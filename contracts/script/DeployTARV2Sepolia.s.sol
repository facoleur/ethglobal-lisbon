// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {TARRecoveryExecutorV2} from "../src/TARRecoveryExecutorV2.sol";

/// @notice Deploys a fresh `TARWebAuthnValidator` plus the V2 TAR executor (Semaphore watch
/// towers) on Sepolia, in a single run. `semaphore` is Sepolia's official `Semaphore` deployment
/// (see `lib/semaphore/packages/utils/src/networks/deployed-contracts.json`).
///
/// `TARWebAuthnValidator` isn't imported directly: it requires solc `^0.8.24`, incompatible with
/// the exact `0.8.23` pin this file inherits (transitively, via `lib/semaphore`) for
/// `TARRecoveryExecutorV2` — no single solc version satisfies both pragmas in one compilation
/// unit. `vm.deployCode` sidesteps that by deploying the already-built bytecode straight from the
/// `out/` artifact, so this script never has to import the source file.
contract DeployTARV2Sepolia is Script {
    address internal constant SEMAPHORE_SEPOLIA = 0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D;

    function run() external {
        vm.startBroadcast();
        address validator = vm.deployCode("TARWebAuthnValidator.sol:TARWebAuthnValidator");
        TARRecoveryExecutorV2 executor = new TARRecoveryExecutorV2(validator, SEMAPHORE_SEPOLIA);
        vm.stopBroadcast();

        console2.log("TARWebAuthnValidator deployed at:", validator);
        console2.log("TARRecoveryExecutorV2 deployed at:", address(executor));
    }
}
