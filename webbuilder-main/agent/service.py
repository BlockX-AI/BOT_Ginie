from .graph_builder import get_workflow
from typing import Dict
from e2b_code_interpreter import AsyncSandbox
from dotenv import load_dotenv
from fastapi import WebSocket
from db.base import get_db
from db.models import Message, Chat
from sqlalchemy import select
import os
import json
import time
import traceback
import uuid
from utils.store import load_json_store, save_json_store
import time

load_dotenv()

# Optional: Use custom E2B template if provided, otherwise use default
TEMPLATE_ID = os.getenv("E2B_TEMPLATE_ID")
base_path = "/home/user/react-app"


class Service:
    """
    LangGraph-based multi-agent service for React application development
    """

    def __init__(self) -> None:
        self.sandboxes: Dict[str, AsyncSandbox] = {}
        self.workflow = get_workflow()
        self.project_timestamps: Dict[str, float] = {}
        self.sandbox_timeout = 1800 
        self.storage_base_path = os.path.join(
            os.path.dirname(__file__), "..", "projects"
        )
        os.makedirs(self.storage_base_path, exist_ok=True)

    async def get_e2b_sandbox(self, id: str) -> AsyncSandbox:
        """Get or create E2B sandbox for project"""
        
        current_time = time.time()

        # Check if sandbox exists and is still valid
        if id in self.sandboxes:
            last_access = self.project_timestamps.get(id, 0)
            time_elapsed = current_time - last_access

            if time_elapsed < self.sandbox_timeout:
                await self.sandboxes[id].set_timeout(1800)
                self.project_timestamps[id] = current_time
                print(f"Extended timeout for existing sandbox: {id}")
                return self.sandboxes[id]
            else:
                # Sandbox expired, clean up
                print(f"Sandbox expired for project {id}, recreating...")
                await self.sandboxes[id].kill()
                del self.sandboxes[id]

        # Create new sandbox
        print(f"Initializing new sandbox for project id = {id}")
        
        # Use custom template if provided, otherwise use default
        if TEMPLATE_ID:
            print(f"Using E2B template: {TEMPLATE_ID}")
            self.sandboxes[id] = await AsyncSandbox.create(template=TEMPLATE_ID, timeout=1800)
        else:
            print("Using default E2B sandbox (no template)")
            self.sandboxes[id] = await AsyncSandbox.create(timeout=1800)
            
        await self.sandboxes[id].set_timeout(1800)
        self.project_timestamps[id] = current_time
        print("Sandbox created successfully")

        # Initialize React app directory structure
        await self._initialize_react_app_directory(self.sandboxes[id])

        # Restore files from database first (primary source of truth)
        await self._restore_files_from_database(id, self.sandboxes[id])
        
        # Fallback: Restore files from disk if no database files found
        await self._restore_files_from_disk(id, self.sandboxes[id])

        return self.sandboxes[id]
    
    async def _initialize_react_app_directory(self, sandbox: AsyncSandbox):
        """Initialize the React app directory structure if it doesn't exist"""
        try:
            # Check if directory exists
            result = await sandbox.commands.run(
                "test -d /home/user/react-app && echo 'exists' || echo 'missing'",
                cwd="/home/user"
            )
            
            if "missing" in result.stdout:
                print("Creating React app directory structure...")
                
                # Create directory structure
                await sandbox.commands.run(
                    "mkdir -p /home/user/react-app/src/components /home/user/react-app/src/pages /home/user/react-app/src/config /home/user/react-app/src/contracts /home/user/react-app/public",
                    cwd="/home/user"
                )

                # Create package.json with Web3 deps pre-listed
                package_json = '''{
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
    "vite": "^5.0.8",
    "tailwindcss": "^4.0.0"
  }
}'''
                await sandbox.files.write("/home/user/react-app/package.json", package_json)
                
                # Create vite.config.js
                vite_config = '''import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})'''
                await sandbox.files.write("/home/user/react-app/vite.config.js", vite_config)
                
                # Create index.html
                index_html = '''<!DOCTYPE html>
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
                await sandbox.files.write("/home/user/react-app/index.html", index_html)
                
                # Create src/config/wagmi.js — BOT Chain chain definition + RainbowKit config
                wagmi_js = '''import { defineChain, createConfig, http } from 'viem'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

const chainId = Number(import.meta.env.VITE_CHAIN_ID || 968)
const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://rpc.bohr.life'
const chainName = import.meta.env.VITE_NETWORK || 'BOT Chain Testnet'
const explorerUrl = import.meta.env.VITE_EXPLORER_URL || 'https://scan.bohr.life'

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
                await sandbox.files.write("/home/user/react-app/src/config/wagmi.js", wagmi_js)

                # Create main.jsx with WagmiProvider + QueryClientProvider + RainbowKitProvider
                main_jsx = '''import React from 'react'
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
                await sandbox.files.write("/home/user/react-app/src/main.jsx", main_jsx)
                
                # Create App.jsx — ABI-driven DApp UI
                app_jsx = r'''import React, { useState, useMemo } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseAbi, formatEther, parseEther } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'

// Contract config is pre-written by the orchestrator
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './config/contract'

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
    if (!data) return null
    if (typeof data === 'bigint') return formatEther(data) + ' ETH'
    if (Array.isArray(data)) return data.join(', ')
    return String(data)
  }, [data])

  return (
    <div className="bg-gray-800/60 rounded-xl p-5 border border-gray-700 hover:border-purple-500/50 transition">
      <h3 className="text-sm font-semibold text-purple-300 mb-3">{fn.name}()</h3>
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
        <button
          onClick={() => refetch()}
          className="w-full py-2 bg-purple-600/80 hover:bg-purple-500 rounded-lg text-sm font-medium transition"
        >
          {isLoading ? 'Loading...' : 'Read'}
        </button>
      ) : (
        <div className="text-sm text-gray-300">
          {isLoading ? 'Loading...' : isError ? 'Error' : result || '—'}
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
    <div className="bg-gray-800/60 rounded-xl p-5 border border-gray-700 hover:border-purple-500/50 transition">
      <h3 className="text-sm font-semibold text-purple-300 mb-3">{fn.name}()</h3>
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
            placeholder="ETH amount"
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
          {isPending ? 'Confirming...' : isConfirming ? 'Waiting...' : !account ? 'Connect Wallet' : 'Write'}
        </button>
      </form>
      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-xs text-green-400"
          >
            ✅ Transaction confirmed
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-xs text-red-400"
          >
            ❌ {error.shortMessage || 'Transaction failed'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function App() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { reads, writes } = useMemo(() => parseAbiFunctions(CONTRACT_ABI), [])

  const wrongChain = isConnected && chainId !== Number(import.meta.env.VITE_CHAIN_ID || 968)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-gray-950/60 border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            BotChain DApp
          </h1>
          <ConnectButton />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Wrong chain warning */}
        {wrongChain && (
          <div className="mb-6 bg-amber-900/40 border border-amber-600/50 rounded-xl p-4 text-center text-amber-200 text-sm">
            ⚠️ Wrong network. Please switch to BOT Chain Testnet (Chain ID: {import.meta.env.VITE_CHAIN_ID || 968})
          </div>
        )}

        {/* Contract info */}
        <div className="mb-8 bg-gray-800/40 rounded-xl p-5 border border-gray-700/50">
          <h2 className="text-sm text-gray-400 mb-1">Contract Address</h2>
          <p className="text-xs font-mono text-purple-300 break-all">{CONTRACT_ADDRESS}</p>
          <p className="text-xs text-gray-500 mt-2">
            Network: {import.meta.env.VITE_NETWORK || 'BOT Chain Testnet'} (ID: {import.meta.env.VITE_CHAIN_ID || 968})
          </p>
        </div>

        {/* Read functions */}
        {reads.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              Read Functions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reads.map(fn => (
                <ReadFunctionCard key={fn.name} fn={fn} address={CONTRACT_ADDRESS} abi={CONTRACT_ABI} />
              ))}
            </div>
          </section>
        )}

        {/* Write functions */}
        {writes.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
              Write Functions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {writes.map(fn => (
                <WriteFunctionCard key={fn.name} fn={fn} address={CONTRACT_ADDRESS} abi={CONTRACT_ABI} />
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

        {/* Disconnected hint */}
        {!isConnected && (writes.length > 0) && (
          <div className="mt-8 text-center text-sm text-gray-500">
            Connect your wallet to interact with write functions.
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 text-center text-xs text-gray-600">
        Built with BotChain DApp Builder
      </footer>
    </div>
  )
}

export default App'''
                await sandbox.files.write("/home/user/react-app/src/App.jsx", app_jsx)
                
                # Create index.css with Tailwind + dark theme base
                index_css = '''@import "tailwindcss";

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
                await sandbox.files.write("/home/user/react-app/src/index.css", index_css)

                # Overwrite the above scaffold with the canonical deterministic
                # neo-brutalist two-page shell so initial seeding == build-time
                # restore (single source of truth in agent/dapp_shell.py). This
                # also creates src/pages/* and src/components/* used by the shell.
                try:
                    from agent.dapp_shell import write_shell_files
                    seeded = await write_shell_files(sandbox)
                    print(f"🎨 Seeded neo-brutalist shell ({len(seeded)} files): {seeded}")
                except Exception as shell_err:
                    print(f"⚠️ Failed to seed deterministic shell (using scaffold): {shell_err}")

                print("React app directory structure initialized successfully")
            else:
                print("React app directory already exists")
                
        except Exception as e:
            print(f"Failed to initialize React app directory: {e}")

    async def _restore_files_from_database(self, project_id: str, sandbox: AsyncSandbox):
        """Restore files from database to sandbox when sandbox is recreated"""
        try:
            from db.base import AsyncSessionLocal
            from utils.file_manager import get_project_files_with_content
            
            async with AsyncSessionLocal() as db:
                files = await get_project_files_with_content(db=db, project_id=project_id)
                
                if not files:
                    print(f"No database files found for project {project_id}")
                    return
                
                print(f"Restoring {len(files)} files from database for project {project_id}")
                
                # Create necessary directories and write files
                restored_count = 0
                for file_path, content in files.items():
                    try:
                        full_path = f"/home/user/react-app/{file_path}"
                        
                        # Ensure parent directory exists
                        parent_dir = os.path.dirname(full_path)
                        if parent_dir and parent_dir != "/home/user/react-app":
                            await sandbox.commands.run(f"mkdir -p {parent_dir}", cwd="/home/user")
                        
                        # Write file to sandbox
                        await sandbox.files.write(full_path, content)
                        restored_count += 1
                    except Exception as e:
                        print(f"Failed to restore {file_path} from database: {e}")
                
                print(f"Database file restoration complete: {restored_count}/{len(files)} files restored for project {project_id}")
                
        except Exception as e:
            print(f"Failed to restore files from database: {e}")
            import traceback
            traceback.print_exc()

    async def close_sandbox(self, id: str):
        """Close and cleanup E2B sandbox"""
        if id in self.sandboxes:
            sandbox = self.sandboxes.pop(id)
            await sandbox.kill()
            print(f"closed sandbox: {id}")

    async def _restore_files_from_disk(self, project_id: str, sandbox: AsyncSandbox):
        """Restore files from disk to sandbox"""

        project_dir = os.path.join(self.storage_base_path, project_id)

        if not os.path.exists(project_dir):
            print(f"No stored files found for project {project_id}")
            return

        metadata_file = os.path.join(project_dir, "metadata.json")
        if not os.path.exists(metadata_file):
            print(f"No metadata found for project {project_id}")
            return

        with open(metadata_file, "r") as f:
            metadata = json.load(f)

        files = metadata.get("files", [])
        print(f"Restoring {len(files)} files for project {project_id}")

        for file_path in files:
            try:
                # Read from disk
                local_file = os.path.join(project_dir, file_path.replace("/", "_"))
                if os.path.exists(local_file):
                    with open(local_file, "r", encoding="utf-8") as f:
                        content = f.read()

                    # Write to sandbox
                    full_path = f"/home/user/react-app/{file_path}"
                    await sandbox.files.write(full_path, content)
                else:
                    print(f"Local file not found: {local_file}")
            except Exception as e:
                print(f"Failed to restore {file_path}: {e}")

        print(f"File restoration complete for project {project_id}")

        # Clean Vite cache to prevent permission issues
        try:
            await sandbox.commands.run(
                "rm -rf node_modules/.vite-temp", cwd="/home/user/react-app"
            )
            print("Cleaned Vite cache after restoration")
        except Exception as e:
            print(f"Failed to clean Vite cache: {e}")

    async def _save_conversation_history(
        self, project_id: str, user_prompt: str, success: bool
    ):
        """Save conversation history to context for future reference"""
        try:
            

            # Load existing context
            context = load_json_store(project_id, "context.json")

            # Get or initialize conversation history
            conversation_history = context.get("conversation_history", [])

            # Add new conversation entry
            conversation_entry = {
                "timestamp": time.time(),
                "user_prompt": user_prompt,
                "success": success,
                "date": str(os.popen("date").read().strip()),
            }

            conversation_history.append(conversation_entry)

            # Keep only last 10 conversations to avoid bloat
            if len(conversation_history) > 10:
                conversation_history = conversation_history[-10:]

            # Update context
            context["conversation_history"] = conversation_history
            save_json_store(project_id, "context.json", context)

            print(f"Saved conversation history for project {project_id}")

        except Exception as e:
            print(f"Failed to save conversation history: {e}")

    async def snapshot_project_files(self, project_id: str):
        """Snapshot all source files from sandbox to disk"""

        if project_id not in self.sandboxes:
            return

        sandbox = self.sandboxes[project_id]

        project_dir = os.path.join(self.storage_base_path, project_id)
        os.makedirs(project_dir, exist_ok=True)

        paths_to_snapshot = [
            "src",
            "public",
            "package.json",
            "index.html",
        ]

        files_stored = []

        for path in paths_to_snapshot:
            try:
                full_path = f"/home/user/react-app/{path}"
                result = await sandbox.commands.run(
                    f"test -f {full_path} && echo 'file' || test -d {full_path} && echo 'dir'",
                    cwd="/home/user/react-app",
                )

                if "file" in result.stdout:
                    content = await sandbox.files.read(full_path)
                    local_file = os.path.join(project_dir, path.replace("/", "_"))
                    with open(local_file, "w", encoding="utf-8") as f:
                        f.write(content)
                    files_stored.append(path)

                elif "dir" in result.stdout:
                    find_result = await sandbox.commands.run(
                        f"find {path} -type f", cwd="/home/user/react-app"
                    )
                    file_paths = find_result.stdout.strip().split("\n")

                    for file_path in file_paths:
                        if file_path and not file_path.startswith("."):
                            try:
                                content = await sandbox.files.read(
                                    f"/home/user/react-app/{file_path}"
                                )
                                local_file = os.path.join(
                                    project_dir, file_path.replace("/", "_")
                                )
                                with open(local_file, "w", encoding="utf-8") as f:
                                    f.write(content)
                                files_stored.append(file_path)
                            except Exception as e:
                                print(f"Failed to snapshot {file_path}: {e}")
            except Exception as e:
                print(f"Failed to snapshot {path}: {e}")

        # Save metadata
        metadata = {
            "project_id": project_id,
            "files": files_stored,
            "timestamp": time.time(),
        }
        metadata_file = os.path.join(project_dir, "metadata.json")
        with open(metadata_file, "w") as f:
            json.dump(metadata, f, indent=2)

        print(f"Snapshotted {len(files_stored)} files for project {project_id} to disk")

    async def _store_message(
        self,
        chat_id: str,
        role: str,
        content: str,
        event_type: str = None,
        tool_calls: list = None,
    ):
        """Helper to store a message in the database"""


        async for db in get_db():
            message = Message(
                id=str(uuid.uuid4()),
                chat_id=chat_id,
                role=role,
                content=content,
                event_type=event_type,
                tool_calls=tool_calls,
            )
            db.add(message)
            await db.commit()
            break

    async def _send_ws_message(self, socket: WebSocket, data: dict):
        """Helper to safely send WebSocket message"""
        try:
            await socket.send_json(data)
        except Exception as e:
            print(f"Failed to send WebSocket message: {e}")
            return

    async def run_agent_stream(self, prompt: str, id: str, socket: WebSocket, model: str = "gpt-4o", db=None):
        """
        Run the LangGraph multi-agent workflow
        
        Args:
            prompt: User's prompt for the AI
            id: Project/chat ID
            socket: WebSocket for real-time updates
            model: Selected AI model (gemini-2.5-pro, gemini-2.5-flash, gpt-4, claude-3)
        """
        try:
            # Store user message first
            await self._store_message(
                chat_id=id,
                role="user",
                content=prompt,
                event_type=None
            )

            await self._send_ws_message(socket, {
                "e": "started",
                "message": f"Starting LangGraph workflow with {model}...",
            })

            sandbox = await self.get_e2b_sandbox(id=id)

            initial_state = {
                "project_id": id,
                "user_prompt": prompt,
                "enhanced_prompt": prompt,
                "plan": None,
                "files_created": [],
                "files_modified": [],
                "current_errors": {},
                "validation_errors": [],
                "runtime_errors": [],
                "retry_count": {
                    "validation_errors": 0,
                    "runtime_errors": 0,
                },
                "max_retries": 3,
                "sandbox": sandbox,
                "socket": socket,
                "current_node": "",
                "execution_log": [],
                "success": False,
                "error_message": None,
                "fatal_error": False,
                "selected_model": model,  # Pass selected model to workflow
            }

            print(f"Starting LangGraph workflow with prompt: {prompt}")
            print(f"Project ID: {id}")
            print(f"Selected Model: {model}")

            # Run the workflow
            final_state = await self.workflow.run_workflow(initial_state)

            # Get the final URL
            host = sandbox.get_host(port=5173)
            url = f"https://{host}"

            print(f"\nWorkflow completed. Project live at: {url}\n")
            print(f"Workflow success: {final_state.get('success')}")
            print(f"Files created: {final_state.get('files_created')}")

            # Save conversation history for future context
            await self._save_conversation_history(
                project_id=id,
                user_prompt=prompt,
                success=final_state.get('success', False)
            )

            async for db in get_db():
                completion_message = Message(
                    id=str(uuid.uuid4()),
                    chat_id=id,
                    role="assistant",
                    content="LangGraph workflow completed" if final_state.get('success') else f"Workflow completed with errors: {final_state.get('error_message')}",
                    event_type="completed",
                )
                db.add(completion_message)

                result = await db.execute(select(Chat).where(Chat.id == id))
                chat = result.scalar_one_or_none()
                if chat:
                    chat.app_url = url
                    print(f"Saved app_url to database: {url}")

                await db.commit()
                break

            await self._send_ws_message(socket, {
                "e": "completed", 
                "url": url,
                "success": final_state.get('success'),
                "message": "Workflow completed successfully!"
            })

        except Exception as e:
            print(f"Error during LangGraph workflow execution: {e}")
            print(f"Error type: {type(e)}")
            print(f"Error details: {str(e)}")
            

            traceback.print_exc()
            
            await self._send_ws_message(socket, {
                "e": "error",
                "message": f"Workflow failed: {str(e)}"
            })


agent_service = Service()
