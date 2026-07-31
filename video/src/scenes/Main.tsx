import { AbsoluteFill, Img, Series, staticFile } from "remotion";
import { Hook } from "./Hook";
import { Problem } from "./Problem";
import { Solution } from "./Solution";
import { Mechanism2, MECH2_FRAMES } from "./Mechanism2";
import { DemoWatchtower, DemoRecover } from "./Demo";
import { Future } from "./Future";
import { Outro } from "./Outro";

const FPS = 30;

// Durations per scene (frames)
export const DURATIONS = {
  hook:      5  * FPS,  //  150  — 0:00–0:05
  problem:   7  * FPS,  //  210  — 0:05–0:12
  solution:  5  * FPS,  //  150  — 0:12–0:17
  mechanism: MECH2_FRAMES, // 1050 — 0:17–0:52  (Mechanism2)
  demoWt:    27 * FPS,  //  810  — 1:17–1:44  (inchangé)
  demoRec:   Math.ceil((64.4 - 31) * FPS) + 2 * FPS, // 1062 — 1:44–2:22  (inchangé)
  future:    5  * FPS,  //  150  — 2:22–2:27
  outro:     4  * FPS,  //  120  — 2:27–2:31
} as const;

export const TOTAL_FRAMES = Object.values(DURATIONS).reduce((a, b) => a + b, 0);
// 150+210+150+1800+810+1062+150+120 = 4452 frames ≈ 2:28

export const Main: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000000" }}>
    <Img
      src={staticFile("bg.png")}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }}
    />
    <Series>
      <Series.Sequence durationInFrames={DURATIONS.hook}>
        <Hook />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.problem}>
        <Problem />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.solution}>
        <Solution />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.mechanism}>
        <Mechanism2 />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.demoWt}>
        <DemoWatchtower />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.demoRec}>
        <DemoRecover />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.future}>
        <Future />
      </Series.Sequence>
      <Series.Sequence durationInFrames={DURATIONS.outro}>
        <Outro />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
