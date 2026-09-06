pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title DonationCollection
 * @dev A contract for collecting donations in ETH or ERC20 tokens.
 *      Uses OpenZeppelin's Ownable for privileged operations.
 *      Uses OpenZeppelin's ReentrancyGuard to prevent reentrancy attacks.
 *      Uses OpenZeppelin's SafeMath for safe arithmetic operations.
 */
contract DonationCollection is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Event emitted when a donation is received.
    event DonationReceived(address indexed donor, address indexed token, uint256 amount);

    // Event emitted when ETH is withdrawn.
    event ETHWithdrawn(address indexed recipient, uint256 amount);

    // Event emitted when ERC20 tokens are withdrawn.
    event TokenWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    /**
     * @dev Fallback function to allow the contract to receive ETH.
     */
    receive() external payable {
        emit DonationReceived(msg.sender, address(0), msg.value);
    }

    /**
     * @dev Donate ETH to the contract.
     */
    function donateETH() external payable {
        require(msg.value > 0, "Donation amount must be greater than 0");
        emit DonationReceived(msg.sender, address(0), msg.value);
    }


    /**
     * @dev Donate ERC20 tokens to the contract.
     * @param _token Address of the ERC20 token.
     * @param _amount Amount of tokens to donate.
     */
    function donateToken(address _token, uint256 _amount) external {
        require(_token != address(0), "Token address cannot be zero");
        require(_amount > 0, "Donation amount must be greater than 0");

        IERC20 token = IERC20(_token);
        require(token.transferFrom(msg.sender, address(this), _amount), "Token transfer failed");

        emit DonationReceived(msg.sender, _token, _amount);
    }

    /**
     * @dev Withdraw ETH from the contract.  Only callable by the owner.
     * @param _amount Amount of ETH to withdraw.
     */
    function withdrawETH(uint256 _amount) external onlyOwner nonReentrant {
        require(_amount > 0, "Withdrawal amount must be greater than 0");
        require(address(this).balance >= _amount, "Insufficient ETH balance");

        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "ETH transfer failed");

        emit ETHWithdrawn(owner(), _amount);
    }

    /**
     * @dev Withdraw ERC20 tokens from the contract. Only callable by the owner.
     * @param _token Address of the ERC20 token.
     * @param _amount Amount of tokens to withdraw.
     */
    function withdrawToken(address _token, uint256 _amount) external onlyOwner nonReentrant {
        require(_token != address(0), "Token address cannot be zero");
        require(_amount > 0, "Withdrawal amount must be greater than 0");

        IERC20 token = IERC20(_token);
        uint256 contractBalance = token.balanceOf(address(this));
        require(contractBalance >= _amount, "Insufficient token balance");

        require(token.transfer(owner(), _amount), "Token transfer failed");

        emit TokenWithdrawn(_token, owner(), _amount);
    }

    /**
     * @dev Get the ETH balance of the contract.
     * @return The ETH balance.
     */
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Get the ERC20 token balance of the contract.
     * @param _token Address of the ERC20 token.
     * @return The token balance.
     */
    function getTokenBalance(address _token) external view returns (uint256) {
        IERC20 token = IERC20(_token);
        return token.balanceOf(address(this));
    }
}
