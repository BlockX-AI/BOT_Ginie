# AI Deployment API

This document lists all endpoints involved in the AI-assisted contract generation, compilation, deployment, and artifact retrieval flows.

Base URLs:
- Local: http://localhost:3000
- Production: https://acadcodegen-production.up.railway.app

## Overview
- AI generates or fixes Solidity (`/api/ai/generate`, `/api/ai/fix`).
- Compile code in an isolated sandbox (`/api/ai/compile`).
- Full pipeline to generate, compile, and deploy in background (`/api/ai/pipeline`).
- Deploy a production-ready ERC20 (`/api/deploy/erc20`).
- Track background job status and logs (`/api/job/:id/status`, `/api/job/:id/logs`).
- Retrieve sources, ABIs, and deploy scripts for a job (`/api/artifacts*`).

Environment variables commonly used:
- `GEMINI_API_KEY` for AI calls.
- Network keys like `BASECAMP_PRIVATE_KEY`, `CAMP_PRIVATE_KEY` and RPC URLs for deployment.

Common headers:
- `Content-Type: application/json`
- `x-job-id: <jobId>` for artifact endpoints when retrieving job-scoped files.

Error format:
```json
{ "ok": false, "error": "ERROR_CODE|message", "stderr": "optional", "reqId": "optional" }
```

Status codes:
- 200 OK: success
- 202 Accepted: async job started
- 400 Bad Request: invalid/missing params
- 500 Internal Server Error: unexpected error

---

## GET /
Health/info endpoint.

Response:
```json
{
  "message": "Welcome to AcademicChain API",
  "documentation": "/api-docs",
  "status": "online",
  "contractAddresses": { "ResearchPaper": "0x...", "CitationRegistry": "0x...", "RoyaltyDistributor": "0x...", "MockOriginProtocol": "0x..." }
}
```

JS example:
```js
const res = await fetch(`${BASE_URL}/`);
const data = await res.json();
```

---

## GET /api-docs
Swagger UI for browsing the API.

JS example:
```js
window.location.href = `${BASE_URL}/api-docs`;
```

## POST /api/deploy/erc20
Deploy the `BusinessToken` ERC20 via Hardhat.

Body:
```json
{
  "name": "Camp Token",
  "symbol": "CAMP",
  "initialSupply": "1000000",
  "owner": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "network": "basecamp" // defaults to "camp-testnet" if omitted in server; script examples use basecamp
}
```

JS example:
```js
const res = await fetch(`${BASE_URL}/api/ai/compile`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename: 'MyToken.sol', code })
});
const data = await res.json();
```

Example (matches `test_deploy_erc20.sh`):
```bash
BASE_URL=${BASE_URL:-https://acadcodegen-production.up.railway.app}
NAME=${NAME:-Camp Token}
SYMBOL=${SYMBOL:-CAMP}
SUPPLY=${SUPPLY:-1000000}
OWNER=${OWNER:-0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E}
NETWORK=${NETWORK:-basecamp}

payload=$(jq -nc --arg name "$NAME" --arg symbol "$SYMBOL" --arg supply "$SUPPLY" --arg owner "$OWNER" --arg network "$NETWORK" '{name:$name, symbol:$symbol, initialSupply:$supply, owner:$owner, network:$network}')

curl -sS -X POST "$BASE_URL/api/deploy/erc20" \
  -H 'Content-Type: application/json' \
  -d "$payload" | jq
```

Response (trimmed):
```json
{
  "ok": true,
  "result": {
    "network": "basecamp",
    "deployer": "0x...",
    "contract": "BusinessToken",
    "address": "0x...",
    "params": { "name": "Camp Token", "symbol": "CAMP", "initialSupply": "1000000", "owner": "0x..." },
    "explorerUrl": "https://basecamp.cloud.blockscout.com/address/0x..." // present when network basecamp
  },
  "stdout": "... DEPLOY_RESULT { ... } ..."
}
```

Notes:
- `network` values: `camp-testnet` (default in server), `basecamp` (used in examples), etc.
- `explorerUrl` is attached for `basecamp` in the response helper. If missing, you can construct it as `https://basecamp.cloud.blockscout.com/address/<address>`.

JS example:
```js
const payload = {
  name: 'Camp Token',
  symbol: 'CAMP',
  initialSupply: '1000000',
  owner: '0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E',
  network: 'basecamp'
};
const res = await fetch(`${BASE_URL}/api/deploy/erc20`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
});
const data = await res.json();
if (!data.ok) throw new Error(data.error || 'Deploy failed');
```

---

## POST /api/ai/generate
Generate contract code from a natural-language prompt using Gemini.

Body:
```json
{
  "prompt": "ERC20 token with mint and burn",
  "model": "gemini-2.5-pro" // optional
}
```

Response (trimmed):
```json
{ "ok": true, "text": "...", "codeBlock": { "language": "solidity", "code": "..." } }
```

JS example:
```js
const res = await fetch(`${BASE_URL}/api/ai/generate`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'ERC20 token with mint and burn' })
});
const data = await res.json();
```

---

## POST /api/ai/fix
Fix Solidity code given compiler errors.

Body:
```json
{
  "code": "pragma solidity ^0.8.20; ...",
  "errors": "TypeError ...",
  "context": "optional notes",
  "model": "gemini-2.5-pro" // optional
}
```

Response (trimmed):
```json
{ "ok": true, "fixed": { "language": "solidity", "code": "..." }, "text": "..." }
```

JS example:
```js
const res = await fetch(`${BASE_URL}/api/ai/fix`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, errors: compilerStdErr, context: 'optional notes' })
});
const data = await res.json();
```

---

## POST /api/ai/compile
Compile a given Solidity file in an isolated sandbox (no repo contracts included).

Body:
```json
{
  "filename": "MyToken.sol", // optional, default AIGenerated.sol
  "code": "pragma solidity ^0.8.20; ..."
}
```

Response (trimmed):
```json
{
  "ok": true,
  "file": { "relativePath": "tmp/jobs/compile_<ts>/contracts/AI_<ts>_MyToken.sol" },
  "compiledContracts": ["MyToken"],
  "stdout": "...",
  "stderr": "..."
}
```

---

## POST /api/ai/pipeline
End-to-end background pipeline: generate code, auto-fix on compile errors, create a deploy script, and deploy.

Body:
```json
{
  "prompt": "ERC721 with minting" ,
  "network": "basecamp-testnet", // aliases supported: camp-testnet->basecamp-testnet, camp->basecamp
  "maxIters": 5,
  "contractName": "", // optional hint
  "filename": "AIGenerated.sol",
  "constructorArgs": []
}
```

Response (202):
```json
{ "ok": true, "job": { "id": "ai_pipeline_<uuid>", "state": "running", "progress": 5, "step": "init" } }
```

Follow-up:
- Poll status: `GET /api/job/:id/status`
- Stream logs: `GET /api/job/:id/logs?since=<ms>`

When completed, the job includes `result` like:
```json
{
  "network": "basecamp-testnet",
  "deployer": "0x...",
  "contract": "MyContract",
  "fqName": "contracts/AI_<id>_AIGenerated.sol:MyContract",
  "address": "0x...",
  "params": { "args": [] }
}
```

---

## GET /api/job/:id/status
Return job metadata including `state` (running|failed|completed), `progress`, `step`, and optional `result`.

Example:
```bash
curl -s http://localhost:3000/api/job/ai_pipeline_123/status | jq
```

JS example:
```js
const st = await fetch(`${BASE_URL}/api/job/${jobId}/status`).then(r => r.json());
```

---

## GET /api/job/:id/logs?since=<ms>
Return job logs emitted during compile/deploy phases.

Example:
```bash
curl -s "http://localhost:3000/api/job/ai_pipeline_123/logs?since=0" | jq
```

JS example:
```js
const logs = await fetch(`${BASE_URL}/api/job/${jobId}/logs?since=0`).then(r => r.text());
```

---

## Artifacts retrieval (job-scoped)
All endpoints below accept either header `x-job-id: <jobId>` or query `?jobId=<jobId>`. They prioritize `tmp/jobs/<jobId>/...` and fall back to project-level directories.

### GET /api/artifacts (combined)
Query: `include=all|sources|abis|scripts` (default `all`).

Response (trimmed):
```json
{ "ok": true, "jobId": "...", "scope": "job:<id>|project", "sources": [], "abis": [], "scripts": [], "meta": {"baseDir": "..."} }
```

JS example:
```js
const res = await fetch(`${BASE_URL}/api/artifacts?include=all`, { headers: { 'x-job-id': jobId } });
const data = await res.json();
```

### GET /api/artifacts/sources
Return Solidity sources.

Example:
```bash
curl -s "http://localhost:3000/api/artifacts/sources?jobId=ai_pipeline_123" | jq
```

JS example:
```js
const res = await fetch(`${BASE_URL}/api/artifacts/sources?jobId=${jobId}`);
const data = await res.json();
```

### GET /api/artifacts/abis
Return ABI artifacts (and bytecode if present).

Example:
```bash
curl -s "http://localhost:3000/api/artifacts/abis?jobId=ai_pipeline_123" | jq
```

JS example:
```js
const res = await fetch(`${BASE_URL}/api/artifacts/abis`, { headers: { 'x-job-id': jobId } });
const data = await res.json();
```

### GET /api/artifacts/scripts
Return deployment scripts generated for the job.

Example:
```bash
curl -s "http://localhost:3000/api/artifacts/scripts?jobId=ai_pipeline_123" | jq
```

JS example:
```js
const res = await fetch(`${BASE_URL}/api/artifacts/scripts?jobId=${jobId}`);
const data = await res.json();
```

---

## Typical AI Deployment Flow
1. POST `/api/ai/pipeline` with prompt + network.
2. Poll `/api/job/:id/status` until `state=completed`.
3. Fetch logs via `/api/job/:id/logs` if needed.
4. Retrieve artifacts via `/api/artifacts/*` using the job ID.

## Notes
- CORS is enabled for known frontends; local dev allowed.
- Sandbox builds isolate compilation from repo contracts to avoid dependency collisions.
- Ensure relevant network private keys and RPC URLs are configured before deploying.

## CORS and Auth
- CORS allows the following by default in `api/server.js`:
  - `http://localhost:5173`
  - `https://academic-chain.vercel.app` and related Vercel previews
- No authentication headers are required for the current endpoints.
- For browser usage, always set `Content-Type: application/json` on POST requests.

## Production vs Local
- Replace `BASE_URL` with `https://acadcodegen-production.up.railway.app` for production.
- For local development, run the server and use `http://localhost:3000`.
