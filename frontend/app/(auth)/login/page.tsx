"use client";

import { Button } from "@/components/ui/button";
import { useLoginPasskey, useRegisterPasskey } from "@/hooks/use-kernel";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function LoginPage() {
  const t = useTranslations("Auth.Login");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const { register, isPending: isCreating } = useRegisterPasskey();
  const { login, isPending: isLoggingIn } = useLoginPasskey();

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
        disabled={isCreating || isLoggingIn}
      >
        {isCreating ? t("creating") : t("createWallet")}
      </Button>

      {/* login with passkey button */}
      <Button
        size="lg"
        variant="outline"
        className="w-full rounded-2xl py-4"
        onClick={handleLogin}
        disabled={isCreating || isLoggingIn}
      >
        {isLoggingIn ? t("loggingIn") : t("loginWithPasskey")}
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
