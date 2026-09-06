"""
EVI Platform Enhancements - Integration Layer
==============================================
This module integrates all enhancement systems:
- Dependency Resolution
- Project State Machine  
- Contract Registry
- Tool Call Budget

Use this as the main entry point for enhanced agent operations.
"""

import logging
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass

from .dependency_resolver import (
    DependencyResolver,
    smart_npm_install,
    get_recommended_stack,
    list_available_stacks,
    DependencyAnalysis
)
from .project_state_machine import (
    ProjectStateMachine,
    ProjectPhase,
    ActionType,
    project_state_manager
)
from .contract_registry import (
    ContractRegistry,
    smart_deploy_game_contract,
    contract_registry
)
from .tool_call_budget import (
    ToolCallBudget,
    BudgetConfig,
    budget_manager,
    get_recommended_budget,
    format_budget_report,
    BudgetExceededException
)

logger = logging.getLogger(__name__)


@dataclass
class EnhancedProjectContext:
    """Complete enhanced context for a project"""
    project_id: str
    state_machine: ProjectStateMachine
    budget: ToolCallBudget
    dependency_resolver: DependencyResolver
    
    # Cached analysis
    _dependency_analysis: Optional[DependencyAnalysis] = None


class EVIEnhancedAgent:
    """
    Enhanced agent wrapper that integrates all improvement systems.
    
    Usage:
        agent = EVIEnhancedAgent(project_id)
        
        # Before any action
        if agent.can_proceed():
            # Before tool call
            allowed, reason = agent.pre_tool_call("create_file", {"file_path": "src/App.jsx"})
            if allowed:
                result = await actual_tool_call(...)
                agent.post_tool_call("create_file", success=True)
    """
    
    def __init__(self, project_id: str, project_type: str = "default"):
        self.project_id = project_id
        self.project_type = project_type
        
        # Initialize all systems
        self.state_machine = project_state_manager.get_or_create(project_id)
        
        budget_config = get_recommended_budget(project_type)
        self.budget = budget_manager.get_or_create(project_id, budget_config)
        
        self.dependency_resolver = DependencyResolver()
        self.contract_registry = contract_registry
        
        # Track context
        self._context = EnhancedProjectContext(
            project_id=project_id,
            state_machine=self.state_machine,
            budget=self.budget,
            dependency_resolver=self.dependency_resolver
        )
    
    def can_proceed(self) -> tuple[bool, Optional[str]]:
        """
        Check if the agent should continue working.
        
        Returns:
            Tuple of (can_proceed, termination_reason)
        """
        # Check state machine
        if not self.state_machine.can_continue:
            reason = self.state_machine.get_termination_reason()
            return False, reason
        
        # Check budget
        if self.budget.budget_remaining <= 0:
            return False, "Tool call budget exhausted"
        
        if self.budget.time_remaining <= 0:
            return False, "Time budget exhausted"
        
        return True, None
    
    def pre_tool_call(
        self, 
        tool_name: str, 
        args: Optional[Dict[str, Any]] = None
    ) -> tuple[bool, str]:
        """
        Call before executing a tool. Checks all constraints.
        
        Returns:
            Tuple of (allowed, reason)
        """
        # Map tool name to action type
        action_map = {
            "read_file": ActionType.READ_FILE,
            "list_directory": ActionType.LIST_DIRECTORY,
            "create_file": ActionType.CREATE_FILE,
            "write_multiple_files": ActionType.CREATE_FILE,
            "delete_file": ActionType.DELETE_FILE,
            "execute_command": ActionType.EXECUTE_COMMAND,
            "npm_install": ActionType.NPM_INSTALL,
            "deploy_game_contract": ActionType.DEPLOY_CONTRACT,
            "deploy_smart_contract": ActionType.DEPLOY_CONTRACT,
            "test_build": ActionType.TEST_BUILD,
            "save_context": ActionType.SAVE_CONTEXT,
        }
        
        action = action_map.get(tool_name, ActionType.EXECUTE_COMMAND)
        
        # Check state machine
        allowed, reason = self.state_machine.can_perform_action(action)
        if not allowed:
            return False, f"State machine: {reason}"
        
        # Check budget
        allowed, reason = self.budget.can_make_call(tool_name)
        if not allowed:
            return False, f"Budget: {reason}"
        
        return True, "Allowed"
    
    def post_tool_call(
        self,
        tool_name: str,
        args: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error: Optional[str] = None,
        duration_ms: Optional[float] = None
    ) -> Optional[str]:
        """
        Call after executing a tool. Records metrics and checks for issues.
        
        Returns:
            Warning message if any issues detected
        """
        # Map to action type for state machine
        action_map = {
            "read_file": ActionType.READ_FILE,
            "list_directory": ActionType.LIST_DIRECTORY,
            "create_file": ActionType.CREATE_FILE,
            "write_multiple_files": ActionType.CREATE_FILE,
            "delete_file": ActionType.DELETE_FILE,
            "execute_command": ActionType.EXECUTE_COMMAND,
            "npm_install": ActionType.NPM_INSTALL,
            "deploy_game_contract": ActionType.DEPLOY_CONTRACT,
            "deploy_smart_contract": ActionType.DEPLOY_CONTRACT,
            "test_build": ActionType.TEST_BUILD,
            "save_context": ActionType.SAVE_CONTEXT,
        }
        
        action = action_map.get(tool_name, ActionType.EXECUTE_COMMAND)
        
        # Record in state machine
        self.state_machine.record_action(action, args)
        if not success and error:
            self.state_machine.record_error(error)
        
        # Record in budget tracker
        warning = self.budget.record_call(
            tool_name=tool_name,
            args=args,
            success=success,
            error=error,
            duration_ms=duration_ms
        )
        
        return warning
    
    def transition_phase(self, new_phase: ProjectPhase) -> bool:
        """Transition to a new project phase"""
        return self.state_machine.transition_to(new_phase)
    
    def mark_web3_project(self):
        """Mark as a Web3 project"""
        self.state_machine.mark_web3_project()
    
    async def smart_install_packages(
        self,
        sandbox,
        packages: List[str],
        existing_package_json: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Install packages with automatic conflict resolution.
        """
        # Pre-check
        allowed, reason = self.pre_tool_call("npm_install", {"packages": packages})
        if not allowed:
            return {"success": False, "error": reason}
        
        import time
        start = time.time()
        
        try:
            result = await smart_npm_install(
                sandbox=sandbox,
                packages=packages,
                project_id=self.project_id,
                existing_package_json=existing_package_json
            )
            
            duration_ms = (time.time() - start) * 1000
            self.post_tool_call(
                "npm_install",
                {"packages": packages},
                success=result.get("success", False),
                duration_ms=duration_ms
            )
            
            return result
            
        except Exception as e:
            self.post_tool_call(
                "npm_install",
                {"packages": packages},
                success=False,
                error=str(e)
            )
            return {"success": False, "error": str(e)}
    
    async def smart_deploy_contract(
        self,
        game_type: str,
        network: str = "basecamp",
        deploy_function: Callable = None,
        force_new: bool = False
    ) -> Dict[str, Any]:
        """
        Deploy contract with deduplication check.
        """
        # Pre-check
        allowed, reason = self.pre_tool_call(
            "deploy_game_contract", 
            {"game_type": game_type, "network": network}
        )
        if not allowed:
            return {"success": False, "error": reason}
        
        import time
        start = time.time()
        
        try:
            result = await smart_deploy_game_contract(
                project_id=self.project_id,
                game_type=game_type,
                network=network,
                deploy_function=deploy_function,
                force_new=force_new
            )
            
            duration_ms = (time.time() - start) * 1000
            
            # Record contract deployment in state machine
            if result.get("success"):
                self.state_machine.record_action(
                    ActionType.DEPLOY_CONTRACT,
                    {
                        "name": game_type,
                        "address": result.get("contract_address"),
                        "reused": result.get("reused", False)
                    }
                )
            
            self.post_tool_call(
                "deploy_game_contract",
                {"game_type": game_type, "network": network},
                success=result.get("success", False),
                duration_ms=duration_ms
            )
            
            return result
            
        except Exception as e:
            self.post_tool_call(
                "deploy_game_contract",
                {"game_type": game_type, "network": network},
                success=False,
                error=str(e)
            )
            return {"success": False, "error": str(e)}
    
    def analyze_dependencies(
        self, 
        package_json: Dict
    ) -> DependencyAnalysis:
        """Analyze package.json for conflicts"""
        self._context._dependency_analysis = self.dependency_resolver.analyze_package_json(package_json)
        return self._context._dependency_analysis
    
    def get_status(self) -> Dict[str, Any]:
        """Get complete status of all systems"""
        return {
            "project_id": self.project_id,
            "state_machine": self.state_machine.get_status_summary(),
            "budget": self.budget.get_summary(),
            "can_proceed": self.can_proceed()[0],
            "termination_reason": self.can_proceed()[1]
        }
    
    def get_report(self) -> str:
        """Get formatted report of all systems"""
        status = self.get_status()
        
        report = f"""
{'='*70}
EVI ENHANCED AGENT STATUS REPORT
{'='*70}

PROJECT: {self.project_id}
TYPE: {self.project_type}

STATE MACHINE STATUS
--------------------
Current Phase: {status['state_machine']['current_phase']}
Is Web3: {status['state_machine']['is_web3']}
Can Continue: {status['state_machine']['can_continue']}
Files Created: {status['state_machine']['files_created']}
Files Read: {status['state_machine']['files_read']}
Dependencies: {status['state_machine']['dependencies_installed']}
Contracts: {status['state_machine']['contracts_deployed']}
Errors: {status['state_machine']['errors']}

BUDGET STATUS
-------------
Total Calls: {status['budget']['total_calls']}
Remaining: {status['budget']['budget_remaining']}
Time Elapsed: {status['budget']['time_elapsed_seconds']:.1f}s
Efficiency Score: {status['budget']['efficiency_score']:.1f}%

TERMINATION STATUS
------------------
Can Proceed: {status['can_proceed']}
Reason: {status['termination_reason'] or 'N/A'}

{'='*70}
"""
        
        # Add budget report
        report += format_budget_report(self.budget)
        
        return report
    
    def should_stop(self) -> tuple[bool, str]:
        """
        Check if agent should stop working.
        
        Returns:
            Tuple of (should_stop, reason)
        """
        can_proceed, reason = self.can_proceed()
        return not can_proceed, reason or "Work complete"
    
    def finalize(self):
        """Clean up and finalize the project"""
        # Transition to complete if possible
        if self.state_machine.current_phase == ProjectPhase.VERIFIED:
            self.state_machine.transition_to(ProjectPhase.COMPLETE)
        
        logger.info(f"Project {self.project_id} finalized")
        logger.info(self.get_report())


# ============================================================================
# FACTORY FUNCTIONS
# ============================================================================

def create_enhanced_agent(
    project_id: str,
    is_web3: bool = False,
    is_complex: bool = False
) -> EVIEnhancedAgent:
    """
    Factory function to create an enhanced agent with appropriate configuration.
    
    Args:
        project_id: Project identifier
        is_web3: Whether this is a Web3 project
        is_complex: Whether this is a complex project needing more resources
    """
    if is_web3:
        project_type = "web3_game"
    elif is_complex:
        project_type = "default"
    else:
        project_type = "simple_app"
    
    agent = EVIEnhancedAgent(project_id, project_type)
    
    if is_web3:
        agent.mark_web3_project()
    
    return agent


def get_project_agent(project_id: str) -> Optional[EVIEnhancedAgent]:
    """Get existing agent for a project if one exists"""
    state_machine = project_state_manager.get(project_id)
    budget = budget_manager.get(project_id)
    
    if state_machine and budget:
        # Reconstruct agent from existing systems
        agent = EVIEnhancedAgent.__new__(EVIEnhancedAgent)
        agent.project_id = project_id
        agent.state_machine = state_machine
        agent.budget = budget
        agent.dependency_resolver = DependencyResolver()
        agent.contract_registry = contract_registry
        return agent
    
    return None


# ============================================================================
# QUICK INTEGRATION HELPERS
# ============================================================================

def check_before_tool_call(
    project_id: str,
    tool_name: str,
    args: Optional[Dict] = None
) -> tuple[bool, str]:
    """
    Quick check before any tool call.
    
    Usage in tools.py:
        allowed, reason = check_before_tool_call(project_id, "create_file", {"file_path": path})
        if not allowed:
            return f"Action blocked: {reason}"
    """
    agent = get_project_agent(project_id)
    if not agent:
        # No tracking for this project yet, allow
        return True, "No tracking"
    
    return agent.pre_tool_call(tool_name, args)


def record_tool_call(
    project_id: str,
    tool_name: str,
    args: Optional[Dict] = None,
    success: bool = True,
    error: Optional[str] = None,
    duration_ms: Optional[float] = None
):
    """
    Record a tool call after execution.
    
    Usage in tools.py:
        record_tool_call(project_id, "create_file", {"file_path": path}, success=True)
    """
    agent = get_project_agent(project_id)
    if agent:
        agent.post_tool_call(tool_name, args, success, error, duration_ms)


def should_agent_stop(project_id: str) -> tuple[bool, str]:
    """
    Check if agent should stop working on a project.
    
    Usage in graph_nodes.py:
        should_stop, reason = should_agent_stop(project_id)
        if should_stop:
            return {"success": False, "error_message": reason}
    """
    agent = get_project_agent(project_id)
    if not agent:
        return False, "No tracking"
    
    return agent.should_stop()
