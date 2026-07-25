import { AlertTriangle, ChevronRight } from "lucide-react";
import { AccountAvatar } from "@/components/ui/account-avatar";
import { truncateAddress } from "@/lib/recovery";
import type { RecoveryAttempt } from "@/lib/recovery-center";

type RecoveryAttemptCardProps = {
  attempt: RecoveryAttempt;
  timeRemaining: string;
  onClick: () => void;
};

export function RecoveryAttemptCard({
  attempt,
  timeRemaining,
  onClick,
}: RecoveryAttemptCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left"
    >
      <div className="relative shrink-0">
        <AccountAvatar address={attempt.targetAddress} size={42} />
        <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-destructive text-white">
          <AlertTriangle className="size-3" />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium">{attempt.targetLabel}</p>
        <p className="text-muted-foreground truncate text-sm">
          {truncateAddress(attempt.targetAddress)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="text-destructive text-sm font-medium tabular-nums">
          {timeRemaining}
        </span>
        <ChevronRight className="text-muted-foreground size-5" />
      </div>
    </button>
  );
}
