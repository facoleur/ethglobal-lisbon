import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

const LOGO_W = 1200;
const LOGO_H = Math.round(LOGO_W * (871 / 4269)); // 245
import { C } from "../colors";
import { fontFamily } from "../fonts";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const ci = (f: number, f0: number, f1: number, v0: number, v1: number, e = EASE) =>
  interpolate(f, [f0, f1], [v0, v1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

const T = {
  logo:  6,
  tag:   45,
  links: 75,
};

// 15s = 450 frames
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOp = ci(frame, T.logo, T.logo + 30, 0, 1);
  const logoSc = ci(frame, T.logo, T.logo + 45, 0.88, 1);

  const tagOp = ci(frame, T.tag, T.tag + 22, 0, 1);
  const tagY  = ci(frame, T.tag, T.tag + 35, 24, 0);

  const linkOp = ci(frame, T.links, T.links + 25, 0, 1);
  const linkY  = ci(frame, T.links, T.links + 35, 20, 0);

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

      {/* Logo */}
      <Img
        src={staticFile("chateau_logo.svg")}
        style={{
          width: LOGO_W,
          height: LOGO_H,
          opacity: logoOp,
          scale: String(logoSc),
        }}
      />

      {/* Tagline */}
      <div
        style={{
          fontFamily,
          fontSize: 68,
          fontWeight: 400,
          color: C.text,
          opacity: tagOp,
          translate: `0px ${tagY}px`,
          marginTop: 28,
          textAlign: "center",
          maxWidth: 1300,
          lineHeight: 1.3,
        }}
      >
        The forgot-my-password flow for self-custody
      </div>

      {/* Links */}
      <div
        style={{
          position: "absolute",
          bottom: 90,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 80,
          opacity: linkOp,
          translate: `0px ${linkY}px`,
        }}
      >
        {["github · eth-global / chateau", "ethglobal.com/showcase/chateau"].map((link) => (
          <div
            key={link}
            style={{
              fontFamily,
              fontSize: 32,
              color: C.muted,
              fontWeight: 500,
            }}
          >
            {link}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
