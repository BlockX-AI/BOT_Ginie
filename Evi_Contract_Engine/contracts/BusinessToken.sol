// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BusinessToken
 * @dev Simple ERC20 token for demo purposes
 */
contract BusinessToken is ERC20Pausable, Ownable {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        address owner_
    ) ERC20(name_, symbol_) {
        require(owner_ != address(0), "owner zero");
        _transferOwnership(owner_);
        _mint(owner_, initialSupply);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
}
