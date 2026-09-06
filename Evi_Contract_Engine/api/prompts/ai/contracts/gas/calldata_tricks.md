# Calldata Tricks

Encode moves efficiently for minimal transaction cost.

## Calldata vs Memory
```solidity
// Expensive: copies to memory
function processMove(uint8[] memory moves) external { }

// Cheap: reads directly from tx data
function processMove(uint8[] calldata moves) external { }
```

Gas: calldata ~3 gas/byte, memory ~30+ gas/byte for copies

## Compact Move Encoding

### Single Byte Moves
```solidity
// For simple games: 4 directions + 4 actions = 8 options
// Fits in 3 bits, but use 1 byte for simplicity
enum Move { UP, DOWN, LEFT, RIGHT, ATTACK, DEFEND, SPECIAL, WAIT }

function executeMove(uint8 move) external {
  require(move < 8, "Invalid move");
  // Process...
}
```

### Two-Byte Coordinates
```solidity
// Pack x,y into uint16: high byte = x, low byte = y
function move(uint16 packed) external {
  uint8 x = uint8(packed >> 8);
  uint8 y = uint8(packed & 0xFF);
  _moveTo(x, y);
}
```

### Custom ABI Encoding
```solidity
// Instead of: function attack(uint256 gameId, uint256 targetId, uint256 damage)
// Use packed: function attack(bytes calldata data)

function attack(bytes calldata data) external {
  require(data.length == 8, "Invalid data");
  uint32 gameId = uint32(bytes4(data[0:4]));
  uint16 targetId = uint16(bytes2(data[4:6]));
  uint16 damage = uint16(bytes2(data[6:8]));
  _executeAttack(gameId, targetId, damage);
}
```

## Batch Move Encoding

### Simple: Array of Bytes
```solidity
function executeMoves(bytes calldata moves) external {
  uint256 len = moves.length;
  require(len <= 20, "Too many moves");
  
  for (uint256 i = 0; i < len;) {
    _processMove(uint8(moves[i]));
    unchecked { ++i; }
  }
}
```

### Complex: Packed Actions
```solidity
// 4 bytes per action: type(1) + x(1) + y(1) + param(1)
function executeActions(bytes calldata actions) external {
  uint256 len = actions.length;
  require(len % 4 == 0 && len <= 80, "Invalid");
  
  for (uint256 i = 0; i < len;) {
    uint8 actionType = uint8(actions[i]);
    uint8 x = uint8(actions[i + 1]);
    uint8 y = uint8(actions[i + 2]);
    uint8 param = uint8(actions[i + 3]);
    _processAction(actionType, x, y, param);
    unchecked { i += 4; }
  }
}
```

## Signature Compression
```solidity
// Standard signature: 65 bytes (r, s, v)
// Compact: 64 bytes (r, s with v encoded in s)

function recoverCompact(bytes32 hash, bytes calldata sig) public pure returns (address) {
  require(sig.length == 64, "Invalid sig length");
  bytes32 r = bytes32(sig[0:32]);
  bytes32 vs = bytes32(sig[32:64]);
  
  // Extract v from vs
  uint8 v = uint8((uint256(vs) >> 255) + 27);
  bytes32 s = vs & bytes32(0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
  
  return ecrecover(hash, v, r, s);
}
```

## Gas Comparison
| Method | Calldata Size | Gas Overhead |
|--------|---------------|--------------|
| Standard ABI (3 uint256) | 96 bytes | ~1500 |
| Packed (3 uint32) | 12 bytes | ~200 |
| Custom bytes | 8 bytes | ~150 |

## Implementation Rules
- Use `calldata` not `memory` for input arrays
- Pack related values into fewer bytes
- Validate packed data length before parsing
- Use bytes for variable-length move sequences
- Consider gas cost of unpacking vs savings
