"use client";

import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import type { WaitForUserOperationReceiptReturnType } from "viem/account-abstraction";
import { useKernelContext } from "@/providers/kernel-provider";
import { publicClient, watchClient } from "@/lib/kernel/config";
import { normalizeError } from "@/lib/errors";

export type KernelCall = {
  to: Address;
  data?: Hex;
  value?: bigint;
};

export function useKernelAccount() {
  const { session, status, error, disconnect } = useKernelContext();

  return {
    account: session?.account,
    client: session?.client,
    address: session?.account.address,
    status,
    error,
    isConnected: status === "connected" && Boolean(session),
    disconnect,
  };
}

export function useRegisterPasskey() {
  const { connect, pendingMode, error } = useKernelContext();

  return {
    register: (passkeyName: string) => connect("register", passkeyName),
    isPending: pendingMode === "register",
    error,
  };
}

export function useLoginPasskey() {
  const { connect, pendingMode, error } = useKernelContext();

  return {
    login: (passkeyName: string, accountAddress?: Address) =>
      connect("login", passkeyName, accountAddress),
    isPending: pendingMode === "login",
    error,
  };
}

export function useRestoreRecoveredWallet() {
  const { restoreRecoveredWallet, pendingMode, error } = useKernelContext();

  return {
    restore: restoreRecoveredWallet,
    isPending: pendingMode === "login",
    error,
  };
}

export function useDisconnectKernel() {
  const { disconnect } = useKernelContext();

  return disconnect;
}

export function useKernelBalance() {
  const { address } = useKernelAccount();
  const [balance, setBalance] = useState<bigint>();
  const [loadedAddress, setLoadedAddress] = useState<Address>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = async () => {
    if (!address) return;

    setIsRefreshing(true);
    setError(null);
    try {
      setBalance(await publicClient.getBalance({ address }));
      setLoadedAddress(address);
    } catch (cause) {
      setError(normalizeError(cause));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Subscribe to new block numbers so the balance stays up-to-date in
  // real-time.  When a WebSocket transport is available (watchClient ≠
  // publicClient), viem uses eth_subscribe / newHeads — no polling at all.
  // When only HTTP is available, viem polls eth_blockNumber on each block,
  // which is still far cheaper than a separate setInterval on getBalance.
  // The unwatch function returned by watchBlockNumber is used as the
  // useEffect cleanup, guaranteeing the subscription is closed on unmount or
  // when the address changes.
  useEffect(() => {
    if (!address) return;

    const unwatch = watchClient.watchBlockNumber({
      emitOnBegin: true,
      onBlockNumber: () => {
        publicClient
          .getBalance({ address })
          .then((nextBalance) => {
            setBalance(nextBalance);
            setLoadedAddress(address);
            setError(null);
          })
          .catch((cause) => {
            setLoadedAddress(address);
            setError(normalizeError(cause));
          });
      },
      onError: (cause) => {
        setError(normalizeError(cause));
      },
    });

    return unwatch;
  }, [address]);

  const hasCurrentBalance = Boolean(address && loadedAddress === address);

  return {
    balance: hasCurrentBalance ? balance : undefined,
    isLoading: Boolean(address && !hasCurrentBalance) || isRefreshing,
    error: hasCurrentBalance ? error : null,
    refresh,
  };
}

export function useSendUserOperation() {
  const { client } = useKernelAccount();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [receipt, setReceipt] =
    useState<WaitForUserOperationReceiptReturnType>();

  const send = async (calls: readonly KernelCall[]) => {
    if (!client) throw new Error("Connect a Kernel account first.");

    setIsPending(true);
    setError(null);
    setReceipt(undefined);

    try {
      const hash = await client.sendUserOperation({ calls });
      const nextReceipt = await client.waitForUserOperationReceipt({ hash });
      setReceipt(nextReceipt);
      return { hash, receipt: nextReceipt };
    } catch (cause) {
      const nextError = normalizeError(cause);
      setError(nextError);
      throw nextError;
    } finally {
      setIsPending(false);
    }
  };

  return { send, isPending, error, receipt };
}

export function useSendKernelTransaction() {
  const userOperation = useSendUserOperation();

  const sendTransaction = async (calls: readonly KernelCall[]) => {
    const result = await userOperation.send(calls);
    return result.receipt.receipt.transactionHash;
  };

  return {
    sendTransaction,
    isPending: userOperation.isPending,
    error: userOperation.error,
  };
}
