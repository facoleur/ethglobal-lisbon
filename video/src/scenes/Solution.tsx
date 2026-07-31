import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { C } from "../colors";
import { fontFamily } from "../fonts";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const ci = (f: number, f0: number, f1: number, v0: number, v1: number, e = EASE) =>
  interpolate(f, [f0, f1], [v0, v1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

// Logo: 4269×871 → ratio 4.9:1
const LOGO_W = 860;
const LOGO_H = Math.round(LOGO_W * (871 / 4269)); // ~176px

const T = { label: 0, name: 15, tag: 80, prin: 260 };

// 30s = 900 frames
export const Solution: React.FC = () => {
  const frame = useCurrentFrame();

  const labelOp = ci(frame, T.label, T.label + 20, 0, 1);
  const nameOp  = ci(frame, T.name, T.name + 25, 0, 1);
  const nameSc  = ci(frame, T.name, T.name + 40, 0.84, 1);
  const tagOp   = ci(frame, T.tag, T.tag + 22, 0, 1);
  const tagY    = ci(frame, T.tag, T.tag + 35, 28, 0);

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >

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
        The solution
      </div>

      {/* Logo — espace de sécurité via margin */}
      <div style={{ margin: "0 80px", opacity: nameOp, scale: String(nameSc) }}>
        <Img
          src={staticFile("chateau_logo.svg")}
          style={{ width: LOGO_W, height: LOGO_H, display: "block" }}
        />
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily,
          fontSize: 54,
          fontWeight: 400,
          color: C.text,
          opacity: tagOp,
          translate: `0px ${tagY}px`,
          marginTop: 40,
          textAlign: "center",
          maxWidth: 1200,
          lineHeight: 1.35,
        }}
      >
        The forgot-my-password flow for self-custody
      </div>

    </AbsoluteFill>
  );
};
