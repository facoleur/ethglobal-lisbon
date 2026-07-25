"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { RecoveryAttempt } from "@/lib/recovery-center";
import type { Address } from "viem";

type PersistedRecoveryCenterState = {
  attempts: RecoveryAttempt[];
};

type RecoveryCenterState = PersistedRecoveryCenterState & {
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  addAttempt: (attempt: RecoveryAttempt) => void;
  removeAttempt: (id: string) => void;
  removeAttemptsForTarget: (address: Address) => void;
  clear: () => void;
};

export const useRecoveryCenterStore = create<RecoveryCenterState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      attempts: [],
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      addAttempt: (attempt) =>
        set((state) => ({
          attempts: [
            ...state.attempts.filter(
              (item) => item.targetAddress !== attempt.targetAddress,
            ),
            attempt,
          ],
        })),
      removeAttempt: (id) =>
        set((state) => ({
          attempts: state.attempts.filter((item) => item.id !== id),
        })),
      removeAttemptsForTarget: (address) =>
        set((state) => ({
          attempts: state.attempts.filter(
            (item) => item.targetAddress !== address,
          ),
        })),
      clear: () => set({ attempts: [] }),
    }),
    {
      name: "tar-recovery-center",
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedRecoveryCenterState => ({
        attempts: state.attempts,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
