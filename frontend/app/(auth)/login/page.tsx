"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/lib/store/wallet";
import { createKernelSession } from "@/lib/kernel/create-session";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RecoveryDrawer } from "@/components/recovery/recovery-drawer";

export default function LoginPage() {
  const t = useTranslations("Auth.Login");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { setCredential } = useWalletStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  async function handleCreateWallet() {
    setIsCreating(true);
    try {
      const session = await createKernelSession("register", "TAR Wallet");
      setCredential(
        session.authenticatorId,
        session.account.address,
        session.publicKey,
      );
      router.push("/");
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleLogin() {
    setIsLoggingIn(true);
    try {
      const session = await createKernelSession("login", "TAR Wallet");
      setCredential(
        session.authenticatorId,
        session.account.address,
        session.publicKey,
      );
      router.push("/");
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* header */}
        <div className="mb-4 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>

        <Button
          size="lg"
          className="w-full rounded-2xl py-4"
          onClick={handleCreateWallet}
          disabled={isCreating || isLoggingIn}
        >
          {isCreating ? t("creating") : t("createWallet")}
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="w-full rounded-2xl py-4"
          onClick={handleLogin}
          disabled={isCreating || isLoggingIn}
        >
          {isLoggingIn ? t("loggingIn") : t("loginWithPasskey")}
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="w-full rounded-2xl py-4"
          onClick={() => setRecoveryOpen(true)}
          disabled={isCreating || isLoggingIn}
        >
          {t("recoverWallet")}
        </Button>
      </div>

      <RecoveryDrawer open={recoveryOpen} onOpenChange={setRecoveryOpen} />
    </>
  );
}
