// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SecureSpinWheelQTDistributor
 * @dev Secure smart contract for distributing QT rewards with signature verification
 * @notice This contract fixes critical vulnerabilities in the original version
 * 
 * SECURITY IMPROVEMENTS:
 * - Signature verification prevents users from claiming amounts they didn't win
 * - Replay attack protection via nonce tracking
 * - Daily reward limits to prevent abuse
 * - Pausable for emergency stops
 * - OpenZeppelin battle-tested security patterns
 */
contract SecureSpinWheelQTDistributor is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    
    IERC20 public immutable qtToken;
    address public backendSigner;
    
    // Cooldown period (12 hours)
    uint256 public constant COOLDOWN_PERIOD = 12 hours;
    
    // Maximum reward limit per user per day (20,000 QT)
    uint256 public constant MAX_DAILY_REWARD = 20000 * 10**18;
    uint256 public constant DAILY_PERIOD = 1 days;
    
    // Track claim data
    mapping(address => uint256) public lastClaimTimestamp;
    mapping(address => uint256) public totalClaims;
    mapping(address => uint256) public totalRewardsClaimed;
    
    // Track daily limits (user => day => amount claimed)
    mapping(address => mapping(uint256 => uint256)) public dailyRewardsClaimed;
    
    // Prevent signature replay attacks (signature hash => used)
    mapping(bytes32 => bool) public usedSignatures;
    
    // Valid reward amounts (in wei with 18 decimals)
    mapping(uint256 => bool) public validRewardAmounts;
    
    // Events
    event QTRewardClaimed(
        address indexed user, 
        uint256 amount, 
        uint256 timestamp,
        bytes32 signatureHash
    );
    event QTTokensDeposited(uint256 amount, uint256 timestamp);
    event QTTokensWithdrawn(uint256 amount, uint256 timestamp);
    event BackendSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    
    constructor(
        address _qtTokenAddress,
        address _backendSigner
    ) Ownable(msg.sender) {
        require(_qtTokenAddress != address(0), "Invalid QT token address");
        require(_backendSigner != address(0), "Invalid backend signer address");
        
        qtToken = IERC20(_qtTokenAddress);
        backendSigner = _backendSigner;
        
        // Set valid reward amounts (in wei)
        validRewardAmounts[100 * 10**18] = true;
        validRewardAmounts[200 * 10**18] = true;
        validRewardAmounts[500 * 10**18] = true;
        validRewardAmounts[1000 * 10**18] = true;
        validRewardAmounts[2000 * 10**18] = true;
        validRewardAmounts[10000 * 10**18] = true;
    }
    
    /**
     * @dev Claim QT reward with backend signature verification
     * @param rewardAmount The amount won (with 18 decimals, in wei)
     * @param nonce Unique nonce to prevent replay attacks
     * @param deadline Signature expiration timestamp
     * @param signature Backend signature authorizing this claim
     */
    function claimSpinReward(
        uint256 rewardAmount,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature
    ) external nonReentrant whenNotPaused {
        // Validate timing
        require(block.timestamp <= deadline, "Signature expired");
        require(canClaim(msg.sender), "Cooldown period not passed");
        
        // Validate amount
        require(validRewardAmounts[rewardAmount], "Invalid reward amount");
        require(getQTBalance() >= rewardAmount, "Insufficient contract balance");
        
        // Check daily limit
        uint256 currentDay = block.timestamp / DAILY_PERIOD;
        require(
            dailyRewardsClaimed[msg.sender][currentDay] + rewardAmount <= MAX_DAILY_REWARD,
            "Daily reward limit exceeded"
        );
        
        // Create message hash (must match backend exactly)
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                rewardAmount,
                nonce,
                deadline,
                address(this),
                block.chainid
            )
        );
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        
        // Verify signature hasn't been used
        require(!usedSignatures[ethSignedMessageHash], "Signature already used");
        
        // Verify signature
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        require(recoveredSigner == backendSigner, "Invalid signature");
        
        // Mark signature as used (prevent replay)
        usedSignatures[ethSignedMessageHash] = true;
        
        // Update state
        lastClaimTimestamp[msg.sender] = block.timestamp;
        totalClaims[msg.sender]++;
        totalRewardsClaimed[msg.sender] += rewardAmount;
        dailyRewardsClaimed[msg.sender][currentDay] += rewardAmount;
        
        // Transfer tokens
        qtToken.safeTransfer(msg.sender, rewardAmount);
        
        emit QTRewardClaimed(msg.sender, rewardAmount, block.timestamp, ethSignedMessageHash);
    }
    
    /**
     * @dev Check if user can claim (cooldown check)
     */
    function canClaim(address user) public view returns (bool) {
        return block.timestamp >= lastClaimTimestamp[user] + COOLDOWN_PERIOD;
    }
    
    /**
     * @dev Get remaining cooldown time
     */
    function getRemainingCooldown(address user) public view returns (uint256) {
        if (canClaim(user)) {
            return 0;
        }
        return (lastClaimTimestamp[user] + COOLDOWN_PERIOD) - block.timestamp;
    }
    
    /**
     * @dev Get user's remaining daily limit
     */
    function getRemainingDailyLimit(address user) public view returns (uint256) {
        uint256 currentDay = block.timestamp / DAILY_PERIOD;
        uint256 claimed = dailyRewardsClaimed[user][currentDay];
        if (claimed >= MAX_DAILY_REWARD) {
            return 0;
        }
        return MAX_DAILY_REWARD - claimed;
    }
    
    /**
     * @dev Get user's claim status
     */
    function getUserClaimStatus(address user) external view returns (
        uint256 lastClaim,
        bool canClaimNow,
        uint256 remainingCooldown,
        uint256 totalUserClaims,
        uint256 totalRewards,
        uint256 remainingDailyLimit
    ) {
        return (
            lastClaimTimestamp[user],
            canClaim(user),
            getRemainingCooldown(user),
            totalClaims[user],
            totalRewardsClaimed[user],
            getRemainingDailyLimit(user)
        );
    }
    
    /**
     * @dev Update backend signer address (owner only)
     */
    function updateBackendSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Invalid signer address");
        emit BackendSignerUpdated(backendSigner, newSigner);
        backendSigner = newSigner;
    }
    
    /**
     * @dev Deposit QT tokens to contract (owner only)
     */
    function depositQTTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        qtToken.safeTransferFrom(msg.sender, address(this), amount);
        emit QTTokensDeposited(amount, block.timestamp);
    }
    
    /**
     * @dev Withdraw QT tokens from contract (owner only)
     */
    function withdrawQTTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= getQTBalance(), "Insufficient balance");
        qtToken.safeTransfer(msg.sender, amount);
        emit QTTokensWithdrawn(amount, block.timestamp);
    }
    
    /**
     * @dev Emergency withdraw any ERC20 token (owner only)
     */
    function emergencyWithdraw(address token) external onlyOwner {
        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");
        tokenContract.safeTransfer(msg.sender, balance);
        emit EmergencyWithdraw(token, balance);
    }
    
    /**
     * @dev Get contract's QT balance
     */
    function getQTBalance() public view returns (uint256) {
        return qtToken.balanceOf(address(this));
    }
    
    /**
     * @dev Get contract's QT balance (readable format)
     */
    function getQTBalanceReadable() public view returns (uint256) {
        return qtToken.balanceOf(address(this)) / 10**18;
    }
    
    /**
     * @dev Pause contract (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}

