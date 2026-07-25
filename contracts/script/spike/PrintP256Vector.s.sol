// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";

/// @notice Prints a valid secp256r1 (P-256) test vector (hash, r, s, pubKeyX, pubKeyY)
/// using Foundry's native P-256 cheatcodes, for use as a RIP-7212 precompile test vector.
contract PrintP256Vector is Script {
    function run() external pure {
        uint256 privateKey = uint256(keccak256("6th-republic-tar-p256-spike-test-key"));
        (uint256 pubKeyX, uint256 pubKeyY) = vm.publicKeyP256(privateKey);
        bytes32 messageHash = keccak256("RIP-7212 spike test vector");
        (bytes32 r, bytes32 s) = vm.signP256(privateKey, messageHash);

        console2.log("hash:");
        console2.logBytes32(messageHash);
        console2.log("r:");
        console2.logBytes32(r);
        console2.log("s:");
        console2.logBytes32(s);
        console2.log("pubKeyX:");
        console2.logBytes32(bytes32(pubKeyX));
        console2.log("pubKeyY:");
        console2.logBytes32(bytes32(pubKeyY));
    }
}
