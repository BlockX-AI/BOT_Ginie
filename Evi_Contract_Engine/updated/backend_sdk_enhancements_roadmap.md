# Backend SDK Server – Enhancements & Roadmap

This document proposes impactful additions to the SDK server (see `updated/backend_sdk_api_service_plan.md` and `updated/backend_sdk_user_guide.md`) to improve developer experience, security, scale, and operability.


## Goals
- Shorten the time from “AI job finished” to “production-grade API” even further.
- Improve safety of server-signed writes while keeping the read-only path frictionless.
- Provide better discovery, docs, and client SDKs for downstream teams.
- Make operations reliable (observability, rate limits, multi-tenant control).


## High-Impact Enhancements (Near-term)
- **[OpenAPI for SDK endpoints]**
  - Auto-generate `/openapi.json` for the SDK surface (`/sdk/*`).
  - Benefits: machine-readable docs, Postman collection, SDK codegen for TS/JS, Python, Go.
  - Implementation: mirror the style used in `api/server.js` Swagger setup and emit a spec for the SDK routes.

- **[Postman + Examples]**
  - Publish a ready-to-run Postman collection referencing a deployed Railway base URL.
  - Include example envs (staging/prod) and sample read/write/event flows.

- **[Client SDK packages]**
  - Use OpenAPI Generator to ship `@yourorg/contract-sdk` (TypeScript) and `yourorg-contract-sdk` (Python) for the `/sdk/*` API.
  - Pin versions to the OpenAPI spec for reproducibility.

- **[Method allowlist UX]**
  - Add `/sdk/admin/methods` to view/modify the write allowlist at runtime (requires admin key), with in-memory + env-backed persistence.
  - Provide a dry-run mode: simulate writes (eth_call) and return estimated gas before sending.

- **[Event webhooks]**
  - Webhook dispatch on matched events: `/sdk/hooks` config (admin-only) to push JSON to endpoints (retries + backoff).
  - Use signing secret to authenticate webhook payloads on the consumer side.

- **[Multicall for reads]**
  - `POST /sdk/call.batch` with `{ calls: [{ method, args }, ...] }` leveraging Multicall or aggregated JSON-RPC to reduce latency.

- **[Result normalization + typing]**
  - Standardize BigInt → string, bytes → hex across all endpoints.
  - Include `types` field in responses (from ABI) to ease client-side parsing.

- **[Per-method caching]**
  - TTL cache for pure/view reads (configurable per-method) + `ETag` headers.
  - Optional `cache=0` query to bypass.


## Security & Access Control
- **[Auth options]**
  - Keep API key for writes. Add JWT bearer support for multi-tenant setups.
  - Optional SIWE (Sign-In With Ethereum) for mapping EOAs to roles.

- **[RBAC]**
  - Role-based method permissions: `admin`, `writer`, `reader`, per method/event.

- **[Key management]**
  - Rotate `PRIVATE_KEY` via Railway variables and add `/sdk/admin/rotate-key` flow (no key material in logs).
  - Optionally isolate signer to a separate microservice or HSM-backed wallet for blast radius reduction.

- **[Rate limiting & quotas]**
  - Per-API-key quotas, burst control, and descriptive 429 responses.

- **[Request signing]**
  - For sensitive admin endpoints, require an `X-Signature` HMAC over (method+path+body+timestamp) using a server-side secret.


## Observability & Reliability
- **[Structured logs + tracing]**
  - Use `pino` with request IDs (see `api/server.js` pattern). Emit external call latencies to `/api/job` and `/api/artifacts`.
  - Integrate OpenTelemetry exporters for traces (collector optional).

- **[Metrics]**
  - `/metrics` endpoint (Prometheus) for request counts, p95 latency, cache hit ratio, tx success rate.

- **[Health & readiness]**
  - `/sdk/health` returns richer checks: RPC reachable, job metadata fresh, ABI loaded, signer status.

- **[Queue for writes]**
  - Confirm per-network nonce queue (similar to `enqueueDeploy` in `api/server.js`) with visibility endpoints (`/sdk/tx/queue`).


## Multi-Contract & Multi-Job
- **[Dynamic job selection]**
  - Support `x-job-id` or `?jobId=` override to switch target contract without redeploying the server.
  - Cache ABIs per jobId; expose `/sdk/reload` to refresh.

- **[Multiple contracts per job]**
  - If a job compiled/deployed multiple contracts, add `?contract=` selector and list them in `/sdk/contract`.

- **[Versioning]**
  - Embed `{ jobId, fqName, commit, buildTs }` in `/sdk/contract` and response headers for traceability.


## Developer Experience
- **[Scaffolds & templates]**
  - Provide a CLI or `npx` template to spin a new SDK service bound to a specific `jobId`.

- **[Docs site]**
  - Simple Docusaurus page consuming the OpenAPI to display live docs and code samples.

- **[Monorepo integration]**
  - CI pipeline to: (1) verify job status, (2) build OpenAPI, (3) publish SDK packages, (4) deploy Railway.


## Data & Indexing Options
- **[Event indexer]**
  - Optional Postgres/SQLite integration to persist decoded events and expose query endpoints.
  - Useful for pagination, analytics, or dashboards.

- **[GraphQL facade]**
  - Optional GraphQL endpoint mirroring `/sdk/call` and indexed entities. GraphQL subscriptions map to SSE/websocket under the hood.


## Verification & Artifacts UX
- **[Auto-verify]**
  - If `/api/verify/byJob` is available (see `api/routes/verify.js`), add an SDK admin action `/sdk/admin/verify` to ensure the explorer shows verified code post-deploy.

- **[Artifact surfacing]**
  - Proxy `GET /api/artifacts/*` for the job from the SDK server to ease frontends’ access to ABI/source listings.


## Reliability Patterns (Railway)
- **[Env promotion]**
  - Staging → production promotion with variable snapshots.

- **[Blue/green or canary]**
  - Deploy two SDK instances and cut traffic gradually.

- **[Crash restart policy]**
  - Use a process manager (PM2 or Node cluster) to recover instantly from unexpected crashes.


## Acceptance Tests & Load Tests
- **[Contract-aware tests]**
  - A small test suite (Jest) that reads `/sdk/methods` and validates a sample of read calls.
  - Synthetic write tests gated behind a separate API key in CI (skip in PRs).

- **[k6/Artillery]**
  - Load-test read endpoints and event polling to set practical rate limits and cache TTLs.


## Roadmap Phasing
- **Phase 1 (MVP++)**: OpenAPI + Postman + client SDKs; method allowlist UX; multicall reads; stronger health.
- **Phase 2**: Event webhooks; RBAC; per-key rate limiting; metrics; admin key rotation.
- **Phase 3**: Event indexer (DB); GraphQL facade; dynamic job selection; SDK codegen publishing pipeline.
- **Phase 4**: HSM/remote signer; blue/green deploys; full SLOs and alerting.


## References in Repository
- ABI & source resolution: `api/routes/artifacts.js`
- Verify flows: `api/routes/verify.js`
- API mounts & patterns (logging, queues): `api/server.js`
- Orchestration example: `scripts/full_flow.js`

These enhancements align with the existing aggregator routes and docs under `updated/frontend_audit_compliance_verify.md` and `updated/frontend_audit_compliance_apis.md`, and are designed to be additive without disrupting current flows.
