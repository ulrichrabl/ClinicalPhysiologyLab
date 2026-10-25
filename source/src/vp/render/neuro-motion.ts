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
  /** Where the test is watched from (degrees round the bed: 0 the patient's right, 90 the front); the side's own by default. */
  view?: number;
  /** A sway of the whole body about the feet, in the frontal plane (degrees, positive toward the patient's right), for stance. */
  sway?: number;
  /** Walking: drawn twice, from the side walking across (`ahead`: how far the hips have come, units) and from the front
      walking toward the examiner (`drift`: sideways, units, positive toward the patient's right; `lurch`: the trunk's sway
      over the standing leg, degrees, positive toward the right). */
  walk?: { ahead: number; drift: number; lurch: number };
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


/** Bring the heel of leg i to `target`, the knee bent toward the front of the body (both for the heel–shin test, lying). */
function legReach(base: Pose, look: FigureLook, i: 0 | 1, target: Pt): Pose {
  const J = figureJoints(base, look), H = J.k.hip, u = J.u;
  const Lt = LEN.thigh * u, Ls = LEN.shin * u;
  /* the heel lies a little behind and below the ankle joint: aim the ankle 3 cm in front of the heel's target */
  const ankle = { x: target.x + J.anterior.x * 3 * u, y: target.y + J.anterior.y * 3 * u };
  const d = clamp(dist(H, ankle), Math.abs(Lt - Ls) + 0.5, Lt + Ls - 0.01);
  const phi = ang(H, ankle);
  const beta = Math.acos(clamp((Lt * Lt + d * d - Ls * Ls) / (2 * Lt * d), -1, 1)) / D2R;
  /* of the two knees that reach, the one in front */
  const knee = (a: number) => ({ x: H.x + Math.cos(a * D2R) * Lt, y: H.y - Math.sin(a * D2R) * Lt });
  const fwd = (q: Pt) => (q.x - H.x) * J.anterior.x + (q.y - H.y) * J.anterior.y;
  const thigh = fwd(knee(phi + beta)) >= fwd(knee(phi - beta)) ? phi + beta : phi - beta;
  const shin = ang(knee(thigh), ankle);
  const set = (pair: [number, number], v: number): [number, number] => (i === 0 ? [v, pair[1]] : [pair[0], v]);
  return { ...base, thigh: set(base.thigh, thigh), shin: set(base.shin, shin), foot: set(base.foot, 20) };
}

export interface HeelShinFinding { dysmetria?: 'none' | 'mild' | 'marked'; intentionTremor?: boolean; limitedByWeakness?: boolean }

/** Heel–shin, lying, leg i, `t` seconds in: the heel is lifted onto the other knee, run down the shin to the ankle, lifted
    and placed again (a 5 s cycle). Dysmetria overshoots the knee and the heel falls off the shin and back; an intention
    tremor makes it wobble as it is placed. Sizes are placements, as for finger–nose. */
export function heelShin(base: Pose, look: FigureLook, t: number, finding: HeelShinFinding = {}, i: 0 | 1 = 0): MotionFrame {
  const J = figureJoints(base, look), u = J.u, k = J.k, far: 0 | 1 = i === 0 ? 1 : 0;
  const up = J.anterior;
  const kneeTop = { x: k.knee[far].x + up.x * 4.5 * u, y: k.knee[far].y + up.y * 4.5 * u };
  const ankleTop = { x: k.ankle[far].x + up.x * 3.5 * u, y: k.ankle[far].y + up.y * 3.5 * u };
  const rest = { x: k.ankle[i].x - up.x * 3 * u, y: k.ankle[i].y - up.y * 3 * u };
  const CYCLE = 5, c = ((t % CYCLE) + CYCLE) % CYCLE;
  const lerpP = (a: Pt, b: Pt, x: number) => ({ x: a.x + (b.x - a.x) * x, y: a.y + (b.y - a.y) * x });
  const arc = (a: Pt, b: Pt, x: number, h: number) => { const p = lerpP(a, b, minJerk(x)); const lift = Math.sin(Math.PI * clamp(x, 0, 1)) * h * u; return { x: p.x + up.x * lift, y: p.y + up.y * lift }; };
  let p: Pt, placing = false, sliding = false, x = 0;
  if (c < 1.0) { x = c / 1.0; p = arc(rest, kneeTop, x, 14); placing = true; }
  else if (c < 3.0) { x = (c - 1.0) / 2.0; p = lerpP(kneeTop, ankleTop, x); sliding = true; }
  else if (c < 4.0) { x = (c - 3.0) / 1.0; p = arc(ankleTop, rest, x, 10); }
  else p = rest;
  const dm = finding.dysmetria ?? 'none';
  if (finding.limitedByWeakness) p = lerpP(rest, p, 0.35);
  else if (dm !== 'none') {
    const big = dm === 'marked' ? 1 : 0.45;
    /* placing: past the knee and back (5 cm marked) */
    if (placing) { const over = 5 * big * Math.max(0, Math.sin(Math.PI * clamp((x - 0.7) / 0.3, 0, 1))); const d = { x: kneeTop.x - rest.x, y: kneeTop.y - rest.y }, L = Math.hypot(d.x, d.y) || 1; p = { x: p.x + (d.x / L) * over * u, y: p.y + (d.y / L) * over * u }; }
    /* sliding: the heel leaves the shin and comes back, irregularly (up to 4 cm marked) */
    if (sliding) { const off = 4 * big * Math.abs(Math.sin(2 * Math.PI * (1.3 * x + 0.4 * Math.sin(5 * x)))); p = { x: p.x + up.x * off * u, y: p.y + up.y * off * u }; }
  }
  if (finding.intentionTremor && (placing || sliding)) { const a = 2 * u * (placing ? x * x : 0.6) * Math.sin(2 * Math.PI * 4 * t); p = { x: p.x + up.x * a, y: p.y + up.y * a }; }
  return { pose: legReach(base, look, i, p), props: '' };
}

export interface RapidAlternatingFinding { dysdiadochokinesia?: boolean; slowed?: boolean }

/** Rapid alternating movements, sitting, arm i, `t` seconds in: the forearm held forward, the hand turned palm up and palm
    down as fast as it can (about 2 turns a second when normal: a placement). Dysdiadochokinesia breaks the rhythm and the
    range; slowed (a pyramidal or extrapyramidal sign) halves the rate and shrinks the range. */
export function rapidAlternating(base: Pose, look: FigureLook, t: number, finding: RapidAlternatingFinding = {}, i: 0 | 1 = 0): MotionFrame {
  const J = figureJoints(base, look), s = J.anterior.x >= 0 ? 1 : -1, ahead = s > 0 ? 0 : 180;
  const set = (pair: [number, number], v: number): [number, number] => (i === 0 ? [v, pair[1]] : [pair[0], v]);
  /* the upper arm along the side, the elbow at a right angle, the forearm forward */
  const upper = ahead - s * 62, fore = ahead + s * 38;
  let rate = finding.slowed ? 1 : 2, range = finding.slowed ? 0.7 : 1, phase = 2 * Math.PI * rate * t;
  if (finding.dysdiadochokinesia) {
    /* irregular: the rate wanders and the turn falls short or overshoots, beat to beat */
    phase = 2 * Math.PI * (rate * 0.8 * t + 0.18 * Math.sin(2 * Math.PI * 0.7 * t) + 0.1 * Math.sin(2 * Math.PI * 1.9 * t));
    range *= 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.45 * t + 1);
  }
  const rot = 90 + 90 * range * Math.sin(phase);   // 0 palm up, 180 palm down
  const os = set((base.outstretch ?? [0, 0]) as [number, number], rot);
  return { pose: { ...base, armUpper: set(base.armUpper, upper), armFore: set(base.armFore, fore), hand: set(base.hand, 0), outstretch: os }, props: '' };
}

export interface RombergFinding { stance: 'steady' | 'sways' | 'falls'; toward?: 'L' | 'R' }

/** Romberg, standing with the feet together, seen from the front, `t` seconds in: 4 s with the eyes open, then 8 s with
    them closed (a 12 s cycle). The body sways about the ankles by the finding of each: steady a fraction of a degree,
    swaying a few degrees, falling toward a side until the examiner's hand catches the shoulder. Sizes are placements. */
export function romberg(base: Pose, look: FigureLook, t: number, open: RombergFinding, closed: RombergFinding): MotionFrame {
  const CYCLE = 12, c = ((t % CYCLE) + CYCLE) % CYCLE, shut = c >= 4;
  const f = shut ? closed : open, since = shut ? c - 4 : c;
  const wobble = (a: number) => a * (0.6 * Math.sin(2 * Math.PI * 0.35 * t) + 0.4 * Math.sin(2 * Math.PI * 0.9 * t + 1.3));
  let sway = 0, props = '';
  const dir = f.toward === 'L' ? -1 : 1;
  if (f.stance === 'steady') sway = wobble(0.4);
  else if (f.stance === 'sways') sway = wobble(3) + dir * (f.toward ? 1.5 : 0);
  else {
    /* falls: the sway grows toward one side and is caught at about 9° (the examiner stands ready) */
    const lean = Math.min(9, 9 * minJerk(since / 2.2));
    sway = dir * lean + wobble(1);
    if (lean > 7) props = 'catch';
  }
  return { pose: { ...base, eyes: shut ? 1 : 0, foot: [0, 0] }, props, view: 90, sway: (f.toward || f.stance !== 'falls') ? sway : sway };
}


export type GaitPattern = 'normal' | 'veers' | 'ataxic' | 'unable' | 'hemiplegic' | 'high-stepping' | 'waddling' | 'sensory-ataxic' | 'parkinsonian';
export interface GaitFinding { pattern: GaitPattern; toward?: 'L' | 'R' }

/** A periodic bump on the gait cycle (0–1), centred at c, of width w. */
const bump = (x: number, c: number, w: number) => { const d = ((x - c + 1.5) % 1) - 0.5; return Math.exp(-(d * d) / (2 * w * w)); };

/** One leg's sagittal angles over the gait cycle, from heel strike (0): hip flexion, knee flexion, ankle dorsiflexion
    (degrees). The shapes follow the normal adult curves (Winter's: hip about 25° flexed at heel strike to 10° extended
    late in stance; knee a 15° flexion in loading and 60° in swing; ankle 10° dorsiflexed in late stance, 20° plantarflexed
    at toe-off); the curves themselves are drawn by eye. */
function legAngles(phi: number) {
  const hip = 7.5 + 17.5 * Math.cos(2 * Math.PI * (phi - 0.02));
  const knee = 15 * bump(phi, 0.15, 0.07) + 60 * bump(phi, 0.72, 0.1) + 3;
  const ankle = -5 * bump(phi, 0.05, 0.03) + 10 * bump(phi, 0.45, 0.1) - 20 * bump(phi, 0.62, 0.05);
  return { hip, knee, ankle };
}

const CADENCE: Record<GaitPattern, number> = { parkinsonian: 0.95, normal: 1.1, veers: 1.15, ataxic: 1.45, unable: 1.4, hemiplegic: 1.7, 'high-stepping': 1.25, waddling: 1.4, 'sensory-ataxic': 1.35 };

/** Walking, `t` seconds in, by the gait the examination model finds. Each gait changes the normal curves the way the
    textbooks describe it: hemiplegic (the affected leg stiff, its foot pointed, swung round in a half-circle, the arm held
    bent and still); high-stepping (the hip and knee lifted high to clear a dropped foot, which slaps down); waddling (the
    trunk lurching over each standing leg, the pelvis dropping on the other); ataxic (broad-based, irregular, reeling);
    sensory-ataxic (broad-based, high steps stamped down, watching the feet); veering (drifting to one side); unable
    (standing, needing the examiner's hand). All sizes are placements judged by eye. */
export function gait(base: Pose, look: FigureLook, t: number, f: GaitFinding): MotionFrame {
  const J = figureJoints(base, look), s = J.anterior.x >= 0 ? 1 : -1, down = -90;
  const T = CADENCE[f.pattern];
  const aff: 0 | 1 | -1 = f.toward === 'R' ? 0 : f.toward === 'L' ? 1 : -1;
  if (f.pattern === 'unable') {
    /* he stands and sways, and would fall without the examiner's hand */
    const sway = (f.toward === 'L' ? -1 : 1) * (5 + 3 * Math.sin(2 * Math.PI * 0.4 * t));
    return { pose: { ...base }, props: 'catch', view: 90, sway };
  }
  /* an ataxic gait is irregular: its timing wanders */
  const irregular = f.pattern === 'ataxic' || f.pattern === 'sensory-ataxic';
  const tt = irregular ? t + 0.09 * Math.sin(2 * Math.PI * 0.31 * t) + 0.05 * Math.sin(2 * Math.PI * 0.83 * t) : t;
  const thigh: [number, number] = [0, 0], shin: [number, number] = [0, 0], foot: [number, number] = [0, 0], out: [number, number] = [0, 0];
  const armUpper: [number, number] = [0, 0], armFore: [number, number] = [0, 0], hand: [number, number] = [6, 6];
  for (const j of [0, 1] as const) {
    const phi = (((tt / T + (j === 0 ? 0 : 0.5)) % 1) + 1) % 1;
    let { hip, knee, ankle } = legAngles(phi);
    /* parkinsonian: short, shuffling steps (the hip's swing under half), feet barely lifted and landing flat */
    if (f.pattern === 'parkinsonian') { hip = 7.5 + (hip - 7.5) * 0.45; knee = 10 + (knee - 3) * 0.55; ankle *= 0.3; }
    const swing = bump(phi, 0.78, 0.12);
    if (irregular) { const k = 1 + 0.25 * Math.sin(2 * Math.PI * (0.23 * t + j * 0.4)); hip *= k; }
    if (f.pattern === 'hemiplegic' && j === aff) { hip = 4 + 9 * Math.cos(2 * Math.PI * phi); knee = 6 + 10 * bump(phi, 0.15, 0.07) + 12 * swing; ankle = -18 * swing - 6; out[j] = 10 * swing; }
    if (f.pattern === 'high-stepping' && (j === aff || aff === -1)) { hip += 22 * swing; knee += 35 * swing; ankle = -28 * bump(phi, 0.8, 0.14) + (phi < 0.06 ? -10 * (1 - phi / 0.06) : 0); }
    if (f.pattern === 'sensory-ataxic') { hip += 14 * swing; knee += 22 * swing; }
    if (irregular) out[j] = 7 + 2 * Math.sin(2 * Math.PI * (0.17 * t + j));
    thigh[j] = down + s * hip;
    shin[j] = thigh[j] - s * knee;
    foot[j] = -ankle;
    /* the arms swing against the legs: the right arm forward with the left leg */
    const arm = 14 * Math.cos(2 * Math.PI * (phi + 0.5 - 0.02));
    armUpper[j] = down + s * arm;
    armFore[j] = armUpper[j] + s * (18 + 6 * Math.sin(2 * Math.PI * phi));
    if (f.pattern === 'hemiplegic' && j === aff) { armUpper[j] = down + s * 12; armFore[j] = down + s * 140; hand[j] = -s * 80; }
    if (irregular) { armUpper[j] = down + s * (arm * 0.5 + 8); }
    if (f.pattern === 'parkinsonian') { armUpper[j] = down + s * (arm * 0.15 + 2); armFore[j] = armUpper[j] + s * 50; }
  }
  const pose: Pose = { ...base, thigh, shin, foot, armUpper, armFore, hand, legOut: out,
    ...(f.pattern === 'hemiplegic' && aff >= 0 ? { fist: (aff === 0 ? [1, 0] : [0, 1]) as [number, number] } : {}),
    ...(f.pattern === 'sensory-ataxic' ? { neck: -22, head: -8 } : {}),
    /* stooped: the trunk and neck bent forward */
    ...(f.pattern === 'parkinsonian' ? { torso: base.torso - s * 14, pelvis: base.pelvis - s * 4, neck: -14, head: 6 } : {}),
    ...(f.pattern === 'waddling' ? { pelvis: base.pelvis + 3, torso: base.torso - 4 } : {}) };
  /* how far the hips have come: as fast as a standing foot sweeps back under them (the unaffected leg's stance from
     10 % to 50 % of the cycle), so the foot on the ground stays put */
  const hipScale = f.pattern === 'parkinsonian' ? 0.45 : 1;
  const sweep = (phi: number) => { const a0 = legAngles(phi), a = { hip: 7.5 + (a0.hip - 7.5) * hipScale, knee: f.pattern === 'parkinsonian' ? 10 + (a0.knee - 3) * 0.55 : a0.knee }, th = (down + s * a.hip) * D2R, sh = (down + s * (a.hip - a.knee)) * D2R; return LEN.thigh * Math.cos(th) + LEN.shin * Math.cos(sh); };
  const speed = (Math.abs(sweep(0.1) - sweep(0.5)) / (0.4 * T)) * J.u * (irregular ? 0.9 : f.pattern === 'parkinsonian' ? 0.8 : 1);
  const ahead = speed * t;
  const lurch = f.pattern === 'waddling' ? 6 * Math.sin(2 * Math.PI * t / T) : f.pattern === 'hemiplegic' ? 2.5 * Math.sin(2 * Math.PI * t / T) : irregular ? 3 * Math.sin(2 * Math.PI * 0.37 * t) + 2 * Math.sin(2 * Math.PI * 0.9 * t) : 0;
  const lean = f.toward === 'L' ? -1 : 1;
  const drift = f.pattern === 'veers' ? lean * 12 * ((t % 6) / 6) * J.u : irregular ? 6 * Math.sin(2 * Math.PI * 0.21 * t) * J.u : 0;
  return { pose, props: '', walk: { ahead, drift, lurch } };
}


export interface ToneFinding { tone?: 'normal' | 'reduced' | 'spastic' | 'rigid'; restTremor?: boolean }

/** A hand of the examiner, gripping at `at`, the sleeve coming in from `from` (a direction in degrees). */
function grip(at: Pt, u: number, from: number): string {
  const d = dir(from), sx = at.x + d.x * 26 * u, sy = at.y + d.y * 26 * u;
  return `<path d="M${f(sx)} ${f(sy)} L${f(at.x + d.x * 5 * u)} ${f(at.y + d.y * 5 * u)}" stroke="#4f7f86" stroke-width="${f(6.5 * u)}" stroke-linecap="round"/>`
    + `<ellipse cx="${f(at.x)}" cy="${f(at.y)}" rx="${f(4.6 * u)}" ry="${f(3.4 * u)}" fill="#e2b89a" stroke="#b98d70" stroke-width="${f(0.35 * u)}" transform="rotate(${f(-from)} ${f(at.x)} ${f(at.y)})"/>`;
}

/** Tone, sitting, arm i, `t` seconds in (a 9 s cycle): 3 s of the hands lying still on the thighs, where a rest tremor
    shows (4–6 Hz, Deuschl 1998; 5 Hz here, about 6° at the wrist: a placement), then the examiner bends and straightens
    the relaxed elbow, once a second each way. Normal tone moves smoothly; spastic tone catches on the stretch and gives way
    (clasp-knife); rigid tone is stiff all the way, in small steps (cogwheel); reduced tone lets the hand flop. The sizes
    and times of each are placements. */
export function toneTest(base: Pose, look: FigureLook, t: number, finding: ToneFinding = {}, i: 0 | 1 = 0): MotionFrame {
  const J0 = figureJoints(base, look), s = J0.anterior.x >= 0 ? 1 : -1;
  const set = (pair: [number, number], v: number): [number, number] => (i === 0 ? [v, pair[1]] : [pair[0], v]);
  const CYCLE = 9, c = ((t % CYCLE) + CYCLE) % CYCLE;
  const tremor = finding.restTremor ? 6 * Math.sin(2 * Math.PI * 5 * t) : 0;
  if (c < 3) {
    /* at rest on the thigh; a rest tremor rolls the hand */
    const hand = set(base.hand, base.hand[i] + tremor);
    const other = i === 0 ? 1 : 0, h2: [number, number] = [hand[0], hand[1]];
    if (finding.restTremor) h2[other] = base.hand[other];
    return { pose: { ...base, hand: h2 }, props: '' };
  }
  /* the examiner's passive movement: the elbow from 20° to 120° of flexion and back (2 s) */
  const x = (c - 3) % 2, flexing = x < 1, ph = flexing ? x : x - 1;
  let e = 20 + 100 * (flexing ? minJerk(ph) : 1 - minJerk(ph));
  let handLag = 0;
  const tone = finding.tone ?? 'normal';
  if (tone === 'spastic' && !flexing) {
    /* stretching the flexors: the resistance builds, then gives way at once (clasp-knife) */
    const held = 0.35, catchAt = 0.3;
    const pp = ph < catchAt ? ph : ph < catchAt + held ? catchAt : catchAt + (ph - catchAt - held) * ((1 - catchAt) / (1 - catchAt - held));
    e = 20 + 100 * (1 - minJerk(pp));
  }
  if (tone === 'rigid') e = 20 + 100 * (flexing ? ph : 1 - ph) + 2.5 * Math.sign(Math.sin(2 * Math.PI * 6 * t));
  if (tone === 'reduced') handLag = -s * 22 * Math.sin(Math.PI * ph);
  const upper = -90 + s * 8, fore = upper + s * e;
  const pose: Pose = { ...base, armUpper: set(base.armUpper, upper), armFore: set(base.armFore, fore), hand: set(base.hand, handLag + (finding.restTremor ? tremor * 0.3 : 0)) };
  const J = figureJoints(pose, look), u = J.u;
  /* the examiner stands in front: one hand round the wrist, the other cupping the elbow, both arms coming from the front */
  const props = `<g class="examiner" pointer-events="none">${grip(J.k.wrist[i], u, s > 0 ? 18 : 162)}${grip(J.k.elbow[i], u, s > 0 ? -22 : 202)}</g>`;
  return { pose, props };
}

/* ---- the tendon reflexes, one after another -------------------------------------------------------------------- */

/** The hammer, held at `pivot` (the examiner's hand), its head brought down onto `target` at `strike` s into a beat of
    `c` s and lifted away again; `lift` turns the raised hammer one way or the other. */
function hammerAt(target: Pt, pivot: Pt, c: number, strike: number, u: number, lift: 1 | -1 = 1): string {
  const swing = (c < strike ? 55 * (1 - minJerk(c / strike)) : 55 * (1 - (1 - Math.min(1, (c - strike) / 0.25)) ** 2)) * lift;
  const r = dist(pivot, target), a0 = ang(pivot, target) - swing;
  const head = { x: pivot.x + Math.cos(a0 * D2R) * r, y: pivot.y - Math.sin(a0 * D2R) * r }, hd = dir(a0 + 90);
  const back = dir(ang(target, pivot));
  return `<path d="M${f(pivot.x)} ${f(pivot.y)} L${f(head.x)} ${f(head.y)}" stroke="#6b6f76" stroke-width="${f(1.1 * u)}" stroke-linecap="round"/>`
    + `<path d="M${f(head.x - hd.x * 4 * u)} ${f(head.y - hd.y * 4 * u)} L${f(head.x + hd.x * 4 * u)} ${f(head.y + hd.y * 4 * u)}" stroke="#c0392b" stroke-width="${f(3 * u)}" stroke-linecap="round"/>`
    + `<path d="M${f(pivot.x + back.x * 3 * u)} ${f(pivot.y + back.y * 3 * u)} L${f(pivot.x + back.x * 28 * u)} ${f(pivot.y + back.y * 28 * u + 6 * u)}" stroke="#4f7f86" stroke-width="${f(7.5 * u)}" stroke-linecap="round"/>`
    + `<rect x="${f(pivot.x - 2.5 * u)}" y="${f(pivot.y - 3.2 * u)}" width="${f(7.5 * u)}" height="${f(6.4 * u)}" rx="${f(2.6 * u)}" fill="#e2b89a" stroke="#b98d70" stroke-width="${f(0.35 * u)}"/>`;
}

/** The muscle's jerk after the tap, as a share of its size: one quick contraction and back with a small overswing, and
    at grade 4 a few further beats at about 6 Hz (clonus). Times are placements, as for the knee jerk. */
function jerk(since: number, grade: ReflexGrade): number {
  const pulse = (x: number) => (x <= 0 ? 0 : x < 0.3 ? Math.sin((Math.PI * x) / 0.3) : -0.12 * Math.sin(Math.PI * Math.min(1, (x - 0.3) / 0.3)));
  let k = pulse(since);
  if (grade >= 4) for (let b = 1; b <= 5; b++) k += 0.45 * Math.pow(0.8, b) * Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, since - 0.3 - (b - 1) / 6) * 6)));
  return grade === 0 ? 0 : k;
}

export interface ArmReflexFinding { biceps: ReflexGrade; supinator: ReflexGrade; triceps: ReflexGrade }
export const ARM_REFLEX_ORDER = ['biceps', 'supinator', 'triceps'] as const;

/** The arm reflexes, sitting, arm i, `t` seconds in: biceps, supinator, triceps, 2.4 s each. For the biceps and the
    supinator the forearm rests bent across the lap and the jerk bends the elbow; for the triceps the examiner holds the
    upper arm out in front with the forearm hanging, and the jerk straightens it. Swing sizes by grade are placements:
    0, 5, 12, 22° (biceps, triceps), 0, 3, 8, 15° (supinator). Returns which reflex is being tested. */
export function armReflexes(base: Pose, look: FigureLook, t: number, g: ArmReflexFinding, i: 0 | 1 = 0): MotionFrame & { reflex: typeof ARM_REFLEX_ORDER[number] } {
  const J0 = figureJoints(base, look), s = J0.anterior.x >= 0 ? 1 : -1, u = J0.u;
  const set = (pair: [number, number], v: number): [number, number] => (i === 0 ? [v, pair[1]] : [pair[0], v]);
  const BEAT = 2.4, STRIKE = 0.55, n = Math.floor((((t % (3 * BEAT)) + 3 * BEAT) % (3 * BEAT)) / BEAT), c = ((t % BEAT) + BEAT) % BEAT;
  const reflex = ARM_REFLEX_ORDER[n], since = c - STRIKE - 0.02;
  const AMP: Record<string, number[]> = { biceps: [0, 5, 12, 22, 22], supinator: [0, 3, 8, 15, 15], triceps: [0, 5, 12, 22, 22] };
  const k = jerk(since, g[reflex]) * AMP[reflex][g[reflex]];
  let pose: Pose, target: Pt, pivot: Pt, lift: 1 | -1 = 1;
  if (reflex === 'triceps') {
    const upper = s > 0 ? 0 : 180, fore = -90 + s * k;   // the jerk swings the forearm forward
    pose = { ...base, armUpper: set(base.armUpper, upper - s * 5), armFore: set(base.armFore, fore), hand: set(base.hand, 0) };
    const J = figureJoints(pose, look), el = J.k.elbow[i];
    target = { x: el.x - s * 1 * u, y: el.y - 4 * u };          // just above the olecranon, behind the elbow
    pivot = { x: target.x - s * 6 * u, y: target.y - 24 * u }; lift = s > 0 ? -1 : 1;
  } else {
    /* forearm across the lap, elbow at about 100°: the jerk bends it */
    const upper = -90 + s * 6, fore = upper + s * (100 + k);
    pose = { ...base, armUpper: set(base.armUpper, upper), armFore: set(base.armFore, fore), hand: set(base.hand, -s * 10) };
    const J = figureJoints(pose, look), el = J.k.elbow[i], wr = J.k.wrist[i];
    const fd = dir(J.k.foreA[i]);
    target = reflex === 'biceps' ? { x: el.x + fd.x * 3 * u - s * 0 * u, y: el.y + fd.y * 3 * u - 3 * u }   // the examiner's thumb on the tendon at the elbow
      : { x: wr.x - fd.x * 6 * u, y: wr.y - fd.y * 6 * u - 2.5 * u };                                     // the radius, a hand's breadth above the wrist
    /* held from above and in front, raised away from the arm */
    pivot = { x: target.x + s * 12 * u, y: target.y - 24 * u }; lift = s > 0 ? -1 : 1;
  }
  const thumb = reflex === 'biceps' ? `<ellipse cx="${f(target.x)}" cy="${f(target.y + 1.2 * u)}" rx="${f(2.6 * u)}" ry="${f(1.6 * u)}" fill="#e2b89a" stroke="#b98d70" stroke-width="${f(0.3 * u)}"/>` : '';
  return { pose, props: `<g class="examiner" pointer-events="none">${thumb}${hammerAt(target, pivot, c, STRIKE, u, lift)}</g>`, reflex };
}

export interface LegReflexFinding { knee: ReflexGrade; ankle: ReflexGrade; plantar: 'flexor' | 'extensor' }

/** The leg reflexes, sitting, leg i, `t` seconds in: the knee jerk (2.4 s), the ankle jerk (2.4 s; the examiner's hand
    under the sole holds the foot up a little, the hammer strikes the Achilles tendon and the foot jerks down, with
    clonus at grade 4), and the plantar response (3 s; a blunt point drawn along the outer sole toward the little toe:
    the toes curl down when flexor, the big toe goes up when extensor, Babinski's sign). Sizes are placements. */
export function legReflexes(base: Pose, look: FigureLook, t: number, g: LegReflexFinding, i: 0 | 1 = 0): MotionFrame & { reflex: 'knee' | 'ankle' | 'plantar' } {
  const CYCLE = 7.8, c0 = ((t % CYCLE) + CYCLE) % CYCLE;
  if (c0 < 2.4) return { ...kneeJerk(base, look, c0, g.knee, i), reflex: 'knee' };
  const J0 = figureJoints(base, look), s = J0.anterior.x >= 0 ? 1 : -1, u = J0.u;
  const set = (pair: [number, number], v: number): [number, number] => (i === 0 ? [v, pair[1]] : [pair[0], v]);
  if (c0 < 4.8) {
    const c = c0 - 2.4, STRIKE = 0.55, since = c - STRIKE - 0.03;
    const k = jerk(since, g.ankle) * [0, 6, 14, 22, 22][g.ankle];
    /* held a little dorsiflexed (foot -12°), the jerk plantarflexes it */
    const pose: Pose = { ...base, foot: set(base.foot, base.foot[i] - 12 + k) };
    const J = figureJoints(pose, look), an = J.k.ankle[i], sd = dir(J.k.shinA[i]);
    const back = dir(J.k.shinA[i] - 90 * s);
    const target = { x: an.x - sd.x * 4 * u + back.x * 4 * u, y: an.y - sd.y * 4 * u + back.y * 4 * u };   // the Achilles tendon above the heel
    const pivot = { x: target.x - s * 22 * u, y: target.y - 8 * u };
    const fa = J.k.footA[i], sole = { x: an.x + dir(fa).x * 12 * u + dir(fa - 90 * s).x * 7 * u, y: an.y + dir(fa).y * 12 * u + dir(fa - 90 * s).y * 7 * u };
    const hand = `<path d="M${f(sole.x + s * 26 * u)} ${f(sole.y + 10 * u)} L${f(sole.x + s * 4 * u)} ${f(sole.y + 2 * u)}" stroke="#4f7f86" stroke-width="${f(6.5 * u)}" stroke-linecap="round"/><ellipse cx="${f(sole.x)}" cy="${f(sole.y + 1.5 * u)}" rx="${f(5 * u)}" ry="${f(3 * u)}" fill="#e2b89a" stroke="#b98d70" stroke-width="${f(0.35 * u)}"/>`;
    return { pose, props: `<g class="examiner" pointer-events="none">${hand}${hammerAt(target, pivot, c, STRIKE, u, s > 0 ? -1 : 1)}</g>`, reflex: 'ankle' };
  }
  /* the plantar response: the stroke takes 1.2 s from the heel; the toes answer from 0.6 s */
  const c = c0 - 4.8, prog = clamp(c / 1.2, 0, 1), resp = minJerk(clamp((c - 0.6) / 0.5, 0, 1)) * (c < 2.6 ? 1 : 1 - minJerk((c - 2.6) / 0.4));
  const ext = g.plantar === 'extensor';
  const pose: Pose = { ...base, toe: set((base.toe ?? [0, 0]) as [number, number], ext ? 55 * resp : -20 * resp), foot: set(base.foot, base.foot[i] - (ext ? 6 * resp : 0)) };
  const J = figureJoints(pose, look), an = J.k.ankle[i], fa = J.k.footA[i];
  const along = dir(fa), under = dir(fa - 90 * s);
  const at = (x: number) => ({ x: an.x + along.x * x * u + under.x * 7.4 * u, y: an.y + along.y * x * u + under.y * 7.4 * u });
  const tip = at(-4 + 19 * prog), tail = { x: tip.x + s * 10 * u, y: tip.y + 12 * u };
  const pen = c < 1.6 ? `<path d="M${f(tail.x)} ${f(tail.y)} L${f(tip.x)} ${f(tip.y)}" stroke="#3a3f47" stroke-width="${f(1.4 * u)}" stroke-linecap="round"/><path d="M${f(tail.x + s * 2 * u)} ${f(tail.y + 2.4 * u)} L${f(tail.x + s * 18 * u)} ${f(tail.y + 12 * u)}" stroke="#4f7f86" stroke-width="${f(6.5 * u)}" stroke-linecap="round"/>` : '';
  return { pose, props: `<g class="examiner" pointer-events="none">${pen}</g>`, reflex: 'plantar' };
}
