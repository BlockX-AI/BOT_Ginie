#@title 🔎 Enhanced Diagnostics Fetcher (Colab Ready)

import os, re, json, time, csv, requests
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

# -------------------------
# Config (edit here or with Colab params)
# -------------------------
API_BASE_URL = "https://acadcodegen-production.up.railway.app"  #@param {type:"string"}
API_KEY = ""  #@param {type:"string"}
OUT_DIR = str(Path(__file__).parent)  # Save directly under Failure Logs root
PAUSE_MS = 300  #@param {type:"integer"}
MAX_LOG_REQUESTS = 50  #@param {type:"integer"}
ALL_LOGS = False  #@param {type:"boolean"}

# Jobs to fetch
JOB_IDS = [
    "ai_pipeline_1f9e87ee-2887-4941-acfd-3519eef88287",  # SafeTreasuryTimelock
    "ai_pipeline_ce68981d-d2b1-441d-81c7-83be8f9c3e17",  # NFTDutchAuctionMarket
    "ai_pipeline_55fdcaaf-2f8b-4c9e-8f3f-c6f3f3a85d09",  # MiniLendingPool
    "ai_pipeline_967c8f73-8694-4acb-b045-bef4780dbc43",  # OnChainGovernorDAO
    "ai_pipeline_087f7670-8d71-44cb-b2bf-3cb012519e0e",  # VestingVaultMulti
    "ai_pipeline_f841e96b-bfe2-4697-be94-49b58a7ab90b",  # MerkleCrowdsale
    "ai_pipeline_ee0ca038-9818-4b7b-a8cd-da1f75ff4811",  # AttestationRegistry
    "ai_pipeline_d049efea-2bd8-4f8c-a8c6-f72360e3de5f",  # OrderBookDEX
    "ai_pipeline_d3cb309d-22f2-47d2-bcbc-eee20e16159f",  # OracleGuardedVault
]

api_base_url = API_BASE_URL.rstrip("/")
api_key = API_KEY
out_dir = Path(OUT_DIR)
out_dir.mkdir(parents=True, exist_ok=True)

# -------------------------
# HTTP Helpers
# -------------------------
def headers():
    h = {"Accept": "application/json"}
    if api_key:
        h["Authorization"] = f"Bearer {api_key}"
    return h

def _get(path: str, params=None, timeout=60):
    url = f"{api_base_url}{path}"
    r = requests.get(url, params=params or {}, headers=headers(), timeout=timeout)
    r.raise_for_status()
    try:
        return r.json()
    except Exception:
        return {"raw": r.text}

def with_retry(fn, label, retries=3, delay_sec=1.2):
    last = None
    for i in range(retries):
        try:
            return fn()
        except Exception as e:
            last = e
            body = getattr(getattr(e, "response", None), "text", str(e))
            print(f"[retry] {label}: attempt {i+1} failed → {body[:300]}")
            time.sleep(delay_sec * (i + 1))
    raise last

# -------------------------
# API Wrappers
# -------------------------
def api_status(job_id): return with_retry(lambda: _get(f"/api/job/{job_id}/status"), f"status {job_id}")
def api_logs_once(job_id, since): return with_retry(lambda: _get(f"/api/job/{job_id}/logs", {"since": since}), f"logs {job_id}")
def api_artifacts_all(job_id): return with_retry(lambda: _get("/api/artifacts", {"include":"all","jobId":job_id}), f"artifacts {job_id}")

# -------------------------
# Log Pagination
# -------------------------
def fetch_all_logs(job_id):
    since, all_logs, no_growth, attempts = 0, [], 0, 0
    while attempts < MAX_LOG_REQUESTS:
        attempts += 1
        resp = api_logs_once(job_id, since)
        batch = (resp or {}).get("data",{}).get("logs",[]) or []
        if batch:
            all_logs.extend(batch)
            since = len(all_logs)
            no_growth = 0
        else:
            no_growth += 1
        if no_growth >= (2 if ALL_LOGS else 1): break
        time.sleep(PAUSE_MS/1000.0)
    return all_logs

# -------------------------
# Failure Reason Extraction
# -------------------------
def extract_reason(logs: List[Dict[str, Any]]) -> Tuple[str,str]:
    for e in reversed(logs):
        lvl,msg = e.get("level","").lower(), str(e.get("msg","")).strip()
        if lvl=="error": return "error", msg
    for e in reversed(logs):
        msg=str(e.get("msg","")).lower()
        if any(k in msg for k in ("compile","type error","parse")): return "compiler", e["msg"]
        if any(k in msg for k in ("deploy","constructor","gas")): return "deploy", e["msg"]
        if any(k in msg for k in ("revert","panic","invalid opcode","stack")): return "runtime", e["msg"]
    return "unknown","Unable to infer reason"

# -------------------------
# Per-job Runner
# -------------------------
def run_job(job_id):
    jd = out_dir / job_id
    jd.mkdir(parents=True, exist_ok=True)

    # 1) Status
    try:
        status = api_status(job_id)
        (jd/"status.json").write_text(json.dumps(status, indent=2))
    except Exception as e:
        status = {"error": str(e)}

    # 2) Logs
    logs = []
    try:
        logs = fetch_all_logs(job_id)
        (jd/"logs.json").write_text(json.dumps({"logs": logs}, indent=2))
        (jd/"logs.txt").write_text("\n".join(f"[{l.get('level','info')}] {l.get('msg','')}" for l in logs))
    except Exception as e:
        (jd/"logs.error.json").write_text(str(e))

    # 3) Artifacts
    try:
        arts = api_artifacts_all(job_id)
        (jd/"artifacts.all.json").write_text(json.dumps(arts, indent=2))
    except Exception as e:
        (jd/"artifacts.error.json").write_text(str(e))

    # 4) Failure reason
    category, reason = extract_reason(logs)

    # 5) Summary
    summary = {
        "jobId": job_id,
        "state": (status.get("data") or {}).get("state"),
        "step": (status.get("data") or {}).get("step"),
        "category": category,
        "reason": reason,
        "logLines": len(logs)
    }
    (jd/"summary.json").write_text(json.dumps(summary, indent=2))
    return summary

# -------------------------
# Main Run
# -------------------------
summaries = []
for job in JOB_IDS:
    print(f"\n=== {job} ===")
    try:
        s = run_job(job)
        print(f"{s['state']} | {s['step']} | {s['category']} → {s['reason'][:100]}")
        summaries.append(s)
    except Exception as e:
        print("error:", e)
        summaries.append({"jobId": job, "error": str(e)})

# Save combined outputs
(out_dir/"index.json").write_text(json.dumps({"jobs": summaries}, indent=2))
with open(out_dir/"index.csv","w",newline="",encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=list(summaries[0].keys()))
    writer.writeheader()
    for s in summaries: writer.writerow(s)

print("\nDone. Results saved under:", out_dir)

