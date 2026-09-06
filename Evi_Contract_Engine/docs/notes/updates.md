# Project Updates and LLM Migration Ideas

This document summarizes backend updates, network support, testing scripts, job APIs, and a proposed plan to evolve the LLM backend from Gemini to GPT-5 (OpenAI-compatible) without changing the API surface exposed to the frontend.

## Summary of Recent Backend Enhancements

- **Boba Sepolia network support**
  - Added `boba-sepolia` in `hardhat.config.js` with `BOBA_SEPOLIA_RPC_URL` and account from `PRIVATE_KEY`.
  - Normalized network aliases in API deploy endpoints (`api/server.js`) and AI routes (`api/routes/ai.js`):
    - Accepts `boba`, `boba-sepolia`, and `boba_sepolia` (underscores → hyphens; lowercased).
  - Recommended environment variables:
    - `BOBA_SEPOLIA_RPC_URL=https://sepolia.boba.network`
    - `PRIVATE_KEY=0x<...>`

- **API deploy endpoints (script-based)**
  - File: `api/server.js`
  - Endpoints:
    - `/api/deploy/erc20`
    - `/api/deploy/research-paper`
    - `/api/deploy/citation-registry`
    - `/api/deploy/royalty-distributor`
    - `/api/deploy/academic-suite`
  - All accept the normalized `network` (now includes Boba Sepolia aliases) and run `npx hardhat run ... --network <net>`.

- **AI routes**
  - File: `api/routes/ai.js`
  - Endpoints:
    - `/api/ai/generate` (LLM-only code generation)
    - `/api/ai/compile` (sandbox compile)
    - `/api/ai/fix` (compile, LLM-guided fix loop, deploy)
    - `/api/ai/pipeline` (generate → compile → fix-loop → deploy)
  - Uses an isolated Hardhat sandbox per job. Networks are inherited from root `hardhat.config.js`.

- **Job status and logs**
  - File: `api/routes/jobs.js`
  - Endpoints:
    - `GET /api/job/:id/status`
    - `GET /api/job/:id/logs?since=<ms>`
  - Use these to poll the state (`queued|running|completed|failed`) and tail logs.

## Test Scripts Added

- **`test_boba.sh`**
  - Location: project root.
  - Purpose: Run 10 AI pipeline tests on `boba-sepolia` against `BASE_URL` (defaults to `http://localhost:3000`).
  - Usage:
    ```bash
    chmod +x ./test_boba.sh
    ./test_boba.sh all
    ./test_boba.sh 1 3 7
    ```

- **`test_deploy_erc20_boba_21.sh`**
  - Location: project root.
  - Purpose: Batch deploy ~21 ERC20 tokens to `boba-sepolia` via `/api/deploy/erc20`.
  - Usage:
    ```bash
    chmod +x ./test_deploy_erc20_boba_21.sh
    ./test_deploy_erc20_boba_21.sh
    # Overrides
    COUNT=30 BASE_URL=http://localhost:3000 OWNER=0xYourAddr ./test_deploy_erc20_boba_21.sh
    ```
  - Output: JSON and Markdown summaries in `deployments/`.

- Existing helpers (for reference):
  - `test_deploy_erc20.sh`: single ERC20 deploy smoke.
  - `test_deploy_erc20_batch.sh`: large batch deploy (default 2500) to a selected network.
  - `run_camp_ecosystem_tests.sh`: Camp/Basecamp pipeline end-to-end tests.

## Constructor Args – Current Behavior vs. Proposed Auto-Fix

- **Current behavior** (as in `api/routes/ai.js`):
  - `/api/ai/fix`: If constructor arg count does not match ABI, the job fails at `deploy_prep` with `CONSTRUCTOR_ARGS_MISMATCH`.
  - `/api/ai/pipeline`:
    - `strictArgs=true`: Fails with `CONSTRUCTOR_ARGS_REQUIRED`.
    - `strictArgs=false`: Auto-fills using simple type defaults (e.g., address=0x0, uint=0, string="").

- **Proposed backend-only auto-fix (no API changes)**
  - Detect mismatch by reading the artifact ABI (ground truth for constructor inputs).
  - Compute final constructor args as:
    - Keep provided positional args intact.
    - For missing positions, infer defaults using param name + type heuristics.
    - Truncate extras if too many were provided.
  - Replace any `$DEPLOYER` sentinel with the signer’s address at deploy time.
  - Log a warning including expected vs. provided vs. final arrays.
  - Optional env-driven overrides for critical addresses.

- **Default inference heuristics (examples)**
  - address owners/admin/treasury/recipient/wallet → `$DEPLOYER`
  - address token/erc20 → `DEFAULT_TOKEN_ADDRESS` (if set) else `0x000…0000`
  - address[] owners → `["$DEPLOYER"]`
  - string name → contractName or `AIGenerated`
  - string symbol → `AI`
  - bytes32 merkleRoot → `DEFAULT_MERKLE_ROOT` (if set) else zero-bytes32
  - uint/int threshold → 1 (updated below when owners[] exists)
  - uint fees/bps → `DEFAULT_FEE_BPS` or 0
  - uint amount/supply/cap → `DEFAULT_INITIAL_AMOUNT` or 0
  - arrays/tuple → `[]`
  - Post-fix: if `owners[]` and `threshold` are present and threshold wasn’t provided, set to `ceil(owners.length/2)` with min=1.

- **Optional env variables**
  - `DEFAULT_TOKEN_ADDRESS`
  - `DEFAULT_TREASURY`
  - `DEFAULT_FORWARDER`
  - `DEFAULT_MERKLE_ROOT`
  - `DEFAULT_FEE_BPS`
  - `DEFAULT_INITIAL_AMOUNT`
  - `ENABLE_AUTO_CONSTRUCTOR=1` (feature flag)

This approach preserves the frontend contract while making the backend resilient when users omit constructor args.

## LLM Migration: Gemini → GPT-5 (OpenAI-compatible) Plan

Goal: Replace direct Gemini usage with a provider-agnostic LLM layer, enabling a seamless switch to GPT-5 (or any OpenAI-compatible model) via configuration.

### Design Overview

- **Abstract LLM client**
  - Create `api/lib/llm/index.js` exporting a unified function:
    ```js
    // generateText({ system, user, model, jsonPreferred }) => { text }
    ```
  - Implement two adapters:
    - `api/lib/llm/gemini.js` (current logic)
    - `api/lib/llm/openai.js` (GPT-5-ready; uses OpenAI-compatible API)
  - Use `LLM_PROVIDER` env to select: `gemini` (default) or `openai`.

- **Environment configuration**
  - `LLM_PROVIDER=gemini|openai`
  - `LLM_MODEL` (e.g., `gemini-2.5-pro`, `gpt-5`, `gpt-4.1` as a fallback)
  - `GEMINI_API_KEY` and/or `OPENAI_API_KEY`
  - Optional: `LLM_TIMEOUT_MS`, `LLM_MAX_RETRIES`, `LLM_BASE_URL` (for proxy/self-hosted gateways)

- **Input/Output normalization**
  - Wrap Gemini’s `contents: [{role, parts:[{text}]}]` and OpenAI’s `messages: [{role, content}]` into a common interface.
  - Preserve current sanitization (`sanitizeSolidity`) and code block extraction (`extractFirstCodeBlock`) so the downstream pipeline remains unchanged.

- **Error handling & retries**
  - Standardize retry policy for 408/429/5xx with exponential backoff (tune per-provider rate limits).
  - Add structured error messages to logs (`appendJobLog`) for better observability.

- **Security & privacy**
  - Avoid logging secrets; redact env-like tokens in prompts/logs.
  - Support a “safe-mode” flag to disable prompt augmentation in sensitive contexts.

### Minimal Code Changes (High Level)

1. Introduce LLM layer:
   - `api/lib/llm/index.js`
   - `api/lib/llm/gemini.js`
   - `api/lib/llm/openai.js`

2. Refactor `api/routes/ai.js` to import the abstraction:
   ```js
   const { generateText } = require('../lib/llm');
   // Replace callGemini() invocations with generateText({ system, user, model })
   ```

3. Add env support and update README/updates.md.

4. Validate with the existing tests (`test_boba.sh`, ecosystem tests, and a few focused prompts that previously failed/required fixes).

### OpenAI Adapter Notes (GPT-5-ready)

- Endpoint: typical `POST /v1/chat/completions` (or newer unified `responses` endpoint if available).
- Request (example):
  ```json
  {
    "model": "gpt-5",
    "messages": [
      {"role": "system", "content": "You are an expert Solidity engineer..."},
      {"role": "user", "content": "Generate a contract..."}
    ],
    "temperature": 0.2,
    "response_format": {"type": "text"}
  }
  ```
- Response handling: Concatenate assistant messages to `text` and feed into our existing sanitization and compile pipeline.

### Rollout Plan

- Phase 1: Ship the LLM abstraction with Gemini as default (no behavior change).
- Phase 2: Add OpenAI adapter behind `LLM_PROVIDER=openai`; smoke-test `generate` and `pipeline`.
- Phase 3: Performance tuning (token costs, latency); possibly add JSON schema outputs for cleaner parsing.
- Phase 4: Flip default in environments where GPT-5 is desired.

## Operational Notes

- **Railway deployment**
  - Ensure `BOBA_SEPOLIA_RPC_URL` + `PRIVATE_KEY` are set in the environment where the API is deployed.
  - Add `LLM_PROVIDER`, `LLM_MODEL`, and the corresponding API key (`GEMINI_API_KEY` or `OPENAI_API_KEY`).

- **Observability**
  - Continue using job logs via `appendJobLog` and `/api/job/:id/logs` for debugging compile/deploy issues.
  - Consider emitting explorer URLs for Boba addresses in deploy responses (e.g., Bobascan) if a stable explorer URL is available.

## Changelog (Human-Friendly)

- Boba Sepolia support wired across Hardhat and API endpoints (aliases: `boba`, `boba-sepolia`, `boba_sepolia`).
- Added scripts for local testing: `test_boba.sh`, `test_deploy_erc20_boba_21.sh`.
- Documented job status/logs endpoints and recommended curl loops.
- Proposed backend-only constructor args auto-fix to reduce `CONSTRUCTOR_ARGS_*` failures.
- Outlined an LLM provider abstraction to enable switching from Gemini to GPT-5 with minimal code churn.

---
If you want, I can implement the LLM abstraction (`api/lib/llm/*`) and wire it into `api/routes/ai.js` behind a feature flag without touching the frontend. Let me know and I’ll proceed.
