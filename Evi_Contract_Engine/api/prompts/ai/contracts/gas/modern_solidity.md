# Modern Solidity Gas Optimizations (0.8.20+)

Apply these patterns for maximum gas efficiency.

## Custom Errors (Save ~50 gas per revert)
```solidity
// BAD - costs gas for string storage
require(balance >= amount, "Insufficient balance");

// GOOD - custom error with parameters
error InsufficientBalance(uint256 available, uint256 required);
if (balance < amount) revert InsufficientBalance(balance, amount);
```

## Unchecked Arithmetic (Save ~40 gas per operation)
```solidity
// For loop counters that can't overflow
for (uint256 i = 0; i < arr.length;) {
    // ... logic
    unchecked { ++i; }  // Safe: i can't overflow before gas runs out
}

// For known-safe math
unchecked {
    uint256 result = a + b;  // Only if you're CERTAIN no overflow
}
```

## Immutable vs Constant
```solidity
// CONSTANT: compile-time known (FREE to read - inlined)
uint256 constant MAX_SUPPLY = 10000;
uint256 constant ENTRY_FEE = 0.01 ether;

// IMMUTABLE: set once in constructor (cheap to read - ~100 gas)
address immutable owner;
uint256 immutable deployTime;

constructor() {
    owner = msg.sender;
    deployTime = block.timestamp;
}
```

## Storage Packing (Save ~20,000 gas per slot)
```solidity
// BAD: 3 storage slots (96 bytes, 60,000 gas to write all)
uint256 amount;    // slot 0 (32 bytes)
uint8 status;      // slot 1 (32 bytes - wastes 31!)
address player;    // slot 2 (32 bytes - wastes 12!)

// GOOD: 2 storage slots (64 bytes, 40,000 gas to write all)
uint256 amount;    // slot 0 (32 bytes)
address player;    // slot 1 (20 bytes)
uint8 status;      // slot 1 (1 byte) - packed with player!
bool active;       // slot 1 (1 byte) - packed!

// BEST: Struct packing
struct PlayerData {
    uint128 score;      // 16 bytes
    uint64 lastAction;  // 8 bytes  
    uint64 level;       // 8 bytes = 32 bytes total (1 slot!)
}
```

## Calldata vs Memory (Save ~60 gas per element)
```solidity
// BAD: copies entire array to memory
function process(uint256[] memory data) external { ... }

// GOOD: reads directly from calldata
function process(uint256[] calldata data) external { ... }
```

## Cache Storage Reads (Save ~2,000 gas per extra read)
```solidity
// BAD: 3 SLOAD operations (6,300 gas)
function bad() external view returns (uint256) {
    if (totalSupply > 0) {           // SLOAD 1
        uint256 share = amount / totalSupply;  // SLOAD 2
        return share * totalSupply;            // SLOAD 3
    }
}

// GOOD: 1 SLOAD operation (2,100 gas)
function good() external view returns (uint256) {
    uint256 _totalSupply = totalSupply;  // SLOAD once, cache
    if (_totalSupply > 0) {
        uint256 share = amount / _totalSupply;
        return share * _totalSupply;
    }
}
```

## Named Returns (Save ~20 gas)
```solidity
// Saves gas by avoiding extra local variable
function getStats() external view returns (uint256 score, uint256 level) {
    score = playerScores[msg.sender];
    level = playerLevels[msg.sender];
    // No explicit return needed
}
```

## Delete for Refunds (Get ~4,800 gas back)
```solidity
// Get gas refund when clearing storage
function resetPlayer(address player) internal {
    delete playerData[player];  // Refunds gas!
    delete pendingRewards[player];
}
```

## Gas Cost Reference
| Operation | Gas Cost |
|-----------|----------|
| SSTORE (new slot) | 20,000 |
| SSTORE (update) | 5,000 |
| SSTORE (delete) | -4,800 refund |
| SLOAD (cold) | 2,100 |
| SLOAD (warm) | 100 |
| Memory read | 3 |
| Calldata read | 3 |
