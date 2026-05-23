// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title BaseDropPlayer
 * @dev ERC1155 contract for BaseDrop Player NFTs with enhanced privacy and supply management
 * Features:
 * - Fixed price minting (0.001 ETH)
 * - 1 NFT per wallet limit
 * - 10,000 max supply for Token ID 1
 * - Private total supply counter
 * - Enhanced holder tracking
 * - Owner-only supply visibility
 */
contract BaseDropPlayer is ERC1155, Ownable, Pausable, ReentrancyGuard {
    // Token constants
    uint256 public constant BASEDROP_PLAYER_ID = 1;
    uint256 private constant MAX_SUPPLY = 10000;
    uint256 public constant PRICE = 0.001 ether;
    
    // State variables
    uint256 private _totalMinted;
    mapping(address => bool) private _hasMinted;
    mapping(address => bool) private _isHolder;
    
    // Events
    event NFTMinted(address indexed to, uint256 tokenId);
    event BaseURIUpdated(string newBaseURI);

    constructor() ERC1155("https://nft-base-drop.vercel.app/api/metadata/0000000000000000000000000000000000000000000000000000000000000001") {
        _transferOwnership(0x55b2ED149545bb4AF2977eeb0bfF91f030b8BD5F);
    }

    /**
     * @dev Public mint function
     * Requirements:
     * - Contract not paused
     * - Sender hasn't minted before
     * - Supply not exceeded
     * - Exact ETH payment
     */
    function mint() external payable nonReentrant whenNotPaused {
        require(!_hasMinted[msg.sender], "Already minted");
        require(_totalMinted < MAX_SUPPLY, "Max supply reached");
        require(msg.value == PRICE, "Incorrect ETH amount");
        
        _hasMinted[msg.sender] = true;
        _isHolder[msg.sender] = true;
        _totalMinted++;
        
        _mint(msg.sender, BASEDROP_PLAYER_ID, 1, "");
        
        emit NFTMinted(msg.sender, BASEDROP_PLAYER_ID);
    }

    /**
     * @dev Check if address can mint
     */
    function canMint(address user) external view returns (bool) {
        return !_hasMinted[user] && _totalMinted < MAX_SUPPLY;
    }

    /**
     * @dev Get balance of a specific address
     */
    function getBalance(address account) external view returns (uint256) {
        return balanceOf(account, BASEDROP_PLAYER_ID);
    }

    // Owner-only functions

    /**
     * @dev Get total minted count (only owner)
     */
    function getTotalMinted() external view onlyOwner returns (uint256) {
        return _totalMinted;
    }

    /**
     * @dev Withdraw contract balance
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Update metadata URI
     */
    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
        emit BaseURIUpdated(newuri);
    }

    /**
     * @dev Pause/unpause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Override transfer to maintain holder status
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
        
        if (from != address(0)) {
            _isHolder[from] = balanceOf(from, BASEDROP_PLAYER_ID) > amounts[0];
        }
        if (to != address(0)) {
            _isHolder[to] = true;
        }
    }

    /**
     * @dev Get contract name and symbol (public view)
     */
    function contractInfo() external pure returns (string memory name, string memory symbol) {
        return ("I'm a BaseDrop Player", "BD");
    }

    /**
     * @dev Required for contract to receive ETH
     */
    receive() external payable {}
}