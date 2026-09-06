# Frontend Dev Guide: Audit, Compliance, and Verify Services (V4)

This document consolidates how to integrate the Audit, Compliance, and Verify services in the frontend.
It is aligned with backend routes in `api/routes/audit.js`, `api/routes/compliance.js`, and `api/routes/verify.js`.

- Base API URL is taken from `VITE_API_URL` (fallback `http://localhost:3000`).
- Long-running actions return a `jobId`; poll `/api/job/:id/status` or stream `/api/job/:id/logs/stream`.
- Reports are persisted to `tmp/jobs/<jobId>/(audit|compliance)/report.json` and can be fetched via `/api/artifacts/*`.

---

## Quick Start

1) Analyze code immediately (no job):

```bash
POST /api/audit/analyze
POST /api/compliance/analyze
```

2) Analyze by previous job (AI pipeline or fix):

```bash
POST /api/audit/byJob        { jobId }
POST /api/compliance/byJob   { jobId }
```

3) Orchestrate background analysis (returns a job you can stream logs for):

```bash
POST /api/audit/orchestrate        { code? | jobId?, fix?, deploy?, network?, ... }
POST /api/compliance/orchestrate   { code? | jobId?, targetProfile?, strict?, fix?, deploy?, network?, ... }
```

- When `jobId` is provided to orchestrate, the report is mirrored to that original AI job folder, so the UI can fetch using a single identifier:

```bash
GET /api/artifacts/audit?jobId=<AI_JOB_ID>
GET /api/artifacts/compliance?jobId=<AI_JOB_ID>
```

4) Verify deployed contracts:

```bash
POST /api/verify/byJob       { jobId, network?, fullyQualifiedName? }
POST /api/verify/byAddress   { address, network?, fullyQualifiedName?, args? }
GET  /api/verify/status?address=0x..&network=basecamp
```

---

## Endpoints (Frontend Reference)

### Audit

- `POST /api/audit/analyze`
  - Body: `{ code: string, filename?: string, model?: string, policy?: object }`
  - Returns: `{ ok, report, policy }`
  - Notes: `report` is LLM-produced JSON; structure may vary by prompt/model.

- `POST /api/audit/byJob`
  - Body: `{ jobId: string, model?: string, policy?: object }`
  - Returns: `{ ok, report, sourceRef: { jobId, filename } }`
  - Side effects: Saves `tmp/jobs/<jobId>/audit/report.json`.

- `POST /api/audit/orchestrate`
  - Body: `{ code?: string, jobId?: string, fix?: boolean, deploy?: boolean, network?: string, model?: string, fixModel?: string, constructorArgs?: any[] }`
  - Returns: `202 { ok, job: { id, type: 'audit_orchestrate' } }`
  - Persisted: `tmp/jobs/<orchestrate_jobId>/audit/report.json`. If `jobId` was provided, a mirrored copy is saved at `tmp/jobs/<jobId>/audit/report.json`.

### Compliance

- `POST /api/compliance/analyze`
  - Body: `{ code: string, filename?: string, model?: string, profile?: 'generic'|'registry'|'token'|'custom', strict?: boolean, policyPack?: string, policyChecks?: any[] }`
  - Returns: `{ ok, compliance, profile, strict, policyPack? }`

- `POST /api/compliance/byJob`
  - Body: `{ jobId: string, model?: string, profile?: 'generic'|'registry'|'token'|'custom', strict?: boolean, policyPack?: string, policyChecks?: any[] }`
  - Returns: `{ ok, compliance, sourceRef: { jobId, filename } }`
  - Side effects: Saves `tmp/jobs/<jobId>/compliance/report.json`.

- `POST /api/compliance/orchestrate`
  - Body: `{ code?: string, jobId?: string, targetProfile?: string, strict?: boolean, fix?: boolean, deploy?: boolean, network?: string, model?: string, fixModel?: string, constructorArgs?: any[] }`
  - Returns: `202 { ok, job: { id, type: 'compliance_orchestrate' } }`
  - Persisted: `tmp/jobs/<orchestrate_jobId>/compliance/report.json`. If `jobId` was provided, mirrored to `tmp/jobs/<jobId>/compliance/report.json`.

### Artifacts

- `GET /api/artifacts/audit?jobId=<id>` → `{ ok, jobId, report }`
- `GET /api/artifacts/compliance?jobId=<id>` → `{ ok, jobId, report }`

Additional:
- `GET /api/artifacts?jobId=<id>&include=sources|abis|scripts|all`
- `GET /api/artifacts/sources?jobId=<id>`
- `GET /api/artifacts/abis?jobId=<id>`
- `GET /api/artifacts/scripts?jobId=<id>`

### Verify

- `POST /api/verify/byJob`
  - Body: `{ jobId: string, network?: string, fullyQualifiedName?: string }`
  - Returns: `{ ok, verified: boolean, explorerUrl?: string, stdout?: string }` or `{ ok: false, error, stdout, stderr }`.

- `POST /api/verify/byAddress`
  - Body: `{ address: string, network?: string, fullyQualifiedName?: string, args?: any[] }`
  - Returns: same shape as byJob.

- `GET /api/verify/status`
  - Query: `address`, `network`
  - Returns: `{ ok, verified: boolean, explorerUrl }`

### Jobs & Logs

- `GET /api/job/:id/status` → `{ ok, data }` (`data.state`, `data.progress`, `data.step`, `data.result`, `...`)
- `GET /api/job/:id/logs` → `{ ok, data: { logs: JobLogEntry[] } }`
- `GET /api/job/:id/logs/stream` (SSE)

---

## TypeScript Types (Frontend)

Recommended minimal types to work defensively with LLM output:

```ts
export type Severity = 'info' | 'warning' | 'error';

export interface AuditFinding {
  id?: string;
  title?: string;
  severity?: Severity;
  category?: string;
  file?: string;
  line?: number;
  description?: string;
  impact?: string;
  likelihood?: 'low' | 'medium' | 'high';
  evidence?: string;
  references?: string[];
  remediation?: string;
}

export interface AuditReport {
  summary?: string;
  score?: number; // 0..100
  severityMax?: Severity;
  findings?: AuditFinding[];
  recommendations?: string[];
  // Allow extra keys
  [k: string]: any;
}

export interface ComplianceCheck {
  id?: string;
  title?: string;
  passed?: boolean;
  severity?: Severity;
  details?: string;
  mapping?: string[];
}

export interface ComplianceReport {
  summary?: string;
  passed?: boolean;
  score?: number;
  checks?: ComplianceCheck[];
  recommendations?: string[];
  [k: string]: any;
}

export interface JobSlim {
  id: string;
  type: string;
  state: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  step?: string;
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

## Frontend Service Wrappers

Create `src/services/analysisService.ts` and `src/services/verifyService.ts`. Each uses the shared Axios `apiClient`:

```ts
// src/services/analysisService.ts
import apiClient from '@/services/apiClient';
import type { AuditReport, ComplianceReport, JobSlim } from './types';

export async function auditAnalyze(params: { code: string; filename?: string; model?: string; policy?: any }) {
  const { data } = await apiClient.post('/api/audit/analyze', params);
  return data as { ok: boolean; report: AuditReport; policy?: any };
}

export async function auditByJob(params: { jobId: string; model?: string; policy?: any }) {
  const { data } = await apiClient.post('/api/audit/byJob', params);
  return data as { ok: boolean; report: AuditReport; sourceRef?: any };
}

export async function auditOrchestrate(params: {
  code?: string;
  jobId?: string;
  fix?: boolean;
  deploy?: boolean;
  network?: string;
  model?: string;
  fixModel?: string;
  constructorArgs?: any[];
}) {
  const { data } = await apiClient.post('/api/audit/orchestrate', params);
  return data as { ok: boolean; job: { id: string; type: 'audit_orchestrate' } };
}

export async function complianceAnalyze(params: {
  code: string;
  filename?: string;
  model?: string;
  profile?: 'generic' | 'registry' | 'token' | 'custom';
  strict?: boolean;
  policyPack?: string;
  policyChecks?: any[];
}) {
  const { data } = await apiClient.post('/api/compliance/analyze', params);
  return data as { ok: boolean; compliance: ComplianceReport; profile?: string; strict?: boolean };
}

export async function complianceByJob(params: {
  jobId: string;
  model?: string;
  profile?: 'generic' | 'registry' | 'token' | 'custom';
  strict?: boolean;
  policyPack?: string;
  policyChecks?: any[];
}) {
  const { data } = await apiClient.post('/api/compliance/byJob', params);
  return data as { ok: boolean; compliance: ComplianceReport; sourceRef?: any };
}

export async function complianceOrchestrate(params: {
  code?: string;
  jobId?: string;
  targetProfile?: string;
  strict?: boolean;
  fix?: boolean;
  deploy?: boolean;
  network?: string;
  model?: string;
  fixModel?: string;
  constructorArgs?: any[];
}) {
  const { data } = await apiClient.post('/api/compliance/orchestrate', params);
  return data as { ok: boolean; job: { id: string; type: 'compliance_orchestrate' } };
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

```ts
// src/services/verifyService.ts
import apiClient from '@/services/apiClient';

export async function verifyByJob(params: { jobId: string; network?: string; fullyQualifiedName?: string }) {
  const { data } = await apiClient.post('/api/verify/byJob', params);
  return data as { ok: boolean; verified?: boolean; explorerUrl?: string; error?: string; stdout?: string; stderr?: string };
}

export async function verifyByAddress(params: { address: string; network?: string; fullyQualifiedName?: string; args?: any[] }) {
  const { data } = await apiClient.post('/api/verify/byAddress', params);
  return data as { ok: boolean; verified?: boolean; explorerUrl?: string; error?: string; stdout?: string; stderr?: string };
}

export async function verifyStatus(address: string, network = 'basecamp') {
  const { data } = await apiClient.get('/api/verify/status', { params: { address, network } });
  return data as { ok: boolean; verified: boolean; explorerUrl?: string };
}
```

---

## React Query Hooks

```ts
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  auditAnalyze, auditByJob, auditOrchestrate,
  complianceAnalyze, complianceByJob, complianceOrchestrate,
  getAuditReport, getComplianceReport
} from '@/services/analysisService';
import { verifyByJob, verifyByAddress, verifyStatus } from '@/services/verifyService';

export function useAuditAnalyze() {
  return useMutation({ mutationFn: auditAnalyze });
}
export function useAuditByJob() {
  return useMutation({ mutationFn: auditByJob });
}
export function useAuditOrchestrate() {
  return useMutation({ mutationFn: auditOrchestrate });
}

export function useComplianceAnalyze() {
  return useMutation({ mutationFn: complianceAnalyze });
}
export function useComplianceByJob() {
  return useMutation({ mutationFn: complianceByJob });
}
export function useComplianceOrchestrate() {
  return useMutation({ mutationFn: complianceOrchestrate });
}

export function useAuditReport(jobId?: string) {
  return useQuery({ queryKey: ['audit-report', jobId], queryFn: () => getAuditReport(jobId!), enabled: !!jobId });
}
export function useComplianceReport(jobId?: string) {
  return useQuery({ queryKey: ['compliance-report', jobId], queryFn: () => getComplianceReport(jobId!), enabled: !!jobId });
}

export function useVerifyByJob() {
  return useMutation({ mutationFn: verifyByJob });
}
export function useVerifyByAddress() {
  return useMutation({ mutationFn: verifyByAddress });
}
export function useVerifyStatus(address?: string, network = 'basecamp') {
  return useQuery({ queryKey: ['verify-status', address, network], queryFn: () => verifyStatus(address!, network), enabled: !!address });
}
```

### SSE Logs Hook

Use SSE for orchestrate jobs:

```ts
import { useEffect, useRef, useState } from 'react';
import type { JobLogEntry } from '@/services/types';

export function useJobSse(jobId?: string, afterIndex = 0) {
  const [logs, setLogs] = useState<JobLogEntry[]>([]);
  const lastIndexRef = useRef(afterIndex);

  useEffect(() => {
    if (!jobId) return;
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const url = new URL(`${base}/api/job/${jobId}/logs/stream`);
    url.searchParams.set('afterIndex', String(lastIndexRef.current));

    const es = new EventSource(url.toString());
    const onLog = (e: MessageEvent) => {
      try {
        const entry: JobLogEntry = JSON.parse(e.data);
        lastIndexRef.current = Math.max(lastIndexRef.current, entry.i || 0);
        setLogs(prev => [...prev, entry]);
      } catch {}
    };

    es.addEventListener('log', onLog as any);
    return () => { es.removeEventListener('log', onLog as any); es.close(); };
  }, [jobId]);

  return { logs };
}
```

---

## Recommended UI Flows

- **Audit Tab**
  - Form: code textarea, optional `filename`, `model`, optional policy JSON.
  - Buttons: Analyze (immediate) and Orchestrate (background job).
  - When orchestrating, stream logs, then fetch the report via artifacts (use the original AI `jobId` if you provided it).
  - Render: summary header (score, severityMax), findings table, JSON viewer.

- **Compliance Tab**
  - Form: `profile` select (`generic|registry|token|custom`), `strict` toggle, optional `policyPack` and `policyChecks` JSON.
  - Buttons: Analyze and Orchestrate. Same log streaming and artifact fetching as Audit.
  - Render: passed/score summary, checks table, recommendations, JSON viewer.

- **Verify Section**
  - Show “Verify on Explorer” button when a deploy `address` is available.
  - `verifyByJob({ jobId, network })` or `verifyByAddress({ address, network, fullyQualifiedName, args })`.
  - On success, display `explorerUrl`.

- **Artifacts Links**
  - Provide convenient deep links to `/api/artifacts?jobId=<id>&include=sources|abis|scripts`.

---

## Error Handling & Edge Cases

- **LLM variability**: Keys in audit/compliance may vary. Render with defensive null checks and provide a raw JSON view.
- **Orchestrate returns 202**: You must poll `/api/job/:id/status` or use SSE. Do not expect final `report` in the initial response.
- **Constructor args mismatch**: The backend validates constructor args for deploy scripts; errors surface in job logs and final status.
- **Verification failures**: Backend returns `stdout/stderr`; surface a link to `explorerUrl` and show diagnostic text.
- **Network aliases**: `camp → basecamp`, `camp-testnet → basecamp-testnet`, `boba → boba-sepolia`, `fuji/avax-fuji → avalanche-fuji`.

---

## Putting It Together (Example)

```ts
// 1) Orchestrate compliance for an existing AI job and stream logs
const { mutateAsync: startCompliance } = useComplianceOrchestrate();
const { logs } = useJobSse(complianceJobId);

async function runCompliance(aiJobId: string) {
  const { job } = await startCompliance({ jobId: aiJobId, targetProfile: 'generic', fix: false, deploy: false });
  setComplianceJobId(job.id);
}

// 2) Later, fetch mirrored report with the original AI job id
targetQuery = useComplianceReport(aiJobId);

// 3) Verify deployed address from AI pipeline job
const { mutateAsync: doVerify } = useVerifyByJob();
await doVerify({ jobId: aiJobId, network: 'basecamp' });
```

---

## Explorer Links

- Basecamp: `https://basecamp.cloud.blockscout.com/address/<address>#code`
- Base Sepolia: `https://sepolia-explorer.base.org/address/<address>#code`
- Expose `explorerUrl` from verification responses in the UI.

---

## Troubleshooting

- **No report at /api/artifacts/**: Ensure the orchestrate job has completed. If you passed `jobId` to orchestrate, use that original id when fetching artifacts.
- **Verify errors in production**: If your backend container is built without dev dependencies, Hardhat verify may fail. Ensure the backend image includes Hardhat or runs verification from a builder stage.
- **Container logs show “ABI missing; skipping contract init”**: Core contract routers are disabled. This does not affect Audit/Compliance/Verify, but you cannot call on-chain routes until ABIs are provided or artifacts are baked into the image.

---

For backend API details, see Swagger at `/api-docs` and source files under `api/routes/`.
