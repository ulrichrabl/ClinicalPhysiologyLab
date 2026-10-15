/* ---------------------------------------------------------------------------
   Figure front: what only shows from in front of the patient, or from
   behind: the face looking at you, hair round the face or down the back,
   oxygen tubing over both ears, the chest and belly (clavicles, nipples,
   ribs, navel, ascites), the back (spine, shoulder blades), the gown's
   neckline and drape, a bra from the front and the back.

   Everything is placed on the body's own surfaces and projected by the view
   (figure-view.ts), so it sits where the body is, whatever the pose. The
   head uses the head frame of figure-head.ts (a: up from the head-neck
   joint, b: forward, in head cm) with z across the face; the trunk uses its
   stations, with zf as the fraction of the half-width across (−1 the
   patient's right flank, +1 the left).

   The profile drawings (figure-head.ts, figure-dress.ts and the details in
   patient-figure.ts) fade out as the patient turns away from profile and
   these fade in, so a turn shows one face, never two.
--------------------------------------------------------------------------- */

import { clamp, closedPath, darken, f, lerp, lighten, off, openPath, tint, type Pt } from './figure-geom.ts';
import { stationAt, trunkPt, type Shape, type Skeleton } from './figure-body.ts';
import { HEAD_SCALE, hairStyle, headFrame, type Palette } from './figure-head.ts';
import { hull, onTube, type Projector } from './figure-view.ts';
import type { FigureLook } from './patient-figure.ts';

export interface FrontCtx {
  pr: Projector; k: Skeleton; sh: Shape; look: FigureLook;
  pal: Palette & { gown: string; gownLight: string; gownDark: string; gownLine: string };
  back: boolean;                       // seen from behind (turn < 0)
  /* where long hair can fall to (image y), and the head's lying-ness */
  floorY: number;
}

type AZ = [number, number];            // head: a (up), z (across, + patient's left)

/* ---- the head from the front: its outline (the "egg"), ears ---- */

/** Half-width of the head at height a (head cm), and how far forward that widest point sits (b). */
const EGG: Array<[number, number]> = [[19.3, 0], [18.6, 2.6], [17.4, 4.6], [15.6, 6.1], [13.4, 7.0], [11, 7.45], [8.5, 7.5], [6, 7.25], [3.6, 6.7],
  [1.2, 5.9], [-1.0, 4.7], [-2.6, 3.3], [-3.5, 1.7], [-3.8, 0]];

function eggW(c: FrontCtx, a: number, w: number): number {
  const sh = c.sh;
  let x = w;
  if (sh.female && a < 3) x *= 0.96;
  x += 1.5 * sh.soft * clamp(1 - Math.abs(a + 0.5) / 4, 0, 1);           // jowls
  x -= 0.6 * sh.bony * clamp(1 - Math.abs(a - 11) / 2.5, 0, 1);           // hollow temples
  x -= 0.7 * sh.bony * clamp(1 - Math.abs(a - 4) / 2.5, 0, 1);            // hollow cheeks
  return x;
}
const eggB = (a: number) => (a < 2 ? lerp(1, 7.5, (2 - a) / 5.8) : 1);

export function H3(c: FrontCtx, a: number, b: number, z: number): Pt { return c.pr.P(headFrame(c.k)(a, b), z * HEAD_SCALE); }
const Hz = (c: FrontCtx, a: number, z: number) => H3(c, a, eggB(a), z);

/** The head's outline seen from the front or back (part of the head's touch region). */
export function headEgg(c: FrontCtx): Pt[] {
  const right = EGG.map(([a, w]) => Hz(c, a, -eggW(c, a, w)));
  const left = EGG.slice(1, -1).reverse().map(([a, w]) => Hz(c, a, eggW(c, a, w)));
  return [...right, ...left];
}
/** Ears seen from the front: they stand a little away from the head, between brow and nose base. */
export function earsFront(c: FrontCtx): Pt[][] {
  const ear: AZ[] = [[9.6, 7.1], [9.5, 8.2], [8.2, 8.75], [6.2, 8.6], [4.4, 8.1], [3.4, 7.5], [3.7, 6.9]];
  return [-1, 1].map((sg) => ear.map(([a, z]) => H3(c, a, -2, z * sg)));
}

/* ---- drawing helpers ---- */
const P = (pts: Pt[]) => openPath(pts);
function line(out: string[], pts: Pt[], col: string, w: number, op = 1, cap = 'round') {
  out.push(`<path d="${P(pts)}" fill="none" stroke="${col}" stroke-width="${f(w)}" stroke-linecap="${cap}" stroke-linejoin="round" opacity="${f(op)}"/>`);
}
function blob(out: string[], pts: Pt[], fill: string, op = 1, stroke = '', sw = 0) {
  out.push(`<path d="${closedPath(pts)}" fill="${fill}" opacity="${f(op)}"${stroke ? ` stroke="${stroke}" stroke-width="${f(sw)}"` : ''}/>`);
}
function dot(out: string[], p: Pt, rx: number, ry: number, fill: string, op = 1) {
  out.push(`<ellipse cx="${f(p.x)}" cy="${f(p.y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" opacity="${f(op)}"/>`);
}

/* ---- the face ---- */

export function faceFront(c: FrontCtx): string {
  if (c.back) return earDetailFront(c);
  const out: string[] = [], pal = c.pal, b = c.look.body, sh = c.sh;
  const u = c.k.u * HEAD_SCALE;
  const Q = (pts: Array<[number, number, number]>) => pts.map(([a, bb, z]) => H3(c, a, bb, z));
  const distress = { none: 0, mild: 1, moderate: 2, severe: 3 }[b.distress];

  /* shading that gives the face its form: temples and cheeks hollow when wasted, the jaw, jowls, a double chin */
  if (sh.bony > 0.25 || sh.wasted) for (const sg of [-1, 1]) {
    dot(out, H3(c, 11, 6, 6.2 * sg), 1.4 * u, 2.0 * u, pal.dark, 0.25 + 0.2 * sh.bony);
    dot(out, H3(c, 4.6, 7, 4.9 * sg), 1.3 * u, 1.8 * u, pal.dark, 0.18 + 0.15 * sh.bony);
  }
  for (const sg of [-1, 1]) line(out, Q([[0.8, 5, 5.6 * sg], [-1.6, 6, 4.2 * sg], [-3.2, 7.5, 1.8 * sg]]), pal.line, 0.22 * u, sh.bony > 0.3 ? 0.55 : 0.3);
  if (sh.soft > 0.2) line(out, Q([[-3.9, 7, -3.4], [-4.6 - sh.soft, 7, 0], [-3.9, 7, 3.4]]), pal.line, 0.2 * u, 0.45);
  if (c.look.body.colour === 'flushed') for (const sg of [-1, 1]) dot(out, H3(c, 5.2, 8, 4.5 * sg), 1.9 * u, 1.4 * u, pal.blush, 0.2);
  if (sh.old > 0.2) for (const sg of [-1, 1]) line(out, Q([[4.2, 9, 1.9 * sg], [2.6, 9, 2.8 * sg], [1.1, 9, 2.9 * sg]]), pal.line, 0.18 * u, 0.3 + 0.3 * sh.old);

  /* eyes: almond, white (or yellow), an iris looking at the examiner, lash line; distress narrows them */
  const shut = distress >= 2 ? 0.28 : 0;
  for (const sg of [-1, 1]) {
    const E = (a: number, z: number) => H3(c, a, 8.6, z * sg);
    const almond = [E(8.35, 1.75), E(9.0 - shut, 2.6), E(9.05 - shut, 3.5), E(8.6, 4.8), E(7.95 + shut * 0.4, 3.6), E(7.9 + shut * 0.4, 2.5)];
    blob(out, almond, pal.sclera);
    const ic = E(8.42 - shut * 0.2, 3.15);
    dot(out, ic, 0.58 * u, 0.58 * u, '#4a3426');
    dot(out, ic, 0.26 * u, 0.26 * u, '#1d1410');
    dot(out, { x: ic.x - 0.18 * u, y: ic.y - 0.2 * u }, 0.12 * u, 0.12 * u, '#ffffff', 0.85);
    line(out, [E(8.3, 1.6), E(9.05 - shut, 2.5), E(9.1 - shut, 3.5), E(8.65, 4.9)], '#3b2a22', 0.32 * u);
    line(out, [E(8.25, 1.9), E(7.85 + shut * 0.4, 3.0), E(8.4, 4.7)], pal.line, 0.16 * u, 0.6);
    if (sh.old > 0.3) line(out, [E(7.5, 2.2), E(7.15, 3.2), E(7.5, 4.3)], pal.line, 0.14 * u, 0.4);
    /* brow: hair colour; distress pulls the inner end down and in */
    const inner = distress >= 2 ? 9.8 : distress === 1 ? 10.15 : 10.3;
    line(out, [H3(c, inner, 9.4, 1.3 * sg), H3(c, 10.75, 9.2, 3.1 * sg), H3(c, 10.45, 8.2, 5.2 * sg)], c.pal.hairDark, (sh.female ? 0.38 : 0.52) * u, 0.85);
  }
  if (distress >= 2) line(out, Q([[10.9, 9.6, -0.5], [11.6, 9.6, 0], [10.9, 9.6, 0.5]]), pal.line, 0.15 * u, 0.5);

  /* nose: the sides of the bridge, the tip, the wings and nostrils */
  for (const sg of [-1, 1]) {
    line(out, Q([[8.6, 9.6, 1.0 * sg], [6.4, 10.4, 1.05 * sg], [4.9, 11, 1.25 * sg]]), pal.line, 0.16 * u, 0.35);
    line(out, Q([[4.6, 10.6, 1.45 * sg], [4.0, 10.6, 1.85 * sg], [3.55, 10.6, 1.3 * sg]]), pal.line, 0.22 * u, 0.75);
    dot(out, H3(c, 3.7, 11, 0.72 * sg), 0.42 * u, 0.24 * u, darken(pal.dark, 0.3), 0.8);
    if (b.breathing.accessory) line(out, Q([[4.9, 10.6, 1.6 * sg], [4.1, 10.6, 2.1 * sg]]), pal.dark, 0.16 * u, 0.6);
  }
  dot(out, H3(c, 4.3, 12, 0), 0.9 * u, 0.75 * u, pal.light, 0.5);

  /* mouth: the lips; pursed lips push forward into an O, distress parts them */
  const pu = b.breathing.pursedLips ? 0.62 : 1;
  const open = !b.breathing.pursedLips && (distress >= 2 || b.breathing.accessory) ? 1 : 0;
  const M = (a: number, z: number) => H3(c, a, 10.5, z * pu);
  const upper = [M(2.05, -2.3), M(2.45, -1.1), M(2.62, -0.35), M(2.48, 0), M(2.62, 0.35), M(2.45, 1.1), M(2.05, 2.3), M(1.78 + open * 0.15, 1.0), M(1.72 + open * 0.2, 0), M(1.78 + open * 0.15, -1.0)];
  const lower = [M(2.05, -2.3), M(1.72 - open * 0.25, -1.0), M(1.68 - open * 0.3, 0), M(1.72 - open * 0.25, 1.0), M(2.05, 2.3), M(1.35 - open * 0.2, 1.55), M(0.95 - open * 0.2, 0), M(1.35 - open * 0.2, -1.55)];
  if (open) blob(out, [M(1.95, -1.6), M(1.95, 1.6), M(1.4, 1.2), M(1.35, -1.2)], '#4a2a26');
  blob(out, upper, pal.lip); blob(out, lower, lighten(pal.lip, 0.06));
  line(out, [M(2.02, -2.25), M(1.75 + open * 0.15, -0.9), M(1.7 + open * 0.15, 0), M(1.75 + open * 0.15, 0.9), M(2.02, 2.25)], pal.lipLine, 0.2 * u, 0.9);
  if (b.breathing.pursedLips) dot(out, M(1.72, 0), 0.38 * u, 0.3 * u, '#4a2a26');
  line(out, Q([[1.2, 9.6, 0.5], [0.6, 9.4, 0], [1.2, 9.6, -0.5]]), pal.line, 0.14 * u, 0.35);   // under the lower lip

  /* sweat: a few highlights on the forehead, temples and upper lip */
  if (b.sweating) for (const [a, z, r] of [[13.4, -1.6, 0.42], [12.6, 2.3, 0.36], [14.3, 0.8, 0.3], [10.8, -5.9, 0.3], [10.6, 5.8, 0.28], [3.1, 1.3, 0.24]] as Array<[number, number, number]>) {
    dot(out, H3(c, a, 9, z), r * u, r * 1.3 * u, '#ffffff', 0.75);
  }
  out.push(earDetailFront(c));
  return `<g class="face-front" pointer-events="none">${out.join('')}</g>`;
}

/** The fold inside each ear, seen from in front or behind. */
function earDetailFront(c: FrontCtx): string {
  const out: string[] = [], u = c.k.u * HEAD_SCALE;
  for (const sg of [-1, 1]) line(out, [H3(c, 8.8, -2, 8.1 * sg), H3(c, 7.4, -2, 8.3 * sg), H3(c, 5.4, -2, 8.0 * sg), H3(c, 4.6, -2, 7.6 * sg)], c.pal.line, 0.2 * u, 0.6);
  return `<g pointer-events="none">${out.join('')}</g>`;
}

/* ---- hair from the front and from behind ---- */

/** Hair that lies behind the head: long hair spread on the pillow round the head of a patient seen from above. */
export function hairBehindFront(c: FrontCtx): string {
  const st = hairStyle(c.look.hairText, c.look.sex);
  if (!st.curtain && !st.bob) return '';
  const g = c.pr.vec({ x: 0, y: 1 }), hang = Math.min(1, Math.hypot(g.x, g.y));
  if (hang > 0.6) return '';
  const spread = (st.curtain ? st.len * 0.45 : 3) * (1 - hang);
  const pts: Pt[] = [];
  for (const [a, w] of EGG) if (a > -2) pts.push(Hz(c, a + spread * 0.5, -(eggW(c, a, w) + spread * (a > 4 ? 1 : 0.6))));
  for (const [a, w] of [...EGG].reverse()) if (a > -2 && w > 0) pts.push(Hz(c, a + spread * 0.5, eggW(c, a, w) + spread * (a > 4 ? 1 : 0.6)));
  const out: string[] = [];
  blob(out, pts, c.pal.hairDark, 1, c.pal.hairDark, 0.4);
  const u = c.k.u * HEAD_SCALE;
  for (const sg of [-1, 1]) for (const k of [0.4, 0.75]) line(out, [Hz(c, 14, sg * 6), Hz(c, 12 + spread * 0.4, sg * (7.5 + spread * k))], c.pal.hair, 0.4 * u, 0.6);
  return `<g pointer-events="none">${out.join('')}</g>`;
}

/** Hair on the head, seen from the front (framing the face) or from behind (covering the back of the head). */
export function hairFront3(c: FrontCtx): string {
  const st = hairStyle(c.look.hairText, c.look.sex);
  const pal = c.pal, u = c.k.u * HEAD_SCALE, out: string[] = [];
  const vol = st.volume * (st.thin ? 0.6 : 1) * (st.messy ? 1.25 : 1);
  /* the outer edge: the skull from one side over the crown to the other, lifted by the hair's volume */
  const lowest = st.bald ? 4 : st.bob ? -1 : st.curtain ? 0.5 : c.back ? 1.5 : 7.6;
  const ring = EGG.filter(([a]) => a >= lowest);
  const bump = (i: number) => (st.curls ? (st.curls === 2 ? 0.45 : 0.75) * Math.abs(Math.sin(i * 1.7)) : 0) + (st.messy ? 0.6 * Math.abs(Math.sin(i * 2.3 + 1)) : 0);
  const outerR = ring.map(([a, w], i) => Hz(c, a + vol * 0.55 * (a > 15 ? 1 : 0.3), -(eggW(c, a, w) + vol * (0.5 + 0.5 * clamp((a - 4) / 10, 0, 1)) + bump(i))));
  const outerL = [...ring].reverse().map(([a, w], i) => Hz(c, a + vol * 0.55 * (a > 15 ? 1 : 0.3), eggW(c, a, w) + vol * (0.5 + 0.5 * clamp((a - 4) / 10, 0, 1)) + bump(i + 3)));
  const crown = Hz(c, 19.3 + vol * 0.6, 0);
  let shape: Pt[];
  if (c.back) {
    /* from behind the hair covers the back of the head down to the nape (or a fringe round it when bald) */
    const nape: AZ[] = st.bob ? [[-1, 6.4], [-1.6, 0], [-1, -6.4]] : st.curtain ? [[0.4, 6.6], [-0.4, 0], [0.4, -6.6]] : [[2.4, 5.6], [1.2, 2.6], [1.0, 0], [1.2, -2.6], [2.4, -5.6]];
    if (st.bald) {
      const fringe: AZ[] = [[9.2, -7.6], [7.6, -6.6], [5.8, -4.8], [5.0, 0], [5.8, 4.8], [7.6, 6.6], [9.2, 7.6], [7, 7.9], [4, 6.6], [3, 0], [4, -6.6], [7, -7.9]];
      shape = fringe.map(([a, z]) => H3(c, a, -8, z));
    } else shape = [...[...outerR].reverse(), crown, ...[...outerL].reverse(), ...nape.map(([a, z]) => H3(c, a, -9, z))];
  } else {
    /* from the front, the hairline frames the forehead; receding moves it back at the temples, bald leaves only the sides */
    const line0: AZ[] = st.bald ? [[11.6, 7.0], [9.8, 7.4], [8.2, 7.5]]
      : st.recede ? [[9.8, 7.2], [11.8, 6.7], [15.0, 5.3], [15.4, 3.6], [14.7, 1.6], [14.6, 0]]
        : [[10.2, 6.9], [11.2, 6.0], [12.8, 4.6], [13.6, 2.5], [13.8, 0]];
    const hairline = [...line0, ...[...line0].reverse().slice(1).map(([a, z]) => [a, -z] as AZ)];
    const sideDown: AZ[] = st.bob ? [[6, 7.1], [2, 6.7], [-0.8, 6.4]] : st.curtain ? [[6, 7.2], [2.6, 6.9], [0.6, 6.7]] : [[8.8, 7.35]];
    const inner = [...sideDown.slice().reverse().map(([a, z]) => [a, -z] as AZ), ...hairline.slice().reverse(), ...sideDown]
      .map(([a, z]) => H3(c, a, 8, z));
    if (st.bald) {
      /* tufts over the ears only */
      for (const sg of [-1, 1]) blob(out, [Hz(c, 11.8, 7.5 * sg), Hz(c, 9.6, (8.1 + vol * 0.5) * sg), Hz(c, 7.4, (7.9 + vol * 0.4) * sg), Hz(c, 7.6, 7.2 * sg), Hz(c, 10, 7.0 * sg)], pal.hair, 0.9, pal.hairDark, 0.3 * u);
      return `<g class="hair-front" pointer-events="none">${out.join('')}</g>`;
    }
    /* right side from below up over the crown, down the left side, then back along the hairline */
    shape = [...[...outerR].reverse(), crown, ...[...outerL].reverse(), ...[...inner].reverse()];
  }
  if (st.thin && !st.bob && !c.back) {
    blob(out, shape, pal.hair, 0.42);
    for (const sg of [-1, 1]) blob(out, [Hz(c, 12, 7.3 * sg), Hz(c, 10, (7.9 + vol * 0.5) * sg), Hz(c, 8.2, (7.8 + vol * 0.3) * sg), Hz(c, 8.6, 7.2 * sg), Hz(c, 10.6, 6.8 * sg)], pal.hair, 1, pal.hairDark, 0.3 * u);
  } else blob(out, shape, pal.hair, st.thin ? 0.75 : 1, pal.hairDark, 0.35 * u);
  /* fine strands, light from the upper left: they sweep from a parting over to each side, as hair lies */
  const part = st.curtain || st.bob || c.look.sex === 'F' ? 0.8 : 1.8;
  for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const strandPts = c.back
      ? [Hz(c, 18.4 + vol * 0.3 - t * 2, sg * (0.6 + t * 2)), Hz(c, 12 - t * 2, sg * (3.4 + t * 2.4)), Hz(c, 4.5 - t, sg * (4.2 + t * 2.6))]
      : [Hz(c, 18.2 + vol * 0.35 - t * 1.6, sg * (part + t * 1.5)), Hz(c, 16.4 - t * 2.4, sg * (4.4 + t * 1.6)), Hz(c, 13.4 - t * 3.2, sg * (6.4 + t * 0.9 + vol * 0.3))];
    line(out, strandPts, i % 2 ? pal.hairLight : pal.hairDark, 0.16 * u, st.thin ? 0.3 : 0.45);
  }
  if (!c.back && !st.bald && (st.curtain || st.bob || c.look.sex === 'F')) line(out, [Hz(c, 18.9 + vol * 0.4, part), Hz(c, 15.6, part * 0.9)], pal.hairDark, 0.22 * u, 0.6);
  /* long hair falls down onto the shoulders (upright) or past the ears onto the pillow (lying, seen from above) */
  if (st.curtain) {
    const g = c.pr.vec({ x: 0, y: 1 }), hang = Math.min(1, Math.hypot(g.x, g.y));
    if (hang > 0.3) for (const sg of [-1, 1]) {
      const fall = (a: number, z: number, len: number) => {
        const pts: Pt[] = [Hz(c, a, z * sg)];
        let p = pts[0];
        const n = 8, step = (len * u) / n;
        for (let i = 0; i < n; i++) { p = { x: p.x + g.x * step + (c.pr.zv.x * sg * 0.12 * step) / (c.k.u || 1), y: p.y + g.y * step }; pts.push(p); }
        return pts;
      };
      const len = st.len * hang * (c.back ? 0.55 : 1);
      const outer = fall(2, 8.6 + vol * 0.4, len), innerS = fall(-0.5, 6.2, len - 2);
      blob(out, [...outer, ...innerS.reverse()], pal.hair, 1, pal.hairDark, 0.35 * u);
      line(out, fall(1, 7.4, len - 1), pal.hairDark, 0.2 * u, 0.5);
    }
  }
  if (c.back && st.tail !== 'none') {
    const root = H3(c, 9.4, -11, 0), g = c.pr.vec({ x: 0, y: 1 });
    const pts = [root, { x: root.x + g.x * 6 * u, y: root.y + g.y * 6 * u }, { x: root.x + g.x * 13 * u, y: root.y + g.y * 13 * u }];
    line(out, pts, pal.hairDark, (st.tail === 'plait' ? 3.4 : 4.2) * u);
    out.push(`<path d="${P(pts)}" fill="none" stroke="${pal.hair}" stroke-width="${f((st.tail === 'plait' ? 2.4 : 3.0) * u)}" stroke-linecap="round"${st.tail === 'plait' ? ` stroke-dasharray="${f(1.3 * u)} ${f(0.5 * u)}"` : ''}/>`);
  }
  if (c.back && st.bun) { const b = H3(c, 12.5, -11.3, 0); dot(out, b, 3.0 * u, 3.0 * u, pal.hair); line(out, [{ x: b.x - 2 * u, y: b.y }, { x: b.x + 2 * u, y: b.y + 0.4 * u }], pal.hairDark, 0.2 * u, 0.6); }
  return `<g class="hair-front" pointer-events="none">${out.join('')}</g>`;
}

/* ---- oxygen, from the front ---- */

export function oxygenFront(c: FrontCtx, chest: Pt): string {
  const dev = (c.look.oxygen ?? '').toLowerCase();
  if (!dev || c.back) return '';
  const u = c.k.u * HEAD_SCALE, out: string[] = [];
  const tube = '#d9ece7', edge = '#8fb2aa';
  const t = (pts: Pt[], w: number) => { line(out, pts, edge, (w + 0.35) * u); line(out, pts, tube, w * u); };
  const Q = (pts: Array<[number, number, number]>) => pts.map(([a, b, z]) => H3(c, a, b, z));
  if (/mask|venturi|rebreath/.test(dev)) {
    const mask = Q([[9.1, 10, 0], [8.2, 10, 2.6], [5.4, 9.6, 4.6], [1.0, 9.6, 4.6], [-2.4, 10, 3.0], [-3.6, 10.4, 0], [-2.4, 10, -3.0], [1.0, 9.6, -4.6], [5.4, 9.6, -4.6], [8.2, 10, -2.6]]);
    for (const sg of [-1, 1]) line(out, Q([[5.4, 9, 4.6 * sg], [6.4, 0, 7.8 * sg], [7.2, -6, 7.6 * sg]]), '#7d9b95', 0.3 * u);
    blob(out, hull(mask), '#e6f3f0', 0.55, edge, 0.3 * u);
    line(out, Q([[6.6, 10, -2.6], [7.6, 10, 0], [6.6, 10, 2.6]]), '#ffffff', 0.35 * u, 0.8);
    const base = H3(c, -3.4, 10.4, 0);
    t([base, { x: base.x + 2 * u, y: Math.max(base.y, chest.y) + 6 * u }, chest], 1.1);
    if (/rebreath|reservoir/.test(dev)) dot(out, { x: base.x + 3 * u, y: base.y + 9 * u }, 3.0 * u, 4.2 * u, '#cfe6d8', 0.8);
  } else {
    for (const sg of [-1, 1]) t(Q([[3.8, 11, 0.7 * sg], [4.1, 10, 2.4 * sg], [5.6, 8, 5.4 * sg], [8.6, 2, 7.9 * sg], [8.6, -3, 8.2 * sg], [4.2, -3, 8.3 * sg], [0.2, 2, 6.2 * sg], [-3.6, 6, 2.0 * sg], [-4.6, 6, 0]]), 0.7);
    const join = H3(c, -4.6, 6, 0);
    t([join, { x: join.x + 1.5 * u, y: Math.max(join.y, chest.y) + 5 * u }, chest], 0.7);
    for (const sg of [-1, 1]) dot(out, H3(c, 3.8, 11, 0.7 * sg), 0.5 * u, 0.5 * u, tube);
  }
  return `<g class="oxygen" pointer-events="none">${out.join('')}</g>`;
}

/* ---- the trunk, front and back ---- */

/** A point on the trunk's front (or back) surface: station s, zf across (−1 … 1 of the half-width), pushed out by dr. */
export function Tf(c: FrontCtx, s: number, zf: number, dr = 0, back = c.back): Pt {
  const t = stationAt(c.sh.trunk, s), rn = (t.a + t.p) / 2 + dr, cc = (t.a - t.p) / 2, w = (t.w ?? rn) + dr;
  const z = clamp(zf, -1, 1), r = Math.sqrt(Math.max(0, 1 - z * z));
  return c.pr.P(trunkPt(c.k, s, cc + (back ? -1 : 1) * rn * r), w * z);
}
/** A point on the front of the neck. */
function Nf(c: FrontCtx, s: number, zf: number): Pt {
  const st = stationAt(c.sh.neck, s), rn = (st.a + st.p) / 2, cc = (st.a - st.p) / 2, w = st.w ?? rn;
  const r = Math.sqrt(Math.max(0, 1 - zf * zf)) * (c.back ? -1 : 1);
  return c.pr.P(off(c.k.neckRoot, c.k.neckA, s * c.k.u, (cc + rn * r) * c.k.u * -c.k.flip), w * zf);
}

export function trunkFront(c: FrontCtx): string {
  const out: string[] = [], pal = c.pal, sh = c.sh, b = c.look.body, u = c.k.u;
  const ex = c.look.exposed, chestBare = ex.has('chest'), abdoBare = ex.has('abdomen');
  const T = (s: number, zf: number, dr = 0) => Tf(c, s, zf, dr);
  const both = (fn: (sg: number) => void) => { fn(-1); fn(1); };
  if (c.back) {
    if (chestBare || abdoBare) {
      /* the spine, the shoulder blades, and the back's soft folds */
      const bon = 0.3 + 0.5 * sh.bony;
      const spine: Pt[] = []; for (let s = 55; s >= 2; s -= 3) spine.push(T(s, 0));
      line(out, spine, pal.line, 0.5, 0.25 + 0.2 * sh.bony);
      for (let s = 54; s >= 22; s -= 3.2) dot(out, T(s, 0), 0.55 * u * (0.5 + sh.bony), 0.4 * u, pal.dark, 0.18 + 0.35 * sh.bony);
      both((sg) => {
        const zS = (z: number) => (z * sg) / (stationAt(sh.trunk, 40).w ?? 15);
        line(out, [T(48, zS(5.2)), T(41, zS(5.6)), T(34, zS(7.6)), T(37.5, zS(11.5)), T(46.5, zS(13.6))], pal.line, 0.6, bon);   // medial and lateral borders
        line(out, [T(46.5, zS(5.6)), T(48.4, zS(10)), T(49.5, zS(14.6))], pal.line, 0.7, bon * 0.9);                           // spine of the scapula
        dot(out, T(40, zS(9.5)), 3.2 * u, 4.6 * u, pal.light, 0.18);
        line(out, [T(44, zS(15.2)), T(37, zS(14.4))], pal.line, 0.5, 0.35);                                                   // posterior axillary fold
        if (sh.soft > 0.2) line(out, [T(21, zS(9)), T(19.5, zS(13.5)), T(20.5, zS(16))], pal.line, 0.6, 0.45);
        if (sh.female || sh.old < 0.5) dot(out, T(1.5, zS(4.2)), 0.7 * u, 0.5 * u, pal.dark, 0.3);                           // dimples of Venus
        if (sh.bony > 0.3) for (let i = 0; i < 4; i++) line(out, [T(30 - i * 3.6, zS(4)), T(29 - i * 3.6, zS(10)), T(27.5 - i * 3.6, zS(14))], pal.line, 0.5, 0.25 * sh.bony + 0.1);
      });
      if (b.sweating) for (const [s, z] of [[42, -0.3], [36, 0.35], [28, -0.15]]) dot(out, T(s, z), 0.35 * u, 0.5 * u, '#ffffff', 0.65);
    }
    return `<g pointer-events="none">${out.join('')}</g>`;
  }
  if (chestBare) {
    /* clavicles and the notch between them; the hollows above them when the neck muscles work or the patient is thin */
    both((sg) => line(out, [T(53.3, 0.1 * sg), T(52.9, 0.42 * sg), T(52.2, 0.72 * sg), T(51.2, (c.sh.shoulderZ - 1) / 16 * sg)], pal.line, 0.7 + 0.5 * sh.bony, 0.35 + 0.35 * sh.bony));
    dot(out, T(53.6, 0), 1.0 * u, 0.6 * u, pal.dark, 0.35);
    if (b.breathing.accessory || sh.bony > 0.4) both((sg) => dot(out, T(52.4, 0.42 * sg), 2.0 * u, 0.9 * u, pal.dark, 0.3));
    /* chest: men's pectoral edge and nipples; women wear a bra (bodyBra) */
    if (!sh.female) both((sg) => {
      line(out, [T(37, 0.12 * sg), T(36.4, 0.4 * sg), T(37.8, 0.75 * sg), T(42, 0.92 * sg)], pal.line, 0.6, 0.3 + 0.2 * (1 - sh.soft));
      dot(out, T(38.5, 0.6 * sg), 0.9 * u, 0.85 * u, tint(pal.lip, pal.dark, 0.4), 0.8);
    });
    /* ribs and the costal margin show in the thin and the hyperinflated */
    if (sh.bony > 0.25 || sh.barrel) both((sg) => {
      for (let i = 0; i < 4; i++) { const s = 34 - i * 2.8; line(out, [T(s + 0.4, 0.42 * sg), T(s - 1.0, 0.68 * sg), T(s - 2.6, 0.92 * sg)], pal.line, 0.55, 0.15 + 0.35 * sh.bony); }
      line(out, [T(30.5, 0.03 * sg), T(27, 0.35 * sg), T(24, 0.7 * sg), T(23, 0.92 * sg)], pal.line, 0.6, 0.2 + 0.35 * sh.bony);
    });
    /* axillary folds where the arms meet the chest */
    both((sg) => line(out, [T(45, 0.96 * sg), T(41, 0.93 * sg)], pal.line, 0.5, 0.35));
    if (b.sweating) for (const [s, z] of [[42, -0.3], [36, 0.25], [45, 0.05]]) dot(out, T(s, z), 0.35 * u, 0.5 * u, '#ffffff', 0.7);
  }
  /* the neck: sternomastoids when the accessory muscles work, or in the wasted */
  if (b.breathing.accessory || sh.bony > 0.4) both((sg) => line(out, [Nf(c, 11, 0.75 * sg), Nf(c, 5, 0.5 * sg), Nf(c, -1.5, 0.18 * sg)], pal.line, 0.9, 0.7));
  if (abdoBare) {
    const ns = sh.navelS;
    if (sh.ascites >= 3) blob(out, ring(T(ns, 0, 0.4), 1.0 * u), pal.skin, 1, pal.line, 0.7);
    else dot(out, T(ns, 0), 0.7 * u, 1.0 * u, pal.dark, 0.7);
    if (sh.bony > 0.3) line(out, [T(30, 0), T(14, 0)], pal.line, 0.5, 0.3);                     // linea alba
    if (sh.ascites >= 2) line(out, [T(24, -0.25), T(16, -0.42), T(8, -0.28)], '#ffffff', 1.6, 0.4);   // the shine of a tense belly
    if (sh.ascites >= 1) both((sg) => line(out, [T(25, 0.82 * sg), T(15, 0.9 * sg), T(6, 0.82 * sg)], pal.line, 0.6, 0.35));
    if (sh.bony > 0.3) both((sg) => line(out, [T(8, 0.7 * sg), T(6, 0.86 * sg), T(4.5, 0.95 * sg)], pal.line, 0.8, 0.3 + 0.3 * sh.bony));   // iliac crests
    if (sh.soft > 0.2 && !sh.ascites) line(out, [T(5, -0.75), T(3.6, -0.3), T(3.3, 0), T(3.6, 0.3), T(5, 0.75)], pal.line, 0.7, 0.5);    // the apron fold
    if (b.sweating) dot(out, T(18, 0.2), 0.35 * u, 0.5 * u, '#ffffff', 0.65);
  }
  return `<g pointer-events="none">${out.join('')}</g>`;
}
const ring = (c: Pt, r: number): Pt[] => Array.from({ length: 10 }, (_, i) => ({ x: c.x + Math.cos((i / 10) * Math.PI * 2) * r, y: c.y + Math.sin((i / 10) * Math.PI * 2) * r }));

/** A plain bra seen from the front or the back. */
export function braFront(c: FrontCtx): string {
  if (!c.sh.breast) return '';
  const out: string[] = [], col = '#e9e1d8', ln = '#bcae9f';
  const T = (s: number, zf: number, dr = 0.35) => Tf(c, s, zf, dr);
  const band: Pt[] = [];
  for (let z = -1; z <= 1.001; z += 0.2) band.push(T(32.6, z));
  for (let z = 1; z >= -1.001; z -= 0.2) band.push(T(34.0, z));
  if (c.back) {
    blob(out, band, col, 1, ln, 0.6);
    for (const sg of [-1, 1]) { const strap = [T(34, 0.5 * sg), T(42, 0.55 * sg), T(50, 0.6 * sg)]; line(out, strap, ln, 2.2); line(out, strap, col, 1.3); }
    return `<g pointer-events="none">${out.join('')}</g>`;
  }
  blob(out, band, col, 1, ln, 0.6);
  for (const sg of [-1, 1]) {
    const cup = [T(33.4, 0.1 * sg), T(32.6, 0.42 * sg), T(33.8, 0.8 * sg), T(37.8, 0.9 * sg), T(41.2, 0.62 * sg), T(40.6, 0.4 * sg), T(37.8, 0.16 * sg)];
    blob(out, cup, col, 1, ln, 0.7);
    line(out, [T(37.6, 0.28 * sg), T(36.4, 0.5 * sg), T(36.6, 0.72 * sg)], ln, 0.4, 0.5);
    const strap = [T(41.2, 0.6 * sg), T(46, 0.58 * sg), T(51, 0.6 * sg)];
    line(out, strap, ln, 2.2); line(out, strap, col, 1.3);
  }
  return `<g pointer-events="none">${out.join('')}</g>`;
}

/** The gown's edges and drape seen from the front or back: neckline, rolled edges where it is pushed up or down,
    long folds, the hem on the thighs. */
export function gownLinesFront(c: FrontCtx, spans: Array<[number, number]>, hem: { thigh: (i: 0 | 1, s: number, psi: number) => { p: Pt; vis: number } } | null): string {
  const out: string[] = [], pal = c.pal;
  const T = (s: number, zf: number) => Tf(c, s, zf, 1.1);
  const across = (s: number, dz = 0.2, sw = (z: number) => s) => { const pts: Pt[] = []; for (let z = -1; z <= 1.001; z += dz) pts.push(T(sw(z), z)); return pts; };
  for (const [s0, s1] of spans) {
    const lo = Math.max(s0, -10), hi = Math.min(s1, 53);
    if (s1 >= 55 && !c.back) line(out, across(55, 0.1, (z) => 55.2 - 2.4 * (1 - z * z) * (Math.abs(z) < 0.6 ? 1 : 0.6)).slice(2, -2), pal.gownLine, 1, 0.8);
    if (s1 >= 55 && c.back) line(out, across(55.4, 0.1).slice(3, -3), pal.gownLine, 1, 0.8);
    if (s1 < 55) { line(out, across(s1), pal.gownDark, 2.2); line(out, across(s1 - 0.6), pal.gownLight, 0.9); }
    if (s0 > -99) line(out, across(s0), pal.gownDark, 2.2);
    if (hi - lo > 18) for (const z of [-0.62, -0.25, 0.18, 0.55]) line(out, [T(hi - 3, z * 0.8), T((hi + lo) / 2, z + 0.04), T(lo + 3, z * 1.08)], pal.gownLine, 0.8, 0.4);
  }
  if (hem) for (const i of [0, 1] as const) {
    const pts: Pt[] = [];
    for (let psi = -90; psi <= 90; psi += 30) pts.push(hem.thigh(i, 26.3, c.back ? 180 - psi : psi).p);
    line(out, pts, pal.gownLine, 1.1, 0.9);
  }
  return `<g pointer-events="none">${out.join('')}</g>`;
}

export { onTube };
