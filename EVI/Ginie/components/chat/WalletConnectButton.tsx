"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { avalancheFuji } from "@/components/web3/WalletProvider";
import { Wallet, ChevronDown, LogOut, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface WalletConnectButtonProps {
  className?: string;
  requiredChainId?: number;
}

export function WalletConnectButton({
  className,
  requiredChainId = avalancheFuji.id, // Use Avalanche Fuji as default deployment network
}: WalletConnectButtonProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [isOpen, setIsOpen] = useState(false);

  const isWrongChain = isConnected && chainId !== requiredChainId;

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = async () => {
    // Use the first available connector (usually injected/MetaMask)
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    }
    setIsOpen(false);
  };

  const handleSwitchChain = () => {
    switchChain({ chainId: requiredChainId });
  };

  if (isConnected && address) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {isWrongChain && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwitchChain}
            disabled={isSwitching}
            className="gap-2 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
          >
            <AlertCircle size={14} />
            {isSwitching ? "Switching..." : "Switch to Avalanche Fuji"}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-2 bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20",
                isWrongChain && "bg-amber-500/10 border-amber-500/30 text-amber-400"
              )}
            >
              <Wallet size={14} />
              <span>{truncateAddress(address)}</span>
              {!isWrongChain && <Check size={14} />}
              <ChevronDown size={14} className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              {address}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => disconnect()}
              className="text-red-400 focus:text-red-400"
            >
              <LogOut size={14} className="mr-2" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Simple connect button - wagmi will auto-detect available wallets
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending || connectors.length === 0}
      onClick={handleConnect}
      className={cn(
        "gap-2 bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white",
        className
      )}
    >
      <Wallet size={14} />
      {isPending ? "Connecting..." : "Connect Wallet"}
    </Button>
  );
}
