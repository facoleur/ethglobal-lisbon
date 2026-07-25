import type { Address } from "viem";
import { MOCK_LOCK_TIME_MS } from "@/lib/recovery";

export type RecoveryAttemptRole = "owner" | "watchTower";

export type RecoveryAttempt = {
  id: string;
  role: RecoveryAttemptRole;
  targetAddress: Address;
  targetLabel: string;
  recovererAddress: Address;
  detectedAt: number;
  executableAt: number;
};

export type RecoveryAttemptGroups = {
  owner: RecoveryAttempt[];
  watchTower: RecoveryAttempt[];
};

type SimulateRecoveryAttemptInput = {
  role: RecoveryAttemptRole;
  targetAddress: Address;
  targetLabel: string;
};

const MOCK_RECOVERER_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

function wait(duration: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

export function groupRecoveryAttempts(
  attempts: RecoveryAttempt[],
): RecoveryAttemptGroups {
  return {
    owner: attempts.filter((attempt) => attempt.role === "owner"),
    watchTower: attempts.filter((attempt) => attempt.role === "watchTower"),
  };
}

export function getAttemptTimeLeft(
  attempt: RecoveryAttempt,
  now: number,
): number {
  return Math.max(0, attempt.executableAt - now);
}

export function getAttemptProgressRemaining(
  attempt: RecoveryAttempt,
  now: number,
): number {
  const duration = attempt.executableAt - attempt.detectedAt;
  if (duration <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, ((attempt.executableAt - now) / duration) * 100),
  );
}

export async function simulateRecoveryAttempt({
  role,
  targetAddress,
  targetLabel,
}: SimulateRecoveryAttemptInput): Promise<RecoveryAttempt> {
  await wait(500);
  const detectedAt = Date.now();
  return {
    id: crypto.randomUUID(),
    role,
    targetAddress,
    targetLabel,
    recovererAddress: MOCK_RECOVERER_ADDRESS,
    detectedAt,
    executableAt: detectedAt + MOCK_LOCK_TIME_MS,
  };
}

export async function simulateResolveRecoveryAttempt(): Promise<void> {
  await wait(900);
}
