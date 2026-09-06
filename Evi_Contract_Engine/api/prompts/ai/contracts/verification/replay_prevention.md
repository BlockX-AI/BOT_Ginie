# Replay Prevention

Nonce strategies per game type.

## The Problem
Without replay protection, valid signatures/actions can be reused.

## Solution Patterns

### Pattern 1: Sequential Nonce
```solidity
// One action at a time, strictly ordered
mapping(address => uint256) public nonces;

function executeAction(bytes calldata data, bytes calldata signature) external {
  uint256 nonce = nonces[msg.sender];
  bytes32 hash = keccak256(abi.encodePacked(data, nonce, address(this), block.chainid));
  
  require(_verifySignature(hash, signature, msg.sender), "Invalid sig");
  
  nonces[msg.sender] = nonce + 1;
  _process(data);
}
```

### Pattern 2: Bitmap Nonce (Parallel Actions)
```solidity
// Allow out-of-order execution within a window
mapping(address => mapping(uint256 => uint256)) public usedNonces;

function isNonceUsed(address user, uint256 nonce) public view returns (bool) {
  uint256 wordIndex = nonce / 256;
  uint256 bitIndex = nonce % 256;
  return (usedNonces[user][wordIndex] >> bitIndex) & 1 == 1;
}

function useNonce(address user, uint256 nonce) internal {
  require(!isNonceUsed(user, nonce), "Nonce used");
  uint256 wordIndex = nonce / 256;
  uint256 bitIndex = nonce % 256;
  usedNonces[user][wordIndex] |= (1 << bitIndex);
}

function executeWithNonce(uint256 nonce, bytes calldata data, bytes calldata sig) external {
  useNonce(msg.sender, nonce);
  // ... verify and process
}
```

### Pattern 3: Deadline-Based
```solidity
// Actions expire after deadline
function executeTimedAction(
  bytes calldata data,
  uint256 deadline,
  bytes calldata signature
) external {
  require(block.timestamp <= deadline, "Expired");
  
  bytes32 hash = keccak256(abi.encodePacked(data, deadline, address(this)));
  require(_verifySignature(hash, signature, msg.sender), "Invalid sig");
  require(!usedHashes[hash], "Already used");
  
  usedHashes[hash] = true;
  _process(data);
}
```

### Pattern 4: Game-Scoped Nonce
```solidity
// Nonce per game session
mapping(uint256 => mapping(address => uint256)) public gameNonces;

function makeMove(uint256 gameId, uint8 move, uint256 nonce, bytes calldata sig) external {
  require(nonce == gameNonces[gameId][msg.sender], "Invalid nonce");
  
  bytes32 hash = keccak256(abi.encodePacked(gameId, move, nonce, msg.sender));
  require(_verifySignature(hash, sig, msg.sender), "Invalid sig");
  
  gameNonces[gameId][msg.sender]++;
  _processMove(gameId, msg.sender, move);
}
```

## EIP-712 Typed Signatures
```solidity
bytes32 public constant DOMAIN_TYPEHASH = keccak256(
  "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

bytes32 public constant MOVE_TYPEHASH = keccak256(
  "Move(uint256 gameId,uint8 moveType,uint256 nonce,uint256 deadline)"
);

bytes32 public DOMAIN_SEPARATOR;

constructor() {
  DOMAIN_SEPARATOR = keccak256(abi.encode(
    DOMAIN_TYPEHASH,
    keccak256("GameContract"),
    keccak256("1"),
    block.chainid,
    address(this)
  ));
}

function verifyMove(
  uint256 gameId,
  uint8 moveType,
  uint256 nonce,
  uint256 deadline,
  uint8 v, bytes32 r, bytes32 s
) public view returns (address) {
  bytes32 structHash = keccak256(abi.encode(
    MOVE_TYPEHASH, gameId, moveType, nonce, deadline
  ));
  bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
  return ecrecover(digest, v, r, s);
}
```

## Per-Game-Type Strategy

| Game Type | Nonce Strategy | Reason |
|-----------|----------------|--------|
| Turn-based | Sequential | Strict ordering matters |
| Real-time | Bitmap | Parallel moves allowed |
| Betting | Sequential + deadline | Order + expiry |
| Tournament | Game-scoped | Reset per match |

## Checklist
- [ ] Include `address(this)` in hash (prevent cross-contract replay)
- [ ] Include `block.chainid` in hash (prevent cross-chain replay)
- [ ] Include nonce or deadline (prevent same-contract replay)
- [ ] Include user address in hash (prevent impersonation)
- [ ] Mark nonce/hash as used BEFORE processing
- [ ] Validate signature recovery returns expected signer
