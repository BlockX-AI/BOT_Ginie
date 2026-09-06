Hard rules:
- Never include secrets (private keys, API keys).
- Avoid backdoors and hidden privileged behaviors.
- Prefer bounded loops and gas-safe patterns.
- For any rewards/claims, prefer replay-protected signatures where applicable.

## Security Essentials (MANDATORY)
1. **ReentrancyGuard**: Import and use for ALL functions that transfer ETH/tokens
2. **CEI Pattern**: Always Checks → Effects → Interactions (update state BEFORE external calls)
3. **Input Validation**: Check non-zero addresses, array bounds, valid ranges
4. **No tx.origin**: Always use msg.sender for authorization
5. **Check Return Values**: Always verify success of low-level calls

## Non-Custodial Fund Management (CRITICAL)
1. **Pull-Over-Push**: Never push funds to users; let them withdraw
2. **Isolated Funds**: Separate funds per user/match, no shared pools
3. **No Multi-Send Loops**: Never loop to send funds to multiple users
4. **Withdrawal Pattern**: Use `pendingWithdrawals` mapping + `withdraw()` function

## Gas Safety
1. **Bounded Loops**: Always cap loop iterations with explicit limits
2. **Storage Caching**: Read storage once, cache in memory, use cached value
3. **Custom Errors**: Use `error X(); revert X();` instead of require strings
4. **Unchecked Math**: Use `unchecked { ++i; }` for safe loop counters
