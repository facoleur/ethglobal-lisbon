"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type RecoveryStatus =
  "idle" | "staking" | "waiting" | "finalized" | "vetoed";

type PersistedRecoveryState = {
  status: RecoveryStatus;
  targetAccount: `0x${string}` | null;
  committedAt: number | null;
  executableAt: number | null;
};

type RecoveryState = PersistedRecoveryState & {
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  setTargetAccount: (addr: `0x${string}`) => void;
  setCommitted: (executableAt: number) => void;
  setStatus: (status: RecoveryStatus) => void;
  clear: () => void;
};

export const useRecoveryStore = create<RecoveryState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      setHasHydrated: (val) => set({ hasHydrated: val }),
      status: "idle",
      targetAccount: null,
      committedAt: null,
      executableAt: null,
      setTargetAccount: (targetAccount) => set({ targetAccount }),
      setCommitted: (executableAt) =>
        set({ executableAt, committedAt: Date.now(), status: "waiting" }),
      setStatus: (status) => set({ status }),
      clear: () =>
        set({
          status: "idle",
          targetAccount: null,
          committedAt: null,
          executableAt: null,
        }),
    }),
    {
      name: "tar-recovery",
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedRecoveryState => ({
        status: state.status,
        targetAccount: state.targetAccount,
        committedAt: state.committedAt,
        executableAt: state.executableAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
