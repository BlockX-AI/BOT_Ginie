Task: Convert a user game idea into a structured GameSpec JSON for reliable contract generation.

Input:
- A single user sentence.

Output:
- Return ONLY valid JSON (no markdown).

Schema:
{
  "game": {
    "title": "",
    "genre": "",
    "coreLoop": "",
    "players": { "min": 1, "max": 2 },
    "randomness": "none|weak_ok|needs_vrf",
    "economy": { "entryFee": "none|optional|required", "rewards": "none|fixed|pool" },
    "antiCheat": "MVP|SIGNED_CLAIMS",
    "leaderboard": { "mode": "events|topN", "topN": 10 }
  },
  "contract": {
    "pattern": "betting|turn_based|score_nft|tournament",
    "funds": "none|native|erc20",
    "roles": ["DEFAULT_ADMIN_ROLE", "PAUSER_ROLE"],
    "events": ["..."],
    "views": ["..."],
    "securityNotes": ["..."]
  }
}

Rules:
- Keep it simple and on-chain feasible.
- Prefer bounded leaderboards (Top N) or events.
- If the user asks to mint scores/rewards, recommend SIGNED_CLAIMS.
