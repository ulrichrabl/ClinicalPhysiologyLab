/* ---------------------------------------------------------------------------
   The sensory chart (`renderer: 'svg.dermatomes'` in the catalog): a front and
   a back view of a schematic body with the examined dermatomes, the nerve
   territories, vibration and joint position, and the face, shaded by what the
   examination model found. Nothing here decides a finding.

   The bands follow the ISNCSCI (ASIA) key sensory points, with the shapes
   between them after the Keegan & Garrett (1948) dermatome map: C5 lateral
   upper arm to the lateral antecubital fossa, C6 lateral forearm and thumb,
   C7 middle finger (and the back of the arm), C8 little finger and medial hand,
   T1 medial forearm, T6 xiphoid, T10 umbilicus, L2 upper anterior thigh,
   L3 medial knee, L4 medial leg and medial malleolus, L5 lateral leg, dorsum
   of the foot and big toe, S1 lateral foot, heel and calf, S3–S5 perianal.
   In reality neighbouring dermatomes overlap widely and vary between people
   (Lee et al. 2008); the bands are approximate, and the legend says so.

   Geometry: each half of the body is drawn in patient coordinates (u = distance
   from the midline, y = down from the vertex) and mirrored per view. The
   patient's right is on the viewer's left in the front view and on the viewer's
   right in the back view. Limbs are in the anatomical position (palms forward):
   on a limb, t runs from its root (0) to the wrist or ankle (1) and s from
   medial (−1) to lateral (+1).
--------------------------------------------------------------------------- */

export type SenseLevel = 'normal' | 'reduced' | 'absent';
type Side = 'R' | 'L';
type Lang = 'en' | 'de';
type T = { en: string; de: string };
export type ArmPinprick = Partial<Record<'C5' | 'C6' | 'C7' | 'C8' | 'T1', SenseLevel>> & { territories?: string[] };
export type LegPinprick = Partial<Record<'L2' | 'L3' | 'L4' | 'L5' | 'S1', SenseLevel>> & { territories?: string[] };
export type TrunkPinprick = Partial<Record<'T6' | 'T10', SenseLevel>>;
export type PositionSense = { vibration?: SenseLevel; proprioception?: SenseLevel };
export type FaceSensation = Partial<Record<'V1' | 'V2' | 'V3', SenseLevel>> & { corneal?: boolean };

/** What the examination model returns, per side; a part left out was not examined and is drawn as not tested. */
export interface SensoryChartInput {
  arm?: Partial<Record<Side, ArmPinprick>>;
  leg?: Partial<Record<Side, LegPinprick>>;
  trunk?: Partial<Record<Side, TrunkPinprick>>;
  saddle?: SenseLevel;
  armVibration?: Partial<Record<Side, PositionSense>>;
  legVibration?: Partial<Record<Side, PositionSense>>;
  face?: Partial<Record<Side, FaceSensation>>;
}
export type SensoryChartColors = { fg: string; muted: string; line: string; abn: string; surface: string; skin?: string };

/* ---- texts ------------------------------------------------------------------------- */

const TX = {
  front: { en: 'Front', de: 'Vorderansicht' },
  back: { en: 'Back', de: 'Rückansicht' },
  R: { en: 'R', de: 'R' }, L: { en: 'L', de: 'L' },
  right: { en: 'right', de: 'rechts' }, left: { en: 'left', de: 'links' },
  normal: { en: 'normal', de: 'normal' },
  reduced: { en: 'reduced', de: 'vermindert' },
  absent: { en: 'absent', de: 'aufgehoben' },
  untested: { en: 'not tested', de: 'nicht geprüft' },
  territory: { en: 'nerve territory affected', de: 'Nervengebiet betroffen' },
  vib: { en: 'vibration', de: 'Vibration' },
  jps: { en: 'joint position', de: 'Lagesinn' },
  filled: { en: 'filled: lost', de: 'gefüllt: ausgefallen' },
  corneal: { en: 'corneal reflex lost', de: 'Kornealreflex erloschen' },
  cornealOk: { en: 'corneal reflex present', de: 'Kornealreflex vorhanden' },
  overlap: { en: 'Dermatomes overlap: the bands are approximate.', de: 'Dermatome überlappen: die Bänder sind ungefähr.' },
  pinprick: { en: 'pinprick', de: 'Schmerzempfinden' },
  hand: { en: 'index finger', de: 'Zeigefinger' }, toe: { en: 'big toe', de: 'Großzehe' },
  title: { en: 'Sensory chart', de: 'Sensibilitätsschema' },
} satisfies Record<string, T>;

const WHERE: Record<string, T> = {
  C5: { en: 'lateral upper arm', de: 'Oberarmaußenseite' },
  C6: { en: 'lateral forearm, thumb', de: 'radialer Unterarm, Daumen' },
  C7: { en: 'middle finger', de: 'Mittelfinger' },
  C8: { en: 'little finger, medial hand', de: 'Kleinfinger, ulnare Hand' },
  T1: { en: 'medial forearm', de: 'ulnarer Unterarm' },
  T6: { en: 'xiphoid level', de: 'Höhe des Processus xiphoideus' },
  T10: { en: 'umbilicus', de: 'Nabel' },
  L2: { en: 'upper anterior thigh', de: 'proximaler vorderer Oberschenkel' },
  L3: { en: 'lower medial thigh, knee', de: 'distaler innerer Oberschenkel, Knie' },
  L4: { en: 'medial leg, medial malleolus', de: 'Unterschenkelinnenseite, Innenknöchel' },
  L5: { en: 'lateral leg, dorsum of the foot, big toe', de: 'Unterschenkelaußenseite, Fußrücken, Großzehe' },
  S1: { en: 'lateral foot, heel, calf', de: 'Fußaußenrand, Ferse, Wade' },
  S345: { en: 'saddle (S3–S5, perianal)', de: 'Reithose (S3–S5, perianal)' },
  V1: { en: 'V1 ophthalmic: forehead', de: 'V1 ophthalmicus: Stirn' },
  V2: { en: 'V2 maxillary: cheek', de: 'V2 maxillaris: Wange' },
  V3: { en: 'V3 mandibular: jaw', de: 'V3 mandibularis: Unterkiefer' },
};
const NERVE: Record<string, T> = {
  axillary: { en: 'axillary nerve (regimental badge)', de: 'N. axillaris (Schulteraußenseite)' },
  musculocutaneous: { en: 'musculocutaneous nerve (lateral forearm)', de: 'N. musculocutaneus (radialer Unterarm)' },
  radial: { en: 'radial nerve (dorsal first web space)', de: 'N. radialis (dorsale erste Interdigitalfalte)' },
  median: { en: 'median nerve (palmar thumb, index and middle finger)', de: 'N. medianus (palmar Daumen, Zeige- und Mittelfinger)' },
  ulnar: { en: 'ulnar nerve (little finger and medial hand)', de: 'N. ulnaris (Kleinfinger und ulnare Hand)' },
  femoral: { en: 'femoral nerve (anterior thigh, medial leg)', de: 'N. femoralis (Oberschenkelvorderseite, Unterschenkelinnenseite)' },
  obturator: { en: 'obturator nerve (medial thigh)', de: 'N. obturatorius (Oberschenkelinnenseite)' },
  peroneal: { en: 'common peroneal nerve (lateral leg, dorsum of the foot)', de: 'N. peroneus communis (Unterschenkelaußenseite, Fußrücken)' },
  tibial: { en: 'tibial nerve (sole)', de: 'N. tibialis (Fußsohle)' },
};

const esc = (x: string) => x.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

/* ---- geometry (patient coordinates) ----------------------------------------------------- */

type P = [number, number];          // [u, y]
type Station = [number, number, number];   // centre u, centre y, half-width
const ARM: Station[] = [[44.5, 91, 12.5], [47.5, 116, 11], [51.5, 144, 9.8], [55.5, 178, 8.6], [59.5, 212, 6.6]];
const LEG: Station[] = [[20, 200, 18.5], [19.5, 248, 15], [18.5, 290, 10.5], [18.5, 316, 11.4], [17.5, 342, 8.4], [17, 366, 6]];

function limbFrame(st: Station[], t: number): { c: P; hw: number; lat: P; dir: P } {
  const n = st.length - 1, x = Math.max(0, Math.min(1, t)) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
  const a = st[i], b = st[i + 1];
  const c: P = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const hw = a[2] + (b[2] - a[2]) * f;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  const dir: P = [dx / L, dy / L];
  let lat: P = [dir[1], -dir[0]]; if (lat[0] < 0) lat = [-lat[0], -lat[1]];
  return { c, hw, lat, dir };
}
const limbPt = (st: Station[], t: number, s: number): P => { const fr = limbFrame(st, t); return [fr.c[0] + fr.lat[0] * fr.hw * s, fr.c[1] + fr.lat[1] * fr.hw * s]; };
/** A region on a limb, given by corners in (t, s); edges are subdivided so they follow the limb. */
function limbRegion(st: Station[], corners: Array<[number, number]>, k = 10): P[] {
  const out: P[] = [];
  for (let i = 0; i < corners.length; i++) {
    const [t0, s0] = corners[i], [t1, s1] = corners[(i + 1) % corners.length];
    for (let j = 0; j < k; j++) out.push(limbPt(st, t0 + (t1 - t0) * j / k, s0 + (s1 - s0) * j / k));
  }
  return out;
}
const HAND_SCALE = 1.3;
/** The hand in its own frame: a along the forearm from the wrist, c lateral (towards the thumb). */
function handPt(a: number, c: number): P {
  const fr = limbFrame(ARM, 1);
  const k = HAND_SCALE;
  return [fr.c[0] + fr.dir[0] * a * k + fr.lat[0] * c * k, fr.c[1] + fr.dir[1] * a * k + fr.lat[1] * c * k];
}
const handPoly = (pts: Array<[number, number]>): P[] => pts.map(([a, c]) => handPt(a, c));
/** A finger (or thumb) as a capsule from (a0, c0) to (a1, c1), half-width w. */
function capsule(a0: number, c0: number, a1: number, c1: number, w: number): P[] {
  const da = a1 - a0, dc = c1 - c0, L = Math.hypot(da, dc), ua = da / L, uc = dc / L, na = -uc, nc = ua;
  const pts: Array<[number, number]> = [[a0 + na * w, c0 + nc * w]];
  for (let i = 0; i <= 8; i++) { const th = Math.PI * i / 8; const ca = Math.cos(th), sa = Math.sin(th); pts.push([a1 + na * w * ca + ua * w * sa, c1 + nc * w * ca + uc * w * sa]); }
  pts.push([a0 - na * w, c0 - nc * w]);
  return handPoly(pts);
}
const FINGERS = { index: [4.6, 14.5], middle: [1.2, 16.5], ring: [-2.2, 15], little: [-5.4, 11.5] } as const;
const finger = (k: keyof typeof FINGERS) => capsule(19, FINGERS[k][0], 19 + FINGERS[k][1], FINGERS[k][0] * 1.08, 1.65);
const THUMB = capsule(3, 5.5, 13, 11.5, 1.9);
const PALM = handPoly([[-1.5, -6], [-1.5, 6], [6, 8], [19, 6.7], [20.5, 4], [20.5, -5], [19, -7.2], [8, -7.6]]);
const handRect = (c0: number, c1: number, a0 = -1.5, a1 = 20.5) => handPoly([[a0, c0], [a1, c0], [a1, c1], [a0, c1]]);

/** The foot, relative to the ankle; du lateral. */
const ANKLE = limbFrame(LEG, 1).c;
const footPoly = (pts: Array<[number, number]>): P[] => pts.map(([du, y]) => [ANKLE[0] + du, y]);
const FOOT_FRONT = footPoly([[-5.5, 362], [5.5, 362], [7.5, 372], [10.5, 383], [9.5, 389], [3, 390.5], [-3, 391], [-8.5, 390], [-10, 386], [-8, 374]]);
const HEEL_BACK = footPoly([[-6, 362], [6, 362], [7.5, 374], [5.5, 383], [0, 385.5], [-5.5, 383], [-7.5, 374]]);
const footRect = (d0: number, d1: number, y0: number, y1: number) => footPoly([[d0, y0], [d1, y0], [d1, y1], [d0, y1]]);

/** Half of the torso, the head and neck are symmetric shapes in their own right. */
const TORSO_HALF: P[] = [[0, 60], [9, 60], [14, 64], [30, 68], [41, 73], [46, 82], [41, 96], [37, 108], [34, 130], [31, 150], [30, 166], [33, 182], [37, 196], [38, 204], [30, 212], [12, 215], [0, 216]];
const torso = (): P[] => [...TORSO_HALF, ...TORSO_HALF.slice(1, -1).reverse().map(([u, y]) => [-u, y] as P)];
const ellipse = (cu: number, cy: number, rx: number, ry: number, n = 28): P[] => Array.from({ length: n }, (_, i) => { const a = 2 * Math.PI * i / n; return [cu + rx * Math.cos(a), cy + ry * Math.sin(a)] as P; });
const HEAD = ellipse(0, 28, 17, 23, 36);
const NECK: P[] = [[-8, 44], [8, 44], [9, 64], [-9, 64]];
const DELTOID = ellipse(43.5, 88, 13.5, 12.5, 24);

/* ---- what is drawn where ------------------------------------------------------------------- */

type View = 'front' | 'back';
type Seg = 'C5' | 'C6' | 'C7' | 'C8' | 'T1' | 'T6' | 'T10' | 'L2' | 'L3' | 'L4' | 'L5' | 'S1' | 'V1' | 'V2' | 'V3';
type Region = { seg: Seg; polys: P[][]; label?: P; torso?: boolean };
const A = (c: Array<[number, number]>) => limbRegion(ARM, c);
const G = (c: Array<[number, number]>) => limbRegion(LEG, c);
const tBand = (y0: number, slope: number, h: number): P[] => [[0, y0], [46, y0 + slope * 46], [46, y0 + slope * 46 + h], [0, y0 + h]];

const FRONT: Region[] = [
  { seg: 'V1', polys: [[[0, 0], [18, 0], [18, 22], [0, 24.5]]], label: [8, 15] },
  { seg: 'V2', polys: [[[0, 24.5], [18, 22], [18, 29], [13, 36], [0, 37.5]]], label: [11.5, 33] },
  { seg: 'V3', polys: [[[0, 37.5], [13, 36], [18, 29], [18, 52], [0, 52]]], label: [8, 48] },
  { seg: 'T6', polys: [tBand(121, -0.14, 10)], label: [16, 124], torso: true },
  { seg: 'T10', polys: [tBand(160, -0.1, 10)], label: [18, 163], torso: true },
  { seg: 'C5', polys: [A([[0, -0.05], [0.42, -0.1], [0.48, 0], [0.48, 1], [0, 1]])], label: limbPt(ARM, 0.3, 0.45) },
  { seg: 'T1', polys: [A([[0.36, -1], [0.74, -1], [0.74, -0.1], [0.48, -0.1], [0.42, -0.1]])], label: limbPt(ARM, 0.58, -0.55) },
  { seg: 'C6', polys: [A([[0.48, -0.1], [0.74, -0.1], [0.74, 0.5], [1, 0.5], [1, 1], [0.48, 1]]), handRect(2.9, 14), THUMB, finger('index')], label: limbPt(ARM, 0.7, 0.62) },
  { seg: 'C7', polys: [A([[0.74, -0.1], [1, -0.1], [1, 0.5], [0.74, 0.5]]), handRect(-0.6, 2.9), finger('middle')], label: handPt(9, 1.1) },
  { seg: 'C8', polys: [A([[0.74, -1], [1, -1], [1, -0.1], [0.74, -0.1]]), handRect(-14, -0.6), finger('ring'), finger('little')], label: limbPt(ARM, 0.88, -0.6) },
  { seg: 'L2', polys: [G([[0.04, 1], [0.2, 1], [0.3, -1], [0.1, -1]])], label: limbPt(LEG, 0.16, 0.05) },
  { seg: 'L3', polys: [G([[0.2, 1], [0.45, 1], [0.58, -1], [0.3, -1]])], label: limbPt(LEG, 0.4, -0.05) },
  { seg: 'L4', polys: [G([[0.58, -1], [1, -1], [1, -0.1], [0.52, -0.1]]), footRect(-14, -4.5, 366, 378)], label: limbPt(LEG, 0.75, -0.55) },
  { seg: 'L5', polys: [G([[0.52, -0.1], [1, -0.1], [1, 1], [0.45, 1]]), footPoly([[-4.5, 366], [5, 366], [5, 393], [-14, 393], [-14, 378], [-4.5, 378]])], label: limbPt(LEG, 0.72, 0.45) },
  { seg: 'S1', polys: [footRect(5, 14, 366, 393)] },
];
const BACK: Region[] = [
  { seg: 'T6', polys: [tBand(105, 0.14, 10)], label: [16, 112], torso: true },
  { seg: 'T10', polys: [tBand(146, 0.1, 10)], label: [18, 153], torso: true },
  { seg: 'C5', polys: [A([[0, -0.25], [0.3, -0.25], [0.45, 0.3], [0.45, 1], [0, 1]])] },
  { seg: 'C7', polys: [A([[0.3, -0.25], [1, -0.1], [1, 0.5], [0.45, 0.3]]), handRect(-0.6, 2.9), finger('middle')], label: limbPt(ARM, 0.62, 0.1) },
  { seg: 'C6', polys: [A([[0.45, 0.3], [1, 0.5], [1, 1], [0.45, 1]]), handRect(2.9, 14), THUMB, finger('index')] },
  { seg: 'T1', polys: [A([[0.36, -1], [0.74, -1], [0.74, -0.18], [0.36, -0.25]])] },
  { seg: 'C8', polys: [A([[0.74, -1], [1, -1], [1, -0.1], [0.74, -0.18]]), handRect(-14, -0.6), finger('ring'), finger('little')] },
  { seg: 'L4', polys: [G([[0.55, -1], [1, -1], [1, -0.4], [0.55, -0.4]])] },
  { seg: 'S1', polys: [G([[0.55, -0.4], [1, -0.4], [1, 0.6], [0.55, 0.6]]), HEEL_BACK], label: limbPt(LEG, 0.7, 0.1) },
  { seg: 'L5', polys: [G([[0.55, 0.6], [1, 0.6], [1, 1], [0.55, 1]])] },
];
const SADDLE = ellipse(0, 207, 13, 9.5, 28);

/** Nerve territories, with sharp edges, where they can be seen. */
const TERRITORIES: Record<string, Partial<Record<View, P[][]>>> = {
  axillary: { front: [A([[0.06, 0.3], [0.3, 0.3], [0.3, 1], [0.06, 1]])], back: [A([[0.06, 0.15], [0.32, 0.15], [0.32, 1], [0.06, 1]])] },
  musculocutaneous: { front: [A([[0.52, 0.3], [0.95, 0.55], [0.95, 1], [0.52, 1]])], back: [A([[0.55, 0.7], [0.92, 0.75], [0.92, 1], [0.55, 1]])] },
  radial: { back: [handPoly([[-1, 2.5], [14, 2.5], [17, 6], [12, 12], [-1, 8]])] },
  median: { front: [handRect(-0.6, 14, 1, 20.5), THUMB, finger('index'), finger('middle')] },
  ulnar: { front: [handRect(-14, -0.6, 1, 20.5), finger('ring'), finger('little')], back: [handRect(-14, -0.6, 1, 20.5), finger('ring'), finger('little')] },
  femoral: { front: [G([[0.1, -0.45], [0.1, 0.6], [0.48, 0.6], [0.52, -0.45]]), G([[0.56, -1], [1, -1], [1, -0.5], [0.56, -0.5]]), footRect(-14, -6, 362, 380)] },
  obturator: { front: [G([[0.28, -1], [0.48, -1], [0.48, -0.55], [0.28, -0.55]])] },
  peroneal: { front: [G([[0.58, 0.05], [1, -0.05], [1, 1], [0.56, 1]]), footRect(-6, 7.5, 366, 393)], back: [G([[0.55, 0.62], [0.82, 0.62], [0.82, 1], [0.55, 1]])] },
  tibial: { back: [footPoly([[-8, 373], [8, 373], [8, 390], [-8, 390]])] },
};

/* ---- drawing -------------------------------------------------------------------------- */

const SC = 1.2, TOP = 30, W = 520, CX: Record<View, number> = { front: 130, back: 390 };
/** The patient's right is on the viewer's left from the front and on the viewer's right from behind. */
const sign = (v: View, S: Side) => (v === 'front' ? (S === 'R' ? -1 : 1) : (S === 'R' ? 1 : -1));
const X = (v: View, S: Side, u: number) => CX[v] + sign(v, S) * u * SC;
const Y = (y: number) => TOP + y * SC;
const pathOf = (v: View, S: Side, pts: P[]) => 'M' + pts.map(([u, y]) => `${f1(X(v, S, u))},${f1(Y(y))}`).join('L') + 'Z';
const fullPath = (v: View, pts: P[]) => pathOf(v, 'L', pts);   // a symmetric (or signed-u) shape

/** A short hash so two charts on one page do not share pattern ids unless they are the same chart. */
function uidOf(s: string): string { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return 'sc' + (h >>> 0).toString(36); }

type Style = { fill: string; stroke: string; dash?: string; width: number; opacity?: number };

export function sensoryChartSvg(input: SensoryChartInput, lang: Lang, colors: SensoryChartColors): string {
  const tr = (t: T) => esc(t[lang]);
  const uid = uidOf(JSON.stringify(input) + lang + JSON.stringify(colors));
  const skin = colors.skin ?? colors.surface;
  const level = (x?: SenseLevel) => (x === 'normal' || x === 'reduced' || x === 'absent' ? x : undefined);
  const style = (lv: SenseLevel | undefined): Style => lv === 'absent' ? { fill: colors.abn, stroke: colors.abn, width: 0.6, opacity: 0.55 }
    : lv === 'reduced' ? { fill: `url(#${uid}-hatch)`, stroke: colors.abn, width: 0.6 }
    : lv === 'normal' ? { fill: 'none', stroke: colors.line, width: 0.5, opacity: 0.55 }
    : { fill: 'none', stroke: colors.muted, width: 0.8, dash: '1 2' };
  const levelText = (lv: SenseLevel | undefined) => tr(lv ? TX[lv] : TX.untested);
  const sideText = (S: Side) => tr(S === 'R' ? TX.right : TX.left);

  /* the value of a segment on a side */
  const segLevel = (seg: Seg, S: Side): SenseLevel | undefined => {
    if (seg === 'V1' || seg === 'V2' || seg === 'V3') return level(input.face?.[S]?.[seg]);
    if (seg === 'T6' || seg === 'T10') return level(input.trunk?.[S]?.[seg]);
    if (seg === 'C5' || seg === 'C6' || seg === 'C7' || seg === 'C8' || seg === 'T1') return level(input.arm?.[S]?.[seg]);
    return level(input.leg?.[S]?.[seg]);
  };
  const territoriesOf = (S: Side) => [...(input.arm?.[S]?.territories ?? []), ...(input.leg?.[S]?.territories ?? [])].filter((t) => TERRITORIES[t]);

  const shape = (d: string, st: Style, title: string, clip?: string) =>
    `<path d="${d}" fill="${st.fill}"${st.opacity !== undefined && st.fill !== 'none' ? ` fill-opacity="${st.opacity}"` : ''} stroke="${st.stroke}" stroke-width="${st.width}"${st.opacity !== undefined ? ` stroke-opacity="${Math.min(1, st.opacity + 0.3)}"` : ''}${st.dash ? ` stroke-dasharray="${st.dash}"` : ''} stroke-linejoin="round"${clip ? ` clip-path="url(#${clip})"` : ''}><title>${title}</title></path>`;

  const out: string[] = [];
  const H = 640;
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;height:auto;display:block" role="img" aria-label="${tr(TX.title)}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">`);
  out.push(`<title>${tr(TX.title)}</title>`);
  out.push('<defs>',
    `<pattern id="${uid}-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="${colors.abn}" fill-opacity="0.1"/><line x1="0" y1="0" x2="0" y2="4" stroke="${colors.abn}" stroke-width="1.3" stroke-opacity="0.75"/></pattern>`,
    `<pattern id="${uid}-cross" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${colors.abn}" fill-opacity="0.22"/><path d="M0,0V5M0,0H5" stroke="${colors.abn}" stroke-width="0.9"/></pattern>`);
  const silhouette = (v: View): string[] => {
    const parts: string[] = [fullPath(v, HEAD), fullPath(v, NECK), fullPath(v, torso())];
    for (const S of ['R', 'L'] as Side[]) {
      parts.push(pathOf(v, S, DELTOID), pathOf(v, S, limbRegion(ARM, [[0, -1], [1, -1], [1, 1], [0, 1]], 24)), pathOf(v, S, PALM), pathOf(v, S, THUMB));
      for (const k of Object.keys(FINGERS) as Array<keyof typeof FINGERS>) parts.push(pathOf(v, S, finger(k)));
      parts.push(pathOf(v, S, limbRegion(LEG, [[0, -1], [1, -1], [1, 1], [0, 1]], 24)), pathOf(v, S, v === 'front' ? FOOT_FRONT : HEEL_BACK));
      parts.push(pathOf(v, S, ellipse(17.5, 29, 3, 6, 14)));   // ear
    }
    return parts;
  };
  for (const v of ['front', 'back'] as View[]) out.push(`<clipPath id="${uid}-torso-${v}"><path d="${fullPath(v, torso())}"/></clipPath>`);
  for (const v of ['front', 'back'] as View[]) out.push(`<clipPath id="${uid}-clip-${v}">${silhouette(v).map((d) => `<path d="${d}"/>`).join('')}</clipPath>`);
  out.push('</defs>');
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${colors.surface}"/>`);

  for (const v of ['front', 'back'] as View[]) {
    const clip = `${uid}-clip-${v}`;
    const sil = silhouette(v);
    /* titles and sides */
    out.push(`<text x="${CX[v]}" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="${colors.fg}">${tr(v === 'front' ? TX.front : TX.back)}</text>`);
    for (const S of ['R', 'L'] as Side[]) {
      out.push(`<text x="${f1(X(v, S, 62))}" y="${f1(Y(30))}" text-anchor="middle" font-size="16" font-weight="700" fill="${colors.fg}"><title>${tr(S === 'R' ? { en: 'patient’s right', de: 'rechts beim Patienten' } : { en: 'patient’s left', de: 'links beim Patienten' })}</title>${tr(TX[S])}</text>`);
    }
    /* the body: an outline under a fill gives one silhouette */
    out.push(`<g fill="${skin}" stroke="${colors.line}" stroke-width="2.2" stroke-linejoin="round">${sil.map((d) => `<path d="${d}"/>`).join('')}</g>`);
    out.push(`<g fill="${skin}" stroke="none">${sil.map((d) => `<path d="${d}"/>`).join('')}</g>`);

    /* dermatomes */
    const labels: string[] = [];
    for (const S of ['R', 'L'] as Side[]) {
      for (const r of v === 'front' ? FRONT : BACK) {
        const lv = segLevel(r.seg, S), st = style(lv);
        const title = `${r.seg} ${sideText(S)} (${tr(WHERE[r.seg])}), ${tr(TX.pinprick)}: ${levelText(lv)}`;
        out.push(`<g data-seg="${r.seg}" data-side="${S}" data-level="${lv ?? 'untested'}">${r.polys.map((p) => shape(pathOf(v, S, p), st, title, r.torso ? `${uid}-torso-${v}` : clip)).join('')}</g>`);
        if (r.label) {
          const abn = lv === 'reduced' || lv === 'absent';
          labels.push(`<text x="${f1(X(v, S, r.label[0]))}" y="${f1(Y(r.label[1]) + 2.6)}" text-anchor="middle" font-size="7.5" font-weight="${abn ? 700 : 400}" fill="${abn ? colors.fg : colors.muted}" pointer-events="none">${esc(r.seg)}</text>`);
        }
      }
    }
    if (v === 'back') {
      const lv = level(input.saddle);
      out.push(`<g data-seg="S3-5" data-level="${lv ?? 'untested'}">${shape(fullPath(v, SADDLE), style(lv), `${tr(WHERE.S345)}, ${tr(TX.pinprick)}: ${levelText(lv)}`, clip)}</g>`);
      labels.push(`<text x="${CX[v]}" y="${f1(Y(207) + 2.4)}" text-anchor="middle" font-size="6.5" font-weight="${lv && lv !== 'normal' ? 700 : 400}" fill="${lv && lv !== 'normal' ? colors.fg : colors.muted}" pointer-events="none">S3–5</text>`);
    }

    /* landmarks, faint */
    const lm: string[] = [];
    if (v === 'front') {
      lm.push(`<circle cx="${CX[v]}" cy="${f1(Y(166))}" r="1.3" fill="none" stroke="${colors.line}" stroke-width="0.8"/>`);
      lm.push(`<path d="M${f1(X(v, 'L', -4))},${f1(Y(42))}Q${CX[v]},${f1(Y(44))} ${f1(X(v, 'L', 4))},${f1(Y(42))}" fill="none" stroke="${colors.line}" stroke-width="0.8"/>`);
      lm.push(`<path d="M${CX[v]},${f1(Y(28))}L${f1(X(v, 'L', 1.6))},${f1(Y(35))}L${CX[v]},${f1(Y(35.6))}" fill="none" stroke="${colors.line}" stroke-width="0.7"/>`);
      lm.push(`<path d="M${f1(X(v, 'L', -2))},${f1(Y(118))}L${CX[v]},${f1(Y(121))}L${f1(X(v, 'L', 2))},${f1(Y(118))}" fill="none" stroke="${colors.line}" stroke-width="0.6" opacity="0.7"/>`);   // xiphoid
    } else {
      lm.push(`<path d="M${CX[v]},${f1(Y(68))}V${f1(Y(186))}" stroke="${colors.line}" stroke-width="0.6" stroke-dasharray="1.5 2.5" opacity="0.7"/>`);
      lm.push(`<path d="M${CX[v]},${f1(Y(190))}V${f1(Y(215))}" stroke="${colors.line}" stroke-width="0.9"/>`);
      for (const S of ['R', 'L'] as Side[]) lm.push(`<path d="M${f1(X(v, S, 2))},${f1(Y(214))}Q${f1(X(v, S, 18))},${f1(Y(219))} ${f1(X(v, S, 34))},${f1(Y(209))}" fill="none" stroke="${colors.line}" stroke-width="0.7"/>`);
    }
    out.push(`<g pointer-events="none">${lm.join('')}</g>`);

    /* nerve territories: sharp-edged overlays over the bands */
    for (const S of ['R', 'L'] as Side[]) for (const t of territoriesOf(S)) {
      const polys = TERRITORIES[t][v]; if (!polys) continue;
      const title = `${tr(NERVE[t])} ${sideText(S)}: ${tr(TX.territory)}`;
      out.push(`<g data-nerve="${esc(t)}" data-side="${S}">${polys.map((p) => `<path d="${pathOf(v, S, p)}" fill="url(#${uid}-cross)" stroke="${colors.abn}" stroke-width="1.3" stroke-linejoin="miter" clip-path="url(#${clip})"><title>${title}</title></path>`).join('')}</g>`);
    }
    out.push(...labels);

    /* eyes and the corneal reflex (front only) */
    if (v === 'front') for (const S of ['R', 'L'] as Side[]) {
      const ex = X(v, S, 7.2), ey = Y(24.5), face = input.face?.[S];
      const lost = face?.corneal === false, known = face?.corneal !== undefined;
      out.push(`<ellipse cx="${f1(ex)}" cy="${f1(ey)}" rx="3.3" ry="1.5" fill="${colors.surface}" stroke="${colors.fg}" stroke-width="0.7"><title>${tr(lost ? TX.corneal : known ? TX.cornealOk : { en: 'corneal reflex not tested', de: 'Kornealreflex nicht geprüft' })} (${sideText(S)})</title></ellipse>`);
      out.push(`<circle cx="${f1(ex)}" cy="${f1(ey)}" r="0.9" fill="${colors.fg}" pointer-events="none"/>`);
      if (lost) out.push(`<g pointer-events="none" stroke="${colors.abn}" stroke-width="1.3" fill="none"><circle cx="${f1(ex)}" cy="${f1(ey)}" r="5"/><path d="M${f1(ex - 3.5)},${f1(ey + 3.5)}L${f1(ex + 3.5)},${f1(ey - 3.5)}"/></g>`);
    }

    /* vibration (circle) and joint position (diamond) at the index finger and the big toe (front only) */
    if (v === 'front') for (const S of ['R', 'L'] as Side[]) {
      const marks: Array<[P, PositionSense | undefined, T]> = [
        [handPt(19 + FINGERS.index[1] + 6, FINGERS.index[0] * 1.08 + 1), input.armVibration?.[S], TX.hand],
        [[ANKLE[0] - 6, 399], input.legVibration?.[S], TX.toe],
      ];
      for (const [[u, y], ps, where] of marks) {
        const cx = X(v, S, u), cy = Y(y), dx = sign(v, S) * 7;
        const mk = (lv: SenseLevel | undefined) => lv === 'absent' ? `fill="${colors.abn}" stroke="${colors.abn}"`
          : lv === 'reduced' ? `fill="url(#${uid}-hatch)" stroke="${colors.abn}"`
          : lv === 'normal' ? `fill="${colors.surface}" stroke="${colors.fg}"` : `fill="${colors.surface}" stroke="${colors.muted}" stroke-dasharray="1 1.5"`;
        const vl = level(ps?.vibration), jl = level(ps?.proprioception);
        out.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="3.2" ${mk(vl)} stroke-width="1"><title>${tr(TX.vib)}, ${tr(where)} ${sideText(S)}: ${levelText(vl)}</title></circle>`);
        const jx = cx + dx;
        out.push(`<path d="M${f1(jx)},${f1(cy - 3.8)}L${f1(jx + 3.8)},${f1(cy)}L${f1(jx)},${f1(cy + 3.8)}L${f1(jx - 3.8)},${f1(cy)}Z" ${mk(jl)} stroke-width="1"><title>${tr(TX.jps)}, ${tr(where)} ${sideText(S)}: ${levelText(jl)}</title></path>`);
      }
    }
  }

  /* legend */
  const ly = 540, col = [14, 186, 352];
  const sw = (x: number, y: number, st: Style) => `<rect x="${x}" y="${y - 9}" width="16" height="11" fill="${st.fill === 'none' ? colors.surface : st.fill}"${st.opacity !== undefined && st.fill !== 'none' ? ` fill-opacity="${st.opacity}"` : ''} stroke="${st.stroke}" stroke-width="${Math.max(0.9, st.width)}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/>`;
  const lt = (x: number, y: number, s: string) => `<text x="${x}" y="${y}" font-size="11" fill="${colors.fg}">${s}</text>`;
  out.push(`<line x1="10" y1="${ly - 22}" x2="${W - 10}" y2="${ly - 22}" stroke="${colors.line}" stroke-width="0.6" opacity="0.6"/>`);
  out.push(sw(col[0], ly, { ...style('normal'), stroke: colors.line, width: 0.9, opacity: undefined }), lt(col[0] + 22, ly, tr(TX.normal)));
  out.push(sw(col[1], ly, style('reduced')), lt(col[1] + 22, ly, tr(TX.reduced)));
  out.push(sw(col[2], ly, style('absent')), lt(col[2] + 22, ly, tr(TX.absent)));
  out.push(sw(col[0], ly + 22, style(undefined)), lt(col[0] + 22, ly + 22, tr(TX.untested)));
  out.push(`<rect x="${col[1]}" y="${ly + 13}" width="16" height="11" fill="url(#${uid}-cross)" stroke="${colors.abn}" stroke-width="1.3"/>`, lt(col[1] + 22, ly + 22, tr(TX.territory)));
  /* vibration and joint position */
  const my = ly + 44 - 3.5;
  out.push(`<circle cx="${col[0] + 8}" cy="${my}" r="3.6" fill="${colors.surface}" stroke="${colors.fg}"/>`, lt(col[0] + 16, ly + 44, tr(TX.vib)));
  const jx = col[0] + 30 + tr(TX.vib).length * 5.6;
  out.push(`<path d="M${jx},${my - 4.2}L${jx + 4.2},${my}L${jx},${my + 4.2}L${jx - 4.2},${my}Z" fill="${colors.surface}" stroke="${colors.fg}"/>`, lt(jx + 8, ly + 44, `${tr(TX.jps)} (${tr(TX.filled)})`));
  const ex = col[2] + 8, ey = my;
  out.push(`<ellipse cx="${ex}" cy="${ey}" rx="3.3" ry="1.5" fill="${colors.surface}" stroke="${colors.fg}" stroke-width="0.7"/><g stroke="${colors.abn}" stroke-width="1.3" fill="none"><circle cx="${ex}" cy="${ey}" r="5"/><path d="M${ex - 3.5},${ey + 3.5}L${ex + 3.5},${ey - 3.5}"/></g>`, lt(col[2] + 22, ly + 44, tr(TX.corneal)));
  out.push(`<text x="${col[0]}" y="${ly + 70}" font-size="11" font-style="italic" fill="${colors.muted}">${tr(TX.overlap)}</text>`);
  out.push('</svg>');
  return out.join('');
}

/* ---- from the examination ---------------------------------------------------------------- */

/** The chart's input from observations by reference (`arm.pinprick.R`, `saddle.sensation`, ...). A reference that
    cannot be read, or reads nothing, is left out and drawn as not tested. */
export function sensoryInputFrom(observe: (ref: string, ctx?: object) => { value: any } | undefined): SensoryChartInput {
  const get = (ref: string): any => { try { const v = observe(ref)?.value; return v && typeof v === 'object' ? v : undefined; } catch { return undefined; } };
  const sides = <X>(prop: string, pick: (v: any) => X): Partial<Record<Side, X>> | undefined => {
    const o: Partial<Record<Side, X>> = {};
    for (const S of ['R', 'L'] as Side[]) { const v = get(`${prop}.${S}`); if (v) o[S] = pick(v); }
    return Object.keys(o).length ? o : undefined;
  };
  const segs = (v: any, keys: string[]) => Object.fromEntries(keys.filter((k) => typeof v[k] === 'string').map((k) => [k, v[k]]));
  const sad = get('saddle.sensation');
  return {
    arm: sides('arm.pinprick', (v) => ({ ...segs(v, ['C5', 'C6', 'C7', 'C8', 'T1']), territories: Array.isArray(v.territories) ? [...v.territories] : [] })),
    leg: sides('leg.pinprick', (v) => ({ ...segs(v, ['L2', 'L3', 'L4', 'L5', 'S1']), territories: Array.isArray(v.territories) ? [...v.territories] : [] })),
    trunk: sides('trunk.pinprick', (v) => segs(v, ['T6', 'T10'])),
    saddle: typeof sad?.pinprick === 'string' ? sad.pinprick : undefined,
    armVibration: sides('arm.vibration', (v) => segs(v, ['vibration', 'proprioception'])),
    legVibration: sides('leg.vibration', (v) => segs(v, ['vibration', 'proprioception'])),
    face: sides('face.sensation', (v) => ({ ...segs(v, ['V1', 'V2', 'V3']), ...(typeof v.corneal === 'boolean' ? { corneal: v.corneal } : {}) })),
  };
}
