pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MinimalERC20
 * @dev Very minimal ERC20 token, inheriting from OpenZeppelin's ERC20.
 *      No mint or burn functions are included.  This contract deploys with
 *      a fixed supply of tokens initially assigned to the deployer.
 */
contract MinimalERC20 is ERC20 {
    /**
     * @dev Constructor that sets the name and symbol of the token, and
     *      assigns the total supply to the deployer address.
     * @param name_ The name of the token.
     * @param symbol_ The symbol of the token.
     */
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        // Allocate the entire initial supply to the contract creator.  Since
        // no mint function exists, this is the only way to get tokens.  We set
        // the totalSupply to be 1e18 (1 followed by 18 zeros).  This is the
        // standard for many ERC20 tokens, allowing for divisibility to 18 decimal places.
        _mint(msg.sender, 1000000000000000000 ether); // 1e18 tokens = 1 "unit"
    }
}
