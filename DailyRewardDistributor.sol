// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DailyRewardDistributor
 * @dev Smart contract for distributing QT tokens as daily rewards
 * @notice Users can claim 1,000 QT tokens once per day
 */
contract DailyRewardDistributor {
    using SafeERC20 for IERC20;
    
    // QT Token contract
    IERC20 public qtToken;
    
    // Owner of the contract
    address public owner;
    
    // Reward amount (1,000 QT tokens with 18 decimals)
    uint256 public constant REWARD_AMOUNT = 1000 * 10**18;
    
    // Track daily claims per user
    mapping(address => uint256) public lastClaimDate;
    
    // Events
    event QTRewardClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event QTTokensDeposited(uint256 amount, uint256 timestamp);
    event QTTokensWithdrawn(uint256 amount, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    modifier nonReentrant() {
        require(!_reentrancyGuard, "ReentrancyGuard: reentrant call");
        _reentrancyGuard = true;
        _;
        _reentrancyGuard = false;
    }
    
    bool private _reentrancyGuard;
    
    constructor(address _qtTokenAddress) {
        require(_qtTokenAddress != address(0), "Invalid QT token address");
        qtToken = IERC20(_qtTokenAddress);
        owner = msg.sender;
    }
    
    /**
     * @dev Check if user can claim today
     * @param user User address to check
     * @return canClaim True if user can claim today
     */
    function canClaimToday(address user) public view returns (bool) {
        uint256 today = block.timestamp / 86400; // Days since epoch
        return lastClaimDate[user] < today;
    }
    
    /**
     * @dev Claim QT token reward (once per day)
     */
    function claimQTReward() external nonReentrant {
        require(canClaimToday(msg.sender), "Already claimed today");
        require(getQTBalance() >= REWARD_AMOUNT, "Insufficient QT tokens in contract");
        
        // Update claim tracking
        uint256 today = block.timestamp / 86400;
        lastClaimDate[msg.sender] = today;
        
        // Transfer QT tokens to user using SafeERC20
        qtToken.safeTransfer(msg.sender, REWARD_AMOUNT);
        
        emit QTRewardClaimed(msg.sender, REWARD_AMOUNT, block.timestamp);
    }
    
    /**
     * @dev Claim QT reward for a specific user (owner only)
     * @param userAddress Address of the user to claim reward for
     */
    function claimQTRewardForUser(address userAddress) external onlyOwner nonReentrant {
        require(canClaimToday(userAddress), "User already claimed today");
        require(getQTBalance() >= REWARD_AMOUNT, "Insufficient QT tokens in contract");
        
        // Update claim tracking
        uint256 today = block.timestamp / 86400;
        lastClaimDate[userAddress] = today;
        
        // Transfer QT tokens to user using SafeERC20
        qtToken.safeTransfer(userAddress, REWARD_AMOUNT);
        
        emit QTRewardClaimed(userAddress, REWARD_AMOUNT, block.timestamp);
    }
    
    /**
     * @dev Deposit QT tokens to the contract (owner only)
     * @param amount Amount of QT tokens to deposit (with 18 decimals)
     */
    function depositQTTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        qtToken.safeTransferFrom(msg.sender, address(this), amount);
        emit QTTokensDeposited(amount, block.timestamp);
    }
    
    /**
     * @dev Withdraw QT tokens from the contract (owner only)
     * @param amount Amount of QT tokens to withdraw (with 18 decimals)
     */
    function withdrawQTTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        qtToken.safeTransfer(msg.sender, amount);
        emit QTTokensWithdrawn(amount, block.timestamp);
    }
    
    /**
     * @dev Get contract's QT token balance
     * @return balance Current QT token balance
     */
    function getQTBalance() public view returns (uint256) {
        return qtToken.balanceOf(address(this));
    }
    
    /**
     * @dev Get user's claim status
     * @param user User address
     * @return lastClaim Last claim date
     * @return canClaim Whether user can claim today
     */
    function getUserClaimStatus(address user) external view returns (uint256 lastClaim, bool canClaim) {
        return (lastClaimDate[user], canClaimToday(user));
    }
    
    /**
     * @dev Transfer ownership of the contract
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is the zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
}

