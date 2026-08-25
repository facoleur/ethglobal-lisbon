# Technical decisions

Non-trivial decisions, short format: what → why. Grouped by component. Not a narrative history — see `git log` for the actual chronological order.

## Contracts — commit-reveal state machine (V1 and V2)

- **`MIN_COMMIT_REVEAL_BLOCKS = 1` between `requestRecovery` and `revealRecovery`.** Prevents an attacker watching a victim's reveal in the mempool from committing *and* revealing their own attempt in the same block to steal the `RecoveryAlreadyActive` guard. Doesn't protect against a patient attacker who pre-commits days in advance — that case is still defended by the veto, not by the rarity of attempts.
- **`requestRecovery` is a strict no-op on an already-pending commitment** (never refreshes `pendingCommitments[commitment]`). Without this, anyone could indefinitely push back a commitment's maturity by re-submitting it, preventing the legitimate broadcaster from ever reaching `revealRecovery` — a permanent DoS on their own recovery.
- **`pubKeyX`/`pubKeyY` are checked non-zero right at `revealRecovery`, not only at `finalizeRecovery`.** Fail-fast: avoids a reveal with an invalid key only being caught after the caller has waited out the entire `lockTime`.
- **`finalizeRecovery` and `regenerateWatchTowerGroup` always target an address fixed at deployment (immutable `validator`) or derived from `msg.sender`, never a caller-supplied address.** Prevents anyone from making the target account execute an arbitrary call via `executeFromExecutor`.
- **The `REJECT` hash (V1) includes `address(this)`, `block.chainid`, `addressToRecover`, `broadcasterAddress`, and `revealTimestamp`.** Binds a reject signature to this exact contract, chain, and attempt, without needing a separate `recoveryId` — prevents replaying a reject signature on a future attempt or another deployment.
- **`challengeRecovery` (V1) authenticates via `IERC1271(addressToRecover).isValidSignature`, never a validator directly.** Keeps `TARRecoveryExecutor` agnostic of the account's active validator.

## Contracts — V2-specific (Semaphore)

- **`challengeRecovery` unifies owner and watch towers into a single path (Semaphore proof).** No more on-chain distinction between "the owner rejected" and "a watch tower vetoed" — necessary for the indistinguishability goal (see `01-concept.md`).
- **`verifyProof` used, not `validateProof`.** `validateProof` adds nullifier tracking (replay protection) that's unnecessary here: double-vetoing the same attempt is already blocked by `RecoveryStatus` (`Rejected` after the first success). Since `verifyProof` is `view`, it returns `false` on an invalid proof instead of reverting — hence the explicit `require` in the contract.
- **`scope` stable per account** (derived from `addressToRecover`), not per individual attempt. Accepted residue: the same defender's nullifier repeats on every veto for that account (visible: "same defender as last time"), but their identity never is.
- **Semaphore group `0` is burned in the constructor** (defense in depth), on top of the explicit `groupId == 0` check in `challengeRecovery` — the two protections are deliberately redundant, neither replaces the other.
- **`regenerateWatchTowerGroup` replaces the group entirely, never additively.** The contract has no notion of adding/removing an individual member — the composition (active watch towers + the owner's identity of the day + random padding up to `MAX_GROUP_SIZE`) is computed entirely off-chain/front-end, so an observer can never infer a change in composition by comparing two successive groups.
- **Solidity not pinned globally** (`foundry.toml`) to accommodate `lib/semaphore`'s exact `0.8.23` pin, incompatible with the `^0.8.28` used by the rest of the code.

## Contracts — `TARWebAuthnValidator`

- **`setNewOwner` does not update `credentialIdHash`**, unlike `rotatePublicKey`. Consistent with the fact that `RecoveryRequest` never carries a `credentialIdHash` — but this leaves that field stale after a TAR recovery. Not fixed, see `05-limitations.md`.
- **No explicit guard on `setNewOwner`.** `msg.sender` is structurally the target account there, since this path is only reachable via `executeFromExecutor` — a direct external call can never spoof that identity.

## Frontend — watch tower identity

- **A watch tower's 100 Semaphore identities are derived via HKDF from its credential's WebAuthn PRF extension, with a salt that includes the protected account's address (`protectedWallet`)** (`lib/watch-tower-identity.ts`) — a secret never transmitted or stored, rather than generated and then exchanged with the owner. The PRF supplies the secret entropy; binding to `protectedWallet` (+ `relationshipId`, `chainId`) in the salt guarantees that the same device/passkey produces a different, non-correlatable set of 100 identities for each protected account. Solves the original synchronization problem (the owner previously had to hand a secret to each watch tower): the watch tower alone computes its identity, regenerable with no backup as long as the passkey remains accessible. **No fallback if PRF isn't supported** by the authenticator — surfaces as a hard error (`PasskeyPrfUnavailableError`), no alternative mechanism.
- **Rejected alternative: on-chain self-registration by the watch tower.** If the watch tower submitted its commitment from its own address, `msg.sender` would be publicly recorded and would link its identity to the account it watches — an indistinguishability leak. The mitigations considered (single-use burner address, batched off-chain submission by the owner) reintroduce either complexity or a synchronization point, without fully closing the leak — hence the choice of a direct QR exchange.
- **The Merkle path is never transmitted by the owner.** Every member insertion emits a public event; anyone (including the watch tower itself) can rebuild the tree and extract their own path from the logs (`@semaphore-protocol/group`, and `app/api/defense-group/route.ts` on the app side). This isn't secret data — only group membership itself needs to stay uncertain from the outside.
