# Frontend Integration Guide: Verify Contract by Job ID (Optional)

Status: Planned optional feature. Backend endpoint to be added in `api/routes/verify.js` and mounted in `api/server.js`.

This guide shows how the frontend can trigger contract verification on Blockscout using the deployment details stored in an AI job (fix/pipeline/orchestrate). Verification is off-chain and does not consume gas.

---

## Why Verify by Job?

- The AI deploy flow stores deployment artifacts under the job sandbox with a consistent `hardhat.config.js`.
- The job result includes the deployed address and constructor arguments needed for verification.
- Running `npx hardhat verify` inside the same sandbox ensures bytecode and metadata match for successful verification.

---

## Backend Endpoint (to be added)

POST `/api/verify/byJob`

- Request body:
```json
{
  "jobId": "string",
  "network": "basecamp",
  "license": "MIT",
  "fullyQualifiedName": "contracts/<file>.sol:<ContractName>"
}
```
- Behavior:
  - Resolves job with `getJob(jobId)`.
  - Reads `job.result.address` and `job.result.params.args` (constructor args) from the AI deploy result.
  - Ensures the job's sandbox `hardhat.config.js` contains the verify plugin and Blockscout `customChains` for `basecamp`.
  - Executes `npx hardhat verify --network <network> <address> ...constructorArgs` with the working directory set to the job sandbox.
  - Returns `{ ok: true, verified: true, explorerUrl }` or `{ ok: false, error }`.

- Example response (success):
```json
{
  "ok": true,
  "verified": true,
  "explorerUrl": "https://basecamp.cloud.blockscout.com/address/0x...#code",
  "stdout": "..."
}
```

- Example response (error):
```json
{
  "ok": false,
  "error": "<message>",
  "stderr": "..."
}
```

> Note: We can also add a `GET /api/verify/status?address=&network=` that queries Blockscout's Etherscan-compatible API to confirm verification status on-demand.

---

## Hardhat Verify Configuration (Blockscout)

The verify endpoint will ensure the job sandbox contains a `hardhat.config.js` with the following additions:

```js
require('@nomicfoundation/hardhat-toolbox');
require('@nomicfoundation/hardhat-verify');
require('dotenv').config();

module.exports = {
  solidity: {
    compilers: [
      { version: '0.8.19', settings: { optimizer: { enabled: true, runs: 200 } } },
      { version: '0.8.20', settings: { optimizer: { enabled: true, runs: 200 } } },
    ],
  },
  networks: {
    hardhat: {},
    basecamp: {
      url: process.env.BASECAMP_RPC_URL || 'https://rpc.basecamp.t.raas.gelato.cloud',
      accounts: process.env.BASECAMP_PRIVATE_KEY ? [ (process.env.BASECAMP_PRIVATE_KEY.startsWith('0x')? process.env.BASECAMP_PRIVATE_KEY : ('0x' + process.env.BASECAMP_PRIVATE_KEY)) ] : [],
    }
  },
  etherscan: {
    apiKey: { basecamp: 'empty' },
    customChains: [
      {
        network: 'basecamp',
        chainId: 123420001114,
        urls: {
          apiURL: 'https://basecamp.cloud.blockscout.com/api',
          browserURL: 'https://basecamp.cloud.blockscout.com'
        }
      }
    ]
  }
};
```

Then verification is executed as:

```bash
npx hardhat verify \
  --network basecamp \
  <deployedAddress> \
  [...constructorArgs]
```

> The `license` selected in the UI will be passed through to Hardhat verification when supported by the plugin. Otherwise it simply influences metadata and the explorer display.

---

## Frontend Service Layer

Create `src/services/verifyService.ts`:

```ts
import apiClient from '@/services/apiClient';

export async function verifyByJob(params: {
  jobId: string;
  network?: string; // default 'basecamp'
  license?: string; // see license list below
  fullyQualifiedName?: string; // contracts/File.sol:Contract
}) {
  const { data } = await apiClient.post('/api/verify/byJob', params);
  return data as { ok: boolean; verified?: boolean; explorerUrl?: string; error?: string; stdout?: string; stderr?: string };
}

export async function verifyStatus(address: string, network = 'basecamp') {
  const { data } = await apiClient.get('/api/verify/status', { params: { address, network } });
  return data as { ok: boolean; verified: boolean; explorerUrl?: string };
}
```

With React Query:

```ts
import { useMutation } from '@tanstack/react-query';
import { verifyByJob } from '@/services/verifyService';

export function useVerifyByJob() {
  return useMutation({ mutationFn: verifyByJob });
}
```

---

## UI Placement and Flow

- Show a "Verify on Blockscout" button wherever a deploy result is displayed:
  - After Audit/Compliance Orchestrate completion.
  - On a Job Details page, if `job.result.address` exists.
- Dialog fields:
  - Network (default `basecamp`).
  - License select (see list below).
  - Fully Qualified Name (optional; defaults to `job.result.fqName`).
- On submit:
  - Call `verifyByJob({ jobId, network, license, fullyQualifiedName })`.
  - Show toast and provide a link to the explorer `#code` tab on success.

Example license options (as per Blockscout best practices):

- No License (None)
- The Unlicense (Unlicense)
- MIT License (MIT)
- GNU General Public License v2.0 (GNU GPLv2)
- GNU General Public License v3.0 (GNU GPLv3)
- GNU Lesser General Public License v2.1 (GNU LGPLv2.1)
- GNU Lesser General Public License v3.0 (GNU LGPLv3)
- BSD 2-clause "Simplified" license (BSD-2-Clause)
- BSD 3-clause "New" Or "Revised" license (BSD-3-Clause)
- Mozilla Public License 2.0 (MPL-2.0)
- Open Software License 3.0 (OSL-3.0)
- Apache 2.0 (Apache)
- GNU Affero General Public License (GNU AGPLv3)
- Business Source License (BSL 1.1)

---

## Data Sourcing from Job Result

The AI deploy flow stores a standardized object in the job result (see `api/routes/ai.js`):

```json
{
  "network": "basecamp",
  "deployer": "0x...",
  "contract": "<ContractName>",
  "fqName": "contracts/AI_<jobId>_<file>.sol:<ContractName>",
  "address": "0x...",
  "params": { "args": ["..."] }
}
```

The verification endpoint uses `address` and `params.args` as constructor arguments. If the contract has no constructor, `args` will be an empty array.

---

## Notes on Gas and Pricing

- Verification is an explorer-side API call; no on-chain transaction is required.
- Optionally, you may show current gas price for context, but it does not block verification.
- If you want a deployment gas guard (e.g., wait until gas < 0.1 Gwei), implement it in the deploy step of orchestrations, not in verification.

---

## Error Handling & Troubleshooting

- Mismatch ABI/artifacts: ensure verification runs in the job sandbox where the contract was compiled.
- Incorrect FQN: pass the `fullyQualifiedName` if multiple contracts were compiled in the file.
- Constructor args mismatch: the endpoint will include an explicit error with expected vs provided info.
- Explorer slowness: consider a follow-up call to `verifyStatus` to confirm when the explorer finishes processing.

---

## Explorer Links

- Basecamp explorer: `https://basecamp.cloud.blockscout.com/address/<address>#code`

Include these links in UI after successful verification for one-click navigation.
