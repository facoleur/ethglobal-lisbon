"use client";

import { ReceiveDrawer } from "@/components/receive/receive-drawer";
import { RecoverySummaryCard } from "@/components/recovery-center/recovery-summary-card";
import { SendDrawer } from "@/components/send/send-drawer";
import { SetupBanner } from "@/components/setup-banner";
import { AccountAvatar } from "@/components/ui/account-avatar";
import { ActionButton } from "@/components/ui/action-button";
import { useKernelAccount, useKernelBalance } from "@/hooks/use-kernel";
import { truncateAddress } from "@/lib/recovery";
import { useRecoveryCenterStore } from "@/lib/store/recovery-center";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import { ArrowDown, ArrowLeftRight, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatEther } from "viem";

export default function HomePage() {
  const t = useTranslations("App.Home");
  const router = useRouter();
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const { address } = useKernelAccount();
  const { balance } = useKernelBalance();
  const { attempts, hasHydrated: attemptsHydrated } = useRecoveryCenterStore();
  const { watchTowers, hasHydrated: watchTowersHydrated } =
    useWatchTowerStore();

  return (
    <>
      <div className="flex flex-col gap-8">
        {/* setup banner */}
        <SetupBanner />

        {/* account section */}
        {address && (
          <div className="flex items-center gap-3">
            <AccountAvatar address={address} size={32} />
            <span className="text-sm font-medium">
              {truncateAddress(address)}
            </span>
          </div>
        )}

        {/* balance */}
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">{t("balanceLabel")}</p>
          <p className="text-4xl font-semibold">
            {formatEther(balance ?? BigInt(0))} ETH
          </p>
        </div>

        {/* action buttons */}
        <div className="flex gap-1">
          <ActionButton
            icon={ArrowUp}
            label={t("sendButton")}
            onClick={() => setSendOpen(true)}
          />
          <ActionButton
            icon={ArrowDown}
            label={t("receiveButton")}
            onClick={() => setReceiveOpen(true)}
          />
          <ActionButton icon={ArrowLeftRight} label={t("swapButton")} />
        </div>

        {/* recovery status */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("recoveryTitle")}</h2>
          <RecoverySummaryCard
            attemptCount={attemptsHydrated ? attempts.length : 0}
            watchTowerCount={watchTowersHydrated ? watchTowers.length : 0}
            alertTitle={t("recoveryAlertTitle")}
            alertSubtitle={t("recoveryAlertSubtitle")}
            protectedTitle={t("protectionTitle")}
            protectedSubtitle={
              watchTowersHydrated && watchTowers.length > 0
                ? t("protectionWithTowers", { count: watchTowers.length })
                : t("protectionWithoutTowers")
            }
            onClick={() => router.push("/recovery")}
          />
        </div>
      </div>

      <SendDrawer open={sendOpen} onOpenChange={setSendOpen} />
      <ReceiveDrawer open={receiveOpen} onOpenChange={setReceiveOpen} />
    </>
  );
}
