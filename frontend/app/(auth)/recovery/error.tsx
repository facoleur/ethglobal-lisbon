"use client";

import { useTranslations } from "next-intl";

export default function RecoveryError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("Common");

  return (
    <div className="flex flex-col gap-4">
      {/* error message */}
      <p className="text-destructive text-sm">{t("error")}</p>
      {/* retry action */}
      <button onClick={reset} className="text-sm underline">
        {t("tryAgain")}
      </button>
    </div>
  );
}
