#!/usr/bin/env python3
"""
Test suite for the EVI Client
Tests the smart contract generation, deployment, and ACV pipeline
"""

import asyncio
import json
import os
import sys
from typing import Dict, Any

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from integrations.evi_client import (
    EVIClient,
    get_explorer_url,
    get_network_info,
    GAME_TEMPLATES,
    NETWORK_CONFIG,
    JobState,
)


def green(text: str) -> str:
    return f"\033[92m{text}\033[0m"

def red(text: str) -> str:
    return f"\033[91m{text}\033[0m"

def yellow(text: str) -> str:
    return f"\033[93m{text}\033[0m"

def cyan(text: str) -> str:
    return f"\033[96m{text}\033[0m"


class EVIClientTester:
    """Test runner for EVI Client"""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.results: Dict[str, str] = {}
    
    def log(self, message: str):
        print(f"  {message}")
    
    def success(self, test_name: str, message: str = ""):
        self.passed += 1
        self.results[test_name] = "PASSED"
        print(green(f"✓ {test_name}") + (f" - {message}" if message else ""))
    
    def fail(self, test_name: str, error: str):
        self.failed += 1
        self.results[test_name] = f"FAILED: {error}"
        print(red(f"✗ {test_name}") + f" - {error}")
    
    def skip(self, test_name: str, reason: str):
        self.skipped += 1
        self.results[test_name] = f"SKIPPED: {reason}"
        print(yellow(f"⊘ {test_name}") + f" - {reason}")
    
    async def test_network_config(self):
        """Test network configuration"""
        test_name = "Network Configuration"
        try:
            # Check basecamp is configured
            assert "basecamp" in NETWORK_CONFIG, "basecamp missing from networks"
            
            basecamp = get_network_info("basecamp")
            assert basecamp.get("chain_id") == 123420111, "Wrong basecamp chain ID"
            assert "explorer" in basecamp, "Missing explorer URL"
            
            # Check explorer URL generation
            explorer = get_explorer_url("basecamp", "0x1234567890")
            assert "basecamp" in explorer.lower() or "blockscout" in explorer.lower(), "Invalid explorer URL"
            
            self.success(test_name, f"{len(NETWORK_CONFIG)} networks configured")
        except Exception as e:
            self.fail(test_name, str(e))
    
    async def test_game_templates(self):
        """Test game templates are configured"""
        test_name = "Game Templates"
        try:
            assert len(GAME_TEMPLATES) >= 6, f"Expected 6+ games, got {len(GAME_TEMPLATES)}"
            
            required_games = ["tic-tac-toe", "temple-run", "2048", "coin-flip"]
            for game in required_games:
                assert game in GAME_TEMPLATES, f"Missing game: {game}"
                template = GAME_TEMPLATES[game]
                assert "prompt" in template, f"Missing prompt for {game}"
                assert "filename" in template, f"Missing filename for {game}"
                assert "contract_name" in template, f"Missing contract_name for {game}"
            
            self.success(test_name, f"{len(GAME_TEMPLATES)} games available")
        except Exception as e:
            self.fail(test_name, str(e))
    
    async def test_client_initialization(self):
        """Test EVIClient can be initialized"""
        test_name = "Client Initialization"
        try:
            async with EVIClient() as client:
                assert client.base_url, "Missing base URL"
                assert client.network == "basecamp", f"Wrong default network: {client.network}"
                assert client.max_iters == 11, f"Wrong max iters: {client.max_iters}"
            
            # Test with custom params
            async with EVIClient(network="sepolia", max_iters=5) as client:
                assert client.network == "sepolia"
                assert client.max_iters == 5
            
            self.success(test_name)
        except Exception as e:
            self.fail(test_name, str(e))
    
    async def test_api_health(self):
        """Test API is reachable"""
        test_name = "API Health Check"
        try:
            async with EVIClient() as client:
                # Try to get a non-existent job (should return error, not crash)
                try:
                    result = await client.get_job_status("non-existent-job-id")
                    # If we get here, API is responsive
                    self.success(test_name, "API is reachable")
                except Exception as e:
                    if "404" in str(e) or "not found" in str(e).lower():
                        self.success(test_name, "API is reachable (404 for invalid job is expected)")
                    else:
                        raise
        except Exception as e:
            self.fail(test_name, f"API not reachable: {e}")
    
    async def test_generate_contract(self):
        """Test contract generation endpoint (no deployment)"""
        test_name = "Contract Generation"
        try:
            async with EVIClient() as client:
                result = await client.generate_contract(
                    prompt="Simple counter contract with increment and decrement functions"
                )
                
                if result.get("ok"):
                    code = result.get("code", result.get("data", {}).get("code", ""))
                    if code and "contract" in code.lower():
                        self.success(test_name, f"Generated {len(code)} chars of Solidity")
                    else:
                        self.fail(test_name, "No contract code in response")
                else:
                    # API might have limits or be unavailable
                    error = result.get("error", "Unknown error")
                    self.skip(test_name, f"API returned: {error}")
        except Exception as e:
            self.skip(test_name, f"Generation failed (may need API key): {e}")
    
    async def test_pipeline_start(self):
        """Test starting a pipeline (doesn't wait for completion)"""
        test_name = "Pipeline Start"
        try:
            async with EVIClient() as client:
                result = await client.start_pipeline(
                    prompt="Simple storage contract that stores a single uint256 value",
                    network="basecamp",
                    max_iters=1  # Minimal iterations for test
                )
                
                if result.get("ok"):
                    job = result.get("job", {})
                    job_id = job.get("id")
                    if job_id:
                        self.success(test_name, f"Job started: {job_id[:20]}...")
                        return job_id
                    else:
                        self.fail(test_name, "No job ID returned")
                else:
                    error = result.get("error", "Unknown error")
                    self.skip(test_name, f"Pipeline start failed: {error}")
        except Exception as e:
            self.skip(test_name, f"Could not start pipeline: {e}")
        return None
    
    async def test_extract_errors(self):
        """Test error extraction from logs"""
        test_name = "Error Extraction"
        try:
            # Test with mock logs
            mock_logs = [
                {"level": "info", "msg": "Starting compilation"},
                {"level": "error", "msg": "TypeError: undefined is not a function"},
                {"level": "warn", "msg": "Deprecated feature used"},
                {"level": "debug", "msg": "Debug info"},
                {"level": "error", "msg": "Compilation failed"},
            ]
            
            errors = EVIClient.extract_errors_from_logs(mock_logs)
            
            assert "TypeError" in errors, "Should extract TypeError"
            assert "Compilation failed" in errors, "Should extract compilation error"
            assert "Debug info" not in errors, "Should not include debug logs"
            assert "Starting compilation" not in errors, "Should not include info logs"
            
            self.success(test_name)
        except Exception as e:
            self.fail(test_name, str(e))
    
    async def run_all(self, include_live_api: bool = False):
        """Run all tests"""
        print(cyan("\n" + "="*60))
        print(cyan("EVI Client Test Suite"))
        print(cyan("="*60 + "\n"))
        
        # Unit tests (no API calls)
        print(cyan("--- Unit Tests ---"))
        await self.test_network_config()
        await self.test_game_templates()
        await self.test_client_initialization()
        await self.test_extract_errors()
        
        # API tests
        if include_live_api:
            print(cyan("\n--- Live API Tests ---"))
            await self.test_api_health()
            await self.test_generate_contract()
            
            # Only run pipeline test if explicitly requested
            if os.getenv("TEST_PIPELINE"):
                await self.test_pipeline_start()
        else:
            print(yellow("\n--- Live API Tests Skipped ---"))
            print("  Set include_live_api=True or run: TEST_LIVE=1 python test_evi_client.py")
        
        # Summary
        print(cyan("\n" + "="*60))
        print(cyan("Test Summary"))
        print(cyan("="*60))
        print(f"  {green('Passed')}: {self.passed}")
        print(f"  {red('Failed')}: {self.failed}")
        print(f"  {yellow('Skipped')}: {self.skipped}")
        print(f"  Total: {self.passed + self.failed + self.skipped}")
        print()
        
        return self.failed == 0


async def test_full_pipeline():
    """Integration test: Run a full ACV pipeline"""
    print(cyan("\n" + "="*60))
    print(cyan("Full Pipeline Integration Test"))
    print(cyan("="*60 + "\n"))
    
    async with EVIClient() as client:
        print("Starting full pipeline...")
        
        def on_status(phase: str, msg: str):
            print(f"[{phase}] {msg}")
        
        result = await client.run_full_pipeline(
            prompt="Create a simple counter contract with increment, decrement, and getCount functions. Keep constructor empty.",
            network="basecamp",
            contract_name="SimpleCounter",
            filename="SimpleCounter.sol",
            on_status=on_status,
            verify=True,
            audit=False,  # Skip audit for faster test
            compliance=False
        )
        
        if result["success"]:
            print(green("\n✓ Pipeline completed successfully!"))
            print(f"  Contract: {result['contract_address']}")
            print(f"  Explorer: {result['explorer_url']}")
            print(f"  Job ID: {result['job_id']}")
        else:
            print(red(f"\n✗ Pipeline failed: {result.get('error')}"))
        
        return result


async def main():
    """Main entry point"""
    tester = EVIClientTester()
    
    # Check if live API tests should run
    include_live = os.getenv("TEST_LIVE", "").lower() in ("1", "true", "yes")
    
    success = await tester.run_all(include_live_api=include_live)
    
    # Full pipeline test (only if explicitly requested)
    if os.getenv("TEST_FULL_PIPELINE"):
        await test_full_pipeline()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
