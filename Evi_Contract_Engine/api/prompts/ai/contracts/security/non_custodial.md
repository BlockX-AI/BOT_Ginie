# Non-Custodial Fund Handling

CRITICAL: Never centralize user funds. Use these patterns to isolate risk.

## Pull-Over-Push Pattern (MANDATORY for all payments)

### Why It Matters
- Push payments can fail (malicious fallback, out of gas)
- One failed push can block ALL other users
- Attacker can grief contract by making their receive() revert

### Implementation
```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract NonCustodialGame is ReentrancyGuard {
    // Track what each user can withdraw
    mapping(address => uint256) public pendingWithdrawals;
    
    event WinningsCredited(address indexed player, uint256 amount);
    event Withdrawn(address indexed player, uint256 amount);
    
    error NothingToWithdraw();
    error TransferFailed();
    
    // GOOD: Credit winnings - no actual transfer
    function _creditWinnings(address winner, uint256 amount) internal {
        pendingWithdrawals[winner] += amount;
        emit WinningsCredited(winner, amount);
    }
    
    // GOOD: User pulls their own funds
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        
        // CEI: Effects before Interactions
        pendingWithdrawals[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit Withdrawn(msg.sender, amount);
    }
}
```

### BAD Pattern - Never Do This
```solidity
// BAD: Push to multiple users - one failure blocks all
function distributeWinnings(address[] calldata winners) external {
    for (uint i = 0; i < winners.length;) {
        // If ANY transfer fails, ALL fail!
        payable(winners[i]).transfer(rewards[winners[i]]);
        unchecked { ++i; }
    }
}
```

## Isolated Match/Game Funds

For PvP games, isolate funds per match:

```solidity
struct Match {
    address player1;
    address player2;
    uint256 stake;
    uint256 totalPool;  // Isolated per match
    bool resolved;
}

mapping(uint256 => Match) public matches;

// Each match has its own isolated pool
function joinMatch(uint256 matchId) external payable {
    Match storage m = matches[matchId];
    require(msg.value == m.stake, "Wrong stake");
    
    m.totalPool += msg.value;  // Funds isolated to this match
}

// Winner claims from their specific match
function claimWinnings(uint256 matchId) external nonReentrant {
    Match storage m = matches[matchId];
    require(m.resolved, "Not resolved");
    require(msg.sender == getWinner(matchId), "Not winner");
    
    uint256 prize = m.totalPool;
    m.totalPool = 0;  // Clear before transfer
    
    (bool success, ) = payable(msg.sender).call{value: prize}("");
    require(success, "Transfer failed");
}
```

## Time-Locked Withdrawals (Anti-Flash-Loan)

For high-value operations, add withdrawal delay:

```solidity
uint256 constant WITHDRAWAL_DELAY = 2; // blocks

struct PendingWithdrawal {
    uint256 amount;
    uint256 requestBlock;
}

mapping(address => PendingWithdrawal) public pendingWithdrawals;

// Step 1: Request withdrawal
function requestWithdrawal(uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient");
    
    balances[msg.sender] -= amount;
    pendingWithdrawals[msg.sender] = PendingWithdrawal({
        amount: amount,
        requestBlock: block.number
    });
}

// Step 2: Execute after delay
function executeWithdrawal() external nonReentrant {
    PendingWithdrawal storage pw = pendingWithdrawals[msg.sender];
    require(pw.amount > 0, "No pending");
    require(block.number >= pw.requestBlock + WITHDRAWAL_DELAY, "Too early");
    
    uint256 amount = pw.amount;
    delete pendingWithdrawals[msg.sender];
    
    (bool success, ) = payable(msg.sender).call{value: amount}("");
    require(success, "Transfer failed");
}
```

## Rules Summary
1. NEVER push funds to users - let them pull
2. NEVER loop through users to send funds
3. ALWAYS use ReentrancyGuard on withdrawal functions
4. ALWAYS update state before external calls (CEI pattern)
5. ISOLATE funds per user/match/game - no shared pools
6. Consider time-locks for high-value withdrawals
