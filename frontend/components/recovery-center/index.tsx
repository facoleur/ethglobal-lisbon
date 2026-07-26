"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ChessRook,
  Clock3,
  FlaskConical,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AttemptGroup } from "@/components/recovery-center/attempt-group";
import { ProtectWalletDrawer } from "@/components/recovery-center/protect-wallet-drawer";
import { RecoveryAttemptDrawer } from "@/components/recovery-center/recovery-attempt-drawer";
import { StopWatchingDrawer } from "@/components/recovery-center/stop-watching-drawer";
import { WatchedWalletCard } from "@/components/recovery-center/watched-wallet-card";
import { WatchTowersDrawer } from "@/components/recovery-center/watch-towers-drawer";
import { RemoveAccountDrawer } from "@/components/settings/remove-account-drawer";
import { SettingsMenuItem } from "@/components/settings/settings-menu-item";
import { TarDrawer } from "@/components/settings/tar-drawer";
import { Button } from "@/components/ui/button";
import { useKernelAccount } from "@/hooks/use-kernel";
import { useRecoveryAttemptSync } from "@/hooks/use-recovery-attempt-sync";
import { getErrorMessage } from "@/lib/errors";
import {
  groupRecoveryAttempts,
  simulateRecoveryAttempt,
  type RecoveryAttempt,
} from "@/lib/recovery-center";
import { MOCK_LOCK_TIME_LABEL, MOCK_LOCK_VALUE_ETH } from "@/lib/recovery";
import { tarRecoveryExecutorV2Address } from "@/lib/kernel/config";
import { useRecoveryCenterStore } from "@/lib/store/recovery-center";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import { MAX_WATCH_TOWERS, type WatchedWallet } from "@/lib/watch-towers";

export function RecoveryCenter() {
  const t = useTranslations("App.Recovery");
  const tCommon = useTranslations("Common");
  const { address: accountAddress } = useKernelAccount();
  const {
    attempts,
    hasHydrated: attemptsHydrated,
    addAttempt,
    removeAttempt,
    purgeExpiredWatchTowerAttempts,
  } = useRecoveryCenterStore();
  const {
    watchTowers,
    watchedWallets,
    hasHydrated: watchTowersHydrated,
  } = useWatchTowerStore();
  const [now, setNow] = useState(() => Date.now());
  const [selectedAttempt, setSelectedAttempt] =
    useState<RecoveryAttempt | null>(null);
  const [watchTowersOpen, setWatchTowersOpen] = useState(false);
  const [tarOpen, setTarOpen] = useState(false);
  const [protectWalletOpen, setProtectWalletOpen] = useState(false);
  const [removeAccountOpen, setRemoveAccountOpen] = useState(false);
  const [walletToRemove, setWalletToRemove] = useState<WatchedWallet | null>(
    null,
  );
  const [simulatingRole, setSimulatingRole] = useState<
    "owner" | "watchTower" | null
  >(null);

  useRecoveryAttemptSync(t("myWallet"));

  useEffect(() => {
    if (attemptsHydrated) purgeExpiredWatchTowerAttempts(Date.now());
  }, [attemptsHydrated, purgeExpiredWatchTowerAttempts]);

  useEffect(() => {
    if (attempts.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setNow(now);
      purgeExpiredWatchTowerAttempts(now);
    }, 1_000);
    return () => clearInterval(interval);
  }, [attempts.length, purgeExpiredWatchTowerAttempts]);

  const groups = groupRecoveryAttempts(attempts);
  const hasAttempts = attempts.length > 0;
  const hasHydrated = attemptsHydrated && watchTowersHydrated;

  async function handleSimulateOwnerAttempt() {
    if (!accountAddress) return;
    setSimulatingRole("owner");
    try {
      const attempt = await simulateRecoveryAttempt({
        role: "owner",
        targetAddress: accountAddress,
        targetLabel: t("myWallet"),
      });
      addAttempt(attempt);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSimulatingRole(null);
    }
  }

  async function handleSimulateWatchTowerAttempt() {
    const wallet = watchedWallets[0];
    if (!wallet) return;
    setSimulatingRole("watchTower");
    try {
      const attempt = await simulateRecoveryAttempt({
        role: "watchTower",
        targetAddress: wallet.address,
        targetLabel: wallet.label,
      });
      addAttempt(attempt);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSimulatingRole(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{t("actionRequired")}</h2>
            {hasAttempts && (
              <span className="bg-destructive rounded-full px-2 py-0.5 text-xs font-semibold text-white">
                {attempts.length}
              </span>
            )}
          </div>

          {!hasHydrated ? (
            <div className="text-muted-foreground rounded-2xl bg-card px-4 py-8 text-center text-sm">
              {tCommon("loading")}
            </div>
          ) : !hasAttempts ? (
            <div className="flex items-center gap-3 rounded-2xl bg-card/60 p-4">
              <CheckCircle2 className="size-6 shrink-0" />
              <div>
                <p className="font-medium">{t("noAttemptsTitle")}</p>
                <p className="text-muted-foreground text-sm">
                  {t("noAttemptsSubtitle")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <AttemptGroup
                attempts={groups.owner}
                now={now}
                expiredLabel={t("expired")}
                onSelect={setSelectedAttempt}
              />
              <AttemptGroup
                attempts={groups.watchTower}
                now={now}
                expiredLabel={t("expired")}
                onSelect={setSelectedAttempt}
              />
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-sm font-semibold">
            {t("myProtectionTitle")}
          </h2>
          <div className="overflow-hidden rounded-2xl bg-card">
            <div className="divide-border divide-y">
              <SettingsMenuItem
                title={t("manageWatchTowers")}
                subtitle={t("watchTowerCount", {
                  count: watchTowers.length,
                  max: MAX_WATCH_TOWERS,
                })}
                icon={<ChessRook className="size-4" />}
                onClick={() => setWatchTowersOpen(true)}
              />
              <SettingsMenuItem
                title={t("recoverySettings")}
                subtitle={t("recoverySettingsSummary", {
                  value: MOCK_LOCK_VALUE_ETH,
                  time: MOCK_LOCK_TIME_LABEL,
                })}
                icon={<Clock3 className="size-4" />}
                onClick={() => setTarOpen(true)}
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold">{t("walletsIProtect")}</h2>
            {watchedWallets.length > 0 && (
              <span className="text-muted-foreground text-sm">
                {watchedWallets.length}
              </span>
            )}
          </div>

          {watchedWallets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-8 text-center">
              <ShieldCheck className="size-7" />
              <div>
                <p className="font-medium">{t("noWatchedWalletsTitle")}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("noWatchedWalletsSubtitle")}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-border overflow-hidden rounded-2xl bg-card divide-y">
              {watchedWallets.map((wallet) => (
                <WatchedWalletCard
                  key={wallet.id}
                  wallet={wallet}
                  removeLabel={t("stopWatchingLabel", {
                    wallet: wallet.label,
                  })}
                  onRemove={() => setWalletToRemove(wallet)}
                />
              ))}
            </div>
          )}

          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => setProtectWalletOpen(true)}
          >
            <Plus className="size-5" />
            {t("protectWalletButton")}
          </Button>
        </section>

        {process.env.NODE_ENV === "development" &&
          !tarRecoveryExecutorV2Address && (
            <section className="flex flex-col gap-2 rounded-2xl bg-black/[0.03] p-4">
              <div className="flex items-center gap-2">
                <FlaskConical className="size-4" />
                <h2 className="text-sm font-semibold">{t("devTools")}</h2>
              </div>
              <Button
                type="button"
                size="xs"
                variant="link"
                className="text-muted-foreground h-auto justify-start p-0 text-left text-xs underline"
                onClick={handleSimulateOwnerAttempt}
                disabled={simulatingRole !== null || !accountAddress}
                loading={simulatingRole === "owner"}
                loadingLabel={t("simulating")}
              >
                {t("simulateOwnerAttempt")}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="link"
                className="text-muted-foreground h-auto justify-start p-0 text-left text-xs underline disabled:opacity-40"
                onClick={handleSimulateWatchTowerAttempt}
                disabled={
                  simulatingRole !== null || watchedWallets.length === 0
                }
                loading={simulatingRole === "watchTower"}
                loadingLabel={t("simulating")}
              >
                {t("simulateWatchedAttempt")}
              </Button>
            </section>
          )}

        <section className="overflow-hidden rounded-2xl bg-card">
          <SettingsMenuItem
            title={t("removeAccount")}
            subtitle={t("removeAccountSubtitle")}
            onClick={() => setRemoveAccountOpen(true)}
            destructive
          />
        </section>
      </div>

      <WatchTowersDrawer
        open={watchTowersOpen}
        onOpenChange={setWatchTowersOpen}
      />
      <TarDrawer open={tarOpen} onOpenChange={setTarOpen} />
      <ProtectWalletDrawer
        open={protectWalletOpen}
        onOpenChange={setProtectWalletOpen}
      />
      <RecoveryAttemptDrawer
        attempt={selectedAttempt}
        onClose={() => setSelectedAttempt(null)}
        onResolved={removeAttempt}
      />
      <StopWatchingDrawer
        wallet={walletToRemove}
        onClose={() => setWalletToRemove(null)}
      />
      <RemoveAccountDrawer
        open={removeAccountOpen}
        onOpenChange={setRemoveAccountOpen}
      />
    </>
  );
}
