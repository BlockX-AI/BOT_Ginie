# AcademicChain: AI-Assisted Smart Contract Generation, Testing, and Deployment

## Executive Summary
AcademicChain streamlines the journey from natural‑language requirements to audited, deployed smart contracts. It combines prompt engineering, LLM generation, iterative compilation/repair, and automated deployment to EVM networks (e.g., Basecamp, Avalanche Fuji). The platform exposes a simple REST API and ships with ecosystem test suites to validate end‑to‑end deployment. Built-in structured logging and sensitive‑data redaction provide strong operational observability without compromising security.

Key outcomes:
- Faster contract delivery using AI with enforceable scaffolding and guardrails.
- Deterministic compilation and deployment using Hardhat and pinned compiler versions.
- Operational transparency via JSON logs, job tracking, and reproducible artifacts.

## Problem Statement
Teams waste time translating product specs into secure Solidity. Manual iteration (compile → fix → redeploy) is slow and error‑prone, especially for repeated patterns like registries, ERC20/721, and governance modules. Observability across AI generation, compilation, and deployment is poor; logs are fragmented and secrets can leak.

## Solution Overview
AcademicChain offers a unified pipeline:
1. Ingest prompt and options over REST.
2. Enhance prompt with safety/compliance structure and optional Gemini augmentation.
3. Generate Solidity, normalize it, and compile with Hardhat.
4. Iterate on compilation errors (bounded retries) with automatic fixes.
5. Deploy to a selected network, returning addresses and metadata.
6. Stream and persist job logs for full traceability.

## Core Features
- AI prompt enhancement:
  - Structural enforcement (`enhancePipelinePrompt`) and optional Gemini‑based augmentation (`ENABLE_GEMINI_PROMPT_AUGMENT`).
- Deterministic build & deploy:
  - Hardhat + OpenZeppelin; network alias normalization; constructor‑args validation.
- Observability:
  - Pino‑based structured logs with redaction; job log mirroring; HTTP request IDs.
- REST API surface:
  - `/api/ai/pipeline` for NL → code → deploy.
  - `/api/deploy/erc20` convenience deploy.
  - `/api/job/:id/status` and `/api/job/:id/logs` for tracking.
- Ecosystem tests:
  - `run_camp_ecosystem_tests.sh` and `run_camp_extended_tests.sh` validate multiple contract archetypes.
- Deploy anywhere:
  - Dockerized; Railway‑ready; supports Basecamp and Avalanche Fuji out‑of‑the‑box.

## Architecture Summary
- API: Node.js/Express (`api/server.js`), routes under `api/routes/` (e.g., `ai.js`).
- Job system: In‑memory with durable logs to file when enabled; `api/lib/jobs.js`.
- Logging: `api/lib/logger.js` (redaction, pretty dev logs, file sink via `LOG_TO_FILE`).
- Build system: Hardhat (`hardhat.config.js`), scripts in `scripts/`, contracts in `contracts/`.
- Artifacts: under `artifacts/` and `api/artifacts/` for API exposure.

## Security & Privacy
- Redaction of sensitive fields (API keys, auth headers, cookies) in logs.
- Job logs mirror to global logger with typed levels (info/error).
- No API keys stored in code; Gemini key is supplied via environment (`GEMINI_API_KEY`).
- CLI tests use public testnets by default; no custodial user funds.

## Performance & Reliability
- Bounded retry on compile/fix to prevent runaway loops.
- Streamed child‑process IO for immediate feedback during deploy.
- Health checks and readiness logging for container orchestration.

## Limitations
- LLM generation quality depends on the model; complex specs may require edits.
- In‑memory job store is ephemeral; use an external store (e.g., Redis/BullMQ) for HA.
- No automatic formal verification; relies on OZ patterns and compilation checks.

## Roadmap
- Pluggable model backends and RAG over audited patterns.
- Persistent job and artifact registry (DB + explorer UI).
- Integrated security checks (Slither/Foundry/echidna opt‑in).
- One‑click mainnet deployment with role handover flows.

## KPIs
- Time‑to‑first‑deployment from prompt (p50, p90).
- Successful compile rate without human edits.
- Mean iterations to successful compile.
- Error classes distribution (syntax vs linking vs constructor args).

## Getting Started
- Deploy: Dockerfile + Railway. Healthcheck on `/`.
- Configure:
  - `LOG_LEVEL=debug`, `LOG_TO_FILE=1` for durable logs.
  - `ENABLE_GEMINI_PROMPT_AUGMENT=1` with `GEMINI_API_KEY` for prompt boosts.
- Test: `BASE_URL=<api> ./run_camp_ecosystem_tests.sh 1` then `all`.
