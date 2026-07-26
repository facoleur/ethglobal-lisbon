import { decodeAbiParameters, toHex, type Hex } from "viem";
import {
  semaphoreGroupsAbi,
  tarRecoveryExecutorV2Abi,
} from "@/lib/contracts/tar-recovery";
import {
  publicClient,
  tarRecoveryExecutorV2Address,
  tarRecoveryExecutorV2DeploymentBlock,
} from "@/lib/kernel/config";

export const runtime = "nodejs";

const MEMBERS_ADDED_TOPIC =
  "0x61e5e8054e3daf084a0c6c646c065e8bf5e7ca4d5567bda942309bd1652f349d";

type BlockscoutLog = {
  data: Hex;
};

type BlockscoutResponse = {
  result?: BlockscoutLog[];
  status?: string;
};

export async function GET(request: Request): Promise<Response> {
  if (
    !tarRecoveryExecutorV2Address ||
    tarRecoveryExecutorV2DeploymentBlock === BigInt(0)
  ) {
    return Response.json(
      { error: "TAR Recovery V2 is not configured." },
      { status: 503 },
    );
  }

  const rawGroupId = new URL(request.url).searchParams.get("groupId");
  if (!rawGroupId || !/^\d+$/.test(rawGroupId)) {
    return Response.json({ error: "Invalid group ID." }, { status: 400 });
  }

  try {
    const groupId = BigInt(rawGroupId);
    const semaphoreAddress = await publicClient.readContract({
      abi: tarRecoveryExecutorV2Abi,
      address: tarRecoveryExecutorV2Address,
      functionName: "semaphore",
    });
    const explorerUrl = new URL("https://eth-sepolia.blockscout.com/api");
    explorerUrl.search = new URLSearchParams({
      module: "logs",
      action: "getLogs",
      fromBlock: tarRecoveryExecutorV2DeploymentBlock.toString(),
      toBlock: "latest",
      address: semaphoreAddress,
      topic0: MEMBERS_ADDED_TOPIC,
      topic0_1_opr: "and",
      topic1: toHex(groupId, { size: 32 }),
    }).toString();
    const [logsResponse, merkleTreeRoot] = await Promise.all([
      fetch(explorerUrl, { cache: "no-store" }),
      publicClient.readContract({
        abi: semaphoreGroupsAbi,
        address: semaphoreAddress,
        functionName: "getMerkleTreeRoot",
        args: [groupId],
      }),
    ]);
    if (!logsResponse.ok) throw new Error("Blockscout request failed.");

    const logs = (await logsResponse.json()) as BlockscoutResponse;
    const event = logs.status === "1" ? logs.result?.at(-1) : undefined;
    if (!event) throw new Error("MembersAdded event was not found.");

    const [startIndex, members, eventRoot] = decodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256[]" }, { type: "uint256" }],
      event.data,
    );
    if (
      startIndex !== BigInt(0) ||
      members.length !== 16 ||
      eventRoot !== merkleTreeRoot
    ) {
      throw new Error("Defense group event does not match on-chain state.");
    }

    return Response.json({
      members: members.map((member) => member.toString()),
      merkleTreeRoot: merkleTreeRoot.toString(),
    });
  } catch {
    return Response.json(
      { error: "Defense group could not be reconstructed." },
      { status: 502 },
    );
  }
}
