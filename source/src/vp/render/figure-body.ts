/* ---------------------------------------------------------------------------
   Figure body: the shape of this patient and the skeleton it hangs on.

   Shape. Every part is described by stations along its bone: at each
   station, how far the skin lies in front of the bone (anterior) and behind
   it (posterior). The numbers are profile depths of an average man, 176 cm,
   BMI 24, in "reference centimetres" (1/176 of the patient's height), taken
   from anthropometric tables and simplified. The patient then changes them:
   fat adds where this patient stores it (belly for central, buttocks and
   thighs for peripheral), lost muscle thins the limbs but not the bones,
   ascites fills the belly, oedema the legs, emphysema the chest. So two
   patients with the same BMI still look different, and a cirrhotic man has
   thin arms and a big belly at once.

   Skeleton. Joints are placed by angles from the pose. The spine bends
   smoothly between pelvis and thorax (the lumbar curve), so the trunk can
   sit, slump and lean; the outline follows the bent spine station by
   station, which is why the back keeps its S-curve in every position.
--------------------------------------------------------------------------- */

import { add, clamp, closedPath, dir, lerp, off, smooth, type Pt } from './figure-geom.ts';
import type { FigureLook, Pose } from './patient-figure.ts';

/** Along the bone, in front of it, behind it (reference cm). */
export interface Station { s: number; a: number; p: number }

/** Bone lengths as reference cm (fractions of height × 176, after Drillis & Contini). */
export const LEN = { pelvis: 17, chest: 33, shoulderS: 46.5, neckRootS: 54, neck: 10, thigh: 43, shin: 43.3, upper: 32.7, fore: 25.7, hand: 18.5 };

export interface Shape {
  u: number;                              // px per reference cm
  trunk: Station[]; neck: Station[];
  thigh: Station[]; shin: Station[]; upper: Station[]; fore: Station[]; hand: Station[]; fingers: Station[];
  foot: Pt[];                              // closed outline in the foot frame: x heel→toe, y toward the instep
  /* what the details need to know */
  female: boolean; old: number;            // old: 0 under 60 … 1 at 85
  bony: number;                            // 0 … 1: clavicles, ribs and iliac crest show through
  soft: number;                            // 0 … 1: soft tissue of obesity (double chin, folds)
  wasted: boolean; muscle: number;
  belly: number;                           // how far the belly stands out beyond the ribs (cm)
  navelS: number;
  ascites: number;                         // 0 none, 1 flank, 2 shifting, 3 tense
  oedema: number;                          // 0 none, 1 ankle, 2 shin, 3 knee
  barrel: boolean; kyphosis: number;       // kyphosis: degrees of forward head and rounded upper back
  breast: number;                          // breast projection (cm), 0 for men
}

/** A smooth bump: 1 at c, falling to 0 at c ± w. */
const bump = (s: number, c: number, w: number) => { const x = clamp(1 - Math.abs(s - c) / w, 0, 1); return x * x * (3 - 2 * x); };

export function bodyShape(look: FigureLook, upright: number): Shape {
  const b = look.body;
  const u = (1.62 * clamp(b.heightCm, 140, 200)) / 176;
  const female = look.sex === 'F';
  const old = clamp((look.age - 60) / 25, 0, 1);
  /* Fat beyond (or below) an average BMI of 24, in cm of tissue per BMI unit, spread by distribution. Thin people lose
     fat more slowly than heavy people gain it, and never lose the bones under it. */
  const ex = b.bmi - 24;
  const fat = ex > 0 ? ex : ex * 0.7;
  const central = b.fat === 'central';
  const cw = central ? 1 : 0.45, pw = central ? 0.55 : 1.2;
  const muscle = (b.muscle === 'wasted' ? 0.32 : 1) * (female ? 0.86 : 1) * (1 - 0.15 * old);
  const bony = clamp((18.5 - b.bmi) / 3.5, 0, 1) * 0.8 + (b.muscle === 'wasted' ? 0.35 : 0) * (b.bmi < 26 ? 1 : 0.5);
  const soft = clamp((b.bmi - 29) / 8, 0, 1);
  const asc = { none: 0, flank: 1, shifting: 2, tense: 3 }[b.ascites];
  const oed = { none: 0, ankle: 1, shin: 2, knee: 3 }[b.oedema];
  const barrel = b.breathing.hyperinflated;
  const kyphosis = 14 * old + (barrel ? 6 : 0);
  /* Lying, the belly spreads to the flanks and flattens; upright, it hangs (more so when old or very fat). */
  const lieFlat = lerp(0.8, 1, upright);
  const sag = upright * (3 * old + 3 * soft);

  /* ---- trunk: s from the hip joint up the spine to the root of the neck ---- */
  const T: Array<[number, number, number]> = [
    [-10, 6.6, 7.4], [-4, 8.2, 11.2], [2, 8.6, 11.0], [8, 9.4, 8.6], [14, 10.0, 6.6], [20, 9.9, 6.6],
    [26, 10.1, 8.0], [32, 11.4, 9.9], [38, 11.8, 10.8], [44, 10.8, 10.4], [49, 8.6, 9.0], [53, 6.4, 6.8], [56, 5.6, 5.6],
  ];
  const ascBelly = [0, 3, 7.5, 15][asc];
  const trunk = T.map(([s, a0, p0]) => {
    let a = a0, p = p0;
    if (female) {
      a += -0.9 * bump(s, 20, 8) + 0.5 * bump(s, 4, 6);          // narrower waist, rounder lower belly
      p += 1.7 * bump(s, -2, 8) - 0.5 * bump(s, 40, 10);         // fuller buttock, smaller back
    }
    /* belly fat, centred a little below the navel; it hangs lower when standing */
    const bellyC = 15 - sag;
    a += fat * cw * 1.35 * bump(s, bellyC, 21) * lieFlat + fat * 0.3 * bump(s, 2, 8);
    a += fat * 0.2 * bump(s, 38, 10);                           // chest fat
    p += fat * 0.3 * bump(s, 22, 22) + fat * pw * 0.62 * bump(s, -3, 11);  // flanks and back, buttocks
    /* muscle: buttocks and upper back shrink when wasted */
    p -= (1 - muscle) * (2.2 * bump(s, -3, 8) + 1.2 * bump(s, 44, 8));
    /* ascites: a round dome from the pubis to the ribs (square root of the bump: full sides, no point); lying, it
       shifts to the flanks */
    a += ascBelly * Math.sqrt(bump(s, 15, 19)) * Math.max(lieFlat, 0.92) + (asc ? 0.6 : 0) * bump(s, 16, 17);
    p += (asc >= 2 ? 1 : 0) * bump(s, 18, 12) * (2 - upright);
    /* barrel chest: deeper front to back; kyphosis rounds the upper back */
    if (barrel) { a += 2.8 * bump(s, 40, 12); p += 2.4 * bump(s, 40, 12); }
    p += kyphosis * 0.12 * bump(s, 46, 9);
    /* the ribcage and pelvis are bone: they never get thinner than this */
    a = Math.max(a, s > 28 ? 9.6 : s > 22 ? 7 : s < -6 ? 5 : 4.5);
    p = Math.max(p, s > 30 ? 8.6 : s < 6 ? 6.6 : 5.6);
    return { s, a, p };
  });
  /* belly beyond the ribs: what the details (navel, folds) and the gown's drape need */
  const at = (s: number) => trunk.reduce((best, t) => (Math.abs(t.s - s) < Math.abs(best.s - s) ? t : best));
  const belly = at(14).a - at(32).a;

  /* breasts sit on the chest at the 4th–5th rib; they flatten and slide sideways lying down and descend with age */
  const breast = female ? (3.2 + Math.max(0, fat) * 0.38) * lerp(0.55, 1, upright) : 0;
  if (breast) for (const t of trunk) t.a += breast * bump(t.s, 37 - 3 * old * upright, 7);

  /* ---- limbs: core (bone), muscle and fat at each station ---- */
  const limb = (rows: Array<[number, number, number, number, number]>, core: number, oedemaFrom = 99) => rows.map(([s, a0, p0, ka, kp]) => {
    const m = (v: number, k: number) => core + Math.max(0.2, v - core - 1.2) * muscle + Math.max(0.35, 1.2 + fat * k * 1.45);
    let a = m(a0, ka), p = m(p0, kp);
    if (oed && s >= oedemaFrom - 6) { const w = smooth(oedemaFrom - 6, oedemaFrom + 4, s); a += 2.3 * w; p += 2.9 * w; }
    return { s, a, p };
  });
  const thigh = limb([[-4, 8.6, 9.0, 0.3 * pw, 0.42 * pw], [4, 8.6, 8.4, 0.34 * pw, 0.4 * pw], [14, 8.1, 7.4, 0.3 * pw, 0.32 * pw], [25, 7.0, 6.3, 0.22 * pw, 0.2 * pw],
    [35, 5.9, 5.5, 0.13, 0.1], [43, 5.5, 5.2, 0.08, 0.06], [47.5, 3.6, 3.2, 0.04, 0.04]], 2.6);
  /* Oedema climbs from the ankle: the stations below its level swell, and the ankle loses its waist and tendons. */
  const oedemaFrom = [99, 30, 16, 0][oed];
  const shin = limb([[-4, 4.4, 4.2, 0.06, 0.06], [0, 5.2, 5.0, 0.08, 0.1], [6, 4.5, 5.9, 0.06, 0.12], [13, 4.0, 6.7, 0.05, 0.13], [22, 3.6, 5.7, 0.04, 0.1],
    [31, 3.1, 3.8, 0.03, 0.05], [38, 2.8, 2.5, 0.02, 0.02], [43.3, 3.0, 2.8, 0.02, 0.02]], 1.9, oedemaFrom);
  if (oed) {   // fill the hollow behind the ankle: no Achilles tendon, no malleolus
    const s38 = shin[6], s31 = shin[5], s43 = shin[7];
    s38.p = Math.max(s38.p, (s31.p + s43.p) / 2 + 0.6); s43.a += 0.6; s43.p += 0.5;
  }
  const upper = limb([[-5, 5.4, 5.6, 0.12, 0.14], [0, 5.7, 5.9, 0.14, 0.18], [8, 5.2, 5.1, 0.16, 0.26], [17, 4.4, 4.7, 0.14, 0.3], [26, 3.6, 3.9, 0.08, 0.16],
    [32.7, 3.1, 3.5, 0.04, 0.06], [35.5, 2.4, 2.4, 0.03, 0.03]], 1.6);
  const fore = limb([[-3, 3.0, 3.0, 0.04, 0.04], [0, 3.6, 3.4, 0.06, 0.06], [6, 4.1, 3.6, 0.07, 0.06], [15, 3.2, 2.9, 0.04, 0.04], [25.7, 2.3, 2.1, 0.02, 0.02]], 1.4);
  /* the palm to the knuckles; the fingers are a second segment so they can curl (figureSvg) */
  const hand: Station[] = [[-1.5, 2.1, 1.9], [3, 2.4, 1.6], [7, 2.0, 1.5], [9.8, 1.6, 1.3]]
    .map(([s, a, p]) => ({ s, a: a + Math.max(0, fat) * 0.03, p: p + Math.max(0, fat) * 0.03 }));
  const fingers: Station[] = [[-1, 1.5, 1.2], [3, 1.25, 1.05], [6.5, 1.0, 0.9], [8.6, 0.55, 0.5]].map(([s, a, p]) => ({ s, a: a + Math.max(0, fat) * 0.02, p: p + Math.max(0, fat) * 0.02 }));
  /* neck: thick in obesity, thin and corded in wasting */
  const nk = (v: number) => v * (0.82 + 0.18 * muscle) + Math.max(-0.6, fat * 0.12);
  const neck: Station[] = [[-3, 6.2, 6.4], [0, 5.8, 5.9], [5, 5.3, 5.1], [10, 5.2, 4.7], [13, 4.8, 4.4]].map(([s, a, p]) => ({ s, a: nk(a), p: nk(p) }));

  /* foot: heel behind the ankle, sole about 7 cm below it, toes 20 cm in front; oedema puffs the instep */
  const pf = oed ? 2.1 : 0;
  const foot: Pt[] = [
    { x: -2.7, y: 4.6 + (oed ? 0.8 : 0) }, { x: -4.1, y: 1.0 + pf * 0.3 }, { x: -5.6, y: -2.5 }, { x: -5.3, y: -5.6 }, { x: -3.6, y: -7.0 }, { x: 2, y: -7.1 },
    { x: 9, y: -6.8 }, { x: 15.5, y: -7.0 }, { x: 19.6, y: -6.4 }, { x: 20.9, y: -5.0 }, { x: 20.2, y: -3.7 }, { x: 18.3, y: -3.3 + pf * 0.2 },
    { x: 16.8, y: -3.25 + pf * 0.3 }, { x: 14, y: -2.8 + pf * 0.6 }, { x: 8, y: -1.2 + pf }, { x: 3.6, y: 1.0 + pf * 0.8 }, { x: 2.0, y: 4.6 + pf * 0.5 },
  ];
  return {
    u, trunk, neck, thigh, shin, upper, fore, hand, fingers, foot, female, old, bony: clamp(bony, 0, 1), soft, wasted: b.muscle === 'wasted', muscle,
    belly, navelS: 12, ascites: asc, oedema: oed, barrel, kyphosis, breast,
  };
}

/* ---- skeleton ---- */

export interface Skeleton {
  u: number;
  spine: Array<{ p: Pt; a: number }>;    // every reference cm from S0
  hip: Pt; shoulder: Pt; neckRoot: Pt; headJoint: Pt;
  neckA: number; headA: number;           // neck direction; the head's "up"
  knee: [Pt, Pt]; ankle: [Pt, Pt]; thighA: [number, number]; shinA: [number, number]; footA: [number, number];
  elbow: [Pt, Pt]; wrist: [Pt, Pt]; upperA: [number, number]; foreA: [number, number]; handA: [number, number];
  flip: number;                           // 1 when prone: everything anterior faces the bed
}
export const S0 = -14;

export function skeleton(p: Pose, sh: Shape, hip: Pt): Skeleton {
  const u = sh.u;
  /* The lumbar spine blends the pelvis angle into the thorax angle over the waist, so a bend is a curve, not a hinge. */
  const spine: Array<{ p: Pt; a: number }> = [];
  let pt = add(hip, p.pelvis, S0 * u);
  for (let s = S0; s <= 60; s++) {
    const a = lerp(p.pelvis, p.torso, smooth(LEN.pelvis - 9, LEN.pelvis + 9, s));
    spine.push({ p: pt, a });
    pt = add(pt, a, u);
  }
  const sp = (s: number) => spine[Math.round(s - S0)];
  const flip = p.prone > 0.5 ? -1 : 1;
  const upright = Math.max(0, Math.sin((p.torso * Math.PI) / 180));
  /* An old or emphysematous back pushes the head forward; the eyes stay level by tipping the head back. */
  const kyph = sh.kyphosis * (0.4 + 0.6 * upright);
  const neckA = p.torso + (p.neck - kyph) * flip;
  const headA = neckA + (p.head + kyph * 0.8) * flip;
  const neckRoot = sp(LEN.neckRootS).p;
  const headJoint = add(neckRoot, neckA, LEN.neck * u);
  const shoulder = off(sp(LEN.shoulderS).p, sp(LEN.shoulderS).a, 0, -0.8 * u * flip);
  const two = <T,>(fn: (i: 0 | 1) => T): [T, T] => [fn(0), fn(1)];
  const knee = two((i) => add(hip, p.thigh[i], LEN.thigh * u));
  const ankle = two((i) => add(knee[i], p.shin[i], LEN.shin * u));
  const elbow = two((i) => add(shoulder, p.armUpper[i], LEN.upper * u));
  const wrist = two((i) => add(elbow[i], p.armFore[i], LEN.fore * u));
  return {
    u, spine, hip, shoulder, neckRoot, headJoint, neckA, headA, knee, ankle,
    thighA: [p.thigh[0], p.thigh[1]], shinA: [p.shin[0], p.shin[1]],
    footA: two((i) => p.shin[i] + (90 - p.foot[i]) * flip),
    elbow, wrist, upperA: [p.armUpper[0], p.armUpper[1]], foreA: [p.armFore[0], p.armFore[1]],
    handA: two((i) => p.armFore[i] + p.hand[i] * flip), flip,
  };
}

/** A point on the trunk: s up the spine, x across it (positive = anterior). */
export function trunkPt(k: Skeleton, s: number, x: number): Pt {
  const i = clamp(s - S0, 0, k.spine.length - 1), i0 = Math.floor(i), t = i - i0, i1 = Math.min(i0 + 1, k.spine.length - 1);
  const a = lerp(k.spine[i0].a, k.spine[i1].a, t);
  const base = { x: lerp(k.spine[i0].p.x, k.spine[i1].p.x, t), y: lerp(k.spine[i0].p.y, k.spine[i1].p.y, t) };
  return add(base, a - 90 * k.flip, x * k.u);
}
/** Trunk direction (the spine's angle) at s. */
export const trunkA = (k: Skeleton, s: number) => k.spine[Math.round(clamp(s - S0, 0, k.spine.length - 1))].a;

/** Station value at s by linear interpolation. */
export function stationAt(st: Station[], s: number): Station {
  if (s <= st[0].s) return st[0];
  for (let i = 1; i < st.length; i++) if (s <= st[i].s) {
    const t = (s - st[i - 1].s) / (st[i].s - st[i - 1].s);
    return { s, a: lerp(st[i - 1].a, st[i].a, t), p: lerp(st[i - 1].p, st[i].p, t) };
  }
  return st[st.length - 1];
}

/** Outline points of the trunk between s0 and s1, anterior side up, posterior side down. */
export function trunkOutline(k: Skeleton, sh: Shape, s0 = -99, s1 = 99, grow = 0): Pt[] {
  const st = sh.trunk.filter((t) => t.s > s0 && t.s < s1);
  if (s0 > sh.trunk[0].s) st.unshift(stationAt(sh.trunk, s0));
  if (s1 < sh.trunk[sh.trunk.length - 1].s) st.push(stationAt(sh.trunk, s1));
  const front = st.map((t) => trunkPt(k, t.s, t.a + grow));
  const back = st.map((t) => trunkPt(k, t.s, -t.p - grow)).reverse();
  const out = [...front];
  const top = st[st.length - 1], bot = st[0];
  if (s1 >= 56) out.push(trunkPt(k, top.s + 2, (top.a - top.p) / 2));
  out.push(...back);
  if (s0 <= -10) out.push(trunkPt(k, bot.s - 2.5, (bot.a - bot.p) / 2 - 1.5));
  return out;
}

/** Outline of a limb segment from `from`, pointing along `a`; anterior is a + 90 (or the other side when prone). */
export function limbOutline(from: Pt, a: number, st: Station[], u: number, flip = 1, grow = 0): Pt[] {
  const front = st.map((t) => off(from, a, t.s * u, (t.a + grow) * u * flip));
  const back = st.map((t) => off(from, a, t.s * u, -(t.p + grow) * u * flip)).reverse();
  const last = st[st.length - 1], first = st[0];
  return [...front, off(from, a, (last.s + Math.min(last.a, last.p) * 0.7) * u, ((last.a - last.p) / 2) * u * flip),
    ...back, off(from, a, (first.s - Math.min(first.a, first.p) * 0.7) * u, ((first.a - first.p) / 2) * u * flip)];
}

export function footOutline(k: Skeleton, sh: Shape, i: 0 | 1, grow = 0): Pt[] {
  return sh.foot.map((q) => {
    const g = grow ? 1 + grow / 8 : 1;
    return off(k.ankle[i], k.footA[i], q.x * sh.u * g, q.y * sh.u * k.flip * g);
  });
}

export const path = closedPath;
export { dir };
