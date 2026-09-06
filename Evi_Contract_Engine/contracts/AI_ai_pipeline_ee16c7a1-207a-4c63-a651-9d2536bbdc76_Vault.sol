pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    mapping(address => uint256) public balances;
    uint256 public totalDeposited;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    constructor(IERC20 _token) {
        token = _token;
    }

    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than zero");

        // Checks
        require(token.allowance(msg.sender, address(this)) >= _amount, "Allowance too low");

        // Effects
        balances[msg.sender] += _amount;
        totalDeposited += _amount;

        // Interactions
        token.safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _amount);
    }

    function withdraw(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be greater than zero");

        // Checks
        require(balances[msg.sender] >= _amount, "Insufficient balance");

        // Effects
        balances[msg.sender] -= _amount;
        totalDeposited -= _amount;

        // Interactions
        token.safeTransfer(msg.sender, _amount);

        emit Withdrawal(msg.sender, _amount);
    }

    function balanceOf(address _user) external view returns (uint256) {
        return balances[_user];
    }

    function getTotalDeposited() external view returns (uint256) {
        return totalDeposited;
    }
}
