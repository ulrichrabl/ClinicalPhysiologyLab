import { EEG } from '../evidence/eeg.ts';

/* ===========================================================================
   The EEG as a measurement: how the scalp sees a source in the brain.

   A patch of cortex whose pyramidal cells are depolarised together is a
   sheet of current dipoles. The current they drive spreads through the
   head, and the scalp electrodes pick up the potential it leaves there.
   The head is four concentric shells (brain, cerebrospinal fluid, skull,
   scalp), each of one conductivity (evidence/eeg.ts). For a current
   dipole in such a head the potential has an exact solution, a series of
   Legendre polynomials (de Munck & Peters 1993; Zhang 1995):

     V(ê) = 1 / (4π σ₁ R²) · Σₙ ŝⁿ⁻¹ gₙ [ n p_r Pₙ(x) + (p_t·ê) Pₙ′(x) ]

   with ê the electrode's direction, x = cos of the angle between ê and the
   source, ŝ the source's radius over the scalp's, p_r and p_t the radial
   and tangential parts of the dipole, and gₙ a factor per order that holds
   the shells. gₙ is found here by matching potential and current across
   each interface, order by order, and requiring that no current leaves the
   scalp. For one homogeneous sphere gₙ = (2n+1)/n.

   The same coefficients give the potential inside every shell, which the
   station draws in a section through the head to show how the skull
   smears the field.

   Units: millimetres, nAm, S/m; potentials in µV.
=========================================================================== */

export type Vec3 = [number, number, number];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vec = { dot, sub, add, scale, norm, unit, cross };

/* ---- the head ---------------------------------------------------------------------------------- */

export interface Head {
  /** outer radius of each shell from the inside: brain, CSF, skull, scalp (mm) */
  radii: number[];
  /** conductivity of each shell (S/m) */
  sigma: number[];
  /** shell names, for drawing */
  names: Array<'brain' | 'csf' | 'skull' | 'scalp'>;
}

/** Brain-to-skull conductivity ratios that have been argued for, with where each comes from. */
export const SKULL_RATIOS = [
  { ratio: EEG.sigmaBrain / EEG.sigmaSkull, ref: 'mccann2019', label: { en: 'meta-analysis (McCann 2019)', de: 'Metaanalyse (McCann 2019)' } },
  { ratio: 15, ref: 'oostendorp2000', label: { en: 'Oostendorp 2000', de: 'Oostendorp 2000' } },
  { ratio: 25, ref: 'lai2005', label: { en: 'in living people (Lai 2005)', de: 'am Lebenden (Lai 2005)' } },
  { ratio: 80, ref: 'rush1968', label: { en: 'classic (Rush & Driscoll 1968)', de: 'klassisch (Rush & Driscoll 1968)' } },
] as const;

export interface HeadOptions { skullRatio?: number; csf?: boolean }

/** The adult head of the evidence registry, optionally with another skull conductivity or without the CSF layer. */
export function standardHead(o: HeadOptions = {}): Head {
  const R = EEG.headRadius, sc = EEG.scalpThickness, sk = EEG.skullThickness, cs = o.csf === false ? 0 : EEG.csfThickness;
  const skull = o.skullRatio ? EEG.sigmaBrain / o.skullRatio : EEG.sigmaSkull;
  const radii = [R - sc - sk - cs, R - sc - sk, R - sc, R];
  const sigma = [EEG.sigmaBrain, EEG.sigmaCsf, skull, EEG.sigmaScalp];
  const names: Head['names'] = ['brain', 'csf', 'skull', 'scalp'];
  if (cs === 0) { radii.splice(1, 1); sigma.splice(1, 1); names.splice(1, 1); }
  return { radii, sigma, names };
}

/** One homogeneous sphere (for tests and for showing what the shells do). */
export const homogeneousHead = (R = EEG.headRadius, sigma = EEG.sigmaBrain): Head => ({ radii: [R], sigma: [sigma], names: ['brain'] });

/* ---- the series ------------------------------------------------------------------------------- */

/** Pₙ(x) and Pₙ′(x) for n = 0…N. */
export function legendre(x: number, N: number, P = new Float64Array(N + 1), D = new Float64Array(N + 1)) {
  P[0] = 1; D[0] = 0;
  if (N >= 1) { P[1] = x; D[1] = 1; }
  for (let n = 1; n < N; n++) {
    P[n + 1] = ((2 * n + 1) * x * P[n] - n * P[n - 1]) / (n + 1);
    D[n + 1] = D[n - 1] + (2 * n + 1) * P[n];
  }
  return { P, D };
}

/** Per order n, the coefficients of rⁿ (A) and r⁻⁽ⁿ⁺¹⁾ (B) in each shell, radii normalised to the scalp,
    for a source in the innermost shell whose own potential has B = 1 there. */
interface Orders { N: number; A: Float64Array[]; B: Float64Array[]; g: Float64Array }

function solveOrders(head: Head, N: number): Orders {
  const R = head.radii[head.radii.length - 1], K = head.radii.length;
  const A = Array.from({ length: K }, () => new Float64Array(N + 1)), B = Array.from({ length: K }, () => new Float64Array(N + 1));
  const g = new Float64Array(N + 1);
  for (let n = 1; n <= N; n++) {
    /* carry two solutions outward: one starting (A, B) = (1, 0) in the brain, one starting (0, 1); the true solution
       is A₁·first + second, with A₁ chosen so that no current leaves the scalp */
    let s1: [number, number] = [1, 0], s2: [number, number] = [0, 1];
    const t1: Array<[number, number]> = [s1], t2: Array<[number, number]> = [s2];
    for (let k = 0; k < K - 1; k++) {
      const a = head.radii[k] / R, u = a ** n, w = a ** -(n + 1), ratio = head.sigma[k] / head.sigma[k + 1];
      const step = ([Ak, Bk]: [number, number]): [number, number] => {
        const P = Ak * u + Bk * w, Q = ratio * (n * Ak * u - (n + 1) * Bk * w);
        return [((n + 1) * P + Q) / ((2 * n + 1) * u), (n * P - Q) / ((2 * n + 1) * w)];
      };
      s1 = step(s1); s2 = step(s2); t1.push(s1); t2.push(s2);
    }
    /* outer surface (radius 1): n·A_N − (n+1)·B_N = 0 */
    const A1 = -(n * s2[0] - (n + 1) * s2[1]) / (n * s1[0] - (n + 1) * s1[1]);
    for (let k = 0; k < K; k++) { A[k][n] = A1 * t1[k][0] + t2[k][0]; B[k][n] = A1 * t1[k][1] + t2[k][1]; }
    g[n] = A[K - 1][n] + B[K - 1][n];
  }
  return { N, A, B, g };
}

/** Enough orders for the terms to fall below 10⁻¹² of the first, for a source at normalised radius s. */
const ordersFor = (s: number) => Math.min(600, Math.max(20, Math.ceil(Math.log(1e-12) / Math.log(Math.max(s, 1e-3))) + 10));

export class ForwardModel {
  readonly head: Head;
  readonly R: number;
  private orders: Orders;
  constructor(head: Head = standardHead()) {
    this.head = head;
    this.R = head.radii[head.radii.length - 1];
    this.orders = solveOrders(head, 600);
  }
  /** µV per nAm before the series */
  private get K() { return 1e3 / (4 * Math.PI * this.head.sigma[0] * this.R * this.R); }

  /** Potential (µV) on the scalp in direction `at` (a unit vector) from a dipole p (nAm) at r0 (mm, inside the brain). */
  scalp(r0: Vec3, p: Vec3, at: Vec3): number {
    const rs = norm(r0), s = rs / this.R;
    const rh: Vec3 = rs > 1e-9 ? scale(r0, 1 / rs) : [0, 0, 1];
    const pr = dot(p, rh), pt = sub(p, scale(rh, pr)), pte = dot(pt, at);
    const x = Math.max(-1, Math.min(1, dot(rh, at)));
    const c = this.coef(s), N = c.length - 1;
    const { P, D } = legendre(x, N, this.P, this.D);
    let sum = 0;
    for (let n = 1; n <= N; n++) sum += c[n] * (n * pr * P[n] + pte * D[n]);
    return this.K * sum;
  }
  private P = new Float64Array(601); private D = new Float64Array(601);
  private cache = new Map<number, Float64Array>();
  /** sⁿ⁻¹·gₙ for a source at normalised radius s, kept for the radii in use (every point of a patch shares one) */
  private coef(s: number): Float64Array {
    let c = this.cache.get(s);
    if (c) return c;
    const N = ordersFor(s), g = this.orders.g;
    c = new Float64Array(N + 1);
    let sp = 1;
    for (let n = 1; n <= N; n++) { c[n] = sp * g[n]; sp *= s; }
    if (this.cache.size > 64) this.cache.clear();
    this.cache.set(s, c);
    return c;
  }

  /** Potential (µV) at any point inside the head (mm), for drawing a section. Inside the brain the source's own
      potential is exact; the shells add a smooth part. Outside the head: NaN. */
  inside(r0: Vec3, p: Vec3, at: Vec3): number {
    const r = norm(at);
    if (r > this.R + 1e-9) return NaN;
    const k = this.head.radii.findIndex((x) => r <= x + 1e-9);
    const rs = norm(r0), s = rs / this.R, rhat = r / this.R;
    const rh: Vec3 = rs > 1e-9 ? scale(r0, 1 / rs) : [0, 0, 1];
    const eh: Vec3 = r > 1e-9 ? scale(at, 1 / r) : [0, 0, 1];
    const pr = dot(p, rh), pt = sub(p, scale(rh, pr)), pte = dot(pt, eh);
    const x = Math.max(-1, Math.min(1, dot(rh, eh)));
    /* the B terms fall as (s/r)ⁿ; the A terms, reflections from the interfaces above, as (s·r/a²)ⁿ with a the shell's
       outer radius (the nearest interface reflects most slowly) */
    const aout = this.head.radii[k] / this.R;
    const N = ordersFor(Math.max((s * rhat) / (aout * aout), k === 0 ? 0 : s / rhat));
    const { P, D } = legendre(x, N, this.P, this.D);
    let sum = 0, sp = 1, rn = rhat, ri = 1 / (rhat * rhat);
    const A = this.orders.A[k], B = this.orders.B[k];
    for (let n = 1; n <= N; n++) {
      /* in the brain, B is the source's own term; it is added exactly below */
      const radial = k === 0 ? A[n] * rn : A[n] * rn + B[n] * ri;
      sum += sp * radial * (n * pr * P[n] + pte * D[n]);
      sp *= s; rn *= rhat; ri /= rhat;
    }
    let v = this.K * sum;
    if (k === 0) { const d = sub(at, r0), dn = norm(d); v += (1e3 / (4 * Math.PI * this.head.sigma[0])) * dot(p, d) / (dn * dn * dn); }
    return v;
  }
}

/** The potential of a dipole in an unbounded medium (µV), for tests. */
export const unboundedPotential = (r0: Vec3, p: Vec3, at: Vec3, sigma: number) => {
  const d = sub(at, r0), dn = norm(d);
  return (1e3 / (4 * Math.PI * sigma)) * dot(p, d) / (dn * dn * dn);
};

/* ---- electrodes -------------------------------------------------------------------------------- */

/** Spherical positions as in the standard 10-10 set distributed with MNE-Python (easycap-M1): θ is the angle from the
    vertex, negative over the left hemisphere; φ the azimuth. x points right, y forward, z up. Ears (A1, A2) are derived
    from the standard_1020 template by the same sphere fit as the radius (evidence/eeg.ts). */
const SPHERICAL: Record<string, [number, number]> = {
  Fp1: [-92, -72], Fp2: [92, 72], Fpz: [92, 90],
  F7: [-92, -36], F3: [-60, -51], Fz: [46, 90], F4: [60, 51], F8: [92, 36],
  T7: [-92, 0], C3: [-46, 0], Cz: [0, 0], C4: [46, 0], T8: [92, 0],
  P7: [-92, 36], P3: [-60, 51], Pz: [46, -90], P4: [60, -51], P8: [92, -36],
  O1: [-92, 72], O2: [92, -72], Oz: [92, -90],
  AFz: [69, 90], TP9: [-115, 18], TP10: [115, -18],
  /* the mastoids (ECT's EEG reference): 10° below TP9/TP10 at the same azimuth, as the 10-5 set places M1/M2 (MNE's
     standard_1005, Oostenveld 2001: M1 at 125°, TP9 at 115°) */
  M1: [-125, 17], M2: [125, -17],
  A1: [-130, 6], A2: [130, -6],
};
export type Electrode = keyof typeof SPHERICAL;
/** The 19 scalp electrodes of the 10-20 system. */
export const E1020 = ['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'T7', 'C3', 'Cz', 'C4', 'T8', 'P7', 'P3', 'Pz', 'P4', 'P8', 'O1', 'O2'] as const;
/** Every electrode the station records from: the 19, the ears, and the sites the ECT device's EEG uses. */
export const ALL_ELECTRODES = [...E1020, 'A1', 'A2', 'Fpz', 'AFz', 'Oz', 'TP9', 'TP10', 'M1', 'M2'] as const;
/** Older names, shown in brackets (ACNS uses T7/T8 and P7/P8). */
export const OLD_NAME: Record<string, string> = { T7: 'T3', T8: 'T4', P7: 'T5', P8: 'T6' };
export const electrodeLabel = (e: string) => (OLD_NAME[e] ? `${e} (${OLD_NAME[e]})` : e);

export function sphericalDir(theta: number, phi: number): Vec3 {
  const t = (theta * Math.PI) / 180, f = (phi * Math.PI) / 180;
  return [Math.sin(t) * Math.cos(f), Math.sin(t) * Math.sin(f), Math.cos(t)];
}
export const electrodeDir = (e: string): Vec3 => { const s = SPHERICAL[e]; if (!s) throw new Error(`unknown electrode ${e}`); return sphericalDir(s[0], s[1]); };

/* ---- the map projection (the head seen from above) --------------------------------------------- */

/** Azimuthal equidistant projection from the vertex: distance from the centre is the angle from Cz, over `maxDeg`.
    The nose is up, the left ear on the left (as an EEG head map is drawn). */
export function toMap(d: Vec3, maxDeg = 130): [number, number] {
  const u = unit(d);
  const ang = Math.acos(Math.max(-1, Math.min(1, u[2])));
  const h = Math.hypot(u[0], u[1]);
  const rho = (ang * 180) / Math.PI / maxDeg;
  return h < 1e-12 ? [0, 0] : [(rho * u[0]) / h, (-rho * u[1]) / h];
}
export function fromMap(x: number, y: number, maxDeg = 130): Vec3 {
  const rho = Math.hypot(x, y), ang = (rho * maxDeg * Math.PI) / 180;
  if (rho < 1e-12) return [0, 0, 1];
  return [(Math.sin(ang) * x) / rho, (Math.sin(ang) * -y) / rho, Math.cos(ang)];
}

/* ---- a patch of cortex as a source ------------------------------------------------------------- */

export interface Patch {
  /** where it is: a point on the map (azimuthal equidistant, ±1 = 130° from the vertex) */
  at: [number, number];
  /** depth of its dipole layer below the brain's surface (mm) */
  depth: number;
  /** area (cm²) */
  area: number;
  /** angle between the patch's negative end and the radial direction (°): 0 radial (a gyral crown), 90 tangential (a sulcal wall) */
  tilt: number;
  /** direction of the tilt as drawn on the map (°, 0 toward the nose, 90 toward the right ear) */
  toward: number;
  /** current dipole moment per area at the peak (nAm/mm²) */
  density: number;
}

export interface PatchPoint { r: Vec3; /** unit direction of the negative end */ q: Vec3; /** area (mm²) */ w: number }

/** The patch as a sheet of dipoles on a sphere of the right depth: rings of points, each with its share of the area,
    each pointing the patch's way relative to its own place on the sphere. */
export function patchPoints(p: Patch, head: Head, rings = 3): PatchPoint[] {
  const Rb = head.radii[0], rs = Math.max(5, Rb - p.depth);
  const c = fromMap(p.at[0], p.at[1]);
  const t = tangentToward(p.at, p.toward);
  const b = cross(c, t);
  const radius = Math.sqrt((p.area * 100) / Math.PI);   // mm on the source sphere
  const pts: Array<[number, number]> = [[0, 0]];
  for (let k = 1; k <= rings; k++) for (let j = 0; j < 6 * k; j++) { const a = (2 * Math.PI * j) / (6 * k); pts.push([(k / rings) * Math.cos(a), (k / rings) * Math.sin(a)]); }
  const w = (p.area * 100) / pts.length;
  const tilt = (p.tilt * Math.PI) / 180;
  return pts.map(([u, v]) => {
    /* walk on the sphere from the centre: arc length radius·√(u²+v²) in the direction u·t + v·b */
    const arc = (radius * Math.hypot(u, v)) / rs;
    const dir = Math.hypot(u, v) < 1e-12 ? t : unit(add(scale(t, u), scale(b, v)));
    const here = unit(add(scale(c, Math.cos(arc)), scale(dir, Math.sin(arc))));
    /* the tangent t carried to this point: its part across the local normal */
    const tl = unit(sub(t, scale(here, dot(t, here))));
    const q = unit(add(scale(here, Math.cos(tilt)), scale(tl, Math.sin(tilt))));
    return { r: scale(here, rs), q, w };
  });
}

/** The direction on the sphere at a map point that moves, on the map, toward the given compass angle. */
export function tangentToward(at: [number, number], toward: number): Vec3 {
  const a = (toward * Math.PI) / 180, h = 1e-4;
  const c = fromMap(at[0], at[1]);
  const d = fromMap(at[0] + h * Math.sin(a), at[1] - h * Math.cos(a));
  const t = sub(d, c);
  return unit(sub(t, scale(c, dot(t, c))));
}

/** A source's field: µV at each electrode for a waveform value of 1 (the peak), negative where the patch's negative end faces. */
export function leadField(model: ForwardModel, pts: PatchPoint[], density: number, electrodes: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of electrodes) {
    const d = electrodeDir(e);
    let v = 0;
    for (const pt of pts) v += model.scalp(pt.r, scale(pt.q, -density * pt.w), d);
    out[e] = v;
  }
  return out;
}

/** The same at any scalp direction (for the map). */
export function fieldAt(model: ForwardModel, pts: PatchPoint[], density: number, at: Vec3): number {
  let v = 0;
  for (const pt of pts) v += model.scalp(pt.r, scale(pt.q, -density * pt.w), at);
  return v;
}

/** Inside the head (for the section): the point in mm. */
export function fieldInside(model: ForwardModel, pts: PatchPoint[], density: number, point: Vec3): number {
  let v = 0;
  for (const pt of pts) v += model.inside(pt.r, scale(pt.q, -density * pt.w), point);
  return v;
}
