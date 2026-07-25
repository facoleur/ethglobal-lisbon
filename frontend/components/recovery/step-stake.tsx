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
  const tCommon = useTranslations("Common");
  const {
    status,
    targetAccount,
    lockValue,
    lockTime,
    broadcasterAddress,
    requiredFunding,
    setRecoverySigner,
    clear,
  } = useRecoveryStore();
  const [isCreatingPasskey, setIsCreatingPasskey] = useState(false);
  const recoverySubmission = useSubmitTarRecovery();
  const fundingAmount = BigInt(requiredFunding ?? "0");
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
  const isReadyToCommit = status === "ready_to_commit";
  const isSubmittingRecovery =
    status === "requesting" ||
    status === "waiting_reveal" ||
    status === "revealing";

  const eip681Uri = buildEip681Uri(
    broadcasterAddress ?? "0x0000000000000000000000000000000000000000",
    SEPOLIA_CHAIN_ID,
    fundingAmount,
  );

  async function handleCreatePasskey() {
    if (!targetAccount || !broadcasterAddress || !isFunded) return;

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
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsCreatingPasskey(false);
    }
  }

  async function handleCopyBroadcasterAddress() {
    if (!broadcasterAddress) return;

    try {
      await navigator.clipboard.writeText(broadcasterAddress);
      toast.success(t("broadcasterAddressCopied"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  async function handleStartRecovery() {
    try {
      await recoverySubmission.submit();
    } catch {
      toast.error(tCommon("error"));
    }
  }

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
            isFunded
              ? "text-center text-sm font-medium text-foreground"
              : "text-muted-foreground text-center text-sm"
          }
        >
          {isSubmittingRecovery
            ? t("submittingRecovery")
            : isReadyToCommit
              ? t("passkeyReady")
              : isFunded
                ? t("fundsReceived")
                : t("waitingForFunds")}
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        {isFunded && status === "awaiting_funding" && (
          <Button
            size="lg"
            className="w-full rounded-2xl py-4"
            onClick={handleCreatePasskey}
            disabled={isCreatingPasskey}
          >
            {isCreatingPasskey
              ? t("creatingRecoveryPasskey")
              : t("createRecoveryPasskey")}
          </Button>
        )}
        {((isFunded && isReadyToCommit) || isSubmittingRecovery) && (
          <Button
            size="lg"
            className="w-full rounded-2xl py-4"
            onClick={handleStartRecovery}
            disabled={recoverySubmission.isPending}
          >
            {recoverySubmission.isPending
              ? t("submittingRecovery")
              : t("startRecoveryButton")}
          </Button>
        )}
        <Button
          size="lg"
          variant="ghost"
          className="w-full rounded-2xl py-4"
          onClick={clear}
          disabled={isCreatingPasskey || recoverySubmission.isPending}
        >
          {t("cancelButton")}
        </Button>
      </div>
    </div>
  );
}
