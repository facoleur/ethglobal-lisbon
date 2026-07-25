"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { useWalletStore } from "@/lib/store/wallet";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { credentialId } = useWalletStore();

  // Zustand persisted state resolves only after client hydration — useEffect required
  useEffect(() => {
    if (credentialId === null) {
      router.replace("/login");
    }
  }, [credentialId, router]);

  {/* loading / redirect guard */}
  if (credentialId === null) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      {/* main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-sm px-6 py-8">{children}</div>
      </main>

      {/* bottom navigation */}
      <BottomNav />
    </div>
  );
}
