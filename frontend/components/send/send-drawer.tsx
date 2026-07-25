"use client";

import { useRef, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { isAddress, parseEther } from "viem";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useSendKernelTransaction } from "@/hooks/use-kernel";
import { getErrorMessage } from "@/lib/errors";

type SendDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SendDrawer({ open, onOpenChange }: SendDrawerProps) {
  const t = useTranslations("App.SendDrawer");
  const formRef = useRef<HTMLFormElement>(null);
  const { sendTransaction, isPending } = useSendKernelTransaction();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isPending) return;
    if (!nextOpen) formRef.current?.reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const recipient = formData.get("recipient");
    const amount = formData.get("amount");

    if (typeof recipient !== "string" || !isAddress(recipient)) {
      toast.error(t("invalidRecipient"));
      return;
    }

    if (typeof amount !== "string") {
      toast.error(t("invalidAmount"));
      return;
    }

    let value: bigint;
    try {
      value = parseEther(amount);
    } catch {
      toast.error(t("invalidAmount"));
      return;
    }

    if (value <= BigInt(0)) {
      toast.error(t("invalidAmount"));
      return;
    }

    try {
      await sendTransaction([{ to: recipient, value }]);
      toast.success(t("success"));
      formRef.current?.reset();
      onOpenChange(false);
    } catch (cause) {
      toast.error(t("sendFailed", { message: getErrorMessage(cause) }));
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={handleOpenChange} title={t("title")}>
      <form
        ref={formRef}
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
      >
        <Input
          name="recipient"
          type="text"
          autoComplete="off"
          aria-label={t("recipientLabel")}
          placeholder={t("recipientPlaceholder")}
          disabled={isPending}
          required
        />
        <Input
          name="amount"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          aria-label={t("amountLabel")}
          placeholder={t("amountPlaceholder")}
          disabled={isPending}
          required
        />
        <Button
          type="submit"
          size="lg"
          className="w-full rounded-xl"
          disabled={isPending}
        >
          {isPending ? t("sendingButton") : t("confirmButton")}
        </Button>
      </form>
    </BottomSheet>
  );
}
