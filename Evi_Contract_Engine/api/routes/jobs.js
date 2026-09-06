const express = require('express');
// Use persistent job store (PostgreSQL-backed) for Railway redeployment durability
const jobStore = require('../lib/jobStore');
const { 
  getJob, getJobSync, appendJobLog, getJobLogs, listJobs, getJobByAddress, getStats, getFullJobData,
  getContractArtifacts, getDeploymentHistory, getDeploymentsByAddress
} = require('../lib/jobStore');

module.exports = () => {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   - name: Jobs
   *     description: Background job status and logs APIs
   */

  // GET /api/job/:id - Get full job object
  /**
   * @swagger
   * /api/job/{id}:
   *   get:
   *     tags: [Jobs]
   *     summary: Get full job details
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Full job object
   *       404:
   *         description: Job not found
   */
  router.get('/:id', async (req, res) => {
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND' });
    return res.json(job);
  });

  // GET /api/job/:id/status
  /**
   * @swagger
   * /api/job/{id}/status:
   *   get:
   *     tags: [Jobs]
   *     summary: Get job status (slim by default)
   *     description: Append `?verbose=1` to include full job object including logs array.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: verbose
   *         schema: { type: string }
   *         description: Set to 1/true to include full job payload and logs
   *     responses:
   *       200:
   *         description: Job status
   *       404:
   *         description: Job not found
   */
  router.get('/:id/status', async (req, res) => {
    const verbose = String(req.query.verbose || '').toLowerCase();
    const wantsVerbose = verbose === '1' || verbose === 'true' || verbose === 'yes';
    const job = await getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND' });

    if (wantsVerbose) return res.json({ ok: true, data: job });

    const {
      id, type, payload, state, progress, step, stepHistory, timings, result, error,
      createdAt, updatedAt, logsCount, lastLogTs
    } = job;
    const slim = { id, type, payload, state, progress, step, stepHistory, timings, result, error, createdAt, updatedAt, logsCount, lastLogTs };
    return res.json({ ok: true, data: slim });
  });

  // GET /api/job/:id/logs
  // Query params:
  // - since: timestamp (ms)
  // - afterIndex: return logs with i > afterIndex
  // - level: comma-separated filter (info,warn,error,debug)
  // - contains: substring filter
  // - limit: max number of entries (default 500)
  // - offset: offset after filtering (default 0)
  // - ndjson: 1 to output newline-delimited JSON instead of a JSON envelope
  /**
   * @swagger
   * /api/job/{id}/logs:
   *   get:
   *     tags: [Jobs]
   *     summary: Get logs for a job with filters and pagination
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: since
   *         schema: { type: integer }
   *         description: Return logs with timestamp > since (ms)
   *       - in: query
   *         name: afterIndex
   *         schema: { type: integer }
   *         description: Return logs with index i > afterIndex
   *       - in: query
   *         name: level
   *         schema: { type: string }
   *         description: Comma-separated level filter (info,warn,error,debug)
   *       - in: query
   *         name: contains
   *         schema: { type: string }
   *         description: Substring filter over log message
   *       - in: query
   *         name: limit
   *         schema: { type: integer }
   *         description: Max number of logs to return (default 500)
   *       - in: query
   *         name: offset
   *         schema: { type: integer }
   *         description: Offset applied after filtering
   *       - in: query
   *         name: ndjson
   *         schema: { type: string }
   *         description: Set to 1 to stream newline-delimited JSON instead of a JSON envelope
   *     responses:
   *       200:
   *         description: Logs payload or NDJSON output
   *       404:
   *         description: Job not found
   */
  router.get('/:id/logs', async (req, res) => {
    const { id } = req.params;
    const job = await getJob(id);
    if (!job) return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND' });

    const since = Number(req.query.since || 0) || 0;
    const afterIndex = Number(req.query.afterIndex || 0) || 0;
    const levelParam = String(req.query.level || '').trim();
    const contains = String(req.query.contains || '');
    const ndjson = String(req.query.ndjson || '') === '1';
    let limit = Number(req.query.limit || 500) || 500;
    let offset = Number(req.query.offset || 0) || 0;
    if (limit < 1) limit = 1; if (limit > 5000) limit = 5000;
    if (offset < 0) offset = 0;

    const levelSet = new Set(
      levelParam ? levelParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : []
    );

    let logs = Array.isArray(job.logs) ? job.logs : [];
    if (since) logs = logs.filter(l => l.t > since);
    if (afterIndex) logs = logs.filter(l => (l.i || 0) > afterIndex);
    if (levelSet.size) logs = logs.filter(l => levelSet.has(String(l.level || '').toLowerCase()));
    if (contains) logs = logs.filter(l => String(l.msg || '').includes(contains));

    const total = logs.length;
    if (offset) logs = logs.slice(offset);
    if (limit) logs = logs.slice(0, limit);

    if (ndjson) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      for (const entry of logs) {
        res.write(JSON.stringify(entry) + '\n');
      }
      return res.end();
    }

    return res.json({ ok: true, data: { id, total, count: logs.length, logs } });
  });

  // GET /api/job/:id/logs/stream (Server-Sent Events)
  /**
   * @swagger
   * /api/job/{id}/logs/stream:
   *   get:
   *     tags: [Jobs]
   *     summary: Real-time logs stream (Server-Sent Events)
   *     description: |
   *       Emits events: 'hello', 'log', 'heartbeat', and 'end'.
   *       Produces text/event-stream.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: afterIndex
   *         schema: { type: integer }
   *         description: Start streaming logs with index greater than this value
   *     responses:
   *       200:
   *         description: SSE stream of logs
   *         content:
   *           text/event-stream: {}
   *       404:
   *         description: Job not found
   */
  router.get('/:id/logs/stream', async (req, res) => {
    const { id } = req.params;
    const job = getJobSync(id); // Use sync for SSE - will get from cache
    if (!job) return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const toSSE = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let lastIndex = Number(req.query.afterIndex || 0) || 0;
    toSSE('hello', { id, lastIndex });

    const interval = setInterval(() => {
      const j = getJobSync(id);
      if (!j) {
        toSSE('end', { reason: 'JOB_GONE' });
        clearInterval(interval);
        return res.end();
      }
      const newLogs = (j.logs || []).filter(l => (l.i || 0) > lastIndex);
      for (const entry of newLogs) {
        toSSE('log', entry);
        lastIndex = Math.max(lastIndex, entry.i || 0);
      }
      const terminal = j.state === 'completed' || j.state === 'failed';
      if (terminal && newLogs.length === 0) {
        toSSE('end', { state: j.state });
        clearInterval(interval);
        return res.end();
      }
      // Heartbeat
      toSSE('heartbeat', { ts: Date.now(), lastIndex });
    }, 1000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  // GET /api/job - List all jobs with filters (from PostgreSQL)
  /**
   * @swagger
   * /api/job:
   *   get:
   *     tags: [Jobs]
   *     summary: List jobs from persistent storage
   *     description: Returns jobs from PostgreSQL database. Survives Railway redeployments.
   *     parameters:
   *       - in: query
   *         name: state
   *         schema: { type: string, enum: [queued, running, completed, failed] }
   *         description: Filter by job state
   *       - in: query
   *         name: type
   *         schema: { type: string }
   *         description: Filter by job type (e.g., ai_pipeline)
   *       - in: query
   *         name: network
   *         schema: { type: string }
   *         description: Filter by deployment network
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 50 }
   *         description: Max results (default 50)
   *       - in: query
   *         name: offset
   *         schema: { type: integer, default: 0 }
   *         description: Pagination offset
   *     responses:
   *       200:
   *         description: List of jobs
   */
  router.get('/', async (req, res) => {
    try {
      const { state, type, network, limit = 50, offset = 0 } = req.query;
      const jobs = await listJobs({
        state: state || undefined,
        type: type || undefined,
        network: network || undefined,
        limit: Math.min(100, Number(limit) || 50),
        offset: Number(offset) || 0,
      });
      return res.json({ ok: true, count: jobs.length, jobs });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/job/by-address/:address - Get job by deployed contract address
  /**
   * @swagger
   * /api/job/by-address/{address}:
   *   get:
   *     tags: [Jobs]
   *     summary: Get job by deployed contract address
   *     description: Look up a job using its deployed contract address from PostgreSQL.
   *     parameters:
   *       - in: path
   *         name: address
   *         required: true
   *         schema: { type: string }
   *         description: Deployed contract address (0x...)
   *     responses:
   *       200:
   *         description: Job found
   *       404:
   *         description: No job found for this address
   */
  router.get('/by-address/:address', async (req, res) => {
    try {
      const job = await getJobByAddress(req.params.address);
      if (!job) return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND_FOR_ADDRESS' });
      return res.json({ ok: true, job });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/job/stats - Get deployment statistics
  /**
   * @swagger
   * /api/job/stats:
   *   get:
   *     tags: [Jobs]
   *     summary: Get job and deployment statistics
   *     description: Returns aggregate statistics from PostgreSQL database.
   *     responses:
   *       200:
   *         description: Statistics object
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = await getStats();
      return res.json({ ok: true, stats });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/job/:id/full - Get complete job data with audit, compliance, verification
  /**
   * @swagger
   * /api/job/{id}/full:
   *   get:
   *     tags: [Jobs]
   *     summary: Get complete job data including audit, compliance, and verification
   *     description: Returns job with all related reports from PostgreSQL database.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *         description: Job ID
   *     responses:
   *       200:
   *         description: Full job data with audit, compliance, and verification reports
   *       404:
   *         description: Job not found
   */
  router.get('/:id/full', async (req, res) => {
    try {
      const fullJob = await getFullJobData(req.params.id);
      if (!fullJob) return res.status(404).json({ ok: false, error: 'JOB_NOT_FOUND' });
      return res.json({ ok: true, job: fullJob });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/job/:id/artifacts - Get contract artifacts for a job
  /**
   * @swagger
   * /api/job/{id}/artifacts:
   *   get:
   *     tags: [Jobs]
   *     summary: Get contract artifacts (ABI, bytecode, source, deploy script) for a job
   *     description: |
   *       Returns all compiled artifacts stored for this job including:
   *       - ABI (Application Binary Interface)
   *       - Bytecode and deployed bytecode
   *       - Source files
   *       - Deploy scripts
   *       - Compiler settings and metadata
   *       - NatSpec documentation
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *         description: Job ID
   *     responses:
   *       200:
   *         description: Contract artifacts array
   *       404:
   *         description: No artifacts found for job
   */
  router.get('/:id/artifacts', async (req, res) => {
    try {
      const artifacts = await getContractArtifacts(req.params.id);
      if (!artifacts || artifacts.length === 0) {
        return res.status(404).json({ ok: false, error: 'NO_ARTIFACTS_FOUND', jobId: req.params.id });
      }
      return res.json({ ok: true, artifacts });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/job/:id/deployments - Get deployment history for a job
  /**
   * @swagger
   * /api/job/{id}/deployments:
   *   get:
   *     tags: [Jobs]
   *     summary: Get deployment history for a job
   *     description: |
   *       Returns all deployments for this job including:
   *       - Network and chain information
   *       - Contract address and deployer
   *       - Transaction details (hash, block, gas)
   *       - Constructor arguments
   *       - Verification status
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *         description: Job ID
   *     responses:
   *       200:
   *         description: Deployment history array
   *       404:
   *         description: No deployments found for job
   */
  router.get('/:id/deployments', async (req, res) => {
    try {
      const deployments = await getDeploymentHistory(req.params.id);
      if (!deployments || deployments.length === 0) {
        return res.status(404).json({ ok: false, error: 'NO_DEPLOYMENTS_FOUND', jobId: req.params.id });
      }
      return res.json({ ok: true, deployments });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/job/by-address/:address - Get deployments by contract address
  /**
   * @swagger
   * /api/job/by-address/{address}:
   *   get:
   *     tags: [Jobs]
   *     summary: Get all deployments for a contract address
   *     description: Returns all deployment records for a given contract address across all networks.
   *     parameters:
   *       - in: path
   *         name: address
   *         required: true
   *         schema: { type: string }
   *         description: Contract address (0x...)
   *     responses:
   *       200:
   *         description: Deployments for the address
   *       404:
   *         description: No deployments found for address
   */
  router.get('/by-address/:address', async (req, res) => {
    try {
      const deployments = await getDeploymentsByAddress(req.params.address);
      if (!deployments || deployments.length === 0) {
        return res.status(404).json({ ok: false, error: 'NO_DEPLOYMENTS_FOUND', address: req.params.address });
      }
      return res.json({ ok: true, deployments });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
};
