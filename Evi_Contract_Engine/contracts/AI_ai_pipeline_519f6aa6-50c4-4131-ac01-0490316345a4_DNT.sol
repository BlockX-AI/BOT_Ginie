pragma solidity ^0.8.0;

// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IERC20Interface {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract DNT is ERC20, Ownable, ReentrancyGuard {
    uint256 public donationGoal;
    uint256 public donationDeadline;
    uint256 public totalDonations;
    bool public goalReached;
    bool public deadlineReached;

    event DonationReceived(address donor, uint256 amount);
    event GoalReached(uint256 total);
    event DeadlineReached(uint256 total);
    event Withdrawal(address recipient, uint256 amount);

    constructor(string memory _name, string memory _symbol, uint256 _donationGoal, uint256 _donationDeadline) ERC20(_name, _symbol) {
        donationGoal = _donationGoal;
        donationDeadline = _donationDeadline;
        _mint(msg.sender, 1000000 * (10 ** decimals())); // Mint initial tokens to the owner (1,000,000) - For demo purposes.
    }


    modifier notReachedGoal() {
        require(!goalReached, "Goal has already been reached.");
        _;
    }

    modifier notReachedDeadline() {
        require(!deadlineReached, "Deadline has already passed.");
        _;
    }

    function donate() public payable notReachedGoal notReachedDeadline nonReentrant {
        require(block.timestamp <= donationDeadline, "Deadline has passed.");
        require(msg.value > 0, "Donation amount must be greater than zero.");

        totalDonations += msg.value;
        emit DonationReceived(msg.sender, msg.value);

        if (totalDonations >= donationGoal) {
            goalReached = true;
            emit GoalReached(totalDonations);
        }
    }

    function updateDonationGoal(uint256 _newGoal) external onlyOwner {
        require(_newGoal > totalDonations, "New goal must be greater than current donations.");
        donationGoal = _newGoal;
        goalReached = false; // Reset goalReached in case the goal is increased
    }


    function updateDonationDeadline(uint256 _newDeadline) external onlyOwner {
        require(_newDeadline > block.timestamp, "New deadline must be in the future.");
        donationDeadline = _newDeadline;
        deadlineReached = false; // Reset deadlineReached if deadline is extended
    }


    function reachDeadline() external onlyOwner {
        require(block.timestamp > donationDeadline, "Deadline has not yet passed.");
        deadlineReached = true;
        emit DeadlineReached(totalDonations);
    }


    function withdraw() external onlyOwner nonReentrant {
        require(goalReached || deadlineReached, "Goal must be reached or deadline passed to withdraw funds.");
        uint256 amount = address(this).balance;
        payable(owner()).transfer(amount);
        emit Withdrawal(owner(), amount);
    }


    function emergencyWithdrawERC20(address _tokenAddress, address _recipient) external onlyOwner nonReentrant {
        IERC20Interface token = IERC20Interface(_tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw.");
        token.transfer(_recipient, balance);
    }

    receive() external payable {
        donate();
    }

    fallback() external payable {
        donate();
    }
}
