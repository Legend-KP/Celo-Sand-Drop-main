// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title QuizTriviaEntry
 * @dev Smart contract for Quiz Trivia with micro transaction entry fees
 * @notice Users pay small fees to start quizzes - maintains revenue while providing Web3 experience
 */
contract QuizTriviaEntry {
    // Events
    event QuizStarted(
        address indexed user,
        uint256 indexed mode,
        uint256 timestamp,
        uint256 feePaid
    );
    
    event QuizCompleted(
        address indexed user,
        uint256 indexed mode,
        uint256 score,
        uint256 timestamp
    );
    
    // Quiz modes
    enum QuizMode {
        CLASSIC,    // 0
        TIME_MODE,  // 1
        CHALLENGE   // 2
    }
    
    // Owner
    address public owner;
    
    // Entry fees (in wei)
    uint256 public constant CLASSIC_FEE = 0.000000 ether;      // ~$0.0000001
    uint256 public constant TIME_MODE_FEE = 0.000000 ether;   // ~$0.0000001
    uint256 public constant CHALLENGE_FEE = 0.000000 ether;    // ~$0.0000001
    
    // Quiz statistics
    mapping(address => uint256) public userQuizCount;
    mapping(QuizMode => uint256) public modeCount;
    uint256 public totalQuizzes;
    uint256 public totalFeesCollected;
    
    // Modifier
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Start a quiz by paying the entry fee
     * @param mode The quiz mode (0=Classic, 1=Time, 2=Challenge)
     */
    function startQuiz(QuizMode mode) external payable {
        require(mode <= QuizMode.CHALLENGE, "Invalid mode");
        
        uint256 requiredFee = getRequiredFee(mode);
        require(msg.value >= requiredFee, "Insufficient payment");
        
        // Update statistics
        userQuizCount[msg.sender]++;
        modeCount[mode]++;
        totalQuizzes++;
        totalFeesCollected += requiredFee;
        
        // Emit event
        emit QuizStarted(msg.sender, uint256(mode), block.timestamp, requiredFee);
        
        // Refund excess payment using call() for better compatibility
        if (msg.value > requiredFee) {
            uint256 refundAmount = msg.value - requiredFee;
            (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
            require(success, "Refund failed");
        }
    }
    
    /**
     * @dev Get the required fee for a quiz mode
     * @param mode The quiz mode
     * @return The fee in wei
     */
    function getRequiredFee(QuizMode mode) public pure returns (uint256) {
        if (mode == QuizMode.CLASSIC) {
            return CLASSIC_FEE;
        } else if (mode == QuizMode.TIME_MODE) {
            return TIME_MODE_FEE;
        } else if (mode == QuizMode.CHALLENGE) {
            return CHALLENGE_FEE;
        }
        revert("Invalid mode");
    }
    
    /**
     * @dev Record quiz completion
     * @param user The user who completed the quiz
     * @param mode The quiz mode
     * @param score The final score
     */
    function recordQuizCompletion(
        address user,
        QuizMode mode,
        uint256 score
    ) external {
        require(mode <= QuizMode.CHALLENGE, "Invalid mode");
        emit QuizCompleted(user, uint256(mode), score, block.timestamp);
    }
    
    /**
     * @dev Get user's quiz count
     * @param user The user address
     * @return The number of quizzes started by this user
     */
    function getUserQuizCount(address user) external view returns (uint256) {
        return userQuizCount[user];
    }
    
    /**
     * @dev Get total statistics
     * @return total Total quizzes started
     * @return classic Total classic quizzes
     * @return time Total time mode quizzes
     * @return challenge Total challenge quizzes
     * @return fees Total fees collected
     */
    function getStats() external view returns (
        uint256 total,
        uint256 classic,
        uint256 time,
        uint256 challenge,
        uint256 fees
    ) {
        return (
            totalQuizzes,
            modeCount[QuizMode.CLASSIC],
            modeCount[QuizMode.TIME_MODE],
            modeCount[QuizMode.CHALLENGE],
            totalFeesCollected
        );
    }
    
    /**
     * @dev Withdraw collected fees
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Get contract balance
     * @return The current balance in wei
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}