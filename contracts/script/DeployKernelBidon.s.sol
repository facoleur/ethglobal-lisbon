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
import {ExecLib} from "kernel/utils/ExecLib.sol";
import {NoopExecutor} from "../src/NoopExecutor.sol";

/// @notice Section 2a dummy deployment: validates Kernel/ERC-7579 mechanics
/// (factory, installModule, EntryPoint.handleOps) with a standard ECDSA
/// validator, independently of the WebAuthn/P-256 path (section 2b).
/// No TAR business logic is involved — the executor installed here is a no-op.
contract DeployKernelBidon is Script {
    uint256 constant MODULE_TYPE_EXECUTOR = 2;

    // Anvil default mnemonic accounts ("test test test ... junk"), overridable via env.
    uint256 constant ANVIL_RELAYER_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant ANVIL_OWNER_KEY = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690;

    function run() external {
        uint256 relayerKey = vm.envOr("RELAYER_PRIVATE_KEY", ANVIL_RELAYER_KEY);
        uint256 ownerKey = vm.envOr("OWNER_PRIVATE_KEY", ANVIL_OWNER_KEY);
        address relayer = vm.addr(relayerKey);
        address owner = vm.addr(ownerKey);

        console2.log("Relayer (self-relay EOA):", relayer);
        console2.log("Kernel owner (ECDSA root validator signer):", owner);

        vm.startBroadcast(relayerKey);

        // 1. EntryPoint v0.7 — deployed at its canonical address via the well-known
        // deterministic deployer (predeployed on Anvil), matching what a real network provides.
        IEntryPoint entrypoint = IEntryPoint(EntryPointLib.deploy());
        console2.log("EntryPoint:", address(entrypoint));

        // 2. Kernel implementation + KernelFactory.
        Kernel implementation = new Kernel(entrypoint);
        KernelFactory factory = new KernelFactory(address(implementation));
        console2.log("Kernel implementation:", address(implementation));
        console2.log("KernelFactory:", address(factory));

        // 3. ECDSAValidator — standard validator, no WebAuthn/P-256 involved.
        ECDSAValidator validator = new ECDSAValidator();
        console2.log("ECDSAValidator:", address(validator));

        // 4. Counterfactual account address.
        ValidationId rootValidation = ValidatorLib.validatorToIdentifier(validator);
        bytes memory validatorData = abi.encodePacked(owner);
        bytes memory initData = abi.encodeWithSelector(
            Kernel.initialize.selector, rootValidation, IHook(address(0)), validatorData, bytes(""), new bytes[](0)
        );
        bytes32 salt = bytes32(0);
        address predicted = factory.getAddress(initData, salt);
        Kernel kernel = Kernel(payable(predicted));
        console2.log("Predicted Kernel account:", predicted);

        // 5. Funding — Anvil accounts are prefunded, so a plain transfer is enough.
        (bool funded,) = predicted.call{value: 1 ether}("");
        require(funded, "funding of counterfactual account failed");

        // 6-7. UserOp deployment: initCode = factory + createAccount(initData, salt), signed by owner.
        bytes memory initCode = abi.encodePacked(
            address(factory), abi.encodeWithSelector(KernelFactory.createAccount.selector, initData, salt)
        );
        _sendRootUserOp(entrypoint, predicted, initCode, hex"", ownerKey, relayer);

        require(predicted.code.length > 0, "kernel account was not deployed");
        require(
            ValidationId.unwrap(kernel.rootValidator()) == ValidationId.unwrap(rootValidation),
            "ECDSAValidator is not root validator"
        );
        console2.log("Kernel account deployed and ECDSAValidator confirmed as root validator");

        // 8. Simple applicative UserOp through the same path: 0 ETH transfer to self.
        bytes memory selfCallData = abi.encodeWithSelector(
            Kernel.execute.selector, ExecLib.encodeSimpleSingle(), ExecLib.encodeSingle(predicted, 0, hex"")
        );
        _sendRootUserOp(entrypoint, predicted, hex"", selfCallData, ownerKey, relayer);
        console2.log("Self-transfer UserOp executed via EntryPoint.handleOps");

        // 9. Dummy executor module (type 2): install, verify, uninstall.
        NoopExecutor noopExecutor = new NoopExecutor();
        console2.log("NoopExecutor:", address(noopExecutor));

        bytes memory installData = abi.encodePacked(address(0), abi.encode(bytes(""), bytes("")));
        bytes memory installCallData = abi.encodeWithSelector(
            Kernel.installModule.selector, MODULE_TYPE_EXECUTOR, address(noopExecutor), installData
        );
        _sendRootUserOp(entrypoint, predicted, hex"", installCallData, ownerKey, relayer);

        require(
            kernel.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(noopExecutor), hex""), "executor was not installed"
        );
        console2.log("NoopExecutor installed and isModuleInstalled confirmed");

        bytes memory uninstallCallData =
            abi.encodeWithSelector(Kernel.uninstallModule.selector, MODULE_TYPE_EXECUTOR, address(noopExecutor), hex"");
        _sendRootUserOp(entrypoint, predicted, hex"", uninstallCallData, ownerKey, relayer);

        require(
            !kernel.isModuleInstalled(MODULE_TYPE_EXECUTOR, address(noopExecutor), hex""),
            "executor was not uninstalled"
        );
        console2.log("NoopExecutor uninstalled and isModuleInstalled confirmed false");
        console2.log("DeployKernelBidon: end-to-end scenario completed successfully");

        vm.stopBroadcast();
    }

    /// @dev Builds, signs (root validator mode, nonce key 0) and submits a single UserOp
    /// via EntryPoint.handleOps — no bundler, self-relayed by `relayer`.
    function _sendRootUserOp(
        IEntryPoint entrypoint,
        address sender,
        bytes memory initCode,
        bytes memory callData,
        uint256 signerKey,
        address relayer
    ) internal {
        PackedUserOperation memory op = PackedUserOperation({
            sender: sender,
            nonce: entrypoint.getNonce(sender, 0),
            initCode: initCode,
            callData: callData,
            accountGasLimits: bytes32(abi.encodePacked(uint128(1_000_000), uint128(1_000_000))),
            preVerificationGas: 100_000,
            gasFees: bytes32(abi.encodePacked(uint128(1 gwei), uint128(1 gwei))),
            paymasterAndData: hex"",
            signature: hex""
        });

        bytes32 userOpHash = entrypoint.getUserOpHash(op);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, userOpHash);
        op.signature = abi.encodePacked(r, s, v);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = op;
        // Explicit gas: EntryPoint's AA95 pre-check requires the outer tx to have at least
        // verificationGasLimit + callGasLimit headroom available, which forge's usual
        // gas-used-based broadcast estimate does not account for.
        entrypoint.handleOps{gas: 3_000_000}(ops, payable(relayer));
    }
}
