# Frontend Integration Guide: Audit & Compliance APIs

Status: Planned endpoints, to be added server-side in `api/routes/audit.js` and `api/routes/compliance.js` and mounted in `api/server.js`.

This guide explains how the React/Vite frontend (`academic-chain-front-main/`) should call the new Audit & Compliance endpoints, render results, attach to job logs (SSE), and fetch persisted artifacts.

- Base URL: the frontend already uses `src/services/apiClient.ts` with `import.meta.env.VITE_API_URL` (default `http://localhost:3000`).
- SSE Logs: use `GET /api/job/:id/logs/stream` to stream orchestrations.
- Artifacts: use `GET /api/artifacts` and the new audit/compliance artifact helpers.

---

## Endpoints

These endpoints reuse the existing Gemini client and the Jobs & Artifacts flows. Response shapes are JSON-only and stable for rendering tables and summaries.

### Audit

1) POST `/api/audit/analyze`
- Request body:
```json
{
  "code": "string",
  "filename": "string?",
  "model": "string?",
  "policy": {
    "severityThreshold": "info|warning|error",
    "focus": ["string"]
  }
}
```
- Response body (example types further below):
```json
{
  "ok": true,
  "report": {
    "summary": "string",
    "score": 0,
    "severityMax": "info",
    "findings": [
      {
        "id": "string",
        "title": "string",
        "severity": "info|warning|error",
        "category": "access-control|arithmetic|reentrancy|dos|upgradeability|gas|validation|style|other",
        "file": "string",
        "line": 1,
        "description": "string",
        "impact": "string",
        "likelihood": "low|medium|high",
        "evidence": "string",
        "references": ["string"],
        "remediation": "string"
      }
    ],
    "recommendations": ["string"]
  }
}
```

2) POST `/api/audit/byJob`
- Request body:
```json
{ "jobId": "string", "model": "string?", "policy": {"severityThreshold": "info|warning|error"} }
```
- Response body: same as analyze + `sourceRef`.
- Source resolution: first `tmp/jobs/<jobId>/contracts/AI_<jobId>_*.sol`, else `/api/artifacts?jobId=<id>&include=sources`.

3) POST `/api/audit/orchestrate`
- Request body:
```json
{
  "code": "string" | undefined,
  "jobId": "string" | undefined,
  "fix": true,
  "deploy": false,
  "network": "basecamp",
  "model": "string?",
  "fixModel": "string?",
  "constructorArgs": []
}
```
- Behavior: Analyze → if threshold exceeded and `fix:true`, calls existing `POST /api/ai/fix` → if `deploy:true`, the fix flow deploys → returns combined result and streams logs via `/api/job/:id/logs/stream`.
- Response body (shape may include nested `fixJob` and `deploy` info):
```json
{
  "ok": true,
  "audit": { /* same as report above */ },
  "fixJob": { "id": "string", "finalStatus": "completed|failed" },
  "deploy": { "address": "0x...", "network": "basecamp" },
  "artifacts": { /* optional */ }
}
```

### Compliance

1) POST `/api/compliance/analyze`
- Request body:
```json
{
  "code": "string",
  "filename": "string?",
  "model": "string?",
  "profile": "generic|registry|token|custom",
  "strict": false,
  "policyPack": "string?",
  "policyChecks": [
    { "id": "string", "title": "string", "criterion": "string", "severity": "info|warning|error", "mapping": ["string"] }
  ]
}
```
- Response body:
```json
{
  "ok": true,
  "compliance": {
    "summary": "string",
    "passed": true,
    "score": 100,
    "checks": [
      {
        "id": "string",
        "title": "string",
        "passed": true,
        "severity": "info|warning|error",
        "details": "string",
        "mapping": ["string"]
      }
    ],
    "recommendations": ["string"]
  }
}
```

2) POST `/api/compliance/byJob`
- Request body:
```json
{ "jobId": "string", "model": "string?", "profile": "generic|registry|token|custom", "strict": false }
```
- Response body: same as analyze + `sourceRef`.

3) POST `/api/compliance/orchestrate`
- Request body:
```json
{
  "code": "string" | undefined,
  "jobId": "string" | undefined,
  "targetProfile": "string?",
  "strict": false,
  "fix": false,
  "deploy": false,
  "network": "basecamp",
  "model": "string?",
  "fixModel": "string?",
  "constructorArgs": []
}
```
- Response body mirrors the audit orchestrate structure with `compliance` instead of `audit`.

### Artifacts (new helpers)

- GET `/api/artifacts/audit?jobId=<id>` → `{ ok, jobId, report }` reading `tmp/jobs/<jobId>/audit/report.json`.
- GET `/api/artifacts/compliance?jobId=<id>` → `{ ok, jobId, report }` reading `tmp/jobs/<jobId>/compliance/report.json`.

> Note: These are additive to the existing endpoints in `api/routes/artifacts.js` like `/api/artifacts`, `/api/artifacts/sources`, `/api/artifacts/abis`, `/api/artifacts/scripts`.

---

## TypeScript Types (frontend)

```ts
export type Severity = 'info' | 'warning' | 'error';

export interface AuditFinding {
  id: string;
  title: string;
  severity: Severity;
  category: 'access-control' | 'arithmetic' | 'reentrancy' | 'dos' | 'upgradeability' | 'gas' | 'validation' | 'style' | 'other';
  file: string;
  line: number;
  description: string;
  impact: string;
  likelihood: 'low' | 'medium' | 'high';
  evidence: string;
  references: string[];
  remediation: string;
}

export interface AuditReport {
  summary: string;
  score: number; // 0..100
  severityMax: Severity;
  findings: AuditFinding[];
  recommendations: string[];
}

export interface ComplianceCheck {
  id: string;
  title: string;
  passed: boolean;
  severity: Severity;
  details: string;
  mapping?: string[];
}

export interface ComplianceReport {
  summary: string;
  passed: boolean;
  score: number;
  checks: ComplianceCheck[];
  recommendations: string[];
}

export interface JobSlim {
  id: string;
  type: string;
  state: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  step?: string;
  stepHistory?: { step: string; t: number }[];
  timings?: { startedAt?: number | null; endedAt?: number | null; phases?: Record<string, { startedAt?: number; endedAt?: number }> };
  result?: any;
  error?: any;
  createdAt: number;
  updatedAt: number;
  logsCount?: number;
  lastLogTs?: number;
}

export interface JobLogEntry {
  i: number; // index
  t: number; // timestamp
  level: 'info' | 'warn' | 'error' | 'debug';
  msg: string;
}
```

---

## Calling the APIs with `apiClient`

The frontend has `src/services/apiClient.ts` (Axios) preconfigured. Here are thin wrappers you can place in `src/services/analysisService.ts`:

```ts
import apiClient from '@/services/apiClient';
import type { AuditReport, ComplianceReport } from './types';

export async function auditAnalyze(params: { code: string; filename?: string; model?: string; policy?: any }) {
  const { data } = await apiClient.post('/api/audit/analyze', params);
  return data as { ok: boolean; report: AuditReport };
}

export async function auditByJob(params: { jobId: string; model?: string; policy?: any }) {
  const { data } = await apiClient.post('/api/audit/byJob', params);
  return data as { ok: boolean; report: AuditReport; sourceRef?: any };
}

export async function auditOrchestrate(params: any) {
  // params may include code or jobId, fix, deploy, network, constructorArgs, etc.
  const { data } = await apiClient.post('/api/audit/orchestrate', params);
  return data as { ok: boolean; audit: AuditReport; fixJob?: { id: string; finalStatus?: string }; deploy?: { address: string; network: string } };
}

export async function complianceAnalyze(params: any) {
  const { data } = await apiClient.post('/api/compliance/analyze', params);
  return data as { ok: boolean; compliance: ComplianceReport };
}

export async function complianceByJob(params: any) {
  const { data } = await apiClient.post('/api/compliance/byJob', params);
  return data as { ok: boolean; compliance: ComplianceReport; sourceRef?: any };
}

export async function complianceOrchestrate(params: any) {
  const { data } = await apiClient.post('/api/compliance/orchestrate', params);
  return data as { ok: boolean; compliance: ComplianceReport; fixJob?: { id: string }; deploy?: { address: string; network: string } };
}

export async function getAuditReport(jobId: string) {
  const { data } = await apiClient.get('/api/artifacts/audit', { params: { jobId } });
  return data as { ok: boolean; jobId: string; report: AuditReport };
}

export async function getComplianceReport(jobId: string) {
  const { data } = await apiClient.get('/api/artifacts/compliance', { params: { jobId } });
  return data as { ok: boolean; jobId: string; report: ComplianceReport };
}
```

With React Query:

```ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { auditAnalyze, getAuditReport } from '@/services/analysisService';

export function useAuditAnalyze() {
  return useMutation({ mutationFn: auditAnalyze });
}

export function useAuditReport(jobId?: string) {
  return useQuery({
    queryKey: ['audit-report', jobId],
    queryFn: () => getAuditReport(jobId!),
    enabled: !!jobId,
  });
}
```

---

## SSE Job Logs (orchestrations)

Use the existing SSE endpoint: `GET /api/job/:id/logs/stream`. It emits events `hello`, `log`, `heartbeat`, and `end`.

Example hook:

```ts
import { useEffect, useRef, useState } from 'react';
import type { JobLogEntry } from '@/services/types';

export function useJobSse(jobId?: string, afterIndex = 0) {
  const [logs, setLogs] = useState<JobLogEntry[]>([]);
  const lastIndexRef = useRef(afterIndex);

  useEffect(() => {
    if (!jobId) return;
    const url = new URL(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/job/${jobId}/logs/stream`);
    url.searchParams.set('afterIndex', String(lastIndexRef.current));

    const es = new EventSource(url.toString());

    const onLog = (e: MessageEvent) => {
      try {
        const entry: JobLogEntry = JSON.parse(e.data);
        lastIndexRef.current = Math.max(lastIndexRef.current, entry.i || 0);
        setLogs((prev) => [...prev, entry]);
      } catch {}
    };

    es.addEventListener('log', onLog as any);

    return () => {
      es.removeEventListener('log', onLog as any);
      es.close();
    };
  }, [jobId]);

  return { logs };
}
```

Render a simple viewer with level-colored rows and auto-scroll.

---

## UI Recommendations

- **Audit Tab**
  - Code form: textarea for Solidity, optional `filename`, `model`, severity threshold; buttons: Analyze, Orchestrate.
  - By Job form: `jobId` input with Analyze and Orchestrate actions.
  - Findings table: severity pill, title, category, file:line, description, impact, likelihood, remediation, references.
  - Summary header: `score`, `severityMax`, counts by severity, `recommendations`.
  - JSON viewer toggle + Download JSON.
  - Logs drawer for orchestrate using `useJobSse`.

- **Compliance Tab**
  - Profile select (`generic|registry|token|custom`), `strict` toggle, `policyPack` picker, optional inline `policyChecks` JSON.
  - Results table: per-check pass/fail, severity, details, mapping; summary with `passed`, `score`, recommendations.
  - Same By Job + Orchestrate flows and logs drawer.

- **Artifacts Links**
  - Deep-link buttons to `/api/artifacts?jobId=<id>&include=sources|abis|scripts`.

---

## Environment Flags (frontend awareness)

- Back-end reads: `AUDIT_MODEL`, `COMPLIANCE_MODEL`, `ANALYSIS_SEVERITY_THRESHOLD`, `COMPLIANCE_STRICT`, etc.
- Frontend should expose minimal user controls for `model`, `severityThreshold`, `strict`, and `network` as applicable.

---

## Error Handling

- 400: Missing inputs → show field validation.
- 404: Job not found → suggest verifying the `jobId`.
- 500: Upstream LLM/compile/deploy errors → show the message and link to job logs.
- If JSON parsing fails server-side, the backend will retry or return `LLM_ANALYSIS_FAILED`.

---

## Notes

- Audit prompt specification is in `updated/audit_prompt.md`; backend loads it from `api/prompts/audit_prompt.md`.
- Compliance has a similar prompt in `api/prompts/compliance_prompt.md` (to be added), with optional policy packs in `api/policies/`.
- All new routes will be documented in Swagger at `/api-docs` once mounted.
