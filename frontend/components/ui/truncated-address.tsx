"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { truncateMiddle } from "@/lib/format";

type TruncatedAddressProps = {
  address: string;
  className?: string;
};

export function TruncatedAddress({
  address,
  className,
}: TruncatedAddressProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayed, setDisplayed] = useState(address);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const width = el.offsetWidth;
      const font = window.getComputedStyle(el).font;
      setDisplayed(truncateMiddle(address, width, font));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [address]);

  return (
    <div ref={ref} className={className}>
      {displayed}
    </div>
  );
}
