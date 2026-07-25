"use client";

import { Drawer } from "vaul";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useKernelAccount } from "@/hooks/use-kernel";
import { QrCode } from "@/components/receive/qr-code";
import { toast } from "sonner";

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
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        {/* drawer backdrop and content */}
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 flex flex-col rounded-t-2xl">
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-zinc-300" />
          <div className="mx-auto w-full max-w-sm px-6 pt-4 pb-10">
            <Drawer.Title className="mb-6 text-lg font-semibold">
              {t("title")}
            </Drawer.Title>

            {address ? (
              <div className="flex flex-col items-center gap-4">
                {/* receive QR code */}
                <div className="bg-white p-3 rounded-xl">
                  <QrCode value={address} size={200} />
                </div>

                {/* wallet address */}
                <p className="font-mono text-xs text-center break-all text-muted-foreground">
                  {address}
                </p>

                {/* address copy action */}
                <Button
                  size="lg"
                  className="w-full rounded-xl"
                  onClick={handleCopy}
                >
                  {t("copyButton")}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center">
                {tCommon("loading")}
              </p>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
