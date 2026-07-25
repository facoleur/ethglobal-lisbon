"use client";

import { RecoveryDrawer } from "@/components/recovery/recovery-drawer";
import { Button } from "@/components/ui/button";
import { useLoginPasskey, useRegisterPasskey } from "@/hooks/use-kernel";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function LoginPage() {
  const t = useTranslations("Auth.Login");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { register, isPending: isCreating } = useRegisterPasskey();
  const { login, isPending: isLoggingIn } = useLoginPasskey();
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  async function handleCreateWallet() {
    try {
      await register("TAR Wallet");
      router.push("/");
    } catch {
      toast.error(tCommon("error"));
    }
  }

  async function handleLogin() {
    try {
      await login("TAR Wallet");
      router.push("/");
    } catch {
      toast.error(tCommon("error"));
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>

        <div className="mt-auto flex flex-col gap-1">
          <Button
            size="lg"
            className="w-full"
            onClick={handleCreateWallet}
            disabled={isCreating || isLoggingIn}
          >
            {isCreating ? t("creating") : t("createWallet")}
          </Button>

          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={handleLogin}
            disabled={isCreating || isLoggingIn}
          >
            {isLoggingIn ? t("loggingIn") : t("loginWithPasskey")}
          </Button>

          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => setRecoveryOpen(true)}
            disabled={isCreating || isLoggingIn}
          >
            {t("recoverWallet")}
          </Button>
        </div>
      </div>

      <RecoveryDrawer open={recoveryOpen} onOpenChange={setRecoveryOpen} />
    </>
  );
}
