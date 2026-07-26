// Generates test/fixtures/semaphore_proof_vector.json — a real Groth16 Semaphore proof vector,
// consumed by test/integration/SemaphoreProofVector.t.sol against the real Semaphore.sol +
// SemaphoreVerifier.sol (not MockSemaphore). See docs/v2/context_mD_v2.md for the full rationale.
//
// Run once (`npm install && npm run generate`), commit the resulting JSON — not regenerated on
// every test run. Deterministic seed, so re-running reproduces byte-identical output.
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof, verifyProof } from "@semaphore-protocol/proof"
import fs from "fs"

const identity = new Identity("tar-watchtower-fixture-seed")

// Small group: the test identity + 2 padding members — no need for 16 (context_mD_v2.md §2).
const group = new Group([identity.commitment, 111n, 222n])

// `scope = uint256(uint160(addressToRecover))`, the convention `challengeRecovery` expects
// (context_mC_v2.md §5). `testAccountAddress` here is an arbitrary fixed test value, not a real
// deployed account.
const scope = 0xc0ffeen
const testAccountAddress = `0x${scope.toString(16).padStart(40, "0")}`
const message = 42n

console.log("Generating valid proof (identity is a real group member)...")
const validProof = await generateProof(identity, group, message, scope)
console.log("  valid proof verifies (JS-side sanity check):", await verifyProof(validProof))

// "Invalid proof" fixture — deliberately NOT built from a genuinely-absent identity. The
// Semaphore circuit computes `merkleTreeRoot` as an output derived from the witness (secret +
// Merkle siblings): there is no way to get a *recorded* group root out of a non-member's real
// inclusion attempt. A proof from an identity truly absent from the group would carry a
// different root entirely, and would be rejected by Semaphore.sol's own
// `Semaphore__MerkleTreeRootIsNotPartOfTheGroup` check *before* ever reaching the Groth16
// verifier — not by `verifyProof` returning `false`. Since `TARRecoveryExecutorV2.challengeRecovery`
// only raises `InvalidWatchTowerProof` on that latter path (see context_mC_v2.md §3), this
// fixture reuses the valid proof's root/nullifier/message/scope (so it passes every structural
// check) but corrupts `points`, so only the final Groth16 pairing check fails.
const invalidProof = {
  ...validProof,
  points: validProof.points.map((p) => (BigInt(p) + 1n).toString())
}
console.log("  invalid proof verifies (JS-side sanity check, expect false):", await verifyProof(invalidProof))

const fixture = {
  group: {
    members: [identity.commitment.toString(), "111", "222"]
  },
  testAccountAddress,
  message: message.toString(),
  scope: scope.toString(),
  valid: validProof,
  invalid: invalidProof
}

const outputPath = new URL("../../test/fixtures/semaphore_proof_vector.json", import.meta.url)
fs.writeFileSync(outputPath, JSON.stringify(fixture, null, 2))
console.log(`Wrote ${outputPath.pathname}`)
