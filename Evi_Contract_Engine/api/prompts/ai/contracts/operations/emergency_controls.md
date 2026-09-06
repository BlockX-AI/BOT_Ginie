# Emergency Controls & Circuit Breakers

CRITICAL: Every game contract MUST have emergency controls for operational safety.

## Core Emergency Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

abstract contract EmergencyControls is AccessControl, ReentrancyGuard {
    // ═══════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════
    
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    
    bool public paused;
    uint256 public pausedAt;
    uint256 public constant MAX_PAUSE_DURATION = 7 days;
    
    // ═══════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════
    
    error ContractPaused();
    error ContractNotPaused();
    error EmergencyWithdrawalTooEarly();
    
    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════
    
    event Paused(address indexed by, string reason);
    event Unpaused(address indexed by);
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    
    // ═══════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Blocks function when paused, auto-unpauses after MAX_PAUSE_DURATION
    modifier whenNotPaused() {
        if (paused && block.timestamp < pausedAt + MAX_PAUSE_DURATION) {
            revert ContractPaused();
        }
        // Auto-unpause if MAX_PAUSE_DURATION exceeded (trustless safety)
        if (paused && block.timestamp >= pausedAt + MAX_PAUSE_DURATION) {
            paused = false;
            emit Unpaused(address(0)); // System auto-unpause
        }
        _;
    }
    
    modifier whenPaused() {
        if (!paused) revert ContractNotPaused();
        _;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // EMERGENCY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Pause all game operations
    /// @param reason Human-readable reason for pause
    function pause(string calldata reason) external onlyRole(PAUSER_ROLE) {
        paused = true;
        pausedAt = block.timestamp;
        emit Paused(msg.sender, reason);
    }
    
    /// @notice Resume operations
    function unpause() external onlyRole(PAUSER_ROLE) whenPaused {
        paused = false;
        emit Unpaused(msg.sender);
    }
    
    /// @notice Emergency withdrawal - only after extended pause
    /// @dev Requires 48 hours of pause before allowing full drain
    function emergencyWithdraw(address to) external onlyRole(EMERGENCY_ROLE) whenPaused {
        if (block.timestamp < pausedAt + 48 hours) {
            revert EmergencyWithdrawalTooEarly();
        }
        
        uint256 balance = address(this).balance;
        (bool success, ) = payable(to).call{value: balance}("");
        require(success, "Transfer failed");
        
        emit EmergencyWithdrawal(to, balance);
    }
}
```

## Granular Pause Controls

For complex games, pause specific features:

```solidity
// Bitmap for granular pausing
uint256 public pausedFeatures;

uint256 constant FEATURE_BETTING = 1 << 0;      // bit 0
uint256 constant FEATURE_WITHDRAWALS = 1 << 1;  // bit 1
uint256 constant FEATURE_MATCHMAKING = 1 << 2;  // bit 2
uint256 constant FEATURE_LEADERBOARD = 1 << 3;  // bit 3

modifier whenFeatureActive(uint256 feature) {
    require(pausedFeatures & feature == 0, "Feature paused");
    _;
}

function pauseFeature(uint256 feature) external onlyRole(PAUSER_ROLE) {
    pausedFeatures |= feature;
}

function unpauseFeature(uint256 feature) external onlyRole(PAUSER_ROLE) {
    pausedFeatures &= ~feature;
}

// Usage:
function placeBet() external whenFeatureActive(FEATURE_BETTING) { ... }
function withdraw() external whenFeatureActive(FEATURE_WITHDRAWALS) { ... }
```

## Timelock for Critical Operations

```solidity
mapping(bytes32 => uint256) public scheduledOperations;
uint256 constant TIMELOCK_DELAY = 24 hours;

event OperationScheduled(bytes32 indexed operationId, uint256 executeTime);
event OperationExecuted(bytes32 indexed operationId);
event OperationCancelled(bytes32 indexed operationId);

function scheduleOperation(bytes32 operationId) external onlyRole(DEFAULT_ADMIN_ROLE) {
    scheduledOperations[operationId] = block.timestamp + TIMELOCK_DELAY;
    emit OperationScheduled(operationId, block.timestamp + TIMELOCK_DELAY);
}

modifier timelocked(bytes32 operationId) {
    uint256 scheduled = scheduledOperations[operationId];
    require(scheduled != 0 && block.timestamp >= scheduled, "Not ready");
    delete scheduledOperations[operationId];
    _;
    emit OperationExecuted(operationId);
}
```

## Rules Summary
1. ALWAYS include pause functionality
2. Auto-unpause after MAX_PAUSE_DURATION for trustlessness
3. Emergency withdrawal requires extended pause period (48h minimum)
4. Use granular pausing for complex games
5. Timelock critical operations (parameter changes, upgrades)
6. Emit events for all emergency actions
7. Never allow instant emergency withdrawal (prevents rug pulls)
