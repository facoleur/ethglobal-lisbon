"use client";

import { Drawer } from "vaul";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useDisconnectKernel } from "@/hooks/use-kernel";
import { useWalletStore } from "@/lib/store/wallet";

type RemoveAccountDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RemoveAccountDrawer({
  open,
  onOpenChange,
}: RemoveAccountDrawerProps) {
  const t = useTranslations("App.Settings.RemoveAccountDrawer");
  const router = useRouter();
  const disconnectKernel = useDisconnectKernel();
  const clearWallet = useWalletStore((state) => state.clear);

  const handleRemove = () => {
    disconnectKernel();
    clearWallet();
    router.replace("/login");
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        {/* account removal drawer */}
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 flex flex-col rounded-t-2xl">
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-zinc-300" />
          <div className="mx-auto w-full max-w-sm px-6 pt-4 pb-10 flex flex-col gap-6">
            <Drawer.Title className="text-lg font-semibold">
              {t("title")}
            </Drawer.Title>

            {/* irreversible action warning */}
            <p className="text-sm text-muted-foreground">{t("warning")}</p>

            {/* confirmation actions */}
            <div className="flex flex-col gap-3">
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
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
