// Simple in-memory job store for MVP. Replace with Redis/BullMQ in production.
const { randomUUID } = require('crypto');
const logger = require('./logger');
const JOB_LOGS_MAX_ENTRIES = Math.max(1000, Number(process.env.JOB_LOGS_MAX_ENTRIES || 10000) || 10000);

const jobs = new Map();

function createJob(type, payload = {}) {
  const id = `${type}_${randomUUID()}`;
  const now = Date.now();
  const job = {
    id,
    type,
    state: 'queued', // queued | running | completed | failed
    progress: 0,
    createdAt: now,
    updatedAt: now,
    payload,
    // Slim status helpers
    step: undefined, // current step string
    stepHistory: [], // [{ step: string, t: number }]
    timings: {       // overall and per-phase timings
      startedAt: null,
      endedAt: null,
      phases: {}     // { [step]: { startedAt?: number, endedAt?: number } }
    },
    // Result/error
    result: null,
    error: null,
    // Logging
    logs: [],        // array of { i: number, t: number, level: string, msg: string }
    _logIndex: 0,    // auto-increment index for logs
    logsCount: 0,    // total logs ever appended (monotonic)
    lastLogTs: 0,    // timestamp of the last appended log
  };
  jobs.set(id, job);
  return job;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;

  const now = Date.now();
  const prevStep = job.step;
  const nextStep = (patch && Object.prototype.hasOwnProperty.call(patch, 'step')) ? patch.step : prevStep;
  const prevState = job.state;
  const nextState = (patch && Object.prototype.hasOwnProperty.call(patch, 'state')) ? patch.state : prevState;

  // Apply patch
  Object.assign(job, patch, { updatedAt: now });

  // Record job start time
  if (!job.timings) job.timings = { startedAt: null, endedAt: null, phases: {} };
  if (nextState === 'running' && !job.timings.startedAt) {
    job.timings.startedAt = now;
  }

  // Track phase transitions and timings
  if (typeof nextStep === 'string' && nextStep && nextStep !== prevStep) {
    // Close previous phase if open
    if (prevStep) {
      const prevPhase = job.timings.phases[prevStep] || {};
      if (!prevPhase.startedAt) prevPhase.startedAt = now;
      if (!prevPhase.endedAt) prevPhase.endedAt = now;
      job.timings.phases[prevStep] = prevPhase;
    }
    // Open new phase
    job.stepHistory.push({ step: nextStep, t: now });
    job.timings.phases[nextStep] = job.timings.phases[nextStep] || {};
    if (!job.timings.phases[nextStep].startedAt) job.timings.phases[nextStep].startedAt = now;
  }

  // Mark end time on terminal states
  if ((nextState === 'completed' || nextState === 'failed') && !job.timings.endedAt) {
    job.timings.endedAt = now;
    // Close current phase end time if not set
    const cur = job.step;
    if (cur) {
      const phase = job.timings.phases[cur] || {};
      if (!phase.startedAt) phase.startedAt = now;
      if (!phase.endedAt) phase.endedAt = now;
      job.timings.phases[cur] = phase;
    }
  }

  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

function appendJobLog(id, level, msg) {
  const job = jobs.get(id);
  if (!job) return null;
  const now = Date.now();
  job._logIndex = (job._logIndex || 0) + 1;
  const entry = { i: job._logIndex, t: now, level, msg: String(msg) };
  job.logs.push(entry);
  job.logsCount = (job.logsCount || 0) + 1;
  job.lastLogTs = now;
  // Trim to last JOB_LOGS_MAX_ENTRIES entries to cap memory
  if (job.logs.length > JOB_LOGS_MAX_ENTRIES) job.logs.splice(0, job.logs.length - JOB_LOGS_MAX_ENTRIES);
  job.updatedAt = now;
  // Mirror to global logger for unified observability
  try {
    const lvl = typeof level === 'string' ? level.toLowerCase() : 'info';
    const fn = (logger[lvl] && typeof logger[lvl] === 'function') ? logger[lvl].bind(logger) : logger.info.bind(logger);
    fn({ jobId: id, type: job.type }, msg);
  } catch (_) {}
  return entry;
}

function getJobLogs(id, sinceTs = 0) {
  const job = jobs.get(id);
  if (!job) return [];
  return job.logs.filter(l => (sinceTs ? l.t > sinceTs : true));
}

module.exports = { createJob, updateJob, getJob, appendJobLog, getJobLogs };
