# Puzzle Game Physics

Grid rules, match validation, cascade logic for puzzle games.

## Core Mechanics

### Grid Representation
```solidity
// Fixed-size grid (8x8 = 64 cells)
// Each cell: 0=empty, 1-6=piece types
uint256 public board; // Pack 64 4-bit cells into one slot

function getCell(uint8 x, uint8 y) public view returns (uint8) {
  require(x < 8 && y < 8, "OOB");
  uint8 pos = (y * 8 + x) * 4;
  return uint8((board >> pos) & 0xF);
}

function setCell(uint8 x, uint8 y, uint8 value) internal {
  uint8 pos = (y * 8 + x) * 4;
  board = (board & ~(uint256(0xF) << pos)) | (uint256(value) << pos);
}
```

### Match-3 Validation
```solidity
// Check for horizontal match at position
function checkHorizontalMatch(uint8 x, uint8 y) internal view returns (uint8 count) {
  uint8 piece = getCell(x, y);
  if (piece == 0) return 0;
  
  count = 1;
  // Check right
  for (uint8 i = x + 1; i < 8 && getCell(i, y) == piece; i++) count++;
  // Check left
  for (uint8 i = x; i > 0 && getCell(i - 1, y) == piece; i--) count++;
  
  return count >= 3 ? count : 0;
}

// Check for vertical match
function checkVerticalMatch(uint8 x, uint8 y) internal view returns (uint8 count) {
  uint8 piece = getCell(x, y);
  if (piece == 0) return 0;
  
  count = 1;
  for (uint8 i = y + 1; i < 8 && getCell(x, i) == piece; i++) count++;
  for (uint8 i = y; i > 0 && getCell(x, i - 1) == piece; i--) count++;
  
  return count >= 3 ? count : 0;
}
```

### 2048-Style Merge
```solidity
// Slide row left and merge
function slideRowLeft(uint8 row) internal returns (uint16 points) {
  uint8[8] memory cells;
  uint8 writePos = 0;
  
  // Collect non-empty cells
  for (uint8 i = 0; i < 8; i++) {
    uint8 val = getCell(i, row);
    if (val > 0) {
      // Merge with previous if same
      if (writePos > 0 && cells[writePos - 1] == val) {
        cells[writePos - 1] = val + 1; // Double value
        points += uint16(1) << val;     // Score = merged value
      } else {
        cells[writePos++] = val;
      }
    }
  }
  
  // Write back to board
  for (uint8 i = 0; i < 8; i++) {
    setCell(i, row, i < writePos ? cells[i] : 0);
  }
}
```

### Cascade/Gravity
```solidity
// Drop pieces to fill empty spaces (column by column)
function applyGravity() internal {
  for (uint8 x = 0; x < 8; x++) {
    uint8 writeY = 0;
    for (uint8 y = 0; y < 8; y++) {
      uint8 piece = getCell(x, y);
      if (piece > 0) {
        if (writeY != y) {
          setCell(x, writeY, piece);
          setCell(x, y, 0);
        }
        writeY++;
      }
    }
  }
}

// Fill empty top cells with new pieces (pseudo-random)
function fillBoard(uint256 seed) internal {
  for (uint8 x = 0; x < 8; x++) {
    for (uint8 y = 0; y < 8; y++) {
      if (getCell(x, y) == 0) {
        seed = uint256(keccak256(abi.encodePacked(seed, x, y)));
        uint8 piece = uint8((seed % 6) + 1); // 1-6
        setCell(x, y, piece);
      }
    }
  }
}
```

## Move Validation
```solidity
function isValidSwap(uint8 x1, uint8 y1, uint8 x2, uint8 y2) public view returns (bool) {
  // Must be adjacent
  uint8 dx = x1 > x2 ? x1 - x2 : x2 - x1;
  uint8 dy = y1 > y2 ? y1 - y2 : y2 - y1;
  if (dx + dy != 1) return false;
  
  // Simulate swap and check for match
  // (Implementation: temporarily swap, check, swap back)
  return true; // Simplified - actual impl needs match check
}
```

## Scoring Rules
| Match Type | Points |
|------------|--------|
| 3 in a row | 100 |
| 4 in a row | 300 |
| 5 in a row | 1000 |
| Cascade bonus | 2x per chain |
| T/L shape | 500 |

## Gas Considerations
- Board fits in 1-2 storage slots (bitmap)
- Match checking: O(1) with bitmap ops
- Cascade: bounded by board size
- No loops > 64 iterations
