 # Ginie Frontend (BlockXAI)

 Ginie is a Next.js (App Router) frontend for BlockXAI that provides OTP-based authentication, an AI smart-contract / deployment workflow UI, job tracking, artifacts viewing, and wallet connectivity.

 [![Repo](https://img.shields.io/badge/GitHub-BlockXAI%2FGinie__Frontend-black)](https://github.com/BlockXAI/Ginie_Frontend)

 ## Quick Links

 - **Repository**: https://github.com/BlockXAI/Ginie_Frontend
 - **Docs (in this repo)**:
   - `docs/AI_Deployment_API.md`
   - `docs/AI_Deploy_UI_UX_Guide.md`
   - `docs/Technical_Overview.md`

 ## Tech Stack

 - **Framework**: Next.js 15 (App Router)
 - **Language**: TypeScript + React
 - **UI**: TailwindCSS + shadcn/ui (Radix)
 - **Web3**: wagmi + web3modal (WalletConnect)

 ## Local Development

 ### Prerequisites

 - Node.js 20+
 - npm

 ### Install

 ```bash
 npm ci
 ```

 ### Run

 The dev server runs on **port 3100**.

 ```bash
 npm run dev
 ```

 ### Build / Start

 ```bash
 npm run build
 npm run start
 ```

 ## Routing

 Key routes in this app:

 - `/` Home / marketing
 - `/signin` OTP sign-in
 - `/signup` OTP sign-up
 - `/projects` Projects / jobs list
 - `/chat` Chat / pipeline UI
 - `/chat/[id]` Job / chat detail
 - `/profile` Profile (includes wallet connect)
 - `/subscription` Subscription

 Redirects:

 - `/pipeline` redirects to `/smart-contract` (configured in `next.config.js`). If you change the canonical route, update `next.config.js`.

 ## Backend / API Integration

 All browser requests go through the local Next.js proxy route to preserve cookies:

 - **Proxy route**: `app/api/proxy/[...path]/route.ts`
 - **Browser base**: `/api/proxy`

 Server-side / deployment base URL is configured via:

 - `NEXT_PUBLIC_API_BASE_URL`

 If `NEXT_PUBLIC_API_BASE_URL` is not set, the code falls back to the default currently hardcoded in:

 - `lib/api.ts`
 - `app/api/proxy/[...path]/route.ts`

 ## Environment Variables

 Create a `.env.local` in the repo root as needed.

 Common variables:

 - `NEXT_PUBLIC_API_BASE_URL` (optional; upstream user-api base URL used by the proxy)
 - `NEXT_PUBLIC_SITE_URL` (optional; used for sitemap base URL)
 - `NEXT_PUBLIC_BASE_URL` (optional; used in WalletConnect metadata; defaults to `http://localhost:3100`)
 - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (required for WalletConnect in production)

 ## Web3 / WalletConnect

 Wallet configuration lives in:

 - `lib/web3.ts`

 It uses `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and sets Ginie-branded metadata for wallet prompts.

 ## Documentation

- `docs/wallet-based-deployment/` contains wallet-deployment integration docs.

## Troubleshooting

### Port 3100 already in use

If `npm run dev` fails with `EADDRINUSE: address already in use :::3100`, either:

- Stop the process using port 3100, or
- Change the port in `package.json` scripts (`next dev -p 3100`).

---

## End-to-End System (Ginie + user-api + Frontend_Builder)

This frontend is designed to work with two backend services:

- **User API** (`Evi_User_Management/user-api`)
  - Node.js + TypeScript + Express
  - Owns OTP auth, sessions (cookie-based), entitlements, jobs DB, and acts as a gateway/proxy to upstream services
  - Default local port: `8080`
- **Frontend_Builder** (`Frontend_Builder/`)
  - Python + FastAPI + LangGraph agentic builder
  - Generates frontend apps and can orchestrate a “full DApp” (contract + frontend)
  - Default local port: `8000`

### High-level architecture

```mermaid
flowchart LR
  U["User Browser"] -->|"HTTP :3100"| G["Ginie<br/>Next.js"]

  %% Same-origin proxy so browser cookies work reliably
  G -->|"/api/proxy/*"| NXP["Next.js Proxy Route<br/>app/api/proxy/*"]
  NXP -->|"HTTP :8080"| UA["user-api<br/>Express"]

  %% user-api stores sessions/jobs and rate limits
  UA --> PG[(Postgres)]
  UA --> RD[(Redis)]

  %% user-api proxies to upstream smart-contract pipeline services
  UA --> UP["Upstream Pipeline Service<br/>/api/ai/pipeline<br/>/api/job/*<br/>/api/artifacts/*<br/>/api/verify/*"]
  UP --> CH[(EVM Chains)]

  %% user-api proxies to Frontend_Builder
  UA -->|"/u/proxy/builder/*"| FB["Frontend_Builder<br/>FastAPI :8000"]
  FB --> FPG[(Frontend_Builder Postgres)]
  FB --> SB[Sandbox / Runner]

  %% service-to-service orchestration
  FB -->|"/u/service/*<br/>(Bearer secret + X-User-Id)"| UA
```

### Why the Next.js proxy exists

Ginie uses cookie-based authentication (`evium_access`, `evium_refresh`). Browsers only reliably attach these cookies when requests are **same-origin**.

So in the browser we call:

- `fetch('/api/proxy/u/...', { credentials: 'include' })`

And `app/api/proxy/[...path]/route.ts` forwards cookies + headers to `user-api`.

### Components you’ll touch most

- **Proxy route**: `app/api/proxy/[...path]/route.ts`
- **Central API client**: `lib/api.ts`
- **Route protection**: `middleware.ts`
- **WalletConnect config**: `lib/web3.ts`

---

## Ports & Local URLs

| Service | Default Port | Notes |
|---|---:|---|
| Ginie (Next.js) | `3100` | `npm run dev` uses `next dev -p 3100` |
| user-api (Express) | `8080` | `npm run dev` uses `tsx watch src/index.ts` |
| Frontend_Builder (FastAPI) | `8000` | `start.sh` uses `${PORT:-8000}` |

---

## Environment Variables (quick reference)

### Ginie (this repo)

- `NEXT_PUBLIC_API_BASE_URL`
  - Base URL for `user-api` used by the proxy route in server contexts.
  - Browser calls still go through `/api/proxy`.
- `NEXT_PUBLIC_SITE_URL`
  - Used for metadata + sitemap base.
- `NEXT_PUBLIC_BASE_URL`
  - Used in WalletConnect metadata (defaults to `http://localhost:3100`).
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
  - WalletConnect project id used in `lib/web3.ts`.

### user-api (`Evi_User_Management/user-api`)

- `PORT` (default `8080`)
- `APP_URL` / `APP_URLS` (CORS allowlist for the frontend origin)
- `DATABASE_URL`, `REDIS_URL`
- `SESSION_SECRET`
- `OTP_PROVIDER_MODE` (`dev` or `prod`)
- `EVI_BASE_URL` / `EVI_V4_BASE_URL` (upstream pipeline service base)
- `FRONTEND_BUILDER_BASE_URL` (FastAPI base, default `http://localhost:8000`)
- `USERAPI_SERVICE_SECRET` (used for service-to-service auth from Frontend_Builder)

### Frontend_Builder (`Frontend_Builder/`)

- `PORT` (default `8000`)
- `DATABASE_URL`
- `USERAPI_BASE_URL` (base URL for user-api; default `http://localhost:8080`)
- `USERAPI_SERVICE_SECRET` (must match user-api)

---

## Auth Flow (OTP + Cookies + CSRF)

Ginie uses **passwordless OTP** via `user-api`. The backend sets HttpOnly session cookies and a readable CSRF cookie.

### Cookies

- `evium_access` (HttpOnly)
- `evium_refresh` (HttpOnly)
- `evium_csrf` (readable; sent as header `x-csrf-token` on write requests)

### OTP send + verify (sequence)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (Ginie)
  participant N as Next.js Proxy (/api/proxy)
  participant U as user-api (/u/*)
  participant DB as Postgres
  participant R as Redis

  B->>N: POST /api/proxy/u/auth/send-otp { email, mode }
  N->>U: POST /u/auth/send-otp (forward cookies, headers)
  U->>R: rate limit + store OTP challenge
  U->>DB: ensure user record (depending on mode)
  U-->>N: 200 { ok: true }
  N-->>B: 200 { ok: true }

  B->>N: POST /api/proxy/u/auth/verify { email, otp }
  N->>U: POST /u/auth/verify
  U->>R: validate OTP challenge
  U->>DB: create/rotate session (hashed tokens)
  U-->>N: Set-Cookie evium_access, evium_refresh, evium_csrf
  N-->>B: Set-Cookie (rewritten for local dev)
```

### CSRF model (why `evium_csrf` exists)

For non-GET routes, `user-api` expects:

- Header: `x-csrf-token: <value>`
- Cookie: `evium_csrf=<value>`

If they mismatch, the backend returns **403**.

`lib/api.ts` is responsible for:

- Reading `evium_csrf` and attaching it as `x-csrf-token`
- Automatically calling refresh once when CSRF is missing/expired

### Refresh + session expiration (sequence)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (Ginie)
  participant N as Next.js Proxy
  participant U as user-api

  B->>N: GET /api/proxy/u/user/me (credentials: include)
  N->>U: GET /u/user/me
  U-->>N: 401 (access expired)
  N-->>B: 401

  B->>N: POST /api/proxy/u/auth/refresh
  N->>U: POST /u/auth/refresh
  U-->>N: 200 + Set-Cookie (rotated access/refresh/csrf)
  N-->>B: 200 + Set-Cookie

  B->>N: GET /api/proxy/u/user/me
  N->>U: GET /u/user/me
  U-->>N: 200 { user }
  N-->>B: 200 { user }
```

---

## API Surface (authoritative endpoint index)

Ginie talks to **user-api** only (through the Next.js proxy). `user-api` then either:

- Serves the request directly (auth, jobs DB, entitlements, audit logs)
- Proxies the request to the upstream smart-contract pipeline service (`EVI_BASE_URL` / `EVI_V4_BASE_URL`)
- Proxies the request to **Frontend_Builder** (`FRONTEND_BUILDER_BASE_URL`)

### Ginie → Next.js proxy → user-api

In the browser, most calls look like:

- `GET /api/proxy/u/...`
- `POST /api/proxy/u/...`

Where everything after `/api/proxy` is forwarded to `user-api`.

### user-api: Auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/u/auth/send-otp` | Send OTP to email (rate limited). |
| POST | `/u/auth/verify` | Verify OTP and set session cookies (`evium_access`, `evium_refresh`, `evium_csrf`). |
| POST | `/u/auth/refresh` | Rotate access/refresh cookies and issue a new CSRF token. |
| POST | `/u/auth/logout` | Revoke session and clear cookies. |

### user-api: User profile

| Method | Path | Purpose |
|---|---|---|
| GET | `/u/user/me` | Get current user + entitlements. |
| POST | `/u/user/profile` | Update profile fields (CSRF required). |
| POST | `/u/user/avatar` | Upload avatar bytes (CSRF required). |
| GET | `/u/user/avatar/:id` | Fetch avatar image by id. |
| DELETE | `/u/user/avatar/:id` | Delete avatar (CSRF required). |
| GET | `/u/user/avatars` | List avatar metadata for current user. |
| POST | `/u/user/avatar/prune` | Prune avatars (CSRF required). |

### user-api: Jobs (ownership + metadata)

`user-api` stores job ownership in Postgres (so the UI can list “my jobs” even though compute happens upstream).

| Method | Path | Purpose |
|---|---|---|
| POST | `/u/jobs/attach` | Attach an upstream `jobId` to the current user (CSRF required). |
| GET | `/u/jobs` | List current user’s jobs (cursor pagination). |
| GET | `/u/jobs/:jobId` | Get a single user job record. |
| PATCH | `/u/jobs/:jobId/meta` | Update title/metadata/tags for a job (CSRF required). |
| DELETE | `/u/jobs/:jobId` | Soft-delete a job (CSRF required). |
| GET | `/u/jobs/:jobId/export` | Export a JSON bundle for a job. |
| POST | `/u/jobs/cache` | Update cached job status fields (CSRF required). |

### user-api: Proxy → Pipeline (smart contract generation/deploy)

These routes proxy to the upstream pipeline service and also attach jobs to the authenticated user.

| Method | Path | Upstream | Purpose |
|---|---|---|---|
| POST | `/u/proxy/ai/pipeline` | `POST /api/ai/pipeline` | Create a pipeline job from a prompt. |

### user-api: Proxy → Job status/logs (polling + SSE)

| Method | Path | Upstream | Purpose |
|---|---|---|---|
| GET | `/u/proxy/job/:id` | `GET /api/job/:id` | Full job detail. |
| GET | `/u/proxy/job/:id/status` | `GET /api/job/:id/status` | Job status/progress. |
| GET | `/u/proxy/job/:id/logs` | `GET /api/job/:id/logs` | Pollable logs. |
| GET | `/u/proxy/job/:id/logs/stream` | `GET /api/job/:id/logs/stream` | SSE log stream (streaming). |

### user-api: Proxy → Artifacts

| Method | Path | Upstream | Purpose |
|---|---|---|---|
| GET | `/u/proxy/artifacts` | `GET /api/artifacts` | Download job artifacts (combined). |
| GET | `/u/proxy/artifacts/sources` | `GET /api/artifacts/sources` | Solidity source(s). |
| GET | `/u/proxy/artifacts/abis` | `GET /api/artifacts/abis` | ABI JSON. |
| GET | `/u/proxy/artifacts/scripts` | `GET /api/artifacts/scripts` | Scripts/build outputs (if available). |
| GET | `/u/proxy/artifacts/audit` | `GET /api/artifacts/audit` | Audit artifact. |
| GET | `/u/proxy/artifacts/compliance` | `GET /api/artifacts/compliance` | Compliance artifact. |

### user-api: Proxy → Audit & Compliance (by job)

| Method | Path | Purpose |
|---|---|---|
| POST | `/u/proxy/audit/byJob` | Run audit for a job id (CSRF required). |
| POST | `/u/proxy/compliance/byJob` | Run compliance for a job id (CSRF required). |

### user-api: Proxy → Verification

| Method | Path | Purpose |
|---|---|---|
| POST | `/u/proxy/verify/byAddress` | Verify a deployed contract by address (CSRF required). |
| POST | `/u/proxy/verify/byJob` | Verify contract using job artifacts (CSRF required). |
| GET | `/u/proxy/verify/status` | Check verification status (rate limited). |

### user-api: Wallet-based Deployment (user signs transactions)

These are wrappers around upstream wallet-deploy endpoints.

Notes:

- Pro-only (requires entitlements; enforced in user-api)
- `POST` routes require CSRF

| Method | Path | Purpose |
|---|---|---|
| GET | `/u/proxy/wallet/networks` | List supported networks + default. |
| POST | `/u/proxy/wallet/deploy` | Start wallet deploy (creates a signing session). |
| GET | `/u/proxy/wallet/sign/:sessionId` | Fetch tx details for the session to sign. |
| POST | `/u/proxy/wallet/sign/:sessionId/submit` | Submit signed tx info (`txHash`, `walletAddress`). |
| GET | `/u/proxy/wallet/sessions/stats` | Session statistics. |

### user-api: Frontend_Builder wrapper routes

These are the routes Ginie should use for “frontend building” and “DApp creation”.

| Domain | Method | Path | Proxies to Frontend_Builder |
|---|---|---|---|
| Projects | POST | `/u/proxy/builder/projects` | `POST /chat` |
| Projects | GET | `/u/proxy/builder/projects` | DB-backed list + optional upstream refresh |
| Projects | GET | `/u/proxy/builder/projects/:id` | DB-backed detail + optional `GET /chats/{id}/messages` |
| Projects | PATCH | `/u/proxy/builder/projects/:id` | DB cache update |
| Projects | DELETE | `/u/proxy/builder/projects/:id` | DB soft delete |
| Projects | GET | `/u/proxy/builder/projects/:id/status` | `GET /chats/{id}/build-status` |
| Files | GET | `/u/proxy/builder/projects/:id/files` | `GET /projects/{id}/files` |
| Files | GET | `/u/proxy/builder/projects/:id/file?path=...` | `GET /projects/{id}/files/{file_path}` |
| Files | GET | `/u/proxy/builder/projects/:id/download` | `GET /projects/{id}/download` |
| Export | POST | `/u/proxy/builder/projects/:id/export/github` | `POST /api/projects/{id}/export-github` |
| Events | GET | `/u/proxy/builder/projects/:id/events/stream` | Bridges Frontend_Builder WS → SSE |
| DApp | POST | `/u/proxy/builder/dapp/create` | `POST /dapp/create` |
| DApp | POST | `/u/proxy/builder/dapp/frontend-for-contract` | `POST /dapp/frontend-for-contract` |
| DApp | GET | `/u/proxy/builder/projects/:id/contracts` | `GET /projects/{id}/contracts` |

### user-api: Service-to-service routes (Frontend_Builder → user-api)

Frontend_Builder uses these to run pipeline jobs under the end user’s identity (calls are authenticated with `USERAPI_SERVICE_SECRET` + `X-User-Id`).

| Method | Path | Purpose |
|---|---|---|
| POST | `/u/service/ai/pipeline` | Create pipeline job as user (service-to-service). |
| GET | `/u/service/job/:id` | Job detail (service-to-service). |
| GET | `/u/service/job/:id/status` | Job status (service-to-service). |
| GET | `/u/service/job/:id/logs/stream` | SSE log stream (service-to-service). |
| GET | `/u/service/artifacts` | Artifacts (service-to-service). |
| GET | `/u/service/artifacts/sources` | Sources (service-to-service). |
| GET | `/u/service/artifacts/abis` | ABIs (service-to-service). |
| POST | `/u/service/verify/byJob` | Verify by job (service-to-service). |
| POST | `/u/service/audit/byJob` | Audit by job (service-to-service). |
| POST | `/u/service/compliance/byJob` | Compliance by job (service-to-service). |

### user-api: Docs

| Path | Purpose |
|---|---|
| `/docs` | Swagger UI |
| `/openapi.json` | OpenAPI JSON |

---

## Frontend Building (what happens when you create a Builder project)

At a high level, the “Frontend Builder” flow looks like this:

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (Ginie)
  participant N as Next.js Proxy
  participant U as user-api
  participant F as Frontend_Builder

  B->>N: POST /api/proxy/u/proxy/builder/projects { prompt }
  N->>U: POST /u/proxy/builder/projects
  U->>F: POST /chat
  F-->>U: 200 { chat_id }
  U-->>B: 200 { project: { id, fb_project_id }, upstream }

  B->>N: GET /api/proxy/u/proxy/builder/projects/:id/events/stream
  N->>U: GET /u/proxy/builder/projects/:id/events/stream
  U->>F: WS /ws/{fb_project_id}
  F-->>U: WS messages (build events)
  U-->>B: SSE events (message, heartbeat, upstream_open, ...)
```

## Pipeline Jobs (Create → Track → Logs → Artifacts)

The smart-contract “pipeline” runs in an upstream service (AI → compile → deploy → verify). `user-api` acts as a gateway:

- Ginie calls `user-api` via `/api/proxy/u/...`
- `user-api` calls upstream `/api/ai/pipeline`, `/api/job/:id/*`, `/api/artifacts/*`
- `user-api` attaches the job to the authenticated user in its DB (`user_jobs`, `job_cache`)

### Create pipeline job (sequence)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (Ginie)
  participant N as Next.js Proxy
  participant U as user-api
  participant UP as Upstream Pipeline
  participant DB as Postgres

  B->>N: POST /api/proxy/u/proxy/ai/pipeline { prompt, network, ... }
  N->>U: POST /u/proxy/ai/pipeline
  U->>UP: POST /api/ai/pipeline
  UP-->>U: 200 { job: { id } }
  U->>DB: attach job to user + audit log
  U-->>N: 200 { job: { id } }
  N-->>B: 200 { job: { id } }
```

### Logs: polling vs streaming (SSE)

There are two common patterns:

- **Polling**: `GET /u/proxy/job/:id/logs?offset=...`
- **Streaming**: `GET /u/proxy/job/:id/logs/stream` (Server-Sent Events)

When Ginie calls SSE through the Next.js proxy, `app/api/proxy/[...path]/route.ts` preserves the stream by returning `NextResponse(res.body)`.

### Artifacts

After a job completes, Ginie can fetch:

- Sources
- ABIs
- Scripts
- Audit / compliance artifacts (if enabled upstream)

Via `user-api` proxy endpoints (called through `/api/proxy/u/...`).

---

## Wallet-based Deployment (User signs transactions)

Wallet-based deployment is a mode where:

- The pipeline prepares deployment data
- Ginie asks the user’s wallet to sign/broadcast
- The backend tracks tx + job state

Reference docs live here:

- `docs/wallet-based-deployment/`

High-level sequence:

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (Ginie)
  participant W as Wallet (WalletConnect)
  participant N as Next.js Proxy
  participant U as user-api
  participant CH as Chain

  B->>N: POST /api/proxy/u/proxy/wallet/deploy (create session)
  N->>U: POST /u/proxy/wallet/deploy
  U-->>N: 200 { sessionId, networkConfig, ... }
  N-->>B: 200 { sessionId, networkConfig, ... }

  B->>N: GET /api/proxy/u/proxy/wallet/sign/:sessionId
  N->>U: GET /u/proxy/wallet/sign/:sessionId
  U-->>N: 200 { txRequest, ... }
  N-->>B: 200 { txRequest, ... }

  B->>W: eth_sendTransaction(txRequest)
  W-->>B: txHash

  B->>N: POST /api/proxy/u/proxy/wallet/sign/:sessionId/submit { txHash, walletAddress }
  N->>U: POST /u/proxy/wallet/sign/:sessionId/submit
  U-->>N: 200 { jobId, ... }
  N-->>B: 200 { jobId, ... }

  U->>CH: observe confirmations / receipt
  B->>N: GET /api/proxy/u/proxy/job/:id/status (poll)
  N->>U: GET /u/proxy/job/:id/status
  U-->>B: state/progress/address/verified
```

---

## Frontend_Builder Integration

Frontend_Builder is a separate FastAPI service that can generate frontend apps (and optionally orchestrate contract + frontend).

Ginie does **not** talk to Frontend_Builder directly. Instead:

- Ginie calls `user-api` wrapper endpoints under `/u/proxy/builder/*` (through `/api/proxy`)
- `user-api` forwards to `FRONTEND_BUILDER_BASE_URL`

### user-api wrapper routes (important)

These routes are implemented in `Evi_User_Management/user-api/src/index.ts`:

- `POST /u/proxy/builder/projects`
- `GET /u/proxy/builder/projects`
- `GET /u/proxy/builder/projects/:id`
- `PATCH /u/proxy/builder/projects/:id`
- `DELETE /u/proxy/builder/projects/:id`
- `GET /u/proxy/builder/projects/:id/status`
- `GET /u/proxy/builder/projects/:id/files`
- `GET /u/proxy/builder/projects/:id/file?path=...`
- `GET /u/proxy/builder/projects/:id/download` (ZIP stream)
- `POST /u/proxy/builder/projects/:id/export/github`
- `GET /u/proxy/builder/projects/:id/events/stream` (SSE bridge)
- `POST /u/proxy/builder/dapp/create`
- `POST /u/proxy/builder/dapp/frontend-for-contract`
- `GET /u/proxy/builder/projects/:id/contracts`

### Builder events: WS → SSE bridge

Frontend_Builder’s native updates are WebSocket-based (`/ws/{id}`).

To make it easy for Ginie to consume updates through the same-origin proxy, `user-api` exposes:

- `GET /u/proxy/builder/projects/:id/events/stream`

Which bridges events and streams them as SSE to the browser.

### Frontend_Builder upstream endpoints (FastAPI)

These endpoints are implemented in `Ginie_Frontend_Builder` (see `main.py`). Ginie should not call them directly in production; they are listed here for debugging and to understand what `user-api` is proxying to.

| Method | Path | Purpose |
|---|---|---|
| POST | `/chat` | Create a new builder project (chat) and start background agent run. |
| GET | `/chats/{id}/messages` | Get message/event history for a project. |
| GET | `/chats/{id}/build-status` | Get build status for a project. |
| GET | `/projects` | List projects. |
| GET | `/projects/{id}/files` | List project files (from sandbox/DB). |
| GET | `/projects/{id}/files/{file_path}` | Get file content. |
| GET | `/projects/{id}/download` | Download project as ZIP. |
| POST | `/api/projects/{project_id}/export-github` | Export project files to a new GitHub repo. |
| POST | `/dapp/create` | Orchestrate full DApp (contract + frontend) build. |
| POST | `/dapp/frontend-for-contract` | Generate a frontend for an already-deployed contract. |
| GET | `/projects/{id}/contracts` | List contract deployments associated with a project. |
| WS | `/ws/{id}` | Real-time build events stream. |

### DApp creation (contract + frontend) — end-to-end orchestration

When you call `POST /u/proxy/builder/dapp/create`, `user-api` forwards the request to Frontend_Builder `/dapp/create` and passes the authenticated user id via header `x-user-id`.

Frontend_Builder then uses service-to-service endpoints on `user-api` to:

- Create a pipeline job for the user (`/u/service/ai/pipeline`)
- Poll status and download artifacts (`/u/service/job/:id/status`, `/u/service/artifacts`)
- Optionally trigger verification (`/u/service/verify/byJob`)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser (Ginie)
  participant N as Next.js Proxy
  participant U as user-api
  participant F as Frontend_Builder
  participant US as user-api (service)
  participant UP as Upstream Pipeline

  B->>N: POST /api/proxy/u/proxy/builder/dapp/create
  N->>U: POST /u/proxy/builder/dapp/create
  U->>F: POST /dapp/create (x-user-id: <userId>)
  F-->>U: 200 { chat_id }
  U-->>B: 200 { ok: true, project: { id, fb_project_id } }

  Note over F,US: Contract pipeline runs via service-to-service auth
  F->>US: POST /u/service/ai/pipeline (Bearer USERAPI_SERVICE_SECRET + X-User-Id)
  US->>UP: POST /api/ai/pipeline
  UP-->>US: 200 { job: { id } }
  US-->>F: 200 { job: { id } }
  F->>US: GET /u/service/job/:id/status (poll)
  F->>US: GET /u/service/artifacts?jobId=...
  F->>US: POST /u/service/verify/byJob (optional)
```

### Service-to-service auth (`/u/service/*`)

When Frontend_Builder orchestrates a full DApp, it calls `user-api` service endpoints:

- `POST /u/service/ai/pipeline`
- `GET /u/service/job/:id/status`
- `GET /u/service/artifacts?...`
- `POST /u/service/verify/byJob`

Auth model (implemented in `user-api`):

- Header `Authorization: Bearer <USERAPI_SERVICE_SECRET>`
- Header `X-User-Id: <id>`

This is used by `Frontend_Builder/integrations/userapi_client.py`.
