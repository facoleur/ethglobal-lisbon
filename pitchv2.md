# TAR — Trustless Account Recovery

---

Nobody likes saving a seed phrase.

So the industry built an alternative: let a cloud provider hold your keys. iCloud, Google Drive, a custodial service. It works — wallet adoption is up.

But think about what you actually gave away.

Your keys live on a server owned by a company, subject to court orders, data breaches, and internal misuse. You didn't remove the trusted third party. You just moved it offchain, out of sight, and out of your control.

**You traded one custodian for another. You just don't see this one.**

---

What if we could remove the custodian entirely — not by bringing back the seed phrase, but by replacing trust with game theory?

---

## How TAR works

Recovery in TAR is open to anyone. No whitelist, no guardian list, no single point of failure.

But it's not free.

To attempt a recovery, you must lock a stake onchain for a fixed timelock period. During that window, the legitimate account owner can prove they're still present — and claim your stake. You lose everything.

This creates an asymmetry that favors the real owner:

- **If you're active**, any recovery attempt costs the attacker their stake. Attacking is expensive; defending is free.
- **If you genuinely lost access**, you're the only one who knows for certain. You initiate recovery yourself, wait out the timelock, and reclaim your account. No one else has the information advantage to frontrun you.

Security becomes an economic game — and the honest player wins by default.

---

## The guardian problem, solved differently

Traditional social recovery gives your guardians the power to *access* your account. You're trusting people with your funds.

TAR flips this completely.

Watch towers in TAR can only do one thing: **veto a recovery**. They cannot initiate one. They cannot move funds. They are shields, not keys.

This changes the trust calculus entirely. You don't need to find someone trustworthy enough to hold your money — you need someone willing to watch a dashboard and click "reject" if something looks wrong.

---

## The invisible shield

Here's where it gets interesting.

What if you don't have anyone you trust even with that limited role? What if you're operating alone?

It doesn't matter — because no attacker can know that.

If some accounts have watch towers and some don't, an attacker can never be sure which kind they're targeting. The risk of losing their stake to a veto they didn't see coming is always present.

The uncertainty itself is the protection.

TAR doesn't just secure accounts that have watch towers. **It creates a collective deterrent that protects every account — including yours — whether you set up a single watch tower or not.**

---

## What TAR removes from the equation

- No seed phrase — ever
- No cloud provider
- No custodian
- No guardian who can steal from you
- No single point of failure

What remains: open cryptoeconomic incentives, and the one fact only you know — that your account is gone.

---

*TAR. Your recovery, secured by game theory.*
