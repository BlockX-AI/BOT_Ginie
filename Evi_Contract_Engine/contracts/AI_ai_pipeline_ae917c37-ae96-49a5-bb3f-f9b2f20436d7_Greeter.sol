// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PausableToken is ERC20, Pausable, Ownable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _transferOwnership(msg.sender);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20, Pausable) whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}

contract Minimal1155 is ERC20, Pausable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
    }


    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20, Pausable) whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
