// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IValidator} from "kernel/interfaces/IERC7579Modules.sol";
import {PackedUserOperation} from "kernel/interfaces/PackedUserOperation.sol";
import {WebAuthn} from "kernel-7579-plugins/utils/WebAuthn.sol";

import {ITARWebAuthnValidator} from "../interfaces/ITARWebAuthnValidator.sol";

/// @title TARWebAuthnValidator
/// @notice WebAuthn/P-256 Kernel validator compatible with the existing
/// permissionless.js installation format, with an additional in-place key
/// rotation function.
///
/// Security model:
/// - Keys are indexed by msg.sender.
/// - During validation, msg.sender is the Kernel account.
/// - During rotation, the call must also come from the Kernel account.
/// - TAR reaches this function only through Kernel.executeFromExecutor().
/// - TAR therefore has no global rotateFor(account, ...) authority.
contract TARWebAuthnValidator is IValidator, ITARWebAuthnValidator {
    uint256 internal constant MODULE_TYPE_VALIDATOR = 1;
    uint256 internal constant SIG_VALIDATION_SUCCESS_UINT = 0;
    uint256 internal constant SIG_VALIDATION_FAILED_UINT = 1;
    bytes4 internal constant ERC1271_MAGICVALUE = 0x1626ba7e;
    bytes4 internal constant ERC1271_INVALID = 0xffffffff;
    uint256 internal constant CHALLENGE_LOCATION = 23;

    struct WebAuthnPublicKey {
        uint256 pubKeyX;
        uint256 pubKeyY;
    }

    struct StoredKey {
        uint256 pubKeyX;
        uint256 pubKeyY;
        bytes32 credentialIdHash;
        uint64 keyVersion;
    }

    mapping(address account => StoredKey data) private _keys;

    error InvalidPublicKey();

    event WebAuthnRegistered(
        address indexed account, uint256 pubKeyX, uint256 pubKeyY, bytes32 indexed credentialIdHash
    );

    event WebAuthnKeyRotated(
        address indexed account, uint64 indexed keyVersion, uint256 pubKeyX, uint256 pubKeyY, bytes32 credentialIdHash
    );

    /// @notice Called by Kernel while installing this validator.
    ///
    /// This deliberately preserves the format used by the current
    /// WebAuthnValidator selected by permissionless.js:
    ///
    /// abi.encode(
    ///     WebAuthnPublicKey({pubKeyX: x, pubKeyY: y}),
    ///     keccak256(bytes(credentialId))
    /// )
    function onInstall(bytes calldata data) external payable override {
        if (isInitialized(msg.sender)) {
            revert AlreadyInitialized(msg.sender);
        }

        (WebAuthnPublicKey memory publicKey, bytes32 credentialIdHash) = abi.decode(data, (WebAuthnPublicKey, bytes32));

        _validatePublicKey(publicKey.pubKeyX, publicKey.pubKeyY);

        _keys[msg.sender] = StoredKey({
            pubKeyX: publicKey.pubKeyX, pubKeyY: publicKey.pubKeyY, credentialIdHash: credentialIdHash, keyVersion: 0
        });

        emit WebAuthnRegistered(msg.sender, publicKey.pubKeyX, publicKey.pubKeyY, credentialIdHash);
    }

    function onUninstall(bytes calldata) external payable override {
        if (!isInitialized(msg.sender)) {
            revert NotInitialized(msg.sender);
        }

        delete _keys[msg.sender];
    }

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }

    function isInitialized(address smartAccount) public view override returns (bool) {
        return _keys[smartAccount].pubKeyX != 0;
    }

    function keyData(address account)
        external
        view
        override
        returns (uint256 pubKeyX, uint256 pubKeyY, bytes32 credentialIdHash, uint64 keyVersion)
    {
        StoredKey memory key = _keys[account];
        return (key.pubKeyX, key.pubKeyY, key.credentialIdHash, key.keyVersion);
    }

    /// @notice Called by Kernel during ERC-4337 validation.
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        payable
        override
        returns (uint256)
    {
        return _verifySignature(msg.sender, userOpHash, userOp.signature)
            ? SIG_VALIDATION_SUCCESS_UINT
            : SIG_VALIDATION_FAILED_UINT;
    }

    /// @notice Called by Kernel during ERC-1271 validation.
    function isValidSignatureWithSender(address, bytes32 hash, bytes calldata signature)
        external
        view
        override
        returns (bytes4)
    {
        return _verifySignature(msg.sender, hash, signature) ? ERC1271_MAGICVALUE : ERC1271_INVALID;
    }

    /// @notice Rotates only the key belonging to msg.sender.
    ///
    /// Correct final path:
    /// TimelockRecovery.finalizeRecovery()
    ///   -> Kernel.executeFromExecutor(...)
    ///   -> this.rotatePublicKey(...)
    ///
    /// At this point msg.sender is the Kernel, not TAR.
    function rotatePublicKey(uint256 newPubKeyX, uint256 newPubKeyY, bytes32 credentialIdHash) external override {
        StoredKey storage current = _keys[msg.sender];

        if (current.pubKeyX == 0) {
            revert NotInitialized(msg.sender);
        }

        _validatePublicKey(newPubKeyX, newPubKeyY);

        current.pubKeyX = newPubKeyX;
        current.pubKeyY = newPubKeyY;
        current.credentialIdHash = credentialIdHash;

        unchecked {
            current.keyVersion++;
        }

        emit WebAuthnKeyRotated(msg.sender, current.keyVersion, newPubKeyX, newPubKeyY, credentialIdHash);
    }

    function _validatePublicKey(uint256 pubKeyX, uint256 pubKeyY) private pure {
        if (pubKeyX == 0 || pubKeyY == 0) {
            revert InvalidPublicKey();
        }
    }

    /// @dev Signature format kept identical to the reference validator:
    /// abi.encode(
    ///   authenticatorData,
    ///   clientDataJSON,
    ///   responseTypeLocation,
    ///   r,
    ///   s,
    ///   usePrecompiled
    /// )
    function _verifySignature(address account, bytes32 hash, bytes calldata signature) private view returns (bool) {
        StoredKey memory current = _keys[account];
        if (current.pubKeyX == 0) {
            return false;
        }

        (
            bytes memory authenticatorData,
            string memory clientDataJSON,
            uint256 responseTypeLocation,
            uint256 r,
            uint256 s,
            bool usePrecompiled
        ) = abi.decode(signature, (bytes, string, uint256, uint256, uint256, bool));

        return WebAuthn.verifySignature(
            abi.encodePacked(hash),
            authenticatorData,
            true,
            clientDataJSON,
            CHALLENGE_LOCATION,
            responseTypeLocation,
            r,
            s,
            current.pubKeyX,
            current.pubKeyY,
            usePrecompiled
        );
    }

    function setNewOwner(uint256 newPubKeyX, uint256 newPubKeyY) external {
        StoredKey storage current = _keys[msg.sender];

        if (current.pubKeyX == 0) {
            revert NotInitialized(msg.sender);
        }

        _validatePublicKey(newPubKeyX, newPubKeyY);

        current.pubKeyX = newPubKeyX;
        current.pubKeyY = newPubKeyY;

        unchecked {
            current.keyVersion++;
        }

        emit WebAuthnKeyRotated(msg.sender, current.keyVersion, newPubKeyX, newPubKeyY, current.credentialIdHash);
    }
}
