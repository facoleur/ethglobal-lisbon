"use client";

import { useEffect, useState } from "react";
import { QrCode } from "@/components/receive/qr-code";

type AnimatedQrCodeProps = {
  frames: string[];
  interval?: number;
  size?: number;
};

export function AnimatedQrCode({
  frames,
  interval = 450,
  size = 220,
}: AnimatedQrCodeProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const activeFrameIndex = frames.length > 0 ? frameIndex % frames.length : 0;

  useEffect(() => {
    if (frames.length <= 1) return;

    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [frames.length, interval]);

  if (frames.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <QrCode value={frames[activeFrameIndex]} size={size} />
      <span className="text-xs font-medium text-black/60 tabular-nums">
        {activeFrameIndex + 1}/{frames.length}
      </span>
    </div>
  );
}
