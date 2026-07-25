import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("Common");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <p className="text-muted-foreground text-sm">{t("notFound")}</p>
      <Link href="/" className="text-sm underline">
        {t("goHome")}
      </Link>
    </div>
  );
}
