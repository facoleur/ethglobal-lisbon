// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITARWebAuthnValidator {
    function rotatePublicKey(uint256 newPubKeyX, uint256 newPubKeyY, bytes32 credentialIdHash) external;

    function keyData(address account)
        external
        view
        returns (uint256 pubKeyX, uint256 pubKeyY, bytes32 credentialIdHash, uint64 keyVersion);

    function setNewOwner(uint256 newPubKeyX, uint256 newPubKeyY) external;
}
