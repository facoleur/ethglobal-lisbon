# Slide 1 — Introduction

Hi everyone!

We're Chateau.

A trustless social recovery solution for ERC-4337 smart accounts.

Our goal is simple:

Recover your wallet without relying on a seed phrase or trusting another person.

---

# Slide 2 — What we built

Chateau combines several technologies to make recovery both secure and private.

We're fully trustless.

Recovery stays self-custodial.

The protocol is built on ERC-4337 account abstraction.

And users authenticate anonymously using Semaphore.

---

# Slide 3 — The problem

Today, wallet recovery is still painful.

Seed phrases are easy to lose.

Guardian-based recovery requires trusting other people.

Custodial solutions sacrifice ownership.

Users shouldn't have to choose between security and decentralization.

---

# Slide 4 — Our solution

Chateau removes these compromises.

Instead of relying on a seed phrase or a trusted guardian,

users recover their wallet using cryptographic proofs.

Recovery stays entirely under the user's control.

No trusted third party.

No custody.

No seed phrase.

---

# Slide 5 — How it works

First, the user registers anonymously using Semaphore.

When recovery is needed,

they generate a zero-knowledge proof proving they're an authorized user,

without revealing their identity.

The recovery request is protected with a Commit-Reveal scheme,

preventing front-running attacks.

Once verified,

the smart account securely transfers ownership to the new device or key.

---

# Slide 6 — Why it's different

Most recovery systems solve only one problem.

Chateau combines multiple security layers.

ERC-4337 provides account abstraction.

Semaphore gives anonymous, verifiable authentication.

Commit-Reveal protects against front-running.

Together, these technologies create a recovery system that's private,

trustless,

and fully self-custodial.

---

# Slide 7 — Demo

Now let's see Chateau in action.

We'll simulate a lost wallet,

recover it using our protocol,

and show that the user never had to reveal their identity or trust anyone else.