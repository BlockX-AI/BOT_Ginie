"""
Project Modes System
=====================
Handles different project complexity levels to optimize AI behavior.
Modes: Simple App, Complex App, Web3 Game

From handwritten notes:
- "We can add modes like Simple app, Complex app, Web3 game 
   to handle lighter projects efficiently"
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class ProjectMode(Enum):
    """Project complexity modes"""
    SIMPLE = "simple"           # Todo apps, calculators, single-page apps
    STANDARD = "standard"       # Multi-page apps, dashboards
    COMPLEX = "complex"         # Full SaaS, e-commerce, large apps
    WEB3_GAME = "web3_game"     # Blockchain games with smart contracts
    WEB3_DAPP = "web3_dapp"     # DApps, DeFi, NFT platforms


@dataclass
class ModeConfig:
    """Configuration for a project mode"""
    mode: ProjectMode
    description: str
    max_files: int
    max_components: int
    max_pages: int
    tool_call_budget: int
    recommended_libraries: List[str]
    required_sections: List[str]
    optional_sections: List[str]
    complexity_keywords: List[str]
    guardrails: Dict[str, Any] = field(default_factory=dict)


# ============================================================================
# MODE CONFIGURATIONS
# ============================================================================

MODE_CONFIGS: Dict[ProjectMode, ModeConfig] = {
    ProjectMode.SIMPLE: ModeConfig(
        mode=ProjectMode.SIMPLE,
        description="Simple single-purpose applications",
        max_files=10,
        max_components=5,
        max_pages=1,
        tool_call_budget=50,
        recommended_libraries=[
            "react",
            "tailwindcss",
            "lucide-react",
        ],
        required_sections=["main_component"],
        optional_sections=["header"],
        complexity_keywords=[
            "todo", "calculator", "counter", "timer", "clock",
            "simple", "basic", "minimal", "quick", "small",
            "converter", "generator", "quiz", "flashcard"
        ],
        guardrails={
            "no_router": True,
            "single_page": True,
            "inline_styles_ok": True,
            "skip_tests": True,
        }
    ),
    
    ProjectMode.STANDARD: ModeConfig(
        mode=ProjectMode.STANDARD,
        description="Standard multi-page applications",
        max_files=30,
        max_components=15,
        max_pages=5,
        tool_call_budget=100,
        recommended_libraries=[
            "react",
            "react-router-dom",
            "tailwindcss",
            "framer-motion",
            "lucide-react",
            "sonner",
        ],
        required_sections=["navbar", "hero", "main_content", "footer"],
        optional_sections=["features", "testimonials", "cta", "faq"],
        complexity_keywords=[
            "website", "landing", "portfolio", "blog", "dashboard",
            "multi-page", "pages", "navigation", "routes"
        ],
        guardrails={
            "require_router": True,
            "component_separation": True,
            "proper_folder_structure": True,
        }
    ),
    
    ProjectMode.COMPLEX: ModeConfig(
        mode=ProjectMode.COMPLEX,
        description="Complex full-featured applications",
        max_files=60,
        max_components=30,
        max_pages=15,
        tool_call_budget=150,
        recommended_libraries=[
            "react",
            "react-router-dom",
            "tailwindcss",
            "framer-motion",
            "lucide-react",
            "@tanstack/react-query",
            "zustand",
            "react-hook-form",
            "zod",
            "sonner",
            "recharts",
        ],
        required_sections=["navbar", "hero", "features", "main_content", "footer"],
        optional_sections=["pricing", "testimonials", "faq", "team", "stats", "cta"],
        complexity_keywords=[
            "saas", "platform", "marketplace", "ecommerce", "e-commerce",
            "admin", "management", "enterprise", "full-stack", "complex",
            "authentication", "payments", "subscriptions", "analytics"
        ],
        guardrails={
            "require_router": True,
            "require_state_management": True,
            "require_form_validation": True,
            "require_error_boundaries": True,
            "require_loading_states": True,
        }
    ),
    
    ProjectMode.WEB3_GAME: ModeConfig(
        mode=ProjectMode.WEB3_GAME,
        description="Blockchain-based games with smart contracts",
        max_files=40,
        max_components=20,
        max_pages=5,
        tool_call_budget=120,
        recommended_libraries=[
            "react",
            "react-router-dom",
            "tailwindcss",
            "framer-motion",
            "lucide-react",
            "wagmi",
            "viem",
            "@rainbow-me/rainbowkit",
            "@tanstack/react-query",
            "sonner",
        ],
        required_sections=["wallet_connect", "game_board", "game_stats"],
        optional_sections=["leaderboard", "history", "rules"],
        complexity_keywords=[
            "game", "tic-tac-toe", "coin flip", "betting", "gambling",
            "nft game", "on-chain", "blockchain game", "play to earn",
            "web3 game", "smart contract game", "crypto game"
        ],
        guardrails={
            "require_wallet_connection": True,
            "require_contract_integration": True,
            "require_transaction_handling": True,
            "require_network_switching": True,
            "deploy_contract_first": True,
        }
    ),
    
    ProjectMode.WEB3_DAPP: ModeConfig(
        mode=ProjectMode.WEB3_DAPP,
        description="Decentralized applications (DeFi, NFT, DAO)",
        max_files=50,
        max_components=25,
        max_pages=10,
        tool_call_budget=140,
        recommended_libraries=[
            "react",
            "react-router-dom",
            "tailwindcss",
            "framer-motion",
            "lucide-react",
            "wagmi",
            "viem",
            "@rainbow-me/rainbowkit",
            "@tanstack/react-query",
            "sonner",
            "recharts",
            "date-fns",
        ],
        required_sections=["wallet_connect", "main_functionality", "transaction_history"],
        optional_sections=["analytics", "governance", "staking", "swap"],
        complexity_keywords=[
            "dapp", "defi", "nft", "dao", "token", "swap", "staking",
            "yield", "lending", "borrowing", "governance", "voting",
            "minting", "marketplace", "auction", "crowdfunding"
        ],
        guardrails={
            "require_wallet_connection": True,
            "require_contract_integration": True,
            "require_transaction_handling": True,
            "require_network_switching": True,
            "require_token_approvals": True,
            "require_balance_checks": True,
        }
    ),
}


# ============================================================================
# MODE DETECTION
# ============================================================================

def detect_project_mode(prompt: str) -> ProjectMode:
    """
    Detect the appropriate project mode based on user prompt.
    Returns the most specific matching mode.
    """
    prompt_lower = prompt.lower()
    
    # Check Web3 modes first (most specific)
    web3_game_score = sum(1 for kw in MODE_CONFIGS[ProjectMode.WEB3_GAME].complexity_keywords if kw in prompt_lower)
    web3_dapp_score = sum(1 for kw in MODE_CONFIGS[ProjectMode.WEB3_DAPP].complexity_keywords if kw in prompt_lower)
    
    if web3_game_score >= 2:
        return ProjectMode.WEB3_GAME
    if web3_dapp_score >= 2:
        return ProjectMode.WEB3_DAPP
    
    # Check complexity modes
    complex_score = sum(1 for kw in MODE_CONFIGS[ProjectMode.COMPLEX].complexity_keywords if kw in prompt_lower)
    standard_score = sum(1 for kw in MODE_CONFIGS[ProjectMode.STANDARD].complexity_keywords if kw in prompt_lower)
    simple_score = sum(1 for kw in MODE_CONFIGS[ProjectMode.SIMPLE].complexity_keywords if kw in prompt_lower)
    
    # Determine based on scores
    if complex_score >= 2:
        return ProjectMode.COMPLEX
    elif simple_score >= 1 and standard_score == 0:
        return ProjectMode.SIMPLE
    elif standard_score >= 1:
        return ProjectMode.STANDARD
    
    # Default to standard for unclear prompts
    return ProjectMode.STANDARD


def get_mode_config(mode: ProjectMode) -> ModeConfig:
    """Get configuration for a specific mode"""
    return MODE_CONFIGS.get(mode, MODE_CONFIGS[ProjectMode.STANDARD])


# ============================================================================
# MODE-SPECIFIC PROMPTS
# ============================================================================

MODE_PROMPTS: Dict[ProjectMode, str] = {
    ProjectMode.SIMPLE: """
🎯 **SIMPLE APP MODE** - Optimized for quick, single-purpose applications

EFFICIENCY RULES:
- Build everything in ONE file (Home.jsx) unless absolutely necessary
- NO router needed - single page only
- Use inline Tailwind classes directly
- Skip complex state management - useState is enough
- Maximum 5 components, prefer fewer
- Target: Complete in under 50 tool calls

FOCUS ON:
- Clean, functional UI
- Single clear purpose
- Immediate usability
- Minimal dependencies
""",

    ProjectMode.STANDARD: """
🌐 **STANDARD MODE** - Multi-page applications with modern UI

STRUCTURE:
- Use React Router for navigation
- Organize components in folders
- Create reusable components
- Implement proper page layouts

REQUIRED ELEMENTS:
- Responsive navbar with mobile menu
- Hero section with CTA
- Main content sections
- Footer with links

UI/UX:
- Use Framer Motion for animations
- Implement hover states and transitions
- Add loading states where needed
- Ensure mobile responsiveness
""",

    ProjectMode.COMPLEX: """
🚀 **COMPLEX APP MODE** - Full-featured applications

ARCHITECTURE:
- Proper folder structure (components, pages, hooks, utils, services)
- State management with Zustand or React Query
- Form handling with React Hook Form + Zod
- Error boundaries and loading states

REQUIRED:
- Authentication flow (if applicable)
- Data fetching with proper caching
- Form validation
- Toast notifications
- Skeleton loaders
- Proper error handling

PREMIUM UI:
- Use all animation presets
- Implement dark mode
- Add micro-interactions
- Dashboard-quality components
""",

    ProjectMode.WEB3_GAME: """
🎮 **WEB3 GAME MODE** - Blockchain game with smart contract

CRITICAL WORKFLOW:
1. FIRST: Deploy smart contract using deploy_game_contract()
2. SECOND: Save contract info with save_contract_info()
3. THIRD: Build React frontend with game UI
4. FOURTH: Integrate contract with wagmi hooks

REQUIRED COMPONENTS:
- Wallet connection (RainbowKit)
- Game board/interface
- Transaction status display
- Game state from contract
- Win/lose animations

SMART CONTRACT INTEGRATION:
- useReadContract for game state
- useWriteContract for moves
- useWaitForTransactionReceipt for confirmations
- Handle all error states

UI/UX:
- Show wallet connection prominently
- Display transaction pending states
- Animate game moves
- Show gas estimates
""",

    ProjectMode.WEB3_DAPP: """
💎 **WEB3 DAPP MODE** - Decentralized application

ARCHITECTURE:
- Proper Web3 provider setup
- Contract interaction hooks
- Transaction management
- Network handling

REQUIRED:
- Wallet connection with network switching
- Contract read/write operations
- Transaction history
- Balance displays
- Token approvals (if needed)

SECURITY:
- Validate all user inputs
- Check balances before transactions
- Handle failed transactions gracefully
- Show clear error messages

UI/UX:
- Professional DeFi-style interface
- Real-time data updates
- Transaction toast notifications
- Loading states for all async operations
""",
}


def get_mode_prompt(mode: ProjectMode) -> str:
    """Get the mode-specific prompt additions"""
    return MODE_PROMPTS.get(mode, MODE_PROMPTS[ProjectMode.STANDARD])


# ============================================================================
# NON-NEGOTIABLE RULES (Compressed guardrails from notes)
# ============================================================================

NON_NEGOTIABLE_RULES = """
⚠️ NON-NEGOTIABLE RULES (DO NOT SKIP):

1. **COMPLETE THE BUILD** - Never stop until app is functional
2. **NO BROKEN IMPORTS** - Verify every import resolves
3. **JSX FILES ONLY** - Use .jsx for React components, never .js
4. **TAILWIND IMPORT** - index.css must have @import "tailwindcss";
5. **TEST BEFORE DONE** - Run test_build before marking complete
6. **SAVE CONTEXT** - Always call save_context() at the end
"""


# ============================================================================
# FAILURE RECOVERY RULES
# ============================================================================

FAILURE_RECOVERY_RULES = """
🔧 FAILURE RECOVERY (If something goes wrong):

**File Corrupted/Missing:**
- Re-read the file to confirm state
- Recreate with correct content
- Verify with list_directory

**Command Failed:**
- Check error message carefully
- Fix the root cause (not symptoms)
- Retry with corrected approach

**Import Error:**
- Verify file exists at path
- Check export matches import
- Ensure .jsx extension for React files

**Build Failed:**
- Read the error log completely
- Fix syntax errors first
- Check for missing dependencies
- Verify Tailwind config

**npm Install Failed:**
- Check for version conflicts
- Use compatible versions from dependency_resolver
- Try installing packages one at a time
"""


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_recommended_libraries(mode: ProjectMode) -> List[str]:
    """Get recommended libraries for a mode"""
    config = get_mode_config(mode)
    return config.recommended_libraries


def get_tool_budget(mode: ProjectMode) -> int:
    """Get tool call budget for a mode"""
    config = get_mode_config(mode)
    return config.tool_call_budget


def should_use_router(mode: ProjectMode) -> bool:
    """Check if router should be used"""
    config = get_mode_config(mode)
    return config.guardrails.get("require_router", False)


def is_web3_mode(mode: ProjectMode) -> bool:
    """Check if mode requires Web3 setup"""
    return mode in [ProjectMode.WEB3_GAME, ProjectMode.WEB3_DAPP]


def get_complete_mode_context(prompt: str) -> Dict[str, Any]:
    """Get complete context for detected mode"""
    mode = detect_project_mode(prompt)
    config = get_mode_config(mode)
    
    return {
        "mode": mode.value,
        "config": {
            "max_files": config.max_files,
            "max_components": config.max_components,
            "max_pages": config.max_pages,
            "tool_call_budget": config.tool_call_budget,
        },
        "libraries": config.recommended_libraries,
        "required_sections": config.required_sections,
        "guardrails": config.guardrails,
        "mode_prompt": get_mode_prompt(mode),
        "is_web3": is_web3_mode(mode),
        "use_router": should_use_router(mode),
    }


# Export all
__all__ = [
    'ProjectMode',
    'ModeConfig',
    'MODE_CONFIGS',
    'detect_project_mode',
    'get_mode_config',
    'get_mode_prompt',
    'get_recommended_libraries',
    'get_tool_budget',
    'should_use_router',
    'is_web3_mode',
    'get_complete_mode_context',
    'NON_NEGOTIABLE_RULES',
    'FAILURE_RECOVERY_RULES',
]
