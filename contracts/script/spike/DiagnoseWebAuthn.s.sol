// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {WebAuthn} from "kernel-7579-plugins/utils/WebAuthn.sol";
import {Base64URL} from "kernel-7579-plugins/utils/Base64URL.sol";
import {P256} from "kernel-7579-plugins/utils/P256.sol";

contract DiagnoseWebAuthn is Script {
    uint256 constant CHALLENGE_LOCATION = 23;
    uint256 constant RESPONSE_TYPE_LOCATION = 1;

    function run() external view {
        uint256 p256PrivateKey = uint256(keccak256("6th-republic-tar-p256-spike-webauthn-key"));
        (uint256 pubKeyX, uint256 pubKeyY) = vm.publicKeyP256(p256PrivateKey);

        bytes32 userOpHash = 0x7e511301ff1ad60fcb5c4ed81db24df0d90e7ef9ebf9b8961b137336a89541e0;
        bytes memory challenge = abi.encodePacked(userOpHash);
        string memory challengeB64url = Base64URL.encode(challenge);
        console2.log("challengeB64url:", challengeB64url);

        string memory clientDataJSON = string.concat(
            '{"type":"webauthn.get","challenge":"',
            challengeB64url,
            '","origin":"https://example.com","crossOrigin":false}'
        );
        console2.log("clientDataJSON:", clientDataJSON);

        bytes memory authenticatorData = abi.encodePacked(keccak256("test-rp-id"), bytes1(0x05), bytes4(0));

        bool authFlagsOk = authenticatorData.length >= 37 && WebAuthn.checkAuthFlags(authenticatorData[32], true);
        console2.log("authFlagsOk:", authFlagsOk);

        bool responseTypeOk = WebAuthn.contains('"type":"webauthn.get"', clientDataJSON, RESPONSE_TYPE_LOCATION);
        console2.log("responseTypeOk:", responseTypeOk);

        string memory challengeProperty = string.concat('"challenge":"', challengeB64url, '"');
        bool challengeOk = WebAuthn.contains(challengeProperty, clientDataJSON, CHALLENGE_LOCATION);
        console2.log("challengeOk:", challengeOk);

        bytes32 clientDataJSONHash = sha256(bytes(clientDataJSON));
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, clientDataJSONHash));
        (bytes32 r, bytes32 s) = vm.signP256(p256PrivateKey, messageHash);

        bool sigOk = P256.verifySignature(messageHash, uint256(r), uint256(s), pubKeyX, pubKeyY, true);
        console2.log("sigOk (precompile):", sigOk);
        bool sigOkFallback = P256.verifySignature(messageHash, uint256(r), uint256(s), pubKeyX, pubKeyY, false);
        console2.log("sigOk (solidity fallback):", sigOkFallback);
    }
}
