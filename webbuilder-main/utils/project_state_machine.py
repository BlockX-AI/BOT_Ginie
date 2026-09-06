"""
Project State Machine
======================
Prevents agent loops by tracking project state and enforcing
clear phase transitions with termination conditions.
"""

import json
import time
from enum import Enum, auto
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ProjectPhase(Enum):
    """Project lifecycle phases - ordered progression"""
    INITIALIZING = auto()          # Project created, sandbox starting
    ANALYZING = auto()             # Reading existing files, understanding context
    PLANNING = auto()              # Creating implementation plan
    DEPENDENCIES_INSTALLING = auto()  # Installing npm packages
    DEPENDENCIES_COMPLETE = auto()    # All dependencies ready
    CONTRACTS_DEPLOYING = auto()      # Deploying smart contracts (Web3 only)
    CONTRACTS_DEPLOYED = auto()       # Contracts ready (Web3 only)
    BUILDING = auto()                 # Creating/modifying files
    BUILD_COMPLETE = auto()           # All files created
    TESTING = auto()                  # Running build/tests
    VERIFIED = auto()                 # Build successful
    COMPLETE = auto()                 # Final state - work done
    ERROR = auto()                    # Error state (recoverable)
    FAILED = auto()                   # Failed state (unrecoverable)


class ActionType(Enum):
    """Types of actions the agent can take"""
    READ_FILE = "read_file"
    CREATE_FILE = "create_file"
    MODIFY_FILE = "modify_file"
    DELETE_FILE = "delete_file"
    EXECUTE_COMMAND = "execute_command"
    NPM_INSTALL = "npm_install"
    DEPLOY_CONTRACT = "deploy_contract"
    TEST_BUILD = "test_build"
    SAVE_CONTEXT = "save_context"
    LIST_DIRECTORY = "list_directory"


@dataclass
class PhaseConfig:
    """Configuration for a project phase"""
    allowed_actions: Set[ActionType]
    max_duration_seconds: int = 300  # 5 minutes default
    max_tool_calls: int = 50
    required_before_transition: List[str] = field(default_factory=list)
    auto_transition_to: Optional[ProjectPhase] = None


# Phase configurations with allowed actions and limits
PHASE_CONFIGS: Dict[ProjectPhase, PhaseConfig] = {
    ProjectPhase.INITIALIZING: PhaseConfig(
        allowed_actions={ActionType.LIST_DIRECTORY, ActionType.READ_FILE},
        max_duration_seconds=60,
        max_tool_calls=10,
        auto_transition_to=ProjectPhase.ANALYZING
    ),
    ProjectPhase.ANALYZING: PhaseConfig(
        allowed_actions={ActionType.LIST_DIRECTORY, ActionType.READ_FILE},
        max_duration_seconds=120,
        max_tool_calls=20,
        required_before_transition=["package.json read", "App.jsx read"]
    ),
    ProjectPhase.PLANNING: PhaseConfig(
        allowed_actions={ActionType.READ_FILE},
        max_duration_seconds=60,
        max_tool_calls=5
    ),
    ProjectPhase.DEPENDENCIES_INSTALLING: PhaseConfig(
        allowed_actions={ActionType.NPM_INSTALL, ActionType.EXECUTE_COMMAND, ActionType.READ_FILE},
        max_duration_seconds=180,
        max_tool_calls=10
    ),
    ProjectPhase.DEPENDENCIES_COMPLETE: PhaseConfig(
        allowed_actions={ActionType.READ_FILE, ActionType.LIST_DIRECTORY},
        max_duration_seconds=30,
        max_tool_calls=5
    ),
    ProjectPhase.CONTRACTS_DEPLOYING: PhaseConfig(
        allowed_actions={ActionType.DEPLOY_CONTRACT, ActionType.READ_FILE},
        max_duration_seconds=300,
        max_tool_calls=5
    ),
    ProjectPhase.CONTRACTS_DEPLOYED: PhaseConfig(
        allowed_actions={ActionType.READ_FILE, ActionType.CREATE_FILE},
        max_duration_seconds=60,
        max_tool_calls=10
    ),
    ProjectPhase.BUILDING: PhaseConfig(
        allowed_actions={
            ActionType.CREATE_FILE, 
            ActionType.MODIFY_FILE, 
            ActionType.READ_FILE,
            ActionType.LIST_DIRECTORY,
            ActionType.EXECUTE_COMMAND
        },
        max_duration_seconds=600,  # 10 minutes for building
        max_tool_calls=100
    ),
    ProjectPhase.BUILD_COMPLETE: PhaseConfig(
        allowed_actions={ActionType.READ_FILE, ActionType.LIST_DIRECTORY},
        max_duration_seconds=30,
        max_tool_calls=5
    ),
    ProjectPhase.TESTING: PhaseConfig(
        allowed_actions={ActionType.TEST_BUILD, ActionType.EXECUTE_COMMAND, ActionType.READ_FILE},
        max_duration_seconds=120,
        max_tool_calls=10
    ),
    ProjectPhase.VERIFIED: PhaseConfig(
        allowed_actions={ActionType.SAVE_CONTEXT, ActionType.READ_FILE},
        max_duration_seconds=60,
        max_tool_calls=5,
        auto_transition_to=ProjectPhase.COMPLETE
    ),
    ProjectPhase.COMPLETE: PhaseConfig(
        allowed_actions={ActionType.READ_FILE},  # Minimal actions only
        max_duration_seconds=30,
        max_tool_calls=3
    ),
    ProjectPhase.ERROR: PhaseConfig(
        allowed_actions={
            ActionType.READ_FILE, 
            ActionType.MODIFY_FILE,
            ActionType.EXECUTE_COMMAND
        },
        max_duration_seconds=180,
        max_tool_calls=20
    ),
    ProjectPhase.FAILED: PhaseConfig(
        allowed_actions=set(),  # No actions allowed
        max_duration_seconds=0,
        max_tool_calls=0
    )
}


@dataclass
class PhaseMetrics:
    """Metrics for a single phase"""
    phase: ProjectPhase
    started_at: float
    ended_at: Optional[float] = None
    tool_calls: int = 0
    actions: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


@dataclass
class ProjectState:
    """Complete state of a project"""
    project_id: str
    current_phase: ProjectPhase = ProjectPhase.INITIALIZING
    is_web3_project: bool = False
    
    # Phase history
    phase_history: List[PhaseMetrics] = field(default_factory=list)
    current_phase_metrics: Optional[PhaseMetrics] = None
    
    # Completion tracking
    files_created: Set[str] = field(default_factory=set)
    files_read: Set[str] = field(default_factory=set)
    dependencies_installed: Set[str] = field(default_factory=set)
    contracts_deployed: Dict[str, str] = field(default_factory=dict)  # name -> address
    
    # Termination tracking
    total_tool_calls: int = 0
    total_errors: int = 0
    started_at: float = field(default_factory=time.time)
    
    # Loop detection
    recent_actions: List[str] = field(default_factory=list)
    repeated_action_count: int = 0


class ProjectStateMachine:
    """
    State machine that manages project lifecycle and prevents loops.
    """
    
    def __init__(self, project_id: str):
        self.state = ProjectState(project_id=project_id)
        self._start_phase(ProjectPhase.INITIALIZING)
    
    @property
    def current_phase(self) -> ProjectPhase:
        return self.state.current_phase
    
    @property
    def is_complete(self) -> bool:
        return self.state.current_phase == ProjectPhase.COMPLETE
    
    @property
    def is_failed(self) -> bool:
        return self.state.current_phase == ProjectPhase.FAILED
    
    @property
    def can_continue(self) -> bool:
        """Check if the agent should continue working"""
        if self.is_complete or self.is_failed:
            return False
        
        # Check tool call budget
        if self.state.total_tool_calls >= 150:  # Global limit
            logger.warning(f"Tool call budget exceeded: {self.state.total_tool_calls}")
            return False
        
        # Check phase limits
        if self.state.current_phase_metrics:
            config = PHASE_CONFIGS[self.state.current_phase]
            if self.state.current_phase_metrics.tool_calls >= config.max_tool_calls:
                logger.warning(f"Phase tool call limit reached: {self.state.current_phase}")
                return False
            
            # Check phase duration
            elapsed = time.time() - self.state.current_phase_metrics.started_at
            if elapsed > config.max_duration_seconds:
                logger.warning(f"Phase duration exceeded: {self.state.current_phase}")
                return False
        
        # Check for loops
        if self.state.repeated_action_count >= 5:
            logger.warning("Loop detected - same action repeated 5+ times")
            return False
        
        return True
    
    def _start_phase(self, phase: ProjectPhase):
        """Start a new phase"""
        # End current phase if exists
        if self.state.current_phase_metrics:
            self.state.current_phase_metrics.ended_at = time.time()
            self.state.phase_history.append(self.state.current_phase_metrics)
        
        # Start new phase
        self.state.current_phase = phase
        self.state.current_phase_metrics = PhaseMetrics(
            phase=phase,
            started_at=time.time()
        )
        
        logger.info(f"Project {self.state.project_id}: Entered phase {phase.name}")
    
    def can_perform_action(self, action: ActionType) -> tuple[bool, str]:
        """
        Check if an action is allowed in the current phase.
        
        Returns:
            Tuple of (allowed, reason)
        """
        if not self.can_continue:
            return False, "Project has reached termination condition"
        
        config = PHASE_CONFIGS[self.state.current_phase]
        
        if action not in config.allowed_actions:
            return False, f"Action {action.value} not allowed in phase {self.state.current_phase.name}"
        
        return True, "Action allowed"
    
    def record_action(self, action: ActionType, details: Dict[str, Any] = None):
        """Record an action taken by the agent"""
        self.state.total_tool_calls += 1
        
        if self.state.current_phase_metrics:
            self.state.current_phase_metrics.tool_calls += 1
            self.state.current_phase_metrics.actions.append({
                "action": action.value,
                "details": details or {},
                "timestamp": time.time()
            })
        
        # Loop detection
        action_sig = f"{action.value}:{json.dumps(details or {}, sort_keys=True)}"
        
        if self.state.recent_actions and self.state.recent_actions[-1] == action_sig:
            self.state.repeated_action_count += 1
        else:
            self.state.repeated_action_count = 0
        
        self.state.recent_actions.append(action_sig)
        if len(self.state.recent_actions) > 10:
            self.state.recent_actions.pop(0)
        
        # Track specific actions
        if action == ActionType.CREATE_FILE and details and "file_path" in details:
            self.state.files_created.add(details["file_path"])
        elif action == ActionType.READ_FILE and details and "file_path" in details:
            self.state.files_read.add(details["file_path"])
        elif action == ActionType.NPM_INSTALL and details and "packages" in details:
            self.state.dependencies_installed.update(details["packages"])
        elif action == ActionType.DEPLOY_CONTRACT and details:
            if "name" in details and "address" in details:
                self.state.contracts_deployed[details["name"]] = details["address"]
    
    def record_error(self, error: str):
        """Record an error"""
        self.state.total_errors += 1
        if self.state.current_phase_metrics:
            self.state.current_phase_metrics.errors.append(error)
    
    def transition_to(self, new_phase: ProjectPhase) -> bool:
        """
        Attempt to transition to a new phase.
        
        Returns:
            True if transition successful, False otherwise
        """
        current = self.state.current_phase
        
        # Define valid transitions
        valid_transitions = {
            ProjectPhase.INITIALIZING: {ProjectPhase.ANALYZING, ProjectPhase.ERROR},
            ProjectPhase.ANALYZING: {ProjectPhase.PLANNING, ProjectPhase.DEPENDENCIES_INSTALLING, ProjectPhase.ERROR},
            ProjectPhase.PLANNING: {ProjectPhase.DEPENDENCIES_INSTALLING, ProjectPhase.BUILDING, ProjectPhase.ERROR},
            ProjectPhase.DEPENDENCIES_INSTALLING: {ProjectPhase.DEPENDENCIES_COMPLETE, ProjectPhase.ERROR},
            ProjectPhase.DEPENDENCIES_COMPLETE: {ProjectPhase.CONTRACTS_DEPLOYING, ProjectPhase.BUILDING},
            ProjectPhase.CONTRACTS_DEPLOYING: {ProjectPhase.CONTRACTS_DEPLOYED, ProjectPhase.ERROR},
            ProjectPhase.CONTRACTS_DEPLOYED: {ProjectPhase.BUILDING},
            ProjectPhase.BUILDING: {ProjectPhase.BUILD_COMPLETE, ProjectPhase.TESTING, ProjectPhase.ERROR},
            ProjectPhase.BUILD_COMPLETE: {ProjectPhase.TESTING, ProjectPhase.VERIFIED},
            ProjectPhase.TESTING: {ProjectPhase.VERIFIED, ProjectPhase.BUILDING, ProjectPhase.ERROR},
            ProjectPhase.VERIFIED: {ProjectPhase.COMPLETE},
            ProjectPhase.ERROR: {ProjectPhase.BUILDING, ProjectPhase.FAILED},
            ProjectPhase.COMPLETE: set(),  # No transitions from COMPLETE
            ProjectPhase.FAILED: set(),    # No transitions from FAILED
        }
        
        if new_phase not in valid_transitions.get(current, set()):
            logger.warning(
                f"Invalid transition: {current.name} -> {new_phase.name}"
            )
            return False
        
        self._start_phase(new_phase)
        return True
    
    def mark_web3_project(self):
        """Mark this as a Web3 project"""
        self.state.is_web3_project = True
    
    def should_skip_contracts(self) -> bool:
        """Check if contract deployment should be skipped"""
        if not self.state.is_web3_project:
            return True
        # Already deployed
        if self.state.contracts_deployed:
            return True
        return False
    
    def get_status_summary(self) -> Dict[str, Any]:
        """Get a summary of current project status"""
        return {
            "project_id": self.state.project_id,
            "current_phase": self.state.current_phase.name,
            "is_web3": self.state.is_web3_project,
            "can_continue": self.can_continue,
            "total_tool_calls": self.state.total_tool_calls,
            "files_created": len(self.state.files_created),
            "files_read": len(self.state.files_read),
            "dependencies_installed": len(self.state.dependencies_installed),
            "contracts_deployed": len(self.state.contracts_deployed),
            "errors": self.state.total_errors,
            "elapsed_seconds": time.time() - self.state.started_at
        }
    
    def get_termination_reason(self) -> Optional[str]:
        """Get the reason why the agent should stop"""
        if self.is_complete:
            return "Project completed successfully"
        
        if self.is_failed:
            return "Project failed with unrecoverable error"
        
        if self.state.total_tool_calls >= 150:
            return f"Tool call budget exceeded ({self.state.total_tool_calls}/150)"
        
        if self.state.repeated_action_count >= 5:
            return "Loop detected - agent repeating same action"
        
        if self.state.current_phase_metrics:
            config = PHASE_CONFIGS[self.state.current_phase]
            if self.state.current_phase_metrics.tool_calls >= config.max_tool_calls:
                return f"Phase tool call limit reached ({config.max_tool_calls})"
            
            elapsed = time.time() - self.state.current_phase_metrics.started_at
            if elapsed > config.max_duration_seconds:
                return f"Phase duration exceeded ({config.max_duration_seconds}s)"
        
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize state to dictionary"""
        return {
            "project_id": self.state.project_id,
            "current_phase": self.state.current_phase.name,
            "is_web3_project": self.state.is_web3_project,
            "files_created": list(self.state.files_created),
            "files_read": list(self.state.files_read),
            "dependencies_installed": list(self.state.dependencies_installed),
            "contracts_deployed": self.state.contracts_deployed,
            "total_tool_calls": self.state.total_tool_calls,
            "total_errors": self.state.total_errors,
            "started_at": self.state.started_at,
            "phase_history": [
                {
                    "phase": pm.phase.name,
                    "started_at": pm.started_at,
                    "ended_at": pm.ended_at,
                    "tool_calls": pm.tool_calls,
                    "errors": pm.errors
                }
                for pm in self.state.phase_history
            ]
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProjectStateMachine":
        """Deserialize state from dictionary"""
        machine = cls(data["project_id"])
        machine.state.current_phase = ProjectPhase[data["current_phase"]]
        machine.state.is_web3_project = data.get("is_web3_project", False)
        machine.state.files_created = set(data.get("files_created", []))
        machine.state.files_read = set(data.get("files_read", []))
        machine.state.dependencies_installed = set(data.get("dependencies_installed", []))
        machine.state.contracts_deployed = data.get("contracts_deployed", {})
        machine.state.total_tool_calls = data.get("total_tool_calls", 0)
        machine.state.total_errors = data.get("total_errors", 0)
        machine.state.started_at = data.get("started_at", time.time())
        return machine


# ============================================================================
# PROJECT STATE MANAGER (Singleton for managing all projects)
# ============================================================================

class ProjectStateManager:
    """Manages state machines for all active projects"""
    
    _instance = None
    _states: Dict[str, ProjectStateMachine] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._states = {}
        return cls._instance
    
    def get_or_create(self, project_id: str) -> ProjectStateMachine:
        """Get existing state machine or create new one"""
        if project_id not in self._states:
            self._states[project_id] = ProjectStateMachine(project_id)
        return self._states[project_id]
    
    def get(self, project_id: str) -> Optional[ProjectStateMachine]:
        """Get state machine for project if exists"""
        return self._states.get(project_id)
    
    def remove(self, project_id: str):
        """Remove state machine for project"""
        if project_id in self._states:
            del self._states[project_id]
    
    def get_all_active(self) -> List[str]:
        """Get all active project IDs"""
        return [
            pid for pid, sm in self._states.items() 
            if sm.can_continue
        ]


# Global instance
project_state_manager = ProjectStateManager()
