for frontend tasks, make sure to respect [frontend/AGENTS.md](frontend/AGENTS.md)

## Project documentation

The technical reference for this project (TAR — Timelock Account Recovery) lives in [`docs/`](docs/README.md): concept, what's actually implemented on the contracts and frontend sides (with maturity status per component), technical decisions, structural limitations, and roadmap. Read it before making non-trivial changes to `contracts/` or `frontend/`.

**Keep it up to date.** Any new feature or non-trivial technical decision must be reflected there:
- New component / maturity change → `docs/02-architecture-contracts.md` or `docs/03-architecture-frontend.md`.
- Non-obvious technical choice → one line in `docs/04-decisions.md` (Decision / Why).
- Newly discovered structural trade-off → a new entry with a stable id in `docs/05-limitations.md`.
- A limitation resolved by a shipped feature → mark it resolved in `05-limitations.md` (pointing to the decision in `04-`), and drop the matching item from `docs/06-roadmap.md` if there was one.

## Auth model

No traditional auth. "Connected" = a passkey credential exists on this device and is the signer for a Kernel smart account.

- `credentialId` is persisted in localStorage via Zustand persist middleware
- On app load, `(app)/layout.tsx` reads the persisted store. If no `credentialId`, redirect to `/login`
- If `credentialId` present, reconstruct `KernelAccountClient` (ZeroDev SDK) -- async, show loading state
- There is no logout. The only "not connected" states are: first time on device (onboarding) or lost device (recovery)

`(auth)/login` = onboarding: create passkey, deploy Kernel account, store credentialId  
`(auth)/recover` = TAR recovery flow: lost device, initiate timelock recovery for one's own account  
`(app)/recovery` = `RecoveryCenter`, a different screen: the owner-side hub for a device that's still connected — configure watch towers, see and veto recovery attempts (on your own account or wallets you watch). See `docs/03-architecture-frontend.md`.
