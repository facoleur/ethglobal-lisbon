"use client";

import { useCallback, useRef } from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { haptic } from "@/lib/haptics";

const MIN = 0;
const MAX = 10;
const STEP = 0.01;

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
        {value.toFixed(2)}{" "}
        <span className="text-base font-medium text-muted-foreground">ETH</span>
      </p>
      {/* protected balance range */}
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
          <SliderPrimitive.Track className="relative h-full w-full overflow-hidden rounded-2xl bg-muted">
            <SliderPrimitive.Indicator className="h-full bg-primary/10" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block h-[44px] w-7 shrink-0 rounded-xl bg-white shadow-md focus-visible:outline-none" />
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
    </div>
  );
}
