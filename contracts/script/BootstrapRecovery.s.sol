// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";

import {IEntryPoint} from "kernel/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "kernel/interfaces/PackedUserOperation.sol";
import {EntryPointLib} from "kernel/sdk/TestBase/erc4337Util.sol";
import {Kernel} from "kernel/Kernel.sol";
import {KernelFactory} from "kernel/factory/KernelFactory.sol";
import {ECDSAValidator} from "kernel/validator/ECDSAValidator.sol";
import {IHook} from "kernel/interfaces/IERC7579Modules.sol";
import {ValidatorLib} from "kernel/utils/ValidationTypeLib.sol";
import {ValidationId} from "kernel/types/Types.sol";

import {TimelockRecovery} from "../src/TimelockRecovery.sol";
import {RotatableWebAuthnValidator} from "../src/RotatableWebAuthnValidator.sol";

/// @title BootstrapRecovery
/// @notice Local Anvil bootstrap + end-to-end recovery smoke test.
///
/// What this script does:
/// 1. Deploys EntryPoint, Kernel implementation and KernelFactory.
/// 2. Deploys an ECDSA root validator used only to make local testing easy.
/// 3. Creates a Kernel smart account.
/// 4. Deploys and installs RotatableWebAuthnValidator as a validator module.
/// 5. Deploys and installs TimelockRecovery as an executor module.
/// 6. Executes commit -> reveal -> finalize.
/// 7. Verifies that the WebAuthn key stored for the Kernel was rotated.
///
/// For a one-command local smoke test, keep RECOVERY_DELAY_SECONDS=0.
contract BootstrapRecovery is Script {
    uint256 internal constant MODULE_TYPE_VALIDATOR = 1;
    uint256 internal constant MODULE_TYPE_EXECUTOR = 2;

    // Default Anvil keys from the standard "test test ... junk" mnemonic.
    uint256 internal constant ANVIL_RELAYER_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 internal constant ANVIL_OWNER_KEY = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690;

    struct WebAuthnPublicKey {
        uint256 pubKeyX;
        uint256 pubKeyY;
    }

    function run() external {
        uint256 relayerKey = vm.envOr("RELAYER_PRIVATE_KEY", ANVIL_RELAYER_KEY);
        uint256 ownerKey = vm.envOr("OWNER_PRIVATE_KEY", ANVIL_OWNER_KEY);

        address relayer = vm.addr(relayerKey);
        address owner = vm.addr(ownerKey);
        address vetoer = vm.envOr("VETOER_ADDRESS", owner);

        uint48 recoveryDelay = uint48(vm.envOr("RECOVERY_DELAY_SECONDS", uint256(0)));
        uint48 revealWindow = uint48(vm.envOr("REVEAL_WINDOW_SECONDS", uint256(1 hours)));
        uint96 minimumDeposit = uint96(vm.envOr("MINIMUM_DEPOSIT_WEI", uint256(0.01 ether)));

        // Dummy non-zero P-256 coordinates for the local module-flow smoke test.
        // Replace these with real passkey coordinates in the frontend integration.
        uint256 oldPubKeyX = vm.envOr("OLD_PUBKEY_X", uint256(111));
        uint256 oldPubKeyY = vm.envOr("OLD_PUBKEY_Y", uint256(222));
        bytes32 oldCredentialIdHash = vm.envOr("OLD_CREDENTIAL_ID_HASH", keccak256("old-local-credential"));

        uint256 newPubKeyX = vm.envOr("NEW_PUBKEY_X", uint256(333));
        uint256 newPubKeyY = vm.envOr("NEW_PUBKEY_Y", uint256(444));
        bytes32 newCredentialIdHash = vm.envOr("NEW_CREDENTIAL_ID_HASH", keccak256("new-local-credential"));

        console2.log("Relayer / claimant:", relayer);
        console2.log("Temporary ECDSA root owner:", owner);
        console2.log("Recovery vetoer:", vetoer);

        vm.startBroadcast(relayerKey);

        // -----------------------------------------------------------------
        // 1. Core Kernel infrastructure
        // -----------------------------------------------------------------

        IEntryPoint entryPoint = IEntryPoint(EntryPointLib.deploy());
        Kernel implementation = new Kernel(entryPoint);
        KernelFactory factory = new KernelFactory(address(implementation));
        ECDSAValidator rootValidator = new ECDSAValidator();

        console2.log("EntryPoint:", address(entryPoint));
        console2.log("Kernel implementation:", address(implementation));
        console2.log("KernelFactory:", address(factory));
        console2.log("Temporary ECDSA root validator:", address(rootValidator));

        // -----------------------------------------------------------------
        // 2. Counterfactual Kernel account
        // -----------------------------------------------------------------

        ValidationId rootValidation = ValidatorLib.validatorToIdentifier(rootValidator);

        bytes memory rootValidatorData = abi.encodePacked(owner);

        bytes memory kernelInitData = abi.encodeWithSelector(
            Kernel.initialize.selector, rootValidation, IHook(address(0)), rootValidatorData, bytes(""), new bytes[](0)
        );

        bytes32 accountSalt = bytes32(0);
        address predictedKernel = factory.getAddress(kernelInitData, accountSalt);
        Kernel kernel = Kernel(payable(predictedKernel));

        // Fund the counterfactual account before deployment.
        (bool funded,) = predictedKernel.call{value: 1 ether}("");
        require(funded, "Kernel funding failed");

        bytes memory initCode = abi.encodePacked(
            address(factory), abi.encodeWithSelector(KernelFactory.createAccount.selector, kernelInitData, accountSalt)
        );

        _sendRootUserOp(entryPoint, predictedKernel, initCode, hex"", ownerKey, relayer);

        require(predictedKernel.code.length > 0, "Kernel deployment failed");
        console2.log("Kernel account:", predictedKernel);

        // -----------------------------------------------------------------
        // 3. Deploy TAR + rotatable WebAuthn validator
        // -----------------------------------------------------------------

        TimelockRecovery recovery = new TimelockRecovery(recoveryDelay, revealWindow, minimumDeposit);

        RotatableWebAuthnValidator webAuthnValidator = new RotatableWebAuthnValidator();

        console2.log("TimelockRecovery:", address(recovery));
        console2.log("RotatableWebAuthnValidator:", address(webAuthnValidator));

        // -----------------------------------------------------------------
        // 4. Install WebAuthn validator module
        // -----------------------------------------------------------------

        bytes memory webAuthnValidatorData =
            abi.encode(WebAuthnPublicKey({pubKeyX: oldPubKeyX, pubKeyY: oldPubKeyY}), oldCredentialIdHash);

        // Kernel v3.1 validator initData:
        // hook address || abi.encode(validatorData, hookData, selectorData)
        bytes memory validatorInstallData =
            abi.encodePacked(address(0), abi.encode(webAuthnValidatorData, bytes(""), bytes("")));

        bytes memory installValidatorCall = abi.encodeWithSelector(
            Kernel.installModule.selector, MODULE_TYPE_VALIDATOR, address(webAuthnValidator), validatorInstallData
        );

        _sendRootUserOp(entryPoint, predictedKernel, hex"", installValidatorCall, ownerKey, relayer);

        require(webAuthnValidator.isInitialized(predictedKernel), "WebAuthn validator installation failed");

        console2.log("WebAuthn validator installed");

        // -----------------------------------------------------------------
        // 5. Install TAR executor module
        // -----------------------------------------------------------------

        bytes memory executorData = abi.encode(address(webAuthnValidator), vetoer);

        // Kernel v3.1 executor initData:
        // hook address || abi.encode(executorData, hookData)
        bytes memory executorInstallData = abi.encodePacked(address(0), abi.encode(executorData, bytes("")));

        bytes memory installExecutorCall = abi.encodeWithSelector(
            Kernel.installModule.selector, MODULE_TYPE_EXECUTOR, address(recovery), executorInstallData
        );

        _sendRootUserOp(entryPoint, predictedKernel, hex"", installExecutorCall, ownerKey, relayer);

        require(
            kernel.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(recovery), hex""), "TAR executor installation failed"
        );

        require(recovery.isInitialized(predictedKernel), "TAR account configuration missing");

        console2.log("TAR executor installed");

        // -----------------------------------------------------------------
        // 6. Full recovery smoke test
        // -----------------------------------------------------------------

        bytes memory newValidatorData = abi.encode(newPubKeyX, newPubKeyY, newCredentialIdHash);

        uint64 nonce = recovery.nextRecoveryNonce(predictedKernel);
        bytes32 recoverySalt = keccak256(abi.encodePacked("LOCAL_RECOVERY_SALT", predictedKernel, block.chainid));

        bytes32 commitment = recovery.computeCommitment(
            predictedKernel, relayer, address(webAuthnValidator), newValidatorData, recoverySalt, nonce
        );

        recovery.commitRecovery{value: minimumDeposit}(predictedKernel, commitment, nonce);

        console2.log("Recovery committed");

        recovery.revealRecovery(predictedKernel, address(webAuthnValidator), newValidatorData, recoverySalt);

        console2.log("Recovery revealed");

        // A non-zero recovery delay is intended for real deployments.
        // For this one-command broadcast smoke test, use delay = 0.
        require(recoveryDelay == 0, "Set RECOVERY_DELAY_SECONDS=0 for the automatic smoke test");

        recovery.finalizeRecovery(predictedKernel);

        console2.log("Recovery finalized");

        (uint256 storedX, uint256 storedY, bytes32 storedCredentialHash, uint64 keyVersion) =
            webAuthnValidator.keyData(predictedKernel);

        require(storedX == newPubKeyX, "pubKeyX was not rotated");
        require(storedY == newPubKeyY, "pubKeyY was not rotated");
        require(storedCredentialHash == newCredentialIdHash, "credential hash was not rotated");
        require(keyVersion == 1, "unexpected key version");

        console2.log("Rotated pubKeyX:", storedX);
        console2.log("Rotated pubKeyY:", storedY);
        console2.log("WebAuthn key version:", keyVersion);
        console2.log("BootstrapRecovery completed successfully");

        vm.stopBroadcast();
    }

    /// @dev Builds, signs and submits a root-validator UserOperation.
    function _sendRootUserOp(
        IEntryPoint entryPoint,
        address sender,
        bytes memory initCode,
        bytes memory callData,
        uint256 signerKey,
        address relayer
    ) internal {
        PackedUserOperation memory op = PackedUserOperation({
            sender: sender,
            nonce: entryPoint.getNonce(sender, 0),
            initCode: initCode,
            callData: callData,
            accountGasLimits: bytes32(abi.encodePacked(uint128(1_500_000), uint128(1_500_000))),
            preVerificationGas: 150_000,
            gasFees: bytes32(abi.encodePacked(uint128(1 gwei), uint128(1 gwei))),
            paymasterAndData: hex"",
            signature: hex""
        });

        bytes32 userOpHash = entryPoint.getUserOpHash(op);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, userOpHash);
        op.signature = abi.encodePacked(r, s, v);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;

        entryPoint.handleOps{gas: 5_000_000}(ops, payable(relayer));
    }
}
