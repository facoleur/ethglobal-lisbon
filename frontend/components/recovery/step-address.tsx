"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isAddress } from "viem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRecoveryStore } from "@/lib/store/recovery";

export function StepAddress() {
  const t = useTranslations("Auth.Recovery");
  const { setTargetAccount, setStatus } = useRecoveryStore();
  const [address, setAddress] = useState("");

  const touched = address.length > 0;
  const valid = isAddress(address);

  function handleContinue() {
    if (!valid) return;
    setTargetAccount(address);
    setStatus("staking");
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("step1Title")}</h1>
          <p className="text-muted-foreground text-sm">{t("step1Subtitle")}</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t("addressLabel")}</label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("addressPlaceholder")}
            aria-invalid={touched && !valid}
          />
        </div>
      </div>

      <div className="mt-auto pt-8">
        <Button
          size="lg"
          className="w-full rounded-2xl py-4"
          onClick={handleContinue}
          disabled={!valid}
        >
          {t("continueButton")}
        </Button>
      </div>
    </div>
  );
}
