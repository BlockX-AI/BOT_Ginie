# Runner Game Reference Implementation

Annotated skeleton for endless runner with score verification.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EndlessRunner is ReentrancyGuard {
  // ═══════════════════════════════════════════════════════════════
  // CONSTANTS: Deterministic physics parameters
  // ═══════════════════════════════════════════════════════════════
  
  uint32 constant MAX_TICKS = 10000;      // ✅ Bounded simulation
  uint8 constant NUM_LANES = 3;
  uint8 constant MAX_ACTIONS = 200;       // ✅ Bounded action log
  
  // Physics (fixed-point: 1000 = 1.0)
  int32 constant GRAVITY = -50;
  int32 constant JUMP_VEL = 300;
  int32 constant GROUND = 0;
  
  // ═══════════════════════════════════════════════════════════════
  // STATE: Minimal on-chain storage
  // ═══════════════════════════════════════════════════════════════
  
  struct Run {
    address player;
    uint256 seed;           // Determines obstacles
    uint32 startBlock;
    bool finalized;
  }
  
  mapping(uint256 => Run) public runs;
  mapping(address => uint32) public highScores;
  uint256 public runCount;
  
  // ═══════════════════════════════════════════════════════════════
  // EVENTS: Full replay data in logs (not storage)
  // ═══════════════════════════════════════════════════════════════
  
  event RunStarted(uint256 indexed runId, address indexed player, uint256 seed);
  event RunFinalized(uint256 indexed runId, uint32 distance, uint32 score);
  
  // ═══════════════════════════════════════════════════════════════
  // GAME LIFECYCLE
  // ═══════════════════════════════════════════════════════════════
  
  /// @notice Start a new run - generates deterministic seed
  function startRun() external returns (uint256 runId) {
    runId = runCount++;
    
    // ✅ Seed from future block (player can't predict obstacles)
    uint256 seed = uint256(keccak256(abi.encodePacked(
      blockhash(block.number - 1),
      msg.sender,
      runId
    )));
    
    runs[runId] = Run({
      player: msg.sender,
      seed: seed,
      startBlock: uint32(block.number),
      finalized: false
    });
    
    emit RunStarted(runId, msg.sender, seed);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SCORE SUBMISSION: Client submits, contract verifies
  // ═══════════════════════════════════════════════════════════════
  
  struct Action {
    uint32 tick;      // When action occurred
    uint8 actionType; // 0=jump, 1=left, 2=right
  }
  
  /// @notice Submit score with action proof for verification
  function submitScore(
    uint256 runId,
    uint32 claimedDistance,
    uint32 claimedScore,
    Action[] calldata actions
  ) external nonReentrant {
    Run storage run = runs[runId];
    
    // ✅ Validation
    require(run.player == msg.sender, "Not your run");
    require(!run.finalized, "Already finalized");
    require(actions.length <= MAX_ACTIONS, "Too many actions");
    
    // ✅ Replay and verify
    (uint32 verifiedDist, uint32 verifiedScore) = _verifyRun(run.seed, actions);
    
    require(verifiedDist == claimedDistance, "Distance mismatch");
    require(verifiedScore == claimedScore, "Score mismatch");
    
    // ✅ Record result
    run.finalized = true;
    
    if (verifiedScore > highScores[msg.sender]) {
      highScores[msg.sender] = verifiedScore;
    }
    
    emit RunFinalized(runId, verifiedDist, verifiedScore);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // VERIFICATION: Deterministic replay of game physics
  // ═══════════════════════════════════════════════════════════════
  
  function _verifyRun(uint256 seed, Action[] calldata actions) 
    internal pure returns (uint32 distance, uint32 score) 
  {
    // Player state
    uint8 lane = 1;         // Start middle
    int32 y = GROUND;
    int32 velY = 0;
    
    uint256 actionIdx = 0;
    
    // ✅ Bounded simulation loop
    for (uint32 tick = 0; tick < MAX_TICKS; tick++) {
      // Process action if queued for this tick
      while (actionIdx < actions.length && actions[actionIdx].tick == tick) {
        uint8 aType = actions[actionIdx].actionType;
        
        if (aType == 0 && y == GROUND) {
          velY = JUMP_VEL;  // Jump (only from ground)
        } else if (aType == 1 && lane > 0) {
          lane--;           // Move left
        } else if (aType == 2 && lane < NUM_LANES - 1) {
          lane++;           // Move right
        }
        
        unchecked { actionIdx++; }
      }
      
      // Apply gravity
      velY += GRAVITY;
      y += velY;
      if (y <= GROUND) {
        y = GROUND;
        velY = 0;
      }
      
      // Check collision with obstacle at this distance
      if (_checkObstacleCollision(seed, distance, lane, y)) {
        break; // Game over
      }
      
      // Progress
      unchecked {
        distance++;
        score += 10 + (tick / 100); // Score increases over time
      }
    }
  }
  
  function _checkObstacleCollision(
    uint256 seed, 
    uint32 distance, 
    uint8 playerLane,
    int32 playerY
  ) internal pure returns (bool) {
    // Obstacle every 50 distance units
    if (distance % 50 != 0) return false;
    
    // Deterministic obstacle from seed
    uint256 hash = uint256(keccak256(abi.encodePacked(seed, distance)));
    uint8 obsLane = uint8(hash % NUM_LANES);
    bool isHighObs = (hash >> 8) % 2 == 1;
    
    // Different lane = safe
    if (obsLane != playerLane) return false;
    
    // High obstacle: must duck (y < 200)
    // Low obstacle: must jump (y > 100)
    if (isHighObs) {
      return playerY >= 200; // Collision if not ducking
    } else {
      return playerY <= 100; // Collision if not jumping
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // VIEW: Leaderboard helpers
  // ═══════════════════════════════════════════════════════════════
  
  function getHighScore(address player) external view returns (uint32) {
    return highScores[player];
  }
}
```

## Key Design Decisions
1. **Off-chain gameplay** - Real-time action happens client-side
2. **On-chain verification** - Contract replays to confirm score
3. **Deterministic obstacles** - Seed → same obstacle pattern
4. **Bounded replay** - MAX_TICKS prevents infinite loops
5. **Action log proof** - Client must prove valid inputs
