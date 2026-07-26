// SPDX-License-Identifier: MIT
// Transitively pulls in `lib/semaphore`'s `ISemaphore.sol`, pinned to exactly `0.8.23` — see
// `foundry.toml`.
pragma solidity 0.8.23;

import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/// @notice Full-interface test double for `ISemaphore` (Milestone B). Real logic only on the
/// three functions `TARRecoveryExecutorV2` actually calls — `createGroup(admin, duration)`,
/// `addMembers`, and `verifyProof` (Milestone D) — everything else is a stub that reverts, so
/// this compiles as a complete `ISemaphore`, not a silent subset of one. No LeanIMT, no Groth16:
/// `addMembers` stores the raw list, `verifyProof` returns a test-controlled flag. Same role as
/// `MockERC7579Account` (POC1): decouple `TARRecoveryExecutorV2`'s business-logic bugs from real
/// cryptographic verification bugs, tested separately against the real `Semaphore.sol`
/// (Milestone E).
///
/// `verifyProof` does no nullifier bookkeeping — deliberately: the real `Semaphore.sol`'s
/// `verifyProof` doesn't either (only `validateProof`, never called by `TARRecoveryExecutorV2`,
/// does that internally). Replay protection against a double-veto on the same recovery attempt
/// comes from `TARRecoveryExecutorV2`'s own `status` field, not from Semaphore.
contract MockSemaphore is ISemaphore {
    error NotImplemented();

    uint256 public groupCounter;
    mapping(uint256 groupId => address admin) public admins;
    mapping(uint256 groupId => uint256[] members) internal _members;
    mapping(uint256 groupId => bool result) public forcedResult;

    // ---------------------------------------------------------------------
    // Real logic
    // ---------------------------------------------------------------------

    function createGroup(
        address admin,
        uint256 /* merkleTreeDuration */
    )
        external
        returns (uint256 groupId)
    {
        // Post-increment, matching the real `Semaphore.sol` (`groupId = groupCounter++;`) — the
        // first group ever created gets id 0, which matters for `TARRecoveryExecutorV2`'s
        // constructor burning that id (see context_mC_v2.md §4).
        groupId = groupCounter++;
        admins[groupId] = admin;
    }

    function addMembers(uint256 groupId, uint256[] calldata identityCommitments) external {
        require(msg.sender == admins[groupId], "MockSemaphore: not admin");
        for (uint256 i = 0; i < identityCommitments.length; i++) {
            _members[groupId].push(identityCommitments[i]);
        }
    }

    /// @dev `view`, no state change — mirrors the real `Semaphore.sol` shape, unlike a
    /// `validateProof`-modeled mock would. `proof` itself is never inspected; only
    /// `forcedResult[groupId]` (test-controlled) decides the outcome, once past the structural
    /// "group has no members" check that the real contract also performs before anything else.
    function verifyProof(
        uint256 groupId,
        SemaphoreProof calldata /* proof */
    )
        external
        view
        returns (bool)
    {
        if (_members[groupId].length == 0) revert Semaphore__GroupHasNoMembers();
        return forcedResult[groupId];
    }

    // ---------------------------------------------------------------------
    // Test helpers (not part of ISemaphore)
    // ---------------------------------------------------------------------

    function setForcedResult(uint256 groupId, bool result) external {
        forcedResult[groupId] = result;
    }

    function membersOf(uint256 groupId) external view returns (uint256[] memory) {
        return _members[groupId];
    }

    // ---------------------------------------------------------------------
    // Stubs — never called by TARRecoveryExecutorV2, kept only for full ISemaphore conformance.
    // `validateProof` in particular is here purely for interface compliance: TARRecoveryExecutorV2
    // uses `verifyProof`, never this — see contract-level note.
    // ---------------------------------------------------------------------

    function createGroup() external pure returns (uint256) {
        revert NotImplemented();
    }

    function createGroup(
        address /* admin */
    )
        external
        pure
        returns (uint256)
    {
        revert NotImplemented();
    }

    function updateGroupAdmin(
        uint256,
        /* groupId */
        address /* newAdmin */
    )
        external
        pure
    {
        revert NotImplemented();
    }

    function acceptGroupAdmin(
        uint256 /* groupId */
    )
        external
        pure
    {
        revert NotImplemented();
    }

    function updateGroupMerkleTreeDuration(
        uint256,
        /* groupId */
        uint256 /* newMerkleTreeDuration */
    )
        external
        pure
    {
        revert NotImplemented();
    }

    function addMember(
        uint256,
        /* groupId */
        uint256 /* identityCommitment */
    )
        external
        pure
    {
        revert NotImplemented();
    }

    function updateMember(
        uint256, /* groupId */
        uint256, /* oldIdentityCommitment */
        uint256, /* newIdentityCommitment */
        uint256[] calldata /* merkleProofSiblings */
    )
        external
        pure
    {
        revert NotImplemented();
    }

    function removeMember(
        uint256,
        /* groupId */
        uint256,
        /* identityCommitment */
        uint256[] calldata /* merkleProofSiblings */
    )
        external
        pure
    {
        revert NotImplemented();
    }

    function validateProof(
        uint256,
        /* groupId */
        SemaphoreProof calldata /* proof */
    )
        external
        pure
    {
        revert NotImplemented();
    }
}
