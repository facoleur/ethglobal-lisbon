"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/receive/qr-code";
import { useRecoveryStore } from "@/lib/store/recovery";
import {
  buildEip681Uri,
  MOCK_LOCK_VALUE_ETH,
  MOCK_LOCK_TIME_LABEL,
  RECOVERY_CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  truncateAddress,
  simulateStake,
} from "@/lib/recovery";

export function StepStake() {
  const t = useTranslations("Auth.Recovery");
  const { targetAccount, setCommitted, clear } = useRecoveryStore();
  const [isPending, setIsPending] = useState(false);

  const eip681Uri = buildEip681Uri(
    RECOVERY_CONTRACT_ADDRESS,
    SEPOLIA_CHAIN_ID,
    MOCK_LOCK_VALUE_ETH,
  );

  async function handleStake() {
    setIsPending(true);
    const { executableAt } = await simulateStake();
    setCommitted(executableAt);
    setIsPending(false);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("step2Title")}</h1>
          <p className="text-muted-foreground text-sm">{t("step2Subtitle")}</p>
        </div>

        <div className="border-border flex flex-col gap-3 rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {t("targetAddressLabel")}
            </span>
            <span className="font-mono text-sm font-medium">
              {targetAccount ? truncateAddress(targetAccount) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {t("depositLabel")}
            </span>
            <span className="text-sm font-medium">
              {MOCK_LOCK_VALUE_ETH} ETH
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {t("lockTimeLabel")}
            </span>
            <span className="text-sm font-medium">{MOCK_LOCK_TIME_LABEL}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <QrCode value={eip681Uri} />
          <p className="text-muted-foreground text-center text-xs">
            {t("qrCaption")}
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <Button
          size="lg"
          className="w-full rounded-2xl py-4"
          onClick={handleStake}
          disabled={isPending}
        >
          {isPending ? t("stakingButton") : t("stakeButton")}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="w-full rounded-2xl py-4"
          onClick={clear}
          disabled={isPending}
        >
          {t("cancelButton")}
        </Button>
      </div>
    </div>
  );
}
