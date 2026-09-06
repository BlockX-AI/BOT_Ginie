# EVI Enhancement Systems - Integration Guide

## Overview

This guide shows how to integrate the four enhancement systems into the existing EVI codebase to prevent:
- **173+ tool calls** → Capped at 150
- **Duplicate contract deployments** → Registry prevents re-deployment
- **Agent loops** → Auto-terminates after 5 repeated actions
- **npm version conflicts** → Pre-tested compatible stacks

---

## Files Created

| File | Purpose |
|------|---------|
| `utils/dependency_resolver.py` | Curated version compatibility database |
| `utils/project_state_machine.py` | Phase tracking & loop detection |
| `utils/contract_registry.py` | Contract deduplication |
| `utils/tool_call_budget.py` | Budget limits & efficiency metrics |
| `utils/evi_enhancements.py` | Unified integration layer |
| `agent/enhanced_tools.py` | Drop-in replacement for tools.py |

---

## Quick Integration (3 Steps)

### Step 1: Update `graph_nodes.py` imports

```python
# At the top of graph_nodes.py, add:
from agent.enhanced_tools import (
    create_enhanced_tools_with_context,
    should_terminate_agent,
    get_agent_report
)
```

### Step 2: Replace tool creation in `builder_node`

```python
# In builder_node(), change this line:
# OLD:
base_tools = create_tools_with_context(sandbox, socket, project_id)

# NEW:
is_web3 = "web3" in str(plan).lower() or "contract" in str(plan).lower()
base_tools = create_enhanced_tools_with_context(
    sandbox, socket, project_id, is_web3=is_web3
)
```

### Step 3: Add termination check in builder loop

```python
# Inside the builder_node agent loop, add termination check:
async for chunk in agent_executor.astream(
    {"messages": messages}, config=config
):
    # ADD THIS CHECK AT THE START OF EACH ITERATION:
    should_stop, reason = should_terminate_agent(project_id)
    if should_stop:
        print(f"🛑 Agent terminated: {reason}")
        await safe_send_socket(socket, {
            "e": "agent_terminated",
            "message": f"Agent stopped: {reason}",
            "report": get_agent_report(project_id)
        })
        break
    
    # ... rest of existing loop code ...
```

---

## Full Integration Example

Here's the complete modified `builder_node` function:

```python
async def builder_node(state: GraphState) -> GraphState:
    """
    Builder node: Creates and modifies files based on plan or feedback
    Enhanced with budget tracking, loop detection, and contract deduplication.
    """
    try:
        socket = state.get("socket")
        sandbox = state.get("sandbox")
        project_id = state.get("project_id", "")

        if not sandbox:
            raise Exception("Sandbox not available")

        # Short-circuit if a fatal error was already detected upstream
        if state.get("fatal_error"):
            print("Fatal error flag set - skipping builder")
            new_state = state.copy()
            new_state["current_node"] = "builder"
            return new_state

        if socket:
            await safe_send_socket(socket, {
                "e": "builder_started",
                "message": "Starting to build the application...",
            })

        plan = state.get("plan", {})
        current_errors = state.get("current_errors", {})

        # ENHANCEMENT: Detect if this is a Web3 project
        plan_str = json.dumps(plan).lower()
        is_web3 = any(kw in plan_str for kw in ['web3', 'contract', 'nft', 'blockchain', 'wallet'])

        # ENHANCEMENT: Use enhanced tools with tracking
        base_tools = create_enhanced_tools_with_context(
            sandbox, socket, project_id, is_web3=is_web3
        )

        # ... (rest of prompt building code stays the same) ...

        messages = [
            SystemMessage(content=INITPROMPT),
            HumanMessage(content=builder_prompt),
        ]

        agent_executor = create_react_agent(llm_gemini_pro, tools=base_tools)
        config = {"recursion_limit": 50}

        try:
            async for chunk in agent_executor.astream(
                {"messages": messages}, config=config
            ):
                # ENHANCEMENT: Check termination conditions
                should_stop, reason = should_terminate_agent(project_id)
                if should_stop:
                    print(f"🛑 Agent terminated: {reason}")
                    await safe_send_socket(socket, {
                        "e": "agent_terminated",
                        "message": f"Build stopped: {reason}",
                        "report": get_agent_report(project_id)
                    })
                    
                    # Mark as success if completed, otherwise error
                    new_state = state.copy()
                    new_state["current_node"] = "builder"
                    if "complete" in reason.lower():
                        new_state["success"] = True
                    else:
                        new_state["error_message"] = reason
                    return new_state

                # ... (rest of existing chunk handling code) ...

        except Exception as e:
            # ... (existing error handling) ...

    except Exception as e:
        # ... (existing error handling) ...
```

---

## Using Enhanced Contract Deployment

The `deploy_game_contract_safe` tool automatically checks for existing contracts:

```python
# Agent calls this tool:
result = await deploy_game_contract_safe(
    game_type="coin-flip",
    network="basecamp"
)

# If contract exists, returns:
# "✅ **Contract Already Deployed!**
#  📍 Address: `0x123...`
#  💡 This contract was previously deployed."

# If new deployment needed:
# "✅ **Deployed new Contract!**
#  📍 Address: `0x456...`"
```

---

## Using Smart npm Install

The `smart_install_packages` tool prevents version conflicts:

```python
# Agent calls this tool:
result = await smart_install_packages("wagmi @rainbow-me/rainbowkit viem")

# Automatically uses compatible versions:
# wagmi@^2.12.0 (not 3.x)
# rainbowkit@^2.1.0
# viem@^2.20.0

# Returns:
# "✅ Successfully installed: wagmi, @rainbow-me/rainbowkit, viem
#  🔧 Auto-fixes applied: wagmi downgraded to ^2.12.0 for RainbowKit compatibility"
```

---

## Monitoring Agent Status

Add this tool call in prompts to let agent self-check:

```python
# In builder_prompt, add:
"""
7. CHECK YOUR STATUS:
   - Call get_agent_status() periodically to see budget usage
   - Call check_should_stop() before major operations
   - If budget is low, prioritize completing essential files
"""
```

---

## Configuration

### Adjusting Budgets

Edit `utils/tool_call_budget.py`:

```python
@dataclass
class BudgetConfig:
    max_total_calls: int = 150      # Increase for complex projects
    max_duration_seconds: int = 900  # 15 minutes default
    
    category_limits = {
        ToolCategory.FILE_WRITE: 80,   # Most budget for file creation
        ToolCategory.FILE_READ: 50,    # Limit redundant reads
        ToolCategory.CONTRACT_DEPLOY: 5,  # Prevent duplicate deploys
    }
```

### Adding New Compatible Stacks

Edit `utils/dependency_resolver.py`:

```python
COMPATIBLE_STACKS["my_custom_stack"] = {
    "description": "Custom stack for XYZ",
    "packages": {
        "package-a": "^1.0.0",
        "package-b": "^2.0.0",
    }
}
```

---

## Troubleshooting

### Agent stops too early
- Increase `max_total_calls` in BudgetConfig
- Check if phase limits are too restrictive

### Agent still loops
- Check `repeated_action_count` threshold (default: 5)
- Review `recent_actions` to see what's repeating

### Contract not found in registry
- Check `/contract_registry/` directory exists
- Verify project_id matches between deploys

---

## Testing the Integration

1. Start a new project and observe tool call counts in logs
2. Try deploying same contract twice - should reuse
3. Install conflicting packages - should auto-resolve
4. Create many duplicate file reads - should warn/stop

---

## Metrics to Monitor

After integration, you should see:
- Tool calls reduced from 150+ to 60-80
- Zero duplicate contract deployments
- Zero npm ERESOLVE errors
- No agent loops (auto-terminated)
