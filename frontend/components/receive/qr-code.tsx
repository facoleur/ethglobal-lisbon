"use client";

import { useEffect, useState } from "react";
import { generateStyledQRCodeSvg } from "@/lib/qr";

type QrCodeProps = {
  value: string;
  size?: number;
};

export function QrCode({ value, size = 200 }: QrCodeProps) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
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
      if (!cancelled) setSvg(s);
    });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!svg) return null;

  return (
    <div
      className="flex items-center justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}