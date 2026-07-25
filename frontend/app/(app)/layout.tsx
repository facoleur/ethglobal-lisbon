"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { useWalletStore } from "@/lib/store/wallet";
import { loginPasskey } from "@/lib/web3/kernel";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Common");
  const router = useRouter();
  const { credentialId, kernelClient, setKernelClient } = useWalletStore();
  // Track whether we've already kicked off the login attempt to avoid double-calling
  const attemptedRef = useRef(false);

  // useEffect is required here because:
  // 1. Zustand persisted state (localStorage) resolves only on the client after hydration
  // 2. loginPasskey() triggers a browser WebAuthn prompt — must run client-side
  useEffect(() => {
    if (credentialId === null) {
      router.replace("/login");
      return;
    }

    if (kernelClient !== null || attemptedRef.current) {
      return;
    }

    attemptedRef.current = true;
    loginPasskey()
      .then(({ kernelClient: client }) => {
        setKernelClient(client);
      })
      .catch(() => {
        // If reconstruction fails, send user back to login to re-authenticate
        router.replace("/login");
      });
  }, [credentialId, kernelClient, router, setKernelClient]);

  const isReady = credentialId !== null && kernelClient !== null;

  if (!isReady) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        <p className="text-muted-foreground text-sm">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-sm px-6 py-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
