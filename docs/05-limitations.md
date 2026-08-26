# Structural limitations and trade-offs

These are not bugs or missing features: they are trade-offs the design deliberately accepts, most of them already documented in [`01-concept.md`](01-concept.md) itself. Each entry has a stable, grep-able id.

### `liveness-dependency`
TAR depends on the owner (or at least one watch tower) being able to observe and react within `lockTime`. An owner who is durably incapacitated with no watch tower is defenseless. The system's opacity (indistinguishability, honeypot-style uncertainty) reduces the risk of an attacker *knowing* an account is undefended, but doesn't change the underlying fact that if no one is watching, the recovery succeeds.

### `capital-requirement`
Initiating a recovery requires staking `lockValue`. A user who has genuinely lost everything may not be able to produce that capital. A third-party "fronting" market for a fee is possible in theory, but doesn't exist.

### `lockTime-tradeoff`
There's no universally correct value for `lockTime`: too short, and the challenge window is insufficient; too long, and legitimate recovery becomes burdensome.

### `key-theft-not-addressed`
TAR addresses key loss, not key theft. An attacker holding a valid key has the active rejection right and can reject the legitimate owner's recovery. This is not a design regression (an attacker with a valid key can drain the account directly anyway, with no need to go through a recovery) — but it marks the exact boundary of what the mechanism protects.

The fact that the signer is a passkey (a key inside the device's Secure Element/TEE) sharply reduces the attack surface compared to a plaintext seed phrase, but doesn't eliminate it:
- **Physical key extraction**: nearly impracticable on a dedicated secure element (StrongBox/Titan M — requires a decapping/fault-injection-grade lab, out of reach for an opportunistic theft). Weaker on a software-only TEE (TrustZone with no dedicated chip) — extraction CVEs historically exist for certain chipsets, but each requires a real, and quickly patched, exploit chain, not a generic method.
- **A signature stolen in isolation (phishing, one-off coercion) has no specific value tied to the rejection right.** An attacker able to obtain a single signature from the victim has much better things to do with it (drain the account directly, install a validator they control) — the "stolen rejection right" mentioned above isn't what an attacker would go after via a one-off theft.
- **The rejection right only becomes a real problem in case of *durable* compromise of the signer** — not an isolated theft: persistent access (a backdoor installed via an earlier trick, malware, or a compromised cloud account if the credential is a *synced* rather than *device-bound* passkey — undetermined for this repo; `lib/kernel/register-prf-passkey.ts` delegates `authenticatorSelection`/`residentKey` to the ZeroDev passkey server, to be checked via registration attestation). Once this durable access is obtained, the attacker can drain the account at will **and**, if the legitimate owner later attempts a TAR recovery from another device to regain control, reject that attempt and confiscate their `lockValue` — keeping control while making them pay for trying to take it back. It's this precise scenario, not an isolated stolen signature, that matches the "active rejection right" mentioned above.

### `griefing-vetotower`
**The design's most sensitive point** (described as such in `01-concept.md`). A watch tower has "strictly negative" power, but that negative power includes indefinitely vetoing the owner's legitimate recovery. To preserve indistinguishability, an owner reject and a watch tower veto must be identical on-chain — a malicious watch tower can therefore confiscate the owner's `lockValue` on every attempt, and the owner (who has just lost their keys) can't update the Merkle root to remove it. No mitigation implemented at this stage.

### `private-setting-collusion`
In the "private address" setting (theorized in `01-concept.md`, not implemented), the recoverers who helped reconstruct the address can, if they collude, link the user's public handle to their address — even though the on-chain recovery event itself only reveals a signer rotation, not the identity that initiated it.

### `commitment-spam`
`requestRecovery` is entirely free (no value at stake, only the gas cost). An attacker can submit an arbitrary number of hollow commitments. Explicitly accepted as a POC limitation — no anti-spam or expiry mechanism implemented.

### `credentialIdHash-staleness`
`TARWebAuthnValidator.setNewOwner` (the path used by `finalizeRecovery`, V1 and V2) updates `pubKeyX`/`pubKeyY` but not `credentialIdHash`, unlike `rotatePublicKey`. After a TAR recovery, this stored field becomes stale. Open question, never settled — depends on whether some part of the system (frontend, another contract) actually relies on `credentialIdHash` afterward.

### `no-real-userop-e2e-test`
No test runs the full cycle through a real `EntryPoint.handleOps`/`PackedUserOperation` — the entire contract test suite (V1 and V2) exercises the logic via direct calls. Real behavior under a bundler/EntryPoint is therefore only validated indirectly, through production usage by the frontend (which does go through real UserOps for the Kernel account's own actions — but not for `requestRecovery`/`revealRecovery`/`finalizeRecovery` themselves, which are sent as direct transactions by an EOA broadcaster, see `03-architecture-frontend.md`).

### `zk-group-storage-tradeoff`
A trade-off discussed several times outside the repo, never written down: **on-chain vs. off-chain** storage of the ZK Merkle tree/group, and **full tree vs. simple commitment** off-chain. The choice actually implemented is "on-chain Semaphore group (real `createGroup`/`addMembers`), reconstructed on demand on the front end via event logs + Blockscout, never stored in a DB" (`app/api/defense-group/route.ts`) — but the reasoning that led to this choice over the alternative isn't captured anywhere. To be filled in by whoever led that discussion.
