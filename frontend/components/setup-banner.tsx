"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

type SetupBannerProps = {
  onAction: () => void;
  visible: boolean;
};

export function SetupBanner({ onAction, visible }: SetupBannerProps) {
  const t = useTranslations("App.SetupBanner");

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onAction}
      className="flex w-full flex-row gap-3 rounded-2xl border border-border bg-card p-4 text-left"
    >
      <div className="flex  items-start justify-between gap-2">
        <AlertTriangle className="size-5 shrink-0 text-yellow-500" />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-foreground">{t("title")}</p>
          <span className="shrink-0 rounded-sm bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {t("badge")}
          </span>
        </div>
        <p className="text-muted-foreground mt-0.5 text-sm">{t("subtitle")}</p>
      </div>
    </button>
  );
}
