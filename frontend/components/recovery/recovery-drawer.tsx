"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ScanLine } from "lucide-react";
import { getAddress, isAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { FullscreenSheet } from "@/components/ui/fullscreen-sheet";
import { QrScanner } from "@/components/ui/qr-scanner";
import { StepStake } from "@/components/recovery/step-stake";
import { StepWaiting } from "@/components/recovery/step-waiting";
import { useTarRecoveryPreflight } from "@/hooks/use-tar-recovery";
import { BROADCASTER_GAS_BUFFER } from "@/lib/recovery";
import { useRecoveryStore } from "@/lib/store/recovery";

type RecoveryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RecoveryDrawer({ open, onOpenChange }: RecoveryDrawerProps) {
  const t = useTranslations("Auth.Recovery");
  const status = useRecoveryStore((state) => state.status);
  const beginFunding = useRecoveryStore((state) => state.beginFunding);
  const resumeRecovery = useRecoveryStore((state) => state.resumeRecovery);
  const [address, setAddress] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const touched = address.length > 0;
  const valid = isAddress(address);
  const targetAccount = valid ? getAddress(address) : undefined;
  const preflight = useTarRecoveryPreflight(targetAccount);
  const isStakeStep =
    status === "awaiting_funding" ||
    status === "ready_to_commit" ||
    status === "requesting" ||
    status === "waiting_reveal" ||
    status === "revealing";

  function handleContinue() {
    if (!targetAccount || !preflight.canContinue || !preflight.lockTime) return;

    if (
      preflight.status === "active" &&
      preflight.lockValue !== null &&
      preflight.revealTimestamp
    ) {
      const broadcasterPrivateKey = generatePrivateKey();
      const broadcasterAddress = privateKeyToAccount(
        broadcasterPrivateKey,
      ).address;
      resumeRecovery({
        targetAccount,
        lockValue: preflight.lockValue,
        revealTimestamp: preflight.revealTimestamp,
        lockTime: preflight.lockTime,
        broadcasterAddress,
        broadcasterPrivateKey,
      });
    } else {
      if (preflight.lockValue === null) return;
      const broadcasterPrivateKey = generatePrivateKey();
      const broadcasterAddress = privateKeyToAccount(
        broadcasterPrivateKey,
      ).address;
      beginFunding({
        targetAccount,
        lockValue: preflight.lockValue,
        lockTime: preflight.lockTime,
        broadcasterAddress,
        broadcasterPrivateKey,
        requiredFunding: preflight.lockValue + BROADCASTER_GAS_BUFFER,
      });
    }

    onOpenChange(false);
    setSheetOpen(true);
  }

  function handleBottomSheetChange(nextOpen: boolean) {
    if (!nextOpen) setAddress("");
    onOpenChange(nextOpen);
  }

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={handleBottomSheetChange}
        title={t("step1Title")}
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t("addressLabel")}</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={t("scanAddress")}
            >
              <ScanLine className="size-5" />
            </button>
            <Input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder={t("addressPlaceholder")}
              aria-invalid={touched && !valid}
              className="pl-12"
            />
          </div>
          {valid && preflight.status === "checking" && (
            <p className="text-muted-foreground text-xs">
              {t("checkingAccount")}
            </p>
          )}
          {valid &&
            preflight.status !== "idle" &&
            preflight.status !== "checking" &&
            preflight.status !== "ready" &&
            preflight.status !== "active" && (
              <p className="text-destructive text-xs">
                {t(`preflight.${preflight.status}`)}
              </p>
            )}
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={handleContinue}
          disabled={!valid || !preflight.canContinue}
        >
          {preflight.status === "active"
            ? t("viewRecoveryButton")
            : t("continueButton")}
        </Button>
      </BottomSheet>

      <FullscreenSheet
        open={sheetOpen && isStakeStep}
        onOpenChange={(nextOpen) => !nextOpen && setSheetOpen(false)}
      >
        <StepStake />
      </FullscreenSheet>

      <BottomSheet
        open={sheetOpen && !isStakeStep && status !== "idle"}
        onOpenChange={(nextOpen) => !nextOpen && setSheetOpen(false)}
      >
        <StepWaiting />
      </BottomSheet>

      {scannerOpen && (
        <QrScanner
          onDetect={(value) => {
            setAddress(value);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  );
}
