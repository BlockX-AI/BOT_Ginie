#!/usr/bin/env node
/*
  acv-test-logic.js

  End-to-end ACV (AI → Contract → Verify → Audit → Compliance) runner.
  - Starts the /api/ai/pipeline (or uses --job to reuse an existing jobId)
  - Streams logs via /api/job/:id/logs/stream and polls status
  - Saves artifacts (sources/ABIs/scripts) for the primary job
  - Verifies the deployed contract via /api/verify/byJob
  - Runs audit and compliance against the job code via /api/audit/byJob and /api/compliance/byJob
  - Fetches and saves audit/compliance reports via /api/artifacts/*

  Environment variables:
  - API_BASE_URL (default: https://evi-v4-production.up.railway.app)
  - NETWORK (default: basecamp)
  - MAX_ITERS (default: 11)
  - OUTPUT_DIR (default: <repoRoot>/ai_pipeline_runs)
*/

const fs = require('fs');
const path = require('path');

// Simple ANSI color helpers (no external deps)
const ANSI = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', underline: '\x1b[4m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m',
  gray: '\x1b[90m', brightRed: '\x1b[91m', brightGreen: '\x1b[92m', brightYellow: '\x1b[93m', brightBlue: '\x1b[94m', brightMagenta: '\x1b[95m', brightCyan: '\x1b[96m', brightWhite: '\x1b[97m'
};
function color(str, c) { return c + String(str) + ANSI.reset; }
function byLevel(level, s) {
  const lvl = String(level || '').toLowerCase();
  if (lvl === 'error') return color(s, ANSI.brightRed);
  if (lvl === 'warn') return color(s, ANSI.brightYellow);
  if (lvl === 'debug') return color(s, ANSI.brightMagenta);
  if (lvl === 'success') return color(s, ANSI.brightGreen);
  if (lvl === 'info') return color(s, ANSI.cyan);
  return color(s, ANSI.white);
}
function highlightKeywords(s) {
  return String(s)
    .replace(/(TypeError:)/g, (_, a) => color(a, ANSI.brightRed) + ' ')
    .replace(/(SyntaxError:)/g, (_, a) => color(a, ANSI.brightRed) + ' ')
    .replace(/(Warning:)/g, (_, a) => color(a, ANSI.brightYellow) + ' ')
    .replace(/(Error\s+HH\d+)/g, (_, a) => color(a, ANSI.brightRed))
    .replace(/(DEPLOY_RESULT)/g, (_, a) => color(a, ANSI.brightGreen))
    .replace(/(-->)/g, (_, a) => color(a, ANSI.gray));
}

const API_BASE = process.env.API_BASE_URL || 'https://evi-v4-production.up.railway.app';
const NETWORK = process.env.NETWORK || 'basecamp';
const MAX_ITERS = Number(process.env.MAX_ITERS || 11);
const OUTPUT_ROOT = path.resolve(process.env.OUTPUT_DIR || path.join(process.cwd(), 'ai_pipeline_runs'));

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function nowIso() { return new Date().toISOString(); }
function stamp() { return nowIso().replace(/[:]/g, '-').replace(/\..+/, ''); }
function writeJson(filePath, obj) { ensureDir(path.dirname(filePath)); fs.writeFileSync(filePath, JSON.stringify(obj, null, 2)); }
function writeText(filePath, txt) { ensureDir(path.dirname(filePath)); fs.writeFileSync(filePath, String(txt ?? ''), 'utf8'); }
function appendNdjson(filePath, objs) { ensureDir(path.dirname(filePath)); const lines = (Array.isArray(objs) ? objs : [objs]).map((o) => JSON.stringify(o)).join('\n') + '\n'; fs.appendFileSync(filePath, lines, 'utf8'); }

// Stream SSE logs for a job and print colorful output
async function streamJobLogsSSE(jobId, outDir, label, { afterIndex = 0 } = {}) {
  const url = `${API_BASE}/api/job/${encodeURIComponent(jobId)}/logs/stream?afterIndex=${afterIndex}`;
  const logsFile = path.join(outDir, 'logs.ndjson');
  ensureDir(outDir);
  console.log(color(`[${label}] Connecting SSE: ${url}`, ANSI.gray));

  const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'text/event-stream' } });
  if (!res.ok || !res.body) throw new Error(`SSE connection failed: ${res.status} ${res.statusText}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastIdx = afterIndex || 0;

  const flushEvent = (eventName, dataStr) => {
    if (!eventName) return;
    let data = null;
    try { data = dataStr ? JSON.parse(dataStr) : null; } catch (_) { data = dataStr; }
    if (eventName === 'hello') {
      const li = Number(data && data.lastIndex);
      if (Number.isFinite(li)) lastIdx = li;
      console.log(color(`[${label}] hello lastIndex=${lastIdx}`, ANSI.gray));
      return;
    }
    if (eventName === 'heartbeat') return;
    if (eventName === 'log') {
      const entry = data || {};
      const idx = Number(entry.i || 0);
      const ts = new Date(Number(entry.t || Date.now())).toISOString();
      const lvl = String(entry.level || 'info').toLowerCase();
      const message = String(entry.msg || '');
      const greenHint = /DEPLOY_RESULT|Deploy success|Stage:\s+deploy|Contract chosen for deploy/.test(message);
      const effective = greenHint ? 'success' : lvl;
      const icon = lvl === 'error' ? '❌' : (lvl === 'warn' ? '⚠️ ' : (lvl === 'debug' ? '🔍' : (greenHint ? '✅' : 'ℹ️')));
      const prefix = `${color(`[${label}]`, ANSI.dim)} ${color(`#${idx}`, ANSI.gray)} ${color(ts, ANSI.gray)} ${byLevel(effective, effective.toUpperCase())} ${icon}`;
      const lines = message.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const ln = highlightKeywords(lines[i]);
        const cont = i === 0 ? '' : '    ';
        console.log(`${prefix} ${byLevel(effective, cont + ln)}`);
      }
      try { appendNdjson(logsFile, entry); } catch (_) {}
      if (!lastIdx || idx > lastIdx) lastIdx = idx;
      return;
    }
    if (eventName === 'end') { console.log(color(`[${label}] SSE stream ended`, ANSI.gray)); return; }
    console.log(color(`[${label}] event=${eventName}`, ANSI.gray), data);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = raw.split('\n');
      let ev = '', data = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) ev = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += (data ? '\n' : '') + line.slice(6);
      }
      flushEvent(ev, data);
    }
  }
}

async function http(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
    err.status = res.status;
    err.response = json || text;
    throw err;
  }
  return json;
}

// API helpers
async function startPipeline({ prompt, network, maxIters, contractName, filename, constructorArgs, strictArgs, context }) {
  return http('POST', `${API_BASE}/api/ai/pipeline`, {
    prompt,
    network,
    maxIters,
    contractName,
    filename,
    constructorArgs: constructorArgs || [],
    strictArgs,
    context: context || ''
  });
}
async function startFix({ code, errors, context, network, filename, constructorArgs, contractName, maxIters }) {
  return http('POST', `${API_BASE}/api/ai/fix`, {
    code,
    errors: errors || '',
    context: context || '',
    network,
    filename,
    constructorArgs: constructorArgs || [],
    contractName,
    maxIters
  });
}
async function getJobStatus(id, { verbose = false } = {}) {
  const qs = verbose ? '?verbose=1' : '';
  return http('GET', `${API_BASE}/api/job/${encodeURIComponent(id)}/status${qs}`);
}
async function getJobLogs(id, { since, afterIndex, level, contains, limit, offset } = {}) {
  const params = new URLSearchParams();
  if (since) params.set('since', String(Number(since) || 0));
  if (afterIndex) params.set('afterIndex', String(Number(afterIndex) || 0));
  if (level) params.set('level', String(level));
  if (contains) params.set('contains', String(contains));
  if (limit) params.set('limit', String(Number(limit) || 0));
  if (offset) params.set('offset', String(Number(offset) || 0));
  return http('GET', `${API_BASE}/api/job/${encodeURIComponent(id)}/logs?${params.toString()}`);
}
async function downloadArtifacts(jobId) {
  return http('GET', `${API_BASE}/api/artifacts?jobId=${encodeURIComponent(jobId)}&include=all`);
}
async function verifyByJobReq(jobId, network, fullyQualifiedName) {
  return http('POST', `${API_BASE}/api/verify/byJob`, { jobId, network, fullyQualifiedName });
}
async function auditByJobReq(jobId, model, policy) {
  return http('POST', `${API_BASE}/api/audit/byJob`, { jobId, model, policy });
}
async function complianceByJobReq(jobId, model, profile, strict, policyPack, policyChecks) {
  return http('POST', `${API_BASE}/api/compliance/byJob`, { jobId, model, profile, strict, policyPack, policyChecks });
}
async function startAuditOrchestrate({ code, jobId, fix = false, deploy = false, network, model, fixModel, constructorArgs = [] }) {
  return http('POST', `${API_BASE}/api/audit/orchestrate`, { code, jobId, fix, deploy, network, model, fixModel, constructorArgs });
}
async function startComplianceOrchestrate({ code, jobId, targetProfile = 'generic', strict = false, fix = false, deploy = false, network, model, fixModel, constructorArgs = [] }) {
  return http('POST', `${API_BASE}/api/compliance/orchestrate`, { code, jobId, targetProfile, strict, fix, deploy, network, model, fixModel, constructorArgs });
}
async function fetchAuditReport(jobId) {
  return http('GET', `${API_BASE}/api/artifacts/audit?jobId=${encodeURIComponent(jobId)}`);
}
async function fetchComplianceReport(jobId) {
  return http('GET', `${API_BASE}/api/artifacts/compliance?jobId=${encodeURIComponent(jobId)}`);
}

function extractErrorsFromLogs(logs) {
  const parts = [];
  for (const l of logs || []) {
    const lvl = String(l.level || '').toLowerCase();
    if (lvl === 'error' || lvl === 'warn') parts.push(l.msg || '');
  }
  return parts.join('\n');
}

// Poll status only until terminal state
async function waitForCompletion(jobId, outDir, label) {
  ensureDir(outDir);
  const statusFile = path.join(outDir, 'status.json');
  const slimFile = path.join(outDir, 'status.slim.json');
  const startedAt = Date.now();

  while (true) {
    let statusResp;
    try { statusResp = await getJobStatus(jobId, { verbose: true }); }
    catch (e) { console.error(`[${label}] status error:`, e.message); await sleep(2000); continue; }

    writeJson(statusFile, statusResp);
    try {
      const j = statusResp.data || {};
      const slim = { id: j.id, type: j.type, state: j.state, progress: j.progress, step: j.step, result: j.result, error: j.error, updatedAt: j.updatedAt, createdAt: j.createdAt };
      writeJson(slimFile, { ok: true, data: slim });
    } catch (_) {}

    const state = statusResp?.data?.state;
    if (state === 'completed' || state === 'failed') return statusResp;

    if (Date.now() - startedAt > 45 * 60 * 1000) { console.error(`[${label}] timeout waiting for job ${jobId}`); return statusResp; }
    await sleep(2000);
  }
}

async function saveArtifacts(jobId, outDir) {
  try {
    const payload = await downloadArtifacts(jobId);
    writeJson(path.join(outDir, 'artifacts.summary.json'), payload);

    const base = path.join(outDir, 'artifacts');
    const srcBase = path.join(base, 'sources');
    const abiBase = path.join(base, 'abis');
    const scriptsBase = path.join(base, 'scripts');

    for (const s of payload.sources || []) {
      const dest = path.join(srcBase, s.path);
      ensureDir(path.dirname(dest));
      fs.writeFileSync(dest, s.content || '', 'utf8');
    }
    for (const a of payload.abis || []) {
      const dest = path.join(abiBase, a.path);
      ensureDir(path.dirname(dest));
      fs.writeFileSync(dest, JSON.stringify(a, null, 2), 'utf8');
    }
    for (const sc of payload.scripts || []) {
      const dest = path.join(scriptsBase, sc.path);
      ensureDir(path.dirname(dest));
      fs.writeFileSync(dest, sc.content || '', 'utf8');
    }
    return payload;
  } catch (e) {
    console.warn('Artifacts download failed:', e.message);
    return null;
  }
}

async function main() {
  // CLI: allow using an existing job id
  const argv = process.argv.slice(2);
  const getArg = (name) => { const i = argv.indexOf(name); return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null; };
  const reuseJobId = getArg('--job');

  const runName = `${stamp()}-ACV`;
  const runDir = path.join(OUTPUT_ROOT, runName);
  const pipelineDir = path.join(runDir, 'pipeline');
  const fixDir = path.join(runDir, 'fix');
  const verifyDir = path.join(runDir, 'verify');
  const auditDir = path.join(runDir, 'audit');
  const complianceDir = path.join(runDir, 'compliance');
  ensureDir(pipelineDir); ensureDir(fixDir); ensureDir(verifyDir); ensureDir(auditDir); ensureDir(complianceDir);

  const prompt = `Create a comprehensive Web3 Bouncing Balls game smart contract with the following requirements:
Keep the constructor args as empty 
## Overview
A blockchain-based physics game where players own ball NFTs, compete in arenas, and earn rewards.

Please implement this as a production-ready, auditable smart contract with comprehensive inline documentation.`;
  const filename = 'Web3BouncingBalls.sol';
  const contractName = 'Web3BouncingBalls';
  const constructorArgs = ['0xTreasuryAddress'];

  console.log('API_BASE_URL =', API_BASE);
  console.log('NETWORK      =', NETWORK);
  console.log('OUTPUT_DIR   =', runDir);

  // Determine the primary job id: reuse or run pipeline
  let primaryJobId = reuseJobId ? String(reuseJobId) : null;
  let primaryKind = reuseJobId ? 'reuse' : 'pipeline';

  if (!primaryJobId) {
    console.log('\nStarting AI pipeline...');
    try {
      const resp = await startPipeline({
        prompt,
        network: NETWORK,
        maxIters: MAX_ITERS,
        contractName,
        filename,
        constructorArgs,
        strictArgs: true,
        context: 'End-to-end ACV run (generate+deploy -> verify -> audit/compliance)'
      });
      const pipelineJobId = resp?.job?.id;
      primaryJobId = pipelineJobId;
      writeJson(path.join(pipelineDir, 'start.response.json'), resp);
      writeText(path.join(pipelineDir, 'job.id'), pipelineJobId || '');
      console.log('Pipeline job id:', pipelineJobId);

      // Stream logs and wait
      const ssePipeline = streamJobLogsSSE(pipelineJobId, pipelineDir, 'pipeline').catch((e) => console.warn('[pipeline] SSE error:', e.message));
      const pipelineStatus = await waitForCompletion(pipelineJobId, pipelineDir, 'pipeline');
      await ssePipeline;
      writeJson(path.join(pipelineDir, 'final.status.json'), pipelineStatus);

      // Save artifacts
      await saveArtifacts(pipelineJobId, pipelineDir);

      const st = pipelineStatus?.data?.state;
      const res = pipelineStatus?.data?.result || null;
      if (st === 'completed') {
        console.log(color('Pipeline state: ' + st, ANSI.brightGreen));
        if (res?.address) console.log(color('Deployed address: ' + res.address, ANSI.brightGreen));
      } else {
        console.log('Pipeline state:', st);
        if (res?.address) console.log('Deployed address:', res.address);
      }

      // If failed, attempt fix flow and switch primary to fix job if it completes
      if (st !== 'completed') {
        console.log('\nPipeline failed. Starting AI fix...');
        // Gather error context
        let errorText = '';
        try {
          const logsResp = await getJobLogs(pipelineJobId, { limit: 5000 });
          const fullLogs = logsResp?.data?.logs || [];
          writeJson(path.join(pipelineDir, 'logs.snapshot.json'), logsResp);
          errorText = extractErrorsFromLogs(fullLogs);
        } catch (e) { console.warn('Could not fetch full logs for error context:', e.message); }
        writeText(path.join(pipelineDir, 'aggregated.errors.txt'), errorText);

        // Try pull generated source
        let code = '';
        try {
          const arts = await downloadArtifacts(pipelineJobId);
          const sources = Array.isArray(arts?.sources) ? arts.sources : [];
          const preferred = sources[0];
          if (preferred) code = String(preferred.content || '');
        } catch (_) {}

        if (!code.trim()) {
          console.error('No source code found from pipeline artifacts; cannot start fix.');
        } else {
          try {
            const fixResp = await startFix({ code, errors: errorText, context: 'Fix after pipeline failure', network: NETWORK, filename, constructorArgs, contractName, maxIters: MAX_ITERS });
            const fixJobId = fixResp?.job?.id;
            primaryJobId = fixJobId;
            primaryKind = 'fix';
            writeJson(path.join(fixDir, 'start.response.json'), fixResp);
            writeText(path.join(fixDir, 'job.id'), fixJobId || '');
            console.log('Fix job id:', fixJobId);

            const sseFix = streamJobLogsSSE(fixJobId, fixDir, 'fix').catch((e) => console.warn('[fix] SSE error:', e.message));
            const fixStatus = await waitForCompletion(fixJobId, fixDir, 'fix');
            await sseFix;
            writeJson(path.join(fixDir, 'final.status.json'), fixStatus);

            await saveArtifacts(fixJobId, fixDir);
            const fixState = fixStatus?.data?.state;
            const fixResult = fixStatus?.data?.result || null;
            console.log('Fix state:', fixState);
            if (fixResult?.address) console.log('Fix deployed address:', fixResult.address);
          } catch (e) {
            console.error('Failed to start/follow fix job:', e.message);
          }
        }
      }
    } catch (e) {
      console.error('Failed to start pipeline:', e.message);
      process.exitCode = 1;
      return;
    }
  } else {
    console.log(color(`Reusing existing job: ${primaryJobId}`, ANSI.cyan));
  }

  if (!primaryJobId) {
    console.error('No primary job id available. Exiting.');
    process.exitCode = 1; return;
  }

  // 1) Verify deployed contract (if any) using byJob
  console.log('\nVerifying contract on explorer...');
  try {
    const verifyResp = await verifyByJobReq(primaryJobId, NETWORK);
    writeJson(path.join(verifyDir, 'byJob.response.json'), verifyResp);
    if (verifyResp?.stdout) writeText(path.join(verifyDir, 'stdout.txt'), verifyResp.stdout);
    if (verifyResp?.error || verifyResp?.ok === false) {
      console.warn(color('Verify failed or returned error payload. Check stdout/stderr in response.', ANSI.brightYellow));
    } else if (verifyResp?.verified) {
      console.log(color(`Verified ✓ ${verifyResp.explorerUrl || ''}`, ANSI.brightGreen));
    } else {
      console.log('Verify response:', verifyResp);
    }
  } catch (e) {
    console.warn('Verify error:', e.message);
  }

  // 2) Audit: start orchestrate, stream SSE, persist status and report
  console.log('\nStarting Audit orchestrate...');
  try {
    const auditStart = await startAuditOrchestrate({ jobId: primaryJobId, network: NETWORK });
    const auditJobId = auditStart?.job?.id;
    writeJson(path.join(auditDir, 'start.response.json'), auditStart);
    writeText(path.join(auditDir, 'job.id'), auditJobId || '');
    if (auditJobId) {
      const sseAudit = streamJobLogsSSE(auditJobId, auditDir, 'audit').catch((e) => console.warn('[audit] SSE error:', e.message));
      const auditStatus = await waitForCompletion(auditJobId, auditDir, 'audit');
      await sseAudit;
      writeJson(path.join(auditDir, 'final.status.json'), auditStatus);
      // Fetch persisted report via artifacts (mirrored under source job)
      try {
        let auditArt = null;
        try { auditArt = await fetchAuditReport(primaryJobId); } catch (_) {}
        if (!auditArt) { try { auditArt = await fetchAuditReport(auditJobId); } catch (_) {}
        }
        if (auditArt) writeJson(path.join(auditDir, 'report.json'), auditArt);
      } catch (e) { console.warn('Fetch audit artifact failed:', e.message); }
    } else {
      console.warn('Audit orchestrate did not return a job id.');
    }
  } catch (e) {
    console.warn('Audit orchestrate error:', e.message);
  }

  // 3) Compliance: start orchestrate, stream SSE, persist status and report
  console.log('\nStarting Compliance orchestrate...');
  try {
    const compStart = await startComplianceOrchestrate({ jobId: primaryJobId, targetProfile: 'generic', strict: false, network: NETWORK });
    const compJobId = compStart?.job?.id;
    writeJson(path.join(complianceDir, 'start.response.json'), compStart);
    writeText(path.join(complianceDir, 'job.id'), compJobId || '');
    if (compJobId) {
      const sseComp = streamJobLogsSSE(compJobId, complianceDir, 'compliance').catch((e) => console.warn('[compliance] SSE error:', e.message));
      const compStatus = await waitForCompletion(compJobId, complianceDir, 'compliance');
      await sseComp;
      writeJson(path.join(complianceDir, 'final.status.json'), compStatus);
      // Fetch persisted report via artifacts (mirrored under source job)
      try {
        let compArt = null;
        try { compArt = await fetchComplianceReport(primaryJobId); } catch (_) {}
        if (!compArt) { try { compArt = await fetchComplianceReport(compJobId); } catch (_) {}
        }
        if (compArt) writeJson(path.join(complianceDir, 'report.json'), compArt);
      } catch (e) { console.warn('Fetch compliance artifact failed:', e.message); }
    } else {
      console.warn('Compliance orchestrate did not return a job id.');
    }
  } catch (e) {
    console.warn('Compliance orchestrate error:', e.message);
  }

  // 4) Save artifacts for primary job under a unified folder for convenience
  const primaryOut = path.join(runDir, `primary_${primaryKind}`);
  ensureDir(primaryOut);
  try { await saveArtifacts(primaryJobId, primaryOut); } catch (_) {}

  console.log(color('\nACV flow complete. Outputs saved under: ' + runDir, ANSI.brightGreen));
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exitCode = 1;
});
