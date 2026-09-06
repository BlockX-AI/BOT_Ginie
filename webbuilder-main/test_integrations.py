#!/usr/bin/env python3
"""
Test Python Integration Components
- EVIClient against EVI API
- DAppOrchestrator functionality
"""

import asyncio
import sys
import json
from datetime import datetime

sys.path.insert(0, '/Users/satyamsinghal/Downloads/webbuilder-main')

from integrations.evi_client import EVIClient, get_network_info, get_explorer_url
from integrations.dapp_orchestrator import DAppOrchestrator

# Backward compat alias
AcademicChainClient = EVIClient

# Colors
class C:
    G = '\033[92m'; R = '\033[91m'; Y = '\033[93m'; B = '\033[94m'
    C = '\033[96m'; M = '\033[95m'; W = '\033[0m'; BOLD = '\033[1m'

def log(icon, msg, color=C.W):
    print(f"{color}{icon} {msg}{C.W}")

async def test_academic_chain_client():
    """Test AcademicChainClient against EVI API"""
    print(f"\n{C.BOLD}{C.C}{'='*80}{C.W}")
    print(f"{C.BOLD}{C.C}Test 1: AcademicChainClient - EVI API Integration{C.W}")
    print(f"{C.BOLD}{C.C}{'='*80}{C.W}\n")
    
    client = AcademicChainClient()
    log("🔗", f"API Base: {client.base_url}", C.C)
    
    results = {"passed": [], "failed": []}
    
    # Test 1: Network Configuration
    try:
        config = get_network_info("basecamp-testnet")
        if config and config.get("chain_id") == 84532:
            log("✅", f"Network config: basecamp-testnet (Chain ID: {config['chain_id']})", C.G)
            results["passed"].append("Network configuration")
        else:
            log("❌", "Network config failed", C.R)
            results["failed"].append("Network configuration")
    except Exception as e:
        log("❌", f"Network config error: {e}", C.R)
        results["failed"].append("Network configuration")
    
    # Test 2: Explorer URL Generation
    try:
        url = get_explorer_url("basecamp-testnet", "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb")
        if "basescan.org" in url:
            log("✅", f"Explorer URL: {url}", C.G)
            results["passed"].append("Explorer URL generation")
        else:
            log("❌", f"Invalid explorer URL: {url}", C.R)
            results["failed"].append("Explorer URL generation")
    except Exception as e:
        log("❌", f"Explorer URL error: {e}", C.R)
        results["failed"].append("Explorer URL generation")
    
    # Test 3: Simple Contract Generation
    try:
        log("🤖", "Generating simple ERC20 contract...", C.C)
        result = await client.generate_contract(
            prompt="Create a simple ERC20 token named TestToken with symbol TEST and 1000 total supply"
        )
        
        if result.get("ok"):
            code = result.get("codeBlock", {}).get("code", "")
            if "contract" in code.lower() and len(code) > 100:
                log("✅", f"Contract generated ({len(code)} chars)", C.G)
                results["passed"].append("Contract generation")
                # Show snippet
                lines = code.split('\n')[:3]
                for line in lines:
                    print(f"      {C.B}{line}{C.W}")
            else:
                log("❌", "Invalid contract code", C.R)
                results["failed"].append("Contract generation")
        else:
            log("❌", f"Generation failed: {result.get('error', 'Unknown')}", C.R)
            results["failed"].append("Contract generation")
    except Exception as e:
        log("⚠️", f"Contract generation error: {e}", C.Y)
        results["failed"].append("Contract generation")
    
    # Test 4: Compilation
    simple_contract = '''
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleToken {
    string public name = "Test";
    uint256 public totalSupply = 1000;
}
'''
    
    try:
        log("⚙️", "Compiling contract...", C.C)
        result = await client.compile_contract(
            filename="SimpleToken.sol",
            code=simple_contract
        )
        
        if result.get("ok"):
            errors = result.get("errors", [])
            if not errors:
                log("✅", "Contract compiled successfully", C.G)
                results["passed"].append("Contract compilation")
            else:
                log("⚠️", f"Compiled with {len(errors)} warning(s)", C.Y)
                results["passed"].append("Contract compilation (warnings)")
        else:
            log("❌", "Compilation failed", C.R)
            results["failed"].append("Contract compilation")
    except Exception as e:
        log("❌", f"Compilation error: {e}", C.R)
        results["failed"].append("Contract compilation")
    
    # Test 5: Method Availability
    methods = [
        "generate_contract", "compile_contract", "fix_contract",
        "create_dapp_pipeline", "get_job_status", "wait_for_job_completion",
        "verify_by_job", "audit_by_job", "compliance_by_job",
        "get_contract_abi", "get_contract_source"
    ]
    
    all_methods_exist = True
    for method in methods:
        if not hasattr(client, method):
            log("❌", f"Missing method: {method}", C.R)
            all_methods_exist = False
    
    if all_methods_exist:
        log("✅", f"All {len(methods)} methods available", C.G)
        results["passed"].append("Method availability")
    else:
        results["failed"].append("Method availability")
    
    await client.close()
    
    # Summary
    print(f"\n{C.BOLD}Results:{C.W}")
    print(f"{C.G}✅ Passed: {len(results['passed'])}{C.W}")
    print(f"{C.R}❌ Failed: {len(results['failed'])}{C.W}")
    
    return results

async def test_dapp_orchestrator():
    """Test DAppOrchestrator initialization and structure"""
    print(f"\n{C.BOLD}{C.C}{'='*80}{C.W}")
    print(f"{C.BOLD}{C.C}Test 2: DAppOrchestrator - Structure & Init{C.W}")
    print(f"{C.BOLD}{C.C}{'='*80}{C.W}\n")
    
    results = {"passed": [], "failed": []}
    
    try:
        orchestrator = DAppOrchestrator()
        log("✅", "DAppOrchestrator initialized", C.G)
        results["passed"].append("Orchestrator initialization")
        
        # Check components
        if hasattr(orchestrator, 'academic_chain'):
            log("✅", "AcademicChain client attached", C.G)
            results["passed"].append("AcademicChain client")
        else:
            log("❌", "Missing AcademicChain client", C.R)
            results["failed"].append("AcademicChain client")
        
        if hasattr(orchestrator, 'webbuilder'):
            log("✅", "WebBuilder service attached", C.G)
            results["passed"].append("WebBuilder service")
        else:
            log("❌", "Missing WebBuilder service", C.R)
            results["failed"].append("WebBuilder service")
        
        # Check methods
        if hasattr(orchestrator, 'create_full_dapp'):
            log("✅", "create_full_dapp method exists", C.G)
            results["passed"].append("create_full_dapp method")
        else:
            log("❌", "Missing create_full_dapp method", C.R)
            results["failed"].append("create_full_dapp method")
        
        await orchestrator.close()
        log("✅", "Orchestrator cleaned up", C.G)
        
    except Exception as e:
        log("❌", f"Orchestrator test error: {e}", C.R)
        results["failed"].append("Orchestrator test")
    
    # Summary
    print(f"\n{C.BOLD}Results:{C.W}")
    print(f"{C.G}✅ Passed: {len(results['passed'])}{C.W}")
    print(f"{C.R}❌ Failed: {len(results['failed'])}{C.W}")
    
    return results

async def test_full_pipeline_dry():
    """Test full pipeline method signature (no actual deployment)"""
    print(f"\n{C.BOLD}{C.C}{'='*80}{C.W}")
    print(f"{C.BOLD}{C.C}Test 3: Full Pipeline - Method Signature{C.W}")
    print(f"{C.BOLD}{C.C}{'='*80}{C.W}\n")
    
    results = {"passed": [], "failed": []}
    
    client = AcademicChainClient()
    
    try:
        # Just verify the method signature works
        log("🔍", "Verifying create_dapp_pipeline signature...", C.C)
        
        # Check parameters
        import inspect
        sig = inspect.signature(client.create_dapp_pipeline)
        params = list(sig.parameters.keys())
        
        expected_params = ["prompt", "network", "max_iters", "constructor_args", "contract_name"]
        missing = [p for p in expected_params if p not in params]
        
        if not missing:
            log("✅", f"Pipeline method has correct parameters: {params}", C.G)
            results["passed"].append("Pipeline method signature")
        else:
            log("❌", f"Missing parameters: {missing}", C.R)
            results["failed"].append("Pipeline method signature")
        
    except Exception as e:
        log("❌", f"Pipeline signature error: {e}", C.R)
        results["failed"].append("Pipeline method signature")
    
    await client.close()
    
    print(f"\n{C.BOLD}Results:{C.W}")
    print(f"{C.G}✅ Passed: {len(results['passed'])}{C.W}")
    print(f"{C.R}❌ Failed: {len(results['failed'])}{C.W}")
    
    return results

async def main():
    """Run all integration tests"""
    print(f"\n{C.BOLD}{C.B}{'='*80}{C.W}")
    print(f"{C.BOLD}{C.B}Python Integration Tests{C.W}")
    print(f"{C.BOLD}{C.B}Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{C.W}")
    print(f"{C.BOLD}{C.B}{'='*80}{C.W}")
    
    all_results = []
    
    # Test 1: AcademicChainClient
    r1 = await test_academic_chain_client()
    all_results.append(r1)
    
    # Test 2: DAppOrchestrator
    r2 = await test_dapp_orchestrator()
    all_results.append(r2)
    
    # Test 3: Pipeline signature
    r3 = await test_full_pipeline_dry()
    all_results.append(r3)
    
    # Overall summary
    total_passed = sum(len(r["passed"]) for r in all_results)
    total_failed = sum(len(r["failed"]) for r in all_results)
    total = total_passed + total_failed
    
    print(f"\n{C.BOLD}{C.C}{'='*80}{C.W}")
    print(f"{C.BOLD}{C.C}OVERALL RESULTS{C.W}")
    print(f"{C.BOLD}{C.C}{'='*80}{C.W}")
    print(f"Total Tests: {total}")
    print(f"{C.G}✅ Passed: {total_passed}{C.W}")
    print(f"{C.R}❌ Failed: {total_failed}{C.W}")
    
    if total > 0:
        success_rate = (total_passed / total) * 100
        print(f"\n{C.BOLD}Success Rate: {success_rate:.1f}%{C.W}")
        
        if success_rate == 100:
            print(f"\n{C.G}{C.BOLD}🎉 ALL TESTS PASSED!{C.W}")
        elif success_rate >= 80:
            print(f"\n{C.Y}⚠️  Most tests passed. Review failures.{C.W}")
        else:
            print(f"\n{C.R}❌ Several tests failed. Investigation needed.{C.W}")
    
    print(f"\n{C.C}Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{C.W}\n")
    
    return total_failed == 0

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
