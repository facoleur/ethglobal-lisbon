"use client";

import { useEffect, useRef } from "react";
import { generateStyledQRCodeSvg } from "@/lib/qr";

type QrCodeProps = {
  value: string;
  size?: number;
};

export function QrCode({ value, size = 200 }: QrCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    generateStyledQRCodeSvg(value, {
      size,
      color: "#000000",
      backgroundColor: "#FFFFFF",
      outerEyeColor: "#000000",
      innerEyeColor: "#000000",
      outerEyeBorderRadius: 8,
      innerEyeBorderRadius: 3,
    }).then((s) => {
      if (!cancelled) el.innerHTML = s;
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return <div ref={containerRef} className="flex items-center justify-center" />;
}