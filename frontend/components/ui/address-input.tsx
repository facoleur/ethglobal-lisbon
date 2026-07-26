"use client";

import * as React from "react";
import { ScanLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AddressInputProps = React.ComponentProps<"input"> & {
  onScanClick?: () => void;
  scanAriaLabel?: string;
};

function AddressInput({
  className,
  onScanClick,
  scanAriaLabel = "Scan QR code",
  ...props
}: AddressInputProps) {
  return (
    <div className="relative">
      <Input
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className={cn("pr-12", className)}
        {...props}
      />
      {onScanClick && (
        <button
          type="button"
          onClick={onScanClick}
          aria-label={scanAriaLabel}
          className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2"
        >
          <ScanLine className="size-5" />
        </button>
      )}
    </div>
  );
}

export { AddressInput };
