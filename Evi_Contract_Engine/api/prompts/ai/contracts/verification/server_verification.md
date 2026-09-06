# Server Verification

What backend/contract MUST verify (physics outcomes).

## Verification Layers

### Layer 1: Input Validation
```solidity
function makeMove(uint256 gameId, uint8 moveType, uint8 x, uint8 y) external {
  // 1. Caller is player in this game
  require(games[gameId].isPlayer(msg.sender), "Not player");
  
  // 2. Game is active
  require(games[gameId].state == GameState.ACTIVE, "Game not active");
  
  // 3. It's caller's turn
  require(games[gameId].currentPlayer == msg.sender, "Not your turn");
  
  // 4. Move type is valid
  require(moveType < NUM_MOVE_TYPES, "Invalid move type");
  
  // 5. Coordinates in bounds
  require(x < BOARD_WIDTH && y < BOARD_HEIGHT, "Out of bounds");
  
  // THEN process...
}
```

### Layer 2: State Validation
```solidity
function attack(uint256 gameId, uint256 targetId) external {
  // Target exists
  require(_entityExists(targetId), "Target not found");
  
  // Target is attackable (not dead, not allied)
  require(_isAttackable(msg.sender, targetId), "Cannot attack");
  
  // Attacker has attack available (cooldown, energy)
  require(_canAttack(msg.sender), "Attack on cooldown");
  
  // Range check
  require(_inRange(msg.sender, targetId, ATTACK_RANGE), "Out of range");
}
```

### Layer 3: Physics Validation
```solidity
function moveEntity(uint256 entityId, uint8 dx, uint8 dy) internal {
  Position memory current = positions[entityId];
  Position memory target = Position(current.x + dx, current.y + dy);
  
  // Bounds check
  require(target.x < MAP_WIDTH && target.y < MAP_HEIGHT, "OOB");
  
  // Collision check
  require(!_isBlocked(target.x, target.y), "Blocked");
  
  // Path validation (no teleporting)
  require(_isAdjacent(current, target), "Invalid path");
  
  // Apply move
  positions[entityId] = target;
}
```

### Layer 4: Outcome Calculation
```solidity
function resolveCombat(uint256 attackerId, uint256 defenderId) internal returns (uint256 damage) {
  Stats memory attacker = stats[attackerId];
  Stats memory defender = stats[defenderId];
  
  // Deterministic formula (no client input)
  uint256 baseDamage = attacker.attack;
  uint256 defense = defender.defense;
  
  // Apply modifiers
  damage = baseDamage > defense ? baseDamage - defense : 1;
  
  // Apply to target
  if (damage >= defender.health) {
    _killEntity(defenderId);
    damage = defender.health;
  } else {
    stats[defenderId].health -= uint16(damage);
  }
  
  emit CombatResolved(attackerId, defenderId, damage);
}
```

## Verification Checklist

### Every Public Function Must Check:
- [ ] Caller authorization (who can call)
- [ ] Game state validity (when can call)
- [ ] Input bounds (valid parameters)
- [ ] Resource availability (can afford action)
- [ ] Action legality (game rules permit)

### Every State Change Must:
- [ ] Follow checks-effects-interactions
- [ ] Emit event for indexing
- [ ] Update all dependent state
- [ ] Check for win/end conditions

### Every Calculation Must:
- [ ] Use only on-chain data
- [ ] Be deterministic (same input = same output)
- [ ] Handle edge cases (zero, max, overflow)
- [ ] Be documented with formula

## Common Verification Patterns
```solidity
// Ownership
modifier onlyPlayer(uint256 gameId) {
  require(games[gameId].hasPlayer(msg.sender), "Not player");
  _;
}

// Turn-based
modifier onlyCurrentTurn(uint256 gameId) {
  require(games[gameId].currentPlayer == msg.sender, "Not your turn");
  _;
}

// State machine
modifier inState(uint256 gameId, GameState required) {
  require(games[gameId].state == required, "Invalid state");
  _;
}

// Cooldown
modifier cooldownElapsed(bytes32 actionKey) {
  require(block.timestamp >= lastAction[actionKey] + COOLDOWN, "Cooldown");
  lastAction[actionKey] = block.timestamp;
  _;
}
```
