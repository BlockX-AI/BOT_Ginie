// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DNT (Donation)
 * @author Your Name
 * @notice A secure and straightforward smart contract for collecting and managing donations.
 * @dev This contract uses OpenZeppelin's Ownable for access control to ensure only the
 * owner can withdraw funds. It also uses ReentrancyGuard as an extra layer of
 * security on the withdrawal function. All donations are tracked, and events are
 * emitted for off-chain monitoring.
 */
contract DNT is Ownable, ReentrancyGuard {

    // --- State Variables ---

    /**
     * @notice Total amount of Ether donated to the contract, in wei.
     */
    uint256 public totalDonations;

    /**
     * @notice Mapping from a donor's address to the total amount they have donated.
     */
    mapping(address => uint256) public donations;

    /**
     * @notice An array of all unique donor addresses.
     * @dev This helps in easily retrieving a list of all contributors.
     */
    address[] public donors;


    // --- Events ---

    /**
     * @notice Emitted when a new donation is successfully received.
     * @param donor The address of the donor.
     * @param amount The amount of Ether donated in wei.
     */
    event DonationReceived(address indexed donor, uint256 amount);

    /**
     * @notice Emitted when the owner withdraws funds from the contract.
     * @param to The address receiving the withdrawn funds (the owner).
     * @param amount The amount of Ether withdrawn in wei.
     */
    event Withdrawal(address indexed to, uint256 amount);


    // --- Constructor ---

    /**
     * @notice Initializes the contract and sets the deployer as the initial owner.
     * @param initialOwner The address that will be designated as the contract owner.
     */
    constructor(address initialOwner) Ownable() {
        if (initialOwner != address(0)) {
            _transferOwnership(initialOwner);
        }
    }


    // --- Functions ---

    /**
     * @notice Fallback function to accept direct Ether transfers as donations.
     */
    receive() external payable {
        _processDonation();
    }

    /**
     * @notice Allows a user to donate Ether to the contract.
     * @dev This is the primary function for donations. It requires a non-zero value.
     */
    function donate() external payable {
        _processDonation();
    }

    /**
     * @notice Internal function to handle the logic for processing a donation.
     * @dev Updates state variables and emits a DonationReceived event.
     * Adds the donor to the `donors` array if it's their first time donating.
     */
    function _processDonation() private {
        require(msg.value > 0, "DNT: Donation amount must be greater than zero");

        // If this is the first donation from this address, add them to the donors list.
        if (donations[msg.sender] == 0) {
            donors.push(msg.sender);
        }

        // Update state
        donations[msg.sender] += msg.value;
        totalDonations += msg.value;

        emit DonationReceived(msg.sender, msg.value);
    }

    /**
     * @notice Allows the owner to withdraw the entire balance of the contract.
     * @dev This function is protected by the `onlyOwner` and `nonReentrant` modifiers.
     * It follows the Checks-Effects-Interactions pattern for security.
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        require(amount > 0, "DNT: No funds available for withdrawal");

        // The recommended way to send Ether.
        (bool success, ) = owner().call{value: amount}("");
        require(success, "DNT: Ether transfer failed");

        emit Withdrawal(owner(), amount);
    }


    // --- View Functions ---

    /**
     * @notice Returns the list of all unique donor addresses.
     * @return An array of addresses representing all donors.
     */
    function getDonors() public view returns (address[] memory) {
        return donors;
    }

    /**
     * @notice Returns the total amount donated by a specific address.
     * @param donor The address of the donor to query.
     * @return The total donation amount in wei for the specified address.
     */
    function getDonationAmount(address donor) public view returns (uint256) {
        return donations[donor];
    }
    
    /**
     * @notice Returns the current Ether balance of the contract.
     * @return The contract's balance in wei.
     */
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
