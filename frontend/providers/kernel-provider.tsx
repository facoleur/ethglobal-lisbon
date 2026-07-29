"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { concatHex, toHex, type Address, type Hex } from "viem";
import { useWalletStore } from "@/lib/store/wallet";
import { tarWebAuthnValidatorAbi } from "@/lib/contracts/tar-recovery";
import { publicClient, webAuthnValidatorAddress } from "@/lib/kernel/config";
import {
  createKernelSession,
  restoreKernelSession,
  type KernelSession,
  type PasskeyMode,
} from "@/lib/kernel/create-session";
import { normalizeError } from "@/lib/errors";

export type KernelStatus = "disconnected" | "connecting" | "connected";

type KernelContextValue = {
  session: KernelSession | null;
  status: KernelStatus;
  pendingMode: PasskeyMode | null;
  error: Error | null;
  connect: (
    mode: PasskeyMode,
    passkeyName: string,
    accountAddress?: Address,
  ) => Promise<void>;
  restoreRecoveredWallet: (
    credentialId: string,
    publicKey: Hex,
    accountAddress: Address,
  ) => Promise<void>;
  disconnect: () => void;
};

const KernelContext = createContext<KernelContextValue | null>(null);

const DEFAULT_PASSKEY_NAME = "TAR Wallet";

export function KernelProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<KernelSession | null>(null);
  const [status, setStatus] = useState<KernelStatus>("disconnected");
  const [pendingMode, setPendingMode] = useState<PasskeyMode | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const isConnecting = useRef(false);
  const didRestore = useRef(false);

  const credentialId = useWalletStore((s) => s.credentialId);
  const accountAddress = useWalletStore((s) => s.accountAddress);
  const publicKey = useWalletStore((s) => s.publicKey);
  const setCredential = useWalletStore((s) => s.setCredential);
  const clearWallet = useWalletStore((s) => s.clear);

  /* auto-restore session from persisted credential — sans cérémonie WebAuthn */
  useEffect(() => {
    if (didRestore.current) return;
    if (!credentialId || !accountAddress || !publicKey) return;

    didRestore.current = true;

    const restore = async () => {
      isConnecting.current = true;
      setStatus("connecting");
      setPendingMode("login");

      try {
        const nextSession = await restoreKernelSession(
          credentialId,
          publicKey as `0x${string}`,
          accountAddress as `0x${string}`,
        );
        setSession(nextSession);
        setStatus("connected");
      } catch {
        setSession(null);
        setStatus("disconnected");
      } finally {
        isConnecting.current = false;
        setPendingMode(null);
      }
    };

    restore();
  }, [credentialId, accountAddress, publicKey]);

  useEffect(() => {
    const connectedAddress = session?.account.address;
    if (status !== "connected" || !connectedAddress || !publicKey) return;

    let cancelled = false;
    const verifyPasskeyIsCurrent = async () => {
      try {
        const [pubKeyX, pubKeyY] = await publicClient.readContract({
          address: webAuthnValidatorAddress,
          abi: tarWebAuthnValidatorAbi,
          functionName: "keyData",
          args: [connectedAddress],
        });
        if (pubKeyX === BigInt(0) && pubKeyY === BigInt(0)) return;

        const onchainPublicKey = concatHex([
          toHex(pubKeyX, { size: 32 }),
          toHex(pubKeyY, { size: 32 }),
        ]);
        if (
          !cancelled &&
          onchainPublicKey.toLowerCase() !== publicKey.toLowerCase()
        ) {
          setSession(null);
          setStatus("disconnected");
          setPendingMode(null);
          clearWallet();
        }
      } catch {
        // Counterfactual accounts do not have validator state until deployment.
      }
    };

    void verifyPasskeyIsCurrent();
    const interval = window.setInterval(verifyPasskeyIsCurrent, 10_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void verifyPasskeyIsCurrent();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearWallet, publicKey, session?.account.address, status]);

  const connect = async (
    mode: PasskeyMode,
    passkeyName: string,
    targetAccount?: Address,
  ) => {
    if (isConnecting.current) return;

    const name = passkeyName.trim() || DEFAULT_PASSKEY_NAME;

    isConnecting.current = true;
    setStatus("connecting");
    setPendingMode(mode);
    setError(null);

    try {
      const nextSession = await createKernelSession(mode, name, targetAccount);
      didRestore.current = true;
      setSession(nextSession);
      setStatus("connected");
      setCredential(
        nextSession.authenticatorId,
        nextSession.account.address,
        nextSession.publicKey,
      );
    } catch (cause) {
      setSession(null);
      setStatus("disconnected");
      setError(normalizeError(cause));
      throw cause;
    } finally {
      isConnecting.current = false;
      setPendingMode(null);
    }
  };

  const restoreRecoveredWallet = async (
    recoveredCredentialId: string,
    recoveredPublicKey: Hex,
    recoveredAccountAddress: Address,
  ) => {
    if (isConnecting.current) return;

    isConnecting.current = true;
    setStatus("connecting");
    setPendingMode("login");
    setError(null);

    try {
      const nextSession = await restoreKernelSession(
        recoveredCredentialId,
        recoveredPublicKey,
        recoveredAccountAddress,
      );
      didRestore.current = true;
      setSession(nextSession);
      setStatus("connected");
      setCredential(
        nextSession.authenticatorId,
        nextSession.account.address,
        nextSession.publicKey,
      );
    } catch (cause) {
      setSession(null);
      setStatus("disconnected");
      setError(normalizeError(cause));
      throw cause;
    } finally {
      isConnecting.current = false;
      setPendingMode(null);
    }
  };

  const disconnect = () => {
    setSession(null);
    setStatus("disconnected");
    setPendingMode(null);
    setError(null);
  };

  return (
    <KernelContext.Provider
      value={{
        session,
        status,
        pendingMode,
        error,
        connect,
        restoreRecoveredWallet,
        disconnect,
      }}
    >
      {children}
    </KernelContext.Provider>
  );
}

export function useKernelContext() {
  const context = useContext(KernelContext);

  if (!context) {
    throw new Error("Kernel hooks must be used inside KernelProvider.");
  }

  return context;
}
