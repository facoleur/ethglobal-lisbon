import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { KeyRound, Users, Building2 } from "lucide-react";
import { C } from "../colors";
import { fontFamily } from "../fonts";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const ci = (f: number, f0: number, f1: number, v0: number, v1: number, e = EASE) =>
  interpolate(f, [f0, f1], [v0, v1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

const CARD_W = 480;
const CARD_H = 340;
const GAP = 60;

const ITEMS = [
  { Icon: KeyRound, title: "Seed phrases\nbreak",          from: 8   },
  { Icon: Users,    title: "Guardians\nrequire trust",     from: 65  },
  { Icon: Building2,title: "Custody means\nno ownership",  from: 122 },
] as const;


// 30s = 900 frames
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const labelOp = ci(frame, 0, 20, 0, 1);

  const totalW = CARD_W * 3 + GAP * 2;
  const marginL = (width - totalW) / 2;
  const cardTopY = (height - CARD_H) / 2 - 60; // légèrement au-dessus du centre

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>

      <div style={{ position: "absolute", top: 60, left: 80, fontFamily, fontSize: 44, color: C.bright, fontWeight: 500, opacity: labelOp }}>
        The problem
      </div>

      {ITEMS.map(({ Icon, title, from }, i) => {
        const op = ci(frame, from, from + 20, 0, 1);
        const ty = ci(frame, from, from + 30, 40, 0);
        const iconSc = interpolate(frame, [from + 5, from + 30], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.spring({ damping: 9, stiffness: 220 }),
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: marginL + i * (CARD_W + GAP),
              top: cardTopY,
              width: CARD_W,
              height: CARD_H,
              backgroundColor: "rgba(51, 51, 51, 0.55)",
              backdropFilter: "blur(24px)",
              borderRadius: 16,
              padding: "44px 44px",
              opacity: op,
              translate: `0px ${ty}px`,
              display: "flex",
              flexDirection: "column",
              gap: 28,
            }}
          >
            <div style={{ scale: String(iconSc), transformOrigin: "left center" }}>
              <Icon size={72} strokeWidth={1.5} color={C.text} />
            </div>
            <div
              style={{
                fontFamily,
                fontSize: 54,
                fontWeight: 500,
                color: C.bright,
                lineHeight: 1.15,
                whiteSpace: "pre-line",
              }}
            >
              {title}
            </div>
          </div>
        );
      })}

    </AbsoluteFill>
  );
};
