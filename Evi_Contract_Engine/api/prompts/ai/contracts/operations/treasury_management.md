# Treasury Management for Game Contracts

CRITICAL: Proper treasury management prevents insolvency and ensures fair gameplay.

## Core Treasury Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

abstract contract TreasuryManagement is Ownable, ReentrancyGuard {
    // ═══════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════
    
    uint256 public constant HOUSE_EDGE_BPS = 250; // 2.5% house edge
    uint256 public constant MAX_BET_RATIO = 100;  // Max bet = treasury / 100 (1%)
    uint256 public constant MIN_RESERVE_RATIO = 10; // Keep 10% as reserve
    
    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    
    uint256 public totalPendingWithdrawals;
    uint256 public accumulatedFees;
    
    mapping(address => uint256) public pendingWithdrawals;
    
    // ═══════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════
    
    error BetTooLarge(uint256 sent, uint256 maxAllowed);
    error InsufficientTreasury(uint256 required, uint256 available);
    error InsufficientReserve();
    error NoFeesToCollect();
    
    // ═══════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════
    
    event TreasuryFunded(address indexed funder, uint256 amount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event FeesCollected(address indexed to, uint256 amount);
    event TreasuryLow(uint256 balance, uint256 threshold);
    
    // ═══════════════════════════════════════════════════════════════
    // TREASURY FUNDING
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Fund the game treasury
    receive() external payable {
        emit TreasuryFunded(msg.sender, msg.value);
    }
    
    /// @notice Explicit treasury funding function
    function fundTreasury() external payable {
        emit TreasuryFunded(msg.sender, msg.value);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Get available treasury (excluding pending withdrawals)
    function availableTreasury() public view returns (uint256) {
        uint256 balance = address(this).balance;
        if (balance <= totalPendingWithdrawals) return 0;
        return balance - totalPendingWithdrawals;
    }
    
    /// @notice Get maximum allowed bet based on treasury
    function maxBet() public view returns (uint256) {
        return availableTreasury() / MAX_BET_RATIO;
    }
    
    /// @notice Check if treasury is healthy
    function isTreasuryHealthy() public view returns (bool) {
        return availableTreasury() > totalPendingWithdrawals * MIN_RESERVE_RATIO / 100;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // BET VALIDATION
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Validate bet amount against treasury limits
    function _validateBet(uint256 betAmount, uint256 potentialPayout) internal view {
        uint256 _maxBet = maxBet();
        if (betAmount > _maxBet) {
            revert BetTooLarge(betAmount, _maxBet);
        }
        
        if (availableTreasury() < potentialPayout) {
            revert InsufficientTreasury(potentialPayout, availableTreasury());
        }
    }
    
    /// @notice Calculate payout after house edge
    function _calculatePayout(uint256 betAmount, uint256 multiplierBps) 
        internal 
        pure 
        returns (uint256 payout, uint256 fee) 
    {
        uint256 grossPayout = (betAmount * multiplierBps) / 10000;
        fee = (grossPayout * HOUSE_EDGE_BPS) / 10000;
        payout = grossPayout - fee;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // WITHDRAWAL MANAGEMENT
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Credit winnings to player (internal)
    function _creditWinnings(address player, uint256 amount) internal {
        pendingWithdrawals[player] += amount;
        totalPendingWithdrawals += amount;
        
        // Emit warning if treasury getting low
        if (!isTreasuryHealthy()) {
            emit TreasuryLow(address(this).balance, totalPendingWithdrawals * 2);
        }
    }
    
    /// @notice Process player withdrawal
    function _processWithdrawal(address player) internal returns (uint256 amount) {
        amount = pendingWithdrawals[player];
        require(amount > 0, "Nothing to withdraw");
        
        // Effects before interactions
        delete pendingWithdrawals[player];
        totalPendingWithdrawals -= amount;
        
        // Interaction
        (bool success, ) = payable(player).call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Withdraw excess treasury (above reserve requirements)
    function withdrawExcessTreasury(uint256 amount, address to) external onlyOwner nonReentrant {
        uint256 minRequired = totalPendingWithdrawals + (totalPendingWithdrawals * MIN_RESERVE_RATIO / 100);
        
        if (address(this).balance - amount < minRequired) {
            revert InsufficientReserve();
        }
        
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit TreasuryWithdrawn(to, amount);
    }
    
    /// @notice Collect accumulated house edge fees
    function collectFees(address to) external onlyOwner nonReentrant {
        uint256 fees = accumulatedFees;
        if (fees == 0) revert NoFeesToCollect();
        
        accumulatedFees = 0;
        
        (bool success, ) = payable(to).call{value: fees}("");
        require(success, "Transfer failed");
        
        emit FeesCollected(to, fees);
    }
}
```

## Treasury Health Monitoring

```solidity
// Thresholds for monitoring
uint256 constant WARNING_THRESHOLD = 50;  // Warn at 50% of pending
uint256 constant CRITICAL_THRESHOLD = 20; // Critical at 20% of pending

function getTreasuryHealth() external view returns (
    uint256 balance,
    uint256 pending,
    uint256 available,
    string memory status
) {
    balance = address(this).balance;
    pending = totalPendingWithdrawals;
    available = availableTreasury();
    
    if (pending == 0) {
        status = "HEALTHY";
    } else {
        uint256 ratio = (available * 100) / pending;
        if (ratio >= 100) status = "HEALTHY";
        else if (ratio >= WARNING_THRESHOLD) status = "WARNING";
        else if (ratio >= CRITICAL_THRESHOLD) status = "CRITICAL";
        else status = "INSOLVENT";
    }
}
```

## Rules Summary
1. ALWAYS include `receive() external payable` for treasury funding
2. ALWAYS track `totalPendingWithdrawals` to ensure solvency
3. Limit bets to 1% of available treasury (prevents single-bet drain)
4. Keep minimum reserve ratio (10%) above pending withdrawals
5. Implement house edge (2-5%) for sustainable operations
6. Emit `TreasuryLow` event when approaching insolvency
7. Admin withdrawals must maintain reserve requirements
8. Never allow treasury withdrawal below pending obligations
