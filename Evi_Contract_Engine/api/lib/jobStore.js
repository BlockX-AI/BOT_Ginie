/**
 * Persistent Job Store
 * Hybrid in-memory cache + PostgreSQL persistence
 * Survives Railway redeployments
 */
const { randomUUID } = require('crypto');
const db = require('./db');
const logger = require('./logger');

const JOB_LOGS_MAX_ENTRIES = Math.max(1000, Number(process.env.JOB_LOGS_MAX_ENTRIES || 10000) || 10000);

// In-memory cache for fast access during job execution
const jobsCache = new Map();

// Track if we've loaded from DB on startup
let cacheWarmed = false;

/**
 * Convert DB row to job object
 */
function rowToJob(row) {
  return {
    id: row.id,
    type: row.type,
    state: row.state,
    progress: row.progress || 0,
    step: row.step,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    payload: row.payload || {},
    
    // Contract data
    contract: row.contract_source ? {
      name: row.contract_name,
      filename: row.contract_filename,
      source: row.contract_source,
      abi: row.contract_abi,
      bytecode: row.contract_bytecode,
      metadata: row.contract_metadata,
    } : null,
    
    // Deployment data
    deployment: row.deployment_address ? {
      network: row.deployment_network,
      chainId: row.deployment_chain_id,
      address: row.deployment_address,
      deployer: row.deployment_deployer,
      txHash: row.deployment_tx_hash,
      blockNumber: row.deployment_block_number,
      constructorArgs: row.deployment_constructor_args,
    } : null,
    
    // Timings
    timings: row.timings || { startedAt: null, endedAt: null, phases: {} },
    stepHistory: row.step_history || [],
    
    // Result/error
    result: row.result,
    error: row.error,
    
    // Logs
    logs: row.logs || [],
    _logIndex: (row.logs || []).length,
    logsCount: row.logs_count || 0,
    lastLogTs: row.last_log_ts || 0,
  };
}

/**
 * Warm cache from database on startup
 */
async function warmCache() {
  if (cacheWarmed) return;
  try {
    // Load recent jobs (last 24 hours or running jobs)
    const result = await db.query(`
      SELECT * FROM jobs 
      WHERE created_at > NOW() - INTERVAL '24 hours' 
         OR state IN ('queued', 'running')
      ORDER BY created_at DESC
      LIMIT 1000
    `);
    
    for (const row of result.rows) {
      jobsCache.set(row.id, rowToJob(row));
    }
    
    logger.info({ count: result.rows.length }, 'Job cache warmed from database');
    cacheWarmed = true;
  } catch (err) {
    logger.error({ err }, 'Failed to warm job cache from database');
    cacheWarmed = true; // Mark as warmed to avoid retry loops
  }
}

/**
 * Create a new job (persisted to DB)
 */
async function createJob(type, payload = {}) {
  const id = `${type}_${randomUUID()}`;
  const now = Date.now();
  
  const job = {
    id,
    type,
    state: 'queued',
    progress: 0,
    createdAt: now,
    updatedAt: now,
    payload,
    step: undefined,
    stepHistory: [],
    timings: { startedAt: null, endedAt: null, phases: {} },
    contract: null,
    deployment: null,
    result: null,
    error: null,
    logs: [],
    _logIndex: 0,
    logsCount: 0,
    lastLogTs: 0,
  };
  
  // Save to cache immediately
  jobsCache.set(id, job);
  
  // Persist to database (async, don't block)
  setImmediate(async () => {
    try {
      await db.query(`
        INSERT INTO jobs (id, type, state, progress, payload, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, to_timestamp($6/1000.0), to_timestamp($7/1000.0))
      `, [id, type, 'queued', 0, JSON.stringify(payload), now, now]);
    } catch (err) {
      logger.error({ err, jobId: id }, 'Failed to persist new job to database');
    }
  });
  
  return job;
}

/**
 * Update job (persisted to DB)
 */
async function updateJob(id, patch) {
  const job = jobsCache.get(id);
  if (!job) {
    // Try loading from DB
    try {
      const result = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        const loaded = rowToJob(result.rows[0]);
        jobsCache.set(id, loaded);
        return updateJob(id, patch); // Retry with loaded job
      }
    } catch (err) {
      logger.error({ err, jobId: id }, 'Failed to load job from database');
    }
    return null;
  }
  
  const now = Date.now();
  const prevStep = job.step;
  const nextStep = (patch && Object.prototype.hasOwnProperty.call(patch, 'step')) ? patch.step : prevStep;
  const prevState = job.state;
  const nextState = (patch && Object.prototype.hasOwnProperty.call(patch, 'state')) ? patch.state : prevState;
  
  // Apply patch to cache
  Object.assign(job, patch, { updatedAt: now });
  
  // Record job start time
  if (!job.timings) job.timings = { startedAt: null, endedAt: null, phases: {} };
  if (nextState === 'running' && !job.timings.startedAt) {
    job.timings.startedAt = now;
  }
  
  // Track phase transitions
  if (typeof nextStep === 'string' && nextStep && nextStep !== prevStep) {
    if (prevStep) {
      const prevPhase = job.timings.phases[prevStep] || {};
      if (!prevPhase.startedAt) prevPhase.startedAt = now;
      if (!prevPhase.endedAt) prevPhase.endedAt = now;
      job.timings.phases[prevStep] = prevPhase;
    }
    job.stepHistory.push({ step: nextStep, t: now });
    job.timings.phases[nextStep] = job.timings.phases[nextStep] || {};
    if (!job.timings.phases[nextStep].startedAt) job.timings.phases[nextStep].startedAt = now;
  }
  
  // Mark end time on terminal states
  if ((nextState === 'completed' || nextState === 'failed') && !job.timings.endedAt) {
    job.timings.endedAt = now;
    const cur = job.step;
    if (cur) {
      const phase = job.timings.phases[cur] || {};
      if (!phase.startedAt) phase.startedAt = now;
      if (!phase.endedAt) phase.endedAt = now;
      job.timings.phases[cur] = phase;
    }
  }
  
  // Persist to database (async)
  setImmediate(async () => {
    try {
      await db.query(`
        UPDATE jobs SET
          state = $2,
          progress = $3,
          step = $4,
          updated_at = to_timestamp($5/1000.0),
          timings = $6,
          step_history = $7,
          result = $8,
          error = $9
        WHERE id = $1
      `, [
        id,
        job.state,
        job.progress,
        job.step,
        now,
        JSON.stringify(job.timings),
        JSON.stringify(job.stepHistory),
        job.result ? JSON.stringify(job.result) : null,
        job.error,
      ]);
    } catch (err) {
      logger.error({ err, jobId: id }, 'Failed to persist job update to database');
    }
  });
  
  return job;
}

/**
 * Save contract data for a job
 */
async function saveContract(id, contractData) {
  const job = jobsCache.get(id);
  if (job) {
    job.contract = contractData;
    job.updatedAt = Date.now();
  }
  
  try {
    await db.query(`
      UPDATE jobs SET
        contract_name = $2,
        contract_filename = $3,
        contract_source = $4,
        contract_abi = $5,
        contract_bytecode = $6,
        contract_metadata = $7,
        updated_at = NOW()
      WHERE id = $1
    `, [
      id,
      contractData.name,
      contractData.filename,
      contractData.source,
      JSON.stringify(contractData.abi),
      contractData.bytecode,
      contractData.metadata ? JSON.stringify(contractData.metadata) : null,
    ]);
    logger.info({ jobId: id, contractName: contractData.name }, 'Contract data persisted to database');
  } catch (err) {
    logger.error({ err, jobId: id }, 'Failed to persist contract data to database');
  }
}

/**
 * Save deployment result for a job
 */
async function saveDeployment(id, deploymentData) {
  const job = jobsCache.get(id);
  if (job) {
    job.deployment = deploymentData;
    job.updatedAt = Date.now();
  }
  
  try {
    await db.query(`
      UPDATE jobs SET
        deployment_network = $2,
        deployment_chain_id = $3,
        deployment_address = $4,
        deployment_deployer = $5,
        deployment_tx_hash = $6,
        deployment_block_number = $7,
        deployment_constructor_args = $8,
        updated_at = NOW()
      WHERE id = $1
    `, [
      id,
      deploymentData.network,
      deploymentData.chainId,
      deploymentData.address,
      deploymentData.deployer,
      deploymentData.txHash,
      deploymentData.blockNumber,
      deploymentData.constructorArgs ? JSON.stringify(deploymentData.constructorArgs) : null,
    ]);
    logger.info({ jobId: id, address: deploymentData.address }, 'Deployment data persisted to database');
  } catch (err) {
    logger.error({ err, jobId: id }, 'Failed to persist deployment data to database');
  }
}

/**
 * Get job by ID (from cache or DB)
 */
async function getJob(id) {
  // Check cache first
  if (jobsCache.has(id)) {
    return jobsCache.get(id);
  }
  
  // Try loading from database
  try {
    const result = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      const job = rowToJob(result.rows[0]);
      jobsCache.set(id, job);
      return job;
    }
  } catch (err) {
    logger.error({ err, jobId: id }, 'Failed to load job from database');
  }
  
  return null;
}

/**
 * Synchronous get (cache only, for backward compatibility)
 */
function getJobSync(id) {
  return jobsCache.get(id) || null;
}

/**
 * Append log entry
 */
async function appendJobLog(id, level, msg) {
  const job = jobsCache.get(id);
  if (!job) return null;
  
  const now = Date.now();
  job._logIndex = (job._logIndex || 0) + 1;
  const entry = { i: job._logIndex, t: now, level, msg: String(msg) };
  job.logs.push(entry);
  job.logsCount = (job.logsCount || 0) + 1;
  job.lastLogTs = now;
  
  // Trim logs
  if (job.logs.length > JOB_LOGS_MAX_ENTRIES) {
    job.logs.splice(0, job.logs.length - JOB_LOGS_MAX_ENTRIES);
  }
  job.updatedAt = now;
  
  // Mirror to logger
  try {
    const lvl = typeof level === 'string' ? level.toLowerCase() : 'info';
    const fn = (logger[lvl] && typeof logger[lvl] === 'function') ? logger[lvl].bind(logger) : logger.info.bind(logger);
    fn({ jobId: id, type: job.type }, msg);
  } catch (_) {}
  
  // Batch persist logs every 10 entries or on important events
  if (job.logsCount % 10 === 0 || level === 'error' || level === 'warn') {
    setImmediate(async () => {
      try {
        await db.query(`
          UPDATE jobs SET
            logs = $2,
            logs_count = $3,
            last_log_ts = $4,
            updated_at = NOW()
          WHERE id = $1
        `, [id, JSON.stringify(job.logs), job.logsCount, job.lastLogTs]);
      } catch (err) {
        // Silent fail for logs
      }
    });
  }
  
  return entry;
}

/**
 * Get job logs
 */
function getJobLogs(id, sinceTs = 0) {
  const job = jobsCache.get(id);
  if (!job) return [];
  return job.logs.filter(l => (sinceTs ? l.t > sinceTs : true));
}

/**
 * List jobs with filters
 */
async function listJobs({ state, type, network, limit = 50, offset = 0 } = {}) {
  try {
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    let paramIdx = 1;
    
    if (state) {
      query += ` AND state = $${paramIdx++}`;
      params.push(state);
    }
    if (type) {
      query += ` AND type = $${paramIdx++}`;
      params.push(type);
    }
    if (network) {
      query += ` AND deployment_network = $${paramIdx++}`;
      params.push(network);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    return result.rows.map(rowToJob);
  } catch (err) {
    logger.error({ err }, 'Failed to list jobs from database');
    return [];
  }
}

/**
 * Get job by deployment address
 */
async function getJobByAddress(address) {
  try {
    const result = await db.query(
      'SELECT * FROM jobs WHERE LOWER(deployment_address) = LOWER($1)',
      [address]
    );
    if (result.rows.length > 0) {
      return rowToJob(result.rows[0]);
    }
  } catch (err) {
    logger.error({ err, address }, 'Failed to get job by address');
  }
  return null;
}

/**
 * Get deployment stats
 */
async function getStats() {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN state = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN state = 'failed' THEN 1 END) as failed_jobs,
        COUNT(CASE WHEN deployment_address IS NOT NULL THEN 1 END) as deployed_contracts,
        COUNT(DISTINCT deployment_network) as networks_used
      FROM jobs
    `);
    return result.rows[0];
  } catch (err) {
    logger.error({ err }, 'Failed to get job stats');
    return null;
  }
}

/**
 * Save audit report for a job
 */
async function saveAuditReport(jobId, sourceJobId, auditData) {
  try {
    const findings = auditData.findings || [];
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    const mediumCount = findings.filter(f => f.severity === 'medium').length;
    const lowCount = findings.filter(f => f.severity === 'low').length;
    const infoCount = findings.filter(f => f.severity === 'info' || f.severity === 'informational').length;

    await db.query(`
      INSERT INTO audit_reports (
        job_id, source_job_id, overall_score, security_score, gas_score, code_quality_score,
        findings, findings_count, critical_count, high_count, medium_count, low_count, info_count,
        report, summary, recommendations, auditor_version, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
      jobId,
      sourceJobId,
      auditData.score || auditData.overall_score,
      auditData.security_score,
      auditData.gas_score,
      auditData.code_quality_score,
      JSON.stringify(findings),
      findings.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      infoCount,
      JSON.stringify(auditData),
      auditData.summary,
      JSON.stringify(auditData.recommendations || []),
      auditData.version,
      auditData.duration_ms,
    ]);
    logger.info({ jobId, sourceJobId, score: auditData.score }, 'Audit report persisted to database');
  } catch (err) {
    logger.error({ err, jobId }, 'Failed to persist audit report to database');
  }
}

/**
 * Get audit report for a job
 */
async function getAuditReport(jobId) {
  try {
    const result = await db.query(
      'SELECT * FROM audit_reports WHERE job_id = $1 OR source_job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [jobId]
    );
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, jobId }, 'Failed to get audit report');
    return null;
  }
}

/**
 * Save compliance report for a job
 */
async function saveComplianceReport(jobId, sourceJobId, complianceData) {
  try {
    const checks = complianceData.checks || [];
    const passedCount = checks.filter(c => c.status === 'passed' || c.passed).length;
    const failedCount = checks.filter(c => c.status === 'failed' || c.passed === false).length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    await db.query(`
      INSERT INTO compliance_reports (
        job_id, source_job_id, overall_score, checks, passed_count, failed_count, warning_count,
        standards_checked, report, summary, checker_version, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      jobId,
      sourceJobId,
      complianceData.score || complianceData.overall_score,
      JSON.stringify(checks),
      passedCount,
      failedCount,
      warningCount,
      JSON.stringify(complianceData.standards || []),
      JSON.stringify(complianceData),
      complianceData.summary,
      complianceData.version,
      complianceData.duration_ms,
    ]);
    logger.info({ jobId, sourceJobId, score: complianceData.score }, 'Compliance report persisted to database');
  } catch (err) {
    logger.error({ err, jobId }, 'Failed to persist compliance report to database');
  }
}

/**
 * Get compliance report for a job
 */
async function getComplianceReport(jobId) {
  try {
    const result = await db.query(
      'SELECT * FROM compliance_reports WHERE job_id = $1 OR source_job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [jobId]
    );
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, jobId }, 'Failed to get compliance report');
    return null;
  }
}

/**
 * Save verification record for a job
 */
async function saveVerificationRecord(jobId, verificationData) {
  try {
    await db.query(`
      INSERT INTO verification_records (
        job_id, network, contract_address, explorer_name, explorer_url, verification_url,
        status, verified_at, response, error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      jobId,
      verificationData.network,
      verificationData.address,
      verificationData.explorer_name || verificationData.explorerName,
      verificationData.explorer_url || verificationData.explorerUrl,
      verificationData.verification_url || verificationData.verificationUrl,
      verificationData.status || 'verified',
      verificationData.verified_at || new Date(),
      verificationData.response ? JSON.stringify(verificationData.response) : null,
      verificationData.error,
    ]);
    logger.info({ jobId, address: verificationData.address }, 'Verification record persisted to database');
  } catch (err) {
    logger.error({ err, jobId }, 'Failed to persist verification record to database');
  }
}

/**
 * Get verification record for a job
 */
async function getVerificationRecord(jobId) {
  try {
    const result = await db.query(
      'SELECT * FROM verification_records WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1',
      [jobId]
    );
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, jobId }, 'Failed to get verification record');
    return null;
  }
}

/**
 * Get full job data including audit, compliance, and verification
 */
async function getFullJobData(jobId) {
  const job = await getJob(jobId);
  if (!job) return null;

  const [audit, compliance, verification, artifacts] = await Promise.all([
    getAuditReport(jobId),
    getComplianceReport(jobId),
    getVerificationRecord(jobId),
    getContractArtifacts(jobId),
  ]);

  return {
    ...job,
    auditReport: audit,
    complianceReport: compliance,
    verificationRecord: verification,
    artifacts: artifacts,
  };
}

/**
 * Save complete contract artifacts (ABI, bytecode, source, deploy script, etc.)
 */
async function saveContractArtifacts(jobId, artifactData) {
  try {
    // Simple INSERT - no upsert to avoid constraint issues with existing tables
    const result = await db.query(`
      INSERT INTO contract_artifacts (
        job_id, contract_name, fully_qualified_name, solidity_version,
        source_files, main_source_path, abi, bytecode, deployed_bytecode,
        link_references, deployed_link_references, compiler_settings,
        metadata, storage_layout, method_identifiers, gas_estimates,
        deploy_script, deploy_script_name, hardhat_config,
        devdoc, userdoc, source_map, deployed_source_map, immutable_references
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      RETURNING id
    `, [
      jobId,
      artifactData.contractName,
      artifactData.fullyQualifiedName || null,
      artifactData.solidityVersion || null,
      JSON.stringify(artifactData.sourceFiles || {}),
      artifactData.mainSourcePath || null,
      JSON.stringify(artifactData.abi || []),
      artifactData.bytecode || null,
      artifactData.deployedBytecode || null,
      JSON.stringify(artifactData.linkReferences || {}),
      JSON.stringify(artifactData.deployedLinkReferences || {}),
      artifactData.compilerSettings ? JSON.stringify(artifactData.compilerSettings) : null,
      artifactData.metadata ? JSON.stringify(artifactData.metadata) : null,
      artifactData.storageLayout ? JSON.stringify(artifactData.storageLayout) : null,
      JSON.stringify(artifactData.methodIdentifiers || {}),
      artifactData.gasEstimates ? JSON.stringify(artifactData.gasEstimates) : null,
      artifactData.deployScript || null,
      artifactData.deployScriptName || null,
      artifactData.hardhatConfig || null,
      artifactData.devdoc ? JSON.stringify(artifactData.devdoc) : null,
      artifactData.userdoc ? JSON.stringify(artifactData.userdoc) : null,
      artifactData.sourceMap || null,
      artifactData.deployedSourceMap || null,
      JSON.stringify(artifactData.immutableReferences || {}),
    ]);
    logger.info({ jobId, contractName: artifactData.contractName }, 'Contract artifacts persisted to database');
    return result.rows[0]?.id;
  } catch (err) {
    // Log but don't crash - artifacts table may not exist yet
    logger.warn({ err: err.message, jobId }, 'Failed to persist contract artifacts (table may not exist)');
    return null;
  }
}

/**
 * Get contract artifacts for a job
 */
async function getContractArtifacts(jobId) {
  try {
    const result = await db.query(
      'SELECT * FROM contract_artifacts WHERE job_id = $1 ORDER BY created_at DESC',
      [jobId]
    );
    return result.rows.map(row => ({
      id: row.id,
      jobId: row.job_id,
      contractName: row.contract_name,
      fullyQualifiedName: row.fully_qualified_name,
      solidityVersion: row.solidity_version,
      sourceFiles: row.source_files,
      mainSourcePath: row.main_source_path,
      abi: row.abi,
      bytecode: row.bytecode,
      deployedBytecode: row.deployed_bytecode,
      linkReferences: row.link_references,
      deployedLinkReferences: row.deployed_link_references,
      compilerSettings: row.compiler_settings,
      metadata: row.metadata,
      storageLayout: row.storage_layout,
      methodIdentifiers: row.method_identifiers,
      gasEstimates: row.gas_estimates,
      deployScript: row.deploy_script,
      deployScriptName: row.deploy_script_name,
      hardhatConfig: row.hardhat_config,
      devdoc: row.devdoc,
      userdoc: row.userdoc,
      sourceMap: row.source_map,
      deployedSourceMap: row.deployed_source_map,
      immutableReferences: row.immutable_references,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    // Table may not exist yet - return empty array
    return [];
  }
}

/**
 * Save deployment to deployment_history
 */
async function saveDeploymentHistory(jobId, artifactId, deploymentData) {
  try {
    const result = await db.query(`
      INSERT INTO deployment_history (
        job_id, artifact_id, network, chain_id, rpc_url,
        contract_address, deployer_address, transaction_hash, block_number,
        gas_used, gas_price, effective_gas_price,
        constructor_args, encoded_constructor_args, libraries,
        is_verified, explorer_url, status, tx_receipt
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING id
    `, [
      jobId,
      artifactId || null,
      deploymentData.network,
      deploymentData.chainId || null,
      deploymentData.rpcUrl || null,
      deploymentData.contractAddress,
      deploymentData.deployerAddress || null,
      deploymentData.transactionHash || null,
      deploymentData.blockNumber || null,
      deploymentData.gasUsed || null,
      deploymentData.gasPrice || null,
      deploymentData.effectiveGasPrice || null,
      JSON.stringify(deploymentData.constructorArgs || []),
      deploymentData.encodedConstructorArgs || null,
      JSON.stringify(deploymentData.libraries || {}),
      deploymentData.isVerified || false,
      deploymentData.explorerUrl || null,
      deploymentData.status || 'deployed',
      deploymentData.txReceipt ? JSON.stringify(deploymentData.txReceipt) : null,
    ]);
    logger.info({ jobId, address: deploymentData.contractAddress }, 'Deployment history persisted to database');
    return result.rows[0]?.id;
  } catch (err) {
    // Log but don't crash - table may not exist yet
    logger.warn({ err: err.message, jobId }, 'Failed to persist deployment history (table may not exist)');
    return null;
  }
}

/**
 * Get deployment history for a job
 */
async function getDeploymentHistory(jobId) {
  try {
    const result = await db.query(
      'SELECT * FROM deployment_history WHERE job_id = $1 ORDER BY created_at DESC',
      [jobId]
    );
    return result.rows.map(row => ({
      id: row.id,
      jobId: row.job_id,
      artifactId: row.artifact_id,
      network: row.network,
      chainId: row.chain_id,
      rpcUrl: row.rpc_url,
      contractAddress: row.contract_address,
      deployerAddress: row.deployer_address,
      transactionHash: row.transaction_hash,
      blockNumber: row.block_number,
      gasUsed: row.gas_used,
      gasPrice: row.gas_price,
      effectiveGasPrice: row.effective_gas_price,
      constructorArgs: row.constructor_args,
      encodedConstructorArgs: row.encoded_constructor_args,
      libraries: row.libraries,
      isVerified: row.is_verified,
      verifiedAt: row.verified_at,
      explorerUrl: row.explorer_url,
      status: row.status,
      txReceipt: row.tx_receipt,
      createdAt: row.created_at,
    }));
  } catch (err) {
    // Table may not exist yet - return empty array
    return [];
  }
}

/**
 * Get deployments by contract address
 */
async function getDeploymentsByAddress(contractAddress) {
  try {
    const result = await db.query(
      'SELECT * FROM deployment_history WHERE contract_address = $1 ORDER BY created_at DESC',
      [contractAddress]
    );
    return result.rows;
  } catch (err) {
    // Table may not exist yet - return empty array
    return [];
  }
}

/**
 * Update verification status in deployment history
 */
async function updateDeploymentVerification(deploymentId, isVerified, explorerUrl) {
  try {
    await db.query(`
      UPDATE deployment_history SET
        is_verified = $2,
        verified_at = CASE WHEN $2 THEN NOW() ELSE verified_at END,
        explorer_url = COALESCE($3, explorer_url)
      WHERE id = $1
    `, [deploymentId, isVerified, explorerUrl]);
    return true;
  } catch (err) {
    // Table may not exist yet
    return false;
  }
}

module.exports = {
  warmCache,
  createJob,
  updateJob,
  getJob,
  getJobSync,
  saveContract,
  saveDeployment,
  appendJobLog,
  getJobLogs,
  listJobs,
  getJobByAddress,
  getStats,
  // Audit, compliance, verification persistence
  saveAuditReport,
  getAuditReport,
  saveComplianceReport,
  getComplianceReport,
  saveVerificationRecord,
  getVerificationRecord,
  getFullJobData,
  // Contract artifacts and deployment history
  saveContractArtifacts,
  getContractArtifacts,
  saveDeploymentHistory,
  getDeploymentHistory,
  getDeploymentsByAddress,
  updateDeploymentVerification,
};
