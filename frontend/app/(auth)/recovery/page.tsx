"use client";

import { useTranslations } from "next-intl";

export default function RecoveryPage() {
  const t = useTranslations("Auth.Recovery");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("addressLabel")}</label>
        <input
          type="text"
          placeholder={t("addressPlaceholder")}
          className="border-border rounded-xl border px-4 py-3 text-sm outline-none"
        />
      </div>

      {/* QR code placeholder */}
      <div className="flex flex-col items-center gap-3">
        <div className="border-border bg-muted flex h-48 w-48 items-center justify-center rounded-2xl border">
          <span className="text-muted-foreground text-xs">
            {t("qrPlaceholder")}
          </span>
        </div>
        <p className="text-muted-foreground text-center text-xs">
          {t("qrCaption")}
        </p>
      </div>

      <div className="border-border rounded-2xl border p-4">
        <p className="mb-2 text-sm font-medium">{t("instructionsTitle")}</p>
        <ol className="text-muted-foreground flex flex-col gap-1.5 text-sm">
          <li>1. {t("step1")}</li>
          <li>2. {t("step2")}</li>
          <li>3. {t("step3")}</li>
        </ol>
      </div>
    </div>
  );
}
