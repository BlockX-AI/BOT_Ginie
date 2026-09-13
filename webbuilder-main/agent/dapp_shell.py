"""
Deterministic DApp shell files — wizard-style architecture.

Two layers:

1. SCAFFOLD (protected — the LLM can never write these):
   - package.json, vite.config.js, index.html
   - src/main.jsx (wagmi/RainbowKit providers)
   - src/index.css (tailwind + theme.css import — slim base)
   - src/App.jsx (HashRouter: "/" + "/app")
   - src/pages/LandingPage.jsx, src/pages/AppPage.jsx (component stitching)
   - src/components/app/AppHeader.jsx (wallet connect — deterministic)
   - src/config/{wagmi,appMeta,contract}.js, src/hooks/useContractField.js

2. AI-OWNED stubs (seeded as functional placeholders, overwritten by the
   builder agent — the ONLY files the LLM designs):
   - src/theme.css (palette/fonts/effects — one controlled file)
   - src/components/layout/{Navbar,Footer}.jsx
   - src/components/landing/{HeroSection,FeaturesSection,HowItWorks,HowToUse}.jsx
   - src/components/app/{ContractInfo,StatCards,ContractActions}.jsx

   The app/* stubs are FUNCTIONAL (generic ABI-driven UI), so a build always
   works even if the AI never writes — the AI only upgrades the design.
"""

REACT_APP_BASE = "/home/user/react-app"

# Files the LLM is allowed (and expected) to write. Enforced via
# context.json["protected_paths"] (everything else is protected when set).
AI_OWNED_PATHS = [
    "src/theme.css",
    "src/components/layout/Navbar.jsx",
    "src/components/layout/Footer.jsx",
    "src/components/landing/HeroSection.jsx",
    "src/components/landing/FeaturesSection.jsx",
    "src/components/landing/HowItWorks.jsx",
    "src/components/landing/HowToUse.jsx",
    "src/components/app/ContractInfo.jsx",
    "src/components/app/StatCards.jsx",
    "src/components/app/ContractActions.jsx",
]

# Same list used by the builder's expected-files check.
EXPECTED_COMPONENT_FILES = list(AI_OWNED_PATHS)

# ═══════════════════════════════════════════════════════════════════════════
# SCAFFOLD FILES (protected — deterministic, never LLM-written)
# ═══════════════════════════════════════════════════════════════════════════

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
    "react-router-dom": "^6.26.0",
    "wagmi": "^2.12.0",
    "viem": "^2.21.0",
    "@rainbow-me/rainbowkit": "^2.1.0",
    "@tanstack/react-query": "^5.51.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.400.0"
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

// Neutral dark RainbowKit theme — the app's own theme.css drives the palette
const rkTheme = darkTheme({
  accentColor: '#8b5cf6',
  accentColorForeground: '#ffffff',
  borderRadius: 'medium',
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)'''

INDEX_CSS = r'''@import "tailwindcss";
@import "./theme.css";

/* ============================================================
   BASE SHELL STYLES (protected — design tokens live in theme.css)
   ============================================================ */
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;
  background:var(--app-bg,#0a0a0f);
  color:var(--app-text,#f4f4f5);
  font-family:var(--font-body,system-ui,-apple-system,'Segoe UI',sans-serif);
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  overflow-x:hidden;
}
::-webkit-scrollbar{width:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#3f3f46;border-radius:9999px}
::-webkit-scrollbar-thumb:hover{background:#52525b}
'''

CONTRACT_JS = '''// Placeholder contract config — overwritten by the orchestrator with the
// real deployed address + ABI (via context.json["protected_files"]).
// This placeholder guarantees the Vite build never fails on a missing
// "./config/contract" import when no contract has been deployed yet.
export const CONTRACT_ADDRESS = ''
export const CONTRACT_ABI = []
export const CHAIN_ID = 0
export const NETWORK = ''
export const contractConfig = { address: CONTRACT_ADDRESS, abi: CONTRACT_ABI }
'''

APP_META_JS = '''// Default app metadata — overwritten by the orchestrator with real values
export const APP_NAME = 'BotChain DApp'
export const APP_TAGLINE = 'A decentralized app on BOT Chain'
export const APP_DESCRIPTION = 'Interact with this smart contract directly on-chain. Every write is permanent and verifiable.'
export const EXPLORER_URL = 'https://scan.botchain.ai'
export const VERIFIED = false
'''

APP_JSX = r'''import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import AppPage from './pages/AppPage.jsx'

// HashRouter is used so client-side routes (/#/app) work when the production
// build is served by a plain static file server (python3 -m http.server) with
// no SPA history fallback.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<AppPage />} />
      </Routes>
    </HashRouter>
  )
}'''

LANDING_PAGE_JSX = r'''import React from 'react'
import Navbar from '../components/layout/Navbar'
import HeroSection from '../components/landing/HeroSection'
import FeaturesSection from '../components/landing/FeaturesSection'
import HowItWorks from '../components/landing/HowItWorks'
import HowToUse from '../components/landing/HowToUse'
import Footer from '../components/layout/Footer'

// Marketing / info page — NO wallet connect and NO contract calls here.
export default function LandingPage() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorks />
      <HowToUse />
      <Footer />
    </div>
  )
}'''

APP_PAGE_JSX = r'''import React from 'react'
import AppHeader from '../components/app/AppHeader'
import ContractInfo from '../components/app/ContractInfo'
import StatCards from '../components/app/StatCards'
import ContractActions from '../components/app/ContractActions'

// All contract interaction lives here.
export default function AppPage() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <ContractInfo />
        <StatCards />
        <ContractActions />
      </main>
    </div>
  )
}'''

# Wallet header — deterministic because it owns RainbowKit ConnectButton,
# wrong-network detection, and the back-home link.
APP_HEADER_JSX = r'''import React from 'react'
import { Link } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { activeChain } from '../../config/wagmi'
import { APP_NAME } from '../../config/appMeta'

export default function AppHeader() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const wrongNetwork = isConnected && chainId !== activeChain.id

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <span className="text-base font-bold tracking-tight text-white">{APP_NAME}</span>
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/70">
            {activeChain.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {wrongNetwork && (
            <button
              onClick={() => switchChain({ chainId: activeChain.id })}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-400/20"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Switch Network
            </button>
          )}
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </div>
      </div>
    </header>
  )
}'''

USE_CONTRACT_FIELD_JS = '''/**
 * Typed Web3 hooks for contract interactions.
 *
 * This file provides deterministic type handling for ABI parameters:
 * - BigInt parsing for uint and int types (no Number() overflow)
 * - Address validation via viem isAddress
 * - Hex validation for bytes types
 * - JSON parsing for tuples and arrays
 *
 * The LLM should import these hooks instead of re-implementing type logic.
 */

import { parseUnits, formatUnits, isAddress } from 'viem'

/**
 * Parse a user input string to a BigInt for uint and int types.
 * Handles decimals if needed (e.g., for token amounts with 18 decimals).
 * 
 * @param {string} value - User input
 * @param {number} decimals - Decimal places (default 0 for raw integers)
 * @returns {bigint} Parsed BigInt
 */
export function parseBigInt(value, decimals = 0) {
  if (!value || value.trim() === '') return 0n
  try {
    return parseUnits(value.trim(), decimals)
  } catch (err) {
    console.error('Failed to parse BigInt:', err)
    return 0n
  }
}

/**
 * Format a BigInt to a human-readable string.
 * 
 * @param {bigint} value - BigInt value
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted string
 */
export function formatBigInt(value, decimals = 0) {
  if (value === undefined || value === null) return '0'
  try {
    return formatUnits(value, decimals)
  } catch (err) {
    console.error('Failed to format BigInt:', err)
    return '0'
  }
}

/**
 * Validate an Ethereum address.
 * 
 * @param {string} value - Address string
 * @returns {boolean} True if valid
 */
export function validateAddress(value) {
  if (!value || value.trim() === '') return false
  return isAddress(value.trim())
}

/**
 * Validate a hex string (for bytes types).
 * 
 * @param {string} value - Hex string
 * @param {number|null} exactBytes - Exact byte length (null for dynamic)
 * @returns {boolean} True if valid
 */
export function validateHex(value, exactBytes = null) {
  if (!value || value.trim() === '') return false
  const cleaned = value.trim()
  
  // Must start with 0x
  if (!cleaned.startsWith('0x')) return false
  
  // Check hex characters
  const hexPart = cleaned.slice(2)
  if (!/^[0-9a-fA-F]*$/.test(hexPart)) return false
  
  // Check exact length if specified
  if (exactBytes !== null) {
    return hexPart.length === exactBytes * 2
  }
  
  // Must be even length (full bytes)
  return hexPart.length % 2 === 0
}

/**
 * Parse a JSON string for tuple/array types.
 * 
 * @param {string} value - JSON string
 * @returns {any} Parsed value or null on error
 */
export function parseJsonParam(value) {
  if (!value || value.trim() === '') return null
  try {
    return JSON.parse(value.trim())
  } catch (err) {
    console.error('Failed to parse JSON param:', err)
    return null
  }
}

/**
 * Get validation error message for a field based on uiSchema.
 * 
 * @param {object} field - Field from uiSchema
 * @param {string} value - User input
 * @returns {string|null} Error message or null if valid
 */
export function getFieldError(field, value) {
  const { control, validation, solidityType } = field
  
  if (validation.required && (!value || value.trim() === '')) {
    return `${field.name} is required`
  }
  
  if (!value || value.trim() === '') return null
  
  switch (control) {
    case 'address':
      if (!validateAddress(value)) {
        return 'Invalid Ethereum address'
      }
      break
    
    case 'number-bigint':
      try {
        const bn = parseBigInt(value, 0)
        if (validation.min !== undefined && bn < BigInt(validation.min)) {
          return `Must be >= ${validation.min}`
        }
      } catch (err) {
        return 'Invalid number'
      }
      break
    
    case 'bytes':
      const exactBytes = solidityType !== 'bytes' && solidityType.startsWith('bytes')
        ? parseInt(solidityType.replace('bytes', ''))
        : null
      
      if (!validateHex(value, exactBytes)) {
        return exactBytes
          ? `Must be exactly ${exactBytes} bytes (0x + ${exactBytes * 2} hex chars)`
          : 'Invalid hex string (must start with 0x)'
      }
      break
    
    case 'textarea':
      if (validation.isJson) {
        if (parseJsonParam(value) === null) {
          return 'Invalid JSON'
        }
      }
      break
  }
  
  return null
}

/**
 * Convert a user input to the correct type for contract call args.
 * Uses the uiSchema field definition to determine the conversion.
 * 
 * @param {object} field - Field from uiSchema
 * @param {string} value - User input
 * @returns {any} Converted value ready for contract call
 */
export function convertFieldValue(field, value) {
  if (!value || value.trim() === '') {
    // Return sensible defaults for empty values
    switch (field.control) {
      case 'number-bigint': return 0n
      case 'bool': return false
      case 'address': return '0x0000000000000000000000000000000000000000'
      default: return ''
    }
  }
  
  const trimmed = value.trim()
  
  switch (field.control) {
    case 'number-bigint':
      return parseBigInt(trimmed, 0)
    
    case 'address':
      return trimmed
    
    case 'bool':
      return trimmed.toLowerCase() === 'true' || trimmed === '1'
    
    case 'bytes':
      return trimmed
    
    case 'textarea':
      if (field.validation.isJson) {
        return parseJsonParam(trimmed)
      }
      return trimmed
    
    case 'text':
    default:
      return trimmed
  }
}
'''

# ═══════════════════════════════════════════════════════════════════════════
# AI-OWNED STUB FILES — functional placeholders the builder overwrites
# ═══════════════════════════════════════════════════════════════════════════

THEME_CSS = r'''/* ============================================================
   THEME TOKENS — the generator rewrites this file per DApp.
   Define the palette, fonts and effects for the requested concept.
   Pages/components consume these vars; Tailwind classes may also
   use the colors directly.
   ============================================================ */
:root{
  --app-bg:#0a0a0f;
  --app-surface:#14141c;
  --app-text:#f4f4f5;
  --app-muted:#a1a1aa;
  --accent:#8b5cf6;
  --accent-2:#22d3ee;
  --font-body:system-ui,-apple-system,'Segoe UI',sans-serif;
  --font-display:var(--font-body);
  --font-mono:ui-monospace,'Courier New',monospace;
}
'''

# ── Landing/layout stubs ─────────────────────────────────────────────────────

NAVBAR_JSX = r'''import React from 'react'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { APP_NAME } from '../../config/appMeta'

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[var(--accent,#8b5cf6)]" />
          <span className="text-base font-bold tracking-tight text-white">{APP_NAME}</span>
        </div>
        <Link to="/app" className="rounded-lg bg-[var(--accent,#8b5cf6)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
          Open App
        </Link>
      </div>
    </header>
  )
}'''

FOOTER_JSX = r'''import React from 'react'
import { ExternalLink, Globe, CheckCircle2 } from 'lucide-react'
import { APP_NAME, EXPLORER_URL, VERIFIED } from '../../config/appMeta'

export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-white/50 sm:flex-row sm:px-6 lg:px-8">
        <span>© {new Date().getFullYear()} {APP_NAME}</span>
        <div className="flex items-center gap-4">
          {VERIFIED && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Verified
            </span>
          )}
          <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 transition-colors hover:text-white">
            <Globe className="h-4 w-4" /> Explorer <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </footer>
  )
}'''

HERO_SECTION_JSX = r'''import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION } from '../../config/appMeta'

export default function HeroSection() {
  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 pt-24 text-center">
      <h1 className="text-5xl font-extrabold tracking-tighter text-white md:text-7xl">{APP_NAME}</h1>
      <p className="mt-4 text-xl text-[var(--accent,#8b5cf6)]">{APP_TAGLINE}</p>
      <p className="mx-auto mt-4 max-w-[60ch] text-lg leading-relaxed text-white/60">{APP_DESCRIPTION}</p>
      <div className="mt-8 flex items-center justify-center gap-4">
        <Link to="/app" className="flex items-center gap-2 rounded-xl bg-[var(--accent,#8b5cf6)] px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90">
          Open App <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  )
}'''

FEATURES_SECTION_JSX = r'''import React from 'react'
import { Zap, Shield, Wallet } from 'lucide-react'

const FEATURES = [
  { icon: Zap, title: 'Instant Actions', desc: 'Interact with the smart contract in real time with fast reads and writes.' },
  { icon: Shield, title: 'Trustless & Transparent', desc: 'Every interaction is executed on-chain and visible on the block explorer.' },
  { icon: Wallet, title: 'Wallet-Native', desc: 'Connect your favorite wallet — no accounts, no custody.' },
]

export default function FeaturesSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold text-white">What It Does</h2>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <Icon className="h-6 w-6 text-[var(--accent,#8b5cf6)]" />
            <h3 className="mt-4 font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-white/60">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}'''

HOW_IT_WORKS_JSX = r'''import React from 'react'

const STEPS = [
  { n: '01', title: 'Connect Wallet', desc: 'Link your wallet on the app page to get started.' },
  { n: '02', title: 'Pick a Function', desc: 'Read contract state or call a write function.' },
  { n: '03', title: 'Confirm On-Chain', desc: 'Sign the transaction and watch it confirm live.' },
]

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold text-white">How It Works</h2>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {STEPS.map(({ n, title, desc }) => (
          <div key={n} className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <span className="font-mono text-sm text-[var(--accent,#8b5cf6)]">{n}</span>
            <h3 className="mt-3 font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-white/60">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}'''

HOW_TO_USE_JSX = r'''import React from 'react'
import { APP_NAME } from '../../config/appMeta'

export default function HowToUse() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold text-white">How To Use</h2>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-white/70">
        <li>Click "Open App" to open the {APP_NAME} dashboard.</li>
        <li>Connect a wallet that supports the network shown in the header.</li>
        <li>All contract reads and writes are signed through your wallet.</li>
      </ul>
    </section>
  )
}'''

# ── App stubs — functional ABI-driven UI (theme-neutral floor) ──────────────

CONTRACT_INFO_JSX = r'''import React, { useState } from 'react'
import { Copy, Check, ExternalLink, CheckCircle2, Globe } from 'lucide-react'
import { CONTRACT_ADDRESS, NETWORK, CHAIN_ID } from '../../config/contract'
import { EXPLORER_URL, VERIFIED } from '../../config/appMeta'

export default function ContractInfo() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(CONTRACT_ADDRESS); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <Globe className="h-5 w-5 text-[var(--accent,#8b5cf6)]" />
      <div className="min-w-0">
        <div className="font-mono text-sm text-white break-all">{CONTRACT_ADDRESS}</div>
        <div className="text-xs text-white/50">{NETWORK} · Chain ID {CHAIN_ID}</div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {VERIFIED && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Verified</span>}
        <button onClick={copy} className="rounded-lg border border-white/10 p-2 text-white/60 transition-colors hover:text-white">
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
        <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 p-2 text-white/60 transition-colors hover:text-white">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}'''

STAT_CARDS_JSX = r'''import React from 'react'
import { useReadContract } from 'wagmi'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../config/contract'

// Humanize camelCase: getCount -> "Get Count"
function humanize(name) {
  if (!name) return ''
  const s = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const READ_STATS = CONTRACT_ABI.filter(
  i => i.type === 'function'
    && (i.stateMutability === 'view' || i.stateMutability === 'pure')
    && !(i.inputs || []).length
)

function Stat({ fn }) {
  const { data, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: fn.name,
  })
  const value = data === undefined || data === null
    ? '—'
    : typeof data === 'bigint' ? data.toString() : String(data)
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="break-all font-mono text-2xl font-bold text-white">{isLoading ? '…' : value}</div>
      <div className="mt-2 text-xs uppercase tracking-wider text-white/50">{humanize(fn.name)}</div>
    </div>
  )
}

export default function StatCards() {
  if (!READ_STATS.length) return null
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {READ_STATS.map(fn => <Stat key={fn.name} fn={fn} />)}
    </div>
  )
}'''

CONTRACT_ACTIONS_JSX = r'''import React, { useMemo, useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../config/contract'
import { EXPLORER_URL } from '../../config/appMeta'

function humanize(name) {
  if (!name) return ''
  const s = name.replace(/^(get|set|is|total)/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim()
  return (s.charAt(0).toUpperCase() + s.slice(1)) || name
}

const FIELD_CLS = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-[var(--accent,#8b5cf6)] focus:outline-none'
const BTN_CLS = 'rounded-lg bg-[var(--accent,#8b5cf6)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40'

function TypedInput({ inp, value, onChange }) {
  const t = (inp.type || '').toLowerCase()
  if (t === 'bool') {
    return (
      <div className="flex gap-2">
        {['true', 'false'].map(v => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={v === String(value) ? BTN_CLS : 'rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60'}>
            {v === 'true' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    )
  }
  const isNum = /^u?int/.test(t)
  return (
    <input type={isNum ? 'number' : 'text'} min={isNum ? '0' : undefined}
      placeholder={`${inp.name} (${inp.type})`} value={value}
      onChange={e => onChange(e.target.value)} className={FIELD_CLS} />
  )
}

function ReadWithArgs({ fn }) {
  const [args, setArgs] = useState({})
  const argValues = fn.inputs.map(i => args[i.name] || '')
  const { data, isError, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: fn.name,
    args: argValues.length ? argValues : undefined,
    query: { enabled: false },
  })
  const result = useMemo(() => {
    if (data === undefined || data === null) return null
    if (typeof data === 'bigint') return data.toString()
    if (Array.isArray(data)) return data.map(d => typeof d === 'bigint' ? d.toString() : String(d)).join(', ')
    return String(data)
  }, [data])
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="font-semibold text-white">{humanize(fn.name)}</h3>
      <p className="mb-3 font-mono text-xs text-white/40">{fn.name}()</p>
      <div className="mb-3 space-y-2">
        {fn.inputs.map(inp => (
          <TypedInput key={inp.name} inp={inp} value={args[inp.name] || ''}
            onChange={v => setArgs({ ...args, [inp.name]: v })} />
        ))}
      </div>
      <button onClick={() => refetch()} className={BTN_CLS + ' w-full'}>{isLoading ? 'Loading…' : 'Read'}</button>
      {result !== null && !isError && (
        <div className="mt-3 break-all rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-sm text-white">{result}</div>
      )}
      {isError && <p className="mt-2 text-xs text-red-400">Failed to read</p>}
    </div>
  )
}

function WriteCard({ fn }) {
  const [args, setArgs] = useState({})
  const [ethValue, setEthValue] = useState('')
  const { isConnected } = useAccount()
  const { writeContractAsync, data: txHash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const isPayable = fn.stateMutability === 'payable'

  const coerce = (inp, raw) => {
    const t = (inp.type || '').toLowerCase()
    if (t === 'bool') return raw === 'true' || raw === true
    if (/^u?int/.test(t)) return raw === '' ? 0n : BigInt(raw)
    return raw
  }
  const submit = async (e) => {
    e.preventDefault()
    if (!isConnected) return
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: fn.name,
        args: fn.inputs.map(i => coerce(i, args[i.name] ?? '')),
        value: isPayable && ethValue ? parseEther(ethValue) : undefined,
      })
    } catch {}
  }
  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="font-semibold text-white">{humanize(fn.name)}</h3>
      <p className="mb-3 font-mono text-xs text-white/40">{fn.name}(){isPayable ? ' · payable' : ''}</p>
      <div className="mb-3 space-y-2">
        {fn.inputs.map(inp => (
          <TypedInput key={inp.name} inp={inp} value={args[inp.name] ?? ''}
            onChange={v => setArgs({ ...args, [inp.name]: v })} />
        ))}
        {isPayable && (
          <input type="number" min="0" step="any" placeholder="Native token amount"
            value={ethValue} onChange={e => setEthValue(e.target.value)} className={FIELD_CLS} />
        )}
      </div>
      <button type="submit" disabled={!isConnected || isPending || isConfirming} className={BTN_CLS + ' w-full'}>
        {isPending || isConfirming ? 'Confirming…' : isConnected ? 'Execute' : 'Connect wallet to write'}
      </button>
      {isSuccess && txHash && (
        <a href={`${EXPLORER_URL.replace(/\/address\/.*/, '')}/tx/${txHash}`} target="_blank" rel="noreferrer"
          className="mt-3 block break-all font-mono text-xs text-emerald-400">
          ✓ Confirmed: {txHash.slice(0, 10)}…{txHash.slice(-6)}
        </a>
      )}
      {error && <p className="mt-2 break-all text-xs text-red-400">{(error.shortMessage || error.message || 'Transaction failed').slice(0, 200)}</p>}
    </form>
  )
}

export default function ContractActions() {
  const { reads, writes } = useMemo(() => {
    const r = [], w = []
    for (const item of CONTRACT_ABI) {
      if (item.type !== 'function') continue
      const fn = { name: item.name, inputs: item.inputs || [], stateMutability: item.stateMutability }
      if (item.stateMutability === 'view' || item.stateMutability === 'pure') {
        if (fn.inputs.length) r.push(fn)   // no-arg reads live in StatCards
      } else {
        w.push(fn)
      }
    }
    return { reads: r, writes: w }
  }, [])

  if (!reads.length && !writes.length) {
    return <p className="text-sm text-white/40">No contract functions found in ABI.</p>
  }
  return (
    <div className="space-y-8">
      {reads.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Read Functions</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reads.map(fn => <ReadWithArgs key={fn.name} fn={fn} />)}
          </div>
        </section>
      )}
      {writes.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Write Functions</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {writes.map(fn => <WriteCard key={fn.name} fn={fn} />)}
          </div>
        </section>
      )}
    </div>
  )
}'''

# ═══════════════════════════════════════════════════════════════════════════
# File maps + write helpers
# ═══════════════════════════════════════════════════════════════════════════

# Protected scaffold — always written/restored deterministically.
SCAFFOLD_FILES = {
    "package.json": PACKAGE_JSON,
    "vite.config.js": VITE_CONFIG,
    "index.html": INDEX_HTML,
    "src/main.jsx": MAIN_JSX,
    "src/index.css": INDEX_CSS,
    "src/App.jsx": APP_JSX,
    "src/pages/LandingPage.jsx": LANDING_PAGE_JSX,
    "src/pages/AppPage.jsx": APP_PAGE_JSX,
    "src/components/app/AppHeader.jsx": APP_HEADER_JSX,
    "src/config/wagmi.js": WAGMI_JS,
    "src/config/appMeta.js": APP_META_JS,
    "src/config/contract.js": CONTRACT_JS,
    "src/hooks/useContractField.js": USE_CONTRACT_FIELD_JS,
}

# AI-owned stubs — functional placeholders overwritten by the builder agent.
AI_STUB_FILES = {
    "src/theme.css": THEME_CSS,
    "src/components/layout/Navbar.jsx": NAVBAR_JSX,
    "src/components/layout/Footer.jsx": FOOTER_JSX,
    "src/components/landing/HeroSection.jsx": HERO_SECTION_JSX,
    "src/components/landing/FeaturesSection.jsx": FEATURES_SECTION_JSX,
    "src/components/landing/HowItWorks.jsx": HOW_IT_WORKS_JSX,
    "src/components/landing/HowToUse.jsx": HOW_TO_USE_JSX,
    "src/components/app/ContractInfo.jsx": CONTRACT_INFO_JSX,
    "src/components/app/StatCards.jsx": STAT_CARDS_JSX,
    "src/components/app/ContractActions.jsx": CONTRACT_ACTIONS_JSX,
}

# Path prefixes/exact paths the LLM may NOT write when protection is enabled.
# (Stored in context.json["protected_paths"] by the orchestrator.)
PROTECTED_PATH_PREFIXES = [
    "src/config/",
    "src/hooks/",
    "src/contracts/",
    "src/pages/",
    "src/components/app/AppHeader.jsx",
]
PROTECTED_EXACT_PATHS = {
    "package.json",
    "package-lock.json",
    "vite.config.js",
    "index.html",
    ".env",
    ".env.production",
    "src/main.jsx",
    "src/App.jsx",
    "src/index.css",
}


def get_shell_files(theme_id: str = None, infra_only: bool = False):
    """
    Return {relative_path: content} for the deterministic shell.

    Kept for backward compatibility — theme_id/infra_only are deprecated
    (the scaffold is theme-neutral; design lives in AI-owned files).
    Returns scaffold + stub files.
    """
    return {**SCAFFOLD_FILES, **AI_STUB_FILES}


def get_scaffold_files():
    """Protected files only — restored before every build."""
    return dict(SCAFFOLD_FILES)


def get_stub_files():
    """AI-owned placeholder files — used for seeding and missing-file restore."""
    return dict(AI_STUB_FILES)


async def write_shell_files(sandbox, base_path: str = REACT_APP_BASE, theme_id: str = None, infra_only: bool = False):
    """
    Seed the full shell: protected scaffold + AI-owned stubs.
    theme_id/infra_only kept for backward compatibility (ignored).
    """
    files = get_shell_files()
    for rel_path, content in files.items():
        await sandbox.files.write(f"{base_path}/{rel_path}", content)
    return list(files.keys())


async def write_scaffold_files(sandbox, base_path: str = REACT_APP_BASE):
    """Overwrite ONLY the protected scaffold files (pre-build restore)."""
    for rel_path, content in SCAFFOLD_FILES.items():
        await sandbox.files.write(f"{base_path}/{rel_path}", content)
    return list(SCAFFOLD_FILES.keys())


async def write_missing_stubs(sandbox, base_path: str = REACT_APP_BASE):
    """
    Write AI-owned stubs ONLY for files that are missing or effectively empty.
    Never overwrites real AI-generated content.
    """
    restored = []
    for rel_path, content in AI_STUB_FILES.items():
        try:
            existing = await sandbox.files.read(f"{base_path}/{rel_path}")
            if existing and len(existing.strip()) >= 50:
                continue
        except Exception:
            pass
        await sandbox.files.write(f"{base_path}/{rel_path}", content)
        restored.append(rel_path)
    return restored
