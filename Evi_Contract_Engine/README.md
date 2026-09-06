# EVI Contract Engine

EVI Contract Engine is an end-to-end smart contract pipeline that turns a natural language prompt into a deployed contract, with automated compilation, AI-driven fixes, verification, audit, and compliance checks.

The system is API-first and production-oriented:

- **AI → Compile → Fix loop (up to 11 iterations)**
- **Deploy to multiple networks** (including `avalanche-fuji`)
- **Verify source on explorers** (Blockscout / Snowtrace / BscScan)
- **AI security audit** with structured report + validation
- **AI compliance checks** with configurable profiles/policies
- **Wallet signing deployments** (non-custodial) via a magic link session flow
- **Persistent job store** (PostgreSQL-backed) so results survive redeployments

## Architecture (High Level)

```text
Prompt
  ↓
/api/ai/pipeline (job created)
  ↓
AI generation (Gemini) → sandbox compile (Hardhat) → AI fix loop → deploy
  ↓
/api/verify/byJob → /api/audit/orchestrate → /api/compliance/orchestrate
  ↓
Artifacts + reports available via /api/artifacts
```

## Repository Structure

```text
.
├── api/                      # Express API server + route modules
│   ├── server.js             # Main server entrypoint
│   ├── routes/               # AI, jobs, artifacts, verify, audit, compliance, wallet deploy
│   └── lib/                  # jobStore (Postgres), tx utils, sessions, logger
├── contracts/                # Solidity contracts and primitives
├── scripts/                  # Hardhat scripts + network docs
├── deployments/              # Deployment outputs (if used)
├── docs/                     # Repository documentation (see below)
├── acv-test-logic.js         # End-to-end ACV runner (AI→Contract→Verify→Audit→Compliance)
├── hardhat.config.js         # Multi-network Hardhat configuration
└── package.json              # Root dependencies
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- (Optional) PostgreSQL for persistence (`DATABASE_URL`)

### Install

```bash
npm install
```

### Configure Environment

Create a `.env` file (do not commit it). Minimum for AI:

- `GEMINI_API_KEY` (required)
- `GEMINI_MODEL=gemini-2.5-pro` (recommended)

For deployments you also need:

- RPC URLs + private keys for the target networks (see `hardhat.config.js`)

### Run API Server

```bash
node api/server.js
```

- Swagger: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`

## Core APIs

- **AI pipeline**: `POST /api/ai/pipeline`
- **Fix code**: `POST /api/ai/fix`
- **Job status**: `GET /api/job/:id/status`
- **Job logs**: `GET /api/job/:id/logs`
- **Logs stream (SSE)**: `GET /api/job/:id/logs/stream`
- **Artifacts**: `GET /api/artifacts?jobId=<id>&include=all`
- **Verify**: `POST /api/verify/byJob`
- **Audit**: `POST /api/audit/orchestrate`
- **Compliance**: `POST /api/compliance/orchestrate`
- **Wallet-based deploy**: `POST /api/wallet/deploy-with-wallet`

## Wallet Signing Flow (Non-Custodial)

- Start: `POST /api/wallet/deploy-with-wallet`
- Fetch session: `GET /api/wallet/sign/:sessionId`
- Submit signed tx: `POST /api/wallet/sign/:sessionId/submit`

Sessions expire after 15 minutes and are single-use.

## Documentation

Root-level docs are organized under `docs/`. Key references:

- `docs/API_DOCUMENTATION.md`
- `docs/DEPLOYMENT_GUIDE.md`
- `docs/FRONTEND_GUIDE.md`
- `docs/SWAGGER_WALLET_DOCS.md`

## Security

- Never commit `.env` or private keys
- Prefer network-specific private keys in environment variables
- Wallet signing mode is non-custodial (server never sees user private keys)

## License

MIT
