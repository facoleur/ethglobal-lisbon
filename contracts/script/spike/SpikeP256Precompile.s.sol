// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {P256Probe} from "../../src/spike/P256Probe.sol";

/// @notice Section 2b, Spike B: is the RIP-7212/EIP-7951 P-256 precompile (0x0100)
/// available in a real transaction (not just eth_call)? Deploys P256Probe and
/// calls it with a known-valid P-256 test vector via a broadcasted transaction.
contract SpikeP256Precompile is Script {
    address constant PRECOMPILE_0X0100 = 0x0000000000000000000000000000000000000100;

    uint256 constant ANVIL_RELAYER_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        uint256 relayerKey = vm.envOr("RELAYER_PRIVATE_KEY", ANVIL_RELAYER_KEY);

        // Known-valid P-256 (secp256r1) test vector, generated with Foundry's native
        // P-256 cheatcodes (see script/spike/PrintP256Vector.s.sol).
        bytes32 messageHash = keccak256("RIP-7212 spike test vector");
        bytes32 r = 0xeb7938f6afed99b1bff185ee7987ca12618ba987c2ee253b3106af482ff1c36e;
        bytes32 s = 0x22e5c2a46241c31259322a4c78733b2bcf61c6cc7273acd89fb6870ae0e54204;
        bytes32 pubKeyX = 0xb038c4a78cebda24158c18581a8292796dad7d99571a01eea146e8cdfed01609;
        bytes32 pubKeyY = 0x9b094cdc457f53ae6678251a2916774cc1b959fbec2c44b52971ad37f1a7f11d;
        bytes memory input = abi.encodePacked(messageHash, r, s, pubKeyX, pubKeyY);

        vm.startBroadcast(relayerKey);
        P256Probe probe = new P256Probe();
        console2.log("P256Probe:", address(probe));

        (bool success, bool valid) = probe.probe(PRECOMPILE_0X0100, input);
        vm.stopBroadcast();

        console2.log("precompile call success:", success);
        console2.log("precompile signature valid:", valid);
    }
}
