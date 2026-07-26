// SPDX-License-Identifier: MIT
// Transitively pulls in `TARRecoveryExecutorV2.sol`, pinned to exactly `0.8.23` by
// `lib/semaphore` — see `foundry.toml`.
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {IModule} from "kernel/interfaces/IERC7579Modules.sol";
import {TARRecoveryExecutorV2} from "../../src/TARRecoveryExecutorV2.sol";
import {ITARRecoveryV2} from "../../src/interfaces/ITARRecoveryV2.sol";
import {MockERC7579Account} from "../mocks/MockERC7579Account.sol";
import {MockRotatableValidator} from "../mocks/MockRotatableValidator.sol";
import {SemaphoreStub} from "../mocks/SemaphoreStub.sol";

/// @notice Milestone A. Two groups of coverage:
/// 1. Non-regression: `requestRecovery`/`revealRecovery`/`finalizeRecovery` copied verbatim from
///    `TARRecoveryExecutor.t.sol` (V1) — same test bodies, run against `TARRecoveryExecutorV2`
///    instead. `challengeRecovery`-related tests are dropped entirely: the function doesn't exist
///    in V2 until Milestone D (unified owner+watch-tower path).
/// 2. New: `regenerateWatchTowerGroup`, tested against `SemaphoreStub` (a bare-bones double —
///    the real `MockSemaphore` lands in Milestone B, `challengeRecovery` proof tests in D).
contract TARRecoveryExecutorV2Test is Test {
    uint256 constant LOCK_VALUE = 1 ether;
    uint256 constant LOCK_TIME = 3 days;

    TARRecoveryExecutorV2 executor;
    MockRotatableValidator validator;
    SemaphoreStub semaphore;
    MockERC7579Account account;

    address broadcaster = address(0xB0AD);
    uint256 newPubKeyX = uint256(keccak256("newPubKeyX"));
    uint256 newPubKeyY = uint256(keccak256("newPubKeyY"));

    function setUp() external {
        validator = new MockRotatableValidator();
        semaphore = new SemaphoreStub();
        executor = new TARRecoveryExecutorV2(address(validator), address(semaphore));
        account = new MockERC7579Account(address(0xBEEF));

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

    // ---------------------------------------------------------------------
    // Happy path (verbatim from TARRecoveryExecutor.t.sol, V1)
    // ---------------------------------------------------------------------

    function test_happyPath_requestRevealFinalize() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _requestAndReveal(salt);

        (,,,,, TARRecoveryExecutorV2.RecoveryStatus statusAfterReveal) = executor.recoveries(address(account));
        assertEq(uint8(statusAfterReveal), uint8(TARRecoveryExecutorV2.RecoveryStatus.Revealed));
        assertEq(executor.pendingCommitments(commitment), 0);

        vm.warp(block.timestamp + LOCK_TIME);
        executor.finalizeRecovery(address(account));

        assertEq(validator.currentPubKeyX(address(account)), newPubKeyX);
        assertEq(validator.currentPubKeyY(address(account)), newPubKeyY);
        assertEq(address(account).balance, LOCK_VALUE);
        (,,,,, TARRecoveryExecutorV2.RecoveryStatus statusAfterFinalize) = executor.recoveries(address(account));
        assertEq(uint8(statusAfterFinalize), uint8(TARRecoveryExecutorV2.RecoveryStatus.Finalized));
    }

    // ---------------------------------------------------------------------
    // Timelock bounds (verbatim from V1)
    // ---------------------------------------------------------------------

    function test_finalizeRecovery_revertsJustBeforeLockTimeElapsed() external {
        bytes32 salt = bytes32(uint256(1));
        _requestAndReveal(salt);

        vm.warp(block.timestamp + LOCK_TIME - 1);
        vm.expectRevert(abi.encodeWithSelector(ITARRecoveryV2.TimelockNotElapsed.selector, address(account)));
        executor.finalizeRecovery(address(account));
    }

    function test_finalizeRecovery_succeedsExactlyAtLockTime() external {
        bytes32 salt = bytes32(uint256(1));
        _requestAndReveal(salt);

        vm.warp(block.timestamp + LOCK_TIME);
        executor.finalizeRecovery(address(account));

        (,,,,, TARRecoveryExecutorV2.RecoveryStatus status) = executor.recoveries(address(account));
        assertEq(uint8(status), uint8(TARRecoveryExecutorV2.RecoveryStatus.Finalized));
    }

    // ---------------------------------------------------------------------
    // Anti-front-running / commitment integrity (verbatim from V1)
    // ---------------------------------------------------------------------

    function test_revealRecovery_wrongBroadcaster_reverts() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
        executor.requestRecovery(commitment);

        vm.deal(address(this), LOCK_VALUE);
        vm.expectRevert(ITARRecoveryV2.InvalidBroadcaster.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
    }

    function test_revealRecovery_unknownCommitment_reverts() external {
        bytes32 salt = bytes32(uint256(1));
        vm.prank(broadcaster);
        vm.expectRevert(ITARRecoveryV2.CommitmentNotFound.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
    }

    function test_revealRecovery_activeRecoveryGuard_reverts() external {
        bytes32 firstSalt = bytes32(uint256(1));
        _requestAndReveal(firstSalt);

        bytes32 secondSalt = bytes32(uint256(2));
        bytes32 secondCommitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, secondSalt);
        executor.requestRecovery(secondCommitment);

        vm.prank(broadcaster);
        vm.expectRevert(abi.encodeWithSelector(ITARRecoveryV2.RecoveryAlreadyActive.selector, address(account)));
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, secondSalt);
    }

    function test_revealRecovery_wrongStakedAmount_revertsAndKeepsCommitmentPending() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
        executor.requestRecovery(commitment);
        vm.roll(block.number + 1);

        vm.prank(broadcaster);
        vm.expectRevert(ITARRecoveryV2.WrongStakedAmount.selector);
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
        vm.expectRevert(ITARRecoveryV2.CommitmentNotMature.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
    }

    function test_revealRecovery_succeedsOneBlockAfterCommit() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
        executor.requestRecovery(commitment);
        vm.roll(block.number + 1);

        vm.prank(broadcaster);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);

        (,,,,, TARRecoveryExecutorV2.RecoveryStatus status) = executor.recoveries(address(account));
        assertEq(uint8(status), uint8(TARRecoveryExecutorV2.RecoveryStatus.Revealed));
    }

    function test_requestRecovery_duplicateDoesNotResetCommitBlock() external {
        bytes32 commitment = _commitment(address(account), broadcaster, newPubKeyX, newPubKeyY, bytes32(uint256(1)));
        executor.requestRecovery(commitment);
        uint256 initialCommitBlock = executor.pendingCommitments(commitment);

        vm.roll(block.number + 5);
        executor.requestRecovery(commitment);

        assertEq(executor.pendingCommitments(commitment), initialCommitBlock);
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
        vm.expectRevert(ITARRecoveryV2.InvalidPublicKey.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, 0, newPubKeyY, salt);
    }

    function test_revealRecovery_zeroPubKeyY_reverts() external {
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = _commitment(address(account), broadcaster, newPubKeyX, 0, salt);
        executor.requestRecovery(commitment);

        vm.prank(broadcaster);
        vm.expectRevert(ITARRecoveryV2.InvalidPublicKey.selector);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, 0, salt);
    }

    // ---------------------------------------------------------------------
    // regenerateWatchTowerGroup (new in V2)
    // ---------------------------------------------------------------------

    function _members(uint256 count) internal pure returns (uint256[] memory members) {
        members = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            members[i] = uint256(keccak256(abi.encode("member", i)));
        }
    }

    function test_regenerateWatchTowerGroup_happyPath_createsGroupAndEmits() external {
        uint256[] memory members = _members(3);

        vm.expectEmit(true, true, false, true, address(executor));
        emit ITARRecoveryV2.WatchTowerGroupRegenerated(address(account), 1, 3, 1);
        vm.prank(address(account));
        executor.regenerateWatchTowerGroup(members);

        uint256 groupId = executor.groupOf(address(account));
        assertEq(groupId, 1);
        assertEq(semaphore.adminOf(groupId), address(account));
        assertEq(semaphore.membersOfGroup(groupId).length, 3);
    }

    function test_regenerateWatchTowerGroup_maxGroupSize_succeeds() external {
        uint256[] memory members = _members(executor.MAX_GROUP_SIZE());

        vm.prank(address(account));
        executor.regenerateWatchTowerGroup(members);

        assertEq(semaphore.membersOfGroup(executor.groupOf(address(account))).length, executor.MAX_GROUP_SIZE());
    }

    function test_regenerateWatchTowerGroup_emptyList_reverts() external {
        vm.prank(address(account));
        vm.expectRevert(ITARRecoveryV2.InvalidGroupSize.selector);
        executor.regenerateWatchTowerGroup(new uint256[](0));
    }

    function test_regenerateWatchTowerGroup_tooManyMembers_reverts() external {
        uint256[] memory members = _members(executor.MAX_GROUP_SIZE() + 1);

        vm.prank(address(account));
        vm.expectRevert(ITARRecoveryV2.InvalidGroupSize.selector);
        executor.regenerateWatchTowerGroup(members);
    }

    function test_regenerateWatchTowerGroup_notInitialized_reverts() external {
        MockERC7579Account uninitializedAccount = new MockERC7579Account(address(0xCAFE));

        vm.prank(address(uninitializedAccount));
        vm.expectRevert(abi.encodeWithSelector(IModule.NotInitialized.selector, address(uninitializedAccount)));
        executor.regenerateWatchTowerGroup(_members(1));
    }

    function test_regenerateWatchTowerGroup_addMembersFails_leavesGroupOfUntouched() external {
        // Establish a baseline groupId so we can assert it is untouched, not just zero.
        vm.prank(address(account));
        executor.regenerateWatchTowerGroup(_members(2));
        uint256 groupIdBefore = executor.groupOf(address(account));

        semaphore.setFailNextAddMembers(true);

        vm.prank(address(account));
        vm.expectRevert("executeFromExecutor: call failed");
        executor.regenerateWatchTowerGroup(_members(3));

        assertEq(executor.groupOf(address(account)), groupIdBefore);
    }

    function test_regenerateWatchTowerGroup_successiveCalls_overwritePreviousGroupId() external {
        vm.startPrank(address(account));
        executor.regenerateWatchTowerGroup(_members(2));
        uint256 firstGroupId = executor.groupOf(address(account));

        executor.regenerateWatchTowerGroup(_members(4));
        uint256 secondGroupId = executor.groupOf(address(account));
        vm.stopPrank();

        assertTrue(secondGroupId != firstGroupId);
        assertEq(executor.groupOf(address(account)), secondGroupId);
    }
}
