// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ERC721EnumerableCustom.sol";

/**
 * @dev ERC721 NFT contract with the following features:
 * - ERC721Enumerable
 * - Ownable
 * - AccessControl
 * - convenience methods to
 *  -- update baseURI (admin only)
 *  -- get existing token ids (all/by index)
 *  -- get all token ids owned by wallet(s)
 */
contract ERC721Extended is
    ERC721Enumerable,
    AccessControl,
    Ownable
{
    // variables
    string internal _baseTokenURI = ""; // e.g. "https://xtools-at.github.io/token/"


    /**
     * @dev Constructor - grants deployer admin role
     */
    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
        // give deployer admin-role
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }


    /** Public getters */

    /**
     * @dev Returns minted token ids.
     */
    function getTokenIds() public view virtual returns (uint[] memory) {
        return _allTokens;
    }

    /**
     * @dev Returns minted token ids by index. Might run out of gas for a large amount of tokens.
     */
    function getTokenIds(uint fromIndex, uint toIndex) public view virtual returns (uint[] memory) {
        require(fromIndex <= toIndex && toIndex < _allTokens.length, "ERC721: index out of bounds");

        // create output
        uint[] memory tokenIds = new uint[](toIndex - fromIndex + 1);
        for (uint i = fromIndex; i <= toIndex; i++) {
            tokenIds[i] = _allTokens[i];
        }

        return tokenIds;
    }

    /**
     * @dev Returns all token IDs owned by `owner`.
     * Uses {balanceOf} and {tokenOfOwnerByIndex} to enumerate all of ``owner``'s tokens.
     */
    function tokensOfOwner(address owner) public view virtual returns (uint[] memory) {
        uint balanceOfOwner = balanceOf(owner);
        uint[] memory tokenIds = new uint[](balanceOfOwner);

        for (uint i = 0; i < balanceOfOwner; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }

        return tokenIds;
    }

    /**
     * @dev Returns a all token IDs owned by each of `owners`.
     * Uses {tokensOfOwner} to enumerate all of ``owners``'s tokens.
     */
    function tokensOfOwnerBatch(address[] memory owners) public view virtual returns (uint[][] memory) {
        uint[][] memory tokenIds = new uint[][](owners.length);

        for (uint i = 0; i < owners.length; i++) {
            tokenIds[i] = tokensOfOwner(owners[i]);
        }

        return tokenIds;
    }

    /**
     * @dev See {IERC165-supportsInterface} - override required by Solidity.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual
        override(ERC721Enumerable, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }


    /** Public setters */

    /**
     * @dev update metadata url - admin only
     */
    function setBaseURI(string calldata newBaseURI)
        external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
    }

    /** Internal methods */

    /**
     * @dev Base URI override for computing {tokenURI} and {contractURI}, working with {setBaseURI}
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }
}
