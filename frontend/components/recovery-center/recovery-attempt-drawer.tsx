"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { haptic } from "@/lib/haptics";
import { tarRecoveryExecutorV2Address } from "@/lib/kernel/config";
import { formatCountdown, truncateAddress } from "@/lib/recovery";
import {
  getAttemptProgressRemaining,
  getAttemptTimeLeft,
  simulateResolveRecoveryAttempt,
  type RecoveryAttempt,
} from "@/lib/recovery-center";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import { useWalletStore } from "@/lib/store/wallet";
import {
  vetoAsOwner,
  vetoAsWatchTower,
  VetoContractError,
  VetoRelayerUnavailableError,
} from "@/lib/watch-tower-policy";
import {
  WatchTowerIdentityNotInGroupError,
  WatchTowerProofGenerationError,
} from "@/lib/watch-tower-proof";

type RecoveryAttemptDrawerProps = {
  attempt: RecoveryAttempt | null;
  onClose: () => void;
  onResolved: (id: string) => void;
};

export function RecoveryAttemptDrawer({
  attempt,
  onClose,
  onResolved,
}: RecoveryAttemptDrawerProps) {
  const t = useTranslations("App.Recovery.AttemptDrawer");
  const credentialId = useWalletStore((state) => state.credentialId);
  const watchedWallets = useWatchTowerStore((state) => state.watchedWallets);
  const setWatchedWalletEpoch = useWatchTowerStore(
    (state) => state.setWatchedWalletEpoch,
  );
  const [now, setNow] = useState(() => Date.now());
  const [pendingAction, setPendingAction] = useState<
    "veto" | "acknowledge" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!attempt) return;
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [attempt]);

  if (!attempt) {
    return null;
  }
  const currentAttempt = attempt;

  const timeLeft = getAttemptTimeLeft(currentAttempt, now);
  const progress = getAttemptProgressRemaining(currentAttempt, now);
  const isExpired = timeLeft === 0;
  const isPending = pendingAction !== null;

  async function resolve(action: "veto" | "acknowledge") {
    haptic(action === "veto" ? "heavy" : "medium");
    setPendingAction(action);
    setActionError(null);
    try {
      if (action === "veto" && tarRecoveryExecutorV2Address) {
        if (currentAttempt.role === "owner") {
          if (!credentialId) throw new Error("Passkey credential not found.");
          await vetoAsOwner(currentAttempt.targetAddress, credentialId);
        } else {
          const wallet = watchedWallets.find(
            (candidate) =>
              candidate.address.toLowerCase() ===
              currentAttempt.targetAddress.toLowerCase(),
          );
          if (!wallet) throw new Error("Watched wallet identity not found.");
          const result = await vetoAsWatchTower(wallet);
          setWatchedWalletEpoch(wallet.id, Number(result.policy.epoch));
        }
      } else {
        await simulateResolveRecoveryAttempt();
      }
      onResolved(currentAttempt.id);
      toast.success(action === "veto" ? t("vetoSuccess") : t("allowSuccess"));
      onClose();
    } catch (error) {
      let message = t("vetoFailed");
      if (error instanceof VetoRelayerUnavailableError) {
        message = t("relayerUnavailable");
      } else if (error instanceof WatchTowerIdentityNotInGroupError) {
        message = t("identityNotInGroup");
      } else if (error instanceof WatchTowerProofGenerationError) {
        message = t("proofGenerationFailed");
      } else if (error instanceof VetoContractError) {
        message = t("contractRejected", {
          reason: error.code ?? error.message,
        });
      }
      setActionError(message);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isPending) onClose();
  }

  return (
    <BottomSheet
      open
      onOpenChange={handleOpenChange}
      title={
        currentAttempt.role === "owner"
          ? t("ownerTitle")
          : t("watchTowerTitle", { wallet: currentAttempt.targetLabel })
      }
    >
      <p className="text-muted-foreground text-sm">
        {currentAttempt.role === "owner"
          ? t("ownerSubtitle")
          : t("watchTowerSubtitle")}
      </p>

      <div className="flex flex-col gap-4 rounded-2xl bg-black/[0.04] p-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground text-sm">
            {t("walletLabel")}
          </span>
          <span className="truncate text-sm font-medium">
            {currentAttempt.targetLabel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground text-sm">
            {t("requesterLabel")}
          </span>
          <span className="text-sm font-medium">
            {truncateAddress(currentAttempt.recovererAddress)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground text-sm">
            {t("timeRemainingLabel")}
          </span>
          <span className="text-sm font-medium tabular-nums">
            {isExpired ? t("expiredLabel") : formatCountdown(timeLeft)}
          </span>
        </div>
        <Progress
          value={progress}
          className="gap-0 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-black/[0.08] [&_[data-slot=progress-indicator]]:bg-foreground"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          variant="destructive"
          className="w-full"
          onClick={() => resolve("veto")}
          disabled={isPending}
        >
          {pendingAction === "veto" ? t("vetoingButton") : t("vetoButton")}
        </Button>
        {currentAttempt.role === "owner" && (
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => resolve("acknowledge")}
            disabled={isPending}
          >
            {pendingAction === "acknowledge"
              ? t("allowingButton")
              : t("allowButton")}
          </Button>
        )}
        {actionError && (
          <p className="text-destructive text-center text-sm">{actionError}</p>
        )}
      </div>
    </BottomSheet>
  );
}
