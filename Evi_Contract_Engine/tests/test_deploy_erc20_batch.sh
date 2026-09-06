#!/usr/bin/env bash
set -euo pipefail

# Batch deploy 2500 ERC20 tokens via POST /api/deploy/erc20
# Requires: curl, jq
# Configurable via env:
#   BASE_URL (default http://localhost:3000)
#   OWNER (default provided)
#   NETWORK (default basecamp)
#   SUPPLY (optional default 1000000) - if unset, script rotates realistic presets
#   COUNT (default 2500)
#   PREFIX (default "Camp Token")
#
# Outputs:
#   - JSON summary: deployments/batch_erc20_<timestamp>.json
#   - Markdown summary: deployments/batch_erc20_<timestamp>.md

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }; }
need curl
need jq

BASE_URL="${BASE_URL:-http://localhost:3000}"
OWNER="${OWNER:-0xa58DCCb0F17279abD1d0D9069Aa8711Df4a4c58E}"
NETWORK="${NETWORK:-basecamp}"
SUPPLY="${SUPPLY:-}"
COUNT="${COUNT:-2500}"
PREFIX="${PREFIX:-Camp Token}"

TS=$(date +%s)
OUT_DIR="deployments"
mkdir -p "$OUT_DIR"
JSON_OUT="$OUT_DIR/batch_erc20_${TS}.json"
MD_OUT="$OUT_DIR/batch_erc20_${TS}.md"

echo "[INFO] Starting batch: COUNT=$COUNT BASE_URL=$BASE_URL NETWORK=$NETWORK OWNER=$OWNER"

# Init JSON array
results_json='[]'

# Init Markdown
{
  echo "# Batch ERC20 Deployments ($COUNT tokens)"
  echo
  echo "- Network: $NETWORK"
  echo "- Owner: $OWNER"
  echo "- Started: $(date -Iseconds)"
  echo
  echo "| # | Name | Symbol | Supply | Address | Explorer | OK |"
  echo "|---:|------|--------|-------:|---------|----------|----:|"
} > "$MD_OUT"

pad() { printf "%02d" "$1"; }

###############################################
# Name & Symbol generators
###############################################
WORDS=(Atlas Nova Orion Zenith Apex Quantum Lunar Stellar Vertex Nimbus Aurora Titan Neon Vega Helix Flux Plasma Vortex Pulse Cipher Drift Terra Omega Solar Pixel Byte Chain Vault Prism Falcon Rapid Sigma Delta Gamma Theta Kappa Lambda Zeta Phoenix Draco Hydra Leonis Aquila Lyra Vela Pyxis Volans Dorado)

abbr() {
  local w="$1"
  # uppercase using tr for macOS bash 3.2 compatibility
  w=$(printf "%s" "$w" | tr '[:lower:]' '[:upper:]')
  # remove vowels to look ticker-ish, keep first letter
  local first="${w:0:1}"
  local rest="${w:1}"
  rest=$(printf "%s" "$rest" | tr -d 'AEIOU')
  local a="${first}${rest}"
  # keep only letters
  a=$(printf "%s" "$a" | tr -cd 'A-Z')
  # ensure 3-4 chars
  if [ ${#a} -lt 3 ]; then a="${a}X"; fi
  echo "${a:0:4}"
}

# Realistic supply presets (tokens, 18 decimals implied)
SUPPLIES=(
  1000000 21000000 50000000 100000000 250000000 420000000 500000000 750000000 1000000000
  888000000 123456789 314159265 271828182 690000000 777000000 900000000 333000000 222000000
)

for i in $(seq 1 "$COUNT"); do
  idx=$(pad "$i")
  wordIndex=$(( (i-1) % ${#WORDS[@]} ))
  baseWord="${WORDS[$wordIndex]}"
  NAME="${baseWord} ${PREFIX} ${idx}"
  baseSym="$(abbr "$baseWord")"
  SYMBOL="${baseSym}${idx}"
  # pick supply: env SUPPLY overrides; else rotate presets
  supplyVal="$SUPPLY"
  if [[ -z "$supplyVal" ]]; then
    supplyVal="${SUPPLIES[$(( (i-1) % ${#SUPPLIES[@]} ))]}"
  fi
  payload=$(jq -nc --arg name "$NAME" --arg symbol "$SYMBOL" --arg supply "$supplyVal" --arg owner "$OWNER" --arg network "$NETWORK" '{name:$name, symbol:$symbol, initialSupply:$supply, owner:$owner, network:$network}')

  echo "[INFO] ($idx/$COUNT) Deploying: $NAME ($SYMBOL) supply=$supplyVal"
  resp=$(curl -sS -X POST "$BASE_URL/api/deploy/erc20" -H 'Content-Type: application/json' -d "$payload" || true)

  ok=$(echo "$resp" | jq -r '.ok // false' 2>/dev/null || echo false)
  address=$(echo "$resp" | jq -r '.result.address // empty' 2>/dev/null || echo "")
  explorer=$(echo "$resp" | jq -r '.result.explorerUrl // empty' 2>/dev/null || echo "")

  # Append to JSON results
  item=$(jq -nc --arg idx "$idx" --arg name "$NAME" --arg symbol "$SYMBOL" --arg supply "$supplyVal" --arg ok "$ok" --arg address "$address" --arg explorer "$explorer" '{index:$idx|tonumber, name:$name, symbol:$symbol, supply: ($supply|tonumber), ok:($ok=="true"), address:$address, explorer:$explorer, raw: .}' <<<"{}")
  # Preserve full raw response too
  item=$(jq --argjson raw "${resp:-null}" '.raw = ($raw // null)' <<<"$item" 2>/dev/null || echo "$item")
  results_json=$(jq --argjson item "$item" '. + [$item]' <<<"$results_json")

  # Append to Markdown
  if [[ -z "$explorer" && -n "$address" && "$NETWORK" == "basecamp" ]]; then
    explorer="https://basecamp.cloud.blockscout.com/address/$address"
  fi
  printf "| %s | %s | %s | %s | %s | %s | %s |\n" "$idx" "$NAME" "$SYMBOL" "$supplyVal" "${address:-}" "${explorer:-}" "$ok" >> "$MD_OUT"

  # Small delay to be polite to RPC/explorer
  sleep 1

done

# Save JSON
jq '.' <<< "$results_json" > "$JSON_OUT"

# Footer in Markdown
{
  echo
  echo "Saved JSON: $JSON_OUT"
  echo "Completed: $(date -Iseconds)"
} >> "$MD_OUT"

# Echo summary
echo "[DONE] Saved:"
echo "- $JSON_OUT"
echo "- $MD_OUT"
