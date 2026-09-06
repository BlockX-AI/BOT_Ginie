pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestToken
 * @dev A simple ERC20 token for testing purposes.  Inherits from OpenZeppelin's ERC20 and Ownable contracts.
 *      This contract demonstrates a basic ERC20 implementation with minting and burning capabilities,
 *      restricted to the contract owner.
 */
contract TestToken is ERC20, Ownable {
    /**
     * @dev The symbol of the token.
     */
    string public constant override symbol = "TTK";

    /**
     * @dev The number of decimals the token uses.
     */
    uint8 public constant override decimals = 18;

    /**
     * @dev The initial supply of the token.  Can be set during contract deployment.
     */
    uint256 private _initialSupply;

    /**
     * @dev Constructor that sets the name and symbol and initializes the initial supply to the deployer.
     * @param initialSupply_ The initial supply of tokens to mint to the deployer address.
     */
    constructor(uint256 initialSupply_) ERC20("TestToken", "TTK") {
        _initialSupply = initialSupply_;
        _mint(msg.sender, initialSupply_);
    }

    /**
     * @dev Mints new tokens to an address.  Only callable by the contract owner.
     * @param to The address to mint the tokens to.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burns tokens from the caller's address.
     * @param amount The amount of tokens to burn.
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Burns tokens from an address. Only callable by the contract owner.
     * @param account The address to burn the tokens from.
     * @param amount The amount of tokens to burn.
     */
    function burnFrom(address account, uint256 amount) public onlyOwner {
        _burn(account, amount);
    }

    /**
     * @dev Returns the initial supply set during contract creation.
     * @return The initial supply.
     */
    function getInitialSupply() public view returns (uint256) {
        return _initialSupply;
    }
}
