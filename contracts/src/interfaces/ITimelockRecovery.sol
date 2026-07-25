// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ITimelockRecovery
/// @notice Public integration interface for frontends and other contracts.
interface ITimelockRecovery {
    enum RecoveryStatus {
        None,
        Committed,
        Pending,
        Vetoed,
        Finalized,
        Expired
    }

    struct AccountConfig {
        address validator;
        address vetoer;
        bool enabled;
    }

    struct Recovery {
        bytes32 commitment;
        address claimant;
        address newValidator;
        bytes newValidatorData;
        uint48 committedAt;
        uint48 executableAt;
        uint96 deposit;
        uint64 nonce;
        RecoveryStatus status;
    }

    event RecoveryConfigured(address indexed account, address indexed validator, address indexed vetoer);

    event RecoveryConfigurationUpdated(address indexed account, address indexed validator, address indexed vetoer);

    event RecoveryDisabled(address indexed account);

    event RecoveryCommitted(
        address indexed account, address indexed claimant, bytes32 commitment, uint64 nonce, uint256 deposit
    );

    event RecoveryRevealed(
        address indexed account, address indexed newValidator, bytes32 indexed newPasskeyHash, uint256 executableAt
    );

    event RecoveryVetoed(address indexed account, address indexed vetoedBy);

    event RecoveryExpired(address indexed account, address indexed claimant);

    event RecoveryFinalized(address indexed account, address indexed newValidator, bytes32 indexed newPasskeyHash);

    function recoveryDelay() external view returns (uint48);

    function revealWindow() external view returns (uint48);

    function minimumDeposit() external view returns (uint96);

    function recoveryNonces(address account) external view returns (uint64);

    function nextRecoveryNonce(address account) external view returns (uint64);

    function computeCommitment(
        address account,
        address claimant,
        address newValidator,
        bytes calldata newValidatorData,
        bytes32 salt,
        uint64 nonce
    ) external view returns (bytes32);

    function commitRecovery(address account, bytes32 commitment, uint64 nonce) external payable;

    function revealRecovery(address account, address newValidator, bytes calldata newValidatorData, bytes32 salt)
        external;

    function vetoRecovery(address account) external;

    function expireCommitment(address account) external;

    function finalizeRecovery(address account) external;

    function updateRecoveryConfiguration(address validator, address vetoer) external;

    function getAccountConfig(address account) external view returns (AccountConfig memory);

    function getRecovery(address account) external view returns (Recovery memory);
}
