#!/usr/bin/env node

// End-to-end flow: prompt -> AI pipeline (generate+fix+deploy) -> verify -> compliance -> audit
// Usage:
//   BASE_URL=http://localhost:3000 node scripts/full_flow.js --network basecamp --prompt "your prompt here"
// Or fallback with a code file (uses /api/ai/fix):
//   BASE_URL=http://localhost:3000 node scripts/full_flow.js --network basecamp --code-file contracts/My.sol
// Optional flags:
//   --network <name>           Network to deploy/verify on (default: basecamp)
//   --timeout <seconds>        Max seconds to wait for each job (default: 180)
//   --prompt <text>            Natural language prompt for /api/ai/pipeline
//   --contract-name <name>     Desired contract name hint for pipeline
//   --filename <name>          Target filename hint for pipeline (e.g., Game.sol)
//   --iters <n>                Max pipeline fix iterations
//   --strict-args <true|false> Pipeline constructor args strict mode (default true if unset)
//   --code-file <path>         Read contract code from a file (fallback path that uses /api/ai/fix)

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://evi-v4-production.up.railway.app';

function parseArgs(argv) {
  const args = {
    network: 'basecamp',
    timeout: 180,
    codeFile: '',
    prompt: '',
    contractName: '',
    filename: '',
    iters: undefined,
    strictArgs: undefined,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--network' && argv[i + 1]) { args.network = argv[++i]; continue; }
    if (a === '--timeout' && argv[i + 1]) { args.timeout = Number(argv[++i]) || 180; continue; }
    if (a === '--prompt' && argv[i + 1]) { args.prompt = argv[++i]; continue; }
    if (a === '--contract-name' && argv[i + 1]) { args.contractName = argv[++i]; continue; }
    if (a === '--filename' && argv[i + 1]) { args.filename = argv[++i]; continue; }
    if (a === '--iters' && argv[i + 1]) { args.iters = Number(argv[++i]); continue; }
    if (a === '--strict-args' && argv[i + 1]) {
      const v = String(argv[++i]).toLowerCase();
      args.strictArgs = v === '1' || v === 'true' || v === 'yes';
      continue;
    }
    if (a === '--code-file' && argv[i + 1]) { args.codeFile = argv[++i]; continue; }
  }
  return args;
}

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  try {
    const json = text ? JSON.parse(text) : {};
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: res.ok, status: res.status, text };
  }
}

async function postJSON(url, body) {
  return fetchJSON(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollJob(jobId, timeoutSec = 180) {
  const t0 = Date.now();
  while (true) {
    const { ok, status, json } = await fetchJSON(`${BASE_URL}/api/job/${jobId}/status`);
    if (!ok) throw new Error(`Job status HTTP ${status}`);
    const state = json?.data?.state || json?.error || 'unknown';
    const progress = json?.data?.progress;
    const step = json?.data?.step;
    process.stdout.write(`job ${jobId}: state=${state}${progress != null ? ` progress=${progress}%` : ''}${step ? ` step=${step}` : ''}       \r`);
    if (state === 'completed') {
      process.stdout.write('\n');
      return json?.data;
    }
    if (state === 'failed') {
      process.stdout.write('\n');
      throw new Error(`Job ${jobId} failed`);
    }
    if ((Date.now() - t0) / 1000 > timeoutSec) {
      process.stdout.write('\n');
      throw new Error(`Job ${jobId} timeout after ${timeoutSec}s`);
    }
    await sleep(1500);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const network = args.network || 'basecamp';

  let jobId = '';
  let usedPipeline = false;
  let code = '';

  if (args.prompt && args.prompt.trim()) {
    // Use the pipeline endpoint when a prompt is provided
    console.log('=== Step 1: AI pipeline (generate + fix + deploy) ===');
    const body = { prompt: args.prompt, network };
    if (typeof args.iters === 'number' && Number.isFinite(args.iters) && args.iters > 0) body.maxIters = Math.floor(args.iters);
    if (args.contractName) body.contractName = args.contractName;
    if (args.filename) body.filename = args.filename;
    if (typeof args.strictArgs === 'boolean') body.strictArgs = args.strictArgs;
    const start = await postJSON(`${BASE_URL}/api/ai/pipeline`, body);
    if (!start.ok) throw new Error(`ai/pipeline HTTP ${start.status}`);
    jobId = start.json?.job?.id;
    if (!jobId) throw new Error(`ai/pipeline: missing job id`);
    usedPipeline = true;
  } else {
    // Fallback: use /api/ai/fix with provided code or a default Hello contract
    console.log('=== Step 1: AI fix+deploy ===');
    code = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.19;\ncontract Hello { function ping() external pure returns (string memory){ return \"pong\"; } }\n`;
    if (args.codeFile) {
      const p = path.resolve(args.codeFile);
      if (!fs.existsSync(p)) throw new Error(`code file not found: ${p}`);
      code = fs.readFileSync(p, 'utf8');
    }
    const start = await postJSON(`${BASE_URL}/api/ai/fix`, { code, network });
    if (!start.ok) throw new Error(`ai/fix HTTP ${start.status}`);
    jobId = start.json?.job?.id;
    if (!jobId) throw new Error(`ai/fix: missing job id`);
  }
  console.log('JOB_ID =', jobId);

  const jobData = await pollJob(jobId, args.timeout);
  const address = jobData?.result?.address;
  const fqName = jobData?.result?.fqName;
  if (!address) throw new Error('No address returned from job result');
  console.log('Deployed address =', address);
  console.log('FQN =', fqName);

  console.log('\n=== Step 2: Verify by job ===');
  const verify = await postJSON(`${BASE_URL}/api/verify/byJob`, { jobId, network });
  if (!verify.ok) {
    console.log('verify/byJob failed:', verify.status, verify.json || verify.text);
  } else {
    console.log('verify/byJob:', verify.json);
  }

  console.log('\n=== Step 3: Verify status ===');
  const status = await fetchJSON(`${BASE_URL}/api/verify/status?address=${address}&network=${encodeURIComponent(network)}`);
  if (!status.ok) throw new Error(`verify/status HTTP ${status.status}`);
  console.log(status.json);

  console.log('\n=== Step 4: Compliance orchestrate ===');
  // Pass jobId so the server mirrors artifacts under the source job folder. Only pass code in fix-flow.
  const compPayload = usedPipeline ? { jobId, fix: false, deploy: false } : { code, jobId, fix: false, deploy: false };
  const compStart = await postJSON(`${BASE_URL}/api/compliance/orchestrate`, compPayload);
  if (!compStart.ok) throw new Error(`compliance/orchestrate HTTP ${compStart.status}`);
  const compJob = compStart.json?.job?.id;
  if (!compJob) throw new Error('Compliance orchestrate: missing job id');
  console.log('Compliance JOB =', compJob);

  await pollJob(compJob, args.timeout);
  let compReport = null;
  // Fetch by original AI jobId (mirrored)
  const compArt = await fetchJSON(`${BASE_URL}/api/artifacts/compliance?jobId=${jobId}`);
  if (compArt.ok) {
    compReport = compArt.json?.report || compArt.json;
  } else {
    // fallback: some implementations return report inline on byJob endpoint if needed
    compReport = { note: 'compliance artifact not found' };
  }
  console.log('Compliance summary:', {
    profile: compReport?.profile,
    passed: compReport?.passed,
    score: compReport?.score,
  });

  console.log('\n=== Step 5: Audit orchestrate ===');
  const auditPayload = usedPipeline ? { jobId, fix: false, deploy: false } : { code, jobId, fix: false, deploy: false };
  const auditStart = await postJSON(`${BASE_URL}/api/audit/orchestrate`, auditPayload);
  if (!auditStart.ok) throw new Error(`audit/orchestrate HTTP ${auditStart.status}`);
  const auditJob = auditStart.json?.job?.id;
  if (!auditJob) throw new Error('Audit orchestrate: missing job id');
  console.log('Audit JOB =', auditJob);

  await pollJob(auditJob, args.timeout);
  let auditReport = null;
  const auditArt = await fetchJSON(`${BASE_URL}/api/artifacts/audit?jobId=${jobId}`);
  if (auditArt.ok) {
    auditReport = auditArt.json?.report || auditArt.json;
  } else {
    auditReport = { note: 'audit artifact not found' };
  }
  console.log('Audit summary:', {
    score: auditReport?.score,
    severityMax: auditReport?.severityMax,
    findings: Array.isArray(auditReport?.findings) ? auditReport.findings.length : undefined,
  });

  console.log('\n=== DONE: Summary ===');
  console.log({
    jobId,
    address,
    explorerUrl: `https://basecamp.cloud.blockscout.com/address/${address}#code`,
    verified: status.json?.verified,
    compliance: { profile: compReport?.profile, score: compReport?.score, passed: compReport?.passed },
    audit: { score: auditReport?.score, severityMax: auditReport?.severityMax },
  });
}

main().catch((err) => {
  console.error('\nFlow failed:', err?.message || err);
  process.exit(1);
});
