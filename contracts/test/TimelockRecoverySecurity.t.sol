// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {TimelockRecovery} from "../src/TimelockRecovery.sol";
import {RotatableWebAuthnValidator} from "../src/RotatableWebAuthnValidator.sol";
import {MockKernelAccount} from "./mocks/MockKernelAccount.sol";

/// @title TimelockRecoverySecurityTest
/// @notice Adversarial and edge-case coverage for TAR.
contract TimelockRecoverySecurityTest is Test {
    TimelockRecovery internal recovery;
    RotatableWebAuthnValidator internal validator;
    RotatableWebAuthnValidator internal otherValidator;
    MockKernelAccount internal kernel;

    address internal claimant = address(0xCA11);
    address internal attacker = address(0xBAD);
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
        otherValidator = new RotatableWebAuthnValidator();
        kernel = new MockKernelAccount();

        bytes memory validatorData = abi.encode(
            RotatableWebAuthnValidator.WebAuthnPublicKey({pubKeyX: OLD_X, pubKeyY: OLD_Y}), OLD_CREDENTIAL_HASH
        );

        kernel.installValidator(address(validator), validatorData);

        kernel.installExecutor(address(recovery), abi.encode(address(validator), vetoer));

        vm.deal(claimant, 10 ether);
        vm.deal(attacker, 10 ether);
    }

    function testCommitRejectsDepositBelowMinimum() external {
        uint64 nonce = recovery.nextRecoveryNonce(address(kernel));

        vm.prank(claimant);
        vm.expectRevert(TimelockRecovery.DepositTooSmall.selector);
        recovery.commitRecovery{value: DEPOSIT - 1}(address(kernel), keccak256("commitment"), nonce);
    }

    function testCommitRejectsWrongNonce() external {
        uint64 nonce = recovery.nextRecoveryNonce(address(kernel));

        vm.prank(claimant);
        vm.expectRevert(TimelockRecovery.InvalidReveal.selector);
        recovery.commitRecovery{value: DEPOSIT}(address(kernel), keccak256("commitment"), nonce + 1);
    }

    function testCommitRejectsUnconfiguredAccount() external {
        address unknownAccount = address(0x1234);

        vm.prank(claimant);
        vm.expectRevert(TimelockRecovery.RecoveryNotEnabled.selector);
        recovery.commitRecovery{value: DEPOSIT}(unknownAccount, keccak256("commitment"), 1);
    }

    function testSecondActiveCommitIsRejected() external {
        (bytes memory validatorData, bytes32 salt, uint64 nonce, bytes32 commitment) = _recoveryInputs();

        vm.prank(claimant);
        recovery.commitRecovery{value: DEPOSIT}(address(kernel), commitment, nonce);

        vm.prank(attacker);
        vm.expectRevert(TimelockRecovery.RecoveryAlreadyActive.selector);
        recovery.commitRecovery{value: DEPOSIT}(
            address(kernel), keccak256(abi.encode(validatorData, salt, attacker)), nonce + 1
        );
    }

    function testRevealRejectsDifferentClaimant() external {
        (bytes memory validatorData, bytes32 salt, uint64 nonce, bytes32 commitment) = _recoveryInputs();

        vm.prank(claimant);
        recovery.commitRecovery{value: DEPOSIT}(address(kernel), commitment, nonce);

        vm.prank(attacker);
        vm.expectRevert(TimelockRecovery.Unauthorized.selector);
        recovery.revealRecovery(address(kernel), address(validator), validatorData, salt);
    }

    function testRevealRejectsWrongSalt() external {
        (bytes memory validatorData,, uint64 nonce, bytes32 commitment) = _recoveryInputs();

        vm.startPrank(claimant);
        recovery.commitRecovery{value: DEPOSIT}(address(kernel), commitment, nonce);

        vm.expectRevert(TimelockRecovery.InvalidReveal.selector);
        recovery.revealRecovery(address(kernel), address(validator), validatorData, keccak256("wrong-salt"));
        vm.stopPrank();
    }

    function testRevealRejectsWrongValidator() external {
        bytes memory validatorData = _newValidatorData();
        bytes32 salt = keccak256("salt");
        uint64 nonce = recovery.nextRecoveryNonce(address(kernel));

        bytes32 commitment =
            recovery.computeCommitment(address(kernel), claimant, address(otherValidator), validatorData, salt, nonce);

        vm.startPrank(claimant);
        recovery.commitRecovery{value: DEPOSIT}(address(kernel), commitment, nonce);

        vm.expectRevert(TimelockRecovery.InvalidValidator.selector);
        recovery.revealRecovery(address(kernel), address(otherValidator), validatorData, salt);
        vm.stopPrank();
    }

    function testRevealRejectsZeroPublicKey() external {
        bytes memory invalidData = abi.encode(uint256(0), NEW_Y, NEW_CREDENTIAL_HASH);
        bytes32 salt = keccak256("salt");
        uint64 nonce = recovery.nextRecoveryNonce(address(kernel));

        bytes32 commitment =
            recovery.computeCommitment(address(kernel), claimant, address(validator), invalidData, salt, nonce);

        vm.startPrank(claimant);
        recovery.commitRecovery{value: DEPOSIT}(address(kernel), commitment, nonce);

        vm.expectRevert(TimelockRecovery.InvalidNewPasskey.selector);
        recovery.revealRecovery(address(kernel), address(validator), invalidData, salt);
        vm.stopPrank();
    }

    function testRevealRejectsExpiredWindow() external {
        (bytes memory validatorData, bytes32 salt, uint64 nonce, bytes32 commitment) = _recoveryInputs();

        vm.prank(claimant);
        recovery.commitRecovery{value: DEPOSIT}(address(kernel), commitment, nonce);

        vm.warp(block.timestamp + REVEAL_WINDOW + 1);

        vm.prank(claimant);
        vm.expectRevert(TimelockRecovery.RevealWindowExpired.selector);
        recovery.revealRecovery(address(kernel), address(validator), validatorData, salt);
    }

    function testFinalizeRejectsBeforeTimelock() external {
        _commitAndReveal();

        vm.expectRevert(TimelockRecovery.TooEarly.selector);
        recovery.finalizeRecovery(address(kernel));
    }

    function testUnauthorizedAddressCannotVeto() external {
        _commitAndReveal();

        vm.prank(attacker);
        vm.expectRevert(TimelockRecovery.Unauthorized.selector);
        recovery.vetoRecovery(address(kernel));
    }

    function testFinalizeRefundsDeposit() external {
        uint256 balanceBefore = claimant.balance;

        _commitAndReveal();

        assertEq(claimant.balance, balanceBefore - DEPOSIT);

        vm.warp(block.timestamp + DELAY);
        recovery.finalizeRecovery(address(kernel));

        assertEq(claimant.balance, balanceBefore);

        TimelockRecovery.Recovery memory state = recovery.getRecovery(address(kernel));

        assertEq(state.deposit, 0);
        assertEq(uint256(state.status), uint256(TimelockRecovery.RecoveryStatus.Finalized));
    }

    function testVetoRefundsDeposit() external {
        uint256 balanceBefore = claimant.balance;

        _commitAndReveal();

        vm.prank(vetoer);
        recovery.vetoRecovery(address(kernel));

        assertEq(claimant.balance, balanceBefore);

        TimelockRecovery.Recovery memory state = recovery.getRecovery(address(kernel));

        assertEq(state.deposit, 0);
        assertEq(uint256(state.status), uint256(TimelockRecovery.RecoveryStatus.Vetoed));
    }

    function testExpireRefundsDeposit() external {
        uint256 balanceBefore = claimant.balance;
        uint64 nonce = recovery.nextRecoveryNonce(address(kernel));

        vm.prank(claimant);
        recovery.commitRecovery{value: DEPOSIT}(address(kernel), keccak256("unused-commitment"), nonce);

        vm.warp(block.timestamp + REVEAL_WINDOW + 1);
        recovery.expireCommitment(address(kernel));

        assertEq(claimant.balance, balanceBefore);
    }

    function testDoubleFinalizeIsRejected() external {
        _commitAndReveal();
        vm.warp(block.timestamp + DELAY);

        recovery.finalizeRecovery(address(kernel));

        vm.expectRevert(TimelockRecovery.RecoveryNotPending.selector);
        recovery.finalizeRecovery(address(kernel));
    }

    function testDirectRotationCannotModifyKernelKey() external {
        (uint256 beforeX, uint256 beforeY, bytes32 beforeHash, uint64 beforeVersion) =
            validator.keyData(address(kernel));

        vm.prank(attacker);
        vm.expectRevert();
        validator.rotatePublicKey(NEW_X, NEW_Y, NEW_CREDENTIAL_HASH);

        (uint256 afterX, uint256 afterY, bytes32 afterHash, uint64 afterVersion) = validator.keyData(address(kernel));

        assertEq(afterX, beforeX);
        assertEq(afterY, beforeY);
        assertEq(afterHash, beforeHash);
        assertEq(afterVersion, beforeVersion);
    }

    function testCommitmentIsBoundToClaimant() external view {
        bytes memory validatorData = _newValidatorData();
        bytes32 salt = keccak256("salt");
        uint64 nonce = recovery.nextRecoveryNonce(address(kernel));

        bytes32 claimantCommitment =
            recovery.computeCommitment(address(kernel), claimant, address(validator), validatorData, salt, nonce);

        bytes32 attackerCommitment =
            recovery.computeCommitment(address(kernel), attacker, address(validator), validatorData, salt, nonce);

        assertNotEq(claimantCommitment, attackerCommitment);
    }

    function _commitAndReveal() internal {
        (bytes memory validatorData, bytes32 salt, uint64 nonce, bytes32 commitment) = _recoveryInputs();

        vm.startPrank(claimant);

        recovery.commitRecovery{value: DEPOSIT}(address(kernel), commitment, nonce);

        recovery.revealRecovery(address(kernel), address(validator), validatorData, salt);

        vm.stopPrank();
    }

    function _recoveryInputs()
        internal
        view
        returns (bytes memory validatorData, bytes32 salt, uint64 nonce, bytes32 commitment)
    {
        validatorData = _newValidatorData();
        salt = keccak256("salt");
        nonce = recovery.nextRecoveryNonce(address(kernel));

        commitment =
            recovery.computeCommitment(address(kernel), claimant, address(validator), validatorData, salt, nonce);
    }

    function _newValidatorData() internal pure returns (bytes memory) {
        return abi.encode(NEW_X, NEW_Y, NEW_CREDENTIAL_HASH);
    }
}
