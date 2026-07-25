// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IModule} from "kernel/interfaces/IERC7579Modules.sol";
import {PackedUserOperation} from "kernel/interfaces/PackedUserOperation.sol";
import {Base64URL} from "kernel-7579-plugins/utils/Base64URL.sol";
import {TARWebAuthnValidator} from "../../src/validators/TARWebAuthnValidator.sol";
import {ITARWebAuthnValidator} from "../../src/interfaces/ITARWebAuthnValidator.sol";

/// @notice Milestone D: `TARWebAuthnValidator` — fork of Kernel's `WebAuthnValidator` with
/// an added `rotatePublicKey`/`setNewOwner` rotation path for TAR's `finalizeRecovery`. Covers
/// the full module lifecycle, both rotation entry points (`rotatePublicKey` used directly,
/// `setNewOwner` — the one `TARRecoveryExecutor.finalizeRecovery` actually calls), and a real
/// WebAuthn/P-256 signature round-trip (`validateUserOp`/`isValidSignatureWithSender`) using
/// Foundry's P-256 cheatcodes, same technique as `script/spike/SpikeWebAuthn.s.sol`.
contract TARWebAuthnValidatorTest is Test {
    // Byte offset of `"type":"webauthn.get"` inside clientDataJSON — fixed by the envelope shape
    // built in `_buildWebAuthnSignature`, mirrors `SpikeWebAuthn.s.sol`.
    uint256 constant RESPONSE_TYPE_LOCATION = 1;

    TARWebAuthnValidator validator;
    address account = address(0xACC0);

    uint256 pubKeyX;
    uint256 pubKeyY;
    bytes32 credentialIdHash = keccak256("credential-id");

    function setUp() external {
        validator = new TARWebAuthnValidator();
        (pubKeyX, pubKeyY) = vm.publicKeyP256(uint256(keccak256("tar-webauthn-test-key")));
    }

    function _install(address a, uint256 x, uint256 y, bytes32 credHash) internal {
        vm.prank(a);
        validator.onInstall(abi.encode(TARWebAuthnValidator.WebAuthnPublicKey({pubKeyX: x, pubKeyY: y}), credHash));
    }

    // ---------------------------------------------------------------------
    // onInstall / onUninstall / isModuleType / isInitialized / keyData
    // ---------------------------------------------------------------------

    function test_onInstall_validParams_storesKeyAndEmits() external {
        vm.expectEmit(true, true, false, true, address(validator));
        emit TARWebAuthnValidator.WebAuthnRegistered(account, pubKeyX, pubKeyY, credentialIdHash);
        _install(account, pubKeyX, pubKeyY, credentialIdHash);

        (uint256 x, uint256 y, bytes32 credHash, uint64 version) = validator.keyData(account);
        assertEq(x, pubKeyX);
        assertEq(y, pubKeyY);
        assertEq(credHash, credentialIdHash);
        assertEq(version, 0);
        assertTrue(validator.isInitialized(account));
    }

    function test_onInstall_calledTwice_reverts() external {
        _install(account, pubKeyX, pubKeyY, credentialIdHash);

        vm.expectRevert(abi.encodeWithSelector(IModule.AlreadyInitialized.selector, account));
        _install(account, pubKeyX, pubKeyY, credentialIdHash);
    }

    function test_onInstall_zeroPubKeyX_reverts() external {
        vm.prank(account);
        vm.expectRevert(TARWebAuthnValidator.InvalidPublicKey.selector);
        validator.onInstall(
            abi.encode(TARWebAuthnValidator.WebAuthnPublicKey({pubKeyX: 0, pubKeyY: pubKeyY}), credentialIdHash)
        );
    }

    function test_onInstall_zeroPubKeyY_reverts() external {
        vm.prank(account);
        vm.expectRevert(TARWebAuthnValidator.InvalidPublicKey.selector);
        validator.onInstall(
            abi.encode(TARWebAuthnValidator.WebAuthnPublicKey({pubKeyX: pubKeyX, pubKeyY: 0}), credentialIdHash)
        );
    }

    function test_onUninstall_notInitialized_reverts() external {
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(IModule.NotInitialized.selector, account));
        validator.onUninstall("");
    }

    function test_onUninstall_nominal_clearsKey() external {
        _install(account, pubKeyX, pubKeyY, credentialIdHash);

        vm.prank(account);
        validator.onUninstall("");

        assertFalse(validator.isInitialized(account));
        (uint256 x,,,) = validator.keyData(account);
        assertEq(x, 0);
    }

    function test_isModuleType_validatorTypeIsTrue_othersAreFalse() external view {
        assertTrue(validator.isModuleType(1));
        assertFalse(validator.isModuleType(2));
        assertFalse(validator.isModuleType(3));
        assertFalse(validator.isModuleType(0));
    }

    // ---------------------------------------------------------------------
    // rotatePublicKey — direct rotation path (not the one TAR calls, but same guard/effects
    // minus credentialIdHash handling; see setNewOwner below for the divergence).
    // ---------------------------------------------------------------------

    function test_rotatePublicKey_notInitialized_reverts() external {
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(IModule.NotInitialized.selector, account));
        validator.rotatePublicKey(pubKeyX, pubKeyY, credentialIdHash);
    }

    function test_rotatePublicKey_zeroPubKey_reverts() external {
        _install(account, pubKeyX, pubKeyY, credentialIdHash);

        vm.prank(account);
        vm.expectRevert(TARWebAuthnValidator.InvalidPublicKey.selector);
        validator.rotatePublicKey(0, pubKeyY, credentialIdHash);
    }

    function test_rotatePublicKey_valid_updatesKeyCredentialAndVersionAndEmits() external {
        _install(account, pubKeyX, pubKeyY, credentialIdHash);

        (uint256 newX, uint256 newY) = vm.publicKeyP256(uint256(keccak256("rotated-key")));
        bytes32 newCredHash = keccak256("rotated-credential-id");

        vm.expectEmit(true, true, false, true, address(validator));
        emit TARWebAuthnValidator.WebAuthnKeyRotated(account, 1, newX, newY, newCredHash);
        vm.prank(account);
        validator.rotatePublicKey(newX, newY, newCredHash);

        (uint256 x, uint256 y, bytes32 credHash, uint64 version) = validator.keyData(account);
        assertEq(x, newX);
        assertEq(y, newY);
        assertEq(credHash, newCredHash);
        assertEq(version, 1);
    }

    // ---------------------------------------------------------------------
    // setNewOwner — the rotation entry point `TARRecoveryExecutor.finalizeRecovery` actually
    // calls (`abi.encodeWithSignature("setNewOwner(uint256,uint256)", pubKeyX, pubKeyY)`).
    // ---------------------------------------------------------------------

    function test_setNewOwner_notInitialized_reverts() external {
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(IModule.NotInitialized.selector, account));
        validator.setNewOwner(pubKeyX, pubKeyY);
    }

    function test_setNewOwner_zeroPubKeyX_reverts() external {
        _install(account, pubKeyX, pubKeyY, credentialIdHash);

        vm.prank(account);
        vm.expectRevert(TARWebAuthnValidator.InvalidPublicKey.selector);
        validator.setNewOwner(0, pubKeyY);
    }

    function test_setNewOwner_zeroPubKeyY_reverts() external {
        _install(account, pubKeyX, pubKeyY, credentialIdHash);

        vm.prank(account);
        vm.expectRevert(TARWebAuthnValidator.InvalidPublicKey.selector);
        validator.setNewOwner(pubKeyX, 0);
    }

    function test_setNewOwner_valid_updatesKeyIncrementsVersionAndEmits() external {
        _install(account, pubKeyX, pubKeyY, credentialIdHash);

        (uint256 newX, uint256 newY) = vm.publicKeyP256(uint256(keccak256("tar-recovered-key")));

        vm.expectEmit(true, true, false, true, address(validator));
        emit TARWebAuthnValidator.WebAuthnKeyRotated(account, 1, newX, newY, credentialIdHash);
        vm.prank(account);
        validator.setNewOwner(newX, newY);

        (uint256 x, uint256 y, bytes32 credHash, uint64 version) = validator.keyData(account);
        assertEq(x, newX);
        assertEq(y, newY);
        assertEq(version, 1);
        // Unlike rotatePublicKey, setNewOwner has no credentialIdHash parameter — TAR's
        // RecoveryRequest never carried one (only pubKeyX/pubKeyY, since Milestone C), so the
        // pre-recovery credentialIdHash survives a TAR-driven rotation unchanged. Flagged to the
        // team: intentional, or should TAR's recovery flow carry a credentialIdHash too?
        assertEq(credHash, credentialIdHash);
    }

    function test_setNewOwner_onlyRotatesCallersOwnKey() external {
        address otherAccount = address(0xACC1);
        _install(account, pubKeyX, pubKeyY, credentialIdHash);
        _install(otherAccount, pubKeyX, pubKeyY, credentialIdHash);

        (uint256 newX, uint256 newY) = vm.publicKeyP256(uint256(keccak256("account-only-key")));
        vm.prank(account);
        validator.setNewOwner(newX, newY);

        (uint256 otherX, uint256 otherY,,) = validator.keyData(otherAccount);
        assertEq(otherX, pubKeyX);
        assertEq(otherY, pubKeyY);
    }

    // ---------------------------------------------------------------------
    // Real WebAuthn/P-256 signature round-trip — proves _verifySignature (shared by
    // validateUserOp and isValidSignatureWithSender) actually accepts a genuine P-256 signature
    // over the expected message, and rejects a wrong key / tampered hash. Uses Foundry's P-256
    // cheatcodes (vm.publicKeyP256/vm.signP256), same technique as SpikeWebAuthn.s.sol.
    // ---------------------------------------------------------------------

    function test_isValidSignatureWithSender_genuineSignature_returnsMagicValue() external {
        // Skipped under `forge test`: its in-process EVM's RIP-7212 (0x0100) precompile stub
        // returns empty data instead of performing real P-256 verification, so this always fails
        // regardless of contract correctness — confirmed by calling the precompile directly
        // against a live `anvil` node with the exact same vector, which correctly returns 1.
        // Same known gap as `script/spike/SpikeWebAuthn.s.sol` (section 2b) for Kernel's stock
        // `WebAuthnValidator` — not specific to this contract. Left in place (skipped, not
        // deleted) as a regression check for whenever this is run against a real node/precompile.
        vm.skip(true, "forge test's local P-256 precompile stub does not verify signatures - see section 2b");
        _install(account, pubKeyX, pubKeyY, credentialIdHash);
        bytes32 hash = keccak256("some ERC-1271 hash to sign");
        bytes memory signature = _buildWebAuthnSignature(hash, uint256(keccak256("tar-webauthn-test-key")));

        vm.prank(account);
        bytes4 result = validator.isValidSignatureWithSender(address(0), hash, signature);
        assertEq(result, bytes4(0x1626ba7e));
    }

    /// @dev Note: under `forge test`'s broken local P-256 precompile stub (see the skipped test
    /// above), the precompile call itself always resolves to "invalid" regardless of input — so
    /// this test currently cannot distinguish "correctly rejected wrong key" from "precompile
    /// stub is broken". It's a valid coarse smoke test either way (a bad signature must never
    /// validate) but is not, by itself, proof of genuine cryptographic discrimination in this
    /// environment; that proof is the same one the skipped positive-case test is waiting on.
    function test_isValidSignatureWithSender_wrongKey_returnsInvalid() external {
        _install(account, pubKeyX, pubKeyY, credentialIdHash);
        bytes32 hash = keccak256("some ERC-1271 hash to sign");
        bytes memory signature = _buildWebAuthnSignature(hash, uint256(keccak256("a-different-key")));

        vm.prank(account);
        bytes4 result = validator.isValidSignatureWithSender(address(0), hash, signature);
        assertEq(result, bytes4(0xffffffff));
    }

    function test_validateUserOp_genuineSignature_succeeds() external {
        // See test_isValidSignatureWithSender_genuineSignature_returnsMagicValue: same broken
        // local P-256 precompile stub, same confirmed-against-live-anvil root cause.
        vm.skip(true, "forge test's local P-256 precompile stub does not verify signatures - see section 2b");
        _install(account, pubKeyX, pubKeyY, credentialIdHash);
        bytes32 userOpHash = keccak256("a userOp hash");
        bytes memory signature = _buildWebAuthnSignature(userOpHash, uint256(keccak256("tar-webauthn-test-key")));

        PackedUserOperation memory userOp;
        userOp.signature = signature;

        vm.prank(account);
        uint256 result = validator.validateUserOp(userOp, userOpHash);
        assertEq(result, 0); // SIG_VALIDATION_SUCCESS_UINT
    }

    /// @dev Mirrors `SpikeWebAuthn.s.sol._buildWebAuthnSignature`: builds a WebAuthn assertion
    /// envelope around `hash` and signs it with the given P-256 key, in the exact format
    /// `TARWebAuthnValidator._verifySignature` expects.
    function _buildWebAuthnSignature(bytes32 hash, uint256 p256PrivateKey) internal pure returns (bytes memory) {
        bytes memory challenge = abi.encodePacked(hash);
        string memory challengeB64url = Base64URL.encode(challenge);

        string memory clientDataJSON = string.concat(
            '{"type":"webauthn.get","challenge":"',
            challengeB64url,
            '","origin":"https://example.com","crossOrigin":false}'
        );

        bytes memory authenticatorData = abi.encodePacked(keccak256("test-rp-id"), bytes1(0x05), bytes4(0));

        bytes32 clientDataJSONHash = sha256(bytes(clientDataJSON));
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, clientDataJSONHash));

        (bytes32 r, bytes32 s) = vm.signP256(p256PrivateKey, messageHash);

        return abi.encode(authenticatorData, clientDataJSON, RESPONSE_TYPE_LOCATION, uint256(r), uint256(s), true);
    }
}
