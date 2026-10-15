/* ---------------------------------------------------------------------------
   Figure head: the head in profile, its face, its hair and the oxygen on it.

   The head is drawn in its own frame: a runs up from the head–neck joint
   toward the crown, b runs forward toward the face (reference cm). The
   profile is an egg, longer than deep, with the face's landmarks where
   they sit on a real skull: brow ridge over the eye, nose, lips, chin, the
   jaw angle in front of the ear, the ear between brow and nose base.

   Hair is read from the case's own words. Short styles hug the skull; long
   hair, plaits and ponytails hang with gravity (strands are stepped down
   toward the floor and stop on the pillow), so the same hair falls down the
   back when sitting and fans over the pillow when lying. Baldness is drawn
   only when the text says receding, thinning or bald.
--------------------------------------------------------------------------- */

import { closedPath, f, off, openPath, type Pt } from './figure-geom.ts';
import type { Shape, Skeleton } from './figure-body.ts';
import type { FigureLook } from './patient-figure.ts';

export interface Palette {
  skin: string; light: string; dark: string; line: string; far: string; farDark: string;
  lip: string; lipLine: string; nail: string; sclera: string; blush: string;
  hair: string; hairDark: string; hairLight: string;
}
/** The surface under the head that hair rests on: a point on it and its normal, pointing up into the air. */
export interface Support { p: Pt; n: Pt }
export interface HeadCtx { k: Skeleton; sh: Shape; look: FigureLook; pal: Palette; support: Support }

export const HEAD_SCALE = 1.06;   // a touch larger than life: 7.5 heads tall, and the face reads at 190 px

type AB = [number, number];

/* The skull from the forehead over the crown to the nape; hair is built on it. */
const SKULL: AB[] = [[14.6, 9.2], [16.6, 7.6], [18.3, 5.0], [19.2, 1.6], [19.0, -1.8], [17.6, -5.0], [15.2, -7.6], [12.0, -9.5], [8.4, -10.1], [5.0, -9.6], [2.2, -8.2], [0.2, -6.0]];

function faceProfile(look: FigureLook, sh: Shape): AB[] {
  const F = sh.female ? 1 : 0, o = sh.old, s = sh.soft, w = sh.wasted || sh.bony > 0.4 ? 1 : 0;
  const purse = look.body.breathing.pursedLips ? 0.7 : 0;
  return [
    [12.2, 9.9 - 0.2 * F], [10.6, 10.3 - 0.4 * F], [9.4, 9.7 - 0.2 * F],                       // forehead, brow ridge, nasion
    [7.3, 10.9 - 0.2 * F], [5.4, 11.9 - 0.3 * F + 0.2 * o], [4.4, 12.6 - 0.4 * F + 0.3 * o], [3.7, 11.9 - 0.3 * F], [3.4, 10.7],  // nose
    [2.6, 11.0 + purse], [1.75, 10.5 + purse * 1.2], [0.9, 10.7 + purse * 0.9 - 0.2 * o], [-0.4, 9.8 - 0.2 * w],        // lips, sulcus
    [-1.7, 10.0 - 0.4 * F], [-3.2, 9.1 - 0.3 * F],                                              // chin
    [-4.0 - 1.3 * s, 7.0 - 0.3 * s], [-3.8 - 2.2 * s, 4.0], [-2.4 - 1.2 * s, 1.6 - 0.4 * s],                 // under the jaw (double chin)
    [-1.4, -2.5], [-0.3, -5.2],
  ];
}

export function headFrame(k: Skeleton) {
  const s = k.u * HEAD_SCALE;
  return (a: number, b: number): Pt => off(k.headJoint, k.headA, a * s, -b * s * k.flip);
}

export function headOutline(c: HeadCtx): Pt[] {
  const H = headFrame(c.k);
  return [...faceProfile(c.look, c.sh), ...[...SKULL].reverse()].map(([a, b]) => H(a, b));
}

/* ---- hair ---- */

interface HairStyle { len: number; curtain: boolean; bob: boolean; tail: 'none' | 'pony' | 'plait'; bun: boolean; braids: boolean; curls: number; messy: boolean; recede: number; thin: boolean; bald: boolean; volume: number }

export function hairStyle(text: string, sex: 'F' | 'M'): HairStyle {
  const t = text.toLowerCase();
  const long = /\blong\b/.test(t), shoulder = /shoulder/.test(t), bob = /\bbob\b/.test(t);
  const tied = /tied|pony/.test(t), bun = /\bbun\b/.test(t) || (tied && /braid|plait/.test(t)), braids = /braid|plait/.test(t);
  const curls = /curl/.test(t) ? (/short/.test(t) ? 2 : 1) : 0;
  return {
    len: tied || bun ? 0 : long ? 30 : shoulder ? 15 : 0,
    curtain: !tied && !bun && (long || shoulder), bob, bun,
    tail: tied && !bun ? (braids ? 'plait' : 'pony') : 'none', braids,
    curls, messy: /unkempt|messy|untidy/.test(t),
    recede: /reced/.test(t) ? 1 : 0, thin: /thin/.test(t), bald: /\bbald/.test(t),
    volume: (curls === 1 ? 1.9 : curls === 2 ? 1.3 : /short|crop/.test(t) ? 0.8 : sex === 'F' || bob || long || shoulder ? 1.4 : 1.0),
  };
}

/** A hair strand hanging from `root`: it leaves along `d0` and bends toward the floor, keeps off the skull, and
    slides along the support (pillow, backrest) instead of passing through it. */
export function strand(root: Pt, d0: Pt, len: number, step: number, sup: Support, avoid: { c: Pt; r: number }): Pt[] {
  const pts = [root];
  let p = root, d = d0, rest = 0;
  const n = Math.max(2, Math.round(len / step));
  for (let i = 0; i < n; i++) {
    d = { x: d.x * 0.8, y: d.y * 0.8 + 0.32 };
    const m = Math.hypot(d.x, d.y) || 1; d = { x: d.x / m, y: d.y / m };
    let q = { x: p.x + d.x * step, y: p.y + d.y * step };
    const dx = q.x - avoid.c.x, dy = q.y - avoid.c.y, r = Math.hypot(dx, dy);
    if (r < avoid.r) q = { x: avoid.c.x + (dx / r) * avoid.r, y: avoid.c.y + (dy / r) * avoid.r };
    const below = (q.x - sup.p.x) * sup.n.x + (q.y - sup.p.y) * sup.n.y;
    if (below < 0) {
      q = { x: q.x - sup.n.x * below, y: q.y - sup.n.y * below };
      /* slide along the surface, downhill or away from the head, losing speed */
      const t = { x: -sup.n.y, y: sup.n.x }, dot = d.x * t.x + d.y * t.y;
      d = dot >= 0 ? t : { x: -t.x, y: -t.y };
      if (++rest > 3) { pts.push(q); break; }
    }
    pts.push(q); p = q;
  }
  return pts;
}

/** Hair that hangs behind the head and body (drawn before them). */
export function hairBehind(c: HeadCtx): string {
  const st = hairStyle(c.look.hairText, c.look.sex);
  const H = headFrame(c.k), u = c.k.u * HEAD_SCALE, pal = c.pal;
  const avoid = { c: H(8.5, -0.5), r: 9.6 * u };
  const out: string[] = [];
  if (st.curtain) {
    /* The mass of long hair: an outer strand from the crown and an inner one from behind the ear, both falling. */
    const back = H(15.5, -9.2), nape = H(4, -10.6);
    const dirOf = (a: Pt, b: Pt) => { const m = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / m, y: (b.y - a.y) / m }; };
    const outer = strand(nape, dirOf(back, nape), st.len * u, 2.2 * u, c.support, avoid);
    const inner = strand(H(5, -3.5), dirOf(H(9, -2.5), H(5, -3.5)), (st.len - 3) * u, 2.2 * u, c.support, { c: avoid.c, r: avoid.r * 0.75 });
    const body = [H(18.5, -4), back, ...outer, ...inner.reverse(), H(9, -2)];
    out.push(`<path d="${closedPath(body)}" fill="${pal.hairDark}" stroke="${pal.hairDark}" stroke-width="${f(0.8 * u)}" stroke-linejoin="round"/>`);
    /* Lying with the head on a pillow, long hair fans out over it beyond the crown. */
    const lyingHead = Math.abs(Math.sin((c.k.headA * Math.PI) / 180)) < 0.6 && c.support.n.y < -0.9;
    if (lyingHead) {
      const t0 = { x: -c.support.n.y, y: c.support.n.x }, up = { x: H(1, 0).x - H(0, 0).x, y: H(1, 0).y - H(0, 0).y };
      const t = t0.x * up.x + t0.y * up.y >= 0 ? t0 : { x: -t0.x, y: -t0.y };
      const occ = H(8, -10.6);
      const below = (occ.x - c.support.p.x) * c.support.n.x + (occ.y - c.support.p.y) * c.support.n.y;
      const base = { x: occ.x - c.support.n.x * below, y: occ.y - c.support.n.y * below };
      const at = (along: number, lift: number) => ({ x: base.x + t.x * along * u - c.support.n.x * -lift * u, y: base.y + t.y * along * u - c.support.n.y * -lift * u });
      const L = Math.min(st.len, 22);
      const fan = [H(17.5, -5), at(L * 0.55, 1.6), at(L * 0.75, 0.4), at(L * 0.6, -0.4), at(-2, -0.4), at(-5, 0.6), H(1, -8)];
      out.push(`<path d="${closedPath(fan)}" fill="${pal.hairDark}"/>`);
      out.push(`<path d="${openPath([H(16, -8), at(L * 0.45, 1.0), at(L * 0.68, 0.3)])}" fill="none" stroke="${pal.hair}" stroke-width="${f(0.4 * u)}" opacity=".6"/>`);
    }
    for (let i = 0; i < (lyingHead ? 0 : 4); i++) {
      const sOut = strand(H(15 - i * 2.5, -9.6 + i * 1.6), dirOf(back, nape), (st.len - 2 - i * 3) * u, 2.2 * u, c.support, avoid);
      out.push(`<path d="${openPath(sOut)}" fill="none" stroke="${pal.hair}" stroke-width="${f(0.45 * u)}" stroke-linecap="round" opacity=".55"/>`);
    }
  }
  if (st.tail !== 'none') {
    /* A ponytail or plait gathered at the back of the head, hanging. */
    const root = H(9.5, -10.9);
    const t = strand(root, { x: (root.x - H(9.5, 0).x) / (10.9 * u), y: (root.y - H(9.5, 0).y) / (10.9 * u) }, 16 * u, 2 * u, c.support, avoid);
    out.push(`<path d="${openPath(t)}" fill="none" stroke="${pal.hairDark}" stroke-width="${f((st.tail === 'plait' ? 3.4 : 4.2) * u)}" stroke-linecap="round"/>`);
    out.push(`<path d="${openPath(t)}" fill="none" stroke="${pal.hair}" stroke-width="${f((st.tail === 'plait' ? 2.4 : 3.0) * u)}" stroke-linecap="round"${st.tail === 'plait' ? ` stroke-dasharray="${f(1.3 * u)} ${f(0.5 * u)}"` : ''}/>`);
  }
  return out.length ? `<g class="hair-back" pointer-events="none">${out.join('')}</g>` : '';
}

/** A tapering ribbon along a strand: how a lock of hair is drawn. */
function ribbon(pts: Pt[], w0: number, w1: number): Pt[] {
  const left: Pt[] = [], right: Pt[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, m = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
    left.push({ x: p.x - (dy / m) * w, y: p.y + (dx / m) * w }); right.push({ x: p.x + (dy / m) * w, y: p.y - (dx / m) * w });
  });
  return [...left, ...right.reverse()];
}

/** Long hair falling forward over the near shoulder: drawn over the gown, so long hair still reads lying back. */
export function hairFront(c: HeadCtx): string {
  const st = hairStyle(c.look.hairText, c.look.sex);
  if (!st.curtain) return '';
  const H = headFrame(c.k), u = c.k.u * HEAD_SCALE, pal = c.pal;
  /* it leaves the head above and behind the ear and falls past the jaw onto the shoulder, never across the face */
  const root = H(12, -2.5), d0 = (() => { const a = H(12, -2.5), b = H(3, -3.2); const m = Math.hypot(b.x - a.x, b.y - a.y); return { x: (b.x - a.x) / m, y: (b.y - a.y) / m }; })();
  const lock = strand(root, d0, (st.len * 0.75 + 4) * u, 1.8 * u, c.support, { c: H(3, 8), r: 6.5 * u });
  const shape = ribbon(lock, 7 * u, 2.2 * u);
  const out = [`<path d="${closedPath(shape)}" fill="${pal.hair}" stroke="${pal.hairDark}" stroke-width="${f(0.3 * u)}" stroke-linejoin="round"/>`];
  for (const t of [-0.6, -0.2, 0.25, 0.6]) {
    const line = lock.map((p, i) => { const q = lock[Math.min(lock.length - 1, i + 1)], r = lock[Math.max(0, i - 1)], m = Math.hypot(q.x - r.x, q.y - r.y) || 1; return { x: p.x - ((q.y - r.y) / m) * t * 2.6 * u * (1 - 0.6 * i / lock.length), y: p.y + ((q.x - r.x) / m) * t * 2.6 * u * (1 - 0.6 * i / lock.length) }; });
    out.push(`<path d="${openPath(line.slice(0, -2))}" fill="none" stroke="${t < 0 ? pal.hairLight : pal.hairDark}" stroke-width="${f(0.18 * u)}" opacity=".6"/>`);
  }
  return `<g class="hair-front" pointer-events="none">${out.join('')}</g>`;
}

/** Hair on the skull, drawn over the head (the ear is drawn over it unless long hair or a bob covers it). */
export function hairOver(c: HeadCtx): string {
  const st = hairStyle(c.look.hairText, c.look.sex);
  const H = headFrame(c.k), u = c.k.u * HEAD_SCALE, pal = c.pal;
  /* Baldness only where the text says so: receding moves the hairline back, thinning lets the scalp show through on
     top, bald leaves the fringe round the back and sides. */
  const center: AB = [8.5, -0.3];
  const horseshoe = st.bald;
  const startIdx = st.bald ? 6 : st.recede ? 2 : 0;
  /* the skull arc, densified so curls and messy hair get a scalloped edge rather than a few lumps */
  const coarse = SKULL.slice(startIdx);
  const arc: AB[] = coarse.flatMap(([a, b], i) => { const n = coarse[i + 1]; return n ? [[a, b], [(a * 2 + n[0]) / 3, (b * 2 + n[1]) / 3], [(a + n[0] * 2) / 3, (b + n[1] * 2) / 3]] as AB[] : [[a, b]] as AB[]; });
  const vol = st.volume * (st.thin ? 0.6 : 1) * (st.messy ? 1.25 : 1);
  const outer = arc.map(([a, b], i) => {
    const da = a - center[0], db = b - center[1], m = Math.hypot(da, db);
    let t = vol * (0.55 + 0.45 * Math.sin((i / (arc.length - 1)) * Math.PI));   // fullest over the crown
    if (st.curls) t += (st.curls === 2 ? 0.5 : 0.8) * Math.abs(Math.sin(i * 1.6));
    if (st.messy) t += 0.7 * Math.abs(Math.sin(i * 2.3 + 1)) * (i % 3 === 1 ? 1.4 : 0.6);
    return [a + (da / m) * t, b + (db / m) * t] as AB;
  });
  /* The side of the head: hairline from the temple down in front of the ear (sideburn), behind the ear to the nape. */
  const bob = st.bob, curtain = st.curtain;
  const sideF: AB[] = horseshoe
    ? [[13.5, -6.8], [11, -5.2], [8.6, -4.2], [6.0, -4.6], [3.0, -6.2]]
    : bob ? [[13.6, 8.6], [11.2, 6.6], [6.5, 4.6], [1.0, 3.6], [-0.6, 1.2], [-0.8, -3.5], [-0.2, -7.6]]
      : curtain ? [[13.8, 8.6], [11.6, 6.2], [8.4, 3.8], [4.4, 2.6], [2.6, -1.2], [1.4, -5.0]]
        : st.recede ? [[17.6, 4.4], [15.0, 2.4], [11.6, 2.6], [8.4, 2.6], [5.0, 2.3], [4.6, 1.2], [6.5, 0.4], [3.4, -4.8], [1.2, -6.4]]
          : [[13.8, 8.4], [12.6, 6.0], [10.4, 4.2], [8.2, 3.0], [5.0, 2.5], [4.6, 1.3], [6.5, 0.6], [3.4, -4.8], [1.2, -6.4]];
  const inner = sideF.slice().reverse();
  const outerPts: AB[] = outer;
  if (bob) { // the bob's hem falls straight to the jaw
    outerPts.push([0, -10.8], [-1.2, -9.6], [-1.6, -4]);
  }
  const shape = [...outerPts, ...inner].map(([a, b]) => H(a, b));
  const out: string[] = [];
  if (st.thin && !bob) {
    /* thin on top: the crown shows scalp through a veil of hair; the back and sides stay */
    out.push(`<path d="${closedPath(shape)}" fill="${pal.hair}" opacity=".42"/>`);
    /* the sides and back keep their hair: from the crown behind, down to the nape, forward under the ear to the
       sideburn and back over the ear to the crown */
    const sides: AB[] = [[1.2, -6.4], [3.4, -4.8], [6.5, 0.6], [4.6, 1.3], [5.0, 2.5], [8.2, 3.0], [10.4, 3.4], [12.2, 1.2], [13.4, -2.4], [14.6, -5.8]];
    const back = outer.slice(Math.max(0, 3 * (6 - startIdx)));
    if (!curtain) out.push(`<path d="${closedPath([...back, ...sides].map(([a, b]) => H(a, b)))}" fill="${pal.hair}" stroke="${pal.hairDark}" stroke-width="${f(0.3 * u)}" stroke-linejoin="round"/>`);
    for (let i = 0; i < 5; i++) {
      const line = SKULL.slice(startIdx, 8).map(([a, b]) => H(a + 0.25 + i * 0.12, b + (i - 2) * 0.35));
      out.push(`<path d="${openPath(line)}" fill="none" stroke="${pal.hairDark}" stroke-width="${f(0.14 * u)}" opacity=".45"/>`);
    }
  } else out.push(`<path d="${closedPath(shape)}" fill="${pal.hair}" stroke="${pal.hairDark}" stroke-width="${f(0.35 * u)}" stroke-linejoin="round"/>`);
  /* Fine strands, light from the upper left, as on the face canvas. */
  const strands = 6;
  for (let i = 0; i < strands && !st.thin && !horseshoe; i++) {
    const t = (i + 1) / (strands + 1);
    const line = coarse.slice(0, Math.max(2, Math.round(coarse.length * 0.9))).map(([a, b]) => {
      const da = a - center[0], db = b - center[1], m = Math.hypot(da, db);
      return H(a + (da / m) * vol * t * 0.8, b + (db / m) * vol * t * 0.8);
    });
    out.push(`<path d="${openPath(line)}" fill="none" stroke="${i % 2 ? pal.hairLight : pal.hairDark}" stroke-width="${f(0.18 * u)}" opacity=".5"/>`);
  }
  if (st.curls) for (let i = 1; i < outer.length - 1; i += 2) {
    const [a, b] = outer[i];
    const p = H(a - 0.6, b);
    out.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(0.55 * u)}" fill="none" stroke="${pal.hairDark}" stroke-width="${f(0.15 * u)}" opacity=".6"/>`);
  }
  if (st.bun) {
    const b = H(12.5, -11.3), r = (st.braids ? 3.4 : 3.0) * u;
    out.push(`<circle cx="${f(b.x)}" cy="${f(b.y)}" r="${f(r)}" fill="${pal.hair}" stroke="${pal.hairDark}" stroke-width="${f(0.35 * u)}"/>`);
    if (st.braids) for (let i = 0; i < 3; i++) out.push(`<circle cx="${f(b.x)}" cy="${f(b.y)}" r="${f(r * (0.35 + i * 0.22))}" fill="none" stroke="${pal.hairDark}" stroke-width="${f(0.2 * u)}" opacity=".7" stroke-dasharray="${f(0.8 * u)} ${f(0.4 * u)}"/>`);
  }
  if (st.tail !== 'none') {   // the band where it is tied
    const a = H(10.2, -10.5), b = H(8.6, -10.9);
    out.push(`<path d="M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}" stroke="${pal.hairDark}" stroke-width="${f(1.2 * u)}" stroke-linecap="round"/>`);
  }
  return `<g class="hair" pointer-events="none">${out.join('')}</g>`;
}

/** Whether hair covers the ear (long hair falling, or a bob). */
export const earCovered = (look: FigureLook) => { const s = hairStyle(look.hairText, look.sex); return s.bob || s.curtain; };

/* ---- the face ---- */

export function face(c: HeadCtx): string {
  const H = headFrame(c.k), u = c.k.u * HEAD_SCALE, pal = c.pal, look = c.look, b = look.body, sh = c.sh;
  const P = (pts: AB[]) => pts.map(([a, bb]) => H(a, bb));
  const out: string[] = [];
  const distress = { none: 0, mild: 1, moderate: 2, severe: 3 }[b.distress];
  const sw = (w: number) => f(w * u);

  /* Hollow temples and cheeks when wasted; soft jowls in obesity; a few lines with age. */
  if (sh.bony > 0.25 || sh.wasted) {
    const t = H(11.2, 4.6), ch = H(3.4, 6.0);
    out.push(`<ellipse cx="${f(t.x)}" cy="${f(t.y)}" rx="${f(2.6 * u)}" ry="${f(2.0 * u)}" fill="${pal.dark}" opacity="${f(0.25 + 0.2 * sh.bony)}"/>`);
    out.push(`<ellipse cx="${f(ch.x)}" cy="${f(ch.y)}" rx="${f(2.2 * u)}" ry="${f(1.6 * u)}" fill="${pal.dark}" opacity="${f(0.18 + 0.15 * sh.bony)}"/>`);
    out.push(`<path d="${openPath(P([[7.0, 7.4], [6.2, 5.0], [6.6, 2.6]]))}" fill="none" stroke="${pal.line}" stroke-width="${sw(0.25)}" opacity=".55"/>`);  // cheekbone
  }
  /* jaw line: the angle of the mandible sits in front of the ear lobe */
  const jaw: AB[] = sh.soft > 0.3 ? [[-1.4, 8.4], [-1.0, 4.4], [0.6, 1.0]] : [[-2.4, 8.2], [-1.2, 4.0], [0.4, 0.6], [3.0, -0.6]];
  out.push(`<path d="${openPath(P(jaw))}" fill="none" stroke="${pal.line}" stroke-width="${sw(0.22)}" opacity="${sh.bony > 0.3 ? 0.7 : 0.4}"/>`);
  if (sh.soft > 0.2) out.push(`<path d="${openPath(P([[-2.2, 7.6], [-3.2 - 1.4 * sh.soft, 5.0], [-2.6 - sh.soft, 2.2]]))}" fill="none" stroke="${pal.line}" stroke-width="${sw(0.2)}" opacity=".45"/>`);
  if (look.body.colour === 'flushed') {
    const ch = H(4.6, 6.8);
    out.push(`<ellipse cx="${f(ch.x)}" cy="${f(ch.y)}" rx="${f(2.2 * u)}" ry="${f(1.7 * u)}" fill="${pal.blush}" opacity=".2"/>`);
  }
  if (sh.old > 0.2) out.push(`<path d="${openPath(P([[4.4, 9.4], [2.4, 8.4], [0.6, 8.6]]))}" fill="none" stroke="${pal.line}" stroke-width="${sw(0.18)}" opacity="${f(0.35 + 0.3 * sh.old)}"/>`);   // nasolabial fold

  /* Eye: a profile eye is a small wedge open toward the front; the iris shows as a dark arc. Distress narrows it. */
  const shut = distress >= 2 ? 0.25 : 0;
  out.push(`<path d="${closedPath(P([[8.95 - shut, 8.5], [8.5, 9.0], [7.8 + shut * 0.6, 8.7], [8.3, 7.1]]))}" fill="${pal.sclera}"/>`);
  const iris = H(8.35, 8.55);
  out.push(`<ellipse cx="${f(iris.x)}" cy="${f(iris.y)}" rx="${f(0.42 * u)}" ry="${f(0.55 * u)}" fill="#3a2a20"/>`);
  out.push(`<path d="${openPath(P([[8.5, 7.0], [9.05 - shut, 8.2], [8.6, 9.15]]))}" fill="none" stroke="#3b2a22" stroke-width="${sw(0.32)}" stroke-linecap="round"/>`);  // upper lid and lashes
  out.push(`<path d="${openPath(P([[8.2, 7.2], [7.75 + shut * 0.6, 8.4], [8.0, 9.0]]))}" fill="none" stroke="${pal.line}" stroke-width="${sw(0.18)}" opacity=".7"/>`);
  /* Brow: hair colour; in distress the inner end pulls down and in. */
  const brow: AB[] = distress >= 2 ? [[10.7, 6.2], [10.9, 8.0], [10.2, 9.6]] : distress === 1 ? [[10.5, 6.2], [10.95, 8.0], [10.6, 9.6]] : [[10.3, 6.2], [10.85, 8.0], [10.75, 9.6]];
  out.push(`<path d="${openPath(P(brow))}" fill="none" stroke="${pal.hairDark}" stroke-width="${sw(sh.female ? 0.4 : 0.55)}" stroke-linecap="round" opacity=".85"/>`);
  if (distress >= 2) out.push(`<path d="${openPath(P([[11.4, 9.4], [12.2, 9.7]]))}" fill="none" stroke="${pal.line}" stroke-width="${sw(0.18)}" opacity=".6"/>`);

  /* Nostril wing. */
  out.push(`<path d="${openPath(P([[4.9, 10.9], [5.0, 10.0], [4.2, 9.5], [3.7, 10.1]]))}" fill="none" stroke="${pal.line}" stroke-width="${sw(0.24)}"/>`);
  if (b.breathing.accessory) out.push(`<path d="${openPath(P([[5.2, 10.6], [4.6, 9.3], [3.8, 9.6]]))}" fill="none" stroke="${pal.dark}" stroke-width="${sw(0.18)}" opacity=".6"/>`); // flaring

  /* Lips: coloured over the profile; pursed lips push forward and round; distress parts them. */
  const pu = b.breathing.pursedLips ? 1 : 0;
  const open = !pu && (distress >= 2 || b.breathing.accessory) ? 0.5 : 0;
  const upper: AB[] = [[3.35, 10.6], [2.7, 11.05 + pu * 0.7], [1.85 + open * 0.3, 10.55 + pu * 1.2], [1.95 + open * 0.3, 9.4], [2.8, 9.7]];
  const lower: AB[] = [[1.6 - open * 0.4, 10.5 + pu * 1.2], [0.9 - open * 0.4, 10.7 + pu * 0.9], [0.0 - open * 0.3, 10.2 + pu * 0.3], [0.6, 9.3], [1.5 - open * 0.3, 9.4]];
  out.push(`<path d="${closedPath(P(upper))}" fill="${pal.lip}"/><path d="${closedPath(P(lower))}" fill="${pal.lip}"/>`);
  if (open) out.push(`<path d="${closedPath(P([[1.85, 10.4], [1.6 - open * 0.4, 10.4], [1.7, 9.6]]))}" fill="#4a2a26"/>`);
  out.push(`<path d="${openPath(P([[1.75 + open * 0.1, 10.55 + pu * 1.2], [1.8, 9.6]]))}" fill="none" stroke="${pal.lipLine}" stroke-width="${sw(0.2)}"/>`);

  /* Sweat: a few highlights on the forehead, temple and upper lip. */
  if (b.sweating) for (const [a, bb, r] of [[13.2, 8.9, 0.42], [12.0, 6.4, 0.34], [10.0, 3.8, 0.3], [3.0, 10.4, 0.26], [14.6, 5.6, 0.3]] as Array<[number, number, number]>) {
    const p = H(a, bb);
    out.push(`<ellipse cx="${f(p.x)}" cy="${f(p.y)}" rx="${f(r * u)}" ry="${f(r * 1.3 * u)}" fill="#ffffff" opacity=".75"/>`);
  }
  return `<g class="face" pointer-events="none">${out.join('')}</g>`;
}

/** The ear, drawn over short hair (long hair and a bob cover it). */
export function ear(c: HeadCtx): string {
  const H = headFrame(c.k), u = c.k.u * HEAD_SCALE, pal = c.pal, look = c.look;
  const P = (pts: AB[]) => pts.map(([a, bb]) => H(a, bb));
  const sw = (w: number) => f(w * u);
  const out: string[] = [];
  /* Ear: between brow and nose base, just behind the middle of the head; tilted back. */
  if (!earCovered(look)) {
    const ear = P([[9.4, -1.0], [9.6, -2.6], [8.3, -4.0], [6.0, -4.1], [4.0, -3.3], [3.0, -2.2], [3.4, -1.2], [5.6, -0.6], [7.8, -0.4]]);
    out.push(`<path d="${closedPath(ear)}" fill="${pal.skin}" stroke="${pal.line}" stroke-width="${sw(0.22)}"/>`);
    out.push(`<path d="${openPath(P([[8.4, -1.4], [8.2, -2.9], [6.4, -3.2], [5.2, -2.6]]))}" fill="none" stroke="${pal.line}" stroke-width="${sw(0.2)}" opacity=".7"/>`);
    out.push(`<path d="${openPath(P([[6.6, -1.0], [5.4, -1.6], [4.6, -1.2]]))}" fill="none" stroke="${pal.dark}" stroke-width="${sw(0.3)}" opacity=".6"/>`);
  }

  return `<g pointer-events="none">${out.join('')}</g>`;
}

/* ---- oxygen ---- */

export function oxygenSvg(c: HeadCtx, chestPt: Pt): string {
  const dev = (c.look.oxygen ?? '').toLowerCase();
  if (!dev) return '';
  const H = headFrame(c.k), u = c.k.u * HEAD_SCALE;
  const tube = '#d9ece7', tubeLine = '#8fb2aa';
  const out: string[] = [];
  const line = (pts: Pt[], w: number, col = tube, edge = tubeLine) => out.push(
    `<path d="${openPath(pts)}" fill="none" stroke="${edge}" stroke-width="${f((w + 0.35) * u)}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${openPath(pts)}" fill="none" stroke="${col}" stroke-width="${f(w * u)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  /* tubing hangs from under the chin toward the chest and off the bed */
  const drop = (from: Pt) => {
    const mid = { x: lerpN(from.x, chestPt.x, 0.5), y: Math.max(from.y, chestPt.y) + 6 * u };
    return [from, mid, chestPt];
  };
  if (/mask|venturi|rebreath/.test(dev)) {
    /* A clear mask over nose and mouth, an elastic strap round the head, tubing from its base. */
    const mask = [[9.4, 9.7], [8.4, 12.4], [5.6, 14.6], [1.6, 15.0], [-2.0, 13.4], [-3.6, 10.6], [-3.2, 8.4], [0.0, 7.4], [4.0, 7.2], [7.4, 8.2]].map(([a, b]) => H(a, b));
    out.push(`<path d="${closedPath(mask)}" fill="#e6f3f0" fill-opacity=".55" stroke="${tubeLine}" stroke-width="${f(0.3 * u)}"/>`);
    out.push(`<path d="${openPath([H(4.6, 13.6), H(2.0, 14.4), H(-0.8, 13.6)])}" fill="none" stroke="#ffffff" stroke-width="${f(0.35 * u)}" opacity=".8"/>`);
    out.push(`<path d="${openPath([H(5.6, 7.6), H(7.2, 1.0), H(7.4, -6.0), H(6.2, -10.4)])}" fill="none" stroke="#7d9b95" stroke-width="${f(0.35 * u)}"/>`);
    const base = H(-2.2, 12.6);
    line(drop(base), 1.1);
    if (/rebreath|reservoir/.test(dev)) {
      const bag = { x: base.x + 2 * u, y: base.y + 13 * u };
      out.push(`<ellipse cx="${f(bag.x + 1.5 * u)}" cy="${f(bag.y + 3.5 * u)}" rx="${f(3.0 * u)}" ry="${f(4.2 * u)}" fill="#cfe6d8" fill-opacity=".8" stroke="${tubeLine}" stroke-width="${f(0.25 * u)}"/>`);
    }
  } else {
    /* Nasal cannula: prongs in the nostril, tubing along the cheek, over the ear, back under the chin. */
    line([H(4.0, 10.6), H(4.6, 8.0), H(5.6, 3.6), H(8.4, 0.2), H(9.5, -2.0), H(8.4, -3.9), H(5.6, -4.4), H(2.8, -3.2), H(0.2, 0.2), H(-2.6, 4.4)], 0.7);
    line(drop(H(-2.6, 4.4)), 0.7);
    const prong = H(3.8, 10.4);
    out.push(`<circle cx="${f(prong.x)}" cy="${f(prong.y)}" r="${f(0.55 * u)}" fill="${tube}" stroke="${tubeLine}" stroke-width="${f(0.2 * u)}"/>`);
  }
  return `<g class="oxygen" pointer-events="none">${out.join('')}</g>`;
}
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
