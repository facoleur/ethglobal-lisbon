"use client";

import { Drawer } from "vaul";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  titleAction?: React.ReactNode;
  children: React.ReactNode;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  titleAction,
  children,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content className="bg-card fixed right-0 bottom-0 left-0 z-50 flex flex-col rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <Drawer.Handle className="mx-auto mt-3 !h-1.5 !w-10 !rounded-full !bg-zinc-300 !opacity-100 touch-none" />
          <div className="mx-auto w-full max-w-md px-4 pt-4 pb-10 flex flex-col gap-6">
            {(title || titleAction) && (
              <div className="flex items-center justify-between">
                {title && (
                  <Drawer.Title className="text-lg font-semibold">
                    {title}
                  </Drawer.Title>
                )}
                {titleAction}
              </div>
            )}
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
