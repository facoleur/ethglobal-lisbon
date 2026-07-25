"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SendDrawer } from "@/components/send/send-drawer";
import { ReceiveDrawer } from "@/components/receive/receive-drawer";

export default function HomePage() {
  const t = useTranslations("App.Home");
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  return (
    <>
      {/* balance section */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">{t("balanceLabel")}</p>
          <p className="text-4xl font-semibold">0.00 ETH</p>
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
      </div>

      {/* send drawer */}
      <SendDrawer open={sendOpen} onOpenChange={setSendOpen} />

      {/* receive drawer */}
      <ReceiveDrawer open={receiveOpen} onOpenChange={setReceiveOpen} />
    </>
  );
}
