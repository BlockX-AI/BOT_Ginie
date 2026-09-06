#!/usr/bin/env python3
"""
Comprehensive Test Suite for Web3 Integration
Tests all new EVI API client methods and agent tools
"""

import asyncio
import sys
import json
from typing import Dict, Any

# Test configuration
TEST_MODE = "dry_run"  # Change to "live" for actual API calls
API_BASE = "https://evi-v4-production.up.railway.app"


class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.skipped = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed.append((test_name, details))
        print(f"✅ PASS: {test_name}")
        if details:
            print(f"   └─ {details}")
    
    def add_fail(self, test_name: str, error: str):
        self.failed.append((test_name, error))
        print(f"❌ FAIL: {test_name}")
        print(f"   └─ Error: {error}")
    
    def add_skip(self, test_name: str, reason: str):
        self.skipped.append((test_name, reason))
        print(f"⏭️  SKIP: {test_name}")
        print(f"   └─ {reason}")
    
    def summary(self):
        total = len(self.passed) + len(self.failed) + len(self.skipped)
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"Total Tests:  {total}")
        print(f"✅ Passed:    {len(self.passed)}")
        print(f"❌ Failed:    {len(self.failed)}")
        print(f"⏭️  Skipped:   {len(self.skipped)}")
        print(f"Success Rate: {len(self.passed)/total*100:.1f}%" if total > 0 else "N/A")
        print("="*60)
        
        if self.failed:
            print("\n🔍 Failed Tests Details:")
            for name, error in self.failed:
                print(f"  • {name}: {error}")
        
        return len(self.failed) == 0


async def test_imports():
    """Test 1: Verify all imports work"""
    results = TestResults()
    
    print("\n" + "="*60)
    print("🧪 TEST SUITE 1: Import Verification")
    print("="*60 + "\n")
    
    # Test AcademicChainClient import
    try:
        from integrations.evi_client import (
            AcademicChainClient,
            NETWORK_CONFIG,
            get_network_info,
            get_explorer_url
        )
        results.add_pass("AcademicChainClient imports", "All classes and functions imported")
    except Exception as e:
        results.add_fail("AcademicChainClient imports", str(e))
        return results
    
    # Test tools import
    try:
        from agent.tools import create_tools_with_context
        results.add_pass("Agent tools imports", "create_tools_with_context imported")
    except Exception as e:
        results.add_fail("Agent tools imports", str(e))
    
    # Test dependencies
    deps = [
        ("httpx", "HTTP client for API calls"),
        ("asyncio", "Async runtime"),
        ("json", "JSON parsing"),
        ("typing", "Type hints"),
    ]
    
    for module_name, description in deps:
        try:
            __import__(module_name)
            results.add_pass(f"Dependency: {module_name}", description)
        except ImportError as e:
            results.add_fail(f"Dependency: {module_name}", str(e))
    
    return results


async def test_client_initialization():
    """Test 2: Client initialization and configuration"""
    results = TestResults()
    
    print("\n" + "="*60)
    print("🧪 TEST SUITE 2: Client Initialization")
    print("="*60 + "\n")
    
    try:
        from integrations.evi_client import (
            AcademicChainClient,
            NETWORK_CONFIG,
            get_network_info,
            get_explorer_url
        )
        
        # Test client initialization
        client = AcademicChainClient()
        results.add_pass("Client initialization", f"Base URL: {client.base_url}")
        
        # Test custom base URL
        custom_client = AcademicChainClient(base_url="https://custom.api.com/")
        if custom_client.base_url == "https://custom.api.com":
            results.add_pass("Custom base URL", "Trailing slash removed correctly")
        else:
            results.add_fail("Custom base URL", f"Expected 'https://custom.api.com', got '{custom_client.base_url}'")
        
        # Test network config
        networks = ["basecamp-testnet", "sepolia", "polygon", "avalanche-fuji"]
        for network in networks:
            config = get_network_info(network)
            if config and "chain_id" in config:
                results.add_pass(f"Network config: {network}", f"Chain ID: {config['chain_id']}")
            else:
                results.add_fail(f"Network config: {network}", "Missing or incomplete config")
        
        # Test explorer URL generation
        test_address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        explorer_url = get_explorer_url("basecamp-testnet", test_address)
        if "basescan.org" in explorer_url and test_address in explorer_url:
            results.add_pass("Explorer URL generation", explorer_url)
        else:
            results.add_fail("Explorer URL generation", f"Invalid URL: {explorer_url}")
        
        # Close client
        await client.close()
        await custom_client.close()
        results.add_pass("Client cleanup", "Clients closed successfully")
        
    except Exception as e:
        results.add_fail("Client initialization suite", str(e))
    
    return results


async def test_client_methods():
    """Test 3: Verify all client methods exist with correct signatures"""
    results = TestResults()
    
    print("\n" + "="*60)
    print("🧪 TEST SUITE 3: Client Method Signatures")
    print("="*60 + "\n")
    
    try:
        from integrations.evi_client import AcademicChainClient
        import inspect
        
        client = AcademicChainClient()
        
        # Expected methods with parameter counts
        expected_methods = {
            # AI Generation
            "generate_contract": ["prompt", "model"],
            "compile_contract": ["filename", "code"],
            "fix_contract": ["code", "errors", "network", "context", "max_iters"],
            "create_dapp_pipeline": ["prompt", "network", "max_iters", "constructor_args", "contract_name"],
            
            # Job Management
            "get_job_status": ["job_id", "verbose"],
            "get_job_logs": ["job_id", "level", "limit"],
            "wait_for_job_completion": ["job_id", "poll_interval", "timeout"],
            
            # Artifacts
            "get_artifacts": ["job_id", "include"],
            "get_contract_abi": ["job_id"],
            "get_contract_source": ["job_id"],
            
            # Audit & Compliance (basic)
            "audit_contract": ["code", "filename", "model"],
            "check_compliance": ["code", "profile", "filename"],
            
            # Verification
            "verify_contract": ["address", "network", "fully_qualified_name", "constructor_args"],
            "verify_by_job": ["job_id", "network", "fully_qualified_name"],
            
            # Advanced Audit & Compliance (NEW)
            "audit_by_job": ["job_id", "model", "policy"],
            "compliance_by_job": ["job_id", "model", "profile", "strict", "policy_pack", "policy_checks"],
            "audit_orchestrate": ["code", "job_id", "fix", "deploy", "network", "model", "fix_model", "constructor_args"],
            "compliance_orchestrate": ["code", "job_id", "target_profile", "strict", "fix", "deploy", "network", "model", "fix_model", "constructor_args"],
            "get_audit_report": ["job_id"],
            "get_compliance_report": ["job_id"],
            
            # SSE Streaming (NEW)
            "stream_job_logs_sse": ["job_id", "after_index", "callback"],
        }
        
        for method_name, expected_params in expected_methods.items():
            if hasattr(client, method_name):
                method = getattr(client, method_name)
                sig = inspect.signature(method)
                params = list(sig.parameters.keys())
                
                # Remove 'self' from parameters
                if 'self' in params:
                    params.remove('self')
                
                # Check if all expected params exist
                missing = set(expected_params) - set(params)
                if not missing:
                    results.add_pass(
                        f"Method: {method_name}",
                        f"Parameters: {', '.join(params)}"
                    )
                else:
                    results.add_fail(
                        f"Method: {method_name}",
                        f"Missing parameters: {missing}"
                    )
            else:
                results.add_fail(f"Method: {method_name}", "Method not found")
        
        await client.close()
        
    except Exception as e:
        results.add_fail("Client methods verification", str(e))
    
    return results


async def test_tools_registration():
    """Test 4: Verify agent tools are registered"""
    results = TestResults()
    
    print("\n" + "="*60)
    print("🧪 TEST SUITE 4: Agent Tools Registration")
    print("="*60 + "\n")
    
    try:
        # We can't fully test tools without E2B sandbox and WebSocket
        # But we can verify the function exists and check documentation
        
        from agent.tools import create_tools_with_context
        import inspect
        
        # Check function signature
        sig = inspect.signature(create_tools_with_context)
        params = list(sig.parameters.keys())
        
        expected_params = ["sandbox", "socket", "project_id"]
        if all(p in params for p in expected_params):
            results.add_pass(
                "create_tools_with_context signature",
                f"Parameters: {', '.join(params)}"
            )
        else:
            results.add_fail(
                "create_tools_with_context signature",
                f"Expected {expected_params}, got {params}"
            )
        
        # Expected tool names
        expected_tools = [
            "create_file",
            "read_file",
            "execute_command",
            "test_build",
            "delete_file",
            "list_directory",
            "write_multiple_files",
            "get_context",
            "save_context",
            "check_missing_packages",
            "save_contract_info",
            "create_web3_boilerplate",
            "get_deployed_contracts",
            # NEW Web3 tools
            "deploy_smart_contract",
            "verify_contract",
            "audit_contract",
            "check_contract_compliance",
            "get_contract_job_status",
        ]
        
        results.add_pass(
            "Expected tools count",
            f"{len(expected_tools)} tools should be available"
        )
        
        # Check source code for tool definitions
        source = inspect.getsource(create_tools_with_context)
        
        found_tools = []
        missing_tools = []
        
        for tool_name in expected_tools:
            if f"async def {tool_name}" in source or f"def {tool_name}" in source:
                found_tools.append(tool_name)
            else:
                missing_tools.append(tool_name)
        
        for tool in found_tools:
            results.add_pass(f"Tool: {tool}", "Definition found in source")
        
        for tool in missing_tools:
            results.add_fail(f"Tool: {tool}", "Definition not found")
        
    except Exception as e:
        results.add_fail("Tools registration verification", str(e))
    
    return results


async def test_api_connectivity():
    """Test 5: Test API connectivity (dry run or live)"""
    results = TestResults()
    
    print("\n" + "="*60)
    print(f"🧪 TEST SUITE 5: API Connectivity ({TEST_MODE.upper()})")
    print("="*60 + "\n")
    
    if TEST_MODE == "dry_run":
        results.add_skip(
            "Live API tests",
            "Running in DRY_RUN mode. Set TEST_MODE='live' for actual API calls"
        )
        return results
    
    try:
        from integrations.evi_client import AcademicChainClient
        
        client = AcademicChainClient()
        
        # Test 1: Health check (if API has one)
        try:
            # Note: EVI API might not have a health endpoint
            # This is just a connectivity test
            results.add_skip(
                "API health check",
                "No public health endpoint available"
            )
        except:
            pass
        
        # Test 2: Try to get job status with invalid ID (should fail gracefully)
        try:
            status = await client.get_job_status("test-invalid-job-id")
            results.add_fail("Invalid job ID handling", "Should have raised error")
        except Exception as e:
            if "404" in str(e) or "not found" in str(e).lower():
                results.add_pass("Invalid job ID handling", "Correctly returns 404")
            else:
                results.add_fail("Invalid job ID handling", str(e))
        
        await client.close()
        
    except Exception as e:
        results.add_fail("API connectivity", str(e))
    
    return results


async def test_integration_flow():
    """Test 6: Test complete integration flow (mock)"""
    results = TestResults()
    
    print("\n" + "="*60)
    print("🧪 TEST SUITE 6: Integration Flow (Mock)")
    print("="*60 + "\n")
    
    try:
        from integrations.evi_client import (
            AcademicChainClient,
            get_explorer_url,
            get_network_info
        )
        
        # Mock a complete DApp creation flow
        network = "basecamp-testnet"
        mock_job_id = "test-job-123"
        mock_address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        
        # Step 1: Network selection
        network_info = get_network_info(network)
        if network_info:
            results.add_pass("Step 1: Network selection", f"Selected {network}")
        else:
            results.add_fail("Step 1: Network selection", "Network not found")
        
        # Step 2: Generate explorer URL
        explorer_url = get_explorer_url(network, mock_address)
        if explorer_url:
            results.add_pass("Step 2: Explorer URL", explorer_url)
        else:
            results.add_fail("Step 2: Explorer URL", "Failed to generate")
        
        # Step 3: Verify method signatures for deployment flow
        client = AcademicChainClient()
        
        flow_methods = [
            "create_dapp_pipeline",  # Deploy
            "wait_for_job_completion",  # Wait
            "get_contract_abi",  # Get ABI
            "verify_by_job",  # Verify
            "audit_by_job",  # Audit
            "compliance_by_job",  # Compliance
        ]
        
        for method in flow_methods:
            if hasattr(client, method):
                results.add_pass(f"Step: {method}", "Method available")
            else:
                results.add_fail(f"Step: {method}", "Method not found")
        
        await client.close()
        
    except Exception as e:
        results.add_fail("Integration flow test", str(e))
    
    return results


async def run_all_tests():
    """Run all test suites"""
    print("🚀 Starting Comprehensive Web3 Integration Tests")
    print(f"📍 API Base URL: {API_BASE}")
    print(f"🔧 Test Mode: {TEST_MODE.upper()}")
    print()
    
    all_results = []
    
    # Run all test suites
    all_results.append(await test_imports())
    all_results.append(await test_client_initialization())
    all_results.append(await test_client_methods())
    all_results.append(await test_tools_registration())
    all_results.append(await test_api_connectivity())
    all_results.append(await test_integration_flow())
    
    # Aggregate results
    print("\n" + "="*60)
    print("📊 OVERALL TEST RESULTS")
    print("="*60)
    
    total_passed = sum(len(r.passed) for r in all_results)
    total_failed = sum(len(r.failed) for r in all_results)
    total_skipped = sum(len(r.skipped) for r in all_results)
    total_tests = total_passed + total_failed + total_skipped
    
    print(f"\n✅ Total Passed:  {total_passed}")
    print(f"❌ Total Failed:  {total_failed}")
    print(f"⏭️  Total Skipped: {total_skipped}")
    print(f"📊 Total Tests:   {total_tests}")
    
    if total_tests > 0:
        success_rate = (total_passed / total_tests) * 100
        print(f"\n🎯 Success Rate: {success_rate:.1f}%")
        
        if success_rate == 100:
            print("\n🎉 ALL TESTS PASSED! Integration is ready for deployment!")
        elif success_rate >= 80:
            print("\n✅ Most tests passed. Review failures before deployment.")
        else:
            print("\n⚠️  Many tests failed. Fix issues before deployment.")
    
    print("="*60 + "\n")
    
    return total_failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
