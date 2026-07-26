"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBalance } from "wagmi";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { AccountAvatar } from "@/components/ui/account-avatar";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/receive/qr-code";
import { useSubmitTarRecovery } from "@/hooks/use-tar-recovery";
import { createPasskeyCredential } from "@/lib/kernel/create-session";
import {
  computeRecoveryCommitment,
  generateRecoverySalt,
} from "@/lib/recovery/commitment";
import { getErrorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { useRecoveryStore } from "@/lib/store/recovery";
import {
  BROADCASTER_GAS_BUFFER,
  buildEip681Uri,
  formatDuration,
  formatEth,
  SEPOLIA_CHAIN_ID,
  truncateAddress,
} from "@/lib/recovery";

export function StepStake() {
  const t = useTranslations("Auth.Recovery");
  const {
    status,
    targetAccount,
    lockValue,
    lockTime,
    broadcasterAddress,
    setRecoverySigner,
  } = useRecoveryStore();
  const [isCreatingPasskey, setIsCreatingPasskey] = useState(false);
  const recoverySubmission = useSubmitTarRecovery();
  const fundingAmount = BigInt(lockValue ?? "0") + BROADCASTER_GAS_BUFFER;
  const broadcasterBalance = useBalance({
    address: broadcasterAddress ?? undefined,
    query: {
      enabled: broadcasterAddress !== null,
      refetchInterval: 3_000,
    },
  });
  const isFunded =
    broadcasterBalance.data !== undefined &&
    broadcasterBalance.data.value >= fundingAmount;
  const canStartRecovery = status === "awaiting_funding" && isFunded;
  const canResumeRecovery =
    status === "ready_to_commit" ||
    status === "requesting" ||
    status === "waiting_reveal" ||
    status === "revealing";
  const hasPassedFunding = isFunded || canResumeRecovery;

  const eip681Uri = buildEip681Uri(
    broadcasterAddress ?? "0x0000000000000000000000000000000000000000",
    SEPOLIA_CHAIN_ID,
    fundingAmount,
  );

  async function handleCopyBroadcasterAddress() {
    if (!broadcasterAddress) return;
    haptic("light");
    try {
      await navigator.clipboard.writeText(broadcasterAddress);
      toast.success(t("broadcasterAddressCopied"));
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  async function handleCreatePasskeyAndStart() {
    if (!targetAccount || !broadcasterAddress) return;
    if (!canStartRecovery && !canResumeRecovery) return;

    if (status === "awaiting_funding") {
      setIsCreatingPasskey(true);
      try {
        const credential = await createPasskeyCredential(
          "register",
          "TAR Recovery",
        );
        const salt = generateRecoverySalt();
        const commitment = computeRecoveryCommitment({
          addressToRecover: targetAccount,
          broadcasterAddress,
          pubKeyX: credential.pubKeyX,
          pubKeyY: credential.pubKeyY,
          salt,
        });
        setRecoverySigner({
          credentialId: credential.authenticatorId,
          publicKey: credential.publicKey,
          pubKeyX: credential.pubKeyX,
          pubKeyY: credential.pubKeyY,
          salt,
          commitment,
        });
        setIsCreatingPasskey(false);
      } catch (e) {
        toast.error(getErrorMessage(e));
        setIsCreatingPasskey(false);
        return;
      }
    }

    try {
      await recoverySubmission.submit();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setIsCreatingPasskey(false);
    }
  }

  const isWorking = isCreatingPasskey || recoverySubmission.isPending;
  const loadingLabel = isCreatingPasskey
    ? t("creatingRecoveryPasskey")
    : recoverySubmission.phase === "submitting-commitment"
      ? t("submittingCommitment")
      : recoverySubmission.phase === "confirming-commitment"
        ? t("confirmingCommitment")
        : recoverySubmission.phase === "waiting-reveal"
          ? t("preparingReveal")
          : recoverySubmission.phase === "submitting-reveal"
            ? t("submittingReveal")
            : recoverySubmission.phase === "confirming-reveal"
              ? t("confirmingReveal")
              : t("submittingRecovery");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("step2Title")}</h1>
          <p className="text-muted-foreground text-sm">{t("step2Subtitle")}</p>
        </div>

        <div className="flex items-center gap-3">
          {targetAccount && <AccountAvatar address={targetAccount} size={40} />}
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">
              {t("targetAddressLabel")}
            </p>
            <p className="font-medium">
              {targetAccount ? truncateAddress(targetAccount) : "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-black/[0.04] p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {t("depositLabel")}
            </span>
            <span className="text-sm font-medium">
              {formatEth(BigInt(lockValue ?? "0"))} ETH
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {t("gasBufferLabel")}
            </span>
            <span className="text-sm font-medium">
              {formatEth(BROADCASTER_GAS_BUFFER)} ETH
            </span>
          </div>
          <div className="border-border flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground text-sm">
              {t("totalLabel")}
            </span>
            <span className="text-sm font-semibold">
              {formatEth(fundingAmount)} ETH
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {t("lockTimeLabel")}
            </span>
            <span className="text-sm font-medium">
              {formatDuration(lockTime ?? 0)}
            </span>
          </div>
        </div>

        {!hasPassedFunding ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-card px-3 py-2">
              <span className="size-2 animate-pulse rounded-full bg-foreground" />
              <p className="text-muted-foreground text-sm">
                {t("waitingForFundingAmount", {
                  amount: formatEth(fundingAmount),
                })}
              </p>
            </div>
            <QrCode value={eip681Uri} />
          </div>
        ) : (
          !isWorking && (
            <div className="flex items-center gap-3 rounded-2xl bg-card p-4">
              <CheckCircle2 className="size-6 shrink-0" />
              <div>
                <p className="font-medium">{t("fundsReadyTitle")}</p>
                <p className="text-muted-foreground text-sm">
                  {t("fundsReadySubtitle")}
                </p>
              </div>
            </div>
          )
        )}
      </div>

      <div className="mt-auto pt-8">
        {canStartRecovery || canResumeRecovery || isWorking ? (
          <Button
            size="lg"
            className="w-full rounded-2xl py-4"
            onClick={handleCreatePasskeyAndStart}
            disabled={isWorking}
            loading={isWorking}
            loadingLabel={loadingLabel}
          >
            {t("startRecoveryButton")}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full rounded-2xl py-4"
            onClick={handleCopyBroadcasterAddress}
            disabled={!broadcasterAddress}
          >
            {t("copyBroadcasterAddress")}
          </Button>
        )}
      </div>
    </div>
  );
}
