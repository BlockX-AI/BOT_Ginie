# Camp‑Codegen V4: Prompt → Deploy → Verify → Compliance → Audit (Content Creator Guide)

This guide shows how to go from a plain‑English idea to a deployed, verified smart contract with compliance and audit reports, using the AI services exposed by your API.

It is written for non‑low‑level developers (“content creators”) who want a simple, reliable path from prompt to on‑chain with minimal ceremony.

---

## What You Get

- AI generates Solidity code matching your prompt.
- The system iteratively fixes compilation issues, then deploys to your target network.
- It verifies the source on the block explorer.
- It runs compliance and audit checks and saves reports you can fetch later.
- Everything is organized by a single `jobId` you can use to retrieve artifacts.

---

## Prerequisites

- API base URL: set this to your running server.
  
  ```bash
  export BASE_URL=http://localhost:3000
  # or your production URL, e.g. https://evi-v4-production.up.railway.app
  ```

- Verification uses your configured Hardhat networks and explorer integration. In production, your backend should have network RPC and private keys (e.g., `BASECAMP_PRIVATE_KEY`) configured.

- Compliance/Audit use Gemini. The backend needs `GEMINI_API_KEY` set.

- Network key used in examples: `basecamp`.

---

## Core Concepts

- **Job**: Long‑running actions (AI pipeline, fix, compliance/audit orchestrations) run as background jobs. Each job has an `id` you can poll and stream logs from.
- **Artifacts**: Sources, ABIs, deploy scripts, and reports are saved under `tmp/jobs/<jobId>/...` and retrievable via API.
- **Mirroring**: When you run compliance/audit for an AI pipeline output, the reports are mirrored under the original AI `jobId` so you can fetch both with a single parameter.

---

## Step 1 — Write a Good Prompt

Tips:
- Target Solidity `^0.8.19` or `^0.8.20`.
- Prefer OpenZeppelin v4.9.x.
- Avoid constructors with required arguments; use setter functions instead.
- Don’t override non‑virtual modifiers; don’t include Pausable in override lists.

Example prompt:

```text
Build a Solidity smart contract for a game that rewards people for staking both dollars (ERC20) and IP for content.
Requirements:
- Target Solidity ^0.8.19/^0.8.20 and OpenZeppelin v4.9.x
- No constructor arguments; contract must be directly deployable
- Roles: admin manages reward parameters and withdrawals
- Users can stake an ERC20 token (treat as “dollars”) and also register IP contributions by content hash (string or bytes32)
- Track staked balances and per-content contributions
- Reward logic: periodically increases user reward balance based on staked dollar amount and registered content count
- Withdraw function for rewards with events
- Events for stake/unstake/contentRegistered/rewardClaimed
- Avoid overriding non-virtual modifiers; don’t include Pausable in override lists
```

---

## Step 2 — Generate → Fix → Compile → Deploy (AI Pipeline)

Endpoint: `POST /api/ai/pipeline`

Body fields you can use:
- `prompt` (string, required)
- `network` (string, default `basecamp-testnet`; aliases supported)
- `maxIters` (number; AI fix iterations)
- `contractName` (string; optional hint)
- `filename` (string; single‑file target name)
- `constructorArgs` (array; leave empty if you asked for no constructor params)
- `strictArgs` (boolean; defaults to true via env)
- `context` (string; optional)

Request example:

```bash
curl -s -X POST "$BASE_URL/api/ai/pipeline" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Build a staking + IP rewards contract ...",
    "network": "basecamp",
    "filename": "GameStaking.sol",
    "contractName": "GameStaking",
    "maxIters": 5
  }'
```

Response (202 Accepted):

```json
{ "ok": true, "job": { "id": "ai_pipeline_...", "type": "ai_pipeline" } }
```

### Track Progress

- Status: `GET /api/job/{id}/status`
- Logs (JSON): `GET /api/job/{id}/logs?limit=200`  
- Live logs (SSE): `GET /api/job/{id}/logs/stream`

When complete, the job’s result includes `address`, `fqName`, `params.args`, `network`, etc.

---

## Step 3 — Verify the Deployed Contract

Preferred: `POST /api/verify/byJob`

```bash
export AI_JOB_ID=<the id returned by pipeline>

curl -s -X POST "$BASE_URL/api/verify/byJob" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "'$AI_JOB_ID'",
    "network": "basecamp"
  }'
```

Response includes:

```json
{ "ok": true, "verified": true, "explorerUrl": "https://...#code", "stdout": "..." }
```

Optional status check anytime:

```bash
curl -s "$BASE_URL/api/verify/status?address=0xYourAddress&network=basecamp"
```

---

## Step 4 — Compliance (LLM Analysis)

Use the orchestrate flow to run in background and mirror the report to the AI pipeline job folder.

`POST /api/compliance/orchestrate`

```bash
curl -s -X POST "$BASE_URL/api/compliance/orchestrate" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "'$AI_JOB_ID'",
    "targetProfile": "generic",
    "strict": false,
    "fix": false,
    "deploy": false
  }'
```

- Poll with `/api/job/{id}/status` or stream `/api/job/{id}/logs/stream`.
- Fetch the saved report (mirrored) with:

```bash
curl -s "$BASE_URL/api/artifacts/compliance?jobId=$AI_JOB_ID" | jq
```

Notes:
- Compliance JSON structure can vary (LLM output). Common keys: `score`, `passed`, `profile`.

---

## Step 5 — Audit (LLM Security Review)

Use the orchestrate flow and mirror to the AI job folder.

`POST /api/audit/orchestrate`

```bash
curl -s -X POST "$BASE_URL/api/audit/orchestrate" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "'$AI_JOB_ID'",
    "fix": false,
    "deploy": false
  }'
```

- Poll status/logs as above.
- Fetch the saved report:

```bash
curl -s "$BASE_URL/api/artifacts/audit?jobId=$AI_JOB_ID" | jq
```

Notes:
- Common keys: `score`, `severityMax`, `findings` (array), but structure may vary.

---

## Optional — Start From Code Instead of a Prompt

- Fix + Deploy: `POST /api/ai/fix`
- Compile only: `POST /api/ai/compile`

These run in a sandbox (`tmp/jobs/<jobId>/...`) and produce the same kinds of artifacts and job logs.

---

## Artifacts & Sources

- List artifacts (auto‑detect job or project): `GET /api/artifacts?jobId=<id>&include=all|sources|abis|scripts`
- Sources only: `GET /api/artifacts/sources?jobId=<id>`
- ABIs only: `GET /api/artifacts/abis?jobId=<id>`
- Scripts only: `GET /api/artifacts/scripts?jobId=<id>`
- Audit report: `GET /api/artifacts/audit?jobId=<id>`
- Compliance report: `GET /api/artifacts/compliance?jobId=<id>`

Artifact layout on server:
- `tmp/jobs/<AI_JOB_ID>/contracts/AI_<jobId>_<filename>.sol`
- `tmp/jobs/<AI_JOB_ID>/artifacts/contracts/.../*.json`
- `tmp/jobs/<AI_JOB_ID>/deploy/result.json`
- `tmp/jobs/<AI_JOB_ID>/audit/report.json`
- `tmp/jobs/<AI_JOB_ID>/compliance/report.json`

---

## Jobs API (for Progress UI)

- `GET /api/job/{id}/status` — returns state, progress, step, result, error.
- `GET /api/job/{id}/logs` — returns recent logs (supports filtering/pagination).
- `GET /api/job/{id}/logs/stream` — Server‑Sent Events for live logs.

Recommended UI patterns:
- Show a live console view using SSE.
- Parse `progress`/`step` for a progress bar.
- On `state=completed`, render deploy address, explorer link, and buttons to “Run Verify”, “Run Compliance”, “Run Audit”.

---

## Best Practices for Prompts

- Be explicit about roles, events, and access control.
- Specify constructor‑less designs (“no constructor args”) to simplify deployment.
- Ask for OpenZeppelin v4.9.x and Solidity `^0.8.19/^0.8.20`.
- Include concrete data model details (mappings, structs) and events.
- Avoid edge‑case features (e.g., complex proxies) unless necessary.

The system also inserts a banner comment into generated contracts:

```solidity
/**
 * This smart contract is generated by Camp-Codegen
 * Build by www.blockxint.com
 * Feel free to reach out at mohit@blockxint.com for queries
 */
```

---

## Troubleshooting

- Explorer verification returns an error
  - Ensure the backend has the right network key (e.g., `BASECAMP_PRIVATE_KEY`).
  - Try `POST /api/verify/byJob` again and check `stdout` in the response.

- Compliance/Audit show `undefined` fields in summaries
  - The raw JSON keys can vary. Always fetch full reports via the artifacts endpoints.

- Production container boots but contract routers are disabled (503)
  - Your backend logs may show “ABI missing; skipping contract init”.
  - Fix by including compiled `artifacts/` in your image or by providing ABI/address env vars.

- Shell quoting issues (zsh)
  - Use heredocs or single‑quoted JSON to avoid `$` substitutions.

---

## Quick Recipe (Copy/Paste)

```bash
# 0) Base URL
export BASE_URL=http://localhost:3000

# 1) Run AI pipeline
AI_JOB_ID=$(curl -s -X POST "$BASE_URL/api/ai/pipeline" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Build a staking + IP rewards contract ...",
    "network": "basecamp",
    "filename": "GameStaking.sol",
    "contractName": "GameStaking",
    "maxIters": 5
  }' | jq -r '.job.id')
echo "AI job: $AI_JOB_ID"

# 2) Poll status
curl -s "$BASE_URL/api/job/$AI_JOB_ID/status" | jq

# 3) Verify on explorer
curl -s -X POST "$BASE_URL/api/verify/byJob" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"'$AI_JOB_ID'","network":"basecamp"}' | jq

# 4) Compliance (mirror to AI job)
COMPLIANCE_JOB=$(curl -s -X POST "$BASE_URL/api/compliance/orchestrate" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"'$AI_JOB_ID'","targetProfile":"generic","fix":false,"deploy":false}' | jq -r '.job.id')
# Wait then fetch mirrored report
curl -s "$BASE_URL/api/artifacts/compliance?jobId=$AI_JOB_ID" | jq

# 5) Audit (mirror to AI job)
AUDIT_JOB=$(curl -s -X POST "$BASE_URL/api/audit/orchestrate" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"'$AI_JOB_ID'","fix":false,"deploy":false}' | jq -r '.job.id')
# Wait then fetch mirrored report
curl -s "$BASE_URL/api/artifacts/audit?jobId=$AI_JOB_ID" | jq

# 6) List sources/abis/scripts
curl -s "$BASE_URL/api/artifacts?jobId=$AI_JOB_ID&include=sources" | jq '.sources[].path'
```

---

## FAQ

- Can I provide my own code instead of a prompt?
  - Yes: use `POST /api/ai/fix` or `POST /api/ai/compile`.

- How do I get the deployed address?
  - From the pipeline job result or via the `verify/byJob` response (includes `explorerUrl`).

- How do I see logs in real time?
  - Connect to `GET /api/job/{id}/logs/stream` and render events in your UI.

---

Happy building! If you need help, reach out at mohit@blockxint.com.
