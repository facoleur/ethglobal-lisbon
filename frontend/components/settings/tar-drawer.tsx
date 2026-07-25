"use client";

import { LockTimePicker } from "@/components/settings/lock-time-picker";
import { LockValueSlider } from "@/components/settings/lock-value-slider";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useUpdateRecoveryParams } from "@/hooks/use-tar-recovery";
import type { LockTimeUnit } from "@/lib/contracts/tar-recovery";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const RECOMMENDED_LOCK_VALUE = 0.1;
const RECOMMENDED_LOCK_TIME_VALUE = 7;
const RECOMMENDED_LOCK_TIME_UNIT: LockTimeUnit = "days";

type TarDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TarDrawer({ open, onOpenChange }: TarDrawerProps) {
  const t = useTranslations("App.Recovery.TarDrawer");
  const tCommon = useTranslations("Common");
  const { updateRecoveryParams, isConfigured, isPending } =
    useUpdateRecoveryParams();
  const [lockValue, setLockValue] = useState(RECOMMENDED_LOCK_VALUE);
  const [lockTimeValue, setLockTimeValue] = useState(
    RECOMMENDED_LOCK_TIME_VALUE,
  );
  const [lockTimeUnit, setLockTimeUnit] = useState(RECOMMENDED_LOCK_TIME_UNIT);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isPending) return;
    onOpenChange(nextOpen);
  };

  const handleSave = async () => {
    try {
      await updateRecoveryParams(lockValue, lockTimeValue, lockTimeUnit);
      toast.success(t("saveSuccess"));
      onOpenChange(false);
    } catch {
      toast.error(tCommon("error"));
    }
  };

  const recommendedButton = (
    <Button
      variant="secondary"
      size="xs"
      disabled={isPending}
      onClick={() => {
        setLockValue(RECOMMENDED_LOCK_VALUE);
        setLockTimeValue(RECOMMENDED_LOCK_TIME_VALUE);
        setLockTimeUnit(RECOMMENDED_LOCK_TIME_UNIT);
      }}
    >
      {t("useRecommended")}
    </Button>
  );

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={t("title")}
      titleAction={recommendedButton}
    >
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          {t("lockValue")}
        </label>
        <LockValueSlider value={lockValue} onChange={setLockValue} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          {t("lockTime")}
        </label>
        <LockTimePicker
          value={lockTimeValue}
          unit={lockTimeUnit}
          onValueChange={setLockTimeValue}
          onUnitChange={setLockTimeUnit}
        />
      </div>

      {!isConfigured && (
        <p className="text-muted-foreground text-sm">{t("notConfigured")}</p>
      )}
      <Button
        size="lg"
        className="w-full"
        disabled={!isConfigured || isPending}
        onClick={handleSave}
      >
        {isPending ? t("savingButton") : t("saveButton")}
      </Button>
    </BottomSheet>
  );
}
