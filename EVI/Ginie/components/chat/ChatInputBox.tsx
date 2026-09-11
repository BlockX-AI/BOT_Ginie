"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Paperclip, Settings, ArrowUp, Gamepad2 } from "lucide-react";
import { DeploymentModeSelector, type DeploymentMode } from "./DeploymentModeSelector";
import { WalletConnectButton } from "./WalletConnectButton";

interface ChatInputBoxProps {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  deploymentMode?: DeploymentMode;
  onDeploymentModeChange?: (mode: DeploymentMode) => void;
  hasWalletEntitlement?: boolean;
  hasDappEntitlement?: boolean;
  showWalletConnect?: boolean;
  gameMode?: boolean;
  onGameModeChange?: (enabled: boolean) => void;
}

export function ChatInputBox({
  input,
  isLoading,
  onInputChange,
  onSubmit,
  deploymentMode = "normal",
  onDeploymentModeChange,
  hasWalletEntitlement = false,
  hasDappEntitlement = false,
  showWalletConnect = false,
  gameMode = false,
  onGameModeChange,
}: ChatInputBoxProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm transition-colors">
        <Input
          type="text"
          placeholder={deploymentMode === "dapp" ? "Describe your DApp (contract + frontend)..." : deploymentMode === "frontend" ? "Describe the website or web app you want to build..." : deploymentMode === "wallet" ? "Describe your smart contract (wallet deploy)" : "Describe your smart contract..."}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          disabled={isLoading}
          className=" bg-transparent text-white placeholder:text-white/40 focus-visible:ring-0 text-lg"
        />

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-white"
            >
              <Plus size={20} />
            </button>
            <button
              type="button"
              className="p-2 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-white"
            >
              <Paperclip size={20} />
            </button>
            {onDeploymentModeChange && (
              <DeploymentModeSelector
                mode={deploymentMode}
                onModeChange={onDeploymentModeChange}
                disabled={isLoading}
                hasWalletEntitlement={hasWalletEntitlement}
                hasDappEntitlement={hasDappEntitlement}
              />
            )}
            {/* Game Mode Toggle - only show when in dapp mode */}
            {deploymentMode === "dapp" && onGameModeChange && (
              <button
                type="button"
                onClick={() => onGameModeChange(!gameMode)}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  gameMode
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 ring-1 ring-purple-500/20'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={gameMode ? "Game Mode ON - Will generate interactive game UI" : "Game Mode OFF - Will generate standard website"}
              >
                <Gamepad2 size={16} />
                <span>{gameMode ? 'Game Mode' : 'Website'}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showWalletConnect && deploymentMode === "wallet" && (
              <WalletConnectButton />
            )}
            <button
              type="button"
              className="p-2 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-white"
            >
              <Settings size={20} />
            </button>
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              size="icon"
              className={`rounded-full w-10 h-10 shadow-lg transform transition-all ${
                !input.trim()
                  ? 'bg-white/6 text-white/30 cursor-not-allowed'
                  : isLoading
                  ? 'bg-white/5 text-white border border-white/30 ring-1 ring-white/20 backdrop-blur-sm opacity-90'
                  : 'bg-white/5 text-white border border-white/20 ring-1 ring-white/20 backdrop-blur-sm hover:scale-105'
              }`}
            >
              <ArrowUp size={16} strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
