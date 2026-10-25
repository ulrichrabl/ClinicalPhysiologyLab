import { figureJoints, type FigureLook, type Pose } from './patient-figure.ts';
import { LEN } from './figure-body.ts';
import { clamp, dir, f, type Pt } from './figure-geom.ts';

/* ===========================================================================
   The neurological examination, moving (ADR-017 decision 10).

   Each test is a function of time that poses the bedside figure's skeleton
   and draws what the examiner holds. It is driven by the examination
   model's finding, never by the lesion: the same function shows how a test
   is done (fed a normal finding, on a teaching card) and what this patient
   does (fed the patient's finding, in the station and the ward).

   The skeleton is posed, not the outlines (the figure's brief). Positions
   are in the figure's drawing coordinates seen from the patient's right,
   where one reference centimetre is `u` units.

   The sizes of the abnormal movements are placements, judged by eye at the
   bedside's scale; each says so where it is set.
=========================================================================== */

const D2R = Math.PI / 180;
const ang = (from: Pt, to: Pt) => Math.atan2(-(to.y - from.y), to.x - from.x) / D2R;
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
/** Minimum-jerk position along a reach, 0–1 (Flash & Hogan's profile: how a practised point-to-point movement unfolds). */
const minJerk = (t: number) => { const x = clamp(t, 0, 1); return x * x * x * (10 - 15 * x + 6 * x * x); };

export interface MotionFrame {
  pose: Pose;
  /** What the examiner holds, in the figure's coordinates, drawn over the patient. */
  props: string;
}

/** Bring the fingertip of arm i (0 near, 1 far) to `target`, the elbow below the line from shoulder to target. */
function reach(base: Pose, look: FigureLook, i: 0 | 1, target: Pt): Pose {
  const J = figureJoints(base, look), S = J.k.shoulder, u = J.u;
  const Lu = LEN.upper * u, Lf = (LEN.fore + LEN.hand) * u;
  const d = clamp(dist(S, target), Math.abs(Lu - Lf) + 0.5, Lu + Lf - 0.01);
  const phi = ang(S, target);
  const beta = Math.acos(clamp((Lu * Lu + d * d - Lf * Lf) / (2 * Lu * d), -1, 1)) / D2R;
  const upper = phi - beta * J.k.flip;
  const elbow = { x: S.x + Math.cos(upper * D2R) * Lu, y: S.y - Math.sin(upper * D2R) * Lu };
  const fore = ang(elbow, target);
  const set = <T extends [number, number]>(pair: T, v: number): [number, number] => (i === 0 ? [v, pair[1]] : [pair[0], v]);
  return { ...base, armUpper: set(base.armUpper, upper), armFore: set(base.armFore, fore), hand: set(base.hand, 0), point: set(base.point ?? [0, 0], 1) };
}

/** The examiner's hand, held up with the index finger pointing at the patient and its tip at `tip`: a sleeve, the back
    of the hand, the other fingers folded, the thumb along them. Drawn simply, as the arrest scene's rescuers are, so that
    it does not compete with the patient. `toward` is the direction the finger points (degrees). */
function examinerHand(tip: Pt, u: number, toward = 180): string {
  const a = toward * D2R, fx = Math.cos(a), fy = -Math.sin(a), nx = -fy, ny = fx;   // along the finger, and across it
  const at = (along: number, across: number) => ({ x: tip.x - fx * along * u + nx * across * u, y: tip.y - fy * along * u + ny * across * u });
  const P = (q: Pt) => `${f(q.x)} ${f(q.y)}`;
  const k = at(7.5, 0.4);                                  // the index's knuckle
  const palm = [at(6.5, 1.6), at(7, -3.2), at(14.5, -3.6), at(16, -0.6), at(15, 2.6), at(9, 2.6)];
  const sleeveA = at(15, 0), sleeveB = at(40, -6);
  return `<g class="examiner" pointer-events="none">`
    + `<path d="M${P(sleeveA)} L${P(sleeveB)}" stroke="#4f7f86" stroke-width="${f(7.5 * u)}" stroke-linecap="round"/>`
    + `<path d="M${P(palm[0])} L${P(palm[1])} Q${P(at(11, -4.6))} ${P(palm[2])} L${P(palm[3])} L${P(palm[4])} Q${P(at(12, 3.4))} ${P(palm[5])} Z" fill="#e2b89a" stroke="#b98d70" stroke-width="${f(0.35 * u)}"/>`
    + `<path d="M${P(at(7.2, -2.6))} Q${P(at(5.6, -2.2))} ${P(at(6, -0.9))}" fill="none" stroke="#b98d70" stroke-width="${f(0.3 * u)}"/>`
    + `<path d="M${P(at(10, 2.4))} Q${P(at(7, 3.2))} ${P(at(6.2, 2.0))}" fill="none" stroke="#c99a7c" stroke-width="${f(1.5 * u)}" stroke-linecap="round"/>`
    + `<path d="M${P(tip)} L${P(k)}" stroke="#e2b89a" stroke-width="${f(1.7 * u)}" stroke-linecap="round"/>`
    + `<path d="M${P(at(0.3, 0))} L${P(at(1.4, 0))}" stroke="#f0d2bf" stroke-width="${f(1.0 * u)}" stroke-linecap="round"/>`
    + `</g>`;
}

export interface FingerNoseFinding { dysmetria?: 'none' | 'mild' | 'marked'; intentionTremor?: boolean; limitedByWeakness?: boolean }

/** Finger–nose, arm i, `t` seconds in: from the nose to the examiner's finger at arm's length and back, again and
    again (3.2 s a cycle). Dysmetria overshoots the target and corrects; an intention tremor oscillates across the path,
    growing as the finger nears the target (cerebellar tremor is below 5 Hz: Deuschl 1998; 4 Hz here). */
export function fingerNose(base: Pose, look: FigureLook, t: number, finding: FingerNoseFinding = {}, i: 0 | 1 = 0): MotionFrame {
  const J = figureJoints(base, look), u = J.u, S = J.k.shoulder;
  const nose = J.nose;
  const fwd = J.anterior;
  /* the examiner's finger: at about the patient's arm's length in front, at eye level */
  const reachLen = (LEN.upper + LEN.fore + LEN.hand) * u * 0.92;
  const target = { x: S.x + fwd.x * reachLen, y: nose.y - 2 * u };
  const touch = { x: nose.x + fwd.x * 0.3 * u, y: nose.y + 0.6 * u };
  const CYCLE = 3.2, LEG = 1.1, HOLD = 0.5;
  const c = ((t % CYCLE) + CYCLE) % CYCLE;
  const out = c < LEG, back = c >= LEG + HOLD && c < 2 * LEG + HOLD;
  const from = out || c < LEG + HOLD ? touch : target, to = out || c < LEG + HOLD ? target : touch;
  const tau = out ? c / LEG : back ? (c - LEG - HOLD) / LEG : 1;
  let p = { x: from.x + (to.x - from.x) * minJerk(tau), y: from.y + (to.y - from.y) * minJerk(tau) };
  if (c >= 2 * LEG + HOLD || (!out && !back && c >= LEG)) p = c >= 2 * LEG + HOLD ? touch : target;
  /* weakness: the arm cannot hold itself up against gravity; it reaches only part of the way (placement) */
  if (finding.limitedByWeakness) p = { x: p.x, y: p.y + 10 * u * Math.sin(Math.PI * minJerk(tau)) };
  const dm = finding.dysmetria ?? 'none';
  if (dm !== 'none' && (out || back)) {
    /* overshoot past the end point, then back to it: about 2 cm mild, 5 cm marked (placements) */
    const over = (dm === 'marked' ? 5 : 2) * u, dx = to.x - from.x, dy = to.y - from.y, L = Math.hypot(dx, dy) || 1;
    const bump = Math.max(0, Math.sin(Math.PI * clamp((tau - 0.7) / 0.3, 0, 1)));
    p = { x: p.x + (dx / L) * over * bump, y: p.y + (dy / L) * over * bump };
  }
  if (finding.intentionTremor && (out || back || c < LEG + HOLD)) {
    /* across the path, growing towards the target: up to 2.5 cm (placement) */
    const near = out || back ? tau * tau : 1;
    const amp = 2.5 * u * near * (c < LEG + HOLD && !out ? 0.6 : 1);
    const nx = -(to.y - from.y), ny = to.x - from.x, L = Math.hypot(nx, ny) || 1;
    const w = Math.sin(2 * Math.PI * 4 * t);
    p = { x: p.x + (nx / L) * amp * w, y: p.y + (ny / L) * amp * w };
  }
  const pose = reach(base, look, i, p);
  return { pose, props: examinerHand(target, u, 180) };
}

export type ReflexGrade = 0 | 1 | 2 | 3 | 4;

/** The knee jerk, sitting on the edge of the bed, leg i, `t` seconds in: the hammer lifts and falls on the patellar
    tendon every 2.4 s, and the leg kicks by the grade. Swing sizes are placements: absent nothing; reduced 6°; normal
    16°; brisk 30°; with clonus (grade 4) a few further beats. */
export function kneeJerk(base: Pose, look: FigureLook, t: number, grade: ReflexGrade = 2, i: 0 | 1 = 0): MotionFrame {
  const J = figureJoints(base, look), u = J.u, k = J.k;
  const PERIOD = 2.4, STRIKE = 0.55;
  const c = ((t % PERIOD) + PERIOD) % PERIOD;
  const since = c - STRIKE - 0.03;                 // the jerk follows the tap by a few tens of milliseconds
  const amp = [0, 6, 16, 30, 30][grade];
  /* one quick extension and back, with a small overswing (0.35 s out and back: a placement); with clonus (grade 4) the
     contraction repeats a few times at about 6 Hz (a placement; clonus is usually described at 5–8 Hz) */
  const pulse = (x: number) => (x <= 0 ? 0 : x < 0.35 ? Math.sin((Math.PI * x) / 0.35) : -0.12 * Math.sin(Math.PI * Math.min(1, (x - 0.35) / 0.3)));
  let kick = amp * pulse(since);
  if (grade >= 4) for (let b = 1; b <= 4; b++) kick += amp * 0.35 * Math.pow(0.75, b) * Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, since - 0.35 - (b - 1) / 6) * 6)));
  const shin: [number, number] = i === 0 ? [base.shin[0] + kick * k.flip, base.shin[1]] : [base.shin[0], base.shin[1] + kick * k.flip];
  const foot: [number, number] = i === 0 ? [base.foot[0] + kick * 0.3, base.foot[1]] : [base.foot[0], base.foot[1] + kick * 0.3];
  const pose = { ...base, shin, foot };
  /* the hammer: a handle from the examiner's hand to a head that falls on the tendon just below the kneecap */
  /* the patellar tendon: just below the kneecap, on the front of the leg (a knee is about 6 cm deep from its centre) */
  const sd = dir(base.shin[i]), front = dir(base.shin[i] + 90 * k.flip);
  const knee = k.knee[i], tendon = { x: knee.x + sd.x * 5 * u + front.x * 5.5 * u, y: knee.y + sd.y * 5 * u + front.y * 5.5 * u };
  /* raised, brought down onto the tendon, and lifted away again before the leg kicks into it */
  const swing = c < STRIKE ? 55 * (1 - minJerk(c / STRIKE)) : 55 * (1 - (1 - Math.min(1, (c - STRIKE) / 0.25)) ** 2);
  const pivot = { x: tendon.x + 26 * u, y: tendon.y - 4 * u };
  const a0 = ang(pivot, tendon) - swing;
  const head = { x: pivot.x + Math.cos(a0 * D2R) * dist(pivot, tendon), y: pivot.y - Math.sin(a0 * D2R) * dist(pivot, tendon) };
  const hd = dir(a0 + 90);
  const props = `<g class="examiner" pointer-events="none">`
    + `<path d="M${f(pivot.x)} ${f(pivot.y)} L${f(head.x)} ${f(head.y)}" stroke="#6b6f76" stroke-width="${f(1.1 * u)}" stroke-linecap="round"/>`
    + `<path d="M${f(head.x - hd.x * 4 * u)} ${f(head.y - hd.y * 4 * u)} L${f(head.x + hd.x * 4 * u)} ${f(head.y + hd.y * 4 * u)}" stroke="#c0392b" stroke-width="${f(3 * u)}" stroke-linecap="round"/>`
    + `<path d="M${f(pivot.x + 4 * u)} ${f(pivot.y + 1 * u)} L${f(pivot.x + 30 * u)} ${f(pivot.y + 8 * u)}" stroke="#4f7f86" stroke-width="${f(7.5 * u)}" stroke-linecap="round"/>`
    + `<rect x="${f(pivot.x - 2.5 * u)}" y="${f(pivot.y - 3.2 * u)}" width="${f(7.5 * u)}" height="${f(6.4 * u)}" rx="${f(2.6 * u)}" fill="#e2b89a" stroke="#b98d70" stroke-width="${f(0.35 * u)}"/>`
    + `</g>`;
  return { pose, props };
}

/** Drift per arm, [right, left] (arm 0 is the right, as in `Pose`). */
export interface DriftFinding { drift: [boolean, boolean] }

/** Pronator drift, `t` seconds in: both arms raised forward to the horizontal, palms up, the eyes closed, held; a weak
    arm pronates, its elbow bends and it sinks (the pyramidal pattern: the pronators and flexors overcome the supinators
    and extensors). The cycle is 16 s: 1.2 s to raise the arms, the eyes closed at 1.6 s, the drift growing over 8 s from
    2.5 s and then held, the arms lowered at 14 s. Every size and time here is a placement judged by eye; the finding
    itself (drift or none, each arm) comes from the examination model. */
export function pronatorDrift(base: Pose, look: FigureLook, t: number, finding: DriftFinding = { drift: [false, false] }): MotionFrame {
  const J = figureJoints(base, look);
  const PERIOD = 16, c = ((t % PERIOD) + PERIOD) % PERIOD;
  /* forward and horizontal, whichever way the patient faces in the drawing; s turns "up" into degrees */
  const s = J.anterior.x >= 0 ? 1 : -1, ahead = s > 0 ? 0 : 180;
  const up = c < 1.2 ? minJerk(c / 1.2) : c < 14 ? 1 : 1 - minJerk((c - 14) / 1.2);
  const grow = c >= 2.5 && c < 14 ? minJerk((c - 2.5) / 8) : 0;
  const d = (j: 0 | 1) => (finding.drift[j] ? grow : 0);
  /* the drift at its fullest: the upper arm 22° below the horizontal, the elbow bent 10° (so the hand sinks with the
     arm), the forearm turned 60° from palm up, the wrist dropped 10° (placements) */
  const pair = (fn: (j: 0 | 1) => number): [number, number] => [fn(0), fn(1)];
  const mix = (a: number, b: number) => a + (b - a) * up;
  const upper = (j: 0 | 1) => ahead - s * 22 * d(j);
  const pose: Pose = {
    ...base,
    armUpper: pair((j) => mix(base.armUpper[j], upper(j))),
    armFore: pair((j) => mix(base.armFore[j], upper(j) + s * 10 * d(j))),
    hand: pair((j) => mix(base.hand[j], -s * 10 * d(j))),
    ...(up > 0.5 ? { outstretch: pair((j) => 60 * d(j)) } : {}),
    eyes: c >= 1.6 && c < 14 ? 1 : 0,
  };
  return { pose, props: '' };
}
