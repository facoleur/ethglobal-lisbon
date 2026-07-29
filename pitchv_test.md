# CHATEAU - ETHGlobal Lisbon

# Pitch Script

---

# Slide 1 — Introduction

Hi everyone!

We are **CHATEAU**.

Every year millions of dollars are permanently lost because someone loses access to their wallet.

Today you have two bad choices:

- Trust another person or company.
- Or trust nobody... and risk losing everything forever.

We think users shouldn't have to choose between security and recoverability.

---

# Slide 2 — The problem

Wallet recovery is still broken.

If you use a seed phrase...

Lose it once and your funds are gone forever.

If you use social recovery...

You have to trust guardians.

Those guardians can disappear, get hacked, collude, or simply stop answering.

Recovery shouldn't depend on trusting humans.

---

# Slide 3 — Our solution

That's why we built **CHATEAU**.

A trust-minimized recovery protocol for ERC-4337 smart accounts.

Instead of trusting people...

You trust **time**.

A recovery request starts a countdown.

During that delay, the legitimate owner can cancel it at any moment.

No guardian can steal your wallet instantly.

---

# Slide 4 — How it works

Recovery happens in four simple steps.

1. A recovery is requested.
2. The requester locks an ETH deposit.
3. A configurable timelock begins.
4. If the owner does nothing, recovery executes automatically.

If the owner is still active...

One transaction cancels everything.

Simple.

---

# Slide 5 — Security

Security is our biggest priority.

Our protocol includes several protections.

• Commit-Reveal prevents front-running.

• ETH bonds discourage spam.

• Watchtowers continuously monitor recovery requests.

• Multiple watchtowers can independently veto suspicious recoveries.

Even if one service goes offline...

The protocol keeps working.

---

# Slide 6 — Zero Knowledge

Privacy also matters.

Users don't have to publicly reveal every recovery credential.

Using Semaphore...

Eligible guardians can anonymously prove authorization.

No identity leakage.

No public guardian lists.

Only a valid proof.

---

# Slide 7 — Account Abstraction

Our protocol is built on ERC-4337.

This means:

- Passkeys
- Smart accounts
- Gas abstraction
- Better UX

Recovery becomes a native feature of modern wallets.

---

# Slide 8 — Stack

Our stack includes:

- Solidity
- ERC-4337
- ZeroDev
- Semaphore
- Passkeys
- Commit-Reveal
- Merkle Trees

Everything is fully on-chain except the optional monitoring infrastructure.

---

# Slide 9 — Demo

Let's see it.

We'll simulate a wallet recovery.

A malicious recovery request is submitted.

Watchtowers detect suspicious activity.

The owner receives a notification.

The recovery is cancelled before the timelock expires.

The wallet stays secure.

---

# Closing

Our goal is simple.

We want recovering your wallet to be as safe as creating it.

Without trusting another person.

Without sacrificing decentralization.

Thank you!

We're CHATEAU.

Questions?