# State Bounds

Array limits, max players, max rounds to prevent DoS.

## Core Principle
Every collection MUST have an upper bound. Unbounded = exploitable.

## Required Bounds

### Player Limits
```solidity
uint8 public constant MIN_PLAYERS = 2;
uint8 public constant MAX_PLAYERS = 100;    // Per game
uint8 public constant MAX_ACTIVE_GAMES = 10; // Per user
```

### Game Session Limits
```solidity
uint16 public constant MAX_TURNS = 1000;
uint32 public constant MAX_DURATION = 7 days;
uint8 public constant MAX_ROUNDS = 50;
```

### Collection Limits
```solidity
uint8 public constant MAX_INVENTORY_SIZE = 100;
uint8 public constant MAX_QUEUE_SIZE = 50;
uint16 public constant MAX_LEADERBOARD_SIZE = 100;
```

## Implementation Patterns

### Bounded Array
```solidity
// BAD: Unbounded
address[] public players;

// GOOD: Bounded with check
address[] public players;
uint8 public constant MAX_PLAYERS = 100;

function addPlayer(address player) external {
  require(players.length < MAX_PLAYERS, "Max players reached");
  players.push(player);
}
```

### Bounded Mapping with Counter
```solidity
mapping(address => uint256) public activeGames;
uint8 public constant MAX_ACTIVE_GAMES = 10;

function createGame() external {
  require(activeGames[msg.sender] < MAX_ACTIVE_GAMES, "Too many games");
  activeGames[msg.sender]++;
  // ... create game
}

function endGame(uint256 gameId) external {
  // ... end game logic
  activeGames[msg.sender]--;
}
```

### Bounded Queue (FIFO)
```solidity
struct BoundedQueue {
  uint256 front;
  uint256 back;
  mapping(uint256 => address) items;
}

uint256 public constant MAX_QUEUE = 50;

function enqueue(BoundedQueue storage q, address item) internal {
  require(q.back - q.front < MAX_QUEUE, "Queue full");
  q.items[q.back++] = item;
}

function dequeue(BoundedQueue storage q) internal returns (address) {
  require(q.front < q.back, "Queue empty");
  address item = q.items[q.front];
  delete q.items[q.front++];
  return item;
}
```

### Top-N Leaderboard
```solidity
// Instead of storing all scores, keep only top N
struct LeaderboardEntry {
  address player;
  uint64 score;
}

uint8 public constant LEADERBOARD_SIZE = 10;
LeaderboardEntry[10] public leaderboard; // Fixed size

function updateLeaderboard(address player, uint64 score) internal {
  // Find insertion point
  uint8 insertAt = LEADERBOARD_SIZE;
  for (uint8 i = 0; i < LEADERBOARD_SIZE; i++) {
    if (score > leaderboard[i].score) {
      insertAt = i;
      break;
    }
  }
  
  if (insertAt < LEADERBOARD_SIZE) {
    // Shift down and insert
    for (uint8 i = LEADERBOARD_SIZE - 1; i > insertAt; i--) {
      leaderboard[i] = leaderboard[i - 1];
    }
    leaderboard[insertAt] = LeaderboardEntry(player, score);
  }
}
```

## Validation Checklist
- [ ] Every array has MAX_SIZE constant
- [ ] Every loop has iteration limit
- [ ] Every user has action count limit
- [ ] Every game has duration/turn limit
- [ ] Every mapping with iteration has size tracking

## DoS Prevention Matrix
| Attack Vector | Mitigation |
|---------------|------------|
| Create infinite games | MAX_ACTIVE_GAMES per user |
| Add infinite players | MAX_PLAYERS per game |
| Infinite turns | MAX_TURNS + timeout |
| Queue flooding | MAX_QUEUE_SIZE + fee |
| Storage bloat | Cleanup old games |

## Testing Requirements
```solidity
function testBoundsEnforced() public {
  // Should revert at limit
  for (uint i = 0; i < MAX_PLAYERS; i++) {
    game.addPlayer(makeAddr(string(abi.encodePacked(i))));
  }
  
  vm.expectRevert("Max players reached");
  game.addPlayer(makeAddr("overflow"));
}
```
