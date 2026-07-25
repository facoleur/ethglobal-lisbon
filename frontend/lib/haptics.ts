type HapticStyle = "light" | "medium" | "heavy";

const VIBRATION_DURATION: Record<HapticStyle, number> = {
  light: 1,
  medium: 5,
  heavy: 10,
};

// Singleton hidden checkbox — iOS 17.4–26.4 Taptic Engine trick via <input switch>
let iosTriggerEl: HTMLInputElement | null = null;

function getIosTriggerEl(): HTMLInputElement | null {
  if (typeof document === "undefined") return null;
  if (!iosTriggerEl) {
    const el = document.createElement("input");
    el.type = "checkbox";
    el.setAttribute("switch", "");
    Object.assign(el.style, {
      position: "fixed",
      top: "-9999px",
      left: "-9999px",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(el);
    iosTriggerEl = el;
  }
  return iosTriggerEl;
}

export function haptic(style: HapticStyle = "light") {
  // Android Chrome — Web Vibration API
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(VIBRATION_DURATION[style]);
    return;
  }

  // iOS Safari 17.4–26.4 — checkbox switch Taptic Engine trick
  getIosTriggerEl()?.click();
}
