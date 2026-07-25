// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    IRecoveryAdapter
} from "../../src/TimelockRecovery.sol";

contract MockRecoveryAdapter is IRecoveryAdapter {
    mapping(address account => address vetoer) public vetoerOf;

    address public lastRecoveredAccount;
    address public lastValidator;
    bytes public lastValidatorData;

    function setVetoer(
        address account,
        address vetoer
    ) external {
        vetoerOf[account] = vetoer;
    }

    function canVeto(
        address account,
        address caller
    ) external view returns (bool) {
        return vetoerOf[account] == caller;
    }

    function applyRecovery(
        address account,
        address newValidator,
        bytes calldata newValidatorData
    ) external {
        lastRecoveredAccount = account;
        lastValidator = newValidator;
        lastValidatorData = newValidatorData;
    }
}