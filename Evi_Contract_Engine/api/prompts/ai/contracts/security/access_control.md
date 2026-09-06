# Access Control Patterns for Game Contracts

CRITICAL: Proper access control prevents unauthorized operations and rug pulls.

## Role-Based Access Control

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract GameAccessControl is AccessControl {
    // ═══════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════
    
    // Admin: Can grant/revoke roles, upgrade contracts
    // DEFAULT_ADMIN_ROLE is inherited from AccessControl
    
    // Operator: Can resolve games, update parameters
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Pauser: Can pause/unpause operations
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // Treasury: Can withdraw funds, collect fees
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    // Oracle: Can submit external data (scores, results)
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════
    
    constructor() {
        // Deployer gets admin role
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // Admin can manage all roles
        _setRoleAdmin(OPERATOR_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(PAUSER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(TREASURY_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(ORACLE_ROLE, DEFAULT_ADMIN_ROLE);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ROLE CHECKS
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Check if address has any privileged role
    function isPrivileged(address account) public view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account) ||
               hasRole(OPERATOR_ROLE, account) ||
               hasRole(TREASURY_ROLE, account);
    }
}
```

## Multi-Signature Requirement

For high-value operations, require multiple approvals:

```solidity
// Simple 2-of-3 multisig for critical operations
struct MultiSigOperation {
    bytes32 operationHash;
    uint8 approvalCount;
    mapping(address => bool) hasApproved;
    bool executed;
}

mapping(bytes32 => MultiSigOperation) public operations;
address[3] public signers;
uint8 constant REQUIRED_APPROVALS = 2;

error AlreadyApproved();
error NotASigner();
error InsufficientApprovals();
error AlreadyExecuted();

function proposeOperation(bytes32 operationHash) external {
    require(_isSigner(msg.sender), "Not a signer");
    operations[operationHash].operationHash = operationHash;
    operations[operationHash].hasApproved[msg.sender] = true;
    operations[operationHash].approvalCount = 1;
}

function approveOperation(bytes32 operationHash) external {
    if (!_isSigner(msg.sender)) revert NotASigner();
    if (operations[operationHash].hasApproved[msg.sender]) revert AlreadyApproved();
    
    operations[operationHash].hasApproved[msg.sender] = true;
    unchecked { operations[operationHash].approvalCount++; }
}

modifier requiresMultiSig(bytes32 operationHash) {
    if (operations[operationHash].executed) revert AlreadyExecuted();
    if (operations[operationHash].approvalCount < REQUIRED_APPROVALS) {
        revert InsufficientApprovals();
    }
    operations[operationHash].executed = true;
    _;
}

function _isSigner(address account) internal view returns (bool) {
    for (uint i = 0; i < 3;) {
        if (signers[i] == account) return true;
        unchecked { ++i; }
    }
    return false;
}
```

## Ownership Transfer with Timelock

```solidity
address public pendingOwner;
uint256 public ownershipTransferTime;
uint256 constant OWNERSHIP_DELAY = 48 hours;

event OwnershipTransferInitiated(address indexed currentOwner, address indexed pendingOwner);
event OwnershipTransferCompleted(address indexed previousOwner, address indexed newOwner);
event OwnershipTransferCancelled();

function initiateOwnershipTransfer(address newOwner) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(newOwner != address(0), "Invalid address");
    pendingOwner = newOwner;
    ownershipTransferTime = block.timestamp + OWNERSHIP_DELAY;
    emit OwnershipTransferInitiated(msg.sender, newOwner);
}

function completeOwnershipTransfer() external {
    require(msg.sender == pendingOwner, "Not pending owner");
    require(block.timestamp >= ownershipTransferTime, "Too early");
    
    address previousOwner = getRoleMember(DEFAULT_ADMIN_ROLE, 0);
    _revokeRole(DEFAULT_ADMIN_ROLE, previousOwner);
    _grantRole(DEFAULT_ADMIN_ROLE, pendingOwner);
    
    emit OwnershipTransferCompleted(previousOwner, pendingOwner);
    
    delete pendingOwner;
    delete ownershipTransferTime;
}

function cancelOwnershipTransfer() external onlyRole(DEFAULT_ADMIN_ROLE) {
    delete pendingOwner;
    delete ownershipTransferTime;
    emit OwnershipTransferCancelled();
}
```

## Never Use tx.origin

```solidity
// BAD: Vulnerable to phishing attacks
function badWithdraw() external {
    require(tx.origin == owner, "Not owner"); // NEVER DO THIS
    // Attacker can create malicious contract that calls this
}

// GOOD: Use msg.sender
function goodWithdraw() external onlyRole(TREASURY_ROLE) {
    // msg.sender is always the immediate caller
}
```

## Rules Summary
1. Use OpenZeppelin's AccessControl for role-based permissions
2. Separate roles: OPERATOR, PAUSER, TREASURY, ORACLE
3. Admin should NOT be able to directly withdraw user funds
4. Use timelocked ownership transfer (48h minimum)
5. Consider multi-sig for high-value operations
6. NEVER use tx.origin for authorization
7. Emit events for all role changes
8. Deployer should renounce admin role after setup (for trustlessness)
