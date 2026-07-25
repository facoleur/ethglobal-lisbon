"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Separator } from "@/components/ui/separator";
import { TarDrawer } from "@/components/settings/tar-drawer";
import { RemoveAccountDrawer } from "@/components/settings/remove-account-drawer";

export default function SettingsPage() {
  const t = useTranslations("App.Settings");
  const [tarOpen, setTarOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  return (
    <>
      {/* settings options */}
      <div className="flex flex-col px-6 py-8">
        <h1 className="text-xl font-semibold mb-6">{t("title")}</h1>

        <div className="flex flex-col">
          {/* TAR configuration */}
          <button
            onClick={() => setTarOpen(true)}
            className="flex items-center justify-between py-4 text-left"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-medium text-foreground">
                {t("tarSettings")}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("tarSettingsSubtitle")}
              </span>
            </div>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={20}
              className="text-muted-foreground shrink-0"
            />
          </button>

          <Separator />

          {/* account removal */}
          <button
            onClick={() => setRemoveOpen(true)}
            className="flex items-center justify-between py-4 text-left"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-medium text-destructive">
                {t("removeAccount")}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("removeAccountSubtitle")}
              </span>
            </div>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={20}
              className="text-muted-foreground shrink-0"
            />
          </button>
        </div>
      </div>

      {/* settings drawers */}
      <TarDrawer open={tarOpen} onOpenChange={setTarOpen} />
      <RemoveAccountDrawer open={removeOpen} onOpenChange={setRemoveOpen} />
    </>
  );
}
