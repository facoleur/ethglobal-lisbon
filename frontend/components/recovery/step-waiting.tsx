"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QrCode } from "@/components/receive/qr-code";
import { useLoginPasskey } from "@/hooks/use-kernel";
import { useFinalizeTarRecovery } from "@/hooks/use-tar-recovery";
import { getErrorMessage } from "@/lib/errors";
import {
  buildEip681Uri,
  computeProgress,
  FINALIZER_GAS_BUFFER,
  formatCountdown,
  formatEth,
  SEPOLIA_CHAIN_ID,
} from "@/lib/recovery";
import { haptic } from "@/lib/haptics";
import { useRecoveryStore } from "@/lib/store/recovery";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useBalance } from "wagmi";

export function StepWaiting() {
  const t = useTranslations("Auth.Recovery");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const {
    status,
    targetAccount,
    broadcasterAddress,
    committedAt,
    executableAt,
    clear,
  } = useRecoveryStore();
  const { login, isPending: isLoggingIn } = useLoginPasskey();
  const finalization = useFinalizeTarRecovery();
  const [now, setNow] = useState(() => Date.now());
  const finalizerBalance = useBalance({
    address: broadcasterAddress ?? undefined,
    query: {
      enabled: broadcasterAddress !== null && status === "waiting",
      refetchInterval: 3_000,
    },
  });

  const isReady = executableAt !== null && now >= executableAt;
  const isFinalizerFunded =
    finalizerBalance.data !== undefined &&
    finalizerBalance.data.value >= FINALIZER_GAS_BUFFER;
  const timeLeft = executableAt !== null ? Math.max(0, executableAt - now) : 0;
  const progressPercent = computeProgress(committedAt, executableAt, now);
  const finalizerFundingUri = buildEip681Uri(
    broadcasterAddress ?? "0x0000000000000000000000000000000000000000",
    SEPOLIA_CHAIN_ID,
    FINALIZER_GAS_BUFFER,
  );

  useEffect(() => {
    if (status !== "waiting") return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [status]);

  async function handleFinalize() {
    try {
      await finalization.finalize();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleCopyFinalizerAddress() {
    if (!broadcasterAddress) return;
    haptic("light");
    try {
      await navigator.clipboard.writeText(broadcasterAddress);
      toast.success(t("finalizerAddressCopied"));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleRecoveredLogin() {
    if (!targetAccount) {
      toast.error(tCommon("error"));
      return;
    }

    try {
      await login("TAR Recovery", targetAccount);
      clear();
      router.push("/");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
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
            onClick={handleRecoveredLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn
              ? t("loggingInRecoveredWallet")
              : t("loginRecoveredWallet")}
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
        <div className="mt-auto flex flex-col gap-4 pt-8">
          {!isFinalizerFunded && (
            <div className="flex flex-col items-center gap-3">
              <QrCode value={finalizerFundingUri} />
              <p className="text-muted-foreground text-center text-sm">
                {t("finalizerFundingHint", {
                  amount: formatEth(FINALIZER_GAS_BUFFER),
                })}
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={handleCopyFinalizerAddress}
                disabled={!broadcasterAddress}
              >
                {t("copyFinalizerAddress")}
              </Button>
            </div>
          )}
          <Button
            size="lg"
            className="w-full rounded-2xl py-4"
            onClick={handleFinalize}
            disabled={!isFinalizerFunded || finalization.isPending}
          >
            {finalization.isPending
              ? t("finalizingButton")
              : isFinalizerFunded
                ? t("finalizeButton")
                : t("waitingForFinalizerFunds")}
          </Button>
        </div>
      )}
    </div>
  );
}
