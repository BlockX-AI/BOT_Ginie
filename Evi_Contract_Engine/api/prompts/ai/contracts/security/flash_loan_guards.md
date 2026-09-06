# Flash Loan Attack Prevention

CRITICAL: Flash loans allow attackers to borrow massive amounts without collateral for one transaction.

## Common Flash Loan Attack Vectors

| Attack Type | Description | Mitigation |
|-------------|-------------|------------|
| Price Manipulation | Manipulate AMM prices within one tx | Use TWAP oracles |
| Governance Attacks | Borrow tokens to vote | Snapshot before voting |
| Liquidation Exploits | Manipulate collateral values | Block delay for positions |
| Reward Farming | Stake/unstake in same block | Minimum stake duration |

## Block Delay Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract FlashLoanGuard {
    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    
    mapping(address => uint256) public lastDepositBlock;
    mapping(address => uint256) public lastActionBlock;
    
    uint256 public constant MIN_BLOCKS_BETWEEN_ACTIONS = 1;
    uint256 public constant MIN_BLOCKS_BEFORE_WITHDRAW = 2;
    
    // ═══════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════
    
    error SameBlockAction();
    error WithdrawTooSoon(uint256 blocksRemaining);
    
    // ═══════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Prevents action in the same block as deposit
    modifier noSameBlockAction() {
        if (block.number <= lastActionBlock[msg.sender]) {
            revert SameBlockAction();
        }
        lastActionBlock[msg.sender] = block.number;
        _;
    }
    
    /// @notice Requires blocks to pass before withdrawal
    modifier delayedWithdraw() {
        uint256 depositBlock = lastDepositBlock[msg.sender];
        if (depositBlock != 0 && block.number < depositBlock + MIN_BLOCKS_BEFORE_WITHDRAW) {
            revert WithdrawTooSoon(depositBlock + MIN_BLOCKS_BEFORE_WITHDRAW - block.number);
        }
        _;
    }
    
    /// @notice Record deposit block
    function _recordDeposit(address user) internal {
        lastDepositBlock[user] = block.number;
    }
}
```

## Snapshot-Based Protection

For voting or reward distribution:

```solidity
// Snapshot balances at specific blocks
mapping(uint256 => mapping(address => uint256)) public balanceSnapshots;
mapping(uint256 => uint256) public totalSupplySnapshots;
uint256[] public snapshotBlocks;

function createSnapshot() external onlyRole(OPERATOR_ROLE) returns (uint256 snapshotId) {
    snapshotId = snapshotBlocks.length;
    snapshotBlocks.push(block.number);
    // Balances are recorded lazily or at snapshot time
}

function getSnapshotBalance(address user, uint256 snapshotId) public view returns (uint256) {
    require(snapshotId < snapshotBlocks.length, "Invalid snapshot");
    
    // Return snapshot balance if recorded
    uint256 snapshotBalance = balanceSnapshots[snapshotId][user];
    if (snapshotBalance != 0) return snapshotBalance;
    
    // If not recorded, check if user had balance before snapshot
    // This requires historical balance tracking
    return _getHistoricalBalance(user, snapshotBlocks[snapshotId]);
}

// Rewards distributed based on snapshot, not current balance
function claimRewards(uint256 snapshotId) external {
    uint256 balance = getSnapshotBalance(msg.sender, snapshotId);
    uint256 total = totalSupplySnapshots[snapshotId];
    uint256 reward = (rewardPool * balance) / total;
    // ... distribute reward
}
```

## Time-Weighted Average Price (TWAP)

For any price-dependent logic:

```solidity
struct PriceObservation {
    uint256 timestamp;
    uint256 price;
    uint256 cumulativePrice;
}

PriceObservation[] public priceHistory;
uint256 constant TWAP_PERIOD = 30 minutes;
uint256 constant MIN_OBSERVATIONS = 3;

function recordPrice(uint256 price) internal {
    uint256 cumulative = priceHistory.length > 0 
        ? priceHistory[priceHistory.length - 1].cumulativePrice + price
        : price;
        
    priceHistory.push(PriceObservation({
        timestamp: block.timestamp,
        price: price,
        cumulativePrice: cumulative
    }));
}

function getTWAP() public view returns (uint256) {
    require(priceHistory.length >= MIN_OBSERVATIONS, "Insufficient data");
    
    uint256 endIdx = priceHistory.length - 1;
    uint256 startIdx = endIdx;
    
    // Find observation from TWAP_PERIOD ago
    uint256 targetTime = block.timestamp - TWAP_PERIOD;
    for (uint256 i = endIdx; i > 0;) {
        if (priceHistory[i].timestamp <= targetTime) {
            startIdx = i;
            break;
        }
        unchecked { --i; }
    }
    
    if (startIdx == endIdx) return priceHistory[endIdx].price;
    
    uint256 timeDelta = priceHistory[endIdx].timestamp - priceHistory[startIdx].timestamp;
    uint256 priceDelta = priceHistory[endIdx].cumulativePrice - priceHistory[startIdx].cumulativePrice;
    
    return priceDelta / timeDelta;
}
```

## Minimum Holding Period for Staking

```solidity
struct Stake {
    uint128 amount;
    uint64 depositTime;
    uint64 lockDuration;
}

mapping(address => Stake) public stakes;
uint256 constant MIN_STAKE_DURATION = 1 days;

function stake() external payable {
    stakes[msg.sender] = Stake({
        amount: uint128(msg.value),
        depositTime: uint64(block.timestamp),
        lockDuration: uint64(MIN_STAKE_DURATION)
    });
}

function unstake() external {
    Stake storage s = stakes[msg.sender];
    require(s.amount > 0, "No stake");
    require(
        block.timestamp >= s.depositTime + s.lockDuration,
        "Still locked"
    );
    
    uint256 amount = s.amount;
    delete stakes[msg.sender];
    
    (bool success,) = payable(msg.sender).call{value: amount}("");
    require(success);
}

// Rewards only for time actually staked
function calculateReward(address user) public view returns (uint256) {
    Stake storage s = stakes[user];
    if (s.amount == 0) return 0;
    
    uint256 stakeDuration = block.timestamp - s.depositTime;
    // Pro-rata rewards based on stake duration
    return (s.amount * stakeDuration * REWARD_RATE) / 1e18;
}
```

## Rules Summary
1. NEVER allow deposit and high-value action in same block
2. Use block delays (2+ blocks) before withdrawals
3. Snapshot balances for voting/rewards, don't use current balance
4. Use TWAP for any price-dependent logic, never spot price
5. Minimum staking duration prevents deposit-claim-withdraw attacks
6. Track deposit blocks to detect flash loan patterns
7. Consider cumulative time-weighted calculations for rewards
