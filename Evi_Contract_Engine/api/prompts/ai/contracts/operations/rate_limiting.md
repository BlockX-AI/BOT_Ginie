# Rate Limiting for Game Contracts

CRITICAL: Rate limiting prevents bot abuse, spam attacks, and economic exploits.

## Per-User Rate Limiting

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract RateLimiting {
    // ═══════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════
    
    uint256 public constant ACTION_COOLDOWN = 10 seconds;
    uint256 public constant DAILY_BET_LIMIT = 10 ether;
    uint256 public constant MAX_BETS_PER_HOUR = 100;
    
    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    
    struct UserLimits {
        uint64 lastActionTime;
        uint64 hourlyBetCount;
        uint64 hourlyResetTime;
        uint128 dailyVolume;
        uint64 dailyResetTime;
    }
    
    mapping(address => UserLimits) public userLimits;
    
    // ═══════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════
    
    error CooldownNotExpired(uint256 remaining);
    error DailyLimitExceeded(uint256 current, uint256 max);
    error HourlyBetLimitExceeded(uint256 current, uint256 max);
    
    // ═══════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════
    
    modifier rateLimited(uint256 betAmount) {
        UserLimits storage limits = userLimits[msg.sender];
        
        // Check cooldown
        uint256 timeSinceLastAction = block.timestamp - limits.lastActionTime;
        if (timeSinceLastAction < ACTION_COOLDOWN) {
            revert CooldownNotExpired(ACTION_COOLDOWN - timeSinceLastAction);
        }
        
        // Reset hourly counter if needed
        uint256 currentHour = block.timestamp / 1 hours;
        if (limits.hourlyResetTime != currentHour) {
            limits.hourlyBetCount = 0;
            limits.hourlyResetTime = uint64(currentHour);
        }
        
        // Check hourly bet count
        if (limits.hourlyBetCount >= MAX_BETS_PER_HOUR) {
            revert HourlyBetLimitExceeded(limits.hourlyBetCount, MAX_BETS_PER_HOUR);
        }
        
        // Reset daily volume if needed
        uint256 currentDay = block.timestamp / 1 days;
        if (limits.dailyResetTime != currentDay) {
            limits.dailyVolume = 0;
            limits.dailyResetTime = uint64(currentDay);
        }
        
        // Check daily limit
        if (limits.dailyVolume + betAmount > DAILY_BET_LIMIT) {
            revert DailyLimitExceeded(limits.dailyVolume + betAmount, DAILY_BET_LIMIT);
        }
        
        // Update limits
        limits.lastActionTime = uint64(block.timestamp);
        limits.hourlyBetCount++;
        limits.dailyVolume += uint128(betAmount);
        
        _;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    function getRemainingCooldown(address user) external view returns (uint256) {
        uint256 elapsed = block.timestamp - userLimits[user].lastActionTime;
        if (elapsed >= ACTION_COOLDOWN) return 0;
        return ACTION_COOLDOWN - elapsed;
    }
    
    function getRemainingDailyLimit(address user) external view returns (uint256) {
        UserLimits storage limits = userLimits[user];
        uint256 currentDay = block.timestamp / 1 days;
        
        if (limits.dailyResetTime != currentDay) {
            return DAILY_BET_LIMIT;
        }
        
        if (limits.dailyVolume >= DAILY_BET_LIMIT) return 0;
        return DAILY_BET_LIMIT - limits.dailyVolume;
    }
}
```

## Global Rate Limiting

Prevent system-wide abuse:

```solidity
// Global limits to prevent coordinated attacks
uint256 public constant MAX_GLOBAL_BETS_PER_BLOCK = 50;
uint256 public constant MAX_GLOBAL_VOLUME_PER_BLOCK = 100 ether;

uint256 private _lastBlockNumber;
uint256 private _blockBetCount;
uint256 private _blockVolume;

modifier globalRateLimited(uint256 betAmount) {
    if (block.number != _lastBlockNumber) {
        _lastBlockNumber = block.number;
        _blockBetCount = 0;
        _blockVolume = 0;
    }
    
    require(_blockBetCount < MAX_GLOBAL_BETS_PER_BLOCK, "Block bet limit");
    require(_blockVolume + betAmount <= MAX_GLOBAL_VOLUME_PER_BLOCK, "Block volume limit");
    
    _blockBetCount++;
    _blockVolume += betAmount;
    _;
}
```

## Progressive Cooldowns

Increase cooldown for suspicious behavior:

```solidity
mapping(address => uint8) public suspicionLevel;
uint256[4] public cooldownTiers = [10 seconds, 1 minutes, 10 minutes, 1 hours];

function _getCooldown(address user) internal view returns (uint256) {
    uint8 level = suspicionLevel[user];
    if (level >= cooldownTiers.length) level = uint8(cooldownTiers.length - 1);
    return cooldownTiers[level];
}

function _recordSuspiciousActivity(address user) internal {
    if (suspicionLevel[user] < 3) {
        suspicionLevel[user]++;
    }
    emit SuspiciousActivity(user, suspicionLevel[user]);
}

// Decay suspicion over time
function _decaySuspicion(address user) internal {
    if (suspicionLevel[user] > 0 && 
        block.timestamp > userLimits[user].lastActionTime + 24 hours) {
        suspicionLevel[user]--;
    }
}
```

## Whitelist for High-Volume Users

```solidity
mapping(address => bool) public whitelisted;
mapping(address => uint256) public customDailyLimit;

modifier rateLimitedWithWhitelist(uint256 betAmount) {
    if (whitelisted[msg.sender]) {
        uint256 limit = customDailyLimit[msg.sender];
        // Apply custom higher limits for whitelisted users
        require(userLimits[msg.sender].dailyVolume + betAmount <= limit);
    } else {
        // Apply standard rate limiting
        // ... standard checks ...
    }
    _;
}

function setWhitelist(address user, bool status, uint256 limit) 
    external 
    onlyRole(OPERATOR_ROLE) 
{
    whitelisted[user] = status;
    customDailyLimit[user] = limit;
}
```

## Rules Summary
1. ALWAYS implement per-user cooldowns (10s minimum between actions)
2. ALWAYS implement daily volume limits per user
3. Consider hourly action count limits
4. Implement global rate limits to prevent coordinated attacks
5. Use progressive cooldowns for suspicious users
6. Whitelist mechanism for verified high-volume users
7. Store limits in packed struct for gas efficiency
8. Provide view functions for frontend to show remaining limits
