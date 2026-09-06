# Game Balance Validator

Prompt for AI to check game mechanics for exploits before generating code.

## Validation Checklist

After generating GameSpec, validate against these exploit patterns:

### 1. Economic Exploits

**Infinite Money Glitch**
- [ ] All resource sources have limits or costs
- [ ] No circular loops: A→B→C→A with gain
- [ ] Reward caps prevent overflow
- [ ] Prestige/reset preserves intended curve

**Free Riding**
- [ ] Entry costs prevent spam accounts
- [ ] Rewards require verifiable action
- [ ] No passive earning without stake/commitment

**Arbitrage**
- [ ] Dynamic prices converge, not diverge
- [ ] No guaranteed profit from market mechanics
- [ ] Fees cover worst-case exploitation

### 2. Gameplay Exploits

**Dominant Strategy**
- [ ] Multiple viable strategies exist
- [ ] No single choice wins >60% regardless of opponent
- [ ] Skill expression matters (timing, prediction, adaptation)

**Stalling/Turtling**
- [ ] Passive play has opportunity cost
- [ ] Time limits force action
- [ ] Defensive strategies have counters

**First-Mover Advantage**
- [ ] Going first doesn't guarantee win
- [ ] Turn order rotates or is randomized
- [ ] Late-game comeback is possible

### 3. Technical Exploits

**Gas Griefing**
- [ ] No unbounded loops in user-callable functions
- [ ] Array operations have caps
- [ ] Batch operations limited

**Front-Running**
- [ ] Hidden information uses commitment scheme
- [ ] Order-dependent actions use time windows
- [ ] MEV extraction minimized

**Reentrancy**
- [ ] State updated before external calls
- [ ] nonReentrant on all value transfers
- [ ] No callback during state changes

### 4. Social Exploits

**Collusion**
- [ ] Multi-account cooperation detected or unprofitable
- [ ] Anonymous matchmaking for competitive
- [ ] Sybil resistance (stake, history, rate limits)

**Sandbagging**
- [ ] Rating/matchmaking manipulation punished
- [ ] Intentional losing has no benefit
- [ ] Smurfing (new account advantage) limited

## Validation Output Format

```json
{
  "validationResult": "PASS" | "WARN" | "FAIL",
  "issues": [
    {
      "category": "economic" | "gameplay" | "technical" | "social",
      "severity": "critical" | "high" | "medium" | "low",
      "description": "What's wrong",
      "exploit": "How it could be abused",
      "mitigation": "Suggested fix"
    }
  ],
  "recommendations": [
    "Additional suggestions for robustness"
  ]
}
```

## Example Validation

**Input GameSpec**: Simple betting game where users bet on coin flip

**Validation**:
```json
{
  "validationResult": "FAIL",
  "issues": [
    {
      "category": "technical",
      "severity": "critical",
      "description": "Randomness source not specified",
      "exploit": "Miners can manipulate block.timestamp to guarantee wins",
      "mitigation": "Use Chainlink VRF or commitment-reveal"
    },
    {
      "category": "economic",
      "severity": "high",
      "description": "No house edge specified",
      "exploit": "Contract drains if 50/50 odds with payouts",
      "mitigation": "Add 2-5% house edge or use player-vs-player model"
    }
  ],
  "recommendations": [
    "Add maximum bet limit to prevent whale manipulation",
    "Implement cool-down between bets per address",
    "Consider commitment scheme for bet timing"
  ]
}
```

## AI Instructions

1. Run validation AFTER GameSpec generation
2. FAIL blocks code generation until issues resolved
3. WARN proceeds but includes mitigations in generated code
4. PASS allows direct code generation
5. Always output validation JSON before code
