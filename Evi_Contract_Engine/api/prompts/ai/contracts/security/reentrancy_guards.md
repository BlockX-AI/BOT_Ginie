# Reentrancy Protection

CRITICAL: Reentrancy is the #1 cause of smart contract exploits.

## When to Use ReentrancyGuard

ALWAYS use `nonReentrant` modifier for:
- Functions that transfer ETH
- Functions that call external contracts
- Functions that transfer ERC20/ERC721/ERC1155 tokens
- Claim/withdraw/redeem functions
- Any function that sends value AND updates state

## Implementation

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SecureGame is ReentrancyGuard {
    mapping(address => uint256) public balances;
    
    error InsufficientBalance();
    error TransferFailed();
    
    // ALWAYS nonReentrant for withdrawals
    function withdraw(uint256 amount) external nonReentrant {
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        
        // CEI: Update state BEFORE external call
        balances[msg.sender] -= amount;
        
        // External call LAST
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
    }
    
    // ALWAYS nonReentrant for claims
    function claimRewards() external nonReentrant {
        uint256 reward = pendingRewards[msg.sender];
        
        // Clear BEFORE transfer
        pendingRewards[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: reward}("");
        if (!success) revert TransferFailed();
    }
}
```

## Checks-Effects-Interactions (CEI) Pattern

ALWAYS follow this order in functions with external calls:

```solidity
function secureFunction(uint256 amount) external nonReentrant {
    // 1. CHECKS - Validate all inputs and conditions
    require(amount > 0, "Zero amount");
    require(balances[msg.sender] >= amount, "Insufficient");
    require(!paused, "Contract paused");
    
    // 2. EFFECTS - Update ALL state variables
    balances[msg.sender] -= amount;
    totalWithdrawn += amount;
    lastWithdrawal[msg.sender] = block.timestamp;
    withdrawalCount[msg.sender]++;
    
    // 3. INTERACTIONS - External calls LAST
    (bool success, ) = payable(msg.sender).call{value: amount}("");
    require(success, "Transfer failed");
    
    emit Withdrawn(msg.sender, amount);
}
```

## Vulnerable vs Secure Examples

### VULNERABLE - State updated after external call
```solidity
// BAD: Can be reentered before balance is updated!
function vulnerableWithdraw() external {
    uint256 bal = balances[msg.sender];
    
    // External call BEFORE state update = VULNERABLE
    (bool sent,) = msg.sender.call{value: bal}("");
    require(sent);
    
    balances[msg.sender] = 0;  // Too late! Already reentered
}
```

### SECURE - State updated before external call
```solidity
// GOOD: State updated before any external call
function secureWithdraw() external nonReentrant {
    uint256 bal = balances[msg.sender];
    
    // Update state FIRST
    balances[msg.sender] = 0;
    
    // External call LAST
    (bool sent,) = msg.sender.call{value: bal}("");
    require(sent);
}
```

## Cross-Function Reentrancy

Watch out for reentrancy across multiple functions:

```solidity
contract SecureMultiFunction is ReentrancyGuard {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public rewards;
    
    // Both functions share state - both need nonReentrant
    function withdrawBalance() external nonReentrant {
        uint256 bal = balances[msg.sender];
        balances[msg.sender] = 0;
        
        (bool success,) = payable(msg.sender).call{value: bal}("");
        require(success);
    }
    
    // This could be called during withdrawBalance if not protected
    function claimRewards() external nonReentrant {
        uint256 reward = rewards[msg.sender];
        rewards[msg.sender] = 0;
        
        (bool success,) = payable(msg.sender).call{value: reward}("");
        require(success);
    }
}
```

## Rules Summary
1. ALWAYS import and inherit ReentrancyGuard
2. ALWAYS add `nonReentrant` to functions with external calls
3. ALWAYS follow CEI pattern: Checks → Effects → Interactions
4. NEVER update state after external calls
5. NEVER trust external contracts - assume they are malicious
6. Use nonReentrant on ALL functions that share state with transfer functions
