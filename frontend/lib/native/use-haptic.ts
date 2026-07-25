type HapticStyle = "light" | "medium" | "heavy";
type NotificationType = "success" | "warning" | "error";

const impactPatterns: Record<HapticStyle, number[]> = {
  light: [10],
  medium: [20],
  heavy: [30],
};

const notificationPatterns: Record<NotificationType, number[]> = {
  success: [10, 50, 10],
  warning: [30, 50, 10],
  error: [50, 30, 50],
};

export function useHaptic() {
  const canVibrate =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  const impact = (style: HapticStyle = "medium") => {
    if (!canVibrate) return;
    navigator.vibrate(impactPatterns[style]);
  };

  const notification = (type: NotificationType = "success") => {
    if (!canVibrate) return;
    navigator.vibrate(notificationPatterns[type]);
  };

  const selection = () => {
    if (!canVibrate) return;
    navigator.vibrate([5]);
  };

  return { impact, notification, selection };
}
