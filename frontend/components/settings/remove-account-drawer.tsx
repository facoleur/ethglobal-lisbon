"use client";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useDisconnectKernel } from "@/hooks/use-kernel";
import { useRecoveryCenterStore } from "@/lib/store/recovery-center";
import { useRecoveryStore } from "@/lib/store/recovery";
import { useWalletStore } from "@/lib/store/wallet";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type RemoveAccountDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RemoveAccountDrawer({
  open,
  onOpenChange,
}: RemoveAccountDrawerProps) {
  const t = useTranslations("App.Recovery.RemoveAccountDrawer");
  const router = useRouter();
  const disconnectKernel = useDisconnectKernel();
  const clearWallet = useWalletStore((state) => state.clear);
  const clearRecovery = useRecoveryStore((state) => state.clear);
  const clearRecoveryCenter = useRecoveryCenterStore((state) => state.clear);
  const clearWatchTowers = useWatchTowerStore((state) => state.clear);

  const handleRemove = () => {
    disconnectKernel();
    clearRecovery();
    clearRecoveryCenter();
    clearWatchTowers();
    clearWallet();
    router.replace("/login");
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("title")}>
      <p className="text-sm text-muted-foreground">{t("warning")}</p>

      <div className="flex flex-col gap-1">
        <Button
          variant="destructive"
          size="lg"
          className="w-full rounded-xl"
          onClick={handleRemove}
        >
          {t("confirmButton")}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-xl"
          onClick={() => onOpenChange(false)}
        >
          {t("cancelButton")}
        </Button>
      </div>
    </BottomSheet>
  );
}
