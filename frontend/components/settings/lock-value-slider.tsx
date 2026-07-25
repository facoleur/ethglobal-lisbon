"use client";

import { useCallback, useRef } from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { haptic } from "@/lib/haptics";

const MIN = 0.001;
const MAX = 0.1;
const STEP = 0.001;
const TICK_COUNT = Math.round((MAX - MIN) / STEP) + 1;

type LockValueSliderProps = {
  value: number;
  onChange: (value: number) => void;
};

export function LockValueSlider({ value, onChange }: LockValueSliderProps) {
  const prevValue = useRef(value);

  const handleValueChange = useCallback(
    (newValue: number) => {
      if (newValue !== prevValue.current) {
        prevValue.current = newValue;
        haptic("light");
        onChange(newValue);
      }
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* selected protected balance */}
      <p className="text-2xl font-semibold tabular-nums">
        {value.toFixed(3)}{" "}
        <span className="text-base font-medium text-muted-foreground">ETH</span>
      </p>
      <SliderPrimitive.Root
        min={MIN}
        max={MAX}
        step={STEP}
        value={value}
        onValueChange={handleValueChange}
        thumbAlignment="edge"
        className="w-full"
      >
        <SliderPrimitive.Control className="relative flex h-12 w-full touch-none select-none items-center">
          <SliderPrimitive.Track className="relative h-full w-full overflow-hidden rounded-2xl bg-black/[0.03]">
            <SliderPrimitive.Indicator className="h-full bg-primary/10" />
            {Array.from({ length: TICK_COUNT }, (_, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-black/[0.08]"
                style={{ left: `${(i / (TICK_COUNT - 1)) * 100}%` }}
              />
            ))}
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block h-[44px] w-7 shrink-0 rounded-xl bg-white shadow-md focus-visible:outline-none" />
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
    </div>
  );
}
