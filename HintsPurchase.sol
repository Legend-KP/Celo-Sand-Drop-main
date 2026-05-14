// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HintsPurchase
 * @notice Pay 0.1 USDT or 0.1 USDC to purchase a hint on Celo Mainnet.
 * @dev Supports two ERC-20 tokens with separate accounting and shared access control.
 *      Rate limiting is global per wallet: after any successful payment, the wallet
 *      must wait RATE_LIMIT seconds before paying again with either token.
 */
contract HintsPurchase {
    string public constant VERSION = "1.0.0";

    address public constant USDT = 0x617f3112bf5397D0467D315cC709EF968D9ba546;
    address public constant USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;

    uint256 public constant FEE = 100_000; // 0.1 USDT/USDC (6 decimals)
    uint256 public constant RATE_LIMIT = 1 days;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    address public owner;
    address public pendingOwner;
    bool public paused;

    uint256 public totalCollectedUSDT;
    uint256 public totalCollectedUSDC;
    uint256 public totalWithdrawnUSDT;
    uint256 public totalWithdrawnUSDC;

    mapping(address => uint256) public payCountUSDT;
    mapping(address => uint256) public payCountUSDC;
    mapping(address => uint256) private lastPayTime;

    event HintPurchased(address indexed player, address indexed token, uint256 amount, uint256 timestamp);
    event WithdrawnUSDT(address indexed to, uint256 amount);
    event WithdrawnUSDC(address indexed to, uint256 amount);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    constructor() {
        owner = msg.sender;
        _status = _NOT_ENTERED;
    }

    /**
     * @notice Pay 0.1 USDT to purchase a hint.
     * @dev Effects are recorded before the token transfer to preserve CEI.
     */
    function payWithUSDT() external nonReentrant whenNotPaused {
        _enforceRateLimit(msg.sender);

        lastPayTime[msg.sender] = block.timestamp;
        payCountUSDT[msg.sender] += 1;
        totalCollectedUSDT += FEE;

        _collectPayment(USDT, msg.sender);

        emit HintPurchased(msg.sender, USDT, FEE, block.timestamp);
    }

    /**
     * @notice Pay 0.1 USDC to purchase a hint.
     * @dev Effects are recorded before the token transfer to preserve CEI.
     */
    function payWithUSDC() external nonReentrant whenNotPaused {
        _enforceRateLimit(msg.sender);

        lastPayTime[msg.sender] = block.timestamp;
        payCountUSDC[msg.sender] += 1;
        totalCollectedUSDC += FEE;

        _collectPayment(USDC, msg.sender);

        emit HintPurchased(msg.sender, USDC, FEE, block.timestamp);
    }

    function withdrawUSDT() external onlyOwner nonReentrant {
        uint256 bal = _balanceOf(USDT, address(this));
        require(bal > 0, "No USDT to withdraw");
        totalWithdrawnUSDT += bal;
        _safeTransfer(USDT, owner, bal);
        emit WithdrawnUSDT(owner, bal);
    }

    function withdrawUSDC() external onlyOwner nonReentrant {
        uint256 bal = _balanceOf(USDC, address(this));
        require(bal > 0, "No USDC to withdraw");
        totalWithdrawnUSDC += bal;
        _safeTransfer(USDC, owner, bal);
        emit WithdrawnUSDC(owner, bal);
    }

    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        require(newOwner != USDT, "New owner cannot be USDT contract");
        require(newOwner != USDC, "New owner cannot be USDC contract");
        require(newOwner != address(this), "New owner cannot be this contract");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(pendingOwner != address(0), "No pending transfer");
        require(msg.sender == pendingOwner, "Not pending owner");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function getBalanceUSDT() external view returns (uint256) {
        return _balanceOf(USDT, address(this));
    }

    function getBalanceUSDC() external view returns (uint256) {
        return _balanceOf(USDC, address(this));
    }

    function getStats()
        external
        view
        returns (
            uint256 currentUSDT,
            uint256 currentUSDC,
            uint256 lifetimeUSDT,
            uint256 lifetimeUSDC,
            uint256 withdrawnUSDT,
            uint256 withdrawnUSDC
        )
    {
        currentUSDT = _balanceOf(USDT, address(this));
        currentUSDC = _balanceOf(USDC, address(this));
        lifetimeUSDT = totalCollectedUSDT;
        lifetimeUSDC = totalCollectedUSDC;
        withdrawnUSDT = totalWithdrawnUSDT;
        withdrawnUSDC = totalWithdrawnUSDC;
    }

    function getPayCount(address player) external view returns (uint256) {
        return payCountUSDT[player] + payCountUSDC[player];
    }

    function getPayCountUSDT(address player) external view returns (uint256) {
        return payCountUSDT[player];
    }

    function getPayCountUSDC(address player) external view returns (uint256) {
        return payCountUSDC[player];
    }

    function canPay(address player) external view returns (bool) {
        return !paused && block.timestamp >= lastPayTime[player] + RATE_LIMIT;
    }

    function secondsUntilCanPay(address player) external view returns (uint256) {
        if (paused) return type(uint256).max;
        uint256 nextAllowed = lastPayTime[player] + RATE_LIMIT;
        if (block.timestamp >= nextAllowed) return 0;
        return nextAllowed - block.timestamp;
    }

    function _enforceRateLimit(address player) internal view {
        require(
            block.timestamp >= lastPayTime[player] + RATE_LIMIT,
            "Rate limit: wait before paying again"
        );
    }

    function _collectPayment(address token, address player) internal {
        uint256 contractBalanceBefore = _balanceOf(token, address(this));
        _safeTransferFrom(token, player, address(this), FEE);
        uint256 contractBalanceAfter = _balanceOf(token, address(this));
        require(
            contractBalanceAfter >= contractBalanceBefore + FEE,
            "Transfer amount mismatch"
        );
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "transferFrom failed"
        );
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
    }

    function _balanceOf(address token, address account) internal view returns (uint256) {
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("balanceOf(address)", account)
        );
        require(success && data.length >= 32, "balanceOf failed");
        return abi.decode(data, (uint256));
    }

    receive() external payable {
        revert("No CELO accepted");
    }

    fallback() external payable {
        revert("No CELO accepted");
    }
}
