"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { useTranslations } from "next-intl";
import { isAddress } from "viem";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRecoveryStore } from "@/lib/store/recovery";

type RecoveryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RecoveryDrawer({ open, onOpenChange }: RecoveryDrawerProps) {
  const t = useTranslations("Auth.Recovery");
  const router = useRouter();
  const { setTargetAccount, setStatus } = useRecoveryStore();
  const [address, setAddress] = useState("");

  const touched = address.length > 0;
  const valid = isAddress(address);

  function handleContinue() {
    if (!valid) return;
    setTargetAccount(address);
    setStatus("staking");
    onOpenChange(false);
    router.push("/recovery");
  }

  function handleOpenChange(next: boolean) {
    if (!next) setAddress("");
    onOpenChange(next);
  }

  return (
    <Drawer.Root open={open} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 flex flex-col rounded-t-2xl">
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-zinc-300" />
          <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 pt-4 pb-10">
            <Drawer.Title className="text-lg font-semibold">
              {t("step1Title")}
            </Drawer.Title>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">{t("addressLabel")}</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("addressPlaceholder")}
                aria-invalid={touched && !valid}
              />
            </div>

            <Button
              size="lg"
              className="w-full rounded-2xl py-4"
              onClick={handleContinue}
              disabled={!valid}
            >
              {t("continueButton")}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
