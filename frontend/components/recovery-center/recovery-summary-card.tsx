import { AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react";

type RecoverySummaryCardProps = {
  attemptCount: number;
  watchTowerCount: number;
  alertTitle: string;
  alertSubtitle: string;
  protectedTitle: string;
  protectedSubtitle: string;
  onClick: () => void;
};

export function RecoverySummaryCard({
  attemptCount,
  watchTowerCount,
  alertTitle,
  alertSubtitle,
  protectedTitle,
  protectedSubtitle,
  onClick,
}: RecoverySummaryCardProps) {
  const hasAttempts = attemptCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        hasAttempts
          ? "bg-destructive/10 flex w-full items-center gap-3 rounded-2xl p-4 text-left"
          : "flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left"
      }
    >
      {hasAttempts ? (
        <AlertTriangle className="text-destructive size-6 shrink-0" />
      ) : (
        <ShieldCheck className="size-6 shrink-0" />
      )}
      <div
        className={
          hasAttempts ? "text-destructive min-w-0 flex-1" : "min-w-0 flex-1"
        }
      >
        <p className="font-medium">
          {hasAttempts ? alertTitle : protectedTitle}
        </p>
        <p className="text-muted-foreground text-sm">
          {hasAttempts ? alertSubtitle : protectedSubtitle}
        </p>
      </div>
      {hasAttempts && (
        <span className="bg-destructive flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs leading-6 font-semibold text-white">
          {attemptCount}
        </span>
      )}
      {!hasAttempts && watchTowerCount > 0 && (
        <span className="text-muted-foreground text-sm font-medium">
          {watchTowerCount}
        </span>
      )}
      <ChevronRight className="text-muted-foreground size-5 shrink-0" />
    </button>
  );
}
