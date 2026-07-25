"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LockTimePicker } from "@/components/settings/lock-time-picker";

const RECOMMENDED_LOCK_VALUE = "0.1";
const RECOMMENDED_LOCK_TIME_VALUE = 7;
const RECOMMENDED_LOCK_TIME_UNIT = "days";

type TarDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TarDrawer({ open, onOpenChange }: TarDrawerProps) {
  const t = useTranslations("App.Settings.TarDrawer");
  const [lockValue, setLockValue] = useState("");
  const [lockTimeValue, setLockTimeValue] = useState(
    RECOMMENDED_LOCK_TIME_VALUE,
  );
  const [lockTimeUnit, setLockTimeUnit] = useState(RECOMMENDED_LOCK_TIME_UNIT);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 flex flex-col rounded-t-2xl">
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-zinc-300" />
          <div className="mx-auto w-full max-w-sm px-6 pt-4 pb-10 flex flex-col gap-6">
            <Drawer.Title className="text-lg font-semibold">
              {t("title")}
            </Drawer.Title>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground">
                  {t("lockValue")}
                </label>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setLockValue(RECOMMENDED_LOCK_VALUE)}
                >
                  {t("lockValueRecommended")}
                </Button>
              </div>
              <Input
                variant="filled"
                placeholder={t("lockValuePlaceholder")}
                value={lockValue}
                onChange={(e) => setLockValue(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground">
                  {t("lockTime")}
                </label>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => {
                    setLockTimeValue(RECOMMENDED_LOCK_TIME_VALUE);
                    setLockTimeUnit(RECOMMENDED_LOCK_TIME_UNIT);
                  }}
                >
                  {t("lockTimeRecommended")}
                </Button>
              </div>
              <LockTimePicker
                value={lockTimeValue}
                unit={lockTimeUnit}
                onValueChange={setLockTimeValue}
                onUnitChange={setLockTimeUnit}
              />
            </div>

            <Button size="lg" className="w-full rounded-xl">
              {t("saveButton")}
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
