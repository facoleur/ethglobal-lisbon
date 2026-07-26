// SPDX-License-Identifier: MIT
// Transitively pulls in `lib/semaphore`'s `ISemaphore.sol`, pinned to exactly `0.8.23` — see
// `foundry.toml`.
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import {MockSemaphore} from "../mocks/MockSemaphore.sol";

/// @notice Milestone B: exercises `MockSemaphore` in isolation, not its integration with
/// `TARRecoveryExecutorV2.regenerateWatchTowerGroup` — that integration is already covered in
/// `TARRecoveryExecutorV2.t.sol` (Milestone A) against `SemaphoreStub` and doesn't need
/// re-testing here.
contract MockSemaphoreTest is Test {
    MockSemaphore semaphore;
    address admin = address(0xA11CE);

    function setUp() external {
        semaphore = new MockSemaphore();
    }

    function _emptyProof() internal pure returns (ISemaphore.SemaphoreProof memory proof) {
        proof.points = [uint256(0), 0, 0, 0, 0, 0, 0, 0];
    }

    // ---------------------------------------------------------------------
    // createGroup
    // ---------------------------------------------------------------------

    function test_createGroup_returnsIncreasingDistinctGroupIds() external {
        uint256 firstGroupId = semaphore.createGroup(admin, 365 days);
        uint256 secondGroupId = semaphore.createGroup(admin, 365 days);

        // Post-increment, matching real Semaphore.sol: the first group ever created gets id 0.
        assertEq(firstGroupId, 0);
        assertEq(secondGroupId, 1);
        assertTrue(secondGroupId > firstGroupId);
    }

    function test_createGroup_registersGivenAdmin_notCaller() external {
        vm.prank(address(0xBEEF));
        uint256 groupId = semaphore.createGroup(admin, 365 days);

        assertEq(semaphore.admins(groupId), admin);
    }

    // ---------------------------------------------------------------------
    // addMembers
    // ---------------------------------------------------------------------

    function test_addMembers_byAdmin_succeedsAndStoresList() external {
        uint256 groupId = semaphore.createGroup(admin, 365 days);
        uint256[] memory members = new uint256[](2);
        members[0] = 111;
        members[1] = 222;

        vm.prank(admin);
        semaphore.addMembers(groupId, members);

        uint256[] memory stored = semaphore.membersOf(groupId);
        assertEq(stored.length, 2);
        assertEq(stored[0], 111);
        assertEq(stored[1], 222);
    }

    function test_addMembers_byNonAdmin_reverts() external {
        uint256 groupId = semaphore.createGroup(admin, 365 days);
        uint256[] memory members = new uint256[](1);
        members[0] = 111;

        vm.prank(address(0xBAD));
        vm.expectRevert("MockSemaphore: not admin");
        semaphore.addMembers(groupId, members);
    }

    // ---------------------------------------------------------------------
    // verifyProof
    // ---------------------------------------------------------------------

    function test_verifyProof_forcedResultTrue_returnsTrue() external {
        uint256 groupId = semaphore.createGroup(admin, 365 days);
        uint256[] memory members = new uint256[](1);
        members[0] = 111;
        vm.prank(admin);
        semaphore.addMembers(groupId, members);

        semaphore.setForcedResult(groupId, true);

        assertTrue(semaphore.verifyProof(groupId, _emptyProof()));
    }

    function test_verifyProof_forcedResultFalse_returnsFalseWithoutReverting() external {
        uint256 groupId = semaphore.createGroup(admin, 365 days);
        uint256[] memory members = new uint256[](1);
        members[0] = 111;
        vm.prank(admin);
        semaphore.addMembers(groupId, members);

        // forcedResult defaults to false — no explicit set needed.
        assertFalse(semaphore.verifyProof(groupId, _emptyProof()));
    }

    function test_verifyProof_groupHasNoMembers_reverts() external {
        uint256 groupId = semaphore.createGroup(admin, 365 days);

        vm.expectRevert(ISemaphore.Semaphore__GroupHasNoMembers.selector);
        semaphore.verifyProof(groupId, _emptyProof());
    }

    function test_verifyProof_neverCreatedGroup_revertsGroupHasNoMembers() external {
        // Mirrors `groupOf[account] == 0` for an account that never called
        // `regenerateWatchTowerGroup` — group 0 was never created, so it has no members either.
        vm.expectRevert(ISemaphore.Semaphore__GroupHasNoMembers.selector);
        semaphore.verifyProof(0, _emptyProof());
    }

    // ---------------------------------------------------------------------
    // Stub conformance — never called by TARRecoveryExecutorV2, just confirms the mock compiles
    // as a complete ISemaphore and that unused surface reverts rather than silently no-oping.
    // ---------------------------------------------------------------------

    function test_validateProof_isStub_reverts() external {
        vm.expectRevert(MockSemaphore.NotImplemented.selector);
        semaphore.validateProof(0, _emptyProof());
    }
}
