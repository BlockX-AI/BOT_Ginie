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
# The deterministic shell now ships a complete, beautiful TWO-PAGE neo-brutalist
# app (Landing "/" + App "/app") that is fully ABI-driven. All of these files are
# restored before the production build so every generated DApp is guaranteed to
# look great and be correctly wired — regardless of what the LLM builder does.
PROTECTED_SHELL_PATHS = [
    "src/main.jsx",
    "src/App.jsx",
    "src/pages/LandingPage.jsx",
    "src/pages/AppPage.jsx",
    "src/components/Ticker.jsx",
    "src/components/ContractCards.jsx",
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
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import App from './App.jsx'
import './index.css'
import { wagmiConfig } from './config/wagmi'

const queryClient = new QueryClient()

// Neo-brutalist RainbowKit theme: flat, sharp, ink borders, blue accent
const nbTheme = lightTheme({
  accentColor: '#2B6FE8',
  accentColorForeground: '#ffffff',
  borderRadius: 'small',
  fontStack: 'system',
})
nbTheme.colors.modalBackground = '#FFFFFF'
nbTheme.colors.modalBorder = '#0A0A0A'
nbTheme.colors.connectButtonBackground = '#FFD91C'
nbTheme.colors.connectButtonText = '#0A0A0A'
nbTheme.shadows.connectButton = '4px 4px 0 #0A0A0A'
nbTheme.shadows.dialog = '6px 6px 0 #0A0A0A'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={nbTheme}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)'''

INDEX_CSS = r'''@import "tailwindcss";

/* ============================================================
   GINIE NEO-BRUTALIST DESIGN SYSTEM  (do not remove)
   ============================================================ */
@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root{
  --paper:#EFEEE9;
  --ink:#0A0A0A;
  --blue:#2B6FE8;
  --yellow:#FFD91C;
  --coral:#FF5C4D;
  --green:#12A150;
  --violet:#7C5CFF;
  --card:#FFFFFF;
  --grey:#5C5C58;
  --sans:'Archivo',system-ui,sans-serif;
  --display:'Archivo Black',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,monospace;
  --bd:3px solid var(--ink);
  --pop:6px 6px 0 var(--ink);
  --pop-sm:4px 4px 0 var(--ink);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;
  background-color:var(--paper);
  background-image:radial-gradient(var(--ink) 1px,transparent 1px);
  background-size:22px 22px;
  color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.55;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;
}
body::before{content:'';position:fixed;inset:0;background:rgba(239,238,233,.88);z-index:-1}
:focus-visible{outline:3px solid var(--blue);outline-offset:3px}

.nb-display{font-family:var(--display);letter-spacing:-.02em;line-height:1.02}
.nb-mono{font-family:var(--mono)}
.nb-hl{background:var(--yellow);padding:0 .12em;box-decoration-break:clone;-webkit-box-decoration-break:clone}

/* card / panel */
.nb-card{background:var(--card);border:var(--bd);border-radius:12px;box-shadow:var(--pop)}
.nb-card-sm{background:var(--card);border:var(--bd);border-radius:10px;box-shadow:var(--pop-sm)}

/* buttons */
.nb-btn{
  font-family:var(--sans);font-size:14.5px;font-weight:700;
  padding:.6rem 1.1rem;border:var(--bd);border-radius:9px;cursor:pointer;
  background:var(--card);color:var(--ink);box-shadow:var(--pop-sm);
  transition:transform .1s,box-shadow .1s;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;
  text-decoration:none;
}
.nb-btn:hover{transform:translate(1px,1px);box-shadow:3px 3px 0 var(--ink)}
.nb-btn:active{transform:translate(4px,4px);box-shadow:0 0 0 var(--ink)}
.nb-btn-primary{background:var(--blue);color:#fff}
.nb-btn-yellow{background:var(--yellow)}
.nb-btn-lg{padding:.85rem 1.6rem;font-size:16px;box-shadow:var(--pop)}
.nb-btn-lg:hover{box-shadow:4px 4px 0 var(--ink)}
.nb-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:var(--pop-sm)}

/* form fields */
.nb-field{
  width:100%;background:var(--paper);border:var(--bd);border-radius:9px;
  padding:.8rem .95rem;color:var(--ink);font-family:var(--sans);font-size:15.5px;font-weight:600;
}
.nb-field::placeholder{color:#9A9A94;font-weight:400}
.nb-field:focus{outline:none;background:#fff;box-shadow:var(--pop-sm)}
.nb-field.mono{font-family:var(--mono)}

/* ticker */
.nb-ticker{background:var(--yellow);border-bottom:var(--bd);overflow:hidden;white-space:nowrap;padding:.5rem 0}
.nb-ticker-track{display:inline-flex;gap:2.5rem;padding-left:100%;animation:nb-slide 34s linear infinite}
.nb-ticker span{font-family:var(--display);font-size:12.5px;letter-spacing:.02em;display:inline-flex;align-items:center;gap:2.5rem}
.nb-ticker i{font-style:normal;color:var(--blue)}
@keyframes nb-slide{to{transform:translateX(-100%)}}
@media (prefers-reduced-motion:reduce){.nb-ticker-track{animation:none;padding-left:1rem}}

/* violet status bar */
.nb-statusbar{background:var(--violet);border-bottom:var(--bd);color:#fff}

/* section helpers */
.nb-wrap{width:min(1140px,100% - 2.5rem);margin-inline:auto}
.nb-section{padding:4rem 0;border-top:var(--bd)}
.nb-badge{font-family:var(--mono);font-size:11px;font-weight:600;border:2px solid var(--ink);border-radius:999px;padding:.15rem .6rem;background:var(--card);display:inline-flex;align-items:center;gap:.35rem}

::-webkit-scrollbar{width:12px;height:12px}
::-webkit-scrollbar-track{background:var(--paper)}
::-webkit-scrollbar-thumb{background:var(--ink);border:3px solid var(--paper)}
'''

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

APP_JSX = r'''import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import AppPage from './pages/AppPage.jsx'

// HashRouter is used so client-side routes (/#/app) work when the production
// build is served by a plain static file server (python3 -m http.server) with
// no SPA history fallback. Links use "/" and "/app" and become "#/" and "#/app".
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<AppPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App'''

TICKER_JSX = r'''import React from 'react'

export default function Ticker({ items }) {
  const phrases = (items && items.length) ? items : ['ON-CHAIN', 'VERIFIED', 'IMMUTABLE', 'DECENTRALIZED', 'NO CODE']
  const doubled = [...phrases, ...phrases]
  return (
    <div className="nb-ticker">
      <div className="nb-ticker-track">
        {doubled.map((p, i) => (
          <span key={i}>{p} <i>★</i></span>
        ))}
      </div>
    </div>
  )
}'''

CONTRACT_CARDS_JSX = r'''import React, { useState, useMemo } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { EXPLORER_URL } from '../config/appMeta'

// Turn a camelCase function name into a human label: getAttemptCount -> "Attempt Count"
export function humanize(name) {
  if (!name) return ''
  let s = name.replace(/^(get|set|is|total)/i, '')
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim()
  s = s.charAt(0).toUpperCase() + s.slice(1)
  return s || name
}

// Parse ABI into read and write functions
export function parseAbiFunctions(abi) {
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

// Input control chosen by Solidity type: bool -> toggle, uint -> number, address/text -> text
function TypedInput({ inp, value, onChange }) {
  const t = (inp.type || '').toLowerCase()
  if (t === 'bool') {
    return (
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange('true')} className={'nb-btn ' + (value === 'true' ? 'nb-btn-primary' : '')}>Yes</button>
        <button type="button" onClick={() => onChange('false')} className={'nb-btn ' + (value === 'false' ? 'nb-btn-primary' : '')}>No</button>
      </div>
    )
  }
  const isNum = /^(u?int)/.test(t)
  const isAddr = t === 'address'
  return (
    <input
      type={isNum ? 'number' : 'text'}
      min={isNum ? '0' : undefined}
      placeholder={inp.name + ' (' + inp.type + ')'}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={'nb-field ' + (isAddr ? 'mono' : '')}
    />
  )
}

// Live stat: no-arg read returning a single value
export function StatCard({ fn, address, abi }) {
  const { data, isLoading } = useReadContract({ address, abi, functionName: fn.name })
  let value = '—'
  if (typeof data === 'bigint') value = data.toString()
  else if (data !== undefined && data !== null && !Array.isArray(data)) value = String(data)
  return (
    <div className="nb-card-sm p-5 text-center">
      <div className="nb-display" style={{ fontSize: '2.25rem', wordBreak: 'break-all' }}>{isLoading ? '…' : value}</div>
      <div className="mt-2 text-xs uppercase tracking-wider" style={{ color: 'var(--grey)' }}>{humanize(fn.name)}</div>
    </div>
  )
}

export function ReadFunctionCard({ fn, address, abi }) {
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
    <div className="nb-card-sm p-5">
      <h3 className="nb-display" style={{ fontSize: '1.05rem', marginBottom: '.15rem' }}>{humanize(fn.name)}</h3>
      <p className="nb-mono" style={{ fontSize: '.72rem', color: 'var(--grey)', marginBottom: '.85rem' }}>{fn.name}()</p>
      {hasArgs && (
        <div className="space-y-2 mb-3">
          {fn.inputs.map(inp => (
            <TypedInput key={inp.name} inp={inp} value={args[inp.name] || ''} onChange={v => setArgs({ ...args, [inp.name]: v })} />
          ))}
        </div>
      )}
      {hasArgs ? (
        <>
          <button onClick={() => refetch()} className="nb-btn nb-btn-yellow" style={{ width: '100%' }}>{isLoading ? 'Loading…' : 'Read'}</button>
          {result !== null && !isError && (
            <div className="nb-mono" style={{ marginTop: '.85rem', fontSize: '.85rem', wordBreak: 'break-all', background: 'var(--paper)', border: '3px solid var(--ink)', borderRadius: '9px', padding: '.75rem' }}>{result}</div>
          )}
        </>
      ) : (
        <div className="nb-mono" style={{ fontSize: '1.1rem', fontWeight: 600, wordBreak: 'break-all' }}>{isLoading ? 'Loading…' : isError ? 'Error' : (result || '—')}</div>
      )}
      {isError && <p style={{ fontSize: '.72rem', color: 'var(--coral)', marginTop: '.5rem' }}>Failed to read</p>}
    </div>
  )
}

export function WriteFunctionCard({ fn, address, abi }) {
  const [args, setArgs] = useState({})
  const [ethValue, setEthValue] = useState('')
  const { address: account } = useAccount()
  const { writeContractAsync, data: txHash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const isPayable = fn.stateMutability === 'payable'

  const coerce = (inp, raw) => {
    const t = (inp.type || '').toLowerCase()
    if (t === 'bool') return raw === 'true'
    return raw
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!account) return
    try {
      await writeContractAsync({
        address,
        abi,
        functionName: fn.name,
        args: fn.inputs.map(inp => coerce(inp, args[inp.name] || '')),
        value: isPayable && ethValue ? parseEther(ethValue) : undefined,
      })
    } catch (err) {
      // user rejected or error
    }
  }
  return (
    <div className="nb-card-sm p-5">
      <h3 className="nb-display" style={{ fontSize: '1.05rem', marginBottom: '.15rem' }}>{humanize(fn.name)}</h3>
      <p className="nb-mono" style={{ fontSize: '.72rem', color: 'var(--grey)', marginBottom: '.85rem' }}>{fn.name}()</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        {fn.inputs.map(inp => (
          <TypedInput key={inp.name} inp={inp} value={args[inp.name] || ''} onChange={v => setArgs({ ...args, [inp.name]: v })} />
        ))}
        {isPayable && (
          <input type="number" min="0" step="any" placeholder="BOT amount" value={ethValue} onChange={e => setEthValue(e.target.value)} className="nb-field mono" />
        )}
        <button type="submit" disabled={isPending || isConfirming || !account} className="nb-btn nb-btn-primary" style={{ width: '100%' }}>
          {isPending ? 'Confirming…' : isConfirming ? 'Waiting…' : !account ? 'Connect Wallet' : 'Write'}
        </button>
      </form>
      {isSuccess && (
        <div style={{ marginTop: '.85rem', fontSize: '.75rem', background: 'var(--green)', color: '#fff', border: '3px solid var(--ink)', borderRadius: '8px', padding: '.5rem .65rem' }}>
          ✓ Confirmed
          {txHash && (<a href={EXPLORER_URL + '/tx/' + txHash} target="_blank" rel="noreferrer" style={{ marginLeft: '.35rem', textDecoration: 'underline', color: '#fff' }}>View</a>)}
        </div>
      )}
      {error && (
        <div style={{ marginTop: '.85rem', fontSize: '.75rem', background: 'var(--coral)', color: '#fff', border: '3px solid var(--ink)', borderRadius: '8px', padding: '.5rem .65rem' }}>
          {error.shortMessage || 'Transaction failed'}
        </div>
      )}
    </div>
  )
}'''

LANDING_PAGE_JSX = r'''import React from 'react'
import { Link } from 'react-router-dom'
import { Zap, ShieldCheck, Layers, ArrowRight, Wallet, MousePointerClick, CheckCircle2 } from 'lucide-react'
import Ticker from '../components/Ticker.jsx'
import { APP_NAME, APP_TAGLINE, APP_DESCRIPTION, EXPLORER_URL, VERIFIED } from '../config/appMeta'

const networkName = import.meta.env.VITE_NETWORK || 'BOT Chain'

export default function LandingPage() {
  const gridCols = (min) => ({ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit,minmax(' + min + 'px,1fr))' })

  const features = [
    { icon: <Zap size={28} />, t: 'Instant On-Chain', d: 'Every action is a real transaction settled on ' + networkName + '.' },
    { icon: <ShieldCheck size={28} />, t: 'Verified & Trustless', d: 'Interact directly with the smart contract. No middlemen.' },
    { icon: <Layers size={28} />, t: 'Fully Transparent', d: 'All reads and writes are public and permanent on the ledger.' },
  ]
  const steps = [
    { n: '1', t: 'Connect Wallet', d: 'Open the app and connect your Web3 wallet.' },
    { n: '2', t: 'Choose an action', d: 'Pick a read or write function from the dashboard.' },
    { n: '3', t: 'Confirm', d: 'Approve the transaction and watch it settle on-chain.' },
    { n: '4', t: 'See results', d: 'Read data back instantly from the contract.' },
  ]

  return (
    <div>
      <Ticker items={[(APP_NAME || 'DAPP').toUpperCase(), 'ON ' + networkName.toUpperCase(), 'IMMUTABLE', 'ON-CHAIN', VERIFIED ? 'VERIFIED CONTRACT' : 'LIVE']} />

      <header className="nb-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1.25rem', paddingBottom: '1.25rem' }}>
        <span className="nb-display" style={{ fontSize: '1.3rem' }}>{APP_NAME}</span>
        <Link to="/app" className="nb-btn nb-btn-primary">Open App <ArrowRight size={16} /></Link>
      </header>

      <section className="nb-wrap" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '2rem', paddingBottom: '3.5rem' }}>
        <span className="nb-badge">{networkName}{VERIFIED ? ' · ✓ Verified' : ''}</span>
        <h1 className="nb-display" style={{ fontSize: 'clamp(2.6rem,7vw,5rem)', marginTop: '1.2rem' }}>
          <span className="nb-hl">{APP_NAME || 'DApp'}</span>
        </h1>
        <p style={{ maxWidth: '640px', marginTop: '1.2rem', fontSize: '1.15rem' }}>{APP_TAGLINE}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.85rem', marginTop: '1.8rem' }}>
          <Link to="/app" className="nb-btn nb-btn-primary nb-btn-lg">Open App <ArrowRight size={18} /></Link>
          <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="nb-btn nb-btn-lg">View on Explorer</a>
        </div>
      </section>

      <section className="nb-section">
        <div className="nb-wrap">
          <h2 className="nb-display" style={{ fontSize: '1.8rem', marginBottom: '1.25rem' }}>What it does</h2>
          <p style={{ maxWidth: '720px', marginBottom: '2rem' }}>{APP_DESCRIPTION}</p>
          <div style={gridCols(220)}>
            {features.map((f, i) => (
              <div key={i} className="nb-card p-6">
                <div style={{ color: 'var(--blue)', marginBottom: '.6rem' }}>{f.icon}</div>
                <h3 className="nb-display" style={{ fontSize: '1.1rem', marginBottom: '.4rem' }}>{f.t}</h3>
                <p style={{ color: 'var(--grey)' }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="nb-section">
        <div className="nb-wrap">
          <h2 className="nb-display" style={{ fontSize: '1.8rem', marginBottom: '1.25rem' }}>How it works</h2>
          <div style={gridCols(200)}>
            {steps.map((s, i) => (
              <div key={i} className="nb-card-sm p-5">
                <div className="nb-display" style={{ fontSize: '2rem', color: 'var(--blue)' }}>{s.n}</div>
                <h3 className="nb-display" style={{ fontSize: '1rem', margin: '.5rem 0 .3rem' }}>{s.t}</h3>
                <p style={{ color: 'var(--grey)', fontSize: '.95rem' }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="nb-section">
        <div className="nb-wrap">
          <div className="nb-card p-6" style={{ maxWidth: '720px' }}>
            <h2 className="nb-display" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>How to use</h2>
            <ul style={{ lineHeight: '2', listStyle: 'none', padding: 0 }}>
              <li><Wallet size={15} style={{ display: 'inline', marginRight: '.4rem' }} /> Install a Web3 wallet (e.g. MetaMask) and add the {networkName} network.</li>
              <li><Zap size={15} style={{ display: 'inline', marginRight: '.4rem' }} /> Make sure you have some {networkName} tokens for gas.</li>
              <li><MousePointerClick size={15} style={{ display: 'inline', marginRight: '.4rem' }} /> Click <b>Open App</b>, connect, and start interacting.</li>
              <li><CheckCircle2 size={15} style={{ display: 'inline', marginRight: '.4rem' }} /> Approve transactions in your wallet to write on-chain.</li>
            </ul>
            <Link to="/app" className="nb-btn nb-btn-primary nb-btn-lg" style={{ marginTop: '1.5rem' }}>Open App <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>

      <footer className="nb-section" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        <div className="nb-wrap" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem' }}>
          <span className="nb-mono" style={{ fontSize: '.85rem' }}>Powered by {networkName}</span>
          <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="nb-badge">Explorer ↗</a>
        </div>
      </footer>
    </div>
  )
}'''

APP_PAGE_JSX = r'''import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useChainId } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ArrowLeft } from 'lucide-react'
import Ticker from '../components/Ticker.jsx'
import { parseAbiFunctions, StatCard, ReadFunctionCard, WriteFunctionCard } from '../components/ContractCards.jsx'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contract'
import { APP_NAME, EXPLORER_URL, VERIFIED } from '../config/appMeta'

export default function AppPage() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { reads, writes } = useMemo(() => parseAbiFunctions(CONTRACT_ABI), [])
  const statFns = useMemo(
    () => reads.filter(f => f.inputs.length === 0 && f.outputs.length === 1 && /int/i.test(f.outputs[0].type)),
    [reads]
  ).slice(0, 4)
  const expectedChainId = Number(import.meta.env.VITE_CHAIN_ID || 677)
  const networkName = import.meta.env.VITE_NETWORK || 'BOT Chain'
  const wrongChain = isConnected && chainId !== expectedChainId
  const shortAddr = CONTRACT_ADDRESS ? CONTRACT_ADDRESS.slice(0, 6) + '…' + CONTRACT_ADDRESS.slice(-4) : ''
  const gridCols = (min) => ({ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit,minmax(' + min + 'px,1fr))' })

  return (
    <div>
      <Ticker items={[(APP_NAME || 'DAPP').toUpperCase(), reads.length + ' READ', writes.length + ' WRITE', 'ON ' + networkName.toUpperCase()]} />

      <header style={{ borderBottom: '3px solid var(--ink)', background: 'var(--card)' }}>
        <div className="nb-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/" className="nb-btn"><ArrowLeft size={16} /> Home</Link>
            <span className="nb-display" style={{ fontSize: '1.1rem' }}>{APP_NAME}</span>
          </div>
          <ConnectButton />
        </div>
      </header>

      <div className="nb-statusbar">
        <div className="nb-wrap nb-mono" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', paddingTop: '.5rem', paddingBottom: '.5rem', fontSize: '.72rem' }}>
          <span>NETWORK: {networkName}</span>
          <a href={EXPLORER_URL + '/address/' + CONTRACT_ADDRESS} target="_blank" rel="noreferrer" style={{ color: '#fff' }}>
            CONTRACT: {shortAddr}{VERIFIED ? ' · ✓ VERIFIED' : ''} ↗
          </a>
        </div>
      </div>

      <main className="nb-wrap" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {wrongChain && (
          <div className="nb-card p-4" style={{ marginBottom: '1.5rem', background: 'var(--coral)', color: '#fff' }}>
            Wrong network. Please switch to {networkName} (Chain ID: {expectedChainId}).
          </div>
        )}

        {statFns.length > 0 && (
          <section style={{ ...gridCols(200), marginBottom: '2.5rem' }}>
            {statFns.map(fn => <StatCard key={fn.name} fn={fn} address={CONTRACT_ADDRESS} abi={CONTRACT_ABI} />)}
          </section>
        )}

        {writes.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <h2 className="nb-display" style={{ fontSize: '1.6rem', marginBottom: '.25rem' }}>Write functions</h2>
            <p style={{ color: 'var(--grey)', marginBottom: '1.25rem' }}>{isConnected ? 'Submit transactions to the contract.' : 'Connect your wallet to submit transactions.'}</p>
            <div style={gridCols(260)}>
              {writes.map(fn => <WriteFunctionCard key={fn.name} fn={fn} address={CONTRACT_ADDRESS} abi={CONTRACT_ABI} />)}
            </div>
          </section>
        )}

        {reads.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <h2 className="nb-display" style={{ fontSize: '1.6rem', marginBottom: '.25rem' }}>Read functions</h2>
            <p style={{ color: 'var(--grey)', marginBottom: '1.25rem' }}>Query live data from the contract.</p>
            <div style={gridCols(260)}>
              {reads.map(fn => <ReadFunctionCard key={fn.name} fn={fn} address={CONTRACT_ADDRESS} abi={CONTRACT_ABI} />)}
            </div>
          </section>
        )}

        {reads.length === 0 && writes.length === 0 && (
          <div className="nb-card p-10 text-center" style={{ color: 'var(--grey)' }}>No contract functions found in ABI.</div>
        )}
      </main>

      <footer style={{ borderTop: '3px solid var(--ink)' }}>
        <div className="nb-wrap nb-mono" style={{ paddingTop: '1.25rem', paddingBottom: '1.25rem', fontSize: '.72rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '.5rem' }}>
          <a href={EXPLORER_URL + '/address/' + CONTRACT_ADDRESS} target="_blank" rel="noreferrer">{CONTRACT_ADDRESS}</a>
          <span>Powered by {networkName}</span>
        </div>
      </footer>
    </div>
  )
}'''


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
        "src/components/Ticker.jsx": TICKER_JSX,
        "src/components/ContractCards.jsx": CONTRACT_CARDS_JSX,
        "src/pages/LandingPage.jsx": LANDING_PAGE_JSX,
        "src/pages/AppPage.jsx": APP_PAGE_JSX,
    }


async def write_shell_files(sandbox, base_path: str = REACT_APP_BASE):
    """Write all deterministic shell files into the sandbox, overwriting existing ones."""
    files = get_shell_files()
    for rel_path, content in files.items():
        await sandbox.files.write(f"{base_path}/{rel_path}", content)
    return list(files.keys())
