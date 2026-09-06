pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract MintableBurnableToken is ERC20, Ownable, Pausable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) public onlyOwner whenNotPaused {
        _mint(to, amount);
    }

    function burn(uint256 amount) public onlyOwner whenNotPaused {
        _burn(_msgSender(), amount);
    }

    function burnFrom(address account, uint256 amount) public onlyOwner whenNotPaused {
        _burn(account, amount);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
