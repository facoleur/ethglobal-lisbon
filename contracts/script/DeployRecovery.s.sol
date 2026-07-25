// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {TimelockRecovery} from "../src/TimelockRecovery.sol";
import {RotatableWebAuthnValidator} from "../src/RotatableWebAuthnValidator.sol";

contract DeployRecovery is Script {
    function run() external returns (TimelockRecovery recovery, RotatableWebAuthnValidator validator) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        uint48 recoveryDelay = uint48(vm.envOr("RECOVERY_DELAY_SECONDS", uint256(1 days)));

        uint48 revealWindow = uint48(vm.envOr("REVEAL_WINDOW_SECONDS", uint256(1 hours)));

        uint96 minimumDeposit = uint96(vm.envOr("MINIMUM_DEPOSIT_WEI", uint256(0.01 ether)));

        vm.startBroadcast(deployerKey);

        recovery = new TimelockRecovery(recoveryDelay, revealWindow, minimumDeposit);

        validator = new RotatableWebAuthnValidator();

        vm.stopBroadcast();

        console2.log("TimelockRecovery:", address(recovery));
        console2.log("RotatableWebAuthnValidator:", address(validator));
    }
}
