import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { C } from "../colors";
import { fontFamily } from "../fonts";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const ci = (
  f: number,
  f0: number,
  f1: number,
  v0: number,
  v1: number,
  e = EASE,
) =>
  interpolate(f, [f0, f1], [v0, v1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: e,
  });

// Phone display dimensions — 720×1600 source scaled to fit 1080 canvas
const PHONE_H = 880;
const PHONE_W = Math.round(PHONE_H * (720 / 1600)); // 396
const BEZEL = 12;
const CORNER = 46;

// Crop 40 source-px from the top (watermark) → 40 * (880/1600) ≈ 22 display-px
const CROP_PX = Math.round(40 * (PHONE_H / 1600));

const ENTER = 40; // phone slide-in duration

export interface DemoSceneProps {
  trimSourceSecs: number;
  sourceDurationSecs: number;
  titleLine1: string;
  titleLine2: string;
}

export const DemoWatchtower: React.FC = () => (
  <DemoScene
    trimSourceSecs={0}
    sourceDurationSecs={25}
    titleLine1="Add a"
    titleLine2="Watchtower"
  />
);

export const DemoRecover: React.FC = () => (
  <DemoScene
    trimSourceSecs={31}
    sourceDurationSecs={64.4 - 31}
    titleLine1="Recover"
    titleLine2="a wallet"
  />
);

const DemoScene: React.FC<DemoSceneProps> = ({
  trimSourceSecs,
  sourceDurationSecs,
  titleLine1,
  titleLine2,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const phoneCx = Math.round(width * 0.36); // phone offset left
  const cy = height / 2;

  const trimFrames = Math.round(trimSourceSecs * fps);
  const vidDurationFrames = Math.ceil(sourceDurationSecs * fps);

  // Phone entrance
  const phoneOp = ci(frame, 0, ENTER, 0, 1);
  const phoneY = ci(frame, 0, ENTER, 70, 0);
  const phoneScale = ci(frame, 0, ENTER, 0.9, 1);

  // Accent glow behind phone
  const glowOp = ci(frame, 20, ENTER + 10, 0, 0.15);

  // Title entrance — slides in from right
  const titleOp = ci(frame, ENTER + 5, ENTER + 30, 0, 1);
  const titleX = ci(frame, ENTER + 5, ENTER + 30, 50, 0);

  // Panel label
  const labelOp = ci(frame, 15, 35, 0, 1);

  // Title panel left edge (right of phone + gap)
  const titleLeft = phoneCx + PHONE_W / 2 + BEZEL + 100;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Accent glow behind phone */}
      <div
        style={{
          position: "absolute",
          left: phoneCx - 400,
          top: cy - 500,
          width: 800,
          height: 1000,
          background: `radial-gradient(ellipse at 50% 50%, ${C.accent}, transparent 70%)`,
          opacity: glowOp,
          pointerEvents: "none",
        }}
      />
      {/* Phone body */}
      <div
        style={{
          position: "absolute",
          left: phoneCx - PHONE_W / 2 - BEZEL,
          top: cy - PHONE_H / 2 - BEZEL,
          width: PHONE_W + BEZEL * 2,
          height: PHONE_H + BEZEL * 2,
          backgroundColor: "#111111",
          borderRadius: CORNER + BEZEL,
          opacity: phoneOp,
          translate: `0px ${phoneY}px`,
          scale: String(phoneScale),
          boxShadow: "0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px #222",
        }}
      >
        {/* Screen */}
        <div
          style={{
            position: "absolute",
            left: BEZEL,
            top: BEZEL,
            width: PHONE_W,
            height: PHONE_H,
            borderRadius: CORNER,
            overflow: "hidden",
            backgroundColor: "#000",
          }}
        >
          <Video
            src={staticFile("screenrec_1.mp4")}
            trimBefore={trimFrames}
            durationInFrames={vidDurationFrames}
            style={{
              position: "absolute",
              top: -CROP_PX,
              left: 0,
              width: "100%",
              height: `calc(100% + ${CROP_PX}px)`,
              objectFit: "cover",
            }}
            from={-46}
          />
        </div>
      </div>
      {/* Title panel — right side */}
      <div
        style={{
          position: "absolute",
          left: titleLeft,
          top: cy - 140,
          right: 100,
          opacity: titleOp,
          translate: `${titleX}px 0px`,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 36,
            fontWeight: 500,
            color: C.muted,
            marginBottom: 24,
            lineHeight: 1,
          }}
        >
          demo
        </div>
        <div
          style={{
            fontFamily,
            fontSize: 100,
            fontWeight: 500,
            color: C.bright,
            lineHeight: 1.1,
          }}
        >
          {titleLine1}
          <br />
          <span style={{ color: C.accent }}>{titleLine2}</span>
        </div>
      </div>
      {/* Panel label top-left */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 80,
          fontFamily,
          fontSize: 44,
          color: C.bright,
          fontWeight: 500,
          opacity: labelOp,
        }}
      >
        Demo
      </div>
    </AbsoluteFill>
  );
};
