#!/usr/bin/env bash
set -euo pipefail

# Test suite for POST /api/deploy/erc20
# Uses the server endpoint implemented in api/server.js
# Endpoint expects body: { name, symbol, initialSupply, owner?, network? }
# Defaults below target Basecamp network and provided owner address.
#
# Usage examples:
#   ./test_deploy_erc20.sh                           # quick test with defaults
#   BASE_URL=http://localhost:3000 ./test_deploy_erc20.sh
#   BASE_URL=https://acadcodegen-production.up.railway.app NAME="Camp Token" SYMBOL=CAMP SUPPLY=1000000 ./test_deploy_erc20.sh
#
# Notes:
# - Requires: curl, jq
# - initialSupply is interpreted by the Hardhat script; commonly tokens (not wei). See your deploy script for exact semantics.

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
need curl
need jq

BASE_URL="${BASE_URL:-https://acadcodegen-production.up.railway.app}"
NAME="${NAME:-Camp Token}"
SYMBOL="${SYMBOL:-CAMP}"
SUPPLY="${SUPPLY:-1000000}"
OWNER="${OWNER:-0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E}"
NETWORK="${NETWORK:-basecamp}"

payload=$(jq -nc --arg name "$NAME" --arg symbol "$SYMBOL" --arg supply "$SUPPLY" --arg owner "$OWNER" --arg network "$NETWORK" '{name:$name, symbol:$symbol, initialSupply:$supply, owner:$owner, network:$network}')

echo "[INFO] POST $BASE_URL/api/deploy/erc20"
echo "[INFO] Payload: $payload"

resp=$(curl -sS -X POST "$BASE_URL/api/deploy/erc20" \
  -H 'Content-Type: application/json' \
  -d "$payload")

echo "[DEBUG] Response: $resp"

ok=$(echo "$resp" | jq -r '.ok // false')
if [[ "$ok" != "true" ]]; then
  echo "[ERROR] Request failed" >&2
  echo "$resp" | jq . >&2 || true
  exit 1
fi

addr=$(echo "$resp" | jq -r '.result.address // empty')
net=$(echo "$resp" | jq -r '.result.network // empty')
explorer=$(echo "$resp" | jq -r '.result.explorerUrl // empty')

if [[ -z "$addr" ]]; then
  echo "[WARN] No address parsed from response. Full response follows:" >&2
  echo "$resp" | jq .
  exit 0
fi

echo "[SUCCESS] Deployed ERC20"
echo "- Network: ${net:-$NETWORK}"
echo "- Address: $addr"
if [[ -n "$explorer" ]]; then
  echo "- Explorer: $explorer"
else
  if [[ "${net:-$NETWORK}" == "basecamp" ]]; then
    echo "- Explorer: https://basecamp.cloud.blockscout.com/address/$addr"
  fi
fi
