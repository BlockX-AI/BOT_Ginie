pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MinimalERC20 is ERC20 {
    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * The default value of {decimals} is 18. To select a different value for
     * {decimals} you should overload it.
     *
     * All two of these values are immutable: they can only be set once during
     * construction.
     *
     *  @param name The name of the ERC20 token.
     *  @param symbol The symbol of the ERC20 token.
     */
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
}
