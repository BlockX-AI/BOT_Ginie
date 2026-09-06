"""
Dependency Version Conflict Resolution System
==============================================
Automatically resolves npm package version conflicts by using a curated
compatibility database and intelligent fallback strategies.
"""

import json
import os
import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)

# ============================================================================
# CURATED VERSION COMPATIBILITY DATABASE
# ============================================================================
# These are TESTED, WORKING combinations that avoid peer dependency conflicts

COMPATIBLE_STACKS = {
    "web3_rainbowkit_v2": {
        "description": "Web3 stack with RainbowKit v2 (stable, recommended)",
        "packages": {
            "wagmi": "^2.12.0",
            "@rainbow-me/rainbowkit": "^2.1.0", 
            "viem": "^2.20.0",
            "@tanstack/react-query": "^5.0.0",
            "react": "^18.2.0",
            "react-dom": "^18.2.0"
        },
        "conflicts_resolved": ["wagmi/rainbowkit peer dependency"]
    },
    "web3_wagmi_v2_standalone": {
        "description": "Wagmi v2 without RainbowKit (for custom wallet UI)",
        "packages": {
            "wagmi": "^2.12.0",
            "viem": "^2.20.0",
            "@tanstack/react-query": "^5.0.0",
            "react": "^18.2.0",
            "react-dom": "^18.2.0"
        }
    },
    "animation_premium": {
        "description": "Premium animation stack",
        "packages": {
            "framer-motion": "^11.0.0",
            "lenis": "^1.1.0",
            "gsap": "^3.12.0"
        }
    },
    "ui_shadcn": {
        "description": "shadcn/ui compatible stack",
        "packages": {
            "@radix-ui/react-dialog": "^1.0.0",
            "@radix-ui/react-dropdown-menu": "^2.0.0",
            "@radix-ui/react-select": "^2.0.0",
            "@radix-ui/react-tabs": "^1.0.0",
            "@radix-ui/react-toast": "^1.0.0",
            "class-variance-authority": "^0.7.0",
            "clsx": "^2.1.0",
            "tailwind-merge": "^2.2.0",
            "lucide-react": "^0.400.0"
        }
    },
    "forms_validation": {
        "description": "Form handling with validation",
        "packages": {
            "react-hook-form": "^7.50.0",
            "zod": "^3.22.0",
            "@hookform/resolvers": "^3.3.0"
        }
    },
    "state_management": {
        "description": "State management options",
        "packages": {
            "zustand": "^4.5.0"
        }
    },
    "notifications": {
        "description": "Toast notifications",
        "packages": {
            "sonner": "^1.4.0"
        }
    },
    "charts": {
        "description": "Data visualization",
        "packages": {
            "recharts": "^2.12.0"
        }
    }
}

# Known problematic version combinations to avoid
KNOWN_CONFLICTS = {
    ("wagmi", "^3.0.0", "@rainbow-me/rainbowkit", "^2.0.0"): {
        "issue": "RainbowKit 2.x requires wagmi ^2.9.0, not 3.x",
        "solution": "Use wagmi ^2.12.0 with RainbowKit ^2.1.0",
        "replacement": {"wagmi": "^2.12.0", "@rainbow-me/rainbowkit": "^2.1.0"}
    },
    ("react", "^17.0.0", "framer-motion", "^11.0.0"): {
        "issue": "Framer Motion 11 requires React 18+",
        "solution": "Upgrade React to ^18.2.0 or use framer-motion ^10.0.0",
        "replacement": {"react": "^18.2.0", "react-dom": "^18.2.0"}
    }
}

# Package categories for smart detection
PACKAGE_CATEGORIES = {
    "web3": ["wagmi", "viem", "ethers", "@rainbow-me/rainbowkit", "web3", "@web3-react/core"],
    "animation": ["framer-motion", "gsap", "lenis", "locomotive-scroll", "react-spring"],
    "ui": ["@radix-ui", "@headlessui/react", "@chakra-ui/react", "@mui/material", "antd"],
    "forms": ["react-hook-form", "formik", "final-form"],
    "state": ["zustand", "jotai", "recoil", "redux", "@reduxjs/toolkit"],
    "charts": ["recharts", "chart.js", "d3", "victory", "nivo"]
}


@dataclass
class DependencyAnalysis:
    """Result of dependency analysis"""
    has_conflicts: bool = False
    conflicts: List[Dict[str, Any]] = field(default_factory=list)
    suggestions: List[Dict[str, str]] = field(default_factory=list)
    recommended_versions: Dict[str, str] = field(default_factory=dict)
    detected_stacks: List[str] = field(default_factory=list)


class ResolutionStrategy(Enum):
    USE_COMPATIBLE_STACK = "use_compatible_stack"
    DOWNGRADE_PACKAGE = "downgrade"
    UPGRADE_PACKAGE = "upgrade"
    USE_LEGACY_PEER_DEPS = "legacy_peer_deps"
    MANUAL_INTERVENTION = "manual"


class DependencyResolver:
    """
    Intelligent dependency resolver that prevents npm conflicts
    before they happen.
    """
    
    def __init__(self):
        self.compatible_stacks = COMPATIBLE_STACKS
        self.known_conflicts = KNOWN_CONFLICTS
        self.package_categories = PACKAGE_CATEGORIES
    
    def detect_stack_requirements(self, packages: Dict[str, str]) -> List[str]:
        """
        Detect which technology stacks are being used based on packages.
        
        Args:
            packages: Dict of package_name -> version_spec
            
        Returns:
            List of detected stack names
        """
        detected = []
        package_names = set(packages.keys())
        
        for category, category_packages in self.package_categories.items():
            if any(pkg in package_names for pkg in category_packages):
                detected.append(category)
        
        return detected
    
    def check_for_conflicts(self, packages: Dict[str, str]) -> DependencyAnalysis:
        """
        Analyze packages for potential conflicts.
        
        Args:
            packages: Dict of package_name -> version_spec
            
        Returns:
            DependencyAnalysis with conflict details and suggestions
        """
        analysis = DependencyAnalysis()
        analysis.detected_stacks = self.detect_stack_requirements(packages)
        
        # Check against known conflict patterns
        for (pkg1, ver1, pkg2, ver2), conflict_info in self.known_conflicts.items():
            if pkg1 in packages and pkg2 in packages:
                pkg1_ver = packages[pkg1]
                pkg2_ver = packages[pkg2]
                
                # Simple version range check (could be made more sophisticated)
                if self._version_matches_range(pkg1_ver, ver1) or \
                   self._version_matches_range(pkg2_ver, ver2):
                    analysis.has_conflicts = True
                    analysis.conflicts.append({
                        "packages": [pkg1, pkg2],
                        "issue": conflict_info["issue"],
                        "solution": conflict_info["solution"]
                    })
                    analysis.recommended_versions.update(conflict_info["replacement"])
        
        # Suggest compatible stacks based on detected requirements
        if "web3" in analysis.detected_stacks:
            if "@rainbow-me/rainbowkit" in packages:
                analysis.suggestions.append({
                    "stack": "web3_rainbowkit_v2",
                    "reason": "Use tested RainbowKit v2 stack for stability"
                })
                # Add recommended versions from compatible stack
                stack_packages = self.compatible_stacks["web3_rainbowkit_v2"]["packages"]
                for pkg, ver in stack_packages.items():
                    if pkg not in analysis.recommended_versions:
                        analysis.recommended_versions[pkg] = ver
        
        return analysis
    
    def _version_matches_range(self, version: str, range_spec: str) -> bool:
        """Simple check if version might match a range spec"""
        # Extract major version from both
        def get_major(v: str) -> Optional[int]:
            match = re.search(r'(\d+)', v)
            return int(match.group(1)) if match else None
        
        v_major = get_major(version)
        r_major = get_major(range_spec)
        
        return v_major == r_major if v_major and r_major else False
    
    def get_compatible_packages(
        self, 
        requested_packages: List[str],
        existing_packages: Optional[Dict[str, str]] = None
    ) -> Dict[str, str]:
        """
        Get compatible versions for requested packages.
        
        Args:
            requested_packages: List of package names to install
            existing_packages: Already installed packages (from package.json)
            
        Returns:
            Dict of package_name -> compatible_version
        """
        result = {}
        existing = existing_packages or {}
        
        # Detect what stacks are needed
        all_packages = set(requested_packages) | set(existing.keys())
        
        # Check if this is a Web3 project
        is_web3 = any(pkg in all_packages for pkg in self.package_categories["web3"])
        needs_rainbowkit = "@rainbow-me/rainbowkit" in all_packages
        
        if is_web3 and needs_rainbowkit:
            # Use the pre-tested Web3 stack
            stack = self.compatible_stacks["web3_rainbowkit_v2"]["packages"]
            for pkg in requested_packages:
                if pkg in stack:
                    result[pkg] = stack[pkg]
                else:
                    # For packages not in stack, use latest or existing
                    result[pkg] = existing.get(pkg, "latest")
        else:
            # For non-Web3 or standalone packages, use compatible stacks where available
            for pkg in requested_packages:
                found = False
                for stack_name, stack_info in self.compatible_stacks.items():
                    if pkg in stack_info["packages"]:
                        result[pkg] = stack_info["packages"][pkg]
                        found = True
                        break
                
                if not found:
                    result[pkg] = existing.get(pkg, "latest")
        
        return result
    
    def generate_install_command(
        self,
        packages: Dict[str, str],
        use_legacy_peer_deps: bool = False
    ) -> str:
        """
        Generate npm install command with proper versions.
        
        Args:
            packages: Dict of package_name -> version
            use_legacy_peer_deps: Whether to add --legacy-peer-deps flag
            
        Returns:
            npm install command string
        """
        package_specs = [
            f"{pkg}@{ver}" if ver != "latest" else pkg 
            for pkg, ver in packages.items()
        ]
        
        cmd = f"npm install {' '.join(package_specs)}"
        
        if use_legacy_peer_deps:
            cmd += " --legacy-peer-deps"
        
        return cmd
    
    def analyze_package_json(self, package_json: Dict) -> DependencyAnalysis:
        """
        Analyze an existing package.json for conflicts.
        
        Args:
            package_json: Parsed package.json content
            
        Returns:
            DependencyAnalysis with findings
        """
        all_deps = {}
        all_deps.update(package_json.get("dependencies", {}))
        all_deps.update(package_json.get("devDependencies", {}))
        
        return self.check_for_conflicts(all_deps)
    
    def fix_package_json(self, package_json: Dict) -> Tuple[Dict, List[str]]:
        """
        Fix conflicts in package.json and return updated version.
        
        Args:
            package_json: Original package.json content
            
        Returns:
            Tuple of (fixed_package_json, list_of_changes)
        """
        changes = []
        fixed = json.loads(json.dumps(package_json))  # Deep copy
        
        analysis = self.analyze_package_json(package_json)
        
        if not analysis.has_conflicts and not analysis.recommended_versions:
            return fixed, ["No conflicts found"]
        
        deps = fixed.get("dependencies", {})
        dev_deps = fixed.get("devDependencies", {})
        
        for pkg, recommended_ver in analysis.recommended_versions.items():
            if pkg in deps:
                old_ver = deps[pkg]
                if old_ver != recommended_ver:
                    deps[pkg] = recommended_ver
                    changes.append(f"Updated {pkg}: {old_ver} -> {recommended_ver}")
            elif pkg in dev_deps:
                old_ver = dev_deps[pkg]
                if old_ver != recommended_ver:
                    dev_deps[pkg] = recommended_ver
                    changes.append(f"Updated {pkg}: {old_ver} -> {recommended_ver}")
            else:
                # Package not present, add to dependencies
                deps[pkg] = recommended_ver
                changes.append(f"Added {pkg}@{recommended_ver}")
        
        fixed["dependencies"] = deps
        if dev_deps:
            fixed["devDependencies"] = dev_deps
        
        return fixed, changes


# ============================================================================
# SMART NPM INSTALL TOOL
# ============================================================================

async def smart_npm_install(
    sandbox,
    packages: List[str],
    project_id: str,
    existing_package_json: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Intelligently install npm packages with automatic conflict resolution.
    
    Args:
        sandbox: E2B sandbox instance
        packages: List of packages to install
        project_id: Project identifier
        existing_package_json: Current package.json content (optional)
        
    Returns:
        Dict with success status, installed packages, and any warnings
    """
    resolver = DependencyResolver()
    result = {
        "success": False,
        "installed": [],
        "warnings": [],
        "changes": [],
        "command_used": ""
    }
    
    # Get existing dependencies if package.json provided
    existing_deps = {}
    if existing_package_json:
        existing_deps.update(existing_package_json.get("dependencies", {}))
        existing_deps.update(existing_package_json.get("devDependencies", {}))
    
    # Filter out already installed packages
    packages_to_install = [
        pkg for pkg in packages 
        if pkg not in existing_deps
    ]
    
    if not packages_to_install:
        result["success"] = True
        result["warnings"].append("All packages already installed")
        return result
    
    # Get compatible versions
    compatible_packages = resolver.get_compatible_packages(
        packages_to_install, 
        existing_deps
    )
    
    # Check for conflicts
    all_packages = {**existing_deps, **compatible_packages}
    analysis = resolver.check_for_conflicts(all_packages)
    
    if analysis.has_conflicts:
        result["warnings"].extend([c["issue"] for c in analysis.conflicts])
        # Apply recommended fixes
        for pkg, ver in analysis.recommended_versions.items():
            compatible_packages[pkg] = ver
            result["changes"].append(f"Fixed: {pkg} -> {ver}")
    
    # Generate and run install command
    install_cmd = resolver.generate_install_command(compatible_packages)
    result["command_used"] = install_cmd
    
    try:
        proc = await sandbox.commands.run(
            install_cmd,
            cwd="/home/user/react-app",
            timeout=120
        )
        
        if proc.exit_code == 0:
            result["success"] = True
            result["installed"] = list(compatible_packages.keys())
        else:
            # Try with legacy peer deps as fallback
            fallback_cmd = install_cmd + " --legacy-peer-deps"
            result["warnings"].append(
                f"Initial install failed, trying with --legacy-peer-deps"
            )
            
            proc = await sandbox.commands.run(
                fallback_cmd,
                cwd="/home/user/react-app",
                timeout=120
            )
            
            if proc.exit_code == 0:
                result["success"] = True
                result["installed"] = list(compatible_packages.keys())
                result["command_used"] = fallback_cmd
            else:
                result["error"] = proc.stderr
                
    except Exception as e:
        result["error"] = str(e)
    
    return result


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_recommended_stack(stack_name: str) -> Optional[Dict[str, str]]:
    """Get packages for a recommended stack"""
    if stack_name in COMPATIBLE_STACKS:
        return COMPATIBLE_STACKS[stack_name]["packages"]
    return None


def list_available_stacks() -> List[Dict[str, str]]:
    """List all available compatible stacks"""
    return [
        {"name": name, "description": info["description"]}
        for name, info in COMPATIBLE_STACKS.items()
    ]
