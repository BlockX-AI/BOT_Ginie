# AI Fix & Deploy Endpoint

This document describes the enhanced AI-powered compile/fix/deploy endpoint exposed by the API server. It explains what the endpoint does, how to call it, how contract selection avoids mocks, how to poll job status/logs, and how to integrate it from a frontend.

## Overview

- The endpoint accepts Solidity source code with optional compile errors and context.
- It spins up an isolated Hardhat sandbox, iteratively fixes compile issues using an AI loop, compiles the code, then deploys the resulting contract to the specified network.
- The process runs as a background job. You poll for status and logs.
- Contract selection avoids deploying mock/test contracts by default.

Primary route: `POST /api/ai/fix`

Supporting routes for job monitoring:
- `GET /api/job/:id/status`
- `GET /api/job/:id/logs`

Relevant server file: `api/routes/ai.js` (handler at `router.post('/fix', ...)`).

## Features (User Perspective)

- Auto-fix compile errors using an iterative AI loop until the code compiles.
- Isolated sandbox compilation (no interference with your project contracts).
- Deterministic and safe contract selection:
  - Prefer contract whose name matches the provided `filename` (sans `.sol`).
  - Exclude artifacts whose names contain "Mock" (case-insensitive).
  - Fallback to the deployable artifact with the largest bytecode (assumed main contract).
  - Optional explicit `contractName` to force a specific contract.
- Real network deployments supported (e.g., `basecamp`).
- Background job with structured logs and machine-readable status.

## Request

POST `http://localhost:3001/api/ai/fix`

Body (JSON):
```
{
  "code": "<Solidity source>",
  "errors": "<optional compile errors>",
  "context": "<optional guidance/context>",
  "model": "<optional LLM model name>",
  "network": "<network name, e.g., basecamp>",
  "filename": "<optional filename hint, e.g., MyToken.sol>",
  "constructorArgs": [<args>],
  "contractName": "<optional explicit contract to deploy>"
}
```

Notes:
- For very large uint values (e.g., 1e24), pass them as decimal strings, not JavaScript numbers. Example: "1000000000000000000000000".
- If `contractName` is omitted, the server chooses a non-mock artifact as described above.

## Response (202 Accepted)

```
{
  "ok": true,
  "job": {
    "id": "ai_fix_<uuid>",
    "type": "ai_fix",
    "state": "running",
    "progress": 5,
    "step": "init",
    "payload": {
      "network": "basecamp",
      "filename": "MyToken.sol",
      "constructorArgs": ["..."]
    },
    "logs": [ { "t": <ms>, "level": "info", "msg": "..." } ]
  }
}
```

Then use the job ID to poll status and logs.

## Polling Job Status

- Status: `GET /api/job/:id/status`
- Logs: `GET /api/job/:id/logs`

Example:
```
curl -sS http://localhost:3001/api/job/ai_fix_123/status
curl -sS http://localhost:3001/api/job/ai_fix_123/logs
```

When completed, `/status` returns:
```
{
  "ok": true,
  "data": {
    "id": "ai_fix_123",
    "type": "ai_fix",
    "state": "completed",
    "progress": 100,
    "result": {
      "network": "basecamp",
      "deployer": "0x...",
      "contract": "MyToken",
      "fqName": "contracts/AI_<id>_MyToken.sol:MyToken",
      "address": "0x...",
      "params": { "args": ["..."] }
    }
  }
}
```

## Contract Selection (No Mocks)

The server selects a deployable artifact with the following priorities (implemented in `api/routes/ai.js`):
1. If `contractName` was supplied and exists, deploy that.
2. Prefer contract whose name matches the given `filename` without `.sol`.
3. Exclude any artifacts whose names contain "Mock".
4. Otherwise choose the deployable artifact with the largest bytecode.

This avoids accidental deployments of mock/test contracts.

## Networks

- `hardhat`: Local in-memory chain, resets on server restart. Useful for quick simulation.
- `basecamp`: Real network (Blockscout available). Ensure your RPC and deployer key are configured in Hardhat.

If you only want real deployments, send `network: "basecamp"` (or your target network) instead of `hardhat`.

## Common Errors

- `CONSTRUCTOR_ARGS_MISMATCH`: The provided args don’t match the contract constructor.
- `COMPILE_FAILED`: The fixer could not repair the code sufficiently to compile.
- `INVALID_ARGUMENT overflow`: You likely sent a large number as a JS numeric literal. Use decimal strings for big uints.

## Examples

### 1) Simple compile-and-deploy (Hardhat)
```
curl -sS -X POST http://localhost:3001/api/ai/fix \
  -H 'Content-Type: application/json' \
  --data-binary @- << 'JSON'
{
  "code": "// SPDX-License-Identifier: UNLICENSED\npragma solidity ^0.8.20;\ncontract RealToken { uint public x; constructor(uint v){ x=v; } }\n",
  "filename": "RealToken.sol",
  "network": "hardhat",
  "constructorArgs": [7],
  "contractName": "RealToken"
}
JSON
```

### 2) Complex token on basecamp (with large cap)
```
curl -sS -X POST http://localhost:3001/api/ai/fix \
  -H 'Content-Type: application/json' \
  --data-binary @- << 'JSON'
{
  "code": "// SPDX-License-Identifier: UNLICENSED\npragma solidity ^0.8.20;\nimport '@openzeppelin/contracts/token/ERC20/ERC20.sol';\nimport '@openzeppelin/contracts/access/Ownable.sol';\nimport '@openzeppelin/contracts/security/Pausable.sol';\ncontract ComplexToken is ERC20, Ownable, Pausable {\n  uint256 public immutable cap;\n  constructor(string memory n, string memory s, uint256 c) ERC20(n,s) { require(c>0,'CAP_ZERO'); cap=c; }\n}",
  "filename": "ComplexToken.sol",
  "network": "basecamp",
  "constructorArgs": ["Complex Token", "CMPX", "1000000000000000000000000"],
  "contractName": "ComplexToken"
}
JSON
```

After the 202 Accepted, poll:
```
curl -sS http://localhost:3001/api/job/<jobId>/status
curl -sS http://localhost:3001/api/job/<jobId>/logs
```

## Frontend Integration

Below is a minimal React/TypeScript example that submits a job and polls for completion. Adjust paths to your app structure.

```tsx
// src/api/aiFix.ts
export type AiFixPayload = {
  code: string;
  filename?: string;
  network?: string;
  constructorArgs?: unknown[];
  contractName?: string;
};

export async function submitAiFix(body: AiFixPayload) {
  const res = await fetch('/api/ai/fix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
  return res.json(); // { ok: true, job }
}

export async function getJobStatus(id: string) {
  const res = await fetch(`/api/job/${id}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json(); // { ok: true, data }
}

export async function getJobLogs(id: string) {
  const res = await fetch(`/api/job/${id}/logs`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json(); // { ok: true, data }
}
```

```tsx
// src/components/AiFixForm.tsx
import React from 'react';
import { submitAiFix, getJobStatus, getJobLogs } from '../api/aiFix';

export function AiFixForm() {
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<any>(null);
  const [logs, setLogs] = React.useState<any>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        code: (document.getElementById('code') as HTMLTextAreaElement).value,
        filename: (document.getElementById('filename') as HTMLInputElement).value,
        network: (document.getElementById('network') as HTMLInputElement).value,
        contractName: (document.getElementById('contractName') as HTMLInputElement).value,
        constructorArgs: JSON.parse((document.getElementById('args') as HTMLInputElement).value || '[]'),
      };
      const { job } = await submitAiFix(body);
      setJobId(job.id);
      // Start polling
      const iv = setInterval(async () => {
        if (!job.id) return;
        const s = await getJobStatus(job.id);
        setStatus(s);
        const l = await getJobLogs(job.id);
        setLogs(l);
        if (s?.data?.state === 'completed' || s?.data?.state === 'failed') {
          clearInterval(iv);
        }
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label>Network</label>
        <input id="network" defaultValue="basecamp" />
      </div>
      <div>
        <label>Filename</label>
        <input id="filename" placeholder="MyToken.sol" />
      </div>
      <div>
        <label>Contract Name (optional)</label>
        <input id="contractName" placeholder="MyToken" />
      </div>
      <div>
        <label>Constructor Args (JSON)</label>
        <input id="args" placeholder='["Name","SYM","1000000000000000000000000"]' />
      </div>
      <div>
        <label>Solidity Code</label>
        <textarea id="code" rows={10} placeholder="// SPDX-License-Identifier: ..." />
      </div>
      <button type="submit" disabled={submitting}>Submit</button>

      {jobId && <p>Job ID: {jobId}</p>}
      <pre>{JSON.stringify(status, null, 2)}</pre>
      <pre>{JSON.stringify(logs, null, 2)}</pre>
    </form>
  );
}
```

## Tips

- Prefer supplying `contractName` to remove ambiguity.
- Use decimal strings for large uints to avoid ethers overflow.
- If you only want real network deployments, set `network` to your live network and ensure your Hardhat config has the RPC URL and deployer private key configured.
