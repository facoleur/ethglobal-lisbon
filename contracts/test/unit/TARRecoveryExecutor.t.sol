// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IModule} from "kernel/interfaces/IERC7579Modules.sol";
import {TARRecoveryExecutor} from "../../src/TARRecoveryExecutor.sol";
import {ITARRecovery} from "../../src/interfaces/ITARRecovery.sol";
import {MockERC7579Account} from "../mocks/MockERC7579Account.sol";
import {MockRotatableValidator} from "../mocks/MockRotatableValidator.sol";

/// @notice Milestone C: full commit-reveal state machine (requestRecovery, revealRecovery,
/// challengeRecovery, finalizeRecovery) with the new signer as a WebAuthn/P-256
/// `(pubKeyX, pubKeyY)` pair — replaces the Milestone B `address newSigner` harness entirely
/// (not an extension, see `context_mC.md`). Tested against `MockERC7579Account` +
/// `MockRotatableValidator`, no real Kernel/validator (Milestone E) involved.
contract TARRecoveryExecutorTest is Test {
    uint256 constant LOCK_VALUE = 1 ether;
    uint256 constant LOCK_TIME = 3 days;

    TARRecoveryExecutor executor;
    MockRotatableValidator validator;
    MockERC7579Account account;

    uint256 ownerKey;
    address owner;
    address broadcaster = address(0xB0AD);
    uint256 newPubKeyX = uint256(keccak256("newPubKeyX"));
    uint256 newPubKeyY = uint256(keccak256("newPubKeyY"));

    function setUp() external {
        validator = new MockRotatableValidator();
        executor = new TARRecoveryExecutor(address(validator));
        (owner, ownerKey) = makeAddrAndKey("owner");
        account = new MockERC7579Account(owner);

        account.installModule(address(executor), abi.encode(LOCK_VALUE, LOCK_TIME));
        vm.deal(broadcaster, 100 ether);
    }

    function _commitment(
        address addressToRecover,
        address broadcasterAddress,
        uint256 pubKeyX,
        uint256 pubKeyY,
        bytes32 salt
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(addressToRecover, broadcasterAddress, pubKeyX, pubKeyY, salt));
    }

    function _requestAndReveal(bytes32 salt) internal returns (bytes32 commitment) {
        commitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
        executor.requestRecovery(commitment);
        vm.roll(block.number + 1);
        vm.prank(broadcaster);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
    }

    function _rejectSignature() internal view returns (bytes memory) {
        (,,,, uint256 revealTimestamp,) = executor.recoveries(address(account));
        bytes32 rejectHash = keccak256(
            abi.encodePacked(address(executor), block.chainid, address(account), broadcaster, revealTimestamp, "REJECT")
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, rejectHash);
        return abi.encodePacked(r, s, v);
    }

    // ---------------------------------------------------------------------
    // Happy path
    // ---------------------------------------------------------------------

    function test_happyPath_requestRevealFinalize() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _requestAndReveal(salt);

        (,,,,, TARRecoveryExecutor.RecoveryStatus statusAfterReveal) = executor.recoveries(address(account));
        assertEq(uint8(statusAfterReveal), uint8(TARRecoveryExecutor.RecoveryStatus.Revealed));
        assertEq(executor.pendingCommitments(commitment), 0);

        vm.warp(block.timestamp + LOCK_TIME);
        executor.finalizeRecovery(address(account));

        assertEq(validator.currentPubKeyX(address(account)), newPubKeyX);
        assertEq(validator.currentPubKeyY(address(account)), newPubKeyY);
        assertEq(address(account).balance, LOCK_VALUE);
        (,,,,, TARRecoveryExecutor.RecoveryStatus statusAfterFinalize) = executor.recoveries(address(account));
        assertEq(uint8(statusAfterFinalize), uint8(TARRecoveryExecutor.RecoveryStatus.Finalized));
    }

    // ---------------------------------------------------------------------
    // Owner rejection
    // ---------------------------------------------------------------------

    function test_challengeRecovery_validSignature_rejectsAndReturnsStake() external {
        bytes32 salt = bytes32(uint256(1));
        _requestAndReveal(salt);

        executor.challengeRecovery(address(account), _rejectSignature());

        (,,,,, TARRecoveryExecutor.RecoveryStatus status) = executor.recoveries(address(account));
        assertEq(uint8(status), uint8(TARRecoveryExecutor.RecoveryStatus.Rejected));
        assertEq(address(account).balance, LOCK_VALUE);

        vm.expectRevert(abi.encodeWithSelector(ITARRecovery.RecoveryNotRevealed.selector, address(account)));
        executor.finalizeRecovery(address(account));
    }

    function test_challengeRecovery_invalidSignature_reverts() external {
        bytes32 salt = bytes32(uint256(1));
        _requestAndReveal(salt);

        (, uint256 wrongKey) = makeAddrAndKey("not-the-owner");
        (,,,, uint256 revealTimestamp,) = executor.recoveries(address(account));
        bytes32 rejectHash = keccak256(
            abi.encodePacked(address(executor), block.chainid, address(account), broadcaster, revealTimestamp, "REJECT")
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, rejectHash);

        vm.expectRevert(ITARRecovery.InvalidRejectSignature.selector);
        executor.challengeRecovery(address(account), abi.encodePacked(r, s, v));
    }

    function test_challengeRecovery_afterTimelockExpiry_stillWorks() external {
        bytes32 salt = bytes32(uint256(1));
        _requestAndReveal(salt);

        vm.warp(block.timestamp + LOCK_TIME + 1 days);
        executor.challengeRecovery(address(account), _rejectSignature());

        (,,,,, TARRecoveryExecutor.RecoveryStatus status) = executor.recoveries(address(account));
        assertEq(uint8(status), uint8(TARRecoveryExecutor.RecoveryStatus.Rejected));
    }

    function test_challengeRecovery_notRevealed_reverts() external {
        vm.expectRevert(abi.encodeWithSelector(ITARRecovery.RecoveryNotRevealed.selector, address(account)));
        executor.challengeRecovery(address(account), "");
    }

    // ---------------------------------------------------------------------
    // Timelock bounds
    // ---------------------------------------------------------------------

    function test_finalizeRecovery_revertsJustBeforeLockTimeElapsed() external {
        bytes32 salt = bytes32(uint256(1));
        _requestAndReveal(salt);

        vm.warp(block.timestamp + LOCK_TIME - 1);
        vm.expectRevert(abi.encodeWithSelector(ITARRecovery.TimelockNotElapsed.selector, address(account)));
        executor.finalizeRecovery(address(account));
    }

    function test_finalizeRecovery_succeedsExactlyAtLockTime() external {
        bytes32 salt = bytes32(uint256(1));
        _requestAndReveal(salt);

        vm.warp(block.timestamp + LOCK_TIME);
        executor.finalizeRecovery(address(account));

        (,,,,, TARRecoveryExecutor.RecoveryStatus status) = executor.recoveries(address(account));
        assertEq(uint8(status), uint8(TARRecoveryExecutor.RecoveryStatus.Finalized));
    }

    // ---------------------------------------------------------------------
    // Anti-front-running / commitment integrity
    // ---------------------------------------------------------------------

    function test_revealRecovery_wrongBroadcaster_reverts() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
        executor.requestRecovery(commitment);

        vm.deal(address(this), LOCK_VALUE);
        vm.expectRevert(ITARRecovery.InvalidBroadcaster.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
    }

    function test_revealRecovery_unknownCommitment_reverts() external {
        bytes32 salt = bytes32(uint256(1));
        vm.prank(broadcaster);
        vm.expectRevert(ITARRecovery.CommitmentNotFound.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
    }

    function test_revealRecovery_commitmentReplay_reverts() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _requestAndReveal(salt);
        executor.challengeRecovery(address(account), _rejectSignature());

        assertEq(executor.pendingCommitments(commitment), 0);
        vm.prank(broadcaster);
        vm.expectRevert(ITARRecovery.CommitmentNotFound.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
    }

    function test_revealRecovery_activeRecoveryGuard_reverts() external {
        bytes32 firstSalt = bytes32(uint256(1));
        _requestAndReveal(firstSalt);

        bytes32 secondSalt = bytes32(uint256(2));
        bytes32 secondCommitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, secondSalt);
        executor.requestRecovery(secondCommitment);

        vm.prank(broadcaster);
        vm.expectRevert(abi.encodeWithSelector(ITARRecovery.RecoveryAlreadyActive.selector, address(account)));
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, secondSalt);
    }

    function test_revealRecovery_wrongStakedAmount_revertsAndKeepsCommitmentPending() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
        executor.requestRecovery(commitment);
        vm.roll(block.number + 1);

        vm.prank(broadcaster);
        vm.expectRevert(ITARRecovery.WrongStakedAmount.selector);
        executor.revealRecovery{value: LOCK_VALUE - 1}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);

        assertTrue(executor.pendingCommitments(commitment) != 0);
    }

    function test_revealRecovery_sameBlockAsCommit_reverts() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
        executor.requestRecovery(commitment);

        // No vm.roll: this is exactly the race the block-delay guards against — an attacker
        // reacting to a victim's pending reveal in the mempool by committing and revealing their
        // own attempt within the same block.
        vm.prank(broadcaster);
        vm.expectRevert(ITARRecovery.CommitmentNotMature.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
    }

    function test_revealRecovery_succeedsOneBlockAfterCommit() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
        executor.requestRecovery(commitment);
        vm.roll(block.number + 1);

        vm.prank(broadcaster);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);

        (,,,,, TARRecoveryExecutor.RecoveryStatus status) = executor.recoveries(address(account));
        assertEq(uint8(status), uint8(TARRecoveryExecutor.RecoveryStatus.Revealed));
    }

    function test_revealRecovery_targetNotInitialized_reverts() external {
        address uninitializedAccount = address(0xDEAD);
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(uninitializedAccount, broadcaster, newPubKeyX, newPubKeyY, salt);
        executor.requestRecovery(commitment);

        vm.prank(broadcaster);
        vm.expectRevert(abi.encodeWithSelector(IModule.NotInitialized.selector, uninitializedAccount));
        executor.revealRecovery{value: LOCK_VALUE}(uninitializedAccount, broadcaster, newPubKeyX, newPubKeyY, salt);
    }

    function test_revealRecovery_zeroPubKeyX_reverts() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(address(account), broadcaster, 0, newPubKeyY, salt);
        executor.requestRecovery(commitment);

        vm.prank(broadcaster);
        vm.expectRevert(ITARRecovery.InvalidPublicKey.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, 0, newPubKeyY, salt);
    }

    function test_revealRecovery_zeroPubKeyY_reverts() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(address(account), broadcaster, newPubKeyX, 0, salt);
        executor.requestRecovery(commitment);

        vm.prank(broadcaster);
        vm.expectRevert(ITARRecovery.InvalidPublicKey.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, 0, salt);
    }

    // ---------------------------------------------------------------------
    // Commitment formula — fixed cross-language (Solidity/JS) test vector. `pubKeyX`/`pubKeyY`
    // are full-width uint256 (keccak256 outputs, representative of real P-256 coordinate
    // magnitude) so a JS harness exercises the same encoding a real WebAuthn key would hit —
    // encoded as uint256 (big integers), not as 32-byte hex strings, which would collide in
    // Solidity's `abi.encodePacked` but not necessarily in a naive JS implementation.
    // ---------------------------------------------------------------------

    function test_commitmentFormula_matchesFixedVector() external pure {
        bytes32 commitment = keccak256(
            abi.encodePacked(
                address(uint160(1)),
                address(uint160(2)),
                uint256(keccak256("pubKeyX-fixture")),
                uint256(keccak256("pubKeyY-fixture")),
                bytes32(uint256(1))
            )
        );
        assertEq(commitment, 0x511fa6ade2900b97c3d7bd86335ea459bb299b50f59de397c874ba73ca1a4498);
    }
}
