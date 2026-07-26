import { getAddress, type Address } from "viem";
import type { WatchTowerEnrollment } from "@/lib/watch-tower-enrollment";

export const DEFENSE_GROUP_SIZE = 16;
export const MAX_WATCH_TOWERS = DEFENSE_GROUP_SIZE - 1;

export type WatchTower = {
  commitments: string[];
  createdAt: number;
  id: string;
  label: string;
  nextCommitmentIndex: number;
};

export type WatchedWallet = {
  address: Address;
  chainId: number;
  createdAt: number;
  credentialId: string;
  id: string;
  label: string;
  lastKnownEpoch: number | null;
  relationshipId: string;
};

type CreateWatchedWalletInput = {
  address: Address;
  chainId: number;
  credentialId: string;
  label: string;
  relationshipId: string;
};

export function maskWatchTowerCommitment(commitment: string): string {
  if (commitment.length <= 12) return commitment;
  return `${commitment.slice(0, 6)}…${commitment.slice(-4)}`;
}

export function createWatchTower(
  label: string,
  enrollment: WatchTowerEnrollment,
): WatchTower {
  return {
    commitments: enrollment.commitments,
    createdAt: Date.now(),
    id: enrollment.relationshipId,
    label: label.trim(),
    nextCommitmentIndex: 0,
  };
}

export function createWatchedWallet({
  address,
  chainId,
  credentialId,
  label,
  relationshipId,
}: CreateWatchedWalletInput): WatchedWallet {
  return {
    address: getAddress(address),
    chainId,
    createdAt: Date.now(),
    credentialId,
    id: relationshipId,
    label: label.trim(),
    lastKnownEpoch: null,
    relationshipId,
  };
}
