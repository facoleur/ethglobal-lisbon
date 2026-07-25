"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type VetoStatus = "idle" | "pending";

type PersistedVetoState = {
  status: VetoStatus;
  recovererAddress: `0x${string}` | null;
  executableAt: number | null;
  detectedAt: number | null;
};

type VetoState = PersistedVetoState & {
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  setPending: (recoverer: `0x${string}`, executableAt: number) => void;
  clear: () => void;
};

export const useVetoStore = create<VetoState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      setHasHydrated: (val) => set({ hasHydrated: val }),
      status: "idle",
      recovererAddress: null,
      executableAt: null,
      detectedAt: null,
      setPending: (recovererAddress, executableAt) =>
        set({
          status: "pending",
          recovererAddress,
          executableAt,
          detectedAt: Date.now(),
        }),
      clear: () =>
        set({
          status: "idle",
          recovererAddress: null,
          executableAt: null,
          detectedAt: null,
        }),
    }),
    {
      name: "tar-veto",
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedVetoState => ({
        status: state.status,
        recovererAddress: state.recovererAddress,
        executableAt: state.executableAt,
        detectedAt: state.detectedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
