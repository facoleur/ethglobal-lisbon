// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {TARRecoveryExecutorV2} from "../src/TARRecoveryExecutorV2.sol";

/// @notice Deploys the V2 TAR executor (Semaphore watch towers) on Sepolia, reusing the existing
/// `TARWebAuthnValidator` singleton already live from the V1 deploy (`DeployTARExecutorSepolia`) —
/// V2's `finalizeRecovery` targets it with the same `setNewOwner(uint256,uint256)` call V1 does, so
/// there is no need for a second validator instance. `semaphore` is Sepolia's official `Semaphore`
/// deployment (see `lib/semaphore/packages/utils/src/networks/deployed-contracts.json`).
contract DeployTARV2Sepolia is Script {
    address internal constant TAR_WEBAUTHN_VALIDATOR = 0x9F79960b33889e5C460b16B6d7Ee38529F480ee9;
    address internal constant SEMAPHORE_SEPOLIA = 0x1e0d7FF1610e480fC93BdEC510811ea2Ba6d7c2f;

    function run() external {
        vm.startBroadcast();
        TARRecoveryExecutorV2 executor = new TARRecoveryExecutorV2(TAR_WEBAUTHN_VALIDATOR, SEMAPHORE_SEPOLIA);
        vm.stopBroadcast();

        console2.log("TARRecoveryExecutorV2 deployed at:", address(executor));
    }
}
