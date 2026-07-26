import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof, type SemaphoreProof } from "@semaphore-protocol/proof";
import type { WatchTowerIdentityContext } from "@/lib/watch-tower-identity";
import { deriveWatchTowerIdentityPool } from "@/lib/watch-tower-identity";
import { DEFENSE_GROUP_SIZE, type WatchTower } from "@/lib/watch-towers";

export type SemaphoreProofAbi = {
  merkleTreeDepth: bigint;
  merkleTreeRoot: bigint;
  message: bigint;
  nullifier: bigint;
  points: readonly [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];
  scope: bigint;
};

type GenerateWatchTowerProofInput = {
  context: WatchTowerIdentityContext;
  expectedRoot?: string;
  groupMembers: string[];
  message: bigint | string;
  scope: bigint | string;
};

type GeneratedWatchTowerProof = {
  commitment: string;
  identityPoolIndex: number;
  proof: SemaphoreProof;
  proofAbi: SemaphoreProofAbi;
};

export class WatchTowerIdentityNotInGroupError extends Error {
  constructor() {
    super("No identity from this watch tower is part of the active group.");
    this.name = "WatchTowerIdentityNotInGroupError";
  }
}

function createDummyCommitment(): string {
  const privateKey = crypto.getRandomValues(new Uint8Array(32));
  return new Identity(privateKey).commitment.toString();
}

function secureShuffle(values: string[]): string[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    const swapIndex = random % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export function createDefenseGroupMembers(
  ownerCommitment: string,
  watchTowers: WatchTower[],
): string[] {
  if (watchTowers.length >= DEFENSE_GROUP_SIZE) {
    throw new Error("Too many external watch towers.");
  }

  const members = [
    ownerCommitment,
    ...watchTowers.map((tower) => {
      const commitment = tower.commitments[tower.nextCommitmentIndex];
      if (!commitment) {
        throw new Error(`Identity pool exhausted for ${tower.label}.`);
      }
      return commitment;
    }),
  ];

  while (members.length < DEFENSE_GROUP_SIZE) {
    members.push(createDummyCommitment());
  }
  if (new Set(members).size !== DEFENSE_GROUP_SIZE) {
    throw new Error("Duplicate Semaphore group member.");
  }

  return secureShuffle(members);
}

export function toSemaphoreProofAbi(proof: SemaphoreProof): SemaphoreProofAbi {
  if (proof.points.length !== 8) {
    throw new Error("Invalid Semaphore proof points.");
  }
  const [p0, p1, p2, p3, p4, p5, p6, p7] = proof.points;

  return {
    merkleTreeDepth: BigInt(proof.merkleTreeDepth),
    merkleTreeRoot: BigInt(proof.merkleTreeRoot),
    message: BigInt(proof.message),
    nullifier: BigInt(proof.nullifier),
    points: [
      BigInt(p0),
      BigInt(p1),
      BigInt(p2),
      BigInt(p3),
      BigInt(p4),
      BigInt(p5),
      BigInt(p6),
      BigInt(p7),
    ],
    scope: BigInt(proof.scope),
  };
}

export async function generateWatchTowerProof({
  context,
  expectedRoot,
  groupMembers,
  message,
  scope,
}: GenerateWatchTowerProofInput): Promise<GeneratedWatchTowerProof> {
  if (groupMembers.length !== DEFENSE_GROUP_SIZE) {
    throw new Error(`Expected ${DEFENSE_GROUP_SIZE} defense group members.`);
  }

  const group = new Group(groupMembers.map((member) => BigInt(member)));
  if (expectedRoot && group.root !== BigInt(expectedRoot)) {
    throw new Error("Defense group root mismatch.");
  }

  const identities = await deriveWatchTowerIdentityPool(context);
  const groupMemberSet = new Set(groupMembers.map((member) => BigInt(member)));
  const identityPoolIndex = identities.findIndex((identity) =>
    groupMemberSet.has(identity.commitment),
  );
  if (identityPoolIndex === -1) {
    throw new WatchTowerIdentityNotInGroupError();
  }

  const identity = identities[identityPoolIndex];
  const proof = await generateProof(identity, group, message, scope);

  return {
    commitment: identity.commitment.toString(),
    identityPoolIndex,
    proof,
    proofAbi: toSemaphoreProofAbi(proof),
  };
}
