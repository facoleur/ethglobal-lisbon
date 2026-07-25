// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {TARRecoveryExecutor} from "../src/TARRecoveryExecutor.sol";

/// @notice Redeploys only the TAR executor while retaining the existing Sepolia validator.
contract DeployTARExecutorSepolia is Script {
    address internal constant TAR_WEBAUTHN_VALIDATOR = 0x21a4270EbF85EB69C68E46Dd660272a292380d1F;

    function run() external {
        vm.startBroadcast();
        TARRecoveryExecutor executor = new TARRecoveryExecutor(TAR_WEBAUTHN_VALIDATOR);
        vm.stopBroadcast();

        console2.log("TARRecoveryExecutor deployed at:", address(executor));
    }
}
