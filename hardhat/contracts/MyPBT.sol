// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./PBT/ESP5791.sol";

/**
 * @dev Your personal PBT contract, ready to use with the ESP-5791 project
 */
contract MyPBT is ESP5791 {
    constructor(string memory name, string memory symbol, string memory baseURI)
        ESP5791(name, symbol, baseURI) {}
}
