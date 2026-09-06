# Storage Slot Optimization

Optimal variable ordering for minimal gas.

## Core Rule
Variables < 32 bytes pack into same slot if declared consecutively.

## Packing Examples

### Bad (3 slots = 60k gas to initialize)
```solidity
uint256 a;    // Slot 0
uint8 b;      // Slot 1 (wastes 31 bytes)
uint256 c;    // Slot 2
uint8 d;      // Slot 3 (wastes 31 bytes)
```

### Good (2 slots = 40k gas to initialize)
```solidity
uint256 a;    // Slot 0
uint256 c;    // Slot 1
uint8 b;      // Slot 2 (packed)
uint8 d;      // Slot 2 (packed with b)
```

## Packing Chart
```
32 bytes = 256 bits = 1 slot

Fit in one slot:
- 1x uint256
- 1x address (20) + 1x uint96
- 1x address (20) + 1x uint64 + 1x uint32
- 2x uint128
- 4x uint64
- 8x uint32
- 32x uint8
- 32x bool (but use bitmap instead)
```

## Game-Optimized Structs

### Player State (1 slot)
```solidity
struct Player {
  uint64 score;       // 8 bytes
  uint64 lastActive;  // 8 bytes (timestamp)
  uint32 gamesPlayed; // 4 bytes
  uint32 gamesWon;    // 4 bytes
  uint16 level;       // 2 bytes
  uint16 energy;      // 2 bytes
  uint32 reserved;    // 4 bytes (future use)
} // Total: 32 bytes = 1 slot
```

### Game Session (2 slots)
```solidity
struct Game {
  // Slot 1
  address player1;    // 20 bytes
  uint32 startTime;   // 4 bytes
  uint32 lastMove;    // 4 bytes
  uint16 turnCount;   // 2 bytes
  uint8 state;        // 1 byte
  uint8 winner;       // 1 byte (0=none, 1=p1, 2=p2)
  
  // Slot 2
  address player2;    // 20 bytes
  uint32 stake;       // 4 bytes (in wei/token units)
  uint32 p1Score;     // 4 bytes
  uint32 p2Score;     // 4 bytes
} // Total: 64 bytes = 2 slots
```

### Compact Move (1 slot)
```solidity
struct Move {
  uint8 moveType;     // 1 byte
  uint8 fromX;        // 1 byte
  uint8 fromY;        // 1 byte
  uint8 toX;          // 1 byte
  uint8 toY;          // 1 byte
  uint8 param1;       // 1 byte
  uint16 param2;      // 2 bytes
  uint32 timestamp;   // 4 bytes
  // 20 bytes remaining for extensions
}
```

## Mapping vs Array

### Prefer Mapping
```solidity
// Good: O(1) access, no length tracking
mapping(uint256 => Game) public games;

// Bad: Growing array = expensive
Game[] public games;
```

### When Array is OK
- Fixed size known at deploy
- Need to iterate (rare on-chain)
- Small bounded size (< 20 items)

## Constants Save Gas
```solidity
// Stored in bytecode, not storage
uint256 public constant MAX_PLAYERS = 100;
uint256 public constant GAME_FEE = 0.01 ether;

// Immutable: set once in constructor, then like constant
address public immutable owner;
uint256 public immutable deployTime;
```

## Gas Reference
| Operation | Gas Cost |
|-----------|----------|
| SSTORE (0 → non-0) | 20,000 |
| SSTORE (non-0 → non-0) | 2,900 |
| SSTORE (non-0 → 0) | 2,900 + 4,800 refund |
| SLOAD (cold) | 2,100 |
| SLOAD (warm) | 100 |
