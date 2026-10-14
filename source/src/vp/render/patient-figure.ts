/* ---------------------------------------------------------------------------
   Patient figure: the whole patient in profile, seen from the right side of
   the bed, where the examiner stands. Near limbs are the patient's right,
   far limbs (drawn behind, in shade) the left.

   How it is drawn. A skeleton is posed by joint angles (pelvis and thorax
   with a lumbar curve between them, neck, head, and each limb down to hands
   and feet). A body outline hangs on it: every part is a closed curve built
   from anatomical stations (figure-body.ts), with the head, face and hair in
   figure-head.ts and the gown and trolley in figure-dress.ts.

   Parts of one layer are drawn twice, first all of them as a thick outline,
   then all of them filled on top: overlapping parts merge into one
   silhouette with a single contour, so a knee or a hip looks like a joint
   rather than two capsules meeting. The near arm is its own layer, so it
   keeps its contour where it crosses the trunk.

   Placement. The figure rests on what carries it: lying or sitting, it is
   lowered until buttocks, back or heels touch the mattress; standing, until
   the feet touch the floor. Poses blend those two (ground), so a patient
   standing up rises off the bed rather than sinking through the floor.

   Changing position interpolates the pose, so the patient sits up, lies
   down or stands rather than jumping. Every body part carries a data-region
   for touch, and none is highlighted: the examiner chooses where to look.
--------------------------------------------------------------------------- */

import { appearanceOf } from './face-canvas.ts';
import { add, clamp, closedPath, darken, dir, f, lerp, lighten, openPath, smooth, tint, type Pt } from './figure-geom.ts';
import { bodyShape, footOutline, limbOutline, skeleton, stationAt, trunkOutline, trunkPt, trunkA, type Shape, type Skeleton } from './figure-body.ts';
import { ear, face, hairBehind, hairFront, hairOver, headFrame, headOutline, oxygenSvg, type Palette, type Support } from './figure-head.ts';
import { BED_TOP, FLOOR, bra, dressDefs, gown, trolley } from './figure-dress.ts';

export interface Pose {
  hipX: number;             // hip joint, across the drawing
  ground: number;           // 0 resting on the trolley, 1 standing on the floor
  pelvis: number;           // direction from hip toward the waist (degrees: 0 right, 90 up, 180 left)
  torso: number;            // direction of the thorax, waist toward the shoulders; the lumbar spine curves between
  neck: number;             // neck relative to the thorax (negative bends the chin toward the chest)
  head: number;             // head relative to the neck
  armUpper: [number, number]; armFore: [number, number]; hand: [number, number];   // [near, far]; arms absolute, hand relative to forearm
  thigh: [number, number]; shin: [number, number]; foot: [number, number];         // legs absolute; foot = plantar flexion
  prone: number;            // 1 face down
  bed: 'flat' | 'back-raised' | 'edge' | 'none';
  backrest: number;         // backrest angle when raised
  bedLeft: number;          // head end of the mattress (shortened for the head-hanging test)
}

const P = (o: Partial<Pose>): Pose => ({
  hipX: 176, ground: 0, pelvis: 180, torso: 180, neck: -12, head: 0, armUpper: [-9, -7], armFore: [2, 3], hand: [-4, -4],
  thigh: [-7, -6], shin: [1, 2], foot: [32, 34], prone: 0, bed: 'flat', backrest: 0, bedLeft: 14, ...o,
});

export const POSES: Record<string, Pose> = {
  supine: P({}),
  prone: P({ prone: 1, neck: 4, foot: [62, 64], armUpper: [-8, -6] }),
  'left-lateral': P({ neck: -16, head: 0, armUpper: [-30, -22], armFore: [18, 26], hand: [-8, -8], thigh: [36, 30], shin: [-36, -32], foot: [24, 26] }),
  'reclined-45': P({ hipX: 168, pelvis: 152, torso: 132, neck: -16, head: -4, armUpper: [-62, -56], armFore: [-26, -20], hand: [-14, -14], thigh: [2, 4], shin: [-5, -3], foot: [26, 28], bed: 'back-raised', backrest: 46 }),
  sitting: P({ hipX: 212, pelvis: 100, torso: 91, neck: -4, head: 2, armUpper: [-93, -87], armFore: [-28, -22], hand: [-14, -14], thigh: [2, 4], shin: [-84, -80], foot: [14, 16], bed: 'edge' }),
  'sitting-forward': P({ hipX: 208, pelvis: 80, torso: 58, neck: 16, head: 14, armUpper: [-70, -66], armFore: [-76, -72], hand: [-28, -28], thigh: [2, 5], shin: [-84, -80], foot: [12, 14], bed: 'edge' }),
  standing: P({ hipX: 178, ground: 1, pelvis: 93, torso: 89, neck: 0, head: 0, armUpper: [-91, -88], armFore: [-86, -84], hand: [6, 6], thigh: [-90, -89], shin: [-90, -90], foot: [0, 0], bed: 'none' }),
  'head-hanging-left': P({ hipX: 186, neck: 34, head: 0, bedLeft: 98 }),
  'head-hanging-right': P({ hipX: 186, neck: 34, head: 0, bedLeft: 98 }),
};

/** Getting up from lying, or lying down from standing, goes through sitting on the edge of the trolley: a person does
    not swing up stiff-legged, and the legs would sweep through the mattress. */
const lyingDown = (p: Pose) => p.ground < 0.5 && Math.abs(Math.sin((p.shin[0] * Math.PI) / 180)) < 0.6 && Math.abs(Math.sin((p.thigh[0] * Math.PI) / 180)) < 0.6;
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const via = POSES.sitting;
  if (a.ground > 0.5 && lyingDown(b)) return t < 0.5 ? lerpDirect(a, via, t * 2) : lerpDirect(via, b, t * 2 - 1);
  if (b.ground > 0.5 && lyingDown(a)) return t < 0.5 ? lerpDirect(a, via, t * 2) : lerpDirect(via, b, t * 2 - 1);
  return lerpDirect(a, b, t);
}

function lerpDirect(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const l2 = (x: [number, number], y: [number, number]): [number, number] => [l(x[0], y[0]), l(x[1], y[1])];
  return {
    hipX: l(a.hipX, b.hipX), ground: l(a.ground, b.ground), pelvis: l(a.pelvis, b.pelvis), torso: l(a.torso, b.torso), neck: l(a.neck, b.neck), head: l(a.head, b.head),
    armUpper: l2(a.armUpper, b.armUpper), armFore: l2(a.armFore, b.armFore), hand: l2(a.hand, b.hand),
    thigh: l2(a.thigh, b.thigh), shin: l2(a.shin, b.shin), foot: l2(a.foot, b.foot), prone: l(a.prone, b.prone),
    bed: t < 0.5 ? a.bed : b.bed, backrest: l(a.backrest, b.backrest), bedLeft: l(a.bedLeft, b.bedLeft),
  };
}

/** What the patient's body looks like now. Its shape comes from the case (height, weight, fat distribution, muscle);
    what the illness does to it comes from the running model, through the same findings an examiner would see, so the
    figure changes when the model changes (oedema rising, ascites drained, a patient going grey and sweaty). */
export interface FigureBody {
  heightCm: number; weightKg: number; bmi: number;
  fat: 'central' | 'peripheral';                    // central: belly and visceral fat (men, older women); peripheral: hips and thighs
  muscle: 'normal' | 'wasted';
  oedema: 'none' | 'ankle' | 'shin' | 'knee';        // legs.oedema: how far up the legs pitting oedema reaches
  ascites: 'none' | 'flank' | 'shifting' | 'tense'; // abdomen.ascites: from slightly full flanks to a tense, distended belly
  colour: 'normal' | 'pale' | 'grey' | 'flushed' | 'cyanosed' | 'jaundiced';  // general.appearance
  icterus: 'none' | 'mild' | 'marked';              // eyes.sclera
  pallor: 'none' | 'mild' | 'marked';               // eyes.conjunctiva
  sweating: boolean;
  distress: 'none' | 'mild' | 'moderate' | 'severe';
  breathing: { hyperinflated: boolean; accessory: boolean; pursedLips: boolean };  // breathing.pattern: barrel chest, neck muscles working
}

/** Everything the figure draws besides the pose. Built by figureLookFor from the case's patient, the encounter state and
    the model's body findings; the app never assembles it itself, so the figure can use more of the patient without
    touching the app. */
export interface FigureLook {
  skin: string; shade: string;           // skin colour and its shadow
  tone: number;                          // skin tone 1 (lightest) … 6
  hair: string;                          // hair colour
  hairText: string;                      // the case's own description: 'long, dark blonde', 'grey, thinning', 'tied back'
  gown: string; gownShade: string;
  exposed: Set<string>;                  // structures uncovered: 'chest', 'abdomen', …
  sex: 'F' | 'M';
  age: number;
  build: 'slim' | 'average' | 'heavy';
  oxygen?: string;                       // device on the patient, if any ('nasal cannula 2 L/min', …)
  body: FigureBody;
}

/** The parts of a case's patient the figure uses (CaseDef['patient'] satisfies it). */
export interface FigurePatient {
  age: number; sex: 'F' | 'M'; heightCm?: number; weightKg?: number;
  appearance: { skinTone: number; hair: string; build?: 'slim' | 'average' | 'heavy'; eyes?: string; fat?: 'central' | 'peripheral'; muscle?: 'normal' | 'wasted' };
}
/** The parts of the encounter state the figure uses (PatientState satisfies it). */
export interface FigureState { exposure?: string[]; oxygen?: { device: string; fio2: number } }
/** Findings from the running model (each optional; a healthy body is assumed for what is missing). */
export type FigureFindings = Partial<Pick<FigureBody, 'oedema' | 'ascites' | 'colour' | 'icterus' | 'pallor' | 'sweating' | 'distress' | 'breathing'>>;

export function figureLookFor(patient: FigurePatient, state: FigureState, seed: number, findings: FigureFindings = {}): FigureLook {
  const ap = appearanceOf(patient as Parameters<typeof appearanceOf>[0], seed);
  const a = patient.appearance;
  const build = a.build ?? 'average';
  /* Without measurements, a height and weight typical for sex and build. */
  const heightCm = patient.heightCm ?? (patient.sex === 'F' ? 165 : 178);
  const typicalBmi = build === 'slim' ? 20.5 : build === 'heavy' ? 29 : 24;
  const weightKg = patient.weightKg ?? Math.round(typicalBmi * (heightCm / 100) ** 2);
  const bmi = weightKg / (heightCm / 100) ** 2;
  const hairText = a.hair.toLowerCase();
  return {
    skin: ap.skin, shade: ap.skinShade, tone: a.skinTone,
    /* white hair is whiter than grey (the face canvas uses one grey for both) */
    hair: /white/.test(hairText) ? '#e3dfd6' : ap.hair, hairText,
    gown: '#9fc4d9', gownShade: '#7fa9c2', exposed: new Set(state.exposure ?? []), sex: patient.sex, age: patient.age, build,
    oxygen: state.oxygen && state.oxygen.fio2 > 0.21 ? state.oxygen.device : undefined,
    body: {
      heightCm, weightKg, bmi,
      /* Men store fat centrally; women peripherally until the menopause, then increasingly centrally. */
      fat: a.fat ?? (patient.sex === 'M' || patient.age >= 55 ? 'central' : 'peripheral'),
      muscle: a.muscle ?? (bmi < 18.5 ? 'wasted' : 'normal'),
      oedema: findings.oedema ?? 'none', ascites: findings.ascites ?? 'none', colour: findings.colour ?? 'normal',
      icterus: findings.icterus ?? 'none', pallor: findings.pallor ?? 'none', sweating: findings.sweating ?? false,
      distress: findings.distress ?? 'none',
      breathing: findings.breathing ?? { hyperinflated: false, accessory: false, pursedLips: false },
    },
  };
}

/* ---- colour ---- */

/** Skin colours with the illness mixed in. Tints are gentler on dark skin, where pallor and jaundice show mostly in the
    lips, nail beds and sclerae; cyanosis always shows first in the lips and nails. */
function palette(look: FigureLook): Palette & { gown: string; gownLight: string; gownDark: string; gownLine: string } {
  const b = look.body, dark = clamp((look.tone - 3) / 3, 0, 1);
  let skin = look.skin, shade = look.shade;
  let lip = tint(skin, '#b8545c', 0.42 - 0.12 * dark), nail = tint(skin, '#e6a3a0', 0.4);
  let sclera = '#f6f3ee';
  const pale = b.colour === 'pale' ? 0.3 : 0, pallor = { none: 0, mild: 0.14, marked: 0.3 }[b.pallor];
  const pv = Math.max(pale, pallor) * (1 - 0.5 * dark);
  if (pv) { skin = tint(skin, '#f1e9e4', pv); shade = tint(shade, '#c9bdb6', pv); lip = tint(lip, '#d9b0ae', pv * 1.6); nail = tint(nail, '#f0e2de', pv * 1.5); }
  if (b.colour === 'grey') { skin = tint(skin, '#a6aaab', 0.3 * (1 - 0.4 * dark)); shade = tint(shade, '#7f8486', 0.3); lip = tint(lip, '#9c8c92', 0.4); }
  if (b.colour === 'flushed') { skin = tint(skin, '#e2826e', 0.1); lip = tint(lip, '#c0444c', 0.25); }
  if (b.colour === 'cyanosed') { skin = tint(skin, '#8e9ab8', 0.16); shade = tint(shade, '#69739a', 0.2); lip = tint(lip, '#6d6a9c', 0.65); nail = tint(nail, '#7d82b4', 0.6); }
  const icter = b.colour === 'jaundiced' ? (b.icterus === 'marked' ? 0.3 : 0.22) : b.icterus === 'marked' ? 0.16 : b.icterus === 'mild' ? 0.07 : 0;
  if (icter) { skin = tint(skin, '#e3c13c', icter * (1 - 0.45 * dark)); shade = tint(shade, '#b0922a', icter * 0.8); }
  if (b.icterus !== 'none' || b.colour === 'jaundiced') sclera = b.icterus === 'marked' || b.colour === 'jaundiced' ? '#ecd96a' : '#f1e6aa';
  const hair = look.hair;
  const gown = look.gown;
  return {
    skin, light: lighten(skin, 0.16), dark: tint(skin, shade, 0.62), line: darken(shade, 0.14),
    far: tint(skin, shade, 0.5), farDark: darken(shade, 0.2),
    lip, lipLine: darken(lip, 0.3), nail, sclera, blush: '#e0605a',
    hair, hairDark: darken(hair, 0.28), hairLight: lighten(hair, 0.28),
    gown, gownLight: lighten(gown, 0.22), gownDark: look.gownShade, gownLine: darken(look.gownShade, 0.18),
  };
}

/* ---- drawing ---- */

type Part = { pts: Pt[]; fill: string };
/** One layer: all outlines, then all fills, so overlapping parts become one silhouette. Fills are grouped by region. */
function layer(groups: Array<{ attrs: string; parts: Part[] }>, line: string, width: number): string {
  const d = groups.map((g) => g.parts.map((p) => closedPath(p.pts)));
  return `<g pointer-events="none" fill="${line}" stroke="${line}" stroke-width="${f(width * 2)}" stroke-linejoin="round">${d.flat().map((x) => `<path d="${x}"/>`).join('')}</g>`
    + groups.map((g, i) => `<g ${g.attrs}>${g.parts.map((p, j) => `<path d="${d[i][j]}" fill="${p.fill}"/>`).join('')}</g>`).join('');
}

/** A gradient across a part, lit from the upper left: from the lit edge through the base colour to the shaded edge. */
function shadeAcross(defs: string[], id: string, c: Pt, axis: number, w: number, pal: { light: string; skin: string; dark: string }): string {
  const n1 = dir(axis + 90), lit = n1.x * -0.55 + n1.y * -0.83 >= 0 ? n1 : { x: -n1.x, y: -n1.y };
  defs.push(`<linearGradient id="fig-§-${id}" gradientUnits="userSpaceOnUse" x1="${f(c.x + lit.x * w)}" y1="${f(c.y + lit.y * w)}" x2="${f(c.x - lit.x * w)}" y2="${f(c.y - lit.y * w)}">`
    + `<stop offset="0" stop-color="${pal.light}"/><stop offset=".42" stop-color="${pal.skin}"/><stop offset="1" stop-color="${pal.dark}"/></linearGradient>`);
  return `url(#fig-§-${id})`;
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const maxY = (pts: Pt[]) => pts.reduce((m, p) => Math.max(m, p.y), -Infinity);

/** Where the figure goes: lowered onto the mattress (lying, sitting) or the floor (standing), never through either. */
/** A pillow's thickness under the head, reference cm. */
const PILLOW = 7;

/** The trolley's backrest: the head section of the mattress, hinged at a fixed point on the frame. Only its angle
    changes, so raising or lowering it never moves the hinge. */
const BACKREST_LEN = 128;
function backrestOf(p: Pose): { pivot: Pt; angle: number; len: number } | null {
  if (p.backrest <= 1 || p.bed === 'none') return null;
  return { pivot: { x: p.bedLeft + BACKREST_LEN, y: BED_TOP }, angle: 180 - p.backrest, len: BACKREST_LEN };
}

function place(p0: Pose, sh: Shape): Skeleton {
  /* Lying, the trunk rests on two places, the buttocks and the shoulder blades (prone: pelvis and chest). A big
     buttock or a big belly would otherwise prop the trunk up at one end; the trunk is tilted until both touch. */
  const lieW = (1 - smooth(0.15, 0.45, Math.abs(Math.sin(rad(p0.torso))))) * (1 - smooth(0, 15, p0.backrest)) * (1 - clamp(p0.ground, 0, 1));
  let p = p0;
  if (lieW > 0) {
    const k = skeleton(p, sh, { x: p.hipX, y: 0 });
    const side = (s: number) => { const t = stationAt(sh.trunk, s); return trunkPt(k, s, k.flip > 0 ? -t.p : t.a); };
    const low = (ss: number[]) => ss.map(side).reduce((m, q) => (q.y > m.y ? q : m));
    const b = low([-6, -3, 0, 3, 6, 10]), c = low([30, 34, 38, 42, 46]);
    /* at most a few degrees: beyond that the pelvis rolls under rather than the shoulders dropping */
    const d = clamp(Math.atan2(b.y - c.y, Math.abs(c.x - b.x) || 1) * (180 / Math.PI), -6, 6) * (c.x < b.x ? 1 : -1) * lieW;
    p = { ...p, pelvis: p.pelvis + d, torso: p.torso + d };
  }
  const k0 = skeleton(p, sh, { x: p.hipX, y: 0 });
  const legs = (i: 0 | 1) => [limbOutline(k0.hip, k0.thighA[i], sh.thigh, sh.u), limbOutline(k0.knee[i], k0.shinA[i], sh.shin, sh.u), footOutline(k0, sh, i)];
  /* what rests on the mattress: the trunk, the thighs, and shins and heels only while they lie roughly flat */
  const flat = (a: number) => Math.abs(Math.sin((a * Math.PI) / 180)) < 0.5;
  const onBed = [trunkOutline(k0, sh), ...[0, 1].flatMap((i) => { const [t, s, ft] = legs(i as 0 | 1); return [t, ...(flat(k0.shinA[i]) ? [s, ft] : [])]; })];
  const bedDy = BED_TOP - Math.max(...onBed.map(maxY));
  const feet = Math.max(maxY(footOutline(k0, sh, 0)), maxY(footOutline(k0, sh, 1)));
  const floorDy = FLOOR - 1 - feet;
  const dy = Math.min(lerp(bedDy, floorDy, clamp(p.ground, 0, 1)), floorDy);
  let k = skeleton(p, sh, { x: p.hipX, y: dy });
  /* Leaning back, the patient slides along the mattress until the back rests on the backrest; the backrest itself
     never moves off its hinge. Sitting up straighter than it, the patient leaves it; the back never passes through. */
  const rest = backrestOf(p);
  if (rest) {
    const n = dir(rest.angle - 90);                               // from the backrest toward the patient
    const gap = Math.min(...trunkOutline(k, sh, 14, 99).map((q) => (q.x - rest.pivot.x) * n.x + (q.y - rest.pivot.y) * n.y));
    /* resting on it while the trunk is no steeper than the backrest (raising it lifts the patient with it) */
    const pull = gap < 0 ? 1 : (1 - smooth(4, 14, (180 - p.torso) - p.backrest)) * smooth(20, 40, p.backrest);
    /* a nearly flat backrest is moved against by sliding a long way, so the slide is capped */
    const dx = clamp((-gap * pull) / n.x, -12 * sh.u, 12 * sh.u);
    if (Math.abs(dx) > 0.05) { p = { ...p, hipX: p.hipX + dx }; k = skeleton(p, sh, { x: p.hipX, y: dy }); }
  }
  /* and the head lies on the pillow rather than hovering over it: the neck bends down until the occiput reaches it */
  if (lieW > 0) {
    const occ = headFrame(k)(8, -10.4), top = BED_TOP - PILLOW * sh.u;
    if (Math.abs(occ.y - top) > 0.5 && occ.x > p.bedLeft + 8) {   // not when the head hangs over the end of the bed
      const r = Math.hypot(occ.x - k.neckRoot.x, occ.y - k.neckRoot.y) || 1;
      const d = clamp(Math.asin(clamp((top - occ.y) / r, -1, 1)) * (180 / Math.PI), -25, 25) * lieW * (occ.x < k.neckRoot.x ? 1 : -1) * k.flip;
      k = skeleton({ ...p, neck: p.neck + d }, sh, { x: p.hipX, y: dy });
    }
  }
  return k;
}

export function figureSvg(p: Pose, look: FigureLook): string {
  const upright = Math.max(0, Math.sin((p.torso * Math.PI) / 180));
  const sh = bodyShape(look, upright);
  const k = place(p, sh);
  const u = k.u, pal = palette(look), b = look.body;
  const defs: string[] = [dressDefs(pal)];
  const out: string[] = [];
  const lineW = 0.62;

  /* ---- outlines of every part ---- */
  const abdomen = trunkOutline(k, sh, -99, 29);
  const chest = trunkOutline(k, sh, 27, 99);
  const neckPts = limbOutline(k.neckRoot, k.neckA, sh.neck, u, -k.flip);
  const head = headOutline({ k, sh, look, pal, support: { p: { x: 0, y: FLOOR }, n: { x: 0, y: -1 } } });
  const leg = (i: 0 | 1) => ({
    thigh: limbOutline(k.hip, k.thighA[i], sh.thigh, u, k.flip), shin: limbOutline(k.knee[i], k.shinA[i], sh.shin, u, k.flip), foot: footOutline(k, sh, i),
  });
  /* fingers curl a little at rest; in distress the hands grip */
  const curl = b.distress === 'severe' ? 70 : b.distress === 'moderate' ? 34 : 16;
  const knuckle = (i: 0 | 1) => add(k.wrist[i], k.handA[i], 9.6 * u);
  const arm = (i: 0 | 1) => ({
    upper: limbOutline(k.shoulder, k.upperA[i], sh.upper, u, k.flip), fore: limbOutline(k.elbow[i], k.foreA[i], sh.fore, u, k.flip),
    hand: limbOutline(k.wrist[i], k.handA[i], sh.hand, u, k.flip),
    fingers: limbOutline(knuckle(i), k.handA[i] + curl * k.flip, sh.fingers, u, k.flip),
    thumb: limbOutline(add(add(k.wrist[i], k.handA[i], 1.5 * u), k.handA[i] + 90 * k.flip, 1.2 * u), k.handA[i] + (28 + curl * 0.3) * k.flip, [{ s: 0, a: 1.0, p: 1.0 }, { s: 4.5, a: 0.85, p: 0.8 }, { s: 6.6, a: 0.5, p: 0.5 }], u, k.flip),
  });

  /* ---- trolley, backrest and pillow ---- */
  const H = headFrame(k);
  let backrest: { pivot: Pt; angle: number; len: number } | null = null;
  /* what the hair rests on: the floor when upright, else the mattress, backrest or pillow under the head */
  let support: Support = { p: { x: 0, y: FLOOR }, n: { x: 0, y: -1 } };
  backrest = backrestOf(p);
  /* Pillow: it lies on the mattress (or the backrest) under the back of the head and is as thick as the gap it fills,
     within what a pillow can be. When the head leaves it (sitting up) it stays where it was, at the head of the bed. */
  let pillow: Pt[] | null = null;
  const hangs = H(8, -10.4).x < p.bedLeft + 8;
  if (!hangs) {
    const occ = H(8, -10.4);
    const down = backrest ? dir(backrest.angle + 90) : { x: 0, y: 1 };
    const along = backrest ? dir(backrest.angle) : { x: -1, y: 0 };
    const surf = (q: Pt) => {
      if (!backrest) return { x: clamp(q.x, p.bedLeft + 30, p.bedLeft + 66), y: BED_TOP };
      const d = dir(backrest.angle), r = { x: q.x - backrest.pivot.x, y: q.y - backrest.pivot.y }, t = r.x * d.x + r.y * d.y;
      return { x: backrest.pivot.x + d.x * t, y: backrest.pivot.y + d.y * t };
    };
    const base = surf(occ);
    const gap = (base.x - occ.x) * down.x + (base.y - occ.y) * down.y;
    const h = clamp(gap + 0.6, 3.5 * u, 9 * u), half = 15 * u;
    const at = (t: number, lift: number) => ({ x: base.x + along.x * t * half - down.x * lift, y: base.y + along.y * t * half - down.y * lift });
    pillow = [at(-1.05, 0), at(-0.9, h * 0.75), at(-0.2, h * 1.02), at(0.6, h * 0.95), at(1.0, h * 0.6), at(1.05, 0)];
    const lying = p.ground < 0.5 && upright < 0.95;
    support = lying ? { p: at(0, Math.min(h, Math.max(gap, 0))), n: { x: -down.x, y: -down.y } } : { p: { x: 0, y: p.ground < 0.5 ? BED_TOP : FLOOR }, n: { x: 0, y: -1 } };
  }
  out.push(`<line x1="8" y1="${FLOOR}" x2="352" y2="${FLOOR}" stroke="#c4cdca" stroke-width="2" stroke-linecap="round" pointer-events="none"/>`);
  out.push(trolley(p.bedLeft, backrest, pillow, clamp(p.ground, 0, 1)));

  const ctx = { k, sh, look, pal, support };
  out.push(hairBehind(ctx));

  /* ---- far limbs, in shade ---- */
  const farLeg = leg(1), farArm = arm(1);
  const farPal = { light: pal.far, skin: pal.far, dark: darken(pal.far, 0.12) };
  const gFar = shadeAcross(defs, 'far', mid(k.hip, k.knee[1]), k.thighA[1], 9 * u, farPal);
  out.push(layer([
    { attrs: 'data-region="arm" data-side="L"', parts: [farArm.upper, farArm.fore, farArm.hand, farArm.fingers, farArm.thumb].map((pts) => ({ pts, fill: gFar })) },
    { attrs: 'data-region="legs" data-side="L"', parts: [farLeg.thigh, farLeg.shin, farLeg.foot].map((pts) => ({ pts, fill: gFar })) },
  ], pal.farDark, lineW));
  const dress = gown(k, sh, look, { ...pal, far: tint(pal.gown, pal.gownDark, 0.7) });
  out.push(dress.far);

  /* ---- the body: trunk, near leg, neck and head as one silhouette ---- */
  const nearLeg = leg(0);
  const g = (id: string, c: Pt, axis: number, w: number) => shadeAcross(defs, id, c, axis, w * u, pal);
  const gAbd = g('abd', trunkPt(k, 10, 0), trunkA(k, 10), 12 + sh.belly * 0.5);
  const gChest = g('chest', trunkPt(k, 40, 0), trunkA(k, 40), 12);
  const gNeck = g('neck', mid(k.neckRoot, k.headJoint), k.neckA, 6);
  const gHead = g('head', H(8, 0), k.headA - 90, 11);
  const gThigh = g('thigh', mid(k.hip, k.knee[0]), k.thighA[0], 8.5);
  const gShin = g('shin', mid(k.knee[0], k.ankle[0]), k.shinA[0], 6);
  const gFoot = g('foot', k.ankle[0], k.footA[0] + 90, 6);
  out.push(layer([
    { attrs: 'data-region="abdomen"', parts: [{ pts: abdomen, fill: gAbd }] },
    { attrs: 'data-region="chest"', parts: [{ pts: chest, fill: gChest }] },
    { attrs: 'data-region="legs" data-side="R"', parts: [{ pts: nearLeg.thigh, fill: gThigh }, { pts: nearLeg.shin, fill: gShin }, { pts: nearLeg.foot, fill: gFoot }] },
    { attrs: 'data-region="neck"', parts: [{ pts: neckPts, fill: gNeck }] },
    { attrs: 'data-region="head"', parts: [{ pts: head, fill: gHead }] },
  ], pal.line, lineW));

  /* ---- what shows on the body: bare skin details, then the gown over the rest ---- */
  out.push(bodyDetails(k, sh, look, pal));
  out.push(dress.body, dress.lines);
  if (look.exposed.has('chest') && look.sex === 'F') out.push(bra(k, sh));
  /* the lock of long hair falls over the gown; the hair on the skull covers its root */
  out.push(hairFront(ctx), face(ctx), hairOver(ctx), ear(ctx));

  /* ---- near arm, over the trunk ---- */
  const nearArm = arm(0);
  const gUpper = g('upper', mid(k.shoulder, k.elbow[0]), k.upperA[0], 5);
  const gFore = g('fore', mid(k.elbow[0], k.wrist[0]), k.foreA[0], 3.6);
  const gHand = g('hand', k.wrist[0], k.handA[0], 3);
  out.push(layer([{ attrs: 'data-region="arm" data-side="R"', parts: [{ pts: nearArm.upper, fill: gUpper }, { pts: nearArm.fore, fill: gFore }, { pts: nearArm.hand, fill: gHand }, { pts: nearArm.fingers, fill: gHand }, { pts: nearArm.thumb, fill: gHand }] }], pal.line, lineW));
  out.push(armDetails(k, look, pal, curl));
  out.push(dress.sleeveNear);
  out.push(oxygenSvg(ctx, { x: k.hip.x + 10 * u * Math.cos(rad(p.torso)), y: BED_TOP - 2 }));

  const body = `<defs>${defs.join('')}</defs>${out.join('')}`;
  return body.replace(/§/g, hash(body));
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Gradient ids must be unique per drawing on a page of many figures, and the same for the same drawing. */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 3) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/* ---- details on bare skin and on the near leg ---- */

function bodyDetails(k: Skeleton, sh: Shape, look: FigureLook, pal: Palette): string {
  const out: string[] = [], u = k.u, b = look.body;
  const st = (s: number) => stationAt(sh.trunk, s);
  const line = (pts: Pt[], o = 0.6, w = 0.6, col = pal.line) => out.push(`<path d="${openPath(pts)}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="round" opacity="${o}"/>`);
  const T = (s: number, x: number) => trunkPt(k, s, x);
  const chestBare = look.exposed.has('chest'), abdoBare = look.exposed.has('abdomen');
  if (chestBare) {
    /* clavicle, and in the thin the ribs; the male nipple */
    if (sh.bony > 0.2 || sh.wasted) line([T(51.5, st(51.5).a - 0.4), T(52.5, st(52).a * 0.4), T(51, 0)], 0.5 + 0.3 * sh.bony, 0.8);
    if (sh.bony > 0.25 || sh.barrel) for (let i = 0; i < 4; i++) {
      const s = 46 - i * 4.5;
      line([T(s + 0.6, st(s).a - 0.8), T(s - 1.2, st(s).a * 0.45), T(s - 2.4, st(s).a * 0.05)], 0.18 + 0.3 * sh.bony, 0.55);
    }
    if (look.sex === 'M') {
      const n = T(37, st(37).a - 0.35);
      out.push(`<ellipse cx="${f(n.x)}" cy="${f(n.y)}" rx="${f(0.75 * u)}" ry="${f(0.75 * u)}" fill="${tint(pal.lip, pal.dark, 0.4)}" opacity=".85"/>`);
    }
    if (b.sweating) for (const [s, x] of [[40, 0.75], [34, 0.5], [44, 0.3]]) { const q = T(s, st(s).a * x); out.push(`<ellipse cx="${f(q.x)}" cy="${f(q.y)}" rx="${f(0.35 * u)}" ry="${f(0.5 * u)}" fill="#fff" opacity=".7"/>`); }
  }
  /* Neck: the sternomastoid stands out when the accessory muscles work, and in the wasted. */
  if (b.breathing.accessory || sh.bony > 0.4) {
    const H = headFrame(k);
    const notch = T(53.5, st(53.5).a * 0.6);
    const mast = H(1.5, -4.2);
    line([mast, { x: (mast.x + notch.x) / 2 + (k.headJoint.x - k.neckRoot.x) * 0.05, y: (mast.y + notch.y) / 2 }, notch], 0.8, 1.0);
    line([H(0.4, -2.6), T(54.5, st(54).a * 0.2)], 0.45, 0.7);
    const fossa = T(53, -1.2);
    out.push(`<ellipse cx="${f(fossa.x)}" cy="${f(fossa.y)}" rx="${f(1.6 * u)}" ry="${f(1.0 * u)}" fill="${pal.dark}" opacity=".35"/>`);
  }
  if (abdoBare) {
    /* navel; everted when ascites is tense */
    const ns = sh.navelS, na = st(ns).a;
    if (sh.ascites >= 3) {
      const q = T(ns, na + 0.4);
      out.push(`<circle cx="${f(q.x)}" cy="${f(q.y)}" r="${f(1.0 * u)}" fill="${pal.skin}" stroke="${pal.line}" stroke-width=".7"/>`);
    } else line([T(ns + 0.7, na - 0.2), T(ns, na - 0.9), T(ns - 0.7, na - 0.2)], 0.8, 0.8, pal.dark);
    /* a tense belly is shiny; a lax one folds at the flanks */
    if (sh.ascites >= 2) line([T(24, st(24).a * 0.7), T(15, st(15).a - 1.2), T(7, st(7).a * 0.75)], 0.45, 1.6, '#ffffff');
    /* lying, ascites spreads to the flanks: a bulging flank line low on the side */
    if (sh.ascites >= 1 && Math.abs(Math.sin(rad(trunkA(k, 15)))) < 0.6) line([T(25, -st(25).p * 0.4), T(15, -st(15).p * 0.75 - 1.2 * sh.ascites), T(6, -st(6).p * 0.5)], 0.5, 0.8);
    if (sh.bony > 0.3) line([T(8, st(8).a - 1.4), T(6, st(6).a * 0.3), T(7, -2)], 0.4 + 0.3 * sh.bony, 0.8);      // iliac crest
    if (sh.soft > 0.2 && !sh.ascites) line([T(4, st(4).a * 0.9), T(5.5, st(5).a * 0.4), T(6, -st(6).p * 0.2)], 0.5, 0.7);   // the apron fold
    if (b.sweating) { const q = T(18, st(18).a * 0.6); out.push(`<ellipse cx="${f(q.x)}" cy="${f(q.y)}" rx="${f(0.35 * u)}" ry="${f(0.5 * u)}" fill="#fff" opacity=".65"/>`); }
  }
  /* Near leg: kneecap, ankle bone and the toe line; oedema hides the bones and makes the skin shine. */
  const L = (from: Pt, a: number, s: number, x: number) => add(add(from, a, s * u), a + 90 * k.flip, x * u);
  const kneeSt = stationAt(sh.thigh, 43), tA = k.thighA[0], sA = k.shinA[0];
  const bent = Math.abs(((tA - sA + 540) % 360) - 180);
  line([L(k.hip, tA, 39.5, kneeSt.a - 0.8), L(k.knee[0], (tA + sA) / 2, 0, kneeSt.a - 0.3 + (180 - bent) * 0.01), L(k.knee[0], sA, 4, stationAt(sh.shin, 4).a - 0.9)], 0.45, 0.7);
  if (!sh.oedema) {
    const m = L(k.ankle[0], sA, -1.6, -0.6);
    out.push(`<ellipse cx="${f(m.x)}" cy="${f(m.y)}" rx="${f(1.0 * u)}" ry="${f(1.2 * u)}" fill="${pal.dark}" opacity=".22"/>`);
  } else {
    /* the shine of tight, swollen skin down the shin */
    const top = [99, 32, 18, 2][sh.oedema];
    line([L(k.knee[0], sA, top, stationAt(sh.shin, top).a - 1.2), L(k.knee[0], sA, (top + 43) / 2, stationAt(sh.shin, (top + 43) / 2).a - 1.0), L(k.knee[0], sA, 41, 1.6)], 0.32, 1.0, '#ffffff');
  }
  const fA = k.footA[0], toe = (x: number, y: number) => add(add(k.ankle[0], fA, x * u), fA + 90 * k.flip, y * u);
  line([toe(15.5, -3.0), toe(16.3, -4.8), toe(17.5, -6.0)], 0.5, 0.6);
  const nailP = toe(19.6, -3.9);
  out.push(`<ellipse cx="${f(nailP.x)}" cy="${f(nailP.y)}" rx="${f(0.9 * u)}" ry="${f(0.55 * u)}" fill="${pal.nail}" opacity=".9" transform="rotate(${f(-fA)} ${f(nailP.x)} ${f(nailP.y)})"/>`);
  /* buttock and groin creases where the thigh meets the trunk */
  if (Math.abs(((tA - k.spine[14].a + 540) % 360) - 180) < 140) line([L(k.hip, tA, 2, stationAt(sh.thigh, 2).a + 0.3), L(k.hip, tA, -1, 2)], 0.45, 0.7);
  /* wasted shoulders: the acromion makes a corner over a thin deltoid */
  if (sh.wasted || sh.bony > 0.4) { const a = trunkPt(k, 50.5, -0.5); out.push(`<circle cx="${f(a.x)}" cy="${f(a.y)}" r="${f(1.1 * u)}" fill="none" stroke="${pal.line}" stroke-width=".7" opacity=".55"/>`); }
  return `<g pointer-events="none">${out.join('')}</g>`;
}

function armDetails(k: Skeleton, look: FigureLook, pal: Palette, curl: number): string {
  const u = k.u, out: string[] = [];
  const hA = k.handA[0], fA = hA + curl * k.flip, kn = add(k.wrist[0], hA, 9.6 * u);
  const F = (s: number, x: number) => add(add(kn, fA, s * u), fA + 90 * k.flip, x * u);
  /* finger lines; the nail bed at the tip shows cyanosis and pallor first */
  out.push(`<path d="${openPath([F(0.5, -0.2), F(7.6, -0.1)])}" fill="none" stroke="${pal.line}" stroke-width=".45" opacity=".5"/>`);
  const nail = F(7.4, -0.75);
  out.push(`<ellipse cx="${f(nail.x)}" cy="${f(nail.y)}" rx="${f(1.0 * u)}" ry="${f(0.42 * u)}" fill="${pal.nail}" transform="rotate(${f(-fA)} ${f(nail.x)} ${f(nail.y)})"/>`);
  /* elbow crease */
  const e = add(add(k.elbow[0], k.upperA[0], -1 * u), k.upperA[0] + 90 * k.flip, 2 * u);
  out.push(`<circle cx="${f(e.x)}" cy="${f(e.y)}" r="${f(0.5 * u)}" fill="${pal.dark}" opacity=".3"/>`);
  if (look.body.sweating) { const q = add(add(k.shoulder, k.upperA[0], 18 * u), k.upperA[0] + 90 * k.flip, 1.5 * u); out.push(`<ellipse cx="${f(q.x)}" cy="${f(q.y)}" rx="${f(0.3 * u)}" ry="${f(0.45 * u)}" fill="#fff" opacity=".6"/>`); }
  return `<g pointer-events="none">${out.join('')}</g>`;
}
