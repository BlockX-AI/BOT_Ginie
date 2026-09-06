# Backend SDK Server – User Guide (for Dapp Developers)

This guide explains what the SDK server is, why it helps, and how a dapp team consumes its REST endpoints once deployed to Railway (or any cloud).


## What is the SDK server?
A small, job-aware HTTP service that turns any deployed contract from your AI pipeline job into a standard web API. It:
- Uses your aggregator’s endpoints (e.g., `GET /api/job/:id/status?verbose=1`, `GET /api/artifacts/abis?jobId=...`) to discover the deployed address and ABI for a given `jobId`.
- Binds an `ethers` Contract to your network (e.g., Basecamp) with a provider, and optionally a signer for writes.
- Exposes concise REST endpoints for:
  - Discovery (`/sdk/health`, `/sdk/contract`, `/sdk/abi`, `/sdk/methods`)
  - Reads (`GET /sdk/call/:method`)
  - Writes (`POST /sdk/send/:method`, guarded by API key + allowlist)
  - Events (`/sdk/events/stream` SSE and `/sdk/events/poll`)

Once this server is deployed (e.g., on Railway), frontend/mobile/backend clients can call these endpoints directly—without bundling ABIs, bytecode, RPC logic, or private keys into their apps.


## Why it helps your users (and your team)
- **Instant contract backend**: After an AI pipeline deploy completes, you immediately have a stable HTTP API for that contract—no additional backend coding.
- **Decoupled frontend**: Your UI calls standard REST endpoints instead of managing RPCs, ABI encoding, provider wiring, or multicall concerns.
- **Secret safety**: Private keys (for server-initiated writes) stay on the server via Railway environment variables. Clients never see them.
- **Standardization**: Every contract exposes the same discovery/read/write/event surface, auto-generated from the ABI.
- **Faster onboarding**: New teams can integrate by reading the contract surface at `/sdk/methods` and calling reads within minutes.
- **Multi-network ready**: The server binds to the same networks your aggregator supports; switching networks is an env change, not a code change.


## Typical ways a dapp uses it
- **Read-heavy frontends**: Use `/sdk/call/...` from the browser via fetch/axios to populate pages and widgets without shipping ABIs.
- **Server-to-server automation**: Cron jobs or microservices poll events using `/sdk/events/poll` or stream via SSE for automation, indexing, or alerts.
- **Controlled writes**: Admin dashboards or back-office UIs can hit `/sdk/send/...` to perform restricted state changes using a server signer, protected by API keys and an allowlist.
- **User-signed writes (hybrid)**: Keep `/sdk/send` disabled (no server signer). Frontend composes transactions locally with a wallet, but still uses the SDK server for reads/events and ABI discovery.


## What users see after you deploy on Railway
- A base URL, for example: `https://your-sdk.up.railway.app`
- A consistent, documented surface:
  - `GET /sdk/health` – confirm address/network/readiness
  - `GET /sdk/contract` – shows `address`, `fqName`, `hasSigner`
  - `GET /sdk/abi` – returns the ABI used by the server
  - `GET /sdk/methods` – lists readable/writeable methods and events inferred from ABI
  - `GET /sdk/call/:method?args[]=...` – read calls return normalized JSON (bigints → strings)
  - `POST /sdk/send/:method` – write calls (optional), guarded by `x-api-key` and method allowlist
  - `GET /sdk/events/stream?event=Name` – server-sent events stream
  - `GET /sdk/events/poll?event=Name&fromBlock=...` – batched log retrieval

No need to manage ABIs, RPC URLs, or chain clients in the consuming app; the SDK server abstracts that away.


## How a developer onboards to your SDK server
- **Step 1 – Discover**: Hit `/sdk/health`, `/sdk/contract`, `/sdk/abi`, `/sdk/methods` to understand the contract surface.
- **Step 2 – Read**: Use `GET /sdk/call/...` for data. Arguments are passed via `args[]` query params; responses are JSON.
- **Step 3 – Events**: Use `/sdk/events/stream` (SSE) to subscribe to real-time logs or `/sdk/events/poll` for historical queries.
- **Step 4 – Writes (optional)**: If enabled, obtain an API key from you and call `POST /sdk/send/:method` with the JSON args. You control which methods are allowed via an allowlist.

This onboarding typically takes minutes: the developer never needs ABI files or a provider setup.


## Security and tenancy
- **Write protection**: Writes require `x-api-key` and are allowlisted via `SDK_WRITE_ALLOWLIST`.
- **Rate limits**: Write routes are rate-limited; reads can be moderately limited.
- **CORS**: Restrict allowed origins to your dapp domains.
- **Multi-job/multi-contract** (optional): Expose `x-job-id` or a `?jobId=` override to let advanced clients switch contracts dynamically. Otherwise, keep one service per contract for simplicity.


## Relationship to existing docs and services
- Reuses your aggregator’s routes mounted in `api/server.js`:
  - `GET /api/job/:id/status?verbose=1` to discover `{ address, fqName, params.args }`.
  - `GET /api/artifacts/abis?jobId=...` to fetch ABIs (see `api/routes/artifacts.js`).
  - Optional `POST /api/verify/byJob` for verification flows already documented in `updated/frontend_audit_compliance_verify.md` and `updated/frontend_audit_compliance_apis.md`.
- The SDK server is the next “productized” layer on top of those primitives for dapp consumption.


## When to spin a new SDK service vs reuse one
- **One service per contract (recommended)**: Easiest to reason about; env points to a single `JOB_ID`.
- **Multi-contract gateway**: Advanced pattern; allow a `jobId` parameter per request and cache ABIs per job. Good for internal tooling, but adds complexity.


## Operational notes (Railway)
- Configure environment variables once (network, RPC, jobId, optional signer key).
- Health checks ensure the instance serves within seconds.
- Logs show upstream aggregator latencies, method calls, and (if enabled) tx statuses.
- No code changes required to switch networks or update the target contract—swap envs or redeploy pointing to a new `JOB_ID`.


## FAQ
- **Does the SDK server replace wallets?** No. It complements them. You can keep `/sdk/send` off and rely on user wallets for writes while still using read/event endpoints.
- **What if the ABI changes?** Redeploy the SDK server pointing to the new `jobId` (or call `/sdk/reload` if exposed) to refresh ABI/address bindings.
- **Is it safe to expose write endpoints?** Yes, with API keys, method allowlists, rate limits, and audit logs. Keep the key in Railway envs only.
- **How do mobile apps benefit?** They avoid bundling ABIs and complex RPC stacks; they fetch normalized JSON over HTTPS.
