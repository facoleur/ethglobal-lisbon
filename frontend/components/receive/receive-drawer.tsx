"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { QrCode } from "@/components/receive/qr-code";
import { Button } from "@/components/ui/button";
import { TruncatedAddress } from "@/components/ui/truncated-address";
import { useKernelAccount } from "@/hooks/use-kernel";
import { haptic } from "@/lib/haptics";

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
    haptic("light");
    try {
      await navigator.clipboard.writeText(address);
      toast.success(t("copied"));
    } catch {
      toast.error(tCommon("error"));
    }
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
