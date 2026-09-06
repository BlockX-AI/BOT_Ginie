# Checkpoint State Management for Real-Time Games

## Core Principle
**Real-time games need periodic state snapshots to enable dispute resolution and recovery**

## Checkpoint Architecture

### State Channel Pattern
```solidity
contract RealtimeGameCheckpoints {
    struct Checkpoint {
        bytes32 stateHash;
        uint256 timestamp;
        uint256 blockNumber;
        bytes signatures; // Both players must sign
    }
    
    struct GameSession {
        address player1;
        address player2;
        uint256 startTime;
        uint256 lastCheckpoint;
        mapping(uint256 => Checkpoint) checkpoints;
        bool disputed;
        uint256 disputeDeadline;
    }
    
    mapping(uint256 => GameSession) public games;
    uint256 public nextGameId;
    
    uint256 constant CHECKPOINT_INTERVAL = 30 seconds;
    uint256 constant DISPUTE_WINDOW = 5 minutes;
    uint256 constant MAX_CHECKPOINTS = 100; // Bounded storage
}
```

### Checkpoint Creation
```solidity
function submitCheckpoint(
    uint256 gameId,
    bytes32 stateHash,
    bytes calldata player1Sig,
    bytes calldata player2Sig
) external {
    GameSession storage game = games[gameId];
    require(game.startTime > 0, "Game not found");
    require(!game.disputed, "Game disputed");
    
    // Verify timing
    require(
        block.timestamp >= game.lastCheckpoint + CHECKPOINT_INTERVAL,
        "Too early for checkpoint"
    );
    
    // Verify signatures
    bytes32 messageHash = keccak256(abi.encodePacked(gameId, stateHash, block.timestamp));
    require(_verifySignature(messageHash, player1Sig, game.player1), "Invalid P1 signature");
    require(_verifySignature(messageHash, player2Sig, game.player2), "Invalid P2 signature");
    
    // Store checkpoint (circular buffer)
    uint256 checkpointId = (block.timestamp / CHECKPOINT_INTERVAL) % MAX_CHECKPOINTS;
    game.checkpoints[checkpointId] = Checkpoint({
        stateHash: stateHash,
        timestamp: block.timestamp,
        blockNumber: block.number,
        signatures: abi.encodePacked(player1Sig, player2Sig)
    });
    
    game.lastCheckpoint = block.timestamp;
    
    emit CheckpointSubmitted(gameId, stateHash, block.timestamp);
}
```

## State Hash Generation

### Deterministic State Encoding
```solidity
// Off-chain state hashing (JavaScript)
function generateStateHash(gameState) {
    const encoded = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256', 'uint256[]', 'uint256[]'], // Player positions, scores, etc.
        [
            gameState.player1.position,
            gameState.player2.position,
            gameState.player1.stats,
            gameState.player2.stats
        ]
    );
    
    return ethers.utils.keccak256(encoded);
}

// On-chain verification
function verifyStateHash(
    bytes32 claimedHash,
    uint256 p1Position,
    uint256 p2Position,
    uint256[] calldata p1Stats,
    uint256[] calldata p2Stats
) internal pure returns (bool) {
    bytes32 computedHash = keccak256(abi.encode(
        p1Position,
        p2Position,
        p1Stats,
        p2Stats
    ));
    
    return computedHash == claimedHash;
}
```

### Incremental State Updates
```solidity
// Track state deltas between checkpoints
struct StateDelta {
    uint256 fromCheckpoint;
    uint256 toCheckpoint;
    bytes32 deltaHash;
    uint256 timestamp;
}

mapping(uint256 => StateDelta[]) public stateDeltas;

function submitStateDelta(
    uint256 gameId,
    uint256 fromCheckpoint,
    bytes32 deltaHash,
    bytes calldata signature
) external {
    // Verify delta is from recent checkpoint
    require(
        block.timestamp <= games[gameId].checkpoints[fromCheckpoint].timestamp + CHECKPOINT_INTERVAL,
        "Delta too old"
    );
    
    // Store delta
    stateDeltas[gameId].push(StateDelta({
        fromCheckpoint: fromCheckpoint,
        toCheckpoint: block.timestamp / CHECKPOINT_INTERVAL,
        deltaHash: deltaHash,
        timestamp: block.timestamp
    }));
}
```

## Dispute Resolution

### Challenge Mechanism
```solidity
function challengeCheckpoint(
    uint256 gameId,
    uint256 checkpointId,
    bytes calldata proof
) external payable {
    require(msg.value >= DISPUTE_BOND, "Insufficient bond");
    
    GameSession storage game = games[gameId];
    require(msg.sender == game.player1 || msg.sender == game.player2, "Not a player");
    
    Checkpoint storage checkpoint = game.checkpoints[checkpointId];
    require(checkpoint.timestamp > 0, "Checkpoint not found");
    require(
        block.timestamp <= checkpoint.timestamp + DISPUTE_WINDOW,
        "Dispute window closed"
    );
    
    // Mark game as disputed
    game.disputed = true;
    game.disputeDeadline = block.timestamp + DISPUTE_WINDOW;
    
    emit CheckpointChallenged(gameId, checkpointId, msg.sender);
    
    // Process dispute with proof
    _processDispute(gameId, checkpointId, proof);
}

function _processDispute(
    uint256 gameId,
    uint256 checkpointId,
    bytes calldata proof
) internal {
    // Verify proof against checkpoint
    // Implementation depends on game-specific logic
    // Could use ZK proofs, Merkle proofs, or state reconstruction
    
    bool disputeValid = _verifyDisputeProof(gameId, checkpointId, proof);
    
    if (disputeValid) {
        // Challenger wins - checkpoint is invalid
        _revertToLastValidCheckpoint(gameId, checkpointId);
        // Refund bond + penalty from other player
    } else {
        // Challenger loses - forfeit bond
        games[gameId].disputed = false;
    }
}
```

### Automatic Timeout Resolution
```solidity
function resolveTimeout(uint256 gameId) external {
    GameSession storage game = games[gameId];
    require(game.disputed, "Game not disputed");
    require(block.timestamp > game.disputeDeadline, "Dispute window open");
    
    // If no valid counter-proof provided, challenger wins
    _revertToLastValidCheckpoint(gameId, game.lastCheckpoint);
    game.disputed = false;
    
    emit DisputeResolved(gameId, "timeout");
}
```

## Optimistic Settlement

### Fast Finality Pattern
```solidity
struct PendingSettlement {
    bytes32 finalStateHash;
    uint256 submitTime;
    address submitter;
    bool challenged;
}

mapping(uint256 => PendingSettlement) public pendingSettlements;

function submitFinalState(
    uint256 gameId,
    bytes32 finalStateHash,
    bytes calldata signature
) external {
    GameSession storage game = games[gameId];
    require(msg.sender == game.player1 || msg.sender == game.player2, "Not a player");
    
    // Verify signature from other player
    address otherPlayer = msg.sender == game.player1 ? game.player2 : game.player1;
    bytes32 messageHash = keccak256(abi.encodePacked(gameId, finalStateHash, "FINAL"));
    require(_verifySignature(messageHash, signature, otherPlayer), "Invalid signature");
    
    pendingSettlements[gameId] = PendingSettlement({
        finalStateHash: finalStateHash,
        submitTime: block.timestamp,
        submitter: msg.sender,
        challenged: false
    });
    
    emit FinalStateSubmitted(gameId, finalStateHash);
}

function finalizeFinalState(uint256 gameId) external {
    PendingSettlement storage settlement = pendingSettlements[gameId];
    require(settlement.submitTime > 0, "No pending settlement");
    require(!settlement.challenged, "Settlement challenged");
    require(
        block.timestamp >= settlement.submitTime + DISPUTE_WINDOW,
        "Challenge window open"
    );
    
    // Finalize game with this state
    _finalizeGame(gameId, settlement.finalStateHash);
    
    delete pendingSettlements[gameId];
    emit GameFinalized(gameId, settlement.finalStateHash);
}
```

## Gas Optimization

### Batch Checkpoint Submission
```solidity
function submitCheckpointBatch(
    uint256[] calldata gameIds,
    bytes32[] calldata stateHashes,
    bytes[] calldata signatures
) external {
    require(gameIds.length == stateHashes.length, "Length mismatch");
    require(gameIds.length <= 10, "Batch too large");
    
    for (uint256 i = 0; i < gameIds.length; i++) {
        // Extract individual signatures
        bytes calldata player1Sig = signatures[i * 2];
        bytes calldata player2Sig = signatures[i * 2 + 1];
        
        _submitSingleCheckpoint(gameIds[i], stateHashes[i], player1Sig, player2Sig);
    }
}
```

### Compressed State Storage
```solidity
// Pack multiple values into single storage slot
struct PackedGameState {
    uint128 player1Score;  // 128 bits
    uint128 player2Score;  // 128 bits
    // Total: 256 bits = 1 storage slot
}

struct PackedPositions {
    uint64 player1X;       // 64 bits
    uint64 player1Y;       // 64 bits  
    uint64 player2X;       // 64 bits
    uint64 player2Y;       // 64 bits
    // Total: 256 bits = 1 storage slot
}

function packGameState(
    uint128 p1Score,
    uint128 p2Score
) internal pure returns (uint256) {
    return uint256(p1Score) | (uint256(p2Score) << 128);
}
```

## State Recovery

### Checkpoint Rollback
```solidity
function rollbackToCheckpoint(
    uint256 gameId,
    uint256 checkpointId
) internal {
    GameSession storage game = games[gameId];
    Checkpoint storage checkpoint = game.checkpoints[checkpointId];
    
    require(checkpoint.timestamp > 0, "Invalid checkpoint");
    
    // Clear all checkpoints after this one
    for (uint256 i = checkpointId + 1; i < MAX_CHECKPOINTS; i++) {
        if (game.checkpoints[i].timestamp > checkpoint.timestamp) {
            delete game.checkpoints[i];
        }
    }
    
    // Reset game state to checkpoint
    game.lastCheckpoint = checkpoint.timestamp;
    game.disputed = false;
    
    emit GameRolledBack(gameId, checkpointId, checkpoint.stateHash);
}
```

### State Reconstruction
```solidity
function reconstructState(
    uint256 gameId,
    uint256 fromCheckpoint,
    bytes[] calldata stateDeltaProofs
) external view returns (bytes32) {
    bytes32 currentState = games[gameId].checkpoints[fromCheckpoint].stateHash;
    
    // Apply deltas in sequence
    for (uint256 i = 0; i < stateDeltaProofs.length; i++) {
        currentState = _applyStateDelta(currentState, stateDeltaProofs[i]);
    }
    
    return currentState;
}

function _applyStateDelta(
    bytes32 currentState,
    bytes calldata deltaProof
) internal pure returns (bytes32) {
    // Game-specific delta application logic
    // Could be XOR for simple cases, or more complex state transitions
    return keccak256(abi.encodePacked(currentState, deltaProof));
}
```

## Output Requirements

Generated checkpoint contracts must include:

1. Checkpoint storage with bounds
2. Signature verification for both players
3. Dispute mechanism with time windows
4. State hash generation/verification
5. Optimistic settlement pattern
6. Gas-efficient batch operations
7. State recovery mechanisms
8. Event emission for off-chain indexing

## Acceptance Criteria

```solidity
// Test: Checkpoint creation
function testCheckpointCreation() external {
    bytes32 stateHash = keccak256("test_state");
    submitCheckpoint(gameId, stateHash, sig1, sig2);
    
    Checkpoint memory cp = games[gameId].checkpoints[0];
    assert(cp.stateHash == stateHash);
}

// Test: Dispute resolution
function testDispute() external {
    challengeCheckpoint(gameId, 0, disputeProof);
    assert(games[gameId].disputed == true);
    
    vm.warp(block.timestamp + DISPUTE_WINDOW + 1);
    resolveTimeout(gameId);
    assert(games[gameId].disputed == false);
}

// Test: Gas limits
function testGasLimits() external {
    uint256 gasBefore = gasleft();
    submitCheckpointBatch(gameIds, stateHashes, signatures);
    uint256 gasUsed = gasBefore - gasleft();
    
    assert(gasUsed < 300000); // Under 300k gas for batch
}
```
