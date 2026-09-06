# LLM Audit & Compliance Services

This document outlines the integration plan for two new LLM-backed services—Auditing and Compliance—fully compatible with the existing API, jobs, SSE logs, and artifacts flows. The plan is broken into two phases (Code-based and Job ID-based). A future pre-deploy gate is specified but kept on hold.

## Goals
- Provide structured, JSON-only audit and compliance reports for Solidity contracts.
- Allow analysis directly from pasted code or by referencing an existing pipeline/fix job (`jobId`).
- Optional orchestration to analyze → fix (using existing `ai.js` fix API) → deploy, returning a combined result.

### Prompt files (wired for reuse)
- Audit prompt: `./audit_prompt.md`
  - Use this with `callGemini()` for all audit endpoints (`/api/audit/analyze`, `/api/audit/byJob`, and orchestrations).
- Compliance prompt: `./compliance_prompt.md`
  - Use this with `callGemini()` for all compliance endpoints (`/api/compliance/analyze`, `/api/compliance/byJob`, and orchestrations).

How to load in code (example):
```
const fs = require('fs');
const path = require('path');
// If reading the prompts from this updated/ docs folder at runtime:
const auditPrompt = fs.readFileSync(path.join(__dirname, 'updated', 'audit_prompt.md'), 'utf8');
const compliancePrompt = fs.readFileSync(path.join(__dirname, 'updated', 'compliance_prompt.md'), 'utf8');
// Alternatively, keep runtime prompts under api/prompts/ and use those paths in production code.
```

---

## Phase 1 — Code-Based Endpoints

Two new route modules will be added:
- `api/routes/audit.js`
- `api/routes/compliance.js`

They will reuse the existing Gemini client helper from `api/routes/ai.js` (see `callGemini`) and plug into the jobs/logs/artifacts system.

### 1) Audit Endpoints

- POST `/api/audit/analyze`
  - Request
    - `{ code: string, filename?: string, model?: string, policy?: { severityThreshold?: 'info'|'warning'|'error', focus?: string[] } }`
  - Behavior
    - Sends the Solidity code to Gemini using an audit-focused prompt and strict JSON-only instructions.
    - Produces a structured report with findings, severities, categories, evidence, and recommendations.
  - Response
    - `{ ok: true, report: { summary, findings: Array<...>, score: number, severityMax, recommendations } }`
  - Artifacts (optional)
    - `tmp/jobs/audit_<timestamp>/audit/report.json`

- POST `/api/audit/orchestrate`
  - Request
    - `{ code: string, fix?: boolean, deploy?: boolean, network?: string, model?: string, fixModel?: string, constructorArgs?: any[] }`
  - Behavior
    - Runs audit on the provided code.
    - If `fix: true` and issues exceed the threshold, generates a targeted “fix” prompt and calls `POST /api/ai/fix` to correct the code.
    - If `deploy: true`, lets the fix flow deploy and captures the deployed address.
    - Streams progress via the existing jobs SSE.
  - Response
    - `{ ok, audit: {...}, fixJob?: { id, finalStatus }, deploy?: { address, network }, artifacts?: {...} }`
  - Artifacts
    - `tmp/jobs/<orchestrateJobId>/analysis/report.json`
    - `tmp/jobs/<orchestrateJobId>/result.json`

### 2) Compliance Endpoints

- POST `/api/compliance/analyze`
  - Request
    - `{ code: string, filename?: string, model?: string, profile?: 'generic'|'registry'|'token'|'custom', strict?: boolean, policyPack?: string, policyChecks?: Array<{ id: string, title: string, criterion: string, severity: 'info'|'warning'|'error', mapping?: string[] }> }`
  - Behavior
    - Sends code to Gemini with a compliance checklist prompt.
    - If `profile==='registry'`, includes the specification already used by `enhancePipelinePrompt()` in `ai.js` (roles like `AUDITOR_ROLE`, `SUBMITTER_ROLE`, required functions like `submitVerification`, `revokeLatest`, `attest`, plus guardrails).
    - If `profile==='custom'` and `policyPack` is provided, loads checks from `api/policies/<policyPack>.json`. If `policyChecks` is provided, uses those inline checks. These checks are injected into the prompt so the LLM returns per‑check pass/fail with mappings.
  - Response
    - `{ ok: true, compliance: { summary, passed: boolean, score: number, checks: Array<{ id, title, passed, severity, details, mapping?: string[] }>, recommendations } }`

- POST `/api/compliance/orchestrate`
  - Request
    - `{ code: string, targetProfile?: string, strict?: boolean, fix?: boolean, deploy?: boolean, network?: string, model?: string, fixModel?: string, constructorArgs?: any[] }`
  - Behavior
    - Runs compliance analysis on the provided code.
    - If non-compliant and `fix: true`, synthesizes failed checks into a “compliance-fix” prompt and calls `POST /api/ai/fix`.
    - Optionally deploys, returning the new address.
  - Response
    - `{ ok, compliance: {...}, fixJob?: {...}, deploy?: {...} }`

### Prompting, Guardrails, and Scoring

- Reuse `callGemini` from `api/routes/ai.js` for auth/retries/timeouts.
- Maintain dedicated prompt templates (see the two files in this `updated/` folder):
  - `audit_prompt.md`
    - Require JSON-only output with fields:
      - `findings: [{id, title, severity, category, file, line, description, remediation, references}]`
      - `overall: {score, severityMax, summary, recommendations}`
    - Guardrails: No code fences; no commentary; OZ v4.9.x; Solidity ^0.8.19/^0.8.20.
  - `compliance_prompt.md`
    - Profile-specific checklists. For `registry`, enforce roles, events, functions, and guardrails.
    - Require JSON summary with per-check pass/fail and overall pass/score.
- Severity model: map LLM severities to policy (info < warning < error). Endpoints accept `severityThreshold`/`strict`.

## Framework Policy Packs

| Framework | Scope | Code checks enforced (examples) | Policy pack name | Mapping tags/references | Output format | Evidence & artifacts | Status |
|---|---|---|---|---|---|---|---|
| SOC 2 (TSC) | Security, Availability, Processing Integrity, Confidentiality, Privacy | Least-privilege roles, critical-path auth, auditable events, input validation, rate limiting/circuit breakers, secure upgrade flows, dependency allowlists | soc2-lite | CC6.x, CC7.x, CC8.x (where code-applicable) | JSON: passed, score (0–100), checks[{id,title,passed,severity,details,mapping?}] | Persist report.json; SSE logs; link findings to emitted events/role gates | Ready to add |
| NIST CSF | Identify/Protect/Detect/Respond/Recover | Protect: RBAC, safe transfers, reentrancy guards; Detect: events for sensitive actions; Respond/Recover: pause/circuit-breakers, upgrade governance; Identify: versioning/metadata | nist-csf-smart-contract | PR.AC, PR.DS, DE.AE, RS.MI, RC.IM (subset) | JSON: passed, score, checks with category mapping | report.json + SSE; per-check evidence from code (events/hooks/roles) | Ready to add |
| NIST SP 800-53 rev5 | AC, AU, CM, SC, SI families | AC: RBAC/least privilege; AU: audit events; CM: versioned/controlled upgrades; SC: safe external calls/withdrawal patterns; SI: input validation/invariants | nist-800-53-lite | AC-3/AC-6, AU-2/AU-12, CM-5/CM-13, SC-7, SI-10 (subset) | JSON: passed, score, checks with control IDs | report.json + SSE; map each check to code evidence (modifiers, emits, guards) | Ready to add |
| DORA | Operational resilience across ICT | Incident signaling via events, pause/feature flags, strict access/change control, dependency allowlists, deterministic deployments | dora-smart-contract | DORA Articles/RTS (code-relevant subset) | JSON: passed, score, checks with article refs | report.json + SSE; evidence via pause controls, upgrade auth, event coverage | Ready to add |
| ISO 27001 | ISMS, risk-based security | Secure development artifacts (audit evidence), controlled upgrades/changes, event logging for critical ops | iso27001-dev-lite | Annex A (code-relevant controls subset) | JSON: passed, score, checks with Annex mappings | report.json + SSE; attach audit outputs as development evidence | Ready to add |
| Custom | Your checklist/policy | Any code-tied checks you define (roles, events, guards, patterns) | custom | Your labels/refs | JSON: passed, score, checks (you define) | report.json + SSE; evidence per your criteria | Supported now |

### SSE Logs and Artifacts

- Create a dedicated job when orchestrating, stream via `/api/job/:id/logs/stream`.
- Save reports and summaries under `tmp/jobs/<jobId>/audit` and/or `tmp/jobs/<jobId>/compliance`.
- Expose via existing `api/routes/artifacts.js`.

### Error Handling & Fallbacks

- If LLM response is invalid JSON, retry with stricter instructions or return `{ ok:false, error:'LLM_ANALYSIS_FAILED' }`.
- (Optional) Offer a local static-check fallback (Solhint + AST guardrails) and return that minimal report.

---

## Phase 2 — Job ID-Based Endpoints

These endpoints analyze the code associated with an existing job (pipeline/fix) and produce audit/compliance results without requiring the user to paste code again.

### 1) Audit by Job

- POST `/api/audit/byJob`
  - Request
    - `{ jobId: string, model?: string, policy?: {...} }`
  - Behavior
    - Resolves the source file for the job:
      - Prefer `tmp/jobs/<jobId>/contracts/AI_<jobId>_<filename>.sol` if present.
      - Fallback: Call `/api/artifacts?jobId=<id>&include=all` and pick the main file (the one compiled to the chosen deploy artifact).
    - Runs the same audit flow as `/api/audit/analyze`.
  - Response
    - Same as analyze, plus `sourceRef: { jobId, filename }`.
  - Artifacts
    - `tmp/jobs/<jobId>/audit/report.json`

### 2) Compliance by Job

- POST `/api/compliance/byJob`
  - Request
    - `{ jobId: string, model?: string, profile?: string, strict?: boolean }`
  - Behavior
    - Resolves the source as above and runs compliance analysis.
  - Response
    - Same as `/api/compliance/analyze`, plus `sourceRef`.

### 3) Orchestrate by Job (Analyze → Fix → Deploy)

- POST `/api/audit/orchestrate` or `/api/compliance/orchestrate`
  - Request
    - `{ jobId: string, fix?: boolean, deploy?: boolean, network?: string, model?: string, fixModel?: string, constructorArgs?: any[] }`
  - Behavior
    - Resolve source using sandbox or artifacts.
    - Run analysis; if `fix:true` and necessary, call `POST /api/ai/fix` using findings/failed checks as context.
    - If `deploy:true`, let the fix job deploy.
  - Response
    - `{ ok, analysis: {...}, fixJob?: { id, finalStatus }, deploy?: { address, network }, artifacts?: {...} }`

---

## Pre-Deploy Gate (On Hold)

A built-in gate inside the pipeline that runs analysis after compile and before deploy, blocking risky deployments. This is kept on hold for now but can be enabled later.

- Insert step `audit`/`compliance` after compile success in `api/routes/ai.js`.
- If severity ≥ threshold or non-compliant under strict mode, set job `state='failed'` with `error='AUDIT_FAILED' | 'COMPLIANCE_FAILED'` and persist reports.
- Stream summarized findings via SSE; persist under `pipeline/audit` and/or `pipeline/compliance` in the run directory.

---

## Environment & Configuration

- `.env`
  - `GEMINI_API_KEY` (already present)
  - `AUDIT_MODEL`, `COMPLIANCE_MODEL` (default to `GEMINI_MODEL`)
  - `LLM_ANALYSIS_TIMEOUT_MS`, `LLM_ANALYSIS_MAX_RETRIES`
  - `ANALYSIS_SEVERITY_THRESHOLD=error`, `COMPLIANCE_STRICT=0|1`
  - `POLICY_PACKS_DIR=api/policies` (optional override; default path for policy packs)

- Safety
  - Prompt strictness: enforce JSON-only output; validate JSON.
  - Optionally add rate limiting or token auth for these routes.

---

## Testing & Rollout

- Phase 1
  - Implement `/analyze` (audit/compliance) with JSON reports and SSE job when orchestrating.
- Phase 2
  - Implement `/byJob` (audit/compliance), verify source resolution via sandbox/artifacts.
- Phase 3
  - Implement `/orchestrate` (audit/compliance) integrating with `POST /api/ai/fix` and deployment; return combined results.
- Phase 4 (optional)
  - Add local static checks fallback (Solhint + AST rules) and a no-LLM mode.

---

## References in Repo

- Gemini client: `api/routes/ai.js` → `callGemini()`
- Jobs system & SSE: `api/routes/jobs.js`, `api/lib/jobs`
- Artifacts export: `api/routes/artifacts.js`
- Fix pipeline: `POST /api/ai/fix` in `api/routes/ai.js`
- Policy packs (optional): `api/policies/` (e.g., `soc2-lite.json`, `nist-csf-smart-contract.json`, `nist-800-53-lite.json`, `dora-smart-contract.json`, `iso27001-dev-lite.json`)
