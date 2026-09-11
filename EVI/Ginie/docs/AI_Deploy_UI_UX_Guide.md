# AI Deployment API – UI/UX Guide

A lovable, Bolt.new/Windsurf-like experience for blockchain devs to go from prompt → on-chain in minutes.

## 1) Product principles
- One-click to “magic moment” (deploy on-chain fast, with transparency).
- Calm, confident, developer-first: clear logs, recoverable errors, copyable artifacts.
- Progressive control: start with prompt, graduate to full code editor.
- Consistency: every job, card, and status reads the same way.

## 2) Information architecture (Next.js App Router)
- /dashboard – Landing dashboard (entry point)
- /deploy – New deployment wizard (prompt → deploy)
- /jobs – Jobs table (observability)
- /jobs/[id] – Job details (timeline, logs, artifacts)
- /projects – Multi-contract projects (grouped deployments)
- /templates – Templates library (DAO, NFT, Treasury, ERC20)
- /editor – Code editor mode (Monaco)
- /settings – API keys, RPC, billing, webhooks
- /explorer – Public gallery of deployed dApps (optional)

## 3) Design system (tailored to your current stack: Tailwind + shadcn)
- Colors
  - Background: bg-background (dark/black, current site)
  - Primary: text-primary / bg-primary (brand violet)
  - Foreground: text-foreground (white)
  - Muted: text-muted-foreground, bg-secondary for surfaces
  - Status chips (colorblind-friendly):
    - running: bg-blue-600/20 text-blue-300 border-blue-600/40
    - completed: bg-emerald-600/20 text-emerald-300 border-emerald-600/40
    - failed: bg-rose-600/20 text-rose-300 border-rose-600/40
    - queued: bg-zinc-600/20 text-zinc-300 border-zinc-600/40
- Typography
  - Display: font-heading (Space Grotesk)
  - Body: font-sans (Inter)
- Spacing & radii
  - Containers: rounded-2xl on cards, rounded-full on pills & chips
  - Layout gutters: 24px-32px
- Components (map to shadcn)
  - Button, Badge, Card, Tabs, Accordion, Dialog/Drawer, Toast, Progress, Table
  - Monaco editor (third-party) in /editor

## 4) Entry point – Landing Dashboard (/dashboard)
- Hero: “One-click AI-powered smart contract deployment.”
- Primary CTA: Button variant="gradient" → “Generate My First dApp” (links to /deploy)
- Recent jobs
  - Table or list: contract, network, state chip, duration, updated time
  - Row click → /jobs/[id]
- Network selector
  - Dropdown: Basecamp, Camp Testnet, Custom RPC (persist in settings)
- Account section
  - Connect wallet or API key setup summary
- Psychology: immediate confidence; users see recency, status, and a clear path forward.

## 5) Core flow – Prompt-to-Deploy (/deploy)
- Form
  - Prompt textarea (contract spec; with examples placeholder)
  - Network dropdown
  - Optional constructor args (auto-suggest once ABI is known)
  - CTA: “Deploy Now”
- After submit → Job details view (/jobs/[id])
  - Timeline: Init → Generate → Compile → Fix → Deploy → Complete
  - Live logs stream (collapsible)
  - Progress bar with % (estimated)
  - Cancel button when running
- Success card
  - Contract name + address
  - Explorer link
  - ABI + Copy
  - Download Artifacts (ZIP)
- Psychology: a crisp “magic moment” with links and artifacts ready to use.

## 6) Iteration flow – Fix & Retry (within /jobs/[id])
- Error panel (red-accent card)
  - Compiler/runtime error text (monospace, collapsible)
  - AI “Explain Error” summary
- Actions
  - “Auto-Fix & Retry” (POST /ai/fix → /pipeline)
  - “Open in Editor” (to /editor with job sources)
- Psychology: failures feel safe and actionable.

## 7) Advanced flow – Code Editor Mode (/editor)
- Monaco editor with Solidity syntax, linting
- Side panel
  - ABI preview, constructor inputs
- Actions
  - Compile (/ai/compile)
  - AI-Fix (/ai/fix)
  - Deploy (/ai/pipeline with editor code)
- Psychology: power users can take control without losing the assistive layer.

## 8) Specialized flows
- ERC20 Wizard (/templates/erc20 or /deploy/erc20)
  - Form: Name, Symbol, Supply, Owner
  - Behind the scenes: POST /api/deploy/erc20
  - Post-deploy: “Add to Wallet”, “Explorer”, “Airdrop”
- Multi-Contract Projects (/projects)
  - Sidebar: contracts with status + address
  - Batch deploy panel: run multiple payloads, show parallel results

## 9) Observability – Jobs Dashboard (/jobs)
- Table columns: ID, Network, Contract, State, Progress, Duration, Updated
- Filters: running / failed / completed
- Row → /jobs/[id] with logs, timeline, artifacts, retry
- Actions: Download logs/artifacts (ZIP)

## 10) Artifacts & Integration UX (Artifacts tab in /jobs/[id])
- Tabs: Sources (code viewer), ABI (JSON viewer + Copy), Scripts (deploy.js preview)
- Buttons: Export ZIP, “Scaffold Frontend” (generate Next.js boilerplate with ABI + address)

## 11) Ecosystem & Social (optional)
- Badges for milestones: Deployed X contracts → Auditor/Builder/Grantee
- Public Explorer gallery: prompt + address showcase
- Grants Hub: CTA to apply for ecosystem grants

## 12) Error recovery UX
- Chain mismatch: suggest correct RPC + autofix
- Missing keys: prompt to configure RPC/PK in settings
- Gas errors: show estimation + “retry with bump”

## 13) Growth features
- Templates Library (DAO, NFT, Treasury, ERC20)
- Frontend Playground: connect wallet, read/write methods
- Sharing: copy link to share job/dApp
- Webhooks/API Keys: Slack/Discord notify on job complete
- Billing: usage & credits if SaaS

## 14) Interaction patterns & animations
- Progress: smooth bar; timeline steps highlight on advance
- Logs: fade-in lines; auto-scroll with “Pause” toggle
- Chips: subtle hover, accessible color contrast
- Empty states: positive copy + CTA (e.g., “No jobs yet — Try a template”) 

## 15) Accessibility & content
- Color contrast AA; colorblind-safe status hues
- Keyboard navigation for tabs/dialogs/forms; focus rings on actions
- Microcopy examples
  - Prompt placeholder: “e.g., ERC20 token with minting paused by default”
  - Success headline: “Deployed to Camp Testnet successfully”
  - Error summary: “We hit a compile error; here’s what it means and how to fix it.”

## 16) Data model (client-side)
```ts
// Job
id: string
state: 'queued'|'running'|'failed'|'completed'
progress: number // 0-100
network: string // 'camp-testnet' | 'basecamp' | 'custom'
contractName?: string
address?: string
durationMs?: number
updatedAt: string
artifacts?: {
  abi?: object
  sources?: Record<string, string>
  scripts?: Record<string, string>
  zipUrl?: string
}
logs?: { ts: string; level: 'info'|'warn'|'error'; msg: string }[]
```

## 17) API surfaces (sketch)
- POST /ai/pipeline { prompt, network, constructorArgs? } → { jobId }
- POST /ai/compile { sources } → { success, diagnostics }
- POST /ai/fix { jobId | sources, diagnostics } → { patch | newSources }
- GET /jobs → Job[]
- GET /jobs/:id → Job
- GET /jobs/:id/logs (SSE or WS)
- GET /jobs/:id/artifacts → { abi, sources, scripts, zipUrl }
- POST /api/deploy/erc20 { name, symbol, supply, owner, network }

## 18) Route & component blueprint (Next.js)
- app/(app)/dashboard/page.tsx
- app/(app)/deploy/page.tsx
- app/(app)/jobs/page.tsx
- app/(app)/jobs/[id]/page.tsx
- app/(app)/editor/page.tsx
- app/(app)/projects/page.tsx
- app/(app)/templates/page.tsx
- app/(app)/settings/page.tsx
- components/deploy/PromptForm.tsx
- components/jobs/JobsTable.tsx
- components/jobs/JobTimeline.tsx
- components/jobs/JobLogs.tsx
- components/jobs/ArtifactsTabs.tsx
- components/editor/MonacoPane.tsx
- components/common/StatusChip.tsx, NetworkSelect.tsx, WalletOrApi.tsx

## 19) Status chips (Tailwind)
- running: `bg-blue-600/20 text-blue-300 border border-blue-600/40`
- completed: `bg-emerald-600/20 text-emerald-300 border border-emerald-600/40`
- failed: `bg-rose-600/20 text-rose-300 border-rose-600/40`
- queued: `bg-zinc-600/20 text-zinc-300 border-zinc-600/40`

## 20) Quick wireframe notes
- Dashboard: two-column on lg: left (recent jobs), right (network/account cards)
- Job details: grid – left (timeline + actions), right (logs w/ sticky header), bottom tab (artifacts)
- Editor: split horizontally on md+ with resizable panel for ABI/inputs

## 21) Telemetry & success metrics
- Time-to-first-deploy, retry count per job, fix success rate
- Drop-off: deploy form → job running → job complete
- Template usage and playground interactions

## 22) Implementation tips in this codebase
- Reuse shadcn components already present (`button`, `badge`, `card`, `tabs`, `dialog`, `toast`, `progress`, `table`).
- Use existing color tokens in `globals.css`. Add status hues via Tailwind utilities per chip examples.
- Logs streaming: use SSE for simplicity; append to a virtualized list, with a “Pause autoscroll” toggle.
- Persist settings (network, RPCs, API key) in localStorage + server sync.
- Keep accessible focus states and keyboard traps for dialogs.

---
This guide is designed to plug into your current dark theme and component stack with minimal friction while giving a clear path from prompt → deploy → iterate, plus observability and growth features.
