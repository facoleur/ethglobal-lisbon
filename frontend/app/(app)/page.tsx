"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SendDrawer } from "@/components/send/send-drawer";

export default function HomePage() {
  const t = useTranslations("App.Home");
  const [sendOpen, setSendOpen] = useState(false);

  return (
    <>
      {/* balance section */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm">{t("balanceLabel")}</p>
          <p className="text-4xl font-semibold">0.00 ETH</p>
        </div>

        {/* send button */}
        <Button
          size="lg"
          className="w-full rounded-2xl py-4"
          onClick={() => setSendOpen(true)}
        >
          {t("sendButton")}
        </Button>
      </div>

      {/* send drawer */}
      <SendDrawer open={sendOpen} onOpenChange={setSendOpen} />
    </>
  );
}
