// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IExecutor} from "kernel/interfaces/IERC7579Modules.sol";
import {ExecLib} from "kernel/utils/ExecLib.sol";

import {IKernelExecutorAccount} from "./interfaces/IKernelExecutorAccount.sol";
import {IRotatableWebAuthnValidator} from "./interfaces/IRotatableWebAuthnValidator.sol";

/// @title TimelockRecovery
/// @notice TAR business logic + ERC-7579 executor.
///
/// Each Kernel installs this contract as an executor before the passkey is lost.
/// At finalization, this contract can only ask the configured Kernel to call
/// the configured validator's rotatePublicKey selector with value = 0.
contract TimelockRecovery is IExecutor {
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

    uint256 internal constant MODULE_TYPE_EXECUTOR = 2;

    uint48 public immutable recoveryDelay;
    uint48 public immutable revealWindow;
    uint96 public immutable minimumDeposit;

    mapping(address account => AccountConfig config) private _accountConfigs;
    mapping(address account => Recovery recovery) private _recoveries;
    mapping(address account => uint64 nonce) public recoveryNonces;

    uint256 private _reentrancyStatus = 1;

    error InvalidAccount();
    error InvalidAddress();
    error InvalidValidator();
    error RecoveryNotEnabled();
    error DepositTooSmall();
    error DepositTooLarge();
    error RecoveryAlreadyActive();
    error RecoveryNotCommitted();
    error RecoveryNotPending();
    error Unauthorized();
    error InvalidReveal();
    error InvalidNewPasskey();
    error RevealWindowExpired();
    error RevealWindowActive();
    error TooEarly();
    error TransferFailed();
    error ReentrantCall();

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

    constructor(uint48 _recoveryDelay, uint48 _revealWindow, uint96 _minimumDeposit) {
        recoveryDelay = _recoveryDelay;
        revealWindow = _revealWindow;
        minimumDeposit = _minimumDeposit;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus != 1) revert ReentrantCall();
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    // ---------------------------------------------------------------------
    // ERC-7579 EXECUTOR LIFECYCLE
    // ---------------------------------------------------------------------

    /// @notice Called by a Kernel account while installing TAR as executor.
    /// executorData = abi.encode(rotatableValidator, vetoer)
    function onInstall(bytes calldata executorData) external payable override {
        if (_accountConfigs[msg.sender].enabled) {
            revert AlreadyInitialized(msg.sender);
        }

        (address validator, address vetoer) = abi.decode(executorData, (address, address));

        _validateConfiguration(validator, vetoer);

        _accountConfigs[msg.sender] = AccountConfig({validator: validator, vetoer: vetoer, enabled: true});

        emit RecoveryConfigured(msg.sender, validator, vetoer);
    }

    function onUninstall(bytes calldata) external payable override {
        if (!_accountConfigs[msg.sender].enabled) {
            revert NotInitialized(msg.sender);
        }

        RecoveryStatus status = _recoveries[msg.sender].status;
        if (status == RecoveryStatus.Committed || status == RecoveryStatus.Pending) {
            revert RecoveryAlreadyActive();
        }

        delete _accountConfigs[msg.sender];
        emit RecoveryDisabled(msg.sender);
    }

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_EXECUTOR;
    }

    function isInitialized(address smartAccount) external view override returns (bool) {
        return _accountConfigs[smartAccount].enabled;
    }

    /// @notice Called through a normal Kernel UserOperation while the account
    /// is still healthy.
    function updateRecoveryConfiguration(address validator, address vetoer) external {
        if (!_accountConfigs[msg.sender].enabled) {
            revert RecoveryNotEnabled();
        }

        RecoveryStatus status = _recoveries[msg.sender].status;
        if (status == RecoveryStatus.Committed || status == RecoveryStatus.Pending) {
            revert RecoveryAlreadyActive();
        }

        _validateConfiguration(validator, vetoer);

        _accountConfigs[msg.sender] = AccountConfig({validator: validator, vetoer: vetoer, enabled: true});

        emit RecoveryConfigurationUpdated(msg.sender, validator, vetoer);
    }

    // ---------------------------------------------------------------------
    // COMMITMENT
    // ---------------------------------------------------------------------

    function nextRecoveryNonce(address account) public view returns (uint64) {
        return recoveryNonces[account] + 1;
    }

    function computeCommitment(
        address account,
        address claimant,
        address newValidator,
        bytes calldata newValidatorData,
        bytes32 salt,
        uint64 nonce
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid, address(this), account, claimant, newValidator, keccak256(newValidatorData), salt, nonce
            )
        );
    }

    // ---------------------------------------------------------------------
    // COMMIT
    // ---------------------------------------------------------------------

    function commitRecovery(address account, bytes32 commitment, uint64 nonce) external payable {
        if (account == address(0)) revert InvalidAccount();

        AccountConfig memory config = _accountConfigs[account];
        if (!config.enabled) revert RecoveryNotEnabled();

        if (msg.value < minimumDeposit) revert DepositTooSmall();
        if (msg.value > type(uint96).max) revert DepositTooLarge();

        if (nonce != nextRecoveryNonce(account)) {
            revert InvalidReveal();
        }

        Recovery storage current = _recoveries[account];

        if (current.status == RecoveryStatus.Committed || current.status == RecoveryStatus.Pending) {
            revert RecoveryAlreadyActive();
        }

        delete _recoveries[account];

        recoveryNonces[account] = nonce;

        Recovery storage recovery = _recoveries[account];
        recovery.commitment = commitment;
        recovery.claimant = msg.sender;
        recovery.committedAt = uint48(block.timestamp);
        recovery.deposit = uint96(msg.value);
        recovery.nonce = nonce;
        recovery.status = RecoveryStatus.Committed;

        emit RecoveryCommitted(account, msg.sender, commitment, nonce, msg.value);
    }

    // ---------------------------------------------------------------------
    // REVEAL
    // ---------------------------------------------------------------------

    function revealRecovery(address account, address newValidator, bytes calldata newValidatorData, bytes32 salt)
        external
    {
        Recovery storage recovery = _recoveries[account];

        if (recovery.status != RecoveryStatus.Committed) {
            revert RecoveryNotCommitted();
        }

        if (msg.sender != recovery.claimant) {
            revert Unauthorized();
        }

        if (block.timestamp > uint256(recovery.committedAt) + revealWindow) {
            revert RevealWindowExpired();
        }

        AccountConfig memory config = _accountConfigs[account];
        if (!config.enabled) revert RecoveryNotEnabled();
        if (newValidator != config.validator) {
            revert InvalidValidator();
        }

        _decodeAndValidateNewPasskey(newValidatorData);

        bytes32 expectedCommitment =
            computeCommitment(account, msg.sender, newValidator, newValidatorData, salt, recovery.nonce);

        if (expectedCommitment != recovery.commitment) {
            revert InvalidReveal();
        }

        recovery.newValidator = newValidator;
        recovery.newValidatorData = newValidatorData;
        recovery.executableAt = uint48(block.timestamp) + recoveryDelay;
        recovery.status = RecoveryStatus.Pending;

        emit RecoveryRevealed(account, newValidator, keccak256(newValidatorData), recovery.executableAt);
    }

    // ---------------------------------------------------------------------
    // VETO / EXPIRY
    // ---------------------------------------------------------------------

    function vetoRecovery(address account) external nonReentrant {
        Recovery storage recovery = _recoveries[account];

        if (recovery.status != RecoveryStatus.Pending) {
            revert RecoveryNotPending();
        }

        if (msg.sender != _accountConfigs[account].vetoer) {
            revert Unauthorized();
        }

        recovery.status = RecoveryStatus.Vetoed;

        uint256 deposit = recovery.deposit;
        recovery.deposit = 0;

        _sendETH(recovery.claimant, deposit);

        emit RecoveryVetoed(account, msg.sender);
    }

    /// @notice Prevents an unrevealed commitment from blocking the account
    /// forever.
    function expireCommitment(address account) external nonReentrant {
        Recovery storage recovery = _recoveries[account];

        if (recovery.status != RecoveryStatus.Committed) {
            revert RecoveryNotCommitted();
        }

        if (block.timestamp <= uint256(recovery.committedAt) + revealWindow) {
            revert RevealWindowActive();
        }

        recovery.status = RecoveryStatus.Expired;

        uint256 deposit = recovery.deposit;
        recovery.deposit = 0;

        _sendETH(recovery.claimant, deposit);

        emit RecoveryExpired(account, recovery.claimant);
    }

    // ---------------------------------------------------------------------
    // FINALIZE
    // ---------------------------------------------------------------------

    function finalizeRecovery(address account) external nonReentrant {
        Recovery storage recovery = _recoveries[account];

        if (recovery.status != RecoveryStatus.Pending) {
            revert RecoveryNotPending();
        }

        if (block.timestamp < recovery.executableAt) {
            revert TooEarly();
        }

        AccountConfig memory config = _accountConfigs[account];
        if (!config.enabled) revert RecoveryNotEnabled();
        if (recovery.newValidator != config.validator) {
            revert InvalidValidator();
        }

        (uint256 newPubKeyX, uint256 newPubKeyY, bytes32 credentialIdHash) =
            _decodeAndValidateNewPasskey(recovery.newValidatorData);

        // Checks-effects-interactions. If Kernel/validator reverts, the whole
        // transaction reverts and the status returns to Pending.
        recovery.status = RecoveryStatus.Finalized;

        bytes memory rotateCall =
            abi.encodeCall(IRotatableWebAuthnValidator.rotatePublicKey, (newPubKeyX, newPubKeyY, credentialIdHash));

        IKernelExecutorAccount(account)
            .executeFromExecutor(ExecLib.encodeSimpleSingle(), ExecLib.encodeSingle(config.validator, 0, rotateCall));

        uint256 deposit = recovery.deposit;
        recovery.deposit = 0;

        _sendETH(recovery.claimant, deposit);

        emit RecoveryFinalized(account, config.validator, keccak256(recovery.newValidatorData));
    }

    // ---------------------------------------------------------------------
    // READ
    // ---------------------------------------------------------------------

    function getAccountConfig(address account) external view returns (AccountConfig memory) {
        return _accountConfigs[account];
    }

    function getRecovery(address account) external view returns (Recovery memory) {
        return _recoveries[account];
    }

    // ---------------------------------------------------------------------
    // INTERNAL
    // ---------------------------------------------------------------------

    function _validateConfiguration(address validator, address vetoer) private pure {
        if (validator == address(0) || vetoer == address(0)) {
            revert InvalidAddress();
        }
    }

    function _decodeAndValidateNewPasskey(bytes memory newValidatorData)
        private
        pure
        returns (uint256 pubKeyX, uint256 pubKeyY, bytes32 credentialIdHash)
    {
        (pubKeyX, pubKeyY, credentialIdHash) = abi.decode(newValidatorData, (uint256, uint256, bytes32));

        if (pubKeyX == 0 || pubKeyY == 0) {
            revert InvalidNewPasskey();
        }
    }

    function _sendETH(address recipient, uint256 amount) private {
        if (amount == 0) return;

        (bool success,) = payable(recipient).call{value: amount}("");

        if (!success) revert TransferFailed();
    }
}
