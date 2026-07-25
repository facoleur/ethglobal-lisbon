"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createKernelSession,
  type KernelSession,
  type PasskeyMode,
} from "@/lib/kernel/create-session";

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

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error("Unexpected wallet error.");
}

export function KernelProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<KernelSession | null>(null);
  const [status, setStatus] = useState<KernelStatus>("disconnected");
  const [pendingMode, setPendingMode] = useState<PasskeyMode | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const isConnecting = useRef(false);

  const connect = async (mode: PasskeyMode, passkeyName: string) => {
    if (isConnecting.current) return;

    const name = passkeyName.trim();
    if (!name) {
      setError(new Error("Enter a name for the passkey."));
      return;
    }

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
