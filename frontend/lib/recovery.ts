import { formatEther, parseEther } from "viem";

export const SEPOLIA_CHAIN_ID = 11155111;
export const BROADCASTER_GAS_BUFFER = parseEther("0.01");
export const FINALIZER_GAS_BUFFER = parseEther("0.001");

const MOCK_CHALLENGE_WINDOW_MS = 30_000;
export const MOCK_LOCK_TIME_LABEL = "1 minute";
export const MOCK_LOCK_VALUE_ETH = 0.01;
export const MOCK_LOCK_TIME_MS = 60 * 1000; // 1 minutes

export function buildEip681Uri(
  to: string,
  chainId: number,
  value: bigint,
): string {
  return `ethereum:${to}@${chainId}?value=${value.toString()}`;
}

export function formatEth(value: bigint): string {
  return formatEther(value).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, "");
}

export function formatDuration(seconds: number): string {
  if (seconds % 86_400 === 0) return `${seconds / 86_400}d`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
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
