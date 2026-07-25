import type { LucideIcon } from "lucide-react";

type ActionButtonProps = {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
};

export function ActionButton({
  icon: Icon,
  label,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 flex-col items-start gap-3 rounded-2xl squircle bg-white p-4"
    >
      <Icon className="size-6 text-muted-foreground" />
      <span className="text-lg font-medium text-foreground">{label}</span>
    </button>
  );
}
