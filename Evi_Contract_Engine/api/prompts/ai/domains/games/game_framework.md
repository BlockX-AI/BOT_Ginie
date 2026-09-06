Domain module: On-chain games.

Before coding, decide:
- Game type: betting mini-game | turn-based PvP | leaderboard score | tournament
- Core loop: create/join -> play moves -> end -> payout/claim
- Win condition and tie handling
- Storage: keep minimal game state on-chain; use events for history
- Randomness: if outcome depends on randomness, do not rely on block.timestamp alone; note VRF for production
- Security: nonReentrant for payouts, checks-effects-interactions, validate turns, prevent replay/duplicate claims

Patterns:
- Use a state machine: WAITING/ACTIVE/FINISHED/CANCELLED
- Use pull-based rewards: claim() instead of pushing funds mid-game
- Use bounded loops only; prefer Top-N leaderboard or event indexing
