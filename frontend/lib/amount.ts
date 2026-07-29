import { parseEther } from "viem";

export function parsePositiveEtherAmount(value: string): bigint | null {
  const normalizedValue = value.trim();
  if (!normalizedValue) return null;

  try {
    const amount = parseEther(normalizedValue);
    return amount > BigInt(0) ? amount : null;
  } catch {
    return null;
  }
}
