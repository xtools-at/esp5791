// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "./ERC721Extended.sol";

/**
 * @dev ERC721 NFT contract with the following features:
 * - all from ERC721Extended
 * - ERC721Burnable
 * - ERC2981 Royalty
 * - Mintable
 * - convenience methods to
 *  -- batch mint and transfer tokens
 *  -- update royalty (default/per token id; admin only)
 */
contract ERC721Full is
    ERC721Extended, ERC721Burnable, ERC721Royalty {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @dev Constructor
     */
    constructor(string memory name, string memory symbol) ERC721Extended(name, symbol) {
        // set default royalty
        _setDefaultRoyalty(_msgSender(), 200); // 100 = 1%
        // give deployer minter-role
        _setupRole(MINTER_ROLE, _msgSender());
    }


    /** Public getters */

    /**
     * @dev See {IERC165-supportsInterface} - override required by Solidity.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual
        override(ERC721, ERC721Extended, ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }


    /** Public setters */

    /**
     * @dev Public mint call, Minter-role only.
     */
    function mint(address to, uint tokenId) public virtual onlyRole(MINTER_ROLE) {
        _safeMint(to, tokenId, "");
    }

    /**
     * @dev Batch-Mint (single recipient).
     */
    function mintBatch(address to, uint[] memory tokenIds) public virtual {
        for (uint i = 0; i < tokenIds.length; i++) {
            mint(to, tokenIds[i]);
        }
    }

    /**
     * @dev Batch-Mint (multiple recipients).
     */
    function mintBatch(address[] memory recipients, uint[] memory tokenIds) public virtual {
        require(recipients.length == tokenIds.length, "ERC721: Array length mismatch");

        for (uint i = 0; i < recipients.length; i++) {
            mint(recipients[i], tokenIds[i]);
        }
    }

    /**
     * @dev Batch-Transfer (single recipient).
     */
    function transferBatch(address from, address to, uint256[] memory tokenIds) public virtual {
        for (uint16 i = 0; i < tokenIds.length; i++) {
            safeTransferFrom(from, to, tokenIds[i], "");
        }
    }

    /**
     * @dev Batch-Transfer (multiple recipients).
     */
    function transferBatch(address from, address[] memory recipients, uint256[] memory tokenIds) public virtual {
        require(recipients.length == tokenIds.length, "ERC721: Array length mismatch");

        for (uint i = 0; i < tokenIds.length; i++) {
            safeTransferFrom(from, recipients[i], tokenIds[i], "");
        }
    }

    /**
     * @dev set default royalty - admin only
     */
    function setDefaultRoyalty(address receiver, uint96 feeNumerator)
        public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        require(feeNumerator <= 10000, "ERC2981: royalty can't be more than 10%");

        _setDefaultRoyalty(receiver, feeNumerator);
    }

    /**
     * @dev set royalty for token id - admin only
     */
    function setTokenRoyalty(uint tokenId, address receiver, uint96 feeNumerator)
        public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        require(feeNumerator <= 10000, "ERC2981: royalty can't be more than 10%");

        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }


    /** Internal methods */

    /**
     * @dev See {ERC721-_burn}
     */
    function _burn(uint256 tokenId) internal virtual override(ERC721, ERC721Royalty) {
        super._burn(tokenId);
    }

    /**
     * @dev Base URI override for computing {tokenURI} and {contractURI}, working with {setBaseURI}
     */
    function _baseURI() internal view virtual override(ERC721, ERC721Extended) returns (string memory) {
        return _baseTokenURI;
    }

    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize)
        internal virtual override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }
}
