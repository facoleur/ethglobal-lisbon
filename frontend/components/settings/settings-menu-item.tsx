import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

type SettingsMenuItemProps = {
  title: string;
  subtitle: string;
  onClick: () => void;
  destructive?: boolean;
};

export function SettingsMenuItem({
  title,
  subtitle,
  onClick,
  destructive = false,
}: SettingsMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between py-4 text-left"
    >
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-base font-medium",
            destructive ? "text-destructive" : "text-foreground",
          )}
        >
          {title}
        </span>
        <span className="text-muted-foreground text-sm">{subtitle}</span>
      </div>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={20}
        className="text-muted-foreground shrink-0"
      />
    </button>
  );
}
