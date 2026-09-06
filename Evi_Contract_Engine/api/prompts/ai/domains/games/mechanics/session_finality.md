# Session Finality

When games end vs infinite states.

## Core Principle
Every game session MUST have a defined end condition. No infinite state accumulation.

## End Condition Types

### 1. Turn Limit
```solidity
uint8 public constant MAX_TURNS = 50;

function makeMove() external {
  require(game.turnCount < MAX_TURNS, "Game ended");
  game.turnCount++;
  // ... process move
  if (game.turnCount == MAX_TURNS) {
    _finalizeByScore();
  }
}
```

### 2. Win Condition
```solidity
function checkWin(uint256 gameId) internal returns (bool) {
  // Example: First to 100 points
  if (games[gameId].score1 >= WIN_SCORE) {
    _declareWinner(gameId, games[gameId].player1);
    return true;
  }
  if (games[gameId].score2 >= WIN_SCORE) {
    _declareWinner(gameId, games[gameId].player2);
    return true;
  }
  return false;
}
```

### 3. Time Limit
```solidity
uint256 public constant GAME_DURATION = 1 hours;

function isGameExpired(uint256 gameId) public view returns (bool) {
  return block.timestamp > games[gameId].startTime + GAME_DURATION;
}

function finalizeExpiredGame(uint256 gameId) external {
  require(isGameExpired(gameId), "Game still active");
  require(games[gameId].state == GameState.ACTIVE);
  _finalizeByScore(gameId);
}
```

### 4. Elimination
```solidity
function eliminate(uint256 gameId, address player) internal {
  games[gameId].eliminated[player] = true;
  games[gameId].remainingPlayers--;
  
  if (games[gameId].remainingPlayers == 1) {
    _declareLastStanding(gameId);
  }
}
```

## State Machine Pattern
```solidity
enum GameState { 
  WAITING,    // Waiting for players
  ACTIVE,     // Game in progress
  FINISHED,   // Normal end
  CANCELLED,  // Aborted before start
  EXPIRED     // Timeout end
}

// Valid transitions only
function _transition(uint256 gameId, GameState newState) internal {
  GameState current = games[gameId].state;
  
  if (current == GameState.WAITING) {
    require(newState == GameState.ACTIVE || newState == GameState.CANCELLED);
  } else if (current == GameState.ACTIVE) {
    require(newState == GameState.FINISHED || newState == GameState.EXPIRED);
  } else {
    revert("Invalid transition");
  }
  
  games[gameId].state = newState;
  emit GameStateChanged(gameId, newState);
}
```

## Cleanup Pattern
```solidity
// Allow old game data deletion for gas refund
function cleanupGame(uint256 gameId) external {
  require(games[gameId].state == GameState.FINISHED || 
          games[gameId].state == GameState.EXPIRED);
  require(block.timestamp > games[gameId].endTime + CLEANUP_DELAY);
  
  delete games[gameId]; // Gas refund
  emit GameCleaned(gameId);
}
```

## Required in GameSpec
```json
{
  "session": {
    "endConditions": ["win_score", "turn_limit", "timeout"],
    "maxTurns": 50,
    "maxDuration": 3600,
    "winScore": 100,
    "tiebreaker": "highest_score"
  }
}
```

## Anti-Exploit
- [ ] All games have at least one guaranteed end condition
- [ ] Timeout exists for all waiting states
- [ ] Clear tiebreaker rules defined
- [ ] Funds cannot be locked in infinite games
- [ ] Cleanup mechanism for old game data
