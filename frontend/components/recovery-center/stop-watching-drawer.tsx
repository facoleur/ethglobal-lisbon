"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useRecoveryCenterStore } from "@/lib/store/recovery-center";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import type { WatchedWallet } from "@/lib/watch-towers";

type StopWatchingDrawerProps = {
  wallet: WatchedWallet | null;
  onClose: () => void;
};

export function StopWatchingDrawer({
  wallet,
  onClose,
}: StopWatchingDrawerProps) {
  const t = useTranslations("App.Recovery.StopWatchingDrawer");
  const tCommon = useTranslations("Common");
  const removeWatchedWallet = useWatchTowerStore(
    (state) => state.removeWatchedWallet,
  );
  const removeAttemptsForTarget = useRecoveryCenterStore(
    (state) => state.removeAttemptsForTarget,
  );

  if (!wallet) return null;
  const currentWallet = wallet;

  function handleRemove() {
    removeWatchedWallet(currentWallet.id);
    removeAttemptsForTarget(currentWallet.address);
    toast.success(t("success"));
    onClose();
  }

  return (
    <BottomSheet
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={t("title")}
    >
      <p className="text-muted-foreground text-sm">
        {t("subtitle", { wallet: currentWallet.label })}
      </p>
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          variant="destructive"
          className="w-full"
          onClick={handleRemove}
        >
          {t("confirmButton")}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full"
          onClick={onClose}
        >
          {tCommon("cancel")}
        </Button>
      </div>
    </BottomSheet>
  );
}
