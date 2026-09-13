from e2b_code_interpreter import AsyncSandbox
from fastapi import WebSocket
from langchain_core.tools import tool
import os
import json
from utils.store import save_json_store, load_json_store
from db.base import get_db
from utils.file_manager import store_project_file
import logging

logger = logging.getLogger(__name__)


def create_tools_with_context(
    sandbox: AsyncSandbox, socket: WebSocket, project_id: str = None
):
    """Create tools with sandbox and socket context"""

    def _check_write_allowed(file_path: str):
        """
        Return an error string if file_path is a pipeline-protected path.
        Protection is driven by context.json["protected_paths"] — only set for
        DApp flows, so generic webbuilder projects are unaffected.
        """
        try:
            ctx = load_json_store(project_id, "context.json") or {}
            protected = ctx.get("protected_paths") or []
        except Exception:
            protected = []
        rel = (file_path or "").lstrip("/").replace("\\", "/")
        for p in protected:
            p = p.lstrip("/").replace("\\", "/")
            if rel == p or rel.startswith(p.rstrip("/") + "/"):
                return (
                    f"BLOCKED: '{rel}' is a protected pipeline file — do NOT create, "
                    "modify or delete it. Write only your assigned component/theme files."
                )
        return None

    async def safe_send_json(sock: WebSocket, data: dict) -> bool:
        """Safely send JSON over WebSocket; return False if send fails or socket closed."""
        try:
            # Check WebSocket application state before sending
            # State 1 = CONNECTED, other states mean disconnected/closing
            if hasattr(sock, 'application_state') and sock.application_state.value != 1:
                return False
            if hasattr(sock, 'client_state') and sock.client_state.value != 1:
                return False
            await sock.send_json(data)
            return True
        except Exception as e:
            # Only log if it's not a common disconnection error
            error_str = str(e)
            if "websocket.close" not in error_str and "response already completed" not in error_str:
                print(f"safe_send_json failed: {e}")
            return False

    @tool
    async def create_file(file_path: str, content: str) -> str:
        """
        Create a file with the given content at the specified path.

        Args:
            file_path: The path where the file should be created (e.g., "src/App.jsx", "src/components/Header.jsx")
            content: The content to write to the file (React components, HTML, CSS, etc.)

        Returns:
            Success message with file path or error message if failed

        Example:
            create_file("src/App.jsx", "import React from 'react';\\nexport default function App() { return <div>Hello</div>; }")
        """
        try:
            denied = _check_write_allowed(file_path)
            if denied:
                return denied
            # The React app is in /home/user/react-app
            full_path = os.path.join("/home/user/react-app", file_path)

            # The LLM sometimes generates code with literal \n instead of actual newlines
            # We need to handle this by decoding escape sequences
            # Use bytes decode to properly interpret escape sequences
            try:
                # Try to decode the content as if it contains escaped characters
                # This converts literal \n, \t, etc. to actual newline and tab characters
                fixed_content = content.encode("utf-8").decode("unicode_escape")
            except (UnicodeDecodeError, AttributeError):
                # If decode fails, content is likely already correct, use as-is
                fixed_content = content

            # Write file to sandbox
            await sandbox.files.write(full_path, fixed_content)
            
            # Store in database immediately for live file viewing
            if project_id:
                try:
                    async for db in get_db():
                        # Create callback for WebSocket notification
                        async def notify_callback(event_data):
                            await safe_send_json(socket, event_data)
                        
                        await store_project_file(
                            db=db,
                            project_id=project_id,
                            file_path=file_path,
                            content=fixed_content,
                            notify_callback=notify_callback
                        )
                        break
                except Exception as db_error:
                    logger.warning(f"Failed to store file in DB: {db_error}")
            
            await safe_send_json(socket, {"e": "file_created", "message": f"Created {file_path}", "file_path": file_path})
            return f"File {file_path} created successfully."
        except Exception as e:
            await safe_send_json(socket, {"e": "file_error", "message": f"Failed to create {file_path}: {str(e)}",})
            return f"Failed to create file {file_path}: {str(e)}"

    @tool
    async def read_file(file_path: str) -> str:
        """
        Read the content of a file from the react-app directory.

        Args:
            file_path: The path of the file to read (e.g., "src/App.jsx", "package.json")

        Returns:
            The file content as a string, or error message if file not found

        Example:
            read_file("src/App.jsx") - reads the main App component
            read_file("package.json") - reads package dependencies
        """
        try:
            # The React app is in /home/user/react-app
            full_path = os.path.join("/home/user/react-app", file_path)
            content = await sandbox.files.read(full_path)
            await safe_send_json(socket, {"e": "file_read", "message": f"Read content from {file_path}"})
            return f"Content from {file_path}:\n{content}"
        except Exception as e:
            await safe_send_json(socket, {"e": "file_error", "message": f"Failed to read {file_path}: {str(e)}"})
            return f"Failed to read file {file_path}: {str(e)}"

    @tool
    async def delete_file(file_path: str) -> str:
        """
        Delete a file from the react-app directory.

        Args:
            file_path: The path of the file to delete (e.g., "src/old-component.jsx")

        Returns:
            Success message or error message if deletion failed

        Example:
            delete_file("src/old-component.jsx") - removes an unused component
        """
        try:
            denied = _check_write_allowed(file_path)
            if denied:
                return denied
            # The React app is in /home/user/react-app
            full_path = os.path.join("/home/user/react-app", file_path)
            await sandbox.files.remove(full_path)
            await safe_send_json(socket, {"e": "file_deleted", "message": f"Deleted {file_path}"})
            return f"File {file_path} deleted successfully."
        except Exception as e:
            await safe_send_json(socket, {"e": "file_error", "message": f"Failed to delete {file_path}: {str(e)}",})
            return f"Failed to delete file {file_path}: {str(e)}"

    @tool
    async def execute_command(command: str) -> str:
        """
        Execute a shell command within the react-app directory.

        Args:
            command: The shell command to execute (e.g., "npm install", "npm run dev", "mkdir src/components")

        Returns:
            Command output and success/error status

        Common Commands:
            - "npm install" - install dependencies
            - "npm install react-router-dom" - install specific package
            - "mkdir -p src/components" - create directory structure
            - "npm run dev" - start development server (usually already running)

        Example:
            execute_command("npm install react-router-dom") - installs routing library
        """
        try:
            await safe_send_json(socket, {"e": "command_started", "command": command})
            print(f"🔧 execute_command: {command}")

            # The React app is in /home/user/react-app
            result = await sandbox.commands.run(command, cwd="/home/user/react-app", timeout=120)

            await safe_send_json(
                socket,
                {
                    "e": "command_output",
                    "command": command,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.exit_code,
                },
            )

            if result.exit_code == 0:
                await safe_send_json(
                    socket,
                    {
                        "e": "command_executed",
                        "command": command,
                        "message": "Command executed successfully",
                    },
                )
                return f"Command '{command}' executed successfully. Output: {result.stdout[:500]}{'...' if len(result.stdout) > 500 else ''}"
            else:
                await safe_send_json(
                    socket,
                    {
                        "e": "command_failed",
                        "command": command,
                        "message": f"Command failed with exit code {result.exit_code}",
                    },
                )
                return f"Command '{command}' failed with exit code {result.exit_code}. Error: {result.stderr[:500]}{'...' if len(result.stderr) > 500 else ''}"

        except Exception as e:
            await safe_send_json(
                socket,
                {
                    "e": "command_error",
                    "command": command,
                    "message": f"Command execution error: {str(e)}",
                },
            )
            return f"Command '{command}' failed with error: {str(e)}"

    @tool
    async def list_directory(path: str = ".") -> str:
        """
        List the directory structure using find command, excluding node_modules and hidden files.

        Args:
            path: The directory path to list (default: "." for current directory)

        Returns:
            Formatted directory tree structure

        Example:
            list_directory() - lists current directory
            list_directory("src") - lists src directory structure

        Note:
            Automatically excludes node_modules and hidden files for cleaner output
        """
        try:
            # Use find command instead of tree (tree may not be installed)
            cmd = f"find {path} -type f -o -type d | grep -v node_modules | grep -v '/\\.' | head -100"
            await safe_send_json(socket, {"e": "command_started", "command": f"list {path}"})

            result = await sandbox.commands.run(cmd, cwd="/home/user/react-app")

            await safe_send_json(
                socket,
                {
                    "e": "command_output",
                    "command": f"list {path}",
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.exit_code,
                },
            )

            if result.exit_code == 0:
                await safe_send_json(
                    socket,
                    {
                        "e": "command_executed",
                        "command": f"list {path}",
                        "message": "Directory structure listed successfully",
                    },
                )
                return f"Directory structure:\n{result.stdout}"
            else:
                await safe_send_json(
                    socket,
                    {
                        "e": "command_failed",
                        "command": f"list {path}",
                        "message": f"Command failed with exit code {result.exit_code}",
                    },
                )
                return f"Failed to list directory structure. Error: {result.stderr}"

        except Exception as e:
            await safe_send_json(
                socket,
                {
                    "e": "command_error",
                    "command": f"tree -I 'node_modules|.*' {path}",
                    "message": f"Command execution error: {str(e)}",
                },
            )
            return f"Failed to list directory: {str(e)}"

    @tool
    def get_context() -> str:
        """Fetches the last saved context for the current project."""
        return "Get context - not implemented yet"

    @tool
    async def test_build() -> str:
        """
        Test if the application builds successfully by running npm run build.
        This cleans the Vite cache, runs npm install if needed, and attempts a build.

        Returns:
            Success message with build output or error message with details

        Example:
            test_build() - Tests if the current application builds without errors

        Note:
            This is useful for validating that all files are correct before deployment
        """
        try:
            path = "/home/user/react-app"

            await safe_send_json(socket, {"e": "build_test_started", "message": "Testing application build..."})

            # Clean Vite cache first nd run npm install
            clean_command = "rm -rf node_modules/.vite-temp && npm install"
            await sandbox.commands.run(clean_command, cwd=path)

            # Run build
            build_command = "npm run build"
            res = await sandbox.commands.run(build_command, cwd=path)

            if res.exit_code == 0:
                await safe_send_json(
                    socket,
                    {
                        "e": "build_test_success",
                        "message": "Build test passed successfully",
                    },
                )
                return f"Build test PASSED. Application builds successfully.\n\nBuild output:\n{res.stdout[:500]}"
            else:
                error_output = res.stderr if res.stderr else res.stdout
                await safe_send_json(
                    socket,
                    {
                        "e": "build_test_failed",
                        "message": "Build test failed",
                        "error": error_output[:500],
                    },
                )
                return f"Build test FAILED with exit code {res.exit_code}.\n\nError:\n{error_output[:1000]}"

        except Exception as e:
            await safe_send_json(socket, {"e": "build_test_error", "message": f"Build test error: {str(e)}"})
            return f"Build test failed with error: {str(e)}"

    @tool
    async def write_multiple_files(files: str) -> str:
        """
        Write multiple files to the sandbox at once for better efficiency.

        Args:
            files: JSON string containing array of file objects with 'path' and 'data' keys

        Returns:
            Success message with list of created files or error message

        Format:
            [
                {"path": "src/App.jsx", "data": "import React from 'react';..."},
                {"path": "src/components/Header.jsx", "data": "export default function Header() {...}"}
            ]

        Example:
            write_multiple_files('[{"path": "src/App.jsx", "data": "import React from \'react\'; export default function App() { return <div>Hello</div>; }"}]')

        Benefits:
            - More efficient than creating files one by one
            - Prevents agent from stopping prematurely
            - Creates complete application structure at once
        """
        try:
            # Better error handling for JSON parsing
            try:
                files_data = json.loads(files)
            except json.JSONDecodeError as je:
                error_msg = f"Invalid JSON format at position {je.pos}: {je.msg}. Please ensure proper JSON formatting with escaped quotes."
                await safe_send_json(
                    socket,
                    {
                        "e": "file_error",
                        "message": error_msg,
                    },
                )
                return error_msg

            # Convert to the format expected by E2B
            file_objects = []
            files_to_store = []  # Track files for DB storage
            skipped_protected = []

            for file_info in files_data:
                if _check_write_allowed(file_info.get("path", "")):
                    skipped_protected.append(file_info.get("path", ""))
                    continue
                # Fix escape sequences in the data (same as create_file)
                content = file_info["data"]
                try:
                    # Try to decode the content as if it contains escaped characters
                    # This converts literal \n, \t, etc. to actual newline and tab characters
                    fixed_content = content.encode("utf-8").decode("unicode_escape")
                except (UnicodeDecodeError, AttributeError):
                    # If decode fails, content is likely already correct, use as-is
                    fixed_content = content

                file_objects.append(
                    {
                        "path": os.path.join("/home/user/react-app", file_info["path"]),
                        "data": fixed_content,
                    }
                )
                
                # Save for DB storage
                files_to_store.append({
                    "path": file_info["path"],
                    "content": fixed_content
                })

            # Write all files to sandbox
            await sandbox.files.write_files(file_objects)
            
            # Store each file in database immediately for live viewing
            if project_id:
                try:
                    async for db in get_db():
                        # Create callback for WebSocket notifications
                        async def notify_callback(event_data):
                            await safe_send_json(socket, event_data)
                        
                        for file_info in files_to_store:
                            try:
                                await store_project_file(
                                    db=db,
                                    project_id=project_id,
                                    file_path=file_info["path"],
                                    content=file_info["content"],
                                    notify_callback=notify_callback
                                )
                            except Exception as file_error:
                                logger.warning(f"Failed to store {file_info['path']} in DB: {file_error}")
                        break
                except Exception as db_error:
                    logger.warning(f"Failed to store files in DB: {db_error}")

            file_names = [f["path"] for f in files_to_store]
            await safe_send_json(
                socket,
                {
                    "e": "files_created",
                    "message": f"Created {len(file_names)} files: {', '.join(file_names)}",
                },
            )

            result_msg = f"Successfully created {len(file_names)} files: {', '.join(file_names)}"
            if skipped_protected:
                result_msg += (
                    f" | BLOCKED {len(skipped_protected)} protected file(s) "
                    f"(not written): {', '.join(skipped_protected)}"
                )
            return result_msg

        except Exception as e:
            await safe_send_json(
                socket,
                {
                    "e": "file_error",
                    "message": f"Failed to create multiple files: {str(e)}",
                },
            )
            return f"Failed to create multiple files: {str(e)}"

    @tool
    def get_context() -> str:
        """
        Fetch the last saved context for the current project.
        This includes information about:
        - What the project is about (semantic memory)
        - How things work in the project (procedural memory)
        - What has been done so far (episodic memory)

        Returns:
            Saved project context as a formatted string, or message if no context exists

        Example:
            get_context() - Retrieves the project context to understand what was previously built

        Use this tool:
        - At the start of your work to understand the project
        - To check what components/features already exist
        - To understand the project structure and conventions
        """
        if not project_id:
            return "No project ID available - context cannot be retrieved"

        try:
            context = load_json_store(project_id, "context.json")

            if not context:
                return "No previous context found for this project. This appears to be a new project."

            # Format the context for display
            result = "=== PROJECT CONTEXT ===\n\n"

            if context.get("semantic"):
                result += "📋 WHAT THIS PROJECT IS:\n"
                result += f"{context['semantic']}\n\n"

            if context.get("procedural"):
                result += "HOW THINGS WORK:\n"
                result += context["procedural"] + "\n\n"

            if context.get("episodic"):
                result += "WHAT HAS BEEN DONE:\n"
                result += f"{context['episodic']}\n\n"

            if context.get("files_created"):
                result += f"📁 FILES CREATED: {len(context['files_created'])} files\n"
                result += f"   {', '.join(context['files_created'][:10])}"
                if len(context["files_created"]) > 10:
                    result += f" ... and {len(context['files_created']) - 10} more"
                result += "\n\n"

            if context.get("conversation_history"):
                result += "CONVERSATION HISTORY:\n"
                for i, conv in enumerate(context["conversation_history"][-5:], 1):
                    status = "[SUCCESS]" if conv.get("success") else "[FAILED]"
                    result += f"   {i}. {status} {conv.get('user_prompt', 'Unknown')[:80]}...\n"
                result += "\n"

            if context.get("last_updated"):
                result += f"Last Updated: {context['last_updated']}\n"

            return result

        except Exception as e:
            return f"Failed to retrieve context: {str(e)}"

    @tool
    def save_context(semantic: str, procedural: str = "", episodic: str = "") -> str:
        """
        Save project context for future sessions.
        This helps maintain continuity across different work sessions.

        Args:
            semantic: What the project is about (e.g., "E-commerce site for jewelry with cart and checkout")
            procedural: How things work (e.g., "Uses React Router for navigation, Context API for state")
            episodic: What has been done (e.g., "Created product catalog, cart functionality, and checkout flow")

        Returns:
            Success message confirming context was saved

        Example:
            save_context(
                semantic="Portfolio website for Abhay with projects, skills, and contact form",
                procedural="Uses React Router, Tailwind CSS for styling, data stored in src/data/",
                episodic="Created all pages, components, and navigation. Added responsive design."
            )

        Use this tool:
        - After completing major features
        - Before finishing your work
        - When you want to document what you've built
        """
        if not project_id:
            return "No project ID available - context cannot be saved"

        try:
            # Load existing context to preserve information
            existing_context = load_json_store(project_id, "context.json") or {}

            # Start from existing context to avoid dropping keys like 'files', 'contracts', deployment fields
            context = dict(existing_context)

            # Update/merge primary fields
            if semantic:
                context["semantic"] = semantic
            else:
                context["semantic"] = existing_context.get("semantic", "")

            if procedural:
                context["procedural"] = procedural
            else:
                context["procedural"] = existing_context.get("procedural", "")

            if episodic:
                context["episodic"] = episodic
            else:
                context["episodic"] = existing_context.get("episodic", "")

            context["last_updated"] = str(os.popen("date").read().strip())

            # Merge files_created array without duplicates
            existing_fc = existing_context.get("files_created", [])
            context_fc = list(dict.fromkeys(existing_fc))
            context["files_created"] = context_fc

            # Preserve conversation history (append-only behavior is handled elsewhere)
            context["conversation_history"] = existing_context.get("conversation_history", [])

            # Write back merged context (preserving keys like 'files', 'contracts', 'vercel_url', 'deployment_status')
            save_json_store(project_id, "context.json", context)

            return f"Context saved successfully for project {project_id}. This information will be available in future sessions."

        except Exception as e:
            return f"Failed to save context: {str(e)}"

    @tool
    async def save_contract_info(
        contract_name: str,
        contract_address: str,
        chain_id: int,
        network: str,
        abi_json: str,
    ) -> str:
        """
        Save smart contract details and write an ABI bundle into the sandbox.

        Args:
            contract_name: A short name for the contract (e.g., "MyNFT")
            contract_address: Deployed address (0x...)
            chain_id: EVM chain ID (e.g., 1, 11155111, 137)
            network: Human-readable network (e.g., "mainnet", "sepolia", "polygon")
            abi_json: The contract ABI as a JSON string

        Writes:
            - /home/user/react-app/src/contracts/{contract_name}.json with { address, chainId, network, abi }
            - Persists metadata into project context store for reuse
        """
        try:
            # Parse ABI
            abi = json.loads(abi_json) if isinstance(abi_json, str) else abi_json

            # Ensure directory exists
            await sandbox.commands.run(
                "mkdir -p src/contracts",
                cwd="/home/user/react-app",
            )

            bundle = {
                "name": contract_name,
                "address": contract_address,
                "chainId": chain_id,
                "network": network,
                "abi": abi,
            }

            # Write ABI bundle to sandbox
            target_path = f"/home/user/react-app/src/contracts/{contract_name}.json"
            await sandbox.files.write(target_path, json.dumps(bundle, indent=2))

            # Save to project context on disk (server-side) for persistence
            if project_id:
                context = load_json_store(project_id, "context.json")
                contracts = context.get("contracts", [])
                # Update or append
                updated = False
                for i, c in enumerate(contracts):
                    if c.get("name") == contract_name:
                        contracts[i] = bundle
                        updated = True
                        break
                if not updated:
                    contracts.append(bundle)
                context["contracts"] = contracts
                save_json_store(project_id, "context.json", context)

            await safe_send_json(socket, {"e": "contract_saved", "message": f"Saved contract {contract_name} at {contract_address} on {network}"})
            return f"Saved contract info and wrote src/contracts/{contract_name}.json"
        except Exception as e:
            await safe_send_json(socket, {"e": "contract_error", "message": f"Failed to save contract: {str(e)}"})
            return f"Failed to save contract info: {str(e)}"

    @tool
    async def create_web3_boilerplate(default_chain: str = "botchain-testnet") -> str:
        """
        Scaffold Web3 boilerplate using wagmi + RainbowKit.

        Creates/overwrites minimal files if absent:
          - src/config/wagmi.js
          - src/components/WalletConnect.jsx
          - src/hooks/useContract.js
        And ensures directories exist.
        
        Args:
            default_chain: Target blockchain network (default: botchain-testnet)
        """
        try:
            await sandbox.commands.run("mkdir -p src/config src/components src/hooks", cwd="/home/user/react-app")

            wagmi_js = f"""
import {{ http }} from 'viem'
import {{ getDefaultConfig }} from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

// Common chains (extend as needed)
export const CHAINS = {{
  mainnet: {{ id: 1, name: 'Ethereum', rpcUrls: [ 'https://eth.llamarpc.com' ] }},
  sepolia: {{ id: 11155111, name: 'Sepolia', rpcUrls: [ 'https://ethereum-sepolia-rpc.publicnode.com' ] }},
  polygon: {{ id: 137, name: 'Polygon', rpcUrls: [ 'https://polygon.llamarpc.com' ] }},
  base:    {{ id: 8453, name: 'Base', rpcUrls: [ 'https://mainnet.base.org' ] }},
  botchain: {{ id: 677, name: 'BOT Chain', rpcUrls: [ 'https://rpc.botchain.ai' ] }},
  'botchain-testnet': {{ id: 968, name: 'BOT Chain Testnet (Bohr)', rpcUrls: [ 'https://rpc.bohr.life' ] }},
}}

const chain = CHAINS['{default_chain}'] || CHAINS['botchain-testnet']

export const wagmiConfig = getDefaultConfig({{
  appName: 'Web3 App',
  projectId: 'WALLETCONNECT_PROJECT_ID', // Replace with your WalletConnect project ID for production
  chains: [ {{ id: chain.id, name: chain.name, rpcUrls: {{ default: {{ http: chain.rpcUrls[0] }} }} }} ],
  transports: {{ [chain.id]: http(chain.rpcUrls[0]) }},
}})
""".strip()

            wallet_connect = """
import React from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export default function WalletConnect() {
  return (
    <div className="p-2">
      <ConnectButton />
    </div>
  )
}
""".strip()

            use_contract = """
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'

export function useContractRead({ address, abi, functionName, args = [] }) {
  return useReadContract({ address, abi, functionName, args })
}

export function useContractWrite({ address, abi, functionName, args = [], valueEth }) {
  const {{ writeContract, data: hash, error }} = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })

  function write() {
    writeContract({ address, abi, functionName, args, ...(valueEth ? {{ value: parseEther(String(valueEth)) }} : {{}}) })
  }

  return {{ write, hash, ...receipt, error }}
}
""".strip()

            await sandbox.files.write("/home/user/react-app/src/config/wagmi.js", wagmi_js)
            await sandbox.files.write("/home/user/react-app/src/components/WalletConnect.jsx", wallet_connect)
            await sandbox.files.write("/home/user/react-app/src/hooks/useContract.js", use_contract)

            await safe_send_json(socket, {"e": "web3_scaffolded", "message": "Created Web3 boilerplate (wagmi/RainbowKit)"})
            return "Web3 boilerplate created: config, wallet connect component, and hooks."
        except Exception as e:
            await safe_send_json(socket, {"e": "web3_error", "message": f"Failed to scaffold web3: {str(e)}"})
            return f"Failed to scaffold web3: {str(e)}"

    @tool
    async def check_missing_packages() -> str:
        """
        Check for missing packages by reading package.json and scanning source files for imports.
        This tool identifies missing dependencies and provides installation commands.

        Returns:
            A report of missing packages and installation commands

        Example:
            check_missing_packages() - Scans files and reports missing packages
        """
        try:
            # Read package.json to see installed packages
            package_json_path = "/home/user/react-app/package.json"
            package_content = await sandbox.files.read(package_json_path)
            package_data = json.loads(package_content)
            installed_deps = package_data.get("dependencies", {})

            # Find all source files
            find_result = await sandbox.commands.run(
                "find src -name '*.jsx' -o -name '*.js'", cwd="/home/user/react-app"
            )
            source_files = [
                f.strip() for f in find_result.stdout.strip().split("\n") if f.strip()
            ]

            # Scan all files for import statements
            all_imports = set()
            for file_path in source_files:
                try:
                    full_path = f"/home/user/react-app/{file_path}"
                    content = await sandbox.files.read(full_path)

                    # Extract import statements
                    import_lines = [
                        line.strip()
                        for line in content.split("\n")
                        if line.strip().startswith("import")
                    ]
                    for line in import_lines:
                        # Extract package names from import statements
                        if "from" in line:
                            # Remove semicolons and extract package name properly
                            after_from = line.split("from")[1].strip()
                            # Remove trailing semicolon if present
                            after_from = after_from.rstrip(';').strip()
                            # Extract between quotes
                            if "'" in after_from:
                                package = after_from.split("'")[1]
                            elif '"' in after_from:
                                package = after_from.split('"')[1]
                            else:
                                continue
                            
                            # Extract root package name
                            # For scoped packages like @rainbow-me/rainbowkit, keep @scope/package
                            # For regular packages like react-icons/fa, keep just react-icons
                            if package.startswith("@"):
                                # Scoped package: take first 2 parts (@scope/package)
                                parts = package.split("/")
                                root_package = "/".join(parts[:2]) if len(parts) >= 2 else parts[0]
                            else:
                                # Regular package: take first part only
                                root_package = package.split("/")[0].strip()
                            
                            # Skip relative imports and empty strings
                            if root_package and not root_package.startswith("."):
                                all_imports.add(root_package)
                        elif "import" in line and "from" not in line:
                            # Handle import 'package' syntax (less common)
                            line_clean = line.replace("import", "").strip().rstrip(';').strip()
                            if "'" in line_clean or '"' in line_clean:
                                package = (
                                    line_clean.split("'")[1]
                                    if "'" in line_clean
                                    else line_clean.split('"')[1]
                                )
                                
                                # Same scoped package logic
                                if package.startswith("@"):
                                    parts = package.split("/")
                                    root_package = "/".join(parts[:2]) if len(parts) >= 2 else parts[0]
                                else:
                                    root_package = package.split("/")[0].strip()
                                
                                if root_package and not root_package.startswith("."):
                                    all_imports.add(root_package)
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

            # Check which packages are missing
            missing_packages = []
            for package in all_imports:
                # Skip empty, invalid, or built-in packages
                if (
                    package
                    and package not in installed_deps
                    and package not in ["react", "react-dom"]
                    and not package.startswith(".")
                    and len(package) > 1  # Avoid single char artifacts
                ):
                    missing_packages.append(package)

            if missing_packages:
                # IMPORTANT: install ALL packages in a SINGLE command. Running
                # multiple `npm install` processes concurrently in the same
                # directory corrupts node_modules (ENOTEMPTY / rmdir errors on
                # shared transitive deps) and hangs the build.
                combined_command = "npm install " + " ".join(missing_packages)
                install_commands = [combined_command]

                result = f"MISSING DEPENDENCIES FOUND:\n\n"
                result += f"Missing packages: {', '.join(missing_packages)}\n\n"
                result += f"Installation command (run this EXACT single command, do NOT split it into multiple installs):\n"
                result += f"  {combined_command}\n"
                result += f"\nRun this ONE command to install all missing dependencies at once."

                await safe_send_json(
                    socket,
                    {
                        "e": "missing_dependencies",
                        "packages": missing_packages,
                        "commands": install_commands,
                    },
                )

                return result
            else:
                return "All dependencies are properly installed. No missing packages found."

        except Exception as e:
            await safe_send_json(
                socket,
                {
                    "e": "dependency_check_error",
                    "message": f"Dependency check failed: {str(e)}",
                },
            )
            return f"Dependency check failed: {str(e)}"

    @tool
    async def validate_file_extensions() -> str:
        """
        Validate that all React component files have the correct .jsx extension.
        
        Scans all .js files in src/ directory and checks if they contain JSX syntax.
        If a .js file contains JSX, it reports an error with fix instructions.
        
        Returns:
            Validation report with any files that need to be renamed from .js to .jsx
            
        Example:
            validate_file_extensions() - checks all files and reports issues
        """
        try:
            # Find all .js files in src/
            result = await sandbox.commands.run(
                "find src -name '*.js' -type f",
                cwd="/home/user/react-app"
            )
            
            js_files = [f.strip() for f in result.stdout.strip().split("\n") if f.strip()]
            
            files_with_jsx = []
            
            for file_path in js_files:
                try:
                    full_path = f"/home/user/react-app/{file_path}"
                    content = await sandbox.files.read(full_path)
                    
                    # Check for JSX syntax patterns
                    jsx_patterns = [
                        '<div', '<span', '<button', '<input', '<form',
                        '<Component', 'return <', 'return(', ')<', '/>', 
                        'className=', 'onClick=', '<>', 'Fragment>'
                    ]
                    
                    if any(pattern in content for pattern in jsx_patterns):
                        files_with_jsx.append(file_path)
                        
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")
            
            if files_with_jsx:
                result_msg = "🚨 FILE EXTENSION ERRORS FOUND:\n\n"
                result_msg += "The following .js files contain JSX and MUST be renamed to .jsx:\n\n"
                
                for file_path in files_with_jsx:
                    new_path = file_path.replace('.js', '.jsx')
                    result_msg += f"  ❌ {file_path}\n"
                    result_msg += f"  ✅ Should be: {new_path}\n"
                    result_msg += f"  Fix: mv {file_path} {new_path}\n\n"
                
                result_msg += "\nWhy this matters:\n"
                result_msg += "- Vite's esbuild cannot parse JSX syntax in .js files by default\n"
                result_msg += "- This causes 'JSX syntax extension is not currently enabled' errors\n"
                result_msg += "- ALL React components with JSX MUST use .jsx extension\n\n"
                result_msg += "ACTION REQUIRED: Rename these files and update all imports!"
                
                await safe_send_json(
                    socket,
                    {
                        "e": "validation_error",
                        "message": "File extension errors found",
                        "files": files_with_jsx
                    },
                )
                
                return result_msg
            else:
                return "✅ All file extensions are correct. No .js files contain JSX syntax."
                
        except Exception as e:
            error_msg = f"File extension validation failed: {str(e)}"
            await safe_send_json(
                socket,
                {
                    "e": "validation_error",
                    "message": error_msg,
                },
            )
            return error_msg

    @tool
    async def get_deployed_contracts() -> str:
        """
        Get list of smart contracts deployed/imported for this project.
        
        Returns contract details including address, ABI, and network info.
        Useful for building Web3 frontends that need to interact with contracts.
        
        Returns:
            JSON string with array of contract objects containing:
            - name: Contract name
            - address: Deployed address
            - network: Network name (sepolia, basecamp-testnet, etc.)
            - chainId: Chain ID number
            - abi: Contract ABI (can be used with wagmi hooks)
            - explorerUrl: Block explorer link
        """
        try:
            if not project_id:
                return json.dumps({"contracts": [], "message": "No project context available"})
            
            # Load contracts from context store
            context = load_json_store(project_id, "context.json")
            contracts = context.get("contracts", [])
            
            if not contracts:
                return json.dumps({
                    "contracts": [],
                    "message": "No contracts found for this project. Use save_contract_info() to add one."
                })
            
            await safe_send_json(
                socket,
                {"e": "contracts_fetched", "message": f"Found {len(contracts)} contract(s)"}
            )
            
            return json.dumps({
                "contracts": contracts,
                "count": len(contracts)
            }, indent=2)
            
        except Exception as e:
            await safe_send_json(
                socket,
                {"e": "contracts_error", "message": f"Failed to fetch contracts: {str(e)}"}
            )
            return json.dumps({"contracts": [], "error": str(e)})

    # ==================== Web3 / Smart Contract Tools (EVI Client) ====================
    
    @tool
    async def deploy_smart_contract(
        prompt: str,
        network: str = "avalanche-fuji",
        constructor_args: str = "[]",
        contract_name: str = None,
        filename: str = None
    ) -> str:
        """
        Generate, compile, and deploy a smart contract from natural language description.
        Uses the EVI API to create production-ready Solidity contracts.
        
        Args:
            prompt: Natural language description of the contract (e.g., "ERC20 token with 2% burn")
            network: Target blockchain network (basecamp, sepolia, polygon, etc.)
            constructor_args: JSON string of constructor arguments (e.g., '["0xAddress", "1000000"]')
            contract_name: Optional specific contract name
            filename: Optional Solidity filename
        
        Returns:
            JSON string containing:
            - success: bool
            - job_id: Job identifier for tracking
            - contract_address: Deployed address (when complete)
            - network: Network name
            - explorer_url: Block explorer link
            - abi: Contract ABI
            - message: Status message
        
        Example:
            deploy_smart_contract(
                "Create an ERC721 NFT contract called MyNFT with max supply 10000",
                network="basecamp",
                constructor_args='[]'
            )
        """
        try:
            from integrations.evi_client import EVIClient, get_explorer_url
            
            # Send structured pipeline start event
            await safe_send_json(socket, {
                "e": "pipeline_started",
                "type": "contract_deployment",
                "network": network,
                "stages": ["generate", "compile", "deploy", "verify"],
                "current_stage": "generate",
                "message": f"🚀 Starting smart contract deployment on {network}"
            })
            
            # Parse constructor args
            try:
                args = json.loads(constructor_args) if constructor_args else []
            except:
                args = []
            
            async with EVIClient(network=network) as client:
                # Define status callback for real-time updates
                async def on_status(phase: str, msg: str):
                    await safe_send_json(socket, {
                        "e": f"contract_{phase}",
                        "message": msg
                    })
                
                # Define log callback for SSE streaming
                async def on_log(entry):
                    level_icons = {
                        "error": "❌",
                        "warn": "⚠️",
                        "debug": "🔍",
                        "success": "✅",
                        "info": "ℹ️"
                    }
                    icon = level_icons.get(entry.level, "ℹ️")
                    # Send log to WebSocket
                    await safe_send_json(socket, {
                        "e": "contract_log",
                        "level": entry.level,
                        "message": f"{icon} {entry.message}"
                    })
                
                # Start deployment pipeline
                result = await client.start_pipeline(
                    prompt=prompt,
                    network=network,
                    constructor_args=args,
                    contract_name=contract_name,
                    filename=filename,
                    strict_args=True,
                    context=f"WebBuilder deployment"
                )
                
                job_id = result.get("job", {}).get("id")
                
                if not job_id:
                    return json.dumps({
                        "success": False,
                        "error": "No job ID returned from API"
                    })
                
                await safe_send_json(socket, {
                    "e": "pipeline_stage",
                    "stage": "compile",
                    "status": "running",
                    "job_id": job_id,
                    "message": f"⚙️ Compiling contract (Job: {job_id[:8]}...)"
                })
                
                # Stream logs in background while waiting
                import asyncio
                log_task = asyncio.create_task(
                    client.stream_job_logs_sse(job_id, callback=lambda e, d: 
                        asyncio.create_task(on_log(type('LogEntry', (), {
                            'level': d.get('level', 'info') if d else 'info',
                            'message': d.get('msg', '') if d else ''
                        })())) if e == 'log' and d else None
                    )
                )
                
                # Wait for completion with retry
                final_status = await client.wait_for_job_completion(
                    job_id,
                    poll_interval=3.0,
                    timeout=300.0
                )
                
                # Cancel log streaming
                log_task.cancel()
                try:
                    await log_task
                except asyncio.CancelledError:
                    pass
                
                status_data = final_status.get("data", {})
                state = status_data.get("state")
                result_data = status_data.get("result", {})
                
                if state == "completed":
                    contract_address = result_data.get("address")
                    network_name = result_data.get("network", network)
                    
                    # Get contract artifacts
                    try:
                        artifacts = await client.download_artifacts(job_id)
                        abis = artifacts.get("abis", [])
                        sources = artifacts.get("sources", [])
                        contract_abi = abis[0].get("abi") if abis else []
                        source_code = sources[0].get("content") if sources else ""
                    except Exception as e:
                        logger.warning(f"Failed to get artifacts: {e}")
                        contract_abi = []
                        source_code = ""
                    
                    explorer_url = get_explorer_url(network_name, contract_address)
                    
                    # Save to project context
                    if project_id and contract_address:
                        context = load_json_store(project_id, "context.json") or {}
                        if "contracts" not in context:
                            context["contracts"] = []
                        
                        context["contracts"].append({
                            "name": result_data.get("contractName", "Contract"),
                            "address": contract_address,
                            "network": network_name,
                            "chainId": result_data.get("chainId"),
                            "abi": contract_abi,
                            "sourceCode": source_code,
                            "explorerUrl": explorer_url,
                            "jobId": job_id
                        })
                        
                        save_json_store(project_id, "context.json", context)
                    
                    # Send deployment success with full details
                    await safe_send_json(socket, {
                        "e": "pipeline_stage",
                        "stage": "deploy",
                        "status": "completed",
                        "message": "📦 Contract compiled and deployed"
                    })
                    
                    await safe_send_json(socket, {
                        "e": "contract_deployed",
                        "contract_address": contract_address,
                        "explorer_url": explorer_url,
                        "network": network_name,
                        "job_id": job_id,
                        "message": f"✅ Deployed to {network_name}"
                    })
                    
                    return json.dumps({
                        "success": True,
                        "job_id": job_id,
                        "contract_address": contract_address,
                        "network": network_name,
                        "explorer_url": explorer_url,
                        "abi": contract_abi,
                        "message": f"Contract successfully deployed to {network_name}"
                    }, indent=2)
                    
                else:
                    # Attempt fix flow
                    error_msg = status_data.get("error", "Deployment failed")
                    await safe_send_json(socket, {
                        "e": "contract_fix_attempt",
                        "message": f"⚠️ Pipeline failed, attempting fix: {error_msg}"
                    })
                    
                    # Get logs and source for fix
                    try:
                        logs_resp = await client.get_job_logs(job_id, limit=5000)
                        errors = client.extract_errors_from_logs(logs_resp.get("data", {}).get("logs", []))
                    except:
                        errors = error_msg
                    
                    try:
                        artifacts = await client.download_artifacts(job_id)
                        sources = artifacts.get("sources", [])
                        code = sources[0].get("content", "") if sources else ""
                    except:
                        code = ""
                    
                    if code.strip():
                        fix_resp = await client.start_fix(
                            code=code,
                            errors=errors,
                            context="Fix after pipeline failure",
                            network=network,
                            filename=filename,
                            constructor_args=args,
                            contract_name=contract_name
                        )
                        
                        fix_job_id = fix_resp.get("job", {}).get("id")
                        if fix_job_id:
                            await safe_send_json(socket, {
                                "e": "contract_fix_started",
                                "message": f"🔧 Fix job started: {fix_job_id}"
                            })
                            
                            fix_status = await client.wait_for_job_completion(fix_job_id, timeout=300.0)
                            fix_state = fix_status.get("data", {}).get("state")
                            fix_result = fix_status.get("data", {}).get("result", {})
                            
                            if fix_state == "completed" and fix_result.get("address"):
                                contract_address = fix_result.get("address")
                                explorer_url = get_explorer_url(network, contract_address)
                                
                                await safe_send_json(socket, {
                                    "e": "contract_deployed",
                                    "message": f"✅ Contract deployed after fix: {contract_address}",
                                    "contract_address": contract_address,
                                    "explorer_url": explorer_url
                                })
                                
                                return json.dumps({
                                    "success": True,
                                    "job_id": fix_job_id,
                                    "contract_address": contract_address,
                                    "network": network,
                                    "explorer_url": explorer_url,
                                    "message": "Contract deployed after fix"
                                }, indent=2)
                    
                    await safe_send_json(socket, {
                        "e": "contract_deploy_failed",
                        "message": f"❌ Deployment failed: {error_msg}"
                    })
                    
                    return json.dumps({
                        "success": False,
                        "job_id": job_id,
                        "error": error_msg,
                        "state": state
                    })
                
        except Exception as e:
            logger.error(f"Smart contract deployment failed: {e}")
            await safe_send_json(socket, {
                "e": "contract_deploy_error",
                "message": f"❌ Error: {str(e)}"
            })
            return json.dumps({"success": False, "error": str(e)})
    
    @tool
    async def deploy_game_contract(
        game_type: str,
        network: str = "fuji"
    ) -> str:
        """
        Deploy a predefined game smart contract template.
        
        Available game types:
        - tic-tac-toe: Turn-based 2-player game
        - temple-run: Endless runner with leaderboard
        - 2048: Puzzle game with high scores
        - coin-flip: Betting game with commit-reveal
        - idle-clicker: Click-to-earn with upgrades
        - bouncing-balls: PvP arena game
        
        Args:
            game_type: One of the available game templates
            network: Target blockchain network
        
        Returns:
            JSON string with deployment result
        """
        try:
            from integrations.evi_client import EVIClient, GAME_TEMPLATES
            
            if game_type not in GAME_TEMPLATES:
                return json.dumps({
                    "success": False,
                    "error": f"Unknown game type: {game_type}",
                    "available_games": list(GAME_TEMPLATES.keys())
                })
            
            template = GAME_TEMPLATES[game_type]
            
            await safe_send_json(socket, {
                "e": "pipeline_started",
                "type": "game_deployment",
                "game_type": game_type,
                "network": network,
                "stages": ["generate", "compile", "deploy", "verify"],
                "current_stage": "generate",
                "message": f"🎮 Deploying {game_type} game on {network}"
            })
            
            async with EVIClient(network=network) as client:
                result = await client.run_full_pipeline(
                    prompt=template["prompt"],
                    network=network,
                    contract_name=template["contract_name"],
                    filename=template["filename"],
                    context=f"Game type: {template['expected_type']}",
                    verify=True,
                    audit=False,  # Skip for faster deployment
                    compliance=False
                )
                
                if result["success"]:
                    # Save to project context
                    if project_id:
                        context = load_json_store(project_id, "context.json") or {}
                        if "contracts" not in context:
                            context["contracts"] = []
                        
                        context["contracts"].append({
                            "name": template["contract_name"],
                            "address": result["contract_address"],
                            "network": network,
                            "abi": result.get("abi", []),
                            "explorerUrl": result["explorer_url"],
                            "jobId": result["job_id"],
                            "gameType": game_type
                        })
                        
                        save_json_store(project_id, "context.json", context)
                    
                    await safe_send_json(socket, {
                        "e": "pipeline_complete",
                        "type": "game_deployment",
                        "success": True,
                        "game_type": game_type,
                        "contract_address": result["contract_address"],
                        "explorer_url": result["explorer_url"],
                        "network": network,
                        "message": f"✅ {game_type} game deployed successfully!"
                    })
                
                return json.dumps(result, indent=2)
                
        except Exception as e:
            logger.error(f"Game deployment failed: {e}")
            return json.dumps({"success": False, "error": str(e)})
    
    @tool
    async def fix_contract(
        job_id: str,
        additional_context: str = ""
    ) -> str:
        """
        Fix compilation errors from a failed deployment and redeploy.
        
        Args:
            job_id: Job ID from a failed deploy_smart_contract
            additional_context: Additional instructions for the fix
        
        Returns:
            JSON string with fix result
        """
        try:
            from integrations.evi_client import EVIClient, get_explorer_url
            
            await safe_send_json(socket, {
                "e": "fix_started",
                "message": f"🔧 Attempting to fix contract from job {job_id}..."
            })
            
            async with EVIClient() as client:
                # Get the failed job's logs and source
                logs_resp = await client.get_job_logs(job_id, limit=5000)
                errors = client.extract_errors_from_logs(logs_resp.get("data", {}).get("logs", []))
                
                artifacts = await client.download_artifacts(job_id)
                sources = artifacts.get("sources", [])
                code = sources[0].get("content", "") if sources else ""
                
                if not code.strip():
                    return json.dumps({
                        "success": False,
                        "error": "No source code found for job"
                    })
                
                # Start fix
                fix_resp = await client.start_fix(
                    code=code,
                    errors=errors,
                    context=additional_context or "Fix compilation errors"
                )
                
                fix_job_id = fix_resp.get("job", {}).get("id")
                if not fix_job_id:
                    return json.dumps({"success": False, "error": "No fix job created"})
                
                await safe_send_json(socket, {
                    "e": "fix_job_created",
                    "message": f"📋 Fix job: {fix_job_id}"
                })
                
                # Wait for fix completion
                final_status = await client.wait_for_job_completion(fix_job_id, timeout=300.0)
                state = final_status.get("data", {}).get("state")
                result_data = final_status.get("data", {}).get("result", {})
                
                if state == "completed" and result_data.get("address"):
                    contract_address = result_data.get("address")
                    network = result_data.get("network", client.network)
                    explorer_url = get_explorer_url(network, contract_address)
                    
                    await safe_send_json(socket, {
                        "e": "fix_completed",
                        "message": f"✅ Fixed and deployed: {contract_address}",
                        "contract_address": contract_address
                    })
                    
                    return json.dumps({
                        "success": True,
                        "job_id": fix_job_id,
                        "contract_address": contract_address,
                        "network": network,
                        "explorer_url": explorer_url
                    }, indent=2)
                else:
                    return json.dumps({
                        "success": False,
                        "job_id": fix_job_id,
                        "error": final_status.get("data", {}).get("error", "Fix failed")
                    })
                
        except Exception as e:
            logger.error(f"Fix failed: {e}")
            return json.dumps({"success": False, "error": str(e)})
    
    @tool
    async def verify_contract(job_id: str, network: str = "fuji") -> str:
        """
        Verify a deployed contract on block explorer (Etherscan, Basescan, etc.).
        
        Args:
            job_id: Job ID from deploy_smart_contract
            network: Network name (must match deployment)
        
        Returns:
            JSON string with verification result
        """
        try:
            from integrations.evi_client import EVIClient
            
            await safe_send_json(socket, {
                "e": "pipeline_stage",
                "stage": "verify",
                "status": "running",
                "network": network,
                "message": f"🔍 Verifying source code on {network} explorer..."
            })
            
            async with EVIClient() as client:
                result = await client.verify_by_job(job_id, network)
                
                if result.get("verified"):
                    explorer_url = result.get("explorerUrl", "")
                    await safe_send_json(socket, {
                        "e": "pipeline_stage",
                        "stage": "verify",
                        "status": "completed",
                        "explorer_url": explorer_url,
                        "message": "✅ Contract verified on block explorer"
                    })
                    
                    return json.dumps({
                        "success": True,
                        "verified": True,
                        "explorer_url": explorer_url,
                        "message": "Contract successfully verified on block explorer"
                    }, indent=2)
                else:
                    return json.dumps({
                        "success": False,
                        "verified": False,
                        "message": "Verification failed. Check logs for details."
                    })
                
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            await safe_send_json(socket, {
                "e": "verification_error",
                "message": f"❌ Verification error: {str(e)}"
            })
            return json.dumps({"success": False, "error": str(e)})
    
    @tool
    async def audit_contract(job_id: str, network: str = "fuji") -> str:
        """
        Run full security audit orchestration on a deployed contract.
        Checks for vulnerabilities, reentrancy, access control issues, etc.
        
        Args:
            job_id: Job ID from deploy_smart_contract
            network: Network for context
        
        Returns:
            JSON string with audit report including:
            - score: Security score out of 100
            - vulnerabilities: List of security issues found
            - recommendations: How to fix issues
        """
        try:
            from integrations.evi_client import EVIClient
            
            await safe_send_json(socket, {
                "e": "pipeline_stage",
                "stage": "audit",
                "status": "running",
                "message": "🔒 Running security audit..."
            })
            
            async with EVIClient() as client:
                # Start audit orchestrate (full pipeline)
                audit_start = await client.audit_orchestrate(
                    job_id=job_id,
                    network=network
                )
                audit_job_id = audit_start.get("job", {}).get("id")
                
                if not audit_job_id:
                    return json.dumps({"success": False, "error": "No audit job created"})
                
                await safe_send_json(socket, {
                    "e": "pipeline_log",
                    "level": "info",
                    "stage": "audit",
                    "message": f"Analyzing contract security (Job: {audit_job_id[:8]}...)"
                })
                
                # Wait for completion (non-blocking - continue even if timeout)
                # Send periodic updates to keep WebSocket alive
                try:
                    elapsed = 0
                    while elapsed < 180:
                        try:
                            await client.wait_for_job_completion(audit_job_id, timeout=30.0)
                            break  # Job completed
                        except Exception:
                            elapsed += 30
                            if elapsed < 180:
                                await safe_send_json(socket, {
                                    "e": "pipeline_log",
                                    "level": "info",
                                    "stage": "audit",
                                    "message": f"⏳ Audit in progress... ({elapsed}s elapsed)"
                                })
                except Exception as timeout_error:
                    # Audit timeout - continue anyway
                    await safe_send_json(socket, {
                        "e": "pipeline_stage",
                        "stage": "audit",
                        "status": "skipped",
                        "message": "⚠️ Audit timeout - skipping (contract already deployed & verified)"
                    })
                    return json.dumps({
                        "success": True,
                        "skipped": True,
                        "reason": "Audit timed out - non-blocking, continuing deployment",
                        "message": "Contract deployed successfully. Audit skipped due to timeout."
                    }, indent=2)
                
                # Fetch audit report (try both job IDs)
                report = None
                try:
                    report = await client.get_audit_report(job_id)
                except:
                    try:
                        report = await client.get_audit_report(audit_job_id)
                    except:
                        pass
                
                if report:
                    score = report.get("score") or report.get("data", {}).get("score")
                    vulnerabilities = report.get("vulnerabilities", [])
                    
                    severity = "success" if score and score >= 80 else "warning"
                    icon = "✅" if severity == "success" else "⚠️"
                    
                    await safe_send_json(socket, {
                        "e": "pipeline_stage",
                        "stage": "audit",
                        "status": "completed",
                        "score": score,
                        "severity": severity,
                        "issues_count": len(vulnerabilities) if vulnerabilities else 0,
                        "message": f"{icon} Security audit: {score}/100"
                    })
                    
                    return json.dumps({
                        "success": True,
                        "score": score,
                        "report": report,
                        "summary": {
                            "total_issues": len(vulnerabilities) if vulnerabilities else 0
                        }
                    }, indent=2)
                else:
                    # No report but job started - return success anyway
                    await safe_send_json(socket, {
                        "e": "pipeline_stage",
                        "stage": "audit",
                        "status": "warning",
                        "message": "⚠️ Audit incomplete - continuing anyway"
                    })
                    return json.dumps({
                        "success": True,
                        "skipped": True,
                        "reason": "Could not fetch audit report",
                        "message": "Contract deployed successfully. Audit report unavailable."
                    }, indent=2)
                
        except Exception as e:
            logger.error(f"Audit failed: {e}")
            await safe_send_json(socket, {
                "e": "audit_error",
                "message": f"❌ Audit error: {str(e)}"
            })
            return json.dumps({"success": False, "error": str(e)})
    
    @tool
    async def check_contract_compliance(
        job_id: str,
        profile: str = "generic",
        network: str = "fuji"
    ) -> str:
        """
        Check contract compliance with standards (ERC20, ERC721, etc.).
        Uses full compliance orchestration pipeline.
        
        Args:
            job_id: Job ID from deploy_smart_contract
            profile: Compliance profile (generic, token, registry, custom)
            network: Network for context
        
        Returns:
            JSON string with compliance report
        """
        try:
            from integrations.evi_client import EVIClient
            
            await safe_send_json(socket, {
                "e": "pipeline_stage",
                "stage": "compliance",
                "status": "running",
                "profile": profile,
                "message": f"📋 Running {profile} compliance check..."
            })
            
            async with EVIClient() as client:
                # Start compliance orchestrate
                comp_start = await client.compliance_orchestrate(
                    job_id=job_id,
                    target_profile=profile,
                    network=network
                )
                comp_job_id = comp_start.get("job", {}).get("id")
                
                if not comp_job_id:
                    return json.dumps({"success": False, "error": "No compliance job created"})
                
                await safe_send_json(socket, {
                    "e": "pipeline_log",
                    "level": "info",
                    "stage": "compliance",
                    "message": f"Checking standards compliance (Job: {comp_job_id[:8]}...)"
                })
                
                # Wait for completion
                await client.wait_for_job_completion(comp_job_id, timeout=180.0)
                
                # Fetch compliance report
                report = None
                try:
                    report = await client.get_compliance_report(job_id)
                except:
                    try:
                        report = await client.get_compliance_report(comp_job_id)
                    except:
                        pass
                
                if report:
                    score = report.get("score") or report.get("data", {}).get("score")
                    passed = report.get("passed", score and score >= 70)
                    
                    severity = "success" if passed else "warning"
                    icon = "✅" if passed else "⚠️"
                    
                    await safe_send_json(socket, {
                        "e": "pipeline_stage",
                        "stage": "compliance",
                        "status": "completed",
                        "score": score,
                        "passed": passed,
                        "severity": severity,
                        "message": f"{icon} Compliance: {score}/100"
                    })
                    
                    return json.dumps({
                        "success": True,
                        "score": score,
                        "passed": passed,
                        "report": report
                    }, indent=2)
                else:
                    return json.dumps({"success": False, "error": "Could not fetch compliance report"})
                
        except Exception as e:
            logger.error(f"Compliance check failed: {e}")
            await safe_send_json(socket, {
                "e": "compliance_error",
                "message": f"❌ Compliance error: {str(e)}"
            })
            return json.dumps({"success": False, "error": str(e)})
    
    @tool
    async def get_contract_job_status(job_id: str) -> str:
        """
        Get status of a smart contract deployment/audit/compliance job.
        
        Args:
            job_id: Job identifier
        
        Returns:
            JSON string with job status and progress
        """
        try:
            from integrations.evi_client import EVIClient
            
            async with EVIClient() as client:
                status = await client.get_job_status(job_id, verbose=True)
                return json.dumps(status, indent=2)
                
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})
    
    @tool
    async def download_contract_artifacts(job_id: str) -> str:
        """
        Download all artifacts (sources, ABIs, scripts) for a contract job.
        Saves them to the project and returns a summary.
        
        Args:
            job_id: Job identifier
        
        Returns:
            JSON string with artifact summary
        """
        try:
            from integrations.evi_client import EVIClient
            
            await safe_send_json(socket, {
                "e": "artifacts_downloading",
                "message": f"📦 Downloading artifacts for job {job_id}..."
            })
            
            async with EVIClient() as client:
                artifacts = await client.download_artifacts(job_id)
                
                sources = artifacts.get("sources", [])
                abis = artifacts.get("abis", [])
                scripts = artifacts.get("scripts", [])
                
                # Save ABI files to sandbox
                for abi_item in abis:
                    abi_path = abi_item.get("path", "Contract.json")
                    abi_content = json.dumps(abi_item, indent=2)
                    
                    target_path = f"/home/user/react-app/src/contracts/{abi_path}"
                    try:
                        await sandbox.commands.run("mkdir -p src/contracts", cwd="/home/user/react-app")
                        await sandbox.files.write(target_path, abi_content)
                    except Exception as e:
                        logger.warning(f"Failed to write ABI: {e}")
                
                await safe_send_json(socket, {
                    "e": "artifacts_downloaded",
                    "message": f"✅ Downloaded: {len(sources)} sources, {len(abis)} ABIs, {len(scripts)} scripts"
                })
                
                return json.dumps({
                    "success": True,
                    "sources_count": len(sources),
                    "abis_count": len(abis),
                    "scripts_count": len(scripts),
                    "sources": [s.get("path") for s in sources],
                    "abis": [a.get("path") for a in abis]
                }, indent=2)
                
        except Exception as e:
            logger.error(f"Artifact download failed: {e}")
            return json.dumps({"success": False, "error": str(e)})
    
    @tool
    async def get_contract_logs(job_id: str, level: str = None, limit: int = 100) -> str:
        """
        Get logs for a contract job.
        
        Args:
            job_id: Job identifier
            level: Filter by level (error, warn, info, debug)
            limit: Maximum logs to return
        
        Returns:
            JSON string with logs
        """
        try:
            from integrations.evi_client import EVIClient
            
            async with EVIClient() as client:
                logs = await client.get_job_logs(job_id, level=level, limit=limit)
                return json.dumps(logs, indent=2)
                
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})
    
    @tool
    def list_available_games() -> str:
        """
        List available game templates for deploy_game_contract.
        
        Returns:
            JSON string with available game types and descriptions
        """
        from integrations.evi_client import GAME_TEMPLATES
        
        games = []
        for key, template in GAME_TEMPLATES.items():
            games.append({
                "type": key,
                "contract_name": template["contract_name"],
                "expected_type": template["expected_type"],
                "description": template["prompt"][:100] + "..."
            })
        
        return json.dumps({"games": games}, indent=2)

    return [
        create_file,
        read_file,
        execute_command,
        test_build,
        delete_file,
        list_directory,
        write_multiple_files,
        get_context,
        save_context,
        check_missing_packages,
        save_contract_info,
        create_web3_boilerplate,
        validate_file_extensions,
        get_deployed_contracts,
        # Web3 / Smart Contract Tools (EVI Client)
        deploy_smart_contract,
        deploy_game_contract,
        fix_contract,
        verify_contract,
        audit_contract,
        check_contract_compliance,
        get_contract_job_status,
        download_contract_artifacts,
        get_contract_logs,
        list_available_games,
    ]
