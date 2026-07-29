"use client";

import { useTranslations } from "next-intl";

type ErrorPageProps = { reset: () => void };

export function ErrorPage({ reset }: ErrorPageProps) {
  const t = useTranslations("Common");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <p className="text-destructive text-sm">{t("error")}</p>
      <button onClick={reset} className="text-sm underline">
        {t("tryAgain")}
      </button>
    </div>
  );
}
