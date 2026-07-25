"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { QrCode } from "@/components/receive/qr-code";
import { Button } from "@/components/ui/button";
import { TruncatedAddress } from "@/components/ui/truncated-address";
import { useKernelAccount } from "@/hooks/use-kernel";

type ReceiveDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReceiveDrawer({ open, onOpenChange }: ReceiveDrawerProps) {
  const t = useTranslations("App.ReceiveDrawer");
  const tCommon = useTranslations("Common");
  const { address } = useKernelAccount();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address || copied) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("title")}>
      {address ? (
        <div className="flex flex-col items-center gap-4">
          <div className="bg-white p-3 rounded-xl">
            <QrCode value={address} size={200} />
          </div>

          <TruncatedAddress
            address={address}
            className="w-full text-sm font-medium text-center"
          />

          <Button size="lg" className="w-full rounded-2xl" onClick={handleCopy}>
            {copied ? t("copiedButton") : t("copyButton")}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm text-center">
          {tCommon("loading")}
        </p>
      )}
    </BottomSheet>
  );
}
