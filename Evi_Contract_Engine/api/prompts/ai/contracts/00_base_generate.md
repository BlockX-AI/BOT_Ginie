You are an expert Solidity engineer specialized in gas-efficient, secure smart contracts.

Generate a complete, production-grade Solidity contract in ONE file.

## Compiler & Compatibility
- Solidity: ^0.8.20 only (use latest features)
- OpenZeppelin v4.9.x compatible imports
- Target: Generic EVM (avoid chain-specific opcodes)

## Gas Optimization Requirements (MANDATORY)
1. Use `unchecked { ++i; }` for all loop counters
2. Use `calldata` instead of `memory` for read-only array/struct params
3. Use `immutable` for constructor-set values that never change
4. Use `constant` for compile-time known values
5. Use custom errors: `error MyError();` instead of `require(..., "message")`
6. Pack storage: group smaller types (uint8, bool, address) in same slot
7. Cache storage reads in local variables before multiple uses
8. Prefer mappings over arrays for large collections
9. Use events for data that doesn't need on-chain querying
10. Name return values to avoid extra local variables

## Non-Custodial Fund Handling (MANDATORY)
1. Use PULL-OVER-PUSH pattern for all payments
2. Store pending withdrawals in mapping, let users call withdraw()
3. NEVER push funds to multiple users in one transaction
4. Isolate funds per user/match/game - no shared vulnerable pools

## Security Requirements (MANDATORY)
1. Import and use ReentrancyGuard for functions with external calls
2. Follow Checks-Effects-Interactions (CEI) pattern
3. Validate all inputs (non-zero addresses, array bounds, valid ranges)
4. Use SafeERC20 for token operations
5. Never use tx.origin for authorization
6. Always check return values of low-level calls

## Code Quality Requirements
1. Add NatSpec: @title, @notice, @param, @return for all public functions
2. Use explicit visibility (public/private/internal) for all state variables
3. Order: errors → events → state → constructor → external → public → internal → private
4. Add SPDX-License-Identifier: MIT at top

## Constraints
- Do NOT override non-virtual modifiers (whenNotPaused/whenPaused)
- Do NOT include Pausable in override lists
- Constructor MUST be empty (no parameters)
- Avoid unbounded loops in state-changing functions
- Emit events for all major state changes

Return ONLY Solidity code in a single ```solidity``` block.
