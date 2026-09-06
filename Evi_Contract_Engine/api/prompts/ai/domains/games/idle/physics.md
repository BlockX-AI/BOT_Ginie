# Idle/Clicker Game Physics

Resource generation, upgrade curves, offline progress.

## Core Mechanics

### Yield Generation (Lazy Calculation)
```solidity
// Don't update every second - calculate on demand
struct YieldState {
  uint128 accumulated;     // Last claimed amount
  uint64 lastClaim;        // Timestamp of last claim
  uint32 ratePerSecond;    // Current generation rate
  uint32 maxAccumulation;  // Cap to prevent overflow
}

function getCurrentYield(YieldState memory s) internal view returns (uint128) {
  uint256 elapsed = block.timestamp - s.lastClaim;
  uint256 generated = elapsed * s.ratePerSecond;
  uint256 total = s.accumulated + generated;
  
  // Cap at maximum
  return uint128(total > s.maxAccumulation ? s.maxAccumulation : total);
}

function claim(YieldState storage s) internal returns (uint128 amount) {
  amount = getCurrentYield(s);
  s.accumulated = 0;
  s.lastClaim = uint64(block.timestamp);
}
```

### Upgrade Cost Curves
```solidity
// Exponential cost increase
function getUpgradeCost(uint8 currentLevel) public pure returns (uint256) {
  // Cost = BASE * (1.15 ^ level)
  // Approximation without floating point
  uint256 cost = BASE_COST;
  for (uint8 i = 0; i < currentLevel; i++) {
    cost = cost * 115 / 100;
  }
  return cost;
}

// Polynomial alternative (cheaper gas)
function getUpgradeCostPoly(uint8 level) public pure returns (uint256) {
  // Cost = BASE * level^2
  return BASE_COST * uint256(level) * uint256(level);
}
```

### Prestige/Rebirth System
```solidity
struct PrestigeState {
  uint32 prestigeCount;
  uint64 totalEarned;       // Lifetime earnings (for prestige calc)
  uint32 prestigeMultiplier; // 1000 = 1x, 1100 = 1.1x
}

function calculatePrestigeBonus(uint64 totalEarned) internal pure returns (uint32) {
  // Bonus = sqrt(totalEarned / 1e18) * 10%
  // Simplified: every 1e18 earned = +10% permanent bonus
  uint32 bonus = uint32(totalEarned / 1e18) * 100; // 100 = 10% in basis points
  return 1000 + bonus; // Base 1x + bonus
}

function prestige(PrestigeState storage p, uint64 currentTotal) internal {
  require(currentTotal >= PRESTIGE_THRESHOLD, "Not enough to prestige");
  
  p.totalEarned += currentTotal;
  p.prestigeMultiplier = calculatePrestigeBonus(p.totalEarned);
  p.prestigeCount++;
  
  // Reset progress but keep multiplier
}
```

### Generator Tiers
```solidity
struct Generator {
  uint8 level;
  uint32 baseOutput;
  uint16 count;
}

// Multiple generators producing different resources
function getTotalOutput(Generator[] storage gens, uint32 multiplier) internal view returns (uint256) {
  uint256 total = 0;
  for (uint256 i = 0; i < gens.length; i++) {
    Generator memory g = gens[i];
    // Output = base * level * count * multiplier
    total += uint256(g.baseOutput) * g.level * g.count * multiplier / 1000;
  }
  return total;
}
```

## Offline Progress
```solidity
// Maximum offline accumulation (prevents exploitation)
uint256 constant MAX_OFFLINE_HOURS = 24;
uint256 constant OFFLINE_EFFICIENCY = 50; // 50% of online rate

function calculateOfflineProgress(
  uint64 lastActive,
  uint32 productionRate
) internal view returns (uint128) {
  uint256 offlineSeconds = block.timestamp - lastActive;
  
  // Cap offline time
  if (offlineSeconds > MAX_OFFLINE_HOURS * 3600) {
    offlineSeconds = MAX_OFFLINE_HOURS * 3600;
  }
  
  // Apply offline penalty
  uint256 offlineGain = offlineSeconds * productionRate * OFFLINE_EFFICIENCY / 100;
  
  return uint128(offlineGain);
}
```

## Auto-Clicker Prevention
```solidity
// Minimum time between clicks
uint32 constant MIN_CLICK_INTERVAL = 100 milliseconds; // 10 CPS max

mapping(address => uint64) public lastClick;

function click() external {
  require(block.timestamp >= lastClick[msg.sender] + MIN_CLICK_INTERVAL / 1000, "Too fast");
  lastClick[msg.sender] = uint64(block.timestamp);
  
  // Award click value
  _addResources(msg.sender, CLICK_VALUE);
}

// Or: make clicking gas-expensive enough that auto-clicking isn't profitable
function clickWithCost() external payable {
  require(msg.value >= CLICK_FEE, "Pay click fee");
  // Click fee goes to game treasury or is burned
}
```

## Milestone/Achievement System
```solidity
// Bitmap for 256 achievements
mapping(address => uint256) public achievements;

function unlockAchievement(address player, uint8 achievementId) internal {
  require(achievementId < 256, "Invalid achievement");
  uint256 mask = 1 << achievementId;
  
  if ((achievements[player] & mask) == 0) {
    achievements[player] |= mask;
    _grantAchievementReward(player, achievementId);
    emit AchievementUnlocked(player, achievementId);
  }
}

function hasAchievement(address player, uint8 id) public view returns (bool) {
  return (achievements[player] >> id) & 1 == 1;
}
```

## Gas Optimization for Idle Games
- Lazy calculation: Don't update state until claim
- Batch upgrades: Buy multiple levels in one tx
- Pack state: All yield info in one storage slot
- Events for history: Don't store every click on-chain
