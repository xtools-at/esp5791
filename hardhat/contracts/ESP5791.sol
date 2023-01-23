// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./base/PBTSimpleCustom.sol";

contract ESP5791 is PBTSimple {
    // constants
    uint256 private constant MAX_BLOCKHASH_WINDOW = 250;

    /**
     * @dev Constructor - including NFT metadata baseURI
     */
    constructor(string memory name, string memory symbol, string memory baseURI)
        PBTSimple(name, symbol) {
        // set metadata base URI
        _baseTokenURI = baseURI;
    }


    /** Public getters */

    /**
     * @dev Get the token data for a given chip address.
     */
    function getTokenData(address chipAddress) public view virtual returns (TokenData memory) {
        require(_tokenDatas[chipAddress].set, "PBT: No mapped token for chip address");

        return _tokenDatas[chipAddress];
    }

    /**
     * @dev Get number of blocks a signed message is valid. Override to use {MAX_BLOCKHASH_WINDOW}
     */
    function getMaxBlockhashValidWindow() public pure virtual override returns (uint256) {
        return MAX_BLOCKHASH_WINDOW;
    }

    /**
     * @dev See {IERC165-supportsInterface} - override to add PBT interface
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IPBT).interfaceId || super.supportsInterface(interfaceId);
    }


    /** Public setters */

    /**
     * @dev Call to update the mapping of chipsAdresses to tokenIds - admin only
     */
    function seedChipToTokenMapping(address[] memory chipAddresses, uint[] memory tokenIds)
        public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _seedChipToTokenMapping(chipAddresses, tokenIds);
    }

    /**
     * @dev Call to replace old chip adresses with new ones - admin only
     */
    function updateChips(address[] calldata chipAddressesOld, address[] calldata chipAddressesNew)
        public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _updateChips(chipAddressesOld, chipAddressesNew);
    }

    /** Internal methods */

    /**
     * @dev {_transferTokenWithChip} override to (safe) mint the token if it doesn't exist yet
     * (doesn't use {PBTSimple-_mintTokenWithChip})
     */
    function _transferTokenWithChip(bytes calldata signatureFromChip, uint blockNumberUsedInSig, bool useSafeTransferFrom)
        internal virtual override {
        TokenData memory tokenData = _getTokenDataForChipSignature(signatureFromChip, blockNumberUsedInSig);
        uint tokenId = tokenData.tokenId;

        if (_exists(tokenId)) {
            // transfer if token exists
            if (useSafeTransferFrom) {
                _safeTransfer(ownerOf(tokenId), _msgSender(), tokenId, "");
            } else {
                _transfer(ownerOf(tokenId), _msgSender(), tokenId);
            }
        } else {
            // mint if token doesn't exist yet but is mapped
            if (useSafeTransferFrom) {
                _safeMint(_msgSender(), tokenId);
            } else {
                _mint(_msgSender(), tokenId);
            }
            // emit PBTMint event (see IPBT)
            emit PBTMint(tokenId, tokenData.chipAddress);
        }
    }
}
