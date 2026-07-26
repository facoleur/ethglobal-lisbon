"use client";

import { useState } from "react";
import {
  encodeFunctionData,
  getAddress,
  parseEther,
  zeroAddress,
  type Address,
} from "viem";
import { useBytecode, useReadContracts } from "wagmi";
import {
  useKernelAccount,
  useSendKernelTransaction,
  type KernelCall,
} from "@/hooks/use-kernel";
import {
  kernelModuleAbi,
  lockTimeToSeconds,
  getTarExecutorInstallData,
  tarRecoveryExecutorAbi,
  tarRecoveryExecutorV2Abi,
  type LockTimeUnit,
} from "@/lib/contracts/tar-recovery";
import {
  publicClient,
  tarRecoveryExecutorAddress,
  tarRecoveryExecutorV2Address,
  webAuthnValidatorAddress,
} from "@/lib/kernel/config";
import { createBroadcasterWalletClient } from "@/lib/recovery/broadcaster";
import { useRecoveryStore } from "@/lib/store/recovery";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import { useWalletStore } from "@/lib/store/wallet";
import { prepareDefenseGroupMembers } from "@/lib/watch-tower-policy";

const EXECUTOR_MODULE_TYPE = BigInt(2);
const REVEALED_STATUS = 1;
const FINALIZED_STATUS = 3;

function normalizeError(error: unknown) {
  return error instanceof Error
    ? error
    : new Error("Unexpected recovery error.");
}

async function waitForCommitMaturity(commitBlock: bigint) {
  const revealBlock = commitBlock + BigInt(1);
  while ((await publicClient.getBlockNumber()) < revealBlock) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

export type TarRecoveryPreflightStatus =
  | "idle"
  | "checking"
  | "ready"
  | "active"
  | "contract-unavailable"
  | "unsupported-account"
  | "module-missing"
  | "validator-mismatch"
  | "config-missing"
  | "read-error";

export function useTarRecoveryPreflight(accountAddress?: Address) {
  const enabled =
    accountAddress !== undefined && tarRecoveryExecutorAddress !== null;
  const targetAddress = accountAddress ?? zeroAddress;
  const recoveryAddress = tarRecoveryExecutorAddress ?? zeroAddress;

  const accountCode = useBytecode({
    address: targetAddress,
    query: { enabled: accountAddress !== undefined },
  });
  const recoveryCode = useBytecode({
    address: recoveryAddress,
    query: { enabled: tarRecoveryExecutorAddress !== null },
  });
  const reads = useReadContracts({
    allowFailure: true,
    contracts: [
      {
        address: targetAddress,
        abi: kernelModuleAbi,
        functionName: "isModuleInstalled",
        args: [EXECUTOR_MODULE_TYPE, recoveryAddress, "0x"],
      },
      {
        address: targetAddress,
        abi: kernelModuleAbi,
        functionName: "rootValidator",
      },
      {
        address: recoveryAddress,
        abi: tarRecoveryExecutorAbi,
        functionName: "configs",
        args: [targetAddress],
      },
      {
        address: recoveryAddress,
        abi: tarRecoveryExecutorAbi,
        functionName: "recoveries",
        args: [targetAddress],
      },
    ],
    query: { enabled },
  });

  const moduleResult = reads.data?.[0];
  const validatorResult = reads.data?.[1];
  const configResult = reads.data?.[2];
  const recoveryResult = reads.data?.[3];
  const lockValue =
    configResult?.status === "success" ? configResult.result[0] : null;
  const lockTime =
    configResult?.status === "success" ? configResult.result[1] : null;
  const revealTimestamp =
    recoveryResult?.status === "success" ? recoveryResult.result[4] : null;
  const recoveryStatus =
    recoveryResult?.status === "success"
      ? Number(recoveryResult.result[5])
      : null;
  const rootValidatorAddress =
    validatorResult?.status === "success"
      ? getAddress(`0x${validatorResult.result.slice(-40)}`)
      : null;

  let status: TarRecoveryPreflightStatus = "idle";
  if (accountAddress && !tarRecoveryExecutorAddress) {
    status = "contract-unavailable";
  } else if (
    enabled &&
    (accountCode.isPending || recoveryCode.isPending || reads.isPending)
  ) {
    status = "checking";
  } else if (enabled && !recoveryCode.data) {
    status = "contract-unavailable";
  } else if (enabled && !accountCode.data) {
    status = "unsupported-account";
  } else if (enabled && reads.isError) {
    status = "read-error";
  } else if (enabled && moduleResult?.status !== "success") {
    status = "unsupported-account";
  } else if (
    enabled &&
    moduleResult?.status === "success" &&
    moduleResult.result !== true
  ) {
    status = "module-missing";
  } else if (enabled && rootValidatorAddress !== webAuthnValidatorAddress) {
    status = "validator-mismatch";
  } else if (
    enabled &&
    (lockValue === null || lockTime === null || lockTime === BigInt(0))
  ) {
    status = "config-missing";
  } else if (enabled && recoveryStatus === REVEALED_STATUS) {
    status = "active";
  } else if (enabled) {
    status = "ready";
  }

  return {
    status,
    lockValue,
    lockTime,
    revealTimestamp,
    canContinue: status === "ready" || status === "active",
    needsSetup:
      status === "unsupported-account" ||
      status === "module-missing" ||
      status === "validator-mismatch" ||
      status === "config-missing",
    refetch: async () => {
      await Promise.all([
        accountCode.refetch(),
        recoveryCode.refetch(),
        reads.refetch(),
      ]);
    },
  };
}

export function useUpdateRecoveryParams() {
  const transaction = useSendKernelTransaction();
  const { address: accountAddress } = useKernelAccount();
  const credentialId = useWalletStore((state) => state.credentialId);
  const watchTowers = useWatchTowerStore((state) => state.watchTowers);
  const advanceWatchTowerCommitments = useWatchTowerStore(
    (state) => state.advanceWatchTowerCommitments,
  );

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

    const lockValueWei = parseEther(lockValue.toString());
    const lockTimeSeconds = lockTimeToSeconds(lockTimeValue, lockTimeUnit);
    const recoveryV2Address = tarRecoveryExecutorV2Address;

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
    const isV2Executor =
      recoveryV2Address !== null &&
      tarRecoveryExecutorAddress === recoveryV2Address;
    const currentGroupId =
      isV2Executor && isAccountDeployed
        ? await publicClient.readContract({
            abi: tarRecoveryExecutorV2Abi,
            address: recoveryV2Address!,
            functionName: "groupOf",
            args: [accountAddress],
          })
        : BigInt(0);
    let defaultGroupMembers: string[] | null = null;
    if (isV2Executor && currentGroupId === BigInt(0)) {
      if (!credentialId) throw new Error("Passkey credential not found.");
      const epoch = isAccountDeployed
        ? await publicClient.readContract({
            abi: tarRecoveryExecutorV2Abi,
            address: recoveryV2Address!,
            functionName: "epochOf",
            args: [accountAddress],
          })
        : BigInt(0);
      defaultGroupMembers = await prepareDefenseGroupMembers(
        accountAddress,
        credentialId,
        watchTowers,
        Number(epoch),
      );
    }

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
            getTarExecutorInstallData(lockValueWei, lockTimeSeconds),
          ],
        }),
      });
    } else {
      calls.push({
        to: tarRecoveryExecutorAddress,
        data: encodeFunctionData({
          abi: tarRecoveryExecutorAbi,
          functionName: "updateRecoveryParams",
          args: [lockValueWei, lockTimeSeconds],
        }),
      });
    }

    if (isV2Executor && defaultGroupMembers) {
      calls.push({
        to: recoveryV2Address!,
        data: encodeFunctionData({
          abi: tarRecoveryExecutorV2Abi,
          functionName: "regenerateWatchTowerGroup",
          args: [defaultGroupMembers.map((member) => BigInt(member))],
        }),
      });
    }

    const transactionHash = await transaction.sendTransaction(calls);
    if (defaultGroupMembers) {
      advanceWatchTowerCommitments(watchTowers.map((tower) => tower.id));
    }
    return transactionHash;
  };

  return {
    updateRecoveryParams,
    isConfigured: tarRecoveryExecutorAddress !== null,
    isPending: transaction.isPending,
    error: transaction.error,
  };
}

export function useSubmitTarRecovery() {
  const [isPending, setIsPending] = useState(false);
  const [phase, setPhase] = useState<
    | "submitting-commitment"
    | "confirming-commitment"
    | "waiting-reveal"
    | "submitting-reveal"
    | "confirming-reveal"
    | null
  >(null);
  const [error, setError] = useState<Error | null>(null);

  const submit = async () => {
    if (!tarRecoveryExecutorAddress) {
      throw new Error("TAR recovery executor is not configured.");
    }

    const recovery = useRecoveryStore.getState();
    const {
      targetAccount,
      broadcasterAddress,
      broadcasterPrivateKey,
      pubKeyX,
      pubKeyY,
      salt,
      commitment,
      requestTxHash,
      commitBlock: storedCommitBlock,
      revealTxHash,
      setRequestSubmitted,
      setCommitConfirmed,
      setRevealSubmitted,
      setRevealConfirmed,
    } = recovery;

    if (
      !targetAccount ||
      !broadcasterAddress ||
      !broadcasterPrivateKey ||
      !pubKeyX ||
      !pubKeyY ||
      !salt ||
      !commitment
    ) {
      throw new Error("Recovery data is incomplete.");
    }

    setIsPending(true);
    setError(null);

    try {
      const walletClient = createBroadcasterWalletClient(broadcasterPrivateKey);
      let commitBlock = storedCommitBlock ? BigInt(storedCommitBlock) : null;

      if (commitBlock === null) {
        let hash = requestTxHash;
        if (!hash) {
          setPhase("submitting-commitment");
          hash = await walletClient.sendTransaction({
            to: tarRecoveryExecutorAddress,
            data: encodeFunctionData({
              abi: tarRecoveryExecutorAbi,
              functionName: "requestRecovery",
              args: [commitment],
            }),
          });
          setRequestSubmitted(hash);
        }

        setPhase("confirming-commitment");
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") {
          throw new Error("Recovery request reverted.");
        }
        commitBlock = receipt.blockNumber;
        setCommitConfirmed(commitBlock);
      }

      setPhase("waiting-reveal");
      await waitForCommitMaturity(commitBlock);

      const pendingCommitBlock = await publicClient.readContract({
        address: tarRecoveryExecutorAddress,
        abi: tarRecoveryExecutorAbi,
        functionName: "pendingCommitments",
        args: [commitment],
      });
      if (pendingCommitBlock === BigInt(0)) {
        throw new Error("Recovery commitment is no longer pending.");
      }

      const [lockValue, lockTime] = await publicClient.readContract({
        address: tarRecoveryExecutorAddress,
        abi: tarRecoveryExecutorAbi,
        functionName: "configs",
        args: [targetAccount],
      });

      let hash = revealTxHash;
      if (!hash) {
        setPhase("submitting-reveal");
        hash = await walletClient.sendTransaction({
          to: tarRecoveryExecutorAddress,
          data: encodeFunctionData({
            abi: tarRecoveryExecutorAbi,
            functionName: "revealRecovery",
            args: [
              targetAccount,
              broadcasterAddress,
              BigInt(pubKeyX),
              BigInt(pubKeyY),
              salt,
            ],
          }),
          value: lockValue,
        });
        setRevealSubmitted(hash);
      }

      setPhase("confirming-reveal");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Recovery reveal reverted.");
      }

      const recoveredState = await publicClient.readContract({
        address: tarRecoveryExecutorAddress,
        abi: tarRecoveryExecutorAbi,
        functionName: "recoveries",
        args: [targetAccount],
      });
      const revealTimestamp = recoveredState[4];
      setRevealConfirmed({
        committedAt: Number(revealTimestamp) * 1_000,
        executableAt: Number(revealTimestamp + lockTime) * 1_000,
      });

      return receipt.transactionHash;
    } catch (cause) {
      const nextError = normalizeError(cause);
      setError(nextError);
      throw nextError;
    } finally {
      setIsPending(false);
      setPhase(null);
    }
  };

  return { submit, isPending, phase, error };
}

export function useFinalizeTarRecovery() {
  const recovery = useRecoveryStore();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const finalize = async () => {
    if (!tarRecoveryExecutorAddress) {
      throw new Error("TAR recovery executor is not configured.");
    }

    const { targetAccount, broadcasterPrivateKey, setStatus } = recovery;
    if (!targetAccount || !broadcasterPrivateKey) {
      throw new Error("Recovery completion data is incomplete.");
    }

    setIsPending(true);
    setError(null);

    try {
      const walletClient = createBroadcasterWalletClient(broadcasterPrivateKey);
      const hash = await walletClient.sendTransaction({
        to: tarRecoveryExecutorAddress,
        data: encodeFunctionData({
          abi: tarRecoveryExecutorAbi,
          functionName: "finalizeRecovery",
          args: [targetAccount],
        }),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Recovery finalization reverted.");
      }

      const recoveredState = await publicClient.readContract({
        address: tarRecoveryExecutorAddress,
        abi: tarRecoveryExecutorAbi,
        functionName: "recoveries",
        args: [targetAccount],
      });
      if (Number(recoveredState[5]) !== FINALIZED_STATUS) {
        throw new Error("Recovery was not finalized on-chain.");
      }

      setStatus("finalized");
      return receipt.transactionHash;
    } catch (cause) {
      const nextError = normalizeError(cause);
      setError(nextError);
      throw nextError;
    } finally {
      setIsPending(false);
    }
  };

  return { finalize, isPending, error };
}
