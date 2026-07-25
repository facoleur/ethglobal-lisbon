// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITARRecovery} from "./interfaces/ITARRecovery.sol";

/// @notice TAR (Timelock Account Recovery) — replaces recovery guardians with an economic game:
/// anyone can initiate a recovery by staking a confiscable `lockValue` and waiting out a
/// `lockTime`, during which the account owner can reject/veto the attempt and confiscate the
/// stake.
///
/// Milestone A scope: module skeleton (types, storage, ERC-7579 boilerplate, config) only.
/// `requestRecovery`/`revealRecovery`/`challengeRecovery`/`finalizeRecovery` are stubbed
/// (`NotImplementedYet`) — their state machine is implemented in Milestone B.
contract TARRecoveryExecutor is ITARRecovery {
    enum RecoveryStatus {
        None, // no recovery in progress on this account
        Revealed, // reveal done, challenge window (lockTime) open
        Rejected, // rejected by the owner, stake returned to addressToRecover
        Finalized // finalized, new signer installed, stake returned to addressToRecover
    }

    struct RecoveryConfig {
        uint256 lockValue;
        uint256 lockTime;
    }

    /// @dev Milestone B (ECDSA, temporary) shape. Becomes `newPubKeyX`/`newPubKeyY` (uint256) at
    /// Milestone C — not anticipated here.
    struct RecoveryRequest {
        address broadcasterAddress;
        address newSigner;
        uint256 stakedValue;
        uint256 revealTimestamp;
        RecoveryStatus status;
    }

    // ERC-7579 module type ID for executors (see EIP-7579) — hardcoded like `NoopExecutor`,
    // matching the value in `kernel/src/types/Constants.sol` (`MODULE_TYPE_EXECUTOR = 2`).
    uint256 internal constant MODULE_TYPE_EXECUTOR = 2;

    mapping(address account => RecoveryConfig config) public configs;
    mapping(bytes32 commitment => bool exists) public pendingCommitments;
    mapping(address addressToRecover => RecoveryRequest request) public recoveries;

    // No separate `activeRecovery` mapping: `recoveries[account].status == RecoveryStatus.Revealed`
    // is the active-recovery guard, used starting from Milestone B.

    function onInstall(bytes calldata data) external payable {
        if (_isInitialized(msg.sender)) revert AlreadyInitialized(msg.sender);
        (uint256 lockValue, uint256 lockTime) = abi.decode(data, (uint256, uint256));
        if (lockValue == 0 || lockTime == 0) revert InvalidRecoveryParams();
        configs[msg.sender] = RecoveryConfig(lockValue, lockTime);
        emit RecoveryParamsUpdated(msg.sender, lockValue, lockTime);
    }

    function onUninstall(bytes calldata) external payable {
        if (!_isInitialized(msg.sender)) revert NotInitialized(msg.sender);
        if (recoveries[msg.sender].status == RecoveryStatus.Revealed) {
            revert ActiveRecoveryExists(msg.sender);
        }
        delete configs[msg.sender];
        delete recoveries[msg.sender];
    }

    function isModuleType(uint256 moduleTypeId) external pure returns (bool) {
        return moduleTypeId == MODULE_TYPE_EXECUTOR;
    }

    function isInitialized(address smartAccount) external view returns (bool) {
        return _isInitialized(smartAccount);
    }

    /// @dev `msg.sender` scopes the update to the caller's own account — no `account` parameter,
    /// same pattern as `onInstall`.
    function updateRecoveryParams(uint256 lockValue, uint256 lockTime) external {
        if (!_isInitialized(msg.sender)) revert NotInitialized(msg.sender);
        if (lockValue == 0 || lockTime == 0) revert InvalidRecoveryParams();
        configs[msg.sender] = RecoveryConfig(lockValue, lockTime);
        emit RecoveryParamsUpdated(msg.sender, lockValue, lockTime);
    }

    /// @dev Stubbed until Milestone B.
    function requestRecovery(bytes32) external pure {
        revert NotImplementedYet();
    }

    /// @dev Stubbed until Milestone B.
    function revealRecovery(address, address, address, bytes32) external payable {
        revert NotImplementedYet();
    }

    /// @dev Stubbed until Milestone B.
    function challengeRecovery(address, bytes calldata) external pure {
        revert NotImplementedYet();
    }

    /// @dev Stubbed until Milestone B.
    function finalizeRecovery(address) external pure {
        revert NotImplementedYet();
    }

    function _isInitialized(address smartAccount) internal view returns (bool) {
        return configs[smartAccount].lockTime != 0;
    }
}
