"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useRecoveryStore } from "@/lib/store/recovery";
import {
  formatCountdown,
  computeProgress,
  simulateFinalize,
} from "@/lib/recovery";

export function StepWaiting() {
  const t = useTranslations("Auth.Recovery");
  const router = useRouter();
  const { status, committedAt, executableAt, setStatus, clear } =
    useRecoveryStore();
  const [now, setNow] = useState(() => Date.now());
  const [isFinalizing, setIsFinalizing] = useState(false);

  const isReady = executableAt !== null && now >= executableAt;
  const timeLeft = executableAt !== null ? Math.max(0, executableAt - now) : 0;
  const progressPercent = computeProgress(committedAt, executableAt, now);

  useEffect(() => {
    if (status !== "waiting") return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [status]);

  async function handleFinalize() {
    setIsFinalizing(true);
    await simulateFinalize();
    setStatus("finalized");
    setIsFinalizing(false);
  }

  if (status === "finalized") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("successTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("successSubtitle")}
          </p>
        </div>
        <div className="mt-auto pt-8">
          <Button
            size="lg"
            className="w-full rounded-2xl py-4"
            onClick={() => {
              clear();
              router.push("/login");
            }}
          >
            {t("backToHome")}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "vetoed") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-1">
          <h1 className="text-destructive text-2xl font-semibold">
            {t("vetoedTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("vetoedSubtitle")}</p>
        </div>
        <div className="mt-auto pt-8">
          <Button
            size="lg"
            variant="outline"
            className="w-full rounded-2xl py-4"
            onClick={clear}
          >
            {t("retryButton")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {isReady ? t("readyTitle") : t("step3Title")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isReady ? t("readySubtitle") : t("step3Subtitle")}
          </p>
        </div>

        {!isReady && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("timeRemaining")}</span>
              <span className="text-muted-foreground tabular-nums text-sm">
                {formatCountdown(timeLeft)}
              </span>
            </div>
            <Progress value={progressPercent} />
          </div>
        )}
      </div>

      {isReady && (
        <div className="mt-auto pt-8">
          <Button
            size="lg"
            className="w-full rounded-2xl py-4"
            onClick={handleFinalize}
            disabled={isFinalizing}
          >
            {isFinalizing ? t("finalizingButton") : t("finalizeButton")}
          </Button>
        </div>
      )}
    </div>
  );
}
