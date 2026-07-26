"use client";

import { useState } from "react";
import { encodeFunctionData } from "viem";
import { useKernelAccount, useSendKernelTransaction } from "@/hooks/use-kernel";
import { tarRecoveryExecutorV2Abi } from "@/lib/contracts/tar-recovery";
import {
  publicClient,
  tarRecoveryExecutorV2Address,
} from "@/lib/kernel/config";
import { useWalletStore } from "@/lib/store/wallet";
import { prepareDefenseGroupMembers } from "@/lib/watch-tower-policy";
import type { WatchTower } from "@/lib/watch-towers";

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
      const members = await prepareDefenseGroupMembers(
        address,
        credentialId,
        watchTowers,
        ownerIdentityIndex,
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
