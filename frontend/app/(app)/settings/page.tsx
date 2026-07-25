"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SettingsMenuItem } from "@/components/settings/settings-menu-item";
import { TarDrawer } from "@/components/settings/tar-drawer";
import { RemoveAccountDrawer } from "@/components/settings/remove-account-drawer";

export default function SettingsPage() {
  const t = useTranslations("App.Settings");
  const [tarOpen, setTarOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col px-4 py-8 gap-6">
        <h1 className="text-xl font-semibold px-1">{t("title")}</h1>

        <div className="overflow-hidden rounded-2xl bg-white divide-y divide-border">
          <SettingsMenuItem
            title={t("tarSettings")}
            subtitle={t("tarSettingsSubtitle")}
            onClick={() => setTarOpen(true)}
          />

          <SettingsMenuItem
            title={t("removeAccount")}
            subtitle={t("removeAccountSubtitle")}
            onClick={() => setRemoveOpen(true)}
            destructive
          />
        </div>
      </div>

      <TarDrawer open={tarOpen} onOpenChange={setTarOpen} />
      <RemoveAccountDrawer open={removeOpen} onOpenChange={setRemoveOpen} />
    </>
  );
}
