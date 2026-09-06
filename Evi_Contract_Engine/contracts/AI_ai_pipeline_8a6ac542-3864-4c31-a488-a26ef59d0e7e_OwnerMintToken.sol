pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MintableToken is ERC20, Ownable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    /**
     * @dev Mints `amount` tokens to `to`.
     *
     * Requirements:
     *
     * - the caller must be the owner.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
