// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC7579Account} from "kernel/interfaces/IERC7579Account.sol";
import {ExecLib} from "kernel/utils/ExecLib.sol";
import {ITARRecovery} from "./interfaces/ITARRecovery.sol";

/// @notice TAR (Timelock Account Recovery) — replaces recovery guardians with an economic game:
/// anyone can initiate a recovery by staking a confiscable `lockValue` and waiting out a
/// `lockTime`, during which the account owner can reject/veto the attempt and confiscate the
/// stake.
///
/// Milestone C scope: full commit-reveal state machine, with the new signer as a WebAuthn/P-256
/// `(pubKeyX, pubKeyY)` pair — replacing the Milestone B `newSigner` (plain `address`, ECDSA,
/// temporary). `finalizeRecovery` rotates the signer on a fixed, constructor-set `validator`
/// address (a test mock at this milestone) — never a caller-supplied target, which would let
/// anyone make `addressToRecover` execute an arbitrary call with the account's authority.
contract TARRecoveryExecutor is ITARRecovery, ReentrancyGuard {
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

    /// @dev Milestone C (WebAuthn) shape — `pubKeyX`/`pubKeyY` (uint256) replaced the Milestone B
    /// `newSigner` (address).
    struct RecoveryRequest {
        address broadcasterAddress;
        uint256 newPubKeyX;
        uint256 newPubKeyY;
        uint256 stakedValue;
        uint256 revealTimestamp;
        RecoveryStatus status;
    }

    // ERC-7579 module type ID for executors (see EIP-7579) — hardcoded like `NoopExecutor`,
    // matching the value in `kernel/src/types/Constants.sol` (`MODULE_TYPE_EXECUTOR = 2`).
    uint256 internal constant MODULE_TYPE_EXECUTOR = 2;

    // Minimum number of blocks between a commitment's `requestRecovery` and its `revealRecovery`.
    // 1 block is the standard minimum for this class of attack (ENS/Uniswap-style commit-reveal):
    // it blocks an attacker who reacts to a victim's pending `revealRecovery` in the mempool by
    // committing and revealing their own malicious attempt within that same block, since their
    // commitment cannot mature until the following block — by which time the victim's reveal has
    // already landed and taken the `RecoveryAlreadyActive` slot. It does not (and is not meant to)
    // stop a patient attacker who pre-commits against a known target well in advance; that attack
    // is inherent to "anyone can initiate a recovery" and is defended by the owner's veto instead.
    uint256 internal constant MIN_COMMIT_REVEAL_BLOCKS = 1;

    // `finalizeRecovery` target for the signer rotation call. Fixed at deployment, never a
    // parameter — see contract-level note. Milestone B: a `MockRotatableValidator` test double.
    // Milestone E: the real `TARWebAuthnValidator` (requires redeploying this contract).
    address public immutable validator;

    mapping(address account => RecoveryConfig config) public configs;
    // 0 = no pending commitment; otherwise the block number `requestRecovery` was called at.
    mapping(bytes32 commitment => uint256 commitBlock) public pendingCommitments;
    mapping(address addressToRecover => RecoveryRequest request) public recoveries;

    // No separate `activeRecovery` mapping: `recoveries[account].status == RecoveryStatus.Revealed`
    // is the active-recovery guard, used starting from Milestone B.

    constructor(address _validator) {
        validator = _validator;
    }

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

    /// @dev No uniqueness check — a commitment already pending simply has its block number
    /// refreshed (no-op beyond resetting the `MIN_COMMIT_REVEAL_BLOCKS` clock). Unbounded spam is
    /// an accepted POC limit (`context-full-implementation.md` §7): this is entirely gas-only, no
    /// value is ever at stake at this step.
    function requestRecovery(bytes32 commitment) external {
        pendingCommitments[commitment] = block.number;
        emit RecoveryRequested(commitment);
    }

    /// @dev Check order goes cheapest-first, before recomputing the commitment hash. A wrong
    /// `msg.value` reverts the whole transaction — no state is ever written on a bad amount
    /// (no `Failed` status/recovery function needed, see `context-full-implementation.md` §4.1).
    /// `pubKeyX`/`pubKeyY` zero-checked here (not strictly required for correctness — an invalid
    /// key would simply make `finalizeRecovery` revert later — but fails fast at reveal instead
    /// of after the caller waits out the full `lockTime`).
    function revealRecovery(
        address addressToRecover,
        address broadcasterAddress,
        uint256 pubKeyX,
        uint256 pubKeyY,
        bytes32 salt
    ) external payable {
        if (!_isInitialized(addressToRecover)) {
            revert NotInitialized(addressToRecover);
        }
        if (recoveries[addressToRecover].status == RecoveryStatus.Revealed) {
            revert RecoveryAlreadyActive(addressToRecover);
        }
        if (msg.sender != broadcasterAddress) revert InvalidBroadcaster();
        if (pubKeyX == 0 || pubKeyY == 0) revert InvalidPublicKey();

        bytes32 commitment = keccak256(abi.encodePacked(addressToRecover, broadcasterAddress, pubKeyX, pubKeyY, salt));
        uint256 commitBlock = pendingCommitments[commitment];
        if (commitBlock == 0) revert CommitmentNotFound();
        if (block.number < commitBlock + MIN_COMMIT_REVEAL_BLOCKS) revert CommitmentNotMature();

        if (msg.value != configs[addressToRecover].lockValue) {
            revert WrongStakedAmount();
        }

        delete pendingCommitments[commitment];

        recoveries[addressToRecover] = RecoveryRequest({
            broadcasterAddress: broadcasterAddress,
            newPubKeyX: pubKeyX,
            newPubKeyY: pubKeyY,
            stakedValue: msg.value,
            revealTimestamp: block.timestamp,
            status: RecoveryStatus.Revealed
        });

        emit RecoveryRevealed(
            addressToRecover, broadcasterAddress, block.timestamp + configs[addressToRecover].lockTime
        );
    }

    /// @dev Owner-authenticated via ERC-1271 (validator-agnostic). Remains callable for as long
    /// as `status == Revealed`, even past `lockTime` — the owner can still reject an unfinalized
    /// attempt (confirmed default; no upper-bound symmetric to `finalizeRecovery`'s check).
    /// CEI: `status` updated before the stake transfer. `ReentrancyGuard` on the external call.
    function challengeRecovery(address addressToRecover, bytes calldata ownerSignature) external nonReentrant {
        RecoveryRequest storage req = recoveries[addressToRecover];
        if (req.status != RecoveryStatus.Revealed) {
            revert RecoveryNotRevealed(addressToRecover);
        }

        bytes32 rejectHash = keccak256(
            abi.encodePacked(
                address(this), block.chainid, addressToRecover, req.broadcasterAddress, req.revealTimestamp, "REJECT"
            )
        );

        if (
            IERC1271(addressToRecover).isValidSignature(rejectHash, ownerSignature)
                != IERC1271.isValidSignature.selector
        ) {
            revert InvalidRejectSignature();
        }

        uint256 stake = req.stakedValue;
        req.status = RecoveryStatus.Rejected;

        (bool success,) = addressToRecover.call{value: stake}("");
        if (!success) revert TransferFailed();

        emit RecoveryRejected(addressToRecover);
    }

    /// @dev Anyone, once `lockTime` has elapsed since reveal without a challenge. Rotates the
    /// signer via `executeFromExecutor` against the fixed `validator` target (see contract-level
    /// note) — never a caller-supplied one. CEI: `status` updated before the external call and
    /// the stake transfer. `ReentrancyGuard` on both.
    function finalizeRecovery(address addressToRecover) external nonReentrant {
        RecoveryRequest storage req = recoveries[addressToRecover];
        if (req.status != RecoveryStatus.Revealed) {
            revert RecoveryNotRevealed(addressToRecover);
        }
        if (block.timestamp < req.revealTimestamp + configs[addressToRecover].lockTime) {
            revert TimelockNotElapsed(addressToRecover);
        }

        uint256 stake = req.stakedValue;
        uint256 pubKeyX = req.newPubKeyX;
        uint256 pubKeyY = req.newPubKeyY;
        req.status = RecoveryStatus.Finalized;

        bytes memory rotationCalldata = abi.encodeWithSignature("setNewOwner(uint256,uint256)", pubKeyX, pubKeyY);
        IERC7579Account(addressToRecover)
            .executeFromExecutor(ExecLib.encodeSimpleSingle(), ExecLib.encodeSingle(validator, 0, rotationCalldata));

        (bool success,) = addressToRecover.call{value: stake}("");
        if (!success) revert TransferFailed();

        emit RecoveryFinalized(addressToRecover);
    }

    function _isInitialized(address smartAccount) internal view returns (bool) {
        return configs[smartAccount].lockTime != 0;
    }
}
