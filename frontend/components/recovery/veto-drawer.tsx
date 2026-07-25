"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Progress } from "@/components/ui/progress";
import { useVetoStore } from "@/lib/store/veto";
import { formatCountdown, truncateAddress, simulateVeto } from "@/lib/recovery";
import { haptic } from "@/lib/haptics";

type VetoDrawerProps = {
  open: boolean;
};

export function VetoDrawer({ open }: VetoDrawerProps) {
  const t = useTranslations("App.VetoDrawer");
  const tCommon = useTranslations("Common");
  const { recovererAddress, executableAt, detectedAt, clear } = useVetoStore();
  const [now, setNow] = useState(() => Date.now());
  const [isVetoing, setIsVetoing] = useState(false);
  const [vetoed, setVetoed] = useState(false);

  const [trackedExecAt, setTrackedExecAt] = useState(executableAt);
  if (trackedExecAt !== executableAt) {
    setTrackedExecAt(executableAt);
    setIsVetoing(false);
    setVetoed(false);
  }

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!vetoed) return;
    const id = setTimeout(() => clear(), 1_500);
    return () => clearTimeout(id);
  }, [vetoed, clear]);

  const timeLeft = executableAt !== null ? Math.max(0, executableAt - now) : 0;
  const isExpired = executableAt !== null && now >= executableAt;

  const total =
    executableAt !== null && detectedAt !== null
      ? executableAt - detectedAt
      : 0;
  const progressPct = total > 0 ? Math.round((timeLeft / total) * 100) : 0;

  async function handleVeto() {
    haptic("heavy");
    setIsVetoing(true);
    try {
      await simulateVeto();
      setVetoed(true);
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsVetoing(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && isVetoing) return;
    if (!next) clear();
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={vetoed ? t("successTitle") : t("title")}
    >
      {vetoed ? (
        <p className="text-muted-foreground text-sm">{t("successSubtitle")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>

          <div className="flex flex-col gap-3 rounded-2xl bg-black/[0.04] p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {t("requesterLabel")}
              </span>
              <span className="text-sm font-medium">
                {recovererAddress ? truncateAddress(recovererAddress) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {t("timeRemainingLabel")}
              </span>
              {isExpired ? (
                <span className="text-muted-foreground text-sm">
                  {t("expiredLabel")}
                </span>
              ) : (
                <span className="text-sm font-medium tabular-nums">
                  {formatCountdown(timeLeft)}
                </span>
              )}
            </div>

            <Progress
              value={progressPct}
              className="gap-0"
              trackClassName="h-1.5 bg-black/[0.08]"
              indicatorClassName="bg-foreground duration-1000 ease-linear"
            />
          </div>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              variant="destructive"
              className="w-full"
              onClick={handleVeto}
              disabled={isVetoing || isExpired}
            >
              {isVetoing ? t("vetoingButton") : t("vetoButton")}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              onClick={clear}
              disabled={isVetoing}
            >
              {t("allowButton")}
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
