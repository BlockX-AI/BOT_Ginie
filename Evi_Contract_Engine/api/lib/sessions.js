// Session management for wallet-based deployments
// Stores temporary transaction data for user signing workflow

const { randomUUID } = require('crypto');
const logger = require('./logger');

// In-memory session store (use Redis in production for scalability)
const sessions = new Map();

// Session expiry time (15 minutes)
const SESSION_EXPIRY_MS = 15 * 60 * 1000;

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(sessionId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info({ cleaned }, 'Cleaned expired sessions');
  }
}, 5 * 60 * 1000);

/**
 * Create a new signing session
 * @param {object} data - Session data
 * @returns {object} Created session
 */
function createSession(data) {
  const sessionId = `sess_${randomUUID()}`;
  const now = Date.now();
  
  const session = {
    sessionId,
    jobId: data.jobId,
    userWallet: data.userWallet || null,
    unsignedTx: data.unsignedTx,
    contractName: data.contractName,
    network: data.network,
    chainId: data.chainId,
    estimatedGas: data.estimatedGas,
    callbackUrl: data.callbackUrl,
    status: 'pending_signature', // pending_signature | signed | expired | failed
    createdAt: now,
    expiresAt: now + SESSION_EXPIRY_MS,
    createdIP: data.ip || null,
    txHash: null,
    signedAt: null,
    metadata: data.metadata || {}
  };
  
  sessions.set(sessionId, session);
  
  logger.info({ 
    sessionId, 
    jobId: data.jobId, 
    network: data.network 
  }, 'Session created');
  
  return session;
}

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @returns {object|null} Session or null if not found/expired
 */
function getSession(sessionId) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  // Check if expired
  if (session.expiresAt < Date.now()) {
    session.status = 'expired';
    sessions.delete(sessionId);
    logger.warn({ sessionId }, 'Session expired');
    return null;
  }
  
  return session;
}

/**
 * Update session
 * @param {string} sessionId - Session ID
 * @param {object} updates - Fields to update
 * @returns {object|null} Updated session or null
 */
function updateSession(sessionId, updates) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    logger.warn({ sessionId }, 'Session not found for update');
    return null;
  }
  
  // Check if expired
  if (session.expiresAt < Date.now()) {
    session.status = 'expired';
    sessions.delete(sessionId);
    return null;
  }
  
  Object.assign(session, updates);
  sessions.set(sessionId, session);
  
  logger.info({ sessionId, updates: Object.keys(updates) }, 'Session updated');
  
  return session;
}

/**
 * Mark session as signed and consume it
 * @param {string} sessionId - Session ID
 * @param {string} txHash - Transaction hash
 * @param {string} walletAddress - Wallet that signed
 * @returns {object|null} Session or null
 */
function signSession(sessionId, txHash, walletAddress) {
  const session = getSession(sessionId);
  
  if (!session) {
    return null;
  }
  
  if (session.status !== 'pending_signature') {
    logger.warn({ sessionId, status: session.status }, 'Session not in pending state');
    return null;
  }
  
  session.status = 'signed';
  session.txHash = txHash;
  session.userWallet = walletAddress;
  session.signedAt = Date.now();
  
  sessions.set(sessionId, session);
  
  logger.info({ 
    sessionId, 
    txHash, 
    wallet: walletAddress 
  }, 'Session signed');
  
  // Sessions auto-expire after use, but keep for a bit for status checks
  setTimeout(() => {
    sessions.delete(sessionId);
    logger.debug({ sessionId }, 'Session cleaned up after use');
  }, 60 * 1000); // Delete after 1 minute
  
  return session;
}

/**
 * Delete session
 * @param {string} sessionId - Session ID
 */
function deleteSession(sessionId) {
  const existed = sessions.delete(sessionId);
  if (existed) {
    logger.info({ sessionId }, 'Session deleted');
  }
  return existed;
}

/**
 * Get sessions by job ID
 * @param {string} jobId - Job ID
 * @returns {array} Array of sessions
 */
function getSessionsByJob(jobId) {
  const result = [];
  for (const session of sessions.values()) {
    if (session.jobId === jobId) {
      result.push(session);
    }
  }
  return result;
}

/**
 * Get session statistics
 * @returns {object} Stats
 */
function getStats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;
  let signed = 0;
  
  for (const session of sessions.values()) {
    if (session.expiresAt < now) {
      expired++;
    } else if (session.status === 'signed') {
      signed++;
    } else if (session.status === 'pending_signature') {
      active++;
    }
  }
  
  return {
    total: sessions.size,
    active,
    signed,
    expired
  };
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  signSession,
  deleteSession,
  getSessionsByJob,
  getStats
};
