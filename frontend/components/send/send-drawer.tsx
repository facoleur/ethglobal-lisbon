"use client";

import { Drawer } from "vaul";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SendDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SendDrawer({ open, onOpenChange }: SendDrawerProps) {
  const t = useTranslations("App.SendDrawer");

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 flex flex-col rounded-t-2xl">
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-zinc-300" />
          <div className="mx-auto w-full max-w-sm px-6 pt-4 pb-10">
            <Drawer.Title className="mb-6 text-lg font-semibold">
              {t("title")}
            </Drawer.Title>
            <div className="flex flex-col gap-4">
              <Input type="text" placeholder={t("recipientPlaceholder")} />
              <Input type="number" placeholder={t("amountPlaceholder")} />
              <Button size="lg" className="w-full rounded-xl">
                {t("confirmButton")}
              </Button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
