"use client";

import { useState } from "react";
import { encodeFunctionData } from "viem";
import { useKernelAccount, useSendKernelTransaction } from "@/hooks/use-kernel";
import { tarRecoveryExecutorV2Abi } from "@/lib/contracts/tar-recovery";
import {
  chain,
  getBrowserPasskeyRpId,
  publicClient,
  tarRecoveryExecutorV2Address,
} from "@/lib/kernel/config";
import { useWalletStore } from "@/lib/store/wallet";
import { deriveWatchTowerIdentityPool } from "@/lib/watch-tower-identity";
import { createDefenseGroupMembers } from "@/lib/watch-tower-proof";
import type { WatchTower } from "@/lib/watch-towers";

const OWNER_RELATIONSHIP_ID = "owner";

export function useRegenerateWatchTowerGroup() {
  const { address } = useKernelAccount();
  const credentialId = useWalletStore((state) => state.credentialId);
  const { sendTransaction, isPending: isSending } = useSendKernelTransaction();
  const [isPreparing, setIsPreparing] = useState(false);

  async function regenerate(watchTowers: WatchTower[]) {
    if (!address || !credentialId) {
      throw new Error("Connect a passkey wallet first.");
    }
    if (!tarRecoveryExecutorV2Address) {
      throw new Error("TAR Recovery V2 is not configured.");
    }

    setIsPreparing(true);
    try {
      const [initialized, epoch] = await Promise.all([
        publicClient.readContract({
          abi: tarRecoveryExecutorV2Abi,
          address: tarRecoveryExecutorV2Address,
          functionName: "isInitialized",
          args: [address],
        }),
        publicClient.readContract({
          abi: tarRecoveryExecutorV2Abi,
          address: tarRecoveryExecutorV2Address,
          functionName: "epochOf",
          args: [address],
        }),
      ]);
      if (!initialized) {
        throw new Error(
          "Configure TAR Recovery V2 before adding watch towers.",
        );
      }
      const ownerIdentityIndex = Number(epoch);
      if (
        !Number.isSafeInteger(ownerIdentityIndex) ||
        ownerIdentityIndex >= 100
      ) {
        throw new Error("Owner identity pool exhausted.");
      }

      const ownerIdentities = await deriveWatchTowerIdentityPool({
        chainId: chain.id,
        credentialId,
        protectedWallet: address,
        relationshipId: OWNER_RELATIONSHIP_ID,
        rpId: getBrowserPasskeyRpId(),
      });
      const members = createDefenseGroupMembers(
        ownerIdentities[ownerIdentityIndex].commitment.toString(),
        watchTowers,
      );
      const transactionHash = await sendTransaction([
        {
          to: tarRecoveryExecutorV2Address,
          data: encodeFunctionData({
            abi: tarRecoveryExecutorV2Abi,
            functionName: "regenerateWatchTowerGroup",
            args: [members.map((member) => BigInt(member))],
          }),
        },
      ]);

      return { epoch: epoch + BigInt(1), members, transactionHash };
    } finally {
      setIsPreparing(false);
    }
  }

  return {
    isConfigured: tarRecoveryExecutorV2Address !== null,
    isPending: isPreparing || isSending,
    regenerate,
  };
}
