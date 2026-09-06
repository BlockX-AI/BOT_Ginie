# GameSpec Validation Schema

Required fields for game planning stage. AI must generate spec matching this schema before code.

## Schema Definition

```typescript
interface GameSpec {
  // REQUIRED: Core identity
  meta: {
    name: string;                    // Contract name (PascalCase)
    gameType: 'puzzle' | 'runner' | 'pvp' | 'idle' | 'betting' | 'tournament';
    description: string;             // One-line summary
  };

  // REQUIRED: Game mechanics
  mechanics: {
    winCondition: string;            // How does a player win?
    loseCondition: string;           // How does a player lose?
    coreLoop: string[];              // Steps: ["join", "play", "resolve", "claim"]
    playerCount: {
      min: number;                   // 1 for single-player
      max: number;                   // Cap for multiplayer
    };
    turnBased: boolean;              // true = sequential turns, false = real-time/async
    sessionDuration?: {
      maxTurns?: number;
      maxSeconds?: number;
    };
  };

  // REQUIRED: Anti-exploit measures
  griefingResistance: {
    timeoutHandling: string;         // What happens on player timeout?
    abandonmentPenalty: string;      // Stake loss, rating penalty, etc.
    spamPrevention: string;          // Cooldowns, costs, rate limits
    mevProtection?: string;          // Commitment scheme if needed
  };

  // REQUIRED: Economics
  economics: {
    entryType: 'free' | 'stake' | 'fee' | 'token';
    stakeCurrency?: 'ETH' | 'ERC20';
    rewardDistribution: string;      // "winner-takes-all" | "proportional" | "tiered"
    rewardCurve?: 'linear' | 'logarithmic' | 'exponential' | 'tiered';
    feeModel?: {
      platformFee: number;           // Basis points (100 = 1%)
      burnRate?: number;
    };
  };

  // REQUIRED: On-chain physics/rules
  physics: {
    deterministicRules: string[];    // List of deterministic calculations
    randomnessSource?: 'none' | 'commitment' | 'blockhash' | 'vrf';
    clientAuthority: string[];       // What client CAN decide
    serverAuthority: string[];       // What contract MUST calculate
  };

  // REQUIRED: Storage design
  storage: {
    stateSize: 'minimal' | 'moderate' | 'complex';
    primaryStructs: string[];        // Main data structures
    useBitmaps: boolean;             // Pack booleans?
    maxEntitiesPerUser: number;      // Bound on user-created items
    cleanupStrategy?: string;        // How old data is handled
  };

  // OPTIONAL: Advanced features
  advanced?: {
    leaderboard?: boolean;
    achievements?: boolean;
    seasons?: boolean;
    nftIntegration?: boolean;
    crossChain?: boolean;
  };
}
```

## Validation Rules

### Must Have
- [ ] `mechanics.winCondition` is non-empty
- [ ] `mechanics.coreLoop` has at least 3 steps
- [ ] `griefingResistance.timeoutHandling` is defined
- [ ] `economics.rewardDistribution` is defined
- [ ] `physics.deterministicRules` has at least 1 rule
- [ ] `physics.serverAuthority` includes all outcome calculations
- [ ] `storage.maxEntitiesPerUser` is <= 100

### Red Flags (Auto-Reject)
- `physics.clientAuthority` includes "damage", "score", "position", "outcome"
- `storage.stateSize` is "complex" without cleanup strategy
- `mechanics.sessionDuration` is missing for multiplayer games
- `griefingResistance` is empty for stake-based games

### Warnings
- No `randomnessSource` for games with chance elements
- No `mevProtection` for competitive games with hidden info
- High `maxEntitiesPerUser` (> 50)

## Example Valid Spec

```json
{
  "meta": {
    "name": "RockPaperScissors",
    "gameType": "pvp",
    "description": "Classic RPS with ETH stakes"
  },
  "mechanics": {
    "winCondition": "Win 3 rounds before opponent",
    "loseCondition": "Opponent wins 3 rounds or timeout",
    "coreLoop": ["createGame", "joinGame", "commitMove", "revealMove", "claimWin"],
    "playerCount": { "min": 2, "max": 2 },
    "turnBased": true,
    "sessionDuration": { "maxTurns": 10 }
  },
  "griefingResistance": {
    "timeoutHandling": "Non-responsive player forfeits after 1 hour",
    "abandonmentPenalty": "Full stake loss to opponent",
    "spamPrevention": "One active game per player",
    "mevProtection": "Commitment-reveal for hidden moves"
  },
  "economics": {
    "entryType": "stake",
    "stakeCurrency": "ETH",
    "rewardDistribution": "winner-takes-all",
    "feeModel": { "platformFee": 250 }
  },
  "physics": {
    "deterministicRules": [
      "Rock beats Scissors",
      "Scissors beats Paper", 
      "Paper beats Rock",
      "Matching moves = tie"
    ],
    "randomnessSource": "none",
    "clientAuthority": ["move choice", "when to commit", "when to reveal"],
    "serverAuthority": ["round winner calculation", "game winner determination", "stake distribution"]
  },
  "storage": {
    "stateSize": "minimal",
    "primaryStructs": ["Game { players, commits, reveals, scores, state }"],
    "useBitmaps": false,
    "maxEntitiesPerUser": 5,
    "cleanupStrategy": "Delete game data 7 days after completion"
  }
}
```

## AI Instructions

When generating a GameSpec:
1. Fill ALL required fields
2. Validate against rules before outputting
3. If unclear, ask user for clarification on:
   - Win/lose conditions
   - Stake requirements
   - Player count
4. Output as valid JSON inside ```json block
