# Railway CLI Deployment Guide – Backend SDK Server

This guide shows how to deploy the SDK server (api_service.js) to Railway using the Railway CLI. It assumes you already followed the plan in `updated/backend_sdk_api_service_plan.md`.


## Prerequisites
- Node.js 18+
- Your repo includes a start script that launches the server, e.g. `"start": "node api/api_service.js"` in `package.json`.
- Railway CLI installed and authenticated.

Install Railway CLI:
```bash
# macOS (Homebrew)
brew install railway

# or via npm
yarn global add @railway/cli  # or
npm i -g @railway/cli
```

Login:
```bash
railway login
```


## Create or Link a Railway Project
From the repository root:
```bash
# Initialize a new Railway project (interactive)
railway init

# If you already created a project in the dashboard, link the folder
railway link

# Open the dashboard (optional)
railway open
```

Tip: If your repo hosts multiple services, you can create separate services in Railway UI and link this directory to the target service during `railway up`.


## Configure Environment Variables
Set the variables required by the SDK server. Replace placeholder values appropriately.
```bash
railway variables set \
  BASE_URL="https://evi-v4-production.up.railway.app" \
  JOB_ID="<your-job-id>" \
  NETWORK="basecamp" \
  RPC_URL="https://rpc.basecamp.t.raas.gelato.cloud" \
  SDK_API_KEY="<strong-random-key>"
```

If you want server-signed write endpoints, also add a private key (keep this secret):
```bash
railway variables set PRIVATE_KEY="0xYOUR_PRIVATE_KEY_HEX"
```

Optional safety controls:
```bash
railway variables set \
  SDK_WRITE_ALLOWLIST="transfer,approve" \
  CORS_ORIGIN="https://yourapp.com,https://staging.yourapp.com" \
  RATE_LIMIT_WINDOW_MS="60000" \
  RATE_LIMIT_MAX="60" \
  LOG_LEVEL="info"
```

Inspect or edit variables later:
```bash
railway variables
```


## Deploy
From the repo root (where `package.json` lives):
```bash
# Build & deploy current directory
railway up
```

If you have multiple services in the project, you can target one by name (or select interactively):
```bash
railway up --service "sdk-server"
```


## Verify Deployment
Check deploy status and logs:
```bash
railway status
railway logs -f
```

Get your public URL from the dashboard (`railway open`) and verify health:
```bash
export SDK_URL="https://<your-service>.up.railway.app"
curl -s "$SDK_URL/sdk/health" | jq '.'
curl -s "$SDK_URL/sdk/methods" | jq '.'
```


## Update or Redeploy
- Change variables:
```bash
railway variables set JOB_ID="<new-job-id>"
```
- Redeploy latest code:
```bash
railway up
```


## Local Run with Remote Env (Optional)
Run the server locally while injecting Railway environment variables:
```bash
railway run node api/api_service.js
```
Then visit http://localhost:8080 (or the port your app binds to) if your service uses `PORT` from env.


## Multiple Environments (Optional)
Use the dashboard to create separate environments (e.g., staging, production) and switch between them before running `railway variables` or `railway up`. You can also manage environments via the CLI by selecting the environment interactively when prompted.


## Troubleshooting
- Ensure your server listens on `process.env.PORT` (Railway injects this).
- If `railway up` deploys but health checks fail, view logs:
```bash
railway logs -f
```
- Validate required vars are set (`railway variables`) and the job artifacts are accessible via your aggregator:
```bash
curl -s "$BASE_URL/api/job/$JOB_ID/status?verbose=1" | jq '.result'
curl -s "$BASE_URL/api/artifacts/abis?jobId=$JOB_ID" | jq '.abis | map({name, path})'
```
- If writes fail, confirm `PRIVATE_KEY` is present, the method is allowlisted, and your RPC has funds.


## Post-Deployment Checklist
- `GET /sdk/health` returns `{ ok: true }` with correct `address` and `network`.
- `GET /sdk/abi` returns ABI JSON for the intended contract.
- `GET /sdk/call/...` works for common read methods.
- If enabled, `POST /sdk/send/...` returns a `txHash` and the transaction confirms on-chain.
- CORS, rate-limits, and allowlists configured appropriately for your dapp.
