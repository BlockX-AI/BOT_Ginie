"use client";

import React from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, polygon, baseSepolia, base, avalancheFuji, type Chain } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";

// Ethereum Sepolia chain (already imported from wagmi/chains as baseSepolia)

// Create query client as singleton
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Create config with injected connector (MetaMask, etc.)
// Include avalancheFuji as the PRIMARY chain for wallet-based deployments
const walletConfig = createConfig({
  chains: [avalancheFuji, baseSepolia, base, mainnet, polygon],
  connectors: [injected()],
  transports: {
    [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
    [baseSepolia.id]: http(),
    [base.id]: http(),
    [mainnet.id]: http(),
    [polygon.id]: http(),
  },
  ssr: true,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Always render WagmiProvider - wagmi handles SSR with ssr: true config
  // This ensures wagmi hooks work during both SSR and client-side rendering
  return (
    <WagmiProvider config={walletConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { walletConfig, avalancheFuji };
