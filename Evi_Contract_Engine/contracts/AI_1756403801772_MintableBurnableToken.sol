// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MintableBurnableToken
 * @dev ERC20 token with owner-only mint and standard burn/burnFrom (allowance-based).
 */
contract MintableBurnableToken is ERC20Burnable, Ownable {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /**
     * @dev Mint new tokens to `to`. Only owner.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}