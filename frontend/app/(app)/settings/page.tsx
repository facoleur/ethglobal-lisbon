"use client";

import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("App.Settings");

  return (
    <div className="flex flex-col gap-6">
      {/* header */}
      <h1 className="text-xl font-semibold">{t("title")}</h1>
    </div>
  );
}
