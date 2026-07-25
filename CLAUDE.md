for frontend tasks, make sure to respect [frontend/AGENTS.md](frontend/AGENTS.md)

## Auth model

No traditional auth. "Connected" = a passkey credential exists on this device and is the signer for a Kernel smart account.

- `credentialId` is persisted in localStorage via Zustand persist middleware
- On app load, `(app)/layout.tsx` reads the persisted store. If no `credentialId`, redirect to `/login`
- If `credentialId` present, reconstruct `KernelAccountClient` (ZeroDev SDK) -- async, show loading state
- There is no logout. The only "not connected" states are: first time on device (onboarding) or lost device (recovery)

`(auth)/login` = onboarding: create passkey, deploy Kernel account, store credentialId  
`(auth)/recovery` = TAR recovery flow: lost device, initiate timelock recovery
