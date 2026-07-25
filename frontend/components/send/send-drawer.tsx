"use client";

import { useRef, type FormEvent } from "react";
import { Drawer } from "vaul";
import { useTranslations } from "next-intl";
import { isAddress, parseEther } from "viem";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSendKernelTransaction } from "@/hooks/use-kernel";

type SendDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SendDrawer({ open, onOpenChange }: SendDrawerProps) {
  const t = useTranslations("App.SendDrawer");
  const tCommon = useTranslations("Common");
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
    } catch {
      toast.error(tCommon("error"));
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        {/* drawer backdrop and content */}
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 flex flex-col rounded-t-2xl">
          <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-zinc-300" />
          <div className="mx-auto w-full max-w-sm px-6 pt-4 pb-10">
            <Drawer.Title className="mb-6 text-lg font-semibold">
              {t("title")}
            </Drawer.Title>
            {/* transfer form */}
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
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
