# AcademicChain Architecture

## Overview
AcademicChain converts natural‑language prompts into deployed EVM smart contracts. The system centers around a Node.js API, a job orchestration layer, Hardhat build tooling, and structured logging for observability.

## Components
- API Server (`api/server.js`)
  - Express + pino-http, request IDs, CORS, OpenAPI docs endpoint.
- Routes (`api/routes/`)
  - `ai.js`: NL → code → compile → deploy pipeline.
  - `artifacts.js`, `citationRegistry.js`, etc., for domain endpoints.
- Job/Logging Libraries
  - `api/lib/jobs.js`: job lifecycle, in‑memory store, appendJobLog().
  - `api/lib/logger.js`: pino logger with redaction and optional file sink.
- Build & Deploy
  - `hardhat.config.js` and `scripts/` for deployments.
  - `contracts/` (sources), `artifacts/` (build outputs).
- DevOps
  - Dockerfile; Railway deployment; healthcheck on `/`.
  - Test runners: `run_camp_ecosystem_tests.sh`, `run_camp_extended_tests.sh`.

## Data Flow
1. Client POSTs `/api/ai/pipeline` with `{ prompt, network, filename, constructorArgs?, maxIters? }`.
2. `enhancePipelinePrompt()` shapes prompt; optional Gemini augmentation applies when enabled.
3. LLM generates Solidity. Code is written to a sandbox workspace.
4. Hardhat compiles; on error, bounded repair iterations occur.
5. On success, deploy script runs with normalized `--network` and config path.
6. Result (address, network, contract, params) is stored in job record; logs are streamed.
7. Client polls `/api/job/:id/status` and `/api/job/:id/logs` until completion.

## Key Modules and Files
- `api/routes/ai.js`
  - Stage transitions: generate → compile → deploy; constructor‑args validation; network aliasing (e.g., `camp-testnet` → `basecamp-testnet`).
  - Child process spawn for `npx hardhat run ...` with log streaming.
- `api/lib/jobs.js`
  - `createJob()`, `updateJob()`, `appendJobLog()`, in‑memory registry.
  - Mirrors job logs into the global logger with context.
- `api/lib/logger.js`
  - Central pino logger. Redacts headers like `authorization`, cookies, and environment‑derived secrets.
  - Pretty logs in development; file sink via `LOG_TO_FILE=1` to `logs/api.log`.

## API Surface (Selected)
- POST `/api/ai/pipeline`
- POST `/api/deploy/erc20`
- GET `/api/job/:id/status`
- GET `/api/job/:id/logs`

Request/response schemas live inline in the route code; responses include `ok`, `job`, and `data` payloads for status endpoints.

## Deployment & Environments
- Containerized via Dockerfile (Node 18 alpine). Copies `api/`, `contracts/`, `scripts/`, `artifacts/contracts`, `hardhat.config.js` and installs production deps.
- Railway service exposes port 8080 with healthcheck on `/`.
- Environment variables:
  - Logging: `LOG_LEVEL`, `LOG_TO_FILE`, `NODE_ENV`.
  - AI: `ENABLE_GEMINI_PROMPT_AUGMENT`, `GEMINI_API_KEY` (optional feature).

## Security Considerations
- Log redaction for secrets/macaroons/auth headers.
- No secrets in artifacts; avoids echoing entire env into logs.
- Constructor‑args sanity checks against ABI before deploy.
- Optional moderation mode can be added at route level to throttle abusive prompts (future work).

## Scalability & Reliability
- Stateless API processes; job store is in‑memory (single instance). For HA:
  - Replace with Redis/BullMQ for distributed workers and persistence.
  - Externalize logs to a collector (ELK/OpenSearch/Grafana Loki).
- Horizontal scale: run multiple API replicas behind a load balancer.
- Long‑running tasks are bounded via `TIMEOUT` in test scripts and max iteration guards during compile/repair.

## Observability
- Pino structured logs with context: `jobId`, stage, network, result.
- HTTP logs with request IDs; correlation via `X-Request-Id`.
- Job logs accessible via API to UIs/automation.

## Sequence (Text Diagram)
- Client → `/api/ai/pipeline`
- Route → `enhancePipelinePrompt()` → optional Gemini augment → LLM generate
- Write Solidity → Hardhat compile → [if error] fix/iterate (max N)
- Select artifact → validate constructor args → spawn deploy
- Stream logs → update job state → respond with address/network
- Client polls `/api/job/:id/status|logs`

## Future Extensions
- Integrate Slither/Foundry CI gates.
- Model‑specific templates and deterministic prompting with RAG.
- UI dashboard for job history, artifacts, and on‑chain explorers.
