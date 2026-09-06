# Prompt Suite Registry

## PUZZLE_COMPLETE

### Required Prompts (in order)
1. `shared/00_style.md` 
2. `shared/01_safety_and_integrity.md` 
3. `contracts/00_base_generate.md` 
4. `domains/games/puzzle/physics.md` ⭐
5. `domains/games/puzzle/reference.md` ⭐
6. `contracts/primitives/bounded_state.md` 
7. `contracts/verification/client_authority_budget.md` ⭐
8. `contracts/gas/bitmap_techniques.md` 
9. `contracts/acceptance/gas_benchmarks.md` 
10. `contracts/acceptance/state_bounds.md` 

### Contract Interface Template
```solidity
interface IPuzzleGame {
    function submitScore(uint256 score, bytes calldata proof) external;
    function getPlayerBest(address player) external view returns (uint256);
    function getTopScores(uint8 limit) external view returns (address[] memory, uint256[] memory);
}
```

### GameSpec Required Fields
- `grid.size` (e.g., "8x8", "4x4")
- `grid.initialState` ("random", "fixed", "empty")
- `moves.validation` ("adjacent_only", "any_tile", "pattern_match")
- `scoring.formula` ("tile_value * multiplier", "combo_based")
- `scoring.maxPossible` (hard cap)
- `physics.gravity` ("down", "none")
- `physics.cascade` (boolean)

### Acceptance Criteria
- Grid state fits in single storage slot or bounded array
- Move validation happens on-chain OR via ZK proof
- No unbounded loops in move processing
- Score deterministic from grid state
- Gas per move <80k

---

## RUNNER_COMPLETE

### Required Prompts (in order)
1. `shared/00_style.md` 
2. `shared/01_safety_and_integrity.md` 
3. `contracts/00_base_generate.md` 
4. `domains/games/mechanics/session_finality.md` 
5. `domains/games/runner/physics.md` ⭐
6. `domains/games/runner/reference.md` ⭐
7. `contracts/verification/server_verification.md` ⭐
8. `contracts/verification/replay_prevention.md` 
9. `contracts/acceptance/gas_benchmarks.md` 
10. `contracts/acceptance/edge_cases.md` 

### Contract Interface Template
```solidity
interface IRunnerGame {
    struct Run {
        uint256 distance;
        uint256 timestamp;
        bytes32 seed;
    }
    
    function claimScore(
        uint256 distance,
        uint256 timestamp,
        bytes32 seed,
        bytes calldata signature
    ) external;
}
```

### GameSpec Required Fields
- `physics.gravity` (pixels/frame²)
- `physics.jumpForce` (pixels/frame)
- `physics.runSpeed` (pixels/frame)
- `obstacles.spawnRate` (obstacles/1000 pixels)
- `obstacles.types` (["spike", "gap", "moving"])
- `session.maxDuration` (seconds)
- `verification.replayWindow` (seconds)

### Acceptance Criteria
- Physics constants match client exactly
- Backend verifies score <= theoretical max for time
- Seed-based obstacle generation is deterministic
- No score accepted without valid signature
- Replay attacks prevented via nonce/timestamp

---

## PVP_TURN_COMPLETE

### Required Prompts (in order)
1. `shared/00_style.md` 
2. `shared/01_safety_and_integrity.md` 
3. `contracts/00_base_generate.md` 
4. `domains/games/mechanics/incentive_alignment.md` 
5. `domains/games/mechanics/griefing_resistance.md` 
6. `domains/games/pvp/physics.md` ⭐
7. `domains/games/pvp/reference.md` ⭐
8. `contracts/primitives/pvp_matchmaking.md` 
9. `contracts/verification/deterministic_randomness.md` 
10. `contracts/verification/replay_prevention.md` 
11. `contracts/acceptance/gas_benchmarks.md` 
12. `contracts/acceptance/state_bounds.md` 

### Contract Interface Template
```solidity
interface IPvPTurnGame {
    struct Match {
        address player1;
        address player2;
        uint8 currentTurn;
        uint256 lastMoveTime;
        GameState state;
    }
    
    function commitMove(uint256 matchId, bytes32 moveHash) external;
    function revealMove(uint256 matchId, Move calldata move, bytes32 salt) external;
    function claimTimeout(uint256 matchId) external;
}
```

### GameSpec Required Fields
- `match.duration` (max turns or time)
- `match.turnTimeout` (seconds per turn)
- `match.commitment` ("reveal_after_both", "reveal_immediate")
- `match.stakeAmount` (entry fee)
- `match.winCondition` (description)
- `griefing.timeoutPenalty` (lose stake, ELO penalty)
- `griefing.abandonPenalty` 

### Acceptance Criteria
- Commit-reveal prevents front-running
- Timeout mechanism enforced
- Stakes handled correctly (winner, draw, timeout)
- Griefing costs > griefing benefit
- State transitions validated on-chain

---

## PVP_REALTIME_COMPLETE

### Required Prompts (in order)
1. `shared/00_style.md` 
2. `shared/01_safety_and_integrity.md` 
3. `contracts/00_base_generate.md` 
4. `domains/games/mechanics/session_finality.md` 
5. `domains/games/pvp/physics.md` ⭐
6. `domains/games/pvp/reference.md` ⭐
7. `contracts/primitives/checkpoint_state.md` 
8. `contracts/verification/server_verification.md` 
9. `contracts/acceptance/gas_benchmarks.md` 
10. `contracts/acceptance/edge_cases.md` 

### Contract Interface Template
```solidity
interface IPvPRealtimeGame {
    struct GameResult {
        address winner;
        uint256 p1Score;
        uint256 p2Score;
        bytes32 finalStateHash;
    }
    
    function submitResult(
        uint256 matchId,
        GameResult calldata result,
        bytes calldata signatures
    ) external;
    
    function dispute(uint256 matchId, bytes calldata proof) external;
}
```

### GameSpec Required Fields
- `session.mode` ("state_channel", "optimistic", "checkpoint")
- `session.checkpointInterval` (seconds)
- `dispute.window` (seconds)
- `dispute.bondAmount` (wei)
- `physics.tickRate` (updates/second)
- `consensus.requireBothSignatures` (boolean)

### Acceptance Criteria
- Most gameplay happens off-chain
- Settlement uses signed state or checkpoints
- Dispute resolution favors provable claims
- Griefing bonds prevent spam disputes
- Frontend handles network lag gracefully

---

## IDLE_COMPLETE

### Required Prompts (in order)
1. `shared/00_style.md` 
2. `shared/01_safety_and_integrity.md` 
3. `contracts/00_base_generate.md` 
4. `domains/games/mechanics/reward_curves.md` 
5. `domains/games/idle/physics.md` ⭐
6. `domains/games/idle/reference.md` ⭐
7. `contracts/primitives/energy_system.md` 
8. `contracts/primitives/economic_sinks.md` 
9. `contracts/gas/batch_operations.md` 
10. `contracts/acceptance/gas_benchmarks.md` 
11. `contracts/acceptance/state_bounds.md` 

### Contract Interface Template
```solidity
interface IIdleGame {
    struct PlayerState {
        uint256 lastClaim;
        uint256 productionRate;
        uint8[10] upgradeLevels;
    }
    
    function claim() external returns (uint256 earned);
    function buyUpgrade(uint8 upgradeId) external;
    function getAccumulated(address player) external view returns (uint256);
}
```

### GameSpec Required Fields
- `accumulation.baseRate` (tokens/second)
- `accumulation.maxOffline` (seconds, prevents infinite claims)
- `upgrades.count` (number of upgrade types)
- `upgrades.costFormula` ("exponential", "linear")
- `upgrades.effectFormula` (rate multiplier)
- `economy.sink` ("burn", "stake", "none")

### Acceptance Criteria
- Time-based earnings capped (no overflow)
- Upgrade costs prevent infinite progression
- Offline accumulation limited
- No claiming future earnings
- Gas optimized for batch upgrades

---

## RPG_COMPLETE

### Required Prompts (in order)
1. `shared/00_style.md` 
2. `shared/01_safety_and_integrity.md` 
3. `contracts/00_base_generate.md` 
4. `domains/games/mechanics/reward_curves.md` 
5. `contracts/primitives/progression_trees.md` 
6. `contracts/verification/deterministic_randomness.md` 
7. `contracts/acceptance/gas_benchmarks.md` 
8. `contracts/acceptance/state_bounds.md` 
9. `contracts/acceptance/edge_cases.md` 

### Contract Interface Template
```solidity
interface IRPGGame {
    struct Character {
        uint8 level;
        uint16 str;
        uint16 dex;
        uint16 int;
        uint32 exp;
        uint256 equippedItems;
    }
    
    function createCharacter() external returns (uint256 tokenId);
    function completeQuest(uint256 tokenId, uint8 questId) external;
    function battlePvE(uint256 tokenId, uint8 enemyId) external;
}
```

### GameSpec Required Fields
- `character.baseStats` (starting STR/DEX/INT)
- `character.levelCap` 
- `character.expCurve` ("linear", "exponential")
- `combat.damageFormula` 
- `combat.critChance` (%)
- `loot.randomness` ("VRF", "blockhash", "deterministic")
- `progression.statPointsPerLevel` 

### Acceptance Criteria
- Character data fits in NFT metadata
- Combat outcomes deterministic given inputs
- Randomness verifiable (VRF or commit-reveal)
- Experience/leveling prevents overflow
- Item equipment validated on-chain

---

## BETTING_COMPLETE

### Required Prompts (in order)
1. `shared/00_style.md` 
2. `shared/01_safety_and_integrity.md` 
3. `contracts/00_base_generate.md` 
4. `contracts/verification/deterministic_randomness.md` 
5. `contracts/primitives/economic_sinks.md` 
6. `contracts/acceptance/gas_benchmarks.md` 
7. `contracts/acceptance/edge_cases.md` 

### Contract Interface Template
```solidity
interface IBettingGame {
    struct Bet {
        address player;
        uint256 amount;
        uint8 prediction;
        bool settled;
    }
    
    function placeBet(uint8 prediction) external payable;
    function settleBet(uint256 betId, bytes32 vrfResult) external;
    function claimWinnings(uint256 betId) external;
}
```

### GameSpec Required Fields
- `betting.minBet` (wei)
- `betting.maxBet` (wei)
- `betting.houseEdge` (percentage)
- `randomness.source` ("VRF", "commit_reveal")
- `payout.multiplier` (for wins)
- `settlement.delay` (blocks)

### Acceptance Criteria
- Randomness is verifiably fair
- House edge correctly implemented
- No bet manipulation possible
- Payouts calculated correctly
- Funds properly escrowed

---

## SECONDARY MECHANICS PROMPTS

### Economy Tokens
- `contracts/primitives/economic_sinks.md`
- `domains/games/mechanics/reward_curves.md`

### Economy NFT
- `contracts/primitives/progression_trees.md` (for character NFTs)

### Social Guilds
- `contracts/primitives/pvp_matchmaking.md` (adapted for teams)

### Social PVP
- `domains/games/mechanics/griefing_resistance.md`
- `contracts/verification/replay_prevention.md`

### Progression Linear
- `contracts/primitives/progression_trees.md`

### Progression Tree
- `contracts/primitives/progression_trees.md`

### Randomness VRF
- `contracts/verification/deterministic_randomness.md`

### Leaderboard Global
- `contracts/acceptance/state_bounds.md` (for leaderboard limits)

### Leaderboard Seasonal
- `domains/games/mechanics/session_finality.md`

### Energy System
- `contracts/primitives/energy_system.md`

### Matchmaking
- `contracts/primitives/pvp_matchmaking.md`

---

## PROMPT SUITE LOADER

```javascript
const PROMPT_SUITES = {
  puzzle_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'domains/games/puzzle/physics.md',
    'domains/games/puzzle/reference.md',
    'contracts/primitives/bounded_state.md',
    'contracts/verification/client_authority_budget.md',
    'contracts/gas/bitmap_techniques.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/state_bounds.md'
  ],
  
  runner_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'domains/games/mechanics/session_finality.md',
    'domains/games/runner/physics.md',
    'domains/games/runner/reference.md',
    'contracts/verification/server_verification.md',
    'contracts/verification/replay_prevention.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/edge_cases.md'
  ],
  
  pvp_turn_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'domains/games/mechanics/incentive_alignment.md',
    'domains/games/mechanics/griefing_resistance.md',
    'domains/games/pvp/physics.md',
    'domains/games/pvp/reference.md',
    'contracts/primitives/pvp_matchmaking.md',
    'contracts/verification/deterministic_randomness.md',
    'contracts/verification/replay_prevention.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/state_bounds.md'
  ],
  
  pvp_realtime_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'domains/games/mechanics/session_finality.md',
    'domains/games/pvp/physics.md',
    'domains/games/pvp/reference.md',
    'contracts/primitives/checkpoint_state.md',
    'contracts/verification/server_verification.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/edge_cases.md'
  ],
  
  idle_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'domains/games/mechanics/reward_curves.md',
    'domains/games/idle/physics.md',
    'domains/games/idle/reference.md',
    'contracts/primitives/energy_system.md',
    'contracts/primitives/economic_sinks.md',
    'contracts/gas/batch_operations.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/state_bounds.md'
  ],
  
  rpg_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'domains/games/mechanics/reward_curves.md',
    'contracts/primitives/progression_trees.md',
    'contracts/verification/deterministic_randomness.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/state_bounds.md',
    'contracts/acceptance/edge_cases.md'
  ],
  
  betting_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'contracts/verification/deterministic_randomness.md',
    'contracts/primitives/economic_sinks.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/edge_cases.md'
  ]
};

const SECONDARY_MECHANICS_PROMPTS = {
  economy_tokens: ['contracts/primitives/economic_sinks.md', 'domains/games/mechanics/reward_curves.md'],
  economy_nft: ['contracts/primitives/progression_trees.md'],
  social_guilds: ['contracts/primitives/pvp_matchmaking.md'],
  social_pvp: ['domains/games/mechanics/griefing_resistance.md', 'contracts/verification/replay_prevention.md'],
  progression_linear: ['contracts/primitives/progression_trees.md'],
  progression_tree: ['contracts/primitives/progression_trees.md'],
  randomness_vrf: ['contracts/verification/deterministic_randomness.md'],
  leaderboard_global: ['contracts/acceptance/state_bounds.md'],
  leaderboard_seasonal: ['domains/games/mechanics/session_finality.md'],
  energy_system: ['contracts/primitives/energy_system.md'],
  matchmaking: ['contracts/primitives/pvp_matchmaking.md']
};

function loadPromptSuite(classification) {
  const basePrompts = PROMPT_SUITES[classification.promptSuite] || [];
  const secondaryPrompts = [];
  
  // Add secondary mechanic prompts
  for (const mechanic of classification.secondaryMechanics || []) {
    const mechanicPrompts = SECONDARY_MECHANICS_PROMPTS[mechanic] || [];
    for (const prompt of mechanicPrompts) {
      if (!basePrompts.includes(prompt) && !secondaryPrompts.includes(prompt)) {
        secondaryPrompts.push(prompt);
      }
    }
  }
  
  return {
    prompts: [...basePrompts, ...secondaryPrompts],
    gameType: classification.gameType,
    complexity: classification.contractComplexity,
    gasProfile: classification.gasProfile,
    antiCheatLevel: classification.antiCheatLevel
  };
}
```

## USAGE EXAMPLE

```javascript
// 1. Classify game idea
const gameIdea = "A 2048-style puzzle game with leaderboard and token rewards";
const classification = classifyGame(gameIdea);

// 2. Load appropriate prompt suite
const promptSuite = loadPromptSuite(classification);

// 3. Generate contract with targeted prompts
const contract = await generateContract(gameIdea, promptSuite.prompts);
```
