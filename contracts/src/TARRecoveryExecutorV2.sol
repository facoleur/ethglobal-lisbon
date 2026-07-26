// SPDX-License-Identifier: MIT
// `lib/semaphore` hard-pins every one of its files to `pragma solidity 0.8.23;` (exact, no
// caret) — see `foundry.toml` for why this file, alone among our own sources, has to match that
// instead of the `^0.8.28` used everywhere else.
pragma solidity 0.8.23;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC7579Account} from "kernel/interfaces/IERC7579Account.sol";
import {ExecLib} from "kernel/utils/ExecLib.sol";
import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import {ITARRecoveryV2} from "./interfaces/ITARRecoveryV2.sol";

/// @notice TAR (Timelock Account Recovery) — V2, Semaphore watch towers. Copy of
/// `TARRecoveryExecutor` (V1): `requestRecovery`, `revealRecovery`, `finalizeRecovery`,
/// `RecoveryStatus`, `RecoveryConfig`, `RecoveryRequest`, `configs`, `pendingCommitments`,
/// `recoveries`, the commit-reveal events, `onInstall`/`onUninstall`/`isModuleType`/
/// `isInitialized` and `MIN_COMMIT_REVEAL_BLOCKS` are unchanged, character for character. V1's
/// `challengeRecovery` (owner-only, ERC-1271 `ownerSignature`) is gone entirely in this milestone
/// — Milestone D reintroduces it unified for the owner and watch towers behind a single Semaphore
/// proof, replacing the ERC-1271 path rather than sitting alongside it. This milestone only adds
/// the storage and `regenerateWatchTowerGroup` needed to manage a defender group ahead of that.
contract TARRecoveryExecutorV2 is ITARRecoveryV2, ReentrancyGuard {
    enum RecoveryStatus {
        None, // no recovery in progress on this account
        Revealed, // reveal done, challenge window (lockTime) open
        Rejected, // rejected by a defender, stake returned to addressToRecover (Milestone D)
        Finalized // finalized, new signer installed, stake returned to addressToRecover
    }

    struct RecoveryConfig {
        uint256 lockValue;
        uint256 lockTime;
    }

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
    // See `TARRecoveryExecutor` (V1) natspec for the full rationale — unchanged here.
    uint256 internal constant MIN_COMMIT_REVEAL_BLOCKS = 1;

    // Owner included: the original "16 WT max" brainstorming predates the owner becoming a
    // defender in their own right. A single constant to revisit if the team decides otherwise.
    uint256 public constant MAX_GROUP_SIZE = 16;

    // Fixed high on purpose so no Merkle root expires mid-challenge-window, however long
    // `lockTime` is — Semaphore's own default (1 hour) does not fit that requirement.
    uint256 public constant MERKLE_TREE_DURATION = 365 days;

    // `finalizeRecovery` target for the signer rotation call. Fixed at deployment, never a
    // parameter — see `TARRecoveryExecutor` (V1) contract-level note.
    address public immutable validator;

    // Fixed at deployment; per-environment address resolution (Anvil vs Sepolia) is Milestone F.
    ISemaphore public immutable semaphore;

    mapping(address account => RecoveryConfig config) public configs;
    // 0 = no pending commitment; otherwise the block number `requestRecovery` was called at.
    mapping(bytes32 commitment => uint256 commitBlock) public pendingCommitments;
    mapping(address addressToRecover => RecoveryRequest request) public recoveries;
    // Current Semaphore defender group per account. Replaced wholesale on every
    // `regenerateWatchTowerGroup` call — the previous `groupId`, if any, is never referenced
    // again, so there is no notion of "removing" a stale group here.
    mapping(address account => uint256 groupId) public groupOf;

    constructor(address _validator, address _semaphore) {
        validator = _validator;
        semaphore = ISemaphore(_semaphore);
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

    /// @dev The first request fixes the commitment block. Duplicate requests are no-ops so an
    /// observer cannot keep resetting the maturity window and indefinitely prevent the reveal.
    /// Unbounded spam with distinct commitments remains an accepted POC limit.
    function requestRecovery(bytes32 commitment) external {
        if (pendingCommitments[commitment] != 0) return;
        pendingCommitments[commitment] = block.number;
        emit RecoveryRequested(commitment);
    }

    /// @dev Check order goes cheapest-first, before recomputing the commitment hash. A wrong
    /// `msg.value` reverts the whole transaction — no state is ever written on a bad amount.
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
        if (block.number < commitBlock + MIN_COMMIT_REVEAL_BLOCKS) {
            revert CommitmentNotMature();
        }

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

    /// @dev Anyone, once `lockTime` has elapsed since reveal without a challenge. Rotates the
    /// signer via `executeFromExecutor` against the fixed `validator` target — never a
    /// caller-supplied one. CEI: `status` updated before the external call and the stake
    /// transfer. `ReentrancyGuard` on both.
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

    /// @dev Owner of `msg.sender`'s own account only, same calling pattern as
    /// `updateRecoveryParams`. Wholesale replacement, never additive — this contract has no
    /// notion of adding or removing an individual member; the composition of `members` (active
    /// watch towers + the owner's own daily identity + random padding up to `MAX_GROUP_SIZE`) is
    /// computed entirely off-chain. `admin` on the new Semaphore group must be the account itself
    /// (not this module), so both `createGroup` and `addMembers` are forwarded through
    /// `executeFromExecutor` — the same account-as-caller mechanism `finalizeRecovery` already
    /// uses to reach `TARWebAuthnValidator.setNewOwner`. `groupOf` is only updated after both
    /// calls succeed; a revert partway through (e.g. `addMembers` failing) leaves it untouched.
    function regenerateWatchTowerGroup(uint256[] calldata members) external {
        if (!_isInitialized(msg.sender)) revert NotInitialized(msg.sender);
        uint256 memberCount = members.length;
        if (memberCount == 0 || memberCount > MAX_GROUP_SIZE) revert InvalidGroupSize();

        // `ISemaphore.createGroup` has three overloads; `abi.encodeCall` can't disambiguate a
        // member access to it (neither off the type nor off the `semaphore` instance) even with
        // concrete argument types at the call site, so this goes through `abi.encodeWithSignature`
        // instead — same approach `finalizeRecovery` already uses for `setNewOwner`.
        bytes memory createGroupCalldata =
            abi.encodeWithSignature("createGroup(address,uint256)", msg.sender, MERKLE_TREE_DURATION);
        bytes[] memory createGroupReturn = IERC7579Account(msg.sender)
            .executeFromExecutor(
                ExecLib.encodeSimpleSingle(), ExecLib.encodeSingle(address(semaphore), 0, createGroupCalldata)
            );
        uint256 groupId = abi.decode(createGroupReturn[0], (uint256));

        bytes memory addMembersCalldata = abi.encodeCall(ISemaphore.addMembers, (groupId, members));
        IERC7579Account(msg.sender)
            .executeFromExecutor(
                ExecLib.encodeSimpleSingle(), ExecLib.encodeSingle(address(semaphore), 0, addMembersCalldata)
            );

        groupOf[msg.sender] = groupId;
        emit WatchTowerGroupRegenerated(msg.sender, groupId, memberCount);
    }

    function _isInitialized(address smartAccount) internal view returns (bool) {
        return configs[smartAccount].lockTime != 0;
    }
}
