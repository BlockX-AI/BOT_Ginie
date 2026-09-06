# Client Authority Budget

What clients CAN decide (input timing only).

## Core Principle
Client controls INPUT, server/contract controls OUTCOME.

## Client Authority (Allowed)
| Action | Client Decides | Contract Validates |
|--------|----------------|-------------------|
| Move direction | Which direction | Is move legal |
| Attack target | Which enemy | Is target valid |
| Timing | When to act | Is within turn |
| Input sequence | Order of inputs | Are inputs valid |

## Server Authority (Required)
| Action | Contract Must Calculate |
|--------|------------------------|
| Damage dealt | Based on stats + formulas |
| Collision detection | Based on positions |
| Win/loss | Based on game rules |
| Rewards | Based on performance |
| Random outcomes | Using VRF/commitment |

## Implementation Pattern
```solidity
// Client sends: WHAT they want to do
// Contract determines: WHAT happens

function attack(uint256 targetId) external {
  // Client chose target - OK
  
  // Server validates target
  require(_isValidTarget(msg.sender, targetId), "Invalid target");
  
  // Server calculates damage (NOT from client)
  uint256 damage = _calculateDamage(msg.sender, targetId);
  
  // Server applies effect
  _applyDamage(targetId, damage);
  
  // Server determines outcome
  if (_isDead(targetId)) {
    _handleKill(msg.sender, targetId);
  }
}
```

## Red Flags (Never Trust Client)
```solidity
// BAD: Client sends damage amount
function attack(uint256 targetId, uint256 damage) external {
  entities[targetId].health -= damage; // EXPLOITABLE
}

// BAD: Client sends final score
function submitScore(uint256 score) external {
  scores[msg.sender] = score; // EXPLOITABLE
}

// BAD: Client sends position after move
function move(uint256 newX, uint256 newY) external {
  positions[msg.sender] = Position(newX, newY); // EXPLOITABLE
}
```

## Correct Patterns
```solidity
// GOOD: Client sends direction, contract calculates new position
function move(uint8 direction) external {
  Position memory pos = positions[msg.sender];
  
  if (direction == 0) pos.y += 1;      // UP
  else if (direction == 1) pos.y -= 1; // DOWN
  else if (direction == 2) pos.x -= 1; // LEFT
  else if (direction == 3) pos.x += 1; // RIGHT
  else revert("Invalid direction");
  
  require(_isValidPosition(pos), "Blocked");
  positions[msg.sender] = pos;
}

// GOOD: Contract tracks score based on verified actions
function collectItem(uint256 itemId) external {
  require(_canCollect(msg.sender, itemId), "Cannot collect");
  _removeItem(itemId);
  scores[msg.sender] += ITEM_VALUE; // Contract-controlled value
}
```

## Authority Budget Summary
```
┌─────────────────┬────────────────┐
│ CLIENT CONTROLS │ CONTRACT MUST  │
├─────────────────┼────────────────┤
│ Input timing    │ Validate timing│
│ Action choice   │ Validate action│
│ Target selection│ Validate target│
│ Sequence order  │ Validate order │
├─────────────────┼────────────────┤
│ NEVER           │ ALWAYS         │
├─────────────────┼────────────────┤
│ Damage values   │ Calculate dmg  │
│ Score values    │ Calculate score│
│ Position values │ Calculate pos  │
│ Random values   │ Generate random│
│ Win conditions  │ Check win      │
└─────────────────┴────────────────┘
```
