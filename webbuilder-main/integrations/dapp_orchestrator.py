"""
DApp Orchestration Service
Coordinates smart contract deployment (EVI Client) with frontend generation (WebBuilder)
"""
import asyncio
import uuid
import json
from typing import Dict, Any, Optional
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .evi_client import EVIClient, get_explorer_url, get_network_info, GAME_TEMPLATES
from agent.service import Service as WebBuilderService
from db.models import Chat, Contract, Message


class DAppOrchestrator:
    """
    Orchestrates full DApp creation:
    1. Generate & deploy smart contract (EVI Client)
    2. Generate React frontend with Web3 integration (WebBuilder)
    """
    
    def __init__(self):
        self.evi_client = EVIClient()
        self.webbuilder = WebBuilderService()
    
    async def close(self):
        """Clean up resources"""
        await self.evi_client.close()
    
    async def create_full_dapp(
        self,
        db: AsyncSession,
        chat_id: str,
        prompt: str,
        network: str = "botchain",
        socket: Optional[WebSocket] = None,
        user_id: Optional[int] = None,
        contract_only: bool = False
    ) -> Dict[str, Any]:
        """
        End-to-end DApp creation from a single prompt
        
        Args:
            db: Database session
            chat_id: Chat/Project ID
            prompt: Natural language description of the DApp
            network: Target blockchain network
            socket: WebSocket for real-time updates
            user_id: User ID for authentication
            contract_only: If True, only deploy contract (skip frontend)
            
        Returns:
            {
                "success": bool,
                "contract_address": str,
                "contract_abi": list,
                "network": str,
                "explorer_url": str,
                "frontend_url": str (if contract_only=False),
                "job_id": str,
                "error": str (if failed)
            }
        """
        try:
            # Send initial status
            if socket:
                await self._send_status(socket, "starting", "Starting DApp creation pipeline...")
            
            # ========== PHASE 1: Smart Contract Deployment ==========
            if socket:
                await self._send_status(socket, "contract_generating", "Generating smart contract with AI...")
            
            # Start contract pipeline
            pipeline_result = await self.evi_client.start_pipeline(
                prompt=prompt,
                network=network,
                max_iters=5
            )
            
            job_id = pipeline_result.get("job", {}).get("id")
            if not job_id:
                error_msg = "No job ID returned from pipeline"
                if socket:
                    await self._send_status(socket, "contract_failed", error_msg)
                return {"success": False, "error": error_msg}
            
            if socket:
                await self._send_status(
                    socket, 
                    "contract_deploying", 
                    f"Contract pipeline started (Job: {job_id}). Compiling and deploying..."
                )
            
            # Stream live progress during the (potentially long) deploy wait so the
            # frontend does not appear frozen. Throttled + deduped to avoid spam.
            import time as _time
            _progress_state = {"last_sent": 0.0, "last_msg": ""}

            async def _on_deploy_status(status: Dict[str, Any]):
                if not socket:
                    return
                data = status.get("data", {}) if isinstance(status, dict) else {}
                state = str(data.get("state") or "")
                step = str(data.get("step") or data.get("phase") or "")
                # Prefer the most recent log line if available
                last_log = ""
                logs = data.get("logs") or []
                if isinstance(logs, list) and logs:
                    last = logs[-1]
                    if isinstance(last, dict):
                        last_log = str(last.get("msg") or last.get("message") or "")
                msg = last_log or step or state or "Compiling and deploying..."
                now = _time.time()
                # Throttle to at most once every 3s, and skip duplicate messages
                if msg == _progress_state["last_msg"] and (now - _progress_state["last_sent"]) < 8:
                    return
                if (now - _progress_state["last_sent"]) < 3:
                    return
                _progress_state["last_sent"] = now
                _progress_state["last_msg"] = msg
                try:
                    await self._send_status(socket, "contract_progress", f"⛓️ {msg}")
                except Exception:
                    pass

            # Wait for deployment to complete with retry
            final_status = await self.evi_client.wait_for_job_completion(
                job_id=job_id,
                poll_interval=3.0,
                timeout=300.0,
                on_status=_on_deploy_status
            )
            
            # Check state from data.state (not top-level status)
            state = final_status.get("data", {}).get("state")
            if state != "completed":
                error_msg = final_status.get("data", {}).get("error", "Contract deployment failed")
                error_details = final_status.get("data", {}).get("details", {})
                if socket:
                    await self._send_status(socket, "contract_failed", error_msg)
                return {"success": False, "error": error_msg, "details": error_details, "job_id": job_id}
            
            # Get deployment artifacts using query params (not headers)
            artifacts = await self.evi_client.download_artifacts(job_id)
            
            # Extract contract info from data.result
            deployment_data = final_status.get("data", {}).get("result", {})
            
            contract_address = deployment_data.get("address")
            if not contract_address:
                error_msg = "Contract address not found in deployment result"
                if socket:
                    await self._send_status(socket, "contract_failed", error_msg)
                return {"success": False, "error": error_msg, "job_id": job_id}
            
            # Get ABI from artifacts (handle multiple response shapes)
            abis = artifacts.get("abis") or artifacts.get("data", {}).get("abis") or []
            contract_abi = abis[0].get("abi") if abis else []

            # Fallback 1: dedicated ABI endpoint if artifacts didn't include one
            if not contract_abi:
                try:
                    print(f"⚠️ No ABI in artifacts for {job_id}; trying /artifacts/abis fallback")
                    abi_resp = await self.evi_client.get_contract_abi(job_id)
                    abis_fb = abi_resp.get("abis") or abi_resp.get("data", {}).get("abis") or []
                    if abis_fb:
                        abis = abis_fb
                        contract_abi = abis_fb[0].get("abi") or []
                except Exception as abi_err:
                    print(f"⚠️ ABI fallback (/artifacts/abis) failed: {abi_err}")

            # Fallback 2: ABI embedded in the deployment result
            if not contract_abi:
                dd_abi = deployment_data.get("abi") or deployment_data.get("contractAbi")
                if isinstance(dd_abi, list) and dd_abi:
                    contract_abi = dd_abi

            if not contract_abi:
                print(f"❌ Could not resolve a non-empty ABI for job {job_id}. The DApp will render without contract functions.")
                if socket:
                    await self._send_status(socket, "contract_abi_missing", "⚠️ Deployed, but ABI could not be resolved — retrying artifact fetch.")

            # Get source code from artifacts
            sources = artifacts.get("sources") or artifacts.get("data", {}).get("sources") or []
            source_code = sources[0].get("content", "") if sources else ""
            
            # Determine contract name from artifacts (ABI name or source filename)
            contract_name = "DAppContract"
            if abis and abis[0].get("name"):
                contract_name = abis[0].get("name")
            elif sources and sources[0].get("name"):
                # Extract contract name from filename (e.g., "AIngo.sol" -> "AIngo")
                filename = sources[0].get("name", "")
                contract_name = filename.replace(".sol", "").split("/")[-1] or "DAppContract"
            
            # Get network info (already imported at top)
            network_info = get_network_info(network)
            chain_id = network_info.get("chain_id", 0)
            
            explorer_url = get_explorer_url(network, contract_address)
            
            if socket:
                await self._send_status(
                    socket,
                    "contract_deployed",
                    f"✅ Contract deployed at {contract_address}",
                    extra={
                        "contract_address": contract_address,
                        "contract_name": contract_name,
                        "network": network,
                        "explorer_url": explorer_url,
                    }
                )
            
            # Save contract to database
            contract = Contract(
                id=str(uuid.uuid4()),
                chat_id=chat_id,
                contract_name=contract_name,
                contract_address=contract_address,
                network=network,
                chain_id=chain_id,
                abi=contract_abi,
                source_code=source_code,
                job_id=job_id,
                deploy_tx_hash=deployment_data.get("transactionHash"),
                verified=False,
                explorer_url=explorer_url,
                deployment_status="deployed"
            )
            
            db.add(contract)
            await db.commit()
            
            # Store contract info in message history
            contract_message = Message(
                id=str(uuid.uuid4()),
                chat_id=chat_id,
                role="assistant",
                content=f"Smart contract deployed successfully!\n\nAddress: {contract_address}\nNetwork: {network}\nExplorer: {explorer_url}",
                event_type="contract_deployed"
            )
            db.add(contract_message)
            await db.commit()

            # ========== Verify contract on explorer ==========
            try:
                if socket:
                    await self._send_status(socket, "contract_verifying", f"Verifying contract on {network} explorer...")

                verify_result = await self.evi_client.verify_by_job(
                    job_id=job_id,
                    network=network
                )

                verified = verify_result.get("ok", False) and verify_result.get("verified", False)
                contract.verified = verified
                await db.commit()

                if socket:
                    if verified:
                        await self._send_status(socket, "contract_verified", f"✅ Contract verified on explorer: {explorer_url}#code",
                            extra={"contract_address": contract_address, "explorer_url": explorer_url, "verified": True})
                    else:
                        await self._send_status(socket, "contract_verify_failed", f"⚠️ Contract verification pending/failed. Check explorer: {explorer_url}",
                            extra={"contract_address": contract_address, "explorer_url": explorer_url})

                print(f"📋 Contract verification: verified={verified}, result={verify_result}")
            except Exception as verify_err:
                print(f"⚠️ Contract verification error: {verify_err}")
                if socket:
                    await self._send_status(socket, "contract_verify_failed", f"⚠️ Verification error: {verify_err}")
            
            # If contract-only mode, return here
            if contract_only:
                return {
                    "success": True,
                    "contract_address": contract_address,
                    "contract_abi": contract_abi,
                    "network": network,
                    "chain_id": chain_id,
                    "explorer_url": explorer_url,
                    "job_id": job_id
                }
            
            # ========== PHASE 2: Frontend Generation ==========
            if socket:
                await self._send_status(
                    socket,
                    "frontend_generating",
                    "Generating React frontend with Web3 integration..."
                )
            
            # Create enhanced prompt for frontend with contract details
            frontend_prompt = self._create_frontend_prompt(
                original_prompt=prompt,
                contract_address=contract_address,
                contract_name=contract_name,
                abi=contract_abi,
                network=network,
                chain_id=chain_id
            )
            
            # Run WebBuilder agent
            # Note: This uses the existing run_agent_stream which expects WebSocket
            # The agent will automatically use the new tools (save_contract_info, create_web3_boilerplate)
            
            # We need to pass contract info to the agent through the enhanced prompt
            # The agent's prompt already instructs it to handle Web3 setup when it sees contract info
            
            if socket:
                await self._send_status(socket, "frontend_building", "Building UI components...")
            
            # Get sandbox and run agent
            sandbox = await self.webbuilder.get_e2b_sandbox(chat_id)

            # Deterministic contract wiring: pre-write contract config into sandbox
            # so the frontend always has the real address+ABI regardless of LLM behavior
            try:
                import json as _json
                await sandbox.commands.run("mkdir -p src/contracts src/config", cwd="/home/user/react-app")

                contract_bundle = {
                    "name": contract_name,
                    "address": contract_address,
                    "chainId": chain_id,
                    "network": network,
                    "abi": contract_abi,
                }
                await sandbox.files.write(
                    f"/home/user/react-app/src/contracts/{contract_name}.json",
                    _json.dumps(contract_bundle, indent=2),
                )

                contract_js = f"""// Auto-generated contract config — do not delete
import {{ parseAbi }} from 'viem'

export const CONTRACT_NAME = '{contract_name}'
export const CONTRACT_ADDRESS = '{contract_address}'
export const CHAIN_ID = {chain_id}
export const NETWORK = '{network}'
export const CONTRACT_ABI = {_json.dumps(contract_abi)}

// wagmi config helpers
export const contractConfig = {{
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  chainId: CHAIN_ID,
}}
"""
                await sandbox.files.write(
                    "/home/user/react-app/src/config/contract.js",
                    contract_js,
                )
                print(f"✅ Pre-wrote contract config: {contract_name} at {contract_address} on {network}")

                # Deterministic app metadata (name/tagline/description) so the frontend
                # can render a proper hero + "what it does" + how-to, derived from the
                # contract name and the user's original prompt (no LLM required).
                _clean_prompt = " ".join((prompt or "").strip().split())
                _app_name = contract_name or "BotChain DApp"
                # Tagline = first sentence of the prompt (trimmed), else a generic line
                _first_sentence = _clean_prompt.split(". ")[0] if _clean_prompt else ""
                _app_tagline = (_first_sentence[:120].rstrip(" .") or "A decentralized app on BOT Chain")
                _app_description = (_clean_prompt[:320].rstrip() + ("…" if len(_clean_prompt) > 320 else "")) if _clean_prompt else \
                    "Interact with this smart contract directly on-chain. Every write is permanent and verifiable."
                app_meta_js = f"""// Auto-generated app metadata — do not delete
export const APP_NAME = {_json.dumps(_app_name)}
export const APP_TAGLINE = {_json.dumps(_app_tagline)}
export const APP_DESCRIPTION = {_json.dumps(_app_description)}
export const EXPLORER_URL = {_json.dumps(explorer_url)}
export const VERIFIED = {(_json.dumps(bool(getattr(contract, 'verified', False))))}
"""
                await sandbox.files.write(
                    "/home/user/react-app/src/config/appMeta.js",
                    app_meta_js,
                )
                print(f"✅ Pre-wrote appMeta: {_app_name}")

                # Write .env.production so Vite inlines VITE_* vars during E2B build
                net_info = get_network_info(network)
                env_prod = (
                    f"VITE_CONTRACT_ADDRESS={contract_address}\n"
                    f"VITE_CHAIN_ID={chain_id}\n"
                    f"VITE_NETWORK={network}\n"
                    f"VITE_RPC_URL={net_info.get('rpc', 'https://rpc.botchain.ai')}\n"
                    f"VITE_EXPLORER_URL={net_info.get('explorer', 'https://scan.botchain.ai')}\n"
                )
                await sandbox.files.write("/home/user/react-app/.env.production", env_prod)
                await sandbox.files.write("/home/user/react-app/.env", env_prod)
                print("✅ Wrote .env.production with VITE_* vars for E2B build")

                # Persist protected files so application_checker can restore them
                # before the build if the LLM blanks/overwrites them.
                try:
                    from utils.store import load_json_store, save_json_store
                    ctx = load_json_store(chat_id, "context.json") or {}
                    ctx["protected_files"] = {
                        f"src/contracts/{contract_name}.json": _json.dumps(contract_bundle, indent=2),
                        "src/config/contract.js": contract_js,
                        "src/config/appMeta.js": app_meta_js,
                        ".env.production": env_prod,
                        ".env": env_prod,
                    }
                    save_json_store(chat_id, "context.json", ctx)
                    print(f"🛡️ Stored {len(ctx['protected_files'])} protected files in context.json")
                except Exception as store_err:
                    print(f"⚠️ Failed to persist protected files: {store_err}")
            except Exception as prewrite_err:
                print(f"⚠️ Failed to pre-write contract config: {prewrite_err}")

            # Run the agent workflow (this will generate the frontend)
            # The socket messages from the agent will stream to the user automatically
            await self.webbuilder.run_agent_stream(
                id=chat_id,
                prompt=frontend_prompt,
                socket=socket,
                db=db
            )
            
            # Get the app URL (should be set by the agent service)
            result = await db.execute(select(Chat).where(Chat.id == chat_id))
            chat = result.scalar_one_or_none()
            frontend_url = chat.app_url if chat else f"https://{chat_id}.e2b.dev"
            vercel_url = getattr(chat, "vercel_url", None) if chat else None

            if socket:
                await self._send_status(
                    socket,
                    "completed",
                    f"🎉 DApp created successfully!\n\nFrontend: {frontend_url}\nContract: {contract_address}",
                    extra={
                        "contract_address": contract_address,
                        "contract_name": contract_name,
                        "network": network,
                        "explorer_url": explorer_url,
                        "frontend_url": frontend_url,
                        "vercel_url": vercel_url,
                        "contract_verified": True,
                    }
                )
            
            return {
                "success": True,
                "contract_address": contract_address,
                "contract_abi": contract_abi,
                "network": network,
                "chain_id": chain_id,
                "explorer_url": explorer_url,
                "frontend_url": frontend_url,
                "job_id": job_id
            }
            
        except Exception as e:
            error_msg = f"DApp creation failed: {str(e)}"
            if socket:
                await self._send_status(socket, "failed", error_msg)
            
            return {
                "success": False,
                "error": error_msg
            }
    
    async def create_frontend_for_existing_contract(
        self,
        db: AsyncSession,
        chat_id: str,
        contract_address: str,
        abi: list,
        network: str,
        prompt: str,
        socket: Optional[WebSocket] = None
    ) -> Dict[str, Any]:
        """
        Generate frontend for an already deployed contract
        
        Args:
            db: Database session
            chat_id: Project ID
            contract_address: Deployed contract address
            abi: Contract ABI
            network: Network name
            prompt: Description of desired UI
            socket: WebSocket for updates
            
        Returns:
            {"success": bool, "frontend_url": str, "error": str}
        """
        try:
            if socket:
                await self._send_status(socket, "starting", "Creating frontend for existing contract...")
            
            # Get network info
            network_info = get_network_info(network)
            chain_id = network_info.get("chain_id", 0)
            
            # Create frontend prompt with contract details
            frontend_prompt = self._create_frontend_prompt(
                original_prompt=prompt,
                contract_address=contract_address,
                contract_name="Contract",
                abi=abi,
                network=network,
                chain_id=chain_id
            )
            
            # Save contract to database
            contract = Contract(
                id=str(uuid.uuid4()),
                chat_id=chat_id,
                contract_name="ImportedContract",
                contract_address=contract_address,
                network=network,
                chain_id=chain_id,
                abi=abi,
                source_code=None,
                job_id=None,
                verified=False,
                explorer_url=get_explorer_url(network, contract_address),
                deployment_status="imported"
            )
            
            db.add(contract)
            await db.commit()
            
            # Run WebBuilder
            sandbox = await self.webbuilder.get_e2b_sandbox(chat_id)

            # Deterministic contract wiring: pre-write contract config into sandbox
            try:
                import json as _json
                await sandbox.commands.run("mkdir -p src/contracts src/config", cwd="/home/user/react-app")

                contract_bundle = {
                    "name": "Contract",
                    "address": contract_address,
                    "chainId": chain_id,
                    "network": network,
                    "abi": abi,
                }
                await sandbox.files.write(
                    "/home/user/react-app/src/contracts/Contract.json",
                    _json.dumps(contract_bundle, indent=2),
                )

                contract_js = f"""// Auto-generated contract config — do not delete
export const CONTRACT_NAME = 'Contract'
export const CONTRACT_ADDRESS = '{contract_address}'
export const CHAIN_ID = {chain_id}
export const NETWORK = '{network}'
export const CONTRACT_ABI = {_json.dumps(abi)}

export const contractConfig = {{
  address: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  chainId: CHAIN_ID,
}}
"""
                await sandbox.files.write(
                    "/home/user/react-app/src/config/contract.js",
                    contract_js,
                )
                print(f"✅ Pre-wrote contract config: Contract at {contract_address} on {network}")

                # Deterministic app metadata for the hero / what-it-does / how-to sections
                _clean_prompt = " ".join((prompt or "").strip().split())
                _app_name = "Contract"
                _first_sentence = _clean_prompt.split(". ")[0] if _clean_prompt else ""
                _app_tagline = (_first_sentence[:120].rstrip(" .") or "A decentralized app on BOT Chain")
                _app_description = (_clean_prompt[:320].rstrip() + ("…" if len(_clean_prompt) > 320 else "")) if _clean_prompt else \
                    "Interact with this smart contract directly on-chain. Every write is permanent and verifiable."
                app_meta_js = f"""// Auto-generated app metadata — do not delete
export const APP_NAME = {_json.dumps(_app_name)}
export const APP_TAGLINE = {_json.dumps(_app_tagline)}
export const APP_DESCRIPTION = {_json.dumps(_app_description)}
export const EXPLORER_URL = {_json.dumps(network_info.get('explorer', 'https://scan.botchain.ai'))}
export const VERIFIED = false
"""
                await sandbox.files.write(
                    "/home/user/react-app/src/config/appMeta.js",
                    app_meta_js,
                )
                print(f"✅ Pre-wrote appMeta: {_app_name}")

                # Write .env.production so Vite inlines VITE_* vars during E2B build
                net_info = get_network_info(network)
                env_prod = (
                    f"VITE_CONTRACT_ADDRESS={contract_address}\n"
                    f"VITE_CHAIN_ID={chain_id}\n"
                    f"VITE_NETWORK={network}\n"
                    f"VITE_RPC_URL={net_info.get('rpc', 'https://rpc.botchain.ai')}\n"
                    f"VITE_EXPLORER_URL={net_info.get('explorer', 'https://scan.botchain.ai')}\n"
                )
                await sandbox.files.write("/home/user/react-app/.env.production", env_prod)
                await sandbox.files.write("/home/user/react-app/.env", env_prod)
                print("✅ Wrote .env.production with VITE_* vars for E2B build")

                # Persist protected files so application_checker can restore them
                try:
                    from utils.store import load_json_store, save_json_store
                    ctx = load_json_store(chat_id, "context.json") or {}
                    ctx["protected_files"] = {
                        "src/contracts/Contract.json": _json.dumps(contract_bundle, indent=2),
                        "src/config/contract.js": contract_js,
                        "src/config/appMeta.js": app_meta_js,
                        ".env.production": env_prod,
                        ".env": env_prod,
                    }
                    save_json_store(chat_id, "context.json", ctx)
                    print(f"🛡️ Stored {len(ctx['protected_files'])} protected files in context.json")
                except Exception as store_err:
                    print(f"⚠️ Failed to persist protected files: {store_err}")
            except Exception as prewrite_err:
                print(f"⚠️ Failed to pre-write contract config: {prewrite_err}")

            await self.webbuilder.run_agent_stream(
                id=chat_id,
                prompt=frontend_prompt,
                socket=socket,
                db=db
            )
            
            # Get frontend URL
            result = await db.execute(select(Chat).where(Chat.id == chat_id))
            chat = result.scalar_one_or_none()
            frontend_url = chat.app_url if chat else f"https://{chat_id}.e2b.dev"
            
            return {
                "success": True,
                "frontend_url": frontend_url,
                "contract_address": contract_address
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def _create_frontend_prompt(
        self,
        original_prompt: str,
        contract_address: str,
        contract_name: str,
        abi: list,
        network: str,
        chain_id: int
    ) -> str:
        """
        Create enhanced prompt for frontend generation with contract details
        """
        return f"""
Build a Web3 React frontend for the following smart contract:

<<<CONTRACT_DETAILS_DO_NOT_ALTER>>>
- Name: {contract_name}
- Address: {contract_address}
- Network: {network} (Chain ID: {chain_id})
- ABI: {json.dumps(abi, indent=2)}
<<<END_CONTRACT_DETAILS>>>

ORIGINAL REQUEST:
{original_prompt}

REQUIREMENTS:
1. Use the create_web3_boilerplate() tool to set up wagmi and RainbowKit
2. Use the save_contract_info() tool to save the contract details with the EXACT address, chain_id, network, and abi_json shown above
3. Wire all read functions using wagmi useReadContract with the contract address above
4. Wire all write functions using wagmi useWriteContract with the contract address above
5. Build a modern, responsive UI with:
   - Wallet connection button (prominent in header)
   - Read functions displayed in cards/sections
   - Write functions with input forms and transaction feedback
   - Loading states and error handling
   - Transaction history/status
6. Use Tailwind CSS for styling
7. Add proper error messages for wallet connection, wrong network, etc.
8. For payable functions, clearly show the ETH amount required

Make the UI intuitive and user-friendly for Web3 interactions.
"""
    
    async def _send_status(self, socket: WebSocket, event: str, message: str, extra: dict = None):
        """Send status update via WebSocket"""
        try:
            payload = {"e": event, "message": message}
            if extra:
                payload.update(extra)
            await socket.send_json(payload)
        except Exception as e:
            print(f"Failed to send WebSocket message: {e}")
    
    async def deploy_game(
        self,
        db: AsyncSession,
        chat_id: str,
        game_type: str,
        network: str = "basecamp",
        socket: Optional[WebSocket] = None,
        with_frontend: bool = True
    ) -> Dict[str, Any]:
        """
        Deploy a predefined game contract with optional frontend.
        
        Available game types:
        - tic-tac-toe, temple-run, 2048, coin-flip, idle-clicker, bouncing-balls
        
        Args:
            db: Database session
            chat_id: Chat/Project ID
            game_type: Game template to deploy
            network: Target blockchain network
            socket: WebSocket for updates
            with_frontend: Generate React frontend if True
            
        Returns:
            {"success": bool, "contract_address": str, "frontend_url": str, ...}
        """
        if game_type not in GAME_TEMPLATES:
            return {
                "success": False,
                "error": f"Unknown game type: {game_type}",
                "available_games": list(GAME_TEMPLATES.keys())
            }
        
        template = GAME_TEMPLATES[game_type]
        
        if socket:
            await self._send_status(socket, "game_starting", f"🎮 Deploying {game_type} game...")
        
        # Use the full DApp flow with the game template prompt
        return await self.create_full_dapp(
            db=db,
            chat_id=chat_id,
            prompt=template["prompt"],
            network=network,
            socket=socket,
            contract_only=not with_frontend
        )
    
    def get_available_games(self) -> Dict[str, Any]:
        """Get list of available game templates"""
        games = []
        for key, template in GAME_TEMPLATES.items():
            games.append({
                "type": key,
                "contract_name": template["contract_name"],
                "expected_type": template["expected_type"],
                "description": template["prompt"][:150] + "..."
            })
        return {"games": games}


# Singleton instance
dapp_orchestrator = DAppOrchestrator()
