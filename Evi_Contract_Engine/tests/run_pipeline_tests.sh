#!/usr/bin/env bash
set -euo pipefail

# Pipeline test runner for test.md scenarios
# Requirements: curl, jq
# Usage:
#   ./run_pipeline_tests.sh all                 # run all tests
#   ./run_pipeline_tests.sh 1 3 5               # run specific tests by number
#   ./run_pipeline_tests.sh deploy100           # deploy 100 Minimal ERC20s via AI pipeline
#   COUNT=150 ./run_pipeline_tests.sh deploy100 # override how many to deploy (default 100)
#   BASE_URL=https://acadcodegen-production.up.railway.app ./run_pipeline_tests.sh all
#   POLL_INTERVAL=3 TIMEOUT=420 ./run_pipeline_tests.sh 1

# Default API base URL (override with BASE_URL env)
# Prod: https://acadcodegen-production.up.railway.app
# Local: http://localhost:3001
BASE_URL="${BASE_URL:-https://acadcodegen-production.up.railway.app}"
POLL_INTERVAL="${POLL_INTERVAL:-3}"
TIMEOUT="${TIMEOUT:-600}"
RESULTS_MD="test_results.md"
SUCCESS_COUNT=0
FAIL_COUNT=0
# Batch settings for deploy100 mode
COUNT="${COUNT:-100}"
BATCH_SLEEP="${BATCH_SLEEP:-2}"

log() { echo "[$(date +'%F %T')] $*"; }

# ----------------------------------------
# Batch unique payload helpers (10 templates)
# ----------------------------------------
# Build a unique payload for index $1 cycling across 10 templates.
make_unique_payload() {
  local idx="$1"
  local mod=$(( (idx - 1) % 10 + 1 ))
  # Derive feature toggles from index to ensure uniqueness
  local b2=$(( idx % 2 ))
  local b3=$(( idx % 3 ))
  local b5=$(( idx % 5 ))
  local b7=$(( idx % 7 ))
  local cap=$(( (idx * 1000000) % 100000000 + 1000000 ))
  local fee_bps=$(( idx % 50 ))
  local delay_sec=$(( (idx % 6 + 1) * 3600 ))
  case "$mod" in
    1)
      # SimpleStorage
      jq -n \
        --arg fn "SimpleStorage_Batch_${idx}.sol" \
        --arg p "Create a simple storage contract in Solidity ^0.8.20 named SimpleStorageBatch${idx} with uint256 value, set(uint256) external and get() external view returns (uint256). $( [[ $b2 -eq 0 ]] && echo 'Add Ownable with onlyOwner for set().' || echo 'Public set without ownership.' ) $( [[ $b3 -eq 0 ]] && echo 'Emit an event ValueChanged(uint256 oldValue,uint256 newValue).' ) $( [[ $b5 -eq 0 ]] && echo 'Add a reset() onlyOwner function to zero the value.' ) No external imports." \
        '{prompt: $p, network: "fuji", maxIters: 5, filename: $fn, constructorArgs: []}'
      ;;
    2)
      # Counter
      jq -n \
        --arg fn "Counter_Batch_${idx}.sol" \
        --arg p "Write a Counter contract in Solidity ^0.8.20 named CounterBatch${idx} with increment(), decrement(), and current() public view returns (int256). $( [[ $b2 -eq 0 ]] && echo 'Use SafeCast for bounds checks on int256.' ) $( [[ $b3 -eq 0 ]] && echo 'Guard with nonReentrant on increment/decrement using OZ ReentrancyGuard.' ) $( [[ $b5 -eq 0 ]] && echo 'Add step(int256 delta) external to add/sub in one call.' ) No external imports beyond OZ if referenced." \
        '{prompt: $p, network: "fuji", maxIters: 5, filename: $fn, constructorArgs: []}'
      ;;
    3)
      # Greeter
      jq -n \
        --arg fn "Greeter_Batch_${idx}.sol" \
        --arg msg "Hello from batch ${idx}" \
        --arg p "Greeter contract in Solidity ^0.8.20 named GreeterBatch${idx} with constructor(string memory message) and hello() external view returns (string memory). $( [[ $b2 -eq 0 ]] && echo 'Include setMessage(string) restricted to onlyOwner.' || echo 'Include setMessage(string) public.' ) $( [[ $b3 -eq 0 ]] && echo 'Emit GreetingChanged(address indexed sender,string oldMessage,string newMessage).' ) $( [[ $b5 -eq 0 ]] && echo 'Add greetCount() view to return number of greetings.' ) No external imports beyond OZ if used." \
        '{prompt: $p, network: "fuji", maxIters: 5, filename: $fn, constructorArgs: [$msg]}'
      ;;
    4)
      # Minimal ERC20
      jq -n \
        --arg fn "MinimalERC20_Batch_${idx}.sol" \
        --arg name "BatchToken${idx}" \
        --arg symbol "BT${idx}" \
        --arg p "Create an ERC20 in Solidity ^0.8.20 using OpenZeppelin named BatchToken${idx} (symbol BT${idx}). Include features: $( [[ $b2 -eq 0 ]] && echo 'Burnable, ' )$( [[ $b3 -eq 0 ]] && echo 'Pausable, ' )$( [[ $b5 -eq 0 ]] && echo 'Permit (EIP-2612), ' )$( [[ $b7 -eq 0 ]] && echo 'Votes (ERC20Votes), ' )constant MAX_SUPPLY = ${cap}e18 enforced in _update. Owner is deployer. Constructor (string name,string symbol)." \
        '{prompt: $p, network: "fuji", maxIters: 5, filename: $fn, constructorArgs: [$name, $symbol]}'
      ;;
    5)
      # OwnerMintToken (ERC20 Ownable mint)
      jq -n \
        --arg fn "OwnerMintToken_Batch_${idx}.sol" \
        --arg name "OwnerMintToken${idx}" \
        --arg symbol "OMT${idx}" \
        --arg p "ERC20 using OpenZeppelin ^4.9 named OwnerMintToken${idx} (symbol OMT${idx}) with Ownable; only owner can mint(address to,uint256 amount). $( [[ $b2 -eq 0 ]] && echo 'Also Burnable.' ) $( [[ $b3 -eq 0 ]] && echo 'Add Pausable; block transfers when paused.' ) $( [[ $b5 -eq 0 ]] && echo 'Emit Minted(owner,to,amount) and Burned(account,amount).' ) No external imports beyond OZ." \
        '{prompt: $p, network: "fuji", maxIters: 5, filename: $fn, constructorArgs: [$name, $symbol]}'
      ;;
    6)
      # Minimal ERC721
      jq -n \
        --arg fn "MinimalNFT_Batch_${idx}.sol" \
        --arg name "BatchNFT${idx}" \
        --arg symbol "BNFT${idx}" \
        --arg p "ERC721 in Solidity ^0.8.20 using OpenZeppelin named BatchNFT${idx} (symbol BNFT${idx}). Include: onlyOwner mintTo(address,uint256). $( [[ $b2 -eq 0 ]] && echo 'Use ERC721URIStorage with setTokenURI onlyOwner.' ) $( [[ $b3 -eq 0 ]] && echo 'Add Pausable; block transfers when paused.' ) $( [[ $b5 -eq 0 ]] && echo 'Add Burnable.' ) $( [[ $b7 -eq 0 ]] && echo 'Implement ERC2981 default royalty 500 basis points hardcoded.' ) Constructor (string name,string symbol)." \
        '{prompt: $p, network: "fuji", maxIters: 5, filename: $fn, constructorArgs: [$name, $symbol]}'
      ;;
    7)
      # Vault with reentrancy guard
      jq -n \
        --arg fn "Vault_Batch_${idx}.sol" \
        --arg p "Vault contract in Solidity ^0.8.20 named VaultBatch${idx} allowing deposits and withdrawals. Use checks-effects-interactions and ReentrancyGuard from OZ. $( [[ $b2 -eq 0 ]] && echo 'Charge withdrawal fee of '${fee_bps}' basis points sent to owner.' ) $( [[ $b3 -eq 0 ]] && echo 'Introduce withdrawalDelay of '${delay_sec}' seconds using block.timestamp checks.' ) $( [[ $b5 -eq 0 ]] && echo 'Add emergencyPause onlyOwner boolean to block new deposits.' ) No external calls except payable transfers." \
        '{prompt: $p, network: "fuji", maxIters: 5, filename: $fn, constructorArgs: []}'
      ;;
    8)
      # Pausable ERC20
      jq -n \
        --arg fn "PausableToken_Batch_${idx}.sol" \
        --arg name "Pausable${idx}" \
        --arg symbol "P${idx}" \
        --arg p "ERC20 using OpenZeppelin ^4.9 named Pausable${idx} (symbol P${idx}) with Ownable + Pausable. Owner can pause/unpause; transfers block when paused. $( [[ $b2 -eq 0 ]] && echo 'Also Burnable.' ) $( [[ $b3 -eq 0 ]] && echo 'Add Permit (EIP-2612).' ) $( [[ $b5 -eq 0 ]] && echo 'Include Snapshots (ERC20Snapshot) callable by onlyOwner.' )" \
        '{prompt: $p, network: "fuji", maxIters: 5, filename: $fn, constructorArgs: [$name, $symbol]}'
      ;;
    9)
      # Minimal ERC1155
      jq -n \
        --arg fn "Minimal1155_Batch_${idx}.sol" \
        --arg base "https://example.com/${idx}/{id}.json" \
        --arg p "ERC1155 using OpenZeppelin ^4.9 named Minimal1155Batch${idx}. Constructor takes a baseURI string. onlyOwner mint(address to,uint256 id,uint256 amount). $( [[ $b2 -eq 0 ]] && echo 'Add Pausable.' ) $( [[ $b3 -eq 0 ]] && echo 'Add supply tracking mapping(uint256=>uint256) totalSupply and exist checks.' ) $( [[ $b5 -eq 0 ]] && echo 'Add batchMint(address to,uint256[] ids,uint256[] amounts).' ) $( [[ $b7 -eq 0 ]] && echo 'Implement ERC2981 royalties default 300 bps.' )" \
        '{prompt: $p, network: "fuji", maxIters: 5, filename: $fn, constructorArgs: [$base]}'
      ;;
    10)
      # Registry
      jq -n \
        --arg fn "Registry_Batch_${idx}.sol" \
        --arg p "Registry contract in Solidity ^0.8.20 named RegistryBatch${idx} mapping(address => string). setMyData(string calldata) external and getData(address) external view returns (string memory). $( [[ $b2 -eq 0 ]] && echo 'Restrict setters to onlyOwner; add setFor(address,string) onlyOwner.' || echo 'Allow any caller to set their own data.' ) $( [[ $b3 -eq 0 ]] && echo 'Emit DataUpdated(address indexed who,string oldValue,string newValue).' ) $( [[ $b5 -eq 0 ]] && echo 'Enforce max length 256 bytes on values; revert otherwise.' ) No external imports beyond OZ if used." \
        '{prompt: $p, network: "fuji", maxIters: 5, filename: $fn, constructorArgs: []}'
      ;;
  esac
}

run_batch_unique() {
  log "Starting batch unique deployments: COUNT=${COUNT}, BASE_URL=${BASE_URL}"
  for ((i=1; i<=COUNT; i++)); do
    local payload
    payload=$(make_unique_payload "$i")
    post_and_poll "BatchUnique #${i}" "$payload"
    sleep "${BATCH_SLEEP}"
  done
}

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
      # Handle common network names and aliases for explorer links
      if [[ "${network}" == "basecamp" ]]; then
        echo "- Explorer: https://basecamp.cloud.blockscout.com/address/${address}"
      elif [[ "${network}" == "fuji" || "${network}" == "avalanche-fuji" ]]; then
        echo "- Explorer: https://testnet.snowtrace.io/address/${address}"
      fi
    fi
    if [[ -n "${error}" ]]; then
      echo "- Error: ${error}"
    fi
    echo
  } >> "${RESULTS_MD}"
}

# Test payloads (JSON strings). Keep aligned with test.md
payload_1='{
  "prompt":"Create a simple storage contract in Solidity ^0.8.20 with uint256 value, set(uint256) external and get() external view returns (uint256). No external imports.",
  "network":"fuji",
  "maxIters": 5,
  "filename":"SimpleStorage.sol",
  "constructorArgs":[]
}'

payload_2='{
  "prompt":"Write a Counter contract in Solidity ^0.8.20 with increment(), decrement(), and current() public view returns (int256). No external imports.",
  "network":"fuji",
  "maxIters": 5,
  "filename":"Counter.sol",
  "constructorArgs":[]
}'

payload_3='{
  "prompt":"Greeter contract in Solidity ^0.8.20 with constructor(string memory message) and hello() external view returns (string memory). No external imports.",
  "network":"fuji",
  "maxIters": 5,
  "filename":"Greeter.sol",
  "constructorArgs":["Hello from pipeline"]
}'

payload_4='{
  "prompt":"Create a minimal ERC20 in Solidity ^0.8.20 using OpenZeppelin ERC20. Constructor (string name,string symbol). No mint/burn.",
  "network":"fuji",
  "maxIters": 5,
  "filename":"MinimalERC20.sol",
  "constructorArgs":["MinimalERC20","MER"]
}'

payload_5='{
  "prompt":"ERC20 using OpenZeppelin ^4.9 with Ownable; only owner can mint(address to,uint256 amount). No burn.",
  "network":"fuji",
  "maxIters": 5,
  "filename":"OwnerMintToken.sol",
  "constructorArgs":["OwnerMintToken","OMT"]
}'

payload_6='{
  "prompt":"Minimal ERC721 in Solidity ^0.8.20 using OpenZeppelin ERC721 and Ownable. Constructor (string name,string symbol). onlyOwner mintTo(address to,uint256 tokenId). No URI logic.",
  "network":"fuji",
  "maxIters": 5,
  "filename":"MinimalNFT.sol",
  "constructorArgs":["MinimalNFT","MNFT"]
}'

payload_7='{
  "prompt":"Vault contract in Solidity ^0.8.20 allowing deposits and withdrawals. Use checks-effects-interactions and ReentrancyGuard from OZ. No external calls except payable transfers.",
  "network":"fuji",
  "maxIters": 5,
  "filename":"Vault.sol",
  "constructorArgs":[]
}'

payload_8='{
  "prompt":"ERC20 using OpenZeppelin ^4.9 with Ownable + Pausable. Owner can pause/unpause; transfers block when paused.",
  "network":"fuji",
  "maxIters": 5,
  "filename":"PausableToken.sol",
  "constructorArgs":["PausableToken","PZT"]
}'

payload_9='{
  "prompt":"Minimal ERC1155 using OpenZeppelin ^4.9. Constructor takes a baseURI string. onlyOwner mint(address to,uint256 id,uint256 amount).",
  "network":"fuji",
  "maxIters": 5,
  "filename":"Minimal1155.sol",
  "constructorArgs":["https://example.com/{id}.json"]
}'

payload_10='{
  "prompt":"Registry contract in Solidity ^0.8.20 mapping(address => string). setMyData(string calldata) external and getData(address) external view returns (string memory). No external imports.",
  "network":"fuji",
  "maxIters": 5,
  "filename":"Registry.sol",
  "constructorArgs":[]
}'

run_one() {
  case "$1" in
    1) post_and_poll "1) SimpleStorage"       "$payload_1" ;;
    2) post_and_poll "2) Counter"             "$payload_2" ;;
    3) post_and_poll "3) Greeter"             "$payload_3" ;;
    4) post_and_poll "4) MinimalERC20"        "$payload_4" ;;
    5) post_and_poll "5) OwnerMintToken"      "$payload_5" ;;
    6) post_and_poll "6) MinimalNFT"          "$payload_6" ;;
    7) post_and_poll "7) Vault"               "$payload_7" ;;
    8) post_and_poll "8) PausableToken"       "$payload_8" ;;
    9) post_and_poll "9) Minimal1155"         "$payload_9" ;;
   10) post_and_poll "10) Registry"           "$payload_10" ;;
    *) die "Unknown test number: $1" ;;
  esac
}

main() {
  local main_start=$(date +%s)
  : > "${RESULTS_MD}"
  echo "# Pipeline Test Results" >> "${RESULTS_MD}"
  echo "Started: $(date +'%F %T')" >> "${RESULTS_MD}"
  echo "Server: ${BASE_URL}" >> "${RESULTS_MD}"
  echo "Settings: POLL_INTERVAL=${POLL_INTERVAL}s, TIMEOUT=${TIMEOUT}s" >> "${RESULTS_MD}"
  echo >> "${RESULTS_MD}"

  if [[ $# -gt 0 && "$1" == "deploy100" ]]; then
    run_batch_unique
  elif [[ $# -eq 0 || "$1" == "all" ]]; then
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

# -----------------------------------------------------------------------------
# Copy-pasteable curl examples (network=fuji). Each line submits a pipeline
# job with a technical prompt, matching the API your server exposes.
# -----------------------------------------------------------------------------
# curl -sS -X POST "$BASE_URL/api/ai/pipeline" \
#   -H 'Content-Type: application/json' \
#   -d '{"prompt":"Create a simple storage contract in Solidity ^0.8.20 with uint256 value, set(uint256), get() view.", "network":"fuji"}' \
# | tee /tmp/pipeline_01.json
#
# curl -sS -X POST "$BASE_URL/api/ai/pipeline" \
#   -H 'Content-Type: application/json' \
#   -d '{"prompt":"Write a Counter contract ^0.8.20 with increment(), decrement(), current() view.", "network":"fuji"}' \
# | tee /tmp/pipeline_02.json
#
# curl -sS -X POST "$BASE_URL/api/ai/pipeline" \
#   -H 'Content-Type: application/json' \
#   -d '{"prompt":"Greeter ^0.8.20 constructor(string) hello() view returns message.", "network":"fuji"}' \
# | tee /tmp/pipeline_03.json
#
# curl -sS -X POST "$BASE_URL/api/ai/pipeline" \
#   -H 'Content-Type: application/json' \
#   -d '{"prompt":"Minimal ERC20 ^0.8.20 via OZ ERC20; constructor(name,symbol).", "network":"fuji"}' \
# | tee /tmp/pipeline_04.json
#
# curl -sS -X POST "$BASE_URL/api/ai/pipeline" \
#   -H 'Content-Type: application/json' \
#   -d '{"prompt":"ERC20 ^0.8.20 via OZ with Ownable; only owner mint(to,amount).", "network":"fuji"}' \
# | tee /tmp/pipeline_05.json
#
# curl -sS -X POST "$BASE_URL/api/ai/pipeline" \
#   -H 'Content-Type: application/json' \
#   -d '{"prompt":"Minimal ERC721 ^0.8.20 via OZ ERC721 + Ownable; onlyOwner mintTo(to,tokenId).", "network":"fuji"}' \
# | tee /tmp/pipeline_06.json
#
# curl -sS -X POST "$BASE_URL/api/ai/pipeline" \
#   -H 'Content-Type: application/json' \
#   -d '{"prompt":"Vault ^0.8.20 with deposit/withdraw; CEI pattern + ReentrancyGuard.", "network":"fuji"}' \
# | tee /tmp/pipeline_07.json
#
# curl -sS -X POST "$BASE_URL/api/ai/pipeline" \
#   -H 'Content-Type: application/json' \
#   -d '{"prompt":"ERC20 ^0.8.20 via OZ with Ownable + Pausable; pause blocks transfers.", "network":"fuji"}' \
# | tee /tmp/pipeline_08.json
#
# curl -sS -X POST "$BASE_URL/api/ai/pipeline" \
#   -H 'Content-Type: application/json' \
#   -d '{"prompt":"Minimal ERC1155 ^0.8.20 via OZ; constructor baseURI; onlyOwner mint(to,id,amount).", "network":"fuji"}' \
# | tee /tmp/pipeline_09.json
#
# curl -sS -X POST "$BASE_URL/api/ai/pipeline" \
#   -H 'Content-Type: application/json' \
#   -d '{"prompt":"Registry ^0.8.20 mapping(address=>string); setMyData(string) and getData(address).", "network":"fuji"}' \
# | tee /tmp/pipeline_10.json
