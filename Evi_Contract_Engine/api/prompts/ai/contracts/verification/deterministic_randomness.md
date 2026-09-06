# Deterministic Randomness

VRF + commitment schemes for provably fair outcomes.

## The Problem
`block.timestamp` and `block.prevrandao` are miner/validator-influenceable.

## Solution Tiers

### Tier 1: Commitment-Reveal (No External Deps)
```solidity
// For player-vs-player hidden choices
mapping(address => bytes32) public commits;
mapping(address => uint256) public commitBlock;

function commit(bytes32 hash) external {
  commits[msg.sender] = hash;
  commitBlock[msg.sender] = block.number;
}

function reveal(uint256 choice, bytes32 salt) external {
  require(block.number > commitBlock[msg.sender] + REVEAL_DELAY, "Too early");
  require(keccak256(abi.encodePacked(choice, salt, msg.sender)) == commits[msg.sender], "Invalid");
  
  _processChoice(msg.sender, choice);
  delete commits[msg.sender];
}
```

### Tier 2: Future Block Hash
```solidity
// For outcomes that can wait a few blocks
struct PendingAction {
  address player;
  uint256 targetBlock;
  bytes32 actionData;
}

mapping(uint256 => PendingAction) public pending;
uint256 public pendingCount;

function requestRandom(bytes32 actionData) external returns (uint256 requestId) {
  requestId = pendingCount++;
  pending[requestId] = PendingAction({
    player: msg.sender,
    targetBlock: block.number + 2, // 2 blocks ahead
    actionData: actionData
  });
}

function resolveRandom(uint256 requestId) external {
  PendingAction memory p = pending[requestId];
  require(block.number > p.targetBlock, "Too early");
  require(block.number <= p.targetBlock + 256, "Expired"); // blockhash limit
  
  uint256 random = uint256(blockhash(p.targetBlock));
  require(random != 0, "Block not available");
  
  _processWithRandom(p.player, p.actionData, random);
  delete pending[requestId];
}
```

### Tier 3: Chainlink VRF (Production)
```solidity
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

contract GameWithVRF is VRFConsumerBaseV2 {
  VRFCoordinatorV2Interface COORDINATOR;
  uint64 subscriptionId;
  bytes32 keyHash;
  
  mapping(uint256 => address) public requestToPlayer;
  
  function requestRandomOutcome() external returns (uint256 requestId) {
    requestId = COORDINATOR.requestRandomWords(
      keyHash,
      subscriptionId,
      3, // confirmations
      100000, // callback gas
      1 // num words
    );
    requestToPlayer[requestId] = msg.sender;
  }
  
  function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
    address player = requestToPlayer[requestId];
    uint256 outcome = randomWords[0] % NUM_OUTCOMES;
    _applyOutcome(player, outcome);
  }
}
```

## Random Distribution Patterns
```solidity
// Uniform distribution (0 to max-1)
function uniformRandom(uint256 seed, uint256 max) internal pure returns (uint256) {
  return seed % max;
}

// Weighted selection
function weightedRandom(uint256 seed, uint256[] memory weights) internal pure returns (uint256) {
  uint256 total;
  for (uint256 i = 0; i < weights.length; i++) {
    total += weights[i];
  }
  
  uint256 roll = seed % total;
  uint256 cumulative;
  for (uint256 i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) return i;
  }
  return weights.length - 1;
}

// Multiple independent rolls from one seed
function multiRoll(uint256 seed, uint256 numRolls, uint256 max) internal pure returns (uint256[] memory) {
  uint256[] memory results = new uint256[](numRolls);
  for (uint256 i = 0; i < numRolls; i++) {
    results[i] = uint256(keccak256(abi.encodePacked(seed, i))) % max;
  }
  return results;
}
```

## Anti-Manipulation
- [ ] Never use `block.timestamp` alone for randomness
- [ ] Commit-reveal requires >1 block delay
- [ ] Future blockhash requires waiting for that block
- [ ] VRF callback must validate requestId
- [ ] Track which requests are pending to prevent replay

## Selection Guide
| Use Case | Method | Latency |
|----------|--------|---------|
| Card games (hidden info) | Commit-reveal | 2+ blocks |
| Loot drops | Future blockhash | 2-3 blocks |
| High-stakes gambling | Chainlink VRF | 3+ blocks |
| Turn-based PvP | Commit-reveal | Per turn |
