"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBalance } from "wagmi";
import { toast } from "sonner";
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

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("step2Title")}</h1>
          <p className="text-muted-foreground text-sm">{t("step2Subtitle")}</p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-black/[0.04] p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {t("targetAddressLabel")}
            </span>
            <span className="text-sm font-medium">
              {targetAccount ? truncateAddress(targetAccount) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {t("broadcasterAddressLabel")}
            </span>
            <span className="text-sm font-medium">
              {broadcasterAddress ? truncateAddress(broadcasterAddress) : "—"}
            </span>
          </div>
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
          <div className="flex items-center justify-between">
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

        <div className="flex flex-col items-center gap-2">
          <QrCode value={eip681Uri} />
          <p className="text-muted-foreground text-center text-xs">
            {t("qrCaption")}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full rounded-xl"
            onClick={handleCopyBroadcasterAddress}
            disabled={!broadcasterAddress}
          >
            {t("copyBroadcasterAddress")}
          </Button>
        </div>
        <p
          className={
            hasPassedFunding
              ? "text-center text-sm font-medium text-foreground"
              : "text-muted-foreground text-center text-sm"
          }
        >
          {recoverySubmission.isPending
            ? t("submittingRecovery")
            : isCreatingPasskey
              ? t("creatingRecoveryPasskey")
              : hasPassedFunding
                ? t("fundsReceived")
                : t("waitingForFunds")}
        </p>
      </div>

      <div className="mt-auto pt-8">
        {canStartRecovery || canResumeRecovery || isWorking ? (
          <Button
            size="lg"
            className="w-full rounded-2xl py-4"
            onClick={handleCreatePasskeyAndStart}
            disabled={isWorking}
            loading={isWorking}
            loadingLabel={
              recoverySubmission.isPending
                ? t("submittingRecovery")
                : t("creatingRecoveryPasskey")
            }
          >
            {t("startRecoveryButton")}
          </Button>
        ) : (
          <Button size="lg" className="w-full rounded-2xl py-4" disabled>
            {t("waitingForFunds")}
          </Button>
        )}
      </div>
    </div>
  );
}
