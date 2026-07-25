"use client";

import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useSwipeBack } from "@/lib/native/use-swipe-back";
import type React from "react";

type PageTransitionProps = {
  children: React.ReactNode;
  enableSwipeBack?: boolean;
};

export function PageTransition({
  children,
  enableSwipeBack = true,
}: PageTransitionProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { dragX, handlers } = useSwipeBack({ onBack: () => router.back() });

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={pathname}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 40, mass: 0.8 }}
        style={{ x: dragX }}
        className="h-full w-full"
        {...(enableSwipeBack ? handlers : {})}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
