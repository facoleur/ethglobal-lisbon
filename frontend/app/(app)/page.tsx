"use client";

import { ReceiveDrawer } from "@/components/receive/receive-drawer";
import { VetoDrawer } from "@/components/recovery/veto-drawer";
import { SendDrawer } from "@/components/send/send-drawer";
import { AccountAvatar } from "@/components/ui/account-avatar";
import { ActionButton } from "@/components/ui/action-button";
import { useKernelAccount, useKernelBalance } from "@/hooks/use-kernel";
import { simulateIncomingRecovery, truncateAddress } from "@/lib/recovery";
import { useVetoStore } from "@/lib/store/veto";
import { ArrowDown, ArrowLeftRight, ArrowUp, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatEther } from "viem";

export default function HomePage() {
  const t = useTranslations("App.Home");
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const { address } = useKernelAccount();
  const { balance } = useKernelBalance();
  const {
    status: vetoStatus,
    hasHydrated: vetoHydrated,
    setPending,
  } = useVetoStore();
  const vetoOpen = vetoHydrated && vetoStatus === "pending";

  return (
    <>
      <div className="flex flex-col gap-8">
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

        {/* activity */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t("activityTitle")}</h2>
          <div className="flex flex-col items-center gap-3 rounded-2xl squircle bg-white/60 py-10">
            <Inbox
              className="size-7 text-muted-foreground/40"
              strokeWidth={1.5}
            />
            <p className="text-sm text-muted-foreground">
              {t("activityEmpty")}
            </p>
          </div>
        </div>

        {process.env.NODE_ENV === "development" && (
          <button
            className="text-muted-foreground text-left text-xs underline"
            onClick={async () => {
              const data = await simulateIncomingRecovery();
              setPending(data.recovererAddress, data.executableAt);
            }}
          >
            [dev] Simulate incoming recovery
          </button>
        )}
      </div>

      <SendDrawer open={sendOpen} onOpenChange={setSendOpen} />
      <ReceiveDrawer open={receiveOpen} onOpenChange={setReceiveOpen} />
      <VetoDrawer open={vetoOpen} />
    </>
  );
}
