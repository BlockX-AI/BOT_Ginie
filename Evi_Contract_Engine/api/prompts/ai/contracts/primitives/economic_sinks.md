# Economic Sink Primitives

Token burn/stake patterns that maintain healthy game economy.

## Burn Mechanisms
```solidity
// Direct burn on action
function craftItem(uint256 tokenAmount) external {
  token.transferFrom(msg.sender, address(0), tokenAmount); // Burn
  _mintItem(msg.sender);
}

// Burn with tracking
uint256 public totalBurned;
function burnForBoost(uint256 amount) external {
  token.burn(msg.sender, amount);
  totalBurned += amount;
  emit TokensBurned(msg.sender, amount);
}
```

## Staking Sinks
```solidity
struct Stake {
  uint128 amount;
  uint64 lockUntil;
  uint64 lastClaim;
}

// Time-locked staking
function stake(uint128 amount, uint64 duration) external {
  require(duration >= MIN_LOCK && duration <= MAX_LOCK);
  token.transferFrom(msg.sender, address(this), amount);
  stakes[msg.sender] = Stake(amount, uint64(block.timestamp) + duration, uint64(block.timestamp));
}
```

## Sink Categories
1. **Entry fees**: Pay to play, burned or pooled
2. **Crafting costs**: Consume tokens for items
3. **Repair/maintenance**: Durability systems
4. **Cosmetic upgrades**: Non-gameplay token sinks
5. **Tournament entry**: Competitive stakes

## Implementation Rules
- **Transparent burn**: Use address(0) or ERC20 burn function
- **Stake visibility**: Always allow users to see locked amounts
- **Emergency withdraw**: Consider admin unlock for stuck funds
- **Rate limits**: Prevent flash-loan exploits on stake/unstake

## Required Functions
1. `burn(uint256 amount)` - Direct burn with event
2. `stake(uint256 amount, uint256 duration)` - Lock tokens
3. `unstake()` - Retrieve after lock expires
4. `getTotalSunk()` - View total removed from circulation

## Anti-Exploit
- Reentrancy guard on all token transfers
- Check allowance before transferFrom
- Validate duration bounds
- No instant stake/unstake (minimum lock)

## Gas Budget
- Burn: <50k gas
- Stake: <60k gas
- Unstake: <50k gas
