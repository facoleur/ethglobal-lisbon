// SPDX-License-Identifier: MIT
// Transitively pulls in `TARRecoveryExecutorV2.sol`, pinned to exactly `0.8.23` by
// `lib/semaphore` — see `foundry.toml`.
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import {TARRecoveryExecutorV2} from "../../src/TARRecoveryExecutorV2.sol";
import {ITARRecoveryV2} from "../../src/interfaces/ITARRecoveryV2.sol";
import {MockERC7579Account} from "../mocks/MockERC7579Account.sol";
import {MockRotatableValidator} from "../mocks/MockRotatableValidator.sol";
import {MockSemaphore} from "../mocks/MockSemaphore.sol";

/// @notice `challengeRecovery` (unified owner/watch-tower path), tested against `MockSemaphore`
/// rather than `SemaphoreStub` — `SemaphoreStub` (Milestone A) never implemented `verifyProof`,
/// only `createGroup`/`addMembers`, since no challenge path existed yet at that point.
contract TARRecoveryExecutorV2ChallengeTest is Test {
    uint256 constant LOCK_VALUE = 1 ether;
    uint256 constant LOCK_TIME = 3 days;

    TARRecoveryExecutorV2 executor;
    MockSemaphore semaphore;
    MockERC7579Account account;

    address broadcaster = address(0xB0AD);
    uint256 newPubKeyX = uint256(keccak256("newPubKeyX"));
    uint256 newPubKeyY = uint256(keccak256("newPubKeyY"));

    function setUp() external {
        semaphore = new MockSemaphore();
        executor = new TARRecoveryExecutorV2(address(new MockRotatableValidator()), address(semaphore));
        account = new MockERC7579Account(address(0xBEEF));
        account.installModule(address(executor), abi.encode(LOCK_VALUE, LOCK_TIME));
        vm.deal(broadcaster, 100 ether);
    }

    function _regenerateGroup(uint256 memberCount) internal returns (uint256 groupId) {
        uint256[] memory members = new uint256[](memberCount);
        for (uint256 i = 0; i < memberCount; i++) {
            members[i] = uint256(keccak256(abi.encode("member", i)));
        }
        vm.prank(address(account));
        executor.regenerateWatchTowerGroup(members);
        return executor.groupOf(address(account));
    }

    function _requestAndReveal(bytes32 salt) internal {
        bytes32 commitment = keccak256(abi.encodePacked(address(account), broadcaster, newPubKeyX, newPubKeyY, salt));
        executor.requestRecovery(commitment);
        vm.roll(block.number + 1);
        vm.prank(broadcaster);
        executor.revealRecovery{value: LOCK_VALUE}(address(account), broadcaster, newPubKeyX, newPubKeyY, salt);
    }

    function _proof(address addressToRecover) internal pure returns (ISemaphore.SemaphoreProof memory proof) {
        proof.scope = uint256(uint160(addressToRecover));
    }

    // ---------------------------------------------------------------------
    // Happy path / veto outcome
    // ---------------------------------------------------------------------

    function test_challengeRecovery_validProof_rejectsAndReturnsStake() external {
        uint256 groupId = _regenerateGroup(3);
        _requestAndReveal(bytes32(uint256(1)));
        semaphore.setForcedResult(groupId, true);

        executor.challengeRecovery(address(account), _proof(address(account)));

        (,,,,, TARRecoveryExecutorV2.RecoveryStatus status) = executor.recoveries(address(account));
        assertEq(uint8(status), uint8(TARRecoveryExecutorV2.RecoveryStatus.Rejected));
        assertEq(address(account).balance, LOCK_VALUE);
    }

    function test_challengeRecovery_invalidProof_revertsWithoutStateChange() external {
        _regenerateGroup(3);
        _requestAndReveal(bytes32(uint256(1)));
        // forcedResult defaults to false: verifyProof returns false, not a revert.

        vm.expectRevert(ITARRecoveryV2.InvalidWatchTowerProof.selector);
        executor.challengeRecovery(address(account), _proof(address(account)));

        (,,,,, TARRecoveryExecutorV2.RecoveryStatus status) = executor.recoveries(address(account));
        assertEq(uint8(status), uint8(TARRecoveryExecutorV2.RecoveryStatus.Revealed));
        assertEq(address(account).balance, 0);
    }

    function test_challengeRecovery_secondCallAfterSuccessfulVeto_revertsRecoveryNotRevealed() external {
        uint256 groupId = _regenerateGroup(3);
        _requestAndReveal(bytes32(uint256(1)));
        semaphore.setForcedResult(groupId, true);
        executor.challengeRecovery(address(account), _proof(address(account)));

        // Blocked by the `status` check alone — never reaches `verifyProof` again, independent
        // of whatever Semaphore's own nullifier policy would or wouldn't allow.
        vm.expectRevert(abi.encodeWithSelector(ITARRecoveryV2.RecoveryNotRevealed.selector, address(account)));
        executor.challengeRecovery(address(account), _proof(address(account)));
    }

    function test_challengeRecovery_notRevealed_reverts() external {
        vm.expectRevert(abi.encodeWithSelector(ITARRecoveryV2.RecoveryNotRevealed.selector, address(account)));
        executor.challengeRecovery(address(account), _proof(address(account)));
    }

    // ---------------------------------------------------------------------
    // groupOf == 0 ambiguity (context_mC_v2.md §4)
    // ---------------------------------------------------------------------

    function test_challengeRecovery_groupNeverConfigured_reverts() external {
        _requestAndReveal(bytes32(uint256(1)));
        // Never called regenerateWatchTowerGroup: groupOf(account) == 0.

        vm.expectRevert(ITARRecoveryV2.WatchTowerGroupNotConfigured.selector);
        executor.challengeRecovery(address(account), _proof(address(account)));
    }

    function test_challengeRecovery_groupNeverConfigured_blockedEvenIfSemaphoreGroupZeroWouldVerify() external {
        // Group 0 on this Semaphore instance is the one `executor`'s own constructor burned
        // (admin = executor itself). Populate it with members and force `verifyProof` to
        // succeed for it anyway, to prove `WatchTowerGroupNotConfigured` is driven purely by our
        // own `groupOf[account]` being zero — not by whatever state group 0 actually holds on
        // the Semaphore side, burned or not.
        uint256[] memory members = new uint256[](1);
        members[0] = 999;
        vm.prank(address(executor));
        semaphore.addMembers(0, members);
        semaphore.setForcedResult(0, true);

        _requestAndReveal(bytes32(uint256(1)));

        vm.expectRevert(ITARRecoveryV2.WatchTowerGroupNotConfigured.selector);
        executor.challengeRecovery(address(account), _proof(address(account)));
    }

    // ---------------------------------------------------------------------
    // scope fail-fast
    // ---------------------------------------------------------------------

    function test_challengeRecovery_scopeMismatch_reverts() external {
        _regenerateGroup(3);
        _requestAndReveal(bytes32(uint256(1)));

        ISemaphore.SemaphoreProof memory proof = _proof(address(account));
        proof.scope = uint256(uint160(address(0xBAD)));

        vm.expectRevert(ITARRecoveryV2.ScopeMismatch.selector);
        executor.challengeRecovery(address(account), proof);
    }

    // ---------------------------------------------------------------------
    // Constructor burns group 0
    // ---------------------------------------------------------------------

    function test_constructor_burnsGroupZero() external {
        assertEq(semaphore.admins(0), address(executor));

        // The first group a real account can ever be assigned is 1, never 0.
        uint256 groupId = _regenerateGroup(1);
        assertEq(groupId, 1);
    }
}
