# Incentive Alignment

Prevent dominant strategies that break game fun.

## Core Principle
Every action should have trade-offs. No single strategy should always win.

## Design Checks
1. **Nash Equilibrium Test**: Is there a single best move regardless of opponent?
2. **Risk/Reward Balance**: Higher rewards require higher risk
3. **Skill Expression**: Better players should win more often
4. **Comeback Mechanics**: Losing players have viable paths to recovery

## Anti-Dominant Strategy Patterns

### Rock-Paper-Scissors Balance
```
Strategy A beats B, B beats C, C beats A
No single choice dominates
```

### Diminishing Returns
```solidity
// Linear rewards plateau
function getReward(uint256 score) public pure returns (uint256) {
  if (score <= 100) return score * 10;
  if (score <= 500) return 1000 + (score - 100) * 5;
  return 3000 + (score - 500) * 2; // Diminishing
}
```

### Counter-Play Windows
- Every powerful action has a counter-window
- Telegraphed attacks can be dodged/blocked
- Resource commitment creates vulnerability

## Red Flags to Detect
- [ ] One strategy wins >70% regardless of opponent choice
- [ ] Optimal play is "do nothing and wait"
- [ ] First-mover always wins (or always loses)
- [ ] Grinding trivial actions beats skilled play
- [ ] Wealthy players auto-win (pure pay-to-win)

## Required in GameSpec
```json
{
  "mechanics": {
    "strategies": ["aggressive", "defensive", "balanced"],
    "counters": {
      "aggressive": "defensive",
      "defensive": "balanced", 
      "balanced": "aggressive"
    },
    "skillFactors": ["timing", "prediction", "resource_management"]
  }
}
```

## Implementation
- Playtest with simulated bots using different strategies
- Track win rates per strategy type
- Adjust rewards/costs until no strategy exceeds 60% win rate
