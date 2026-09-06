# Success Guide: Generate and Deploy Any Contract with AI

This guide explains two reliable ways to create, compile, and deploy Solidity contracts using the AI endpoints defined in `api/routes/ai.js` and Hardhat.

- Endpoint group: `/api/ai/*` (generate, fix, compile, pipeline)
- Hardhat config: `hardhat.config.js`
- Example networks: `basecamp` (stable), `camp-testnet` (flaky)

## Prerequisites
- Node deps installed: `npm i`
- Environment variables (same shell where you run the server):
  - `GEMINI_API_KEY="<your_key>"`
  - Optional: `GEMINI_MODEL="gemini-2.0-flash-exp"`
  - For deploys: `BASECAMP_PRIVATE_KEY` funded, `BASECAMP_RPC_URL` set (already in repo)
- Start server:
```bash
PORT=3000 node api/server.js
```

## Option A (Recommended): One-call Pipeline (Generate → Compile/Fix → Deploy)
The pipeline automates the whole flow.

1) Kick off job
```bash
JOB_JSON=$(curl -s http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"ERC20 with name FooToken, symbol FOO. Use OpenZeppelin, include mint() restricted to owner.",
    "network":"basecamp",
    "maxIters":3,
    "contractName":"FooToken",
    "filename":"FooToken.sol",
    "constructorArgs":[]
  }')
JOB_ID=$(printf "%s" "$JOB_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
```

2) Poll job status
```bash
while true; do
  RESP=$(curl -s "http://localhost:3000/api/job/$JOB_ID/status")
  echo "$RESP"
  echo "$RESP" | grep -q '"state":"completed"' && break
  echo "$RESP" | grep -q '"state":"failed"' && break
  sleep 2
done
```

3) Result
- On success, the response includes `result.address` and `contract` name.
- Solidity is saved to `contracts/AI_<timestamp>_<Name>.sol`.
- Artifacts ABI are under `artifacts/contracts/.../*.json`.

Troubleshooting:
- `GEMINI_API_KEY not set`: export the key and restart the server.
- Gemini 503 overload: set `GEMINI_MODEL=gemini-2.0-flash-exp` or retry.
- Camp testnet RPC errors: prefer `--network basecamp`.

## Option B: Manual Steps (Generate → Compile → Fix → Compile → Deploy)
Use this when you want more control or to avoid a long pipeline.

1) Generate Solidity
```bash
GEN=$(curl -s http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"ERC20 with name FooToken, symbol FOO. Use OpenZeppelin, include mint() restricted to owner."}')
# Extract the first code block (jq-free)
CODE=$(printf "%s" "$GEN" | sed -n 's/.*"code":"\([^"']*\\n[^"']*\)".*/\1/p' | sed 's/\\n/\n/g; s/\\"/"/g')
printf "%s\n" "$CODE" > /tmp/FooToken.sol
```

2) Compile via API (no jq)
```bash
curl -s http://localhost:3000/api/ai/compile \
  -H "Content-Type: application/json" \
  -d "$(python3 - <<'PY'
import json, pathlib
code = pathlib.Path('/tmp/FooToken.sol').read_text()
print(json.dumps({"filename":"FooToken.sol","code": code}))
PY
)"
```
- Check `ok`, `stdout`, `stderr`. If `ok:false`, continue to fix.

3) Auto-fix compile errors
```bash
ERRORS='Paste the stderr from the previous compile here'

curl -s http://localhost:3000/api/ai/fix \
  -H "Content-Type: application/json" \
  -d "$(python3 - <<'PY'
import json, pathlib, sys
code = pathlib.Path('/tmp/FooToken.sol').read_text()
errors = sys.stdin.read()
print(json.dumps({"code": code, "errors": errors}))
PY
)" <<< "$ERRORS"
```
- Extract the fixed code from the response and re-run the compile using the same Python-json trick.

4) Deploy (Hardhat)
- Quick method: edit `scripts/deploy-mycontract.js` and set the factory name to your contract (e.g., `FooToken`).
- Or create a generic deploy script that reads `CONTRACT_NAME` and `CONSTRUCTOR_ARGS` envs, then run:
```bash
npx hardhat run scripts/deploy-any.js --network basecamp
```

## Verify and Interact (Hardhat Console)
```bash
npx hardhat console --network basecamp
```
```js
const addr = "<deployed_address>";
const c = await ethers.getContractAt("FooToken", addr);
await c.name();
await c.symbol();
(await c.totalSupply()).toString();
```

## Notes
- Keep a single server instance on port 3000; kill old PIDs if needed: `lsof -i:3000` then `kill -9 <pid>`.
- Artifacts and ABIs live in `artifacts/`; source files are saved into `contracts/` with timestamped names.
- Use `basecamp` network for demos while camp testnet RPCs are unstable.




# Integreation with Frontend 

API Documentation: AI Pipeline Integration
This documents the two endpoints used to run and monitor the AI pipeline that generates, compiles, fixes, and deploys a Solidity contract.

Endpoints are implemented in:

api/routes/ai.js
 → POST /api/ai/pipeline
api/routes/jobs.js
 → GET /api/job/:id/status
Base URL: use your deployed API or http://localhost:3000.

1) Start Pipeline
Method: POST
Path: /api/ai/pipeline
Body (JSON):
prompt: string (required)
network: string (optional; default "camp-testnet"; e.g., "basecamp")
maxIters: number (optional; default 3) – AI fix attempts
contractName: string (optional) – overrides inferred name
filename: string (optional; default "AIGenerated.sol")
constructorArgs: any[] (optional; used in deploy(...args))
Success (202):
{ ok: true, job: { id, type: "ai_pipeline", state: "running", progress: 5, step: "init", ... } }
Failure (500+):
{ ok: false, error: "ERROR_MESSAGE" }
Example:

bash
curl -s http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"ERC20 with name FooToken, symbol FOO. Use OpenZeppelin, include mint() restricted to owner.",
    "network":"basecamp",
    "maxIters":3,
    "contractName":"FooToken",
    "filename":"FooToken.sol",
    "constructorArgs":[]
  }'
Response (truncated):

json
{
  "ok": true,
  "job": {
    "id": "ai_pipeline_a2614e73-3a3b-4670-a495-53661776a557",
    "type": "ai_pipeline",
    "state": "running",
    "progress": 5,
    "step": "init",
    "payload": { "prompt":"...", "network":"basecamp", ... }
  }
}
2) Poll Job Status
Method: GET
Path: /api/job/:id/status
Params:
id: string (from the pipeline response)
Success (200):
{ ok: true, data: Job }
Not found (404):
{ ok: false, error: "JOB_NOT_FOUND" }
Job object fields:

id: string
type: "ai_pipeline"
state: "running" | "completed" | "failed"
progress: number (0–100)
step: string (see lifecycle below)
payload: original request payload
result: on success
{ network, deployer, contract, address, params: { args: any[] } }
error: on failure
stdout, stderr: optional execution logs
lastErrors, details: optional compile/fix details
Example responses during the lifecycle:

json
{"ok":true,"data":{"state":"running","progress":10,"step":"generate"}}
{"ok":true,"data":{"state":"running","progress":30,"step":"compile"}}
{"ok":true,"data":{"state":"running","progress":80,"step":"deploy","contractName":"FooToken"}}
{"ok":true,"data":{"state":"completed","progress":100,"step":"deploy","result":{
  "network":"basecamp",
  "deployer":"0xa58D...c58E",
  "contract":"FooToken",
  "address":"0x8a69F46DA734dB6DC50c94fdc27757596a31f8aA",
  "params":{"args":[]}
}}}
Lifecycle: Steps and Progress
The pipeline transitions through these steps (see 
api/routes/ai.js
):

init → progress ≈ 5
generate (AI code) → 10
write (save file) → 20
compile (run Hardhat) → 30
fix (AI fix loop) → 35–50 (repeats up to maxIters)
deploy_script (create deploy script) → 70
deploy (run hardhat run --network) → 80
completed → 100 (or failed with error)
Notes:

During “fix”, field lastErrors may contain compiler output used for AI correction.
On success, stdout often includes one line: DEPLOY_RESULT {...}, which is parsed into result.
Example: Full CLI Script (progress printing)
bash
# Start pipeline
JOB_JSON=$(curl -s http://localhost:3000/api/ai/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"ERC20 with name FooToken, symbol FOO. Use OpenZeppelin, include mint() restricted to owner.",
    "network":"basecamp",
    "maxIters":3,
    "contractName":"FooToken",
    "filename":"FooToken.sol",
    "constructorArgs":[]
  }')
echo "$JOB_JSON"

# Extract job id without jq
JOB_ID=$(printf "%s" "$JOB_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "JOB_ID=$JOB_ID"

# Poll until done
while true; do
  RESP=$(curl -s "http://localhost:3000/api/job/$JOB_ID/status")
  echo "$RESP"
  echo "$RESP" | grep -q '"state":"completed"' && break
  echo "$RESP" | grep -q '"state":"failed"' && break
  sleep 3
done
OpenAPI (YAML) Snippet
yaml
openapi: 3.0.0
info:
  title: AcademicChain AI Pipeline
  version: 1.0.0
paths:
  /api/ai/pipeline:
    post:
      summary: Start AI pipeline (generate → compile/fix → deploy)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [prompt]
              properties:
                prompt: { type: string }
                network: { type: string, default: camp-testnet }
                maxIters: { type: integer, default: 3 }
                contractName: { type: string }
                filename: { type: string, default: AIGenerated.sol }
                constructorArgs: { type: array, items: { } }
      responses:
        '202':
          description: Job created
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok: { type: boolean }
                  job:
                    type: object
                    properties:
                      id: { type: string }
                      type: { type: string, enum: [ai_pipeline] }
                      state: { type: string }
                      progress: { type: integer }
                      step: { type: string }
        '500':
          description: Error
  /api/job/{id}/status:
    get:
      summary: Get job status
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        '200':
          description: Job object
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok: { type: boolean }
                  data:
                    type: object
                    properties:
                      id: { type: string }
                      state: { type: string, enum: [running, completed, failed] }
                      progress: { type: integer }
                      step: { type: string }
                      result:
                        type: object
                        properties:
                          network: { type: string }
                          deployer: { type: string }
                          contract: { type: string }
                          address: { type: string }
                          params:
                            type: object
                            properties:
                              args: { type: array, items: { } }
                      error: { type: string }
                      stdout: { type: string }
                      stderr: { type: string }
                      lastErrors: { type: string }
        '404':
          description: Job not found
Common Errors
PROMPT_REQUIRED: empty prompt
Internal 500 from Gemini/Hardhat: see stderr, stdout, details
JOB_NOT_FOUND: wrong or expired job id
Notes
Backend wallet does on-chain writes; the client only supplies inputs.
For basecamp network, explorer URLs are not attached by the pipeline (only in deploy suite endpoints), but result.address and result.network are returned so you can build links if needed.
Summary: Use POST /api/ai/pipeline to start a job, then poll GET /api/job/:id/status until state is completed or failed, reading progress, step, and result fields to display live status and final deployment details.

Feedback submitted