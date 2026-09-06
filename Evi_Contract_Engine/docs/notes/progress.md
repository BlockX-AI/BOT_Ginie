### API Improvement
- `api/server.js` updated to include `explorerUrl` in the `POST /api/deploy/erc20` JSON response when `network` is `basecamp`.
# Project Progress Report

Date: 2025-08-27 00:46 IST

## Update (2025-08-28 13:40 IST)

### AI Generate → Compile → Deploy (Basecamp) — Success
- Contract: FooToken (ERC20, OpenZeppelin, owner-only mint)
- Network: basecamp
- Deployer: `0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E`
- Deployed Address: `0x8a69F46DA734dB6DC50c94fdc27757596a31f8aA`
- Pipeline Route: `POST /api/ai/pipeline` from `api/routes/ai.js`

#### Commands Used
```bash
# Ensure AI env is set before starting server
export GEMINI_API_KEY="<your_key>"
export GEMINI_MODEL="gemini-2.0-flash-exp"   # optional
PORT=3000 node api/server.js

# Start pipeline (generate -> compile -> deploy)
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

# Poll job status
while true; do
  RESP=$(curl -s "http://localhost:3000/api/job/$JOB_ID/status")
  echo "$RESP"
  echo "$RESP" | grep -q '"state":"completed"' && break
  echo "$RESP" | grep -q '"state":"failed"' && break
  sleep 2
done
```

#### Result
- Final state: `completed`
- Stdout included: `DEPLOY_RESULT {"network":"basecamp","deployer":"0xa58D...","contract":"FooToken","address":"0x8a69F4...","params":{"args":[]}}`
- Artifacts: `artifacts/contracts/.../FooToken.json`
- Source saved under `contracts/AI_<timestamp>_FooToken.sol`

#### Notes
- If Gemini returns 503 (overloaded), set `GEMINI_MODEL=gemini-2.0-flash-exp` or retry.
- Camp testnet RPC was flaky; Basecamp network is stable and recommended for demos.

## Demo Summary
- Successfully executed end-to-end ERC20 deployment via Hardhat.
- Verified working path using Basecamp network while Camp testnet RPCs were unstable.

## Deployment Details
- Contract: BusinessToken (ERC20)
- Network: basecamp (chainId 123420001114)
- Deployer/Owner: 0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E
- Token Name/Symbol: MyToken (MYT)
- Initial Supply: 21,000,000
- Deployed Address: 0xdE5680986216184Aa5d9944efd68c071025B41b0
- Deployment Artifact: deployments/basecamp-business-token-1756235599588.json
- Explorer Link: https://basecamp.cloud.blockscout.com/address/0xdE5680986216184Aa5d9944efd68c071025B41b0

## Commands Used
```bash
HARDHAT_NETWORK=basecamp \
NAME="MyToken" SYMBOL="MYT" INITIAL_SUPPLY="21000000" OWNER="0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E" \
npx hardhat run scripts/deploy-erc20.js
```

## Issues Encountered & Resolutions
- Camp Testnet RPC failures (325000, 90354): Thirdweb provider errors and 525 SSL errors.
  - Resolution: Switched to `basecamp` network for demo continuity.
- Hardhat positional args (HH308) when calling via API.
  - Resolution: Use environment variables for NAME/SYMBOL/INITIAL_SUPPLY/OWNER instead of argv.
- Truncated OWNER (e.g., `0xa58D...`) caused `resolveName` error.
  - Resolution: Use full 42-char 0x-prefixed address.
- Running commands from `~/Desktop` caused `HHE3` (no config).
  - Resolution: Run from project root `~/Desktop/Anadi_Submission/`.

## Environment Variables
- Basecamp: `BASECAMP_PRIVATE_KEY=0x...` (funded)
- Camp Testnet V2 (325000): `CAMP_TESTNET_RPC_URL=https://325000.rpc.thirdweb.com`
- Camp Original Testnet (90354): `CAMP_TESTNET_90354_RPC_URL=https://90354.rpc.thirdweb.com`

## Next Steps
- Re-try Camp Testnet deployments when RPC stabilizes; keep both networks configured:
  - `--network camp-testnet` (325000)
  - `--network camp-90354` (90354)
- Update API (`api/server.js`) to pass deploy params via env vars (no positional args) and restart API to enable POST-based deploys.
- Optionally add retries/backoff for transient RPC errors.

## Update (2025-08-27 01:32 IST)

### Additional ERC20 Deployments (Basecamp)
- MyToken (MYT)
  - Address: `0x49Da5474D53f4b44c9f7C1Dd313f1723cD4593c7`
  - Artifact: `deployments/basecamp-business-token-1756238273196.json`
- BlockXCamp (BXC)
  - Address: `0x7FB29E51E5944fb352072d6c7533F28444Bccb54`
  - Artifact: `deployments/basecamp-business-token-1756238322662.json`
  - Explorer: https://basecamp.cloud.blockscout.com/address/0x7FB29E51E5944fb352072d6c7533F28444Bccb54

### API-based Deployment (POST /api/deploy/erc20)
- Request deployed BlockXCamp (BXC) via API
  - Address: `0x31C63465B6544599749bC24F875869B40daA5dAf`
  - Artifact: `deployments/basecamp-business-token-1756238747631.json`
  - Explorer: https://basecamp.cloud.blockscout.com/address/0x31C63465B6544599749bC24F875869B40daA5dAf

### AI API Status
- Routes mounted at `POST /api/ai/generate` and `POST /api/ai/fix` per `api/routes/ai.js` and `api/server.js`.
- Health check: `GET /api/ai/generate` returns 404 by design (only POST supported).
- Generate: Working. Returned a valid `DemoToken` ERC20 code block using OpenZeppelin.
- Fix: Returned empty output with `gemini-2.5-pro`.
  - Workaround: set `GEMINI_MODEL=gemini-1.5-flash` and retry.
  - Ensure `GEMINI_API_KEY` is exported in the same shell before curl.

### Commands
```bash
# Generate (works)
export GEMINI_API_KEY="<key>"
# Optional fallback model if 2.5-pro under-performs or is unavailable
export GEMINI_MODEL="gemini-1.5-flash"

curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create a minimal ERC20 using OpenZeppelin with name DemoToken, symbol DMO"}'

# Fix (retry with explicit model fallback)
curl -X POST http://localhost:3000/api/ai/fix \
  -H "Content-Type: application/json" \
  -d '{"code":"pragma solidity ^0.8.20; contract X { }","errors":"TypeError: Missing inheritance from ERC20...","context":"Use OpenZeppelin ERC20 standard, 18 decimals","model":"gemini-1.5-flash"}'
```

### Next AI Improvements (optional)
- Add a small GET handler in `api/routes/ai.js` to return a 405-style hint for `/api/ai/generate` and `/api/ai/fix`.
- In `fix`, if no code block is found, return the raw text as `fixed.code` to avoid empty payloads.

## References
- Config: `hardhat.config.js`
- Scripts: `scripts/deploy-erc20.js`, `scripts/deploy.js`
- Docs plan: `COdeGen.md`

## Production (Railway)
- **Base URL**: https://acadcodegen-production.up.railway.app
- **Docs (local dev)**: `http://localhost:3000/api-docs` (Swagger)

## Product Features (Overview)
- **AI Code Generation**
  - `POST /api/ai/generate`: Generates Solidity contracts (prefers OpenZeppelin); returns full text, first code block, and raw provider payload.
  - `POST /api/ai/fix`: Fixes provided Solidity code based on compiler errors/context; returns corrected code block and raw payload.
- **Smart-Contract Suite (Research Platform)**
  - Papers: register, cite, verify, query by id/researcher/keyword.
  - Citations: record, verify, counts, lookups.
  - Royalties: pay, batch pay, withdraw, balances, totals, payment lookups.
  - Origin assets: register, verify ownership, transfer, list by owner.
- **One-click Deployments**
  - `POST /api/deploy/erc20`: Deploys ERC20 (BusinessToken) via Hardhat; includes explorer URL when `network=basecamp`.
  - `POST /api/deploy/academic-suite`: Deploys ResearchPaper, CitationRegistry, RoyaltyDistributor with configurable params.

## Networks
- **Basecamp** (stable): Proven working for deployments and transactions; explorer integrated in responses.
- **Camp Testnet** (325000 / 90354): Supported in config; retry when RPCs stabilize.
- **Avalanche Fuji** (testnet): Use network key `avalanche-fuji` for direct deploys; ensure `AVALANCHE_PRIVATE_KEY` and `AVALANCHE_FUJI_RPC_URL` are set.

## Quick Usage (Railway)
```bash
# AI Generate
curl -X POST https://acadcodegen-production.up.railway.app/api/ai/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Create an ERC20 with mint and burn using OpenZeppelin"}'

# AI Fix
curl -X POST https://acadcodegen-production.up.railway.app/api/ai/fix \
  -H 'Content-Type: application/json' \
  -d '{"code":"pragma solidity ^0.8.20; contract X{}","errors":"Parser error","context":"Use OpenZeppelin"}'

# ERC20 Deploy (Basecamp)
curl -X POST https://acadcodegen-production.up.railway.app/api/deploy/erc20 \
  -H 'Content-Type: application/json' \
  -d '{"name":"MyToken","symbol":"MYT","initialSupply":"1000","owner":"0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E","network":"basecamp"}'

# Academic Suite Deploy (requires valid originProtocol address)
curl -X POST https://acadcodegen-production.up.railway.app/api/deploy/academic-suite \
  -H 'Content-Type: application/json' \
  -d '{"rpName":"ResearchPaper","rpSymbol":"RPR","originProtocol":"0x...","treasury":"0x...","platformFeeBps":"500","network":"basecamp"}'

```

## SDKs (npm & PyPI)

### JavaScript/TypeScript SDK (npm)
- __Package__: `<your-npm-package-name>`
- __Install__:
  ```bash
  npm install <your-npm-package-name>
  # or
  yarn add <your-npm-package-name>
  pnpm add <your-npm-package-name>
  ```
- __Env__:
  - `BASE_URL` for your API (e.g., `http://localhost:3000` or Railway URL)
  - For protected endpoints, set auth headers in client init if required
- __Usage__:
  ```ts
  import { AiClient } from '<your-npm-package-name>';

  const client = new AiClient({ baseUrl: process.env.BASE_URL || 'http://localhost:3000' });

  // 1) Run AI → Compile → Deploy pipeline
  const start = await client.startPipeline({
    prompt: 'ERC20 with name FooToken, symbol FOO (mint onlyOwner)',
    network: 'basecamp',
    maxIters: 5,
    filename: 'FooToken.sol',
    constructorArgs: []
  });
  const jobId = start.id;

  // 2) Poll job status
  const status = await client.getJobStatus(jobId);
  // 3) Optionally stream logs
  const logs = await client.getJobLogs(jobId);

  // 4) One-click ERC20 deploy (non-AI)
  const deployResp = await client.deployErc20({
    name: 'MyToken', symbol: 'MYT', initialSupply: '1000', owner: '0x...', network: 'basecamp'
  });
  ```

### Python SDK (PyPI)
- __Package__: `<your-pypi-package-name>`
- __Install__:
  ```bash
  pip install <your-pypi-package-name>
  ```
- __Env__:
  - `BASE_URL` for your API (e.g., `http://localhost:3000` or Railway URL)
- __Usage__:
  ```python
  from <your_pypi_package_import> import AiClient
  import os

  client = AiClient(base_url=os.getenv('BASE_URL', 'http://localhost:3000'))

  # 1) Run pipeline
  start = client.start_pipeline({
      'prompt': 'Simple storage contract with set/get',
      'network': 'basecamp',
      'maxIters': 5,
      'filename': 'SimpleStorage.sol',
      'constructorArgs': []
  })
  job_id = start['id']

  # 2) Poll status
  status = client.get_job_status(job_id)
  # 3) Fetch logs
  logs = client.get_job_logs(job_id)

  # 4) ERC20 deploy (non-AI)
  resp = client.deploy_erc20({
      'name': 'MyToken',
      'symbol': 'MYT',
      'initialSupply': '1000',
      'owner': '0x...',
      'network': 'basecamp'
  })
  ```

#### Supported endpoints in SDKs
- `POST /api/ai/pipeline`
- `GET /api/job/:id/status`
- `GET /api/job/:id/logs` (if enabled)
- `POST /api/deploy/erc20`

> Replace placeholders (`<your-npm-package-name>`, `<your-pypi-package-name>`, `<your_pypi_package_import>`) with the actual published names/import paths.
