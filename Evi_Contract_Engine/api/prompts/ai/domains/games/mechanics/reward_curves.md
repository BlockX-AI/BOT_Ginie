# Reward Curves

Proven formulas for game economies.

## Curve Types

### 1. Linear
```solidity
// Simple, predictable
function linearReward(uint256 score) public pure returns (uint256) {
  return score * REWARD_PER_POINT;
}
```
**Use when**: Fair distribution, skill-based games
**Risk**: Unbounded top-end rewards

### 2. Logarithmic (Diminishing Returns)
```solidity
// Rewards slow down at high scores
function logReward(uint256 score) public pure returns (uint256) {
  if (score == 0) return 0;
  // log2 approximation: count leading zeros
  uint256 log = 0;
  uint256 temp = score;
  while (temp > 1) { temp >>= 1; log++; }
  return BASE_REWARD * log;
}
```
**Use when**: Prevent runaway leaders, encourage participation
**Risk**: May discourage high-skill grind

### 3. Exponential (High Risk/Reward)
```solidity
// Rewards accelerate - winner takes more
function expReward(uint256 streak) public pure returns (uint256) {
  require(streak <= 10, "Max streak"); // CAP IT
  return BASE_REWARD * (2 ** streak);
}
```
**Use when**: Tournament finals, high-stakes modes
**Risk**: Wealth concentration, must have caps

### 4. Tiered/Bracket
```solidity
function tieredReward(uint256 score) public pure returns (uint256) {
  if (score >= 1000) return GOLD_REWARD;
  if (score >= 500) return SILVER_REWARD;
  if (score >= 100) return BRONZE_REWARD;
  return PARTICIPATION_REWARD;
}
```
**Use when**: Clear goals, seasonal rankings
**Risk**: Cliff effects at boundaries

### 5. Bonding Curve (Dynamic Pricing)
```solidity
// Price increases with supply
function getBuyPrice(uint256 currentSupply) public pure returns (uint256) {
  return BASE_PRICE + (currentSupply * SLOPE);
}
```
**Use when**: Limited items, auction mechanics
**Risk**: Early adopter advantage

## Selection Matrix

| Game Type | Recommended Curve | Reason |
|-----------|-------------------|--------|
| Casual puzzle | Logarithmic | Encourage all players |
| Competitive PvP | Linear + cap | Skill matters, bounded |
| Tournament | Tiered | Clear prize structure |
| Idle/clicker | Exponential (capped) | Progression feel |
| Economy sim | Bonding curve | Market dynamics |

## Required Parameters
```json
{
  "economics": {
    "rewardCurve": "logarithmic",
    "baseReward": 100,
    "maxReward": 10000,
    "curveParams": {
      "diminishingFactor": 0.9
    }
  }
}
```

## Anti-Exploit
- ALWAYS cap maximum rewards
- Rate-limit reward claims
- Track total distributed vs budget
- Emergency pause if anomaly detected
