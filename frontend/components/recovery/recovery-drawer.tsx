"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { isAddress } from "viem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useRecoveryStore } from "@/lib/store/recovery";

type RecoveryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RecoveryDrawer({ open, onOpenChange }: RecoveryDrawerProps) {
  const t = useTranslations("Auth.Recovery");
  const router = useRouter();
  const { setTargetAccount, setStatus } = useRecoveryStore();
  const [address, setAddress] = useState("");

  const touched = address.length > 0;
  const valid = isAddress(address);

  function handleContinue() {
    if (!valid) return;
    setTargetAccount(address);
    setStatus("staking");
    onOpenChange(false);
    router.push("/recovery");
  }

  function handleOpenChange(next: boolean) {
    if (!next) setAddress("");
    onOpenChange(next);
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={t("step1Title")}
    >
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("addressLabel")}</label>
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t("addressPlaceholder")}
          aria-invalid={touched && !valid}
        />
      </div>

      <Button
        size="lg"
        className="w-full rounded-2xl py-4"
        onClick={handleContinue}
        disabled={!valid}
      >
        {t("continueButton")}
      </Button>
    </BottomSheet>
  );
}
