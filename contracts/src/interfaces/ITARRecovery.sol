// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IExecutor} from "kernel/interfaces/IERC7579Modules.sol";

/// @notice TAR (Timelock Account Recovery) executor module (ERC-7579 type 2, `IExecutor`).
/// `IExecutor` already provides `onInstall`/`onUninstall`/`isModuleType`/`isInitialized` and the
/// `AlreadyInitialized`/`NotInitialized` errors (inherited from `IModule`); `NotInitialized` is
/// reused here to check that `addressToRecover` has installed the module.
interface ITARRecovery is IExecutor {
    /// @dev lockValue == 0 or lockTime == 0 passed to `onInstall`/`updateRecoveryParams`.
    error InvalidRecoveryParams();

    /// @dev `onUninstall` attempted while `recoveries[account].status == RecoveryStatus.Revealed`.
    error ActiveRecoveryExists(address account);

    /// @dev `revealRecovery` recomputed a commitment absent from `pendingCommitments`.
    error CommitmentNotFound();

    /// @dev `revealRecovery` called by an address other than its own `broadcasterAddress` param.
    error InvalidBroadcaster();

    /// @dev `revealRecovery`'s `msg.value` does not match `configs[addressToRecover].lockValue`.
    error WrongStakedAmount();

    /// @dev `revealRecovery` targeting an account that already has a `Revealed` recovery.
    error RecoveryAlreadyActive(address account);

    /// @dev `challengeRecovery`/`finalizeRecovery` called while `status != RecoveryStatus.Revealed`.
    error RecoveryNotRevealed(address account);

    /// @dev `finalizeRecovery` called before `revealTimestamp + lockTime` has elapsed.
    error TimelockNotElapsed(address account);

    /// @dev `challengeRecovery`'s `ownerSignature` does not validate against `rejectHash` via ERC-1271.
    error InvalidRejectSignature();

    /// @dev Stake transfer to `addressToRecover` failed in `challengeRecovery`/`finalizeRecovery`.
    error TransferFailed();

    event RecoveryParamsUpdated(address indexed account, uint256 lockValue, uint256 lockTime);
    event RecoveryRequested(bytes32 indexed commitment);
    event RecoveryRevealed(
        address indexed addressToRecover, address indexed broadcasterAddress, uint256 challengeDeadline
    );
    event RecoveryRejected(address indexed addressToRecover);
    event RecoveryFinalized(address indexed addressToRecover);

    /// @dev Owner of `msg.sender`'s own account only — no separate `account` parameter.
    function updateRecoveryParams(uint256 lockValue, uint256 lockTime) external;

    /// @dev Anyone, non-payable. Records commitment existence; no uniqueness check (spam is an
    /// accepted POC limit — see `context-full-implementation.md` §7).
    function requestRecovery(bytes32 commitment) external;

    /// @dev Must be called by `broadcasterAddress` itself. `newSigner` is the Milestone B (ECDSA)
    /// shape — becomes `(pubKeyX, pubKeyY)` at Milestone C.
    function revealRecovery(address addressToRecover, address broadcasterAddress, address newSigner, bytes32 salt)
        external
        payable;

    /// @dev Owner of `addressToRecover`, authenticated via ERC-1271 (validator-agnostic).
    function challengeRecovery(address addressToRecover, bytes calldata ownerSignature) external;

    /// @dev Anyone, callable only once `lockTime` has elapsed since reveal without a challenge.
    function finalizeRecovery(address addressToRecover) external;
}
