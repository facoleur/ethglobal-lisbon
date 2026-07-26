"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getAddress, isAddress } from "viem";
import { toast } from "sonner";
import { AccountAvatar } from "@/components/ui/account-avatar";
import { AnimatedQrCode } from "@/components/ui/animated-qr-code";
import { AddressInput } from "@/components/ui/address-input";
import { Button } from "@/components/ui/button";
import { FullscreenSheet } from "@/components/ui/fullscreen-sheet";
import { Input } from "@/components/ui/input";
import { QrScanner } from "@/components/ui/qr-scanner";
import { chain, getBrowserPasskeyRpId } from "@/lib/kernel/config";
import { getErrorMessage } from "@/lib/errors";
import { truncateAddress } from "@/lib/recovery";
import { useWatchTowerStore } from "@/lib/store/watch-towers";
import { useWalletStore } from "@/lib/store/wallet";
import {
  createWatchTowerRelationshipId,
  deriveWatchTowerCommitments,
  PasskeyPrfUnavailableError,
} from "@/lib/watch-tower-identity";
import {
  createWatchTowerEnrollmentFrames,
  WATCH_TOWER_ENROLLMENT_VERSION,
} from "@/lib/watch-tower-enrollment";
import { createWatchedWallet, type WatchedWallet } from "@/lib/watch-towers";

type ProtectWalletDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type PendingEnrollment = {
  frames: string[];
  wallet: WatchedWallet;
};

export function ProtectWalletDrawer({
  open,
  onOpenChange,
}: ProtectWalletDrawerProps) {
  const t = useTranslations("App.Recovery.ProtectWalletDrawer");
  const { watchedWallets, addWatchedWallet } = useWatchTowerStore();
  const credentialId = useWalletStore((state) => state.credentialId);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pendingEnrollment, setPendingEnrollment] =
    useState<PendingEnrollment | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const validAddress = isAddress(address);
  const labelValid = label.trim().length > 0;
  const isDuplicate =
    validAddress &&
    watchedWallets.some((wallet) => wallet.address === getAddress(address));

  function reset() {
    setLabel("");
    setAddress("");
    setPendingEnrollment(null);
    setScannerOpen(false);
    setGenerationError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isGenerating) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function handleGenerate() {
    if (!validAddress || !labelValid || isDuplicate || !credentialId) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const protectedWallet = getAddress(address);
      const relationshipId = createWatchTowerRelationshipId();
      const commitments = await deriveWatchTowerCommitments({
        chainId: chain.id,
        credentialId,
        protectedWallet,
        relationshipId,
        rpId: getBrowserPasskeyRpId(),
      });
      const wallet = createWatchedWallet({
        address: protectedWallet,
        chainId: chain.id,
        credentialId,
        label,
        relationshipId,
      });
      const frames = await createWatchTowerEnrollmentFrames({
        chainId: chain.id,
        commitments,
        createdAt: wallet.createdAt,
        protectedWallet,
        relationshipId,
        version: WATCH_TOWER_ENROLLMENT_VERSION,
      });
      setPendingEnrollment({ frames, wallet });
    } catch (error) {
      const message =
        error instanceof PasskeyPrfUnavailableError
          ? t("prfUnavailable")
          : getErrorMessage(error);
      setGenerationError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleActivate() {
    if (!pendingEnrollment) return;
    addWatchedWallet(pendingEnrollment.wallet);
    toast.success(t("activateSuccess"));
    handleOpenChange(false);
  }

  return (
    <>
      <FullscreenSheet open={open} onOpenChange={handleOpenChange}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="pb-8 text-center">
            <h1 className="text-lg font-semibold">{t("title")}</h1>
          </div>

          {pendingEnrollment ? (
            <div className="flex flex-1 flex-col">
              <div className="flex flex-col items-center gap-5 text-center">
                <div>
                  <h2 className="text-xl font-semibold">{t("qrTitle")}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {t("qrSubtitle", {
                      wallet: pendingEnrollment.wallet.label,
                    })}
                  </p>
                </div>

                <div className="rounded-3xl bg-white p-4">
                  <AnimatedQrCode frames={pendingEnrollment.frames} />
                </div>

                <div className="flex w-full max-w-full items-center gap-3 overflow-hidden rounded-2xl bg-card p-4 text-left">
                  <AccountAvatar
                    address={pendingEnrollment.wallet.address}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {pendingEnrollment.wallet.label}
                    </p>
                    <p className="text-muted-foreground block max-w-full truncate text-sm">
                      {truncateAddress(pendingEnrollment.wallet.address)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8">
                <Button size="lg" className="w-full" onClick={handleActivate}>
                  {t("ownerScannedButton")}
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
                  <AddressInput
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder={t("addressPlaceholder")}
                    aria-invalid={address.length > 0 && !validAddress}
                    onScanClick={() => setScannerOpen(true)}
                    scanAriaLabel={t("scanLabel")}
                  />
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
                    !validAddress ||
                    !labelValid ||
                    isDuplicate ||
                    isGenerating ||
                    !credentialId
                  }
                  loading={isGenerating}
                  loadingLabel={t("generatingButton")}
                >
                  {t("generateButton")}
                </Button>
                {generationError && (
                  <p className="text-destructive mt-3 text-center text-sm">
                    {generationError}
                  </p>
                )}
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
