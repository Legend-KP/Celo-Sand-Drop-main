// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

contract HappyTrenchy is ERC1155, Ownable, Pausable, ERC1155Burnable, ERC1155Supply, IERC2981 {
    string public name = "Happy Trenchy";
    string public symbol = "Trenchy";
    
    // Token ID for the collection (all NFTs will have ID 1)
    uint256 public constant TOKEN_ID = 1;
    
    // Maximum supply
    uint256 public constant MAX_SUPPLY = 300;
    
    // Royalty info
    address public royaltyReceiver;
    uint96 public royaltyFeeNumerator = 100; // 1% = 100/10000
    
    // Base URI for metadata
    string private _baseTokenURI;
    
    // Whitelist for minting
    mapping(address => bool) public whitelist;
    bool public whitelistEnabled = true;
    
    // Events
    event WhitelistUpdated(address indexed account, bool status);
    event WhitelistToggled(bool enabled);
    event RoyaltyUpdated(address receiver, uint96 feeNumerator);
    event BaseURIUpdated(string newBaseURI);
    
    constructor(address initialOwner) ERC1155("") {
        _transferOwnership(initialOwner);
        royaltyReceiver = initialOwner;
        
        // Set initial base URI with Pinata CID
        _baseTokenURI = "https://og-nu-orcin.vercel.app/api/metadata";
    }
    
    // ========== MINTING FUNCTIONS ==========    
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(totalSupply(TOKEN_ID) + amount <= MAX_SUPPLY, "Exceeds maximum supply");
        
        _mint(to, TOKEN_ID, amount, "");
    }
    
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(totalSupply(TOKEN_ID) + totalAmount <= MAX_SUPPLY, "Exceeds maximum supply");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            _mint(recipients[i], TOKEN_ID, amounts[i], "");
        }
    }
    
    function mintRemaining() external onlyOwner {
        uint256 remaining = MAX_SUPPLY - totalSupply(TOKEN_ID);
        require(remaining > 0, "No remaining supply");
        _mint(owner(), TOKEN_ID, remaining, "");
    }
    
    // ========== WHITELIST FUNCTIONS ==========    
    function updateWhitelist(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            whitelist[accounts[i]] = status;
            emit WhitelistUpdated(accounts[i], status);
        }
    }
    
    function toggleWhitelist() external onlyOwner {
        whitelistEnabled = !whitelistEnabled;
        emit WhitelistToggled(whitelistEnabled);
    }
    
    // ========== TRANSFER RESTRICTIONS ==========    
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        if (whitelistEnabled && from != owner()) {
            require(whitelist[from] || whitelist[to], "Transfer not allowed: whitelist required");
        }
        super.safeTransferFrom(from, to, id, amount, data);
    }
    
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override {
        if (whitelistEnabled && from != owner()) {
            require(whitelist[from] || whitelist[to], "Transfer not allowed: whitelist required");
        }
        super.safeBatchTransferFrom(from, to, ids, amounts, data);
    }
    
    // ========== METADATA FUNCTIONS ==========    
    function uri(uint256) public view virtual override returns (string memory) {
        return _baseTokenURI;
    }
    
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }
    
    // ========== ROYALTY FUNCTIONS ==========    
    function setRoyaltyInfo(address receiver, uint96 feeNumerator) external onlyOwner {
        require(receiver != address(0), "Invalid royalty receiver");
        require(feeNumerator <= 1000, "Royalty fee too high"); // Max 10%
        
        royaltyReceiver = receiver;
        royaltyFeeNumerator = feeNumerator;
        emit RoyaltyUpdated(receiver, feeNumerator);
    }
    
    function royaltyInfo(uint256, uint256 salePrice) external view override returns (address, uint256) {
        uint256 royaltyAmount = (salePrice * royaltyFeeNumerator) / 10000;
        return (royaltyReceiver, royaltyAmount);
    }
    
    // ========== PAUSABLE FUNCTIONS ==========    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ========== VIEW FUNCTIONS ==========    
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply(TOKEN_ID);
    }
    
    function isMintingComplete() external view returns (bool) {
        return totalSupply(TOKEN_ID) >= MAX_SUPPLY;
    }
    
    function getContractInfo() external view returns (
        string memory contractName,
        string memory contractSymbol,
        uint256 maxSupply,
        uint256 currentSupply,
        uint256 tokenId,
        address owner,
        bool isPaused,
        bool isWhitelistEnabled
    ) {
        return (
            name,
            symbol,
            MAX_SUPPLY,
            totalSupply(TOKEN_ID),
            TOKEN_ID,
            owner,
            paused(),
            whitelistEnabled
        );
    }
    
    // ========== EMERGENCY FUNCTIONS ==========    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    // ========== REQUIRED OVERRIDES ==========    
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155, ERC1155Supply) whenNotPaused {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }
} 