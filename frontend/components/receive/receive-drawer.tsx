"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useKernelAccount } from "@/hooks/use-kernel";
import { QrCode } from "@/components/receive/qr-code";

type ReceiveDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReceiveDrawer({ open, onOpenChange }: ReceiveDrawerProps) {
  const t = useTranslations("App.ReceiveDrawer");
  const tCommon = useTranslations("Common");
  const { address } = useKernelAccount();

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    toast.success(t("copied"));
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("title")}>
      {address ? (
        <div className="flex flex-col items-center gap-4">
          <div className="bg-white p-3 rounded-xl">
            <QrCode value={address} size={200} />
          </div>
          <p className="font-mono text-xs text-center break-all text-muted-foreground">
            {address}
          </p>
          <Button size="lg" className="w-full rounded-xl" onClick={handleCopy}>
            {t("copyButton")}
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
