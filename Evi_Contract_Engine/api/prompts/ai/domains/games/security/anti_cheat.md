# Anti-Cheat Mechanisms for Web3 Games

CRITICAL: On-chain games are transparent - assume all data and logic is visible to attackers.

## Commit-Reveal Pattern

Prevents front-running of player choices:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract CommitReveal {
    // ═══════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════
    
    struct Commitment {
        bytes32 hash;
        uint64 commitBlock;
        uint64 deadline;
        bool revealed;
    }
    
    mapping(address => Commitment) public commitments;
    
    uint256 public constant REVEAL_WINDOW = 10; // blocks
    uint256 public constant MIN_COMMIT_DELAY = 2; // blocks before reveal
    
    // ═══════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════
    
    error CommitmentExists();
    error NoCommitment();
    error RevealTooEarly();
    error RevealTooLate();
    error InvalidReveal();
    
    // ═══════════════════════════════════════════════════════════════
    // COMMIT PHASE
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Commit a hidden choice
    /// @param commitHash keccak256(abi.encodePacked(choice, secret, msg.sender))
    function commit(bytes32 commitHash) external {
        if (commitments[msg.sender].hash != bytes32(0) && !commitments[msg.sender].revealed) {
            revert CommitmentExists();
        }
        
        commitments[msg.sender] = Commitment({
            hash: commitHash,
            commitBlock: uint64(block.number),
            deadline: uint64(block.number + MIN_COMMIT_DELAY + REVEAL_WINDOW),
            revealed: false
        });
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REVEAL PHASE
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Reveal the committed choice
    function reveal(uint256 choice, bytes32 secret) external returns (uint256) {
        Commitment storage c = commitments[msg.sender];
        
        if (c.hash == bytes32(0)) revert NoCommitment();
        if (block.number < c.commitBlock + MIN_COMMIT_DELAY) revert RevealTooEarly();
        if (block.number > c.deadline) revert RevealTooLate();
        
        bytes32 expectedHash = keccak256(abi.encodePacked(choice, secret, msg.sender));
        if (c.hash != expectedHash) revert InvalidReveal();
        
        c.revealed = true;
        
        return choice;
    }
    
    /// @notice Generate commit hash (helper for frontend)
    function generateCommitHash(uint256 choice, bytes32 secret, address player) 
        external 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encodePacked(choice, secret, player));
    }
}
```

## Server-Signed Score Verification

For off-chain games (runners, puzzles):

```solidity
// Server signs scores, contract verifies
address public immutable trustedSigner;

struct ScoreSubmission {
    address player;
    uint256 score;
    uint256 gameId;
    uint256 timestamp;
    bytes signature;
}

error InvalidSignature();
error SignatureExpired();
error ScoreAlreadySubmitted();

mapping(bytes32 => bool) public usedSignatures;

function submitScore(ScoreSubmission calldata submission) external {
    // Verify signature is from trusted server
    bytes32 messageHash = keccak256(abi.encodePacked(
        submission.player,
        submission.score,
        submission.gameId,
        submission.timestamp
    ));
    
    bytes32 ethSignedHash = keccak256(abi.encodePacked(
        "\x19Ethereum Signed Message:\n32",
        messageHash
    ));
    
    address signer = _recoverSigner(ethSignedHash, submission.signature);
    if (signer != trustedSigner) revert InvalidSignature();
    
    // Prevent replay
    if (usedSignatures[ethSignedHash]) revert ScoreAlreadySubmitted();
    usedSignatures[ethSignedHash] = true;
    
    // Prevent old signatures
    if (block.timestamp > submission.timestamp + 1 hours) revert SignatureExpired();
    
    // Process score
    _processScore(submission.player, submission.score);
}

function _recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
    require(sig.length == 65, "Invalid signature length");
    
    bytes32 r;
    bytes32 s;
    uint8 v;
    
    assembly {
        r := mload(add(sig, 32))
        s := mload(add(sig, 64))
        v := byte(0, mload(add(sig, 96)))
    }
    
    if (v < 27) v += 27;
    
    return ecrecover(hash, v, r, s);
}
```

## Merkle Proof for Batch Verification

Verify multiple game actions efficiently:

```solidity
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

bytes32 public gameStateRoot;

function verifyAction(
    bytes32[] calldata proof,
    address player,
    uint256 actionType,
    uint256 actionData
) external view returns (bool) {
    bytes32 leaf = keccak256(abi.encodePacked(player, actionType, actionData));
    return MerkleProof.verify(proof, gameStateRoot, leaf);
}

function updateGameState(bytes32 newRoot) external onlyRole(OPERATOR_ROLE) {
    gameStateRoot = newRoot;
    emit GameStateUpdated(newRoot, block.timestamp);
}
```

## Random Matchmaking (Anti-Collusion)

```solidity
address[] public matchmakingQueue;
mapping(address => uint256) public queuePosition;

function joinQueue() external payable {
    require(msg.value == ENTRY_FEE, "Wrong fee");
    require(queuePosition[msg.sender] == 0, "Already in queue");
    
    matchmakingQueue.push(msg.sender);
    queuePosition[msg.sender] = matchmakingQueue.length;
    
    // Auto-match when enough players
    if (matchmakingQueue.length >= 2) {
        _createRandomMatch();
    }
}

function _createRandomMatch() internal {
    require(matchmakingQueue.length >= 2, "Not enough players");
    
    // Use future block hash for randomness (commit now, resolve later)
    // Or use VRF for truly secure matchmaking
    uint256 rand = uint256(keccak256(abi.encodePacked(
        block.prevrandao,
        block.timestamp,
        matchmakingQueue.length
    )));
    
    uint256 idx1 = rand % matchmakingQueue.length;
    uint256 idx2 = (rand / matchmakingQueue.length) % (matchmakingQueue.length - 1);
    if (idx2 >= idx1) idx2++;
    
    address player1 = matchmakingQueue[idx1];
    address player2 = matchmakingQueue[idx2];
    
    // Remove from queue and create match
    _removeFromQueue(idx1 > idx2 ? idx1 : idx2);
    _removeFromQueue(idx1 > idx2 ? idx2 : idx1);
    
    _startMatch(player1, player2);
}
```

## Stake Requirements (Anti-Sybil)

```solidity
uint256 public constant MIN_STAKE_TO_PLAY = 0.1 ether;
mapping(address => uint256) public playerStakes;
mapping(address => uint256) public reputation;

modifier requiresStake() {
    require(playerStakes[msg.sender] >= MIN_STAKE_TO_PLAY, "Insufficient stake");
    _;
}

function stake() external payable {
    playerStakes[msg.sender] += msg.value;
}

// Slash stake for cheating
function slashPlayer(address cheater, uint256 amount) external onlyRole(OPERATOR_ROLE) {
    uint256 slashAmount = amount > playerStakes[cheater] ? playerStakes[cheater] : amount;
    playerStakes[cheater] -= slashAmount;
    reputation[cheater] = 0; // Reset reputation
    
    emit PlayerSlashed(cheater, slashAmount);
}

// Bonus rewards for high reputation players
function getRewardMultiplier(address player) public view returns (uint256) {
    uint256 rep = reputation[player];
    if (rep >= 100) return 150; // 1.5x
    if (rep >= 50) return 125;  // 1.25x
    return 100; // 1x
}
```

## Rules Summary
1. Use commit-reveal for ANY player choice that could be front-run
2. Server-signed verification for off-chain game scores
3. Merkle proofs for efficient batch verification
4. Random matchmaking prevents collusion
5. Stake requirements deter Sybil attacks
6. Reputation systems reward honest players
7. Slash mechanisms punish cheaters
8. Time-bound signatures prevent replay attacks
