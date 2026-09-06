// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MinimalFixedToken
 * @author Your Name
 * @dev A minimal, secure, and gas-efficient ERC20 token with a fixed supply.
 * This contract uses the battle-tested OpenZeppelin ERC20 implementation.
 * It is also pausable, meaning the owner can halt all token transfers.
 *
 * The entire token supply is minted to the deployer of the contract during
 * construction. There are no functions to mint or burn tokens after deployment,
 * making the total supply fixed.
 *
 * The standard ERC20 decimals value of 18 is used by default.
 */
contract MinimalFixedToken is ERC20Pausable, Ownable {
    /**
     * @dev Constructor that sets the token's name, symbol, and initial supply.
     * The full initial supply is assigned to the contract deployer (`msg.sender`).
     * The deployer also becomes the initial owner who can pause/unpause the contract.
     *
     * @param name_ The name of the token (e.g., "My Token").
     * @param symbol_ The symbol of the token (e.g., "MTK").
     * @param initialSupply_ The total amount of tokens to mint. This value should
     *                       include the token's decimals. For example, to create
     *                       1,000 tokens with 18 decimals, this value should be
     *                       `1000 * (10**18)`.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_
    ) ERC20(name_, symbol_) Ownable() {
        // The _mint function is internal and can only be called from within the
        // contract. Here, we call it once to create the initial supply.
        // The recipient of the initial supply is the contract deployer.
        _mint(msg.sender, initialSupply_);
    }

    /**
     * @dev Pauses all token transfers.
     *
     * See {Pausable-_pause}.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     * - The caller must be the owner.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     *
     * See {Pausable-_unpause}.
     *
     * Requirements:
     *
     * - The contract must be paused.
     * - The caller must be the owner.
     */
    function unpause() public onlyOwner {
        _unpause();
    }
}
