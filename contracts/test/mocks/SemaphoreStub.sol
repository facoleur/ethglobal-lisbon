// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/// @notice Milestone A test double for `regenerateWatchTowerGroup`'s `executeFromExecutor` wiring
/// (admin = calling account, sequential `createGroup` then `addMembers`). Deliberately not
/// `ISemaphore`-shaped and has no `validateProof` — no proof verification exists yet at this
/// milestone. The real `MockSemaphore` (Milestone B) and the cross-checked real `Semaphore.sol`
/// (Milestone E/F) replace this once `challengeRecovery` exists.
contract SemaphoreStub {
    uint256 public groupCounter;
    mapping(uint256 groupId => address admin) public adminOf;
    mapping(uint256 groupId => uint256[] members) internal membersOf;
    bool public failNextAddMembers;

    function createGroup(
        address admin,
        uint256 /* merkleTreeDuration */
    )
        external
        returns (uint256 groupId)
    {
        groupId = ++groupCounter;
        adminOf[groupId] = admin;
    }

    function addMembers(uint256 groupId, uint256[] calldata identityCommitments) external {
        require(adminOf[groupId] == msg.sender, "SemaphoreStub: not admin");
        if (failNextAddMembers) {
            failNextAddMembers = false;
            revert("SemaphoreStub: forced failure");
        }
        for (uint256 i = 0; i < identityCommitments.length; i++) {
            membersOf[groupId].push(identityCommitments[i]);
        }
    }

    function membersOfGroup(uint256 groupId) external view returns (uint256[] memory) {
        return membersOf[groupId];
    }

    /// @dev Test hook: makes the *next* `addMembers` call revert, to exercise
    /// `regenerateWatchTowerGroup`'s "insertion fails mid-way" path without a real proof system.
    function setFailNextAddMembers(bool value) external {
        failNextAddMembers = value;
    }
}
