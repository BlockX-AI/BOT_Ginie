"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import JobTimeline from "@/components/jobs/JobTimeline";
import StatusChip from "@/components/common/StatusChip";
import { Button } from "@/components/ui/button";
import { Api, JobState, stepToIndex } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Props = { params: { id: string } };

export default function JobDetailPage({ params }: Props) {
  const jobId = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const [autoFixing, setAutoFixing] = useState(false);
  const [state, setState] = useState<JobState>("queued");
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{
    network?: string;
    address?: string;
    contract?: string;
    explorerUrl?: string;
  }>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [sources, setSources] = useState<Record<string, string>>({});
  const lastLogIdx = useRef(0);
  const hasHardhatNodeWarn = useMemo(() => logs.some(l => l.includes('Hardhat') && l.includes('Node.js')), [logs]);
  const hasHH506 = useMemo(() => logs.some(l => l.includes('HH506')), [logs]);


  useEffect(() => {
    let stop = false;
    async function poll() {
      while (!stop) {
        try {
          const s = await Api.getJobStatus(jobId);
          if (s?.ok) {
            const d = s.data;
            setState(d.state);
            setProgress(d.progress);
            setStep(stepToIndex(d.step));
            if (d.result) {
              setResult({
                network: d.result.network,
                address: d.result.address,
                contract: d.result.contract,
              });
            }
            if (d.state === "completed" || d.state === "failed") {
              // fetch artifacts once
              try {
                const art = await Api.getArtifactsAll(jobId);
                if (art?.ok && art.data?.sources) setSources(art.data.sources);
              } catch {}
              break;
            }
          }
        } catch (e) {
          // soft-fail
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    poll();
    return () => {
      stop = true;
    };
  }, [jobId]);

  useEffect(() => {
    let stop = false;
    async function pollLogs() {
      while (!stop) {
        try {
          const r = await Api.getJobLogs(jobId, { afterIndex: lastLogIdx.current, limit: 1000 });
          const logsArr: any[] = r?.data?.logs || [];
          if (logsArr.length) {
            const newLines = logsArr.map((l: any) => `[${l.level}] ${l.msg || l.message}`);
            setLogs((prev) => [...prev, ...newLines]);
            // Advance index using 'i' if provided, else by count
            const maxI = logsArr.reduce((m: number, x: any) => typeof x?.i === 'number' ? Math.max(m, x.i) : m, lastLogIdx.current);
            lastLogIdx.current = Math.max(maxI, lastLogIdx.current + logsArr.length);
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 1200));
        if (state === "completed" || state === "failed") break;
      }
    }
    pollLogs();
    return () => {
      stop = true;
    };
  }, [jobId, state]);

  const pct = useMemo(() => Math.min(100, Math.max(0, progress)), [progress]);

  function copyLogs() {
    if (typeof window === 'undefined') return;
    const text = logs.join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      toast({ title: 'Logs copied' });
    }).catch(() => {
      toast({ title: 'Copy failed', description: 'Select and copy manually' });
    });
  }

  function downloadLogs() {
    if (typeof window === 'undefined') return;
    const text = logs.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jobId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Job {jobId}</h1>
          <div className="mt-1"><StatusChip state={state} /></div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={autoFixing}
            onClick={async () => {
              setAutoFixing(true);
              try {
                toast({ title: 'Auto-fixing…', description: 'Fetching sources and logs' });
                const art = await Api.getArtifactsAll(jobId);
                const sources = art?.data?.sources || {};
                const first = Object.entries(sources)[0];
                if (!first) throw new Error('No sources to fix');
                const [fullName, currentCode] = first;
                const logs = await Api.getJobLogs(jobId, 0);
                const lines = (logs?.data?.logs || []).map((l) => `[${l.level}] ${l.msg}`);
                const errText = lines.slice(-80).join('\n');

                const fix = await Api.aiFix(currentCode, errText);
                if (!fix?.ok || !fix.data?.code) throw new Error('AI fix failed');

                const filename = fullName.split('/').pop() || 'Contract.sol';
                let compiledOk = true;
                try {
                  const comp = await Api.aiCompile(filename, fix.data.code);
                  compiledOk = !!comp?.ok;
                } catch {
                  compiledOk = false;
                }

                // stash in session storage for the editor to pick up
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem(`fixedCode:${jobId}`, fix.data.code);
                  sessionStorage.setItem(`fixedFilename:${jobId}`, filename);
                }
                toast({ title: compiledOk ? 'Fixed & compiled' : 'Fixed (compile skipped)', description: 'Opening editor…' });
                router.push(`/editor?job=${encodeURIComponent(jobId)}&fixed=1`);
              } catch (e: any) {
                toast({ title: 'Auto-fix failed', description: e?.message || 'Unknown error' });
              } finally {
                setAutoFixing(false);
              }
            }}
          >
            {autoFixing ? 'Auto-Fixing…' : 'Auto-Fix & Retry'}
          </Button>
          <Button variant="gradient" onClick={() => router.push(`/editor?job=${encodeURIComponent(jobId)}`)}>Open in Editor</Button>
        </div>
      </div>

      {(hasHardhatNodeWarn || hasHH506) && (
        <Alert variant="destructive" className="bg-rose-950/30 border-rose-800/40">
          <AlertTitle>Compiler environment issue detected</AlertTitle>
          <AlertDescription>
            {hasHardhatNodeWarn && 'Hardhat warns about the Node.js version on the server. '}
            {hasHH506 && 'Solidity compiler (solcjs) failed (HH506). '}
            Use “Auto-Fix & Retry” to open the Editor with AI-suggested fixes, or try again later.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 bg-secondary/40 border-border lg:col-span-2 space-y-4">
          <h2 className="font-semibold">Timeline</h2>
          <JobTimeline currentStep={step} />
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </Card>
        <Card className="p-6 bg-secondary/40 border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Logs</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyLogs}>Copy</Button>
              <Button size="sm" variant="outline" onClick={downloadLogs}>Download</Button>
            </div>
          </div>
          <div className="h-64 overflow-auto rounded-md bg-background/40 border border-border p-3 text-xs font-mono text-gray-300">
            {logs.length === 0 ? (
              <div className="text-gray-500">waiting for logs…</div>
            ) : (
              logs.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-secondary/40 border-border">
        <h2 className="font-semibold mb-4">Artifacts</h2>
        {Object.keys(sources).length === 0 ? (
          <div className="text-gray-500 text-sm">No artifacts yet.</div>
        ) : (
          <div className="space-y-3">
            {Object.entries(sources).map(([name]) => (
              <div key={name} className="rounded-lg border border-border p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-400">Source</div>
                  <div className="text-white break-all">{name}</div>
                </div>
                <Button size="sm" variant="outline">View</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
