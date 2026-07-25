"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWalletStore } from "@/lib/store/wallet";
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
  connect: (mode: PasskeyMode, passkeyName: string) => Promise<void>;
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

  const connect = async (mode: PasskeyMode, passkeyName: string) => {
    if (isConnecting.current) return;

    const name = passkeyName.trim() || DEFAULT_PASSKEY_NAME;

    isConnecting.current = true;
    setStatus("connecting");
    setPendingMode(mode);
    setError(null);

    try {
      const nextSession = await createKernelSession(mode, name);
      setSession(nextSession);
      setStatus("connected");
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
      value={{ session, status, pendingMode, error, connect, disconnect }}
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
