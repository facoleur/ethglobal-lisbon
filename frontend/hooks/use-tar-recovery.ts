"use client";

import { encodeFunctionData, parseEther } from "viem";
import {
  useKernelAccount,
  useSendKernelTransaction,
  type KernelCall,
} from "@/hooks/use-kernel";
import {
  kernelModuleAbi,
  lockTimeToSeconds,
  tarExecutorInstallData,
  tarRecoveryExecutorAbi,
  type LockTimeUnit,
} from "@/lib/contracts/tar-recovery";
import { publicClient, tarRecoveryExecutorAddress } from "@/lib/kernel/config";

const EXECUTOR_MODULE_TYPE = BigInt(2);

export function useUpdateRecoveryParams() {
  const transaction = useSendKernelTransaction();
  const { address: accountAddress } = useKernelAccount();

  const updateRecoveryParams = async (
    lockValue: number,
    lockTimeValue: number,
    lockTimeUnit: LockTimeUnit,
  ) => {
    if (!tarRecoveryExecutorAddress) {
      throw new Error("TAR recovery executor is not configured.");
    }
    if (!accountAddress) {
      throw new Error("Connect a Kernel account first.");
    }

    const accountCode = await publicClient.getCode({ address: accountAddress });
    const isAccountDeployed = accountCode !== undefined && accountCode !== "0x";
    const isTarInstalled = isAccountDeployed
      ? await publicClient.readContract({
          address: accountAddress,
          abi: kernelModuleAbi,
          functionName: "isModuleInstalled",
          args: [EXECUTOR_MODULE_TYPE, tarRecoveryExecutorAddress, "0x"],
        })
      : false;

    const calls: KernelCall[] = [];

    if (!isTarInstalled) {
      calls.push({
        to: accountAddress,
        data: encodeFunctionData({
          abi: kernelModuleAbi,
          functionName: "installModule",
          args: [
            EXECUTOR_MODULE_TYPE,
            tarRecoveryExecutorAddress,
            tarExecutorInstallData,
          ],
        }),
      });
    }

    calls.push({
      to: tarRecoveryExecutorAddress,
      data: encodeFunctionData({
        abi: tarRecoveryExecutorAbi,
        functionName: "updateRecoveryParams",
        args: [
          parseEther(lockValue.toString()),
          lockTimeToSeconds(lockTimeValue, lockTimeUnit),
        ],
      }),
    });

    return transaction.sendTransaction(calls);
  };

  return {
    updateRecoveryParams,
    isConfigured: tarRecoveryExecutorAddress !== null,
    isPending: transaction.isPending,
    error: transaction.error,
  };
}
