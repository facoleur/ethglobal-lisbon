"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useRecoveryCenterStore } from "@/lib/store/recovery-center";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import {
  simulateStopWatchingWallet,
  type WatchedWallet,
} from "@/lib/watch-towers";

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
  const [isRemoving, setIsRemoving] = useState(false);
  const removeWatchedWallet = useWatchTowerStore(
    (state) => state.removeWatchedWallet,
  );
  const removeAttemptsForTarget = useRecoveryCenterStore(
    (state) => state.removeAttemptsForTarget,
  );

  if (!wallet) return null;
  const currentWallet = wallet;

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await simulateStopWatchingWallet();
      removeWatchedWallet(currentWallet.id);
      removeAttemptsForTarget(currentWallet.address);
      toast.success(t("success"));
      onClose();
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <BottomSheet
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isRemoving) onClose();
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
          disabled={isRemoving}
        >
          {isRemoving ? t("removingButton") : t("confirmButton")}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full"
          onClick={onClose}
          disabled={isRemoving}
        >
          {tCommon("cancel")}
        </Button>
      </div>
    </BottomSheet>
  );
}
