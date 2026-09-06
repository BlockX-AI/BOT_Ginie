pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestCoin is ERC20 {
    constructor() ERC20("TestCoin", "TST") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}
