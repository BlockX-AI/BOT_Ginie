# Chainlink VRF Integration for Secure Randomness

CRITICAL: On-chain randomness using block.prevrandao/timestamp is INSECURE and exploitable by validators.

## When to Use VRF
- Betting/gambling games (dice, roulette, lottery)
- Random NFT minting (loot boxes, card packs)
- Random matchmaking or team assignment
- Any game where randomness affects value transfer

## VRF V2.5 Implementation Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract SecureRandomGame is VRFConsumerBaseV2Plus {
    // ═══════════════════════════════════════════════════════════════
    // VRF CONFIGURATION
    // ═══════════════════════════════════════════════════════════════
    
    // Avalanche Fuji Testnet values
    uint256 immutable subscriptionId;
    bytes32 constant KEY_HASH = 0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61;
    uint32 constant CALLBACK_GAS_LIMIT = 100000;
    uint16 constant REQUEST_CONFIRMATIONS = 3;
    uint32 constant NUM_WORDS = 1;
    
    // ═══════════════════════════════════════════════════════════════
    // GAME STATE
    // ═══════════════════════════════════════════════════════════════
    
    struct PendingGame {
        address player;
        uint256 betAmount;
        bool isHigh;
        bool fulfilled;
    }
    
    mapping(uint256 => PendingGame) public pendingGames; // requestId => game
    mapping(address => uint256) public pendingWithdrawals;
    
    event RandomnessRequested(uint256 indexed requestId, address indexed player);
    event GameResolved(uint256 indexed requestId, address indexed player, bool won, uint256 payout);
    
    error GameAlreadyFulfilled();
    error GameNotFound();
    
    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════
    
    constructor(
        address vrfCoordinator,
        uint256 _subscriptionId
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        subscriptionId = _subscriptionId;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // GAME LOGIC
    // ═══════════════════════════════════════════════════════════════
    
    /// @notice Place a bet - randomness will be delivered async
    function placeBet(bool isHigh) external payable returns (uint256 requestId) {
        require(msg.value >= 0.001 ether, "Min bet 0.001 ETH");
        
        // Request randomness from Chainlink
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: KEY_HASH,
                subId: subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );
        
        // Store pending game
        pendingGames[requestId] = PendingGame({
            player: msg.sender,
            betAmount: msg.value,
            isHigh: isHigh,
            fulfilled: false
        });
        
        emit RandomnessRequested(requestId, msg.sender);
    }
    
    /// @notice Callback from Chainlink VRF
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        PendingGame storage game = pendingGames[requestId];
        if (game.player == address(0)) revert GameNotFound();
        if (game.fulfilled) revert GameAlreadyFulfilled();
        
        game.fulfilled = true;
        
        // Use the random number
        uint8 diceResult = uint8((randomWords[0] % 6) + 1);
        bool won = (game.isHigh && diceResult >= 4) || (!game.isHigh && diceResult <= 3);
        
        uint256 payout = 0;
        if (won) {
            payout = game.betAmount * 2;
            pendingWithdrawals[game.player] += payout;
        }
        
        emit GameResolved(requestId, game.player, won, payout);
    }
}
```

## Network Configuration

| Network | VRF Coordinator | Subscription Dashboard |
|---------|-----------------|------------------------|
| Avalanche Fuji | `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE` | https://vrf.chain.link/fuji |
| Avalanche Mainnet | `0xE40895D055bccd2053DD0638C9695E326152b1A4` | https://vrf.chain.link/avalanche |
| Ethereum Sepolia | `0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B` | https://vrf.chain.link/sepolia |

## Fallback for Development/Testing

For testnets without VRF or local development, provide a fallback:

```solidity
bool public useVRF = true;
address public trustedOperator;

function resolveGameManually(uint256 requestId, uint256 randomSeed) 
    external 
    onlyRole(OPERATOR_ROLE) 
{
    require(!useVRF, "VRF enabled");
    // Use randomSeed to resolve game
    _resolveGame(requestId, randomSeed);
}
```

## Gas Considerations

| Operation | Approximate Gas |
|-----------|-----------------|
| Request randomness | ~100,000 |
| Callback (simple) | ~50,000-100,000 |
| Callback (complex) | ~100,000-300,000 |

**IMPORTANT**: Set `CALLBACK_GAS_LIMIT` high enough for your game logic, but not excessive (wastes LINK).

## Security Rules
1. NEVER use randomness in the same transaction it was generated
2. ALWAYS use commit-reveal or VRF for player choices
3. Store game state BEFORE requesting randomness
4. Handle edge case where VRF callback never arrives (timeout mechanism)
5. Validate that the callback is from the VRF Coordinator
