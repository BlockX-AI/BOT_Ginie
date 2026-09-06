/*
 Smoke tests for Audit & Compliance APIs.

 Usage:
   BASE_URL=http://localhost:3000 node scripts/test-audit-compliance.js

 Notes:
 - The API server must be running and must have GEMINI_API_KEY set in its environment for /api/audit/* and /api/compliance/*.
 - This script does not set server-side env vars; restart the server with GEMINI_API_KEY if needed.
*/

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; } catch (_) { return { status: res.status, text }; }
}

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

const SAMPLE_CODE = `pragma solidity ^0.8.19;\ncontract Sample {\n  function add(uint256 a, uint256 b) public pure returns (uint256) { return a + b; }\n}`;

(async () => {
  console.log(`\n>>> Testing Audit & Compliance APIs at ${baseUrl}`);

  // 1) Health
  logSection('Health /');
  console.log(await getJson(`${baseUrl}/`));

  // 2) Swagger availability
  logSection('Swagger /api-docs');
  const docs = await fetch(`${baseUrl}/api-docs`);
  console.log({ status: docs.status, ok: docs.ok, contentType: docs.headers.get('content-type') });

  // 3) Artifacts (project fallback)
  logSection('Artifacts (project fallback) /api/artifacts?include=sources');
  console.log(await getJson(`${baseUrl}/api/artifacts?include=sources`));

  // 4) Audit analyze (code-based)
  logSection('Audit Analyze /api/audit/analyze');
  const auditAnalyze = await getJson(`${baseUrl}/api/audit/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: SAMPLE_CODE, filename: 'Sample.sol' })
  });
  console.log(auditAnalyze);

  // 5) Compliance analyze (code-based)
  logSection('Compliance Analyze /api/compliance/analyze');
  const complianceAnalyze = await getJson(`${baseUrl}/api/compliance/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: SAMPLE_CODE, filename: 'Sample.sol', profile: 'generic', strict: false })
  });
  console.log(complianceAnalyze);

  // 6) Audit byJob (unknown)
  logSection('Audit byJob (expected 400/404) /api/audit/byJob');
  console.log(await getJson(`${baseUrl}/api/audit/byJob`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: 'unknown-id' })
  }));

  // 7) Compliance byJob (unknown)
  logSection('Compliance byJob (expected 400/404) /api/compliance/byJob');
  console.log(await getJson(`${baseUrl}/api/compliance/byJob`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: 'unknown-id', profile: 'generic', strict: false })
  }));

  // 8) Artifacts audit report (unknown)
  logSection('Artifacts Audit Report (expected 404) /api/artifacts/audit?jobId=unknown-id');
  console.log(await getJson(`${baseUrl}/api/artifacts/audit?jobId=unknown-id`));

  // 9) Artifacts compliance report (unknown)
  logSection('Artifacts Compliance Report (expected 404) /api/artifacts/compliance?jobId=unknown-id');
  console.log(await getJson(`${baseUrl}/api/artifacts/compliance?jobId=unknown-id`));

  console.log('\n>>> Done');
})().catch((e) => {
  console.error('Test script error:', e);
  process.exit(1);
});
