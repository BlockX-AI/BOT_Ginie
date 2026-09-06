"""
Tool Call Budget & Efficiency System
=====================================
Tracks tool usage, enforces budgets, detects inefficiencies,
and provides recommendations for optimizing agent behavior.
"""

import time
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import logging
import json

logger = logging.getLogger(__name__)


class ToolCategory(Enum):
    """Categories of tools for budget allocation"""
    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    COMMAND_EXEC = "command_exec"
    NPM_INSTALL = "npm_install"
    CONTRACT_DEPLOY = "contract_deploy"
    CONTEXT_SAVE = "context_save"
    BUILD_TEST = "build_test"
    OTHER = "other"


# Tool name to category mapping
TOOL_CATEGORIES: Dict[str, ToolCategory] = {
    "read_file": ToolCategory.FILE_READ,
    "list_directory": ToolCategory.FILE_READ,
    "get_context": ToolCategory.FILE_READ,
    "create_file": ToolCategory.FILE_WRITE,
    "write_multiple_files": ToolCategory.FILE_WRITE,
    "delete_file": ToolCategory.FILE_WRITE,
    "execute_command": ToolCategory.COMMAND_EXEC,
    "npm_install": ToolCategory.NPM_INSTALL,
    "deploy_game_contract": ToolCategory.CONTRACT_DEPLOY,
    "deploy_smart_contract": ToolCategory.CONTRACT_DEPLOY,
    "save_context": ToolCategory.CONTEXT_SAVE,
    "test_build": ToolCategory.BUILD_TEST,
}


@dataclass
class ToolCallRecord:
    """Record of a single tool call"""
    tool_name: str
    category: ToolCategory
    timestamp: float
    duration_ms: Optional[float] = None
    success: bool = True
    error: Optional[str] = None
    args_hash: Optional[str] = None  # For duplicate detection
    result_size: int = 0


@dataclass
class BudgetConfig:
    """Budget configuration for a project"""
    # Global limits
    max_total_calls: int = 150
    max_duration_seconds: int = 900  # 15 minutes
    
    # Per-category limits
    category_limits: Dict[ToolCategory, int] = field(default_factory=lambda: {
        ToolCategory.FILE_READ: 50,
        ToolCategory.FILE_WRITE: 80,
        ToolCategory.COMMAND_EXEC: 30,
        ToolCategory.NPM_INSTALL: 10,
        ToolCategory.CONTRACT_DEPLOY: 5,
        ToolCategory.CONTEXT_SAVE: 5,
        ToolCategory.BUILD_TEST: 10,
        ToolCategory.OTHER: 20,
    })
    
    # Efficiency thresholds
    duplicate_threshold: int = 3  # Max times same call can repeat
    idle_threshold_seconds: float = 30.0  # Max time between calls


@dataclass
class EfficiencyMetrics:
    """Metrics for evaluating agent efficiency"""
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    duplicate_calls: int = 0
    
    total_duration_ms: float = 0
    avg_call_duration_ms: float = 0
    
    files_created: int = 0
    files_read: int = 0
    commands_executed: int = 0
    
    # Efficiency score (0-100)
    efficiency_score: float = 100.0
    
    # Issues detected
    issues: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


class ToolCallBudget:
    """
    Manages tool call budgets and tracks efficiency.
    """
    
    def __init__(self, project_id: str, config: Optional[BudgetConfig] = None):
        self.project_id = project_id
        self.config = config or BudgetConfig()
        
        # Tracking
        self.calls: List[ToolCallRecord] = []
        self.category_counts: Dict[ToolCategory, int] = defaultdict(int)
        self.call_hashes: Dict[str, int] = defaultdict(int)  # hash -> count
        
        # Timing
        self.started_at = time.time()
        self.last_call_at = time.time()
        
        # Warnings issued
        self.warnings_issued: List[str] = []
    
    @property
    def total_calls(self) -> int:
        return len(self.calls)
    
    @property
    def elapsed_seconds(self) -> float:
        return time.time() - self.started_at
    
    @property
    def budget_remaining(self) -> int:
        return max(0, self.config.max_total_calls - self.total_calls)
    
    @property
    def time_remaining(self) -> float:
        return max(0, self.config.max_duration_seconds - self.elapsed_seconds)
    
    def can_make_call(self, tool_name: str) -> tuple[bool, str]:
        """
        Check if a tool call is allowed within budget.
        
        Returns:
            Tuple of (allowed, reason)
        """
        # Check total budget
        if self.total_calls >= self.config.max_total_calls:
            return False, f"Total tool call budget exceeded ({self.total_calls}/{self.config.max_total_calls})"
        
        # Check time budget
        if self.elapsed_seconds >= self.config.max_duration_seconds:
            return False, f"Time budget exceeded ({self.elapsed_seconds:.0f}s/{self.config.max_duration_seconds}s)"
        
        # Check category budget
        category = TOOL_CATEGORIES.get(tool_name, ToolCategory.OTHER)
        category_limit = self.config.category_limits.get(category, 20)
        category_count = self.category_counts[category]
        
        if category_count >= category_limit:
            return False, f"Category budget exceeded for {category.value} ({category_count}/{category_limit})"
        
        return True, "Call allowed"
    
    def _compute_args_hash(self, tool_name: str, args: Dict[str, Any]) -> str:
        """Compute hash of tool call for duplicate detection"""
        # Simplified hash based on tool name and key arguments
        key_parts = [tool_name]
        
        if "file_path" in args:
            key_parts.append(str(args["file_path"]))
        if "path" in args:
            key_parts.append(str(args["path"]))
        if "command" in args:
            key_parts.append(str(args["command"])[:50])  # First 50 chars
        
        return ":".join(key_parts)
    
    def record_call(
        self,
        tool_name: str,
        args: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error: Optional[str] = None,
        duration_ms: Optional[float] = None,
        result_size: int = 0
    ) -> Optional[str]:
        """
        Record a tool call and check for issues.
        
        Returns:
            Warning message if issues detected, None otherwise
        """
        category = TOOL_CATEGORIES.get(tool_name, ToolCategory.OTHER)
        args_hash = self._compute_args_hash(tool_name, args or {})
        
        # Check for duplicates
        self.call_hashes[args_hash] += 1
        is_duplicate = self.call_hashes[args_hash] > 1
        
        record = ToolCallRecord(
            tool_name=tool_name,
            category=category,
            timestamp=time.time(),
            duration_ms=duration_ms,
            success=success,
            error=error,
            args_hash=args_hash,
            result_size=result_size
        )
        
        self.calls.append(record)
        self.category_counts[category] += 1
        self.last_call_at = time.time()
        
        # Check for issues
        warning = None
        
        # Duplicate detection
        if self.call_hashes[args_hash] >= self.config.duplicate_threshold:
            warning = f"⚠️ Duplicate call detected: {tool_name} called {self.call_hashes[args_hash]} times with same args"
            if warning not in self.warnings_issued:
                self.warnings_issued.append(warning)
                logger.warning(warning)
        
        # Budget warnings
        remaining_pct = (self.budget_remaining / self.config.max_total_calls) * 100
        if remaining_pct <= 20 and "budget_20" not in self.warnings_issued:
            warning = f"⚠️ Tool call budget at {remaining_pct:.0f}% ({self.budget_remaining} calls remaining)"
            self.warnings_issued.append("budget_20")
            logger.warning(warning)
        elif remaining_pct <= 10 and "budget_10" not in self.warnings_issued:
            warning = f"🚨 Tool call budget critical: {self.budget_remaining} calls remaining"
            self.warnings_issued.append("budget_10")
            logger.warning(warning)
        
        return warning
    
    def get_metrics(self) -> EfficiencyMetrics:
        """Calculate efficiency metrics"""
        metrics = EfficiencyMetrics()
        
        metrics.total_calls = self.total_calls
        metrics.successful_calls = sum(1 for c in self.calls if c.success)
        metrics.failed_calls = sum(1 for c in self.calls if not c.success)
        metrics.duplicate_calls = sum(1 for count in self.call_hashes.values() if count > 1)
        
        # Duration metrics
        durations = [c.duration_ms for c in self.calls if c.duration_ms]
        if durations:
            metrics.total_duration_ms = sum(durations)
            metrics.avg_call_duration_ms = metrics.total_duration_ms / len(durations)
        
        # Category metrics
        metrics.files_created = self.category_counts[ToolCategory.FILE_WRITE]
        metrics.files_read = self.category_counts[ToolCategory.FILE_READ]
        metrics.commands_executed = self.category_counts[ToolCategory.COMMAND_EXEC]
        
        # Calculate efficiency score
        score = 100.0
        
        # Penalize duplicates
        duplicate_ratio = metrics.duplicate_calls / max(1, metrics.total_calls)
        score -= duplicate_ratio * 30  # Up to -30 for duplicates
        
        # Penalize failures
        failure_ratio = metrics.failed_calls / max(1, metrics.total_calls)
        score -= failure_ratio * 20  # Up to -20 for failures
        
        # Penalize excessive reads vs writes (too much reading, not enough doing)
        if metrics.files_read > 0 and metrics.files_created > 0:
            read_write_ratio = metrics.files_read / metrics.files_created
            if read_write_ratio > 3:  # Reading 3x more than writing
                score -= min(20, (read_write_ratio - 3) * 5)
        
        metrics.efficiency_score = max(0, min(100, score))
        
        # Generate issues and recommendations
        if duplicate_ratio > 0.1:
            metrics.issues.append(f"High duplicate call rate: {duplicate_ratio*100:.1f}%")
            metrics.recommendations.append("Use write_multiple_files to batch file operations")
        
        if failure_ratio > 0.2:
            metrics.issues.append(f"High failure rate: {failure_ratio*100:.1f}%")
            metrics.recommendations.append("Check tool arguments and error handling")
        
        if self.category_counts[ToolCategory.NPM_INSTALL] > 5:
            metrics.issues.append(f"Excessive npm install calls: {self.category_counts[ToolCategory.NPM_INSTALL]}")
            metrics.recommendations.append("Batch npm installs into single command")
        
        if self.category_counts[ToolCategory.CONTRACT_DEPLOY] > 2:
            metrics.issues.append(f"Multiple contract deployments: {self.category_counts[ToolCategory.CONTRACT_DEPLOY]}")
            metrics.recommendations.append("Use contract registry to avoid duplicate deployments")
        
        return metrics
    
    def get_summary(self) -> Dict[str, Any]:
        """Get budget summary"""
        metrics = self.get_metrics()
        
        return {
            "project_id": self.project_id,
            "total_calls": self.total_calls,
            "budget_remaining": self.budget_remaining,
            "time_elapsed_seconds": self.elapsed_seconds,
            "time_remaining_seconds": self.time_remaining,
            "efficiency_score": metrics.efficiency_score,
            "category_breakdown": {
                cat.value: count 
                for cat, count in self.category_counts.items()
            },
            "issues": metrics.issues,
            "recommendations": metrics.recommendations,
            "warnings_issued": len(self.warnings_issued)
        }
    
    def get_optimization_hints(self) -> List[str]:
        """Get hints for optimizing tool usage"""
        hints = []
        
        # Check for batching opportunities
        read_calls = [c for c in self.calls if c.category == ToolCategory.FILE_READ]
        if len(read_calls) > 10:
            hints.append(
                f"📚 {len(read_calls)} file reads detected. Consider reading files in batches."
            )
        
        write_calls = [c for c in self.calls if c.category == ToolCategory.FILE_WRITE]
        if len(write_calls) > 5:
            single_writes = sum(1 for c in write_calls if c.tool_name == "create_file")
            if single_writes > 3:
                hints.append(
                    f"📝 {single_writes} individual file creates. Use write_multiple_files for efficiency."
                )
        
        # Check for repeated patterns
        for args_hash, count in self.call_hashes.items():
            if count >= 3:
                tool_name = args_hash.split(":")[0]
                hints.append(
                    f"🔄 {tool_name} called {count} times with same arguments. Possible loop detected."
                )
        
        return hints


# ============================================================================
# BUDGET MANAGER (Singleton)
# ============================================================================

class BudgetManager:
    """Manages budgets for all active projects"""
    
    _instance = None
    _budgets: Dict[str, ToolCallBudget] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._budgets = {}
        return cls._instance
    
    def get_or_create(
        self, 
        project_id: str, 
        config: Optional[BudgetConfig] = None
    ) -> ToolCallBudget:
        """Get existing budget or create new one"""
        if project_id not in self._budgets:
            self._budgets[project_id] = ToolCallBudget(project_id, config)
        return self._budgets[project_id]
    
    def get(self, project_id: str) -> Optional[ToolCallBudget]:
        """Get budget for project if exists"""
        return self._budgets.get(project_id)
    
    def remove(self, project_id: str):
        """Remove budget tracker for project"""
        if project_id in self._budgets:
            del self._budgets[project_id]
    
    def get_all_summaries(self) -> List[Dict[str, Any]]:
        """Get summaries for all active budgets"""
        return [budget.get_summary() for budget in self._budgets.values()]


# Global instance
budget_manager = BudgetManager()


# ============================================================================
# DECORATOR FOR TOOL CALL TRACKING
# ============================================================================

def track_tool_call(tool_name: str):
    """
    Decorator to automatically track tool calls.
    
    Usage:
        @track_tool_call("create_file")
        async def create_file(file_path: str, content: str):
            ...
    """
    def decorator(func: Callable):
        async def wrapper(*args, project_id: str = None, **kwargs):
            if not project_id:
                # Try to get from args or kwargs
                project_id = kwargs.get("project_id") or "unknown"
            
            budget = budget_manager.get_or_create(project_id)
            
            # Check if call is allowed
            allowed, reason = budget.can_make_call(tool_name)
            if not allowed:
                raise BudgetExceededException(reason)
            
            # Execute and track
            start_time = time.time()
            success = True
            error = None
            result = None
            
            try:
                result = await func(*args, **kwargs)
            except Exception as e:
                success = False
                error = str(e)
                raise
            finally:
                duration_ms = (time.time() - start_time) * 1000
                warning = budget.record_call(
                    tool_name=tool_name,
                    args=kwargs,
                    success=success,
                    error=error,
                    duration_ms=duration_ms
                )
                
                if warning:
                    logger.warning(f"[{project_id}] {warning}")
            
            return result
        
        return wrapper
    return decorator


class BudgetExceededException(Exception):
    """Raised when tool call budget is exceeded"""
    pass


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_recommended_budget(project_type: str) -> BudgetConfig:
    """Get recommended budget config for project type"""
    
    if project_type == "web3_game":
        return BudgetConfig(
            max_total_calls=180,
            max_duration_seconds=1200,  # 20 minutes
            category_limits={
                ToolCategory.FILE_READ: 60,
                ToolCategory.FILE_WRITE: 100,
                ToolCategory.COMMAND_EXEC: 40,
                ToolCategory.NPM_INSTALL: 15,
                ToolCategory.CONTRACT_DEPLOY: 5,
                ToolCategory.CONTEXT_SAVE: 5,
                ToolCategory.BUILD_TEST: 15,
                ToolCategory.OTHER: 25,
            }
        )
    
    elif project_type == "simple_app":
        return BudgetConfig(
            max_total_calls=80,
            max_duration_seconds=600,  # 10 minutes
            category_limits={
                ToolCategory.FILE_READ: 30,
                ToolCategory.FILE_WRITE: 40,
                ToolCategory.COMMAND_EXEC: 15,
                ToolCategory.NPM_INSTALL: 5,
                ToolCategory.CONTRACT_DEPLOY: 0,
                ToolCategory.CONTEXT_SAVE: 3,
                ToolCategory.BUILD_TEST: 5,
                ToolCategory.OTHER: 10,
            }
        )
    
    # Default config
    return BudgetConfig()


def format_budget_report(budget: ToolCallBudget) -> str:
    """Format a human-readable budget report"""
    summary = budget.get_summary()
    metrics = budget.get_metrics()
    hints = budget.get_optimization_hints()
    
    report = f"""
╔══════════════════════════════════════════════════════════════╗
║               TOOL CALL BUDGET REPORT                        ║
╠══════════════════════════════════════════════════════════════╣
║ Project: {summary['project_id'][:40]:<40} ║
╠══════════════════════════════════════════════════════════════╣
║ USAGE SUMMARY                                                ║
║ ─────────────────────────────────────────────────────────── ║
║ Total Calls:     {summary['total_calls']:>5} / {budget.config.max_total_calls:<5} ({summary['budget_remaining']} remaining)  ║
║ Time Elapsed:    {summary['time_elapsed_seconds']:>5.0f}s / {budget.config.max_duration_seconds}s                        ║
║ Efficiency:      {metrics.efficiency_score:>5.1f}%                                      ║
╠══════════════════════════════════════════════════════════════╣
║ CATEGORY BREAKDOWN                                           ║
║ ─────────────────────────────────────────────────────────── ║"""
    
    for cat, count in summary['category_breakdown'].items():
        if count > 0:
            limit = budget.config.category_limits.get(ToolCategory(cat), 20)
            report += f"\n║ {cat:<20}: {count:>3} / {limit:<3}                              ║"
    
    if metrics.issues:
        report += """
╠══════════════════════════════════════════════════════════════╣
║ ⚠️  ISSUES DETECTED                                          ║
║ ─────────────────────────────────────────────────────────── ║"""
        for issue in metrics.issues:
            report += f"\n║ • {issue[:55]:<55} ║"
    
    if hints:
        report += """
╠══════════════════════════════════════════════════════════════╣
║ 💡 OPTIMIZATION HINTS                                        ║
║ ─────────────────────────────────────────────────────────── ║"""
        for hint in hints[:3]:
            report += f"\n║ {hint[:58]:<58} ║"
    
    report += """
╚══════════════════════════════════════════════════════════════╝"""
    
    return report
