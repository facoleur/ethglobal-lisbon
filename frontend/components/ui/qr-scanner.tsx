"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import jsQR from "jsqr";
import { haptic } from "@/lib/haptics";

type QrScannerProps = {
  onDetect: (value: string) => void;
  onClose: () => void;
};

export function QrScanner({ onDetect, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const detectedRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    function scan() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || detectedRef.current) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          detectedRef.current = true;
          haptic("medium");
          onDetect(code.data);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(scan);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          rafRef.current = requestAnimationFrame(scan);
        }
      } catch {
        onClose();
      }
    }

    start();

    return () => {
      cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetect, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* vignette */}
      <div className="absolute inset-0 bg-black/40" />

      {/* scan frame */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative size-64">
          <div className="absolute top-0 left-0 h-9 w-9 rounded-tl-xl border-t-[3px] border-l-[3px] border-white/80" />
          <div className="absolute top-0 right-0 h-9 w-9 rounded-tr-xl border-t-[3px] border-r-[3px] border-white/80" />
          <div className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-xl border-b-[3px] border-l-[3px] border-white/80" />
          <div className="absolute bottom-0 right-0 h-9 w-9 rounded-br-xl border-b-[3px] border-r-[3px] border-white/80" />
        </div>
      </div>

      {/* close button */}
      <button
        onClick={onClose}
        className="absolute top-14 right-6 flex size-11 items-center justify-center rounded-full bg-white/20"
      >
        <X className="size-5 text-white" />
      </button>
    </div>
  );
}
