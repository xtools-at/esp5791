// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../ESP5791.sol";

/**
 * @dev Mock contract for demoing PBT functionality.
 *
 * Instead of using a defined chipAddress-to-tokenId mapping, we take the chips's public address recovered
 * from the signature as tokenId, so any private key is considered valid.
 *
 * UNSAFE, DEMO ONLY, DO NOT USE IN PRODUCTION!
 */
contract ESP5791Demo is ESP5791 {
    constructor(string memory name, string memory symbol, string memory baseURI)
        ESP5791(name, symbol, baseURI) {}

    /**
     * @dev See {IERC721Metadata-tokenURI} - override; returns same uri for all tokens
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireMinted(tokenId);

        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, "meta.json")) : "";
    }

    /**
     * @dev See {_transferTokenWithChip} - UNSAFE override; generates token id from chip address
     */
    function _transferTokenWithChip(bytes calldata signatureFromChip, uint256 blockNumberUsedInSig, bool useSafeTransferFrom)
        internal virtual override {
        address chipAddress = _getChipAddressForChipSignature(signatureFromChip, blockNumberUsedInSig);
        uint tokenId = uint(uint160(chipAddress));

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
            emit PBTMint(tokenId, chipAddress);
        }
    }
}
