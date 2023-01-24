// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/** PATCH notes: made contract abstract, prefixed error messages, use our NFT contract as base to prevent conflicts */
import "./ERC721Extended.sol";

/**
 * An implementation of 721 that's publicly readonly (no approvals or transfers exposed).
 */
abstract contract ERC721ReadOnly is ERC721Extended {
    function approve(address to, uint256 tokenId) public virtual override(ERC721, IERC721) {
        revert("PBT: ERC721 public approve not allowed");
    }

    function getApproved(uint256 tokenId) public view virtual override(ERC721, IERC721) returns (address) {
        require(_exists(tokenId), "ERC721: invalid token ID");
        return address(0);
    }

    function setApprovalForAll(address operator, bool approved) public virtual override(ERC721, IERC721) {
        revert("PBT: ERC721 public setApprovalForAll not allowed");
    }

    function isApprovedForAll(address owner, address operator) public view virtual override(ERC721, IERC721) returns (bool) {
        return false;
    }

    function transferFrom(address from, address to, uint256 tokenId) public virtual override(ERC721, IERC721) {
        revert("PBT: ERC721 public transferFrom not allowed");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public virtual override(ERC721, IERC721) {
        revert("PBT: ERC721 public safeTransferFrom not allowed");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public virtual override(ERC721, IERC721) {
        revert("PBT: ERC721 public safeTransferFrom not allowed");
    }
}
