# Energy System Primitives

Time-based resource regeneration for on-chain games.

## Core Pattern
```solidity
struct EnergyState {
  uint32 current;      // Current energy (packed)
  uint32 max;          // Max cap
  uint32 lastUpdate;   // block.timestamp when last updated
  uint16 regenRate;    // Energy per hour
}
```

## Implementation Rules
- **Lazy regeneration**: Calculate current energy on-read, not on-timer
- **Formula**: `current = min(max, stored + (now - lastUpdate) * regenRate / 3600)`
- **Gas optimization**: Pack into single uint256 slot
- **Overflow protection**: Use SafeCast or explicit bounds

## Required Functions
1. `getEnergy(address)` - View current (with lazy calc)
2. `spendEnergy(uint256 amount)` - Deduct with underflow check
3. `setRegenRate(uint16)` - Admin only, emit event

## Anti-Exploit
- Cap max energy to prevent infinite accumulation
- Minimum cooldown between actions using energy
- No retroactive energy grants (prevents manipulation)

## Gas Budget
- Read: <5k gas
- Spend: <25k gas (single SSTORE)
