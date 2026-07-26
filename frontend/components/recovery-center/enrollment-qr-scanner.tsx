"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { QrScanner } from "@/components/ui/qr-scanner";
import {
  collectWatchTowerEnrollmentFrame,
  createEmptyWatchTowerQrCollection,
  InvalidWatchTowerQrError,
  type WatchTowerEnrollment,
  type WatchTowerQrCollection,
} from "@/lib/watch-tower-enrollment";

type EnrollmentQrScannerProps = {
  onClose: () => void;
  onComplete: (enrollment: WatchTowerEnrollment) => void;
};

export function EnrollmentQrScanner({
  onClose,
  onComplete,
}: EnrollmentQrScannerProps) {
  const t = useTranslations("App.Recovery.EnrollmentQrScanner");
  const collectionRef = useRef<WatchTowerQrCollection>(
    createEmptyWatchTowerQrCollection(),
  );
  const processingRef = useRef(false);
  const [progress, setProgress] = useState({ received: 0, total: 0 });

  async function handleDetect(value: string) {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      const result = await collectWatchTowerEnrollmentFrame(
        collectionRef.current,
        value,
      );
      collectionRef.current = result.collection;
      setProgress({ received: result.received, total: result.total });

      if (result.enrollment) onComplete(result.enrollment);
    } catch (error) {
      if (error instanceof InvalidWatchTowerQrError) {
        toast.error(t("invalidQr"));
      }
    } finally {
      processingRef.current = false;
    }
  }

  return (
    <QrScanner continuous onDetect={handleDetect} onClose={onClose}>
      <div className="rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
        {progress.total > 0
          ? t("progress", progress)
          : t("waitingForFirstFrame")}
      </div>
    </QrScanner>
  );
}
