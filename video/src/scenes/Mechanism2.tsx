import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Coins, XCircle } from "lucide-react";
import { C } from "../colors";
import { fontFamily } from "../fonts";

const EASE   = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_F = Easing.bezier(0.4, 0, 0.2, 1);
const ci = (f: number, f0: number, f1: number, v0: number, v1: number, e = EASE) =>
  interpolate(f, [f0, f1], [v0, v1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

const W = 1920, H = 1080;
const BOX = 160;

// Actor positions
const A   = { x: 960,  y: 530 }; // Account (center)
const ATK = { x: 290,  y: 530 }; // Attacker (left)
const OWN = { x: 1630, y: 530 }; // Owner (right)
const WT  = { x: 960,  y: 180 }; // Watchtower (top)

// Edge points
const E = {
  a_t:   { x: A.x,              y: A.y   - BOX / 2 },
  a_l:   { x: A.x   - BOX / 2,  y: A.y             },
  a_r:   { x: A.x   + BOX / 2,  y: A.y             },
  atk_r: { x: ATK.x + BOX / 2,  y: ATK.y           },
  atk_t: { x: ATK.x,            y: ATK.y - BOX / 2 },
  own_l: { x: OWN.x - BOX / 2,  y: OWN.y           },
  wt_b:  { x: WT.x,             y: WT.y  + BOX / 2 },
  wt_l:  { x: WT.x  - BOX / 2,  y: WT.y            },
  wt_r:  { x: WT.x  + BOX / 2,  y: WT.y            },
  own_t: { x: OWN.x,            y: OWN.y - BOX / 2 },
};

const ARR_LOCK   = E.a_l.x - E.atk_r.x;         // 510 — Attacker→Account
const ARR_VETO1  = E.own_l.x - E.a_r.x;          // 510 — Owner→Account (P1)
const SK = { x: (E.atk_r.x + E.a_l.x) / 2, y: ATK.y + 62 }; // stake midpoint

// SVG arc paths
const CONTACT_PATH_ATK = `M ${E.wt_l.x} ${E.wt_l.y} C 700 60, 180 290, ${E.atk_t.x} ${E.atk_t.y}`;
const CONTACT_PATH_OWN = `M ${E.wt_r.x} ${E.wt_r.y} C 1220 60, 1750 290, ${E.own_t.x} ${E.own_t.y}`;
const VETO_PATH_WT = `M ${E.wt_b.x} ${E.wt_b.y} C 800 300, 700 430, ${SK.x} ${SK.y}`;

const STAKE_SZ = 72;
const CHECK_SZ = 60;
const TIMER_W  = 200, TIMER_H = 10;

// ── Timings ──────────────────────────────────────────────────
// Phase 1: Lock + Veto (no WT)   0–8s = 0–240f
const P1 = {
  acct_in:    5,
  atk_in:    18,
  atk_ar_in: 30, atk_ar_out: 56,
  tm_s:      44,
  own_in:    68,
  veto_in:  110, veto_out: 135,
  seized:   142,
  mk_s:     145, mk_e: 167,
  fade_s:   200, fade_e: 232,
} as const;

// Phase 2: Watchtowers (owner unavailable)   8s–18s = 232–540f
const P2 = {
  start:     232,
  acct_in:   242,
  atk_in:    255,
  atk_ar_in: 267, atk_ar_out: 293,
  tm_s:      281,
  wt_in:     305,
  mon_in:    320,
  ck_in:     358, ck_out: 385,
  nl_in:     392,
  veto_in:   412, veto_out: 437,
  seized:    444,
  mk_s:      447, mk_e: 469,
  fade_s:    510, fade_e: 545,
} as const;

// Phase 3: Privacy   18s–35s = 540–1050f
const P3 = {
  start:    545,
  accts:    555,
  wts:      615,
  links:    695,
  blink_s:  760, blink_e: 990,
  caption: 1010,
} as const;

export const MECH2_FRAMES = 1050;

// ── Reusable box actor ────────────────────────────────────────
const Box: React.FC<{
  cx: number; cy: number; label: string; fromFrame: number;
  bg?: string; fadeOut?: [number, number]; pulse?: [number, number]; dim?: boolean;
}> = ({ cx, cy, label, fromFrame, bg = C.box, fadeOut, pulse, dim }) => {
  const f = useCurrentFrame();
  let op = ci(f, fromFrame, fromFrame + 12, 0, 1);
  if (fadeOut) op *= ci(f, fadeOut[0], fadeOut[1], 1, 0);
  let ps = 1;
  if (pulse) ps = interpolate(f, [pulse[0], (pulse[0] + pulse[1]) / 2, pulse[1]], [1, 1.07, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <div style={{
      position: "absolute", left: cx - BOX / 2, top: cy - BOX / 2,
      width: BOX, height: BOX,
      backgroundColor: dim ? C.boxDim : bg,
      borderRadius: 16,
      display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "0 10px",
      opacity: op * (dim ? 0.35 : 1),
      scale: String(ci(f, fromFrame, fromFrame + 12, 0.88, 1) * ps),
      fontFamily, fontSize: 32, fontWeight: 500,
      color: dim ? C.muted : C.bright, lineHeight: 1.2,
    }}>{label}</div>
  );
};

// 60s = 1800 frames
export const Mechanism2: React.FC = () => {
  const frame = useCurrentFrame();

  const inP1 = frame < P2.start;
  const inP2 = frame >= P2.start && frame < P3.start;
  const inP3 = frame >= P3.start;

  const p1Fade = frame < P1.fade_s ? 1 : ci(frame, P1.fade_s, P1.fade_e, 1, 0);
  const p2Fade = frame < P2.fade_s ? 1 : ci(frame, P2.fade_s, P2.fade_e, 1, 0);

  // ── P1 anim values ──
  const p1ArPrg  = ci(frame, P1.atk_ar_in,      P1.atk_ar_out,      0, 1, EASE_F);
  const p1ArHd   = ci(frame, P1.atk_ar_out - 4,  P1.atk_ar_out + 3,  0, 1, EASE_F);
  const p1ArLbl  = ci(frame, P1.atk_ar_out,      P1.atk_ar_out + 8,  0, 1);
  const p1TmPrg  = ci(frame, P1.tm_s,            P1.fade_s - 30,     0, 1, Easing.linear);
  const p1TmOp   = ci(frame, P1.tm_s,            P1.tm_s + 8,        0, 1);
  const p1VtPrg  = ci(frame, P1.veto_in,         P1.veto_out,        0, 1, EASE_F);
  const p1VtHd   = ci(frame, P1.veto_out - 4,    P1.veto_out + 3,    0, 1, EASE_F);
  const p1VtLbl  = ci(frame, P1.veto_out,        P1.veto_out + 8,    0, 1);
  const p1SzLbl  = ci(frame, P1.seized,          P1.seized + 8,      0, 1);
  const p1SkX    = frame < P1.atk_ar_in  ? ATK.x
    : frame < P1.atk_ar_out ? ci(frame, P1.atk_ar_in,  P1.atk_ar_out, ATK.x, SK.x, EASE_F)
    : frame < P1.mk_s        ? SK.x
    : ci(frame, P1.mk_s, P1.mk_e, SK.x, A.x, EASE_F);
  const p1SkY    = frame < P1.atk_ar_in  ? ATK.y
    : frame < P1.atk_ar_out ? ci(frame, P1.atk_ar_in,  P1.atk_ar_out, ATK.y, SK.y, EASE_F)
    : frame < P1.mk_s        ? SK.y
    : ci(frame, P1.mk_s, P1.mk_e, SK.y, A.y, EASE_F);
  const p1SkOp   = frame < P1.atk_ar_in  ? 0
    : frame < P1.mk_e ? ci(frame, P1.atk_ar_in, P1.atk_ar_in + 10, 0, 1)
    : ci(frame, P1.mk_e, P1.mk_e + 12, 1, 0);

  // ── P2 anim values ──
  const p2ArPrg  = ci(frame, P2.atk_ar_in,      P2.atk_ar_out,      0, 1, EASE_F);
  const p2ArHd   = ci(frame, P2.atk_ar_out - 4,  P2.atk_ar_out + 3,  0, 1, EASE_F);
  const p2ArLbl  = ci(frame, P2.atk_ar_out,      P2.atk_ar_out + 8,  0, 1);
  const p2TmPrg  = ci(frame, P2.tm_s,            P2.veto_in,         0, 0.38, Easing.linear);
  const p2TmOp   = ci(frame, P2.tm_s,            P2.tm_s + 8,        0, 1);
  const p2MonOp  = inP2 ? ci(frame, P2.mon_in, P2.mon_in + 15, 0, 1) : 0;
  // check arc toward Attacker (left)
  const p2CkPrg  = ci(frame, P2.ck_in,           P2.ck_out,          0, 1, EASE_F);
  const p2CkHd   = ci(frame, P2.ck_out - 4,      P2.ck_out + 3,      0, 1, EASE_F);
  const p2CkLbl  = ci(frame, P2.ck_out,          P2.ck_out + 8,      0, 1);
  // check arc toward Owner (right) — same timing, mirrored
  const p2CkOPrg = ci(frame, P2.ck_in,           P2.ck_out,          0, 1, EASE_F);
  const p2CkOHd  = ci(frame, P2.ck_out - 4,      P2.ck_out + 3,      0, 1, EASE_F);
  const p2NlOp   = ci(frame, P2.nl_in,           P2.nl_in + 8,       0, 1);
  const p2VtPrg  = ci(frame, P2.veto_in,         P2.veto_out,        0, 1, EASE_F);
  const p2VtHd   = ci(frame, P2.veto_out - 4,    P2.veto_out + 3,    0, 1, EASE_F);
  const p2VtLbl  = ci(frame, P2.veto_out,        P2.veto_out + 8,    0, 1);
  const p2SzLbl  = ci(frame, P2.seized,          P2.seized + 8,      0, 1);
  const p2SkX    = frame < P2.atk_ar_in  ? ATK.x
    : frame < P2.atk_ar_out ? ci(frame, P2.atk_ar_in,  P2.atk_ar_out, ATK.x, SK.x, EASE_F)
    : frame < P2.mk_s        ? SK.x
    : ci(frame, P2.mk_s, P2.mk_e, SK.x, A.x, EASE_F);
  const p2SkY    = frame < P2.atk_ar_in  ? ATK.y
    : frame < P2.atk_ar_out ? ci(frame, P2.atk_ar_in,  P2.atk_ar_out, ATK.y, SK.y, EASE_F)
    : frame < P2.mk_s        ? SK.y
    : ci(frame, P2.mk_s, P2.mk_e, SK.y, A.y, EASE_F);
  const p2SkOp   = frame < P2.atk_ar_in  ? 0
    : frame < P2.mk_e ? ci(frame, P2.atk_ar_in, P2.atk_ar_in + 10, 0, 1)
    : ci(frame, P2.mk_e, P2.mk_e + 12, 1, 0);

  // ── P3 ──
  const P3_ACCTS = [{ x: 380, y: 550 }, { x: 960, y: 550 }, { x: 1540, y: 550 }];
  const P3_WTS   = [{ x: 380, y: 200 }, { x: 960, y: 200 }, { x: 1540, y: 200 }];
  const blink = (seed: number) =>
    inP3 && frame >= P3.blink_s && frame < P3.blink_e
      ? 0.25 + 0.75 * Math.abs(Math.sin((frame - P3.blink_s) * (0.055 + seed * 0.022) + seed * 1.8))
      : 1;

  // Panel label opacities
  const lbP1Op = inP1 ? ci(frame, P1.acct_in,  P1.acct_in  + 12, 0, 1) * p1Fade : 0;
  const lbP2Op = inP2 ? ci(frame, P2.start,     P2.start    + 12, 0, 1) * p2Fade : 0;
  const lbP3Op = inP3 ? ci(frame, P3.start,     P3.start    + 12, 0, 1)           : 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>

      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox={`0 0 ${W} ${H}`}>

        {/* ── PHASE 1: Lock + Veto (owner present, no WT) ── */}

        {inP1 && frame >= P1.atk_ar_in && (
          <g opacity={p1Fade}>
            {/* Attacker → Account: locks stake */}
            <line x1={E.atk_r.x} y1={E.atk_r.y} x2={E.a_l.x} y2={E.a_l.y}
              stroke={C.text} strokeWidth={2.5}
              strokeDasharray={ARR_LOCK} strokeDashoffset={ARR_LOCK * (1 - p1ArPrg)}
              strokeLinecap="round" />
            <g transform={`translate(${E.a_l.x},${E.a_l.y})`} opacity={p1ArHd}>
              <polygon points="-16,-6 0,0 -16,6" fill={C.text} />
            </g>
            <text x={(E.atk_r.x + E.a_l.x) / 2} y={ATK.y - 28}
              textAnchor="middle" fontSize={28} fontFamily={fontFamily}
              fill={C.text} fontWeight={600} opacity={p1ArLbl}>locks stake</text>
          </g>
        )}

        {inP1 && frame >= P1.tm_s && (
          <g opacity={p1TmOp * p1Fade}>
            <rect x={A.x - TIMER_W / 2} y={A.y + BOX / 2 + 20} width={TIMER_W} height={TIMER_H} rx={5} fill={C.boxDim} />
            <rect x={A.x - TIMER_W / 2} y={A.y + BOX / 2 + 20}
              width={TIMER_W * p1TmPrg} height={TIMER_H} rx={5} fill={C.accent} />
            <text x={A.x} y={A.y + BOX / 2 + 62} textAnchor="middle"
              fontSize={26} fontFamily={fontFamily} fill={C.muted} fontWeight={500}>timelock</text>
          </g>
        )}

        {/* Owner → Account: veto (right-to-left arrow) */}
        {inP1 && frame >= P1.veto_in && (
          <g opacity={p1Fade}>
            <line x1={E.own_l.x} y1={E.own_l.y} x2={E.a_r.x} y2={E.a_r.y}
              stroke={C.accent} strokeWidth={3}
              strokeDasharray={ARR_VETO1} strokeDashoffset={ARR_VETO1 * (1 - p1VtPrg)}
              strokeLinecap="round" />
            <g transform={`translate(${E.a_r.x},${E.a_r.y}) rotate(180)`} opacity={p1VtHd}>
              <polygon points="-16,-6 0,0 -16,6" fill={C.accent} />
            </g>
            <text x={(E.own_l.x + E.a_r.x) / 2} y={OWN.y - 28}
              textAnchor="middle" fontSize={28} fontFamily={fontFamily}
              fill={C.accent} fontWeight={700} opacity={p1VtLbl}>veto</text>
          </g>
        )}

        {inP1 && frame >= P1.seized && (
          <text x={A.x} y={A.y + BOX / 2 + 98} textAnchor="middle"
            fontSize={36} fontFamily={fontFamily} fill={C.accent} fontWeight={700}
            opacity={p1SzLbl * p1Fade}>stake seized ✓</text>
        )}

        {/* ── PHASE 2: Watchtowers (owner unavailable) ── */}

        {inP2 && frame >= P2.atk_ar_in && (
          <g opacity={p2Fade}>
            <line x1={E.atk_r.x} y1={E.atk_r.y} x2={E.a_l.x} y2={E.a_l.y}
              stroke={C.text} strokeWidth={2.5}
              strokeDasharray={ARR_LOCK} strokeDashoffset={ARR_LOCK * (1 - p2ArPrg)}
              strokeLinecap="round" />
            <g transform={`translate(${E.a_l.x},${E.a_l.y})`} opacity={p2ArHd}>
              <polygon points="-16,-6 0,0 -16,6" fill={C.text} />
            </g>
            <text x={(E.atk_r.x + E.a_l.x) / 2} y={ATK.y - 28}
              textAnchor="middle" fontSize={28} fontFamily={fontFamily}
              fill={C.text} fontWeight={600} opacity={p2ArLbl}>locks stake</text>
          </g>
        )}

        {/* WT monitors line */}
        {inP2 && (
          <g opacity={p2MonOp * p2Fade}>
            <line x1={E.wt_b.x} y1={E.wt_b.y} x2={E.a_t.x} y2={E.a_t.y}
              stroke={C.muted} strokeWidth={2} strokeDasharray="10 7" strokeLinecap="round" />
            <text x={WT.x + 28} y={(E.wt_b.y + E.a_t.y) / 2}
              fontSize={28} fontFamily={fontFamily} fill={C.muted} fontWeight={600}
              dominantBaseline="middle">monitors</text>
          </g>
        )}

        {inP2 && frame >= P2.tm_s && (
          <g opacity={p2TmOp * p2Fade}>
            <rect x={A.x - TIMER_W / 2} y={A.y + BOX / 2 + 20} width={TIMER_W} height={TIMER_H} rx={5} fill={C.boxDim} />
            <rect x={A.x - TIMER_W / 2} y={A.y + BOX / 2 + 20}
              width={TIMER_W * p2TmPrg} height={TIMER_H} rx={5} fill={C.accent} />
            <text x={A.x} y={A.y + BOX / 2 + 62} textAnchor="middle"
              fontSize={26} fontFamily={fontFamily} fill={C.muted} fontWeight={500}>timelock</text>
          </g>
        )}

        {/* WT off-chain check arcs — left (Attacker) + right (Owner) */}
        {inP2 && frame >= P2.ck_in && (
          <g opacity={p2Fade}>
            {/* → Attacker */}
            <path d={CONTACT_PATH_ATK} stroke={C.bright} strokeWidth={2} fill="none"
              strokeDasharray={950} strokeDashoffset={950 * (1 - p2CkPrg)}
              strokeLinecap="round" opacity={0.65} />
            <g transform={`translate(${E.atk_t.x},${E.atk_t.y}) rotate(56)`} opacity={p2CkHd * 0.65}>
              <polygon points="-14,-5 0,0 -14,5" fill={C.bright} />
            </g>
            {/* → Owner */}
            <path d={CONTACT_PATH_OWN} stroke={C.bright} strokeWidth={2} fill="none"
              strokeDasharray={950} strokeDashoffset={950 * (1 - p2CkOPrg)}
              strokeLinecap="round" opacity={0.65} />
            <g transform={`translate(${E.own_t.x},${E.own_t.y}) rotate(124)`} opacity={p2CkOHd * 0.65}>
              <polygon points="-14,-5 0,0 -14,5" fill={C.bright} />
            </g>
            {/* shared label, centered */}
            <text x={960} y={100} textAnchor="middle"
              fontSize={28} fontFamily={fontFamily} fill={C.bright} fontWeight={600}
              opacity={p2CkLbl * 0.65}>off-chain check</text>
          </g>
        )}

        {inP2 && frame >= P2.nl_in && (
          <text x={ATK.x} y={ATK.y - BOX / 2 - 20} textAnchor="middle"
            fontSize={32} fontFamily={fontFamily} fill="#ff5555" fontWeight={700}
            opacity={p2NlOp * p2Fade}>not legit</text>
        )}

        {/* WT veto arc */}
        {inP2 && frame >= P2.veto_in && (
          <g opacity={p2Fade}>
            <path d={VETO_PATH_WT} stroke={C.accent} strokeWidth={3} fill="none"
              strokeDasharray={620} strokeDashoffset={620 * (1 - p2VtPrg)} strokeLinecap="round" />
            <g transform={`translate(${SK.x},${SK.y}) rotate(114)`} opacity={p2VtHd}>
              <polygon points="-16,-6 0,0 -16,6" fill={C.accent} />
            </g>
            <text x={710} y={370} textAnchor="middle"
              fontSize={28} fontFamily={fontFamily} fill={C.accent} fontWeight={700} opacity={p2VtLbl}>
              veto: seizes stake
            </text>
          </g>
        )}

        {inP2 && frame >= P2.seized && (
          <text x={A.x} y={A.y + BOX / 2 + 98} textAnchor="middle"
            fontSize={36} fontFamily={fontFamily} fill={C.accent} fontWeight={700}
            opacity={p2SzLbl * p2Fade}>stake seized ✓</text>
        )}

        {/* ── PHASE 3: Privacy ── */}
        {inP3 && P3_ACCTS.map((acct, i) => {
          const wt       = P3_WTS[i];
          const acctOp   = ci(frame, P3.accts, P3.accts + 18, 0, 1) * blink(i);
          const wtOp     = ci(frame, P3.wts,   P3.wts   + 18, 0, 1);
          const linkOp   = ci(frame, P3.links,  P3.links  + 15, 0, 1);
          const qOp      = ci(frame, P3.wts + 22, P3.wts + 38, 0, 1) * blink(i + 3);
          return (
            <g key={i}>
              <line x1={wt.x} y1={wt.y + BOX / 2} x2={acct.x} y2={acct.y - BOX / 2}
                stroke="#444" strokeWidth={2} strokeDasharray="10 7" opacity={linkOp} />
              {/* Account box */}
              <rect x={acct.x - BOX / 2} y={acct.y - BOX / 2}
                width={BOX} height={BOX} rx={16} fill={C.box} opacity={acctOp} />
              <text x={acct.x} y={acct.y} textAnchor="middle"
                fontSize={30} fontFamily={fontFamily} fill={C.bright} fontWeight={500}
                dominantBaseline="middle" opacity={acctOp}>Account</text>
              {/* WT box */}
              <rect x={wt.x - BOX / 2} y={wt.y - BOX / 2}
                width={BOX} height={BOX} rx={16} fill={C.boxDim} opacity={wtOp} />
              <text x={wt.x} y={wt.y - 10} textAnchor="middle"
                fontSize={22} fontFamily={fontFamily} fill={C.muted} fontWeight={500}
                dominantBaseline="middle" opacity={wtOp}>Watch­tower</text>
              {/* "?" — WT doesn't know the owner */}
              <text x={wt.x} y={wt.y + 22} textAnchor="middle"
                fontSize={38} fontFamily={fontFamily} fill="#666" fontWeight={700}
                dominantBaseline="middle" opacity={qOp}>?</text>
            </g>
          );
        })}

        {inP3 && frame >= P3.caption && (
          <text x={960} y={790} textAnchor="middle"
            fontSize={40} fontFamily={fontFamily} fill={C.text} fontWeight={500}
            opacity={ci(frame, P3.caption, P3.caption + 22, 0, 1)}>
            WTs see on-chain events only — they never know whose account they protect
          </text>
        )}
      </svg>

      {/* ── HTML actors — P1 ── */}
      {inP1 && (
        <>
          <Box cx={A.x}   cy={A.y}   label="Account"  fromFrame={P1.acct_in} fadeOut={[P1.fade_s, P1.fade_e]} />
          <Box cx={ATK.x} cy={ATK.y} label="Attacker" fromFrame={P1.atk_in}  fadeOut={[P1.fade_s, P1.fade_e]} />
          {frame >= P1.own_in && (
            <Box cx={OWN.x} cy={OWN.y} label="Owner" fromFrame={P1.own_in} fadeOut={[P1.fade_s, P1.fade_e]} />
          )}
        </>
      )}

      {/* Stake coin — P1 */}
      {inP1 && frame >= P1.atk_ar_in && (
        <div style={{
          position: "absolute",
          left: p1SkX - STAKE_SZ / 2, top: p1SkY - STAKE_SZ / 2,
          opacity: p1SkOp * p1Fade, color: C.accent, pointerEvents: "none",
        }}>
          <Coins size={STAKE_SZ} strokeWidth={1.8} />
        </div>
      )}

      {/* ── HTML actors — P2 ── */}
      {inP2 && (
        <>
          <Box cx={A.x}   cy={A.y}   label="Account"    fromFrame={P2.acct_in} fadeOut={[P2.fade_s, P2.fade_e]} />
          <Box cx={ATK.x} cy={ATK.y} label="Attacker"   fromFrame={P2.atk_in}  fadeOut={[P2.fade_s, P2.fade_e]} />
          <Box cx={OWN.x} cy={OWN.y} label="Owner"      fromFrame={P2.acct_in} fadeOut={[P2.fade_s, P2.fade_e]} dim />
          <Box cx={WT.x}  cy={WT.y}  label="Watch­tower" fromFrame={P2.wt_in}   fadeOut={[P2.fade_s, P2.fade_e]}
            bg={C.boxDim}
            pulse={frame >= P2.veto_out && inP2 ? [P2.veto_out, P2.veto_out + 40] : undefined}
          />
        </>
      )}

      {/* "unavailable" caption under dim Owner */}
      {inP2 && (
        <div style={{
          position: "absolute", left: OWN.x - 120, top: OWN.y + BOX / 2 + 10,
          fontFamily, fontSize: 26, fontWeight: 500, color: C.muted,
          opacity: ci(frame, P2.acct_in, P2.acct_in + 15, 0, 1) * p2Fade,
          textAlign: "center", width: 240,
        }}>unavailable</div>
      )}

      {/* Stake coin — P2 */}
      {inP2 && frame >= P2.atk_ar_in && (
        <div style={{
          position: "absolute",
          left: p2SkX - STAKE_SZ / 2, top: p2SkY - STAKE_SZ / 2,
          opacity: p2SkOp * p2Fade, color: C.accent, pointerEvents: "none",
        }}>
          <Coins size={STAKE_SZ} strokeWidth={1.8} />
        </div>
      )}

      {/* X icon for attacker (P2) */}
      {inP2 && frame >= P2.nl_in && (
        <div style={{
          position: "absolute",
          left: ATK.x + BOX / 2 + 16, top: ATK.y - BOX / 4 - CHECK_SZ / 2,
          opacity: p2NlOp * p2Fade, color: "#ff5555", pointerEvents: "none",
        }}>
          <XCircle size={CHECK_SZ} strokeWidth={2} />
        </div>
      )}

      {/* Panel labels */}
      <div style={{ position: "absolute", top: 60, left: 80, fontFamily, fontSize: 44, color: C.bright, fontWeight: 500, opacity: lbP1Op }}>
        Lock + Veto
      </div>
      <div style={{ position: "absolute", top: 60, left: 80, fontFamily, fontSize: 44, color: C.bright, fontWeight: 500, opacity: lbP2Op }}>
        Watchtowers
      </div>
      <div style={{ position: "absolute", top: 60, left: 80, fontFamily, fontSize: 44, color: C.bright, fontWeight: 500, opacity: lbP3Op }}>
        Privacy
      </div>

    </AbsoluteFill>
  );
};
