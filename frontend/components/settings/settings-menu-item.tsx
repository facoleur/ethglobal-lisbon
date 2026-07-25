import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

type SettingsMenuItemProps = {
  title: string;
  subtitle: string;
  onClick: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
};

export function SettingsMenuItem({
  title,
  subtitle,
  onClick,
  icon,
  destructive = false,
}: SettingsMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between px-4 py-4 text-left"
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "truncate text-base font-medium",
              destructive ? "text-destructive" : "text-foreground",
            )}
          >
            {title}
          </span>
          <span className="text-muted-foreground truncate text-sm">
            {subtitle}
          </span>
        </div>
      </div>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={20}
        className="text-muted-foreground shrink-0"
      />
    </button>
  );
}
