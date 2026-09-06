# PvP Matchmaking Primitives

Fair pairing and commitment schemes for competitive games.

## Commitment-Reveal Pattern
```solidity
struct Match {
  address player1;
  address player2;
  bytes32 p1Commit;    // keccak256(move, salt)
  bytes32 p2Commit;
  uint8 p1Move;
  uint8 p2Move;
  uint32 deadline;
  MatchState state;    // OPEN/COMMITTED/REVEALED/RESOLVED
}
```

## Matchmaking Rules
- **Queue-based**: First-come-first-served for fairness
- **Rating brackets**: Optional ELO/MMR within ±100 range
- **Timeout protection**: Auto-forfeit if no action within deadline
- **Stake escrow**: Lock funds on match creation, not commit

## Required Functions
1. `joinQueue(uint256 stake)` - Enter matchmaking
2. `leaveQueue()` - Exit before matched
3. `commitMove(uint256 matchId, bytes32 commitment)` - Submit hidden move
4. `revealMove(uint256 matchId, uint8 move, bytes32 salt)` - Reveal and verify
5. `claimTimeout(uint256 matchId)` - Forfeit opponent who missed deadline

## Anti-Exploit
- **Front-run protection**: Commitment hides move until both commit
- **Replay prevention**: Include matchId + nonce in commitment hash
- **MEV resistance**: Random queue position or batch matching
- **Griefing mitigation**: Stake forfeit for no-shows

## Commitment Hash
```solidity
bytes32 commitment = keccak256(abi.encodePacked(matchId, move, salt, msg.sender));
```

## Gas Budget
- Join queue: <50k gas
- Commit: <30k gas
- Reveal + resolve: <80k gas
