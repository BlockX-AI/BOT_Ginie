/*
 REST smoke tests for Compliance endpoints and artifacts helpers.

 Usage:
   BASE_URL=http://localhost:3000 node scripts/test_compliance.js

 Server prerequisites:
 - API server running (node api/server.js)
 - GEMINI_API_KEY exported in the server environment for LLM-backed endpoints
*/

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

async function getText(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; } catch (_) { return { status: res.status, text }; }
}

async function postJson(url, body) {
  return getJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitJob(jobId, { timeoutMs = 60000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const r = await getJson(`${baseUrl}/api/job/${jobId}/status`);
    if (r.status === 200 && r.json?.data) {
      last = r.json.data;
      const state = last.state;
      process.stdout.write(`\rJob ${jobId} state=${state} progress=${last.progress}% step=${last.step || ''}    `);
      if (state === 'completed' || state === 'failed') {
        console.log();
        return last;
      }
    } else {
      console.log(`\nStatus error:`, r);
    }
    await sleep(intervalMs);
  }
  console.log();
  throw new Error(`Timeout waiting for job ${jobId}`);
}

const SAMPLE_CODE = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.19;\ncontract A { function x() public{} }`;

(async () => {
  console.log(`\n>>> Testing Compliance API at ${baseUrl}`);

  // 1) Health
  section('Health /');
  console.log(await getJson(`${baseUrl}/`));

  // 2) Swagger
  section('Swagger /api-docs');
  const docs = await getText(`${baseUrl}/api-docs`);
  console.log({ status: docs.status, ok: docs.status === 200, contentType: docs.headers.get('content-type') });

  // 3) Compliance Analyze (code-based)
  section('POST /api/compliance/analyze');
  const analyze = await postJson(`${baseUrl}/api/compliance/analyze`, { code: SAMPLE_CODE, filename: 'A.sol', profile: 'generic', strict: false });
  console.log({ status: analyze.status, ok: analyze.json?.ok, score: analyze.json?.compliance?.score, checks: analyze.json?.compliance?.checks?.length });
  if (analyze.status !== 200 || !analyze.json?.ok) {
    console.log('Full response:', analyze);
  }

  // 4) Compliance byJob (unknown id -> expect 404)
  section('POST /api/compliance/byJob (unknown id)');
  const byJobUnknown = await postJson(`${baseUrl}/api/compliance/byJob`, { jobId: 'unknown-id', profile: 'generic', strict: false });
  console.log(byJobUnknown);

  // 5) Compliance orchestrate (analyze only)
  section('POST /api/compliance/orchestrate (analyze only)');
  const orch = await postJson(`${baseUrl}/api/compliance/orchestrate`, { code: SAMPLE_CODE, fix: false, deploy: false, targetProfile: 'generic', strict: false });
  console.log('Orchestrate submit:', orch);
  if (orch.status === 202 && orch.json?.job?.id) {
    const jobId = orch.json.job.id;
    const final = await waitJob(jobId, { timeoutMs: 120000, intervalMs: 1500 });
    console.log('Final job status:', { state: final.state, progress: final.progress, step: final.step });

    // 5a) Fetch logs snapshot
    section(`GET /api/job/${jobId}/logs?limit=10`);
    const logs = await getJson(`${baseUrl}/api/job/${jobId}/logs?limit=10`);
    console.log({ status: logs.status, count: logs.json?.data?.count, preview: logs.json?.data?.logs?.slice?.(0, 3) });

    // 5b) Fetch persisted compliance report via artifacts
    section(`GET /api/artifacts/compliance?jobId=${jobId}`);
    const art = await getJson(`${baseUrl}/api/artifacts/compliance?jobId=${jobId}`);
    console.log({ status: art.status, ok: art.json?.ok, hasReport: !!art.json?.report, score: art.json?.report?.score });
    if (art.status !== 200) console.log('Artifacts error:', art);
  } else {
    console.log('Orchestrate did not return a job id; skipping job-related checks.');
  }

  console.log('\n>>> Done');
})().catch((e) => {
  console.error('Test script error:', e);
  process.exit(1);
});

