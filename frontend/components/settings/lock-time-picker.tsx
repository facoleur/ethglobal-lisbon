"use client";

import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
} from "@/components/wheel-picker";

const VALUE_OPTIONS: WheelPickerOption<number>[] = Array.from(
  { length: 30 },
  (_, i) => ({ label: String(i + 1), value: i + 1 }),
);

const UNIT_OPTIONS: WheelPickerOption<string>[] = [
  { label: "Days", value: "days" },
  { label: "Weeks", value: "weeks" },
  { label: "Months", value: "months" },
];

type LockTimePickerProps = {
  value: number;
  unit: string;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: string) => void;
};

export function LockTimePicker({
  value,
  unit,
  onValueChange,
  onUnitChange,
}: LockTimePickerProps) {
  return (
    <WheelPickerWrapper className="w-full border-transparent bg-muted">
      {/* timelock duration */}
      <WheelPicker<number>
        options={VALUE_OPTIONS}
        value={value}
        onValueChange={onValueChange}
        infinite
      />
      {/* timelock unit */}
      <WheelPicker<string>
        options={UNIT_OPTIONS}
        value={unit}
        onValueChange={onUnitChange}
      />
    </WheelPickerWrapper>
  );
}
