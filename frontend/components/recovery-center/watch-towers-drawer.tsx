"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AddressInput } from "@/components/ui/address-input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { FullscreenSheet } from "@/components/ui/fullscreen-sheet";
import { getErrorMessage } from "@/lib/errors";
import { Input } from "@/components/ui/input";
import { QrScanner } from "@/components/ui/qr-scanner";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import {
  maskWatchTowerSecret,
  MAX_WATCH_TOWERS,
  simulateAddWatchTower,
  simulateRemoveWatchTower,
  type WatchTower,
} from "@/lib/watch-towers";

type WatchTowersDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function WatchTowersDrawer({
  open,
  onOpenChange,
}: WatchTowersDrawerProps) {
  const t = useTranslations("App.Recovery.WatchTowersDrawer");
  const tCommon = useTranslations("Common");
  const { watchTowers, hasHydrated, addWatchTower, removeWatchTower } =
    useWatchTowerStore();
  const [addOpen, setAddOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [towerToRemove, setTowerToRemove] = useState<WatchTower | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const isAtLimit = watchTowers.length >= MAX_WATCH_TOWERS;
  const labelValid = label.trim().length > 0;
  const normalizedSecret = secret.trim();
  const secretValid = normalizedSecret.length > 0;
  const duplicateSecret = watchTowers.some(
    (tower) => tower.secret === normalizedSecret,
  );

  function resetAddFlow() {
    setAddOpen(false);
    setSecret("");
    setLabel("");
  }

  function handleDetected(value: string) {
    const detectedSecret = value.trim();
    setScannerOpen(false);

    if (!detectedSecret) {
      toast.error(t("invalidSecret"));
      return;
    }
    setSecret(detectedSecret);
  }

  async function handleAdd() {
    if (!secretValid || !labelValid || duplicateSecret || isAtLimit) return;
    setIsAdding(true);
    try {
      const watchTower = await simulateAddWatchTower({
        label,
        secret: normalizedSecret,
      });
      addWatchTower(watchTower);
      toast.success(t("addSuccess"));
      resetAddFlow();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemove() {
    if (!towerToRemove) return;
    setIsRemoving(true);
    try {
      await simulateRemoveWatchTower();
      removeWatchTower(towerToRemove.id);
      toast.success(t("removeSuccess"));
      setTowerToRemove(null);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setIsRemoving(false);
    }
  }

  function handleDrawerChange(nextOpen: boolean) {
    if (!nextOpen && (isAdding || isRemoving)) return;
    if (!nextOpen) {
      setScannerOpen(false);
      resetAddFlow();
      setTowerToRemove(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <>
      <FullscreenSheet open={open} onOpenChange={handleDrawerChange}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 pb-6">
            <div>
              <h1 className="text-xl font-semibold">{t("title")}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("count", {
                  count: watchTowers.length,
                  max: MAX_WATCH_TOWERS,
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDrawerChange(false)}
              aria-label={t("closeLabel")}
              className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-full"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
            {!hasHydrated ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {tCommon("loading")}
              </p>
            ) : watchTowers.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <ShieldCheck className="size-8" />
                <div>
                  <p className="font-medium">{t("emptyTitle")}</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t("emptySubtitle")}
                  </p>
                </div>
              </div>
            ) : (
              watchTowers.map((tower) => (
                <div
                  key={tower.id}
                  className="flex items-center gap-3 rounded-2xl bg-card p-4"
                >
                  <ShieldCheck className="size-6 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">
                      {tower.label}
                    </p>
                    <p className="text-muted-foreground truncate text-sm">
                      {maskWatchTowerSecret(tower.secret)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTowerToRemove(tower)}
                    aria-label={t("removeLabel", { label: tower.label })}
                    className="text-destructive flex size-11 shrink-0 items-center justify-center rounded-xl"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pt-6">
            <Button
              size="lg"
              className="w-full"
              onClick={() => setAddOpen(true)}
              disabled={!hasHydrated || isAtLimit}
            >
              <Plus className="size-5" />
              {isAtLimit ? t("limitReached") : t("addButton")}
            </Button>
          </div>
        </div>
      </FullscreenSheet>

      {scannerOpen && (
        <QrScanner
          onDetect={handleDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <BottomSheet
        open={addOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isAdding) resetAddFlow();
        }}
        title={t("labelTitle")}
      >
        <p className="text-muted-foreground text-sm">{t("labelSubtitle")}</p>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t("labelLabel")}</label>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t("labelPlaceholder")}
            maxLength={40}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t("secretLabel")}</label>
          <AddressInput
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={t("secretPlaceholder")}
            aria-invalid={duplicateSecret}
            onScanClick={() => setScannerOpen(true)}
            scanAriaLabel={t("scanSecretLabel")}
          />
          {duplicateSecret && (
            <p className="text-destructive text-sm">{t("duplicateSecret")}</p>
          )}
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={handleAdd}
          disabled={
            !labelValid ||
            !secretValid ||
            duplicateSecret ||
            isAdding ||
            isAtLimit
          }
          loading={isAdding}
          loadingLabel={t("addingButton")}
        >
          {t("confirmAddButton")}
        </Button>
      </BottomSheet>

      <BottomSheet
        open={towerToRemove !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isRemoving) setTowerToRemove(null);
        }}
        title={t("removeTitle")}
      >
        <p className="text-muted-foreground text-sm">
          {t("removeSubtitle", { label: towerToRemove?.label ?? "" })}
        </p>
        <Button
          size="lg"
          variant="destructive"
          className="w-full"
          onClick={handleRemove}
          disabled={isRemoving}
          loading={isRemoving}
          loadingLabel={t("removingButton")}
        >
          {t("confirmRemoveButton")}
        </Button>
      </BottomSheet>
    </>
  );
}
