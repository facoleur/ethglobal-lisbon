import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Coins, CircleCheck, XCircle } from "lucide-react";
import { C } from "../colors";
import { fontFamily } from "../fonts";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_F = Easing.bezier(0.4, 0, 0.2, 1);

const ci = (f: number, f0: number, f1: number, v0: number, v1: number, e = EASE) =>
  interpolate(f, [f0, f1], [v0, v1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

// === Layout (1920×1080) ===
const W = 1920, H = 1080;
const BOX = 160;

const A  = { x: 960, y: 530 };
const WT = { x: 960, y: 180 };
const RC = { x: 290, y: 530 };

const E = {
  a_t:  { x: A.x,            y: A.y  - BOX / 2 }, // 960, 450
  a_l:  { x: A.x - BOX / 2,  y: A.y },             // 880, 530
  a_r:  { x: A.x + BOX / 2,  y: A.y },             // 1040, 530
  wt_b: { x: WT.x,           y: WT.y + BOX / 2 },  // 960, 260
  wt_l: { x: WT.x - BOX / 2, y: WT.y },            // 880, 180
  rc_r: { x: RC.x + BOX / 2, y: RC.y },            // 370, 530
  rc_t: { x: RC.x,           y: RC.y - BOX / 2 },  // 290, 450
};

const ARR_LEN = E.a_l.x - E.rc_r.x; // 510
const SK = { x: (E.rc_r.x + E.a_l.x) / 2, y: RC.y + 62 };

const STAKE_SZ = 72;
const CHECK_SZ = 60;

const VETO_PATH    = `M ${E.wt_b.x} ${E.wt_b.y} C 800 300, 700 430, ${SK.x} ${SK.y}`;
const CONTACT_PATH = `M ${E.wt_l.x} ${E.wt_l.y} C 700 60, 180 290, ${E.rc_t.x} ${E.rc_t.y}`;

const TIMER_W = 200, TIMER_H = 10;

// === Timings (frames @ 30fps) — 60s = 1800f ===
// Order: setup → phase 1 owner (legitimate recovery) → phase 2 attacker → phase 3 P3 → punchline
const T = {
  // Setup (0–3s = 0–90f)
  acct_in: 10, wt_in: 28, mon_in: 44, mon_out: 72,

  // Phase 1: Legitimate recovery (3–15s = 90–450f)
  ow_in:     95,
  ow_ar_in:  108,  // 13f après owner — stake sort + flèche
  ow_ar_out: 128,  // 20f (rapide)
  ow_tm_s:   120,  // chevauche la flèche (12f après ar_in)
  ow_ct_in:  215,  // 95f après timer — WT contacte off-chain
  ow_ct_out: 235,  // 20f arc
  ow_vl_in:  240,  // valide
  ow_nv:     255,  // no veto
  ow_tm_e:   285,  // timelock complet — 165f total = 5.5s
  ow_mk_s:   290,  // stake retourne Owner
  ow_mk_e:   310,  // 20f
  ow_suc:    314,  // "Account recovered"
  ow_fd_s:   390,  // fade-out
  ow_fd_e:   418,

  // Phase 2: Attacker (15–27s = 450–810f)
  atk_in:    450,
  atk_ar_in: 462,  // 12f après attacker
  atk_ar_out: 482, // 20f
  atk_tm_s:  474,  // chevauche la flèche (12f après ar_in)
  atk_ck_in: 510,  // WT vérifie l'attaquant (arc off-chain check)
  atk_ck_out: 530, // 20f arc
  atk_nl_in: 535,  // "not legit" + X icon
  atk_vt_in: 565,  // veto déclenché après le check
  atk_vt_out: 585, // 20f
  atk_mv_s:  588,  // stake → Account
  atk_mv_e:  608,  // 20f
  atk_sz:    612,
  atk_fd_s:  680,
  atk_fd_e:  708,

  // Phase 3: What people see (27–41s = 810–1230f)
  p3:      770,
  p3bl_s:  840,
  p3bl_e:  1080,
  p3_end:  1160,

  // Punchline (41–60s = 1230–1800f)
  punch: 1160,
} as const;

// === Boîte acteur carrée ===
const Box: React.FC<{
  cx: number; cy: number; label: string; fromFrame: number;
  bg?: string; fadeOut?: [number, number]; pulse?: [number, number];
}> = ({ cx, cy, label, fromFrame, bg = C.box, fadeOut, pulse }) => {
  const f = useCurrentFrame();
  let op = ci(f, fromFrame, fromFrame + 10, 0, 1);
  if (fadeOut) op *= ci(f, fadeOut[0], fadeOut[1], 1, 0);
  let ps = 1;
  if (pulse) ps = interpolate(f, [pulse[0], (pulse[0] + pulse[1]) / 2, pulse[1]], [1, 1.07, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <div style={{
      position: "absolute", left: cx - BOX / 2, top: cy - BOX / 2,
      width: BOX, height: BOX, backgroundColor: bg, borderRadius: 16,
      display: "flex", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "0 10px",
      opacity: op, scale: String(ci(f, fromFrame, fromFrame + 10, 0.88, 1) * ps),
      fontFamily, fontSize: 32, fontWeight: 500, color: C.bright, lineHeight: 1.2,
    }}>{label}</div>
  );
};

// 60s = 1800 frames
export const Mechanism: React.FC = () => {
  const frame = useCurrentFrame();

  const inOwner = frame >= T.ow_in  && frame < T.atk_in;
  const inAtk   = frame >= T.atk_in && frame < T.p3;
  const inP3    = frame >= T.p3     && frame < T.p3_end;
  void (frame >= T.punch); // inPunch — réservé pour futurs éléments de punchline

  // Fade global de la phase owner (owner-specific elements seulement)
  const owPhaseOp = frame < T.ow_in ? 0
    : frame < T.ow_fd_s ? 1
    : ci(frame, T.ow_fd_s, T.ow_fd_e, 1, 0);

  // Monitors (masqués en P3)
  const monitorsOp = inP3 ? 0
    : frame < T.mon_in  ? 0
    : frame < T.mon_out ? ci(frame, T.mon_in, T.mon_out, 0, 1)
    : 1;

  // === OWNER ===
  const owArPrg = ci(frame, T.ow_ar_in,  T.ow_ar_out, 0, 1, EASE_F);
  const owArHd  = ci(frame, T.ow_ar_out - 4, T.ow_ar_out + 3, 0, 1, EASE_F);
  const owArLbl = ci(frame, T.ow_ar_out, T.ow_ar_out + 8, 0, 1);
  const owTmPrg = ci(frame, T.ow_tm_s,  T.ow_tm_e, 0, 1, Easing.linear);
  const owTmOp  = ci(frame, T.ow_tm_s,  T.ow_tm_s + 8, 0, 1);

  const ctPrg = ci(frame, T.ow_ct_in,  T.ow_ct_out, 0, 1, EASE_F);
  const ctHd  = ci(frame, T.ow_ct_out - 4, T.ow_ct_out + 3, 0, 1, EASE_F);
  const ctLbl = ci(frame, T.ow_ct_out, T.ow_ct_out + 8, 0, 1);

  const vlOp  = ci(frame, T.ow_vl_in, T.ow_vl_in + 8, 0, 1);
  const nvOp  = ci(frame, T.ow_nv,    T.ow_nv + 8, 0, 1);
  const sucOp = ci(frame, T.ow_suc,   T.ow_suc + 10, 0, 1);

  // Stake owner: RC → SK (avec la flèche), attend, puis SK → Account (recovery réussie)
  const owSkX = frame < T.ow_ar_in ? RC.x
    : frame < T.ow_ar_out ? ci(frame, T.ow_ar_in, T.ow_ar_out, RC.x, SK.x, EASE_F)
    : frame < T.ow_mk_s   ? SK.x
    : ci(frame, T.ow_mk_s, T.ow_mk_e, SK.x, A.x, EASE_F);
  const owSkY = frame < T.ow_ar_in ? RC.y
    : frame < T.ow_ar_out ? ci(frame, T.ow_ar_in, T.ow_ar_out, RC.y, SK.y, EASE_F)
    : frame < T.ow_mk_s   ? SK.y
    : ci(frame, T.ow_mk_s, T.ow_mk_e, SK.y, A.y, EASE_F);

  // === ATTACKER ===
  const atkOp    = frame < T.atk_fd_s ? 1 : ci(frame, T.atk_fd_s, T.atk_fd_e, 1, 0);
  const atkArPrg = ci(frame, T.atk_ar_in,  T.atk_ar_out, 0, 1, EASE_F);
  const atkArHd  = ci(frame, T.atk_ar_out - 4, T.atk_ar_out + 3, 0, 1, EASE_F);
  const atkArLbl = ci(frame, T.atk_ar_out, T.atk_ar_out + 8, 0, 1);
  const atkTmPrg = ci(frame, T.atk_tm_s,  T.atk_vt_in, 0, 0.38, Easing.linear);
  const atkTmOp  = ci(frame, T.atk_tm_s,  T.atk_tm_s + 8, 0, 1);

  // Stake attacker: RC → SK (avec la flèche), attend, puis SK → Account après veto
  const atkSkOp = frame < T.atk_ar_in ? 0
    : frame >= T.atk_mv_e ? ci(frame, T.atk_mv_e, T.atk_mv_e + 8, 1, 0)
    : 1;
  const atkSkX = frame < T.atk_ar_in ? RC.x
    : frame < T.atk_ar_out ? ci(frame, T.atk_ar_in, T.atk_ar_out, RC.x, SK.x, EASE_F)
    : frame < T.atk_mv_s   ? SK.x
    : ci(frame, T.atk_mv_s, T.atk_mv_e, SK.x, A.x, EASE_F);
  const atkSkY = frame < T.atk_ar_in ? RC.y
    : frame < T.atk_ar_out ? ci(frame, T.atk_ar_in, T.atk_ar_out, RC.y, SK.y, EASE_F)
    : frame < T.atk_mv_s   ? SK.y
    : ci(frame, T.atk_mv_s, T.atk_mv_e, SK.y, A.y, EASE_F);

  const ckPrg = ci(frame, T.atk_ck_in,  T.atk_ck_out, 0, 1, EASE_F);
  const ckHd  = ci(frame, T.atk_ck_out - 4, T.atk_ck_out + 3, 0, 1, EASE_F);
  const ckLbl = ci(frame, T.atk_ck_out, T.atk_ck_out + 8, 0, 1);
  const nlOp  = ci(frame, T.atk_nl_in,  T.atk_nl_in + 8, 0, 1);

  const vtPrg = ci(frame, T.atk_vt_in, T.atk_vt_out, 0, 1, EASE_F);
  const vtHd  = ci(frame, T.atk_vt_out - 4, T.atk_vt_out + 3, 0, 1, EASE_F);
  const vtLbl = ci(frame, T.atk_vt_out, T.atk_vt_out + 8, 0, 1);
  const szLbl = ci(frame, T.atk_sz, T.atk_sz + 8, 0, 1);

  // === P3 ===
  const p3LineOp = inP3 ? ci(frame, T.p3, T.p3 + 8, 0, 1) : 0;
  const blink = (seed: number) =>
    inP3 && frame >= T.p3bl_s && frame < T.p3bl_e
      ? 0.3 + 0.7 * Math.abs(Math.sin((frame - T.p3bl_s) * (0.07 + seed * 0.03) + seed * 1.4))
      : 1;
  const Qs = [{ x: 960, y: 180 }, { x: 300, y: 800 }, { x: 1620, y: 800 }];

  // Panel labels
  const ownerLbOp  = frame < T.ow_in ? 0
    : frame < T.ow_fd_s ? ci(frame, T.ow_in, T.ow_in + 10, 0, 1)
    : ci(frame, T.ow_fd_s, T.ow_fd_e, 1, 0);
  const realityOp  = frame < T.atk_in ? 0
    : frame < T.atk_fd_s ? ci(frame, T.atk_in, T.atk_in + 10, 0, 1)
    : ci(frame, T.atk_fd_s, T.atk_fd_e, 1, 0);
  const whatOp     = inP3 ? ci(frame, T.p3, T.p3 + 8, 0, 1) : 0;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>


      {/* === SVG layer === */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox={`0 0 ${W} ${H}`}>

        {/* Monitors */}
        <line x1={E.wt_b.x} y1={E.wt_b.y} x2={E.a_t.x} y2={E.a_t.y}
          stroke={C.muted} strokeWidth={2} strokeDasharray="10 7"
          strokeLinecap="round" opacity={monitorsOp} />
        {monitorsOp > 0 && (
          <text x={WT.x + 26} y={(E.wt_b.y + E.a_t.y) / 2}
            fontSize={28} fontFamily={fontFamily} fill={C.muted} fontWeight={600}
            dominantBaseline="middle" opacity={monitorsOp}>monitors</text>
        )}

        {/* ── PHASE 1: OWNER (legitimate recovery) ── */}

        {/* Flèche locks stake */}
        {frame >= T.ow_ar_in && inOwner && (
          <g opacity={owPhaseOp}>
            <line x1={E.rc_r.x} y1={E.rc_r.y} x2={E.a_l.x} y2={E.a_l.y}
              stroke={C.text} strokeWidth={2.5}
              strokeDasharray={ARR_LEN} strokeDashoffset={ARR_LEN * (1 - owArPrg)}
              strokeLinecap="round" />
            <g transform={`translate(${E.a_l.x},${E.a_l.y})`} opacity={owArHd}>
              <polygon points="-16,-6 0,0 -16,6" fill={C.text} />
            </g>
            <text x={(E.rc_r.x + E.a_l.x) / 2} y={RC.y - 28}
              textAnchor="middle" fontSize={28} fontFamily={fontFamily}
              fill={C.text} fontWeight={600} opacity={owArLbl}>locks stake</text>
          </g>
        )}

        {/* Timer owner */}
        {frame >= T.ow_tm_s && inOwner && (
          <g opacity={owTmOp * owPhaseOp}>
            <rect x={A.x - TIMER_W / 2} y={A.y + BOX / 2 + 20} width={TIMER_W} height={TIMER_H} rx={5} fill={C.boxDim} />
            <rect x={A.x - TIMER_W / 2} y={A.y + BOX / 2 + 20}
              width={TIMER_W * owTmPrg} height={TIMER_H} rx={5}
              fill={frame >= T.ow_tm_e ? C.bright : C.accent} />
            <text x={A.x} y={A.y + BOX / 2 + 60} textAnchor="middle"
              fontSize={26} fontFamily={fontFamily} fill={C.muted} fontWeight={500}>timelock</text>
          </g>
        )}

        {/* Arc off-chain WT → Owner */}
        {frame >= T.ow_ct_in && inOwner && (
          <g opacity={owPhaseOp}>
            <path d={CONTACT_PATH} stroke={C.bright} strokeWidth={2} fill="none"
              strokeDasharray={950} strokeDashoffset={950 * (1 - ctPrg)}
              strokeLinecap="round" opacity={0.65} />
            <g transform={`translate(${E.rc_t.x},${E.rc_t.y}) rotate(56)`} opacity={ctHd * 0.65}>
              <polygon points="-14,-5 0,0 -14,5" fill={C.bright} />
            </g>
            <text x={590} y={290} textAnchor="middle"
              fontSize={28} fontFamily={fontFamily} fill={C.bright} fontWeight={600}
              opacity={ctLbl * 0.65}>off-chain contact</text>
          </g>
        )}

        {/* "no veto" */}
        {frame >= T.ow_nv && inOwner && (
          <text x={WT.x} y={E.wt_b.y + 48} textAnchor="middle"
            fontSize={32} fontFamily={fontFamily} fill="#7aff7a" fontWeight={700}
            opacity={nvOp * owPhaseOp}>
            no veto
          </text>
        )}

        {/* "Account recovered" */}
        {frame >= T.ow_suc && inOwner && (
          <text x={A.x} y={A.y + BOX / 2 + 100} textAnchor="middle"
            fontSize={42} fontFamily={fontFamily} fill={C.bright} fontWeight={700}
            opacity={sucOp * owPhaseOp}>
            Account recovered ✓
          </text>
        )}

        {/* ── PHASE 2: ATTACKER ── */}

        {/* Flèche locks stake */}
        {frame >= T.atk_ar_in && inAtk && (
          <g opacity={atkOp}>
            <line x1={E.rc_r.x} y1={E.rc_r.y} x2={E.a_l.x} y2={E.a_l.y}
              stroke={C.text} strokeWidth={2.5}
              strokeDasharray={ARR_LEN} strokeDashoffset={ARR_LEN * (1 - atkArPrg)}
              strokeLinecap="round" />
            <g transform={`translate(${E.a_l.x},${E.a_l.y})`} opacity={atkArHd}>
              <polygon points="-16,-6 0,0 -16,6" fill={C.text} />
            </g>
            <text x={(E.rc_r.x + E.a_l.x) / 2} y={RC.y - 28}
              textAnchor="middle" fontSize={28} fontFamily={fontFamily}
              fill={C.text} fontWeight={600} opacity={atkArLbl}>locks stake</text>
          </g>
        )}

        {/* Timer attacker */}
        {frame >= T.atk_tm_s && inAtk && (
          <g opacity={atkTmOp * atkOp}>
            <rect x={A.x - TIMER_W / 2} y={A.y + BOX / 2 + 20} width={TIMER_W} height={TIMER_H} rx={5} fill={C.boxDim} />
            <rect x={A.x - TIMER_W / 2} y={A.y + BOX / 2 + 20} width={TIMER_W * atkTmPrg} height={TIMER_H} rx={5} fill={C.accent} />
            <text x={A.x} y={A.y + BOX / 2 + 60} textAnchor="middle"
              fontSize={26} fontFamily={fontFamily} fill={C.muted} fontWeight={500}>timelock</text>
          </g>
        )}

        {/* Arc WT → Attacker (off-chain check) */}
        {frame >= T.atk_ck_in && inAtk && (
          <g opacity={atkOp}>
            <path d={CONTACT_PATH} stroke={C.bright} strokeWidth={2} fill="none"
              strokeDasharray={950} strokeDashoffset={950 * (1 - ckPrg)}
              strokeLinecap="round" opacity={0.65} />
            <g transform={`translate(${E.rc_t.x},${E.rc_t.y}) rotate(56)`} opacity={ckHd * 0.65}>
              <polygon points="-14,-5 0,0 -14,5" fill={C.bright} />
            </g>
            <text x={590} y={290} textAnchor="middle"
              fontSize={28} fontFamily={fontFamily} fill={C.bright} fontWeight={600}
              opacity={ckLbl * 0.65}>off-chain check</text>
          </g>
        )}

        {/* "not legit" — résultat du check négatif */}
        {frame >= T.atk_nl_in && inAtk && (
          <text x={RC.x} y={RC.y - BOX / 2 - 20} textAnchor="middle"
            fontSize={32} fontFamily={fontFamily} fill="#ff5555" fontWeight={700}
            opacity={nlOp * atkOp}>
            not legit
          </text>
        )}

        {/* Courbe veto */}
        {frame >= T.atk_vt_in && inAtk && (
          <g opacity={atkOp}>
            <path d={VETO_PATH} stroke={C.accent} strokeWidth={3} fill="none"
              strokeDasharray={620} strokeDashoffset={620 * (1 - vtPrg)} strokeLinecap="round" />
            <g transform={`translate(${SK.x},${SK.y}) rotate(114)`} opacity={vtHd}>
              <polygon points="-16,-6 0,0 -16,6" fill={C.accent} />
            </g>
            <text x={710} y={370} textAnchor="middle"
              fontSize={28} fontFamily={fontFamily} fill={C.accent} fontWeight={700} opacity={vtLbl}>
              veto: seizes stake
            </text>
          </g>
        )}

        {/* "stake seized" */}
        {frame >= T.atk_sz && inAtk && (
          <text x={A.x} y={A.y + BOX / 2 + 95} textAnchor="middle"
            fontSize={36} fontFamily={fontFamily} fill={C.accent} fontWeight={700} opacity={szLbl * atkOp}>
            stake seized ✓
          </text>
        )}

        {/* ── PHASE 3: P3 ── */}
        {inP3 && (
          <>
            <line x1={E.a_t.x} y1={E.a_t.y} x2={Qs[0].x} y2={Qs[0].y + BOX / 2}
              stroke="#444" strokeWidth={2} strokeDasharray="10 7" opacity={p3LineOp * blink(0)} />
            <line x1={E.a_l.x} y1={E.a_l.y} x2={Qs[1].x + BOX / 2} y2={Qs[1].y}
              stroke="#444" strokeWidth={2} strokeDasharray="10 7" opacity={p3LineOp * blink(1)} />
            <line x1={E.a_r.x} y1={E.a_r.y} x2={Qs[2].x - BOX / 2} y2={Qs[2].y}
              stroke="#444" strokeWidth={2} strokeDasharray="10 7" opacity={p3LineOp * blink(2)} />
          </>
        )}
      </svg>

      {/* === Stake icon (Lucide Coins) — owner === */}
      {frame >= T.ow_ar_in && inOwner && (
        <div style={{
          position: "absolute",
          left: owSkX - STAKE_SZ / 2,
          top: owSkY - STAKE_SZ / 2,
          opacity: owPhaseOp,
          color: C.accent,
          pointerEvents: "none",
        }}>
          <Coins size={STAKE_SZ} strokeWidth={1.8} />
        </div>
      )}

      {/* === Checkmark (Lucide CircleCheck) — owner validates === */}
      {frame >= T.ow_vl_in && inOwner && (
        <div style={{
          position: "absolute",
          left: RC.x + BOX / 2 + 16,
          top: RC.y - BOX / 4 - CHECK_SZ / 2,
          opacity: vlOp * owPhaseOp,
          color: "#7aff7a",
          pointerEvents: "none",
        }}>
          <CircleCheck size={CHECK_SZ} strokeWidth={2} />
        </div>
      )}

      {/* === X icon (Lucide XCircle) — attacker not legit === */}
      {frame >= T.atk_nl_in && inAtk && (
        <div style={{
          position: "absolute",
          left: RC.x + BOX / 2 + 16,
          top: RC.y - BOX / 4 - CHECK_SZ / 2,
          opacity: nlOp * atkOp,
          color: "#ff5555",
          pointerEvents: "none",
        }}>
          <XCircle size={CHECK_SZ} strokeWidth={2} />
        </div>
      )}

      {/* === Stake icon (Lucide Coins) — attacker === */}
      {frame >= T.atk_ar_in && inAtk && (
        <div style={{
          position: "absolute",
          left: atkSkX - STAKE_SZ / 2,
          top: atkSkY - STAKE_SZ / 2,
          opacity: atkSkOp * atkOp,
          color: C.accent,
          pointerEvents: "none",
        }}>
          <Coins size={STAKE_SZ} strokeWidth={1.8} />
        </div>
      )}

      {/* === HTML boxes === */}

      {/* Account — persistant hors P3 */}
      {!inP3 && <Box cx={A.x} cy={A.y} label="Account" fromFrame={T.acct_in} />}
      {inP3  && <Box cx={A.x} cy={A.y} label="Account" fromFrame={0} />}

      {/* Watchtower — persistant hors P3 */}
      {!inP3 && (
        <Box cx={WT.x} cy={WT.y} label="Watch­tower" fromFrame={T.wt_in} bg={C.boxDim}
          pulse={frame >= T.atk_vt_out && inAtk ? [T.atk_vt_out, T.atk_vt_out + 40] : undefined}
        />
      )}

      {/* Phase 1: Owner */}
      {inOwner && (
        <Box cx={RC.x} cy={RC.y} label="Owner" fromFrame={T.ow_in}
          fadeOut={[T.ow_fd_s, T.ow_fd_e]}
        />
      )}

      {/* Phase 2: Attacker */}
      {inAtk && (
        <Box cx={RC.x} cy={RC.y} label="Attacker" fromFrame={T.atk_in}
          fadeOut={[T.atk_fd_s, T.atk_fd_e]}
        />
      )}

      {/* Phase 3: "?" boxes */}
      {inP3 && Qs.map((q, i) => (
        <div key={i} style={{
          position: "absolute", left: q.x - BOX / 2, top: q.y - BOX / 2,
          width: BOX, height: BOX, backgroundColor: C.boxDim, borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: ci(frame, T.p3, T.p3 + 8, 0, 1) * blink(i),
          fontFamily, fontSize: 80, fontWeight: 500, color: "#666",
        }}>?</div>
      ))}

      {/* Panel labels */}
      <div style={{ position: "absolute", top: 60, left: 80, fontFamily, fontSize: 44,
        color: C.bright, fontWeight: 500, opacity: ownerLbOp }}>Legitimate recovery</div>
      <div style={{ position: "absolute", top: 60, left: 80, fontFamily, fontSize: 44,
        color: C.bright, fontWeight: 500, opacity: realityOp }}>Reality</div>
      <div style={{ position: "absolute", top: 60, left: 80, fontFamily, fontSize: 44,
        color: C.bright, fontWeight: 500, opacity: whatOp }}>What people see</div>

    </AbsoluteFill>
  );
};
