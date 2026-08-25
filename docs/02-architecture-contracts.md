# Architecture — Contracts (`contracts/`)

See [`README.md`](README.md) for the maturity status legend (🟢🟡🟠⚪). For the reasoning behind the choices listed here, see [`04-decisions.md`](04-decisions.md).

## Overview

```
contracts/src/
  TARRecoveryExecutor.sol       # V1 — no watch towers, challenge = owner signature
  TARRecoveryExecutorV2.sol     # V2 — watch towers via Semaphore, unified challenge
  interfaces/
    ITARRecovery.sol
    ITARRecoveryV2.sol
    ITARWebAuthnValidator.sol
  validators/
    TARWebAuthnValidator.sol    # Kernel validator, fork + key rotation
```

Both executors (V1 and V2) are **ERC-7579 Executor modules** (type 2) installed on a Kernel account. They share, byte for byte, the entire commit-reveal state machine (`requestRecovery`/`revealRecovery`/`finalizeRecovery`, structs, events, `MIN_COMMIT_REVEAL_BLOCKS`). Only `challengeRecovery` differs between the two.

**Solidity**: no version pinned globally. `lib/semaphore` enforces an exact `pragma solidity 0.8.23;` in all its files, incompatible with the `^0.8.28`/`^0.8.24` used by the rest of the project — `forge`'s auto-detection resolves each file against its own pragma (see `foundry.toml`, detailed comment). `via_ir = true` stays enabled globally (needed for `WebAuthn.sol`, otherwise "stack too deep"); Semaphore's Groth16 verifier compiles more slowly because of this, but it's a one-time compilation cost, judged not worth optimizing for now.

## `TARRecoveryExecutor` (V1) — 🟢 Deployed + tested

**Sepolia** (latest deployment `broadcast/DeployTARSepolia.s.sol/11155111/run-latest.json` — cross-check against the frontend env vars actually in use before treating this as the source of truth):
- `TARRecoveryExecutor`: `0x98593a06e9a74fe9c1dcb3c8df1698540d8b6c8a`
- `TARWebAuthnValidator` (V1 deployment): `0x9f79960b33889e5c460b16b6d7ee38529f480ee9`

**What's implemented**:
- `onInstall`/`onUninstall`/`isModuleType`/`isInitialized` — standard ERC-7579 module cycle (`IModule` from `kernel`, `payable` required).
- `updateRecoveryParams(lockValue, lockTime)` — scoped to `msg.sender`, no `account` parameter.
- `requestRecovery(commitment)` — non-payable commit; strict no-op if already pending (see `04-decisions.md`).
- `revealRecovery(addressToRecover, broadcasterAddress, pubKeyX, pubKeyY, salt)` — payable, `newSigner` already in WebAuthn `(pubKeyX, pubKeyY)` form (not the ECDSA `address` form from an earlier milestone). Checks broadcaster, exact staked amount, `MIN_COMMIT_REVEAL_BLOCKS = 1` maturity, active-recovery guard.
- `challengeRecovery(addressToRecover, ownerSignature)` — **ERC-1271** authentication via `IERC1271(addressToRecover).isValidSignature`, agnostic of the account's active validator. `ReentrancyGuard` + CEI.
- `finalizeRecovery(addressToRecover)` — calls `setNewOwner(pubKeyX, pubKeyY)` on a `validator` that is **immutable, fixed at deployment** (never a parameter) via `executeFromExecutor`/`ExecLib`. `ReentrancyGuard` + CEI.

**Why this contract is kept as-is, with no further evolution**: it's the historical pre-Semaphore reference. If an alternative ZK variant is ever explored (e.g. Noir instead of Semaphore), **don't fork V1**: V1 has no notion of watch towers at all, so starting from it would mean rebuilding the entire group architecture already solved in V2 (storage, `MAX_GROUP_SIZE`, the "regenerate" pattern). **Forking V2** and replacing only its Semaphore-specific part is the recommended starting point — see the "Semaphore-specific vs. protocol-agnostic" list in `04-decisions.md`. V1 stays in the repo as a reference for the simplest design (no watch tower), not as a working base.

**Tests**: `test/unit/TARRecoveryExecutor.t.sol` (19) + `test/unit/TARRecoveryExecutorLifecycle.t.sol` (10) against `test/mocks/MockERC7579Account.sol` (built from scratch, no `modulekit` dependency) and `test/mocks/MockRotatableValidator.sol`.

## `TARRecoveryExecutorV2` — 🟢 Deployed + tested

**Sepolia** (latest deployment `broadcast/DeployTARV2Sepolia.s.sol/11155111/run-latest.json`, same caveat as above):
- `TARRecoveryExecutorV2`: `0x62fc9ba3d7bdbf8a59c817693f009ed4402fbc93`
- `TARWebAuthnValidator` (V2 deployment): `0xa342e79e93cf90d53f216c063fcc0c8f6261a3c2`

**What changes relative to V1** (everything else is identical, character for character):
- Additional storage: `ISemaphore public immutable semaphore`, `mapping(address => uint256) public groupOf`, `mapping(address => uint256) public epochOf`, `MAX_GROUP_SIZE = 16`, `MERKLE_TREE_DURATION = 365 days`.
- The constructor **burns Semaphore group `0`** (a throwaway `createGroup`, admin = the contract itself) so that no real `groupOf[account]` can ever equal `0` — defense in depth on top of the explicit `groupId == 0` check in `challengeRecovery`.
- `challengeRecovery(addressToRecover, ISemaphore.SemaphoreProof proof)` — **a single path for both the owner and watch towers**, no more ERC-1271/`ownerSignature`. Checks `status == Revealed`, `groupOf != 0`, `proof.scope == uint256(uint160(addressToRecover))`, then `semaphore.verifyProof(groupId, proof)` (explicit — see `04-decisions.md` on `verifyProof` vs `validateProof`).
- `regenerateWatchTowerGroup(uint256[] members)` — **full** replacement of the group (never additive), `createGroup`+`addMembers` forwarded via `executeFromExecutor` (Semaphore admin = the account itself, not the module). Updates `groupOf`/`epochOf` only after complete success.

**Tests**: `TARRecoveryExecutorV2.t.sol` (20) + `TARRecoveryExecutorV2Lifecycle.t.sol` (10) + `TARRecoveryExecutorV2Challenge.t.sol` (8) + `MockSemaphore.t.sol` (9, validates the mock itself) against `test/mocks/MockSemaphore.sol` (implements `ISemaphore` in full, real logic only for `createGroup`/`addMembers`/`verifyProof`) — plus `test/integration/SemaphoreProofVector.t.sol` (2) against a **real** `Semaphore.sol`/`SemaphoreVerifier.sol` (real Groth16), fixture in `test/fixtures/semaphore_proof_vector.json`.

**🟡 Not covered, worth noting**: no test goes through a real `EntryPoint.handleOps`/`PackedUserOperation` — the entire suite (V1 and V2) exercises the contracts via direct calls. No `KernelP256E2E.t.sol`/`KernelWatchTowerE2E.t.sol` file exists in the repo despite being mentioned in older plans — never built.

## `TARWebAuthnValidator` — 🟢 Deployed + tested (with a caveat)

Full fork of `WebAuthnValidator.sol` (Kernel `kernel-7579-plugins`), `onInstall` format identical to the one expected by `permissionless.js` (`abi.encode(WebAuthnPublicKey, credentialIdHash)`). Two rotation functions, with a notable gap between them:
- `rotatePublicKey(pubKeyX, pubKeyY, credentialIdHash)` — updates the key **and** `credentialIdHash`.
- `setNewOwner(pubKeyX, pubKeyY)` — this is the one used by `finalizeRecovery` (both V1 and V2) via `executeFromExecutor`. **Does not update `credentialIdHash`** — after a TAR recovery, this field becomes stale. No explicit guard needed: `msg.sender` is structurally the account, since this path is only reachable via `executeFromExecutor`. Open question, not fixed — see `05-limitations.md`.

**Tests**: `TARWebAuthnValidator.t.sol` (18 cases, written with no dedicated context document, directly from the contract). **2 tests `vm.skip()`-ed**: the local P-256 precompile in `forge test` (including with `--fork-url`) returns a `STOP` with no data instead of verifying — empirically confirmed by comparing against a direct precompile call on a real `anvil` node with the same vector, which correctly returns `1`. Only affects local test execution, not real behavior on Sepolia.

## Dependencies (`contracts/lib/`, `remappings.txt`)

`forge-std`, `openzeppelin-contracts`, `account-abstraction` (v0.7.0), `kernel` + `kernel-7579-plugins` (ZeroDev), `semaphore` (v4 — LeanIMT + EdDSA, not v2/v3), `zk-kit.solidity` (LeanIMT), `poseidon-solidity`. All as git submodules, not npm+remapping (unlike what had originally been considered for Semaphore).
