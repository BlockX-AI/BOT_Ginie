# AI Deployment API — Full Developer Documentation

A clean reference for your AI-assisted smart contract deployment platform.

## Base URLs
- Production: https://acadcodegen-production.up.railway.app
- Local: http://localhost:3000

Environment configuration
- In the Next.js frontend, set `NEXT_PUBLIC_API_BASE` to override the backend base URL used by the UI.
- For Node/server-side contexts, `API_BASE` is also supported by the client.

Always send header:
- Content-Type: application/json

## Overview
- Core: POST /api/ai/pipeline → AI-assisted contract generation → compile → deploy
- One-click Token: POST /api/deploy/erc20
- Job Tracking: GET /api/job/:id/status and GET /api/job/:id/logs
- Artifacts: /api/artifacts* → get sources, ABIs, scripts (or combined)

---

## 1) AI Pipeline (Main Flow)
Run the full AI → Solidity → Deployment pipeline.

POST /api/ai/pipeline

Request body
```json
{
  "prompt": "ERC721 with minting",
  "network": "basecamp",
  "maxIters": 5,
  "filename": "AIGenerated.sol",
  "constructorArgs": []
}
```

Response (job started)
```json
{
  "ok": true,
  "job": {
    "id": "ai_pipeline_<uuid>",
    "state": "running",
    "progress": 5,
    "step": "init"
  }
}
```

Example (curl)
```bash
curl -X POST "http://localhost:3000/api/ai/pipeline" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "ERC721 with minting",
    "network": "basecamp",
    "maxIters": 5,
    "filename": "AIGenerated.sol",
    "constructorArgs": []
  }'
```

---

## 2) Job Tracking

Check job status
GET /api/job/:id/status

Optional query params
- `verbose=1` → include additional metadata such as timings and step history.

Response (completed)
```json
{
  "ok": true,
  "data": {
    "id": "ai_pipeline_<uuid>",
    "state": "completed",
    "progress": 100,
    "step": "deploy",
    "result": {
      "network": "basecamp",
      "deployer": "0xDeployerAddress",
      "contract": "MyContract",
      "fqName": "contracts/AI_<id>_AIGenerated.sol:MyContract",
      "address": "0xDeployedContract",
      "params": { "args": [] }
    }
  }
}
```

Stream and filter logs
GET /api/job/:id/logs?since=0

Optional query params (all optional)
- `since` → integer cursor for incremental fetching
- `afterIndex` → return logs strictly after index `i`
- `level` → filter by level (e.g., `info`, `warn`, `error`)
- `contains` → substring filter within message
- `limit` → max number of logs to return
- `offset` → offset within the filtered result set

Live streaming (Server-Sent Events)
GET /api/job/:id/logs/stream
Headers: `Accept: text/event-stream`

Response
```json
{
  "ok": true,
  "data": {
    "logs": [
      { "level": "info", "msg": "Compiled successfully" },
      { "level": "info", "msg": "Deployed at 0xDeployedContract" }
    ]
  }
}
```

---

## 3) Artifacts Retrieval
Artifacts should be shown in UI for transparency.

Combined (all)
GET /api/artifacts?include=all&jobId=<jobId>

Sources only
GET /api/artifacts/sources?jobId=<jobId>

ABIs only
GET /api/artifacts/abis?jobId=<jobId>

Scripts only
GET /api/artifacts/scripts?jobId=<jobId>

Example responses (sketch):
```json
{
  "ok": true,
  "data": {
    "sources": { "contracts/My.sol": "pragma solidity ^0.8.20; ..." },
    "abis": { "My": { "abi": [ /* ... */ ], "bytecode": "0x..." } },
    "scripts": { "deploy.js": "module.exports = async () => { /* ... */ }" }
  }
}
```

---

## 4) One-Click ERC20 Deployment

POST /api/deploy/erc20

Request body
```json
{
  "name": "Camp Token",
  "symbol": "CAMP",
  "initialSupply": "1000000",
  "owner": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E",
  "network": "basecamp"
}
```

Note: owner defaults to 0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E if not provided.

Response
```json
{
  "ok": true,
  "result": {
    "network": "basecamp",
    "deployer": "0xDeployerAddress",
    "contract": "BusinessToken",
    "address": "0xNewTokenAddress",
    "params": {
      "name": "Camp Token",
      "symbol": "CAMP",
      "initialSupply": "1000000",
      "owner": "0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E"
    },
    "explorerUrl": "https://basecamp.cloud.blockscout.com/address/0xNewTokenAddress"
  }
}
```

---

## 5) AI Helpers (Optional)

Generate Solidity
POST /api/ai/generate
```json
{ "prompt": "ERC20 with mint and burn" }
```

Fix Solidity Errors
POST /api/ai/fix
```json
{ "code": "pragma ...", "errors": "TypeError ..." }
```

Compile Solidity
POST /api/ai/compile
```json
{ "filename": "MyToken.sol", "code": "pragma solidity ^0.8.20; ..." }
```

---

## 6) Typical Flow in UI
1. User enters prompt → POST /api/ai/pipeline
2. Poll GET /api/job/:id/status until complete
3. Show deployed address + explorer link
4. Pull artifacts → show Solidity code, ABI, deploy script
5. For token creation → POST /api/deploy/erc20

---

## Error handling & status codes
- 200 OK: Successful requests
- 400 Bad Request: Missing/invalid parameters
- 404 Not Found: Unknown job or artifacts
- 409 Conflict: Pipeline already running for job
- 500 Server Error: Unexpected errors (see logs)

Common fields
```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "Prompt is required" } }
```

---

## TypeScript interfaces (client-side sketch)
```ts
export type JobState = 'queued' | 'running' | 'failed' | 'completed';

export interface PipelineRequest {
  prompt: string;
  network: string; // 'camp-testnet' | 'basecamp' | 'custom'
  maxIters?: number;
  filename?: string;
  constructorArgs?: any[];
}

export interface PipelineResponse {
  ok: boolean;
  job: { id: string; state: JobState; progress: number; step: string };
}

export interface JobStatusResponse {
  ok: boolean;
  data: {
    id: string;
    state: JobState;
    progress: number;
    step: string;
    result?: {
      network: string;
      deployer: string;
      contract: string;
      fqName: string;
      address: string;
      params: { args: any[] };
    }
  }
}

export interface LogsResponse {
  ok: boolean;
  data: { logs: { level: 'info' | 'warn' | 'error'; msg: string }[] };
}

export interface ArtifactsResponse {
  ok: boolean;
  data: {
    sources?: Record<string, string>;
    abis?: Record<string, { abi: any[]; bytecode?: string }>;
    scripts?: Record<string, string>;
  };
}

export interface ERC20DeployRequest {
  name: string;
  symbol: string;
  initialSupply: string;
  owner?: string;
  network: string;
}

export interface ERC20DeployResponse {
  ok: boolean;
  result: {
    network: string;
    deployer: string;
    contract: string;
    address: string;
    params: { name: string; symbol: string; initialSupply: string; owner: string };
    explorerUrl?: string;
  };
}
```

---

## Quick fetch examples
```ts
// run pipeline
await fetch(`/api/ai/pipeline`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'ERC721 with minting', network: 'basecamp' })
});

// poll job status
const res = await fetch(`/api/job/${jobId}/status`);
const status = await res.json();

// get artifacts (combined)
await fetch(`/api/artifacts?include=all&jobId=${jobId}`);

// deploy ERC20
await fetch(`/api/deploy/erc20`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Camp Token', symbol: 'CAMP', initialSupply: '1000000', network: 'basecamp' })
});
```
