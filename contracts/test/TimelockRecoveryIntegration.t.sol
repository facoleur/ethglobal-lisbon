// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {TimelockRecovery} from "../src/TimelockRecovery.sol";
import {RotatableWebAuthnValidator} from "../src/RotatableWebAuthnValidator.sol";
import {MockKernelAccount} from "./mocks/MockKernelAccount.sol";

contract TimelockRecoveryIntegrationTest is Test {
    TimelockRecovery internal recovery;
    RotatableWebAuthnValidator internal validator;
    MockKernelAccount internal kernel;

    address internal claimant = address(0xCA11);
    address internal vetoer = address(0xBEEF);

    uint256 internal constant OLD_X = 11;
    uint256 internal constant OLD_Y = 22;
    uint256 internal constant NEW_X = 33;
    uint256 internal constant NEW_Y = 44;

    bytes32 internal constant OLD_CREDENTIAL_HASH = keccak256("old-credential");
    bytes32 internal constant NEW_CREDENTIAL_HASH = keccak256("new-credential");

    uint48 internal constant DELAY = 1 days;
    uint48 internal constant REVEAL_WINDOW = 1 hours;
    uint96 internal constant DEPOSIT = 0.1 ether;

    function setUp() external {
        recovery = new TimelockRecovery(DELAY, REVEAL_WINDOW, DEPOSIT);

        validator = new RotatableWebAuthnValidator();
        kernel = new MockKernelAccount();

        bytes memory validatorData = abi.encode(
            RotatableWebAuthnValidator.WebAuthnPublicKey({pubKeyX: OLD_X, pubKeyY: OLD_Y}), OLD_CREDENTIAL_HASH
        );

        kernel.installValidator(address(validator), validatorData);

        kernel.installExecutor(address(recovery), abi.encode(address(validator), vetoer));

        vm.deal(claimant, 10 ether);
    }

    function testFinalizeRotatesKernelKey() external {
        bytes memory newValidatorData = abi.encode(NEW_X, NEW_Y, NEW_CREDENTIAL_HASH);

        bytes32 salt = keccak256("salt");
        uint64 nonce = recovery.nextRecoveryNonce(address(kernel));

        bytes32 commitment =
            recovery.computeCommitment(address(kernel), claimant, address(validator), newValidatorData, salt, nonce);

        vm.startPrank(claimant);

        recovery.commitRecovery{value: DEPOSIT}(address(kernel), commitment, nonce);

        recovery.revealRecovery(address(kernel), address(validator), newValidatorData, salt);

        vm.stopPrank();

        vm.warp(block.timestamp + DELAY);

        recovery.finalizeRecovery(address(kernel));

        (uint256 x, uint256 y, bytes32 credentialHash, uint64 version) = validator.keyData(address(kernel));

        assertEq(x, NEW_X);
        assertEq(y, NEW_Y);
        assertEq(credentialHash, NEW_CREDENTIAL_HASH);
        assertEq(version, 1);
    }

    function testVetoPreventsFinalization() external {
        bytes memory newValidatorData = abi.encode(NEW_X, NEW_Y, NEW_CREDENTIAL_HASH);

        bytes32 salt = keccak256("salt");
        uint64 nonce = recovery.nextRecoveryNonce(address(kernel));

        bytes32 commitment =
            recovery.computeCommitment(address(kernel), claimant, address(validator), newValidatorData, salt, nonce);

        vm.startPrank(claimant);

        recovery.commitRecovery{value: DEPOSIT}(address(kernel), commitment, nonce);

        recovery.revealRecovery(address(kernel), address(validator), newValidatorData, salt);

        vm.stopPrank();

        vm.prank(vetoer);
        recovery.vetoRecovery(address(kernel));

        vm.warp(block.timestamp + DELAY);

        vm.expectRevert(TimelockRecovery.RecoveryNotPending.selector);
        recovery.finalizeRecovery(address(kernel));
    }

    function testExpiredCommitCanBeCleared() external {
        bytes32 fakeCommitment = keccak256("fake");
        uint64 nonce = recovery.nextRecoveryNonce(address(kernel));

        vm.prank(claimant);
        recovery.commitRecovery{value: DEPOSIT}(address(kernel), fakeCommitment, nonce);

        vm.warp(block.timestamp + REVEAL_WINDOW + 1);

        recovery.expireCommitment(address(kernel));

        TimelockRecovery.Recovery memory state = recovery.getRecovery(address(kernel));

        assertEq(uint256(state.status), uint256(TimelockRecovery.RecoveryStatus.Expired));
    }
}
