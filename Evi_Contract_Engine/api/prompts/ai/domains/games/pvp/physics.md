# PvP Game Physics

Turn-based and real-time competitive mechanics.

## Turn-Based PvP

### State Machine
```
WAITING → ACTIVE → FINISHED
    ↓
 CANCELLED

Transitions:
- WAITING → ACTIVE: When all players join
- WAITING → CANCELLED: Timeout or creator cancel
- ACTIVE → FINISHED: Win condition or turn limit
```

### Turn Management
```solidity
struct TurnState {
  uint8 currentPlayer;    // Index of whose turn
  uint8 turnNumber;       // Current turn (for limits)
  uint32 turnDeadline;    // Must move before this
  uint8 playerCount;
}

function advanceTurn(TurnState memory t) internal view returns (TurnState memory) {
  t.currentPlayer = (t.currentPlayer + 1) % t.playerCount;
  if (t.currentPlayer == 0) {
    t.turnNumber++; // Full round completed
  }
  t.turnDeadline = uint32(block.timestamp) + TURN_DURATION;
  return t;
}
```

### Combat Resolution
```solidity
// Rock-Paper-Scissors example
function resolveRPS(uint8 move1, uint8 move2) internal pure returns (int8) {
  // 0=rock, 1=paper, 2=scissors
  if (move1 == move2) return 0; // Tie
  if ((move1 + 1) % 3 == move2) return -1; // Player 2 wins
  return 1; // Player 1 wins
}

// Stat-based combat
function resolveCombat(
  uint16 attackerPower,
  uint16 defenderDefense,
  uint256 randomSeed
) internal pure returns (uint16 damage) {
  // Base damage
  int32 base = int32(uint32(attackerPower)) - int32(uint32(defenderDefense)) / 2;
  if (base < 1) base = 1;
  
  // Variance: ±20% using seed
  uint16 variance = uint16((randomSeed % 40) + 80); // 80-120%
  damage = uint16(uint32(base) * variance / 100);
}
```

## Commitment-Reveal for Hidden Moves
```solidity
struct CommitReveal {
  bytes32 p1Commit;
  bytes32 p2Commit;
  uint8 p1Move;
  uint8 p2Move;
  uint8 revealed; // Bitmask: bit 0 = p1, bit 1 = p2
}

// Commit phase
function commitMove(uint256 gameId, bytes32 commitment) external {
  // Store hash of (move + salt + sender)
  uint8 playerIndex = _getPlayerIndex(gameId, msg.sender);
  if (playerIndex == 0) games[gameId].cr.p1Commit = commitment;
  else games[gameId].cr.p2Commit = commitment;
}

// Reveal phase
function revealMove(uint256 gameId, uint8 move, bytes32 salt) external {
  bytes32 expected = keccak256(abi.encodePacked(gameId, move, salt, msg.sender));
  uint8 playerIndex = _getPlayerIndex(gameId, msg.sender);
  
  if (playerIndex == 0) {
    require(games[gameId].cr.p1Commit == expected, "Invalid reveal");
    games[gameId].cr.p1Move = move;
    games[gameId].cr.revealed |= 1;
  } else {
    require(games[gameId].cr.p2Commit == expected, "Invalid reveal");
    games[gameId].cr.p2Move = move;
    games[gameId].cr.revealed |= 2;
  }
  
  // Both revealed? Resolve!
  if (games[gameId].cr.revealed == 3) {
    _resolveRound(gameId);
  }
}
```

## Real-Time PvP Considerations

### Challenge: Blockchain Latency
- Block time: 2-12 seconds
- Not suitable for frame-by-frame action

### Solution: Turn Windows
```solidity
// Both players submit within window, resolve at end
uint32 constant ACTION_WINDOW = 10 seconds;

struct ActionWindow {
  uint32 windowStart;
  bytes32 p1ActionHash;
  bytes32 p2ActionHash;
}

function submitAction(uint256 gameId, bytes32 actionHash) external {
  ActionWindow storage w = windows[gameId];
  
  // New window?
  if (block.timestamp > w.windowStart + ACTION_WINDOW) {
    _resolveWindow(gameId); // Resolve previous
    w.windowStart = uint32(block.timestamp);
    w.p1ActionHash = bytes32(0);
    w.p2ActionHash = bytes32(0);
  }
  
  // Record action
  uint8 idx = _getPlayerIndex(gameId, msg.sender);
  if (idx == 0) w.p1ActionHash = actionHash;
  else w.p2ActionHash = actionHash;
}
```

## ELO/Rating System
```solidity
// Simplified ELO calculation
function updateRatings(
  uint16 winnerRating,
  uint16 loserRating
) internal pure returns (uint16 newWinner, uint16 newLoser) {
  // K-factor
  uint16 K = 32;
  
  // Expected scores
  int32 diff = int32(uint32(winnerRating)) - int32(uint32(loserRating));
  uint16 expectedWinner = uint16(1000 / (1 + uint256(10 ** uint256(uint32(-diff / 400)))));
  
  // Actual: winner = 1, loser = 0
  int16 winnerChange = int16(uint16(K * (1000 - expectedWinner) / 1000));
  
  newWinner = winnerRating + uint16(winnerChange);
  newLoser = loserRating > uint16(winnerChange) ? loserRating - uint16(winnerChange) : 100;
}
```

## Anti-Grief Patterns
- Timeout forfeit after missed turn
- Stake slashing for abandonment
- Rating penalty for disconnects
- Cooldown after forfeit before new match
