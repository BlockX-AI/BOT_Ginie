/*
Usage:
  BASE_URL=http://localhost:3000 \
  PROMPT="Create a SimpleStorage contract and deploy" \
  NETWORK=hardhat \
  node scripts/run-pipeline.js

Defaults:
  BASE_URL -> http://localhost:3000
  PROMPT   -> "Create a SimpleStorage contract and deploy"
  NETWORK  -> hardhat
*/

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PROMPT = process.env.PROMPT || 'Create a SimpleStorage contract and deploy';
const NETWORK = process.env.NETWORK || 'hardhat';
const TIMEOUT_S = Number(process.env.TIMEOUT_S || 180);
const POLL_MS = Number(process.env.POLL_MS || 3000);
const STRICT = (String(process.env.STRICT || process.env.STRICT_ARGS || '') === '1');
let ARGS = [];
try {
  if (process.env.ARGS) ARGS = JSON.parse(process.env.ARGS);
} catch (_) {
  console.warn('WARN: Failed to parse ARGS env; expected JSON array like [0, "hello"]. Using [].');
}

async function ensureFetch() {
  if (typeof fetch === 'undefined') {
    const mod = await import('node-fetch');
    global.fetch = mod.default;
  }
}

async function httpPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json };
}

async function httpGet(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, ok: res.ok, json };
}

(async () => {
  await ensureFetch();
  console.log('BASE:', BASE);
  console.log('PROMPT:', PROMPT);
  console.log('NETWORK:', NETWORK);
  console.log('STRICT_ARGS:', STRICT);
  console.log('ARGS:', JSON.stringify(ARGS));

  // 1) Start pipeline job
  const start = await httpPost('/api/ai/pipeline', { prompt: PROMPT, network: NETWORK, strictArgs: STRICT, constructorArgs: ARGS });
  if (!start.ok || !start.json || !start.json.job || !start.json.job.id) {
    console.error('Failed to start pipeline:', start);
    process.exit(1);
  }
  const jobId = start.json.job.id;
  console.log('JOB ID:', jobId);

  // 2) Poll until completed/failed or timeout
  const t0 = Date.now();
  let state = 'queued';
  let step = 'init';
  let progress = 0;
  while (true) {
    const st = await httpGet(`/api/job/${jobId}/status`);
    const data = (st.json && st.json.data) || {};
    state = data.state || state;
    step = data.step || step;
    progress = data.progress || progress;
    console.log(`[STATUS] state=${state} step=${step} progress=${progress}`);
    if (state === 'completed' || state === 'failed') break;
    if (Date.now() - t0 > TIMEOUT_S * 1000) {
      console.warn('Timeout waiting for job');
      break;
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }

  // 3) Fetch final status, logs, and artifacts
  const final = await httpGet(`/api/job/${jobId}/status`);
  const logs = await httpGet(`/api/job/${jobId}/logs?since=0`);
  const arts = await httpGet(`/api/artifacts?include=all`, { 'x-job-id': jobId });

  const data = (final.json && final.json.data) || {};
  const result = data.result || {};
  const summary = {
    ok: true,
    jobId: data.id,
    state: data.state,
    step: data.step,
    progress: data.progress,
    address: result.address || null,
    network: result.network || null,
    contract: result.contract || null,
    fqName: result.fqName || null,
    compiledArtifacts: (arts.json && arts.json.abis ? arts.json.abis.map(a => a.name).slice(0, 10) : []),
    sourcesCount: (arts.json && arts.json.sources ? arts.json.sources.length : 0),
    scriptsCount: (arts.json && arts.json.scripts ? arts.json.scripts.length : 0),
    logsCount: (logs.json && logs.json.data ? logs.json.data.count : 0)
  };

  console.log('\n===== PIPELINE SUMMARY =====');
  console.log(JSON.stringify(summary, null, 2));

  // Optional: show last few log lines for convenience
  try {
    const lines = (logs.json && logs.json.data && logs.json.data.logs) || [];
    const tail = lines.slice(-15).map(l => `[${new Date(l.t).toISOString()}] ${l.level.toUpperCase()}: ${String(l.msg).trim()}`);
    console.log('\n===== LAST LOGS (tail) =====');
    console.log(tail.join('\n'));
  } catch {}
})();
