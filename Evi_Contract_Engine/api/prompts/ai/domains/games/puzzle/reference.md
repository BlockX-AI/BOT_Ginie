# Puzzle Game Reference Implementation

Annotated skeleton for match-3 / 2048 style games.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PuzzleGame is ReentrancyGuard {
  // ═══════════════════════════════════════════════════════════════
  // STATE: Fixed-size grid packed into minimal storage
  // ═══════════════════════════════════════════════════════════════
  
  uint8 public constant GRID_SIZE = 8;        // ✅ Bounded
  uint8 public constant NUM_PIECE_TYPES = 6;  // ✅ Limited variety
  
  struct Game {
    uint256 board;           // 64 cells × 4 bits = 256 bits ✅ 1 slot
    uint64 score;            // ✅ Bounded score
    uint32 movesLeft;        // ✅ Session finality
    uint32 startTime;
    address player;
    bool active;
  }
  
  mapping(uint256 => Game) public games;
  uint256 public gameCount;
  
  // ═══════════════════════════════════════════════════════════════
  // EVENTS: Log state changes for indexing
  // ═══════════════════════════════════════════════════════════════
  
  event GameCreated(uint256 indexed gameId, address indexed player);
  event MoveMade(uint256 indexed gameId, uint8 x1, uint8 y1, uint8 x2, uint8 y2, uint64 points);
  event GameEnded(uint256 indexed gameId, uint64 finalScore);
  
  // ═══════════════════════════════════════════════════════════════
  // GAME LIFECYCLE
  // ═══════════════════════════════════════════════════════════════
  
  function createGame() external returns (uint256 gameId) {
    gameId = gameCount++;
    
    // Initialize with deterministic seed
    uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, gameId)));
    uint256 board = _generateBoard(seed);
    
    games[gameId] = Game({
      board: board,
      score: 0,
      movesLeft: 30,           // ✅ Finite moves
      startTime: uint32(block.timestamp),
      player: msg.sender,
      active: true
    });
    
    emit GameCreated(gameId, msg.sender);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // MOVES: Client chooses WHAT, contract validates and calculates
  // ═══════════════════════════════════════════════════════════════
  
  function makeMove(uint256 gameId, uint8 x1, uint8 y1, uint8 x2, uint8 y2) external {
    Game storage g = games[gameId];
    
    // ✅ Validation: who, when, what
    require(g.player == msg.sender, "Not your game");
    require(g.active, "Game ended");
    require(g.movesLeft > 0, "No moves left");
    require(_isValidSwap(x1, y1, x2, y2), "Invalid swap");
    
    // ✅ Effects: update state
    g.movesLeft--;
    
    // ✅ Contract calculates outcome (not client)
    uint64 points = _executeSwap(g, x1, y1, x2, y2);
    g.score += points;
    
    emit MoveMade(gameId, x1, y1, x2, y2, points);
    
    // ✅ Check end condition
    if (g.movesLeft == 0) {
      _endGame(gameId);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SCORING: Deterministic formula, no randomness
  // ═══════════════════════════════════════════════════════════════
  
  function _executeSwap(Game storage g, uint8 x1, uint8 y1, uint8 x2, uint8 y2) 
    internal returns (uint64 totalPoints) 
  {
    // Swap pieces
    uint8 piece1 = _getCell(g.board, x1, y1);
    uint8 piece2 = _getCell(g.board, x2, y2);
    g.board = _setCell(g.board, x1, y1, piece2);
    g.board = _setCell(g.board, x2, y2, piece1);
    
    // Check and clear matches (cascade loop)
    uint8 cascadeMultiplier = 1;
    uint8 maxCascades = 10; // ✅ Bounded loop
    
    for (uint8 c = 0; c < maxCascades; c++) {
      uint64 matchPoints = _findAndClearMatches(g);
      if (matchPoints == 0) break;
      
      totalPoints += matchPoints * cascadeMultiplier;
      cascadeMultiplier++;
      
      _applyGravity(g);
      _fillEmpty(g, uint256(keccak256(abi.encodePacked(g.board, c))));
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // INTERNAL: Grid operations (bitmap-optimized)
  // ═══════════════════════════════════════════════════════════════
  
  function _getCell(uint256 board, uint8 x, uint8 y) internal pure returns (uint8) {
    uint8 pos = (y * GRID_SIZE + x) * 4;
    return uint8((board >> pos) & 0xF);
  }
  
  function _setCell(uint256 board, uint8 x, uint8 y, uint8 val) internal pure returns (uint256) {
    uint8 pos = (y * GRID_SIZE + x) * 4;
    return (board & ~(uint256(0xF) << pos)) | (uint256(val) << pos);
  }
  
  function _isValidSwap(uint8 x1, uint8 y1, uint8 x2, uint8 y2) internal pure returns (bool) {
    if (x1 >= GRID_SIZE || y1 >= GRID_SIZE) return false;
    if (x2 >= GRID_SIZE || y2 >= GRID_SIZE) return false;
    uint8 dx = x1 > x2 ? x1 - x2 : x2 - x1;
    uint8 dy = y1 > y2 ? y1 - y2 : y2 - y1;
    return dx + dy == 1; // Adjacent only
  }
  
  function _generateBoard(uint256 seed) internal pure returns (uint256 board) {
    for (uint8 i = 0; i < 64; i++) {
      seed = uint256(keccak256(abi.encodePacked(seed, i)));
      uint8 piece = uint8((seed % NUM_PIECE_TYPES) + 1);
      board = _setCell(board, i % GRID_SIZE, i / GRID_SIZE, piece);
    }
  }
  
  function _findAndClearMatches(Game storage g) internal returns (uint64) {
    // Simplified: scan for 3+ matches, clear, return points
    // Real impl: check horizontal + vertical, mark, clear
    return 0; // Placeholder
  }
  
  function _applyGravity(Game storage g) internal {
    // Drop pieces to fill gaps
  }
  
  function _fillEmpty(Game storage g, uint256 seed) internal {
    // Fill empty cells with new pieces
  }
  
  function _endGame(uint256 gameId) internal {
    Game storage g = games[gameId];
    g.active = false;
    emit GameEnded(gameId, g.score);
    // Reward distribution would go here
  }
}
```

## Key Design Decisions Annotated
1. **Board as uint256** - All 64 cells in one storage slot
2. **Fixed move limit** - Guarantees game ends
3. **Cascade cap** - Prevents infinite loops
4. **Deterministic scoring** - Same board + move = same result
5. **Events for history** - Don't store move history on-chain
