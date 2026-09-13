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

from integrations.evi_client import EVIClient, get_network_info, get_explorer_url
from agent.service import Service as WebBuilderService
from db.models import Contract, Message, Chat
from db.base import get_db
from agent.ui_schema import build_ui_schema  # Deterministic ABI→UI schema


# =============================================================================
# Deploy Error Classification (Wizard §4.4)
# =============================================================================
def classify_deploy_error(error_msg: str) -> tuple[str, str]:
    """
    Classify deployment errors into actionable categories.
    Ported from wizard's classifyDeployError.
    
    Returns:
        (error_kind, user_friendly_message)
    """
    error_lower = error_msg.lower()
    
    # Constructor args mismatch
    if "constructor" in error_lower and ("args" in error_lower or "arguments" in error_lower or "expected" in error_lower):
        return ("CONSTRUCTOR_ARGS", "Contract requires constructor arguments. Please provide them or use a no-arg constructor.")
    
    # Nonce issues
    if "nonce too low" in error_lower or "replacement transaction underpriced" in error_lower:
        return ("NONCE_MISMATCH", "Transaction nonce conflict. Please retry the deployment.")
    
    # Insufficient funds
    if "insufficient funds" in error_lower or "insufficient balance" in error_lower:
        return ("INSUFFICIENT_FUNDS", "Insufficient funds in deployer wallet. Please add funds and retry.")
    
    # Gas issues
    if "out of gas" in error_lower or "gas required exceeds" in error_lower:
        return ("OUT_OF_GAS", "Transaction ran out of gas. Try increasing gas limit.")
    
    # RPC issues
    if "econnrefused" in error_lower or "etimedout" in error_lower or "network error" in error_lower:
        return ("RPC_UNREACHABLE", "Cannot reach RPC endpoint. Check network connection and RPC URL.")
    
    if "429" in error_msg or "rate limit" in error_lower:
        return ("RPC_RATE_LIMITED", "RPC rate limit exceeded. Please wait and retry.")
    
    # Compilation errors (shouldn't reach deploy, but handle anyway)
    if "compilation" in error_lower or "solidity" in error_lower:
        return ("COMPILATION_FAILED", "Contract compilation failed. Check Solidity code for errors.")
    
    # Generic
    return ("UNKNOWN", f"Deployment failed: {error_msg[:200]}")


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
        contract_only: bool = False,
        theme_id: str = "neo-brutalist"
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
            
            # ========== WIZARD §4.3: Constructor Args Resolver ==========
            # Strategy: Instruct EVI to prefer no-arg constructors via prompt enhancement
            # If constructor args are needed, they can be passed via constructor_args param
            enhanced_prompt = self._enhance_contract_prompt_for_no_args(prompt)
            
            # Start contract pipeline
            pipeline_result = await self.evi_client.start_pipeline(
                prompt=enhanced_prompt,
                network=network,
                max_iters=5,
                constructor_args=[],  # Empty args - prefer no-arg constructors
                strict_args=False  # Allow deployment even if constructor exists (will use defaults)
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
                
                # Wizard §4.4: Classify error for better user feedback
                error_kind, friendly_msg = classify_deploy_error(error_msg)
                print(f"❌ Deploy failed: {error_kind} — {friendly_msg}")
                
                if socket:
                    await self._send_status(socket, "contract_failed", f"❌ {friendly_msg}")
                return {
                    "success": False, 
                    "error": error_msg, 
                    "error_kind": error_kind,
                    "friendly_error": friendly_msg,
                    "details": error_details, 
                    "job_id": job_id
                }
            
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
            frontend_prompt, has_custom_theme = self._create_frontend_prompt(
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
                await sandbox.commands.run("mkdir -p src/contracts src/config src/hooks", cwd="/home/user/react-app")

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

                # ========== WIZARD INTEGRATION: Deterministic UI Schema ==========
                # Generate typed UI schema from ABI (§4.1 from WIZARD_INTEGRATION_PLAN)
                ui_schema = build_ui_schema(contract_abi)
                await sandbox.files.write(
                    "/home/user/react-app/src/config/uiSchema.json",
                    _json.dumps(ui_schema, indent=2),
                )
                print(f"✅ Generated UI schema: {len(ui_schema)} functions with typed controls")

                # Generate AI-powered app metadata (name/tagline/description) based on
                # contract name and ABI, not raw user prompt
                metadata = await self._generate_app_metadata(
                    contract_name=contract_name,
                    contract_abi=contract_abi,
                    user_prompt=prompt
                )
                _app_name = metadata["name"]
                _app_tagline = metadata["tagline"]
                _app_description = metadata["description"]
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
                        "src/config/uiSchema.json": _json.dumps(ui_schema, indent=2),  # Wizard: UI schema
                        ".env.production": env_prod,
                        ".env": env_prod,
                    }
                    ctx["theme_id"] = theme_id  # Store selected theme for shell restoration
                    ctx["has_custom_theme"] = has_custom_theme  # Store custom theme flag
                    save_json_store(chat_id, "context.json", ctx)
                    print(f"🛡️ Stored {len(ctx['protected_files'])} protected files + theme ({theme_id}, custom={has_custom_theme}) in context.json")
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
            frontend_prompt, has_custom_theme = self._create_frontend_prompt(
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
    
    def _enhance_contract_prompt_for_no_args(self, prompt: str) -> str:
        """
        Wizard §4.3: Enhance contract generation prompt to prefer no-arg constructors.
        This is the safest mitigation for constructor-args deployment failures.
        """
        return f"""{prompt}

IMPORTANT DEPLOYMENT CONSTRAINT:
- Use a constructor with NO parameters (empty constructor or no constructor at all)
- Initialize state variables with sensible defaults directly in their declarations
- If configuration is needed, provide setter functions instead of constructor params
- This ensures the contract can be deployed without constructor arguments

Example:
  ✓ GOOD: contract MyToken {{ uint256 public totalSupply = 1000000; }}
  ✓ GOOD: constructor() {{ owner = msg.sender; }}
  ✗ BAD:  constructor(uint256 _supply) {{ totalSupply = _supply; }}
"""
    
    def _create_frontend_prompt(
        self,
        original_prompt: str,
        contract_address: str,
        contract_name: str,
        abi: list,
        network: str,
        chain_id: int
    ) -> tuple[str, bool]:
        """
        Create enhanced prompt for frontend generation with contract details.

        Enforces:
          - A MANDATORY two-page architecture (LandingPage "/" + AppPage "/app")
          - The strict "Ginie neo-brutalist" design system on every frontend (unless custom theme requested)
        
        Returns:
            (prompt_text, has_custom_theme)
        """
        # Detect if user requested custom theme/styling
        custom_theme_keywords = [
            'purple', 'matrix', 'green', 'cyberpunk', 'neon', 'glow', 'glassmorphism',
            'dark theme', 'background:', 'color:', '#', 'gradient', 'futuristic',
            'terminal', 'hacker', 'sci-fi', 'blue theme', 'red theme', 'custom theme',
            'styling:', 'design:', 'aesthetic:', 'look:', 'visual:'
        ]
        
        prompt_lower = original_prompt.lower()
        has_custom_theme = any(keyword in prompt_lower for keyword in custom_theme_keywords)
        
        if has_custom_theme:
            print("🎨 Custom theme detected in prompt - using flexible design system")
            design_system = self._get_flexible_design_system()
            index_css = self._get_flexible_css_template()
        else:
            print("🎨 No custom theme detected - using default neo-brutalist design")
            design_system = get_strict_design_system()
            index_css = get_index_css_template()

        return f"""
Build a premium Web3 React frontend for the following smart contract.

<<<CONTRACT_DETAILS_DO_NOT_ALTER>>>
- Name: {contract_name}
- Address: {contract_address}
- Network: {network} (Chain ID: {chain_id})
- ABI: {json.dumps(abi, indent=2)}
<<<END_CONTRACT_DETAILS>>>

ORIGINAL REQUEST:
{original_prompt}

<<<FRONTEND_SPEC_DO_NOT_ALTER>>>
================================================================================
🚨 MANDATORY TWO-PAGE ARCHITECTURE (NON-NEGOTIABLE)
================================================================================
You MUST create TWO separate pages wired with react-router-dom. A single-page
layout is NOT acceptable and will be rejected.

1. src/pages/LandingPage.jsx  → route "/"  (marketing / info ONLY, NO contract calls)
   - Full-width HERO: big Archivo Black headline (use nb-hl yellow highlight on a
     key word), tagline from APP_TAGLINE, short description from APP_DESCRIPTION.
   - Prominent primary button "Open App" that navigates to "/app"
     (use react-router <Link to="/app"> or useNavigate).
   - "What It Does" section: 3-4 nb-card feature cards with lucide-react icons.
   - "How It Works" section: numbered steps 1-2-3-4 (connect wallet → action → result).
   - "How To Use" section: short bullet instructions + prerequisites.
   - Footer: explorer link (EXPLORER_URL), network badge, verification status.
   - NO wallet connect and NO contract reads/writes on this page.

2. src/pages/AppPage.jsx  → route "/app"  (ALL contract interaction lives here)
   - Header: app name, wallet connect button (RainbowKit), connected address,
     network indicator, and a "← Home" <Link to="/">.
   - Stats dashboard: key read-function values in nb-card-sm cards (mono numbers).
   - Grouped function sections:
       * READ functions  → auto-fetch + refresh button, results in cards.
       * WRITE functions → input forms with the CORRECT control per Solidity type
         (string→text, uint→number min=0, address→text w/ 0x validation,
          bool→Yes/No toggle buttons NOT text, enum→select, array→dynamic list).
   - Transaction feedback: pending spinner, success toast with explorer tx link,
     friendly error messages. Handle wallet-not-connected & wrong-network states.

3. src/App.jsx MUST set up routing:
   import {{ BrowserRouter, Routes, Route }} from 'react-router-dom'
   <BrowserRouter>
     <Routes>
       <Route path="/" element={{<LandingPage />}} />
       <Route path="/app" element={{<AppPage />}} />
     </Routes>
   </BrowserRouter>
   Ensure react-router-dom is installed/added to package.json.

Both pages MUST import shared metadata from src/config/appMeta.js
(APP_NAME, APP_TAGLINE, APP_DESCRIPTION, EXPLORER_URL, VERIFIED) and contract
config from src/config/contract.js — these files are PRE-WRITTEN, do not overwrite.

================================================================================
WEB3 WIRING REQUIREMENTS (WIZARD-ENHANCED)
================================================================================
1. Use create_web3_boilerplate() to set up wagmi + RainbowKit + viem.
2. Use save_contract_info() with the EXACT address, chain_id, network, abi above.
3. Wire ALL read functions via wagmi useReadContract (address from contract.js).
4. Wire ALL write functions via wagmi useWriteContract + useWaitForTransactionReceipt.
5. For payable functions, clearly show the required native-token amount.

🎯 DETERMINISTIC TYPE HANDLING (DO NOT RE-IMPLEMENT):
   - A typed UI schema is pre-written at src/config/uiSchema.json
   - Typed Web3 hooks are pre-written at src/hooks/useContractField.js
   - IMPORT these instead of writing your own type logic:
     
     import uiSchema from '../config/uiSchema.json'
     import {{ convertFieldValue, getFieldError, parseBigInt, validateAddress }} from '../hooks/useContractField'
     
   - For each function input, use the uiSchema field.control to pick the right UI:
     * "address" → text input with validateAddress()
     * "number-bigint" → number input, convert with parseBigInt()
     * "bool" → Yes/No toggle buttons (NOT text input)
     * "bytes" → text input with hex validation
     * "text" → text input
     * "textarea" → textarea (for arrays/tuples, parse JSON)
   
   - Before calling a write function, convert args with convertFieldValue(field, userInput)
   - Show validation errors with getFieldError(field, userInput)

{design_system}

================================================================================
📄 src/index.css — WRITE THIS FILE EXACTLY AS BELOW (design system tokens+classes)
================================================================================
{index_css}

FINAL CHECK before you finish:
  ✓ LandingPage.jsx and AppPage.jsx BOTH exist and are routed in App.jsx.
  ✓ index.css contains the neo-brutalist tokens/classes above.
  ✓ nb-* classes (nb-card, nb-btn, nb-field, nb-ticker, nb-display, nb-hl) are used.
  ✓ Landing page has an "Open App" button → "/app"; App page has "← Home" → "/".
  ✓ All contract read/write functions are wired on AppPage only.
<<<END_FRONTEND_SPEC>>>
""", has_custom_theme
    
    def _get_flexible_design_system(self) -> str:
        """
        Return a flexible design system that allows AI to derive theme from the user's concept.
        Based on wizard's frontend.system.md approach.
        """
        return r"""
================================================================================
🎨 FLEXIBLE DESIGN SYSTEM — AI-DRIVEN THEME CUSTOMIZATION
================================================================================
You are a Staff Frontend & Web3 Design Engineer. The user has requested specific
visual styling in their prompt. You MUST honor their requested theme/colors/aesthetic.

STEP 1 — READ THE CONCEPT, THEN DESIGN
---------------------------------------
Before writing any code, read the DApp concept and styling requirements provided.
Extract the requested:
- Background colors
- Text colors
- Accent colors
- Button colors
- Visual aesthetic (cyberpunk, minimalist, glassmorphism, etc.)
- Typography preferences
- Animation preferences

Use these requirements to create a custom design system that matches the user's vision.

STEP 2 — IMPLEMENT THE REQUESTED THEME
---------------------------------------
1. **Colors**: Use the EXACT colors specified in the prompt (e.g., #1a0033 for purple, #00ff41 for matrix green)
2. **Background**: Apply the requested background color/gradient/image
3. **Typography**: Use requested fonts or choose fonts that match the aesthetic
4. **Components**: Style buttons, cards, inputs to match the requested theme
5. **Effects**: Add requested effects (neon glow, glassmorphism, shadows, etc.)
6. **Animations**: Use framer-motion if animations are requested

STEP 3 — WRITE CUSTOM CSS
--------------------------
Write src/index.css with:
- @import "tailwindcss" at the top
- Custom CSS variables for the requested color palette
- Custom component classes that implement the requested styling
- Any requested effects (glows, gradients, animations)

Example for a cyberpunk purple/matrix-green theme:
```css
@import "tailwindcss";

:root {
  --bg-primary: #1a0033;
  --text-primary: #00ff41;
  --text-secondary: #00ffff;
  --accent: #00ffff;
  --card-bg: rgba(26, 0, 51, 0.6);
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
}

.custom-card {
  background: var(--card-bg);
  border: 1px solid #00ff41;
  border-radius: 8px;
  backdrop-filter: blur(10px);
  box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
}

.custom-btn {
  background: var(--accent);
  color: #1a0033;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-weight: 600;
  transition: all 0.3s;
}

.custom-btn:hover {
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.6);
  transform: translateY(-2px);
}
```

CRITICAL RULES:
- DO NOT ignore the user's color/theme requirements
- DO NOT fall back to a default theme if custom styling is requested
- DO use the exact hex colors specified in the prompt
- DO implement the requested visual effects (neon, glow, glassmorphism, etc.)
- DO use framer-motion for animations if requested
- DO make the design match the requested aesthetic (cyberpunk, minimalist, etc.)

================================================================================
"""
    
    def _get_flexible_css_template(self) -> str:
        """
        Return a minimal CSS template that allows full customization.
        The AI will replace this with custom CSS based on the user's requirements.
        """
        return r"""@import "tailwindcss";

/* 
 * CUSTOM THEME CSS
 * This file should be completely rewritten by the AI based on the user's
 * requested theme, colors, and styling requirements from the prompt.
 * 
 * The AI MUST:
 * 1. Define CSS variables for the requested color palette
 * 2. Style the body with the requested background
 * 3. Create custom component classes that match the requested aesthetic
 * 4. Add any requested visual effects (glows, shadows, gradients, etc.)
 */

:root {
  /* Define your custom color palette here based on user requirements */
}

body {
  /* Apply requested background, typography, and base styles */
}

/* Add custom component classes here */
"""
    
    async def _generate_app_metadata(
        self,
        contract_name: str,
        contract_abi: list,
        user_prompt: str
    ) -> Dict[str, str]:
        """
        Generate professional app metadata (name, tagline, description) using AI
        based on contract name and ABI analysis, not raw user prompt.
        
        Returns:
            {
                "name": "Token Swap",
                "tagline": "Decentralized token exchange on BOT Chain",
                "description": "Swap tokens instantly with automated market making. Connect your wallet to trade ERC-20 tokens with low fees and instant settlement."
            }
        """
        try:
            from agent.agent import llm_gemini_flash
            from langchain_core.messages import SystemMessage, HumanMessage
            import json as _json
            
            # Extract function names from ABI for context
            function_names = [
                item.get("name", "")
                for item in contract_abi
                if item.get("type") == "function" and item.get("name")
            ]
            
            system_prompt = """You are a marketing copywriter for Web3 DApps. Generate professional metadata for a DApp landing page.

Output ONLY valid JSON with this exact structure:
{
  "name": "Short App Name (2-4 words, title case)",
  "tagline": "One catchy sentence about what it does (max 80 chars)",
  "description": "2-3 sentences explaining functionality and benefits (max 200 chars)"
}

Rules:
- Name: Professional, not code-like (e.g., "Token Swap" not "TokenSwap" or "Effotel")
- Tagline: Marketing-focused, mention blockchain/decentralization
- Description: Explain what users can DO, not what the contract IS
- NO raw prompts, NO technical jargon, YES user benefits
"""
            
            user_message = f"""Contract Name: {contract_name}
User Request: {user_prompt[:200]}
Contract Functions: {", ".join(function_names[:10])}

Generate professional DApp metadata (name, tagline, description) for the landing page."""
            
            response = await llm_gemini_flash.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_message)
            ])
            
            # Parse JSON response
            metadata = _json.loads(response.content.strip())
            
            # Validate and provide fallbacks
            return {
                "name": metadata.get("name", contract_name or "BotChain DApp")[:50],
                "tagline": metadata.get("tagline", "A decentralized app on BOT Chain")[:120],
                "description": metadata.get("description", "Interact with this smart contract directly on-chain.")[:250]
            }
            
        except Exception as e:
            print(f"⚠️ Metadata generation failed: {e}, using fallbacks")
            # Fallback to simple formatting
            clean_name = contract_name.replace("_", " ").replace("-", " ").title() if contract_name else "BotChain DApp"
            return {
                "name": clean_name,
                "tagline": f"Decentralized {clean_name.lower()} on BOT Chain",
                "description": "Interact with this smart contract directly on-chain. Every transaction is transparent and verifiable on the blockchain."
            }
    
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
