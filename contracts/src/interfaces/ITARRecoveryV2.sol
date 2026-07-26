// SPDX-License-Identifier: MIT
// `challengeRecovery` below takes an `ISemaphore.SemaphoreProof`, which `lib/semaphore` pins to
// exactly `pragma solidity 0.8.23;` (no caret) — see `foundry.toml`. Matches
// `TARRecoveryExecutorV2.sol` (which imports this file) for the same reason.
pragma solidity 0.8.23;

import {IExecutor} from "kernel/interfaces/IERC7579Modules.sol";
import {ISemaphore} from "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

/// @notice TAR (Timelock Account Recovery) executor module (ERC-7579 type 2, `IExecutor`) — V2,
/// Semaphore watch towers. `requestRecovery`/`revealRecovery`/`finalizeRecovery` and their errors/
/// events are unchanged from `ITARRecovery` (V1). `challengeRecovery` is unified for the owner
/// and watch towers behind a single Semaphore proof — no `IERC1271`/`ownerSignature`/`rejectHash`
/// path exists anywhere in V2, unlike V1; `InvalidRejectSignature` is dropped along with it.
/// `IExecutor` already provides `onInstall`/`onUninstall`/`isModuleType`/`isInitialized` and the
/// `AlreadyInitialized`/`NotInitialized` errors (inherited from `IModule`); `NotInitialized` is
/// reused here to check that `addressToRecover` has installed the module.
interface ITARRecoveryV2 is IExecutor {
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

    /// @dev `finalizeRecovery` called while `status != RecoveryStatus.Revealed`.
    error RecoveryNotRevealed(address account);

    /// @dev `finalizeRecovery` called before `revealTimestamp + lockTime` has elapsed.
    error TimelockNotElapsed(address account);

    /// @dev Stake transfer to `addressToRecover` failed in `finalizeRecovery`.
    error TransferFailed();

    /// @dev `revealRecovery` called with `pubKeyX == 0` or `pubKeyY == 0` — fail fast at reveal
    /// rather than let the caller wait out the full `lockTime` before `finalizeRecovery` reverts.
    error InvalidPublicKey();

    /// @dev `revealRecovery` called in the same block as its matching `requestRecovery` (or any
    /// block before `MIN_COMMIT_REVEAL_BLOCKS` has elapsed) — see `requestRecovery` natspec.
    error CommitmentNotMature();

    /// @dev `regenerateWatchTowerGroup` called with an empty `members` list or one longer than
    /// `MAX_GROUP_SIZE`.
    error InvalidGroupSize();

    /// @dev `challengeRecovery` called against `addressToRecover` whose `groupOf` is still `0` —
    /// i.e. it never called `regenerateWatchTowerGroup`. `0` is otherwise a legitimate Semaphore
    /// group id (`groupCounter` starts at 0), so this can't be told apart from "legitimately
    /// assigned to group 0" without this check; see `TARRecoveryExecutorV2`'s constructor, which
    /// burns group 0 as a second, independent layer of defense against the same ambiguity.
    error WatchTowerGroupNotConfigured();

    /// @dev `challengeRecovery`'s `proof.scope` does not match `addressToRecover`. Cheap fail-fast
    /// against front-end proof-generation bugs — not a security boundary on its own: `scope` is a
    /// public Groth16 input, so a mismatched value already fails `verifyProof` on its own, and the
    /// per-account `groupId` already prevents a proof generated for another account from applying
    /// here.
    error ScopeMismatch();

    /// @dev `semaphore.verifyProof` returned `false` for `challengeRecovery`'s proof. `verifyProof`
    /// is `view` and returns `false` on a cryptographically invalid proof rather than reverting
    /// itself (unlike `validateProof`, never used here) — see `TARRecoveryExecutorV2.sol`.
    error InvalidWatchTowerProof();

    event RecoveryParamsUpdated(address indexed account, uint256 lockValue, uint256 lockTime);
    event RecoveryRequested(bytes32 indexed commitment);
    event RecoveryRevealed(
        address indexed addressToRecover, address indexed broadcasterAddress, uint256 challengeDeadline
    );
    event RecoveryRejected(address indexed addressToRecover);
    event RecoveryFinalized(address indexed addressToRecover);

    /// @dev `msg.sender`'s own Semaphore defender group replaced wholesale — never additive, no
    /// notion of adding/removing a single member at the contract level. `epoch` is `epochOf[account]`
    /// after the bump, i.e. the version of this group — `groupId` alone isn't incremental per
    /// account, so this is what the front-end keys its off-chain saved precommitments against.
    event WatchTowerGroupRegenerated(
        address indexed account, uint256 indexed groupId, uint256 memberCount, uint256 epoch
    );

    /// @dev Owner of `msg.sender`'s own account only — no separate `account` parameter.
    function updateRecoveryParams(uint256 lockValue, uint256 lockTime) external;

    /// @dev Anyone, non-payable. Records the commitment's block number on the first request;
    /// duplicate requests are no-ops and cannot reset its maturity window. Spam with distinct
    /// commitments is an accepted POC limit. `revealRecovery` enforces a minimum age
    /// (`MIN_COMMIT_REVEAL_BLOCKS`) before this commitment is revealable.
    function requestRecovery(bytes32 commitment) external;

    /// @dev Must be called by `broadcasterAddress` itself, at least `MIN_COMMIT_REVEAL_BLOCKS`
    /// after the matching `requestRecovery` (see its natspec). `(pubKeyX, pubKeyY)` is a
    /// WebAuthn/P-256 public key — `uint256` to match `WebAuthnValidatorData` (Kernel) and
    /// `TARWebAuthnValidator.setNewOwner` exactly, avoiding an implicit cast at every boundary
    /// between this contract and the validator.
    function revealRecovery(
        address addressToRecover,
        address broadcasterAddress,
        uint256 pubKeyX,
        uint256 pubKeyY,
        bytes32 salt
    ) external payable;

    /// @dev Anyone, callable only once `lockTime` has elapsed since reveal without a challenge.
    function finalizeRecovery(address addressToRecover) external;

    /// @dev Owner and watch towers share this single path — no separate owner-only function.
    /// `proof` must validate against `groupOf[addressToRecover]`'s current Semaphore group; the
    /// caller's identity is never checked or logged on-chain beyond that.
    function challengeRecovery(address addressToRecover, ISemaphore.SemaphoreProof calldata proof) external;

    /// @dev Owner of `msg.sender`'s own account only — same calling pattern as
    /// `updateRecoveryParams`. Replaces the account's entire Semaphore defender group (watch
    /// towers + the owner's own daily identity + padding, all computed off-chain) in one call;
    /// the previous `groupId`, if any, is never referenced again.
    function regenerateWatchTowerGroup(uint256[] calldata members) external;
}
