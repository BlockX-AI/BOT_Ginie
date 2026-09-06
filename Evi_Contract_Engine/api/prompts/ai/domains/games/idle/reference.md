# Idle Game Reference Implementation

Annotated skeleton for clicker/idle games.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract IdleGame is ReentrancyGuard {
  // ═══════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════
  
  uint32 constant CLICK_VALUE = 1;
  uint32 constant MAX_OFFLINE_SECONDS = 24 * 3600; // ✅ Bounded
  uint8 constant MAX_GENERATOR_LEVEL = 100;        // ✅ Bounded
  uint8 constant NUM_GENERATOR_TYPES = 5;          // ✅ Fixed
  
  // ═══════════════════════════════════════════════════════════════
  // STATE: Packed for gas efficiency
  // ═══════════════════════════════════════════════════════════════
  
  struct PlayerState {
    // Slot 1: Resources
    uint128 coins;           // Current balance
    uint64 lastActive;       // For offline calculation
    uint32 clickPower;       // Coins per click
    uint32 autoRate;         // Coins per second (from generators)
    
    // Slot 2: Progression
    uint32 totalClicks;
    uint32 totalCoinsEarned; // Lifetime (for prestige)
    uint16 prestigeLevel;
    uint16 prestigeMultiplier; // 100 = 1x
    
    // Slot 3: Generators (packed: 5 generators × 8 bits each = 40 bits)
    uint64 generators;       // Levels packed
  }
  
  mapping(address => PlayerState) public players;
  
  // Generator configs (immutable after deploy)
  uint32[5] public generatorBaseCost = [10, 100, 1000, 10000, 100000];
  uint32[5] public generatorBaseRate = [1, 5, 25, 125, 625];
  
  // ═══════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════
  
  event Clicked(address indexed player, uint32 earned);
  event GeneratorBought(address indexed player, uint8 genType, uint8 newLevel);
  event CoinsClaimed(address indexed player, uint128 amount);
  event Prestiged(address indexed player, uint16 newLevel, uint16 multiplier);
  
  // ═══════════════════════════════════════════════════════════════
  // CORE ACTIONS
  // ═══════════════════════════════════════════════════════════════
  
  /// @notice Manual click to earn coins
  function click() external {
    PlayerState storage p = players[msg.sender];
    
    // Initialize new player
    if (p.lastActive == 0) {
      p.lastActive = uint64(block.timestamp);
      p.clickPower = CLICK_VALUE;
      p.prestigeMultiplier = 100;
    }
    
    // Collect offline earnings first
    _collectOffline(p);
    
    // Apply click
    uint32 earned = p.clickPower * p.prestigeMultiplier / 100;
    p.coins += earned;
    p.totalCoinsEarned += earned;
    p.totalClicks++;
    
    emit Clicked(msg.sender, earned);
  }
  
  /// @notice Claim accumulated offline/auto earnings
  function claim() external {
    PlayerState storage p = players[msg.sender];
    require(p.lastActive > 0, "Not initialized");
    
    uint128 collected = _collectOffline(p);
    emit CoinsClaimed(msg.sender, collected);
  }
  
  /// @notice Buy/upgrade a generator
  function buyGenerator(uint8 genType) external {
    require(genType < NUM_GENERATOR_TYPES, "Invalid generator");
    
    PlayerState storage p = players[msg.sender];
    _collectOffline(p);
    
    uint8 currentLevel = _getGeneratorLevel(p.generators, genType);
    require(currentLevel < MAX_GENERATOR_LEVEL, "Max level");
    
    // Cost = base * 1.15^level (approximated)
    uint256 cost = _getUpgradeCost(genType, currentLevel);
    require(p.coins >= cost, "Not enough coins");
    
    // Deduct cost
    p.coins -= uint128(cost);
    
    // Upgrade generator
    uint8 newLevel = currentLevel + 1;
    p.generators = _setGeneratorLevel(p.generators, genType, newLevel);
    
    // Recalculate auto rate
    p.autoRate = _calculateAutoRate(p.generators, p.prestigeMultiplier);
    
    emit GeneratorBought(msg.sender, genType, newLevel);
  }
  
  /// @notice Prestige to reset progress with permanent bonus
  function prestige() external {
    PlayerState storage p = players[msg.sender];
    require(p.totalCoinsEarned >= 1e9, "Need 1B coins earned");
    
    // Calculate new multiplier
    uint16 bonus = uint16(p.totalCoinsEarned / 1e9) * 10; // +10% per billion
    p.prestigeMultiplier = 100 + bonus;
    p.prestigeLevel++;
    
    // Reset progress
    p.coins = 0;
    p.generators = 0;
    p.autoRate = 0;
    p.clickPower = CLICK_VALUE;
    // Note: totalCoinsEarned persists for next prestige calc
    
    emit Prestiged(msg.sender, p.prestigeLevel, p.prestigeMultiplier);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // INTERNAL: Lazy yield calculation
  // ═══════════════════════════════════════════════════════════════
  
  function _collectOffline(PlayerState storage p) internal returns (uint128 collected) {
    if (p.autoRate == 0) {
      p.lastActive = uint64(block.timestamp);
      return 0;
    }
    
    uint256 elapsed = block.timestamp - p.lastActive;
    
    // ✅ Cap offline time
    if (elapsed > MAX_OFFLINE_SECONDS) {
      elapsed = MAX_OFFLINE_SECONDS;
    }
    
    // Calculate offline earnings (50% efficiency)
    collected = uint128(elapsed * p.autoRate / 2);
    
    p.coins += collected;
    p.totalCoinsEarned += uint32(collected > type(uint32).max ? type(uint32).max : collected);
    p.lastActive = uint64(block.timestamp);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // INTERNAL: Generator helpers
  // ═══════════════════════════════════════════════════════════════
  
  function _getGeneratorLevel(uint64 packed, uint8 index) internal pure returns (uint8) {
    return uint8((packed >> (index * 8)) & 0xFF);
  }
  
  function _setGeneratorLevel(uint64 packed, uint8 index, uint8 level) internal pure returns (uint64) {
    uint64 mask = ~(uint64(0xFF) << (index * 8));
    return (packed & mask) | (uint64(level) << (index * 8));
  }
  
  function _getUpgradeCost(uint8 genType, uint8 currentLevel) internal view returns (uint256) {
    uint256 base = generatorBaseCost[genType];
    // Approximate 1.15^level
    for (uint8 i = 0; i < currentLevel; i++) {
      base = base * 115 / 100;
    }
    return base;
  }
  
  function _calculateAutoRate(uint64 generators, uint16 multiplier) internal view returns (uint32) {
    uint256 total = 0;
    for (uint8 i = 0; i < NUM_GENERATOR_TYPES; i++) {
      uint8 level = _getGeneratorLevel(generators, i);
      if (level > 0) {
        total += uint256(generatorBaseRate[i]) * level;
      }
    }
    return uint32(total * multiplier / 100);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // VIEW: Player stats
  // ═══════════════════════════════════════════════════════════════
  
  function getPlayerStats(address player) external view returns (
    uint128 coins,
    uint128 pendingOffline,
    uint32 autoRate,
    uint32 clickPower
  ) {
    PlayerState memory p = players[player];
    coins = p.coins;
    autoRate = p.autoRate;
    clickPower = p.clickPower * p.prestigeMultiplier / 100;
    
    // Calculate pending offline
    if (p.autoRate > 0) {
      uint256 elapsed = block.timestamp - p.lastActive;
      if (elapsed > MAX_OFFLINE_SECONDS) elapsed = MAX_OFFLINE_SECONDS;
      pendingOffline = uint128(elapsed * p.autoRate / 2);
    }
  }
}
```

## Key Design Decisions
1. **Lazy calculation** - Yield computed on claim, not every second
2. **Packed generators** - 5 generators in one uint64
3. **Offline cap** - Maximum 24h to prevent exploitation
4. **Prestige system** - Permanent progression across resets
5. **Fixed generator types** - No unbounded arrays
