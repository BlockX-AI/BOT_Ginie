#!/usr/bin/env python3
"""
ACV Full Pipeline Test - Python equivalent of acv-test-logic.js

Tests the complete ACV (AI → Contract → Verify → Audit → Compliance) flow:
1. Start pipeline (generate, compile, deploy)
2. Stream logs via SSE
3. Download artifacts (sources, ABIs, scripts)
4. Verify contract on explorer
5. Run security audit
6. Run compliance check
7. Fetch and save reports

Environment variables:
- EVI_API_BASE_URL (default: https://evi-web-test-production.up.railway.app)
- EVI_NETWORK (default: basecamp)
- EVI_MAX_ITERS (default: 11)
- OUTPUT_DIR (default: ./ai_pipeline_runs)
- TEST_GAME (default: tic-tac-toe)
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from integrations.evi_client import (
    EVIClient,
    get_explorer_url,
    get_network_info,
    GAME_TEMPLATES,
    NETWORK_CONFIG,
    LogEntry,
)

# =============================================================================
# ANSI Colors
# =============================================================================

class Colors:
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    GRAY = '\033[90m'

def color(text: str, c: str) -> str:
    return f"{c}{text}{Colors.RESET}"

def by_level(level: str, text: str) -> str:
    lvl = level.lower()
    if lvl == 'error':
        return color(text, Colors.RED)
    elif lvl == 'warn':
        return color(text, Colors.YELLOW)
    elif lvl == 'debug':
        return color(text, Colors.MAGENTA)
    elif lvl == 'success':
        return color(text, Colors.GREEN)
    elif lvl == 'info':
        return color(text, Colors.CYAN)
    return text

# =============================================================================
# Configuration
# =============================================================================

API_BASE = os.getenv("EVI_API_BASE_URL", "https://evi-web-test-production.up.railway.app")
NETWORK = os.getenv("EVI_NETWORK", "basecamp")
MAX_ITERS = int(os.getenv("EVI_MAX_ITERS", "11"))
OUTPUT_ROOT = Path(os.getenv("OUTPUT_DIR", "./ai_pipeline_runs"))

# =============================================================================
# File Utilities
# =============================================================================

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def write_json(file_path: Path, obj: Any):
    ensure_dir(file_path.parent)
    with open(file_path, 'w') as f:
        json.dump(obj, f, indent=2, default=str)

def write_text(file_path: Path, text: str):
    ensure_dir(file_path.parent)
    with open(file_path, 'w') as f:
        f.write(text)

def append_ndjson(file_path: Path, entries: List[Dict]):
    ensure_dir(file_path.parent)
    with open(file_path, 'a') as f:
        for entry in entries if isinstance(entries, list) else [entries]:
            f.write(json.dumps(entry, default=str) + '\n')

def stamp() -> str:
    return datetime.now().strftime("%Y%m%dT%H%M%S")

# =============================================================================
# Pipeline Result
# =============================================================================

class PipelineResult:
    def __init__(self, game_key: str):
        self.game_key = game_key
        self.success = False
        self.job_id: Optional[str] = None
        self.contract_address: Optional[str] = None
        self.explorer_url: Optional[str] = None
        self.verify: Dict[str, Any] = {}
        self.audit: Dict[str, Any] = {}
        self.compliance: Dict[str, Any] = {}
        self.error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "game_key": self.game_key,
            "success": self.success,
            "job_id": self.job_id,
            "contract_address": self.contract_address,
            "explorer_url": self.explorer_url,
            "verify": self.verify,
            "audit": self.audit,
            "compliance": self.compliance,
            "error": self.error
        }

# =============================================================================
# Full ACV Pipeline
# =============================================================================

async def run_full_acv_pipeline(
    game_key: str,
    game_config: Dict[str, Any],
    run_dir: Path,
    client: EVIClient
) -> PipelineResult:
    """
    Run the complete ACV pipeline for a game template.
    Matches the functionality of acv-test-logic.js runGamePipeline()
    """
    result = PipelineResult(game_key)
    
    prompt = game_config["prompt"]
    filename = game_config["filename"]
    contract_name = game_config["contract_name"]
    expected_type = game_config["expected_type"]
    
    pipeline_dir = run_dir / "pipeline"
    fix_dir = run_dir / "fix"
    verify_dir = run_dir / "verify"
    audit_dir = run_dir / "audit"
    compliance_dir = run_dir / "compliance"
    
    for d in [pipeline_dir, fix_dir, verify_dir, audit_dir, compliance_dir]:
        ensure_dir(d)
    
    print(color(f"\n{'='*60}", Colors.CYAN))
    print(color(f"  GAME: {game_key.upper()} (Expected: {expected_type})", Colors.CYAN + Colors.BOLD))
    print(color(f"  Contract: {contract_name} → {filename}", Colors.CYAN))
    print(color(f"{'='*60}", Colors.CYAN))
    
    primary_job_id = None
    primary_kind = "pipeline"
    
    # =========================================================================
    # 1) Start Pipeline
    # =========================================================================
    print(f"\n{color('▶ Starting AI Pipeline...', Colors.YELLOW)}")
    
    try:
        resp = await client.start_pipeline(
            prompt=prompt,
            network=NETWORK,
            max_iters=MAX_ITERS,
            contract_name=contract_name,
            filename=filename,
            constructor_args=[],
            strict_args=True,
            context=f"Game type: {expected_type}. End-to-end ACV run."
        )
        
        primary_job_id = resp.get("job", {}).get("id")
        write_json(pipeline_dir / "start.response.json", resp)
        write_text(pipeline_dir / "job.id", primary_job_id or "")
        print(color(f"  Job ID: {primary_job_id}", Colors.GRAY))
        
        if not primary_job_id:
            result.error = "No job ID returned from pipeline"
            return result
        
        result.job_id = primary_job_id
        
        # Stream logs in background
        log_entries = []
        async def log_callback(event: str, data: Any):
            if event == "log" and data:
                entry = {
                    "i": data.get("i", 0),
                    "t": data.get("t", 0),
                    "level": data.get("level", "info"),
                    "msg": data.get("msg", "")
                }
                log_entries.append(entry)
                
                lvl = entry["level"]
                msg = entry["msg"]
                icon = "❌" if lvl == "error" else ("⚠️" if lvl == "warn" else ("🔍" if lvl == "debug" else "ℹ️"))
                
                # Check for success indicators
                if any(x in msg for x in ["DEPLOY_RESULT", "Deploy success", "Contract chosen"]):
                    icon = "✅"
                    lvl = "success"
                
                print(f"  {color(f'[{lvl.upper()}]', Colors.GRAY)} {icon} {by_level(lvl, msg[:100])}")
        
        # Start SSE streaming task
        sse_task = asyncio.create_task(
            client.stream_job_logs_sse(primary_job_id, callback=log_callback)
        )
        
        # Wait for completion
        print(color("  Waiting for pipeline completion...", Colors.GRAY))
        final_status = await client.wait_for_job_completion(
            primary_job_id,
            poll_interval=3.0,
            timeout=600.0
        )
        
        # Cancel SSE streaming
        sse_task.cancel()
        try:
            await sse_task
        except asyncio.CancelledError:
            pass
        
        # Save logs
        if log_entries:
            for entry in log_entries:
                append_ndjson(pipeline_dir / "logs.ndjson", entry)
        
        write_json(pipeline_dir / "final.status.json", final_status)
        
        # Save artifacts
        try:
            artifacts = await client.download_artifacts(primary_job_id)
            write_json(pipeline_dir / "artifacts.summary.json", artifacts)
            await save_artifacts(artifacts, pipeline_dir / "artifacts")
        except Exception as e:
            print(color(f"  Artifacts download failed: {e}", Colors.YELLOW))
        
        state = final_status.get("data", {}).get("state")
        deploy_result = final_status.get("data", {}).get("result", {})
        
        if state == "completed":
            print(color(f"\n✅ Pipeline COMPLETED", Colors.GREEN))
            if deploy_result.get("address"):
                result.contract_address = deploy_result["address"]
                result.explorer_url = get_explorer_url(NETWORK, result.contract_address)
                print(color(f"   Deployed: {result.contract_address}", Colors.GREEN))
                print(color(f"   Explorer: {result.explorer_url}", Colors.GREEN))
        else:
            # Pipeline failed - attempt fix flow
            error_msg = final_status.get("data", {}).get("error", "unknown")
            print(color(f"\n❌ Pipeline FAILED: {error_msg}", Colors.RED))
            print(color("▶ Attempting Fix Flow...", Colors.YELLOW))
            
            # Get error logs
            error_text = ""
            try:
                logs_resp = await client.get_job_logs(primary_job_id, limit=5000)
                error_text = client.extract_errors_from_logs(logs_resp.get("data", {}).get("logs", []))
            except Exception:
                pass
            
            # Get code
            code = ""
            try:
                arts = await client.download_artifacts(primary_job_id)
                sources = arts.get("sources", [])
                code = sources[0].get("content", "") if sources else ""
            except Exception:
                pass
            
            if code.strip():
                fix_resp = await client.start_fix(
                    code=code,
                    errors=error_text,
                    context="Fix after pipeline failure",
                    network=NETWORK,
                    filename=filename,
                    constructor_args=[],
                    contract_name=contract_name,
                    max_iters=MAX_ITERS
                )
                
                fix_job_id = fix_resp.get("job", {}).get("id")
                if fix_job_id:
                    primary_job_id = fix_job_id
                    primary_kind = "fix"
                    result.job_id = fix_job_id
                    
                    write_json(fix_dir / "start.response.json", fix_resp)
                    
                    fix_status = await client.wait_for_job_completion(fix_job_id, timeout=600.0)
                    write_json(fix_dir / "final.status.json", fix_status)
                    
                    try:
                        fix_arts = await client.download_artifacts(fix_job_id)
                        await save_artifacts(fix_arts, fix_dir / "artifacts")
                    except Exception:
                        pass
                    
                    if fix_status.get("data", {}).get("state") == "completed":
                        fix_result = fix_status.get("data", {}).get("result", {})
                        if fix_result.get("address"):
                            result.contract_address = fix_result["address"]
                            result.explorer_url = get_explorer_url(NETWORK, result.contract_address)
                            print(color(f"\n✅ Fix COMPLETED", Colors.GREEN))
                            print(color(f"   Deployed: {result.contract_address}", Colors.GREEN))
        
        if not result.contract_address:
            result.error = "No contract address after pipeline/fix"
            return result
        
    except Exception as e:
        print(color(f"Pipeline error: {e}", Colors.RED))
        result.error = str(e)
        return result
    
    # =========================================================================
    # 2) Verify Contract
    # =========================================================================
    print(f"\n{color('▶ Verifying Contract...', Colors.YELLOW)}")
    
    try:
        verify_resp = await client.verify_by_job(primary_job_id, NETWORK)
        write_json(verify_dir / "byJob.response.json", verify_resp)
        
        if verify_resp.get("verified"):
            explorer_url = verify_resp.get("explorerUrl", "")
            print(color(f"✅ Verified: {explorer_url}", Colors.GREEN))
            result.verify = {"verified": True, "url": explorer_url}
        else:
            print(color(f"⚠️  Verify response: {json.dumps(verify_resp)}", Colors.YELLOW))
            result.verify = {"verified": False}
    except Exception as e:
        print(color(f"Verify error: {e}", Colors.YELLOW))
        result.verify = {"verified": False, "error": str(e)}
    
    # =========================================================================
    # 3) Security Audit
    # =========================================================================
    print(f"\n{color('▶ Running Security Audit...', Colors.YELLOW)}")
    
    try:
        audit_start = await client.audit_orchestrate(job_id=primary_job_id, network=NETWORK)
        audit_job_id = audit_start.get("job", {}).get("id")
        write_json(audit_dir / "start.response.json", audit_start)
        
        if audit_job_id:
            print(color(f"  Audit job: {audit_job_id}", Colors.GRAY))
            
            # Stream audit logs
            audit_sse = asyncio.create_task(client.stream_job_logs_sse(audit_job_id))
            await client.wait_for_job_completion(audit_job_id, timeout=300.0)
            audit_sse.cancel()
            try:
                await audit_sse
            except asyncio.CancelledError:
                pass
            
            # Fetch audit report
            audit_report = None
            try:
                audit_report = await client.get_audit_report(primary_job_id)
            except Exception:
                try:
                    audit_report = await client.get_audit_report(audit_job_id)
                except Exception:
                    pass
            
            if audit_report:
                write_json(audit_dir / "report.json", audit_report)
                score = audit_report.get("score") or audit_report.get("data", {}).get("score")
                print(color(f"✅ Audit Score: {score}/100", Colors.GREEN))
                result.audit = {"score": score, "report": audit_report}
    except Exception as e:
        print(color(f"Audit error: {e}", Colors.YELLOW))
        result.audit = {"error": str(e)}
    
    # =========================================================================
    # 4) Compliance Check
    # =========================================================================
    print(f"\n{color('▶ Running Compliance Check...', Colors.YELLOW)}")
    
    try:
        comp_start = await client.compliance_orchestrate(
            job_id=primary_job_id,
            target_profile="generic",
            strict=False,
            network=NETWORK
        )
        comp_job_id = comp_start.get("job", {}).get("id")
        write_json(compliance_dir / "start.response.json", comp_start)
        
        if comp_job_id:
            print(color(f"  Compliance job: {comp_job_id}", Colors.GRAY))
            
            # Stream compliance logs
            comp_sse = asyncio.create_task(client.stream_job_logs_sse(comp_job_id))
            await client.wait_for_job_completion(comp_job_id, timeout=300.0)
            comp_sse.cancel()
            try:
                await comp_sse
            except asyncio.CancelledError:
                pass
            
            # Fetch compliance report
            comp_report = None
            try:
                comp_report = await client.get_compliance_report(primary_job_id)
            except Exception:
                try:
                    comp_report = await client.get_compliance_report(comp_job_id)
                except Exception:
                    pass
            
            if comp_report:
                write_json(compliance_dir / "report.json", comp_report)
                score = comp_report.get("score") or comp_report.get("data", {}).get("score")
                print(color(f"✅ Compliance Score: {score}/100", Colors.GREEN))
                result.compliance = {"score": score, "report": comp_report}
    except Exception as e:
        print(color(f"Compliance error: {e}", Colors.YELLOW))
        result.compliance = {"error": str(e)}
    
    # Save final artifacts
    primary_out = run_dir / f"primary_{primary_kind}"
    ensure_dir(primary_out)
    try:
        final_arts = await client.download_artifacts(primary_job_id)
        await save_artifacts(final_arts, primary_out / "artifacts")
    except Exception:
        pass
    
    result.success = True
    return result


async def save_artifacts(artifacts: Dict[str, Any], base_dir: Path):
    """Save artifacts to disk"""
    sources = artifacts.get("sources", [])
    abis = artifacts.get("abis", [])
    scripts = artifacts.get("scripts", [])
    
    src_dir = base_dir / "sources"
    abi_dir = base_dir / "abis"
    scripts_dir = base_dir / "scripts"
    
    for s in sources:
        dest = src_dir / s.get("path", "unknown.sol")
        ensure_dir(dest.parent)
        write_text(dest, s.get("content", ""))
    
    for a in abis:
        dest = abi_dir / a.get("path", "unknown.json")
        ensure_dir(dest.parent)
        write_json(dest, a)
    
    for sc in scripts:
        dest = scripts_dir / sc.get("path", "unknown.js")
        ensure_dir(dest.parent)
        write_text(dest, sc.get("content", ""))


async def run_acv_on_existing_job(job_id: str, run_dir: Path, client: EVIClient) -> PipelineResult:
    """Run ACV (Verify, Audit, Compliance) on an existing job ID"""
    result = PipelineResult("reuse")
    result.job_id = job_id
    
    verify_dir = run_dir / "verify"
    audit_dir = run_dir / "audit"
    compliance_dir = run_dir / "compliance"
    
    for d in [verify_dir, audit_dir, compliance_dir]:
        ensure_dir(d)
    
    print(color(f"\nReusing existing job: {job_id}", Colors.CYAN))
    
    # Verify
    print(f"\n{color('▶ Verifying Contract...', Colors.YELLOW)}")
    try:
        verify_resp = await client.verify_by_job(job_id, NETWORK)
        write_json(verify_dir / "byJob.response.json", verify_resp)
        if verify_resp.get("verified"):
            print(color(f"✅ Verified: {verify_resp.get('explorerUrl', '')}", Colors.GREEN))
            result.verify = {"verified": True, "url": verify_resp.get("explorerUrl")}
    except Exception as e:
        print(color(f"Verify error: {e}", Colors.YELLOW))
    
    # Audit
    print(f"\n{color('▶ Running Security Audit...', Colors.YELLOW)}")
    try:
        audit_start = await client.audit_orchestrate(job_id=job_id, network=NETWORK)
        audit_job_id = audit_start.get("job", {}).get("id")
        if audit_job_id:
            await client.wait_for_job_completion(audit_job_id, timeout=300.0)
            audit_report = await client.get_audit_report(job_id)
            if audit_report:
                write_json(audit_dir / "report.json", audit_report)
                score = audit_report.get("score") or audit_report.get("data", {}).get("score")
                print(color(f"✅ Audit Score: {score}/100", Colors.GREEN))
                result.audit = {"score": score}
    except Exception as e:
        print(color(f"Audit error: {e}", Colors.YELLOW))
    
    # Compliance
    print(f"\n{color('▶ Running Compliance Check...', Colors.YELLOW)}")
    try:
        comp_start = await client.compliance_orchestrate(job_id=job_id, target_profile="generic", network=NETWORK)
        comp_job_id = comp_start.get("job", {}).get("id")
        if comp_job_id:
            await client.wait_for_job_completion(comp_job_id, timeout=300.0)
            comp_report = await client.get_compliance_report(job_id)
            if comp_report:
                write_json(compliance_dir / "report.json", comp_report)
                score = comp_report.get("score") or comp_report.get("data", {}).get("score")
                print(color(f"✅ Compliance Score: {score}/100", Colors.GREEN))
                result.compliance = {"score": score}
    except Exception as e:
        print(color(f"Compliance error: {e}", Colors.YELLOW))
    
    result.success = True
    return result


def print_usage():
    print(f"""
{color('ACV Test Logic - Game Smart Contract Pipeline + Audit + Compliance', Colors.CYAN + Colors.BOLD)}

{color('Usage:', Colors.BOLD)}
  python test_acv_full_pipeline.py [options]

{color('Options:', Colors.BOLD)}
  --game <type>     Select a game template (see list below)
  --job <id>        Reuse an existing job ID (skip pipeline)
  --all             Run all game templates sequentially
  --list            List available game templates
  --help            Show this help message

{color('Available Game Templates:', Colors.BOLD)}
""")
    for k, v in GAME_TEMPLATES.items():
        print(f"  {color(k.ljust(15), Colors.GREEN)} → {v['expected_type'].ljust(12)} ({v['contract_name']})")
    
    print(f"""
{color('Environment Variables:', Colors.BOLD)}
  EVI_API_BASE_URL  API endpoint (default: {API_BASE})
  EVI_NETWORK       Target network (default: {NETWORK})
  EVI_MAX_ITERS     Max fix iterations (default: {MAX_ITERS})
  OUTPUT_DIR        Output directory (default: {OUTPUT_ROOT})

{color('Examples:', Colors.BOLD)}
  python test_acv_full_pipeline.py --game tic-tac-toe
  python test_acv_full_pipeline.py --all
  python test_acv_full_pipeline.py --job ai_pipeline_abc123
  python test_acv_full_pipeline.py --list
""")


async def main():
    args = sys.argv[1:]
    
    def get_arg(name: str) -> Optional[str]:
        try:
            idx = args.index(name)
            if idx + 1 < len(args):
                return args[idx + 1]
        except ValueError:
            pass
        return None
    
    def has_flag(name: str) -> bool:
        return name in args
    
    if has_flag("--help") or has_flag("-h"):
        print_usage()
        return
    
    if has_flag("--list"):
        print(color("\nAvailable Game Templates:", Colors.CYAN + Colors.BOLD))
        for k, v in GAME_TEMPLATES.items():
            print(f"  {color(k.ljust(15), Colors.GREEN)} → {color(v['expected_type'].ljust(12), Colors.YELLOW)} ({v['contract_name']})")
        return
    
    reuse_job_id = get_arg("--job")
    selected_game = get_arg("--game")
    run_all = has_flag("--all")
    
    print(color("\n╔══════════════════════════════════════════════════════════════╗", Colors.CYAN))
    print(color("║     ACV Test Logic - Game Smart Contract Pipeline            ║", Colors.CYAN + Colors.BOLD))
    print(color("╚══════════════════════════════════════════════════════════════╝", Colors.CYAN))
    print(f"API_BASE_URL = {color(API_BASE, Colors.GRAY)}")
    print(f"NETWORK      = {color(NETWORK, Colors.GRAY)}")
    print(f"MAX_ITERS    = {color(str(MAX_ITERS), Colors.GRAY)}")
    print(f"OUTPUT_DIR   = {color(str(OUTPUT_ROOT), Colors.GRAY)}")
    
    async with EVIClient(base_url=API_BASE, network=NETWORK, max_iters=MAX_ITERS) as client:
        
        if reuse_job_id:
            # Run ACV on existing job
            run_name = f"{stamp()}-reuse"
            run_dir = OUTPUT_ROOT / run_name
            result = await run_acv_on_existing_job(reuse_job_id, run_dir, client)
            write_json(run_dir / "summary.json", result.to_dict())
            print(color(f"\nACV flow complete. Outputs saved under: {run_dir}", Colors.GREEN))
            return
        
        # Determine games to run
        games_to_run = []
        if run_all:
            games_to_run = list(GAME_TEMPLATES.keys())
        elif selected_game:
            if selected_game not in GAME_TEMPLATES:
                print(color(f"Unknown game: {selected_game}. Use --list to see available games.", Colors.RED))
                sys.exit(1)
            games_to_run = [selected_game]
        else:
            # Default: run tic-tac-toe
            games_to_run = ["tic-tac-toe"]
        
        # Run each game
        results = []
        for game_key in games_to_run:
            game_config = GAME_TEMPLATES[game_key]
            run_name = f"{stamp()}-{game_key}"
            run_dir = OUTPUT_ROOT / run_name
            ensure_dir(run_dir)
            
            result = await run_full_acv_pipeline(game_key, game_config, run_dir, client)
            results.append(result)
            
            write_json(run_dir / "summary.json", result.to_dict())
        
        # Print final summary
        print(color("\n╔══════════════════════════════════════════════════════════════╗", Colors.CYAN))
        print(color("║                    FINAL SUMMARY                             ║", Colors.CYAN + Colors.BOLD))
        print(color("╚══════════════════════════════════════════════════════════════╝", Colors.CYAN))
        print()
        
        for r in results:
            status = color("✅ SUCCESS", Colors.GREEN) if r.success else color("❌ FAILED", Colors.RED)
            audit = f"Audit: {r.audit.get('score', 'N/A')}" if r.audit else "Audit: N/A"
            comp = f"Compliance: {r.compliance.get('score', 'N/A')}" if r.compliance else "Compliance: N/A"
            verify = "✓ Verified" if r.verify.get("verified") else "✗ Not Verified"
            
            print(f"  {r.game_key.ljust(15)} {status}  {audit}  {comp}  {verify}")
            if r.contract_address:
                print(f"    └─ Contract: {r.contract_address}")
                print(f"    └─ Explorer: {r.explorer_url}")
        
        print()
        print(color(f"Outputs saved under: {OUTPUT_ROOT}", Colors.GRAY))


if __name__ == "__main__":
    asyncio.run(main())
