"use client";

import type { ReactNode } from "react";
import { KernelProvider } from "@/providers/kernel-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <KernelProvider>{children}</KernelProvider>;
}
