"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getAddress, type Address } from "viem";
import { useKernelAccount } from "@/hooks/use-kernel";
import { tarRecoveryExecutorV2Abi } from "@/lib/contracts/tar-recovery";
import {
  publicClient,
  tarRecoveryExecutorV2Address,
} from "@/lib/kernel/config";
import { useRecoveryCenterStore } from "@/lib/store/recovery-center";
import { useWatchTowerStore } from "@/lib/store/watch-towers";

const POLL_INTERVAL = 15_000;

type RecoveryTarget = {
  address: Address;
  label: string;
  role: "owner" | "watchTower";
};

export function useRecoveryAttemptSync(ownerLabel: string) {
  const { address: ownerAddress } = useKernelAccount();
  const watchedWallets = useWatchTowerStore((state) => state.watchedWallets);
  const addAttempt = useRecoveryCenterStore((state) => state.addAttempt);
  const removeAttemptsForTarget = useRecoveryCenterStore(
    (state) => state.removeAttemptsForTarget,
  );
  const [error, setError] = useState<Error | null>(null);
  const syncingRef = useRef(false);

  const targets: RecoveryTarget[] = [
    ...(ownerAddress
      ? [{ address: ownerAddress, label: ownerLabel, role: "owner" as const }]
      : []),
    ...watchedWallets.map((wallet) => ({
      address: wallet.address,
      label: wallet.label,
      role: "watchTower" as const,
    })),
  ];
  const targetKey = targets
    .map((target) => `${target.role}:${target.address}`)
    .join("|");

  const sync = useEffectEvent(async () => {
    const executorAddress = tarRecoveryExecutorV2Address;
    if (!executorAddress || syncingRef.current) return;
    syncingRef.current = true;

    try {
      const results = await Promise.allSettled(
        targets.map(async (target) => {
          const [recovery, config] = await Promise.all([
            publicClient.readContract({
              abi: tarRecoveryExecutorV2Abi,
              address: executorAddress,
              functionName: "recoveries",
              args: [target.address],
            }),
            publicClient.readContract({
              abi: tarRecoveryExecutorV2Abi,
              address: executorAddress,
              functionName: "configs",
              args: [target.address],
            }),
          ]);
          const [broadcasterAddress, , , , revealTimestamp, status] = recovery;
          const [, lockTime] = config;

          if (status !== 1 || revealTimestamp === BigInt(0)) {
            removeAttemptsForTarget(target.address);
            return;
          }

          const detectedAt = Number(revealTimestamp) * 1_000;
          addAttempt({
            detectedAt,
            executableAt: detectedAt + Number(lockTime) * 1_000,
            id: `${getAddress(target.address)}:${revealTimestamp}`,
            recovererAddress: broadcasterAddress,
            role: target.role,
            targetAddress: target.address,
            targetLabel: target.label,
          });
        }),
      );
      const failed = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      setError(
        failed
          ? failed.reason instanceof Error
            ? failed.reason
            : new Error(String(failed.reason))
          : null,
      );
    } finally {
      syncingRef.current = false;
    }
  });

  useEffect(() => {
    if (!tarRecoveryExecutorV2Address || targets.length === 0) return;

    const initialSync = window.setTimeout(() => void sync(), 0);
    const timer = window.setInterval(() => void sync(), POLL_INTERVAL);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [targetKey, targets.length]);

  return { error };
}
