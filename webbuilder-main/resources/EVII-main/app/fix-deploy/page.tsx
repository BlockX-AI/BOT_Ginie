"use client";

import React from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

// New AI Fix & Deploy page implementing the enhanced /api/ai/fix flow
// Uses production backend by default; respects NEXT_PUBLIC_API_BASE when present
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE?.trim() || "https://acadcodegen-production.up.railway.app").replace(/\/$/, "");

type JobState = "queued" | "running" | "failed" | "completed";

type JobData = {
  id: string;
  type?: string;
  state: JobState;
  progress: number;
  step?: string; // init | fix | compile | deploy | complete | other
  result?: {
    network?: string;
    deployer?: string;
    contract?: string;
    fqName?: string;
    address?: string;
    params?: any;
  };
};

type LogEntry = { t?: number; level?: string; msg?: string; message?: string };

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

function bucketizeStep(step?: string): "validate" | "fix" | "compile" | "deploy" | undefined {
  if (!step) return undefined;
  const s = step.toLowerCase();
  if (s.includes("init") || s.includes("valid")) return "validate";
  if (s.includes("fix")) return "fix";
  if (s.includes("compil")) return "compile";
  if (s.includes("deploy")) return "deploy";
  return undefined;
}

export default function AIFixDeployPage() {
  const [code, setCode] = React.useState<string>("// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract MyToken {\n    // Your buggy code here...\n}");
  const [network, setNetwork] = React.useState<string>("basecamp");
  const [filename, setFilename] = React.useState<string>("");
  const [contractName, setContractName] = React.useState<string>("");
  const [constructorArgs, setConstructorArgs] = React.useState<string>("");
  const [context, setContext] = React.useState<string>("");
  const [errors, setErrors] = React.useState<string>("");

  const [submitting, setSubmitting] = React.useState(false);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [job, setJob] = React.useState<JobData | null>(null);
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const [successOpen, setSuccessOpen] = React.useState(false);
  const [failureOpen, setFailureOpen] = React.useState(false);
  const [derivedDeploy, setDerivedDeploy] = React.useState<{ address?: string; network?: string } | null>(null);

  const pollRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current as any); }, []);

  async function submitFixDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setLogs([]);
    setJob(null);
    setJobId(null);

    try {
      let parsedArgs: unknown[] | undefined = undefined;
      if (constructorArgs.trim()) {
        try { parsedArgs = JSON.parse(constructorArgs); } catch { parsedArgs = undefined; }
      }

      const res = await fetch(`${API_BASE}/api/ai/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          errors: errors || undefined,
          context: context || undefined,
          model: undefined,
          network,
          filename: filename || undefined,
          constructorArgs: parsedArgs,
          contractName: contractName || undefined,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Submit failed: ${res.status} ${txt}`);
      }
      const body = await res.json(); // { ok: true, job }
      const id = body?.job?.id as string | undefined;
      if (!id) throw new Error("No job id returned");
      setJobId(id);
      setJob({ id, state: body.job.state, progress: body.job.progress, step: body.job.step });

      if (pollRef.current) clearInterval(pollRef.current as any);
      pollRef.current = setInterval(async () => {
        await Promise.all([
          refreshStatus(id),
          refreshLogs(id),
        ]);
      }, 2000);
    } catch (err: any) {
      setLogs((prev) => [...prev, { level: "error", msg: err?.message || "Submit failed" }]);
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshStatus(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/job/${encodeURIComponent(id)}/status`);
      const body = await res.json();
      if (body?.ok && body.data) {
        setJob(body.data as JobData);
        if (body.data.state === "completed" || body.data.state === "failed") {
          if (pollRef.current) clearInterval(pollRef.current as any);
          if (body.data.state === "completed") setSuccessOpen(true);
          if (body.data.state === "failed") setFailureOpen(true);
        }
      }
    } catch {}
  }

  async function refreshLogs(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/job/${encodeURIComponent(id)}/logs`);
      const body = await res.json();
      if (body?.ok && Array.isArray(body.data?.logs)) {
        const newLogs = body.data.logs as LogEntry[];
        setLogs(newLogs);
        // Try to derive deploy info from logs if job.result is not available yet
        try {
          const textLines = newLogs.map((l) => `${l.msg || l.message || ""}`);
          // Look for a JSON DEPLOY_RESULT line or an address= in logs
          const deployJsonLine = textLines.find((t) => /\bDEPLOY_RESULT\b/i.test(t) && /\{/.test(t));
          if (deployJsonLine) {
            const jsonMatch = deployJsonLine.match(/\{.*\}/);
            if (jsonMatch) {
              const j = JSON.parse(jsonMatch[0]);
              if (j?.address) setDerivedDeploy({ address: j.address, network: j.network });
            }
          } else {
            const addrMatch = textLines.join("\n").match(/0x[a-fA-F0-9]{40}/);
            if (addrMatch && !derivedDeploy?.address) {
              setDerivedDeploy((prev) => ({ ...(prev || {}), address: addrMatch[0] }));
            }
          }
        } catch {}
      }
    } catch {}
  }

  const stepBucket = bucketizeStep(job?.step);
  const progressPct = Math.max(0, Math.min(100, Number(job?.progress ?? 0)));
  const deployedAddress = job?.result?.address || derivedDeploy?.address;
  const deployedNetwork = job?.result?.network || derivedDeploy?.network;
  const explorerUrl = getExplorerUrl(deployedNetwork, deployedAddress);
  const networkLabel = deployedNetwork ? (NETWORK_LABELS[deployedNetwork] || deployedNetwork) : undefined;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Top Nav */}
      <div className="mb-4">
        <Link href="/">
          <Button variant="outline" size="sm" className="inline-flex items-center gap-2 border-primary/30 hover:border-primary/50">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>
      {/* Hero */}
      <section className="text-center rounded-2xl p-10 bg-gradient-to-br from-orange-50 via-orange-100/60 to-amber-100 shadow-[0_10px_40px_rgba(255,109,1,0.10)] border border-orange-200">
        <h1 className="font-heading text-4xl md:text-5xl font-bold text-orange-900 leading-tight">
          Have a <span className="inline-block mx-1 bg-gradient-to-br from-orange-500 to-orange-600 text-white highlight-on-orange px-3 py-1 rounded-lg shadow-[0_5px_20px_rgba(255,109,1,0.40)]">Buggy</span> Smart Contract?
          <br className="hidden md:block" />
          Let us <span className="inline-block mx-1 bg-gradient-to-br from-orange-500 to-orange-600 text-white highlight-on-orange px-3 py-1 rounded-lg shadow-[0_5px_20px_rgba(255,109,1,0.40)]">Fix & Deploy</span> it!
        </h1>
        <p className="mt-4 text-orange-800/90 max-w-2xl mx-auto">
          Enjoy the camp with friends while our AI fixes your Solidity code and deploys it to Basecamp automatically.
        </p>
        <p className="mt-1 text-sm text-orange-700">⚡ Powered by AI • 🚀 Auto-Deploy • 🛡️ Mock-Safe Selection</p>
      </section>

      {/* Main Section */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mt-8">
        {/* Form Card */}
        <div className="rounded-2xl p-6 bg-white/90 backdrop-blur border border-orange-200 shadow-[0_20px_60px_rgba(255,109,1,0.10)]">
          <h2 className="text-xl font-semibold text-orange-900 flex items-center gap-2 mb-4">
            <span className="inline-flex w-6 h-6 rounded-full items-center justify-center text-white text-[12px] bg-gradient-to-br from-orange-500 to-orange-600">🔧</span>
            Smart Contract Fixer
          </h2>

          {/* Steps */}
          <div className="flex items-center justify-between gap-2 mb-6">
            {[
              { key: "validate", label: "Upload Code", n: 1 },
              { key: "fix", label: "Configure", n: 2 },
              { key: "deploy", label: "Fix & Deploy", n: 3 },
            ].map((s, idx) => {
              const active = stepBucket ? s.key === stepBucket || (s.key === "validate" && !stepBucket) : idx === 0;
              return (
                <div key={s.key} className="flex-1 flex flex-col items-center relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold mb-1 ${active ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_5px_15px_rgba(255,109,1,0.40)]" : "bg-orange-200 text-orange-900"}`}>{s.n}</div>
                  <div className="text-xs text-orange-800 font-medium text-center">{s.label}</div>
                  {idx < 2 && <div className="absolute top-5 left-1/2 right-[-50%] h-[2px] bg-orange-200" />}
                </div>
              );
            })}
          </div>

          <form onSubmit={submitFixDeploy} className="space-y-4">
            {/* Code */}
            <div>
              <label className="block mb-2 font-medium text-orange-900">Solidity Code *</label>
              <textarea
                className="w-full min-h-[220px] rounded-lg border-2 border-orange-200 focus:border-orange-500 focus:ring-0 p-3 font-mono text-sm text-orange-900 bg-white/80"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract MyToken {\n    // Your buggy code here...\n}"
                required
              />
              <p className="text-xs text-orange-700 mt-1">Paste your Solidity contract code that needs fixing</p>
            </div>

            {/* Network */}
            <div>
              <label className="block mb-2 font-medium text-orange-900">Deployment Network *</label>
              <select
                className="w-full rounded-lg border-2 border-orange-200 focus:border-orange-500 focus:ring-0 p-2.5 text-sm text-orange-900 bg-white/80"
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                required
              >
                <option value="basecamp">Basecamp (Recommended)</option>
              </select>
              <p className="text-xs text-orange-700 mt-1">Choose Basecamp for real deployment or Hardhat for testing</p>
            </div>

            {/* Filename */}
            <div>
              <label className="block mb-2 font-medium text-orange-900">Contract Filename</label>
              <input
                className="w-full rounded-lg border-2 border-orange-200 focus:border-orange-500 focus:ring-0 p-2.5 text-sm text-orange-900 bg-white/80"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="MyToken.sol"
              />
              <p className="text-xs text-orange-700 mt-1">Optional: Helps with contract selection</p>
            </div>

            {/* Advanced Toggle */}
            <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="inline-flex items-center gap-2 text-orange-900 font-medium">
              <span>⚙️</span>
              <span>Advanced Options</span>
              <span>{showAdvanced ? "▲" : "▼"}</span>
            </button>

            {showAdvanced && (
              <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-4 space-y-4">
                {/* Contract Name */}
                <div>
                  <label className="block mb-2 font-medium text-orange-900">Specific Contract Name</label>
                  <input
                    className="w-full rounded-lg border-2 border-orange-200 focus:border-orange-500 focus:ring-0 p-2.5 text-sm text-orange-900 bg-white/80"
                    value={contractName}
                    onChange={(e) => setContractName(e.target.value)}
                    placeholder="MyToken"
                  />
                  <p className="text-xs text-orange-700 mt-1">Force deploy a specific contract (optional)</p>
                </div>

                {/* Constructor Args */}
                <div>
                  <label className="block mb-2 font-medium text-orange-900">Constructor Arguments (JSON)</label>
                  <input
                    className="w-full rounded-lg border-2 border-orange-200 focus:border-orange-500 focus:ring-0 p-2.5 text-sm text-orange-900 bg-white/80"
                    value={constructorArgs}
                    onChange={(e) => setConstructorArgs(e.target.value)}
                    placeholder='["Token Name", "TKN", "1000000000000000000000000"]'
                  />
                  <p className="text-xs text-orange-700 mt-1">Use decimal strings for large numbers</p>
                </div>

                {/* Context / Errors */}
                <div>
                  <label className="block mb-2 font-medium text-orange-900">Additional Context</label>
                  <textarea
                    className="w-full min-h-[100px] rounded-lg border-2 border-orange-200 focus:border-orange-500 focus:ring-0 p-3 text-sm text-orange-900 bg-white/80"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Describe any specific issues or requirements..."
                  />
                  <p className="text-xs text-orange-700 mt-1">Help AI understand your requirements better</p>
                </div>

                <div>
                  <label className="block mb-2 font-medium text-orange-900">Compile Errors (optional)</label>
                  <textarea
                    className="w-full min-h-[80px] rounded-lg border-2 border-orange-200 focus:border-orange-500 focus:ring-0 p-3 text-sm text-orange-900 bg-white/80"
                    value={errors}
                    onChange={(e) => setErrors(e.target.value)}
                    placeholder="Paste compiler output to guide the fixer"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold bg-gradient-to-br from-orange-500 to-orange-600 shadow-[0_10px_30px_rgba(255,109,1,0.30)] hover:shadow-[0_15px_40px_rgba(255,109,1,0.40)] transition-transform hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
              disabled={submitting || !code.trim()}
            >
              {submitting ? (<><Loader2 className="h-5 w-5 animate-spin" /> Processing...</>) : (<>🚀 Fix & Deploy Contract</>)}
            </button>
          </form>
        </div>

        {/* Progress / Logs */}
        <aside className="rounded-2xl p-6 bg-white/90 backdrop-blur border border-orange-200 shadow-[0_20px_60px_rgba(255,109,1,0.10)] h-fit lg:sticky lg:top-24">
          <h3 className="text-lg font-semibold text-orange-900 text-center">Deployment Progress</h3>

          <div className="mx-auto mt-4 mb-5 w-32 h-32 rounded-full grid place-items-center relative" aria-label="progress">
            <div className="absolute inset-0 rounded-full" style={{
              background: `conic-gradient(#ff6d01 ${3.6 * (progressPct || 0)}deg, #fed7aa 0deg)`
            }} />
            <div className="w-24 h-24 rounded-full bg-white grid place-items-center text-xl font-bold text-orange-600">
              {Math.round(progressPct)}%
            </div>
          </div>

          <ul className="divide-y divide-orange-200 text-sm">
            {[{ k: "validate", label: "Validating Code" }, { k: "fix", label: "AI Fixing Errors" }, { k: "compile", label: "Compiling Contract" }, { k: "deploy", label: "Deploying to Network" }].map(({ k, label }) => {
              const current = stepBucket === k || (!stepBucket && k === "validate");
              const completed = job?.state === "completed" || (stepBucket && ["fix", "compile", "deploy"].indexOf(k) < ["fix", "compile", "deploy"].indexOf(stepBucket));
              const failed = job?.state === "failed" && stepBucket === k;
              return (
                <li key={k} className="flex items-center gap-3 py-2">
                  <div className={`w-5 h-5 rounded-full grid place-items-center text-[11px] ${
                    failed ? "bg-red-500 text-white" : current ? "bg-orange-500 text-white animate-pulse" : completed ? "bg-emerald-500 text-white" : "bg-orange-200 text-orange-900"
                  }`}>
                    {failed ? "!" : completed ? "✓" : "⏳"}
                  </div>
                  <div>{label}</div>
                </li>
              );
            })}
          </ul>

          {/* Logs */}
          <div className="mt-5">
            <div className="text-sm font-medium text-orange-900 mb-2">Logs</div>
            <div className="max-h-72 overflow-auto rounded-lg p-3 font-mono text-xs bg-gray-50 text-gray-800 border border-gray-200 whitespace-pre-wrap">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet.</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className={`opacity-90 ${l.level === "error" ? "text-red-600" : l.level === "warn" ? "text-yellow-700" : ""}`}>
                    [{new Date().toLocaleTimeString()}] {(l.level || "info").toUpperCase()} {l.msg || l.message}
                  </div>
                ))
              )}
            </div>
            {deployedAddress && (
              <div className="mt-4 rounded border border-orange-500/50 bg-orange-600 p-3 text-white">
                <div className="text-xs opacity-90">Deployed Address</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="font-mono text-sm break-all max-w-full">{deployedAddress}</div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { navigator.clipboard.writeText(deployedAddress); toast({ title: "Copied address" }); }}
                  >
                    Copy
                  </Button>
                </div>
                {explorerUrl && (
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="block mt-2 text-xs underline text-white/90 hover:text-white">View on Explorer →</a>
                )}
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
        {[
          { icon: "🤖", title: "AI-Powered Fixing", desc: "Our advanced AI analyzes your code and automatically fixes compilation errors, syntax issues, and common bugs." },
          { icon: "🛡️", title: "Smart Contract Selection", desc: "Automatically avoids deploying mock or test contracts. Intelligently selects the main contract for deployment." },
          { icon: "⚡", title: "Real-time Progress", desc: "Monitor your deployment in real-time with detailed logs and status updates throughout the process." },
          { icon: "🌐", title: "Multi-Network Support", desc: "Deploy to Basecamp for production or Hardhat for local testing and development." },
          { icon: "🔒", title: "Secure & Isolated", desc: "Each deployment runs in an isolated sandbox environment to ensure security and prevent interference." },
          { icon: "📊", title: "Detailed Analytics", desc: "Get comprehensive deployment results including contract addresses and parameters." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl p-6 bg-white/80 border border-orange-200 shadow-[0_10px_30px_rgba(255,109,1,0.10)] hover:shadow-[0_20px_40px_rgba(255,109,1,0.20)] transition-transform hover:-translate-y-0.5">
            <div className="w-14 h-14 rounded-xl grid place-items-center text-2xl text-white bg-gradient-to-br from-orange-500 to-orange-600 mb-3">{f.icon}</div>
            <div className="text-lg font-semibold text-orange-900 mb-1">{f.title}</div>
            <div className="text-orange-800/90 leading-relaxed text-sm">{f.desc}</div>
          </div>
        ))}
      </section>

      {/* Success Modal */}
      {successOpen && job?.state === 'completed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSuccessOpen(false)} />
          <div className="relative z-10 mx-4 w-full max-w-lg md:max-w-lg rounded-lg border border-orange-200 bg-background p-6 shadow-xl">
            <div className="text-3xl mb-3 text-center">🎉</div>
            <h2 className="text-xl font-semibold text-primary text-center mb-2">Contract Deployed Successfully!</h2>
            <p className="text-sm text-muted-foreground text-center mb-4">Your contract has been deployed{networkLabel ? ` to ${networkLabel}` : ''}.</p>
            <div className="bg-muted/50 rounded p-3 text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
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
                  onClick={() => {
                    navigator.clipboard.writeText(deployedAddress);
                    toast({ title: "Copied address" });
                  }}
                >
                  Copy Address
                </Button>
              )}
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer"><Button size="sm">View on Explorer</Button></a>
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
            <div className="font-semibold text-red-600">Deployment Failed</div>
            <div className="text-sm text-muted-foreground">Step: {job?.step || 'unknown'}. Please review logs and try again.</div>
            <div className="mt-3 flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setFailureOpen(false)}>Dismiss</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
