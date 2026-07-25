"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ScanLine } from "lucide-react";
import { isAddress } from "viem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { QrScanner } from "@/components/ui/qr-scanner";
import { useRecoveryStore } from "@/lib/store/recovery";
import { useRouter } from "next/navigation";

type RecoveryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RecoveryDrawer({ open, onOpenChange }: RecoveryDrawerProps) {
  const t = useTranslations("Auth.Recovery");
  const router = useRouter();
  const { setTargetAccount, setStatus } = useRecoveryStore();
  const [address, setAddress] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const touched = address.length > 0;
  const valid = isAddress(address);

  function handleContinue() {
    if (!valid) return;
    setTargetAccount(address);
    setStatus("staking");
    onOpenChange(false);
    router.push("/recover");
  }

  function handleBottomSheetChange(next: boolean) {
    if (!next) setAddress("");
    onOpenChange(next);
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
            >
              <ScanLine className="size-5" />
            </button>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("addressPlaceholder")}
              aria-invalid={touched && !valid}
              className="pl-12"
            />
          </div>
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={handleContinue}
          disabled={!valid}
        >
          {t("continueButton")}
        </Button>
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
