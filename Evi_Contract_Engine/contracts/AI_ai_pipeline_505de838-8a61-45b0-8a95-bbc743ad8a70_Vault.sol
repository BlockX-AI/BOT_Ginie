// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Vault
 * @author Your Name
 * @notice A secure, pausable contract that allows users to deposit and withdraw Ether.
 * @dev This contract uses OpenZeppelin's ReentrancyGuard and follows the
 * Checks-Effects-Interactions pattern to mitigate reentrancy risks.
 * The owner can pause and unpause deposits and withdrawals.
 */
contract Vault is Ownable, ReentrancyGuard, Pausable {
    // --- State Variables ---

    /**
     * @notice Mapping from user address to their balance in Wei.
     */
    mapping(address => uint256) public balances;

    // --- Events ---

    /**
     * @notice Emitted when a user deposits Ether into the vault.
     * @param user The address of the depositor.
     * @param amount The amount deposited in Wei.
     */
    event Deposited(address indexed user, uint256 amount);

    /**
     * @notice Emitted when a user withdraws Ether from the vault.
     * @param user The address of the withdrawer.
     * @param amount The amount withdrawn in Wei.
     */
    event Withdrawn(address indexed user, uint256 amount);

    // --- Functions ---

    /**
     * @notice Allows a user to deposit Ether into the vault.
     * @dev The amount is determined by the value sent with the transaction (msg.value).
     * The function will revert if the deposit amount is zero or if the contract is paused.
     */
    function deposit() external payable whenNotPaused {
        // Check: Ensure that some Ether is being sent.
        require(msg.value > 0, "Vault: Deposit amount must be greater than zero.");

        // Effect: Update the sender's balance.
        // This is safe from reentrancy as there are no external calls.
        balances[msg.sender] += msg.value;

        // Emit an event to log the deposit.
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Allows a user to withdraw a specified amount of their deposited Ether.
     * @dev This function is protected against reentrancy attacks by the `nonReentrant`
     * modifier and by strictly following the Checks-Effects-Interactions pattern.
     * The function will revert if the contract is paused.
     * @param _amount The amount of Ether (in Wei) to withdraw.
     */
    function withdraw(uint256 _amount) external nonReentrant whenNotPaused {
        // --- Checks ---
        // 1. Ensure the withdrawal amount is not zero.
        require(_amount > 0, "Vault: Withdrawal amount must be greater than zero.");

        // 2. Load the user's balance from storage into memory.
        uint256 userBalance = balances[msg.sender];

        // 3. Check if the user has sufficient funds for the withdrawal.
        require(userBalance >= _amount, "Vault: Insufficient balance.");

        // --- Effects ---
        // 4. Update the user's balance *before* the external call. This is the
        // core principle of the Checks-Effects-Interactions pattern and is the
        // primary defense against reentrancy.
        balances[msg.sender] = userBalance - _amount;
        
        // --- Interaction ---
        // 5. Send the Ether to the user. Use .call() as it's the recommended
        // safe way to transfer Ether. It forwards all available gas and is not
        // vulnerable to changes in gas costs like .transfer() or .send().
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Vault: Ether transfer failed.");

        // Emit an event to log the withdrawal.
        emit Withdrawn(msg.sender, _amount);
    }

    /**
     * @notice A view function to get the total Ether balance of the contract.
     * @return The total balance of this contract in Wei.
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Pauses the contract. Only the owner can call this.
     * @dev When paused, `deposit` and `withdraw` will be disabled.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract. Only the owner can call this.
     */
    function unpause() public onlyOwner {
        _unpause();
    }
}
