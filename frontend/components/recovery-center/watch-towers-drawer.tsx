"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, ScanLine, ShieldCheck, Trash2, X } from "lucide-react";
import { getAddress } from "viem";
import { useReadContract } from "wagmi";
import { toast } from "sonner";
import { EnrollmentQrScanner } from "@/components/recovery-center/enrollment-qr-scanner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { FullscreenSheet } from "@/components/ui/fullscreen-sheet";
import { getErrorMessage } from "@/lib/errors";
import { Input } from "@/components/ui/input";
import { useKernelAccount } from "@/hooks/use-kernel";
import { useRegenerateWatchTowerGroup } from "@/hooks/use-watch-tower-policy";
import { tarRecoveryExecutorV2Abi } from "@/lib/contracts/tar-recovery";
import { chain } from "@/lib/kernel/config";
import { tarRecoveryExecutorV2Address } from "@/lib/kernel/config";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import type { WatchTowerEnrollment } from "@/lib/watch-tower-enrollment";
import {
  createWatchTower,
  maskWatchTowerCommitment,
  MAX_WATCH_TOWERS,
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
  const { address: ownerAddress } = useKernelAccount();
  const {
    watchTowers,
    hasHydrated,
    addWatchTower,
    advanceWatchTowerCommitments,
    removeWatchTower,
  } = useWatchTowerStore();
  const {
    regenerate,
    isConfigured,
    isPending: isUpdatingPolicy,
  } = useRegenerateWatchTowerGroup();
  const defenseGroup = useReadContract({
    abi: tarRecoveryExecutorV2Abi,
    address: tarRecoveryExecutorV2Address ?? undefined,
    functionName: "groupOf",
    args: ownerAddress ? [ownerAddress] : undefined,
    query: {
      enabled:
        tarRecoveryExecutorV2Address !== null && ownerAddress !== undefined,
    },
  });
  const [addOpen, setAddOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<WatchTowerEnrollment | null>(
    null,
  );
  const [label, setLabel] = useState("");
  const [towerToRemove, setTowerToRemove] = useState<WatchTower | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const isAtLimit = watchTowers.length >= MAX_WATCH_TOWERS;
  const labelValid = label.trim().length > 0;
  const duplicateEnrollment =
    enrollment !== null &&
    watchTowers.some((tower) => tower.id === enrollment.relationshipId);
  const needsPolicyActivation = isConfigured && defenseGroup.data === BigInt(0);

  function resetAddFlow() {
    setAddOpen(false);
    setEnrollment(null);
    setLabel("");
  }

  function handleEnrollment(nextEnrollment: WatchTowerEnrollment) {
    setScannerOpen(false);

    if (nextEnrollment.chainId !== chain.id) {
      toast.error(t("wrongNetwork"));
      return;
    }
    if (
      !ownerAddress ||
      getAddress(nextEnrollment.protectedWallet) !== getAddress(ownerAddress)
    ) {
      toast.error(t("wrongWallet"));
      return;
    }
    if (
      watchTowers.some((tower) => tower.id === nextEnrollment.relationshipId)
    ) {
      toast.error(t("duplicateEnrollment"));
      return;
    }

    setEnrollment(nextEnrollment);
  }

  async function handleAdd() {
    if (!enrollment || !labelValid || duplicateEnrollment || isAtLimit) return;
    const watchTower = createWatchTower(label, enrollment);

    setIsAdding(true);
    try {
      const nextWatchTowers = [...watchTowers, watchTower];
      if (isConfigured) await regenerate(nextWatchTowers);

      addWatchTower(watchTower);
      if (isConfigured) {
        advanceWatchTowerCommitments(nextWatchTowers.map((tower) => tower.id));
      }
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
      const nextWatchTowers = watchTowers.filter(
        (tower) => tower.id !== towerToRemove.id,
      );
      if (isConfigured) await regenerate(nextWatchTowers);

      removeWatchTower(towerToRemove.id);
      if (isConfigured) {
        advanceWatchTowerCommitments(nextWatchTowers.map((tower) => tower.id));
      }
      toast.success(t("removeSuccess"));
      setTowerToRemove(null);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setIsRemoving(false);
    }
  }

  async function handleActivatePolicy() {
    setIsActivating(true);
    try {
      await regenerate(watchTowers);
      advanceWatchTowerCommitments(watchTowers.map((tower) => tower.id));
      await defenseGroup.refetch();
      toast.success(t("policyActivated"));
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setIsActivating(false);
    }
  }

  function handleDrawerChange(nextOpen: boolean) {
    if (
      !nextOpen &&
      (isUpdatingPolicy || isAdding || isRemoving || isActivating)
    )
      return;
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
                      {maskWatchTowerCommitment(tower.commitments[0])}
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

          <div className="flex flex-col gap-2 pt-6">
            {needsPolicyActivation && (
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                onClick={handleActivatePolicy}
                disabled={isUpdatingPolicy || isActivating}
                loading={isActivating}
                loadingLabel={t("updatingPolicy")}
              >
                <ShieldCheck className="size-5" />
                {t("activatePolicy")}
              </Button>
            )}
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
        <EnrollmentQrScanner
          onComplete={handleEnrollment}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <BottomSheet
        open={addOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isUpdatingPolicy && !isAdding) resetAddFlow();
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
        {enrollment ? (
          <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4">
            <ShieldCheck className="size-6 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">{t("enrollmentReady")}</p>
              <p className="text-muted-foreground truncate text-sm">
                {t("commitmentCount", {
                  count: enrollment.commitments.length,
                })}
              </p>
            </div>
          </div>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="size-5" />
            {t("scanEnrollment")}
          </Button>
        )}
        <Button
          size="lg"
          className="w-full"
          onClick={handleAdd}
          disabled={
            !labelValid ||
            !enrollment ||
            duplicateEnrollment ||
            isAtLimit ||
            isUpdatingPolicy ||
            isAdding
          }
          loading={isAdding}
          loadingLabel={t("updatingPolicy")}
        >
          {t("confirmAddButton")}
        </Button>
      </BottomSheet>

      <BottomSheet
        open={towerToRemove !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isUpdatingPolicy && !isRemoving)
            setTowerToRemove(null);
        }}
        title={t("removeTitle")}
      >
        <p className="text-muted-foreground text-sm">
          {t("removeSubtitle", { label: towerToRemove?.label ?? "" })}
        </p>
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            variant="destructive"
            className="w-full"
            onClick={handleRemove}
            disabled={isUpdatingPolicy || isRemoving}
            loading={isRemoving}
            loadingLabel={t("removingButton")}
          >
            {t("confirmRemoveButton")}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => setTowerToRemove(null)}
            disabled={isUpdatingPolicy || isRemoving}
          >
            {tCommon("cancel")}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
