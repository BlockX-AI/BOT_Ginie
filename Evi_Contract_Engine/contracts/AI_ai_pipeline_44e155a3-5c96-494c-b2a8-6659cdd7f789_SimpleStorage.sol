// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MyPausableToken
 * @dev This contract is a corrected version based on a set of compiler errors.
 * The original code provided did not match the errors, so this version synthesizes
 * the features suggested by the errors (ERC20, Pausable, Ownable) and fixes them
 * according to OpenZeppelin v4.9.x and Solidity ^0.8.19 standards.
 *
 * Fixes applied:
 * 1. Replaced the incorrect override of `_update` with the `_beforeTokenTransfer` hook.
 * 2. Removed attempts to override non-virtual modifiers `whenNotPaused` and `whenPaused`.
 * 3. Corrected override specifiers, removing invalid contracts like `Pausable`.
 * 4. Ensured `override` is only used on functions that actually override a virtual function.
 */
contract MyPausableToken is ERC20, Ownable, Pausable {
    /**
     * @dev Sets the name and symbol of the token.
     * The deployer of the contract will be the owner.
     */
    constructor() ERC20("My Pausable Token", "MPT") {}

    /**
     * @dev Pauses all token transfers.
     * Can only be called by the owner.
     * See {Pausable-_pause}.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     * Can only be called by the owner.
     * See {Pausable-_unpause}.
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Creates `amount` tokens and assigns them to `to`, increasing
     * the total supply.
     * Can only be called by the owner.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev See {ERC20-_beforeTokenTransfer}.
     *
     * This hook ensures that token transfers are not possible when the contract is paused.
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
