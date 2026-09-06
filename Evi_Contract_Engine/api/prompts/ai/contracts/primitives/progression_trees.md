# Progression Tree Primitives

Unlock mechanics without state bloat.

## Bitmap Unlocks Pattern
```solidity
// Pack 256 unlocks into single uint256
mapping(address => uint256) public unlockedNodes;

function isUnlocked(address player, uint8 nodeId) public view returns (bool) {
  return (unlockedNodes[player] >> nodeId) & 1 == 1;
}

function unlock(uint8 nodeId) internal {
  unlockedNodes[msg.sender] |= (1 << nodeId);
}
```

## Dependency Encoding
```solidity
// Store prerequisites as bitmask
mapping(uint8 => uint256) public nodePrereqs;

function canUnlock(address player, uint8 nodeId) public view returns (bool) {
  uint256 required = nodePrereqs[nodeId];
  uint256 owned = unlockedNodes[player];
  return (owned & required) == required; // All prereqs met
}
```

## Implementation Rules
- **Max 256 nodes** per tree (fits uint256)
- **Multiple trees**: Use mapping(uint8 treeId => mapping(address => uint256))
- **Cost storage**: Pack cost + nodeId into struct or use predictable formula
- **No arrays**: Avoid unbounded loops

## Required Functions
1. `getUnlockedNodes(address)` - Return bitmap
2. `unlockNode(uint8 nodeId)` - Check prereqs + cost, set bit
3. `getNodeCost(uint8 nodeId)` - View cost (formula-based preferred)
4. `resetProgress(address)` - Admin/special reset (optional)

## Anti-Exploit
- Validate nodeId < 256
- Prevent double-unlock (check before set)
- Immutable prereqs after game launch

## Gas Budget
- Check unlock: <3k gas
- Unlock node: <30k gas
- Full tree read: <5k gas
