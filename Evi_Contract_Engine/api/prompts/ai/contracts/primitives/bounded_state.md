# Bounded State Management for Games

## Core Principle
**All game state must have explicit bounds to prevent DoS attacks and gas exhaustion**

## State Bounds Categories

### Player Limits
```solidity
// Maximum players per game session
uint8 constant MAX_PLAYERS = 100;

// Maximum active games per player
uint8 constant MAX_GAMES_PER_PLAYER = 10;

// Maximum moves per game
uint16 constant MAX_MOVES = 1000;
```

### Collection Limits
```solidity
// Arrays must be bounded
uint8 constant MAX_LEADERBOARD_SIZE = 100;
uint8 constant MAX_INVENTORY_ITEMS = 50;
uint8 constant MAX_ACHIEVEMENTS = 200;

// Use fixed-size arrays when possible
struct PlayerState {
    uint256[10] upgradeLevels;  // Fixed size
    uint8[50] inventory;        // Fixed size
    bool[200] achievements;     // Fixed size
}
```

### Time Bounds
```solidity
// Maximum game session duration
uint256 constant MAX_SESSION_DURATION = 1 hours;

// Maximum offline accumulation
uint256 constant MAX_OFFLINE_TIME = 7 days;

// Timeout for player actions
uint256 constant MOVE_TIMEOUT = 5 minutes;
```

## Implementation Patterns

### Pattern: Bounded Arrays with Overflow Protection
```solidity
contract BoundedLeaderboard {
    struct Entry {
        address player;
        uint256 score;
    }
    
    Entry[100] public leaderboard; // Fixed size
    uint8 public leaderboardSize;  // Current entries
    
    function addScore(address player, uint256 score) external {
        require(score > 0, "Invalid score");
        
        // Find insertion point
        uint8 insertAt = _findInsertPosition(score);
        
        if (insertAt < 100) {
            // Shift entries down (bounded loop)
            uint8 shiftEnd = leaderboardSize < 99 ? leaderboardSize : 99;
            for (uint8 i = shiftEnd; i > insertAt; i--) {
                leaderboard[i] = leaderboard[i-1];
            }
            
            // Insert new entry
            leaderboard[insertAt] = Entry(player, score);
            
            // Update size (capped at 100)
            if (leaderboardSize < 100) {
                leaderboardSize++;
            }
        }
    }
    
    function _findInsertPosition(uint256 score) internal view returns (uint8) {
        for (uint8 i = 0; i < leaderboardSize && i < 100; i++) {
            if (score > leaderboard[i].score) {
                return i;
            }
        }
        return leaderboardSize < 100 ? leaderboardSize : 100;
    }
}
```

### Pattern: Bounded Mappings with Cleanup
```solidity
contract BoundedGameSessions {
    struct GameSession {
        address[] players;
        uint256 startTime;
        bool active;
    }
    
    mapping(uint256 => GameSession) public games;
    mapping(address => uint256[]) public playerGames; // Games per player
    uint256 public nextGameId;
    
    function createGame() external returns (uint256) {
        // Limit active games per player
        require(getActiveGameCount(msg.sender) < MAX_GAMES_PER_PLAYER, "Too many games");
        
        uint256 gameId = nextGameId++;
        games[gameId] = GameSession({
            players: new address[](0),
            startTime: block.timestamp,
            active: true
        });
        
        // Add to player's game list (bounded)
        if (playerGames[msg.sender].length < MAX_GAMES_PER_PLAYER) {
            playerGames[msg.sender].push(gameId);
        }
        
        return gameId;
    }
    
    function getActiveGameCount(address player) public view returns (uint8) {
        uint8 count = 0;
        uint256[] memory gameIds = playerGames[player];
        
        // Bounded loop
        uint256 maxCheck = gameIds.length > MAX_GAMES_PER_PLAYER ? MAX_GAMES_PER_PLAYER : gameIds.length;
        for (uint256 i = 0; i < maxCheck; i++) {
            if (games[gameIds[i]].active) {
                count++;
            }
        }
        return count;
    }
    
    function cleanupOldGames(address player) external {
        uint256[] storage gameIds = playerGames[player];
        uint256 writeIndex = 0;
        
        // Remove inactive games (bounded cleanup)
        for (uint256 i = 0; i < gameIds.length && i < MAX_GAMES_PER_PLAYER; i++) {
            if (games[gameIds[i]].active) {
                gameIds[writeIndex] = gameIds[i];
                writeIndex++;
            }
        }
        
        // Truncate array
        while (gameIds.length > writeIndex) {
            gameIds.pop();
        }
    }
}
```

### Pattern: Circular Buffer for History
```solidity
contract BoundedHistory {
    struct MoveRecord {
        address player;
        uint8 moveType;
        uint256 timestamp;
    }
    
    MoveRecord[1000] public moveHistory; // Fixed circular buffer
    uint256 public historyHead; // Next write position
    uint256 public historySize; // Current size
    
    function recordMove(address player, uint8 moveType) internal {
        moveHistory[historyHead] = MoveRecord({
            player: player,
            moveType: moveType,
            timestamp: block.timestamp
        });
        
        historyHead = (historyHead + 1) % 1000; // Circular
        
        if (historySize < 1000) {
            historySize++;
        }
    }
    
    function getRecentMoves(uint8 count) external view returns (MoveRecord[] memory) {
        require(count <= 100, "Too many moves requested"); // Limit response size
        
        uint8 actualCount = count > historySize ? uint8(historySize) : count;
        MoveRecord[] memory recent = new MoveRecord[](actualCount);
        
        for (uint8 i = 0; i < actualCount; i++) {
            uint256 index = (historyHead + 1000 - 1 - i) % 1000;
            recent[i] = moveHistory[index];
        }
        
        return recent;
    }
}
```

## State Size Validation

### Grid State Bounds
```solidity
// For puzzle games
function validateGridSize(uint8 width, uint8 height) internal pure {
    require(width > 0 && width <= 16, "Invalid width");
    require(height > 0 && height <= 16, "Invalid height");
    require(width * height <= 256, "Grid too large"); // Fits in uint256
}

// For board games
function validateBoardState(uint256 board) internal pure {
    // Ensure no invalid piece types
    for (uint8 i = 0; i < 64; i++) { // 8x8 board
        uint8 piece = uint8((board >> (i * 4)) & 0xF);
        require(piece <= 12, "Invalid piece"); // 12 piece types max
    }
}
```

### Player State Bounds
```solidity
function validatePlayerStats(uint16 str, uint16 dex, uint16 int) internal pure {
    require(str <= 999, "STR too high");
    require(dex <= 999, "DEX too high");
    require(int <= 999, "INT too high");
    require(str + dex + int <= 2000, "Total stats too high");
}

function validateLevel(uint8 level) internal pure {
    require(level <= 100, "Level cap exceeded");
}
```

## Gas Budget Enforcement

### Loop Bounds
```solidity
// NEVER use unbounded loops
function processMatches(uint256 grid) internal pure returns (uint256, uint256) {
    uint256 score = 0;
    uint256 newGrid = grid;
    
    // Maximum 10 cascade iterations
    for (uint8 cascade = 0; cascade < 10; cascade++) {
        (bool hasMatches, uint256 cascadeScore, uint256 afterCascade) = _findAndClearMatches(newGrid);
        
        if (!hasMatches) break; // Early exit
        
        score += cascadeScore;
        newGrid = afterCascade;
    }
    
    return (newGrid, score);
}

function _findAndClearMatches(uint256 grid) internal pure returns (bool, uint256, uint256) {
    // Bounded grid scan (max 16x16 = 256 iterations)
    // Implementation details...
}
```

### Memory Allocation Limits
```solidity
function getTopPlayers(uint8 count) external view returns (address[] memory) {
    require(count <= 100, "Too many players requested");
    
    // Limit memory allocation
    address[] memory players = new address[](count);
    
    // Fill with bounded loop
    for (uint8 i = 0; i < count && i < leaderboardSize; i++) {
        players[i] = leaderboard[i].player;
    }
    
    return players;
}
```

## Anti-DoS Patterns

### Rate Limiting
```solidity
mapping(address => uint256) public lastActionTime;
uint256 constant ACTION_COOLDOWN = 1 seconds;

modifier rateLimited() {
    require(block.timestamp >= lastActionTime[msg.sender] + ACTION_COOLDOWN, "Too fast");
    lastActionTime[msg.sender] = block.timestamp;
    _;
}

function makeMove(uint8 direction) external rateLimited {
    // Move logic
}
```

### Resource Limits
```solidity
mapping(address => uint8) public dailyActions;
mapping(address => uint256) public lastResetDay;
uint8 constant MAX_DAILY_ACTIONS = 100;

modifier dailyLimit() {
    uint256 today = block.timestamp / 1 days;
    
    if (lastResetDay[msg.sender] < today) {
        dailyActions[msg.sender] = 0;
        lastResetDay[msg.sender] = today;
    }
    
    require(dailyActions[msg.sender] < MAX_DAILY_ACTIONS, "Daily limit exceeded");
    dailyActions[msg.sender]++;
    _;
}
```

## Output Requirements

When generating bounded state contracts, include:

1. Explicit constants for all limits
2. Bounds checking on all inputs
3. Fixed-size arrays where possible
4. Circular buffers for history
5. Cleanup functions for old data
6. Gas-efficient iteration patterns
7. Rate limiting mechanisms
8. Clear error messages for limit violations

## Acceptance Criteria

```solidity
// Test: Array bounds
function testArrayBounds() external {
    // Should accept valid size
    addToArray(validItem);
    
    // Should reject when full
    vm.expectRevert("Array full");
    addToArray(itemWhenFull);
}

// Test: Gas limits
function testGasLimits() external {
    uint256 gasBefore = gasleft();
    processLargeState();
    uint256 gasUsed = gasBefore - gasleft();
    
    assert(gasUsed < 500000); // Under 500k gas
}

// Test: State size
function testStateSize() external {
    bytes memory encoded = abi.encode(gameState);
    assert(encoded.length < 1024); // Under 1KB
}
```
