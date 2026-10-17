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

   Views. Every part also has a width across the body, so the figure is a
   light 3D model (figure-view.ts): it can be seen from the right side of the
   bed, from the foot of the bed (lying: from above; sitting or standing:
   face to face) and from the left, and the app walks round the bed between
   them. Drawings that only make sense in profile (the face in profile, the
   hair, folds) fade out as the patient turns and their front counterparts
   (figure-front.ts) fade in. The chest views (thorax.ts) draw this same
   body, standing, from the front and the back.

   Changing position interpolates the pose, so the patient sits up, lies
   down or stands rather than jumping. Every body part carries a data-region
   for touch, and none is highlighted: the examiner chooses where to look.
--------------------------------------------------------------------------- */

import { appearanceOf } from './face-canvas.ts';
import { add, clamp, closedPath, darken, dir, f, lerp, lighten, openPath, smooth, tint, type Pt } from './figure-geom.ts';
import { LEN, bodyShape, footOutline, limb3, limbOutline, skeleton, stationAt, trunk3, trunkOutline, trunkPt, trunkA, type Shape, type Skeleton } from './figure-body.ts';
import { ear, face, hairBehind, hairFront, hairOver, headFrame, headOutline, oxygenSvg, type Palette, type Support } from './figure-head.ts';
import { BED_TOP, FLOOR, bra, cloth, dressDefs, gown, sleeveSvg, trolley } from './figure-dress.ts';
import { Projector, frontness, onTube, VIEW_RIGHT, type FigureView } from './figure-view.ts';
import { braFront, chestFront, earsFront, faceFront, gownLinesFront, hairBehindFront, hairFront3, headEgg, oxygenFront, trunkFront, type FrontCtx } from './figure-front.ts';

export { VIEW_RIGHT, VIEW_LEFT, VIEW_FRONT, VIEW_BACK, type FigureView } from './figure-view.ts';

/** Options for drawing the figure outside the bedside panel (the chest views draw it without the trolley). */
export interface FigureOptions {
  scene?: boolean;                 // floor, trolley and pillow (default true)
  head?: boolean;                  // the head (default true)
  chestFrame?: boolean;            // place the drawing in chest centimetres: 4th intercostal space at (0, 0)
  /** Receives the outline of every touch region and a few landmarks, in the drawing's final coordinates. */
  collect?: (kind: string, side: 'R' | 'L' | '', pts: Pt[]) => void;
}

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

/** A gradient across a part, lit from the upper left: from the lit edge through the base colour to the shaded edge.
    lx: the light's horizontal direction before a left-side drawing is mirrored (so it still comes from the left). */
function shadeAcross(defs: string[], id: string, c: Pt, axis: number, w: number, pal: { light: string; skin: string; dark: string }, lx = -0.55): string {
  const n1 = dir(axis + 90), lit = n1.x * lx + n1.y * -0.83 >= 0 ? n1 : { x: -n1.x, y: -n1.y };
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

/** The patient in this pose, seen from the right side of the bed (the default), the left, the front, or the back. */
export function figureSvg(p: Pose, look: FigureLook, view: FigureView = VIEW_RIGHT, opts: FigureOptions = {}): string {
  const upright = Math.max(0, Math.sin((p.torso * Math.PI) / 180));
  const sh = bodyShape(look, upright);
  const k = place(p, sh);
  const u = k.u, pal = palette(look), b = look.body;
  const scene = opts.scene !== false, withHead = opts.head !== false;
  const defs: string[] = [dressDefs(pal)];
  const out: string[] = [];
  const lineW = 0.62;

  /* ---- the view: turned about the trunk's long axis; prone, "front" means from above, which is the back ---- */
  const tA = trunkA(k, 40);
  const pr = new Projector(trunkPt(k, 20, 0), dir(tA), dir(tA - 90 * k.flip), { turn: view.turn * k.flip, side: view.side }, u);
  /* From the front the examiner is at the foot of the bed: the drawing turns until the trunk is upright, and a lying
     patient's bed is brought to the middle of the panel. */
  const stand = pr.sn * pr.sn;
  const tilt = ((((90 - tA) % 360) + 540) % 360) - 180;      // screen rotation that would make the trunk point up
  const rotDeg = tilt * stand;
  const lying = 1 - Math.abs(Math.sin(rad(tA)));
  const bedMid = { x: 180, y: BED_TOP - 10 };
  pr.settle(rotDeg, pr.O, { x: 0, y: 0 });
  if (scene) {
    /* From the foot of the bed the patient is in the middle of the panel (lying: the bed is), so the front seen on the
       way round from the right is the same picture as the front seen on the way round from the left. */
    const m = pr.P(bedMid), o = pr.P(pr.O);
    const cx = lerp(o.x, m.x, lying);
    pr.settle(rotDeg, pr.O, { x: (180 - cx) * stand, y: (196 - m.y) * lying * stand });
  }
  const fp = frontness(pr);                                  // 0 profile … 1 front or back
  const lx = view.side < 0 ? 0.55 : -0.55;
  const M = pr.matrix();
  /* drawings made for the profile turn with the body and fade out; those for the front fade in */
  /* (drawn only when they show: each is passed as a function) */
  const prof = (draw: () => string) => { if (fp >= 1) return ''; const svg = draw(); return !svg ? '' : pr.profile ? svg : `<g transform="${M}" opacity="${f(1 - fp)}">${svg}</g>`; };
  const front = (draw: () => string) => { if (fp <= 0) return ''; const svg = draw(); return !svg ? '' : fp >= 1 ? svg : `<g opacity="${f(fp)}">${svg}</g>`; };
  const backView = pr.sn < 0;

  /* ---- how far each limb lies from the midline: legs under the hips; arms beside the trunk, or over the thighs when
     the hands rest in front of the body ---- */
  const sg = (i: 0 | 1) => (i === 0 ? -1 : 1);
  const legZ = (i: 0 | 1) => ({ hip: sg(i) * sh.hipZ, knee: sg(i) * (sh.hipZ - 1.0), ankle: sg(i) * (sh.hipZ - 1.3) });
  const nearSpine = (q: Pt) => { let bi = 0, bd = Infinity; k.spine.forEach((sp, i) => { const d = (sp.p.x - q.x) ** 2 + (sp.p.y - q.y) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
  const sideZ = (q: Pt, minZ: number, extra: number, frontZ: number) => {
    const i = nearSpine(q), sp = k.spine[i], t = stationAt(sh.trunk, i - 14), nA = dir(sp.a - 90 * k.flip);
    const da = ((q.x - sp.p.x) * nA.x + (q.y - sp.p.y) * nA.y) / u;
    const before = smooth(t.a - 1, t.a + 7, da);
    return lerp(Math.max(minZ, (t.w ?? 14) + extra), frontZ, before);
  };
  const armZ = (i: 0 | 1) => {
    const sh0 = sh.shoulderZ;
    const el = sideZ(k.elbow[i], sh0 + 0.6, (stationAt(sh.upper, 32.7).w ?? 3.3) + 0.5, sh0 * 0.85);
    const wr = sideZ(k.wrist[i], el + 0.6, (stationAt(sh.fore, 25.7).w ?? 2.6) + 0.4, sh.hipZ + 1.5);
    return { sh: sg(i) * sh0, el: sg(i) * el, wr: sg(i) * wr };
  };

  /* ---- outlines of every part, as seen ---- */
  const abdomen = trunk3(pr, k, sh, -99, 29);
  const chest = trunk3(pr, k, sh, 27, 99);
  const neckPts = limb3(pr, k.neckRoot, k.neckA, sh.neck, -k.flip, 0, 0);
  const H = headFrame(k);
  const fctx: FrontCtx = { pr, k, sh, look, pal, back: backView, floorY: FLOOR };
  const headProfile = headOutline({ k, sh, look, pal, support: { p: { x: 0, y: FLOOR }, n: { x: 0, y: -1 } } }).map((q) => pr.P(q));
  const head: Pt[][] = pr.profile ? [headProfile] : [headProfile, headEgg(fctx), ...earsFront(fctx)];
  const leg = (i: 0 | 1) => {
    const z = legZ(i);
    return {
      thigh: limb3(pr, k.hip, k.thighA[i], sh.thigh, k.flip, z.hip, z.knee), shin: limb3(pr, k.knee[i], k.shinA[i], sh.shin, k.flip, z.knee, z.ankle),
      foot: pr.profile ? [footOutline(k, sh, i)] : limb3(pr, k.ankle[i], k.footA[i], sh.footSt, k.flip, z.ankle, z.ankle),
    };
  };
  /* The deltoid (the top of the upper arm) is the shoulder from every side: its dome meets the trapezius at the acromion. */
  const upperSt = sh.upper;
  /* The shoulder from the front (and back) is not the profile's cap over the arm. The clavicle carries the shoulder line
     out to the acromion; from there the deltoid makes one convex arc down and out, broadest just below the acromion,
     into the outer edge of the arm, which narrows below its insertion. On the inner side there is no dome: the deltoid's
     front border runs down from the outer clavicle (the deltopectoral groove) and the arm parts from the trunk at the
     armpit. So in these views the shoulder is drawn as that shape, joined to the trunk without a line, and the arm
     proper starts under it; the gown's sleeve is cut from the same shape. From the side the arm is drawn whole. */
  const joinShoulder = Math.abs(pr.c) <= 0.64;
  const ARM0 = 0.5;
  const armSt = [stationAt(sh.upper, ARM0), ...sh.upper.filter((t) => t.s > ARM0)];
  const acroZ = sh.shoulderZ + 2.0;
  /** The shoulder shape for arm i: grown by `grow` (cloth), pulled in by `inset` (a fill that must stay inside the
      outline), down the arm to sEnd; `med` how far its inner edge lies beyond the arm's above the armpit. */
  const shoulderShape = (i: 0 | 1, grow: number, inset: number, sEnd: number, med: number): Pt[] => {
    const z = armZ(i), sg2 = i === 0 ? -1 : 1, fr = { from: k.shoulder, a: k.upperA[i], flip: k.flip };
    const st = (x: number) => w3s(stationAt(sh.upper, x), 0);
    const zs = (x: number) => z.sh + ((z.el - z.sh) * x) / LEN.upper;
    const L = (x: number, dr: number) => onTube(pr, fr, st, x, sg2 * 90, zs(x), dr).p;
    const M = (x: number, dr: number) => onTube(pr, fr, st, x, -sg2 * 90, zs(x), dr).p;
    const T = (sv: number, zz: number) => { const t = stationAt(sh.trunk, sv); return pr.P(trunkPt(k, sv, (t.a - t.p) / 2), zz); };
    const d = grow - inset, sTop = 51.0 + grow * 0.7 - inset;
    /* the deltoid stands out beyond the arm below it, most just under the acromion, and narrows to its insertion */
    const bulge = (x: number) => { const t = Math.max(0, 1 - Math.abs(x - 3) / 8.5); return 1.0 * t * t * (3 - 2 * t); };
    const A = T(sTop, sg2 * (acroZ - 1.2));
    const E = L(1, d + bulge(1));
    const K = T(sTop - 0.2, sg2 * (Math.abs(z.sh) + (st(1).w ?? 6) + d + bulge(1)));
    const arc = [0.25, 0.5, 0.75].map((t) => ({ x: (1 - t) ** 2 * A.x + 2 * t * (1 - t) * K.x + t * t * E.x, y: (1 - t) ** 2 * A.y + 2 * t * (1 - t) * K.y + t * t * E.y }));
    /* below the bulge a skin shape keeps inside the arm's own outline (which then takes over); cloth flares to its hem */
    const lat = [2, 3.5, 5, 7, 9, 11, sEnd].filter((x) => x <= sEnd).map((x) => L(x, d + bulge(x) + (grow ? 0.35 * (x / sEnd) : -0.95 * (1 - bulge(x)))));
    const inner = [M(sEnd, grow ? d + 0.35 : d), M((sEnd + 8) / 2, d + (med - d) * 0.5), M(8, med)];
    const C = T(sTop - 0.3, sg2 * (sh.shoulderZ - 7.5));
    return [A, ...arc, E, ...lat, ...inner, C];
  };
  /* fingers curl a little at rest; in distress the hands grip */
  const curl = b.distress === 'severe' ? 70 : b.distress === 'moderate' ? 34 : 16;
  const knuckle = (i: 0 | 1) => add(k.wrist[i], k.handA[i], 9.6 * u);
  const arm = (i: 0 | 1) => {
    const z = armZ(i);
    return {
      upper: joinShoulder ? limb3(pr, k.shoulder, k.upperA[i], armSt, k.flip, z.sh + ((z.el - z.sh) * ARM0) / LEN.upper, z.el).map((pts) => pts) : limb3(pr, k.shoulder, k.upperA[i], upperSt, k.flip, z.sh, z.el), fore: limb3(pr, k.elbow[i], k.foreA[i], sh.fore, k.flip, z.el, z.wr),
      hand: limb3(pr, k.wrist[i], k.handA[i], sh.hand, k.flip, z.wr, z.wr),
      fingers: limb3(pr, knuckle(i), k.handA[i] + curl * k.flip, sh.fingers, k.flip, z.wr, z.wr),
      thumb: limb3(pr, add(add(k.wrist[i], k.handA[i], 1.5 * u), k.handA[i] + 90 * k.flip, 1.2 * u), k.handA[i] + (28 + curl * 0.3) * k.flip,
        [{ s: 0, a: 1.0, p: 1.0, w: 0.9 }, { s: 4.5, a: 0.85, p: 0.8, w: 0.8 }, { s: 6.6, a: 0.5, p: 0.5, w: 0.5 }], k.flip, z.wr - sg(i) * 1.2, z.wr - sg(i) * 1.6),
    };
  };

  /* ---- trolley, backrest and pillow ---- */
  let backrest: { pivot: Pt; angle: number; len: number } | null = null;
  /* what the hair rests on: the floor when upright, else the mattress, backrest or pillow under the head */
  let support: Support = { p: { x: 0, y: FLOOR }, n: { x: 0, y: -1 } };
  backrest = backrestOf(p);
  /* Pillow: it belongs to the head section of the trolley (flat, or raised as the backrest) and is placed along it,
     measured from the hinge. While the head rests on it, it sits under the back of the head and is as thick as the gap
     it fills, within what a pillow can be; as the head leaves it (sitting up, standing) it settles at its place at the
     head of the bed and keeps it. It is never placed anywhere the head section is not. */
  const sec = backrest ?? { pivot: { x: p.bedLeft + BACKREST_LEN, y: BED_TOP }, angle: 180, len: BACKREST_LEN };
  const along = dir(sec.angle), down = dir(sec.angle + 90);   // toward the head end; into the mattress
  const occ = H(8, -10.4), rel = { x: occ.x - sec.pivot.x, y: occ.y - sec.pivot.y };
  const dHead = rel.x * along.x + rel.y * along.y, gap = -(rel.x * down.x + rel.y * down.y);
  const half = 15 * u;
  const onSection = smooth(0, half, dHead) * (1 - smooth(sec.len - half * 0.3, sec.len + half, dHead));
  const resting = (1 - smooth(10 * u, 22 * u, gap)) * onSection * (1 - clamp(p.ground, 0, 1));
  const dPillow = lerp(sec.len - 30 * u, clamp(dHead, half, sec.len - half * 0.7), resting);
  const h = lerp(PILLOW * u, clamp(gap + 0.6, 3.5 * u, 9 * u), resting);
  const base = { x: sec.pivot.x + along.x * dPillow, y: sec.pivot.y + along.y * dPillow };
  const at = (t: number, lift: number) => ({ x: base.x + along.x * t * half - down.x * lift, y: base.y + along.y * t * half - down.y * lift });
  const pillow: Pt[] = [at(-1.05, 0), at(-0.9, h * 0.75), at(-0.2, h * 1.02), at(0.6, h * 0.95), at(1.0, h * 0.6), at(1.05, 0)];
  /* hair rests on the pillow while the head does, else on whatever is below */
  support = resting > 0.5 ? { p: at(0, Math.min(h, Math.max(gap, 0))), n: { x: -down.x, y: -down.y } }
    : { p: { x: 0, y: p.ground < 0.5 ? BED_TOP : FLOOR }, n: { x: 0, y: -1 } };
  if (scene) {
    /* the floor is a line only while it is seen edge-on */
    const fl = pr.P({ x: 180, y: FLOOR }, 60), fl0 = pr.P({ x: 180, y: FLOOR }, -60), edgeOn = 1 - clamp(Math.abs(fl.y - fl0.y) / 30, 0, 1);
    if (edgeOn > 0.02) {
      const a = pr.P({ x: 8, y: FLOOR }), bb = pr.P({ x: 352, y: FLOOR });
      out.push(`<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(bb.x)}" y2="${f(bb.y)}" stroke="#c4cdca" stroke-width="2" stroke-linecap="round" opacity="${f(edgeOn)}" pointer-events="none"/>`);
    }
    out.push(trolley(pr, p.bedLeft, backrest, pillow, clamp(p.ground, 0, 1)));
  }

  const ctx = { k, sh, look, pal, support };
  if (withHead) { out.push(prof(() => hairBehind(ctx))); if (!backView) out.push(front(() => hairBehindFront(fctx))); }

  /* ---- depth: from the side, the far limbs are behind the body, in shade; from the front, both sides are in view ---- */
  const near: 0 | 1 = view.side * pr.c >= 0 ? 0 : 1, far: 0 | 1 = near === 0 ? 1 : 0;
  const sideOn = Math.abs(pr.c) > 0.64;
  const g = (id: string, c: Pt, axis: number, w: number) => shadeAcross(defs, id, c, axis, w * u, pal, lx);
  const ang = (a: Pt, bb: Pt) => (Math.atan2(-(bb.y - a.y), bb.x - a.x) * 180) / Math.PI;
  const mid2 = (a: Pt, bb: Pt) => mid(pr.P(a), pr.P(bb));
  const legParts = (i: 0 | 1, fills: [string, string, string]) => { const l = leg(i); return [...l.thigh.map((pts) => ({ pts, fill: fills[0] })), ...l.shin.map((pts) => ({ pts, fill: fills[1] })), ...l.foot.map((pts) => ({ pts, fill: fills[2] }))]; };
  /* each limb's shading is centred on the limb itself, where it is across the body */
  const legFills = (i: 0 | 1): [string, string, string] => {
    const z = legZ(i), hp = pr.P(k.hip, z.hip), kn = pr.P(k.knee[i], z.knee), an = pr.P(k.ankle[i], z.ankle);
    return [g(`thigh${i}`, mid(hp, kn), ang(hp, kn), 8.5), g(`shin${i}`, mid(kn, an), ang(kn, an), 6),
      g(`foot${i}`, an, ang(an, pr.P(add(k.ankle[i], k.footA[i], 10 * u), z.ankle)) + 90, 6)];
  };
  const armParts = (i: 0 | 1, fills: [string, string, string]) => { const a = arm(i); return [...a.upper.map((pts) => ({ pts, fill: fills[0] })), ...a.fore.map((pts) => ({ pts, fill: fills[1] })), ...a.hand.map((pts) => ({ pts, fill: fills[2] })), ...a.fingers.map((pts) => ({ pts, fill: fills[2] })), ...a.thumb.map((pts) => ({ pts, fill: fills[2] }))]; };
  const armFills = (i: 0 | 1): [string, string, string] => {
    const z = armZ(i), s0 = pr.P(k.shoulder, z.sh), el = pr.P(k.elbow[i], z.el), wr = pr.P(k.wrist[i], z.wr);
    /* from the front the upper arms share the chest's light (one body, no seam at the shoulder) */
    return [joinShoulder ? gWide : g(`upper${i}`, mid(s0, el), ang(s0, el), 5), joinShoulder ? gWide : g(`fore${i}`, mid(el, wr), ang(el, wr), 3.6), joinShoulder ? gWide : g(`hand${i}`, wr, ang(wr, pr.P(knuckle(i), z.wr)), 3)];
  };
  const sideAttr = (i: 0 | 1) => (i === 0 ? 'R' : 'L');
  const dress = gown(pr, k, { ...sh, upper: upperSt }, look, pal, {
    thigh: (i) => { const z = legZ(i); return [z.hip, z.knee]; },
    upper: (i) => { const z = armZ(i); return [z.sh, z.el]; },
  });
  const gownFill = 'url(#fig-§-gown)';
  if (sideOn) {
    const farPal = { light: pal.far, skin: pal.far, dark: darken(pal.far, 0.12) };
    const zf = legZ(far), hf = pr.P(k.hip, zf.hip), kf = pr.P(k.knee[far], zf.knee);
    const gFar = shadeAcross(defs, 'far', mid(hf, kf), ang(hf, kf), 9 * u, farPal, lx);
    out.push(layer([
      { attrs: `data-region="arm" data-side="${sideAttr(far)}"`, parts: armParts(far, [gFar, gFar, gFar]) },
      { attrs: `data-region="legs" data-side="${sideAttr(far)}"`, parts: legParts(far, [gFar, gFar, gFar]) },
    ], pal.farDark, lineW));
    out.push(cloth([...dress.thigh[far], ...(dress.sleeve ? dress.sleeve[far] : [])], tint(pal.gown, pal.gownDark, 0.7), pal.gownLine));
  }

  /* ---- the body: trunk, legs in view, neck and head as one silhouette ---- */
  const tw = (s: number) => ((stationAt(sh.trunk, s).a + stationAt(sh.trunk, s).p) / 2) * Math.abs(pr.c) + (stationAt(sh.trunk, s).w ?? 14) * Math.abs(pr.sn);
  const gAbd = g('abd', pr.P(trunkPt(k, 10, 0)), ang(pr.P(trunkPt(k, 0, 0)), pr.P(trunkPt(k, 20, 0))), tw(10) + sh.belly * 0.5 * Math.abs(pr.c));
  const gChest0 = g('chest', pr.P(trunkPt(k, 40, 0)), ang(pr.P(trunkPt(k, 30, 0)), pr.P(trunkPt(k, 50, 0))), tw(40));
  /* from the front and back one light runs across the chest, the shoulders and the upper arms */
  const gWide = joinShoulder ? g('wide', pr.P(trunkPt(k, 42, 0)), ang(pr.P(trunkPt(k, 30, 0)), pr.P(trunkPt(k, 50, 0))), acroZ + 7) : gChest0;
  const gChest = joinShoulder ? gWide : gChest0;
  const gNeck = joinShoulder ? gWide : g('neck', mid2(k.neckRoot, k.headJoint), ang(pr.P(k.neckRoot), pr.P(k.headJoint)), 6);
  const gHead = g('head', pr.P(H(8, 0)), ang(pr.P(H(0, 0)), pr.P(H(10, 0))) - 90 * (1 - fp), 11 - 3.5 * fp);
  const legsInBody: Array<0 | 1> = sideOn ? [near] : [0, 1];
  out.push(layer([
    { attrs: 'data-region="abdomen"', parts: [{ pts: abdomen, fill: gAbd }] },
    { attrs: 'data-region="chest"', parts: [{ pts: chest, fill: gChest }] },
    ...legsInBody.map((i) => ({ attrs: `data-region="legs" data-side="${sideAttr(i)}"`, parts: legParts(i, legFills(i)) })),
    { attrs: 'data-region="neck"', parts: neckPts.map((pts) => ({ pts, fill: gNeck })) },
    ...(joinShoulder ? ([0, 1] as const).map((i) => ({ attrs: `data-region="arm" data-side="${sideAttr(i)}"`, parts: [{ pts: shoulderShape(i, 0, 0, 13, 0), fill: armFills(i)[0] }] })) : []),
    ...(withHead ? [{ attrs: 'data-region="head"', parts: head.map((pts) => ({ pts, fill: gHead })) }] : []),
  ], pal.line, lineW));

  /* ---- what shows on the body: bare skin details, then the gown over the rest ---- */
  out.push(prof(() => bodyDetails(k, sh, look, pal)));
  out.push(front(() => trunkFront(fctx) + legsFront(fctx, legZ)));
  const sleeveFront = joinShoulder && dress.sleeve;
  out.push(cloth([...dress.trunk, ...legsInBody.flatMap((i) => dress.thigh[i]), ...(sleeveFront ? [shoulderShape(0, 1.0, 0, 12, 1.0), shoulderShape(1, 1.0, 0, 12, 1.0)] : [])], gownFill, pal.gownLine));
  out.push(prof(() => dress.profileLines));
  out.push(front(() => gownLinesFront(fctx, dress.spans, { thigh: (i, s, psi) => onTube(pr, { from: k.hip, a: k.thighA[i], flip: k.flip }, (x) => w3s(stationAt(sh.thigh, x), 1.1), s, psi, legZ(i).hip + ((legZ(i).knee - legZ(i).hip) * s) / 43) })));
  if (look.exposed.has('chest') && look.sex === 'F') { out.push(prof(() => bra(k, sh))); out.push(front(() => braFront(fctx))); }
  if (withHead) {
    /* the lock of long hair falls over the gown; the hair on the skull covers its root */
    out.push(prof(() => hairFront(ctx) + face(ctx) + hairOver(ctx) + ear(ctx)));
    out.push(front(() => faceFront(fctx) + hairFront3(fctx)));
  }

  /* the sleeve from the front: the shoulder's cloth again over the arm, its hem round the arm, its inner edge where it
     hangs free of the gown's body below the armpit */
  const sleeveOver = (i: 0 | 1) => {
    const z = armZ(i), sg2 = i === 0 ? -1 : 1, fr = { from: k.shoulder, a: k.upperA[i], flip: k.flip };
    const st = (x: number) => w3s(stationAt(sh.upper, x), 0);
    const zs = (x: number) => z.sh + ((z.el - z.sh) * x) / LEN.upper;
    /* round the side of the arm that is seen: from its outer edge over the front (or the back) to its inner edge */
    const hem = [0, 30, 60, 90, 120, 150, 180].map((t) => onTube(pr, fr, st, 12, sg2 * (backView ? 90 + t : 90 - t), zs(12), 1.35).p);
    const edge = [12, 10, 7.5].map((x) => onTube(pr, fr, st, x, -sg2 * 90, zs(x), 1.0).p);
    return `<g pointer-events="none"><path d="${closedPath(shoulderShape(i, 1.0, 0.45, 12, 0.55))}" fill="${gownFill}"/>`
      + `<path d="${openPath(hem)}" fill="none" stroke="${pal.gownLine}" stroke-width="1.1" stroke-linecap="round"/>`
      + `<path d="${openPath(edge)}" fill="none" stroke="${pal.gownLine}" stroke-width="0.9" stroke-linecap="round" opacity=".7"/></g>`;
  };

  /* ---- arms, over the trunk: the near one from the side, both from the front ---- */
  const armsOver: Array<0 | 1> = sideOn ? [near] : [0, 1];
  for (const i of armsOver) {
    out.push(layer([{ attrs: `data-region="arm" data-side="${sideAttr(i)}"`, parts: armParts(i, armFills(i)) }], pal.line, lineW));
    /* the top of the arm proper and its inner edge above the armpit disappear under the shoulder (its fill, inside its outline) */
    if (joinShoulder && !dress.sleeve) out.push(`<path d="${closedPath(shoulderShape(i, 0, 0.45, 13, 0.5))}" fill="${armFills(i)[0]}" pointer-events="none"/>`);
    if (i === 0 && near === 0) out.push(prof(() => armDetails(k, look, pal, curl)));
    if (dress.sleeve) out.push(joinShoulder ? sleeveOver(i) : sleeveSvg(dress.sleeve[i], gownFill, pal.gownLine, pr.profile ? dress.sleeveCut[i] : ''));
  }
  /* the bare chest's anatomy lies over the tops of the arms (the shoulder) */
  out.push(front(() => {
    const svg = chestFront(fctx);
    if (!svg || !joinShoulder) return svg;
    /* its shading stays on the body: clipped to the chest and the shoulders */
    const clip = [chest, shoulderShape(0, 0, 0, 13, 0), shoulderShape(1, 0, 0, 13, 0)].map((pts) => `<path d="${closedPath(pts)}"/>`).join('');
    return `<clipPath id="fig-§-torso">${clip}</clipPath><g clip-path="url(#fig-§-torso)">${svg}</g>`;
  }));
  if (withHead) {
    out.push(prof(() => oxygenSvg(ctx, { x: k.hip.x + 10 * u * Math.cos(rad(p.torso)), y: BED_TOP - 2 })));
    out.push(front(() => oxygenFront(fctx, pr.P(trunkPt(k, 30, (stationAt(sh.trunk, 30).a)), 4))));
  }

  let body = pr.wrap(out.join(''));
  const anchor = pr.P(trunkPt(k, CHEST_ANCHOR_S, 0));
  if (opts.chestFrame) body = `<g transform="scale(${f4(1 / u)}) translate(${f(-anchor.x)} ${f(-anchor.y)})">${body}</g>`;
  if (opts.collect) {
    /* the same geometry for hit-testing outside the browser (the chest views' electrode drop) */
    const fin = (q: Pt): Pt => { const x = view.side < 0 ? 360 - q.x : q.x; return opts.chestFrame ? { x: (x - anchor.x) / u, y: (q.y - anchor.y) / u } : { x, y: q.y }; };
    const put = (kind: string, side: 'R' | 'L' | '', polys: Pt[][]) => polys.forEach((pts) => opts.collect!(kind, side, pts.map(fin)));
    put('abdomen', '', [abdomen]); put('chest', '', [chest]); put('neck', '', neckPts);
    for (const i of [0, 1] as const) {
      const a = arm(i), l = leg(i), side = sideAttr(i);
      put('arm', side, [...a.upper, ...a.fore, ...a.hand]); put('legs', side, [...l.thigh, ...l.shin, ...l.foot]);
      const az = armZ(i), lz = legZ(i);
      opts.collect('wrist', side, [fin(pr.P(add(k.wrist[i], k.foreA[i], -5 * u), az.wr))]);
      opts.collect('thigh', side, [fin(pr.P(add(k.hip, k.thighA[i], 12 * u), lz.hip + (lz.knee - lz.hip) * 0.28))]);
    }
  }
  const svg = `<defs>${defs.join('')}</defs>${body}`;
  return svg.replace(/§/g, hash(svg));
}

/** Walking round the bed: 0 the patient's right, 90 the foot of the bed (the front), 180 the patient's left. The front
    is the same picture from either side, so a turn from right to left passes through it without a jump. */
export const VIEW_ANGLE = { right: 0, front: 90, left: 180 } as const;
export function viewAt(phi: number): FigureView {
  const x = clamp(phi, 0, 180);
  return x <= 90 ? { turn: x, side: 1 } : { turn: 180 - x, side: -1 };
}

/** The station level of the 4th intercostal space: the chest views put it at y = 0. */
export const CHEST_ANCHOR_S = 42;
const f4 = (n: number) => (Math.round(n * 10000) / 10000).toString();
const w3s = (t: { s: number; a: number; p: number; w?: number }, g: number) => ({ s: t.s, a: t.a + g, p: t.p + g, w: (t.w ?? (t.a + t.p) / 2) + g });

/** Kneecaps and ankle bones from the front; oedema hides the bones and makes the shins shine. */
function legsFront(c: FrontCtx, legZ: (i: 0 | 1) => { hip: number; knee: number; ankle: number }): string {
  if (c.back) return '';
  const out: string[] = [], { pr, k, sh, pal } = c, u = k.u;
  for (const i of [0, 1] as const) {
    const z = legZ(i);
    const shinAt = (s: number, psi: number, dr = 0) => onTube(pr, { from: k.knee[i], a: k.shinA[i], flip: k.flip }, (x) => w3s(stationAt(sh.shin, x), 0), s, psi, z.knee + ((z.ankle - z.knee) * s) / 43.3, dr);
    const kneeAt = (s: number, psi: number) => onTube(pr, { from: k.hip, a: k.thighA[i], flip: k.flip }, (x) => w3s(stationAt(sh.thigh, x), 0), s, psi, z.hip + ((z.knee - z.hip) * s) / 43);
    const kp = kneeAt(43, 0);
    if (kp.vis > 0) out.push(`<ellipse cx="${f(kp.p.x)}" cy="${f(kp.p.y)}" rx="${f(2.2 * u)}" ry="${f(2.5 * u)}" fill="none" stroke="${pal.line}" stroke-width=".6" opacity=".4"/>`);
    if (!sh.oedema) for (const psi of [-80, 80]) { const m = shinAt(41, psi); if (m.vis > 0) out.push(`<ellipse cx="${f(m.p.x)}" cy="${f(m.p.y)}" rx="${f(0.9 * u)}" ry="${f(1.0 * u)}" fill="${pal.dark}" opacity=".22"/>`); }
    else { const top = [99, 32, 18, 2][sh.oedema]; const pts = [shinAt(top, -15).p, shinAt((top + 43) / 2, -15).p, shinAt(40, -15).p]; out.push(`<path d="${openPath(pts)}" fill="none" stroke="#ffffff" stroke-width="1" opacity=".32" stroke-linecap="round"/>`); }
  }
  return `<g pointer-events="none">${out.join('')}</g>`;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Gradient ids must be unique per drawing on a page of many figures, and the same for the same drawing. */
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 11) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
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
