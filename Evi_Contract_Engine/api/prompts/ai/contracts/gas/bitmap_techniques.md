# Bitmap Techniques

Pack game state into uint256 for massive gas savings.

## Core Concept
One uint256 = 256 bits = 256 boolean flags OR multiple packed values.

## Pattern 1: Boolean Flags
```solidity
// 256 unlocks in one slot
mapping(address => uint256) public playerFlags;

function hasFlag(address player, uint8 flagId) public view returns (bool) {
  return (playerFlags[player] >> flagId) & 1 == 1;
}

function setFlag(address player, uint8 flagId) internal {
  playerFlags[player] |= (1 << flagId);
}

function clearFlag(address player, uint8 flagId) internal {
  playerFlags[player] &= ~(1 << flagId);
}

function toggleFlag(address player, uint8 flagId) internal {
  playerFlags[player] ^= (1 << flagId);
}
```

## Pattern 2: Packed Game Board
```solidity
// 8x8 board with 4-bit cells = 256 bits = 1 slot
// Each cell: 0=empty, 1-15=piece types
uint256 public board;

function getCell(uint8 x, uint8 y) public view returns (uint8) {
  require(x < 8 && y < 8);
  uint8 bitPos = (y * 8 + x) * 4;
  return uint8((board >> bitPos) & 0xF);
}

function setCell(uint8 x, uint8 y, uint8 value) internal {
  require(x < 8 && y < 8 && value < 16);
  uint8 bitPos = (y * 8 + x) * 4;
  uint256 mask = ~(uint256(0xF) << bitPos);
  board = (board & mask) | (uint256(value) << bitPos);
}
```

## Pattern 3: Packed Player Stats
```solidity
// Pack multiple values into one uint256
// Layout: health(16) | mana(16) | xp(32) | gold(64) | level(8) | flags(120)
mapping(address => uint256) public packedStats;

function getHealth(address p) public view returns (uint16) {
  return uint16(packedStats[p] >> 240);
}

function getMana(address p) public view returns (uint16) {
  return uint16(packedStats[p] >> 224);
}

function setHealth(address p, uint16 val) internal {
  packedStats[p] = (packedStats[p] & ~(uint256(0xFFFF) << 240)) | (uint256(val) << 240);
}

// Batch update multiple stats in one SSTORE
function updateStats(address p, uint16 health, uint16 mana, uint32 xp) internal {
  uint256 packed = packedStats[p];
  packed = (packed & 0x0000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) 
         | (uint256(health) << 240) 
         | (uint256(mana) << 224)
         | (uint256(xp) << 192);
  packedStats[p] = packed;
}
```

## Pattern 4: Grid Validation
```solidity
// Precomputed valid move masks
mapping(uint8 => uint256) public validMoves; // pieceType => bitmap of valid squares

function isValidMove(uint8 pieceType, uint8 fromX, uint8 fromY, uint8 toX, uint8 toY) public view returns (bool) {
  uint8 deltaX = toX > fromX ? toX - fromX : fromX - toX;
  uint8 deltaY = toY > fromY ? toY - fromY : fromY - toY;
  uint8 movePattern = deltaY * 16 + deltaX; // Encode delta as index
  return (validMoves[pieceType] >> movePattern) & 1 == 1;
}
```

## Gas Comparison
| Storage Method | Read Gas | Write Gas |
|----------------|----------|-----------|
| bool mapping | 2100 | 20000 |
| uint256 bitmap (cold) | 2100 | 20000 |
| uint256 bitmap (warm) | 100 | 2900 |
| **Packed 256 bools** | **2100** | **20000 for ALL** |

## Implementation Rules
- **Plan bit layout first**: Document which bits mean what
- **Use constants**: `uint256 constant HEALTH_OFFSET = 240;`
- **Bounds check**: Validate indices before bit ops
- **Batch writes**: Update multiple fields then single SSTORE

## Common Layouts
```
// Game entity (256 bits)
[255-248] entityType (8 bits) - 256 types
[247-240] health (8 bits) - 0-255 HP
[239-224] position (16 bits) - x:8, y:8
[223-192] timestamp (32 bits) - last action
[191-128] owner (64 bits) - truncated address (use mapping for full)
[127-0] flags + metadata (128 bits)
```
