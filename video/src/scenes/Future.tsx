import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { C } from "../colors";
import { fontFamily } from "../fonts";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const ci = (f: number, f0: number, f1: number, v0: number, v1: number, e = EASE) =>
  interpolate(f, [f0, f1], [v0, v1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

const WALLETS = ["Safe", "Biconomy", "ZeroDev", "Alchemy", "Rhinestone"];

const T = {
  label:   0,
  title:   8,
  sub:     45,
  cta:     75,
  wallets: 95,
};

// 30s = 900 frames
export const Future: React.FC = () => {
  const frame = useCurrentFrame();

  const labelOp = ci(frame, T.label, T.label + 20, 0, 1);

  const titleOp = ci(frame, T.title, T.title + 25, 0, 1);
  const titleSc = ci(frame, T.title, T.title + 40, 0.85, 1);

  const subOp = ci(frame, T.sub, T.sub + 22, 0, 1);
  const subY  = ci(frame, T.sub, T.sub + 35, 28, 0);

  const ctaOp = ci(frame, T.cta, T.cta + 25, 0, 1);
  const ctaY  = ci(frame, T.cta, T.cta + 35, 24, 0);

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
        Beyond Chateau
      </div>

      {/* ERC-7579 */}
      <div
        style={{
          fontFamily,
          fontSize: 180,
          fontWeight: 500,
          color: C.accent,
          lineHeight: 1,
          opacity: titleOp,
          scale: String(titleSc),
        }}
      >
        erc-7579
      </div>

      {/* Module */}
      <div
        style={{
          fontFamily,
          fontSize: 90,
          fontWeight: 400,
          color: C.bright,
          lineHeight: 1,
          opacity: subOp,
          translate: `0px ${subY}px`,
          marginTop: 16,
        }}
      >
        Module
      </div>

      {/* CTA */}
      <div
        style={{
          fontFamily,
          fontSize: 52,
          fontWeight: 400,
          color: C.text,
          lineHeight: 1.4,
          opacity: ctaOp,
          translate: `0px ${ctaY}px`,
          marginTop: 48,
          textAlign: "center",
          maxWidth: 1300,
        }}
      >
        Drop it into any smart account,{" "}
        <span style={{ color: C.bright }}>no app required</span>
      </div>

      {/* Compatible wallets */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 48,
        }}
      >
        {WALLETS.map((name, i) => {
          const wFrom = T.wallets + i * 40;
          const wOp = ci(frame, wFrom, wFrom + 20, 0, 1);
          const wY  = ci(frame, wFrom, wFrom + 30, 20, 0);
          return (
            <div
              key={name}
              style={{
                fontFamily,
                fontSize: 36,
                fontWeight: 500,
                color: C.muted,
                opacity: wOp,
                translate: `0px ${wY}px`,
                backgroundColor: C.boxDim,
                borderRadius: 14,
                padding: "14px 36px",
              }}
            >
              {name}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
