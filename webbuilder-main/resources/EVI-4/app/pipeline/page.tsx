"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Loader2, Play, Terminal, FileCode, ListChecks, AlertTriangle, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { TickerTemplates, type TickerItem } from "@/components/pipeline/TickerTemplates";
import { Api } from "@/lib/api";
import { magicalFromLog } from "@/lib/magical";

// Centralized API client usage via lib/api.ts

type JobState = "running" | "completed" | "failed" | "queued";

type JobData = {
  id: string;
  state: JobState;
  progress: number;
  step: string; // init | generate | compile | fix | deploy
  result?: {
    network: string;
    deployer?: string;
    contract?: string;
    fqName?: string;
    address?: string;
    params?: any;
  };
};

type LogEntry = { level: "info" | "warn" | "error" | string; msg?: string; message?: string; repeat?: number };

const STEP_ORDER = ["init", "generate", "compile", "fix", "deploy", "verify"] as const;
type Step = typeof STEP_ORDER[number];

function bucketizeStep(step?: string): Step | undefined {
  if (!step) return undefined;
  const s = step.toLowerCase();
  if (STEP_ORDER.includes(s as Step)) return s as Step;
  if (s.includes("init")) return "init";
  if (s.includes("gen")) return "generate";
  if (s.includes("compil")) return "compile";
  if (s.includes("fix")) return "fix";
  if (s.includes("deploy")) return "deploy";
  if (s.includes("verif")) return "verify";
  return undefined;
}

function getExplorerUrl(network?: string, address?: string): string | undefined {
  if (!network || !address) return undefined;
  const map: Record<string, string> = {
    basecamp: `https://basecamp.cloud.blockscout.com/address/${address}`,
  };
  return map[network] || undefined;
}

const NETWORK_LABELS: Record<string, string> = {
  basecamp: "Basecamp",
};

export default function PipelinePage() {
  const [prompt, setPrompt] = useState("");
  const [network, setNetwork] = useState<"basecamp">("basecamp");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsSince, setLogsSince] = useState(0);
  const [sources, setSources] = useState<{ path: string; content: string }[] | null>(null);
  const [abis, setAbis] = useState<any | null>(null);
  const [scripts, setScripts] = useState<{ path: string; content: string }[] | null>(null);
  const [activeArtifactTab, setActiveArtifactTab] = useState<"abi" | "sources" | "scripts">("abi");
  const [selectedSourceIdx, setSelectedSourceIdx] = useState(0);
  const [selectedScriptIdx, setSelectedScriptIdx] = useState(0);
  const [successOpen, setSuccessOpen] = useState(false);
  const [failureOpen, setFailureOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyRes, setVerifyRes] = useState<{ verified?: boolean; explorerUrl?: string; stdout?: string } | null>(null);
  // Max iterations for AI fix loop
  const [maxIters, setMaxIters] = useState<11 | 15 | 21>(11);
  // Artifacts debug logs
  const [artifactsDebug, setArtifactsDebug] = useState<string[]>([]);
  // LLM enhancement debug
  const [enhanceDebug, setEnhanceDebug] = useState<{ base: string; enhanced?: string; provider?: string; model?: string; used: boolean; error?: string } | null>(null);
  const [showEnhanceDebug, setShowEnhanceDebug] = useState(false);
  // Templates modal
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // ERC20
  const [erc20Name, setErc20Name] = useState("Camp Token");
  const [erc20Symbol, setErc20Symbol] = useState("CAMP");
  const [erc20Supply, setErc20Supply] = useState("1000000");
  const [erc20Owner, setErc20Owner] = useState("0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E");
  const [erc20Result, setErc20Result] = useState<any | null>(null);
  const [erc20Loading, setErc20Loading] = useState(false);
  const [erc20Error, setErc20Error] = useState<string | null>(null);
  // Animated dots for "Working..." in Steps
  const [dotCounter, setDotCounter] = useState(0);
  useEffect(() => {
    if (job?.state === 'running') {
      const id = setInterval(() => setDotCounter((c) => (c + 1) % 3), 500);
      return () => clearInterval(id);
    } else {
      setDotCounter(0);
    }
  }, [job?.state]);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const localInitRef = useRef<NodeJS.Timeout | null>(null);
  const logsSinceRef = useRef(0);
  const logsIndexRef = useRef(0);
  const fetchingLogsRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);
  const logsBoxRef = useRef<HTMLDivElement | null>(null);
  const logsStreamRef = useRef<EventSource | null>(null);
  const logsStreamLastMsgRef = useRef<number>(0);
  // Track last seen index for each (level|message) key to collapse interleaved duplicates
  const logIndexRef = useRef<Map<string, { index: number; ts: number }>>(new Map());
  const verifyStartedRef = useRef(false);

  const statusLabel = useMemo(() => {
    if (verifying) return "Verifying...";
    if (!job) return "Idle";
    if (job.state === "running") {
      const m: Record<string, string> = {
        init: "Initializing...",
        generate: "AI Generating Code...",
        compile: "Compiling Contract...",
        fix: "Auto-fixing Errors...",
        deploy: "Deploying to Blockchain...",
        verify: "Verifying...",
      };
      return m[job.step] || "Processing...";
    }
    return job.state[0]?.toUpperCase() + job.state.slice(1);
  }, [job, verifying]);

  // ----- Artifact helpers -----
  async function exportArtifactsZip() {
    if (!abis && !sources && !scripts) return;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    if (sources && sources.length) {
      const folder = zip.folder('sources');
      sources.forEach((s) => folder?.file(s.path.split('/').pop() || 'contract.sol', s.content));
    }
    if (scripts && scripts.length) {
      const folder = zip.folder('scripts');
      scripts.forEach((s) => folder?.file(s.path.split('/').pop() || 'script.ts', s.content));
    }
    if (abis) {
      zip.file('abis.json', JSON.stringify(abis, null, 2));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    // Prefer contract name for filename; fall back to first ABI key or 'artifacts'
    const preferredName = job?.result?.contract || (abis ? Object.keys(abis)[0] : undefined) || 'artifacts';
    const safeName = String(preferredName).replace(/[^a-zA-Z0-9-_]/g, '_');
    a.href = url; a.download = `${safeName}.zip`; a.click();
    URL.revokeObjectURL(url);
  }

  function copyAllArtifacts() {
    const payload: any = { abis, sources, scripts };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  }

  function copyAllSources() {
    if (!sources || sources.length === 0) return;
    const combined = sources.map(s => `// ${s.path}\n${s.content}`).join('\n\n');
    navigator.clipboard.writeText(combined);
  }

  async function verifyByJobNow() {
    const id = jobIdRef.current || jobId;
    if (!id) return;
    setVerifying(true);
    setVerifyRes(null);
    try {
      const res: any = await Api.verifyByJob(id, (job?.result?.network || network) as string);
      const verified = !!(res?.verified ?? res?.ok);
      const explorer = res?.explorerUrl as string | undefined;
      const stdout = res?.stdout as string | undefined;
      setVerifyRes({ verified, explorerUrl: explorer, stdout });
      if (verified) {
        toast({ title: 'Verified', description: explorer ? 'View on explorer' : undefined });
        setSuccessOpen(true);
      }
      else toast({ title: 'Verification submitted' });
    } catch (e: any) {
      toast({ title: 'Verification failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  }

  // Send a short failure report to Dev Team
  async function sendFailureReport() {
    try {
      const payload: any = {
        jobId: jobIdRef.current,
        step: job?.step,
        state: job?.state,
        logs: logs.slice(-50),
      };
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast({ title: 'Report sent to Dev Team' });
    } catch (e) {
      toast({ title: 'Could not send report', variant: 'destructive' });
    }
  }

  function getLastErrorMessage() {
    for (let i = logs.length - 1; i >= 0; i--) {
      const l = logs[i];
      if ((l.level || '').toLowerCase() === 'error') {
        return (l.msg || (l as any).message || '').toString() || 'Unknown error';
      }
    }
    if (error) return error;
    return `Unsupported in step: ${job?.step || 'unknown'}`;
  }

  function handleSendReportEmail() {
    try {
      const to = 'mohit@blockxint.com';
      const subject = `Camp Codegen Failure Report${jobId ? ` - ${jobId}` : ''}`;
      const errText = getLastErrorMessage();
      const recent = logs.slice(-30);
      const logsText = recent.length
        ? recent
            .map((l) => {
              const lvl = (l.level || 'info').toString().toUpperCase();
              const msg = (l.msg || (l as any).message || '').toString();
              const rep = typeof l.repeat === 'number' && l.repeat > 1 ? ` x${l.repeat}` : '';
              return `[${lvl}] ${msg}${rep}`;
            })
            .join('\n')
        : 'No logs available';
      const body = `Hey Camp Codegen,\n\nI wanted to build this "${prompt}".\n\nI tried this and got this error: "${errText}".\n\nJob ID: ${jobId || '—'}\nStep: ${job?.step || 'unknown'}\nNetwork: ${job?.result?.network || network}\n\nRecent logs (last ${recent.length} entries):\n${logsText}\n\nOur team will reach out to you in 30 min.`;
      const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      // Best-effort: also send to backend
      sendFailureReport().catch(() => {});
      if (typeof window !== 'undefined') {
        window.location.href = mailto;
      }
    } finally {
      setFailureOpen(false);
    }
  }

  // Client-side log helper (used before a backend job exists)
  function pushLocalLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    setLogs((prev) => [...prev, { level, msg: message }]);
  }

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current as any);
      if (localInitRef.current) clearInterval(localInitRef.current as any);
      try { logsStreamRef.current?.close(); } catch {}
    };
  }, []);

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current as any);
    pollingRef.current = setInterval(async () => {
      const id = jobIdRef.current;
      if (!id) return;
      await Promise.all([checkJobStatus(id), fetchLogs(id)]);
    }, 2000);
  };

  function startLogStream(id: string) {
    try {
      // do not create multiple
      if (logsStreamRef.current) return;
      const es = Api.streamJobLogs(id, { afterIndex: logsIndexRef.current });
      if (!es) return;
      logsStreamRef.current = es as EventSource;
      logsStreamLastMsgRef.current = Date.now();

      const handleEvent = (e: MessageEvent) => {
        try {
          const data = e.data;
          let payload: any = null;
          try { payload = JSON.parse(data); } catch { payload = data; }
          const items: Array<{ level?: string; msg?: string; message?: string; i?: number }> = [];
          if (payload && Array.isArray(payload.logs)) {
            items.push(...payload.logs);
          } else if (payload && typeof payload === 'object' && (payload.level || payload.msg || payload.message)) {
            items.push(payload);
          } else if (typeof payload === 'string' && payload.trim().length) {
            items.push({ level: 'info', msg: payload.trim() });
          }
          if (items.length) {
            logsStreamLastMsgRef.current = Date.now();
            const incoming = items.map((x) => ({ level: (x.level || 'info') as any, msg: (x.msg || x.message || '').toString(), i: (x as any).i })) as any[];
            setLogs((prev) => {
              const out = [...prev];
              const now = Date.now();
              const WINDOW_MS = 60000;
              for (const entry of incoming) {
                const key = `${entry.level}|${entry.msg || entry.message}`;
                const hit = logIndexRef.current.get(key);
                if (hit && now - hit.ts <= WINDOW_MS && hit.index >= 0 && hit.index < out.length) {
                  const existing = out[hit.index];
                  const rep = (existing.repeat ?? 1) + 1;
                  out[hit.index] = { ...existing, repeat: rep } as any;
                  logIndexRef.current.set(key, { index: hit.index, ts: now });
                } else {
                  out.push(entry as any);
                  logIndexRef.current.set(key, { index: out.length - 1, ts: now });
                }
                if (typeof entry.i === 'number') {
                  logsIndexRef.current = Math.max(logsIndexRef.current, entry.i);
                }

                // Inject narrative magical logs derived from this message
                try {
                  const ctxNet = (job?.result?.network || network) as string | undefined;
                  const ctxName = job?.result?.contract as string | undefined;
                  const narratives = magicalFromLog(entry.msg || entry.message || '', { network: ctxNet, contractName: ctxName });
                  const iconFor = (cat: string) => cat === 'generation' ? '🪄' : cat === 'compilation' ? '🧪' : cat === 'errors' ? '❌' : cat === 'deployment' ? '🚀' : cat === 'celebration' ? '🎉' : '✨';
                  for (const n of narratives) {
                    const nMsg = `${iconFor(n.category)} ${n.msg}`;
                    const mKey = `magical|${nMsg}`;
                    const mHit = logIndexRef.current.get(mKey);
                    if (mHit && now - mHit.ts <= WINDOW_MS && mHit.index >= 0 && mHit.index < out.length) {
                      const existing = out[mHit.index] as any;
                      const rep = (existing.repeat ?? 1) + 1;
                      out[mHit.index] = { ...existing, repeat: rep };
                      logIndexRef.current.set(mKey, { index: mHit.index, ts: now });
                    } else {
                      out.push({ level: 'magical', msg: nMsg } as any);
                      logIndexRef.current.set(mKey, { index: out.length - 1, ts: now });
                    }
                  }
                } catch { /* ignore magical errors */ }
              }
              const MAX = 2000;
              const trimmed = out.length > MAX ? out.slice(out.length - MAX) : out;
              const rebuilt = new Map<string, { index: number; ts: number }>();
              for (let i = 0; i < trimmed.length; i++) {
                const l = trimmed[i];
                const key = `${l.level}|${l.msg || l.message}`;
                rebuilt.set(key, { index: i, ts: now });
              }
              logIndexRef.current = rebuilt;
              return trimmed as any;
            });
          }
        } catch { /* ignore */ }
      };

      // Default messages and named events
      es.onmessage = handleEvent;
      es.onopen = () => { logsStreamLastMsgRef.current = Date.now(); };
      // Also listen to named events some servers emit
      try {
        (es as any).addEventListener?.('log', handleEvent);
        (es as any).addEventListener?.('logs', handleEvent);
        (es as any).addEventListener?.('snapshot', handleEvent);
        // EVI pipeline emits these
        (es as any).addEventListener?.('hello', (e: MessageEvent) => {
          try {
            const p = JSON.parse(e.data || '{}');
            if (typeof p?.lastIndex === 'number') {
              logsIndexRef.current = Math.max(logsIndexRef.current, p.lastIndex as number);
            }
          } catch {}
          logsStreamLastMsgRef.current = Date.now();
        });
        (es as any).addEventListener?.('heartbeat', () => {
          logsStreamLastMsgRef.current = Date.now();
        });
        (es as any).addEventListener?.('end', () => {
          logsStreamLastMsgRef.current = Date.now();
          try { (logsStreamRef.current as EventSource | null)?.close(); } catch {}
          logsStreamRef.current = null;
          // Opportunistically refresh final status
          const jid = jobIdRef.current; if (jid) { checkJobStatus(jid).catch(() => {}); }
        });
      } catch {}

      es.onerror = () => {
        try { logsStreamRef.current?.close(); } catch {}
        logsStreamRef.current = null;
      };

      // Watchdog: if no SSE messages for 6s, fall back to polling
      setTimeout(function sseWatchdog() {
        const now = Date.now();
        const idleMs = now - (logsStreamLastMsgRef.current || 0);
        if (!logsStreamRef.current) return; // already closed
        if (idleMs > 6000) {
          try { logsStreamRef.current?.close(); } catch {}
          logsStreamRef.current = null;
          return;
        }
        setTimeout(sseWatchdog, 3000);
      }, 3000);
    } catch {
      // ignore
    }
  }

  // Resilient polling: restart interval on hot reload if job is running
  useEffect(() => {
    if (jobId && job?.state === 'running' && !pollingRef.current) {
      startPolling();
    }
  }, [jobId, job?.state]);

  async function startPipeline() {
    if (!prompt.trim()) {
      setError("Please enter a contract description");
      return;
    }
    setError(null);
    setLoading(true);
    setJob(null);
    setLogs([]);
    logsIndexRef.current = 0;
    setSources(null);
    setAbis(null);
    setScripts(null);
    setErc20Result(null);
    setSuccessOpen(false);
    setVerifying(false);
    setVerifyRes(null);
    verifyStartedRef.current = false;

    try {
      // Reflect immediate activity: show Init phase while we enhance/normalize prompt
      setJob({ id: 'local-init', state: 'running', progress: 0, step: 'init' });
      // Simulate progress during local Init (up to 9%) so the UI feels alive
      if (localInitRef.current) clearInterval(localInitRef.current as any);
      localInitRef.current = setInterval(() => {
        setJob((prev) => {
          if (!prev || prev.id !== 'local-init') return prev;
          const next = Math.min(9, (prev.progress || 0) + 1);
          return { ...prev, progress: next };
        });
      }, 250);
      pushLocalLog('Init: Guardrailing prompt (constructor = EMPTY).');
      // Guardrails: ensure constructor is explicitly empty for user-typed prompts
      // If the prompt does not already include an EMPTY CONSTRUCTOR declaration, append one.
      const ptxt = prompt.trim();
      const hasEmptyDecl = /EMPTY\s+CONSTRUCTOR/i.test(ptxt) || /No\s+constructor\s+args/i.test(ptxt);
      const guardrail = "EMPTY CONSTRUCTOR. No constructor args.";
      const basePrompt = hasEmptyDecl ? ptxt : `${ptxt}\n\n${guardrail}`;

      // Second guardrail layer: LLM enhancement pass (OpenAI/Gemini via /api/ai/enhance-prompt)
      let finalPrompt = basePrompt;
      setEnhanceDebug({ base: basePrompt, used: false });
      pushLocalLog('Init: Enhancing prompt via LLM guardrail (OpenAI/Gemini with fallback)...');
      let t0 = performance.now();
      try {
        const enh = await Api.enhancePrompt(basePrompt);
        if (enh?.ok && enh.data?.prompt && typeof enh.data.prompt === 'string') {
          finalPrompt = enh.data.prompt.trim();
          const prov = (enh as any).data?.provider as string | undefined;
          const mdl = (enh as any).data?.model as string | undefined;
          const usedLLM = !!prov && prov !== 'base';
          console.debug('[PromptEnhance]', usedLLM ? `Applied via ${prov}` : 'Fallback to base guardrails');
          setEnhanceDebug({ base: basePrompt, enhanced: finalPrompt, provider: prov, model: mdl, used: usedLLM });
          const dt = Math.max(1, Math.round(performance.now() - t0));
          if (usedLLM) pushLocalLog(`Init: LLM enhancement completed in ${dt} ms (provider=${prov}${mdl ? `, model=${mdl}` : ''}).`);
          else pushLocalLog(`Init: LLM enhancement skipped or failed; using base guardrails (took ${dt} ms).`);
        } else {
          console.debug('[PromptEnhance] Skipped (no data or not ok)');
          setEnhanceDebug({ base: basePrompt, used: false });
          const dt = Math.max(1, Math.round(performance.now() - t0));
          pushLocalLog(`Init: Enhancement unavailable; proceeding with base prompt (took ${dt} ms).`, 'warn');
        }
      } catch (e) {
        // No keys or network error; proceed with base prompt
        console.warn('[PromptEnhance] Enhancement failed/disabled, using base prompt', e);
        setEnhanceDebug({ base: basePrompt, used: false, error: e instanceof Error ? e.message : String(e) });
        const dt = Math.max(1, Math.round(performance.now() - t0));
        pushLocalLog(`Init: Enhancement error (${e instanceof Error ? e.message : String(e)}). Using base guardrails (took ${dt} ms).`, 'warn');
      }

      // Derive filename and contractName from the leading contract label 'LabelName:' in the enhanced prompt
      const labelMatch = finalPrompt.match(/^\s*([A-Za-z][A-Za-z0-9_]{0,63})\s*:/m);
      const filename = labelMatch ? `${labelMatch[1]}.sol` : "AIGenerated.sol";
      const contractName = labelMatch ? labelMatch[1] : undefined;

      // We have finished Init. Transitioning to backend job start.
      // Keep step as 'init' until server accepts the job.
      const res = await Api.runPipeline({
        prompt: finalPrompt,
        network,
        maxIters,
        filename,
        constructorArgs: [],
        strictArgs: true,
        context: 'UI pipeline: guardrailed and enhanced prompt',
        contractName,
      });
      // Stop local init simulated progress
      if (localInitRef.current) { clearInterval(localInitRef.current as any); localInitRef.current = null; }
      setJobId(res.job.id);
      jobIdRef.current = res.job.id;
      setJob({ id: res.job.id, state: res.job.state, progress: res.job.progress, step: res.job.step });
      // Start SSE stream for faster log updates (falls back to polling if not available)
      startLogStream(res.job.id);
      startPolling();
    } catch (e: any) {
      setError(e?.message || "This contract is not supported currently. We're continuously working on updates.");
    } finally {
      if (localInitRef.current) { clearInterval(localInitRef.current as any); localInitRef.current = null; }
      setLoading(false);
    }
  }

  async function checkJobStatus(id: string) {
    try {
      const res = await Api.getJobStatus(id, { verbose: true });
      const d = res.data as unknown as JobData;
      if (d) {
        setJob(d);
        if (d.state === "completed") {
          if (pollingRef.current) clearInterval(pollingRef.current as any);
          try { logsStreamRef.current?.close(); } catch {}
          logsStreamRef.current = null;
          fetchArtifacts(id).catch(() => {});
          if (!verifyStartedRef.current) {
            verifyStartedRef.current = true;
            setVerifying(true);
            verifyByJobNow().catch(() => setVerifying(false));
          }
        }
        if (d.state === "failed") {
          if (pollingRef.current) clearInterval(pollingRef.current as any);
          try { logsStreamRef.current?.close(); } catch {}
          logsStreamRef.current = null;
          setError("This contract is not supported in the current version (step: " + d.step + "). We're continuously working on updates.");
          await fetchArtifacts(id);
          setFailureOpen(true);
        }
      }
    } catch (e) {
      // ignore transient errors
    }
  }

  async function fetchLogs(id: string) {
    // If SSE is active, skip polling
    if (logsStreamRef.current) return;
    if (fetchingLogsRef.current) return;
    fetchingLogsRef.current = true;
    try {
      const res = await Api.getJobLogs(id, { afterIndex: logsIndexRef.current, limit: 1000 });
      const data: any = (res as any)?.data ?? res ?? {};
      const payloadLogs: any[] = Array.isArray(data?.logs) ? data.logs : [];
      if (Array.isArray(payloadLogs) && payloadLogs.length > 0) {
        const incoming: (LogEntry & { i?: number })[] = (payloadLogs as any[]).map((x) => ({
          level: (x?.level || 'info') as any,
          msg: typeof x?.msg === 'string' ? x.msg : (typeof x?.message === 'string' ? x.message : String(x ?? '')),
          i: typeof x?.i === 'number' ? x.i : undefined,
        }));
        setLogs((prev) => {
          const out = [...prev];
          const now = Date.now();
          const WINDOW_MS = 60000; // collapse duplicates seen within last 60s
          for (const entry of incoming) {
            const key = `${entry.level}|${entry.msg || entry.message}`;
            const hit = logIndexRef.current.get(key);
            if (hit && now - hit.ts <= WINDOW_MS && hit.index >= 0 && hit.index < out.length) {
              const existing = out[hit.index];
              const rep = (existing.repeat ?? 1) + 1;
              out[hit.index] = { ...existing, repeat: rep } as any;
              // refresh timestamp
              logIndexRef.current.set(key, { index: hit.index, ts: now });
            } else {
              // append as new line
              out.push(entry as any);
              logIndexRef.current.set(key, { index: out.length - 1, ts: now });
            }
            if (typeof (entry as any).i === 'number') {
              logsIndexRef.current = Math.max(logsIndexRef.current, (entry as any).i as number);
            }

            // Inject narrative magical logs derived from this message
            try {
              const ctxNet = (job?.result?.network || network) as string | undefined;
              const ctxName = job?.result?.contract as string | undefined;
              const narratives = magicalFromLog(entry.msg || (entry as any).message || '', { network: ctxNet, contractName: ctxName });
              const iconFor = (cat: string) => cat === 'generation' ? '🪄' : cat === 'compilation' ? '🧪' : cat === 'errors' ? '❌' : cat === 'deployment' ? '🚀' : cat === 'celebration' ? '🎉' : '✨';
              for (const n of narratives) {
                const nMsg = `${iconFor(n.category)} ${n.msg}`;
                const mKey = `magical|${nMsg}`;
                const mHit = logIndexRef.current.get(mKey);
                if (mHit && now - mHit.ts <= WINDOW_MS && mHit.index >= 0 && mHit.index < out.length) {
                  const existing = out[mHit.index] as any;
                  const rep = (existing.repeat ?? 1) + 1;
                  out[mHit.index] = { ...existing, repeat: rep };
                  logIndexRef.current.set(mKey, { index: mHit.index, ts: now });
                } else {
                  out.push({ level: 'magical', msg: nMsg } as any);
                  logIndexRef.current.set(mKey, { index: out.length - 1, ts: now });
                }
              }
            } catch { /* ignore magical errors */ }
          }
          // cap log length to last 2000 entries to avoid unbounded growth
          const MAX = 2000;
          const trimmed = out.length > MAX ? out.slice(out.length - MAX) : out;
          // rebuild index map for trimmed logs (use current time for timestamps)
          const rebuilt = new Map<string, { index: number; ts: number }>();
          const baseIdx = trimmed.length - Math.min(trimmed.length, MAX);
          for (let i = 0; i < trimmed.length; i++) {
            const l = trimmed[i];
            const key = `${l.level}|${l.msg || l.message}`;
            rebuilt.set(key, { index: i, ts: now });
          }
          logIndexRef.current = rebuilt;
          return trimmed as any;
        });
      }
    } catch (e) {
      // ignore
    } finally {
      fetchingLogsRef.current = false;
    }
  }

  function clearLogs() {
    setLogs([]);
    setLogsSince(0);
    logsSinceRef.current = 0;
    logIndexRef.current.clear();
  }

  // keep refs synced when state changes (in case external changes happen)
  useEffect(() => {
    jobIdRef.current = jobId;
  }, [jobId]);

  useEffect(() => {
    logsSinceRef.current = logsSince;
  }, [logsSince]);

  // auto-scroll logs on append
  useEffect(() => {
    if (logsBoxRef.current) {
      logsBoxRef.current.scrollTop = logsBoxRef.current.scrollHeight;
    }
  }, [logs]);

  async function fetchArtifacts(id: string, attempt = 0) {
    const maxAttempts = 8; // ~12s total at 1.5s steps
    const waitMs = 1500;

    const hasArtifacts = () => {
      const srcReady = !!sources && sources.length > 0;
      const abiReady = !!abis && Object.keys(abis).length > 0;
      const scrReady = !!scripts && scripts.length > 0;
      return srcReady || abiReady || scrReady;
    };

    const normalize = (payload: any) => {
      const data = payload?.data ?? payload ?? {};
      const toSourcesRecord = (s: any): Record<string, string> => {
        if (!s) return {};
        // Array<{path, content}> → Record
        if (Array.isArray(s)) {
          const out: Record<string, string> = {};
          for (const it of s) {
            const p = it?.path;
            const c = it?.content;
            if (typeof p === 'string' && typeof c === 'string') out[p] = c;
          }
          return out;
        }
        // If object: either { file: code } or { file: { content } }
        if (typeof s === 'object') {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries<any>(s)) {
            if (typeof v === 'string') out[k] = v;
            else if (v && typeof v === 'object' && typeof v.content === 'string') out[k] = v.content;
          }
          return out;
        }
        return {};
      };
      const toScriptsRecord = (s: any): Record<string, string> => toSourcesRecord(s);
      const toAbisRecord = (a: any): Record<string, any> => {
        if (!a) return {};
        if (Array.isArray(a)) {
          const out: Record<string, any> = {};
          a.forEach((item: any, i: number) => {
            const name = item?.name || `Contract${i}`;
            if (item?.abi) out[name] = { abi: item.abi, bytecode: item.bytecode || item?.evm?.bytecode?.object };
          });
          return out;
        }
        if (typeof a === 'object') return a as Record<string, any>;
        return {};
      };

      const srcRec = toSourcesRecord(data.sources);
      const abiRec = toAbisRecord(data.abis);
      const scrRec = toScriptsRecord(data.scripts);
      return { srcRec, abiRec, scrRec };
    };

    const applyArtifacts = (srcRec: Record<string, string>, abiRec: Record<string, any>, scrRec: Record<string, string>) => {
      const srcArr = Object.entries(srcRec).map(([path, content]) => ({ path, content }));
      const scrArr = Object.entries(scrRec).map(([path, content]) => ({ path, content }));
      if (srcArr.length) { setSources(srcArr); setActiveArtifactTab('sources'); }
      if (Object.keys(abiRec).length) setAbis(abiRec);
      if (scrArr.length) setScripts(scrArr);
    };

    const logA = (msg: string) => setArtifactsDebug((prev) => [...prev, `${new Date().toISOString()} ${msg}`]);

    try {
      console.debug('[Artifacts] Attempt', attempt + 1, 'jobId=', id);
      logA(`Attempt ${attempt + 1} for job ${id}`);
      // 1) Combined default
      try {
        const all = await Api.getArtifactsAll(id);
        const { srcRec, abiRec, scrRec } = normalize(all);
        applyArtifacts(srcRec, abiRec, scrRec);
        logA(`GET /api/artifacts?include=all&jobId=... src=${Object.keys(srcRec).length} abi=${Object.keys(abiRec).length} scripts=${Object.keys(scrRec).length}`);
      } catch (e) {
        console.warn('[Artifacts] combined include=all failed', e);
        logA(`combined include=all failed: ${e instanceof Error ? e.message : String(e)}`);
      }

      // 2) Combined without include
      if (!hasArtifacts()) {
        try {
          const allNoInc = await Api.getArtifactsAllNoInclude(id);
          const { srcRec, abiRec, scrRec } = normalize(allNoInc);
          applyArtifacts(srcRec, abiRec, scrRec);
          logA(`GET /api/artifacts?jobId=... src=${Object.keys(srcRec).length} abi=${Object.keys(abiRec).length} scripts=${Object.keys(scrRec).length}`);
        } catch (e) {
          console.warn('[Artifacts] combined no-include failed', e);
          logA(`combined no-include failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // 3) Combined with different id key (job/id)
      if (!hasArtifacts()) {
        for (const key of ['job', 'id'] as const) {
          try {
            const alt = await Api.getArtifactsAllBy(id, key);
            const { srcRec, abiRec, scrRec } = normalize(alt);
            applyArtifacts(srcRec, abiRec, scrRec);
            logA(`GET /api/artifacts?include=all&${key}=... src=${Object.keys(srcRec).length} abi=${Object.keys(abiRec).length} scripts=${Object.keys(scrRec).length}`);
            if (hasArtifacts()) break;
          } catch (e) {
            console.warn(`[Artifacts] combined alt key=${key} failed`, e);
            logA(`combined alt key=${key} failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      // 4) Job-nested endpoints
      if (!hasArtifacts()) {
        try {
          const jobAll = await Api.getJobArtifacts(id);
          const { srcRec, abiRec, scrRec } = normalize(jobAll);
          applyArtifacts(srcRec, abiRec, scrRec);
          logA(`GET /api/job/:id/artifacts src=${Object.keys(srcRec).length} abi=${Object.keys(abiRec).length} scripts=${Object.keys(scrRec).length}`);
        } catch (e) {
          console.warn('[Artifacts] /api/job/:id/artifacts failed', e);
          logA(`/api/job/:id/artifacts failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // 5) Specific parts fallbacks
      if (!hasArtifacts()) {
        try {
          const res = await Api.getArtifactsSources(id);
          const { srcRec } = normalize(res);
          if (Object.keys(srcRec).length) applyArtifacts(srcRec, {}, {});
          logA(`GET /api/artifacts/sources src=${Object.keys(srcRec).length}`);
        } catch (e) {
          console.warn('[Artifacts] sources fetch failed', e);
          logA(`sources fetch failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        try {
          const res = await Api.getArtifactsAbis(id);
          const { abiRec } = normalize(res);
          if (Object.keys(abiRec).length) applyArtifacts({}, abiRec, {});
          logA(`GET /api/artifacts/abis abi=${Object.keys(abiRec).length}`);
        } catch (e) {
          console.warn('[Artifacts] abis fetch failed', e);
          logA(`abis fetch failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        try {
          const res = await Api.getArtifactsScripts(id);
          const { scrRec } = normalize(res);
          if (Object.keys(scrRec).length) applyArtifacts({}, {}, scrRec);
          logA(`GET /api/artifacts/scripts scripts=${Object.keys(scrRec).length}`);
        } catch (e) {
          console.warn('[Artifacts] scripts fetch failed', e);
          logA(`scripts fetch failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // 6) Job-nested specific parts
      if (!hasArtifacts()) {
        for (const part of ['sources', 'abis', 'scripts'] as const) {
          try {
            const jobAll = await Api.getJobArtifactsPart(id, part);
            const { srcRec, abiRec, scrRec } = normalize(jobAll);
            applyArtifacts(srcRec, abiRec, scrRec);
            logA(`GET /api/job/:id/${part} found src=${Object.keys(srcRec).length} abi=${Object.keys(abiRec).length} scripts=${Object.keys(scrRec).length}`);
          } catch (e) {
            console.warn(`[Artifacts] /api/job/:id/${part} failed`, e);
            logA(`/api/job/:id/${part} failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      // If nothing yet, retry briefly (artifacts sometimes lag a bit behind status=completed)
      if (!hasArtifacts() && attempt < maxAttempts) {
        setTimeout(() => fetchArtifacts(id, attempt + 1), waitMs);
      }
      // Last-resort fallback: regenerate from prompt + compile (not guaranteed to match deployed bytecode)
      else if (!hasArtifacts() && attempt >= maxAttempts) {
        try {
          console.warn('[Artifacts] Backend returned no artifacts; attempting fallback generation from prompt');
          logA('Backend returned no artifacts after retries; attempting fallback generation');
          const gen = await Api.aiGenerate(prompt);
          let srcRec: Record<string, string> = {};
          const data: any = gen || {};
          const genData = (data.data || {}) as any;
          if (genData.sources && typeof genData.sources === 'object') {
            srcRec = genData.sources as Record<string, string>;
          } else if (typeof genData.code === 'string' && genData.code.trim().length > 0) {
            const fname = `${job?.result?.contract || 'AIGenerated'}.sol`;
            srcRec = { [fname]: genData.code };
          }
          if (Object.keys(srcRec).length) {
            const srcArr = Object.entries(srcRec).map(([path, content]) => ({ path, content }));
            setSources(srcArr);
            setActiveArtifactTab('sources');
            logA(`Fallback generation produced sources: ${srcArr.length}`);

            // Try compile to recover ABIs
            const [firstPath, firstContent] = Object.entries(srcRec)[0];
            try {
              const comp = await Api.aiCompile(firstPath, firstContent);
              const compData: any = comp?.data || comp || {};
              // Try various shapes
              let abiRec: Record<string, any> = {};
              if (compData.abis && typeof compData.abis === 'object') {
                abiRec = compData.abis;
              } else if (compData.contracts && typeof compData.contracts === 'object') {
                // Flatten common hardhat-like contracts mapping to abis record
                const out: Record<string, any> = {};
                for (const [name, meta] of Object.entries<any>(compData.contracts)) {
                  if (meta && meta.abi) out[name] = { abi: meta.abi, bytecode: meta.bytecode || meta.evm?.bytecode?.object };
                }
                abiRec = out;
              }
              if (Object.keys(abiRec).length) setAbis(abiRec);
            } catch (e) {
              console.warn('[Artifacts] Fallback compile failed', e);
              logA(`Fallback compile failed: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        } catch (e) {
          console.warn('[Artifacts] Fallback generation failed', e);
          logA(`Fallback generation failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      console.warn('Artifacts: unexpected failure', e);
      logA(`Unexpected failure: ${e instanceof Error ? e.message : String(e)}`);
      if (!hasArtifacts() && attempt < maxAttempts) {
        setTimeout(() => fetchArtifacts(id, attempt + 1), waitMs);
      }
    }
  }

  async function deployERC20() {
    setErc20Error(null);
    setErc20Loading(true);
    setErc20Result(null);
    try {
      const res = await Api.deployErc20({
        name: erc20Name,
        symbol: erc20Symbol,
        initialSupply: erc20Supply,
        owner: erc20Owner,
        network,
      });
      setErc20Result(res.result);
    } catch (e: any) {
      setErc20Error(e?.message || "ERC20 deployment failed");
    } finally {
      setErc20Loading(false);
    }
  }

  const firstSource = sources?.[selectedSourceIdx || 0];
  const firstScript = scripts?.[selectedScriptIdx || 0];
  const deployedAddress = job?.result?.address || erc20Result?.address;
  const explorerUrl = job?.result?.address
    ? getExplorerUrl(job?.result?.network, job?.result?.address)
    : erc20Result?.explorerUrl;
  const networkLabel = job?.result?.network ? (NETWORK_LABELS[job.result.network] || job.result.network) : undefined;

  // New ticker items: 25+ templates provided by user (exact prompts)
  // To avoid hydration mismatch: render base order on server, then rotate on client after mount
  const baseTickerItems: TickerItem[] = useMemo(() => [
    {
      label: "CrossChainInbox",
      text: "EMPTY CONSTRUCTOR (no args). Receive messages (bytes data, address sender, uint256 srcChainId). Owner can setTrustedBridge(address,bool). Events: MessageReceived(bytes,address,uint256), BridgeUpdated(address,bool). Use Ownable and ReentrancyGuard. No constructor parameters; all config via setters."
    },
    {
      label: "MicroGrantDAO",
      text: "EMPTY CONSTRUCTOR (no args). AccessControl-based grants. Functions: proposeGrant(string ipfsCid,uint256 amount), voteYes(uint256 id), voteNo(uint256 id), finalize(uint256 id). Owner/admin can setTreasury(address) and setGovernanceToken(address) post-deploy (token-weighted voting optional; if governanceToken=0 address, use simple 1-address-1-vote). Events: Proposed, Voted, Finalized, TreasurySet, GovernanceTokenSet. No constructor args."
    },
    {
      label: "OnchainAttestor (ComplianceRegistry)",
      text: "EMPTY CONSTRUCTOR. Roles: DEFAULT_ADMIN_ROLE, AUDITOR_ROLE. issue(address subject, bytes32 topic, bytes32 value), revoke(address subject, bytes32 topic), update(address,bytes32,bytes32). Query latest by (subject,topic). Events: Issued, Revoked, Updated. No constructor args."
    },
    {
      label: "CampFaucet",
      text: "EMPTY CONSTRUCTOR. Daily ERC20 faucet. Owner can setToken(address) and setDailyAmount(uint256). claim() once per 24h per address with cooldown mapping. Events: Claimed(address,uint256), ParamsUpdated(address token,uint256 dailyAmount). No constructor args."
    },
    {
      label: "NFTRaffle",
      text: "EMPTY CONSTRUCTOR. Owner sets setTicketPrice(uint256) and setPrize(address nft,uint256 tokenId). buyTicket() payable; drawWinner() onlyOwner using blockhash (demo); claimPrize() by winner. Events: TicketBought(address), WinnerDrawn(address), PrizeClaimed(address,uint256). ReentrancyGuard. No constructor args."
    },
    {
      label: "BountyBoard",
      text: "EMPTY CONSTRUCTOR. createBounty(string cid,uint256 reward,address token) (escrows ERC20 in contract); submitWork(uint256 id,string cid); resolve(uint256 id,bool success) by owner/reviewer; pay(uint256 id) transfers token on success. Events: Created, Submitted, Resolved, Paid. No constructor args."
    },
    {
      label: "NameRegistrar",
      text: "EMPTY CONSTRUCTOR. Simple ENS-like: name(string)=>owner + contenthash(bytes32). register(string), setContenthash(string,bytes32), transferName(string,address). Prevent duplicates. Events: Registered, ContentUpdated, Transferred. No constructor args."
    },
    {
      label: "StableVault",
      text: "EMPTY CONSTRUCTOR. Single-asset vault with internal receipt ERC20 using fixed NAME='Stable Vault Token' and SYMBOL='SVT' constants in code. Owner sets setUnderlying(address erc20) and setWithdrawalFeeBps(uint16) post-deploy; pause/unpause. deposit(uint256), withdraw(uint256) burns receipts and transfers underlying minus fee. Events: Deposited, Withdrawn, ParamsUpdated, Paused, Unpaused. No constructor args."
    },
    {
      label: "SocialTips",
      text: "EMPTY CONSTRUCTOR. setProfile(bytes32 id,string cid); tip(bytes32 id) payable accumulates balance; withdraw(bytes32 id) by creator. Optional splits via setSplits(bytes32,address[],uint256[] bps). Events: ProfileSet, Tipped, Withdrawn, SplitsSet. No constructor args."
    },
    {
      label: "GasSponsor",
      text: "EMPTY CONSTRUCTOR. ERC2771-style demo. Owner setTrustedForwarder(address) post-deploy. executeMetaTx(address target, bytes data, bytes signature) verifies EIP-712 and performs call on behalf of user, sponsor pays gas. Events: ForwarderSet(address), MetaTxExecuted(address user,address target,bytes4 selector). No constructor args."
    },
    {
      label: "SMSOracle",
      text: "EMPTY CONSTRUCTOR. Roles: DEFAULT_ADMIN_ROLE, ORACLE_ROLE. post(address user,bool verified,uint64 ts) by oracle/admin; revoke(address user). view isVerified(address). Events: Posted(address,bool,uint64), Revoked(address). No constructor args."
    },
    {
      label: "PriceFeedAggregator",
      text: "EMPTY CONSTRUCTOR. Admin addSymbol(bytes32); grant FEEDER_ROLE. submit(bytes32 symbol,uint256 price) by feeder; read latest price and median of last N submissions (keep small ring buffer per symbol). Events: SymbolAdded, Submitted. No constructor args."
    },
    {
      label: "MultiSigLite",
      text: "EMPTY CONSTRUCTOR. Post-deploy owner (deployer) config: addOwner(address), removeOwner(address), setThreshold(uint256). submitTransaction(address to,uint256 value,bytes data) returns id; confirmTransaction(uint256 id); execute(uint256 id) when confirmations >= threshold. Events: OwnerAdded, OwnerRemoved, ThresholdSet, Submitted, Confirmed, Executed. No constructor args."
    },
    {
      label: "AirdropMerkle",
      text: "EMPTY CONSTRUCTOR. Owner setToken(address erc20) and setMerkleRoot(bytes32 root) post-deploy. claim(uint256 amount, bytes32[] proof) with claimed bitmap. Events: RootSet(bytes32), Claimed(address,uint256). No constructor args."
    },
    {
      label: "CampaignManager",
      text: "EMPTY CONSTRUCTOR. createCampaign(string cid,uint256 deadline,uint256 goal). donate(uint256 id) payable; withdraw(uint256 id) after deadline if goal met; refund(uint256 id) if not met. Events: Created, Donated, Withdrawn, Refunded. No constructor args."
    },
    {
      label: "TimeLockVault",
      text: "EMPTY CONSTRUCTOR. deposit(address token,uint256 amount,uint256 unlockTimestamp); withdraw(uint256 depositId) after unlock; owner can pause/unpause. Events: Deposited, Withdrawn, Paused, Unpaused. No constructor args."
    },
    {
      label: "EscrowSimple",
      text: "EMPTY CONSTRUCTOR. createEscrow(address buyer,address seller,address token,uint256 amount,address arbiter); buyer deposits; arbiter release(id)/refund(id). Events: EscrowCreated, Funded, Released, Refunded. No constructor args."
    },
    {
      label: "RewardDistributor",
      text: "EMPTY CONSTRUCTOR. Owner setToken(address erc20). setMerkleRoot(uint256 epoch, bytes32 root); claim(uint256 epoch,uint256 amount,bytes32[] proof). Events: EpochSet(uint256,bytes32), Claimed(address,uint256,uint256). No constructor args."
    },
    {
      label: "SBTRegistry",
      text: "EMPTY CONSTRUCTOR. Minimal non-transferable SBT (do NOT inherit ERC721 that needs name/symbol args). issue(address to,string cid) onlyOwner -> returns tokenId; revoke(uint256 tokenId) onlyOwner. Events: Issued(address,uint256,string), Revoked(uint256). No constructor args."
    },
    {
      label: "FeeSplitter",
      text: "EMPTY CONSTRUCTOR. Receives ETH and splits by shares. Owner addPayee(address,uint96 shares), removePayee(address). release(address payee) pulls owed ETH. Events: PayeeAdded, PayeeRemoved, PaymentReleased. No constructor args."
    },
    {
      label: "L2BridgeMock",
      text: "EMPTY CONSTRUCTOR. lock(address token,uint256 amount,uint256 dstChain) emits event; unlock(address token,address to,uint256 amount) onlyOwner. Events: Locked, Unlocked. No constructor args."
    },
    {
      label: "SubscriptionManager",
      text: "EMPTY CONSTRUCTOR. Owner createPlan(uint256 price,uint256 period); subscribe(uint256 planId) payable; cancel(uint256 subId); owner withdraw(). Events: PlanCreated, Subscribed, Canceled, Withdrawn. No constructor args."
    },
    {
      label: "OracleRegistry",
      text: "EMPTY CONSTRUCTOR. registerOracle(address oracle, bytes32 role) onlyOwner; post(bytes32 key, bytes data) only registered oracle; read latest by key. Events: OracleRegistered, Posted. No constructor args."
    },
    {
      label: "PermitERC20",
      text: "EMPTY CONSTRUCTOR. ERC20 with EIP-2612 permit(). HARD-CODE constants NAME='Permit Token', SYMBOL='PRMT', DECIMALS=18 in code. mint(address to,uint256 amount) onlyOwner. Use OZ ERC20Permit with fixed name via constructor internal call that uses constant, not external args. Events: standard ERC20. No constructor args."
    },
    {
      label: "NFTDutchAuction",
      text: "NFTDutchAuction: EMPTY CONSTRUCTOR. Owner sets setItem(address nft,uint256 tokenId). start(uint256 priceStart,uint256 priceEnd,uint256 duration); buy() at descending price; finalize. Events: Started, Bought, Finalized. No constructor args."
    },
    { label: "DonationBox", text: "EMPTY CONSTRUCTOR. accept ETH donations via donate() payable. owner withdraw(). Events: Donated(address,uint256), Withdrawn(address,uint256). No constructor args." },
    { label: "SimpleVoting", text: "EMPTY CONSTRUCTOR. createProposal(string cid). vote(uint256 id,bool support). close(uint256 id) after deadline. Events: ProposalCreated, Voted, Closed. No constructor args." },
    { label: "BadgeRegistry", text: "EMPTY CONSTRUCTOR. issueBadge(address user,string uri) onlyOwner. revokeBadge(uint256 id) onlyOwner. Non-transferable. Events: Issued, Revoked. No constructor args." },
    { label: "ContentRegistry", text: "EMPTY CONSTRUCTOR. registerContent(bytes32 hash,string uri). updateContent(uint256 id,string newUri). Events: Registered, Updated. No constructor args." },
    { label: "RoyaltySplitter", text: "EMPTY CONSTRUCTOR. receive ETH. owner setSplits(address[] payees,uint256[] bps). release(address payee). Events: SplitsSet, Released. No constructor args." },
    { label: "WhitelistRegistry", text: "EMPTY CONSTRUCTOR. owner add(address), remove(address). view isWhitelisted(address). Events: Added, Removed. No constructor args." },
    { label: "SimpleNFT", text: "EMPTY CONSTRUCTOR. ERC721 with fixed NAME='Simple NFT' and SYMBOL='SNFT'. owner mint(address to,string uri). Events: Minted. No constructor args." },
    { label: "GovernanceNotes", text: "EMPTY CONSTRUCTOR. addNote(string cid) onlyOwner. updateNote(uint256 id,string newCid). Events: NoteAdded, NoteUpdated. No constructor args." },
    { label: "CrowdFundLite", text: "EMPTY CONSTRUCTOR. startCampaign(string cid,uint256 goal,uint256 deadline). contribute(uint256 id) payable. withdraw(uint256 id) if goal met. refund(uint256 id) if not. Events: CampaignStarted, Contributed, Withdrawn, Refunded. No constructor args." },
    { label: "ReputationSystem", text: "EMPTY CONSTRUCTOR. grant(address user,uint256 points) onlyOwner. revoke(address user,uint256 points) onlyOwner. view reputation(address). Events: Granted, Revoked. No constructor args." },
    { label: "MultiSender", text: "EMPTY CONSTRUCTOR. sendETH(address[] recipients,uint256[] amounts) payable. Events: Sent(address,uint256). No constructor args." },

    // --- Appended templates (unique labels) ---
    { label: "MessageBoard", text: "EMPTY CONSTRUCTOR. post(string message). Events: MessagePosted. No constructor args." },
    { label: "LikeCounter", text: "EMPTY CONSTRUCTOR. like(). unlike(). view count(). Events: Liked, Unliked. No constructor args." },
    { label: "SimpleCounter", text: "EMPTY CONSTRUCTOR. increment(). decrement(). view current(). Events: Incremented, Decremented. No constructor args." },
    { label: "Greeter", text: "EMPTY CONSTRUCTOR. setGreeting(string text). getGreeting(). Events: GreetingSet. No constructor args." },
    { label: "NoteKeeper", text: "EMPTY CONSTRUCTOR. addNote(string text). updateNote(uint256 id,string text). Events: NoteAdded, NoteUpdated. No constructor args." },
    { label: "SimpleBank", text: "EMPTY CONSTRUCTOR. deposit() payable. withdraw(uint256 amount). view balance(). Events: Deposited, Withdrawn. No constructor args." },
    { label: "Poll", text: "EMPTY CONSTRUCTOR. createPoll(string question). vote(uint256 id,bool choice). closePoll(uint256 id). Events: PollCreated, Voted, Closed. No constructor args." },
    { label: "DonationTracker", text: "EMPTY CONSTRUCTOR. donate() payable. totalDonations(). Events: Donated. No constructor args." },
    { label: "TodoList", text: "EMPTY CONSTRUCTOR. addTask(string desc). completeTask(uint256 id). Events: TaskAdded, TaskCompleted. No constructor args." },
    { label: "PetAdoption", text: "EMPTY CONSTRUCTOR. addPet(string name). adopt(uint256 id). Events: PetAdded, Adopted. No constructor args." },

    { label: "AllowanceBox", text: "EMPTY CONSTRUCTOR. setAllowance(address user,uint256 amount). spend(uint256 amount). Events: AllowanceSet, Spent. No constructor args." },
    { label: "LotteryBox", text: "EMPTY CONSTRUCTOR. enter() payable. pickWinner() onlyOwner. Events: Entered, WinnerPicked. No constructor args." },
    { label: "Vault", text: "EMPTY CONSTRUCTOR. deposit() payable. withdraw(uint256 amount). Events: Deposited, Withdrawn. No constructor args." },
    { label: "BadgeMinter", text: "EMPTY CONSTRUCTOR. mintBadge(address user,string uri) onlyOwner. Events: BadgeMinted. No constructor args." },
    { label: "PointsLedger", text: "EMPTY CONSTRUCTOR. award(address user,uint256 points). burn(address user,uint256 points). view balance(address). Events: Awarded, Burned. No constructor args." },
    { label: "Whitelist", text: "EMPTY CONSTRUCTOR. add(address). remove(address). check(address). Events: Added, Removed. No constructor args." },
    { label: "Blacklist", text: "EMPTY CONSTRUCTOR. add(address). remove(address). check(address). Events: Blacklisted, Removed. No constructor args." },
    { label: "Reputation", text: "EMPTY CONSTRUCTOR. increase(address,uint256). decrease(address,uint256). view score(address). Events: Increased, Decreased. No constructor args." },
    { label: "SimpleStore", text: "EMPTY CONSTRUCTOR. set(uint256 value). get() view returns(uint256). Events: ValueSet. No constructor args." },
    { label: "KeyValueStore", text: "EMPTY CONSTRUCTOR. set(bytes32 key,string value). get(bytes32 key). Events: EntrySet. No constructor args." },
    { label: "SimpleAuction", text: "EMPTY CONSTRUCTOR. start(uint256 minBid,uint256 duration). bid() payable. finalize(). Events: Started, BidPlaced, Finalized. No constructor args." },
    { label: "Escrow", text: "EMPTY CONSTRUCTOR. create(address seller,uint256 amount). fund() payable. release(). refund(). Events: Created, Funded, Released, Refunded. No constructor args." },
    { label: "EventLog", text: "EMPTY CONSTRUCTOR. log(string message). Events: Logged. No constructor args." },
    { label: "SimpleNFTMinter", text: "EMPTY CONSTRUCTOR. ERC721 fixed NAME='TestNFT' SYMBOL='TNFT'. mint(address to,string uri). Events: Minted. No constructor args." },
    { label: "CouponBook", text: "EMPTY CONSTRUCTOR. issue(address user,string code). redeem(uint256 id). Events: Issued, Redeemed. No constructor args." },

    { label: "TokenFaucet", text: "EMPTY CONSTRUCTOR. setToken(address). drip(address user). Events: TokenSet, Dripped. No constructor args." },
    { label: "Survey", text: "EMPTY CONSTRUCTOR. create(string question). respond(uint256 id,string answer). close(uint256 id). Events: Created, Responded, Closed. No constructor args." },
    { label: "Membership", text: "EMPTY CONSTRUCTOR. join(address user). leave(address user). Events: Joined, Left. No constructor args." },
    { label: "Karma", text: "EMPTY CONSTRUCTOR. give(address user,uint256 points). take(address user,uint256 points). Events: Given, Taken. No constructor args." },
    { label: "Scheduler", text: "EMPTY CONSTRUCTOR. schedule(string task,uint256 time). cancel(uint256 id). Events: Scheduled, Canceled. No constructor args." },
    { label: "GiftBox", text: "EMPTY CONSTRUCTOR. deposit() payable. open() onlyOwner. Events: Deposited, Opened. No constructor args." },
    { label: "AccessList", text: "EMPTY CONSTRUCTOR. grant(address). revoke(address). check(address). Events: Granted, Revoked. No constructor args." },
    { label: "SimpleToken", text: "EMPTY CONSTRUCTOR. ERC20 fixed NAME='SimpleToken' SYMBOL='STK'. mint(address,uint256). Events: Minted. No constructor args." },
    { label: "SurveyBox", text: "EMPTY CONSTRUCTOR. createSurvey(string q). vote(uint256 id,uint8 choice). close(uint256 id). Events: Created, Voted, Closed. No constructor args." },

    { label: "Timelock", text: "EMPTY CONSTRUCTOR. lock(uint256 amount,uint256 until) payable. unlock(uint256 id). Events: Locked, Unlocked. No constructor args." },
    { label: "Pledge", text: "EMPTY CONSTRUCTOR. pledge() payable. withdraw() onlyOwner. Events: Pledged, Withdrawn. No constructor args." },
    { label: "TokenMinter", text: "EMPTY CONSTRUCTOR. ERC20 NAME='MinterToken' SYMBOL='MINT'. mint(address,uint256). Events: Minted. No constructor args." },
    { label: "TaskList", text: "EMPTY CONSTRUCTOR. add(string task). complete(uint256 id). Events: Added, Completed. No constructor args." },
    { label: "ProposalBox", text: "EMPTY CONSTRUCTOR. propose(string title). vote(uint256 id,bool support). Events: Proposed, Voted. No constructor args." },
    { label: "SimpleRewards", text: "EMPTY CONSTRUCTOR. addPoints(address,uint256). redeem(address,uint256). Events: PointsAdded, Redeemed. No constructor args." },
    { label: "CrowdFund", text: "EMPTY CONSTRUCTOR. start(string name,uint256 goal). contribute(uint256 id) payable. withdraw(uint256 id). Events: Started, Contributed, Withdrawn. No constructor args." },
    { label: "NFTBadge", text: "EMPTY CONSTRUCTOR. ERC721 NAME='Badge' SYMBOL='BGE'. mint(address,string uri). Events: Minted. No constructor args." },
    { label: "Logger", text: "EMPTY CONSTRUCTOR. write(string text). Events: Written. No constructor args." },
    { label: "ContentLicensing", text: "EMPTY CONSTRUCTOR. ERC721. SPDX-License-Identifier: MIT. NAME='ContentLicense' SYMBOL='CL'. licenseContent(address creator,string uri,uint256 royalty). Only override ERC721URIStorage. Use 4-param _beforeTokenTransfer. Events: Licensed. No constructor args." },
    { label: "PeerToPeerLending", text: "EMPTY CONSTRUCTOR. createLoan(uint256 amount,uint256 interest,uint256 duration). fundLoan(uint256 loanId) payable. repay(uint256 loanId) payable. Events: LoanCreated, Funded, Repaid. No constructor args." },
    { label: "DecentalizedExchange", text: "EMPTY CONSTRUCTOR. addLiquidity(address token) payable. swap(address tokenIn,address tokenOut,uint256 amountIn). Events: LiquidityAdded, Swapped. No constructor args." },
    { label: "TaskMarketplace", text: "EMPTY CONSTRUCTOR. createTask(string description,uint256 reward) payable. completeTask(uint256 taskId,string proof). approveTask(uint256 taskId). Events: TaskCreated, Completed, Approved. No constructor args." },
    { label: "VendingMachine", text: "EMPTY CONSTRUCTOR. owner addProduct(uint256 productId,uint256 price,uint256 stock). purchase(uint256 productId) payable. Events: ProductAdded, Purchased. No constructor args." },
    { label: "PayrollSystem", text: "EMPTY CONSTRUCTOR. owner addEmployee(address emp,uint256 salary). paySalary(address emp). employee claimSalary(). Events: EmployeeAdded, SalaryPaid, SalaryClaimed. No constructor args." },
    { label: "BugBountyProgram", text: "EMPTY CONSTRUCTOR. owner createBounty(string description,uint256 reward). submitBug(uint256 bountyId,string report). approveBug(uint256 submissionId). Events: BountyCreated, BugSubmitted, BugApproved. No constructor args." },
    { label: "PredictionMarket", text: "EMPTY CONSTRUCTOR. createMarket(string question,uint256 endTime). bet(uint256 marketId,bool outcome) payable. resolve(uint256 marketId,bool result). Events: MarketCreated, BetPlaced, MarketResolved. No constructor args." },
    { label: "DecentralizedStorage", text: "EMPTY CONSTRUCTOR. uploadFile(bytes32 fileHash,string ipfsHash) payable. deleteFile(bytes32 fileHash) by uploader. Events: FileUploaded, FileDeleted. No constructor args." },
    { label: "SupplyChainTracker", text: "EMPTY CONSTRUCTOR. createProduct(string productId,string origin). updateLocation(string productId,string location). Events: ProductCreated, LocationUpdated. No constructor args." },
    { label: "TimeLockedWallet", text: "EMPTY CONSTRUCTOR. deposit() payable. setUnlockTime(uint256 timestamp). withdraw() after unlock. Events: Deposited, UnlockTimeSet, Withdrawn. No constructor args." },
    { label: "RewardPoints", text: "EMPTY CONSTRUCTOR. ERC20 with NAME='RewardPoints' SYMBOL='RP'. owner mint(address to,uint256 amount). redeem(uint256 points,string item). Events: Minted, Redeemed. No constructor args." },
    { label: "MultiSigTreasury", text: "EMPTY CONSTRUCTOR. owner addSigner(address signer). proposeTransaction(address to,uint256 value,bytes data). confirmTransaction(uint256 txId). Events: SignerAdded, Proposed, Confirmed. No constructor args." },
    { label: "CarbonCredits", text: "EMPTY CONSTRUCTOR. ERC20 with NAME='CarbonCredits' SYMBOL='CC'. owner mint(address to,uint256 amount). retire(uint256 amount) burns tokens. Events: Minted, Retired. No constructor args." },
    { label: "EnergyTrading", text: "EMPTY CONSTRUCTOR. sellEnergy(uint256 amount,uint256 pricePerUnit). buyEnergy(uint256 sellOfferId) payable. Events: EnergySold, EnergyBought. No constructor args." },
    { label: "MusicRoyalties", text: "EMPTY CONSTRUCTOR. registerSong(string songId,address[] artists,uint256[] shares). distributeRoyalties(string songId) payable splits to artists. Events: SongRegistered, RoyaltiesDistributed. No constructor args." },
    { label: "FreelanceEscrow", text: "EMPTY CONSTRUCTOR. createProject(address freelancer,uint256 payment) payable. deliverWork(uint256 projectId,string deliverable). approveWork(uint256 projectId). Events: ProjectCreated, WorkDelivered, WorkApproved. No constructor args." },
    { label: "VehicleRegistry", text: "EMPTY CONSTRUCTOR. registerVehicle(string vin,string make,string model,uint256 year). transferOwnership(string vin,address newOwner). Events: VehicleRegistered, OwnershipTransferred. No constructor args." },
    { label: "MedicalRecords", text: "EMPTY CONSTRUCTOR. addRecord(address patient,bytes32 recordHash,string ipfsHash). grantAccess(address doctor). patient and doctor can view. Events: RecordAdded, AccessGranted. No constructor args." },
    { label: "LoyaltyProgram", text: "EMPTY CONSTRUCTOR. owner setPointsPerPurchase(uint256 points). earnPoints(address customer,uint256 purchaseAmount). redeemPoints(uint256 points). Events: PointsEarned, PointsRedeemed. No constructor args." },
    { label: "DecentralizedBlog", text: "EMPTY CONSTRUCTOR. createPost(string title,string ipfsHash). tip(uint256 postId) payable to author. Events: PostCreated, PostTipped. No constructor args." },
    { label: "NFTFractionalization", text: "EMPTY CONSTRUCTOR. fractionalize(address nftContract,uint256 tokenId,uint256 shares). buyShare(uint256 fractionalId) payable. redeemNFT(uint256 fractionalId) if owns all shares. Events: Fractionalized, ShareBought, NFTRedeemed. No constructor args." },
    { label: "RealEstateTokens", text: "EMPTY CONSTRUCTOR. ERC721. SPDX-License-Identifier: MIT. NAME='RealEstate' SYMBOL='REAL'. tokenizeProperty(address owner,string propertyAddress,uint256 value). Only override ERC721URIStorage. Use 4-param _beforeTokenTransfer. Events: PropertyTokenized. No constructor args." },
    { label: "ChainlinkPriceFeed", text: "EMPTY CONSTRUCTOR. owner setPriceFeed(address feedAddress). getLatestPrice() returns (int256). Events: PriceFeedSet. No constructor args." },
    { label: "ElectionVoting", text: "EMPTY CONSTRUCTOR. owner addCandidate(string name). vote(uint256 candidateId) one vote per address. getResults() returns winner. Events: CandidateAdded, Voted. No constructor args." },
    { label: "CommunityFund", text: "EMPTY CONSTRUCTOR. contribute() payable. proposeProject(string description,uint256 funding). voteOnProject(uint256 projectId,bool support). releaseProjectFunds(uint256 projectId). Events: Contributed, ProjectProposed, Voted, FundsReleased. No constructor args." },
    { label: "InventoryManagement", text: "EMPTY CONSTRUCTOR. owner addItem(string itemId,uint256 quantity,uint256 price). updateStock(string itemId,uint256 newQuantity). sellItem(string itemId,uint256 quantity) payable. Events: ItemAdded, StockUpdated, ItemSold. No constructor args." },
    { label: "ReviewSystem", text: "EMPTY CONSTRUCTOR. submitReview(address product,uint8 rating,string comment). getAverageRating(address product) returns (uint256). Events: ReviewSubmitted. No constructor args." },
    { label: "WeatherInsurance", text: "EMPTY CONSTRUCTOR. createPolicy(string location,uint256 premium,uint256 payout) payable. claimPayout(uint256 policyId,string weatherProof). Events: PolicyCreated, PayoutClaimed. No constructor args." },
    { label: "JobBoard", text: "EMPTY CONSTRUCTOR. postJob(string title,string description,uint256 salary). applyForJob(uint256 jobId,string resume). hireApplicant(uint256 applicationId). Events: JobPosted, ApplicationSubmitted, ApplicantHired. No constructor args." },
    { label: "MarketplaceEscrow", text: "EMPTY CONSTRUCTOR. createListing(string item,uint256 price). purchase(uint256 listingId) payable into escrow. confirmReceipt(uint256 purchaseId). Events: Listed, Purchased, ReceiptConfirmed. No constructor args." },
    { label: "AntiCounterfeit", text: "EMPTY CONSTRUCTOR. registerProduct(string productId,bytes32 authHash). verifyProduct(string productId,bytes32 providedHash) returns (bool). Events: ProductRegistered, ProductVerified. No constructor args." },
    { label: "CrowdSourcedData", text: "EMPTY CONSTRUCTOR. submitData(string dataType,string value) payable gas refund. validateData(uint256 submissionId,bool isValid) by validator. Events: DataSubmitted, DataValidated. No constructor args." },
    { label: "GeolocationProof", text: "EMPTY CONSTRUCTOR. submitProof(string location,bytes32 proofHash,uint256 timestamp). verifyProof(uint256 proofId) returns (string,bytes32,uint256). Events: ProofSubmitted. No constructor args." },
    { label: "DigitalAssetInsurance", text: "EMPTY CONSTRUCTOR. insureAsset(address assetContract,uint256 assetId,uint256 value) payable. claimInsurance(uint256 policyId,string lossEvidence). Events: AssetInsured, InsuranceClaimed. No constructor args." },
    { label: "FarmToTable", text: "EMPTY CONSTRUCTOR. registerFarm(string farmId,string location). trackProduct(string productId,string farmId,uint256 harvestDate). Events: FarmRegistered, ProductTracked. No constructor args." },
    { label: "SocialImpactBonds", text: "EMPTY CONSTRUCTOR. createBond(string project,uint256 targetOutcome,uint256 payout) payable. reportOutcome(uint256 bondId,uint256 actualOutcome). payoutBond(uint256 bondId). Events: BondCreated, OutcomeReported, BondPaidOut. No constructor args." },
    { label: "DigitalWill", text: "EMPTY CONSTRUCTOR. createWill(bytes32 willHash,address executor). executeWill(bytes32 willHash,bytes32 deathProof) by executor. Events: WillCreated, WillExecuted. No constructor args." },
    { label: "CommunityOracle", text: "EMPTY CONSTRUCTOR. submitValue(string dataPoint,uint256 value). getConsensusValue(string dataPoint) returns (uint256 median). Events: ValueSubmitted. No constructor args." },
    { label: "PersonalDataVault", text: "EMPTY CONSTRUCTOR. storeData(bytes32 dataHash,bytes encryptedData). grantAccess(bytes32 dataHash,address accessor). revokeAccess(bytes32 dataHash,address accessor). Events: DataStored, AccessGranted, AccessRevoked. No constructor args." },
    { label: "MicroPayments", text: "EMPTY CONSTRUCTOR. openChannel(address recipient) payable. closeChannel(uint256 channelId,uint256 amount,bytes signature). Events: ChannelOpened, ChannelClosed. No constructor args." },
    { label: "CorporateGovernance", text: "EMPTY CONSTRUCTOR. issueShares(address shareholder,uint256 amount). proposeResolution(string description). voteOnResolution(uint256 resolutionId,bool support). Events: SharesIssued, ResolutionProposed, VoteCast. No constructor args." },
    { label: "TournamentBracket", text: "EMPTY CONSTRUCTOR. createTournament(string name,address[] participants). reportMatch(uint256 tournamentId,uint256 matchId,address winner). Events: TournamentCreated, MatchReported. No constructor args." },
    { label: "RecyclingRewards", text: "EMPTY CONSTRUCTOR. reportRecycling(string itemType,uint256 quantity). claimReward(uint256 reportId) mints reward tokens. Events: RecyclingReported, RewardClaimed. No constructor args." },
    { label: "DigitalLibrary", text: "EMPTY CONSTRUCTOR. uploadBook(string title,string ipfsHash) payable. borrowBook(uint256 bookId,uint256 duration) payable. returnBook(uint256 borrowId). Events: BookUploaded, BookBorrowed, BookReturned. No constructor args." },
    { label: "PetRegistry", text: "EMPTY CONSTRUCTOR. registerPet(string petId,string species,address owner). transferPet(string petId,address newOwner). reportLost(string petId). Events: PetRegistered, PetTransferred, PetReported. No constructor args." },
    { label: "EnvironmentalData", text: "EMPTY CONSTRUCTOR. submitReading(string location,string dataType,uint256 value,uint256 timestamp). getLatestReading(string location,string dataType) returns (uint256,uint256). Events: ReadingSubmitted. No constructor args." },
    { label: "StudentLoanTracker", text: "EMPTY CONSTRUCTOR. recordLoan(address student,uint256 principal,uint256 interestRate). makePayment(uint256 loanId) payable. calculateBalance(uint256 loanId) returns (uint256). Events: LoanRecorded, PaymentMade. No constructor args." },
    { label: "LocalBusinessDirectory", text: "EMPTY CONSTRUCTOR. registerBusiness(string name,string category,string location). rateBusiness(uint256 businessId,uint8 rating). Events: BusinessRegistered, BusinessRated. No constructor args." },
    { label: "EventPhotography", text: "EMPTY CONSTRUCTOR. ERC721. SPDX-License-Identifier: MIT. NAME='EventPhotos' SYMBOL='PHOTO'. mintPhoto(address photographer,string ipfsHash,uint256 eventId). Only override ERC721URIStorage. Use 4-param _beforeTokenTransfer. Events: PhotoMinted. No constructor args." },
    { label: "AcademicCredits", text: "EMPTY CONSTRUCTOR. ERC20 with NAME='AcademicCredits' SYMBOL='AC'. owner awardCredits(address student,uint256 amount,string course). transferCredits(address institution,uint256 amount). Events: CreditsAwarded, CreditsTransferred. No constructor args." },
    { label: "WasteManagement", text: "EMPTY CONSTRUCTOR. schedulePickup(string location,string wasteType,uint256 quantity). confirmPickup(uint256 pickupId) by collector. Events: PickupScheduled, PickupConfirmed. No constructor args." },
    { label: "ParkingPermits", text: "EMPTY CONSTRUCTOR. ERC721. SPDX-License-Identifier: MIT. NAME='ParkingPermit' SYMBOL='PARK'. issuePermit(address holder,string zone,uint256 expiry). Only override ERC721URIStorage. Use 4-param _beforeTokenTransfer. Events: PermitIssued. No constructor args." },
    { label: "MentalHealthSupport", text: "EMPTY CONSTRUCTOR. scheduleSession(address therapist,uint256 sessionTime) payable. recordSession(uint256 sessionId,string notes) by therapist. Events: SessionScheduled, SessionRecorded. No constructor args." },
    { label: "LocalElections", text: "EMPTY CONSTRUCTOR. owner registerVoter(address voter,string district). castVote(string district,uint256 candidateId) one per voter per district. Events: VoterRegistered, VoteCast. No constructor args." },
    { label: "EscrowETH", text: "EMPTY CONSTRUCTOR. createEscrow(address seller,uint256 amount). buyer deposits ETH; release/refund by arbiter. Events: EscrowCreated, Funded, Released, Refunded. No constructor args." },
    { label: "NFTVault", text: "EMPTY CONSTRUCTOR. depositNFT(address nft,uint256 tokenId). withdrawNFT(uint256 depositId) by depositor. Events: Deposited, Withdrawn. No constructor args." },
    { label: "TokenVesting", text: "EMPTY CONSTRUCTOR. owner createVesting(address beneficiary,uint256 amount,uint64 start,uint64 cliff,uint64 duration). beneficiary release(). Events: VestingCreated, Released. No constructor args." },
    { label: "KYCRegistry", text: "EMPTY CONSTRUCTOR. owner verify(address user,string cid). revoke(address user). view isVerified(address). Events: Verified, Revoked. No constructor args." },
    { label: "NFTWhitelistSale", text: "EMPTY CONSTRUCTOR. owner setNFT(address). setPrice(uint256). setWhitelist(address,bool). buy() payable if whitelisted. Events: Bought, WhitelistUpdated. No constructor args." },
    { label: "StakingPool", text: "EMPTY CONSTRUCTOR. owner setToken(address). stake(uint256). withdraw(uint256). Events: Staked, Withdrawn. No constructor args." },
    { label: "CrossChainNotifier", text: "EMPTY CONSTRUCTOR. owner registerBridge(address). notify(bytes data,uint256 srcChainId). Events: Notified. No constructor args." },
    { label: "OracleMock", text: "EMPTY CONSTRUCTOR. setAnswer(uint256 value) onlyOwner. getAnswer() view returns(uint256). Events: AnswerSet. No constructor args." },
    { label: "GameScoreRegistry", text: "EMPTY CONSTRUCTOR. submitScore(address player,uint256 score). getHighScore(address player). Events: ScoreSubmitted. No constructor args." },
    { label: "MinimalDAO", text: "EMPTY CONSTRUCTOR. propose(string cid). vote(uint256 id,bool support). execute(uint256 id) if majority. Events: Proposed, Voted, Executed. No constructor args." },
    { label: "AuctionHouse", text: "EMPTY CONSTRUCTOR. createAuction(address nft,uint256 tokenId,uint256 minBid,uint256 duration). bid(uint256 id) payable. finalize(uint256 id). Events: Created, BidPlaced, Finalized. No constructor args." },
    { label: "SubscriptionService", text: "EMPTY CONSTRUCTOR. subscribe() payable. owner setPrice(uint256). checkSubscription(address) returns (bool,uint256 expiry). Events: Subscribed, PriceUpdated. No constructor args." },
    { label: "EventTicketing", text: "EMPTY CONSTRUCTOR. createEvent(string name,uint256 price,uint256 maxTickets). buyTicket(uint256 eventId) payable. Events: EventCreated, TicketSold. No constructor args." },
    { label: "DigitalIdentity", text: "EMPTY CONSTRUCTOR. register(string did,bytes32 documentHash). update(string did,bytes32 newHash) by owner. Events: Registered, Updated. No constructor args." },
    { label: "FlashLoanProvider", text: "EMPTY CONSTRUCTOR. addLiquidity() payable. flashLoan(uint256 amount,bytes data). borrower implements onFlashLoan. Events: LiquidityAdded, LoanExecuted. No constructor args." }
    , { label: "VotingBooth", text: "EMPTY CONSTRUCTOR. propose(string desc). vote(uint256 id,bool support). close(uint256 id). Events: Proposed, Voted, Closed. No constructor args." }
    , { label: "TicketBooth", text: "EMPTY CONSTRUCTOR. buyTicket() payable. useTicket(uint256 id). Events: TicketBought, TicketUsed. No constructor args." }
    , { label: "ScoreBoard", text: "EMPTY CONSTRUCTOR. updateScore(address player,uint256 score). getScore(address). Events: ScoreUpdated. No constructor args." }
    , { label: "WishList", text: "EMPTY CONSTRUCTOR. addWish(string item). removeWish(uint256 id). Events: WishAdded, WishRemoved. No constructor args." }
    , { label: "GuestBook", text: "EMPTY CONSTRUCTOR. sign(string name,string message). Events: Signed. No constructor args." }
    , { label: "Library", text: "EMPTY CONSTRUCTOR. addBook(string title). borrowBook(uint256 id). returnBook(uint256 id). Events: BookAdded, Borrowed, Returned. No constructor args." }
    , { label: "Attendance", text: "EMPTY CONSTRUCTOR. checkIn(address user). checkOut(address user). Events: CheckedIn, CheckedOut. No constructor args." }
    , { label: "Leaderboard", text: "EMPTY CONSTRUCTOR. addPlayer(address player,uint256 score). updatePlayer(address player,uint256 score). Events: PlayerAdded, PlayerUpdated. No constructor args." }
    , { label: "Bookmark", text: "EMPTY CONSTRUCTOR. add(string url). remove(uint256 id). Events: BookmarkAdded, BookmarkRemoved. No constructor args." }
    , { label: "Calendar", text: "EMPTY CONSTRUCTOR. addEvent(string name,uint256 timestamp). removeEvent(uint256 id). Events: EventAdded, EventRemoved. No constructor args." }
    , { label: "Recipe", text: "EMPTY CONSTRUCTOR. add(string name,string ingredients). rate(uint256 id,uint8 rating). Events: RecipeAdded, Rated. No constructor args." }
    , { label: "ContactBook", text: "EMPTY CONSTRUCTOR. addContact(string name,string info). updateContact(uint256 id,string info). Events: ContactAdded, ContactUpdated. No constructor args." }
    , { label: "ChatRoom", text: "EMPTY CONSTRUCTOR. sendMessage(string message). Events: MessageSent. No constructor args." }
    , { label: "NewsBoard", text: "EMPTY CONSTRUCTOR. publishNews(string headline,string content). Events: NewsPublished. No constructor args." }
    , { label: "FeedbackBox", text: "EMPTY CONSTRUCTOR. submit(string feedback,uint8 rating). Events: FeedbackSubmitted. No constructor args." }
    , { label: "Complaint", text: "EMPTY CONSTRUCTOR. file(string issue). resolve(uint256 id). Events: ComplaintFiled, ComplaintResolved. No constructor args." }
    , { label: "Suggestion", text: "EMPTY CONSTRUCTOR. submit(string suggestion). approve(uint256 id). reject(uint256 id). Events: Submitted, Approved, Rejected. No constructor args." }
    , { label: "SkillTracker", text: "EMPTY CONSTRUCTOR. addSkill(address user,string skill). levelUp(address user,string skill). Events: SkillAdded, LeveledUp. No constructor args." }
    , { label: "Achievement", text: "EMPTY CONSTRUCTOR. unlock(address user,string badge). Events: Unlocked. No constructor args." }
    , { label: "Milestone", text: "EMPTY CONSTRUCTOR. set(string title,uint256 target). complete(uint256 id). Events: MilestoneSet, MilestoneCompleted. No constructor args." }
    , { label: "Progress", text: "EMPTY CONSTRUCTOR. update(address user,uint256 percentage). Events: ProgressUpdated. No constructor args." }
    , { label: "Certificate", text: "EMPTY CONSTRUCTOR. issue(address recipient,string course). verify(uint256 id). Events: CertificateIssued. No constructor args." }
    , { label: "Diploma", text: "EMPTY CONSTRUCTOR. grant(address student,string degree). Events: DiplomaGranted. No constructor args." }

    // --- Batch 2: Education, HR, Finance, Access Control, Moderation ---
    , { label: "Grade", text: "EMPTY CONSTRUCTOR. assign(address student,string subject,uint8 grade). Events: GradeAssigned. No constructor args." }
    , { label: "Course", text: "EMPTY CONSTRUCTOR. enroll(address student). complete(address student). Events: Enrolled, Completed. No constructor args." }
    , { label: "Lesson", text: "EMPTY CONSTRUCTOR. create(string title,string content). mark(uint256 id). Events: LessonCreated, LessonMarked. No constructor args." }
    , { label: "Quiz", text: "EMPTY CONSTRUCTOR. create(string question,string answer). submit(uint256 id,string response). Events: QuizCreated, Submitted. No constructor args." }
    , { label: "Exam", text: "EMPTY CONSTRUCTOR. schedule(string subject,uint256 timestamp). take(uint256 id). Events: ExamScheduled, ExamTaken. No constructor args." }
    , { label: "Project", text: "EMPTY CONSTRUCTOR. create(string name,string description). submit(uint256 id). Events: ProjectCreated, ProjectSubmitted. No constructor args." }
    , { label: "Portfolio", text: "EMPTY CONSTRUCTOR. addWork(string title,string url). rate(uint256 id,uint8 rating). Events: WorkAdded, WorkRated. No constructor args." }
    , { label: "Resume", text: "EMPTY CONSTRUCTOR. addExperience(string company,string role). addSkill(string skill). Events: ExperienceAdded, SkillAdded. No constructor args." }
    , { label: "Interview", text: "EMPTY CONSTRUCTOR. schedule(address candidate,uint256 timestamp). complete(uint256 id,bool passed). Events: InterviewScheduled, InterviewCompleted. No constructor args." }
    , { label: "Application", text: "EMPTY CONSTRUCTOR. submit(string position,string coverLetter). review(uint256 id,bool approved). Events: ApplicationSubmitted, ApplicationReviewed. No constructor args." }
    , { label: "Payroll", text: "EMPTY CONSTRUCTOR. addEmployee(address employee,uint256 salary). paySalary(address employee). Events: EmployeeAdded, SalaryPaid. No constructor args." }
    , { label: "TimeSheet", text: "EMPTY CONSTRUCTOR. clockIn(address employee). clockOut(address employee). Events: ClockedIn, ClockedOut. No constructor args." }
    , { label: "Expense", text: "EMPTY CONSTRUCTOR. submit(string category,uint256 amount). approve(uint256 id). Events: ExpenseSubmitted, ExpenseApproved. No constructor args." }
    , { label: "Invoice", text: "EMPTY CONSTRUCTOR. create(address client,uint256 amount). pay(uint256 id) payable. Events: InvoiceCreated, InvoicePaid. No constructor args." }
    , { label: "Receipt", text: "EMPTY CONSTRUCTOR. generate(address customer,uint256 amount). Events: ReceiptGenerated. No constructor args." }
    , { label: "Transaction", text: "EMPTY CONSTRUCTOR. record(address from,address to,uint256 amount). Events: TransactionRecorded. No constructor args." }
    , { label: "Ledger", text: "EMPTY CONSTRUCTOR. addEntry(string description,uint256 amount,bool credit). Events: EntryAdded. No constructor args." }
    , { label: "Budget", text: "EMPTY CONSTRUCTOR. set(string category,uint256 limit). spend(string category,uint256 amount). Events: BudgetSet, BudgetSpent. No constructor args." }
    , { label: "Savings", text: "EMPTY CONSTRUCTOR. deposit() payable. withdraw(uint256 amount). Events: SavedDeposit, SavedWithdraw. No constructor args." }
    , { label: "Loan", text: "EMPTY CONSTRUCTOR. request(uint256 amount). approve(uint256 id). repay(uint256 id) payable. Events: LoanRequested, LoanApproved, LoanRepaid. No constructor args." }
    , { label: "Insurance", text: "EMPTY CONSTRUCTOR. buyPolicy() payable. claim(uint256 policyId,string reason). Events: PolicyBought, ClaimFiled. No constructor args." }
    , { label: "Warranty", text: "EMPTY CONSTRUCTOR. register(address owner,string product). claim(uint256 id). Events: WarrantyRegistered, WarrantyClaimed. No constructor args." }
    , { label: "Subscription", text: "EMPTY CONSTRUCTOR. subscribe() payable. renew() payable. cancel(). Events: Subscribed, Renewed, Canceled. No constructor args." }
    , { label: "Membership2", text: "EMPTY CONSTRUCTOR. signup() payable. upgrade(). downgrade(). Events: SignedUp, Upgraded, Downgraded. No constructor args." }
    , { label: "License", text: "EMPTY CONSTRUCTOR. issue(address holder,string type). renew(uint256 id). Events: LicenseIssued, LicenseRenewed. No constructor args." }
    , { label: "Approval", text: "EMPTY CONSTRUCTOR. request(string item). approve(uint256 id). deny(uint256 id). Events: ApprovalRequested, Approved, Denied. No constructor args." }
    , { label: "Authorization", text: "EMPTY CONSTRUCTOR. grant(address user,string permission). revoke(address user,string permission). Events: Authorized, Revoked. No constructor args." }
    , { label: "Permission", text: "EMPTY CONSTRUCTOR. assign(address user,uint8 level). check(address user). Events: PermissionAssigned. No constructor args." }
    , { label: "Role", text: "EMPTY CONSTRUCTOR. assign(address user,string role). remove(address user,string role). Events: RoleAssigned, RoleRemoved. No constructor args." }
    , { label: "Admin", text: "EMPTY CONSTRUCTOR. promote(address user). demote(address user). Events: Promoted, Demoted. No constructor args." }
    , { label: "Moderator", text: "EMPTY CONSTRUCTOR. assign(address user). suspend(address user). Events: ModeratorAssigned, UserSuspended. No constructor args." }
    , { label: "Ban", text: "EMPTY CONSTRUCTOR. banUser(address user,string reason). unbanUser(address user). Events: UserBanned, UserUnbanned. No constructor args." }
    , { label: "Mute", text: "EMPTY CONSTRUCTOR. muteUser(address user,uint256 duration). unmuteUser(address user). Events: UserMuted, UserUnmuted. No constructor args." }
    , { label: "Warning", text: "EMPTY CONSTRUCTOR. warn(address user,string reason). clearWarnings(address user). Events: WarningIssued, WarningsCleared. No constructor args." }
    , { label: "Penalty", text: "EMPTY CONSTRUCTOR. impose(address user,uint256 amount). pay(uint256 id) payable. Events: PenaltyImposed, PenaltyPaid. No constructor args." }
    , { label: "Fine", text: "EMPTY CONSTRUCTOR. issue(address user,uint256 amount,string reason). pay(uint256 id) payable. Events: FineIssued, FinePaid. No constructor args." }
    , { label: "Violation", text: "EMPTY CONSTRUCTOR. report(address user,string violation). resolve(uint256 id). Events: ViolationReported, ViolationResolved. No constructor args." }
    , { label: "Dispute", text: "EMPTY CONSTRUCTOR. file(address against,string reason). mediate(uint256 id). Events: DisputeFiled, DisputeMediated. No constructor args." }
    , { label: "Appeal", text: "EMPTY CONSTRUCTOR. file(uint256 caseId,string reason). review(uint256 id). Events: AppealFiled, AppealReviewed. No constructor args." }
    , { label: "Case", text: "EMPTY CONSTRUCTOR. open(string description). close(uint256 id,string resolution). Events: CaseOpened, CaseClosed. No constructor args." }
    , { label: "Ticket2", text: "EMPTY CONSTRUCTOR. create(string issue,uint8 priority). assign(uint256 id,address agent). resolve(uint256 id). Events: TicketCreated, TicketAssigned, TicketResolved. No constructor args." }
    , { label: "Support", text: "EMPTY CONSTRUCTOR. requestHelp(string issue). provideHelp(uint256 id,string solution). Events: HelpRequested, HelpProvided. No constructor args." }
    , { label: "Help", text: "EMPTY CONSTRUCTOR. ask(string question). answer(uint256 id,string response). Events: QuestionAsked, QuestionAnswered. No constructor args." }
    , { label: "FAQ", text: "EMPTY CONSTRUCTOR. add(string question,string answer). update(uint256 id,string answer). Events: FAQAdded, FAQUpdated. No constructor args." }
    , { label: "Guide", text: "EMPTY CONSTRUCTOR. create(string title,string content). rate(uint256 id,uint8 rating). Events: GuideCreated, GuideRated. No constructor args." }
    , { label: "Tutorial", text: "EMPTY CONSTRUCTOR. publish(string title,string steps). complete(uint256 id). Events: TutorialPublished, TutorialCompleted. No constructor args." }
    , { label: "Manual", text: "EMPTY CONSTRUCTOR. upload(string title,string content). download(uint256 id). Events: ManualUploaded, ManualDownloaded. No constructor args." }
    , { label: "Documentation", text: "EMPTY CONSTRUCTOR. add(string section,string content). update(uint256 id,string content). Events: DocumentationAdded, DocumentationUpdated. No constructor args." }
    , { label: "Wiki", text: "EMPTY CONSTRUCTOR. createPage(string title,string content). editPage(uint256 id,string content). Events: PageCreated, PageEdited. No constructor args." }
    , { label: "Article", text: "EMPTY CONSTRUCTOR. publish(string title,string content). like(uint256 id). Events: ArticlePublished, ArticleLiked. No constructor args." }
    , { label: "Testimonial", text: "EMPTY CONSTRUCTOR. submit(string text,string author). feature(uint256 id). Events: TestimonialSubmitted, TestimonialFeatured. No constructor args." }
    , { label: "Endorsement", text: "EMPTY CONSTRUCTOR. give(address user,string skill). verify(uint256 id). Events: EndorsementGiven, EndorsementVerified. No constructor args." }
    , { label: "Recommendation", text: "EMPTY CONSTRUCTOR. write(address user,string text). approve(uint256 id). Events: RecommendationWritten, RecommendationApproved. No constructor args." }
    , { label: "Reference", text: "EMPTY CONSTRUCTOR. add(address user,string contact). verify(uint256 id). Events: ReferenceAdded, ReferenceVerified. No constructor args." }

    // --- Batch 3: Social graph, feed, and interactions ---
    , { label: "Network", text: "EMPTY CONSTRUCTOR. connect(address user1,address user2). disconnect(address user1,address user2). Events: Connected, Disconnected. No constructor args." }
    , { label: "Friend", text: "EMPTY CONSTRUCTOR. sendRequest(address to). acceptRequest(uint256 id). rejectRequest(uint256 id). Events: RequestSent, RequestAccepted, RequestRejected. No constructor args." }
    , { label: "Follow", text: "EMPTY CONSTRUCTOR. follow(address user). unfollow(address user). Events: Followed, Unfollowed. No constructor args." }
    , { label: "Block", text: "EMPTY CONSTRUCTOR. blockUser(address user). unblockUser(address user). Events: UserBlocked, UserUnblocked. No constructor args." }
    , { label: "Report", text: "EMPTY CONSTRUCTOR. file(address user,string reason). investigate(uint256 id). Events: ReportFiled, ReportInvestigated. No constructor args." }
    , { label: "Flag", text: "EMPTY CONSTRUCTOR. flag(address content,string reason). review(uint256 id). Events: ContentFlagged, FlagReviewed. No constructor args." }
    , { label: "Moderation", text: "EMPTY CONSTRUCTOR. review(address content). approve(address content). reject(address content). Events: ContentReviewed, ContentApproved, ContentRejected. No constructor args." }
    , { label: "Post", text: "EMPTY CONSTRUCTOR. create(string text). like(uint256 id). share(uint256 id). Events: PostCreated, PostLiked, PostShared. No constructor args." }
    , { label: "Comment", text: "EMPTY CONSTRUCTOR. add(uint256 postId,string text). reply(uint256 commentId,string text). Events: CommentAdded, CommentReplied. No constructor args." }
    , { label: "Like", text: "EMPTY CONSTRUCTOR. addLike(uint256 contentId). removeLike(uint256 contentId). Events: LikeAdded, LikeRemoved. No constructor args." }
    , { label: "Share", text: "EMPTY CONSTRUCTOR. shareContent(uint256 contentId). Events: ContentShared. No constructor args." }
    , { label: "Bookmark2", text: "EMPTY CONSTRUCTOR. save(uint256 contentId). unsave(uint256 contentId). Events: ContentSaved, ContentUnsaved. No constructor args." }
    , { label: "Favorite", text: "EMPTY CONSTRUCTOR. add(uint256 itemId). remove(uint256 itemId). Events: FavoriteAdded, FavoriteRemoved. No constructor args." }

    // --- Batch 4: Media and content ---
    , { label: "Playlist", text: "EMPTY CONSTRUCTOR. create(string name). addSong(uint256 playlistId,uint256 songId). removeSong(uint256 playlistId,uint256 songId). Events: PlaylistCreated, SongAdded, SongRemoved. No constructor args." }
    , { label: "Music", text: "EMPTY CONSTRUCTOR. upload(string title,string artist). play(uint256 id). Events: MusicUploaded, MusicPlayed. No constructor args." }
    , { label: "Video", text: "EMPTY CONSTRUCTOR. upload(string title,string url). watch(uint256 id). Events: VideoUploaded, VideoWatched. No constructor args." }
    , { label: "Album", text: "EMPTY CONSTRUCTOR. create(string title). addPhoto(uint256 albumId,uint256 photoId). Events: AlbumCreated, PhotoAddedToAlbum. No constructor args." }
    , { label: "Gallery", text: "EMPTY CONSTRUCTOR. create(string name). display(uint256 galleryId,uint256 artId). Events: GalleryCreated, ArtDisplayed. No constructor args." }
    , { label: "Collectible", text: "EMPTY CONSTRUCTOR. ERC721 NAME='Collectible' SYMBOL='COLL'. mint(address to,string uri). trade(uint256 id,address to). Events: CollectibleMinted, CollectibleTraded. No constructor args." }

    // --- Batch 5: Commerce and marketplace ---
    , { label: "Trading", text: "EMPTY CONSTRUCTOR. list(uint256 tokenId,uint256 price). buy(uint256 listingId) payable. cancel(uint256 listingId). Events: ItemListed, ItemBought, ListingCanceled. No constructor args." }
    , { label: "Marketplace", text: "EMPTY CONSTRUCTOR. createListing(string item,uint256 price). purchase(uint256 id) payable. Events: ListingCreated, ItemPurchased. No constructor args." }
    , { label: "Store", text: "EMPTY CONSTRUCTOR. addProduct(string name,uint256 price). buyProduct(uint256 id) payable. Events: ProductAdded, ProductBought. No constructor args." }
    , { label: "Shop", text: "EMPTY CONSTRUCTOR. stock(string item,uint256 quantity). sell(uint256 id,uint256 qty) payable. Events: ItemStocked, ItemSold. No constructor args." }
    , { label: "Cart", text: "EMPTY CONSTRUCTOR. addItem(uint256 productId,uint256 qty). removeItem(uint256 productId). checkout() payable. Events: ItemAdded, ItemRemoved, CheckedOut. No constructor args." }
    , { label: "Order", text: "EMPTY CONSTRUCTOR. place(string items,uint256 total) payable. ship(uint256 id). deliver(uint256 id). Events: OrderPlaced, OrderShipped, OrderDelivered. No constructor args." }
    , { label: "Shipping", text: "EMPTY CONSTRUCTOR. schedule(uint256 orderId,string address). track(uint256 shipmentId). Events: ShipmentScheduled, ShipmentTracked. No constructor args." }
    , { label: "Delivery", text: "EMPTY CONSTRUCTOR. assign(uint256 orderId,address driver). complete(uint256 deliveryId). Events: DeliveryAssigned, DeliveryCompleted. No constructor args." }
    , { label: "Tracking", text: "EMPTY CONSTRUCTOR. update(uint256 shipmentId,string status). Events: StatusUpdated. No constructor args." }
    , { label: "Return", text: "EMPTY CONSTRUCTOR. request(uint256 orderId,string reason). approve(uint256 id). process(uint256 id). Events: ReturnRequested, ReturnApproved, ReturnProcessed. No constructor args." }
    , { label: "Refund", text: "EMPTY CONSTRUCTOR. request(uint256 orderId,uint256 amount). approve(uint256 id). process(uint256 id). Events: RefundRequested, RefundApproved, RefundProcessed. No constructor args." }
    , { label: "Exchange", text: "EMPTY CONSTRUCTOR. request(uint256 oldItem,uint256 newItem). approve(uint256 id). Events: ExchangeRequested, ExchangeApproved. No constructor args." }
    , { label: "Coupon", text: "EMPTY CONSTRUCTOR. create(string code,uint256 discount). redeem(string code). Events: CouponCreated, CouponRedeemed. No constructor args." }
    , { label: "Promotion", text: "EMPTY CONSTRUCTOR. launch(string name,uint256 discount). end(uint256 id). Events: PromotionLaunched, PromotionEnded. No constructor args." }
    , { label: "Sale", text: "EMPTY CONSTRUCTOR. start(uint256 productId,uint256 newPrice). end(uint256 saleId). Events: SaleStarted, SaleEnded. No constructor args." }

    // --- Batch 6: Auctions, raffles, challenges, games (part 1) ---
    , { label: "Bidding", text: "EMPTY CONSTRUCTOR. placeBid(uint256 auctionId,uint256 amount) payable. withdrawBid(uint256 bidId). Events: BidPlaced, BidWithdrawn. No constructor args." }
    , { label: "Raffle", text: "EMPTY CONSTRUCTOR. enterRaffle() payable. drawWinner(). Events: RaffleEntered, WinnerDrawn. No constructor args." }
    , { label: "Prize", text: "EMPTY CONSTRUCTOR. create(string name,uint256 value). award(uint256 id,address winner). claim(uint256 id). Events: PrizeCreated, PrizeAwarded, PrizeClaimed. No constructor args." }
    , { label: "Contest", text: "EMPTY CONSTRUCTOR. start(string name,uint256 prize). enter(). judge(address winner). Events: ContestStarted, ContestEntered, WinnerJudged. No constructor args." }
    , { label: "Competition", text: "EMPTY CONSTRUCTOR. register() payable. compete(). score(address participant,uint256 points). Events: Registered, Competed, Scored. No constructor args." }
    , { label: "Tournament", text: "EMPTY CONSTRUCTOR. join() payable. advance(address player). eliminate(address player). Events: PlayerJoined, PlayerAdvanced, PlayerEliminated. No constructor args." }
    , { label: "Match", text: "EMPTY CONSTRUCTOR. schedule(address player1,address player2). result(uint256 id,address winner). Events: MatchScheduled, MatchResulted. No constructor args." }
    , { label: "Game", text: "EMPTY CONSTRUCTOR. start(). play(address player,uint8 move). end(address winner). Events: GameStarted, MovePlayed, GameEnded. No constructor args." }
    , { label: "Puzzle", text: "EMPTY CONSTRUCTOR. create(string question,string solution). solve(uint256 id,string answer). Events: PuzzleCreated, PuzzleSolved. No constructor args." }
    , { label: "Challenge", text: "EMPTY CONSTRUCTOR. issue(string task). accept(address participant). complete(uint256 id). Events: ChallengeIssued, ChallengeAccepted, ChallengeCompleted. No constructor args." }
    , { label: "Quest", text: "EMPTY CONSTRUCTOR. begin(string objective). progress(uint256 id,uint8 stage). complete(uint256 id). Events: QuestBegan, QuestProgressed, QuestCompleted. No constructor args." }
    , { label: "Mission", text: "EMPTY CONSTRUCTOR. assign(address agent,string objective). report(uint256 id,string status). Events: MissionAssigned, MissionReported. No constructor args." }

    // --- Travel & Hospitality ---
    , { label: "Adventure", text: "EMPTY CONSTRUCTOR. embark(string destination). explore(uint256 id). discover(uint256 id,string item). Events: AdventureEmbarked, LocationExplored, ItemDiscovered. No constructor args." }
    , { label: "Journey", text: "EMPTY CONSTRUCTOR. plan(string route). travel(uint256 id). arrive(uint256 id). Events: JourneyPlanned, TravelStarted, DestinationArrived. No constructor args." }
    , { label: "Trip", text: "EMPTY CONSTRUCTOR. book(string destination,uint256 cost) payable. cancel(uint256 id). Events: TripBooked, TripCanceled. No constructor args." }
    , { label: "Hotel", text: "EMPTY CONSTRUCTOR. checkIn(address guest). checkOut(address guest). Events: GuestCheckedIn, GuestCheckedOut. No constructor args." }
    , { label: "Room", text: "EMPTY CONSTRUCTOR. book(uint256 roomNumber,address guest) payable. clean(uint256 roomNumber). Events: RoomBooked, RoomCleaned. No constructor args." }
    , { label: "Reservation", text: "EMPTY CONSTRUCTOR. make(string service,uint256 timestamp) payable. confirm(uint256 id). cancel(uint256 id). Events: ReservationMade, ReservationConfirmed, ReservationCanceled. No constructor args." }
    , { label: "Booking", text: "EMPTY CONSTRUCTOR. create(string service,address customer) payable. modify(uint256 id,uint256 newTime). Events: BookingCreated, BookingModified. No constructor args." }
    , { label: "Appointment", text: "EMPTY CONSTRUCTOR. schedule(address client,uint256 timestamp). reschedule(uint256 id,uint256 newTime). Events: AppointmentScheduled, AppointmentRescheduled. No constructor args." }
    , { label: "Meeting", text: "EMPTY CONSTRUCTOR. arrange(string topic,uint256 timestamp). attend(uint256 id). Events: MeetingArranged, MeetingAttended. No constructor args." }
    , { label: "Conference", text: "EMPTY CONSTRUCTOR. organize(string title,uint256 date). register(uint256 id) payable. Events: ConferenceOrganized, ParticipantRegistered. No constructor args." }
    , { label: "Event2", text: "EMPTY CONSTRUCTOR. create(string name,uint256 timestamp). attend(uint256 id). cancel(uint256 id). Events: EventCreated, EventAttended, EventCanceled. No constructor args." }
    , { label: "Party", text: "EMPTY CONSTRUCTOR. plan(string theme,uint256 date). invite(uint256 id,address guest). rsvp(uint256 id,bool attending). Events: PartyPlanned, GuestInvited, RSVPReceived. No constructor args." }
    , { label: "Wedding", text: "EMPTY CONSTRUCTOR. plan(address bride,address groom,uint256 date). invite(address guest). attend(uint256 id). Events: WeddingPlanned, GuestInvited, WeddingAttended. No constructor args." }
    , { label: "Birthday", text: "EMPTY CONSTRUCTOR. celebrate(address person,uint8 age). gift(address person,string item). Events: BirthdayCelebrated, GiftGiven. No constructor args." }
    , { label: "Holiday", text: "EMPTY CONSTRUCTOR. declare(string name,uint256 date). celebrate(uint256 id). Events: HolidayDeclared, HolidayCelebrated. No constructor args." }
    , { label: "Festival", text: "EMPTY CONSTRUCTOR. organize(string name,uint256 startDate). participate(uint256 id). Events: FestivalOrganized, ParticipantJoined. No constructor args." }
    , { label: "Concert", text: "EMPTY CONSTRUCTOR. schedule(string artist,uint256 date). buyTicket(uint256 id) payable. attend(uint256 ticketId). Events: ConcertScheduled, TicketBought, ConcertAttended. No constructor args." }
    , { label: "Show", text: "EMPTY CONSTRUCTOR. create(string title,uint256 showTime). watch(uint256 id). rate(uint256 id,uint8 rating). Events: ShowCreated, ShowWatched, ShowRated. No constructor args." }
    , { label: "Cinema", text: "EMPTY CONSTRUCTOR. schedule(uint256 movieId,uint256 showTime). bookTicket(uint256 showId) payable. Events: MovieScheduled, MovieTicketBooked. No constructor args." }

    // --- Sports ---
    , { label: "Sports", text: "EMPTY CONSTRUCTOR. createTeam(string name). joinTeam(uint256 teamId). playMatch(uint256 team1,uint256 team2). Events: TeamCreated, PlayerJoined, MatchPlayed. No constructor args." }
    , { label: "Player", text: "EMPTY CONSTRUCTOR. register(string name,string sport). updateStats(address player,uint256 points). Events: PlayerRegistered, StatsUpdated. No constructor args." }
    , { label: "Coach", text: "EMPTY CONSTRUCTOR. hire(address coach,uint256 teamId). train(uint256 teamId). Events: CoachHired, TeamTrained. No constructor args." }
    , { label: "Stadium", text: "EMPTY CONSTRUCTOR. book(uint256 date,string event) payable. host(uint256 bookingId). Events: StadiumBooked, EventHosted. No constructor args." }
    , { label: "Gym", text: "EMPTY CONSTRUCTOR. register() payable. checkIn(). workout(string exercise). Events: MemberRegistered, MemberCheckedIn, WorkoutLogged. No constructor args." }
    , { label: "Fitness", text: "EMPTY CONSTRUCTOR. setGoal(string goal,uint256 target). trackProgress(string goal,uint256 current). Events: GoalSet, ProgressTracked. No constructor args." }

    // --- Health & Wellness ---
    , { label: "Health", text: "EMPTY CONSTRUCTOR. recordVitals(uint8 heartRate,uint8 bloodPressure). checkup(address doctor). Events: VitalsRecorded, CheckupCompleted. No constructor args." }
    , { label: "Medical", text: "EMPTY CONSTRUCTOR. diagnose(address patient,string condition). prescribe(address patient,string medicine). Events: PatientDiagnosed, MedicinePrescribed. No constructor args." }
    , { label: "Doctor", text: "EMPTY CONSTRUCTOR. register(address doctor,string specialty). bookAppointment(address doctor,uint256 timestamp) payable. Events: DoctorRegistered, AppointmentBooked. No constructor args." }
    , { label: "Patient", text: "EMPTY CONSTRUCTOR. register(string name,uint8 age). visit(address doctor). Events: PatientRegistered, DoctorVisited. No constructor args." }
    , { label: "Hospital", text: "EMPTY CONSTRUCTOR. admit(address patient). discharge(address patient). Events: PatientAdmitted, PatientDischarged. No constructor args." }
    , { label: "Pharmacy", text: "EMPTY CONSTRUCTOR. stock(string medicine,uint256 quantity). dispense(string medicine,address patient). Events: MedicineStocked, MedicineDispensed. No constructor args." }
    , { label: "Prescription", text: "EMPTY CONSTRUCTOR. write(address patient,string medicine,uint8 dosage). fill(uint256 id). Events: PrescriptionWritten, PrescriptionFilled. No constructor args." }
    , { label: "Treatment", text: "EMPTY CONSTRUCTOR. begin(address patient,string therapy). complete(uint256 id). Events: TreatmentBegan, TreatmentCompleted. No constructor args." }
    , { label: "Surgery", text: "EMPTY CONSTRUCTOR. schedule(address patient,string procedure,uint256 date). perform(uint256 id). Events: SurgeryScheduled, SurgeryPerformed. No constructor args." }
    , { label: "Recovery", text: "EMPTY CONSTRUCTOR. begin(address patient). progress(address patient,uint8 percentage). complete(address patient). Events: RecoveryBegan, RecoveryProgressed, RecoveryCompleted. No constructor args." }
    , { label: "Therapy", text: "EMPTY CONSTRUCTOR. start(address patient,string type). session(address patient). Events: TherapyStarted, SessionCompleted. No constructor args." }
    , { label: "Rehabilitation", text: "EMPTY CONSTRUCTOR. enroll(address patient). exercise(address patient,string activity). Events: PatientEnrolled, ExerciseCompleted. No constructor args." }
    , { label: "Wellness", text: "EMPTY CONSTRUCTOR. assess(address person). recommend(address person,string activity). Events: WellnessAssessed, ActivityRecommended. No constructor args." }
    , { label: "Nutrition", text: "EMPTY CONSTRUCTOR. plan(address person,string diet). track(address person,string food). Events: NutritionPlanned, FoodTracked. No constructor args." }
    , { label: "Diet", text: "EMPTY CONSTRUCTOR. create(string name,string guidelines). follow(address person,uint256 dietId). Events: DietCreated, DietFollowed. No constructor args." }
    , { label: "Exercise", text: "EMPTY CONSTRUCTOR. log(string activity,uint256 duration). complete(address person,string workout). Events: ExerciseLogged, WorkoutCompleted. No constructor args." }
    , { label: "Meditation", text: "EMPTY CONSTRUCTOR. start(uint256 duration). complete(address person). track(address person,uint256 totalMinutes). Events: MeditationStarted, MeditationCompleted, ProgressTracked. No constructor args." }
    , { label: "Mood", text: "EMPTY CONSTRUCTOR. record(address person,uint8 mood). analyze(address person). Events: MoodRecorded, MoodAnalyzed. No constructor args." }
    , { label: "Journal", text: "EMPTY CONSTRUCTOR. write(string entry). reflect(uint256 id). Events: EntryWritten, EntryReflected. No constructor args." }
    , { label: "Diary", text: "EMPTY CONSTRUCTOR. addEntry(string date,string content). lock(uint256 id). unlock(uint256 id). Events: DiaryEntryAdded, DiaryLocked, DiaryUnlocked. No constructor args." }
    , { label: "Memory", text: "EMPTY CONSTRUCTOR. store(string title,string content). recall(uint256 id). share(uint256 id,address person). Events: MemoryStored, MemoryRecalled, MemoryShared. No constructor args." }

    // --- Writing, Language, Communication, Philosophy, Education ---
    , { label: "Story", text: "EMPTY CONSTRUCTOR. write(string title,string content). publish(uint256 id). read(uint256 id). Events: StoryWritten, StoryPublished, StoryRead. No constructor args." }
    , { label: "Book2", text: "EMPTY CONSTRUCTOR. publish(string title,string author). read(uint256 id). bookmark(uint256 id,uint256 page). Events: BookPublished, BookRead, BookBookmarked. No constructor args." }
    , { label: "Library2", text: "EMPTY CONSTRUCTOR. add(uint256 bookId). borrow(uint256 bookId). return(uint256 borrowId). Events: BookAddedToLibrary, BookBorrowed, BookReturned. No constructor args." }
    , { label: "Author", text: "EMPTY CONSTRUCTOR. register(string name,string bio). publish(string title). Events: AuthorRegistered, WorkPublished. No constructor args." }
    , { label: "Editor", text: "EMPTY CONSTRUCTOR. review(uint256 manuscriptId). edit(uint256 id,string changes). approve(uint256 id). Events: ManuscriptReviewed, ManuscriptEdited, ManuscriptApproved. No constructor args." }
    , { label: "Manuscript", text: "EMPTY CONSTRUCTOR. submit(string title,string content). revise(uint256 id,string newContent). Events: ManuscriptSubmitted, ManuscriptRevised. No constructor args." }
    , { label: "Chapter", text: "EMPTY CONSTRUCTOR. write(uint256 bookId,string title,string content). edit(uint256 id,string content). Events: ChapterWritten, ChapterEdited. No constructor args." }
    , { label: "Page", text: "EMPTY CONSTRUCTOR. create(uint256 chapterId,string content). update(uint256 id,string content). Events: PageCreated, PageUpdated. No constructor args." }
    , { label: "Paragraph", text: "EMPTY CONSTRUCTOR. compose(uint256 pageId,string text). revise(uint256 id,string newText). Events: ParagraphComposed, ParagraphRevised. No constructor args." }
    , { label: "Sentence", text: "EMPTY CONSTRUCTOR. add(uint256 paragraphId,string text). modify(uint256 id,string newText). Events: SentenceAdded, SentenceModified. No constructor args." }
    , { label: "Dictionary", text: "EMPTY CONSTRUCTOR. addWord(string word,string definition). search(string word). Events: WordAdded, WordSearched. No constructor args." }
    , { label: "Vocabulary", text: "EMPTY CONSTRUCTOR. learn(address student,string word). test(address student). Events: WordLearned, VocabularyTested. No constructor args." }
    , { label: "Language", text: "EMPTY CONSTRUCTOR. create(string name,string code). translate(uint256 langId,string text). Events: LanguageCreated, TextTranslated. No constructor args." }
    , { label: "Translation", text: "EMPTY CONSTRUCTOR. request(string text,string fromLang,string toLang). complete(uint256 id,string result). Events: TranslationRequested, TranslationCompleted. No constructor args." }
    , { label: "Interpreter", text: "EMPTY CONSTRUCTOR. hire(address interpreter,string language). interpret(uint256 sessionId). Events: InterpreterHired, InterpretationCompleted. No constructor args." }
    , { label: "Communication", text: "EMPTY CONSTRUCTOR. send(address to,string message). receive(uint256 id). reply(uint256 id,string response). Events: MessageSent, MessageReceived, MessageReplied. No constructor args." }
    , { label: "Conversation", text: "EMPTY CONSTRUCTOR. start(address participant1,address participant2). speak(uint256 id,string message). end(uint256 id). Events: ConversationStarted, MessageSpoken, ConversationEnded. No constructor args." }
    , { label: "Discussion", text: "EMPTY CONSTRUCTOR. initiate(string subject). participate(uint256 id,string comment). close(uint256 id). Events: DiscussionInitiated, CommentAdded, DiscussionClosed. No constructor args." }
    , { label: "Debate", text: "EMPTY CONSTRUCTOR. propose(string motion). argue(uint256 id,bool position,string argument). vote(uint256 id,bool support). Events: MotionProposed, ArgumentMade, VoteCast. No constructor args." }
    , { label: "Evidence", text: "EMPTY CONSTRUCTOR. submit(string type,string data). verify(uint256 id). challenge(uint256 id). Events: EvidenceSubmitted, EvidenceVerified, EvidenceChallenged. No constructor args." }
    , { label: "Proof", text: "EMPTY CONSTRUCTOR. provide(string claim,string evidence). validate(uint256 id). Events: ProofProvided, ProofValidated. No constructor args." }
    , { label: "Logic", text: "EMPTY CONSTRUCTOR. premise(string statement). conclude(uint256 premiseId,string conclusion). Events: PremiseStated, ConclusionDrawn. No constructor args." }
    , { label: "Reason", text: "EMPTY CONSTRUCTOR. state(string reasoning). support(uint256 id,string evidence). Events: ReasonStated, ReasonSupported. No constructor args." }
    , { label: "Philosophy", text: "EMPTY CONSTRUCTOR. ponder(string question). theorize(uint256 id,string theory). Events: QuestionPondered, TheoryProposed. No constructor args." }
    , { label: "Knowledge", text: "EMPTY CONSTRUCTOR. acquire(string subject,string information). test(address person,string subject). Events: KnowledgeAcquired, KnowledgeTested. No constructor args." }
    , { label: "Learning", text: "EMPTY CONSTRUCTOR. begin(string subject). study(string topic). master(string skill). Events: LearningBegan, TopicStudied, SkillMastered. No constructor args." }
    , { label: "Education", text: "EMPTY CONSTRUCTOR. enroll(address student,string program). graduate(address student). Events: StudentEnrolled, StudentGraduated. No constructor args." }
    , { label: "School", text: "EMPTY CONSTRUCTOR. admit(address student). teach(address student,string subject). Events: StudentAdmitted, SubjectTaught. No constructor args." }
    , { label: "College", text: "EMPTY CONSTRUCTOR. register(address student). attend(address student,string class). Events: StudentRegistered, ClassAttended. No constructor args." }
    , { label: "Campus", text: "EMPTY CONSTRUCTOR. build(string facility). maintain(uint256 facilityId). Events: FacilityBuilt, FacilityMaintained. No constructor args." }
    , { label: "Classroom", text: "EMPTY CONSTRUCTOR. setup(uint8 capacity). occupy(address teacher,address[] students). Events: ClassroomSetup, ClassroomOccupied. No constructor args." }
    , { label: "Teacher", text: "EMPTY CONSTRUCTOR. hire(address teacher,string subject). evaluate(address teacher). Events: TeacherHired, TeacherEvaluated. No constructor args." }
    , { label: "Student", text: "EMPTY CONSTRUCTOR. enroll(address student,string grade). promote(address student). Events: StudentEnrolled, StudentPromoted. No constructor args." }
    , { label: "Principal", text: "EMPTY CONSTRUCTOR. appoint(address principal). manage(string policy). Events: PrincipalAppointed, PolicyManaged. No constructor args." }
    , { label: "Dean", text: "EMPTY CONSTRUCTOR. appoint(address dean,string department). oversee(string program). Events: DeanAppointed, ProgramOverseen. No constructor args." }
  ], []);

  // Derive categories from labels/text when not explicitly provided
  const categorize = useCallback((it: TickerItem): string => {
    const s = `${it.label} ${it.text}`.toLowerCase();
    // Order matters; match more specific categories first
    if (s.includes('erc721') || s.includes('nft')) return 'NFT';
    if (s.includes('erc20') || s.includes('token ')) return 'Token';
    if (s.includes('staking') || s.includes('stake')) return 'Staking';
    if (s.includes('vote') || s.includes('dao') || s.includes('govern')) return 'Governance';
    if (s.includes('auction')) return 'Auction';
    if (s.includes('lending') || s.includes('loan') || s.includes('flashloan')) return 'Lending';
    if (s.includes('escrow')) return 'Escrow';
    if (s.includes('whitelist') || s.includes('blacklist') || s.includes('access')) return 'Access';
    if (s.includes('oracle') || s.includes('pricefeed')) return 'Oracle';
    if (s.includes('bridge') || s.includes('crosschain')) return 'Bridge';
    if (s.includes('market')) return 'Marketplace';
    if (s.includes('subscription')) return 'Subscription';
    if (s.includes('insurance')) return 'Insurance';
    if (s.includes('crowd') || s.includes('campaign')) return 'Crowdfunding';
    if (s.includes('faucet')) return 'Faucet';
    if (s.includes('royalty') || s.includes('split')) return 'Payments';
  if (s.includes('vault') || s.includes('timelock')) return 'Vault';
  if (s.includes('identity') || s.includes('kyc') || s.includes('did')) return 'Identity';
  if (s.includes('registry')) return 'Registry';
  if (s.includes('survey')) return 'Survey';
  if (s.includes('lottery') || s.includes('tournament') || s.includes('game')) return 'Games';
  return 'Utility';
  }, []);

  // Label normalization (dedupe/typo fixes)
  const renameMap = useMemo(() => ({
    DecentalizedExchange: 'DecentralizedExchange',
    Book2: 'Book',
    Library2: 'LibraryPlus',
    Bookmark2: 'ContentBookmark',
    Membership2: 'MembershipPlus',
    Ticket2: 'Ticket',
    Event2: 'Event',
  } as Record<string, string>), []);

  // Explicit category overrides for improved grouping
  const explicitCategoryMap = useMemo(() => ({
    // Education
    Grade: 'Education', Course: 'Education', Lesson: 'Education', Quiz: 'Education', Exam: 'Education', Project: 'Education', Portfolio: 'Education', Resume: 'Education', Interview: 'Education', Application: 'Education', Certificate: 'Education', Diploma: 'Education', Student: 'Education', Teacher: 'Education', Classroom: 'Education', School: 'Education', College: 'Education', Campus: 'Education', Principal: 'Education', Dean: 'Education',
    // Healthcare
    Health: 'Healthcare', Medical: 'Healthcare', Doctor: 'Healthcare', Patient: 'Healthcare', Hospital: 'Healthcare', Pharmacy: 'Healthcare', Prescription: 'Healthcare', Treatment: 'Healthcare', Surgery: 'Healthcare', Recovery: 'Healthcare', Therapy: 'Healthcare', Rehabilitation: 'Healthcare', Wellness: 'Healthcare', Nutrition: 'Healthcare', Diet: 'Healthcare', Exercise: 'Healthcare', Meditation: 'Healthcare', Mood: 'Healthcare',
    // Commerce
    Marketplace: 'Commerce', Store: 'Commerce', Shop: 'Commerce', Cart: 'Commerce', Order: 'Commerce', Shipping: 'Commerce', Delivery: 'Commerce', Tracking: 'Commerce', Return: 'Commerce', Refund: 'Commerce', Exchange: 'Commerce', Coupon: 'Commerce', Promotion: 'Commerce', Sale: 'Commerce', Invoice: 'Commerce', Receipt: 'Commerce', Ledger: 'Commerce', Budget: 'Commerce',
    // Media
    Music: 'Media', Video: 'Media', Album: 'Media', Gallery: 'Media', Collectible: 'Media', Playlist: 'Media', Article: 'Media', NewsBoard: 'Media', Testimonial: 'Media',
    // Social
    Network: 'Social', Friend: 'Social', Follow: 'Social', Block: 'Social', Report: 'Social', Flag: 'Social', Moderation: 'Social', Post: 'Social', Comment: 'Social', Like: 'Social', Bookmark: 'Social', ContentBookmark: 'Social', Favorite: 'Social', ChatRoom: 'Social', GuestBook: 'Social',
    // Travel & Events
    Adventure: 'Travel', Journey: 'Travel', Trip: 'Travel', Hotel: 'Travel', Room: 'Travel', Reservation: 'Travel', Booking: 'Travel', Appointment: 'Events', Meeting: 'Events', Conference: 'Events', Event: 'Events', Party: 'Events', Wedding: 'Events', Birthday: 'Events', Holiday: 'Events', Festival: 'Events', Concert: 'Events', Show: 'Events', Cinema: 'Events',
    // Sports & Competition
    Sports: 'Sports', Player: 'Sports', Coach: 'Sports', Stadium: 'Sports', Gym: 'Sports', Fitness: 'Sports', Leaderboard: 'Sports', ScoreBoard: 'Sports', Game: 'Sports', Match: 'Sports', Tournament: 'Sports', Competition: 'Sports', AuctionHouse: 'Auction', Bidding: 'Auction', SimpleAuction: 'Auction', Raffle: 'Lottery', LotteryBox: 'Lottery', Prize: 'Competition', Contest: 'Competition', Challenge: 'Competition', Quest: 'Competition', Mission: 'Competition',
    // Finance
    SimpleBank: 'Finance', Savings: 'Finance', Loan: 'Finance', Insurance: 'Finance', Warranty: 'Finance', Payroll: 'Finance', TimeSheet: 'Finance', Expense: 'Finance', Transaction: 'Finance', PointsLedger: 'Finance', FeeSplitter: 'Finance', RoyaltySplitter: 'Finance',
    // Identity & Access
    KYCRegistry: 'Identity', DigitalIdentity: 'Identity', Permission: 'Access', Role: 'Access', Admin: 'Access', Moderator: 'Access', Ban: 'Access', Mute: 'Access', Warning: 'Access', Approval: 'Access', Authorization: 'Access',
    // Writing & Language
    Story: 'Writing', Book: 'Writing', LibraryPlus: 'Writing', Author: 'Writing', Editor: 'Writing', Manuscript: 'Writing', Chapter: 'Writing', Page: 'Writing', Paragraph: 'Writing', Sentence: 'Writing',
    Dictionary: 'Language', Vocabulary: 'Language', Language: 'Language', Translation: 'Language', Interpreter: 'Language', Communication: 'Language', Conversation: 'Language', Discussion: 'Language', Debate: 'Language', Evidence: 'Language', Proof: 'Language', Logic: 'Language', Reason: 'Language', Philosophy: 'Language', Knowledge: 'Education', Learning: 'Education',
    // Membership
    Membership: 'Membership', MembershipPlus: 'Membership', Subscription: 'Membership', SubscriptionService: 'Membership',
  } as Record<string, string>), []);

  // Auto-generate tags for better search
  const computeTags = useCallback((label: string, text: string): string[] => {
    const s = `${label} ${text}`.toLowerCase();
    const tags = new Set<string>();
    const add = (t: string) => { if (t) tags.add(t); };
    const kw = (k: string, t: string) => { if (s.includes(k)) add(t); };
    kw('erc721','erc721'); kw('nft','nft'); kw('erc20','erc20'); kw('token ','token');
    kw('auction','auction'); kw('raffle','raffle'); kw('lottery','lottery');
    kw('vote','vote'); kw('dao','dao'); kw('govern','governance');
    kw('escrow','escrow'); kw('oracle','oracle'); kw('bridge','bridge');
    kw('market','marketplace'); kw('store','commerce'); kw('shop','commerce'); kw('cart','commerce'); kw('order','commerce');
    kw('shipping','shipping'); kw('delivery','delivery'); kw('tracking','tracking'); kw('return','returns'); kw('refund','refunds'); kw('exchange','exchange');
    kw('coupon','coupon'); kw('promotion','promotion'); kw('sale','sale'); kw('invoice','invoice'); kw('receipt','receipt'); kw('budget','budget'); kw('ledger','ledger');
    kw('loan','loan'); kw('insurance','insurance'); kw('warranty','warranty'); kw('bank','bank'); kw('savings','savings');
    kw('subscription','subscription'); kw('member','membership'); kw('identity','identity'); kw('kyc','kyc'); kw('did','did');
    kw('survey','survey'); kw('game','game'); kw('tournament','tournament'); kw('match','match'); kw('score','score');
    kw('friend','social'); kw('follow','social'); kw('network','social'); kw('post','social'); kw('comment','social'); kw('like','social'); kw('share','social'); kw('bookmark','social'); kw('chat','chat'); kw('news','media');
    kw('music','music'); kw('video','video'); kw('photo','photo'); kw('playlist','playlist'); kw('gallery','gallery'); kw('collectible','collectible');
    kw('trip','travel'); kw('hotel','travel'); kw('reservation','travel'); kw('booking','travel'); kw('appointment','events'); kw('conference','events'); kw('event','events'); kw('party','events'); kw('wedding','events'); kw('festival','events'); kw('concert','events');
    kw('sports','sports'); kw('player','sports'); kw('coach','sports'); kw('stadium','sports'); kw('gym','sports'); kw('fitness','sports');
    kw('health','health'); kw('medical','health'); kw('doctor','health'); kw('patient','health'); kw('hospital','health'); kw('pharmacy','health'); kw('prescription','health'); kw('treatment','health'); kw('surgery','health'); kw('therapy','health'); kw('recovery','health'); kw('nutrition','health'); kw('diet','health'); kw('exercise','health'); kw('meditation','health'); kw('mood','health');
    kw('journal','journal'); kw('diary','diary'); kw('memory','memory'); kw('school','education'); kw('teacher','education'); kw('student','education'); kw('classroom','education'); kw('campus','education');
    kw('book','writing'); kw('author','writing'); kw('editor','writing'); kw('manuscript','writing'); kw('chapter','writing'); kw('page','writing'); kw('paragraph','writing'); kw('sentence','writing'); kw('dictionary','language'); kw('vocabulary','language'); kw('language','language'); kw('translation','language'); kw('communication','language'); kw('conversation','language'); kw('discussion','language'); kw('debate','language'); kw('evidence','language'); kw('proof','language'); kw('logic','language'); kw('reason','language'); kw('philosophy','language');
    // infer function-like identifiers as tags
    const fn = /\b([a-zA-Z][a-zA-Z0-9_]*)\s*\(/g; let m: RegExpExecArray | null;
    while ((m = fn.exec(text)) !== null) { const name = m[1]; if (name && name.length >= 3) add(`fn:${name}`); }
    return Array.from(tags);
  }, []);

  const normalizedItems: TickerItem[] = useMemo(() => {
    const out: TickerItem[] = [];
    const seen = new Set<string>();
    for (const it of baseTickerItems) {
      const label = renameMap[it.label] || it.label;
      const key = `${label.toLowerCase()}|${it.text.trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const overrideCat = explicitCategoryMap[label];
      const category = overrideCat || it.category || categorize({ label, text: it.text });
      const autoTags = computeTags(label, it.text);
      const tags = Array.from(new Set([...(it.tags || []), ...autoTags, category.toLowerCase()]));
      out.push({ ...it, label, category, tags });
    }
    return out;
  }, [baseTickerItems, renameMap, explicitCategoryMap, categorize, computeTags]);

  const categorizedTickerItems = normalizedItems;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of categorizedTickerItems) set.add(it.category || 'Utility');
    return ['All', ...Array.from(set).sort()];
  }, [categorizedTickerItems]);

// Filtered list for the templates modal
const filteredTemplates = useMemo(() => {
  const q = templateSearch.trim().toLowerCase();
  let list = categorizedTickerItems;
  if (selectedCategory !== 'All') {
    list = list.filter((it) => (it.category || 'Utility') === selectedCategory);
  }
  if (!q) return list;
  return list.filter((it) =>
    it.label.toLowerCase().includes(q)
    || it.text.toLowerCase().includes(q)
    || (it.category?.toLowerCase().includes(q) ?? false)
    || (it.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
  );
}, [templateSearch, selectedCategory, categorizedTickerItems]);

const [tickerItems, setTickerItems] = useState<TickerItem[]>(baseTickerItems);

useEffect(() => {
if (typeof window === 'undefined') return;
if (!baseTickerItems.length) return;
const idx = Math.floor(Math.random() * baseTickerItems.length);
setTickerItems([...baseTickerItems.slice(idx), ...baseTickerItems.slice(0, idx)]);
}, [baseTickerItems]);

return (
<div className="min-h-screen">

  <div className="container mx-auto px-4 py-10 max-w-6xl">
{/* Top Nav */}
  <div className="mb-4 flex items-center justify-between">
    <Link href="/" className="text-sm inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white hover:bg-orange-50 border-orange-200 text-orange-700">
      ← Back to Home
    </Link>
  </div>
  <section className="mb-8">
    <div className="rounded-2xl border border-orange-200 bg-orange-50/40 px-6 py-8 text-center shadow-sm">
      <h1 className="hero-title text-black">AI Deployment Playground</h1>
      <p className="mt-2 body-text max-w-2xl mx-auto text-black">Describe, generate, compile, fix and deploy smart contracts to Basecamp.</p>
      <div className="mt-2 flex items-center justify-center gap-3 text-small text-black">
        <span>⚡ Powered by AI</span>
        <span>•</span>
        <span>🚀 Auto-Deploy</span>
        <span>•</span>
        <span>🛡️ Mock-Safe Selection</span>
      </div>
    </div>
  </section>

  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <Card className="lg:col-span-2 border border-orange-200">
      <CardHeader>
        <CardTitle>1) Describe your contract</CardTitle>
        <CardDescription>Tell the AI what to build</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="prompt">Prompt</Label>
          <Textarea
            id="prompt"
            placeholder="e.g., ERC721 with minting and baseURI"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            className="input-field textarea-field min-h-[120px] text-black placeholder:text-gray-500"
          />

          <div className="relative w-full overflow-x-hidden">
            <TickerTemplates
              items={tickerItems}
              onSelect={(text) => setPrompt(text)}
              autoSpeed={40}
              direction="rtl"
              pauseOnHover
              resumeDelayMs={500}
              snap="chip"
              inertia={false}
              draggable={true}
              className="pb-1 px-1 w-full max-w-full"
            />
          </div>

          {/* View all templates trigger */}
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              size="lg"
              variant="secondary"
              onClick={() => setTemplatesOpen(true)}
              aria-haspopup="dialog"
              className="rounded-full border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-400 shadow-md px-4"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              View All Templates
            </Button>
          </div>

          {/* Templates Library Modal */}
          <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <DialogContent className="max-w-4xl w-[min(92vw,64rem)] rounded-2xl border border-orange-200 shadow-lg max-h-[85vh] md:max-h-[calc(100svh-4rem)] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Template Library</DialogTitle>
                <DialogDescription>Browse and select from all available templates. Click "Use" to load the prompt.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 sticky top-0 z-10 bg-white/95 backdrop-blur px-3 py-3 -mx-3 border-b border-orange-100">
                <Input
                  placeholder="Search templates by name or text..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="focus-visible:ring-2 focus-visible:ring-orange-500 border-orange-200"
                />
                {/* Category filter chips */}
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Button
                      key={cat}
                      type="button"
                      size="sm"
                      variant={selectedCategory === cat ? 'secondary' : 'outline'}
                      onClick={() => setSelectedCategory(cat)}
                      aria-pressed={selectedCategory === cat}
                      className="rounded-full uppercase tracking-wide text-xs border-orange-200"
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
                <div className="text-sm text-muted-foreground">{filteredTemplates.length} templates</div>
              </div>
              <div className="flex-1 overflow-auto overscroll-contain space-y-3 mt-2 px-3 -mx-3 pb-3">
                {filteredTemplates.map((it, idx) => (
                  <div key={`${it.label}-${idx}`} className="rounded-2xl border border-orange-200 bg-white/90 p-4 shadow-sm hover:shadow-md hover:border-orange-300 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium flex items-center gap-2">
                        {it.label}
                        {it.category && (
                          <span className="text-[10px] uppercase tracking-wide rounded-full border border-orange-200 px-2 py-0.5 bg-white text-muted-foreground">{it.category}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(it.text); toast({ title: 'Copied template' }); }}>Copy</Button>
                        <Button size="sm" onClick={() => { setPrompt(it.text); setTemplatesOpen(false); }}>Use</Button>
                      </div>
                    </div>
                    <pre className="mt-2 text-xs whitespace-pre-wrap break-words bg-orange-50/50 border border-orange-200 rounded p-2">{it.text}</pre>
                  </div>
                ))}
                {filteredTemplates.length === 0 && (
                  <div className="text-sm text-muted-foreground py-6 text-center">No templates match your search.</div>
                )}
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setTemplatesOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* LLM Enhancement Debug (restored) */}
        <div className="mt-2">
          <button
            type="button"
            className="text-xs underline text-muted-foreground hover:text-foreground"
            onClick={() => setShowEnhanceDebug((v) => !v)}
            aria-expanded={showEnhanceDebug}
          >
            {showEnhanceDebug ? 'Hide' : 'Show'} LLM Prompt Debug
          </button>
          {showEnhanceDebug && enhanceDebug && (
            <div className="mt-2 rounded-md border p-3 bg-muted/30 text-xs space-y-2">
              <div className="flex flex-wrap gap-4">
                <div>Provider: <span className="font-medium">{enhanceDebug.provider || '—'}</span></div>
                <div>Model: <span className="font-medium">{enhanceDebug.model || '—'}</span></div>
                <div>Enhanced Used: <span className="font-medium">{enhanceDebug.used ? 'Yes' : 'No'}</span></div>
                {enhanceDebug.error && (<div className="text-red-600">Error: {enhanceDebug.error}</div>)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-muted-foreground">Base Prompt</div>
                  <pre className="whitespace-pre-wrap break-words bg-background border rounded p-2 max-h-48 overflow-auto">{enhanceDebug.base}</pre>
                  <div className="mt-1">
                    <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(enhanceDebug.base)}>Copy Base</Button>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-muted-foreground">Enhanced Prompt</div>
                  <pre className="whitespace-pre-wrap break-words bg-background border rounded p-2 max-h-48 overflow-auto">{enhanceDebug.enhanced || '—'}</pre>
                  <div className="mt-1">
                    <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(enhanceDebug.enhanced || '')} disabled={!enhanceDebug.enhanced}>Copy Enhanced</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Label>Network:</Label>
          <div className="inline-flex rounded-lg border p-0.5 bg-background">
            <button
              className={`px-3 py-1 rounded-md text-sm transition-colors bg-primary text-primary-foreground`}
              onClick={() => setNetwork("basecamp")}
              disabled
              aria-pressed={true}
            >
              basecamp
            </button>
          </div>
        </div>

        {/* Max Iterations Selector */}
        <div className="flex items-center gap-3 flex-wrap mt-3">
          <Label>Max Iterations:</Label>
          <div className="inline-flex rounded-lg border p-0.5 bg-background">
            {[11, 15, 21].map((v) => (
              <button
                key={v}
                type="button"
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  maxIters === v
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => setMaxIters(v as 11 | 15 | 21)}
                disabled={loading}
                aria-pressed={maxIters === v}
                aria-label={`Set max iterations to ${v}`}
                title={`Set max iterations to ${v}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={startPipeline} disabled={loading || !prompt.trim()} className="btn-primary w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Generate & Deploy →
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}
      </CardContent>
    </Card>

        <Card className="border border-orange-200">
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Job progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-orange-600 font-medium">Job ID:</span> <span className="text-orange-600 font-medium">{jobId || "—"}</span></div>
            <div><span className="text-orange-600 font-medium">State:</span> <span className="text-orange-600 font-medium">{statusLabel}</span></div>
            <div><span className="text-orange-600 font-medium">Progress:</span> <span className="text-orange-600 font-medium">{job?.progress ?? 0}%</span></div>
            <div><span className="text-orange-600 font-medium">Step:</span> <span className="text-orange-600 font-medium">{job?.step || "—"}</span></div>
            {networkLabel && (
              <div><span className="text-orange-600 font-medium">Network:</span> <span className="text-orange-600 font-medium">{networkLabel}</span></div>
            )}
            {deployedAddress && (
              <div className="mt-2 rounded border border-orange-500/50 bg-orange-600 p-3 text-white">
                <div className="text-xs opacity-90">Deployed Address</div>
                <div className="font-mono text-sm mt-1 break-all max-w-full">
                  {deployedAddress}
                </div>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-2 text-xs underline text-white/90 hover:text-white"
                  >
                    View on Explorer →
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="lg:col-span-2 border border-orange-200">
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle className="flex items-center gap-2"><Terminal className="h-4 w-4" /> Live Logs</CardTitle>
              <Button variant="secondary" size="sm" onClick={clearLogs}>Clear</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={logsBoxRef} className="h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs space-y-1 font-mono text-gray-800 whitespace-pre-wrap">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet.</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="">
                    {l.level === 'magical' ? (
                      <>
                        <span className="text-primary font-medium italic">{l.msg || l.message}</span>
                        {typeof l.repeat === 'number' && l.repeat > 1 && (
                          <span className="ml-2 text-muted-foreground">×{l.repeat}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className={`mr-2 ${l.level === "error" ? "text-red-600" : l.level === "warn" ? "text-yellow-700" : "text-sky-700"}`}>{(l.level || "info").toUpperCase()}</span>
                        <span>{l.msg || l.message}</span>
                        {typeof l.repeat === 'number' && l.repeat > 1 && (
                          <span className="ml-2 text-muted-foreground">×{l.repeat}</span>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> Steps</CardTitle>
            <CardDescription>Progress mapping</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {STEP_ORDER.map((s, i) => {
                const bucket = bucketizeStep(job?.step);
                const serverIdx = bucket ? STEP_ORDER.indexOf(bucket) : -1;
                const idx = i;
                const isVerify = s === 'verify';
                const active = isVerify ? verifying : (job?.state === 'running' && idx === serverIdx);
                const failed = job?.state === 'failed' && idx === serverIdx && !isVerify;
                const completedBase = (!isVerify && (job?.state === 'completed' || (serverIdx > -1 && idx < serverIdx)));
                const completed = isVerify ? !!verifyRes?.verified : completedBase;
                return (
                  <div
                    key={s}
                    className={`flex items-center justify-between text-sm px-3 py-2 rounded border ${
                      completed ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' :
                      failed ? 'bg-red-500/10 border-red-500/40 text-red-500' :
                      active ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-muted border-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${completed ? 'bg-emerald-500 text-black border-emerald-500' : failed ? 'bg-red-500 text-white border-red-500' : active ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                        {completed ? '✓' : failed ? '!' : i + 1}
                      </div>
                      <span className="capitalize">{s}</span>
                    </div>
                    <span className="text-xs">{failed ? 'Unsupported' : active ? `Working${'.'.repeat((dotCounter % 3) + 1)}` : completed ? 'Done' : ''}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="border border-orange-200">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2"><FileCode className="h-4 w-4" /> Artifacts</CardTitle>
                <CardDescription>ABI • Sources • Scripts</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { copyAllArtifacts(); toast({ title: "Copied all artifacts" }); }}
                >
                  Copy All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { copyAllSources(); toast({ title: "Copied all sources" }); }}
                >
                  Copy All Sources
                </Button>
                <Button size="sm" onClick={exportArtifactsZip}>Export ZIP</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeArtifactTab} onValueChange={(v) => setActiveArtifactTab(v as any)}>
              <TabsList>
                <TabsTrigger value="abi">ABI</TabsTrigger>
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="scripts">Scripts</TabsTrigger>
              </TabsList>

              <TabsContent value="abi">
                {!abis ? (
                  <div className="text-sm text-muted-foreground">No ABI yet.</div>
                ) : (
                  <div>
                    <div className="mb-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(abis, null, 2));
                          toast({ title: "Copied ABI JSON" });
                        }}
                      >
                        Copy ABI JSON
                      </Button>
                    </div>
                    <pre className="bg-muted p-3 rounded overflow-auto text-xs max-h-[400px]"><code>{JSON.stringify(abis, null, 2)}</code></pre>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sources">
                {!sources || sources.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No sources yet.</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <div className="lg:col-span-1 space-y-1">
                      {sources.map((s, i) => (
                        <button key={s.path} className={`w-full text-left text-xs px-2 py-1 rounded border ${i===selectedSourceIdx? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setSelectedSourceIdx(i)}>
                          {s.path.split('/').pop()}
                        </button>
                      ))}
                    </div>
                    <div className="lg:col-span-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (firstSource) {
                            const text = typeof firstSource.content === 'string' ? firstSource.content : JSON.stringify(firstSource.content, null, 2);
                            navigator.clipboard.writeText(text);
                            toast({ title: "Copied file" });
                          }
                        }}
                      >
                        Copy File
                      </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">{firstSource?.path}</div>
                      <pre className="bg-muted p-3 rounded overflow-auto text-xs max-h-[400px] font-mono text-foreground"><code>{
                        firstSource ? (typeof firstSource.content === 'string' ? firstSource.content : JSON.stringify(firstSource.content, null, 2)) : ''
                      }</code></pre>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="scripts">
                {!scripts || scripts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No scripts yet.</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                    <div className="lg:col-span-1 space-y-1">
                      {scripts.map((s, i) => (
                        <button key={s.path} className={`w-full text-left text-xs px-2 py-1 rounded border ${i===selectedScriptIdx? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setSelectedScriptIdx(i)}>
                          {s.path.split('/').pop()}
                        </button>
                      ))}
                    </div>
                    <div className="lg:col-span-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (firstScript) {
                              const text = typeof firstScript.content === 'string' ? firstScript.content : JSON.stringify(firstScript.content, null, 2);
                              navigator.clipboard.writeText(text);
                              toast({ title: "Copied script" });
                            }
                          }}
                        >
                          Copy Script
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">{firstScript?.path}</div>
                      <pre className="bg-muted p-3 rounded overflow-auto text-xs max-h-[400px] font-mono text-foreground"><code>{
                        firstScript ? (typeof firstScript.content === 'string' ? firstScript.content : JSON.stringify(firstScript.content, null, 2)) : ''
                      }</code></pre>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>



      {/* Success Modal */}
      {successOpen && job?.state === 'completed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSuccessOpen(false)} />
          <div className="relative z-10 mx-4 w-full max-w-lg md:max-w-lg rounded-lg border border-primary/40 bg-background p-6 shadow-xl">
            <div className="text-3xl mb-3 text-center">🎉</div>
            <h2 className="text-xl font-semibold text-primary text-center mb-2">Contract Deployed Successfully!</h2>
            <p className="text-sm text-muted-foreground text-center mb-2">Your contract has been deployed{networkLabel ? ` to ${networkLabel}` : ''}.</p>
            {!(abis || sources || scripts) && (
              <p className="text-xs text-muted-foreground text-center mb-2">Fetching artifacts…</p>
            )}
            <div className="bg-muted/50 rounded p-3 text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-muted-foreground">Job ID:</span>
              <span className="font-mono break-words">{jobId || 'ai_pipeline_55c79ab4-f3e7-46ff-92bc-b228d0359f28'}</span>
              {job?.result?.contract && (
                <>
                  <span className="text-muted-foreground">Contract:</span>
                  <span className="break-words">{job.result.contract}</span>
                </>
              )}
              {deployedAddress && (
                <>
                  <span className="text-muted-foreground">Address:</span>
                  <span className="font-mono break-words inline-block rounded-md bg-orange-500 text-white px-2 py-0.5">{deployedAddress}</span>
                </>
              )}
              {networkLabel && (
                <>
                  <span className="text-muted-foreground">Network:</span>
                  <span className="text-orange-600 font-medium">{networkLabel}</span>
                </>
              )}
            </div>
            <div className="mt-4 flex gap-2 justify-center flex-wrap">
              {deployedAddress && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { navigator.clipboard.writeText(deployedAddress); toast({ title: "Copied address" }); }}
                >
                  Copy Address
                </Button>
              )}
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer"><Button size="sm">View on Explorer</Button></a>
              )}
              {(abis || sources || scripts) && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => {
                    const blob = new Blob([JSON.stringify({ abis, sources, scripts }, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `artifacts-${jobId}.json`; a.click();
                    URL.revokeObjectURL(url);
                  }}>Download JSON</Button>
                  <Button variant="secondary" size="sm" onClick={exportArtifactsZip}>Export ZIP</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const id = jobId || 'ai_pipeline_55c79ab4-f3e7-46ff-92bc-b228d0359f28';
                      navigator.clipboard.writeText(id);
                      toast({ title: 'Copied Job AI' });
                    }}
                  >
                    Copy Job ID
                  </Button>
                  <Button variant="outline" size="sm" onClick={copyAllSources}>Copy All Sources</Button>
                </>
              )}
            </div>
            <button className="absolute top-2 right-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => setSuccessOpen(false)}>✕</button>
          </div>
        </div>
      )}

      {/* Failure Toast */}
      {failureOpen && job?.state === 'failed' && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="rounded-lg border border-red-500/40 bg-background shadow-xl p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-red-600">Contract Not Supported</div>
                <div className="text-sm text-muted-foreground">This contract is not supported in the current version (step: {job?.step || 'unknown'}). We’re continuously working on updates.</div>
                <div className="text-sm text-muted-foreground mt-1">Click on "Send report" to share this with our Dev Team.</div>
                <div className="mt-3 flex gap-2 justify-end">
                  <Button variant="secondary" size="sm" onClick={() => setFailureOpen(false)}>Dismiss</Button>
                  <Button size="sm" onClick={handleSendReportEmail}>Send Report</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  {/* Close wrapper */}
</div>
  );
}
