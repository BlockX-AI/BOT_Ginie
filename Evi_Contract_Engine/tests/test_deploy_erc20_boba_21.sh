#!/usr/bin/env bash
set -euo pipefail

# Deploy ~21 ERC20 tokens to BOBA Sepolia via POST /api/deploy/erc20
# Mirrors style of test_deploy_erc20.sh but loops ~21 times
# Requirements: curl, jq
# Usage:
#   ./test_deploy_erc20_boba_21.sh              # deploy 21 tokens to boba-sepolia
#   COUNT=25 ./test_deploy_erc20_boba_21.sh     # deploy a different count
#   BASE_URL=http://localhost:3000 ./test_deploy_erc20_boba_21.sh
#   OWNER=0xYourAddr PRIVATE_KEY=... BOBA_SEPOLIA_RPC_URL=... ./test_deploy_erc20_boba_21.sh

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
need curl
need jq

# Defaults
BASE_URL="${BASE_URL:-http://localhost:3000}"
OWNER="${OWNER:-0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E}"
NETWORK="${NETWORK:-boba-sepolia}"
COUNT="${COUNT:-21}"
PREFIX="${PREFIX:-Boba Token}"
SUPPLY="${SUPPLY:-}"   # if blank, we rotate realistic presets below

TS=$(date +%s)
OUT_DIR="deployments"
mkdir -p "$OUT_DIR"
JSON_OUT="$OUT_DIR/batch_erc20_boba_${TS}.json"
MD_OUT="$OUT_DIR/batch_erc20_boba_${TS}.md"

# Init outputs
results_json='[]'
{
  echo "# Batch ERC20 Deployments on Boba Sepolia ($COUNT tokens)"
  echo
  echo "- Network: $NETWORK"
  echo "- Owner: $OWNER"
  echo "- Server: $BASE_URL"
  echo "- Started: $(date -Iseconds)"
  echo
  echo "| # | Name | Symbol | Supply | Address | OK |"
  echo "|---:|------|--------|-------:|---------|----:|"
} > "$MD_OUT"

echo "[INFO] Starting batch: COUNT=$COUNT BASE_URL=$BASE_URL NETWORK=$NETWORK OWNER=$OWNER"

# Helpers
pad() { printf "%02d" "$1"; }

abbr() {
  local w="$1"
  w=$(printf "%s" "$w" | tr '[:lower:]' '[:upper:]')
  local first="${w:0:1}"
  local rest="${w:1}"
  rest=$(printf "%s" "$rest" | tr -d 'AEIOU')
  local a="${first}${rest}"
  a=$(printf "%s" "$a" | tr -cd 'A-Z')
  if [ ${#a} -lt 3 ]; then a="${a}X"; fi
  echo "${a:0:4}"
}

WORDS=(Atlas Nova Orion Zenith Apex Quantum Lunar Stellar Vertex Nimbus Aurora Titan Neon Vega Helix Flux Plasma Vortex Pulse Cipher Drift Terra Omega Solar Pixel Byte Chain Vault Prism Falcon Rapid Sigma Delta Gamma Theta Kappa Lambda Zeta Phoenix Draco Hydra Leonis Aquila Lyra Vela Pyxis Volans Dorado)

# Realistic supply presets (tokens, 18 decimals implied by deploy script)
SUPPLIES=(
  1000000 21000000 50000000 100000000 250000000 420000000 500000000 750000000 1000000000
  888000000 123456789 314159265 271828182 690000000 777000000 900000000 333000000 222000000
)

# Loop deploy
for i in $(seq 1 "$COUNT"); do
  idx=$(pad "$i")
  wordIndex=$(( (i-1) % ${#WORDS[@]} ))
  baseWord="${WORDS[$wordIndex]}"
  NAME="$baseWord $PREFIX $idx"
  baseSym="$(abbr "$baseWord")"
  SYMBOL="${baseSym}${idx}"
  supplyVal="$SUPPLY"
  if [[ -z "$supplyVal" ]]; then
    supplyVal="${SUPPLIES[$(( (i-1) % ${#SUPPLIES[@]} ))]}"
  fi

  payload=$(jq -nc \
    --arg name "$NAME" \
    --arg symbol "$SYMBOL" \
    --arg supply "$supplyVal" \
    --arg owner "$OWNER" \
    --arg network "$NETWORK" \
    '{name:$name, symbol:$symbol, initialSupply:$supply, owner:$owner, network:$network}')

  echo "[INFO] ($idx/$COUNT) POST $BASE_URL/api/deploy/erc20 :: $NAME ($SYMBOL) supply=$supplyVal"
  resp=$(curl -sS -X POST "$BASE_URL/api/deploy/erc20" -H 'Content-Type: application/json' -d "$payload" || true)

  ok=$(echo "$resp" | jq -r '.ok // false' 2>/dev/null || echo false)
  address=$(echo "$resp" | jq -r '.result.address // empty' 2>/dev/null || echo "")

  # Append to JSON results
  item=$(jq -nc --arg idx "$idx" --arg name "$NAME" --arg symbol "$SYMBOL" --arg supply "$supplyVal" --arg ok "$ok" --arg address "$address" '{index:$idx|tonumber, name:$name, symbol:$symbol, supply: ($supply|tonumber), ok:($ok=="true"), address:$address, raw: .}' <<<"{}")
  item=$(jq --argjson raw "${resp:-null}" '.raw = ($raw // null)' <<<"$item" 2>/dev/null || echo "$item")
  results_json=$(jq --argjson item "$item" '. + [$item]' <<<"$results_json")

  # Append to Markdown
  printf "| %s | %s | %s | %s | %s | %s |\n" "$idx" "$NAME" "$SYMBOL" "$supplyVal" "${address:-}" "$ok" >> "$MD_OUT"

  # Small delay
  sleep 1

done

# Save JSON & footer
jq '.' <<< "$results_json" > "$JSON_OUT"
{
  echo
  echo "Saved JSON: $JSON_OUT"
  echo "Completed: $(date -Iseconds)"
} >> "$MD_OUT"

echo "[DONE] Saved:"
echo "- $JSON_OUT"
echo "- $MD_OUT"
