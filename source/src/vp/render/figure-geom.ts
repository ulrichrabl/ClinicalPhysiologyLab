/* ---------------------------------------------------------------------------
   Figure geometry: the small toolbox the patient figure is drawn with.

   Angles are in degrees, measured like a maths graph (0 = right, 90 = up),
   because the poses read most naturally that way; SVG's y axis points down,
   so dir() flips it once here and nowhere else.

   Body parts are closed outlines through a list of points, smoothed with a
   Catmull-Rom spline written out as cubic Béziers: the outlines stay smooth
   whatever the pose and the widths, without hand-placing control points.
--------------------------------------------------------------------------- */

export interface Pt { x: number; y: number }

export const rad = (d: number) => (d * Math.PI) / 180;
export const dir = (a: number): Pt => ({ x: Math.cos(rad(a)), y: -Math.sin(rad(a)) });
export const add = (p: Pt, a: number, len: number): Pt => { const d = dir(a); return { x: p.x + d.x * len, y: p.y + d.y * len }; };
/** p moved by `along` in direction a and `across` in direction a + 90. */
export const off = (p: Pt, a: number, along: number, across: number): Pt => {
  const d = dir(a), n = dir(a + 90);
  return { x: p.x + d.x * along + n.x * across, y: p.y + d.y * along + n.y * across };
};
export const mix = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
/** One decimal, as short as possible. Written out by hand: the figure formats thousands of numbers per frame, and
    integer-to-string is several times faster than formatting a float. */
export const f = (n: number): string => {
  let i = Math.round(n * 10);
  const neg = i < 0; if (neg) i = -i;
  const w = (i / 10) | 0, d = i - w * 10;
  return (neg && i ? '-' : '') + w + (d ? '.' + d : '');
};

/** A closed, smooth outline through the points (Catmull-Rom as cubic Béziers). */
export function closedPath(pts: Pt[]): string {
  const n = pts.length;
  if (n < 3) return '';
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d + 'Z';
}

/** An open smooth line through the points (for creases, folds, tubing, hair strands). */
export function openPath(pts: Pt[]): string {
  const n = pts.length;
  if (n < 2) return '';
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

/* ---- colour: the illness tints the skin by mixing, never by replacing ---- */
const hex2 = (h: string) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const toHex = (c: number[]) => '#' + c.map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
export const tint = (a: string, b: string, t: number) => { const x = hex2(a), y = hex2(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export const darken = (a: string, t: number) => tint(a, '#000000', t);
export const lighten = (a: string, t: number) => tint(a, '#ffffff', t);
