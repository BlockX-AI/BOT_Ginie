// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract PausableToken is ERC20, Ownable, Pausable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    modifier whenNotPaused() override virtual {
        _;
    }

    modifier whenPaused() override virtual {
        require(paused(), "Pausable: not paused");
        _;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20, Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
