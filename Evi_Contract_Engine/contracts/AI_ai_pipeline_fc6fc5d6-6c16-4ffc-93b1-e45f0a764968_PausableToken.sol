pragma solidity ^0.8.0;

// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PausableToken
 * @dev ERC20 token with pausable token transfers, minting, and burning.
 *  Inherits from ERC20, Ownable, and Pausable.
 */
contract PausableToken is ERC20, Ownable, Pausable {
    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * The default value of {decimals} is 18. To select a different value for
     * {decimals} you should overload it.
     *
     * All three of these values are immutable: they can only be set once during
     * construction.
     *
     * @param name The name of the token.
     * @param symbol The symbol of the token.
     */
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    /**
     * @dev Modifier to make a function callable only when the contract is not paused.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    modifier whenNotPaused() override virtual {
        require(!paused(), "Pausable: paused");
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is paused.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    modifier whenPaused() override virtual {
        require(paused(), "Pausable: not paused");
        _;
    }


    /**
     * @dev See {ERC20-_beforeTokenTransfer}.
     *
     * Requirements:
     *
     * - the contract must not be paused.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20, IPausable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev Pause the token.
     *
     * Requirements:
     *
     * - The caller must be the owner.
     */
    function pause() public onlyOwner whenNotPaused {
        _pause();
    }

    /**
     * @dev Unpause the token.
     *
     * Requirements:
     *
     * - The caller must be the owner.
     */
    function unpause() public onlyOwner whenPaused {
        _unpause();
    }

    /**
     * @dev Mint new tokens for an address.
     *
     * Requirements:
     *
     * - The caller must be the owner.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens from an address.
     *
     * Requirements:
     *
     * - The caller must be the owner.
     */
    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
    }
}

interface IPausable {
    function paused() external view returns (bool);
}
