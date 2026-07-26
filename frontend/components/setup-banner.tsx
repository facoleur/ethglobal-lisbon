"use client";

import { TarDrawer } from "@/components/settings/tar-drawer";
import { useWalletStore } from "@/lib/store/wallet";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function SetupBanner() {
  const t = useTranslations("App.SetupBanner");
  const { isSetupComplete, hasHydrated, setSetupComplete } = useWalletStore();
  const [tarOpen, setTarOpen] = useState(false);

  if (!hasHydrated || isSetupComplete) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setTarOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground"
      >
        <Sparkles className="size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t("title")}</p>
          <p className="text-sm opacity-80">{t("subtitle")}</p>
        </div>
      </button>

      <TarDrawer
        open={tarOpen}
        onOpenChange={setTarOpen}
        onSuccess={setSetupComplete}
      />
    </>
  );
}
