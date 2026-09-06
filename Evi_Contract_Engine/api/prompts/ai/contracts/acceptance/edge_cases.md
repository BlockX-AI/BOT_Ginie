# Edge Cases

Empty state, max state, overflow scenarios to handle.

## Required Edge Case Coverage

### 1. Zero/Empty States
```solidity
// Handle first player
function getLeader() public view returns (address) {
  if (players.length == 0) return address(0);
  return players[0];
}

// Handle zero balance
function withdraw() external {
  uint256 balance = balances[msg.sender];
  require(balance > 0, "Nothing to withdraw"); // Explicit check
  balances[msg.sender] = 0;
  payable(msg.sender).transfer(balance);
}

// Handle empty game
function getCurrentPlayer(uint256 gameId) public view returns (address) {
  Game storage g = games[gameId];
  if (g.state == GameState.WAITING || g.playerCount == 0) {
    return address(0);
  }
  return g.players[g.currentTurn % g.playerCount];
}
```

### 2. Maximum Values
```solidity
// Score overflow protection
function addScore(address player, uint256 points) internal {
  uint256 current = scores[player];
  uint256 newScore = current + points;
  
  // Check overflow (or use SafeMath/checked arithmetic)
  require(newScore >= current, "Score overflow");
  
  // Cap at maximum
  scores[player] = newScore > MAX_SCORE ? MAX_SCORE : newScore;
}

// Timestamp overflow (year 2106 problem)
function setDeadline(uint256 duration) internal returns (uint32) {
  uint256 deadline = block.timestamp + duration;
  require(deadline <= type(uint32).max, "Deadline overflow");
  return uint32(deadline);
}
```

### 3. Boundary Conditions
```solidity
// First and last player
function getNextPlayer(uint256 gameId) internal view returns (uint8) {
  Game storage g = games[gameId];
  uint8 next = g.currentPlayer + 1;
  if (next >= g.playerCount) next = 0; // Wrap around
  return next;
}

// Board boundaries
function isValidPosition(int8 x, int8 y) public pure returns (bool) {
  return x >= 0 && x < int8(BOARD_SIZE) && y >= 0 && y < int8(BOARD_SIZE);
}

// Array index safety
function getPlayer(uint256 gameId, uint8 index) public view returns (address) {
  require(index < games[gameId].playerCount, "Index out of bounds");
  return games[gameId].players[index];
}
```

### 4. Division Edge Cases
```solidity
// Division by zero
function calculateShare(uint256 total, uint256 players) public pure returns (uint256) {
  if (players == 0) return 0; // Or revert, depending on logic
  return total / players;
}

// Rounding behavior
function distributeRewards(uint256 pool, uint256 winners) internal {
  if (winners == 0) return;
  
  uint256 perWinner = pool / winners;
  uint256 remainder = pool % winners;
  
  // First winner gets remainder (or accumulate for next round)
  // Document this behavior clearly
}
```

### 5. Timing Edge Cases
```solidity
// Exactly at deadline
function isExpired(uint256 deadline) public view returns (bool) {
  return block.timestamp > deadline; // Not >=, gives grace at exact time
}

// Same-block actions
mapping(address => uint256) public lastActionBlock;

function preventSameBlockAction() internal {
  require(block.number > lastActionBlock[msg.sender], "Wait for next block");
  lastActionBlock[msg.sender] = block.number;
}
```

### 6. Reentrancy Scenarios
```solidity
// State before external call
function claimReward() external nonReentrant {
  uint256 reward = pendingRewards[msg.sender];
  require(reward > 0, "No reward");
  
  // EFFECTS before INTERACTIONS
  pendingRewards[msg.sender] = 0; // Clear first
  totalPending -= reward;
  
  // Then transfer
  (bool success,) = msg.sender.call{value: reward}("");
  require(success, "Transfer failed");
}
```

### 7. Address Edge Cases
```solidity
// Zero address check
function setOwner(address newOwner) external onlyOwner {
  require(newOwner != address(0), "Zero address");
  owner = newOwner;
}

// Self-reference
function transfer(address to) external {
  require(to != msg.sender, "Cannot transfer to self");
  // ...
}

// Contract vs EOA (when relevant)
function isContract(address account) internal view returns (bool) {
  return account.code.length > 0;
}
```

## Testing Matrix
| Category | Test Case | Expected Behavior |
|----------|-----------|-------------------|
| Empty | No players | Return zero/revert |
| Empty | No balance | Revert gracefully |
| Max | Score overflow | Cap or revert |
| Max | Array full | Revert with message |
| Boundary | First player | Handle index 0 |
| Boundary | Last player | Handle wrap-around |
| Division | Zero divisor | Handle gracefully |
| Timing | Exact deadline | Defined behavior |
| Timing | Same block | Prevent if needed |

## Required Tests
Every game contract should have tests for:
```solidity
function testEmptyState() public { }
function testMaxState() public { }
function testBoundaryConditions() public { }
function testDivisionEdgeCases() public { }
function testTimingEdgeCases() public { }
function testReentrancy() public { }
function testAddressEdgeCases() public { }
```
