"use client";

import {
  WheelPicker,
  WheelPickerWrapper,
  type WheelPickerOption,
} from "@/components/wheel-picker";
import { useTranslations } from "next-intl";
import type { LockTimeUnit } from "@/lib/contracts/tar-recovery";

const VALUE_OPTIONS: WheelPickerOption<number>[] = Array.from(
  { length: 30 },
  (_, i) => ({ label: String(i + 1), value: i + 1 }),
);

type LockTimePickerProps = {
  value: number;
  unit: LockTimeUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: LockTimeUnit) => void;
};

export function LockTimePicker({
  value,
  unit,
  onValueChange,
  onUnitChange,
}: LockTimePickerProps) {
  const t = useTranslations("App.Settings.TarDrawer");
  const unitOptions: WheelPickerOption<LockTimeUnit>[] = [
    { label: t("seconds"), value: "seconds" },
    { label: t("minutes"), value: "minutes" },
    { label: t("hours"), value: "hours" },
    { label: t("days"), value: "days" },
    { label: t("weeks"), value: "weeks" },
    { label: t("months"), value: "months" },
  ];

  return (
    <WheelPickerWrapper className="w-full border-transparent bg-black/[0.03]">
      {/* timelock duration */}
      <WheelPicker<number>
        options={VALUE_OPTIONS}
        value={value}
        onValueChange={onValueChange}
        infinite
      />
      {/* timelock unit */}
      <WheelPicker<LockTimeUnit>
        options={unitOptions}
        value={unit}
        onValueChange={onUnitChange}
      />
    </WheelPickerWrapper>
  );
}
