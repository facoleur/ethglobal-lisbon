import { useMotionValue, animate } from "motion/react";
import { useRef, useState, useEffect } from "react";
import type React from "react";

type SwipeBackOptions = {
  onBack: () => void;
  threshold?: number;
  edgeZone?: number;
};

type SwipeBackReturn = {
  dragX: ReturnType<typeof useMotionValue<number>>;
  isGesturing: boolean;
  handlers: {
    onTouchStart: React.TouchEventHandler;
    onTouchMove: React.TouchEventHandler;
    onTouchEnd: React.TouchEventHandler;
  };
};

export function useSwipeBack({
  onBack,
  threshold = 0.35,
  edgeZone = 20,
}: SwipeBackOptions): SwipeBackReturn {
  const dragX = useMotionValue(0);
  const [isGesturing, setIsGesturing] = useState(false);
  const isActiveRef = useRef(false);
  const startXRef = useRef(0);
  const isStandaloneRef = useRef(false);

  useEffect(() => {
    isStandaloneRef.current = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;
  }, []);

  const onTouchStart: React.TouchEventHandler = (e) => {
    if (!isStandaloneRef.current) return;
    const clientX = e.touches[0].clientX;
    if (clientX < edgeZone) {
      isActiveRef.current = true;
      startXRef.current = clientX;
    }
  };

  const onTouchMove: React.TouchEventHandler = (e) => {
    if (!isStandaloneRef.current || !isActiveRef.current) return;
    const delta = e.touches[0].clientX - startXRef.current;
    dragX.set(Math.max(0, delta));
    if (!isGesturing) setIsGesturing(true);
  };

  const onTouchEnd: React.TouchEventHandler = () => {
    if (!isStandaloneRef.current || !isActiveRef.current) return;
    isActiveRef.current = false;
    setIsGesturing(false);

    if (dragX.get() > threshold * window.innerWidth) {
      onBack();
      dragX.set(0);
    } else {
      animate(dragX, 0, {
        type: "spring",
        stiffness: 400,
        damping: 40,
        mass: 0.8,
      });
    }
  };

  return {
    dragX,
    isGesturing,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
