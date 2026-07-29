"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PersistedWalletState = {
  credentialId: string | null;
  accountAddress: string | null;
  publicKey: string | null;
};

type WalletState = PersistedWalletState & {
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  setCredential: (
    credentialId: string,
    accountAddress: string,
    publicKey: string,
  ) => void;
  clear: () => void;
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      setHasHydrated: (val) => set({ hasHydrated: val }),
      credentialId: null,
      accountAddress: null,
      publicKey: null,
      setCredential: (credentialId, accountAddress, publicKey) =>
        set({ credentialId, accountAddress, publicKey }),
      clear: () =>
        set({
          credentialId: null,
          accountAddress: null,
          publicKey: null,
        }),
    }),
    {
      name: "tar-wallet",
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedWalletState => ({
        credentialId: state.credentialId,
        accountAddress: state.accountAddress,
        publicKey: state.publicKey,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
