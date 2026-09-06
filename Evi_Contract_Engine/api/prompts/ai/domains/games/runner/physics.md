# Runner Game Physics

Gravity, collision, spawn rates for endless runner / platformer.

## Core Challenge
Runners need fast-paced action but blockchain is slow. Solution: **Score submission with verification**.

## Architecture
```
┌─────────────────────────────────────────────┐
│                 CLIENT                       │
│  - Real-time physics simulation             │
│  - Input handling (jump, duck, lane change) │
│  - Visual feedback                          │
│  - Records action log                       │
└──────────────────────┬──────────────────────┘
                       │ Submit score + proof
┌──────────────────────▼──────────────────────┐
│                CONTRACT                      │
│  - Verifies action sequence is valid        │
│  - Replays deterministic simulation         │
│  - Confirms score matches                   │
│  - Records final score on-chain             │
└─────────────────────────────────────────────┘
```

## Deterministic Physics Rules

### Gravity & Jump
```solidity
// Fixed-point math (1000 = 1.0)
int32 constant GRAVITY = -50;        // Units per tick²
int32 constant JUMP_VELOCITY = 300;  // Initial upward velocity
int32 constant GROUND_Y = 0;
int32 constant MAX_HEIGHT = 1000;

struct PlayerState {
  int32 y;          // Vertical position
  int32 velocityY;  // Vertical velocity
  uint32 tick;      // Game tick counter
}

function applyPhysics(PlayerState memory p) internal pure returns (PlayerState memory) {
  p.velocityY += GRAVITY;
  p.y += p.velocityY;
  
  // Ground collision
  if (p.y <= GROUND_Y) {
    p.y = GROUND_Y;
    p.velocityY = 0;
  }
  
  // Ceiling cap
  if (p.y > MAX_HEIGHT) {
    p.y = MAX_HEIGHT;
    p.velocityY = 0;
  }
  
  p.tick++;
  return p;
}
```

### Lane System (Subway Surfer style)
```solidity
uint8 constant NUM_LANES = 3;
uint8 constant LANE_WIDTH = 100;

struct RunnerState {
  uint8 lane;           // 0, 1, or 2
  int32 y;              // Vertical for jump/duck
  uint32 distance;      // How far traveled
  uint32 score;
}

function changeLane(RunnerState memory s, int8 direction) internal pure returns (RunnerState memory) {
  int8 newLane = int8(s.lane) + direction;
  if (newLane >= 0 && newLane < int8(NUM_LANES)) {
    s.lane = uint8(newLane);
  }
  return s;
}
```

### Obstacle Spawning (Deterministic)
```solidity
// Obstacles generated from seed - same seed = same obstacles
function getObstacleAt(uint256 seed, uint32 distance) internal pure returns (Obstacle memory) {
  // Hash distance to get deterministic obstacle
  uint256 hash = uint256(keccak256(abi.encodePacked(seed, distance / SPAWN_INTERVAL)));
  
  return Obstacle({
    lane: uint8(hash % NUM_LANES),
    obstacleType: uint8((hash >> 8) % NUM_OBSTACLE_TYPES),
    height: uint8((hash >> 16) % 2) // Low or high
  });
}

function checkCollision(RunnerState memory player, Obstacle memory obs, uint32 distance) 
  internal pure returns (bool) 
{
  // Same lane?
  if (player.lane != obs.lane) return false;
  
  // Height check (jumping over or ducking under)
  if (obs.height == 0 && player.y > JUMP_THRESHOLD) return false; // Jumped over
  if (obs.height == 1 && player.y < DUCK_THRESHOLD) return false; // Ducked under
  
  return true; // Collision!
}
```

## Score Verification Pattern
```solidity
struct GameRun {
  uint256 seed;           // Determines obstacle layout
  uint32 startTime;
  address player;
}

struct ActionLog {
  uint32 tick;            // When action occurred
  uint8 actionType;       // 0=jump, 1=duck, 2=left, 3=right
}

function submitScore(
  uint256 runId,
  uint32 finalDistance,
  uint32 claimedScore,
  ActionLog[] calldata actions
) external {
  GameRun storage run = runs[runId];
  require(run.player == msg.sender, "Not your run");
  
  // Replay simulation with provided actions
  (uint32 verifiedDistance, uint32 verifiedScore) = _replayRun(run.seed, actions);
  
  require(verifiedDistance == finalDistance, "Distance mismatch");
  require(verifiedScore == claimedScore, "Score mismatch");
  
  // Record verified score
  scores[msg.sender] = verifiedScore > scores[msg.sender] ? verifiedScore : scores[msg.sender];
}

function _replayRun(uint256 seed, ActionLog[] calldata actions) 
  internal pure returns (uint32 distance, uint32 score) 
{
  RunnerState memory state;
  uint256 actionIndex = 0;
  
  // Simulate until collision or max ticks
  for (uint32 tick = 0; tick < MAX_TICKS; tick++) {
    // Apply queued action if timing matches
    if (actionIndex < actions.length && actions[actionIndex].tick == tick) {
      state = _applyAction(state, actions[actionIndex].actionType);
      actionIndex++;
    }
    
    // Apply physics
    state = _applyPhysics(state);
    
    // Check collision
    Obstacle memory obs = getObstacleAt(seed, state.distance);
    if (checkCollision(state, obs, state.distance)) {
      break; // Game over
    }
    
    state.distance++;
    state.score += _getScoreForTick(tick);
  }
  
  return (state.distance, state.score);
}
```

## Gas Optimization
- Action log: ~100 actions max per run
- Replay verification: bounded by MAX_TICKS
- Store only: seed, final score, player address
- Events: emit detailed run data for replay viewing
