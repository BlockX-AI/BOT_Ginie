pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TestToken
 * @dev An ERC20 token with a fixed supply, ownership, and pausable functionality.
 */
contract TestToken is ERC20, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 1000000 * 10**18; // 1,000,000 tokens, with 18 decimals

    /**
     * @dev Constructor that mints the entire token supply to the contract owner.
     */
    constructor() ERC20("TestToken", "TEST") {
        _mint(msg.sender, MAX_SUPPLY);
    }

    /**
     * @dev Pause token transfers. Only the owner can call this function.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause token transfers. Only the owner can call this function.
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev See {ERC20-_beforeTokenTransfer}.
     *
     * Requirements:
     *
     * - the contract must not be paused.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @dev Mint new tokens.  This function can be overridden to allow minting only under certain conditions.
     *  In the current implementation, only the owner can mint tokens.
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens. This function can be overridden to allow burning only under certain conditions.
     *  In the current implementation, any address can burn its own tokens.
     * @param amount The amount of tokens to burn.
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Burn tokens from a specific account. Requires approval.
     * @param account The address to burn tokens from.
     * @param amount The amount of tokens to burn.
     */
    function burnFrom(address account, uint256 amount) public {
        allowance[account][msg.sender] -= amount;
        _burn(account, amount);
    }


    /**
     * @dev Atomically increases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        _approve(msg.sender, spender, allowance[msg.sender][spender] + addedValue);
        return true;
    }

    /**
     * @dev Atomically decreases the allowance granted to `spender` by the caller.
     *
     * This is an alternative to {approve} that can be used as a mitigation for
     * problems described in {IERC20-approve}.
     *
     * Emits an {Approval} event indicating the updated allowance.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     * - `spender` must have allowance for the caller of at least
     * `subtractedValue`.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        uint256 currentAllowance = allowance[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
        unchecked {
            _approve(msg.sender, spender, currentAllowance - subtractedValue);
        }

        return true;
    }

}
