"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { useTranslations } from "next-intl";
import { getAddress, isAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTarRecoveryPreflight } from "@/hooks/use-tar-recovery";
import { BROADCASTER_GAS_BUFFER } from "@/lib/recovery";
import { useRecoveryStore } from "@/lib/store/recovery";

type RecoveryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RecoveryDrawer({ open, onOpenChange }: RecoveryDrawerProps) {
  const t = useTranslations("Auth.Recovery");
  const router = useRouter();
  const beginFunding = useRecoveryStore((state) => state.beginFunding);
  const resumeRecovery = useRecoveryStore((state) => state.resumeRecovery);
  const [address, setAddress] = useState("");

  const touched = address.length > 0;
  const valid = isAddress(address);
  const targetAccount = valid ? getAddress(address) : undefined;
  const preflight = useTarRecoveryPreflight(targetAccount);

  function handleContinue() {
    if (!targetAccount || !preflight.canContinue || !preflight.lockTime) return;

    if (
      preflight.status === "active" &&
      preflight.lockValue !== null &&
      preflight.revealTimestamp
    ) {
      resumeRecovery({
        targetAccount,
        lockValue: preflight.lockValue,
        revealTimestamp: preflight.revealTimestamp,
        lockTime: preflight.lockTime,
      });
    } else {
      if (preflight.lockValue === null) return;
      const broadcasterPrivateKey = generatePrivateKey();
      const broadcasterAddress = privateKeyToAccount(
        broadcasterPrivateKey,
      ).address;
      beginFunding({
        targetAccount,
        lockValue: preflight.lockValue,
        lockTime: preflight.lockTime,
        broadcasterAddress,
        broadcasterPrivateKey,
        requiredFunding: preflight.lockValue + BROADCASTER_GAS_BUFFER,
      });
    }

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
              {valid && preflight.status === "checking" && (
                <p className="text-muted-foreground text-xs">
                  {t("checkingAccount")}
                </p>
              )}
              {valid &&
                preflight.status !== "idle" &&
                preflight.status !== "checking" &&
                preflight.status !== "ready" &&
                preflight.status !== "active" && (
                  <p className="text-destructive text-xs">
                    {t(`preflight.${preflight.status}`)}
                  </p>
                )}
            </div>

            <Button
              size="lg"
              className="w-full rounded-2xl py-4"
              onClick={handleContinue}
              disabled={!valid || !preflight.canContinue}
            >
              {preflight.status === "active"
                ? t("viewRecoveryButton")
                : t("continueButton")}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
