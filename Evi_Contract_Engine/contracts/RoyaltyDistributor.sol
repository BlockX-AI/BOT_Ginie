// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IOriginProtocol.sol";

/**
 * @title RoyaltyDistributor
 * @dev Handles royalty payments for cited papers
 * This contract manages royalty distribution, platform fees, and payment tracking.
 */
contract RoyaltyDistributor is Ownable, ReentrancyGuard {
    struct RoyaltyPayment {
        uint256 paymentId;      
        uint256 paperId;        
        address researcher;     
        uint256 amount;         
        uint256 timestamp;      
        address payer;          
        string reason;          
    }

    // Origin Protocol integration
    IOriginProtocol public originProtocol;
    
    // Platform fee percentage (basis points: 1% = 100)
    uint256 public platformFeePercentage = 500; // 5% default
    
    // Platform treasury address
    address public treasuryAddress;
    
    // Payment tracking
    mapping(address => uint256) public researcherBalances;
    mapping(uint256 => RoyaltyPayment) public payments;
    mapping(address => uint256[]) public researcherPayments;
    mapping(uint256 => uint256[]) public paperPayments;
    
    // Payment ID counter
    uint256 private nextPaymentId = 1;
    
    // Events
    event RoyaltyPaid(uint256 indexed paymentId, uint256 indexed paperId, address indexed researcher, uint256 amount, string reason);
    event RoyaltyWithdrawn(address indexed researcher, uint256 amount);
    event PlatformFeeUpdated(uint256 newFeePercentage);
    event TreasuryAddressUpdated(address newTreasuryAddress);

    /**
     * @dev Constructor initializes the contract
     * @param _originProtocol Address of the Origin Protocol contract
     */
    constructor(address _originProtocol) {
        require(_originProtocol != address(0), "Invalid Origin Protocol address");
        originProtocol = IOriginProtocol(_originProtocol);
        treasuryAddress = msg.sender; // Default to contract owner
    }

    /**
     * @dev Pay royalty for a paper citation or access
     * @param _paperId ID of the paper
     * @param _researcher Address of the researcher to pay
     * @param _reason Reason for the payment (e.g., "citation", "access")
     * @return paymentId ID of the created payment
     */
    function payRoyalty(
        uint256 _paperId,
        address _researcher,
        string memory _reason
    ) external payable nonReentrant returns (uint256) {
        require(msg.value > 0, "Payment amount must be greater than 0");
        require(_researcher != address(0), "Invalid researcher address");
        
        // Verify ownership via Origin Protocol
        bool isOwner = originProtocol.verifyOwnership(_paperId, _researcher);
        require(isOwner, "Researcher is not the paper owner");
        
        // Calculate platform fee
        uint256 platformFee = (msg.value * platformFeePercentage) / 10000;
        uint256 researcherPayment = msg.value - platformFee;
        
        // Update researcher balance
        researcherBalances[_researcher] += researcherPayment;
        
        // Transfer platform fee to treasury
        if (platformFee > 0 && treasuryAddress != address(0)) {
            (bool success, ) = treasuryAddress.call{value: platformFee}("");
            require(success, "Platform fee transfer failed");
        }
        
        // Create payment record
        uint256 paymentId = nextPaymentId++;
        payments[paymentId] = RoyaltyPayment({
            paymentId: paymentId,
            paperId: _paperId,
            researcher: _researcher,
            amount: researcherPayment,
            timestamp: block.timestamp,
            payer: msg.sender,
            reason: _reason
        });
        
        // Update mappings
        researcherPayments[_researcher].push(paymentId);
        paperPayments[_paperId].push(paymentId);
        
        // Record payment with Origin Protocol
        originProtocol.recordRoyaltyPayment(_paperId, _researcher, researcherPayment);
        
        emit RoyaltyPaid(paymentId, _paperId, _researcher, researcherPayment, _reason);
        
        return paymentId;
    }

    /**
     * @dev Withdraw accumulated royalties
     */
    function withdrawRoyalties() external nonReentrant {
        uint256 amount = researcherBalances[msg.sender];
        require(amount > 0, "No royalties to withdraw");
        
        // Reset balance before transfer
        researcherBalances[msg.sender] = 0;
        
        // Transfer royalties
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Royalty transfer failed");
        
        emit RoyaltyWithdrawn(msg.sender, amount);
    }

    /**
     * @dev Batch pay royalties to multiple researchers
     * @param _paperIds Array of paper IDs
     * @param _researchers Array of researcher addresses
     * @param _reasons Array of payment reasons
     * @param _amounts Array of payment amounts
     * @return Array of payment IDs
     */
    function batchPayRoyalties(
        uint256[] calldata _paperIds,
        address[] calldata _researchers,
        string[] calldata _reasons,
        uint256[] calldata _amounts
    ) external payable nonReentrant returns (uint256[] memory) {
        require(
            _paperIds.length == _researchers.length && 
            _researchers.length == _reasons.length && 
            _reasons.length == _amounts.length,
            "Arrays must have the same length"
        );
        
        uint256 totalAmount = 0;
        for (uint i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }
        
        require(msg.value == totalAmount, "Incorrect total amount sent");
        
        uint256[] memory paymentIds = new uint256[](_paperIds.length);
        
        for (uint i = 0; i < _paperIds.length; i++) {
            uint256 paperId = _paperIds[i];
            address researcher = _researchers[i];
            string memory reason = _reasons[i];
            uint256 amount = _amounts[i];
            
            require(amount > 0, "Payment amount must be greater than 0");
            require(researcher != address(0), "Invalid researcher address");
            
            // Verify ownership via Origin Protocol
            bool isOwner = originProtocol.verifyOwnership(paperId, researcher);
            require(isOwner, "Researcher is not the paper owner");
            
            // Calculate platform fee
            uint256 platformFee = (amount * platformFeePercentage) / 10000;
            uint256 researcherPayment = amount - platformFee;
            
            // Update researcher balance
            researcherBalances[researcher] += researcherPayment;
            
            // Transfer platform fee to treasury
            if (platformFee > 0 && treasuryAddress != address(0)) {
                (bool success, ) = treasuryAddress.call{value: platformFee}("");
                require(success, "Platform fee transfer failed");
            }
            
            // Create payment record
            uint256 paymentId = nextPaymentId++;
            payments[paymentId] = RoyaltyPayment({
                paymentId: paymentId,
                paperId: paperId,
                researcher: researcher,
                amount: researcherPayment,
                timestamp: block.timestamp,
                payer: msg.sender,
                reason: reason
            });
            
            // Update mappings
            researcherPayments[researcher].push(paymentId);
            paperPayments[paperId].push(paymentId);
            
            // Record payment with Origin Protocol
            originProtocol.recordRoyaltyPayment(paperId, researcher, researcherPayment);
            
            emit RoyaltyPaid(paymentId, paperId, researcher, researcherPayment, reason);
            
            paymentIds[i] = paymentId;
        }
        
        return paymentIds;
    }

    /**
     * @dev Update the platform fee percentage
     * @param _newFeePercentage New fee percentage in basis points (1% = 100)
     */
    function updatePlatformFee(uint256 _newFeePercentage) external onlyOwner {
        require(_newFeePercentage <= 3000, "Fee cannot exceed 30%");
        platformFeePercentage = _newFeePercentage;
        
        emit PlatformFeeUpdated(_newFeePercentage);
    }

    /**
     * @dev Update the treasury address
     * @param _newTreasuryAddress New treasury address
     */
    function updateTreasuryAddress(address _newTreasuryAddress) external onlyOwner {
        require(_newTreasuryAddress != address(0), "Invalid address");
        treasuryAddress = _newTreasuryAddress;
        
        emit TreasuryAddressUpdated(_newTreasuryAddress);
    }

    /**
     * @dev Get the balance of a researcher
     * @param _researcher Address of the researcher
     * @return Balance in wei
     */
    function getResearcherBalance(address _researcher) external view returns (uint256) {
        return researcherBalances[_researcher];
    }

    /**
     * @dev Get payment details
     * @param _paymentId ID of the payment
     * @return paperId ID of the paper
     * @return researcher Address of the researcher
     * @return amount Payment amount
     * @return timestamp Payment timestamp
     * @return payer Address of the payer
     * @return reason Reason for the payment
     */
    function getPaymentDetails(uint256 _paymentId) external view returns (
        uint256 paperId,
        address researcher,
        uint256 amount,
        uint256 timestamp,
        address payer,
        string memory reason
    ) {
        require(_paymentId > 0 && _paymentId < nextPaymentId, "Payment does not exist");
        RoyaltyPayment memory payment = payments[_paymentId];
        
        return (
            payment.paperId,
            payment.researcher,
            payment.amount,
            payment.timestamp,
            payment.payer,
            payment.reason
        );
    }

    /**
     * @dev Get all payments for a researcher
     * @param _researcher Address of the researcher
     * @return Array of payment IDs for the researcher
     */
    function getResearcherPayments(address _researcher) external view returns (uint256[] memory) {
        return researcherPayments[_researcher];
    }

    /**
     * @dev Get all payments for a paper
     * @param _paperId ID of the paper
     * @return Array of payment IDs for the paper
     */
    function getPaperPayments(uint256 _paperId) external view returns (uint256[] memory) {
        return paperPayments[_paperId];
    }

    /**
     * @dev Get total royalties paid for a paper
     * @param _paperId ID of the paper
     * @return Total amount paid in wei
     */
    function getTotalRoyaltiesForPaper(uint256 _paperId) external view returns (uint256) {
        uint256[] memory paymentIds = paperPayments[_paperId];
        uint256 total = 0;
        
        for (uint i = 0; i < paymentIds.length; i++) {
            total += payments[paymentIds[i]].amount;
        }
        
        return total;
    }
}
