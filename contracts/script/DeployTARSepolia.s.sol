// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {TARWebAuthnValidator} from "../src/validators/TARWebAuthnValidator.sol";
import {TARRecoveryExecutor} from "../src/TARRecoveryExecutor.sol";

/// @notice Milestone E: deploys the two TAR "singleton" contracts on Sepolia — one
/// `TARWebAuthnValidator` and one `TARRecoveryExecutor` (parameterized with the validator's
/// address), shared across every user's Kernel account. Does not create any user account or
/// install any module on one — that happens per-user, front-side, afterwards. Not an E2E test
/// via EntryPoint/UserOp either (Milestone F) — the deployer is a plain EOA sending direct txs.
contract DeployTARSepolia is Script {
    function run() external {
        vm.startBroadcast();

        TARWebAuthnValidator validator = new TARWebAuthnValidator();
        TARRecoveryExecutor executor = new TARRecoveryExecutor(address(validator));

        vm.stopBroadcast();

        console2.log("TARWebAuthnValidator deployed at:", address(validator));
        console2.log("TARRecoveryExecutor deployed at:", address(executor));
    }
}
