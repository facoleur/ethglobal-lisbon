# Timelock Account Recovery (TAR)

A trustless recovery mechanism for ERC-4337 / ERC-7579 smart accounts. Instead of trusted guardians, recovery is gated by a confiscable stake (`lockValue`) and a challenge window (`lockTime`). Anyone can attempt recovery, but the legitimate owner -- or hidden watch towers acting on their behalf -- can reject the attempt and seize the stake.

Watch towers hold strictly negative power: they can veto a recovery but cannot take the account. Their membership is committed as a Merkle root on-chain; individual members prove membership via ZK (Semaphore) so the defensive set is never revealed publicly. This makes defended and undefended accounts indistinguishable to an attacker.

## Stack

**Smart contracts**
- ERC-7579 module interface
- Kernel smart account (ZeroDev)
- Merkle tree for watch tower set commitment
- Semaphore for anonymous ZK membership proofs

**Frontend**
- Next.js, mobile-first PWA
- ZeroDev SDK + permissionless.js
- Passkey (WebAuthn) as the Kernel account signer
- wagmi for contract reads
- Zustand for client state
- shadcn/ui + Tailwind + next-intl

## Auth model

There is no traditional auth. "Connected" means a passkey credential exists on the device. The passkey is the signer for the user's Kernel account. The credential ID is persisted locally and used to reconstruct the `KernelAccountClient` on every app load.

`(auth)/login` is onboarding (first device, create passkey + deploy Kernel account).  
`(auth)/recovery` is the TAR recovery flow (lost device).

## Setup

```bash
npm install -g lefthook
make setup
```

## Dev

```bash
cd frontend && npm run dev
```
