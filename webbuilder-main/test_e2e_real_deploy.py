#!/usr/bin/env python3
"""
E2E Real Deployment Test

This script performs REAL operations against the EVI API:
1. Deploys a game smart contract
2. Waits for deployment completion
3. Verifies the contract on explorer
4. Runs security audit
5. Runs compliance check
6. Downloads all artifacts

Usage:
  python test_e2e_real_deploy.py                    # Deploy tic-tac-toe
  python test_e2e_real_deploy.py --game coin-flip   # Deploy specific game
  python test_e2e_real_deploy.py --list             # List available games

This will make REAL API calls and deploy REAL contracts to the blockchain.
"""

import asyncio
import sys
import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from integrations.evi_client import (
    EVIClient,
    get_explorer_url,
    get_network_info,
    GAME_TEMPLATES,
    NETWORK_CONFIG,
)

# =============================================================================
# Colors
# =============================================================================

class C:
    RESET = '\033[0m'
    BOLD = '\033[1m'
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    GRAY = '\033[90m'

def banner(text: str):
    print(f"\n{C.CYAN}{C.BOLD}{'='*70}")
    print(f"  {text}")
    print(f"{'='*70}{C.RESET}\n")

def step(text: str):
    print(f"\n{C.YELLOW}{C.BOLD}▶ {text}{C.RESET}")

def success(text: str):
    print(f"{C.GREEN}✅ {text}{C.RESET}")

def error(text: str):
    print(f"{C.RED}❌ {text}{C.RESET}")

def info(text: str):
    print(f"{C.CYAN}ℹ️  {text}{C.RESET}")

def log(text: str):
    print(f"{C.GRAY}   {text}{C.RESET}")

# =============================================================================
# Configuration
# =============================================================================

API_BASE = os.getenv("EVI_API_BASE_URL", "https://evi-web-test-production.up.railway.app")
NETWORK = os.getenv("EVI_NETWORK", "basecamp")
MAX_ITERS = int(os.getenv("EVI_MAX_ITERS", "11"))
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "./e2e_test_runs"))

# =============================================================================
# E2E Test Runner
# =============================================================================

class E2ETestRunner:
    def __init__(self, game_key: str):
        self.game_key = game_key
        self.game_config = GAME_TEMPLATES[game_key]
        self.client: Optional[EVIClient] = None
        self.run_dir: Optional[Path] = None
        
        # Results
        self.job_id: Optional[str] = None
        self.contract_address: Optional[str] = None
        self.explorer_url: Optional[str] = None
        self.verified: bool = False
        self.verify_url: Optional[str] = None
        self.audit_score: Optional[int] = None
        self.compliance_score: Optional[int] = None
        self.artifacts: Dict[str, Any] = {}
        self.errors: list = []
    
    async def run(self) -> Dict[str, Any]:
        """Run the complete E2E test"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.run_dir = OUTPUT_DIR / f"{timestamp}_{self.game_key}"
        self.run_dir.mkdir(parents=True, exist_ok=True)
        
        banner(f"E2E REAL DEPLOYMENT TEST: {self.game_key.upper()}")
        
        print(f"Game:       {C.CYAN}{self.game_key}{C.RESET}")
        print(f"Contract:   {C.CYAN}{self.game_config['contract_name']}{C.RESET}")
        print(f"Network:    {C.CYAN}{NETWORK}{C.RESET}")
        print(f"API:        {C.GRAY}{API_BASE}{C.RESET}")
        print(f"Output:     {C.GRAY}{self.run_dir}{C.RESET}")
        
        async with EVIClient(base_url=API_BASE, network=NETWORK, max_iters=MAX_ITERS) as client:
            self.client = client
            
            # Step 1: Deploy
            await self._deploy_contract()
            
            if not self.contract_address:
                error("Deployment failed - cannot continue")
                return self._get_results()
            
            # Step 2: Verify
            await self._verify_contract()
            
            # Step 3: Audit
            await self._audit_contract()
            
            # Step 4: Compliance
            await self._compliance_check()
            
            # Step 5: Download artifacts
            await self._download_artifacts()
        
        # Print final summary
        self._print_summary()
        
        # Save results
        self._save_results()
        
        return self._get_results()
    
    async def _deploy_contract(self):
        """Step 1: Deploy the smart contract"""
        step("STEP 1: Deploying Smart Contract")
        
        prompt = self.game_config["prompt"]
        filename = self.game_config["filename"]
        contract_name = self.game_config["contract_name"]
        
        info(f"Contract: {contract_name}")
        info(f"File: {filename}")
        log("Starting AI pipeline...")
        
        try:
            # Start pipeline
            result = await self.client.start_pipeline(
                prompt=prompt,
                network=NETWORK,
                max_iters=MAX_ITERS,
                contract_name=contract_name,
                filename=filename,
                constructor_args=[],
                strict_args=True,
                context=f"Game type: {self.game_config['expected_type']}. E2E test deployment."
            )
            
            self.job_id = result.get("job", {}).get("id")
            
            if not self.job_id:
                error("No job ID returned from pipeline")
                self.errors.append("No job ID from pipeline")
                return
            
            info(f"Job ID: {self.job_id}")
            
            # Save pipeline start response
            self._save_json("pipeline_start.json", result)
            
            # Stream logs while waiting
            log("Streaming deployment logs...")
            log_count = [0]
            
            async def on_log(event: str, data: Any):
                if event == "log" and data:
                    log_count[0] += 1
                    msg = data.get("msg", "")[:80]
                    level = data.get("level", "info")
                    
                    if level == "error":
                        print(f"   {C.RED}[ERROR] {msg}{C.RESET}")
                    elif "DEPLOY_RESULT" in msg or "Deploy success" in msg:
                        print(f"   {C.GREEN}[SUCCESS] {msg}{C.RESET}")
                    elif level == "warn":
                        print(f"   {C.YELLOW}[WARN] {msg}{C.RESET}")
                    else:
                        print(f"   {C.GRAY}[{level.upper()}] {msg}{C.RESET}")
            
            # Start SSE streaming in background
            sse_task = asyncio.create_task(
                self.client.stream_job_logs_sse(self.job_id, callback=on_log)
            )
            
            # Wait for completion
            log("Waiting for deployment to complete...")
            final_status = await self.client.wait_for_job_completion(
                self.job_id,
                poll_interval=3.0,
                timeout=600.0  # 10 minutes
            )
            
            # Stop SSE
            sse_task.cancel()
            try:
                await sse_task
            except asyncio.CancelledError:
                pass
            
            # Save final status
            self._save_json("pipeline_final_status.json", final_status)
            
            # Check result
            state = final_status.get("data", {}).get("state")
            deploy_result = final_status.get("data", {}).get("result", {})
            
            if state == "completed" and deploy_result.get("address"):
                self.contract_address = deploy_result["address"]
                self.explorer_url = get_explorer_url(NETWORK, self.contract_address)
                
                success(f"Contract deployed!")
                print(f"   {C.GREEN}Address: {self.contract_address}{C.RESET}")
                print(f"   {C.GREEN}Explorer: {self.explorer_url}{C.RESET}")
                print(f"   {C.GRAY}Logs processed: {log_count[0]}{C.RESET}")
            else:
                error_msg = final_status.get("data", {}).get("error", "Unknown error")
                error(f"Deployment failed: {error_msg}")
                self.errors.append(f"Deployment failed: {error_msg}")
                
                # Try fix flow
                await self._attempt_fix(final_status)
                
        except Exception as e:
            error(f"Deployment error: {e}")
            self.errors.append(f"Deployment exception: {e}")
    
    async def _attempt_fix(self, failed_status: Dict):
        """Attempt to fix failed deployment"""
        log("Attempting fix flow...")
        
        try:
            # Get error logs
            logs_resp = await self.client.get_job_logs(self.job_id, limit=5000)
            error_text = self.client.extract_errors_from_logs(
                logs_resp.get("data", {}).get("logs", [])
            )
            
            # Get code
            arts = await self.client.download_artifacts(self.job_id)
            sources = arts.get("sources", [])
            code = sources[0].get("content", "") if sources else ""
            
            if not code.strip():
                error("No code to fix")
                return
            
            # Start fix
            fix_result = await self.client.start_fix(
                code=code,
                errors=error_text,
                context="Fix after pipeline failure",
                network=NETWORK,
                filename=self.game_config["filename"],
                constructor_args=[],
                contract_name=self.game_config["contract_name"],
                max_iters=MAX_ITERS
            )
            
            fix_job_id = fix_result.get("job", {}).get("id")
            if not fix_job_id:
                error("No fix job ID")
                return
            
            info(f"Fix Job ID: {fix_job_id}")
            self._save_json("fix_start.json", fix_result)
            
            # Wait for fix
            fix_status = await self.client.wait_for_job_completion(fix_job_id, timeout=600.0)
            self._save_json("fix_final_status.json", fix_status)
            
            if fix_status.get("data", {}).get("state") == "completed":
                fix_result = fix_status.get("data", {}).get("result", {})
                if fix_result.get("address"):
                    self.job_id = fix_job_id
                    self.contract_address = fix_result["address"]
                    self.explorer_url = get_explorer_url(NETWORK, self.contract_address)
                    success(f"Fix successful! Contract: {self.contract_address}")
                    
        except Exception as e:
            error(f"Fix attempt failed: {e}")
    
    async def _verify_contract(self):
        """Step 2: Verify contract on explorer"""
        step("STEP 2: Verifying Contract on Explorer")
        
        if not self.job_id:
            error("No job ID - skipping verification")
            return
        
        try:
            result = await self.client.verify_by_job(self.job_id, NETWORK)
            self._save_json("verify_result.json", result)
            
            if result.get("verified"):
                self.verified = True
                self.verify_url = result.get("explorerUrl", self.explorer_url)
                success(f"Contract verified!")
                print(f"   {C.GREEN}Verified URL: {self.verify_url}{C.RESET}")
            else:
                info(f"Verification response: {json.dumps(result)}")
                
        except Exception as e:
            error(f"Verification error: {e}")
            self.errors.append(f"Verification error: {e}")
    
    async def _audit_contract(self):
        """Step 3: Run security audit"""
        step("STEP 3: Running Security Audit")
        
        if not self.job_id:
            error("No job ID - skipping audit")
            return
        
        try:
            # Start audit orchestration
            audit_start = await self.client.audit_orchestrate(
                job_id=self.job_id,
                network=NETWORK
            )
            self._save_json("audit_start.json", audit_start)
            
            audit_job_id = audit_start.get("job", {}).get("id")
            if audit_job_id:
                info(f"Audit Job ID: {audit_job_id}")
                
                # Wait for audit
                audit_status = await self.client.wait_for_job_completion(
                    audit_job_id, timeout=300.0
                )
                self._save_json("audit_status.json", audit_status)
                
                # Get audit report
                try:
                    report = await self.client.get_audit_report(self.job_id)
                    if not report:
                        report = await self.client.get_audit_report(audit_job_id)
                    
                    if report:
                        self._save_json("audit_report.json", report)
                        self.audit_score = report.get("score") or report.get("data", {}).get("score")
                        
                        if self.audit_score:
                            success(f"Audit Score: {self.audit_score}/100")
                        else:
                            info("Audit completed (no score in response)")
                except Exception as e:
                    log(f"Could not fetch audit report: {e}")
            else:
                info("No audit job started")
                
        except Exception as e:
            error(f"Audit error: {e}")
            self.errors.append(f"Audit error: {e}")
    
    async def _compliance_check(self):
        """Step 4: Run compliance check"""
        step("STEP 4: Running Compliance Check")
        
        if not self.job_id:
            error("No job ID - skipping compliance")
            return
        
        try:
            # Start compliance orchestration
            comp_start = await self.client.compliance_orchestrate(
                job_id=self.job_id,
                target_profile="generic",
                strict=False,
                network=NETWORK
            )
            self._save_json("compliance_start.json", comp_start)
            
            comp_job_id = comp_start.get("job", {}).get("id")
            if comp_job_id:
                info(f"Compliance Job ID: {comp_job_id}")
                
                # Wait for compliance
                comp_status = await self.client.wait_for_job_completion(
                    comp_job_id, timeout=300.0
                )
                self._save_json("compliance_status.json", comp_status)
                
                # Get compliance report
                try:
                    report = await self.client.get_compliance_report(self.job_id)
                    if not report:
                        report = await self.client.get_compliance_report(comp_job_id)
                    
                    if report:
                        self._save_json("compliance_report.json", report)
                        self.compliance_score = report.get("score") or report.get("data", {}).get("score")
                        
                        if self.compliance_score:
                            success(f"Compliance Score: {self.compliance_score}/100")
                        else:
                            info("Compliance completed (no score in response)")
                except Exception as e:
                    log(f"Could not fetch compliance report: {e}")
            else:
                info("No compliance job started")
                
        except Exception as e:
            error(f"Compliance error: {e}")
            self.errors.append(f"Compliance error: {e}")
    
    async def _download_artifacts(self):
        """Step 5: Download all artifacts"""
        step("STEP 5: Downloading Artifacts")
        
        if not self.job_id:
            error("No job ID - skipping artifacts")
            return
        
        try:
            artifacts = await self.client.download_artifacts(self.job_id)
            self.artifacts = artifacts
            self._save_json("artifacts.json", artifacts)
            
            # Save individual files
            sources = artifacts.get("sources", [])
            abis = artifacts.get("abis", [])
            scripts = artifacts.get("scripts", [])
            
            artifacts_dir = self.run_dir / "artifacts"
            
            # Save .sol source files
            for src in sources:
                filename = src.get("path", "contract.sol")
                path = artifacts_dir / "sources" / filename
                path.parent.mkdir(parents=True, exist_ok=True)
                content = src.get("content", "")
                path.write_text(content)
                info(f"Saved: {path.name} ({len(content)} chars)")
            
            # Save ABI JSON files
            for abi in abis:
                filename = abi.get("path", "abi.json")
                path = artifacts_dir / "abis" / filename
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(abi.get("abi", abi), indent=2))
                info(f"Saved: {path.name}")
            
            # Save script files
            for script in scripts:
                filename = script.get("path", "deploy.js")
                path = artifacts_dir / "scripts" / filename
                path.parent.mkdir(parents=True, exist_ok=True)
                content = script.get("content", "")
                path.write_text(content)
                info(f"Saved: {path.name} ({len(content)} chars)")
            
            # Save contract address to file
            if self.contract_address:
                addr_file = artifacts_dir / "contract_address.txt"
                addr_file.parent.mkdir(parents=True, exist_ok=True)
                addr_file.write_text(f"Contract Address: {self.contract_address}\nExplorer: {self.explorer_url}\nNetwork: {NETWORK}\nJob ID: {self.job_id}")
                info(f"Saved: contract_address.txt")
            
            success(f"Downloaded {len(sources)} sources, {len(abis)} ABIs, {len(scripts)} scripts")
            
        except Exception as e:
            error(f"Artifacts download error: {e}")
            self.errors.append(f"Artifacts error: {e}")
    
    def _print_summary(self):
        """Print final summary"""
        banner("E2E TEST RESULTS")
        
        print(f"Game:              {C.CYAN}{self.game_key}{C.RESET}")
        print(f"Contract Name:     {C.CYAN}{self.game_config['contract_name']}{C.RESET}")
        print(f"Network:           {C.CYAN}{NETWORK}{C.RESET}")
        print()
        
        # Contract details
        if self.contract_address:
            print(f"{C.GREEN}✅ Contract Address:  {self.contract_address}{C.RESET}")
        else:
            print(f"{C.RED}❌ Contract Address:  FAILED{C.RESET}")
        
        if self.explorer_url:
            print(f"{C.GREEN}✅ Explorer URL:      {self.explorer_url}{C.RESET}")
        
        if self.verified:
            print(f"{C.GREEN}✅ Verified:          Yes{C.RESET}")
            if self.verify_url:
                print(f"   Verified URL:      {self.verify_url}")
        else:
            print(f"{C.YELLOW}⚠️  Verified:          No{C.RESET}")
        
        # Scores
        if self.audit_score is not None:
            color = C.GREEN if self.audit_score >= 70 else (C.YELLOW if self.audit_score >= 50 else C.RED)
            print(f"{color}✅ Audit Score:       {self.audit_score}/100{C.RESET}")
        else:
            print(f"{C.GRAY}⚠️  Audit Score:       N/A{C.RESET}")
        
        if self.compliance_score is not None:
            color = C.GREEN if self.compliance_score >= 70 else (C.YELLOW if self.compliance_score >= 50 else C.RED)
            print(f"{color}✅ Compliance Score:  {self.compliance_score}/100{C.RESET}")
        else:
            print(f"{C.GRAY}⚠️  Compliance Score:  N/A{C.RESET}")
        
        print()
        print(f"Job ID:            {C.GRAY}{self.job_id}{C.RESET}")
        print(f"Output Directory:  {C.GRAY}{self.run_dir}{C.RESET}")
        
        # List output files
        print(f"\n{C.BOLD}📁 Output Files:{C.RESET}")
        if self.run_dir and self.run_dir.exists():
            artifacts_dir = self.run_dir / "artifacts"
            
            # Sources (.sol files) - recursive search
            sources_dir = artifacts_dir / "sources"
            if sources_dir.exists():
                for f in sources_dir.rglob("*.sol"):
                    size = f.stat().st_size
                    print(f"   {C.GREEN}📄 {f.name} ({size} bytes){C.RESET}")
                    self.sol_file = f
            
            # ABIs - recursive search
            abis_dir = artifacts_dir / "abis"
            if abis_dir.exists():
                for f in abis_dir.rglob("*.json"):
                    print(f"   {C.CYAN}📋 {f.name}{C.RESET}")
                    self.abi_file = f
            
            # Scripts - recursive search
            scripts_dir = artifacts_dir / "scripts"
            if scripts_dir.exists():
                for f in scripts_dir.rglob("*.js"):
                    size = f.stat().st_size
                    print(f"   {C.YELLOW}📜 {f.name} ({size} bytes){C.RESET}")
                    self.script_file = f
            
            # Contract address file
            addr_file = artifacts_dir / "contract_address.txt"
            if addr_file.exists():
                print(f"   {C.MAGENTA}📍 contract_address.txt{C.RESET}")
            
            # Reports
            audit_report = self.run_dir / "audit_report.json"
            if audit_report.exists():
                print(f"   {C.BLUE}🔍 audit_report.json{C.RESET}")
            
            compliance_report = self.run_dir / "compliance_report.json"
            if compliance_report.exists():
                print(f"   {C.BLUE}✓ compliance_report.json{C.RESET}")
        
        if self.errors:
            print(f"\n{C.RED}Errors:{C.RESET}")
            for err in self.errors:
                print(f"  - {err}")
        
        print()
        
        if self.contract_address and self.verified:
            print(f"{C.GREEN}{C.BOLD}🎉 E2E TEST PASSED - Contract deployed and verified!{C.RESET}")
        elif self.contract_address:
            print(f"{C.YELLOW}{C.BOLD}⚠️  E2E TEST PARTIAL - Contract deployed but not verified{C.RESET}")
        else:
            print(f"{C.RED}{C.BOLD}❌ E2E TEST FAILED - No contract deployed{C.RESET}")
    
    def _save_json(self, filename: str, data: Any):
        """Save JSON data to run directory"""
        if self.run_dir:
            path = self.run_dir / filename
            path.write_text(json.dumps(data, indent=2, default=str))
    
    def _save_results(self):
        """Save final results"""
        results = self._get_results()
        self._save_json("e2e_results.json", results)
    
    def _get_results(self) -> Dict[str, Any]:
        """Get results as dictionary"""
        return {
            "game": self.game_key,
            "contract_name": self.game_config["contract_name"],
            "network": NETWORK,
            "job_id": self.job_id,
            "contract_address": self.contract_address,
            "explorer_url": self.explorer_url,
            "verified": self.verified,
            "verify_url": self.verify_url,
            "audit_score": self.audit_score,
            "compliance_score": self.compliance_score,
            "errors": self.errors,
            "success": bool(self.contract_address),
            "timestamp": datetime.now().isoformat()
        }

# =============================================================================
# Main
# =============================================================================

def print_usage():
    print(f"""
{C.CYAN}{C.BOLD}E2E Real Deployment Test{C.RESET}

{C.BOLD}Usage:{C.RESET}
  python test_e2e_real_deploy.py                    # Deploy tic-tac-toe (default)
  python test_e2e_real_deploy.py --game <name>      # Deploy specific game
  python test_e2e_real_deploy.py --list             # List available games
  python test_e2e_real_deploy.py --help             # Show this help

{C.BOLD}Available Games:{C.RESET}
""")
    for key, config in GAME_TEMPLATES.items():
        print(f"  {C.GREEN}{key.ljust(15)}{C.RESET} → {config['expected_type'].ljust(12)} ({config['contract_name']})")
    
    print(f"""
{C.BOLD}Environment Variables:{C.RESET}
  EVI_API_BASE_URL  API endpoint (default: {API_BASE})
  EVI_NETWORK       Network (default: {NETWORK})
  EVI_MAX_ITERS     Max iterations (default: {MAX_ITERS})
  OUTPUT_DIR        Output directory (default: {OUTPUT_DIR})

{C.YELLOW}⚠️  This will make REAL API calls and deploy REAL contracts!{C.RESET}
""")


async def main():
    args = sys.argv[1:]
    
    if "--help" in args or "-h" in args:
        print_usage()
        return
    
    if "--list" in args:
        print(f"\n{C.CYAN}{C.BOLD}Available Game Templates:{C.RESET}\n")
        for key, config in GAME_TEMPLATES.items():
            print(f"  {C.GREEN}{key.ljust(15)}{C.RESET} → {config['expected_type'].ljust(12)} ({config['contract_name']})")
        print()
        return
    
    # Get game selection
    game_key = "tic-tac-toe"  # default
    if "--game" in args:
        idx = args.index("--game")
        if idx + 1 < len(args):
            game_key = args[idx + 1]
    
    if game_key not in GAME_TEMPLATES:
        print(f"{C.RED}Unknown game: {game_key}{C.RESET}")
        print(f"Use --list to see available games")
        sys.exit(1)
    
    # Run E2E test
    runner = E2ETestRunner(game_key)
    results = await runner.run()
    
    # Exit code based on success
    sys.exit(0 if results.get("success") else 1)


if __name__ == "__main__":
    asyncio.run(main())
