#!/usr/bin/env bash
set -euo pipefail

# Boba Sepolia (boba-sepolia) pipeline tests
# Requirements: curl, jq
# Usage:
#   ./test_boba.sh all            # run all tests
#   ./test_boba.sh 1 3 5          # run specific tests by number
#   POLL_INTERVAL=3 TIMEOUT=420 ./test_boba.sh all
# Notes:
# - Defaults to local API at http://localhost:3000
# - All payloads target network boba-sepolia and set strictArgs=false for smoother deploys

# Default API base URL (override with BASE_URL env if needed)
BASE_URL="${BASE_URL:-http://localhost:3000}"
POLL_INTERVAL="${POLL_INTERVAL:-3}"
TIMEOUT="${TIMEOUT:-600}"
RESULTS_MD="boba_test_results.md"
SUCCESS_COUNT=0
FAIL_COUNT=0

log() { echo "[$(date +'%F %T')] $*"; }

die() { echo "ERROR: $*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"; }

need curl
need jq

post_and_poll() {
  local name="$1" payload="$2"
  log "Submitting: ${name}"
  local resp job_id
  resp=$(curl -sS -X POST "${BASE_URL}/api/ai/pipeline" \
    -H 'Content-Type: application/json' \
    -d "${payload}")
  echo "${resp}" | jq -e '.ok == true' >/dev/null || { echo "Response:"; echo "${resp}"; die "Submission failed for ${name}"; }
  job_id=$(echo "${resp}" | jq -r '.job.id')
  log "Job ID: ${job_id}"

  # Poll loop
  local start_ts=$(date +%s) now state step progress
  while true; do
    now=$(date +%s)
    if (( now - start_ts > TIMEOUT )); then
      die "Timeout waiting for job ${job_id}"
    fi
    local status
    status=$(curl -sS "${BASE_URL}/api/job/${job_id}/status")
    state=$(echo "${status}" | jq -r '.data.state')
    step=$(echo "${status}" | jq -r '.data.step // ""')
    progress=$(echo "${status}" | jq -r '.data.progress // 0')
    log "${name}: state=${state} step=${step} progress=${progress}"
    if [[ "${state}" == "completed" || "${state}" == "failed" ]]; then
      echo "${status}" > "/tmp/${job_id}.json"
      break
    fi
    sleep "${POLL_INTERVAL}"
  done

  # Summarize
  local end_ts=$(date +%s)
  local duration=$(( end_ts - start_ts ))
  local address network error deployer contract fqName filename prompt args server
  local start_human end_human outcome
  address=$(jq -r '.data.result.address // empty' "/tmp/${job_id}.json")
  network=$(jq -r '.data.result.network // .data.payload.network // empty' "/tmp/${job_id}.json")
  error=$(jq -r '.data.error // empty' "/tmp/${job_id}.json")
  deployer=$(jq -r '.data.result.deployer // empty' "/tmp/${job_id}.json")
  contract=$(jq -r '.data.result.contract // empty' "/tmp/${job_id}.json")
  fqName=$(jq -r '.data.result.fqName // empty' "/tmp/${job_id}.json")
  filename=$(jq -r '.data.payload.filename // empty' "/tmp/${job_id}.json")
  prompt=$(jq -r '.data.payload.prompt // empty' "/tmp/${job_id}.json")
  args=$(jq -c '.data.result.params.args // .data.payload.constructorArgs // []' "/tmp/${job_id}.json")
  server="${BASE_URL}"
  start_human=$(date -r "${start_ts}" +'%F %T' 2>/dev/null || date -u +'%F %T')
  end_human=$(date -r "${end_ts}" +'%F %T' 2>/dev/null || date -u +'%F %T')
  outcome=$([[ "${state}" == "completed" ]] && echo "Success" || echo "Failed")

  if [[ "${state}" == "completed" ]]; then
    log "${name}: SUCCESS address=${address} network=${network}"
    SUCCESS_COUNT=$(( SUCCESS_COUNT + 1 ))
  else
    log "${name}: FAILED error=${error}"
    FAIL_COUNT=$(( FAIL_COUNT + 1 ))
  fi

  # Append to results markdown
  {
    echo "### ${name}"
    echo "- Server: ${server}"
    echo "- Job ID: ${job_id}"
    echo "- Outcome: ${outcome}"
    echo "- State: ${state}"
    echo "- Step: ${step}"
    echo "- Progress: ${progress}"
    echo "- Duration (s): ${duration}"
    echo "- Started At: ${start_human}"
    echo "- Finished At: ${end_human}"
    echo "- Network: ${network}"
    echo "- Contract: ${contract}"
    echo "- FQN: ${fqName}"
    echo "- Deployer: ${deployer}"
    echo "- Filename: ${filename}"
    echo "- Constructor Args: ${args}"
    echo "- Prompt: \n\n\t${prompt}\n"
    if [[ -n "${address}" ]]; then
      echo "- Address: ${address}"
    fi
    if [[ -n "${error}" ]]; then
      echo "- Error: ${error}"
    fi
    echo
  } >> "${RESULTS_MD}"
}

# Test payloads (all target boba-sepolia and use strictArgs=false)

payload_1='{
  "prompt":"Write a Solidity ^0.8.20 IdentityRegistry where users can register a DID (string), auditors can issue attestations mapping(address => bytes32 attestation). Include revoke and events. Use OpenZeppelin AccessControl for roles.",
  "network":"boba-sepolia",
  "maxIters": 5,
  "filename":"IdentityRegistry.sol",
  "constructorArgs":[],
  "strictArgs": false
}'

payload_2='{
  "prompt":"Write FeeTreasury contract in Solidity ^0.8.20. receive() payable, depositERC20(address token, uint256 amount). OnlyOwner can withdraw. Add function distribute(address[] recipients,uint256[] amounts). Events Deposited, Withdrawn, Distributed.",
  "network":"boba-sepolia",
  "maxIters": 5,
  "filename":"FeeTreasury.sol",
  "constructorArgs":[],
  "strictArgs": false
}'

payload_3='{
  "prompt":"GrantsEscrow contract in Solidity ^0.8.20 where funders lock ERC20 tokens for developers. release() allowed only after milestone verification (bool flag set by auditor role). Supports multiple milestones per project. Events Funded, Released, Revoked.",
  "network":"boba-sepolia",
  "maxIters": 5,
  "filename":"GrantsEscrow.sol",
  "constructorArgs":[],
  "strictArgs": false
}'

payload_4='{
  "prompt":"Write BatchCIDAnchor in Solidity ^0.8.20 where submitter can store multiple IPFS CIDs (string[]). mapping(bytes32 => CIDRecord) stores cid + timestamp + submitter. BatchSubmit and CIDUpdated events.",
  "network":"boba-sepolia",
  "maxIters": 5,
  "filename":"BatchCIDAnchor.sol",
  "constructorArgs":[],
  "strictArgs": false
}'

payload_5='{
  "prompt":"DAOProposal contract in Solidity ^0.8.20 supporting proposals with description string, yes/no votes (ERC20 token-weighted). After deadline, proposal is executable. Use OZ Governor or simple custom model.",
  "network":"boba-sepolia",
  "maxIters": 5,
  "filename":"DAOProposal.sol",
  "constructorArgs":[],
  "strictArgs": false
}'

payload_6='{
  "prompt":"Write a simple PaymentStream contract in Solidity ^0.8.20: createStream(address recipient, uint256 ratePerSec). allow withdraw() by recipient = (elapsed * ratePerSec). Owner can cancel. Events StreamCreated, StreamCancelled, Withdrawn.",
  "network":"boba-sepolia",
  "maxIters": 5,
  "filename":"PaymentStream.sol",
  "constructorArgs":[],
  "strictArgs": false
}'

payload_7='{
  "prompt":"Create EcosystemBadge NFT (ERC721) with role-based minting. Mint badges like 'Auditor', 'Builder', 'Grantee'. Metadata stored via IPFS CIDs. Only Owner or DAO contract can mint badges.",
  "network":"boba-sepolia",
  "maxIters": 5,
  "filename":"EcosystemBadge.sol",
  "constructorArgs":["EcosystemBadge","ECO"],
  "strictArgs": false
}'

payload_8='{
  "prompt":"OraclePublisher contract in Solidity ^0.8.20 with AccessControl. ORACLE_ROLE can post uint256 values tied to a bytes32 key. Client contracts can read latest value. Events Published, Revoked.",
  "network":"boba-sepolia",
  "maxIters": 5,
  "filename":"OraclePublisher.sol",
  "constructorArgs":[],
  "strictArgs": false
}'

payload_9='{
  "prompt":"Write a MockBridge contract for Boba Sepolia in Solidity ^0.8.20. lock(address token,uint256 amount) and emit BridgeRequested. unlock(address recipient,uint256 amount) onlyOwner. For demo bridging flows.",
  "network":"boba-sepolia",
  "maxIters": 5,
  "filename":"MockBridge.sol",
  "constructorArgs":[],
  "strictArgs": false
}'

payload_10='{
  "prompt":"MetadataRegistry contract Solidity ^0.8.20 with mapping(bytes32 => string). Allows updateCID(bytes32 key, string newCid). Events MetadataSet, MetadataUpdated. Only owner of key can update.",
  "network":"boba-sepolia",
  "maxIters": 5,
  "filename":"MetadataRegistry.sol",
  "constructorArgs":[],
  "strictArgs": false
}'

run_one() {
  case "$1" in
    1) post_and_poll "1) IdentityRegistry (boba)"      "$payload_1" ;;
    2) post_and_poll "2) FeeTreasury (boba)"           "$payload_2" ;;
    3) post_and_poll "3) GrantsEscrow (boba)"          "$payload_3" ;;
    4) post_and_poll "4) BatchCIDAnchor (boba)"        "$payload_4" ;;
    5) post_and_poll "5) DAOProposal (boba)"           "$payload_5" ;;
    6) post_and_poll "6) PaymentStream (boba)"         "$payload_6" ;;
    7) post_and_poll "7) EcosystemBadge (boba)"        "$payload_7" ;;
    8) post_and_poll "8) OraclePublisher (boba)"       "$payload_8" ;;
    9) post_and_poll "9) MockBridge (boba)"            "$payload_9" ;;
   10) post_and_poll "10) MetadataRegistry (boba)"     "$payload_10" ;;
    *) die "Unknown test number: $1" ;;
  esac
}

main() {
  local main_start=$(date +%s)
  : > "${RESULTS_MD}"
  echo "# Boba Sepolia Test Results" >> "${RESULTS_MD}"
  echo "Started: $(date +'%F %T')" >> "${RESULTS_MD}"
  echo "Server: ${BASE_URL}" >> "${RESULTS_MD}"
  echo "Settings: POLL_INTERVAL=${POLL_INTERVAL}s, TIMEOUT=${TIMEOUT}s" >> "${RESULTS_MD}"
  echo >> "${RESULTS_MD}"

  if [[ $# -eq 0 || "$1" == "all" ]]; then
    for i in {1..10}; do run_one "$i"; done
  else
    for i in "$@"; do run_one "$i"; done
  fi

  local main_end=$(date +%s)
  local total_duration=$(( main_end - main_start ))
  echo >> "${RESULTS_MD}"
  echo "Finished: $(date +'%F %T')" >> "${RESULTS_MD}"
  echo "Total Duration (s): ${total_duration}" >> "${RESULTS_MD}"
  echo "Summary: ${SUCCESS_COUNT} succeeded, ${FAIL_COUNT} failed" >> "${RESULTS_MD}"
  log "Results written to ${RESULTS_MD}"
}

main "$@"
