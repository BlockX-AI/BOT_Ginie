#!/usr/bin/env node
/*
  test-logic.js

  End-to-end runner for the AI pipeline with automatic fix fallback.
  - Starts the /api/ai/pipeline with the Mortgage prompt
  - Polls /api/job/:id/status and /api/job/:id/logs, saves logs & status
  - If pipeline fails, collects failure logs and generated source, then calls /api/ai/fix
  - Polls fix job similarly and saves its artifacts
  - Downloads and saves artifacts (sources/ABIs/scripts) for both jobs under a root-level export directory

  Environment variables:
  - API_BASE_URL (default: https://acadcodegen-production.up.railway.app)
  - NETWORK (default: basecamp-testnet)
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

// Stream SSE from a fully-qualified URL (useful when user pastes the SSE URL directly)
async function streamSSEFromUrl(fullUrl, outDir, label) {
  const logsFile = path.join(outDir, 'logs.ndjson');
  ensureDir(outDir);
  console.log(color(`[${label}] Connecting SSE: ${fullUrl}`, ANSI.gray));

  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: { 'Accept': 'text/event-stream' }
  });
  if (!res.ok || !res.body) throw new Error(`SSE connection failed: ${res.status} ${res.statusText}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flushEvent = (eventName, dataStr) => {
    if (!eventName) return;
    let data = null;
    try { data = dataStr ? JSON.parse(dataStr) : null; } catch (_) { data = dataStr; }
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
      return;
    }
    if (eventName === 'hello' || eventName === 'heartbeat') return;
    if (eventName === 'end') {
      console.log(color(`[${label}] SSE stream ended`, ANSI.gray));
      return;
    }
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
const NETWORK = process.env.NETWORK || 'base-sepolia';
const MAX_ITERS = Number(process.env.MAX_ITERS || 11);
const OUTPUT_ROOT = path.resolve(process.env.OUTPUT_DIR || path.join(process.cwd(), 'ai_pipeline_runs'));

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function nowIso() { return new Date().toISOString(); }
function stamp() { return nowIso().replace(/[:]/g, '-').replace(/\..+/, ''); }
function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}
function writeText(filePath, txt) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, String(txt ?? ''), 'utf8');
}
function appendNdjson(filePath, objs) {
  ensureDir(path.dirname(filePath));
  const lines = (Array.isArray(objs) ? objs : [objs]).map((o) => JSON.stringify(o)).join('\n') + '\n';
  fs.appendFileSync(filePath, lines, 'utf8');
}

// Stream SSE logs for a job and print colorful output
async function streamJobLogsSSE(jobId, outDir, label, { afterIndex = 0 } = {}) {
  const url = `${API_BASE}/api/job/${encodeURIComponent(jobId)}/logs/stream?afterIndex=${afterIndex}`;
  const logsFile = path.join(outDir, 'logs.ndjson');
  ensureDir(outDir);
  console.log(color(`[${label}] Connecting SSE: ${url}`, ANSI.gray));

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'text/event-stream' }
  });
  if (!res.ok || !res.body) {
    throw new Error(`SSE connection failed: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastIdx = afterIndex || 0;
  let closed = false;

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
    if (eventName === 'heartbeat') {
      // optional heartbeat indicator (quiet by default)
      return;
    }
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
        // Indent continuation lines
        const cont = i === 0 ? '' : '    ';
        console.log(`${prefix} ${byLevel(effective, cont + ln)}`);
      }
      // Append to NDJSON file
      try { appendNdjson(logsFile, entry); } catch (_) {}
      if (!lastIdx || idx > lastIdx) lastIdx = idx;
      return;
    }
    if (eventName === 'end') {
      closed = true;
      console.log(color(`[${label}] SSE stream ended`, ANSI.gray));
      return;
    }
    // Unknown events
    console.log(color(`[${label}] event=${eventName}`, ANSI.gray), data);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Process complete SSE events separated by blank line
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

  // Flush any trailing event
  if (buffer.trim()) {
    const lines = buffer.split('\n');
    let ev = '', data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) ev = line.slice(7).trim();
      else if (line.startsWith('data: ')) data += (data ? '\n' : '') + line.slice(6);
    }
    flushEvent(ev, data);
  }

  return { ok: true, closed };
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

function extractErrorsFromLogs(logs) {
  const parts = [];
  for (const l of logs || []) {
    const lvl = String(l.level || '').toLowerCase();
    if (lvl === 'error' || lvl === 'warn') parts.push(l.msg || '');
  }
  return parts.join('\n');
}

async function pollJob(jobId, outDir, label) {
  ensureDir(outDir);
  const statusFile = path.join(outDir, 'status.json');
  const logsFile = path.join(outDir, 'logs.ndjson');
  const slimFile = path.join(outDir, 'status.slim.json');

  let afterIndex = 0;
  const seen = new Set();
  const startedAt = Date.now();

  while (true) {
    let statusResp;
    try {
      statusResp = await getJobStatus(jobId, { verbose: true });
    } catch (e) {
      console.error(`[${label}] status error:`, e.message);
      await sleep(2000);
      continue;
    }

    // Write verbose and slim status snapshots
    writeJson(statusFile, statusResp);
    try {
      const j = statusResp.data || {};
      const slim = {
        id: j.id, type: j.type, state: j.state, progress: j.progress, step: j.step,
        result: j.result, error: j.error, updatedAt: j.updatedAt, createdAt: j.createdAt
      };
      writeJson(slimFile, { ok: true, data: slim });
    } catch (_) {}

    // Fetch incremental logs
    try {
      const logsResp = await getJobLogs(jobId, { afterIndex, limit: 1000 });
      const logs = logsResp?.data?.logs || [];
      const newLogs = [];
      for (const entry of logs) {
        const idx = Number(entry.i || 0);
        if (seen.has(idx)) continue;
        seen.add(idx);
        newLogs.push(entry);
        if (!afterIndex || idx > afterIndex) afterIndex = idx;
      }
      if (newLogs.length) appendNdjson(logsFile, newLogs);
    } catch (e) {
      console.error(`[${label}] logs error:`, e.message);
    }

    const state = statusResp?.data?.state;
    if (state === 'completed' || state === 'failed') {
      return statusResp;
    }

    if (Date.now() - startedAt > 45 * 60 * 1000) {
      console.error(`[${label}] timeout waiting for job ${jobId}`);
      return statusResp;
    }

    await sleep(2000);
  }
}

// Poll only status until terminal state; write snapshots periodically
async function waitForCompletion(jobId, outDir, label) {
  ensureDir(outDir);
  const statusFile = path.join(outDir, 'status.json');
  const slimFile = path.join(outDir, 'status.slim.json');
  const startedAt = Date.now();

  while (true) {
    let statusResp;
    try {
      statusResp = await getJobStatus(jobId, { verbose: true });
    } catch (e) {
      console.error(`[${label}] status error:`, e.message);
      await sleep(2000);
      continue;
    }

    // Write snapshots
    writeJson(statusFile, statusResp);
    try {
      const j = statusResp.data || {};
      const slim = {
        id: j.id,
        type: j.type,
        state: j.state,
        progress: j.progress,
        step: j.step,
        result: j.result,
        error: j.error,
        updatedAt: j.updatedAt,
        createdAt: j.createdAt,
      };
      writeJson(slimFile, { ok: true, data: slim });
    } catch (_) {}

    const state = statusResp?.data?.state;
    if (state === 'completed' || state === 'failed') return statusResp;

    if (Date.now() - startedAt > 45 * 60 * 1000) {
      console.error(`[${label}] timeout waiting for job ${jobId}`);
      return statusResp;
    }
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
  const runName = `${stamp()}-Bank`;
  const runDir = path.join(OUTPUT_ROOT, runName);
  const pipelineDir = path.join(runDir, 'pipeline');
  const fixDir = path.join(runDir, 'fix');
  ensureDir(pipelineDir);
  ensureDir(fixDir);

  const prompt = `I need two Solidity smart contracts that work together for an INR-backed token and a Uniswap v4 hook for UPI withdrawals.
Indian Rupee Token (INRT)
It’s an ERC-20 token named “Indian Rupee Token” with symbol “INRT”.
It represents rupees backed 1:1 by real bank deposits.
Only the owner can mint tokens after confirming a bank deposit, and each mint is tied to a unique bankTxIdso the same deposit can’t be counted twice.
When users withdraw to a UPI bank account, tokens must be burned.
The burn can be triggered either by the owner or by a separate Hook contract that we’ll build.
Keep a running total of the real INR reserves in totalBankReserves.
Increase reserves on mint, decrease on burn.
Track every withdrawal request in a struct containing the user’s address, amount, UPI ID, timestamp, and a processed flag.
Emit events whenever tokens are minted, burned, or a withdrawal is requested, so the backend can listen to them.
Include pausable transfers for emergencies.
Owner should be able to pause/unpause, authorize or revoke the hook contract, and mark a withdrawal as processed after the INR is actually paid out.
Add view functions to check a withdrawal’s details, whether a bankTxId has been processed, and a backing-ratio view that reports totalBankReserves ÷ totalSupply.
CryptoUPIHook

Don’t add any features that aren’t described above.`;
  const filename = 'INRTAndCryptoUPIHook.sol';
  const contractName = 'INRT';
  const constructorArgs = [];

  console.log('API_BASE_URL =', API_BASE);
  console.log('NETWORK      =', NETWORK);
  console.log('OUTPUT_DIR   =', runDir);

  // Start pipeline
  console.log('\nStarting AI pipeline...');
  let pipelineJobId = null;
  try {
    const resp = await startPipeline({
      prompt,
      network: NETWORK,
      maxIters: MAX_ITERS,
      contractName,
      filename,
      constructorArgs,
      strictArgs: true,
      context: 'INRT ERC20 and CryptoUPIHook (Uniswap v4) contract generation and deployment via pipeline'
    });
    pipelineJobId = resp?.job?.id;
    writeJson(path.join(pipelineDir, 'start.response.json'), resp);
    writeText(path.join(pipelineDir, 'job.id'), pipelineJobId || '');
    console.log('Pipeline job id:', pipelineJobId);
  } catch (e) {
    console.error('Failed to start pipeline:', e.message);
    process.exitCode = 1;
    return;
  }

  // Stream verbose logs via SSE while polling status until completion
  const ssePipeline = streamJobLogsSSE(pipelineJobId, pipelineDir, 'pipeline').catch((e) => {
    console.warn('[pipeline] SSE stream error:', e.message);
  });
  const pipelineStatus = await waitForCompletion(pipelineJobId, pipelineDir, 'pipeline');
  await ssePipeline;
  writeJson(path.join(pipelineDir, 'final.status.json'), pipelineStatus);

  // Save pipeline artifacts
  const pipelineArtifacts = await saveArtifacts(pipelineJobId, pipelineDir);

  const pipelineState = pipelineStatus?.data?.state;
  const pipelineResult = pipelineStatus?.data?.result || null;
  if (pipelineState === 'completed') {
    console.log(color('Pipeline state: ' + pipelineState, ANSI.brightGreen));
    if (pipelineResult?.address) {
      console.log(color('Pipeline deployed address: ' + pipelineResult.address, ANSI.brightGreen));
    }
  } else {
    console.log('Pipeline state:', pipelineState);
    if (pipelineResult?.address) {
      console.log('Pipeline deployed address:', pipelineResult.address);
    }
  }

  // If failed, run fix flow using error logs and generated source
  if (pipelineState !== 'completed') {
    console.log('\nPipeline failed. Starting AI fix...');

    // Collect error logs for context (final snapshot)
    let errorText = '';
    try {
      const logsResp = await getJobLogs(pipelineJobId, { limit: 5000 });
      const fullLogs = logsResp?.data?.logs || [];
      writeJson(path.join(pipelineDir, 'logs.snapshot.json'), logsResp);
      errorText = extractErrorsFromLogs(fullLogs);
    } catch (e) {
      console.warn('Could not fetch full logs for error context:', e.message);
    }
    writeText(path.join(pipelineDir, 'aggregated.errors.txt'), errorText);

    // Try to get the generated source from pipeline artifacts
    let code = '';
    try {
      const sources = pipelineArtifacts?.sources || [];
      const preferred = sources.find((s) => path.basename(s.path).toLowerCase().includes('mortgage.sol')) || sources[0];
      if (preferred) code = preferred.content || '';
    } catch (_) {}

    if (!code || !code.trim()) {
      console.error('No source code found from pipeline artifacts; cannot start fix.');
    } else {
      // Start fix job
      let fixJobId = null;
      try {
        const fixResp = await startFix({
          code,
          errors: errorText,
          context: 'Fixing Mortgage contract compile/deploy errors from pipeline',
          network: NETWORK,
          filename,
          constructorArgs,
          contractName,
          maxIters: MAX_ITERS
        });
        fixJobId = fixResp?.job?.id;
        writeJson(path.join(fixDir, 'start.response.json'), fixResp);
        writeText(path.join(fixDir, 'job.id'), fixJobId || '');
        console.log('Fix job id:', fixJobId);

        // Stream fix logs via SSE and wait for completion
        const sseFix = streamJobLogsSSE(fixJobId, fixDir, 'fix').catch((e) => {
          console.warn('[fix] SSE stream error:', e.message);
        });
        const fixStatus = await waitForCompletion(fixJobId, fixDir, 'fix');
        await sseFix;
        writeJson(path.join(fixDir, 'final.status.json'), fixStatus);

        // Save fix artifacts
        const fixArtifacts = await saveArtifacts(fixJobId, fixDir);
        const fixState = fixStatus?.data?.state;
        const fixResult = fixStatus?.data?.result || null;
        console.log('Fix state:', fixState);
        if (fixResult?.address) {
          console.log('Fix deployed address:', fixResult.address);
        }
      } catch (e) {
        console.error('Failed to start/follow fix job:', e.message);
      }
    }
  }

  console.log(color('\nDone. Outputs saved under: ' + runDir, ANSI.brightGreen));
}

// Entry: support streaming-only mode via CLI
async function entry() {
  const argv = process.argv.slice(2);
  const getArg = (name) => {
    const i = argv.indexOf(name);
    return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null;
  };
  if (argv.includes('--stream')) {
    const jobId = getArg('--stream');
    const label = getArg('--label') || 'stream';
    const afterIndex = Number(getArg('--afterIndex') || 0) || 0;
    if (!jobId) {
      console.error('Usage: node test-logic.js --stream <jobId> [--afterIndex 0] [--label label]');
      process.exit(1);
    }
    const outDir = path.join(OUTPUT_ROOT, `stream_${jobId}`);
    await streamJobLogsSSE(jobId, outDir, label, { afterIndex });
    return;
  }
  if (argv.includes('--sse')) {
    const url = getArg('--sse');
    const label = getArg('--label') || 'stream';
    if (!url) {
      console.error('Usage: node test-logic.js --sse <full_sse_url> [--label label]');
      process.exit(1);
    }
    // Derive a folder name from job id in URL if possible
    let jobId = 'custom';
    try {
      const m = url.match(/\/api\/job\/([^/]+)/);
      if (m && m[1]) jobId = m[1];
    } catch (_) {}
    const outDir = path.join(OUTPUT_ROOT, `stream_${jobId}`);
    await streamSSEFromUrl(url, outDir, label);
    return;
  }
  await main();
}

entry().catch((e) => {
  console.error('Fatal error:', e);
  process.exitCode = 1;
});
