#!/usr/bin/env bash
set -euo pipefail

# Camp Ecosystem extended tests (15 dapps)
# Requirements: curl, jq
# Usage:
#   ./run_camp_extended_tests.sh all            # run all extended tests
#   ./run_camp_extended_tests.sh 1 3 5          # run specific tests by number
#   BASE_URL=https://acadcodegen-production.up.railway.app ./run_camp_extended_tests.sh all
#   POLL_INTERVAL=3 TIMEOUT=420 ./run_camp_extended_tests.sh 1

# Default API base URL (override with BASE_URL env)
# Prod: https://acadcodegen-production.up.railway.app
# Local: http://localhost:3001
BASE_URL="${BASE_URL:-https://acadcodegen-production.up.railway.app}"
POLL_INTERVAL="${POLL_INTERVAL:-3}"
TIMEOUT="${TIMEOUT:-600}"
RESULTS_MD="camp_extended_results.md"
SUCCESS_COUNT=0
FAIL_COUNT=0

# If API returns Gemini-related errors, terminate the whole run immediately
GEMINI_ERROR_TERMS="${GEMINI_ERROR_TERMS:-Gemini|googleai|quota|Resource has been exhausted|model unavailable|safety|blocked by safety}"

log() { echo "[$(date +'%F %T')] $*"; }

die() { echo "ERROR: $*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"; }

need curl
need jq

has_gemini_error() {
  local s="$1"
  if echo "$s" | grep -Eiq "$GEMINI_ERROR_TERMS"; then
    return 0
  else
    return 1
  fi
}

post_and_poll() {
  local name="$1" payload="$2"
  log "Submitting: ${name}"
  local resp job_id
  resp=$(curl -sS -X POST "${BASE_URL}/api/ai/pipeline" \
    -H 'Content-Type: application/json' \
    -d "${payload}")

  # Immediate Gemini error detection on submission
  if has_gemini_error "$resp"; then
    echo "Response:"; echo "$resp"
    die "Gemini API error detected at submission for ${name}; terminating run."
  fi

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

    # Gemini error detection during polling
    if has_gemini_error "$status"; then
      echo "Status:"; echo "$status"
      die "Gemini API error detected while polling job ${job_id}; terminating run."
    fi

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
      if [[ "${network}" == "basecamp" ]]; then
        echo "- Explorer: https://basecamp.cloud.blockscout.com/address/${address}"
      fi
    fi
    if [[ -n "${error}" ]]; then
      echo "- Error: ${error}"
    fi
    echo
  } >> "${RESULTS_MD}"
}

# Extended ecosystem payloads (best-fit for Camp). All use network=basecamp and maxIters=5

payload_1='{
  "prompt":"CrossChainInbox: contract to receive messages (bytes data, address sender, uint256 srcChainId). Owner can set trusted bridges. Events MessageReceived, BridgeUpdated.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"CrossChainInbox.sol",
  "constructorArgs":[]
}'

payload_2='{
  "prompt":"MicroGrantDAO using AccessControl: proposeGrant(string ipfsCid,uint256 amount), voteYes/voteNo (token-weighted optional simple model), finalize() sets approved flag. Treasury address settable; if approved, mark payable() to accept funding. Events Proposed, Voted, Finalized.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"MicroGrantDAO.sol",
  "constructorArgs":[]
}'

payload_3='{
  "prompt":"OnchainAttestor: auditors with role can issue bytes32 attestations per subject address keyed by topic bytes32. revoke/update supported. Query latest by subject+topic. Events Issued, Revoked, Updated.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"OnchainAttestor.sol",
  "constructorArgs":[]
}'

payload_4='{
  "prompt":"CampFaucet: daily rate faucet for ERC20 token: claim() gives fixed amount per 24h per address. Owner can set amount and token. Anti-abuse via cooldown mapping. Events Claimed, ParamsUpdated.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"CampFaucet.sol",
  "constructorArgs":[]
}'

payload_5='{
  "prompt":"NFTRaffle: ERC721 raffle with buyTicket(price) payable, drawWinner() onlyOwner using pseudo-random blockhash for demo. Winner can claim NFT prize by tokenId metadata CID. Events TicketBought, WinnerDrawn, PrizeClaimed.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"NFTRaffle.sol",
  "constructorArgs":[]
}'

payload_6='{
  "prompt":"BountyBoard: createBounty(string cid,uint256 reward,address token). submitWork(uint256 id,string cid). owner or reviewer resolve(id,bool success) and pay reward if success. Events Created, Submitted, Resolved, Paid.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"BountyBoard.sol",
  "constructorArgs":[]
}'

payload_7='{
  "prompt":"NameRegistrar: simple ENS-like registrar mapping name(string) => owner + resolver(bytes32 contenthash). register(name), setContenthash, transferName. Prevent duplicates. Events Registered, ContentUpdated, Transferred.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"NameRegistrar.sol",
  "constructorArgs":[]
}'

payload_8='{
  "prompt":"StableVault: accepts deposits of an ERC20, mints receipt tokens (ERC20) 1:1. Owner can pause/unpause and set withdrawal fees in bps. Withdraw burns receipts and transfers underlying minus fee. Events Deposited, Withdrawn, ParamsUpdated.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"StableVault.sol",
  "constructorArgs":[]
}'

payload_9='{
  "prompt":"SocialTips: tipping contract for creators. setProfile(bytes32 id,string cid). tip(bytes32 id) payable accumulates balance; creator withdraws. Optional split percentages to collaborators. Events ProfileSet, Tipped, Withdrawn.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"SocialTips.sol",
  "constructorArgs":[]
}'

payload_10='{
  "prompt":"GasSponsor (ERC2771 style): setTrustedForwarder(address). verify meta-tx signature offchain style and execute call for user paying gas. Minimal demo with EIP-712 structs. Events ForwarderSet, MetaTxExecuted.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"GasSponsor.sol",
  "constructorArgs":[]
}'

payload_11='{
  "prompt":"SMSOracle: owner or ORACLE_ROLE posts signed SMS verification results mapping(address=>bool verified, uint64 ts). Client can query isVerified(address). Events Posted, Revoked.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"SMSOracle.sol",
  "constructorArgs":[]
}'

payload_12='{
  "prompt":"PriceFeedAggregator: allow multiple feeders with role to submit uint256 price for symbol bytes32. read latest price and median of last N submissions. Events Submitted, SymbolAdded.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"PriceFeedAggregator.sol",
  "constructorArgs":[]
}'

payload_13='{
  "prompt":"MultiSigLite: owners set at deploy; submitTransaction(to,value,data), confirmTransaction(id), execute when confirmations >= threshold. Events Submitted, Confirmed, Executed.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"MultiSigLite.sol",
  "constructorArgs":[]
}'

payload_14='{
  "prompt":"AirdropMerkle: setMerkleRoot(bytes32 root) by owner; claim(amount, proof) for ERC20, tracks claimed bitmap. Events RootSet, Claimed.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"AirdropMerkle.sol",
  "constructorArgs":[]
}'

payload_15='{
  "prompt":"CampaignManager: createCampaign(string cid,uint256 deadline). donate(uint256 id) payable; after deadline, creator withdraws if goal met else donors refund. Events Created, Donated, Withdrawn, Refunded.",
  "network":"basecamp",
  "maxIters": 5,
  "filename":"CampaignManager.sol",
  "constructorArgs":[]
}'

run_one() {
  case "$1" in
    1)  post_and_poll "1) CrossChainInbox"           "$payload_1" ;;
    2)  post_and_poll "2) MicroGrantDAO"             "$payload_2" ;;
    3)  post_and_poll "3) OnchainAttestor"           "$payload_3" ;;
    4)  post_and_poll "4) CampFaucet"                "$payload_4" ;;
    5)  post_and_poll "5) NFTRaffle"                 "$payload_5" ;;
    6)  post_and_poll "6) BountyBoard"               "$payload_6" ;;
    7)  post_and_poll "7) NameRegistrar"             "$payload_7" ;;
    8)  post_and_poll "8) StableVault"               "$payload_8" ;;
    9)  post_and_poll "9) SocialTips"                "$payload_9" ;;
    10) post_and_poll "10) GasSponsor"               "$payload_10" ;;
    11) post_and_poll "11) SMSOracle"                "$payload_11" ;;
    12) post_and_poll "12) PriceFeedAggregator"      "$payload_12" ;;
    13) post_and_poll "13) MultiSigLite"             "$payload_13" ;;
    14) post_and_poll "14) AirdropMerkle"            "$payload_14" ;;
    15) post_and_poll "15) CampaignManager"          "$payload_15" ;;
    *) die "Unknown test number: $1" ;;
  esac
}

main() {
  local main_start=$(date +%s)
  : > "${RESULTS_MD}"
  echo "# Camp Extended Test Results" >> "${RESULTS_MD}"
  echo "Started: $(date +'%F %T')" >> "${RESULTS_MD}"
  echo "Server: ${BASE_URL}" >> "${RESULTS_MD}"
  echo "Settings: POLL_INTERVAL=${POLL_INTERVAL}s, TIMEOUT=${TIMEOUT}s" >> "${RESULTS_MD}"
  echo >> "${RESULTS_MD}"

  if [[ $# -eq 0 || "$1" == "all" ]]; then
    for i in {1..15}; do run_one "$i"; done
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
