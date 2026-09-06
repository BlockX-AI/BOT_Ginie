pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Pipelinex is ERC20, Ownable {
    constructor() ERC20("Pipelinex", "PPLX") {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        _burn(_msgSender(), amount);
    }

    function burnFrom(address account, uint256 amount) public {
        require(allowance(account, _msgSender()) >= amount, "ERC20: insufficient allowance");
        _spendAllowance(account, _msgSender(), amount);
        _burn(account, amount);
    }
}
