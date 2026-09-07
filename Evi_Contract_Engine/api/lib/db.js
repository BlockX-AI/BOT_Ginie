/**
 * PostgreSQL Database Connection
 * Provides persistent storage for jobs, contracts, and deployment data
 */
const { Pool } = require('pg');
const logger = require('./logger');

// Normalize DATABASE_URL - handle Python SQLAlchemy format (postgresql+asyncpg://)
function normalizeConnectionString(url) {
  if (!url) return url;
  // Strip +asyncpg or +psycopg2 or similar Python driver suffixes
  return url.replace(/^postgresql\+[^:]+:\/\//, 'postgresql://');
}

const connectionString = normalizeConnectionString(process.env.DATABASE_URL);

// Connection pool - only create if DATABASE_URL is set
const pool = connectionString ? new Pool({
  connectionString,
  ssl: connectionString?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
}) : null;

// Track initialization state
let initialized = false;
let initPromise = null;

/**
 * Initialize database schema
 */
async function initializeDatabase() {
  if (!pool) {
    logger.warn('DATABASE_URL not configured - skipping database initialization');
    return;
  }
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const client = await pool.connect();
    try {
      // Create jobs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS jobs (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(100) NOT NULL,
          state VARCHAR(50) NOT NULL DEFAULT 'queued',
          progress INTEGER DEFAULT 0,
          step VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Original request payload
          payload JSONB DEFAULT '{}',
          
          -- Contract data
          contract_name VARCHAR(255),
          contract_filename VARCHAR(255),
          contract_source TEXT,
          contract_abi JSONB,
          contract_bytecode TEXT,
          contract_metadata JSONB,
          
          -- Deployment result
          deployment_network VARCHAR(100),
          deployment_chain_id BIGINT,
          deployment_address VARCHAR(66),
          deployment_deployer VARCHAR(66),
          deployment_tx_hash VARCHAR(66),
          deployment_block_number BIGINT,
          deployment_constructor_args JSONB,
          
          -- Timings and history
          timings JSONB DEFAULT '{}',
          step_history JSONB DEFAULT '[]',
          
          -- Result/error
          result JSONB,
          error TEXT,
          
          -- Logs (stored as JSONB array, capped on insert)
          logs JSONB DEFAULT '[]',
          logs_count INTEGER DEFAULT 0,
          last_log_ts BIGINT DEFAULT 0
        );
        
        -- Indexes for common queries
        CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
        CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
        CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_jobs_deployment_address ON jobs(deployment_address);
        CREATE INDEX IF NOT EXISTS idx_jobs_deployment_network ON jobs(deployment_network);
      `);

      // Create audit_reports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_reports (
          id SERIAL PRIMARY KEY,
          job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          source_job_id VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Audit scores
          overall_score INTEGER,
          security_score INTEGER,
          gas_score INTEGER,
          code_quality_score INTEGER,
          
          -- Findings
          findings JSONB DEFAULT '[]',
          findings_count INTEGER DEFAULT 0,
          critical_count INTEGER DEFAULT 0,
          high_count INTEGER DEFAULT 0,
          medium_count INTEGER DEFAULT 0,
          low_count INTEGER DEFAULT 0,
          info_count INTEGER DEFAULT 0,
          
          -- Full report
          report JSONB,
          summary TEXT,
          recommendations JSONB DEFAULT '[]',
          
          -- Metadata
          auditor_version VARCHAR(50),
          duration_ms INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_audit_reports_job_id ON audit_reports(job_id);
        CREATE INDEX IF NOT EXISTS idx_audit_reports_source_job ON audit_reports(source_job_id);
      `);

      // Create compliance_reports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS compliance_reports (
          id SERIAL PRIMARY KEY,
          job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          source_job_id VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Compliance scores
          overall_score INTEGER,
          
          -- Check results
          checks JSONB DEFAULT '[]',
          passed_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          warning_count INTEGER DEFAULT 0,
          
          -- Standards checked
          standards_checked JSONB DEFAULT '[]',
          
          -- Full report
          report JSONB,
          summary TEXT,
          
          -- Metadata
          checker_version VARCHAR(50),
          duration_ms INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_compliance_reports_job_id ON compliance_reports(job_id);
        CREATE INDEX IF NOT EXISTS idx_compliance_reports_source_job ON compliance_reports(source_job_id);
      `);

      // Create verification_records table
      await client.query(`
        CREATE TABLE IF NOT EXISTS verification_records (
          id SERIAL PRIMARY KEY,
          job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Verification details
          network VARCHAR(100),
          contract_address VARCHAR(66),
          explorer_name VARCHAR(100),
          explorer_url TEXT,
          verification_url TEXT,
          
          -- Status
          status VARCHAR(50) DEFAULT 'pending',
          verified_at TIMESTAMPTZ,
          
          -- Response
          response JSONB,
          error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_verification_job_id ON verification_records(job_id);
        CREATE INDEX IF NOT EXISTS idx_verification_address ON verification_records(contract_address);
      `);

      // Create contract_artifacts table for complete artifact storage
      await client.query(`
        CREATE TABLE IF NOT EXISTS contract_artifacts (
          id SERIAL PRIMARY KEY,
          job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Contract identification
          contract_name VARCHAR(255) NOT NULL,
          fully_qualified_name VARCHAR(512),
          solidity_version VARCHAR(50),
          
          -- Source files (can store multiple)
          source_files JSONB DEFAULT '{}',
          main_source_path VARCHAR(512),
          
          -- Compiled artifacts
          abi JSONB NOT NULL DEFAULT '[]',
          bytecode TEXT,
          deployed_bytecode TEXT,
          link_references JSONB DEFAULT '{}',
          deployed_link_references JSONB DEFAULT '{}',
          
          -- Metadata
          compiler_settings JSONB,
          metadata JSONB,
          storage_layout JSONB,
          method_identifiers JSONB DEFAULT '{}',
          gas_estimates JSONB,
          
          -- Deploy script
          deploy_script TEXT,
          deploy_script_name VARCHAR(255),
          
          -- Hardhat config used
          hardhat_config TEXT,
          
          -- NatSpec documentation
          devdoc JSONB,
          userdoc JSONB,
          
          -- Source map for debugging
          source_map TEXT,
          deployed_source_map TEXT,
          
          -- Immutable references (for verified contracts)
          immutable_references JSONB DEFAULT '{}',
          
          -- Unique constraint for upsert
          UNIQUE(job_id, contract_name)
        );
        CREATE INDEX IF NOT EXISTS idx_artifacts_job_id ON contract_artifacts(job_id);
        CREATE INDEX IF NOT EXISTS idx_artifacts_contract_name ON contract_artifacts(contract_name);
        CREATE INDEX IF NOT EXISTS idx_artifacts_fqn ON contract_artifacts(fully_qualified_name);
      `);

      // Create deployment_history table for tracking all deployments
      await client.query(`
        CREATE TABLE IF NOT EXISTS deployment_history (
          id SERIAL PRIMARY KEY,
          job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          artifact_id INTEGER REFERENCES contract_artifacts(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          
          -- Network info
          network VARCHAR(100) NOT NULL,
          chain_id BIGINT,
          rpc_url TEXT,
          
          -- Deployment details
          contract_address VARCHAR(66) NOT NULL,
          deployer_address VARCHAR(66),
          transaction_hash VARCHAR(66),
          block_number BIGINT,
          gas_used BIGINT,
          gas_price BIGINT,
          effective_gas_price BIGINT,
          
          -- Constructor
          constructor_args JSONB DEFAULT '[]',
          encoded_constructor_args TEXT,
          
          -- Libraries linked
          libraries JSONB DEFAULT '{}',
          
          -- Verification status
          is_verified BOOLEAN DEFAULT FALSE,
          verified_at TIMESTAMPTZ,
          explorer_url TEXT,
          
          -- Status
          status VARCHAR(50) DEFAULT 'deployed',
          
          -- Full transaction receipt
          tx_receipt JSONB
        );
        CREATE INDEX IF NOT EXISTS idx_deploy_history_job ON deployment_history(job_id);
        CREATE INDEX IF NOT EXISTS idx_deploy_history_address ON deployment_history(contract_address);
        CREATE INDEX IF NOT EXISTS idx_deploy_history_network ON deployment_history(network);
        CREATE INDEX IF NOT EXISTS idx_deploy_history_chain ON deployment_history(chain_id);
      `);

      logger.info('Database schema initialized successfully');
      initialized = true;
    } catch (err) {
      logger.error({ err }, 'Failed to initialize database schema');
      throw err;
    } finally {
      client.release();
    }
  })();

  return initPromise;
}

/**
 * Get a client from the pool
 */
async function getClient() {
  if (!pool) return null;
  await initializeDatabase();
  return pool.connect();
}

/**
 * Execute a query
 */
async function query(text, params) {
  if (!pool) return { rows: [] };
  await initializeDatabase();
  return pool.query(text, params);
}

/**
 * Check database health
 */
async function healthCheck() {
  if (!pool) {
    return { healthy: false, error: 'DATABASE_URL not configured' };
  }
  try {
    const result = await pool.query('SELECT NOW()');
    return { healthy: true, timestamp: result.rows[0].now };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

/**
 * Close pool (for graceful shutdown)
 */
async function close() {
  if (pool) await pool.end();
}

/**
 * Check if database is configured
 */
function isConfigured() {
  return !!pool;
}

module.exports = {
  pool,
  query,
  getClient,
  initializeDatabase,
  healthCheck,
  close,
  isConfigured,
};
