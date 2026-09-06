# Griefing Resistance

MEV/spam attack surfaces and mitigations.

## Attack Vectors

### 1. Transaction Spam
**Attack**: Flood contract with cheap txs to DOS other players
**Mitigation**:
```solidity
uint256 public constant MIN_ACTION_COST = 0.001 ether;
mapping(address => uint256) public lastActionTime;
uint256 public constant COOLDOWN = 1 minutes;

modifier antiSpam() {
  require(msg.value >= MIN_ACTION_COST, "Minimum cost required");
  require(block.timestamp >= lastActionTime[msg.sender] + COOLDOWN, "Cooldown active");
  lastActionTime[msg.sender] = block.timestamp;
  _;
}
```

### 2. MEV Front-Running
**Attack**: Bots see pending tx and front-run favorable moves
**Mitigation**: Commitment-reveal scheme
```solidity
// Phase 1: Commit (hidden)
function commitMove(bytes32 hash) external {
  commits[msg.sender] = Commit(hash, block.number);
}

// Phase 2: Reveal (after N blocks)
function revealMove(uint8 move, bytes32 salt) external {
  require(block.number > commits[msg.sender].blockNum + REVEAL_DELAY);
  require(keccak256(abi.encodePacked(move, salt, msg.sender)) == commits[msg.sender].hash);
  _executeMove(move);
}
```

### 3. Abandonment Griefing
**Attack**: Start game, never finish, lock opponent's stake
**Mitigation**:
```solidity
uint256 public constant TURN_TIMEOUT = 1 hours;

function claimAbandonment(uint256 gameId) external {
  Game storage g = games[gameId];
  require(g.state == GameState.ACTIVE);
  require(block.timestamp > g.lastMoveTime + TURN_TIMEOUT);
  require(msg.sender == _getOpponent(gameId));
  _resolveGame(gameId, msg.sender); // Claimer wins
}
```

### 4. State Bloat
**Attack**: Create thousands of games/entities to bloat storage
**Mitigation**:
```solidity
uint256 public constant MAX_ACTIVE_GAMES_PER_USER = 5;
mapping(address => uint256) public activeGameCount;

function createGame() external {
  require(activeGameCount[msg.sender] < MAX_ACTIVE_GAMES_PER_USER);
  activeGameCount[msg.sender]++;
  // ... create game
}
```

### 5. Sybil Attacks
**Attack**: Create many accounts to manipulate leaderboards/rewards
**Mitigation**:
- Minimum stake per account
- Reputation/history requirements
- Rate-limited rewards per address

## Required Checks
- [ ] All public functions have cost or cooldown
- [ ] Timeouts exist for all waiting states
- [ ] Maximum limits on user-created entities
- [ ] Commitment scheme for hidden information games
- [ ] Stake slashing for bad behavior

## Gas Budget for Mitigations
- Cooldown check: <3k gas
- Commitment store: <25k gas
- Timeout claim: <50k gas
