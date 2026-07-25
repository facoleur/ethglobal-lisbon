"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRecoveryStore } from "@/lib/store/recovery";
import { StepStake } from "@/components/recovery/step-stake";
import { StepWaiting } from "@/components/recovery/step-waiting";

export default function RecoveryPage() {
  const router = useRouter();
  const { status, hasHydrated } = useRecoveryStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (status === "idle") router.replace("/login");
  }, [status, hasHydrated, router]);

  if (!hasHydrated || status === "idle") return null;
  if (status === "staking") return <StepStake />;
  return <StepWaiting />;
}
