import { Trash2 } from "lucide-react";
import { AccountAvatar } from "@/components/ui/account-avatar";
import { truncateAddress } from "@/lib/recovery";
import type { WatchedWallet } from "@/lib/watch-towers";

type WatchedWalletCardProps = {
  wallet: WatchedWallet;
  removeLabel: string;
  onRemove: () => void;
};

export function WatchedWalletCard({
  wallet,
  removeLabel,
  onRemove,
}: WatchedWalletCardProps) {
  return (
    <div className="flex items-center gap-3 p-4">
      <AccountAvatar address={wallet.address} size={42} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium">{wallet.label}</p>
        <p className="text-muted-foreground truncate text-sm">
          {truncateAddress(wallet.address)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="text-destructive flex size-10 shrink-0 items-center justify-center rounded-xl"
      >
        <Trash2 className="size-5" />
      </button>
    </div>
  );
}
