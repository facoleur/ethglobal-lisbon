"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";

type RemoveAccountDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RemoveAccountDrawer({
  open,
  onOpenChange,
}: RemoveAccountDrawerProps) {
  const t = useTranslations("App.Settings.RemoveAccountDrawer");

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={t("title")}>
      <p className="text-sm text-muted-foreground">{t("warning")}</p>

      <div className="flex flex-col gap-3">
        <Button variant="destructive" size="lg" className="w-full rounded-xl">
          {t("confirmButton")}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-xl"
          onClick={() => onOpenChange(false)}
        >
          {t("cancelButton")}
        </Button>
      </div>
    </BottomSheet>
  );
}
