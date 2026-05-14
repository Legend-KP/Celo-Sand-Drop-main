// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title GameplayEntry — Final Secure Version v5.0
 * @dev Collects 0.05 USDT per gameplay on Celo Mainnet
 * @notice No constructor arguments needed — just deploy and go
 *
 * Security fixes applied from audit:
 * ✅ 1.1 — Reentrancy guard added (uint256 pattern — safe on revert)
 * ✅ 1.2 — Explicit allowance + balance checks before transfer
 * ✅ 2.2 — Rate limiting (10 seconds between payments per wallet)
 * ✅ 3.1 — newOwner cannot be USDT address or zero address
 * ✅ 3.2 — getBalance() failure handled with revert not silent 0
 * ✅ All low-level USDT calls use safe pattern (handles non-standard returns)
 * ✅ CEI pattern — state updated BEFORE external call everywhere
 * ✅ Events emitted on every state change
 */

contract GameplayEntry {

    // ─────────────────────────────────────────
    // STATE VARIABLES
    // ─────────────────────────────────────────

    address public owner;
    bool public paused;

    // ✅ Celo Mainnet USDT — immutable after deployment
    address public constant USDT = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;

    // 0.05 USDT — 6 decimal places
    uint256 public constant FEE = 50_000;

    // ✅ FIX 1.1 — Safe reentrancy guard using uint256 (not bool)
    // bool pattern can permanently brick contract on revert
    // uint256 pattern always resets safely
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    // ✅ FIX 2.2 — Rate limit: minimum gap between payments per wallet
    uint256 public constant RATE_LIMIT_SECONDS = 10;
    mapping(address => uint256) public lastPaymentTime;

    // Stats — visible on Celoscan Read Contract
    uint256 public totalCollected;
    uint256 public totalPayments;
    mapping(address => uint256) public payCount;

    // ─────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────

    event FeePaid(address indexed user, uint256 timestamp);
    event Withdrawn(address indexed to, uint256 amount, uint256 timestamp);
    event ContractPaused(address indexed by, uint256 timestamp);
    event ContractUnpaused(address indexed by, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─────────────────────────────────────────
    // MODIFIERS
    // ─────────────────────────────────────────

    // ✅ FIX 1.1 — Reentrancy guard
    modifier nonReentrant() {
        require(_status != _ENTERED, "Reentrant call blocked");
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

    // ─────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        _status = _NOT_ENTERED; // ✅ Initialize reentrancy guard
    }

    // ─────────────────────────────────────────
    // SAFE USDT TRANSFER HELPERS
    //
    // ✅ Uses low-level call() instead of interface
    // Reason: Celo USDT does not reliably return bool from transferFrom
    // This pattern handles:
    //   - tokens that return true
    //   - tokens that return nothing
    //   - tokens that revert on failure
    // This is identical to OpenZeppelin SafeERC20 internals
    // ─────────────────────────────────────────

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        // transferFrom(address,address,uint256) selector = 0x23b872dd
        (bool ok, bytes memory data) = USDT.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount)
        );
        require(
            ok && (data.length == 0 || abi.decode(data, (bool))),
            "USDT transferFrom failed"
        );
    }

    function _safeTransfer(address to, uint256 amount) internal {
        // transfer(address,uint256) selector = 0xa9059cbb
        (bool ok, bytes memory data) = USDT.call(
            abi.encodeWithSelector(0xa9059cbb, to, amount)
        );
        require(
            ok && (data.length == 0 || abi.decode(data, (bool))),
            "USDT transfer failed"
        );
    }

    // ─────────────────────────────────────────
    // SAFE READ HELPERS
    // ─────────────────────────────────────────

    function _getAllowance(address user) internal view returns (uint256) {
        // allowance(address,address) selector = 0xdd62ed3e
        (bool ok, bytes memory data) = USDT.staticcall(
            abi.encodeWithSelector(0xdd62ed3e, user, address(this))
        );
        require(ok && data.length >= 32, "Allowance check failed");
        return abi.decode(data, (uint256));
    }

    function _getBalance(address user) internal view returns (uint256) {
        // balanceOf(address) selector = 0x70a08231
        (bool ok, bytes memory data) = USDT.staticcall(
            abi.encodeWithSelector(0x70a08231, user)
        );
        require(ok && data.length >= 32, "Balance check failed");
        return abi.decode(data, (uint256));
    }

    // ─────────────────────────────────────────
    // CORE FUNCTION
    // ─────────────────────────────────────────

    /**
     * @dev Pay 0.05 USDT to submit a gameplay entry
     *
     * Step 1: On USDT contract call approve(THIS_CONTRACT_ADDRESS, 50000)
     * Step 2: Call pay() here — 0.05 USDT moves to this contract
     *
     * Protected by:
     * - nonReentrant (reentrancy attack blocked)
     * - whenNotPaused (owner can emergency stop)
     * - rate limit (10s between payments per wallet)
     * - explicit allowance + balance checks (clear error messages)
     * - CEI pattern (state updated before external call)
     */
    function pay() external nonReentrant whenNotPaused {

        // ✅ FIX 2.2 — Rate limit: prevent spam payments
        require(
            block.timestamp >= lastPaymentTime[msg.sender] + RATE_LIMIT_SECONDS,
            "Please wait 10 seconds before paying again"
        );

        // ✅ FIX 1.2 — Explicit allowance check with clear message
        uint256 allowed = _getAllowance(msg.sender);
        require(
            allowed >= FEE,
            "Insufficient USDT allowance. Call approve(contractAddress, 50000) on USDT first"
        );

        // ✅ FIX 1.2 — Explicit balance check with clear message
        uint256 bal = _getBalance(msg.sender);
        require(
            bal >= FEE,
            "Insufficient USDT balance. You need at least 0.05 USDT"
        );

        // ✅ CEI pattern — update ALL state BEFORE external transfer call
        // This closes the reentrancy window even if nonReentrant was removed
        lastPaymentTime[msg.sender] = block.timestamp;
        totalCollected += FEE;
        totalPayments++;
        payCount[msg.sender]++;

        // ✅ External call LAST — after all state is updated
        _safeTransferFrom(msg.sender, address(this), FEE);

        emit FeePaid(msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────
    // OWNER FUNCTIONS
    // ─────────────────────────────────────────

    /**
     * @dev Withdraw all collected USDT to owner wallet
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 bal = getBalance();
        require(bal > 0, "No USDT to withdraw");

        // ✅ Emit BEFORE transfer for full on-chain transparency
        emit Withdrawn(owner, bal, block.timestamp);

        _safeTransfer(owner, bal);
    }

    /**
     * @dev Emergency stop — pauses all pay() calls
     * Existing approvals are preserved, users can pay once unpaused
     */
    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit ContractPaused(msg.sender, block.timestamp);
    }

    /**
     * @dev Resume pay() calls
     */
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit ContractUnpaused(msg.sender, block.timestamp);
    }

    /**
     * @dev Transfer ownership to a new wallet
     */
    function transferOwnership(address newOwner) external onlyOwner {
        // ✅ FIX 3.1 — Prevent locking contract by setting owner to:
        // - zero address (nobody can withdraw)
        // - USDT address (USDT contract can't sign transactions)
        // - current owner (pointless)
        require(newOwner != address(0), "Cannot set zero address as owner");
        require(newOwner != USDT, "Cannot set USDT as owner");
        require(newOwner != owner, "Already the owner");

        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────

    /**
     * @dev Current USDT balance in this contract
     * ✅ FIX 3.2 — Reverts with message instead of silently returning 0
     * Prevents frontend from showing wrong balance and blocking withdraw
     */
    function getBalance() public view returns (uint256) {
        return _getBalance(address(this));
    }

    /**
     * @dev How many times a wallet has paid
     */
    function getPayCount(address user) external view returns (uint256) {
        return payCount[user];
    }

    /**
     * @dev Check if a wallet can pay right now (rate limit check)
     * Frontend can call this before showing the pay button
     */
    function canPay(address user) external view returns (bool) {
        return block.timestamp >= lastPaymentTime[user] + RATE_LIMIT_SECONDS;
    }

    /**
     * @dev Seconds remaining until user can pay again (0 = can pay now)
     * Useful for frontend countdown timer
     */
    function secondsUntilCanPay(address user) external view returns (uint256) {
        uint256 nextAllowed = lastPaymentTime[user] + RATE_LIMIT_SECONDS;
        if (block.timestamp >= nextAllowed) return 0;
        return nextAllowed - block.timestamp;
    }

    // ─────────────────────────────────────────
    // SAFETY NET
    // ─────────────────────────────────────────

    receive() external payable {
        revert("This contract does not accept CELO");
    }

    fallback() external payable {
        revert("Invalid function call");
    }
}
