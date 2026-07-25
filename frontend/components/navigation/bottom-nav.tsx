"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("Navigation");

  return (
    <nav className="border-border flex shrink-0 border-t pb-[env(safe-area-inset-bottom)]">
      <Link
        href="/"
        className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs ${pathname === "/" ? "text-foreground" : "text-muted-foreground"}`}
      >
        <HugeiconsIcon icon={Home01Icon} strokeWidth={2} className="size-5" />
        {t("home")}
      </Link>
      <Link
        href="/settings"
        className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs ${pathname === "/settings" ? "text-foreground" : "text-muted-foreground"}`}
      >
        <HugeiconsIcon
          icon={Settings01Icon}
          strokeWidth={2}
          className="size-5"
        />
        {t("settings")}
      </Link>
    </nav>
  );
}
