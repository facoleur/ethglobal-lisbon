"use client";

import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import type { WaitForUserOperationReceiptReturnType } from "viem/account-abstraction";
import { useKernelContext } from "@/providers/kernel-provider";
import { publicClient } from "@/lib/kernel/config";
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
    login: (passkeyName: string) => connect("login", passkeyName),
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

  useEffect(() => {
    let cancelled = false;

    if (!address) return;

    publicClient
      .getBalance({ address })
      .then((nextBalance) => {
        if (!cancelled) {
          setBalance(nextBalance);
          setLoadedAddress(address);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setLoadedAddress(address);
          setError(normalizeError(cause));
        }
      });

    return () => {
      cancelled = true;
    };
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
