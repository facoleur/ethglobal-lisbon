// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IEntryPoint} from "kernel/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "kernel/interfaces/PackedUserOperation.sol";
import {EntryPointLib} from "kernel/sdk/TestBase/erc4337Util.sol";
import {Kernel} from "kernel/Kernel.sol";
import {KernelFactory} from "kernel/factory/KernelFactory.sol";
import {IHook, IValidator} from "kernel/interfaces/IERC7579Modules.sol";
import {ValidatorLib} from "kernel/utils/ValidationTypeLib.sol";
import {ValidationId} from "kernel/types/Types.sol";
import {WebAuthnValidator, WebAuthnValidatorData} from "kernel-7579-plugins/validators/WebAuthnValidator.sol";
import {Base64URL} from "kernel-7579-plugins/utils/Base64URL.sol";

/// @notice Section 2b, Spike A: does Kernel's WebAuthnValidator actually work in a
/// real transaction (not just eth_call)? Deploys WebAuthnValidator, creates a Kernel
/// v3.1 account with it as the ROOT validator (no ECDSA fallback involved), builds a
/// realistic (but test-generated, no real authenticator) WebAuthn assertion envelope
/// around the UserOpHash, and sends it through EntryPoint.handleOps as a broadcasted tx.
contract SpikeWebAuthn is Script {
    uint256 constant ANVIL_RELAYER_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    // Fixed by WebAuthnValidator: byte offset of `"challenge":"..."` inside clientDataJSON.
    uint256 constant CHALLENGE_LOCATION = 23;
    // Byte offset of `"type":"webauthn.get"` inside clientDataJSON.
    uint256 constant RESPONSE_TYPE_LOCATION = 1;

    function run() external {
        uint256 relayerKey = vm.envOr("RELAYER_PRIVATE_KEY", ANVIL_RELAYER_KEY);
        bool usePrecompiled = vm.envOr("USE_PRECOMPILED_P256", true);
        address relayer = vm.addr(relayerKey);

        // Test-only P-256 "authenticator" key (no real Secure Enclave/authenticator involved).
        uint256 p256PrivateKey = uint256(keccak256("6th-republic-tar-p256-spike-webauthn-key"));
        (uint256 pubKeyX, uint256 pubKeyY) = vm.publicKeyP256(p256PrivateKey);

        console2.log("Relayer (self-relay EOA):", relayer);
        console2.log("usePrecompiled:", usePrecompiled);
        console2.log("P-256 pubKeyX:", pubKeyX);
        console2.log("P-256 pubKeyY:", pubKeyY);

        vm.startBroadcast(relayerKey);

        IEntryPoint entrypoint = IEntryPoint(EntryPointLib.deploy());
        Kernel implementation = new Kernel(entrypoint);
        KernelFactory factory = new KernelFactory(address(implementation));
        WebAuthnValidator validator = new WebAuthnValidator();
        console2.log("EntryPoint:", address(entrypoint));
        console2.log("WebAuthnValidator:", address(validator));

        ValidationId rootValidation = ValidatorLib.validatorToIdentifier(IValidator(address(validator)));
        bytes memory validatorData = abi.encode(WebAuthnValidatorData({pubKeyX: pubKeyX, pubKeyY: pubKeyY}), bytes32(0));
        bytes memory initData = abi.encodeWithSelector(
            Kernel.initialize.selector, rootValidation, IHook(address(0)), validatorData, bytes(""), new bytes[](0)
        );
        bytes32 salt = bytes32(0);
        address predicted = factory.getAddress(initData, salt);
        console2.log("Predicted Kernel account:", predicted);

        (bool funded,) = predicted.call{value: 1 ether}("");
        require(funded, "funding of counterfactual account failed");

        bytes memory initCode = abi.encodePacked(
            address(factory), abi.encodeWithSelector(KernelFactory.createAccount.selector, initData, salt)
        );

        PackedUserOperation memory op = PackedUserOperation({
            sender: predicted,
            nonce: entrypoint.getNonce(predicted, 0),
            initCode: initCode,
            callData: hex"",
            accountGasLimits: bytes32(abi.encodePacked(uint128(1_000_000), uint128(1_000_000))),
            preVerificationGas: 100_000,
            gasFees: bytes32(abi.encodePacked(uint128(1 gwei), uint128(1 gwei))),
            paymasterAndData: hex"",
            signature: hex""
        });
        vm.stopBroadcast();

        bytes32 userOpHash = entrypoint.getUserOpHash(op);
        op.signature = _buildWebAuthnSignature(userOpHash, p256PrivateKey, usePrecompiled);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        // NOTE: forge script's own local pre-broadcast simulation of this call goes
        // through a different (buggy) local P-256 precompile stub than the real Anvil
        // node's, and reports failure even when the real chain would succeed (see
        // docs/spike-p256-results.md). So we do NOT call entrypoint.handleOps here;
        // instead we print the exact calldata and submit it out-of-band with `cast send`,
        // which talks to the real node directly with no local pre-simulation involved.
        bytes memory handleOpsCalldata = abi.encodeWithSelector(IEntryPoint.handleOps.selector, ops, payable(relayer));
        console2.log("EntryPoint address:");
        console2.logAddress(address(entrypoint));
        console2.log("handleOps calldata (submit with cast send):");
        console2.logBytes(handleOpsCalldata);
    }

    /// @dev Builds a WebAuthn assertion envelope (authenticatorData + clientDataJSON)
    /// around `userOpHash` and signs it with the test P-256 key, in the exact format
    /// WebAuthnValidator._verifySignature expects.
    function _buildWebAuthnSignature(bytes32 userOpHash, uint256 p256PrivateKey, bool usePrecompiled)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory challenge = abi.encodePacked(userOpHash);
        string memory challengeB64url = Base64URL.encode(challenge);

        // Byte-for-byte the shape real browsers/authenticators produce; the
        // fixed CHALLENGE_LOCATION=23 in WebAuthnValidator assumes exactly this prefix.
        string memory clientDataJSON = string.concat(
            '{"type":"webauthn.get","challenge":"',
            challengeB64url,
            '","origin":"https://example.com","crossOrigin":false}'
        );

        // Minimal 37-byte authenticatorData: rpIdHash(32) + flags(1) + signCount(4).
        // flags = 0x05 = UP (bit0) | UV (bit2), matching requireUserVerification=true.
        bytes memory authenticatorData = abi.encodePacked(keccak256("test-rp-id"), bytes1(0x05), bytes4(0));

        bytes32 clientDataJSONHash = sha256(bytes(clientDataJSON));
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, clientDataJSONHash));

        (bytes32 r, bytes32 s) = vm.signP256(p256PrivateKey, messageHash);

        return
            abi.encode(
                authenticatorData, clientDataJSON, RESPONSE_TYPE_LOCATION, uint256(r), uint256(s), usePrecompiled
            );
    }
}
