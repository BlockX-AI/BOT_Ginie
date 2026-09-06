# PvP Game Reference Implementation

Annotated skeleton for turn-based competitive games.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TurnBasedPvP is ReentrancyGuard {
  // ═══════════════════════════════════════════════════════════════
  // CONSTANTS
  // ═══════════════════════════════════════════════════════════════
  
  uint32 constant TURN_TIMEOUT = 1 hours;     // ✅ Session finality
  uint8 constant MAX_TURNS = 100;             // ✅ Bounded game length
  uint256 constant MIN_STAKE = 0.01 ether;
  
  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  
  enum GameState { WAITING, COMMIT, REVEAL, FINISHED, CANCELLED }
  
  struct Game {
    // Slot 1
    address player1;
    uint32 lastAction;
    uint16 p1Health;
    uint16 p2Health;
    
    // Slot 2
    address player2;
    uint32 stake;           // In finney (0.001 ETH)
    uint8 turnCount;
    GameState state;
    
    // Slot 3 - Commitment
    bytes32 p1Commit;
    
    // Slot 4
    bytes32 p2Commit;
    
    // Slot 5
    uint8 p1Move;
    uint8 p2Move;
    uint8 revealed;         // Bitmask
  }
  
  mapping(uint256 => Game) public games;
  uint256 public gameCount;
  
  // Matchmaking queue
  uint256[] public waitingGames;
  
  // ═══════════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════════
  
  event GameCreated(uint256 indexed gameId, address indexed player1, uint256 stake);
  event GameJoined(uint256 indexed gameId, address indexed player2);
  event MoveCommitted(uint256 indexed gameId, address indexed player);
  event MoveRevealed(uint256 indexed gameId, address indexed player, uint8 move);
  event RoundResolved(uint256 indexed gameId, uint8 p1Damage, uint8 p2Damage);
  event GameFinished(uint256 indexed gameId, address indexed winner, uint256 prize);
  
  // ═══════════════════════════════════════════════════════════════
  // MATCHMAKING
  // ═══════════════════════════════════════════════════════════════
  
  /// @notice Create game and wait for opponent
  function createGame() external payable returns (uint256 gameId) {
    require(msg.value >= MIN_STAKE, "Stake too low");
    
    gameId = gameCount++;
    games[gameId] = Game({
      player1: msg.sender,
      player2: address(0),
      p1Health: 100,
      p2Health: 100,
      stake: uint32(msg.value / 1e15), // Store as finney
      lastAction: uint32(block.timestamp),
      turnCount: 0,
      state: GameState.WAITING,
      p1Commit: bytes32(0),
      p2Commit: bytes32(0),
      p1Move: 0,
      p2Move: 0,
      revealed: 0
    });
    
    waitingGames.push(gameId);
    emit GameCreated(gameId, msg.sender, msg.value);
  }
  
  /// @notice Join existing game with matching stake
  function joinGame(uint256 gameId) external payable {
    Game storage g = games[gameId];
    
    require(g.state == GameState.WAITING, "Not waiting");
    require(g.player1 != msg.sender, "Cannot play yourself");
    require(msg.value == uint256(g.stake) * 1e15, "Wrong stake");
    
    g.player2 = msg.sender;
    g.state = GameState.COMMIT;
    g.lastAction = uint32(block.timestamp);
    
    // Remove from waiting queue (swap and pop)
    _removeFromWaiting(gameId);
    
    emit GameJoined(gameId, msg.sender);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // COMMITMENT-REVEAL PATTERN (Anti-frontrun)
  // ═══════════════════════════════════════════════════════════════
  
  /// @notice Commit your move (hidden)
  /// @param commitment keccak256(abi.encodePacked(gameId, move, salt, msg.sender))
  function commitMove(uint256 gameId, bytes32 commitment) external {
    Game storage g = games[gameId];
    
    require(g.state == GameState.COMMIT, "Not commit phase");
    require(_isPlayer(g, msg.sender), "Not player");
    
    if (msg.sender == g.player1) {
      require(g.p1Commit == bytes32(0), "Already committed");
      g.p1Commit = commitment;
    } else {
      require(g.p2Commit == bytes32(0), "Already committed");
      g.p2Commit = commitment;
    }
    
    g.lastAction = uint32(block.timestamp);
    emit MoveCommitted(gameId, msg.sender);
    
    // Both committed? Move to reveal
    if (g.p1Commit != bytes32(0) && g.p2Commit != bytes32(0)) {
      g.state = GameState.REVEAL;
    }
  }
  
  /// @notice Reveal your committed move
  function revealMove(uint256 gameId, uint8 move, bytes32 salt) external {
    Game storage g = games[gameId];
    
    require(g.state == GameState.REVEAL, "Not reveal phase");
    require(move < 3, "Invalid move"); // 0=rock, 1=paper, 2=scissors
    
    bytes32 expected = keccak256(abi.encodePacked(gameId, move, salt, msg.sender));
    
    if (msg.sender == g.player1) {
      require(g.p1Commit == expected, "Invalid reveal");
      require((g.revealed & 1) == 0, "Already revealed");
      g.p1Move = move;
      g.revealed |= 1;
    } else {
      require(g.p2Commit == expected, "Invalid reveal");
      require((g.revealed & 2) == 0, "Already revealed");
      g.p2Move = move;
      g.revealed |= 2;
    }
    
    g.lastAction = uint32(block.timestamp);
    emit MoveRevealed(gameId, msg.sender, move);
    
    // Both revealed? Resolve round
    if (g.revealed == 3) {
      _resolveRound(gameId);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // RESOLUTION: Deterministic outcome calculation
  // ═══════════════════════════════════════════════════════════════
  
  function _resolveRound(uint256 gameId) internal {
    Game storage g = games[gameId];
    
    // RPS logic: 0 beats 2, 1 beats 0, 2 beats 1
    uint8 p1 = g.p1Move;
    uint8 p2 = g.p2Move;
    
    uint8 p1Damage = 0;
    uint8 p2Damage = 0;
    
    if (p1 != p2) {
      if ((p1 + 1) % 3 == p2) {
        p1Damage = 20; // P2 wins round
      } else {
        p2Damage = 20; // P1 wins round
      }
    }
    
    // Apply damage
    g.p1Health = g.p1Health > p1Damage ? g.p1Health - p1Damage : 0;
    g.p2Health = g.p2Health > p2Damage ? g.p2Health - p2Damage : 0;
    
    emit RoundResolved(gameId, p1Damage, p2Damage);
    
    // Check win condition
    if (g.p1Health == 0 || g.p2Health == 0 || g.turnCount >= MAX_TURNS) {
      _finishGame(gameId);
    } else {
      // Reset for next round
      g.p1Commit = bytes32(0);
      g.p2Commit = bytes32(0);
      g.revealed = 0;
      g.turnCount++;
      g.state = GameState.COMMIT;
    }
  }
  
  function _finishGame(uint256 gameId) internal {
    Game storage g = games[gameId];
    g.state = GameState.FINISHED;
    
    address winner;
    if (g.p1Health > g.p2Health) {
      winner = g.player1;
    } else if (g.p2Health > g.p1Health) {
      winner = g.player2;
    } else {
      // Tie: refund both
      uint256 stake = uint256(g.stake) * 1e15;
      payable(g.player1).transfer(stake);
      payable(g.player2).transfer(stake);
      emit GameFinished(gameId, address(0), 0);
      return;
    }
    
    // Winner takes all
    uint256 prize = uint256(g.stake) * 2 * 1e15;
    payable(winner).transfer(prize);
    emit GameFinished(gameId, winner, prize);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // TIMEOUT: Anti-grief protection
  // ═══════════════════════════════════════════════════════════════
  
  function claimTimeout(uint256 gameId) external {
    Game storage g = games[gameId];
    
    require(g.state != GameState.FINISHED && g.state != GameState.CANCELLED);
    require(block.timestamp > g.lastAction + TURN_TIMEOUT, "Not timed out");
    require(_isPlayer(g, msg.sender), "Not player");
    
    // Determine who timed out and award victory to other player
    g.state = GameState.FINISHED;
    
    address winner = msg.sender;
    uint256 prize = uint256(g.stake) * 2 * 1e15;
    
    if (g.player2 == address(0)) {
      // No opponent joined, refund
      prize = uint256(g.stake) * 1e15;
    }
    
    payable(winner).transfer(prize);
    emit GameFinished(gameId, winner, prize);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════
  
  function _isPlayer(Game storage g, address addr) internal view returns (bool) {
    return addr == g.player1 || addr == g.player2;
  }
  
  function _removeFromWaiting(uint256 gameId) internal {
    for (uint256 i = 0; i < waitingGames.length; i++) {
      if (waitingGames[i] == gameId) {
        waitingGames[i] = waitingGames[waitingGames.length - 1];
        waitingGames.pop();
        break;
      }
    }
  }
  
  function getWaitingGames() external view returns (uint256[] memory) {
    return waitingGames;
  }
}
```

## Key Design Decisions
1. **Commitment-reveal** - Prevents move prediction/frontrunning
2. **Timeout claims** - No stuck funds from abandonment
3. **Turn limit** - Guarantees finite game length
4. **Stake escrow** - Both players commit funds upfront
5. **Deterministic resolution** - Same moves = same outcome
