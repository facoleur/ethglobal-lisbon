"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QrCode } from "@/components/receive/qr-code";
import { useRestoreRecoveredWallet } from "@/hooks/use-kernel";
import { useFinalizeTarRecovery } from "@/hooks/use-tar-recovery";
import { tarRecoveryExecutorAbi } from "@/lib/contracts/tar-recovery";
import { getErrorMessage } from "@/lib/errors";
import { tarRecoveryExecutorAddress } from "@/lib/kernel/config";
import {
  buildEip681Uri,
  computeProgress,
  FINALIZATION_GAS_BUFFER,
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
import { useBalance, useReadContract } from "wagmi";

const REJECTED_STATUS = 2;

export function StepWaiting() {
  const t = useTranslations("Auth.Recovery");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const {
    status,
    targetAccount,
    broadcasterAddress,
    credentialId,
    publicKey,
    committedAt,
    executableAt,
    clear,
    setStatus,
  } = useRecoveryStore();
  const recoveredWallet = useRestoreRecoveredWallet();
  const finalization = useFinalizeTarRecovery();
  const [now, setNow] = useState(() => Date.now());
  const broadcasterBalance = useBalance({
    address: broadcasterAddress ?? undefined,
    query: {
      enabled: broadcasterAddress !== null && status === "waiting",
      refetchInterval: 3_000,
    },
  });
  const onchainRecovery = useReadContract({
    address: tarRecoveryExecutorAddress ?? undefined,
    abi: tarRecoveryExecutorAbi,
    functionName: "recoveries",
    args: targetAccount ? [targetAccount] : undefined,
    query: {
      enabled:
        tarRecoveryExecutorAddress !== null &&
        targetAccount !== null &&
        status === "waiting",
      refetchInterval: 3_000,
    },
  });

  const isReady = executableAt !== null && now >= executableAt;
  const isCompletionFunded =
    broadcasterBalance.data !== undefined &&
    broadcasterBalance.data.value >= FINALIZATION_GAS_BUFFER;
  const timeLeft = executableAt !== null ? Math.max(0, executableAt - now) : 0;
  const progressPercent = computeProgress(committedAt, executableAt, now);
  const completionFundingUri = buildEip681Uri(
    broadcasterAddress ?? "0x0000000000000000000000000000000000000000",
    SEPOLIA_CHAIN_ID,
    FINALIZATION_GAS_BUFFER,
  );

  useEffect(() => {
    if (status !== "waiting") return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (
      status === "waiting" &&
      onchainRecovery.data &&
      Number(onchainRecovery.data[5]) === REJECTED_STATUS
    ) {
      setStatus("vetoed");
    }
  }, [onchainRecovery.data, setStatus, status]);

  async function handleFinalize() {
    if (!targetAccount || !credentialId || !publicKey) {
      toast.error(tCommon("error"));
      return;
    }

    try {
      const finalized = await finalization.finalize();
      if (!finalized) return;
      await recoveredWallet.restore(credentialId, publicKey, targetAccount);
      clear();
      router.replace("/");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleCopyFundingAddress() {
    if (!broadcasterAddress) return;
    haptic("light");
    try {
      await navigator.clipboard.writeText(broadcasterAddress);
      toast.success(t("completionAddressCopied"));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleRecoveredLogin() {
    if (!targetAccount || !credentialId || !publicKey) {
      toast.error(tCommon("error"));
      return;
    }

    try {
      await recoveredWallet.restore(credentialId, publicKey, targetAccount);
      clear();
      router.replace("/");
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
            disabled={recoveredWallet.isPending}
            loading={recoveredWallet.isPending}
            loadingLabel={t("openingRecoveredWallet")}
          >
            {t("openRecoveredWallet")}
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
          {!isCompletionFunded && (
            <div className="flex flex-col items-center gap-3">
              <QrCode value={completionFundingUri} />
              <p className="text-muted-foreground text-center text-sm">
                {t("completionFundingHint", {
                  amount: formatEth(FINALIZATION_GAS_BUFFER),
                })}
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={handleCopyFundingAddress}
                disabled={!broadcasterAddress}
              >
                {t("copyCompletionAddress")}
              </Button>
            </div>
          )}
          <Button
            size="lg"
            className="w-full rounded-2xl py-4"
            onClick={handleFinalize}
            disabled={
              !isCompletionFunded ||
              finalization.isPending ||
              recoveredWallet.isPending
            }
            loading={finalization.isPending || recoveredWallet.isPending}
            loadingLabel={
              recoveredWallet.isPending
                ? t("openingRecoveredWallet")
                : t("finalizingButton")
            }
          >
            {isCompletionFunded
              ? t("finalizeButton")
              : t("waitingForCompletionFunds")}
          </Button>
        </div>
      )}
    </div>
  );
}
