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

const API_BASE = process.env.API_BASE_URL || 'https://evi-web-test-production.up.railway.app';
const NETWORK = process.env.NETWORK || 'basecamp';
const MAX_ITERS = Number(process.env.MAX_ITERS || 11);
const OUTPUT_ROOT = path.resolve(process.env.OUTPUT_DIR || path.join(process.cwd(), 'ai_pipeline_runs'));

// ============================================================================
// GAME TEMPLATES - Predefined game types for testing the full pipeline
// ============================================================================
const GAME_TEMPLATES = {
  'tic-tac-toe': {
    prompt: `Create a Tic Tac Toe game smart contract. Features:
- Two players take turns marking X or O on a 3x3 grid
- Track game state on-chain with board array
- Detect win conditions (rows, columns, diagonals) and draw
- Emit events for moves, wins, and draws
- Allow starting new games
- Keep constructor empty, gas-efficient design`,
    filename: 'TicTacToe.sol',
    contractName: 'TicTacToe',
    expectedType: 'PVP_TURN'
  },
  'temple-run': {
    prompt: `Create a Temple Run style endless runner game smart contract. Features:
- Player runs and dodges obstacles
- Track distance/score on-chain
- Submit high scores to global leaderboard
- Collect coins during run
- Energy system with cooldowns
- Emit events for game start/end/score submission
- Gas-efficient score verification
- Keep constructor empty`,
    filename: 'TempleRunner.sol',
    contractName: 'TempleRunner',
    expectedType: 'RUNNER'
  },
  '2048': {
    prompt: `Create a 2048 puzzle game smart contract. Features:
- 4x4 grid with sliding tiles
- Merge same numbers when colliding
- Track high scores on-chain
- Global leaderboard
- Emit events for moves and game over
- Gas-efficient state management
- Keep constructor empty`,
    filename: 'Puzzle2048.sol',
    contractName: 'Puzzle2048',
    expectedType: 'PUZZLE'
  },
  'coin-flip': {
    prompt: `Create a Coin Flip betting game smart contract. Features:
- Players bet ETH on heads or tails
- Use commit-reveal for fairness (or VRF placeholder)
- House edge 2%
- Track betting history per player
- Emit events for bets placed and results
- Anti-cheat with commit-reveal pattern
- Keep constructor empty`,
    filename: 'CoinFlipBet.sol',
    contractName: 'CoinFlipBet',
    expectedType: 'BETTING'
  },
  'idle-clicker': {
    prompt: `Create an Idle Clicker game smart contract. Features:
- Players click to earn tokens
- Upgrade multipliers with earned tokens
- Passive income generation over time
- Prestige system to reset with bonuses
- Track total clicks and earnings on-chain
- Gas-efficient batch claiming
- Keep constructor empty`,
    filename: 'IdleClicker.sol',
    contractName: 'IdleClicker',
    expectedType: 'IDLE'
  },
  'rpg-dungeon': {
    prompt: `Create an RPG Dungeon Crawler game smart contract. Features:
- Character creation with stats (STR, DEX, INT)
- Dungeon exploration with random encounters
- Loot drops as NFT items
- Experience and leveling system
- Equipment slots and inventory
- Boss battles with rewards
- Keep constructor empty`,
    filename: 'DungeonCrawler.sol',
    contractName: 'DungeonCrawler',
    expectedType: 'RPG'
  },
  'racing': {
    prompt: `Create a Racing game smart contract. Features:
- Real-time race simulation
- Multiple players compete simultaneously
- Car NFTs with speed/handling stats
- Race entry fees and prize pools
- Leaderboard and rankings
- Emit events for race start/finish/positions
- Keep constructor empty`,
    filename: 'RacingGame.sol',
    contractName: 'RacingGame',
    expectedType: 'PVP_REALTIME'
  },
  'bouncing-balls': {
    prompt: `Create a comprehensive Web3 Bouncing Balls game smart contract. Features:
- Ball NFTs with physics properties
- Arena competitions
- Earn rewards for wins
- Leaderboard system
- Keep constructor empty
- Production-ready, auditable code`,
    filename: 'Web3BouncingBalls.sol',
    contractName: 'Web3BouncingBalls',
    expectedType: 'PVP_REALTIME'
  }
};

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

function printUsage() {
  console.log(`
${color('ACV Test Logic - Game Smart Contract Pipeline + Audit + Compliance', ANSI.brightCyan)}

${color('Usage:', ANSI.bold)}
  node acv-test-logic.js [options]

${color('Options:', ANSI.bold)}
  --game <type>     Select a game template (see list below)
  --job <id>        Reuse an existing job ID (skip pipeline)
  --all             Run all game templates sequentially
  --list            List available game templates
  --help            Show this help message

${color('Available Game Templates:', ANSI.bold)}
${Object.entries(GAME_TEMPLATES).map(([k, v]) => `  ${color(k.padEnd(15), ANSI.green)} → ${v.expectedType.padEnd(12)} (${v.contractName})`).join('\n')}

${color('Environment Variables:', ANSI.bold)}
  API_BASE_URL     API endpoint (default: https://evi-web-test-production.up.railway.app)
  NETWORK          Target network (default: basecamp)
  MAX_ITERS        Max fix iterations (default: 11)
  OUTPUT_DIR       Output directory (default: ./ai_pipeline_runs)

${color('Examples:', ANSI.bold)}
  node acv-test-logic.js --game tic-tac-toe
  node acv-test-logic.js --game temple-run --all
  node acv-test-logic.js --job ai_pipeline_abc123
  node acv-test-logic.js --list
`);
}

async function runGamePipeline(gameKey, gameConfig, runDir) {
  const { prompt, filename, contractName, expectedType } = gameConfig;
  const pipelineDir = path.join(runDir, 'pipeline');
  const fixDir = path.join(runDir, 'fix');
  const verifyDir = path.join(runDir, 'verify');
  const auditDir = path.join(runDir, 'audit');
  const complianceDir = path.join(runDir, 'compliance');
  ensureDir(pipelineDir); ensureDir(fixDir); ensureDir(verifyDir); ensureDir(auditDir); ensureDir(complianceDir);

  console.log(color(`\n${'='.repeat(60)}`, ANSI.cyan));
  console.log(color(`  GAME: ${gameKey.toUpperCase()} (Expected: ${expectedType})`, ANSI.brightCyan));
  console.log(color(`  Contract: ${contractName} → ${filename}`, ANSI.cyan));
  console.log(color(`${'='.repeat(60)}`, ANSI.cyan));

  let primaryJobId = null;
  let primaryKind = 'pipeline';

  // 1) Start Pipeline
  console.log('\n' + color('▶ Starting AI Pipeline...', ANSI.brightYellow));
  try {
    const resp = await startPipeline({
      prompt,
      network: NETWORK,
      maxIters: MAX_ITERS,
      contractName,
      filename,
      constructorArgs: [],
      strictArgs: true,
      context: `Game type: ${expectedType}. End-to-end ACV run.`
    });
    primaryJobId = resp?.job?.id;
    writeJson(path.join(pipelineDir, 'start.response.json'), resp);
    writeText(path.join(pipelineDir, 'job.id'), primaryJobId || '');
    console.log(color(`  Job ID: ${primaryJobId}`, ANSI.gray));

    const ssePipeline = streamJobLogsSSE(primaryJobId, pipelineDir, 'pipeline').catch((e) => console.warn('[pipeline] SSE error:', e.message));
    const pipelineStatus = await waitForCompletion(primaryJobId, pipelineDir, 'pipeline');
    await ssePipeline;
    writeJson(path.join(pipelineDir, 'final.status.json'), pipelineStatus);
    await saveArtifacts(primaryJobId, pipelineDir);

    const st = pipelineStatus?.data?.state;
    const res = pipelineStatus?.data?.result || null;
    if (st === 'completed') {
      console.log(color(`\n✅ Pipeline COMPLETED`, ANSI.brightGreen));
      if (res?.address) console.log(color(`   Deployed: ${res.address}`, ANSI.brightGreen));
    } else {
      console.log(color(`\n❌ Pipeline FAILED: ${pipelineStatus?.data?.error || 'unknown'}`, ANSI.brightRed));
      // Attempt fix flow
      console.log('\n' + color('▶ Attempting Fix Flow...', ANSI.brightYellow));
      let errorText = '';
      try {
        const logsResp = await getJobLogs(primaryJobId, { limit: 5000 });
        errorText = extractErrorsFromLogs(logsResp?.data?.logs || []);
      } catch (_) {}
      let code = '';
      try {
        const arts = await downloadArtifacts(primaryJobId);
        code = arts?.sources?.[0]?.content || '';
      } catch (_) {}
      if (code.trim()) {
        const fixResp = await startFix({ code, errors: errorText, context: 'Fix after pipeline failure', network: NETWORK, filename, constructorArgs: [], contractName, maxIters: MAX_ITERS });
        const fixJobId = fixResp?.job?.id;
        primaryJobId = fixJobId;
        primaryKind = 'fix';
        writeJson(path.join(fixDir, 'start.response.json'), fixResp);
        const sseFix = streamJobLogsSSE(fixJobId, fixDir, 'fix').catch((e) => console.warn('[fix] SSE error:', e.message));
        const fixStatus = await waitForCompletion(fixJobId, fixDir, 'fix');
        await sseFix;
        writeJson(path.join(fixDir, 'final.status.json'), fixStatus);
        await saveArtifacts(fixJobId, fixDir);
        if (fixStatus?.data?.state === 'completed') {
          console.log(color(`\n✅ Fix COMPLETED`, ANSI.brightGreen));
          if (fixStatus?.data?.result?.address) console.log(color(`   Deployed: ${fixStatus.data.result.address}`, ANSI.brightGreen));
        }
      }
    }
  } catch (e) {
    console.error(color(`Pipeline error: ${e.message}`, ANSI.brightRed));
    return { gameKey, success: false, error: e.message };
  }

  if (!primaryJobId) {
    return { gameKey, success: false, error: 'No job ID' };
  }

  // 2) Verify
  console.log('\n' + color('▶ Verifying Contract...', ANSI.brightYellow));
  let verifyResult = null;
  try {
    const verifyResp = await verifyByJobReq(primaryJobId, NETWORK);
    writeJson(path.join(verifyDir, 'byJob.response.json'), verifyResp);
    if (verifyResp?.verified) {
      console.log(color(`✅ Verified: ${verifyResp.explorerUrl || ''}`, ANSI.brightGreen));
      verifyResult = { verified: true, url: verifyResp.explorerUrl };
    } else {
      console.log(color(`⚠️  Verify response: ${JSON.stringify(verifyResp)}`, ANSI.brightYellow));
      verifyResult = { verified: false };
    }
  } catch (e) {
    console.warn(color(`Verify error: ${e.message}`, ANSI.brightYellow));
    verifyResult = { verified: false, error: e.message };
  }

  // 3) Audit
  console.log('\n' + color('▶ Running Security Audit...', ANSI.brightYellow));
  let auditResult = null;
  try {
    const auditStart = await startAuditOrchestrate({ jobId: primaryJobId, network: NETWORK });
    const auditJobId = auditStart?.job?.id;
    writeJson(path.join(auditDir, 'start.response.json'), auditStart);
    if (auditJobId) {
      const sseAudit = streamJobLogsSSE(auditJobId, auditDir, 'audit').catch((e) => console.warn('[audit] SSE error:', e.message));
      const auditStatus = await waitForCompletion(auditJobId, auditDir, 'audit');
      await sseAudit;
      writeJson(path.join(auditDir, 'final.status.json'), auditStatus);
      try {
        let auditArt = await fetchAuditReport(primaryJobId).catch(() => null);
        if (!auditArt) auditArt = await fetchAuditReport(auditJobId).catch(() => null);
        if (auditArt) {
          writeJson(path.join(auditDir, 'report.json'), auditArt);
          const score = auditArt?.score || auditArt?.data?.score;
          console.log(color(`✅ Audit Score: ${score}/100`, ANSI.brightGreen));
          auditResult = { score, report: auditArt };
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn(color(`Audit error: ${e.message}`, ANSI.brightYellow));
    auditResult = { error: e.message };
  }

  // 4) Compliance
  console.log('\n' + color('▶ Running Compliance Check...', ANSI.brightYellow));
  let complianceResult = null;
  try {
    const compStart = await startComplianceOrchestrate({ jobId: primaryJobId, targetProfile: 'generic', strict: false, network: NETWORK });
    const compJobId = compStart?.job?.id;
    writeJson(path.join(complianceDir, 'start.response.json'), compStart);
    if (compJobId) {
      const sseComp = streamJobLogsSSE(compJobId, complianceDir, 'compliance').catch((e) => console.warn('[compliance] SSE error:', e.message));
      const compStatus = await waitForCompletion(compJobId, complianceDir, 'compliance');
      await sseComp;
      writeJson(path.join(complianceDir, 'final.status.json'), compStatus);
      try {
        let compArt = await fetchComplianceReport(primaryJobId).catch(() => null);
        if (!compArt) compArt = await fetchComplianceReport(compJobId).catch(() => null);
        if (compArt) {
          writeJson(path.join(complianceDir, 'report.json'), compArt);
          const score = compArt?.score || compArt?.data?.score;
          console.log(color(`✅ Compliance Score: ${score}/100`, ANSI.brightGreen));
          complianceResult = { score, report: compArt };
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn(color(`Compliance error: ${e.message}`, ANSI.brightYellow));
    complianceResult = { error: e.message };
  }

  // Save final artifacts
  const primaryOut = path.join(runDir, `primary_${primaryKind}`);
  ensureDir(primaryOut);
  try { await saveArtifacts(primaryJobId, primaryOut); } catch (_) {}

  return {
    gameKey,
    success: true,
    jobId: primaryJobId,
    verify: verifyResult,
    audit: auditResult,
    compliance: complianceResult
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const getArg = (name) => { const i = argv.indexOf(name); return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null; };
  const hasFlag = (name) => argv.includes(name);

  // Help
  if (hasFlag('--help') || hasFlag('-h')) {
    printUsage();
    return;
  }

  // List games
  if (hasFlag('--list')) {
    console.log(color('\nAvailable Game Templates:', ANSI.brightCyan));
    for (const [k, v] of Object.entries(GAME_TEMPLATES)) {
      console.log(`  ${color(k.padEnd(15), ANSI.green)} → ${color(v.expectedType.padEnd(12), ANSI.yellow)} (${v.contractName})`);
    }
    return;
  }

  const reuseJobId = getArg('--job');
  const selectedGame = getArg('--game');
  const runAll = hasFlag('--all');

  console.log(color('\n╔══════════════════════════════════════════════════════════════╗', ANSI.cyan));
  console.log(color('║     ACV Test Logic - Game Smart Contract Pipeline            ║', ANSI.brightCyan));
  console.log(color('╚══════════════════════════════════════════════════════════════╝', ANSI.cyan));
  console.log(`API_BASE_URL = ${color(API_BASE, ANSI.gray)}`);
  console.log(`NETWORK      = ${color(NETWORK, ANSI.gray)}`);
  console.log(`MAX_ITERS    = ${color(MAX_ITERS, ANSI.gray)}`);
  console.log(`OUTPUT_DIR   = ${color(OUTPUT_ROOT, ANSI.gray)}`);

  // If reusing a job, run ACV only
  if (reuseJobId) {
    console.log(color(`\nReusing existing job: ${reuseJobId}`, ANSI.cyan));
    const runName = `${stamp()}-reuse`;
    const runDir = path.join(OUTPUT_ROOT, runName);

    const verifyDir = path.join(runDir, 'verify');
    const auditDir = path.join(runDir, 'audit');
    const complianceDir = path.join(runDir, 'compliance');
    ensureDir(verifyDir); ensureDir(auditDir); ensureDir(complianceDir);

    // Run ACV only
    console.log('\n' + color('▶ Verifying Contract...', ANSI.brightYellow));
    try {
      const verifyResp = await verifyByJobReq(reuseJobId, NETWORK);
      writeJson(path.join(verifyDir, 'byJob.response.json'), verifyResp);
      if (verifyResp?.verified) console.log(color(`✅ Verified: ${verifyResp.explorerUrl || ''}`, ANSI.brightGreen));
    } catch (e) { console.warn('Verify error:', e.message); }

    console.log('\n' + color('▶ Running Security Audit...', ANSI.brightYellow));
    try {
      const auditStart = await startAuditOrchestrate({ jobId: reuseJobId, network: NETWORK });
      const auditJobId = auditStart?.job?.id;
      if (auditJobId) {
        const sseAudit = streamJobLogsSSE(auditJobId, auditDir, 'audit').catch(() => {});
        await waitForCompletion(auditJobId, auditDir, 'audit');
        await sseAudit;
        const auditArt = await fetchAuditReport(reuseJobId).catch(() => null);
        if (auditArt) {
          writeJson(path.join(auditDir, 'report.json'), auditArt);
          console.log(color(`✅ Audit Score: ${auditArt?.score || auditArt?.data?.score}/100`, ANSI.brightGreen));
        }
      }
    } catch (e) { console.warn('Audit error:', e.message); }

    console.log('\n' + color('▶ Running Compliance Check...', ANSI.brightYellow));
    try {
      const compStart = await startComplianceOrchestrate({ jobId: reuseJobId, targetProfile: 'generic', strict: false, network: NETWORK });
      const compJobId = compStart?.job?.id;
      if (compJobId) {
        const sseComp = streamJobLogsSSE(compJobId, complianceDir, 'compliance').catch(() => {});
        await waitForCompletion(compJobId, complianceDir, 'compliance');
        await sseComp;
        const compArt = await fetchComplianceReport(reuseJobId).catch(() => null);
        if (compArt) {
          writeJson(path.join(complianceDir, 'report.json'), compArt);
          console.log(color(`✅ Compliance Score: ${compArt?.score || compArt?.data?.score}/100`, ANSI.brightGreen));
        }
      }
    } catch (e) { console.warn('Compliance error:', e.message); }

    console.log(color('\nACV flow complete. Outputs saved under: ' + runDir, ANSI.brightGreen));
    return;
  }

  // Determine which games to run
  let gamesToRun = [];
  if (runAll) {
    gamesToRun = Object.keys(GAME_TEMPLATES);
  } else if (selectedGame) {
    if (!GAME_TEMPLATES[selectedGame]) {
      console.error(color(`Unknown game: ${selectedGame}. Use --list to see available games.`, ANSI.brightRed));
      process.exitCode = 1;
      return;
    }
    gamesToRun = [selectedGame];
  } else {
    // Default: run bouncing-balls for backward compatibility
    gamesToRun = ['bouncing-balls'];
  }

  // Run each game
  const results = [];
  for (const gameKey of gamesToRun) {
    const gameConfig = GAME_TEMPLATES[gameKey];
    const runName = `${stamp()}-${gameKey}`;
    const runDir = path.join(OUTPUT_ROOT, runName);
    ensureDir(runDir);

    const result = await runGamePipeline(gameKey, gameConfig, runDir);
    results.push(result);

    // Save summary
    writeJson(path.join(runDir, 'summary.json'), result);
  }

  // Print final summary
  console.log(color('\n╔══════════════════════════════════════════════════════════════╗', ANSI.cyan));
  console.log(color('║                    FINAL SUMMARY                             ║', ANSI.brightCyan));
  console.log(color('╚══════════════════════════════════════════════════════════════╝', ANSI.cyan));
  console.log('');
  for (const r of results) {
    const status = r.success ? color('✅ SUCCESS', ANSI.brightGreen) : color('❌ FAILED', ANSI.brightRed);
    const audit = r.audit?.score ? `Audit: ${r.audit.score}` : 'Audit: N/A';
    const comp = r.compliance?.score ? `Compliance: ${r.compliance.score}` : 'Compliance: N/A';
    const verify = r.verify?.verified ? '✓ Verified' : '✗ Not Verified';
    console.log(`  ${r.gameKey.padEnd(15)} ${status}  ${audit}  ${comp}  ${verify}`);
  }
  console.log('');
  console.log(color(`Outputs saved under: ${OUTPUT_ROOT}`, ANSI.gray));
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exitCode = 1;
});
