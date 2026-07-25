"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PersistedWalletState = {
  credentialId: string | null;
  accountAddress: string | null;
};

type WalletState = PersistedWalletState & {
  setCredential: (credentialId: string, accountAddress: string) => void;
  clear: () => void;
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      credentialId: null,
      accountAddress: null,
      setCredential: (credentialId, accountAddress) =>
        set({ credentialId, accountAddress }),
      clear: () => set({ credentialId: null, accountAddress: null }),
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
