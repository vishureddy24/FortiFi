// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @dev FortiFi Timelock Controller
 * Used to delay the execution of governance proposals, providing a safety buffer.
 */
contract FortiFiTimelock is TimelockController {
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors
    ) TimelockController(minDelay, proposers, executors) {}
}
