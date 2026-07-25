// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRecoveryAdapter} from "./interfaces/IRecoveryAdapter.sol";

contract TimelockRecovery {
    enum RecoveryStatus {
        None,
        Committed,
        Pending,
        Vetoed,
        Finalized
    }

    struct AccountConfig {
        address adapter;
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
        RecoveryStatus status;
    }

    uint48 public immutable recoveryDelay;
    uint48 public immutable revealWindow;
    uint96 public immutable minimumDeposit;

    mapping(address account => AccountConfig) public accountConfigs;
    mapping(address account => Recovery) private recoveries;

    error InvalidAccount();
    error InvalidAdapter();
    error RecoveryNotEnabled();
    error DepositTooSmall();
    error RecoveryAlreadyActive();
    error RecoveryNotCommitted();
    error RecoveryNotPending();
    error Unauthorized();
    error InvalidReveal();
    error InvalidValidator();
    error TooEarly();
    error TransferFailed();

    event RecoveryConfigured(
        address indexed account,
        address indexed adapter
    );

    event RecoveryCommitted(
        address indexed account,
        address indexed claimant,
        bytes32 commitment,
        uint256 deposit
    );

    event RecoveryRevealed(
        address indexed account,
        address indexed newValidator,
        uint256 executableAt
    );

    event RecoveryVetoed(
        address indexed account,
        address indexed vetoedBy
    );

    event RecoveryFinalized(
        address indexed account,
        address indexed newValidator
    );

    constructor(
        uint48 _recoveryDelay,
        uint48 _revealWindow,
        uint96 _minimumDeposit
    ) {
        recoveryDelay = _recoveryDelay;
        revealWindow = _revealWindow;
        minimumDeposit = _minimumDeposit;
    }

    // ------------------------------------------------------------
    // 1. CONFIGURATION
    // ------------------------------------------------------------

    /**
     * Le smart account appelle cette fonction lors de l'installation
     * du système de recovery.
     */
    function configureRecovery(address adapter) external {
        if (adapter == address(0)) {
            revert InvalidAdapter();
        }

        accountConfigs[msg.sender] = AccountConfig({
            adapter: adapter,
            enabled: true
        });

        emit RecoveryConfigured(msg.sender, adapter);
    }

    // ------------------------------------------------------------
    // 2. COMMITMENT
    // ------------------------------------------------------------

    function computeCommitment(
        address account,
        address claimant,
        address newValidator,
        bytes calldata newValidatorData,
        bytes32 salt
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                account,
                claimant,
                newValidator,
                keccak256(newValidatorData),
                salt
            )
        );
    }

    // ------------------------------------------------------------
    // 3. COMMIT
    // ------------------------------------------------------------

    function commitRecovery(
        address account,
        bytes32 commitment
    ) external payable {
        if (account == address(0)) {
            revert InvalidAccount();
        }

        if (!accountConfigs[account].enabled) {
            revert RecoveryNotEnabled();
        }

        if (msg.value < minimumDeposit) {
            revert DepositTooSmall();
        }

        Recovery storage recovery = recoveries[account];

        if (
            recovery.status == RecoveryStatus.Committed
                || recovery.status == RecoveryStatus.Pending
        ) {
            revert RecoveryAlreadyActive();
        }

        delete recoveries[account];

        recovery.commitment = commitment;
        recovery.claimant = msg.sender;
        recovery.deposit = uint96(msg.value);
        recovery.status = RecoveryStatus.Committed;

        emit RecoveryCommitted(
            account,
            msg.sender,
            commitment,
            msg.value
        );
    }

    // ------------------------------------------------------------
    // 4. REVEAL
    // ------------------------------------------------------------

    function revealRecovery(
        address account,
        address newValidator,
        bytes calldata newValidatorData,
        bytes32 salt
    ) external {
        Recovery storage recovery = recoveries[account];

        if (recovery.status != RecoveryStatus.Committed) {
            revert RecoveryNotCommitted();
        }

        if (msg.sender != recovery.claimant) {
            revert Unauthorized();
        }

        if (newValidator == address(0)) {
            revert InvalidValidator();
        }

        bytes32 expectedCommitment = computeCommitment(
            account,
            msg.sender,
            newValidator,
            newValidatorData,
            salt
        );

        if (expectedCommitment != recovery.commitment) {
            revert InvalidReveal();
        }

        recovery.newValidator = newValidator;
        recovery.newValidatorData = newValidatorData;
        recovery.executableAt =
            uint48(block.timestamp) + recoveryDelay;
        recovery.status = RecoveryStatus.Pending;

        emit RecoveryRevealed(
            account,
            newValidator,
            recovery.executableAt
        );
    }

    // ------------------------------------------------------------
    // 5. VETO
    // ------------------------------------------------------------

    function vetoRecovery(address account) external {
        Recovery storage recovery = recoveries[account];

        if (recovery.status != RecoveryStatus.Pending) {
            revert RecoveryNotPending();
        }

        address adapter = accountConfigs[account].adapter;

        bool authorized = IRecoveryAdapter(adapter).canVeto(
            account,
            msg.sender
        );

        if (!authorized) {
            revert Unauthorized();
        }

        recovery.status = RecoveryStatus.Vetoed;

        uint256 deposit = recovery.deposit;
        recovery.deposit = 0;

        /*
         * Politique économique temporaire :
         * on rembourse le claimant.
         *
         * Plus tard, on pourra choisir de slasher tout ou partie
         * du dépôt en cas de veto.
         */
        _sendETH(recovery.claimant, deposit);

        emit RecoveryVetoed(account, msg.sender);
    }

    // ------------------------------------------------------------
    // 6. FINALIZE
    // ------------------------------------------------------------

    function finalizeRecovery(address account) external {
        Recovery storage recovery = recoveries[account];

        if (recovery.status != RecoveryStatus.Pending) {
            revert RecoveryNotPending();
        }

        if (block.timestamp < recovery.executableAt) {
            revert TooEarly();
        }

        /*
         * On passe d'abord à Finalized.
         * Si applyRecovery revert, toute la transaction revert,
         * donc le statut revient automatiquement à Pending.
         */
        recovery.status = RecoveryStatus.Finalized;

        address adapter = accountConfigs[account].adapter;

        IRecoveryAdapter(adapter).applyRecovery(
            account,
            recovery.newValidator,
            recovery.newValidatorData
        );

        uint256 deposit = recovery.deposit;
        recovery.deposit = 0;

        _sendETH(recovery.claimant, deposit);

        emit RecoveryFinalized(
            account,
            recovery.newValidator
        );
    }

    // ------------------------------------------------------------
    // 7. READ
    // ------------------------------------------------------------

    function getRecovery(
        address account
    ) external view returns (Recovery memory) {
        return recoveries[account];
    }

    // ------------------------------------------------------------
    // INTERNAL
    // ------------------------------------------------------------

    function _sendETH(
        address recipient,
        uint256 amount
    ) internal {
        if (amount == 0) {
            return;
        }

        (bool success,) = payable(recipient).call{
            value: amount
        }("");

        if (!success) {
            revert TransferFailed();
        }
    }
}
