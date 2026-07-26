import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { tarRecoveryExecutorV2Abi } from "@/lib/contracts/tar-recovery";
import {
  chain,
  sepoliaRpcUrl,
  tarRecoveryExecutorV2Address,
} from "@/lib/kernel/config";
import type { SemaphoreProofAbi } from "@/lib/watch-tower-proof";

export const runtime = "nodejs";

type VetoRequest = {
  addressToRecover: string;
  proof: {
    merkleTreeDepth: string;
    merkleTreeRoot: string;
    message: string;
    nullifier: string;
    points: string[];
    scope: string;
  };
};

function parseUint256(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("Invalid proof value.");
  }
  const parsed = BigInt(value);
  if (parsed < BigInt(0) || parsed >= BigInt(2) ** BigInt(256)) {
    throw new Error("Proof value exceeds uint256.");
  }
  return parsed;
}

function parseRequest(value: unknown): {
  addressToRecover: `0x${string}`;
  proof: SemaphoreProofAbi;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid veto request.");
  }
  const request = value as Partial<VetoRequest>;
  const rawAddress = request.addressToRecover;
  if (
    typeof rawAddress !== "string" ||
    !isAddress(rawAddress) ||
    !request.proof
  ) {
    throw new Error("Invalid veto request.");
  }
  if (
    !Array.isArray(request.proof.points) ||
    request.proof.points.length !== 8
  ) {
    throw new Error("Invalid proof points.");
  }
  const points = request.proof.points.map(parseUint256);
  const addressToRecover = getAddress(rawAddress);
  const proof: SemaphoreProofAbi = {
    merkleTreeDepth: parseUint256(request.proof.merkleTreeDepth),
    merkleTreeRoot: parseUint256(request.proof.merkleTreeRoot),
    message: parseUint256(request.proof.message),
    nullifier: parseUint256(request.proof.nullifier),
    points: [
      points[0],
      points[1],
      points[2],
      points[3],
      points[4],
      points[5],
      points[6],
      points[7],
    ],
    scope: parseUint256(request.proof.scope),
  };
  if (proof.scope !== BigInt(addressToRecover)) {
    throw new Error("Proof scope does not match the recovery account.");
  }

  return { addressToRecover, proof };
}

function getRelayerPrivateKey(): Hex | null {
  const privateKey = process.env.TAR_RELAYER_PRIVATE_KEY?.trim();
  return privateKey && /^0x[0-9a-fA-F]{64}$/.test(privateKey)
    ? (privateKey as Hex)
    : null;
}

export function GET(): Response {
  const privateKey = getRelayerPrivateKey();
  return Response.json({
    configured: tarRecoveryExecutorV2Address !== null && privateKey !== null,
    address: privateKey ? privateKeyToAccount(privateKey).address : null,
  });
}

export async function POST(request: Request): Promise<Response> {
  const privateKey = getRelayerPrivateKey();
  if (!tarRecoveryExecutorV2Address || !privateKey) {
    return Response.json(
      { error: "Veto relayer is not configured." },
      { status: 503 },
    );
  }
  try {
    const rawBody = await request.text();
    if (rawBody.length > 16_384) {
      return Response.json(
        { error: "Veto request is too large." },
        { status: 413 },
      );
    }
    const { addressToRecover, proof } = parseRequest(JSON.parse(rawBody));
    const rpcUrl = process.env.SEPOLIA_RPC_URL?.trim() || sepoliaRpcUrl;
    const account = privateKeyToAccount(privateKey);
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });
    const simulation = await publicClient.simulateContract({
      account,
      abi: tarRecoveryExecutorV2Abi,
      address: tarRecoveryExecutorV2Address,
      functionName: "challengeRecovery",
      args: [addressToRecover, proof],
    });
    const transactionHash = await walletClient.writeContract(
      simulation.request,
    );

    return Response.json({ transactionHash });
  } catch (cause) {
    console.error("Veto relayer rejected a request", {
      cause: cause instanceof Error ? cause.name : "UnknownError",
    });
    return Response.json(
      { error: "Veto request was rejected." },
      { status: 400 },
    );
  }
}
