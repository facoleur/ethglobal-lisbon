"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home01Icon, Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  icon: typeof Home01Icon;
  label: string;
  active: boolean;
};

function NavItem({ href, icon, label, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 py-3 text-xs",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5" />
      {label}
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("Navigation");

  return (
    <nav className="border-border flex shrink-0 border-t pb-[env(safe-area-inset-bottom)]">
      <NavItem
        href="/"
        icon={Home01Icon}
        label={t("home")}
        active={pathname === "/"}
      />
      <NavItem
        href="/settings"
        icon={Settings01Icon}
        label={t("settings")}
        active={pathname === "/settings"}
      />
    </nav>
  );
}
