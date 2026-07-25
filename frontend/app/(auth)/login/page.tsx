"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const t = useTranslations("Auth.Login");

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-4 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <Button size="lg" className="w-full rounded-2xl py-4">
        {t("createWallet")}
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="w-full rounded-2xl py-4"
        render={<Link href="/recovery" />}
      >
        {t("recoverWallet")}
      </Button>
    </div>
  );
}
