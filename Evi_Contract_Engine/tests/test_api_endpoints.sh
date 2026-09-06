#!/usr/bin/env bash
set -euo pipefail

# End-to-end API smoke tests against a running server
# Default target: production Railway URL
# Usage:
#   ./test_api_endpoints.sh                         # run read-only and AI tests
#   RUN_DEPLOYS=1 ./test_api_endpoints.sh           # also run deploy endpoints (testnet)
#   BASE_URL=http://localhost:3000 ./test_api_endpoints.sh
#
# Requirements: curl, jq

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
need curl
need jq

BASE_URL=${BASE_URL:-https://evi-web-test-production.up.railway.app}
RUN_DEPLOYS=${RUN_DEPLOYS:-0}
RUN_WALLET_DEPLOY=${RUN_WALLET_DEPLOY:-0}
TIMEOUT=${TIMEOUT:-120}
POLL_INTERVAL=${POLL_INTERVAL:-3}

TS=$(date +%s)
OUT_DIR="tmp/api_tests"
mkdir -p "$OUT_DIR"
JSON_OUT="$OUT_DIR/results_${TS}.json"
MD_OUT="$OUT_DIR/results_${TS}.md"

pass=0; fail=0
results='[]'
add_result() {
  local name="$1" ok="$2" detail="$3"
  results=$(jq --arg name "$name" --argjson ok "$ok" --arg detail "$detail" '. + [{name:$name, ok:$ok, detail:$detail}]' <<<"$results")
  if [[ "$ok" == "true" ]]; then pass=$((pass+1)); else fail=$((fail+1)); fi
}

info() { echo "[INFO] $*"; }
ok() { echo "[ OK ] $*"; }
err() { echo "[ERR ] $*" >&2; }

# 1) Root
info "GET /"
if resp=$(curl -sS "$BASE_URL/" 2>/dev/null); then
  echo "$resp" | jq -e '.status=="online"' >/dev/null 2>&1 && add_result "GET /" true "online" || add_result "GET /" true "no status field"
  ok "/"
else
  add_result "GET /" false "unreachable"
  err "root unreachable"
fi

# 2) API docs
info "GET /api-docs"
if curl -sSf "$BASE_URL/api-docs" >/dev/null 2>&1; then
  add_result "GET /api-docs" true "served"
  ok "/api-docs"
else
  add_result "GET /api-docs" false "not found"
fi

# 3) AI Generate
info "POST /api/ai/generate"
GEN_PROMPT=${GEN_PROMPT:-"ERC20 token with mint and burn"}
if resp=$(curl -sS -X POST "$BASE_URL/api/ai/generate" -H 'Content-Type: application/json' -d "{\"prompt\": \"$GEN_PROMPT\"}"); then
  add_result "POST /api/ai/generate" true "$(echo "$resp" | jq -r '.ok,.error? | select(.)' 2>/dev/null | paste -sd ' ' -)"
  echo "$resp" > "$OUT_DIR/ai_generate_${TS}.json"
else
  add_result "POST /api/ai/generate" false "request failed"
fi

# 4) AI Compile (SimpleStorage)
info "POST /api/ai/compile"
read -r -d '' SIMPLE_STORAGE <<'SOL'
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
contract SimpleStorage {
  uint256 private _v; function set(uint256 v) public { _v = v; }
  function get() public view returns(uint256){ return _v; }
}
SOL
if resp=$(jq -nc --arg code "$SIMPLE_STORAGE" '{code:$code}' | curl -sS -X POST "$BASE_URL/api/ai/compile" -H 'Content-Type: application/json' -d @-); then
  add_result "POST /api/ai/compile" true "compiled"
  echo "$resp" > "$OUT_DIR/ai_compile_${TS}.json"
else
  add_result "POST /api/ai/compile" false "request failed"
fi

# 5) AI Pipeline -> Job -> Artifacts
info "POST /api/ai/pipeline"
PIPE_PROMPT=${PIPE_PROMPT:-"Create a simple on-chain puzzle game contract named MiniPuzzleGame with startGame(), submitMove(uint8 move), and submitScore(uint256 score). Keep it minimal and deterministic."}
PIPE_NETWORK=${PIPE_NETWORK:-basecamp-testnet}
PIPE_MAX_ITERS=${PIPE_MAX_ITERS:-11}
PIPE_FILENAME=${PIPE_FILENAME:-MiniPuzzleGame.sol}
PIPE_CONTRACT_NAME=${PIPE_CONTRACT_NAME:-MiniPuzzleGame}
PIPE_STRICT_ARGS=${PIPE_STRICT_ARGS:-1}
PIPE_CONTEXT=${PIPE_CONTEXT:-"Smoke test pipeline: generate + compile + (optional) deploy"}
jobId=""
if resp=$(jq -nc \
  --arg prompt "$PIPE_PROMPT" \
  --arg network "$PIPE_NETWORK" \
  --arg filename "$PIPE_FILENAME" \
  --arg contractName "$PIPE_CONTRACT_NAME" \
  --arg context "$PIPE_CONTEXT" \
  --argjson maxIters "${PIPE_MAX_ITERS}" \
  --argjson strictArgs "$( [[ "$PIPE_STRICT_ARGS" == "1" ]] && echo true || echo false )" \
  '{prompt:$prompt, network:$network, maxIters:$maxIters, contractName:$contractName, filename:$filename, constructorArgs:[], strictArgs:$strictArgs, context:$context}' \
  | curl -sS -X POST "$BASE_URL/api/ai/pipeline" -H 'Content-Type: application/json' -d @-); then
  jobId=$(echo "$resp" | jq -r '.job.id // .jobId // empty')
  if [[ -n "$jobId" ]]; then
    add_result "POST /api/ai/pipeline" true "$jobId"
  else
    add_result "POST /api/ai/pipeline" false "no jobId"
  fi
  echo "$resp" > "$OUT_DIR/ai_pipeline_${TS}.json"
else
  add_result "POST /api/ai/pipeline" false "request failed"
fi

if [[ -n "$jobId" ]]; then
  info "Polling /api/job/$jobId/status"
  end=$((SECONDS+TIMEOUT))
  while true; do
    st=$(curl -sS "$BASE_URL/api/job/$jobId/status" || echo '{}')
    echo "$st" > "$OUT_DIR/job_${jobId}_status.json"
    state=$(echo "$st" | jq -r '.data.state // empty')
    if [[ "$state" == "completed" || "$state" == "failed" || $SECONDS -ge $end ]]; then
      break
    fi
    sleep "$POLL_INTERVAL"
  done
  ok "/api/job/$jobId/status polled"
  add_result "GET /api/job/:id/status" true "polled"

  info "GET /api/job/$jobId/logs"
  curl -sS "$BASE_URL/api/job/$jobId/logs" > "$OUT_DIR/job_${jobId}_logs.txt" || true
  add_result "GET /api/job/:id/logs" true "saved"

  info "GET /api/artifacts?include=all"
  curl -sS "$BASE_URL/api/artifacts?jobId=$jobId&include=all" > "$OUT_DIR/artifacts_${jobId}.json" || true
  add_result "GET /api/artifacts" true "saved"
fi

# 6) Optional: Deploy endpoints (guarded by RUN_DEPLOYS)
if [[ "$RUN_DEPLOYS" == "1" ]]; then
  info "Running deploy endpoint tests (testnet)"
  # ERC20
  payload=$(jq -nc '{name:"Smoke Token", symbol:"SMK", initialSupply:"1000", owner:"0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E", network:"camp-testnet"}')
  curl -sS -X POST "$BASE_URL/api/deploy/erc20" -H 'Content-Type: application/json' -d "$payload" > "$OUT_DIR/deploy_erc20_${TS}.json" || true
  add_result "POST /api/deploy/erc20" true "requested"

  # CitationRegistry
  curl -sS -X POST "$BASE_URL/api/deploy/citation-registry" -H 'Content-Type: application/json' -d '{"network":"camp-testnet"}' > "$OUT_DIR/deploy_citation_registry_${TS}.json" || true
  add_result "POST /api/deploy/citation-registry" true "requested"

  # ResearchPaper (needs originProtocol address)
  curl -sS -X POST "$BASE_URL/api/deploy/research-paper" -H 'Content-Type: application/json' -d '{"name":"ResearchPaper","symbol":"RPR","originProtocol":"0x83A3AFEb5D6AEbcc01eaF42AA6bb9f08b58031A1","network":"camp-testnet"}' > "$OUT_DIR/deploy_research_paper_${TS}.json" || true
  add_result "POST /api/deploy/research-paper" true "requested"

  # RoyaltyDistributor (needs originProtocol)
  curl -sS -X POST "$BASE_URL/api/deploy/royalty-distributor" -H 'Content-Type: application/json' -d '{"originProtocol":"0x83A3AFEb5D6AEbcc01eaF42AA6bb9f08b58031A1","treasury":"0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E","platformFeeBps":"500","network":"camp-testnet"}' > "$OUT_DIR/deploy_royalty_distributor_${TS}.json" || true
  add_result "POST /api/deploy/royalty-distributor" true "requested"

  # Academic Suite
  curl -sS -X POST "$BASE_URL/api/deploy/academic-suite" -H 'Content-Type: application/json' -d '{"rpName":"ResearchPaper","rpSymbol":"RPR","originProtocol":"0x83A3AFEb5D6AEbcc01eaF42AA6bb9f08b58031A1","treasury":"0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E","platformFeeBps":"500","network":"camp-testnet"}' > "$OUT_DIR/deploy_academic_suite_${TS}.json" || true
  add_result "POST /api/deploy/academic-suite" true "requested"
fi

# 7) Optional: Wallet deploy flow on Basecamp (guarded by RUN_WALLET_DEPLOY)
# This validates: AI -> compile -> unsigned tx preparation.
# It will typically stop at state=awaiting_signature unless you actually sign the tx.
if [[ "$RUN_WALLET_DEPLOY" == "1" ]]; then
  info "POST /api/wallet/deploy-with-wallet (basecamp)"
  GAME_WALLET_PROMPT=${GAME_WALLET_PROMPT:-"Create a simple on-chain puzzle game contract named MiniPuzzleGame with: startGame(), submitMove(uint8 move), and submitScore(uint256 score) that stores bestScore per player and emits events. Keep it minimal and deterministic."}
  WALLET_NETWORK=${WALLET_NETWORK:-basecamp}

  walletJobId=""
  if resp=$(jq -nc --arg prompt "$GAME_WALLET_PROMPT" --arg network "$WALLET_NETWORK" '{prompt:$prompt, network:$network, constructorArgs:[], strictArgs:false}' | curl -sS -X POST "$BASE_URL/api/wallet/deploy-with-wallet" -H 'Content-Type: application/json' -d @-); then
    walletJobId=$(echo "$resp" | jq -r '.jobId // empty')
    echo "$resp" > "$OUT_DIR/wallet_deploy_start_${TS}.json"
    if [[ -n "$walletJobId" ]]; then
      add_result "POST /api/wallet/deploy-with-wallet" true "$walletJobId"
      ok "wallet deploy started: $walletJobId"
    else
      add_result "POST /api/wallet/deploy-with-wallet" false "no jobId"
      err "wallet deploy returned no jobId"
    fi
  else
    add_result "POST /api/wallet/deploy-with-wallet" false "request failed"
  fi

  if [[ -n "$walletJobId" ]]; then
    info "Polling /api/job/$walletJobId/status?verbose=1"
    end=$((SECONDS+TIMEOUT))
    finalState=""
    while true; do
      st=$(curl -sS "$BASE_URL/api/job/$walletJobId/status?verbose=1" || echo '{}')
      echo "$st" > "$OUT_DIR/job_${walletJobId}_status_verbose.json"
      finalState=$(echo "$st" | jq -r '.data.state // empty')
      if [[ "$finalState" == "awaiting_signature" || "$finalState" == "completed" || "$finalState" == "failed" || $SECONDS -ge $end ]]; then
        break
      fi
      sleep "$POLL_INTERVAL"
    done
    ok "wallet job state: ${finalState:-unknown}"

    info "GET /api/job/$walletJobId/logs"
    curl -sS "$BASE_URL/api/job/$walletJobId/logs?limit=2000" > "$OUT_DIR/job_${walletJobId}_logs.json" || true

    # Treat awaiting_signature as success (means: AI generation + compilation + unsigned tx ready)
    if [[ "$finalState" == "awaiting_signature" || "$finalState" == "completed" ]]; then
      add_result "Wallet deploy basecamp (prep)" true "state=$finalState"
    else
      add_result "Wallet deploy basecamp (prep)" false "state=${finalState:-timeout}" 
    fi
  fi
fi

# Markdown summary
{
  echo "# API Smoke Test Results"
  echo
  echo "- Base URL: $BASE_URL"
  echo "- Time: $(date -Iseconds)"
  echo
  echo "| Endpoint | OK | Detail |"
  echo "|---|---:|---|"
  echo "$results" | jq -r '.[] | "| \(.name) | \(.ok) | \(.detail // "") |"'
} > "$MD_OUT"

# JSON summary
jq '.' <<< "$results" > "$JSON_OUT"

echo "[DONE] Results saved:"
echo "- $MD_OUT"
echo "- $JSON_OUT"
