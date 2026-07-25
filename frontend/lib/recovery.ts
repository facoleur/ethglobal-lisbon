import { parseEther } from "viem";
import { tarRecoveryExecutorAddress } from "@/lib/kernel/config";

// TODO: replace with minimumDeposit() read from TimelockRecovery contract
export const MOCK_LOCK_VALUE_ETH = "0.001";

// TODO: replace with recoveryDelay() read from TimelockRecovery contract (formatted for display)
export const MOCK_LOCK_TIME_LABEL = "30 seconds";

// TODO: replace with recoveryDelay() read from TimelockRecovery contract (in ms, for local countdown seed)
export const MOCK_CHALLENGE_WINDOW_MS = 30_000;

export const SEPOLIA_CHAIN_ID = 11155111;

export const RECOVERY_CONTRACT_ADDRESS =
  tarRecoveryExecutorAddress ?? "0x0000000000000000000000000000000000000000";

export function buildEip681Uri(
  to: string,
  chainId: number,
  valueEth: string,
): string {
  const valueWei = parseEther(valueEth).toString();
  return `ethereum:${to}@${chainId}?value=${valueWei}`;
}

export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function computeProgress(
  committedAt: number | null,
  executableAt: number | null,
  now: number,
): number {
  if (committedAt === null || executableAt === null) return 0;
  const total = executableAt - committedAt;
  if (total <= 0) return 100;
  const elapsed = Math.min(now - committedAt, total);
  return Math.min(100, (elapsed / total) * 100);
}

// TODO: replace with commitRecovery + revealRecovery user operations on TimelockRecovery contract
// executableAt comes from getRecovery(account).executableAt after reveal
export async function simulateStake(): Promise<{ executableAt: number }> {
  await new Promise((r) => setTimeout(r, 2_000));
  return { executableAt: Date.now() + MOCK_CHALLENGE_WINDOW_MS };
}

// TODO: replace with finalizeRecovery user operation on TimelockRecovery contract
export async function simulateFinalize(): Promise<void> {
  await new Promise((r) => setTimeout(r, 1_500));
}

// TODO: replace with vetoRecovery user operation on TimelockRecovery contract
export async function simulateVeto(): Promise<void> {
  await new Promise((r) => setTimeout(r, 1_500));
}

// TODO: replace with getRecovery(connectedAddress) poll on TimelockRecovery contract
export async function simulateIncomingRecovery(): Promise<{
  recovererAddress: `0x${string}`;
  executableAt: number;
}> {
  await new Promise((r) => setTimeout(r, 500));
  return {
    recovererAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    executableAt: Date.now() + MOCK_CHALLENGE_WINDOW_MS,
  };
}
