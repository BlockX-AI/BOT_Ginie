"""
Deterministic DApp shell files.

These are the "golden" copies of the ABI-driven Web3 frontend. They are:
  1. Seeded into the sandbox when the react-app is first initialized (service.py)
  2. Restored right before the production build (application_checker) so that
     any damage done by the LLM builder/validator is always overwritten.

The contract config (src/config/contract.js, src/contracts/*.json, .env*) is
written separately by the orchestrator with the real address/ABI, and is
protected via context.json["protected_files"].
"""

REACT_APP_BASE = "/home/user/react-app"

# Files that must never be left in a broken/boilerplate state.
# Paths are relative to the react-app root.
# NOTE: src/App.jsx is NOT protected so the builder can create custom routing
# (e.g., LandingPage + AppPage for DApps). The builder is responsible for
# creating a valid App.jsx with proper imports and routing.
PROTECTED_SHELL_PATHS = [
    "src/main.jsx",
    # "src/App.jsx",  # REMOVED - allow builder to create custom routing
    "src/config/wagmi.js",
    "src/config/appMeta.js",
    "src/config/contract.js",
    "src/index.css",
    "package.json",
    "vite.config.js",
    "index.html",
]

PACKAGE_JSON = '''{
  "name": "react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "wagmi": "^2.12.0",
    "viem": "^2.21.0",
    "@rainbow-me/rainbowkit": "^2.1.0",
    "@tanstack/react-query": "^5.51.0",
    "framer-motion": "^11.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "@tailwindcss/vite": "^4.0.0",
    "vite": "^5.0.8",
    "tailwindcss": "^4.0.0"
  }
}'''

VITE_CONFIG = '''import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})'''

INDEX_HTML = '''<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DApp</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>'''

WAGMI_JS = '''import { defineChain, http } from 'viem'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

const chainId = Number(import.meta.env.VITE_CHAIN_ID || 677)
const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://rpc.botchain.ai'
const chainName = import.meta.env.VITE_NETWORK || 'BOT Chain'
const explorerUrl = import.meta.env.VITE_EXPLORER_URL || 'https://scan.botchain.ai'

export const activeChain = defineChain({
  id: chainId,
  name: chainName,
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: 'Explorer', url: explorerUrl } },
  testnet: chainId !== 677,
})

export const wagmiConfig = getDefaultConfig({
  appName: 'BotChain DApp',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '3a4897f1f2b94df6b8a3c6e5f7d8a9b0',
  chains: [activeChain],
  transports: { [chainId]: http(rpcUrl) },
  ssr: false,
})
'''

MAIN_JSX = '''import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import App from './App.jsx'
import './index.css'
import { wagmiConfig } from './config/wagmi'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: '#7c3aed',
          accentColorForeground: 'white',
          borderRadius: 'medium',
        })}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)'''

INDEX_CSS = '''@import "tailwindcss";

:root {
  color-scheme: dark;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #0a0a0f;
}

::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #1a1a2e;
}
::-webkit-scrollbar-thumb {
  background: #4c1d95;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #6d28d9;
}'''

CONTRACT_JS = '''// Placeholder contract config — overwritten by the orchestrator with the
// real deployed address + ABI (via context.json["protected_files"]).
// This placeholder guarantees the Vite build never fails on a missing
// "./config/contract" import when no contract has been deployed yet.
export const CONTRACT_ADDRESS = ''
export const CONTRACT_ABI = []
'''

APP_META_JS = '''// Default app metadata — overwritten by the orchestrator with real values
export const APP_NAME = 'BotChain DApp'
export const APP_TAGLINE = 'A decentralized app on BOT Chain'
export const APP_DESCRIPTION = 'Interact with this smart contract directly on-chain. Every write is permanent and verifiable.'
export const EXPLORER_URL = 'https://scan.botchain.ai'
export const VERIFIED = false
'''

APP_JSX = r'''import React, { useState, useMemo } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseEther } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'

// Config is pre-written by the orchestrator
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './config/contract'
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION, EXPLORER_URL, VERIFIED } from './config/appMeta'

// Turn a camelCase function name into a human label: getAttemptCount -> "Attempt Count"
function humanize(name) {
  if (!name) return ''
  let s = name.replace(/^(get|set|is|total)/i, '')
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim()
  s = s.charAt(0).toUpperCase() + s.slice(1)
  return s || name
}

// Helper: parse ABI into read and write functions
function parseAbiFunctions(abi) {
  const reads = []
  const writes = []
  for (const item of abi) {
    if (item.type !== 'function') continue
    const inputs = item.inputs || []
    const outputs = item.outputs || []
    if (item.stateMutability === 'view' || item.stateMutability === 'pure') {
      reads.push({ name: item.name, inputs, outputs, stateMutability: item.stateMutability })
    } else {
      writes.push({ name: item.name, inputs, stateMutability: item.stateMutability })
    }
  }
  return { reads, writes }
}

// Live stat: no-arg read returning a single numeric value
function StatCard({ fn, address, abi }) {
  const { data, isLoading } = useReadContract({ address, abi, functionName: fn.name })
  let value = '—'
  if (typeof data === 'bigint') value = data.toString()
  else if (data !== undefined && data !== null && !Array.isArray(data)) value = String(data)
  return (
    <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 text-center">
      <div className="text-4xl font-extrabold bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">
        {isLoading ? '…' : value}
      </div>
      <div className="mt-2 text-xs uppercase tracking-wider text-gray-400">{humanize(fn.name)}</div>
    </div>
  )
}

// Read function card
function ReadFunctionCard({ fn, address, abi }) {
  const [args, setArgs] = useState({})
  const argValues = fn.inputs.map(inp => args[inp.name] || '')
  const { data, isError, isLoading, refetch } = useReadContract({
    address,
    abi,
    functionName: fn.name,
    args: argValues.length > 0 ? argValues : undefined,
    query: { enabled: fn.inputs.length === 0 },
  })

  const hasArgs = fn.inputs.length > 0
  const result = useMemo(() => {
    if (data === undefined || data === null) return null
    if (typeof data === 'bigint') return data.toString()
    if (Array.isArray(data)) return data.map(d => (typeof d === 'bigint' ? d.toString() : String(d))).join(', ')
    return String(data)
  }, [data])

  return (
    <div className="bg-gray-800/60 rounded-2xl p-5 border border-gray-700 hover:border-purple-500/50 transition">
      <h3 className="text-sm font-semibold text-purple-200 mb-1">{humanize(fn.name)}</h3>
      <p className="text-[11px] font-mono text-gray-500 mb-3">{fn.name}()</p>
      {hasArgs && (
        <div className="space-y-2 mb-3">
          {fn.inputs.map(inp => (
            <input
              key={inp.name}
              type="text"
              placeholder={inp.name + ' (' + inp.type + ')'}
              value={args[inp.name] || ''}
              onChange={e => setArgs({ ...args, [inp.name]: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900/80 rounded-lg border border-gray-600 text-sm focus:border-purple-500 focus:outline-none"
            />
          ))}
        </div>
      )}
      {hasArgs ? (
        <>
          <button
            onClick={() => refetch()}
            className="w-full py-2 bg-purple-600/80 hover:bg-purple-500 rounded-lg text-sm font-medium transition"
          >
            {isLoading ? 'Loading…' : 'Read'}
          </button>
          {result !== null && !isError && (
            <div className="mt-3 text-sm text-gray-200 break-all bg-gray-900/60 rounded-lg p-3 border border-gray-700/60">
              {result}
            </div>
          )}
        </>
      ) : (
        <div className="text-lg font-semibold text-gray-100 break-all">
          {isLoading ? 'Loading…' : isError ? 'Error' : result || '—'}
        </div>
      )}
      {isError && <p className="text-xs text-red-400 mt-2">Failed to read</p>}
    </div>
  )
}

// Write function card
function WriteFunctionCard({ fn, address, abi }) {
  const [args, setArgs] = useState({})
  const [ethValue, setEthValue] = useState('')
  const { address: account } = useAccount()
  const { writeContractAsync, data: txHash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const isPayable = fn.stateMutability === 'payable'
  const argValues = fn.inputs.map(inp => args[inp.name] || '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!account) return
    try {
      await writeContractAsync({
        address,
        abi,
        functionName: fn.name,
        args: argValues,
        value: isPayable && ethValue ? parseEther(ethValue) : undefined,
      })
    } catch (err) {
      // user rejected or error
    }
  }

  return (
    <div className="bg-gray-800/60 rounded-2xl p-5 border border-gray-700 hover:border-purple-500/50 transition">
      <h3 className="text-sm font-semibold text-purple-200 mb-1">{humanize(fn.name)}</h3>
      <p className="text-[11px] font-mono text-gray-500 mb-3">{fn.name}()</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        {fn.inputs.map(inp => (
          <input
            key={inp.name}
            type="text"
            placeholder={inp.name + ' (' + inp.type + ')'}
            value={args[inp.name] || ''}
            onChange={e => setArgs({ ...args, [inp.name]: e.target.value })}
            className="w-full px-3 py-2 bg-gray-900/80 rounded-lg border border-gray-600 text-sm focus:border-purple-500 focus:outline-none"
          />
        ))}
        {isPayable && (
          <input
            type="text"
            placeholder="BOT amount"
            value={ethValue}
            onChange={e => setEthValue(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900/80 rounded-lg border border-gray-600 text-sm focus:border-purple-500 focus:outline-none"
          />
        )}
        <button
          type="submit"
          disabled={isPending || isConfirming || !account}
          className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition"
        >
          {isPending ? 'Confirming…' : isConfirming ? 'Waiting…' : !account ? 'Connect Wallet' : 'Write'}
        </button>
      </form>
      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-xs text-green-400"
          >
            ✓ Transaction confirmed
            {txHash && (
              <a href={EXPLORER_URL + '/tx/' + txHash} target="_blank" rel="noreferrer" className="ml-1 underline hover:text-green-300">
                View on explorer
              </a>
            )}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-xs text-red-400"
          >
            {error.shortMessage || 'Transaction failed'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function App() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { reads, writes } = useMemo(() => parseAbiFunctions(CONTRACT_ABI), [])

  const statFns = useMemo(
    () => reads.filter(f => f.inputs.length === 0 && f.outputs.length === 1 && /int/i.test(f.outputs[0].type)),
    [reads]
  ).slice(0, 3)

  const expectedChainId = Number(import.meta.env.VITE_CHAIN_ID || 677)
  const networkName = import.meta.env.VITE_NETWORK || 'BOT Chain'
  const wrongChain = isConnected && chainId !== expectedChainId
  const shortAddr = CONTRACT_ADDRESS ? CONTRACT_ADDRESS.slice(0, 6) + '…' + CONTRACT_ADDRESS.slice(-4) : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-gray-950/60 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            {APP_NAME}
          </span>
          <ConnectButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Wrong chain warning */}
        {wrongChain && (
          <div className="mb-6 bg-amber-900/40 border border-amber-600/50 rounded-xl p-4 text-center text-amber-200 text-sm">
            Wrong network. Please switch to {networkName} (Chain ID: {expectedChainId})
          </div>
        )}

        {/* Hero */}
        <section className="text-center py-8">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-purple-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent"
          >
            {APP_NAME}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto"
          >
            {APP_TAGLINE}
          </motion.p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200">On {networkName}</span>
            {VERIFIED && (
              <a href={EXPLORER_URL + '/address/' + CONTRACT_ADDRESS + '#code'} target="_blank" rel="noreferrer"
                 className="px-3 py-1 rounded-full bg-green-500/15 border border-green-500/30 text-green-300 hover:bg-green-500/25">
                ✓ Verified contract
              </a>
            )}
            <a href={EXPLORER_URL + '/address/' + CONTRACT_ADDRESS} target="_blank" rel="noreferrer"
               className="px-3 py-1 rounded-full bg-gray-700/40 border border-gray-600/50 text-gray-300 font-mono hover:bg-gray-700/60">
              {shortAddr}
            </a>
          </div>
        </section>

        {/* What it does */}
        <section className="mt-4 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 bg-gray-800/40 rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-sm font-semibold text-purple-200 uppercase tracking-wider mb-3">What it does</h2>
            <p className="text-gray-300 leading-relaxed">{APP_DESCRIPTION}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-400">
              <span className="px-2.5 py-1 rounded-lg bg-gray-900/60 border border-gray-700/60">{reads.length} read function{reads.length === 1 ? '' : 's'}</span>
              <span className="px-2.5 py-1 rounded-lg bg-gray-900/60 border border-gray-700/60">{writes.length} write function{writes.length === 1 ? '' : 's'}</span>
              <span className="px-2.5 py-1 rounded-lg bg-gray-900/60 border border-gray-700/60">Immutable & on-chain</span>
            </div>
          </div>

          {/* How to test */}
          <div className="bg-gray-800/40 rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-sm font-semibold text-purple-200 uppercase tracking-wider mb-3">How to test</h2>
            <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
              <li>Connect your wallet (top right).</li>
              {writes.length > 0 && (
                <li>
                  Fill in {writes[0].inputs.map(i => i.name).join(', ') || 'the fields'} under
                  <span className="text-purple-200"> {humanize(writes[0].name)}</span> and click <span className="text-purple-200">Write</span>.
                </li>
              )}
              <li>Approve the transaction in your wallet.</li>
              {reads.length > 0 && (
                <li>Use <span className="text-purple-200">{humanize(reads[0].name)}</span> to read your data back.</li>
              )}
            </ol>
          </div>
        </section>

        {/* Live stats */}
        {statFns.length > 0 && (
          <section className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {statFns.map(fn => (
              <StatCard key={fn.name} fn={fn} address={CONTRACT_ADDRESS} abi={CONTRACT_ABI} />
            ))}
          </section>
        )}

        {/* Write functions */}
        {writes.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
              Interact
            </h2>
            {!isConnected && (
              <div className="mb-4 text-sm text-gray-400">Connect your wallet to submit transactions.</div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {writes.map(fn => (
                <WriteFunctionCard key={fn.name} fn={fn} address={CONTRACT_ADDRESS} abi={CONTRACT_ABI} />
              ))}
            </div>
          </section>
        )}

        {/* Read functions */}
        {reads.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              Explore data
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reads.map(fn => (
                <ReadFunctionCard key={fn.name} fn={fn} address={CONTRACT_ADDRESS} abi={CONTRACT_ABI} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {reads.length === 0 && writes.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-sm">No contract functions found in ABI.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 text-center text-xs text-gray-600">
        <a href={EXPLORER_URL + '/address/' + CONTRACT_ADDRESS} target="_blank" rel="noreferrer" className="hover:text-gray-400 font-mono">
          {CONTRACT_ADDRESS}
        </a>
        <div className="mt-1">Powered by {networkName} · Built with BotChain DApp Builder</div>
      </footer>
    </div>
  )
}

export default App'''


def get_shell_files():
    """Return a dict of {relative_path: content} for all deterministic shell files."""
    return {
        "package.json": PACKAGE_JSON,
        "vite.config.js": VITE_CONFIG,
        "index.html": INDEX_HTML,
        "src/config/wagmi.js": WAGMI_JS,
        "src/config/appMeta.js": APP_META_JS,
        "src/config/contract.js": CONTRACT_JS,
        "src/main.jsx": MAIN_JSX,
        "src/index.css": INDEX_CSS,
        "src/App.jsx": APP_JSX,
    }


async def write_shell_files(sandbox, base_path: str = REACT_APP_BASE):
    """Write all deterministic shell files into the sandbox, overwriting existing ones."""
    files = get_shell_files()
    for rel_path, content in files.items():
        await sandbox.files.write(f"{base_path}/{rel_path}", content)
    return list(files.keys())
