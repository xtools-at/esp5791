// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./PBT/ESP5791.sol";

/**
 * @dev Your personal PBT contract, ready to use with the ESP-5791 project
 */
contract MyPBT is ESP5791 {
    constructor() ESP5791("My first PBT", "MYPBT", "https://example.com/metdata-base-path/") {}
}
