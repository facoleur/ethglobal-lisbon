import { keccak256, stringToHex, type Address } from "viem";
import {
  semaphoreGroupsAbi,
  tarRecoveryExecutorV2Abi,
} from "@/lib/contracts/tar-recovery";
import {
  chain,
  getBrowserPasskeyRpId,
  publicClient,
  tarRecoveryExecutorV2Address,
  tarRecoveryExecutorV2DeploymentBlock,
} from "@/lib/kernel/config";
import type { WatchedWallet } from "@/lib/watch-towers";
import {
  generateWatchTowerProof,
  type SemaphoreProofAbi,
} from "@/lib/watch-tower-proof";

export type DefensePolicy = {
  epoch: bigint;
  groupId: bigint;
  members: string[];
  merkleTreeRoot: bigint;
};

export class VetoRelayerUnavailableError extends Error {
  constructor() {
    super("The veto relayer is not configured.");
    this.name = "VetoRelayerUnavailableError";
  }
}

async function requireVetoRelayer(): Promise<void> {
  const response = await fetch("/api/veto", { cache: "no-store" });
  if (!response.ok) throw new VetoRelayerUnavailableError();

  const status = (await response.json()) as { configured?: boolean };
  if (!status.configured) throw new VetoRelayerUnavailableError();
}

export async function getDefensePolicy(
  protectedWallet: Address,
): Promise<DefensePolicy> {
  if (!tarRecoveryExecutorV2Address) {
    throw new Error("TAR Recovery V2 is not configured.");
  }
  if (tarRecoveryExecutorV2DeploymentBlock === BigInt(0)) {
    throw new Error("TAR Recovery V2 deployment block is not configured.");
  }

  const [epoch, groupId, semaphoreAddress] = await Promise.all([
    publicClient.readContract({
      abi: tarRecoveryExecutorV2Abi,
      address: tarRecoveryExecutorV2Address,
      functionName: "epochOf",
      args: [protectedWallet],
    }),
    publicClient.readContract({
      abi: tarRecoveryExecutorV2Abi,
      address: tarRecoveryExecutorV2Address,
      functionName: "groupOf",
      args: [protectedWallet],
    }),
    publicClient.readContract({
      abi: tarRecoveryExecutorV2Abi,
      address: tarRecoveryExecutorV2Address,
      functionName: "semaphore",
    }),
  ]);
  if (groupId === BigInt(0)) {
    throw new Error("This wallet has no defense group.");
  }

  const [merkleTreeRoot, events] = await Promise.all([
    publicClient.readContract({
      abi: semaphoreGroupsAbi,
      address: semaphoreAddress,
      functionName: "getMerkleTreeRoot",
      args: [groupId],
    }),
    publicClient.getContractEvents({
      abi: semaphoreGroupsAbi,
      address: semaphoreAddress,
      eventName: "MembersAdded",
      args: { groupId },
      fromBlock: tarRecoveryExecutorV2DeploymentBlock,
      toBlock: "latest",
    }),
  ]);
  const event = events.at(-1);
  if (
    !event?.args.identityCommitments ||
    event.args.identityCommitments.length !== 16 ||
    event.args.merkleTreeRoot !== merkleTreeRoot
  ) {
    throw new Error("Defense group members were not found.");
  }
  const members = event.args.identityCommitments.map((member) =>
    member.toString(),
  );

  return { epoch, groupId, members, merkleTreeRoot };
}

export async function prepareWatchTowerVeto(wallet: WatchedWallet) {
  if (wallet.chainId !== chain.id) {
    throw new Error("The watched wallet belongs to another network.");
  }

  const policy = await getDefensePolicy(wallet.address);
  const proof = await generateWatchTowerProof({
    context: {
      chainId: wallet.chainId,
      credentialId: wallet.credentialId,
      protectedWallet: wallet.address,
      relationshipId: wallet.relationshipId,
      rpId: getBrowserPasskeyRpId(),
    },
    expectedRoot: policy.merkleTreeRoot.toString(),
    groupMembers: policy.members,
    message: BigInt(keccak256(stringToHex("TAR_VETO_V1"))),
    scope: BigInt(wallet.address),
  });

  return { policy, ...proof };
}

export async function prepareOwnerVeto(
  protectedWallet: Address,
  credentialId: string,
) {
  const policy = await getDefensePolicy(protectedWallet);
  const proof = await generateWatchTowerProof({
    context: {
      chainId: chain.id,
      credentialId,
      protectedWallet,
      relationshipId: "owner",
      rpId: getBrowserPasskeyRpId(),
    },
    expectedRoot: policy.merkleTreeRoot.toString(),
    groupMembers: policy.members,
    message: BigInt(keccak256(stringToHex("TAR_VETO_V1"))),
    scope: BigInt(protectedWallet),
  });

  return { policy, ...proof };
}

async function submitVeto(
  addressToRecover: Address,
  proof: SemaphoreProofAbi,
): Promise<`0x${string}`> {
  const response = await fetch("/api/veto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      addressToRecover,
      proof: {
        merkleTreeDepth: proof.merkleTreeDepth.toString(),
        merkleTreeRoot: proof.merkleTreeRoot.toString(),
        message: proof.message.toString(),
        nullifier: proof.nullifier.toString(),
        points: proof.points.map((point) => point.toString()),
        scope: proof.scope.toString(),
      },
    }),
  });
  const body = (await response.json()) as {
    error?: string;
    transactionHash?: `0x${string}`;
  };
  if (!response.ok || !body.transactionHash) {
    throw new Error(body.error || "Veto submission failed.");
  }

  return body.transactionHash;
}

export async function vetoAsWatchTower(wallet: WatchedWallet) {
  await requireVetoRelayer();
  const prepared = await prepareWatchTowerVeto(wallet);
  const transactionHash = await submitVeto(wallet.address, prepared.proofAbi);
  return { ...prepared, transactionHash };
}

export async function vetoAsOwner(
  protectedWallet: Address,
  credentialId: string,
) {
  await requireVetoRelayer();
  const prepared = await prepareOwnerVeto(protectedWallet, credentialId);
  const transactionHash = await submitVeto(protectedWallet, prepared.proofAbi);
  return { ...prepared, transactionHash };
}
