"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Address, Hex } from "viem";

export type RecoveryStatus =
  | "idle"
  | "awaiting_funding"
  | "ready_to_commit"
  | "requesting"
  | "waiting_reveal"
  | "revealing"
  | "waiting"
  | "finalized"
  | "vetoed";

type PersistedRecoveryState = {
  status: RecoveryStatus;
  targetAccount: Address | null;
  lockValue: string | null;
  lockTime: number | null;
  broadcasterAddress: Address | null;
  broadcasterPrivateKey: Hex | null;
  requiredFunding: string | null;
  credentialId: string | null;
  publicKey: Hex | null;
  pubKeyX: Hex | null;
  pubKeyY: Hex | null;
  salt: Hex | null;
  commitment: Hex | null;
  requestTxHash: Hex | null;
  commitBlock: string | null;
  revealTxHash: Hex | null;
  committedAt: number | null;
  executableAt: number | null;
};

type RecoveryState = PersistedRecoveryState & {
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  beginFunding: (params: {
    targetAccount: Address;
    lockValue: bigint;
    lockTime: bigint;
    broadcasterAddress: Address;
    broadcasterPrivateKey: Hex;
    requiredFunding: bigint;
  }) => void;
  resumeRecovery: (params: {
    targetAccount: Address;
    lockValue: bigint;
    revealTimestamp: bigint;
    lockTime: bigint;
  }) => void;
  setRecoverySigner: (params: {
    credentialId: string;
    publicKey: Hex;
    pubKeyX: Hex;
    pubKeyY: Hex;
    salt: Hex;
    commitment: Hex;
  }) => void;
  setRequestSubmitted: (requestTxHash: Hex) => void;
  setCommitConfirmed: (commitBlock: bigint) => void;
  setRevealSubmitted: (revealTxHash: Hex) => void;
  setRevealConfirmed: (params: {
    committedAt: number;
    executableAt: number;
  }) => void;
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
      lockValue: null,
      lockTime: null,
      broadcasterAddress: null,
      broadcasterPrivateKey: null,
      requiredFunding: null,
      credentialId: null,
      publicKey: null,
      pubKeyX: null,
      pubKeyY: null,
      salt: null,
      commitment: null,
      requestTxHash: null,
      commitBlock: null,
      revealTxHash: null,
      committedAt: null,
      executableAt: null,
      beginFunding: ({
        targetAccount,
        lockValue,
        lockTime,
        broadcasterAddress,
        broadcasterPrivateKey,
        requiredFunding,
      }) =>
        set({
          status: "awaiting_funding",
          targetAccount,
          lockValue: lockValue.toString(),
          lockTime: Number(lockTime),
          broadcasterAddress,
          broadcasterPrivateKey,
          requiredFunding: requiredFunding.toString(),
          credentialId: null,
          publicKey: null,
          pubKeyX: null,
          pubKeyY: null,
          salt: null,
          commitment: null,
          requestTxHash: null,
          commitBlock: null,
          revealTxHash: null,
          committedAt: null,
          executableAt: null,
        }),
      resumeRecovery: ({
        targetAccount,
        lockValue,
        revealTimestamp,
        lockTime,
      }) => {
        const committedAt = Number(revealTimestamp) * 1_000;
        set({
          status: "waiting",
          targetAccount,
          lockValue: lockValue.toString(),
          lockTime: Number(lockTime),
          broadcasterAddress: null,
          broadcasterPrivateKey: null,
          requiredFunding: null,
          credentialId: null,
          publicKey: null,
          pubKeyX: null,
          pubKeyY: null,
          salt: null,
          commitment: null,
          requestTxHash: null,
          commitBlock: null,
          revealTxHash: null,
          committedAt,
          executableAt: committedAt + Number(lockTime) * 1_000,
        });
      },
      setRecoverySigner: ({
        credentialId,
        publicKey,
        pubKeyX,
        pubKeyY,
        salt,
        commitment,
      }) =>
        set({
          status: "ready_to_commit",
          credentialId,
          publicKey,
          pubKeyX,
          pubKeyY,
          salt,
          commitment,
        }),
      setRequestSubmitted: (requestTxHash) =>
        set({ status: "requesting", requestTxHash }),
      setCommitConfirmed: (commitBlock) =>
        set({ status: "waiting_reveal", commitBlock: commitBlock.toString() }),
      setRevealSubmitted: (revealTxHash) =>
        set({ status: "revealing", revealTxHash }),
      setRevealConfirmed: ({ committedAt, executableAt }) =>
        set({ status: "waiting", committedAt, executableAt }),
      setCommitted: (executableAt) =>
        set({ executableAt, committedAt: Date.now(), status: "waiting" }),
      setStatus: (status) => set({ status }),
      clear: () =>
        set({
          status: "idle",
          targetAccount: null,
          lockValue: null,
          lockTime: null,
          broadcasterAddress: null,
          broadcasterPrivateKey: null,
          requiredFunding: null,
          credentialId: null,
          publicKey: null,
          pubKeyX: null,
          pubKeyY: null,
          salt: null,
          commitment: null,
          requestTxHash: null,
          commitBlock: null,
          revealTxHash: null,
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
        lockValue: state.lockValue,
        lockTime: state.lockTime,
        broadcasterAddress: state.broadcasterAddress,
        broadcasterPrivateKey: state.broadcasterPrivateKey,
        requiredFunding: state.requiredFunding,
        credentialId: state.credentialId,
        publicKey: state.publicKey,
        pubKeyX: state.pubKeyX,
        pubKeyY: state.pubKeyY,
        salt: state.salt,
        commitment: state.commitment,
        requestTxHash: state.requestTxHash,
        commitBlock: state.commitBlock,
        revealTxHash: state.revealTxHash,
        committedAt: state.committedAt,
        executableAt: state.executableAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
