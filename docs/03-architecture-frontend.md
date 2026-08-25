# Architecture — Frontend (`frontend/`)

See [`README.md`](README.md) for the maturity status legend (🟢🟡🟠⚪). For the reasoning behind the choices listed here, see [`04-decisions.md`](04-decisions.md).

**Important methodological note**: a good part of this doc contradicts the design specs that existed before implementation (e.g. `towers-design.md`, deleted — it described watch towers as a localStorage mock). The current code is substantially more advanced than those specs. Everything below was verified directly in the code, not inferred from planning documents.

## Actual stack

Next.js 16 (App Router), React 19, TypeScript. Passkey-only auth (see root `CLAUDE.md`, "Auth model" section). `wagmi` v3 for contract reads, `permissionless.js` (ZeroDev SDK, Kernel v0.3.1, EntryPoint v0.7) for writes via the smart account. `zustand` (persist middleware, `localStorage`) for client state. `@semaphore-protocol/{identity,group,proof}` v4.13.0 client-side for everything watch-tower-related. `next-intl`, `shadcn/ui`, `tailwindcss`, `vaul` (drawers), `motion`. Single target: **Sepolia** (`lib/kernel/config.ts`, `chain = sepolia`, hardcoded).

## Auth / Kernel account — 🟢 Implemented

- `providers/kernel-provider.tsx` (`KernelProvider`): restores the session from the persisted `credentialId`/`accountAddress`/`publicKey` (`wallet` store, `lib/store/wallet.ts`) without a WebAuthn ceremony on load. Periodically checks (every 10s + on `visibilitychange`) that the local public key still matches `TARWebAuthnValidator.keyData` on-chain — if they diverge (e.g. a TAR recovery rotated the key elsewhere), automatic local disconnect.
- `hooks/use-kernel.ts`: `useKernelAccount`, `useRegisterPasskey` (onboarding), `useLoginPasskey`, `useRestoreRecoveredWallet` (post-recovery), `useSendUserOperation`/`useSendKernelTransaction` (go through the Kernel SDK's `client.sendUserOperation` + `waitForUserOperationReceipt` — a real UserOp, not a direct call).
- `(app)/layout.tsx`: redirects to `/login` if `credentialId === null` after the store hydrates — behavior documented in the root `CLAUDE.md`, verified to match the code.

## Recovery for oneself (`(auth)/recover`) — 🟢 Implemented

*(The root `CLAUDE.md` used to mention `(auth)/recovery` — the actual path was corrected to `(auth)/recover`.)*

- `hooks/use-tar-recovery.ts`: `useTarRecoveryPreflight` reads on-chain state (module installed, `rootValidator` == expected `TARWebAuthnValidator`, `configs`/`recoveries` for the target account) to determine a precise status (`contract-unavailable`, `unsupported-account`, `module-missing`, `validator-mismatch`, `config-missing`, `ready`, `active`...) before letting the user enter the flow.
- `useSubmitTarRecovery`: runs the **commit → wait for maturity (poll block number) → reveal** cycle via an ephemeral "broadcaster" wallet client (`lib/recovery/broadcaster.ts`, private key held in the `recovery` store, not a Kernel account) that sends `requestRecovery`/`revealRecovery` transactions directly (no sponsoring/UserOp here — expected, since this broadcaster has no Kernel account, it's a plain EOA).
- `useFinalizeTarRecovery`: reads the on-chain status, calls `finalizeRecovery` if still `Revealed`, otherwise directly reflects `finalized`/`vetoed`.
- `useUpdateRecoveryParams`: installs the module if missing, or updates `lockValue`/`lockTime`; if the active executor is V2 and no watch tower group exists yet (`groupOf == 0`), generates a default group (owner only + padding) via `prepareDefenseGroupMembers` and includes it in the same transaction batch as `regenerateWatchTowerGroup`.

## Watch towers — 🟢 Implemented (identity, enrollment, group, veto — end-to-end on Sepolia)

Contrary to what the planning spec suggested (`towers-design.md`, deleted): this is **not** an isolated localStorage mock. It's wired end-to-end to the real V2 contract.

- **Deterministic identity** (`lib/watch-tower-identity.ts`): derived from the passkey credential's **WebAuthn PRF** extension (`evalByCredential`), never stored or transmitted — see `04-decisions.md`. `WATCH_TOWER_IDENTITY_COUNT = 100` independent identities precomputable per relationship.
- **Enrollment** (`lib/watch-tower-enrollment.ts`): homegrown QR protocol (`tar-wt1`), split into chunked frames (450 characters/frame, 32 frames max) to carry a watch tower's commitments to the owner (bidirectional scan).
- **Proof generation** (`lib/watch-tower-proof.ts`): actually uses `@semaphore-protocol/{identity,group,proof}` — `generateProof` (real client-side Groth16), not a mock.
- **Defense group management** (`lib/watch-tower-policy.ts`, `hooks/use-watch-tower-policy.ts` → `useRegenerateWatchTowerGroup`): builds the member list (active watch towers + the owner's identity of the day + padding), calls `regenerateWatchTowerGroup` on the real deployed V2 contract.
- **Veto** (`app/api/veto/route.ts`): a server route that **actually relays the `challengeRecovery` transaction** via a server-held private key (`TAR_RELAYER_PRIVATE_KEY`), after simulation (`simulateContract`) — so the caller (the watch tower) doesn't need ETH to veto, the relay sponsors the gas for this specific transaction. Validates `proof.scope == addressToRecover` before sending anything.
- **Defense group reconstruction** (`app/api/defense-group/route.ts`): stores nothing server-side — reconstructs the member list and `merkleTreeRoot` on demand, by reading the `MembersAdded` event on-chain via the Blockscout Sepolia API and verifying the root live against `Semaphore.getMerkleTreeRoot`.
- **Attempt synchronization** (`hooks/use-recovery-attempt-sync.ts` → `useRecoveryAttemptSync`): polls on-chain (15s + `visibilitychange`) `recoveries`/`configs` for the user's own account **and** for every wallet they watch as a watch tower (`watchedWallets`, `watch-towers` store) — feeds the `RecoveryCenter` hub.

**🟠 Maturity nuance**: `components/recovery-center/index.tsx` imports `simulateRecoveryAttempt` (`lib/recovery-center.ts`) alongside the real flow described above — a sign that at least one demo/test sub-path remains simulated in this screen. Not verified precisely which one for this doc; to be checked before treating *all* of the `RecoveryCenter` screen as proven under real conditions.

## `(app)/recovery` → `RecoveryCenter` — 🟢/🟠 Implemented (owner-side hub)

*(Missing from the root `CLAUDE.md` before the fix — not to be confused with `(auth)/recover` above, which is the "I lost my device" flow.)*

Central screen for an already-connected user: wallet protection (`lockValue`/`lockTime` config + defense group), list of configured watch towers, wallets watched as a watch tower, ongoing recovery attempts (their own and the ones they watch) with veto actions. Components under `components/recovery-center/`.

## What's still unverified / not covered by this doc

- The `simulateRecoveryAttempt` sub-path mentioned above.
- The generation of the broadcaster's private key (`lib/recovery/broadcaster.ts` only builds the client from an already-supplied key — the origin/storage of that key wasn't audited for this doc).
- No automated tests (unit or e2e) exist on the `frontend/` side as of this writing — only `typecheck`/`lint`/`build` are scripted in `package.json`.
