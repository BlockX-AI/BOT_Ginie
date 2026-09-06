# Batch Operations

Multi-action transactions for gas efficiency.

## Core Pattern
```solidity
// Instead of multiple calls
function batchMoves(uint8[] calldata moves) external {
  uint256 len = moves.length;
  require(len <= MAX_BATCH_SIZE, "Batch too large");
  
  for (uint256 i = 0; i < len;) {
    _processMove(moves[i]);
    unchecked { ++i; }
  }
}
```

## Batch Patterns

### 1. Multi-Claim
```solidity
function claimMultipleRewards(uint256[] calldata gameIds) external nonReentrant {
  uint256 totalReward;
  uint256 len = gameIds.length;
  require(len <= 20, "Max 20 claims");
  
  for (uint256 i = 0; i < len;) {
    uint256 reward = _calculateReward(gameIds[i], msg.sender);
    if (reward > 0) {
      _markClaimed(gameIds[i], msg.sender);
      totalReward += reward;
    }
    unchecked { ++i; }
  }
  
  // Single transfer at end
  if (totalReward > 0) {
    _transfer(msg.sender, totalReward);
  }
}
```

### 2. Multi-Action Turn
```solidity
struct Action {
  uint8 actionType;
  uint8 targetX;
  uint8 targetY;
  uint16 param;
}

function executeTurn(uint256 gameId, Action[] calldata actions) external {
  require(actions.length <= MAX_ACTIONS_PER_TURN);
  
  for (uint256 i = 0; i < actions.length;) {
    _executeAction(gameId, actions[i]);
    unchecked { ++i; }
  }
  
  _endTurn(gameId);
}
```

### 3. Batch Mint
```solidity
function batchMintItems(address to, uint256[] calldata itemIds) external onlyGame {
  uint256 len = itemIds.length;
  require(len <= 50, "Max 50 items");
  
  for (uint256 i = 0; i < len;) {
    _mint(to, itemIds[i]);
    unchecked { ++i; }
  }
}
```

## Gas Savings
| Operation | Single Call | Batched (10) | Savings |
|-----------|-------------|--------------|---------|
| Claim reward | 50k | 25k each = 250k | 50% |
| Make move | 40k | 15k each = 150k | 62% |
| Mint item | 80k | 35k each = 350k | 56% |

## Implementation Rules
- **Cap batch size**: Always `require(len <= MAX)`
- **Use calldata**: Not memory for arrays
- **Unchecked increment**: Save ~60 gas per iteration
- **Single state write**: Aggregate then write once
- **Single transfer**: Accumulate then send

## Anti-Exploit
- Hard limit on batch size (prevent gas griefing)
- Validate each item in batch
- Fail entire batch on any invalid item (atomic)
- Rate limit batch calls per block

## Gas Budget
- Batch overhead: ~5k gas
- Per-item in batch: 30-60% of individual call
- Maximum batch: Keep total <500k gas
