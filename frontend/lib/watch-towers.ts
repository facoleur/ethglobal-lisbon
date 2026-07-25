import { getAddress, type Address } from "viem";

export const MAX_WATCH_TOWERS = 16;

export type WatchTower = {
  id: string;
  label: string;
  secret: string;
  createdAt: number;
};

export type WatchedWallet = {
  id: string;
  label: string;
  address: Address;
  secret: string;
  createdAt: number;
};

type AddWatchTowerInput = {
  label: string;
  secret: string;
};

type CreateWatchedWalletInput = {
  label: string;
  address: Address;
};

function wait(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function createMockSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

export function maskWatchTowerSecret(secret: string): string {
  if (secret.length <= 12) return "••••••••";
  return `${secret.slice(0, 6)}…${secret.slice(-4)}`;
}

export async function simulateAddWatchTower({
  label,
  secret,
}: AddWatchTowerInput): Promise<WatchTower> {
  await wait(650);
  return {
    id: crypto.randomUUID(),
    label: label.trim(),
    secret: secret.trim(),
    createdAt: Date.now(),
  };
}

export async function simulateRemoveWatchTower(): Promise<void> {
  await wait(500);
}

export async function simulateCreateWatchedWallet({
  label,
  address,
}: CreateWatchedWalletInput): Promise<WatchedWallet> {
  await wait(650);
  return {
    id: crypto.randomUUID(),
    label: label.trim(),
    address: getAddress(address),
    secret: createMockSecret(),
    createdAt: Date.now(),
  };
}

export async function simulateActivateWatchedWallet(): Promise<void> {
  await wait(500);
}

export async function simulateStopWatchingWallet(): Promise<void> {
  await wait(500);
}
