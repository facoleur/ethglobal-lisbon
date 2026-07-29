"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChessRook } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecoveryCenterStore } from "@/lib/store/recovery-center";

type NavItemProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
};

function NavItem({ href, icon, label, active, badge = 0 }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 px-8 py-3 text-xs",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span className="relative">
        {icon}
        {badge > 0 && (
          <span className="bg-destructive absolute -top-2 -right-3 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {label}
      <span
        className={cn(
          "h-0.5 w-4 rounded-full bg-primary transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("Navigation");
  const { attempts, hasHydrated } = useRecoveryCenterStore();

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center px-6 pb-[max(env(safe-area-inset-bottom),36px)] z-40 pointer-events-none">
      <nav className="pointer-events-auto flex rounded-full backdrop-blur-xl bg-white/70">
        <NavItem
          href="/"
          icon={
            <HugeiconsIcon
              icon={Wallet01Icon}
              strokeWidth={2}
              className="size-5"
            />
          }
          label={t("wallet")}
          active={pathname === "/"}
        />
        <NavItem
          href="/recovery"
          icon={<ChessRook className="size-5" strokeWidth={2} />}
          label={t("recovery")}
          active={pathname === "/recovery"}
          badge={hasHydrated ? attempts.length : 0}
        />
      </nav>
    </div>
  );
}
