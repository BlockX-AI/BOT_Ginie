// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MyToken
 * @author Your Name
 * @dev An ERC20 token contract with minting and pausing controlled by an owner.
 *
 * This contract leverages OpenZeppelin's secure and audited implementations of
 * the ERC20 standard, Ownable access control, and Pausable patterns.
 *
 * The contract owner, set at deployment, is the only address authorized to
 * create new tokens by calling the `mint` function, and to pause or unpause
 * token transfers. When paused, all transfers (including minting) will be reverted.
 */
contract MyToken is ERC20, Pausable, Ownable {

    /**
     * @dev Constructor that sets the name and symbol of the token, and the initial owner.
     * @param initialOwner The address that will be granted ownership of this contract.
     * The owner is responsible for minting new tokens and managing pausable state.
     */
    constructor(address initialOwner)
        ERC20("My Token", "MTK")
    {
        // The ERC20 constructor is called with the token's name and symbol.
        // The Ownable constructor sets the deployer as the initial owner.
        // We then transfer ownership to the specified initialOwner.
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Pauses all token transfers.
     * Can only be called by the owner.
     * See {Pausable-_pause}.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Resumes token transfers.
     * Can only be called by the owner.
     * See {Pausable-_unpause}.
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Creates `amount` new tokens and assigns them to the `to` address.
     *
     * This function can only be called by the contract's owner. A successful call
     * will increase the total supply of the token. This operation is subject to the
     * pausable mechanism; it will fail if the contract is paused.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     * - The caller must be the owner.
     * - `to` cannot be the zero address.
     * - The contract must not be paused.
     *
     * @param to The address that will receive the newly minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Hook that is called before any token transfer. This includes calls to {send},
     * {transfer}, {transferFrom}, minting, and burning.
     *
     * Overriding this function ensures that the pausable functionality works for all
     * token movements. This effectively replicates the behavior of ERC20Pausable.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function _update(address from, address to, uint256 value)
        internal
        override
        whenNotPaused
    {
        super._update(from, to, value);
    }
}
