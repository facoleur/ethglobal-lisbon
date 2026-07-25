"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ScanLine } from "lucide-react";
import { getAddress, isAddress } from "viem";
import { toast } from "sonner";
import { QrCode } from "@/components/receive/qr-code";
import { AccountAvatar } from "@/components/ui/account-avatar";
import { Button } from "@/components/ui/button";
import { FullscreenSheet } from "@/components/ui/fullscreen-sheet";
import { Input } from "@/components/ui/input";
import { QrScanner } from "@/components/ui/qr-scanner";
import { truncateAddress } from "@/lib/recovery";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import {
  simulateActivateWatchedWallet,
  simulateCreateWatchedWallet,
  type WatchedWallet,
} from "@/lib/watch-towers";

type ProtectWalletDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProtectWalletDrawer({
  open,
  onOpenChange,
}: ProtectWalletDrawerProps) {
  const t = useTranslations("App.Recovery.ProtectWalletDrawer");
  const tCommon = useTranslations("Common");
  const { watchedWallets, addWatchedWallet } = useWatchTowerStore();
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pendingWallet, setPendingWallet] = useState<WatchedWallet | null>(
    null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const validAddress = isAddress(address);
  const labelValid = label.trim().length > 0;
  const isDuplicate =
    validAddress &&
    watchedWallets.some((wallet) => wallet.address === getAddress(address));

  function reset() {
    setLabel("");
    setAddress("");
    setPendingWallet(null);
    setScannerOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (isGenerating || isActivating)) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function handleGenerate() {
    if (!validAddress || !labelValid || isDuplicate) return;
    setIsGenerating(true);
    try {
      const wallet = await simulateCreateWatchedWallet({
        label,
        address: getAddress(address),
      });
      setPendingWallet(wallet);
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleActivate() {
    if (!pendingWallet) return;
    setIsActivating(true);
    try {
      await simulateActivateWatchedWallet();
      addWatchedWallet(pendingWallet);
      toast.success(t("activateSuccess"));
      handleOpenChange(false);
    } catch {
      toast.error(tCommon("error"));
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <>
      <FullscreenSheet open={open} onOpenChange={handleOpenChange}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="pb-8 text-center">
            <h1 className="text-lg font-semibold">{t("title")}</h1>
          </div>

          {pendingWallet ? (
            <div className="flex flex-1 flex-col">
              <div className="flex flex-col items-center gap-5 text-center">
                <div>
                  <h2 className="text-xl font-semibold">{t("qrTitle")}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t("qrSubtitle", { wallet: pendingWallet.label })}
                  </p>
                </div>

                <div className="rounded-3xl bg-white p-4">
                  <QrCode value={pendingWallet.secret} size={220} />
                </div>

                <div className="flex w-full max-w-full items-center gap-3 overflow-hidden rounded-2xl bg-card p-4 text-left">
                  <AccountAvatar address={pendingWallet.address} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {pendingWallet.label}
                    </p>
                    <p className="text-muted-foreground block max-w-full truncate text-sm">
                      {truncateAddress(pendingWallet.address)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleActivate}
                  disabled={isActivating}
                >
                  {isActivating
                    ? t("activatingButton")
                    : t("ownerScannedButton")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-xl font-semibold">{t("detailsTitle")}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t("detailsSubtitle")}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    {t("labelLabel")}
                  </label>
                  <Input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder={t("labelPlaceholder")}
                    maxLength={40}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    {t("addressLabel")}
                  </label>
                  <div className="relative">
                    <Input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder={t("addressPlaceholder")}
                      aria-invalid={address.length > 0 && !validAddress}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      aria-label={t("scanLabel")}
                      className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2"
                    >
                      <ScanLine className="size-5" />
                    </button>
                  </div>
                  {isDuplicate && (
                    <p className="text-destructive text-sm">
                      {t("duplicateWallet")}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-auto pt-8">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={
                    !validAddress || !labelValid || isDuplicate || isGenerating
                  }
                >
                  {isGenerating ? t("generatingButton") : t("generateButton")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </FullscreenSheet>

      {scannerOpen && (
        <QrScanner
          onDetect={(value) => {
            setAddress(value);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  );
}
