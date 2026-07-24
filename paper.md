# Timelock Account Recovery

Account recovery remains one of the core unsolved problems of self-custodial wallet design. Externally owned accounts solve it in the most rigid possible way: the user must preserve a seed phrase, and any failure in that process is either irreversible loss or total compromise. Smart accounts make alternative recovery flows possible, but most existing approaches achieve this by reintroducing trust through another channel. Guardians, social recovery committees, and related constructions improve usability, but they do so by giving some degree of power to third parties.

If smart accounts are meant to compete with EOAs not only in terms of UX but also in terms of sovereignty, then they need a recovery mechanism that does not depend on actors who can positively take control of the account. The purpose of this note is to outline such a mechanism for ERC-4337 smart accounts. The central idea is simple: recovery should remain possible, but it should never be free, never be immediate, and never be riskless for the requester.

## Existing methods

Most current account recovery mechanisms rely on trusted parties. The two most common families are guardian-based recovery and social recovery. In both cases, the underlying principle is the same: the user distributes trust across one or several external actors who may later help restore access to the account.

This is a meaningful improvement over seed phrases from a usability perspective, but it comes with an obvious trade-off. Recovery no longer depends exclusively on the owner's ability to preserve secret material; it depends on the behavior, availability, and honesty of other parties. Even when this trust is distributed, it is still trust. This remains one of the main conceptual problems if the goal is to preserve the trustless and decentralized ethos of crypto systems while avoiding the UX burden of raw seed phrase management.

## Trustless solution

The proposed mechanism introduces a different recovery model based on two account-level parameters: `lockValue`, the amount of ETH that must be staked to initiate a recovery, and `lockTime`, the amount of time that must pass before the recovery can be finalized.

To begin a recovery, a requester locks `lockValue` into a recovery contract that is authorized by the account to handle recovery flows. Once the request is created, the requester must wait through the full `lockTime` before obtaining recovery rights. During that waiting period, the legitimate owner can reject the request. If that happens, the recovery fails and the requester loses the locked stake, which can then be sent to the targeted account or to another beneficiary defined by the protocol.

The key property of this mechanism is that unauthorized recovery attempts become costly and exposed to loss. Recovery is no longer something an attacker can attempt for free. They must lock capital, wait through a challenge window, and accept the possibility that the owner will notice the attempt and confiscate the stake. The system is therefore secured not by trust in third parties, but by a game-theoretic asymmetry between the requester and the legitimate owner.

## Recovery flow

At a high level, the recovery flow is intentionally simple. A requester first initiates a recovery and locks the required collateral. This starts a timelock associated with the targeted account. During that interval, the current owner retains the ability to reject the recovery. If the request is challenged, the process is cancelled and the stake is lost. If the timelock expires without a valid rejection, the recovery can be finalized.

**Diagram: Timelock Recovery**
- Lost Device → Smart Account
- Smart Account → ETH → (loop back)
- Smart Account → Wait Period (owner "Can Reject")
- Wait Period → Allow Access → Device to allow
- Device to allow → (1) → Lost Device

The exact effect of a successful recovery depends on the smart account implementation. In some accounts it may replace the owner key; in others it may update the validation logic, rotate to a new signer, or grant a restricted emergency privilege that is later finalized through an additional step. Those semantics are modular. The core primitive is simply a delayed, challengeable, collateralized recovery claim.

## Front-running resistance

A recovery flow of this kind should not be vulnerable to trivial front-running. If an attacker prepares a recovery transaction in the public mempool, a third party should not be able to observe it and hijack the claim for the same account.

A basic mitigation is to require a prior proof-of-intention commitment. The requester first publishes a commitment of the form `keccak256(addressToRecover, requesterAddress, salt)`. Later, when revealing the recovery request, the contract recomputes the commitment using `msg.sender` and the reveal data and verifies that it had already been registered. This binds the recovery attempt to the original requester and prevents simple mempool theft of the claim.

**Diagram: Timelock Recovery (with commitment)**
- Lost Device → Smart Account
- Recovery Contract → ETH → Smart Account
- Recovery Request → Hash → Intention-proof list (Check Hash)
- Smart Account → Wait Period (owner "Can Reject")
- Wait Period → Allow Access → Device to allow
- Device to allow → ETH → Recovery Request

In practice, the commitment can be hardened further by including a nonce, an expiry, a chain identifier, or an account-specific epoch. The exact construction is flexible, but the core point is that recovery initiation should be bound to a prior hidden commitment rather than exposed as a raw one-step public action.

## Limits of pure game theory

Taken alone, the timelock-plus-collateral model already provides a trustless recovery path with meaningful abuse resistance. But its strength depends heavily on attacker uncertainty. If an attacker has reasons to believe that the owner is inactive, offline, hospitalized, or otherwise unlikely to react within the challenge window, then the expected downside of attempting recovery falls significantly.

This is the main weakness of a pure timelock design. In theory, unauthorized recovery is risky. In practice, informed attackers may be able to reduce that risk by exploiting contextual information about the owner. As soon as attackers can classify some accounts as weakly monitored targets, the deterrence of the system starts to degrade.

## Watch Towers

This is where watch towers become useful. A watch tower is an entity that may veto an ongoing recovery during the challenge period, but has no positive control over the account. It cannot recover the account, cannot move funds, cannot sign transactions as the owner, and cannot seize ownership. Its only role is to block a suspicious recovery before it finalizes.

**Diagram: Timelock Recovery (with WatchTower)**
- Lost Device → Smart Account
- Recovery Contract → ETH → Smart Account
- Recovery Request → Hash → Intention-proof list (Check Hash)
- Smart Account → Wait Period (owner and WatchTower "Can Reject")
- Wait Period → Allow Access → Device to allow
- Device to allow → ETH → Recovery Request

That distinction matters. In a traditional social recovery system, recovery actors are part of the authority structure of the account. Here, watch towers are not recovery authorities. They are only negative-power defensive actors. This keeps the trust surface much narrower: they can prevent a bad transition, but they cannot produce a privileged one.

The direct utility of watch towers is obvious when the owner is temporarily unavailable. But their deeper value is strategic. If an attacker can determine exactly which accounts are protected by additional defensive actors and which are not, they can simply avoid the defended ones and target the rest. A visible defense strengthens the accounts that have it, but it does not meaningfully protect those that do not. What matters much more is making it difficult to tell which accounts are weak targets in the first place.

## Privacy and indistinguishability

The watch tower mechanism becomes significantly stronger once the defensive set is not exposed publicly. Ideally, an attacker inspecting an account should not be able to determine whether additional defensive actors exist, how many there are, or who they are. If that information is visible on-chain, the system immediately separates into obviously protected and obviously unprotected accounts, allowing attackers to optimize their target selection accordingly.

The privacy goal is therefore not merely to hide the identities of individual watch towers. It is to preserve indistinguishability between accounts with different defensive configurations. An account protected only by its owner should look externally similar to an account backed by one or several additional hidden veto actors. More generally, the public recovery surface should not reveal the internal composition of the defensive set. This creates a system-level effect: once defended and undefended accounts become externally indistinguishable, even accounts with no additional defensive actors benefit from the uncertainty created by those that do have hidden watch towers.

A practical way to achieve this is to commit only to the defensive set through a Merkle root stored by the account, rather than publishing the authorized defensive actors directly. Each leaf of the Merkle tree corresponds to an authorized defensive actor or credential, and the account stores only the resulting root. Externally, the account exposes a uniform recovery interface while keeping the underlying defensive structure private.

**Diagram: Merkle Tree Defensive Set Commitment**
- WatchTower 1 + Salt → Node A
- WatchTower 2 + WatchTower 3 → Node A
- Node A (both) → Smart Account → Defensive Set → root

## Anonymous vetoes

Under this model, a watch tower does not identify itself on-chain when vetoing a recovery. Instead, it proves in zero knowledge that it belongs to the set authorized by the current recovery policy for that account and that it is entitled to veto the specific recovery instance in progress. The contract only needs to verify that a valid veto exists; it does not need to learn which actor produced it.

A recovery-scoped nullifier can be used to ensure that the same watch tower cannot submit multiple pseudonymous vetoes for the same recovery attempt. This gives the system a way to combine anonymity with protocol-level uniqueness. The result is that a recovery can be blocked by an authorized hidden actor without revealing any information about the identity of that actor, and ideally without revealing much about the structure of the policy itself.

## Emergent attacker hunting

An interesting second-order effect may emerge naturally from the incentive structure of the system. If failed recovery attempts transfer meaningful value to the targeted account, then some actors may find it rational to operate accounts that appear weak, inactive, or otherwise attractive to attack while actually being actively monitored.

The important point is that this possibility further degrades the attacker's ability to rely on behavioral heuristics. If some apparently weak accounts are in fact deliberate traps, then observed inactivity or weak-looking operational patterns become less reliable as signals of recoverability. The attacker is no longer facing only the uncertainty of hidden defensive policies. They are also facing the possibility that perceived weakness is intentionally staged.

This matters even if such behavior remains relatively rare. The system does not need a large organized class of hunters to benefit from the effect. It only needs attackers to believe that surface-level target selection is noisy and that some attractive targets may in fact be costly mistakes.

## Security intuition

The security of the mechanism should therefore not be understood as resting on a single line of defense. The base layer comes from economic collateral and delayed finality. A malicious requester must lock capital and wait. The second layer comes from the legitimate owner's ability to reject the recovery during the challenge period. The third layer comes from hidden watch towers that may exist even when the owner is unavailable. Finally, the system may acquire an additional background layer of deterrence if the economic incentives lead some actors to operate believable trap accounts.

What makes the overall design interesting is not merely that each individual layer adds protection, but that together they damage the attacker's confidence in their own target classification model. The attacker is forced to reason under uncertainty about owner liveness, hidden veto policies, and the possibility of deceptive targets. That uncertainty is itself a security resource.

## Conclusion

Timelock Account Recovery provides a trustless recovery primitive for ERC-4337 smart accounts based on delayed finalization, locked collateral, and challengeability. Its most interesting extension is not the introduction of trusted recovery actors, but the introduction of hidden defensive actors with strictly negative power. Once those actors are made private, the protection of the system extends beyond the accounts that actively use them, because attackers can no longer easily distinguish defended from undefended targets.

The broader significance of the design is that it shifts recovery security away from explicit trust delegation and toward a combination of economic deterrence, privacy, and strategic uncertainty. In the strongest version of the model, the question for an attacker is no longer whether a given account appears weak, but whether that appearance can be trusted at all.
