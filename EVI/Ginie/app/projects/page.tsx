"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Download, ExternalLink, ChevronDown, ChevronUp, Globe, FileCode, CheckCircle2, XCircle, Clock, Play, Copy, Check, Shield, ShieldCheck, AlertCircle } from "lucide-react";
import { ProjectListSkeleton } from "@/components/skeletons/ProfileSkeleton";
import DAppCard from "@/components/projects/DAppCard";

// Network explorer URLs
const EXPLORER_URLS: Record<string, string> = {
  "avalanche-fuji": "https://testnet.snowtrace.io",
  "avalanche-mainnet": "https://snowtrace.io",
  "ethereum-sepolia": "https://sepolia.etherscan.io",
  "ethereum-mainnet": "https://etherscan.io",
  "polygon-mumbai": "https://mumbai.polygonscan.com",
  "polygon-mainnet": "https://polygonscan.com",
};

// Status badge component
const StatusBadge = ({ state, progress }: { state?: string; progress?: number }) => {
  const configs: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    completed: { bg: "bg-green-500/20", text: "text-green-400", icon: <CheckCircle2 className="w-3 h-3" /> },
    deployed: { bg: "bg-green-500/20", text: "text-green-400", icon: <CheckCircle2 className="w-3 h-3" /> },
    failed: { bg: "bg-red-500/20", text: "text-red-400", icon: <XCircle className="w-3 h-3" /> },
    running: { bg: "bg-blue-500/20", text: "text-blue-400", icon: <Play className="w-3 h-3 animate-pulse" /> },
    building: { bg: "bg-blue-500/20", text: "text-blue-400", icon: <Play className="w-3 h-3 animate-pulse" /> },
    pending: { bg: "bg-yellow-500/20", text: "text-yellow-400", icon: <Clock className="w-3 h-3" /> },
    status_unavailable: { bg: "bg-white/10", text: "text-white/60", icon: <AlertCircle className="w-3 h-3" /> },
  };
  const config = configs[state || "pending"] || configs.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.icon}
      {state === "status_unavailable" ? "status unavailable" : state || "pending"}
      {progress !== undefined && progress < 100 && ` • ${progress}%`}
    </span>
  );
};

// Network badge
const NetworkBadge = ({ network }: { network?: string }) => {
  if (!network) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">
      <Globe className="w-3 h-3" />
      {network}
    </span>
  );
};

export default function ProjectsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [builderProjects, setBuilderProjects] = useState<any[]>([]);
  const [builderStatusById, setBuilderStatusById] = useState<
    Record<string, { fetchedAt: number; status?: any; error?: string }>
  >({});
  const [builderPrompt, setBuilderPrompt] = useState("");
  const [builderLoading, setBuilderLoading] = useState(false);
  const [dapps, setDapps] = useState<any[]>([]);
  const [dappPrompt, setDappPrompt] = useState("");
  const [dappLoading, setDappLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"contracts" | "frontend" | "dapps">("contracts");
  const [expandedBuilder, setExpandedBuilder] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<any | null>(null);
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterNetwork, setFilterNetwork] = useState("");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const router = useRouter();

  const maybeFetchBuilderStatus = useCallback(
    async (projectId: string) => {
      const cached = builderStatusById[projectId];
      const now = Date.now();
      if (cached?.status && now - cached.fetchedAt < 60_000) return;
      if (cached?.error && now - cached.fetchedAt < 30_000) return;

      setBuilderStatusById((s) => ({ ...s, [projectId]: { fetchedAt: now, error: s[projectId]?.error, status: s[projectId]?.status } }));
      try {
        const res = await api.builderGetStatus(projectId);
        const status = (res as any)?.status;
        setBuilderStatusById((s) => ({ ...s, [projectId]: { fetchedAt: Date.now(), status } }));
      } catch (e: any) {
        setBuilderStatusById((s) => ({
          ...s,
          [projectId]: { fetchedAt: Date.now(), error: e?.message || "upstream_unreachable" },
        }));
      }
    },
    [builderStatusById]
  );

  const handleDeleteBuilderProject = async (id: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      await api.builderDeleteProject(id);
      setBuilderProjects((s) => s.filter((p: any) => p.id !== id));
    } catch (e) {
      console.warn(e);
      alert("Failed to delete project");
    }
  };

  const handleDeleteDapp = async (id: string) => {
    if (!confirm("Delete this DApp? This cannot be undone.")) return;
    try {
      await api.builderDeleteProject(id);
      setDapps((s) => s.filter((p: any) => p.id !== id));
    } catch (e) {
      console.warn(e);
      alert("Failed to delete DApp");
    }
  };

  useEffect(() => {
    loadJobs();
    (async () => {
      try {
        const res = await api.builderListProjects({ limit: 30, refresh: true });
        setBuilderProjects((res as any)?.projects || []);
      } catch {
        setBuilderProjects([]);
      }
    })();
    loadDapps();
  }, []);

  const loadDapps = async () => {
    try {
      const res = await api.builderListDapps({ limit: 30 });
      setDapps((res as any)?.projects || []);
    } catch {
      setDapps([]);
    }
  };

  const createDapp = async () => {
    const prompt = dappPrompt.trim();
    if (!prompt) return;
    setDappLoading(true);
    try {
      const res = await api.builderCreateDapp({ prompt, network: "avalanche-fuji" });
      const proj = (res as any)?.project;
      if (proj?.id) {
        setDappPrompt("");
        router.push(`/chat/${encodeURIComponent(proj.id)}?mode=dapp`);
        return;
      }
      throw new Error("Failed to create DApp");
    } catch (e: any) {
      alert(e?.message || "Failed to create DApp");
    } finally {
      setDappLoading(false);
    }
  };

  const createBuilderProject = async () => {
    const prompt = builderPrompt.trim();
    if (!prompt) return;
    setBuilderLoading(true);
    try {
      const res = await api.builderCreateProject({ prompt });
      const proj = (res as any)?.project;
      if (proj?.id) {
        setBuilderPrompt("");
        router.push(`/chat/${encodeURIComponent(proj.id)}?mode=builder`);
        return;
      }
      throw new Error("Failed to create project");
    } catch (e: any) {
      alert(e?.message || "Failed to create builder project");
    } finally {
      setBuilderLoading(false);
    }
  };

  const loadJobs = async (reset = true) => {
    setIsLoading(true);
    try {
      const res = await api.listUserJobsCached({ q: q || undefined, type: filterType || undefined, state: filterState || undefined, network: filterNetwork || undefined, limit: 20 });
      if (res?.jobs) {
        const mapped = res.jobs.map((j: any) => ({ ...j }));
        setJobs(reset ? mapped : (s) => [...s, ...mapped]);
        setNextCursor(res.nextCursor || null);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    setIsLoading(true);
    try {
      const res = await api.listUserJobsCached({ q: q || undefined, type: filterType || undefined, state: filterState || undefined, network: filterNetwork || undefined, limit: 20, cursorCreatedAt: nextCursor.created_at, cursorId: nextCursor.job_id });
      if (res?.jobs) {
        setJobs((s) => [...s, ...res.jobs]);
        setNextCursor(res.nextCursor || null);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm("Delete this job? This cannot be undone.")) return;
    try {
      await api.deleteUserJob(jobId);
      setJobs((s) => s.filter((j) => j.job_id !== jobId));
    } catch (e) {
      console.warn(e);
      alert("Failed to delete job");
    }
  };

  const handleExport = async (jobId: string, title?: string) => {
    try {
      const res = await api.exportUserJob(jobId);
      const data = typeof res === "string" ? res : JSON.stringify(res, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || jobId).replace(/[^a-z0-9-_\.]/gi, "_")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn(e);
      alert("Failed to export job");
    }
  };

  // Toggle job expansion and load details
  const toggleExpand = async (jobId: string) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(jobId);
    if (!jobDetails[jobId]) {
      setLoadingDetails(jobId);
      try {
        const res = await api.getUserJob(jobId);
        if (res?.job) {
          setJobDetails((prev) => ({ ...prev, [jobId]: res.job }));
        }
      } catch (e) {
        console.warn("Failed to load job details:", e);
      } finally {
        setLoadingDetails(null);
      }
    }
  };

  // Copy address to clipboard
  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (e) {
      console.warn(e);
    }
  };

  // Get explorer URL for a contract
  const getExplorerUrl = (network: string, address: string) => {
    const base = EXPLORER_URLS[network] || EXPLORER_URLS["avalanche-fuji"];
    return `${base}/address/${address}`;
  };

  // Format prompt for display (truncate)
  const formatPrompt = (prompt?: string, maxLen = 150) => {
    if (!prompt) return "No prompt available";
    return prompt.length > maxLen ? prompt.slice(0, maxLen) + "..." : prompt;
  };

  return (
    <div className="p-6 pt-36 page-transition">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold text-white mb-4">Projects</h1>

        <div className="flex items-center gap-2 mb-5 border border-white/10 bg-white/5 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setActiveTab("contracts")}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "contracts" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}
          >
            Smart Contracts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("frontend")}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "frontend" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}
          >
            Frontend Builder
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dapps")}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "dapps" ? "bg-white/10 text-white" : "text-white/60 hover:text-white"}`}
          >
            DApps
          </button>
        </div>

        {activeTab === "frontend" && (
        <div className="bg-[#0a0a0a] rounded-lg p-4 border border-white/5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-medium">Frontend Builder</h2>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await api.builderListProjects({ limit: 30, refresh: true });
                  setBuilderProjects((res as any)?.projects || []);
                } catch {}
              }}
              className="text-xs px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70"
            >
              Refresh
            </button>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              value={builderPrompt}
              onChange={(e) => setBuilderPrompt(e.target.value)}
              placeholder="Describe the frontend you want to build..."
              className="flex-1 bg-white/5 rounded-md p-2 text-white placeholder:text-white/50"
            />
            <button
              type="button"
              onClick={createBuilderProject}
              disabled={builderLoading || !builderPrompt.trim()}
              className="px-4 py-2 rounded-md bg-white/6 hover:bg-white/10 disabled:opacity-50"
            >
              {builderLoading ? "Creating..." : "Create"}
            </button>
          </div>
          {builderProjects.length === 0 ? (
            <div className="text-sm text-white/40 py-2">No frontend projects yet</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {builderProjects.map((p: any) => {
                const st = builderStatusById[p.id];
                const upstreamBuildStatus = String(st?.status?.build_status || st?.status?.status || "").toLowerCase();
                const statusRaw = upstreamBuildStatus || String(p.build_status || p.status || "").toLowerCase();
                const hasStatusError = !!st?.error;

                const state = hasStatusError
                  ? "status_unavailable"
                  : statusRaw.includes("deploy")
                  ? "deployed"
                  : statusRaw.includes("fail") || statusRaw.includes("error")
                  ? "failed"
                  : statusRaw.includes("build") || statusRaw.includes("run") || statusRaw.includes("progress")
                  ? "building"
                  : statusRaw.includes("complete") || statusRaw.includes("done")
                  ? "completed"
                  : p.vercel_url
                  ? "deployed"
                  : statusRaw === "unknown"
                  ? "pending"
                  : statusRaw || "pending";

                const title = p.title || `Project ${String(p.id).slice(0, 8)}`;
                const isExpanded = expandedBuilder === p.id;

                return (
                  <div key={p.id} className="rounded-lg bg-white/[0.02] border border-white/5 overflow-hidden">
                    <div
                      className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-white/[0.02]"
                      onClick={() => {
                        setExpandedBuilder((cur) => {
                          const next = cur === p.id ? null : p.id;
                          if (next) void maybeFetchBuilderStatus(p.id);
                          return next;
                        });
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-white font-medium truncate">{title}</h3>
                          <StatusBadge state={state} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/40 mt-2">
                          {p.created_at && <span>{new Date(p.created_at).toLocaleString()}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/40 mt-1">
                          {p.vercel_url && (
                            <a
                              href={p.vercel_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-400 hover:underline truncate"
                            >
                              {p.vercel_url.replace(/^https?:\/\//, "").slice(0, 42)}...
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {p.vercel_url && (
                          <button
                            title="Open deployment"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(p.vercel_url, "_blank", "noopener,noreferrer");
                            }}
                            className="p-2 rounded-md hover:bg-white/10 text-white/60 hover:text-white"
                          >
                            <Globe className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          title="Download ZIP"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const buf = await api.builderDownloadZip(p.id);
                              const blob = new Blob([buf], { type: "application/zip" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `${(title || p.id).replace(/[^a-z0-9-_\.]/gi, "_")}.zip`;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              URL.revokeObjectURL(url);
                            } catch (err) {
                              console.warn(err);
                              alert("Failed to download ZIP");
                            }
                          }}
                          className="p-2 rounded-md hover:bg-white/10 text-white/60 hover:text-white"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          title="Open"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/chat/${encodeURIComponent(p.id)}?mode=builder`);
                          }}
                          className="p-2 rounded-md hover:bg-white/10 text-white/60 hover:text-white"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBuilderProject(p.id);
                          }}
                          className="p-2 rounded-md hover:bg-red-500/20 text-white/60 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="p-2 text-white/40">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-white/5 bg-white/[0.01] p-4 space-y-2">
                        {builderStatusById[p.id]?.error && (
                          <div className="text-xs text-white/50">
                            <span className="text-white/40">Status:</span> unavailable (upstream unreachable)
                          </div>
                        )}
                        {p.vercel_url && (
                          <div className="text-xs text-white/50 break-all">
                            <span className="text-white/40">Deployment:</span> {p.vercel_url}
                          </div>
                        )}
                        {p.github_url && (
                          <div className="text-xs text-white/50 break-all">
                            <span className="text-white/40">GitHub:</span> {p.github_url}
                          </div>
                        )}
                        <div className="text-xs text-white/50 break-all">
                          <span className="text-white/40">Project ID:</span> {p.id}
                        </div>
                        {p.fb_project_id && (
                          <div className="text-xs text-white/50 break-all">
                            <span className="text-white/40">FB ID:</span> {p.fb_project_id}
                          </div>
                        )}
                        {builderStatusById[p.id]?.status?.build_status && (
                          <div className="text-xs text-white/50 break-all">
                            <span className="text-white/40">Build status:</span> {String(builderStatusById[p.id]?.status?.build_status)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* ═══════ DApps Section ═══════ */}
        {activeTab === "dapps" && (
        <div className="bg-[#0a0a0a] rounded-lg p-4 border border-white/5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-medium flex items-center gap-2">
              <span className="text-purple-400">⬡</span> DApps
              <span className="text-xs text-white/40 font-normal">(Contract + Frontend)</span>
            </h2>
            <button
              type="button"
              onClick={loadDapps}
              className="text-xs px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70"
            >
              Refresh
            </button>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              value={dappPrompt}
              onChange={(e) => setDappPrompt(e.target.value)}
              placeholder="Describe the DApp you want to create (contract + frontend)..."
              className="flex-1 bg-white/5 rounded-md p-2 text-white placeholder:text-white/50"
              onKeyDown={(e) => e.key === "Enter" && createDapp()}
            />
            <select className="bg-white/5 text-white/60 rounded-md px-2 text-sm" defaultValue="avalanche-fuji" disabled>
              <option value="avalanche-fuji">Avalanche Fuji</option>
            </select>
            <button
              type="button"
              onClick={createDapp}
              disabled={dappLoading || !dappPrompt.trim()}
              className="px-4 py-2 rounded-md bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 disabled:opacity-50 text-sm font-medium"
            >
              {dappLoading ? "Creating..." : "Create DApp"}
            </button>
          </div>
          {dapps.length === 0 ? (
            <div className="text-sm text-white/40 py-2">No DApps yet. Create one above to deploy a smart contract with a frontend.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dapps.map((p: any) => (
                <DAppCard
                  key={p.id}
                  project={p}
                  onOpen={(id) => router.push(`/chat/${encodeURIComponent(id)}?mode=dapp`)}
                  onDelete={handleDeleteDapp}
                />
              ))}
            </div>
          )}
        </div>
        )}

        {activeTab === "contracts" && (
        <>
        <div className="flex gap-2 items-center mb-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, filename, prompt" className="flex-1 bg-white/5 rounded-md p-2 text-white placeholder:text-white/50" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-white/5 text-white rounded-md p-2">
            <option value="">All types</option>
            <option value="pipeline">Pipeline</option>
            <option value="wallet_deploy">Wallet_deploy</option>
          </select>
          <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="bg-white/5 text-white rounded-md p-2">
            <option value="">All states</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <select value={filterNetwork} onChange={(e) => setFilterNetwork(e.target.value)} className="bg-white/5 text-white rounded-md p-2">
            <option value="">All networks</option>
            <option value="avalanche-fuji">avalanche-fuji</option>
          </select>
          <button onClick={() => loadJobs(true)} className="px-4 py-2 rounded-md bg-white/6 hover:bg-white/10">Filter</button>
        </div>

        <div className="bg-[#0a0a0a] rounded-lg p-4 border border-white/5">
          {isLoading && jobs.length === 0 ? (
            <ProjectListSkeleton />
          ) : jobs.length === 0 ? (
            <div className="py-12 text-center text-white/40">No projects found</div>
          ) : (
            <div className="space-y-3">
              {jobs.map((j) => {
                const isExpanded = expandedJob === j.job_id;
                const details = jobDetails[j.job_id];
                const cache = j.cache || details?.cache;
                const contractAddress = cache?.address;
                const network = j.network || cache?.network || "avalanche-fuji";
                const state = cache?.state || j.state || "pending";
                const progress = cache?.progress;
                const fqName = cache?.fq_name;
                const contractName = fqName?.split(":").pop() || j.filename?.replace(".sol", "") || "Contract";
                const verified = cache?.verified === true;
                const explorerUrl = cache?.explorer_url;

                return (
                  <div key={j.job_id} className="rounded-lg bg-white/[0.02] border border-white/5 overflow-hidden transition-all">
                    {/* Main row - clickable to expand */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02]"
                      onClick={() => toggleExpand(j.job_id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-white font-medium truncate">{j.title || j.filename || contractName}</h3>
                          <StatusBadge state={state} progress={progress} />
                          <NetworkBadge network={network} />
                          {verified && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 font-medium">
                              <ShieldCheck className="w-3 h-3" />
                              Verified
                            </span>
                          )}
                        </div>
                        <p className="text-white/50 text-sm mt-1 truncate">
                          {formatPrompt(j.prompt || details?.prompt, 100)}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                          <span>{new Date(j.created_at).toLocaleString()}</span>
                          {j.filename && (
                            <span className="flex items-center gap-1">
                              <FileCode className="w-3 h-3" />
                              {j.filename}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          title="Open in Chat"
                          onClick={(e) => { e.stopPropagation(); router.push(`/chat/${j.job_id}`); }}
                          className="p-2 rounded-md hover:bg-white/10 text-white/60 hover:text-white"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          title="Export"
                          onClick={(e) => { e.stopPropagation(); handleExport(j.job_id, j.title); }}
                          className="p-2 rounded-md hover:bg-white/10 text-white/60 hover:text-white"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          title="Delete"
                          onClick={(e) => { e.stopPropagation(); handleDelete(j.job_id); }}
                          className="p-2 rounded-md hover:bg-red-500/20 text-white/60 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="p-2 text-white/40">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-white/5 bg-white/[0.01] p-4">
                        {loadingDetails === j.job_id ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Contract Address with Explorer Link */}
                            {contractAddress && (
                              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4">
                                <h4 className="text-green-400 font-medium text-sm mb-2">✨ Deployed Contract</h4>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <code className="text-white font-mono text-sm bg-black/30 px-3 py-1.5 rounded">
                                    {contractAddress}
                                  </code>
                                  <button
                                    onClick={() => copyAddress(contractAddress)}
                                    className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white"
                                    title="Copy address"
                                  >
                                    {copiedAddress === contractAddress ? (
                                      <Check className="w-4 h-4 text-green-400" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                  <a
                                    href={getExplorerUrl(network, contractAddress)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-sm font-medium"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View on Explorer
                                  </a>
                                </div>
                                {fqName && (
                                  <p className="text-white/50 text-xs mt-2">
                                    Contract: <span className="text-white/70">{fqName}</span>
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Job Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-white/[0.02] rounded-lg p-3">
                                <p className="text-white/40 text-xs uppercase tracking-wider">Status</p>
                                <p className="text-white font-medium mt-1 capitalize">{state}</p>
                              </div>
                              <div className="bg-white/[0.02] rounded-lg p-3">
                                <p className="text-white/40 text-xs uppercase tracking-wider">Network</p>
                                <p className="text-white font-medium mt-1">{network}</p>
                              </div>
                              <div className="bg-white/[0.02] rounded-lg p-3">
                                <p className="text-white/40 text-xs uppercase tracking-wider">Progress</p>
                                <p className="text-white font-medium mt-1">{progress !== undefined ? `${progress}%` : "N/A"}</p>
                              </div>
                              <div className="bg-white/[0.02] rounded-lg p-3">
                                <p className="text-white/40 text-xs uppercase tracking-wider">Type</p>
                                <p className="text-white font-medium mt-1 capitalize">{j.type || "pipeline"}</p>
                              </div>
                              <div className="bg-white/[0.02] rounded-lg p-3">
                                <p className="text-white/40 text-xs uppercase tracking-wider">Verified</p>
                                <p className={`font-medium mt-1 flex items-center gap-1 ${verified ? "text-emerald-400" : "text-white/50"}`}>
                                  {verified ? <><ShieldCheck className="w-3.5 h-3.5" /> Yes</> : "No"}
                                </p>
                              </div>
                              {explorerUrl && (
                                <div className="bg-white/[0.02] rounded-lg p-3">
                                  <p className="text-white/40 text-xs uppercase tracking-wider">Explorer</p>
                                  <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 text-sm hover:underline mt-1 flex items-center gap-1 truncate"
                                  >
                                    <ExternalLink className="w-3 h-3 shrink-0" /> View
                                  </a>
                                </div>
                              )}
                            </div>

                            {/* Prompt */}
                            {(j.prompt || details?.prompt) && (
                              <div className="bg-white/[0.02] rounded-lg p-4">
                                <h4 className="text-white/60 text-sm font-medium mb-2">Prompt</h4>
                                <p className="text-white/80 text-sm whitespace-pre-wrap">
                                  {j.prompt || details?.prompt}
                                </p>
                              </div>
                            )}

                            {/* Tags */}
                            {j.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {j.tags.map((t: string) => (
                                  <span key={t} className="text-xs text-white/60 bg-white/5 px-2 py-1 rounded-full">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Timestamps */}
                            <div className="flex gap-4 text-xs text-white/40 pt-2 border-t border-white/5">
                              <span>Created: {new Date(j.created_at).toLocaleString()}</span>
                              {j.updated_at && <span>Updated: {new Date(j.updated_at).toLocaleString()}</span>}
                              {cache?.completed_at && <span>Completed: {new Date(cache.completed_at).toLocaleString()}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {nextCursor && (
                <div className="text-center py-4">
                  <button onClick={loadMore} className="px-4 py-2 rounded-md bg-white/6 hover:bg-white/10">Load more</button>
                </div>
              )}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
