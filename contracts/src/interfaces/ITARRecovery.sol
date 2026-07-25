// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IExecutor} from "kernel/interfaces/IERC7579Modules.sol";

/// @notice TAR (Timelock Account Recovery) executor module (ERC-7579 type 2, `IExecutor`).
/// Milestone A: types, storage and boilerplate only — the four business functions below are
/// declared for interface conformance but stubbed (`NotImplementedYet`) until Milestone B.
/// `IExecutor` already provides `onInstall`/`onUninstall`/`isModuleType`/`isInitialized` and the
/// `AlreadyInitialized`/`NotInitialized` errors (inherited from `IModule`).
interface ITARRecovery is IExecutor {
    /// @dev lockValue == 0 or lockTime == 0 passed to `onInstall`/`updateRecoveryParams`.
    error InvalidRecoveryParams();

    /// @dev `onUninstall` attempted while `recoveries[account].status == RecoveryStatus.Revealed`.
    error ActiveRecoveryExists(address account);

    /// @dev Placeholder for the four business functions below until Milestone B implements them.
    error NotImplementedYet();

    event RecoveryParamsUpdated(address indexed account, uint256 lockValue, uint256 lockTime);

    /// @dev Owner of `msg.sender`'s own account only — no separate `account` parameter.
    function updateRecoveryParams(uint256 lockValue, uint256 lockTime) external;

    /// @dev Stubbed until Milestone B (commit-reveal state machine).
    function requestRecovery(bytes32 commitment) external;

    /// @dev Stubbed until Milestone B. `newSigner` is the Milestone B (ECDSA) shape — becomes
    /// `(pubKeyX, pubKeyY)` at Milestone C.
    function revealRecovery(address addressToRecover, address broadcasterAddress, address newSigner, bytes32 salt)
        external
        payable;

    /// @dev Stubbed until Milestone B.
    function challengeRecovery(address addressToRecover, bytes calldata ownerSignature) external;

    /// @dev Stubbed until Milestone B.
    function finalizeRecovery(address addressToRecover) external;
}
