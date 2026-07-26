"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { isAddress } from "viem";
import { toast } from "sonner";
import { AddressInput } from "@/components/ui/address-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { QrScanner } from "@/components/ui/qr-scanner";
import { useSendKernelTransaction } from "@/hooks/use-kernel";
import { parsePositiveEtherAmount } from "@/lib/amount";
import { getTransactionErrorMessage } from "@/lib/errors";
import { haptic } from "@/lib/haptics";
import { parseEthereumQr } from "@/lib/qr";

type SendDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance?: bigint;
};

export function SendDrawer({ open, onOpenChange, balance }: SendDrawerProps) {
  const t = useTranslations("App.SendDrawer");
  const tCommon = useTranslations("Common");
  const formRef = useRef<HTMLFormElement>(null);
  const { sendTransaction, isPending } = useSendKernelTransaction();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const amountValue = parsePositiveEtherAmount(amount);
  const hasSufficientBalance =
    balance !== undefined && amountValue !== null && amountValue <= balance;
  const canSubmit = recipient.trim() !== "" && hasSufficientBalance;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isPending) return;
    if (!nextOpen) {
      formRef.current?.reset();
      setRecipient("");
      setAmount("");
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const recipientValue = formData.get("recipient");
    const amount = formData.get("amount");

    if (typeof recipientValue !== "string" || !isAddress(recipientValue)) {
      toast.error(t("invalidRecipient"));
      return;
    }

    if (typeof amount !== "string") {
      toast.error(t("invalidAmount"));
      return;
    }

    const value = parsePositiveEtherAmount(amount);
    if (value === null) {
      toast.error(t("invalidAmount"));
      return;
    }
    if (balance === undefined || value > balance) {
      toast.error(t("insufficientBalance"));
      return;
    }

    try {
      await sendTransaction([{ to: recipientValue, value }]);
      toast.success(t("success"));
      formRef.current?.reset();
      setRecipient("");
      setAmount("");
      onOpenChange(false);
    } catch (cause) {
      toast.error(
        t("sendFailed", {
          message: getTransactionErrorMessage(
            cause,
            tCommon("revokedPasskeyError"),
          ),
        }),
      );
    }
  };

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={handleOpenChange}
        title={t("title")}
      >
        <form
          ref={formRef}
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <AddressInput
            name="recipient"
            value={recipient}
            aria-label={t("recipientLabel")}
            placeholder={t("recipientPlaceholder")}
            disabled={isPending}
            required
            onChange={(e) => setRecipient(e.target.value)}
            onScanClick={() => setScannerOpen(true)}
            scanAriaLabel={t("scanAddress")}
          />
          <Input
            name="amount"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            aria-label={t("amountLabel")}
            placeholder={t("amountPlaceholder")}
            value={amount}
            disabled={isPending}
            required
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-xl"
            disabled={isPending || !canSubmit}
            loading={isPending}
            loadingLabel={t("sendingButton")}
          >
            {t("confirmButton")}
          </Button>
        </form>
      </BottomSheet>

      {scannerOpen && (
        <QrScanner
          onDetect={(raw) => {
            const address = parseEthereumQr(raw);
            setScannerOpen(false);
            if (!address) {
              toast.error(t("invalidQr"));
              return;
            }
            haptic("medium");
            setRecipient(address);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  );
}
