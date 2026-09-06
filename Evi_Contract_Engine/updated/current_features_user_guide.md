# Current Features User Guide (V4)

This guide documents the current capabilities and endpoints exposed by your API. It covers AI pipeline and fix flows, Verification, Compliance, Audit, Artifacts, Jobs & Logs, Deploy helpers, and Health/OpenAPI discovery. Examples are cURL-based; adapt to your HTTP client of choice.


## Base URL and Conventions
- Set your base URL (production or local):
```bash
export BASE_URL="https://evi-v4-production.up.railway.app"
# For local dev: export BASE_URL="http://localhost:3000"
```
- All examples below use `$BASE_URL`.
- For background work, endpoints return a `jobId`. Poll `/api/job/:id/status` or stream `/api/job/:id/logs/stream`.
- Reports and artifacts mirror under `tmp/jobs/<jobId>/...` and are accessible via `/api/artifacts/*`.

---

## Quick Start: Prompt ➜ Deploy ➜ Verify ➜ Compliance ➜ Audit

1) Start an AI pipeline job (generate + fix + compile + deploy)
```bash
curl -s -X POST "$BASE_URL/api/ai/pipeline" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create and deploy a TicTacToe smart contract for two players with startGame(address) and makeMove(uint8,uint8). Name the contract TicTacToe.",
    "network": "basecamp",
    "maxIters": 7,
    "filename": "TicTacToe.sol",
    "strictArgs": true
  }' | jq '.'
# => { ok, job: { id } }
```

2) Poll job status for address and fqName
```bash
export JOB_ID="<paste-from-step-1>"
curl -s "$BASE_URL/api/job/$JOB_ID/status?verbose=1" | jq '.data | {state, result, error}'
# result contains: { address, fqName, params: { args } }
```

3) Verify on explorer (by job)
```bash
curl -s -X POST "$BASE_URL/api/verify/byJob" \
  -H "Content-Type: application/json" \
  -d '{ "jobId": "'$JOB_ID'", "network": "basecamp" }' | jq '.'
# => { ok, verified: true, explorerUrl }
```

4) Confirm verification status anytime
```bash
export ADDRESS=$(curl -s "$BASE_URL/api/job/$JOB_ID/status" | jq -r '.data.result.address')
curl -s "$BASE_URL/api/verify/status?address=$ADDRESS&network=basecamp" | jq '.'
```

5) Run Compliance + Audit orchestrations (persisted under the original AI job)
```bash
# Compliance orchestrate; mirrors report to tmp/jobs/<AI_JOB_ID>/compliance/report.json
curl -s -X POST "$BASE_URL/api/compliance/orchestrate" \
  -H "Content-Type: application/json" \
  -d '{ "jobId": "'$JOB_ID'", "fix": false, "deploy": false }' | jq '.'

# Audit orchestrate; mirrors report to tmp/jobs/<AI_JOB_ID>/audit/report.json
curl -s -X POST "$BASE_URL/api/audit/orchestrate" \
  -H "Content-Type: application/json" \
  -d '{ "jobId": "'$JOB_ID'", "fix": false, "deploy": false }' | jq '.'
```

6) Retrieve saved reports via artifacts
```bash
curl -s "$BASE_URL/api/artifacts/compliance?jobId=$JOB_ID" | jq '.report | {profile, passed, score}'
curl -s "$BASE_URL/api/artifacts/audit?jobId=$JOB_ID" | jq '.report | {score, severityMax, findings: (.findings|length)}'
```

---

## Alternative Quick Start: Fix Existing Code ➜ Deploy ➜ Verify

1) Provide Solidity code to fix+deploy
```bash
curl -s -X POST "$BASE_URL/api/ai/fix" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.19; contract Hello { function ping() external pure returns (string memory){ return \"pong\"; } }",
    "network": "basecamp"
  }' | jq '.'
# => { ok, job: { id } }
```

2) Poll job status for the deployed address and continue with the Verify + Reports steps above.

---

## AI Endpoints

- `POST /api/ai/generate` – Generate Solidity from prompt (no job). Useful for previewing code.
- `POST /api/ai/compile` – Compile arbitrary code in an isolated sandbox (no deploy).
- `POST /api/ai/fix` – AI-driven fix + compile + deploy of provided code. Returns `jobId`.
- `POST /api/ai/pipeline` – Full pipeline (generate + fix + compile + deploy) from a natural language prompt. Returns `jobId`.

Common request fields:
- `network`: Use `basecamp` (aliases: `camp` → `basecamp`, `camp-testnet` → `basecamp-testnet`).
- `filename`, `contractName`, `constructorArgs`, `strictArgs`.

---

## Verify Endpoints

- `POST /api/verify/byJob`
  - Body: `{ jobId: string, network?: string, fullyQualifiedName?: string }`
  - Returns `{ ok, verified, explorerUrl?, stdout?, stderr? }`

- `POST /api/verify/byAddress`
  - Body: `{ address: string, network?: string, fullyQualifiedName?: string, args?: any[] }`
  - Use if you only have an address; provide FQN and constructor args if auto-detect fails.

- `GET /api/verify/status?address=0x..&network=basecamp`
  - Returns `{ ok, verified, explorerUrl }`

Example:
```bash
export ADDRESS="0x..."
curl -s "$BASE_URL/api/verify/status?address=$ADDRESS&network=basecamp" | jq '.'
```

---

## Artifacts Endpoints

- `GET /api/artifacts?jobId=<id>&include=sources|abis|scripts|all`
  - Lists sources, ABIs, and scripts. Includes `scope` and `meta.baseDir`.

- `GET /api/artifacts/abis?jobId=<id>`
  - Returns compiled ABIs and bytecode references.

- `GET /api/artifacts/sources?jobId=<id>`
- `GET /api/artifacts/scripts?jobId=<id>`
- `GET /api/artifacts/audit?jobId=<id>`
- `GET /api/artifacts/compliance?jobId=<id>`

Example:
```bash
curl -s "$BASE_URL/api/artifacts/abis?jobId=$JOB_ID" | jq '.abis | map({name, path})'
```

---

## Compliance Endpoints

- `POST /api/compliance/analyze`
  - Body: `{ code, filename?, model?, profile?, strict?, policyPack?, policyChecks? }`
  - Returns: `{ ok, compliance }` (immediate)

- `POST /api/compliance/byJob`
  - Body: `{ jobId, ... }` → `{ ok, compliance }` and persists report under the job path.

- `POST /api/compliance/orchestrate`
  - Body: `{ code?, jobId?, targetProfile?, strict?, fix?, deploy?, network?, model?, fixModel?, constructorArgs? }`
  - Returns: `202 { ok, job: { id } }`

Fetch saved report:
```bash
curl -s "$BASE_URL/api/artifacts/compliance?jobId=$JOB_ID" | jq '.report | {profile, passed, score}'
```

---

## Audit Endpoints

- `POST /api/audit/analyze`
  - Body: `{ code, filename?, model?, policy? }` → `{ ok, report }`

- `POST /api/audit/byJob`
  - Body: `{ jobId, model?, policy? }` → `{ ok, report }` (also persisted)

- `POST /api/audit/orchestrate`
  - Body: `{ code?, jobId?, fix?, deploy?, network?, model?, fixModel?, constructorArgs? }`
  - Returns: `202 { ok, job: { id } }`

Fetch saved report:
```bash
curl -s "$BASE_URL/api/artifacts/audit?jobId=$JOB_ID" | jq '.report | {score, severityMax, findings: (.findings|length)}'
```

---

## Jobs & Logs

- `GET /api/job/:id/status` – Slim status. `?verbose=1` includes `result`, `logs`, and timings.
- `GET /api/job/:id/logs` – Filtered log list (`since`, `afterIndex`, `level`, `contains`, `limit`, `offset`).
- `GET /api/job/:id/logs/stream` – SSE stream of logs (`event: log`, `event: heartbeat`, `event: end`).

Examples:
```bash
curl -s "$BASE_URL/api/job/$JOB_ID/status" | jq '.data | {id, state, step, progress, result}'

# SSE stream
curl -N "$BASE_URL/api/job/$JOB_ID/logs/stream"
```

---

## Deploy Helpers (Optional)

- `POST /api/deploy/erc20` – Deploy `BusinessToken.sol` (ERC20). Returns `{ ok, result: { network, address, ... }, stdout }`.
- `POST /api/deploy/research-paper`
- `POST /api/deploy/citation-registry`
- `POST /api/deploy/royalty-distributor`
- `POST /api/deploy/academic-suite`

Example:
```bash
curl -s -X POST "$BASE_URL/api/deploy/erc20" \
  -H "Content-Type: application/json" \
  -d '{ "network": "basecamp", "name": "Business Token", "symbol": "BUS", "initialSupply": "1000000" }' | jq '.ok, .result'
```

---

## Health & OpenAPI

- `GET /` – Service health and connected contract addresses.
- `GET /api-docs` – Swagger UI (interactive docs).
- `GET /openapi.json` or `/api-docs.json` – Raw OpenAPI spec.

Examples:
```bash
curl -s "$BASE_URL/" | jq '{status, contractAddresses, documentation}'
curl -s "$BASE_URL/openapi.json" | jq '.paths | keys'
```

---

## Networks and Aliases
- `camp` → `basecamp`
- `camp-testnet` → `basecamp-testnet`
- `fuji`/`avax-fuji` → `avalanche-fuji`
- `boba` → `boba-sepolia`

Use `network: "basecamp"` for the Basecamp chain in examples.

---

## Troubleshooting
- **Verify failed**: Check `stdout`/`stderr` from verification responses; try supplying `fullyQualifiedName` and `args`.
- **No artifacts**: Confirm the orchestrate job finished. Use `?verbose=1` on job status to review steps/logs.
- **Constructor args mismatch**: For pipeline/fix, ensure you provided required args or toggle `strictArgs` if supported.
- **SSE blocked by CORS**: When streaming logs from a browser, ensure your frontend origin is allowed by the server.
- **RPC/network issues**: Verify RPC URL and network name mapping (see aliases).

---

## See Also
- Frontend integration reference: `updated/frontend_audit_compliance_verify.md`
- Artifacts route details: `api/routes/artifacts.js`
- Verify routes: `api/routes/verify.js`
- AI routes: `api/routes/ai.js`
- Jobs routes: `api/routes/jobs.js`
- Optional backend SDK plan and user guide:
  - `updated/backend_sdk_api_service_plan.md`
  - `updated/backend_sdk_user_guide.md`
