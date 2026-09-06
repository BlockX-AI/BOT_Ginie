"""
Enhanced Tools Integration
===========================
This module wraps existing tools with the enhancement systems:
- Tool Call Budget tracking
- Project State Machine enforcement
- Contract Registry deduplication
- Dependency Resolution

Import this instead of tools.py to get enhanced behavior.
"""

import time
import json
import logging
from functools import wraps
from typing import Callable, Any, Dict, Optional

from e2b_code_interpreter import AsyncSandbox
from fastapi import WebSocket
from langchain_core.tools import tool

# Import enhancement systems
from utils.evi_enhancements import (
    EVIEnhancedAgent,
    create_enhanced_agent,
    check_before_tool_call,
    record_tool_call,
    should_agent_stop
)
from utils.dependency_resolver import smart_npm_install, DependencyResolver
from utils.contract_registry import smart_deploy_game_contract, contract_registry
from utils.project_state_machine import ProjectPhase, ActionType

logger = logging.getLogger(__name__)

# Global agent instances per project
_project_agents: Dict[str, EVIEnhancedAgent] = {}


def get_enhanced_agent(project_id: str, is_web3: bool = False) -> EVIEnhancedAgent:
    """Get or create enhanced agent for a project"""
    if project_id not in _project_agents:
        _project_agents[project_id] = create_enhanced_agent(
            project_id=project_id,
            is_web3=is_web3
        )
    return _project_agents[project_id]


def tracked_tool(tool_name: str, action_type: ActionType = None):
    """
    Decorator that adds tracking to any tool function.
    
    Usage:
        @tracked_tool("create_file", ActionType.CREATE_FILE)
        async def create_file(file_path: str, content: str) -> str:
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, project_id: str = None, **kwargs):
            # Extract project_id from various sources
            pid = project_id or kwargs.get('project_id')
            
            if not pid:
                # Fall back to executing without tracking
                return await func(*args, **kwargs)
            
            agent = get_enhanced_agent(pid)
            
            # Pre-check
            allowed, reason = agent.pre_tool_call(tool_name, kwargs)
            if not allowed:
                logger.warning(f"Tool call blocked: {tool_name} - {reason}")
                return f"⚠️ Action blocked: {reason}"
            
            # Execute with timing
            start_time = time.time()
            success = True
            error = None
            result = None
            
            try:
                result = await func(*args, **kwargs)
                # Check if result indicates failure
                if isinstance(result, str) and ("error" in result.lower() or "failed" in result.lower()):
                    success = False
                    error = result
            except Exception as e:
                success = False
                error = str(e)
                raise
            finally:
                duration_ms = (time.time() - start_time) * 1000
                warning = agent.post_tool_call(
                    tool_name=tool_name,
                    args=kwargs,
                    success=success,
                    error=error,
                    duration_ms=duration_ms
                )
                
                if warning:
                    logger.warning(f"[{pid}] {warning}")
            
            return result
        
        return wrapper
    return decorator


def create_enhanced_tools_with_context(
    sandbox: AsyncSandbox, 
    socket: WebSocket, 
    project_id: str = None,
    is_web3: bool = False
):
    """
    Create tools with enhanced tracking and safety features.
    Drop-in replacement for create_tools_with_context.
    """
    
    # Initialize enhanced agent for this project
    if project_id:
        agent = get_enhanced_agent(project_id, is_web3)
    else:
        agent = None
    
    async def safe_send_json(sock: WebSocket, data: dict) -> bool:
        """Safely send JSON over WebSocket"""
        try:
            if hasattr(sock, 'application_state') and sock.application_state.value != 1:
                return False
            if hasattr(sock, 'client_state') and sock.client_state.value != 1:
                return False
            await sock.send_json(data)
            return True
        except Exception as e:
            error_str = str(e)
            if "websocket.close" not in error_str and "response already completed" not in error_str:
                print(f"safe_send_json failed: {e}")
            return False
    
    def check_can_continue() -> tuple[bool, str]:
        """Check if agent should continue working"""
        if agent:
            return agent.can_proceed()
        return True, "No tracking"
    
    # =========================================================================
    # ENHANCED FILE OPERATIONS
    # =========================================================================
    
    @tool
    async def create_file(file_path: str, content: str) -> str:
        """
        Create a file with the given content at the specified path.
        Enhanced with budget tracking and loop detection.
        """
        # Pre-check
        if agent:
            allowed, reason = agent.pre_tool_call("create_file", {"file_path": file_path})
            if not allowed:
                return f"⚠️ Blocked: {reason}"
        
        start_time = time.time()
        
        try:
            import os
            full_path = os.path.join("/home/user/react-app", file_path)
            
            # Handle escaped characters
            try:
                fixed_content = content.encode("utf-8").decode("unicode_escape")
            except (UnicodeDecodeError, AttributeError):
                fixed_content = content
            
            await sandbox.files.write(full_path, fixed_content)
            
            # Store in database
            if project_id:
                try:
                    from db.base import get_db
                    from utils.file_manager import store_project_file
                    async for db in get_db():
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
            
            await safe_send_json(socket, {
                "e": "file_created", 
                "message": f"Created {file_path}", 
                "file_path": file_path
            })
            
            # Record success
            if agent:
                agent.post_tool_call(
                    "create_file", 
                    {"file_path": file_path}, 
                    success=True,
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            return f"File {file_path} created successfully."
            
        except Exception as e:
            if agent:
                agent.post_tool_call(
                    "create_file", 
                    {"file_path": file_path}, 
                    success=False,
                    error=str(e)
                )
            await safe_send_json(socket, {
                "e": "file_error", 
                "message": f"Failed to create {file_path}: {str(e)}"
            })
            return f"Failed to create file {file_path}: {str(e)}"
    
    @tool
    async def read_file(file_path: str) -> str:
        """
        Read the content of a file. Enhanced with duplicate detection.
        """
        if agent:
            allowed, reason = agent.pre_tool_call("read_file", {"file_path": file_path})
            if not allowed:
                return f"⚠️ Blocked: {reason}"
        
        start_time = time.time()
        
        try:
            import os
            full_path = os.path.join("/home/user/react-app", file_path)
            content = await sandbox.files.read(full_path)
            
            if agent:
                agent.post_tool_call(
                    "read_file",
                    {"file_path": file_path},
                    success=True,
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            return content
            
        except Exception as e:
            if agent:
                agent.post_tool_call(
                    "read_file",
                    {"file_path": file_path},
                    success=False,
                    error=str(e)
                )
            return f"Error reading file {file_path}: {str(e)}"
    
    @tool
    async def list_directory(path: str = ".") -> str:
        """
        List directory structure. Enhanced with duplicate detection.
        """
        if agent:
            allowed, reason = agent.pre_tool_call("list_directory", {"path": path})
            if not allowed:
                return f"⚠️ Blocked: {reason}"
        
        start_time = time.time()
        
        try:
            cmd = f"find {path} -type f -o -type d | grep -v node_modules | grep -v '/\\.' | head -100"
            result = await sandbox.commands.run(cmd, cwd="/home/user/react-app")
            
            if agent:
                agent.post_tool_call(
                    "list_directory",
                    {"path": path},
                    success=result.exit_code == 0,
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            if result.exit_code == 0:
                return f"Directory structure:\n{result.stdout}"
            else:
                return f"Failed to list directory: {result.stderr}"
                
        except Exception as e:
            if agent:
                agent.post_tool_call("list_directory", {"path": path}, success=False, error=str(e))
            return f"Error listing directory: {str(e)}"
    
    # =========================================================================
    # ENHANCED NPM INSTALL (with dependency resolution)
    # =========================================================================
    
    @tool
    async def smart_install_packages(packages: str) -> str:
        """
        Install npm packages with automatic version conflict resolution.
        Uses the curated compatibility database to prevent peer dependency issues.
        
        Args:
            packages: Space-separated list of packages to install
        
        Example:
            smart_install_packages("wagmi @rainbow-me/rainbowkit viem")
        """
        if agent:
            allowed, reason = agent.pre_tool_call("npm_install", {"packages": packages})
            if not allowed:
                return f"⚠️ Blocked: {reason}"
        
        start_time = time.time()
        package_list = packages.split()
        
        try:
            # Read existing package.json
            try:
                pkg_content = await sandbox.files.read("/home/user/react-app/package.json")
                existing_pkg = json.loads(pkg_content)
            except:
                existing_pkg = None
            
            # Use smart installer
            result = await smart_npm_install(
                sandbox=sandbox,
                packages=package_list,
                project_id=project_id,
                existing_package_json=existing_pkg
            )
            
            if agent:
                agent.post_tool_call(
                    "npm_install",
                    {"packages": package_list},
                    success=result.get("success", False),
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            if result.get("success"):
                msg = f"✅ Successfully installed: {', '.join(result.get('installed', []))}"
                if result.get("warnings"):
                    msg += f"\n⚠️ Warnings: {'; '.join(result['warnings'])}"
                if result.get("changes"):
                    msg += f"\n🔧 Auto-fixes applied: {'; '.join(result['changes'])}"
                return msg
            else:
                return f"❌ Installation failed: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            if agent:
                agent.post_tool_call("npm_install", {"packages": package_list}, success=False, error=str(e))
            return f"❌ Installation error: {str(e)}"
    
    # =========================================================================
    # ENHANCED CONTRACT DEPLOYMENT (with deduplication)
    # =========================================================================
    
    @tool
    async def deploy_game_contract_safe(
        game_type: str,
        network: str = "basecamp",
        force_new: bool = False
    ) -> str:
        """
        Deploy a game smart contract with automatic deduplication.
        Checks if contract already exists before deploying.
        
        Args:
            game_type: Type of game (coin-flip, tic-tac-toe, etc.)
            network: Target network (default: basecamp)
            force_new: Force new deployment even if contract exists
        
        Returns:
            Contract address and deployment details
        """
        if agent:
            allowed, reason = agent.pre_tool_call(
                "deploy_game_contract", 
                {"game_type": game_type, "network": network}
            )
            if not allowed:
                return f"⚠️ Blocked: {reason}"
            
            # Mark as Web3 project
            agent.mark_web3_project()
        
        start_time = time.time()
        
        # Check for existing contract FIRST
        existing = contract_registry.get_game_contract(project_id, game_type, network)
        if existing and not force_new:
            if agent:
                agent.post_tool_call(
                    "deploy_game_contract",
                    {"game_type": game_type, "network": network, "reused": True},
                    success=True,
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            return f"""✅ **Contract Already Deployed!**
📍 Address: `{existing.address}`
🌐 Network: {existing.network}
🔗 Explorer: {existing.explorer_url or 'N/A'}

💡 This contract was previously deployed. Use force_new=True to deploy a new one."""
        
        try:
            # Import actual deployment function
            from integrations.evi_client import EVIClient
            
            async def actual_deploy(gt, net):
                async with EVIClient() as client:
                    result = await client.deploy_game(gt, net)
                    return result
            
            result = await smart_deploy_game_contract(
                project_id=project_id,
                game_type=game_type,
                network=network,
                deploy_function=actual_deploy,
                force_new=force_new
            )
            
            if agent:
                agent.post_tool_call(
                    "deploy_game_contract",
                    {"game_type": game_type, "network": network, "reused": result.get("reused", False)},
                    success=result.get("success", False),
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            if result.get("success"):
                status = "Reused existing" if result.get("reused") else "Deployed new"
                return f"""✅ **{status} Contract!**
📍 Address: `{result['contract_address']}`
🌐 Network: {result['network']}
🔗 Explorer: {result.get('explorer_url', 'N/A')}"""
            else:
                return f"❌ Deployment failed: {result.get('error', 'Unknown error')}"
                
        except Exception as e:
            if agent:
                agent.post_tool_call(
                    "deploy_game_contract",
                    {"game_type": game_type, "network": network},
                    success=False,
                    error=str(e)
                )
            return f"❌ Deployment error: {str(e)}"
    
    # =========================================================================
    # STATUS & CONTROL TOOLS
    # =========================================================================
    
    @tool
    def get_agent_status() -> str:
        """
        Get current status of the enhanced agent including budget usage,
        phase, and efficiency metrics.
        """
        if not agent:
            return "No enhanced agent tracking for this project."
        
        return agent.get_report()
    
    @tool
    def check_should_stop() -> str:
        """
        Check if the agent should stop working.
        Returns termination reason if should stop.
        """
        if not agent:
            return json.dumps({"should_stop": False, "reason": "No tracking"})
        
        should_stop, reason = agent.should_stop()
        return json.dumps({
            "should_stop": should_stop,
            "reason": reason,
            "total_tool_calls": agent.budget.total_calls,
            "budget_remaining": agent.budget.budget_remaining
        })
    
    @tool
    def transition_phase(new_phase: str) -> str:
        """
        Transition to a new project phase.
        Valid phases: ANALYZING, PLANNING, DEPENDENCIES_INSTALLING, 
        BUILDING, TESTING, VERIFIED, COMPLETE
        """
        if not agent:
            return "No enhanced agent tracking for this project."
        
        try:
            phase = ProjectPhase[new_phase.upper()]
            success = agent.transition_phase(phase)
            if success:
                return f"✅ Transitioned to phase: {phase.name}"
            else:
                return f"❌ Invalid transition to {phase.name} from {agent.state_machine.current_phase.name}"
        except KeyError:
            return f"❌ Unknown phase: {new_phase}"
    
    # Return all tools including enhanced ones
    return [
        create_file,
        read_file,
        list_directory,
        smart_install_packages,
        deploy_game_contract_safe,
        get_agent_status,
        check_should_stop,
        transition_phase,
        # Add other tools from original tools.py as needed
    ]


# ============================================================================
# TERMINATION CHECK FOR GRAPH NODES
# ============================================================================

def should_terminate_agent(project_id: str) -> tuple[bool, str]:
    """
    Call this in graph_nodes.py to check if agent should stop.
    
    Usage in graph_nodes.py:
        from agent.enhanced_tools import should_terminate_agent
        
        should_stop, reason = should_terminate_agent(project_id)
        if should_stop:
            return {"success": True, "message": reason}
    """
    if project_id in _project_agents:
        agent = _project_agents[project_id]
        return agent.should_stop()
    return False, "No tracking"


def get_agent_report(project_id: str) -> str:
    """Get full report for a project's agent"""
    if project_id in _project_agents:
        return _project_agents[project_id].get_report()
    return "No enhanced agent for this project"
