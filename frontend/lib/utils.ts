import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddressDisplay(address: string): string {
  const hex = address.slice(2);
  const groups = hex.match(/.{1,4}/g) ?? [];
  return `0x ${groups.join(" ")}`;
}
