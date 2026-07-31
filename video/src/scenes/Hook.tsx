import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C } from "../colors";
import { fontFamily } from "../fonts";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

const Line: React.FC<{
  text: string;
  fromFrame: number;
  size?: number;
  color?: string;
  weight?: number;
}> = ({ text, fromFrame, size = 48, color = C.text, weight = 400 }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [fromFrame, fromFrame + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  const translateY = interpolate(frame, [fromFrame, fromFrame + 20], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <div
      style={{
        opacity,
        translate: `0px ${translateY}px`,
        fontFamily,
        fontSize: size,
        fontWeight: weight,
        color,
        textAlign: "center",
        lineHeight: 1.2,
        marginBottom: 24,
        maxWidth: 1400,
      }}
    >
      {text}
    </div>
  );
};

// 15 seconds = 450 frames @ 30fps
export const Hook: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        padding: "0 160px",
      }}
    >
      <Line
        text="Seedphrases suck"
        fromFrame={9}
        size={120}
        color={C.bright}
        weight={700}
      />
    </AbsoluteFill>
  );
};
