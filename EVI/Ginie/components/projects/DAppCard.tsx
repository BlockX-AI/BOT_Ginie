"use client";

import React, { useState } from "react";
import { ExternalLink, Globe, Copy, Check, FileCode, Layers, CheckCircle2, Trash2 } from "lucide-react";

type DAppProject = {
  id: string;
  fb_project_id: string;
  title: string | null;
  status: string | null;
  vercel_url: string | null;
  github_url: string | null;
  project_type: string;
  contract_address: string | null;
  contract_network: string | null;
  contract_chain_id: number | null;
  contract_explorer_url: string | null;
  contract_verified: boolean;
  contract_name: string | null;
  created_at: string;
};

const EXPLORER_URLS: Record<string, string> = {
  "avalanche-fuji": "https://testnet.snowtrace.io",
  "avalanche-mainnet": "https://snowtrace.io",
  "ethereum-sepolia": "https://sepolia.etherscan.io",
  "ethereum-mainnet": "https://etherscan.io",
};

function getExplorerUrl(network: string, address: string): string {
  const base = EXPLORER_URLS[network] || EXPLORER_URLS["avalanche-fuji"];
  return `${base}/address/${address}`;
}

const StatusDot = ({ status }: { status?: string | null }) => {
  const map: Record<string, string> = {
    completed: "bg-green-400",
    deployed: "bg-green-400",
    running: "bg-blue-400 animate-pulse",
    building: "bg-blue-400 animate-pulse",
    failed: "bg-red-400",
    pending: "bg-yellow-400",
  };
  return <span className={`w-2 h-2 rounded-full inline-block ${map[status || ""] || "bg-white/30"}`} />;
};

export default function DAppCard({
  project,
  onOpen,
  onDelete,
}: {
  project: DAppProject;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (!project.contract_address) return;
    navigator.clipboard.writeText(project.contract_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const network = project.contract_network || "avalanche-fuji";
  const hasContract = !!project.contract_address;
  const hasFrontend = !!project.vercel_url;
  const typeBadge = project.project_type === "dapp" ? "DApp" : project.project_type === "dapp_frontend" ? "Frontend" : "Project";

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden hover:border-white/10 transition-colors">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 text-purple-400 shrink-0" />
            <h3 className="text-white font-medium truncate text-sm">
              {project.title || `Project ${project.id.slice(0, 8)}`}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium uppercase tracking-wider">
              {typeBadge}
            </span>
            <StatusDot status={project.status} />
          </div>
        </div>

        {/* Contract info */}
        {hasContract && (
          <div className="bg-green-500/5 border border-green-500/10 rounded-md p-2.5 mb-2">
            <div className="flex items-center gap-1.5 mb-1">
              <FileCode className="w-3 h-3 text-green-400" />
              <span className="text-green-400 text-xs font-medium">
                {project.contract_name || "Contract"}
                {project.contract_verified && (
                  <CheckCircle2 className="w-3 h-3 inline ml-1 text-green-400" />
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <code className="text-white/80 text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded truncate">
                {project.contract_address}
              </code>
              <button onClick={copyAddress} className="p-0.5 hover:bg-white/10 rounded text-white/40 hover:text-white">
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
              <a
                href={project.contract_explorer_url || getExplorerUrl(network, project.contract_address!)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-0.5 hover:bg-white/10 rounded text-white/40 hover:text-blue-400"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Frontend info */}
        {hasFrontend && (
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-md p-2.5 mb-2">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-blue-400" />
              <a
                href={project.vercel_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-xs hover:underline truncate"
              >
                {project.vercel_url}
              </a>
            </div>
          </div>
        )}

        {/* Footer: network + date */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400">
              <Globe className="w-2.5 h-2.5" />
              {network}
            </span>
          </div>
          <span className="text-[10px] text-white/30">
            {new Date(project.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="border-t border-white/5 px-4 py-2 flex items-center justify-end gap-2">
        {onDelete && (
          <button
            onClick={() => onDelete(project.id)}
            className="p-2 rounded-md hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onOpen(project.id)}
          className="text-xs px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
        >
          Open
        </button>
      </div>
    </div>
  );
}
