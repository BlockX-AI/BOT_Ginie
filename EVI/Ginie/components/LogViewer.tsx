"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { ExternalLink, AlertCircle, AlertTriangle, Info, CheckCircle, Bug, Loader2, Shield, Search } from "lucide-react";

interface LogViewerProps {
  logs: string[];
  className?: string;
  currentStage?: string;
  progress?: number | null;
}

// Network explorer URLs
const EXPLORER_URLS: Record<string, string> = {
  "avalanche-fuji": "https://testnet.snowtrace.io",
  "avalanche-mainnet": "https://snowtrace.io",
  "ethereum-sepolia": "https://sepolia.etherscan.io",
  "ethereum-mainnet": "https://etherscan.io",
};

// Parse and categorize log lines
type LogLineType = "stage" | "info" | "debug" | "warn" | "error" | "success" | "deploy" | "done" | "magical" | "normal";

interface ParsedLine {
  type: LogLineType;
  content: string;
  stage?: string;
  address?: string;
  network?: string;
  contract?: string;
}

// Clean emojis from text
function stripEmojis(text: string): string {
  return text
    .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/[\u2600-\u26FF]/g, "")
    .replace(/[\u2700-\u27BF]/g, "")
    .replace(/✨|✅|❌|⚠️|🔍|ℹ️|🔧|💡|🚀|🎉|⭐|🔥|💻|📦|🔗|🌐/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseLine(line: string): ParsedLine {
  // Stage header: ─── ▶ Stage: generate [info]
  const stageMatch = line.match(/^─+\s*▶\s*Stage:\s*(\w+)/i);
  if (stageMatch) {
    return { type: "stage", content: line, stage: stageMatch[1] };
  }

  // Deploy result with address
  const deployMatch = line.match(/DEPLOY_RESULT\s*({.*})/);
  if (deployMatch) {
    try {
      const data = JSON.parse(deployMatch[1]);
      return {
        type: "deploy",
        content: line,
        address: data.address,
        network: data.network,
        contract: data.contract || data.fqName?.split(":").pop(),
      };
    } catch {
      return { type: "info", content: line };
    }
  }

  // Address in log
  const addressMatch = line.match(/address[=:]\s*(0x[a-fA-F0-9]{40})/i);
  if (addressMatch) {
    return { type: "success", content: line, address: addressMatch[1] };
  }

  // Done/completed
  if (line.includes("[done]") || line.toLowerCase().includes("job completed")) {
    return { type: "done", content: line };
  }

  // Success indicators
  if (line.includes("✨") || line.includes("✅") || line.toLowerCase().includes("success")) {
    return { type: "success", content: line };
  }

  // Error
  if (line.startsWith("[error]") || line.includes("Error:") || line.includes("❌")) {
    return { type: "error", content: line };
  }

  // Warning
  if (line.startsWith("[warn]") || line.includes("⚠️") || line.includes("Warning:")) {
    return { type: "warn", content: line };
  }

  // Debug
  if (line.startsWith("[debug]")) {
    return { type: "debug", content: line };
  }

  // Info
  if (line.startsWith("[info]")) {
    return { type: "info", content: line };
  }

  // Magical/whimsical messages (contain certain keywords)
  const magicalKeywords = ["scroll", "rune", "ancient", "spell", "mystical", "cauldron", "stardust", "void", "incantation", "sigil", "glyph", "spirit", "sage", "summoning", "ethereal", "blockchain riddle"];
  if (magicalKeywords.some(k => line.toLowerCase().includes(k))) {
    return { type: "magical", content: line };
  }

  return { type: "normal", content: line };
}

// Style classes for each log type - improved spacing
const typeStyles: Record<LogLineType, string> = {
  stage: "text-cyan-400 font-semibold text-sm py-3 mt-4 first:mt-0 border-l-2 border-cyan-500 pl-3 bg-cyan-500/5",
  info: "text-white/80 py-1",
  debug: "text-white/40 text-[11px] py-0.5 font-mono",
  warn: "text-amber-400 py-1.5 bg-amber-500/5 px-2 rounded",
  error: "text-red-400 py-1.5 bg-red-500/5 px-2 rounded",
  success: "text-emerald-400 py-1.5",
  deploy: "text-emerald-400 font-medium py-2",
  done: "text-green-400 font-semibold py-2 mt-2",
  magical: "text-white/50 italic py-0.5 text-[11px]",
  normal: "text-white/60 py-0.5",
};

// Pipeline stages in order
const PIPELINE_STAGES = [
  { key: "generate", label: "Generate" },
  { key: "compile", label: "Compile" },
  { key: "deploy", label: "Deploy" },
  { key: "verify", label: "Verify" },
  { key: "completed", label: "Done" },
];

function PipelineStepper({ currentStage, progress }: { currentStage: string; progress: number | null }) {
  const stageIndex = PIPELINE_STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="px-2 py-3">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress ?? 0}%` }}
        />
      </div>
      {/* Stage dots */}
      <div className="flex items-center justify-between">
        {PIPELINE_STAGES.map((stage, i) => {
          const isActive = stage.key === currentStage;
          const isDone = stageIndex > i || currentStage === "completed";
          const isFuture = stageIndex < i && currentStage !== "completed";
          return (
            <div key={stage.key} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : isActive
                    ? "bg-cyan-500 text-white ring-2 ring-cyan-500/40 animate-pulse"
                    : "bg-white/10 text-white/30"
                }`}
              >
                {isDone ? (
                  <CheckCircle className="w-3 h-3" />
                ) : isActive ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-[10px] leading-tight ${
                  isDone ? "text-emerald-400" : isActive ? "text-cyan-400 font-medium" : "text-white/30"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LogViewer({ logs, className = "", currentStage = "", progress = null }: LogViewerProps) {
  const parsedLogs = useMemo(() => {
    return logs.map(parseLine);
  }, [logs]);

  // Auto-scroll to bottom
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  // Extract final deployed address and network if available
  const deployInfo = useMemo(() => {
    for (let i = parsedLogs.length - 1; i >= 0; i--) {
      const p = parsedLogs[i];
      if (p.type === "deploy" && p.address) {
        return { address: p.address, network: p.network, contract: p.contract };
      }
      if (p.address) {
        const networkMatch = logs.slice(Math.max(0, i - 10), i + 10).join(" ").match(/network[=:]\s*([a-z-]+)/i);
        return { address: p.address, network: networkMatch?.[1] || "avalanche-fuji", contract: p.contract };
      }
    }
    return null;
  }, [parsedLogs, logs]);

  if (logs.length === 0) {
    return (
      <div className={`text-white/40 text-sm text-center py-8 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-white/20" />
        Waiting for pipeline updates...
      </div>
    );
  }

  return (
    <div className={`space-y-1 font-mono text-xs ${className}`}>
      {/* Pipeline stepper */}
      {currentStage && <PipelineStepper currentStage={currentStage} progress={progress} />}
      {/* Deployed contract banner */}
      {deployInfo?.address && (
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-green-400 text-sm font-medium mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Contract Deployed{deployInfo.contract ? `: ${deployInfo.contract}` : ""}
              </p>
              <code className="text-white font-mono text-sm bg-black/40 px-3 py-1.5 rounded block">
                {deployInfo.address}
              </code>
            </div>
            <a
              href={`${EXPLORER_URLS[deployInfo.network || "avalanche-fuji"] || EXPLORER_URLS["avalanche-fuji"]}/address/${deployInfo.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-500 text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on Explorer
            </a>
          </div>
        </div>
      )}

      {/* Log lines */}
      {parsedLogs.map((parsed, i) => {
        const { type, content, stage } = parsed;

        // Stage headers get special rendering
        if (type === "stage") {
          return (
            <div key={i} className={typeStyles[type]}>
              <span className="uppercase tracking-wider">Stage: {stage}</span>
            </div>
          );
        }

        // Skip redundant magical messages
        if (type === "magical") {
          const isDuplicate = parsedLogs.slice(0, i).some(p => p.content === content);
          if (isDuplicate) return null;
        }

        // Clean up content - remove emojis and log level prefixes
        let displayContent = stripEmojis(content);

        // Remove log level prefixes
        displayContent = displayContent
          .replace(/^\[info\]\s*/i, "")
          .replace(/^\[debug\]\s*/i, "")
          .replace(/^\[warn\]\s*/i, "")
          .replace(/^\[error\]\s*/i, "")
          .replace(/^\[done\]\s*/i, "");

        // Skip empty lines after cleanup
        if (!displayContent.trim()) return null;

        // Render with appropriate icon
        const IconMap: Record<LogLineType, React.ReactNode> = {
          info: <Info className="w-3 h-3 text-blue-400 shrink-0" />,
          debug: <Bug className="w-3 h-3 text-white/30 shrink-0" />,
          warn: <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />,
          error: <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />,
          success: <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />,
          deploy: <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />,
          done: <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />,
          magical: null,
          normal: null,
          stage: null,
        };

        const icon = IconMap[type];

        // Special rendering for verification lines
        if (content.includes("Verifying contract") || content.includes("verification")) {
          return (
            <div key={i} className={`flex items-start gap-2 py-2 px-2 bg-blue-500/5 rounded border-l-2 border-blue-500 ${typeStyles[type]}`}>
              <Search className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <span className="break-words text-blue-300">{displayContent}</span>
            </div>
          );
        }

        // Special rendering for verified success
        if (content.includes("verified successfully")) {
          return (
            <div key={i} className="flex items-start gap-2 py-2 px-2 bg-emerald-500/10 rounded border-l-2 border-emerald-500">
              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="break-words text-emerald-300 font-medium">{displayContent}</span>
            </div>
          );
        }

        return (
          <div key={i} className={`flex items-start gap-2 ${typeStyles[type]}`}>
            {icon}
            <span className="break-words">{displayContent}</span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

export default LogViewer;
