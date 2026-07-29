import { RecoveryAttemptCard } from "@/components/recovery-center/recovery-attempt-card";
import { formatCountdown } from "@/lib/recovery";
import {
  getAttemptTimeLeft,
  type RecoveryAttempt,
} from "@/lib/recovery-center";

type AttemptGroupProps = {
  title?: string;
  attempts: RecoveryAttempt[];
  now: number;
  expiredLabel: string;
  onSelect: (attempt: RecoveryAttempt) => void;
};

export function AttemptGroup({
  title,
  attempts,
  now,
  expiredLabel,
  onSelect,
}: AttemptGroupProps) {
  if (attempts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {title && (
        <h3 className="text-muted-foreground px-1 text-xs font-semibold tracking-wide uppercase">
          {title}
        </h3>
      )}
      {attempts.map((attempt) => {
        const timeLeft = getAttemptTimeLeft(attempt, now);
        return (
          <RecoveryAttemptCard
            key={attempt.id}
            attempt={attempt}
            timeRemaining={
              timeLeft === 0 ? expiredLabel : formatCountdown(timeLeft)
            }
            onClick={() => onSelect(attempt)}
          />
        );
      })}
    </div>
  );
}
