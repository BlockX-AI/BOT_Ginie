pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyToken
 * @dev A simple ERC20 token inheriting from OpenZeppelin's ERC20 and Ownable contracts.
 *      This contract provides basic token functionality with minting initial supply to the deployer.
 */
contract MyToken is ERC20, Ownable {
    /**
     * @dev The total initial supply of tokens minted to the deployer.
     */
    uint256 private constant INITIAL_SUPPLY = 1000000 * (10**18); // 1,000,000 tokens with 18 decimals.

    /**
     * @dev Constructor that mints the initial supply to the deployer's address.
     */
    constructor() ERC20("MyToken", "MTK") {
        // Mint the initial supply to the contract deployer.
        _mint(msg.sender, INITIAL_SUPPLY);

        // Transfer ownership to the deployer. This is redundant since Ownable is already owned by the deployer
        // but kept for explicitness if later the ownership needs to be changed.
        _transferOwnership(msg.sender);
    }

    /**
     * @dev Function to mint new tokens (only callable by the owner).
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Function to burn tokens (only callable by the owner).
     * @param from The address that will burn the tokens.
     * @param amount The amount of tokens to burn.
     */
    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
    }

    /**
     * @dev Function to transfer ownership to a new owner.
     * @param newOwner The address of the new owner.
     * Override internal function to include a check that the caller is the current owner
     * (security measure)
     */
    function _transferOwnership(address newOwner) internal virtual override onlyOwner {
        super._transferOwnership(newOwner);
    }

    /**
     * @dev See {IERC20-decimals}.
     * Override to return 18 decimals - Standard ERC20 format.
     */
    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    /**
     * @dev Destroys `amount` tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 amount) public virtual {
        _burn(msg.sender, amount);
    }

}
