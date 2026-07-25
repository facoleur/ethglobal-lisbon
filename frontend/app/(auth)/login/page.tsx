"use client";

import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/lib/store/wallet";
import { createKernelSession } from "@/lib/kernel/create-session";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function LoginPage() {
  const t = useTranslations("Auth.Login");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { setCredential } = useWalletStore();
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreateWallet() {
    setIsCreating(true);
    try {
      const session = await createKernelSession("register", "TAR Wallet");
      setCredential(session.authenticatorId, session.account.address);
      router.push("/");
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="mb-4 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {/* create wallet button */}
      <Button
        size="lg"
        className="w-full rounded-2xl py-4"
        onClick={handleCreateWallet}
        disabled={isCreating}
      >
        {isCreating ? t("creating") : t("createWallet")}
      </Button>

      {/* recover wallet button */}
      <Button
        variant="outline"
        size="lg"
        className="w-full rounded-2xl py-4"
        render={<Link href="/recovery" />}
        nativeButton={false}
      >
        {t("recoverWallet")}
      </Button>
    </div>
  );
}
