# Gas Benchmarks

Maximum gas per action by game type.

## Hard Limits
Transactions exceeding these FAIL the build:

| Action Type | Max Gas | Rationale |
|-------------|---------|-----------|
| View/Read | 50,000 | Should be mostly free |
| Simple move | 80,000 | ~$0.50 at 50 gwei |
| Complex action | 150,000 | ~$1 at 50 gwei |
| Batch (10 items) | 300,000 | ~$2 at 50 gwei |
| Game creation | 200,000 | One-time cost OK |
| Claim rewards | 100,000 | Should be cheap |

## Per-Game-Type Budgets

### Puzzle Games
```
createGame:     <150,000
makeMove:       <50,000   // Single cell change
checkMatch:     <30,000   // Pattern validation
claimReward:    <80,000
```

### PvP Games
```
joinMatch:      <100,000
commitMove:     <50,000
revealMove:     <80,000
resolveMatch:   <150,000
claimWinnings:  <100,000
```

### Idle/Clicker
```
click:          <30,000   // Must be VERY cheap
upgrade:        <80,000
claimYield:     <100,000
compound:       <120,000
```

### Runner/Arcade
```
startRun:       <100,000
submitScore:    <80,000   // With verification
claimRank:      <100,000
```

## Optimization Checklist
When gas exceeds budget:

1. **Storage Access**
   - [ ] Use `calldata` instead of `memory` for arrays
   - [ ] Pack structs into fewer slots
   - [ ] Cache storage reads in local variables
   - [ ] Use mappings instead of arrays for lookups

2. **Loop Optimization**
   - [ ] Use `unchecked { ++i }` for counters
   - [ ] Limit loop iterations with hard cap
   - [ ] Consider off-chain computation + verification

3. **Logic Simplification**
   - [ ] Remove redundant checks
   - [ ] Combine similar operations
   - [ ] Use bitmap for boolean arrays

4. **Event Usage**
   - [ ] Log data instead of storing when possible
   - [ ] Use indexed params sparingly (3 max)

## Measurement Template
```solidity
// Add to tests
function testGasUsage() public {
  uint256 gasBefore = gasleft();
  
  // Action to measure
  game.makeMove(1, 2);
  
  uint256 gasUsed = gasBefore - gasleft();
  console.log("Gas used:", gasUsed);
  
  // Assert under budget
  assertLt(gasUsed, 50000, "makeMove exceeds gas budget");
}
```

## Cost Estimation (at various gas prices)
| Gas Used | 20 gwei | 50 gwei | 100 gwei |
|----------|---------|---------|----------|
| 50,000 | $0.10 | $0.25 | $0.50 |
| 100,000 | $0.20 | $0.50 | $1.00 |
| 200,000 | $0.40 | $1.00 | $2.00 |
| 500,000 | $1.00 | $2.50 | $5.00 |

*Assumes ETH = $2000*
