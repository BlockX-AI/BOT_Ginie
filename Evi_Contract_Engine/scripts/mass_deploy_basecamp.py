# %% [markdown]
# # One-Pager: Mass Smart-Contract Deployment to Basecamp Network (20 DApps)
# Submits many diverse prompts to /api/ai/pipeline, polls /api/job/{id}/status,
# logs to console+file, and writes detailed Markdown report with failure analysis.
# Prints a status line per job:
# - ✅ <name>: <address> | <explorer link>
# - ❌ <name>: <reason>


# %% ---------------------- CONFIG (CONFIGURED FOR BASECAMP) ----------------------
MODE          = "deploy20"      # Deploy 20 DApps to Basecamp
BASE_URL      = "https://acadcodegen-production.up.railway.app"
POLL_INTERVAL = 3               # seconds between polls
TIMEOUT       = 600             # per job (seconds)
COUNT         = 20              # Deploy 20 DApps
BATCH_SLEEP   = 2.0             # delay between submissions (seconds) - slightly longer for stability
RESULTS_MD    = "basecamp_deploy_results.md"
MAX_ITERS     = 6               # pipeline internal passes per job
NETWORK       = "basecamp"      # Changed to basecamp network


# %% ---------------------- IMPLEMENTATION ----------------------
import os, time, json, logging, random, math, requests
from pathlib import Path
from datetime import datetime, timezone


LOG_DIR = Path("logs"); LOG_DIR.mkdir(exist_ok=True)
TMP_DIR = Path("tmp");  TMP_DIR.mkdir(exist_ok=True)


# Enhanced Logger with more detailed formatting
logger = logging.getLogger("mass_deploy_basecamp"); logger.setLevel(logging.DEBUG); logger.handlers.clear()
fmt = logging.Formatter("[%(asctime)s] %(levelname)-8s | %(name)s | %(message)s")
sh = logging.StreamHandler(); sh.setFormatter(fmt); sh.setLevel(logging.INFO)
fh = logging.FileHandler(LOG_DIR / "basecamp_deploy.log"); fh.setFormatter(fmt); fh.setLevel(logging.DEBUG)
logger.addHandler(sh); logger.addHandler(fh)
log = lambda m, lvl=logging.INFO: logger.log(lvl, m)


def now_utc(): return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")


def write_md(line): 
    Path(RESULTS_MD).open("a", encoding="utf-8").write(line + "\n")


def reset_md():
    with Path(RESULTS_MD).open("w", encoding="utf-8") as f:
        f.write("# Mass Deploy Results - Basecamp Network\n\n")
        f.write(f"**Started:** {now_utc()}\n")
        f.write(f"**Server:** {BASE_URL}\n")
        f.write(f"**Target Network:** {NETWORK}\n")
        f.write(f"**Total DApps to Deploy:** {COUNT}\n")
        f.write(f"**Settings:** POLL_INTERVAL={POLL_INTERVAL}s, TIMEOUT={TIMEOUT}s, MAX_ITERS={MAX_ITERS}\n\n")
        f.write("---\n\n")


# Enhanced HTTP with better error handling and logging
def _req_json(method, url, **kwargs):
    tries = 0
    while True:
        try:
            log(f"HTTP {method} {url} (attempt {tries + 1})", logging.DEBUG)
            r = requests.request(method, url, timeout=60, **kwargs)
            r.raise_for_status()
            response_data = r.json()
            log(f"HTTP {method} {url} - Success", logging.DEBUG)
            return response_data
        except requests.exceptions.RequestException as e:
            tries += 1
            if tries >= 5:
                log(f"HTTP {method} {url} - Failed after {tries} attempts: {e}", logging.ERROR)
                raise
            sleep = min(5, 0.5 * (2 ** (tries - 1))) + random.uniform(0, 0.25)
            log(f"HTTP {method} {url} error: {e} (retry {tries} in {sleep:.1f}s)", logging.WARNING)
            time.sleep(sleep)
        except Exception as e:
            tries += 1
            if tries >= 5:
                log(f"HTTP {method} {url} - Unexpected error after {tries} attempts: {e}", logging.ERROR)
                raise
            sleep = min(5, 0.5 * (2 ** (tries - 1))) + random.uniform(0, 0.25)
            log(f"HTTP {method} {url} unexpected error: {e} (retry {tries} in {sleep:.1f}s)", logging.WARNING)
            time.sleep(sleep)


def post_json(url, payload): return _req_json("POST", url, json=payload)
def get_json(url): return _req_json("GET", url)


def _safe_get(d, *keys, default=None):
    cur = d
    for k in keys:
        if not isinstance(cur, dict): return default
        cur = cur.get(k)
        if cur is None: return default
    return cur


def _coerce_dict(x): return x if isinstance(x, dict) else {}


def explorer_url_for(network: str, address: str):
    if not (isinstance(address, str) and address.startswith("0x") and len(address) == 42):
        return None
    net = (network or "").lower()
    if net == "avalanche-fuji":
        return f"https://subnets-test.avax.network/c-chain/address/{address}"
    if net == "basecamp":
        return f"https://basecamp.cloud.blockscout.com/address/{address}"
    return None


# --------------- Enhanced 10 base templates with more variety ---------------
BASE_TEMPLATES = [
    lambda i: {"filename": f"SimpleStorage_{i}.sol", "prompt": f"Solidity ^0.8.21: SimpleStorage{i} with uint256 value; set(uint256) external; get() external view returns(uint256). No external imports."},
    lambda i: {"filename": f"Counter_{i}.sol", "prompt": f"Solidity ^0.8.21: Counter{i} with increment(), decrement(), current() public view returns(int256). Include reset() onlyOwner."},
    lambda i: {"filename": f"Greeter_{i}.sol", "prompt": f"Solidity ^0.8.21: Greeter{i} with constructor(string message), hello() view returns(string). Add onlyOwner setMessage(string) and getOwner()."},
    lambda i: {"filename": f"ERC20_Basic_{i}.sol", "prompt": f"Solidity ^0.8.21: Basic ERC20{i} token using OpenZeppelin; constructor(string name, string symbol, uint256 initialSupply); standard transfer/approve."},
    lambda i: {"filename": f"ERC20_Mintable_{i}.sol", "prompt": f"Solidity ^0.8.21: Mintable ERC20{i} via OpenZeppelin with Ownable; onlyOwner mint(address to, uint256 amount); emit Minted event."},
    lambda i: {"filename": f"ERC721_NFT_{i}.sol", "prompt": f"Solidity ^0.8.21: ERC721{i} NFT via OpenZeppelin + Ownable; constructor(name, symbol); onlyOwner mintTo(address, uint256); tokenURI support."},
    lambda i: {"filename": f"ERC1155_Multi_{i}.sol", "prompt": f"Solidity ^0.8.21: ERC1155{i} multi-token via OpenZeppelin; constructor(string baseURI); onlyOwner mint(address to, uint256 id, uint256 amount)."},
    lambda i: {"filename": f"Vault_Secure_{i}.sol", "prompt": f"Solidity ^0.8.21: Vault{i} for ETH deposits/withdrawals; CEI pattern; ReentrancyGuard; withdrawal fee mechanism and emergency pause."},
    lambda i: {"filename": f"Timelock_Controller_{i}.sol", "prompt": f"Solidity ^0.8.21: Timelock{i} controller with queue/execute/cancel operations; admin role; comprehensive event logging and delay validation."},
    lambda i: {"filename": f"Proxy_UUPS_{i}.sol", "prompt": f"Solidity ^0.8.21: UUPS{i} upgradeable proxy using OpenZeppelin UUPS pattern; Ownable; initialize() pattern with storage slots."},
]


# --------------- Enhanced feature variations ---------------
EXTRA_FEATURES = [
    "Add comprehensive events for all state changes with indexed parameters.",
    "Implement gas-optimized loops and unchecked arithmetic blocks where mathematically safe.",
    "Use custom errors instead of revert strings for better gas efficiency.",
    "Include detailed Natspec documentation on all public/external functions.",
    "Implement role-based access control via OpenZeppelin AccessControl or Ownable.",
    "Add reentrancy guards around all state-changing external calls.",
    "Include Pausable functionality to halt sensitive operations during emergencies.",
    "Add internal invariant checks and require statements for data validation.",
    "Implement circuit breaker pattern for high-value operations.",
    "Use immutable variables for constants to save gas on reads.",
    "Add withdrawal patterns instead of direct transfers for security.",
    "Implement rate limiting for sensitive functions.",
]


def build_payload(i: int) -> dict:
    template = BASE_TEMPLATES[(i - 1) % len(BASE_TEMPLATES)](i)
    # Select 2-5 random features to make each contract unique
    extras = " ".join(random.sample(EXTRA_FEATURES, k=random.randint(2, 5)))
    enhanced_prompt = f"{template['prompt']} {extras}"
    
    payload = {
        "prompt": enhanced_prompt,
        "network": NETWORK,
        "maxIters": MAX_ITERS,
        "filename": template["filename"],
        "constructorArgs": [],
    }
    
    log(f"Built payload for {template['filename']}: {enhanced_prompt[:100]}...", logging.DEBUG)
    return payload


def post_and_poll(name: str, payload: dict):
    start = time.time()
    log(f"=== Starting deployment: {name} ===")
    log(f"Payload: {json.dumps(payload, indent=2)}", logging.DEBUG)
    
    try:
        # Submit job
        data = post_json(f"{BASE_URL}/api/ai/pipeline", payload)
        log(f"Submission response: {json.dumps(data, indent=2)}", logging.DEBUG)


        ok = bool(_safe_get(data, "ok", default=False))
        if not ok:
            error_msg = f"Submission failed - API returned ok=false. Response: {json.dumps(data, indent=2)}"
            log(f"{name}: {error_msg}", logging.ERROR)
            print(f"❌ {name}: submission failed - API returned ok=false", flush=True)
            raise RuntimeError(error_msg)


        # Extract job ID
        job_id = (
            _safe_get(data, "job", "id") or
            _safe_get(data, "jobId") or
            _safe_get(data, "id") or
            _safe_get(data, "data", "job", "id")
        )
        if not job_id:
            error_msg = f"Missing job ID in response: {json.dumps(data, indent=2)}"
            log(f"{name}: {error_msg}", logging.ERROR)
            print(f"❌ {name}: missing job ID", flush=True)
            raise RuntimeError(error_msg)


        log(f"{name}: Job submitted successfully with ID: {job_id}")


        # Enhanced polling with detailed status tracking
        state, step, progress = "pending", "", 0
        last_status = {}
        poll_count = 0
        
        while True:
            poll_count += 1
            elapsed = time.time() - start
            
            if elapsed > TIMEOUT:
                error_msg = f"Timeout after {elapsed:.1f}s waiting for job {job_id}"
                log(f"{name}: {error_msg}", logging.ERROR)
                print(f"❌ {name}: timeout ({elapsed:.1f}s)", flush=True)
                raise TimeoutError(error_msg)


            try:
                status = get_json(f"{BASE_URL}/api/job/{job_id}/status")
                last_status = status
                d = _coerce_dict(status.get("data", {}))
                
                new_state = d.get("state", state) or state
                new_step = d.get("step", "") or ""
                new_progress = d.get("progress", progress) or progress
                
                # Log state changes
                if new_state != state or new_step != step or new_progress != progress:
                    log(f"{name}: Poll #{poll_count} - state={new_state}, step='{new_step}', progress={new_progress}, elapsed={elapsed:.1f}s")
                
                state, step, progress = new_state, new_step, new_progress
                
                if state in ("completed", "failed"):
                    # Save detailed status for analysis
                    status_file = TMP_DIR / f"{job_id}_status.json"
                    status_file.write_text(json.dumps(status, indent=2), encoding="utf-8")
                    log(f"{name}: Final state '{state}' reached. Status saved to {status_file}")
                    break
                    
            except Exception as e:
                log(f"{name}: Poll #{poll_count} error: {e}", logging.WARNING)
                
            time.sleep(POLL_INTERVAL)


        # Enhanced result processing and failure analysis
        d = _coerce_dict(last_status.get("data", {}))
        result = _coerce_dict(d.get("result", {}))
        payload_back = _coerce_dict(d.get("payload", {}))


        address = result.get("address") or ""
        network = result.get("network") or payload_back.get("network") or payload.get("network", NETWORK)
        error = d.get("error") or ""
        contract = result.get("contract") or ""
        fq_name = result.get("fqName") or ""
        filename = payload_back.get("filename") or payload.get("filename", "")
        args = _safe_get(result, "params", "args", default=None)
        if args is None:
            args = payload_back.get("constructorArgs") or payload.get("constructorArgs") or []


        explorer = address and explorer_url_for(network, address)
        outcome = "Success" if state == "completed" and address else "Failed"
        
        # Enhanced failure reason extraction
        failure_reason = ""
        if outcome == "Failed":
            if error:
                failure_reason = error
            elif state == "failed":
                failure_reason = "Job marked as failed by server"
            elif state == "completed" and not address:
                failure_reason = "Completed but no contract address returned"
            else:
                failure_reason = f"Unknown failure (state: {state})"


        # Print concise status line
        if outcome == "Success" and address:
            print(f"✅ {name}: {address} | {explorer or '(no explorer)'}", flush=True)
            log(f"{name}: SUCCESS - Contract deployed at {address}")
        else:
            print(f"❌ {name}: {failure_reason}", flush=True)
            log(f"{name}: FAILED - {failure_reason}", logging.ERROR)


        elapsed_total = int(time.time() - start)
        
        # Enhanced Markdown report with failure analysis
        write_md(f"### {name}")
        write_md(f"**Status:** {outcome}")
        write_md(f"**Duration:** {elapsed_total}s")
        write_md(f"**Job ID:** `{job_id}`")
        write_md(f"**Network:** {network}")
        write_md(f"**Final State:** {state}")
        if step:
            write_md(f"**Final Step:** {step}")
        write_md(f"**Progress:** {progress}")
        
        # Contract details (success case)
        if outcome == "Success":
            write_md(f"**✅ Contract Address:** `{address}`")
            if explorer:
                write_md(f"**🔍 Explorer Link:** [{address}]({explorer})")
            if contract:
                write_md(f"**Contract Name:** {contract}")
            if fq_name:
                write_md(f"**Fully Qualified Name:** {fq_name}")
        
        # Failure analysis (failure case)
        if outcome == "Failed":
            write_md(f"**❌ Failure Reason:** {failure_reason}")
            if error:
                write_md(f"**Error Details:** ```{error}```")
            # Log full status for debugging
            write_md(f"**Debug Info:** Job final status saved to `tmp/{job_id}_status.json`")
        
        write_md(f"**Filename:** {filename}")
        write_md(f"**Constructor Args:** `{json.dumps(args)}`")
        
        # Log the prompt used
        prompt_str = payload_back.get("prompt") or payload.get("prompt", "")
        write_md(f"**Prompt Used:**")
        write_md(f"```")
        write_md(f"{prompt_str}")
        write_md(f"```")
        
        write_md(f"**Timestamps:**")
        write_md(f"- Started: {datetime.fromtimestamp(start).strftime('%Y-%m-%d %H:%M:%S')}")
        write_md(f"- Finished: {datetime.fromtimestamp(start + elapsed_total).strftime('%Y-%m-%d %H:%M:%S')}")
        
        write_md("\n---\n")


        return {
            "name": name,
            "state": state, 
            "outcome": outcome, 
            "address": address,
            "explorer": explorer, 
            "job_id": job_id, 
            "filename": filename,
            "error": error,
            "failure_reason": failure_reason,
            "duration_s": elapsed_total,
            "poll_count": poll_count
        }
        
    except Exception as e:
        elapsed = int(time.time() - start)
        error_msg = str(e)
        log(f"{name}: Exception during deployment: {error_msg}", logging.ERROR)
        print(f"❌ {name}: {error_msg}", flush=True)
        
        # Log failed job to markdown too
        write_md(f"### {name}")
        write_md(f"**Status:** Failed (Exception)")
        write_md(f"**Duration:** {elapsed}s")
        write_md(f"**❌ Exception:** {error_msg}")
        write_md(f"**Filename:** {payload.get('filename', 'unknown')}")
        write_md("\n---\n")
        
        return {
            "name": name,
            "state": "exception", 
            "outcome": "Failed", 
            "address": "",
            "explorer": "", 
            "job_id": "", 
            "filename": payload.get("filename", ""),
            "error": error_msg,
            "failure_reason": f"Exception: {error_msg}",
            "duration_s": elapsed,
            "poll_count": 0
        }


def run_one(i: int):
    payload = build_payload(i)
    contract_name = payload['filename'].split('.')[0]
    return post_and_poll(f"{i:02d}) {contract_name}", payload)


def run_batch(count: int):
    log(f"🚀 STARTING BATCH DEPLOYMENT TO BASECAMP NETWORK")
    log(f"Target: {count} DApps | Server: {BASE_URL} | Network: {NETWORK}")
    log(f"Timeout: {TIMEOUT}s per job | Poll interval: {POLL_INTERVAL}s")
    
    results = []
    success_count = 0
    failure_count = 0
    
    for i in range(1, count + 1):
        log(f"\n--- Deploying DApp {i}/{count} ---")
        try:
            result = run_one(i)
            results.append(result)
            
            if result["outcome"] == "Success":
                success_count += 1
            else:
                failure_count += 1
                
        except Exception as e:
            failure_count += 1
            log(f"DApp #{i} deployment failed with exception: {e}", logging.ERROR)
            print(f"❌ #{i}: {e}", flush=True)
            
            # Add failed result to list
            results.append({
                "name": f"{i:02d}) Unknown",
                "state": "exception",
                "outcome": "Failed",
                "address": "",
                "explorer": "",
                "job_id": "",
                "filename": "",
                "error": str(e),
                "failure_reason": f"Deployment exception: {e}",
                "duration_s": 0,
                "poll_count": 0
            })
        
        # Sleep between deployments to avoid overwhelming the server
        if i < count:  # Don't sleep after the last one
            log(f"Sleeping {BATCH_SLEEP}s before next deployment...")
            time.sleep(BATCH_SLEEP + random.uniform(0.0, 0.5))
    
    log(f"\n🏁 BATCH COMPLETE: {success_count} successes, {failure_count} failures out of {count} total")
    return results


def generate_summary_report(results, total_duration):
    """Generate a comprehensive summary at the end of the markdown report"""
    
    successes = [r for r in results if r["outcome"] == "Success"]
    failures = [r for r in results if r["outcome"] == "Failed"]
    
    write_md("## 📊 DEPLOYMENT SUMMARY")
    write_md(f"**Total DApps Attempted:** {len(results)}")
    write_md(f"**✅ Successful Deployments:** {len(successes)}")
    write_md(f"**❌ Failed Deployments:** {len(failures)}")
    write_md(f"**Success Rate:** {len(successes)/len(results)*100:.1f}%")
    write_md(f"**Total Time:** {total_duration}s ({total_duration//60}m {total_duration%60}s)")
    write_md("")
    
    if successes:
        write_md("### ✅ Successful Deployments")
        for r in successes:
            explorer_link = f" | [Explorer]({r['explorer']})" if r['explorer'] else ""
            write_md(f"- **{r['name']}**: `{r['address']}`{explorer_link}")
        write_md("")
    
    if failures:
        write_md("### ❌ Failed Deployments Analysis")
        
        # Group failures by reason
        failure_groups = {}
        for r in failures:
            reason = r.get("failure_reason", "Unknown")
            if reason not in failure_groups:
                failure_groups[reason] = []
            failure_groups[reason].append(r)
        
        write_md("**Failure Breakdown by Reason:**")
        for reason, failed_jobs in failure_groups.items():
            write_md(f"- **{reason}:** {len(failed_jobs)} job(s)")
            for job in failed_jobs:
                write_md(f"  - {job['name']} (Job ID: `{job.get('job_id', 'N/A')}`)")
        write_md("")
        
        write_md("**All Failed Jobs:**")
        for r in failures:
            duration_str = f" | {r['duration_s']}s" if r['duration_s'] > 0 else ""
            write_md(f"- **{r['name']}**: {r['failure_reason']}{duration_str}")
        write_md("")


def main(mode=MODE):
    reset_md()
    start_time = time.time()
    
    log(f"🎯 MASS DEPLOYMENT STARTING")
    log(f"Mode: {mode} | Network: {NETWORK} | Base URL: {BASE_URL}")
    
    results = []
    
    if mode == "all10":
        log("Running all 10 template types once...")
        for i in range(1, 11):
            try:
                results.append(run_one(i))
            except Exception as e:
                log(f"Template #{i} failed: {e}", logging.ERROR)
                print(f"❌ #{i}: {e}", flush=True)
            time.sleep(BATCH_SLEEP + random.uniform(0.0, 0.4))
                
    elif mode == "deploy20":
        log(f"Running batch deployment of {COUNT} DApps...")
        results = run_batch(COUNT)
        
    elif isinstance(mode, list):
        log(f"Running specific deployments: {mode}")
        for a in mode:
            try:
                results.append(run_one(int(a)))
            except Exception as e:
                log(f"Deployment #{a} failed: {e}", logging.ERROR)
                print(f"❌ #{a}: {e}", flush=True)
            time.sleep(BATCH_SLEEP)
            
    else:
        raise ValueError(f"Unknown MODE: {mode}")
    
    total_duration = int(time.time() - start_time)
    
    # Generate comprehensive summary
    generate_summary_report(results, total_duration)
    
    write_md(f"\n**Deployment Completed:** {now_utc()}")
    write_md(f"**Total Duration:** {total_duration}s")
    
    log(f"🎉 DEPLOYMENT COMPLETE")
    log(f"Results written to {RESULTS_MD}")
    log(f"Detailed logs in {LOG_DIR / 'basecamp_deploy.log'}")
    
    # Print final summary to console
    successes = len([r for r in results if r["outcome"] == "Success"])
    failures = len([r for r in results if r["outcome"] == "Failed"])
    
    print(f"\n🎉 FINAL SUMMARY:")
    print(f"✅ Successful: {successes}")
    print(f"❌ Failed: {failures}")
    print(f"📊 Success Rate: {successes/(successes+failures)*100:.1f}%")
    print(f"⏱️ Total Time: {total_duration}s")
    
    return {
        "duration_s": total_duration, 
        "results_md": str(Path(RESULTS_MD)), 
        "log_file": str(LOG_DIR / 'basecamp_deploy.log'),
        "total_jobs": len(results),
        "successes": successes,
        "failures": failures,
        "success_rate": successes/(successes+failures)*100 if results else 0,
        "results": results
    }


# ---------------------- RUN THE DEPLOYMENT ----------------------
print("🚀 Starting mass deployment to Basecamp network...")
print(f"Target: {COUNT} DApps | Network: {NETWORK}")
print(f"This will take approximately {(COUNT * (BATCH_SLEEP + 30)) // 60} minutes")
print("=" * 60)


summary = main(MODE)


print("=" * 60)
print("📋 DEPLOYMENT COMPLETE!")
print(f"📄 Detailed report: ./{RESULTS_MD}")
print(f"📋 Full logs: ./logs/basecamp_deploy.log")
print(f"📁 Job status files: ./tmp/")
print("=" * 60)
