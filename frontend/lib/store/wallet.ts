"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { KernelAccountClient } from "@zerodev/sdk";

type PersistedWalletState = {
  credentialId: string | null;
  accountAddress: string | null;
};

type WalletState = PersistedWalletState & {
  kernelClient: KernelAccountClient | null;
  setCredential: (credentialId: string, accountAddress: string) => void;
  setKernelClient: (client: KernelAccountClient) => void;
  clear: () => void;
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      credentialId: null,
      accountAddress: null,
      kernelClient: null,
      setCredential: (credentialId, accountAddress) =>
        set({ credentialId, accountAddress }),
      setKernelClient: (kernelClient) => set({ kernelClient }),
      clear: () =>
        set({ credentialId: null, accountAddress: null, kernelClient: null }),
    }),
    {
      name: "tar-wallet",
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedWalletState => ({
        credentialId: state.credentialId,
        accountAddress: state.accountAddress,
      }),
    },
  ),
);
