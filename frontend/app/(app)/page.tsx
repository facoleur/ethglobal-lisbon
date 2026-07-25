"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { SendDrawer } from "@/components/send/send-drawer";
import { ReceiveDrawer } from "@/components/receive/receive-drawer";
import { VetoDrawer } from "@/components/recovery/veto-drawer";
import { useKernelBalance } from "@/hooks/use-kernel";
import { useVetoStore } from "@/lib/store/veto";
import { simulateIncomingRecovery } from "@/lib/recovery";

export default function HomePage() {
  const t = useTranslations("App.Home");
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const { balance } = useKernelBalance();
  const {
    status: vetoStatus,
    hasHydrated: vetoHydrated,
    setPending,
  } = useVetoStore();
  const vetoOpen = vetoHydrated && vetoStatus === "pending";

  return (
    <>
      {/* balance section */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">{t("balanceLabel")}</p>
          <p className="text-4xl font-semibold">
            {formatEther(balance ?? BigInt(0))} ETH
          </p>
        </div>

        {/* actions */}
        <div className="flex gap-3">
          {/* send button */}
          <Button
            size="lg"
            className="flex-1 rounded-2xl py-4"
            onClick={() => setSendOpen(true)}
          >
            {t("sendButton")}
          </Button>

          {/* receive button */}
          <Button
            size="lg"
            variant="outline"
            className="flex-1 rounded-2xl py-4"
            onClick={() => setReceiveOpen(true)}
          >
            {t("receiveButton")}
          </Button>
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

      {/* send drawer */}
      <SendDrawer open={sendOpen} onOpenChange={setSendOpen} />

      {/* receive drawer */}
      <ReceiveDrawer open={receiveOpen} onOpenChange={setReceiveOpen} />

      {/* veto drawer — auto-opens when a recovery against this wallet is detected */}
      <VetoDrawer open={vetoOpen} />
    </>
  );
}
