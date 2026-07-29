"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  MAX_WATCH_TOWERS,
  type WatchedWallet,
  type WatchTower,
} from "@/lib/watch-towers";

type PersistedWatchTowerState = {
  watchTowers: WatchTower[];
  watchedWallets: WatchedWallet[];
};

type WatchTowerState = PersistedWatchTowerState & {
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  addWatchTower: (watchTower: WatchTower) => void;
  advanceWatchTowerCommitments: (ids: string[]) => void;
  removeWatchTower: (id: string) => void;
  addWatchedWallet: (wallet: WatchedWallet) => void;
  setWatchedWalletEpoch: (id: string, epoch: number) => void;
  removeWatchedWallet: (id: string) => void;
  clear: () => void;
};

export const useWatchTowerStore = create<WatchTowerState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      watchTowers: [],
      watchedWallets: [],
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      addWatchTower: (watchTower) =>
        set((state) => {
          const alreadyExists = state.watchTowers.some(
            (item) => item.id === watchTower.id,
          );
          if (alreadyExists || state.watchTowers.length >= MAX_WATCH_TOWERS) {
            return state;
          }
          return { watchTowers: [...state.watchTowers, watchTower] };
        }),
      advanceWatchTowerCommitments: (ids) =>
        set((state) => {
          const rotatedIds = new Set(ids);
          return {
            watchTowers: state.watchTowers.map((tower) =>
              rotatedIds.has(tower.id)
                ? {
                    ...tower,
                    nextCommitmentIndex: tower.nextCommitmentIndex + 1,
                  }
                : tower,
            ),
          };
        }),
      removeWatchTower: (id) =>
        set((state) => ({
          watchTowers: state.watchTowers.filter((item) => item.id !== id),
        })),
      addWatchedWallet: (wallet) =>
        set((state) => {
          const withoutDuplicate = state.watchedWallets.filter(
            (item) => item.address !== wallet.address,
          );
          return { watchedWallets: [...withoutDuplicate, wallet] };
        }),
      setWatchedWalletEpoch: (id, lastKnownEpoch) =>
        set((state) => ({
          watchedWallets: state.watchedWallets.map((wallet) =>
            wallet.id === id ? { ...wallet, lastKnownEpoch } : wallet,
          ),
        })),
      removeWatchedWallet: (id) =>
        set((state) => ({
          watchedWallets: state.watchedWallets.filter((item) => item.id !== id),
        })),
      clear: () => set({ watchTowers: [], watchedWallets: [] }),
    }),
    {
      name: "tar-watch-towers",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version): PersistedWatchTowerState => {
        if (version === 1) return persistedState as PersistedWatchTowerState;
        return { watchTowers: [], watchedWallets: [] };
      },
      partialize: (state): PersistedWatchTowerState => ({
        watchTowers: state.watchTowers,
        watchedWallets: state.watchedWallets,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
