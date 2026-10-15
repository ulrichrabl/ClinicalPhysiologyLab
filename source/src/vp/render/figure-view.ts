/* ---------------------------------------------------------------------------
   Figure view: how the posed body is seen from where the examiner stands.

   The skeleton is posed in the sagittal plane, which is what the right-hand
   side of the bed shows. Every part also has a width across the body
   (lateral, in reference cm; + is the patient's left), so the body is a
   simple 3D model: tubes with an elliptical cross-section (front-to-back
   depth from the profile stations, side-to-side width from w).

   A view turns that model about the trunk's long axis:
     turn 0     the profile, from the patient's right (as drawn before);
     turn 90    the front of the patient: lying, from above; sitting or
                standing, face to face;
     turn -90   the back (the thorax view from behind);
   and side −1 is the same seen from the patient's left: the drawing is
   mirrored and the left limbs are the near ones. From the front the
   examiner stands at the foot of the bed, so as the patient turns the
   drawing also rotates until the trunk stands upright in it: lying, the
   patient is seen from above with the head at the top. Because the projection is
   linear, everything posed or placed in profile (joints, the trolley, the
   pillow) turns with the body and a change of view can be animated.

   The silhouette of a tube is found per station: the cross-section ellipse
   is projected and its extent measured across the projected axis. Where a
   limb points at the viewer (a thigh seen from the front while sitting) the
   axis vanishes, so the ends of every tube are also drawn as projected
   cross-sections: a knee seen end-on is a round knee.
--------------------------------------------------------------------------- */

import { add, clamp, dir, off, type Pt } from './figure-geom.ts';

export interface FigureView { turn: number; side: 1 | -1 }
export const VIEW_RIGHT: FigureView = { turn: 0, side: 1 };
export const VIEW_LEFT: FigureView = { turn: 0, side: -1 };
export const VIEW_FRONT: FigureView = { turn: 90, side: 1 };
export const VIEW_BACK: FigureView = { turn: -90, side: 1 };

/** A station of a part: along its axis, in front of it, behind it, and half its width across (reference cm). */
export interface Station3 { s: number; a: number; p: number; w: number }

export class Projector {
  readonly c: number; readonly sn: number;
  private rc = 1; private rs = 0; private pivot: Pt = { x: 0, y: 0 }; private shift: Pt = { x: 0, y: 0 };
  /** O: origin (a profile point that stays put), U: the trunk's long axis in the drawing, A: its anterior direction. */
  constructor(readonly O: Pt, readonly U: Pt, readonly A: Pt, readonly view: FigureView, readonly u: number, readonly mirrorX = 180) {
    this.c = Math.cos((view.turn * Math.PI) / 180);
    this.sn = Math.sin((view.turn * Math.PI) / 180);
  }
  /** After projecting, rotate by `deg` (counter-clockwise on screen) about `pivot` and move by `shift`. */
  settle(deg: number, pivot: Pt, shift: Pt): this {
    this.rc = Math.cos((deg * Math.PI) / 180); this.rs = Math.sin((deg * Math.PI) / 180); this.pivot = pivot; this.shift = shift;
    return this;
  }
  private rot(p: Pt): Pt {
    const x = p.x - this.pivot.x, y = p.y - this.pivot.y;
    return { x: this.pivot.x + x * this.rc + y * this.rs + this.shift.x, y: this.pivot.y - x * this.rs + y * this.rc + this.shift.y };
  }
  private rotV(v: Pt): Pt { return { x: v.x * this.rc + v.y * this.rs, y: -v.x * this.rs + v.y * this.rc }; }
  /** The whole map as an SVG matrix, for drawings made in profile (lateral offset zero). */
  matrix(): string {
    const o = this.P({ x: 0, y: 0 }), ex = this.P({ x: 1, y: 0 }), ey = this.P({ x: 0, y: 1 });
    const r = (n: number) => (Math.round(n * 10000) / 10000).toString();
    return `matrix(${r(ex.x - o.x)} ${r(ex.y - o.y)} ${r(ey.x - o.x)} ${r(ey.y - o.y)} ${r(o.x)} ${r(o.y)})`;
  }
  get profile() { return Math.abs(this.sn) < 1e-6; }
  /** A profile point p, moved z reference cm across the body. Mirroring for the left side happens at the end, on the
      whole drawing, so this stays in the right-side frame. */
  P(p: Pt, z = 0): Pt {
    const dx = p.x - this.O.x, dy = p.y - this.O.y;
    const du = dx * this.U.x + dy * this.U.y, da = dx * this.A.x + dy * this.A.y;
    const t = da * this.c + this.view.side * z * this.u * this.sn;
    return this.rot({ x: this.O.x + this.U.x * du + this.A.x * t, y: this.O.y + this.U.y * du + this.A.y * t });
  }
  /** A direction in profile, projected (no lateral part). */
  vec(d: Pt): Pt {
    const du = d.x * this.U.x + d.y * this.U.y, da = d.x * this.A.x + d.y * this.A.y;
    return this.rotV({ x: this.U.x * du + this.A.x * da * this.c, y: this.U.y * du + this.A.y * da * this.c });
  }
  /** The lateral unit (one reference cm toward the patient's left), projected. */
  get zv(): Pt { const k = this.view.side * this.u * this.sn; return this.rotV({ x: this.A.x * k, y: this.A.y * k }); }
  /** How much a surface with normal (anterior component na in profile direction nDir, lateral nz) faces the viewer:
      > 0 visible. The viewer looks from the patient's right (side 1) at turn 0, from in front at 90. */
  facing(nAnt: number, nz: number): number { return nAnt * this.sn - this.view.side * nz * this.c; }
  /** Wrap a finished drawing for the side it is seen from. */
  wrap(svg: string): string { return this.view.side < 0 ? `<g transform="matrix(-1 0 0 1 ${this.mirrorX * 2} 0)">${svg}</g>` : svg; }
}

/** Profile frame of a tube: a station at s along `a` from `from`, x across it toward anterior (flip: anterior side). */
export interface TubeFrame { from: Pt; a: number; flip: number }

/** The silhouette of a tube and its end sections, as seen. z0/z1: the axis' lateral offset at the first and last station. */
export function tube(pr: Projector, fr: TubeFrame, st: Station3[], z0: number, z1: number, grow = 0, caps = true): Pt[][] {
  const u = pr.u, n = st.length, s0 = st[0].s, s1 = st[n - 1].s;
  const zAt = (s: number) => z0 + ((z1 - z0) * (s - s0)) / (s1 - s0 || 1);
  const nrm = dir(fr.a + 90 * fr.flip);                   // anterior, in profile
  const nImg = pr.vec(nrm), zImg = pr.zv;
  const C: Pt[] = st.map((t) => pr.P(off(fr.from, fr.a, t.s * u, ((t.a - t.p) / 2) * u * fr.flip), zAt(t.s)));
  /* the projected axis, and across it */
  let ax = { x: C[n - 1].x - C[0].x, y: C[n - 1].y - C[0].y };
  const L = Math.hypot(ax.x, ax.y);
  if (L < 1e-6) { const d = pr.vec(dir(fr.a)); ax = Math.hypot(d.x, d.y) > 1e-6 ? d : pr.zv; }
  const m = Math.hypot(ax.x, ax.y) || 1; ax = { x: ax.x / m, y: ax.y / m };
  const nn = { x: -ax.y * fr.flip, y: ax.x * fr.flip };
  /* keep "front" on the anterior side in profile so the outline matches the profile drawing exactly */
  const sgn = nn.x * nImg.x + nn.y * nImg.y < -1e-9 ? -1 : 1;
  const across = { x: nn.x * sgn, y: nn.y * sgn };
  const ext = (t: Station3) => {
    const rn = (t.a + t.p) / 2 + grow, w = t.w + grow;
    const e1 = rn * u * (nImg.x * across.x + nImg.y * across.y), e2 = w * (zImg.x * across.x + zImg.y * across.y);
    return Math.sqrt(e1 * e1 + e2 * e2);
  };
  const front = st.map((t, i) => ({ x: C[i].x + across.x * ext(t), y: C[i].y + across.y * ext(t) }));
  const back = st.map((t, i) => ({ x: C[i].x - across.x * ext(t), y: C[i].y - across.y * ext(t) })).reverse();
  const tip = (t: Station3, i: number, sign: number) => {
    const r = Math.max(Math.min(t.a, t.p), 0.3 * (t.a + t.p) / 2) * 0.7 * (L > 1e-6 ? Math.min(1, L / (u * Math.abs(s1 - s0) || 1)) : 0);
    return { x: C[i].x + ax.x * r * u * sign, y: C[i].y + ax.y * r * u * sign };
  };
  const out: Pt[][] = [[...front, tip(st[n - 1], n - 1, 1), ...back, tip(st[0], 0, -1)]];
  /* end sections: the cross-section ellipse, which is all one sees of a tube pointing at the eye */
  if (caps && Math.abs(pr.sn) > 0.04) for (const i of [0, n - 1]) {
    const t = st[i], rn = (t.a + t.p) / 2 + grow, w = t.w + grow, ring: Pt[] = [];
    for (let k = 0; k < 10; k++) {
      const ph = (k / 10) * Math.PI * 2, cs = Math.cos(ph) * rn * u, sn = Math.sin(ph) * w;
      ring.push({ x: C[i].x + nImg.x * cs + zImg.x * sn, y: C[i].y + nImg.y * cs + zImg.y * sn });
    }
    out.push(ring);
  }
  return out;
}

/** A point on a tube's surface: station s, angle psi round the section (0 anterior, 90 toward the patient's left),
    pushed out by dr. Returns the point and how much it faces the viewer. */
export function onTube(pr: Projector, fr: TubeFrame, st: (s: number) => Station3, s: number, psi: number, z: number, dr = 0): { p: Pt; vis: number } {
  const t = st(s), rn = (t.a + t.p) / 2 + dr, c = (t.a - t.p) / 2, w = t.w + dr;
  const cs = Math.cos((psi * Math.PI) / 180), sn = Math.sin((psi * Math.PI) / 180);
  const p = pr.P(off(fr.from, fr.a, s * pr.u, (c + rn * cs) * pr.u * fr.flip), z + w * sn);
  return { p, vis: pr.facing(cs / Math.max(rn, 0.1), sn / Math.max(w, 0.1)) * Math.max(rn, w) };
}

/** The convex hull of points (for boxes, masks). */
export function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** A box in the scene: x0..x1 along the drawing, y0..y1 down, z0..z1 across (reference cm); its corners, projected. */
export function boxCorners(pr: Projector, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Pt[] {
  const out: Pt[] = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(pr.P({ x, y }, z));
  return out;
}

/** Fade in over a band of |turn| (profile drawings fade out as the front ones fade in). */
export const frontness = (pr: Projector) => clamp((Math.abs(pr.sn) - 0.55) / 0.3, 0, 1);

export { add };
