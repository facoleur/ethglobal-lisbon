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
/// `challengeRecovery` (owner-only, ERC-1271 `ownerSignature`) is gone entirely — replaced by a
/// single Semaphore-proof path shared by the owner and watch towers alike; no `IERC1271`/
/// `ownerSignature`/`rejectHash` exists anywhere in this contract.
contract TARRecoveryExecutorV2 is ITARRecoveryV2, ReentrancyGuard {
    enum RecoveryStatus {
        None, // no recovery in progress on this account
        Revealed, // reveal done, challenge window (lockTime) open
        Rejected, // rejected by a defender, stake returned to addressToRecover
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
    // Bumped on every successful `regenerateWatchTowerGroup` for the account. `groupId` itself
    // isn't incremental per-account (it's a single global counter shared across every account's
    // groups), so the front-end can't use it alone to tell "this is the Nth group version for
    // this user" — `epochOf` gives it that per-account, monotonic cursor to key and sync its
    // off-chain saved precommitments against.
    mapping(address account => uint256) public epochOf;

    // Current Semaphore defender group per account. Replaced wholesale on every
    // `regenerateWatchTowerGroup` call — the previous `groupId`, if any, is never referenced
    // again, so there is no notion of "removing" a stale group here.
    mapping(address account => uint256 groupId) public groupOf;

    constructor(address _validator, address _semaphore) {
        validator = _validator;
        semaphore = ISemaphore(_semaphore);

        // Burn group 0: the real `Semaphore.sol` assigns group ids by post-incrementing
        // `groupCounter` (starts at 0), so group 0 is a legitimate, assignable id —
        // indistinguishable in `groupOf` from "this account never configured watch towers"
        // (which also defaults to 0). A throwaway group here, admin'd by this module (never a
        // real account), guarantees every `groupOf[account]` this contract ever assigns is >= 1.
        // Defense in depth, not a substitute for `challengeRecovery`'s own explicit
        // `groupOf == 0` check — either one alone would close the gap; both are kept.
        semaphore.createGroup(address(this), MERKLE_TREE_DURATION);
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

    /// @dev Owner and watch towers share this one path — no separate ERC-1271 owner check, no
    /// caller identity logged on-chain beyond what the Semaphore proof itself reveals (nothing,
    /// by design). Checks go cheapest-first: `status`, then `groupOf == 0` (see constructor for
    /// why this is checked here too, not just defended against by burning group 0), then
    /// `proof.scope` (a fail-fast against front-end bugs, not a security boundary — see
    /// `ScopeMismatch` natspec), and only then the actual `verifyProof` call. `verifyProof` is
    /// `view` (a STATICCALL under the hood) and returns `false` rather than reverting on an
    /// invalid proof, so this needs its own explicit `require`-equivalent, unlike a
    /// `validateProof`-shaped design would. CEI: `status` updated before the stake transfer,
    /// `ReentrancyGuard` conserved from V1's `challengeRecovery`, even though `verifyProof` being
    /// a STATICCALL already rules out state-changing reentrancy through it specifically.
    function challengeRecovery(address addressToRecover, ISemaphore.SemaphoreProof calldata proof)
        external
        nonReentrant
    {
        RecoveryRequest storage req = recoveries[addressToRecover];
        if (req.status != RecoveryStatus.Revealed) {
            revert RecoveryNotRevealed(addressToRecover);
        }

        uint256 groupId = groupOf[addressToRecover];
        if (groupId == 0) revert WatchTowerGroupNotConfigured();

        if (proof.scope != uint256(uint160(addressToRecover))) {
            revert ScopeMismatch();
        }

        if (!semaphore.verifyProof(groupId, proof)) {
            revert InvalidWatchTowerProof();
        }

        uint256 stake = req.stakedValue;
        req.status = RecoveryStatus.Rejected;

        (bool success,) = addressToRecover.call{value: stake}("");
        if (!success) revert TransferFailed();

        emit RecoveryRejected(addressToRecover);
    }

    /// @dev Owner of `msg.sender`'s own account only, same calling pattern as
    /// `updateRecoveryParams`. Wholesale replacement, never additive — this contract has no
    /// notion of adding or removing an individual member; the composition of `members` (active
    /// watch towers + the owner's own daily identity + random padding up to `MAX_GROUP_SIZE`) is
    /// computed entirely off-chain. `admin` on the new Semaphore group must be the account itself
    /// (not this module), so both `createGroup` and `addMembers` are forwarded through
    /// `executeFromExecutor` — the same account-as-caller mechanism `finalizeRecovery` already
    /// uses to reach `TARWebAuthnValidator.setNewOwner`. `groupOf` and `epochOf` are only updated
    /// after both calls succeed; a revert partway through (e.g. `addMembers` failing) leaves both
    /// untouched.
    function regenerateWatchTowerGroup(uint256[] calldata members) external {
        if (!_isInitialized(msg.sender)) revert NotInitialized(msg.sender);
        uint256 memberCount = members.length;
        if (memberCount == 0 || memberCount > MAX_GROUP_SIZE) {
            revert InvalidGroupSize();
        }

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
        uint256 epoch = ++epochOf[msg.sender];
        emit WatchTowerGroupRegenerated(msg.sender, groupId, memberCount, epoch);
    }

    function _isInitialized(address smartAccount) internal view returns (bool) {
        return configs[smartAccount].lockTime != 0;
    }
}
