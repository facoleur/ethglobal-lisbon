# Trustless Timelock Recovery
## ETHGlobal Lisbon – 4 Minute Pitch

---

# 🎤 Slide 1 — The Hook (0:00 - 0:20)

## "What happens if you lose your phone?"

Imagine waking up tomorrow and realizing you've lost your phone.

With passkeys and smart accounts becoming the future of Ethereum wallets, losing your device can also mean losing access to your entire on-chain identity.

Today's recovery solutions usually rely on trusted guardians, centralized services, or multisigs.

We wanted something different.

**We built a completely trustless recovery protocol.**

---

# 🚨 Slide 2 — The Problem (0:20 - 1:00)

Smart Accounts dramatically improve UX.

Passkeys remove seed phrases.

But they introduce a new challenge:

> **How do you safely recover your wallet if your passkey is permanently lost?**

Current solutions force users to trust:

- friends
- guardians
- companies
- recovery services

These introduce new attack surfaces and single points of failure.

We wanted recovery that doesn't require trusting anyone.

---

# 🛠️ Slide 3 — Our Solution (1:00 - 2:00)

Our protocol allows **anyone** to initiate a recovery request.

However, recovery is **never immediate.**

Every recovery goes through a configurable timelock.

During this delay:

- the legitimate owner can cancel it at any time,
- decentralized watchtowers continuously monitor suspicious requests,
- and the recovery requester has locked an ETH security deposit, discouraging spam and malicious attempts.

To prevent front-running, recoveries use a **Commit-Reveal** mechanism.

If the owner is still active, recovery is simply cancelled.

If the owner has truly lost access, recovery safely completes after the delay.

---

# 🔒 Slide 4 — Security & Privacy (2:00 - 3:00)

Building another recovery contract wasn't the hard part.

The real challenge was securing every attack vector.

### ✅ Front-running protection

We use a Commit-Reveal scheme so attackers cannot steal or copy recovery requests.

### ✅ Decentralized monitoring

Watchtowers **cannot recover wallets.**

They only have permission to veto suspicious recoveries.

This removes a huge trust assumption.

### ✅ Privacy

Recovery identities are never publicly revealed.

Instead, we use:

- Merkle Trees
- Semaphore
- Zero-Knowledge Proofs

Authorized users prove they belong to the recovery set **without revealing which identity they are.**

This preserves privacy while remaining fully verifiable on-chain.

---

# ⚙️ Slide 5 — Tech Stack (3:00 - 3:40)

Our project combines several modern Ethereum technologies:

- Solidity smart contracts
- ERC-4337 Account Abstraction
- WebAuthn Passkeys
- Semaphore
- Zero-Knowledge Proofs
- Merkle Trees
- Next.js
- TypeScript

Everything is designed to be modular so developers can integrate our recovery protocol into existing smart accounts.

---

# 🚀 Slide 6 — Closing (3:40 - 4:00)

As crypto becomes mainstream, losing a phone should not mean losing your wallet forever.

Recovery shouldn't depend on trusting people.

It should depend on mathematics.

That's exactly what we built:

**A trustless, privacy-preserving recovery protocol for the next generation of smart accounts.**

Thank you.

---

# 💬 Possible Jury Questions

## What was the biggest technical challenge?

There were three main challenges:

- preventing front-running attacks,
- enabling decentralized monitoring without giving watchtowers control over funds,
- preserving privacy with Zero-Knowledge Proofs while keeping recoveries verifiable.

---

## Why use Zero-Knowledge?

Without ZK, every recovery identity would be publicly visible on-chain.

Semaphore allows recovery members to prove they are authorized without revealing who they are.

This greatly improves privacy while maintaining full security.

---

## Why not simply use guardians?

Traditional guardians require trusting specific people.

If guardians are compromised, unavailable, or collude, recovery can fail or be abused.

Our protocol minimizes trust by relying on cryptographic proofs, economic incentives, and timelocks instead of trusted third parties.

---

## Future Work

- ERC-7702 compatibility
- Multi-chain deployments
- Additional watchtower networks
- Mobile SDK integration
- Pluggable recovery policies
- Better developer tooling