"use client";

import { Drawer } from "vaul";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 flex flex-col rounded-t-2xl">
          <Drawer.Handle className="mx-auto mt-3 !h-1.5 !w-10 !rounded-full !bg-zinc-300 !opacity-100 touch-none" />
          <div className="mx-auto w-full max-w-sm px-6 pt-4 pb-10 flex flex-col gap-6">
            <Drawer.Title className="text-lg font-semibold">
              {title}
            </Drawer.Title>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
