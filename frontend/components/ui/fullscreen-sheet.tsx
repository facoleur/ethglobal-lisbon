"use client";

import { Drawer } from "vaul";

type FullscreenSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function FullscreenSheet({
  open,
  onOpenChange,
  children,
}: FullscreenSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content className="bg-background fixed inset-x-0 bottom-0 top-4 z-50 flex flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
          <Drawer.Handle className="mx-auto mt-3 !h-1.5 !w-10 !rounded-full !bg-zinc-300 !opacity-100 touch-none" />
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col overflow-y-auto px-6 py-4 pb-10">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
