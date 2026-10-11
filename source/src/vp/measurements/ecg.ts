import type { LocalizedText } from '../model/i18n.ts';
import type { Vec3 } from '../physiology/heart/electrical.ts';

/* ===========================================================================
   The ECG as a measurement.

   An electrode on the skin sees the heart's dipole H(t) through the body:
   its potential is H · L, where L, the lead vector, depends on where the
   electrode sits. A lead is the difference between two such potentials (or
   between one and Wilson's central terminal, the mean of the three limb
   electrodes). So the twelve leads are twelve views of one vector, and
   where the electrodes are placed is part of the measurement.

   Lead vectors at the standard positions are Dower's (the inverse Dower
   transform from Frank X, Y, Z). Away from them, a precordial electrode's
   lead vector follows a field fitted to those six vectors, a dipole-like
   falloff from a source in the heart, so a V1 placed two spaces too high
   records what a high V1 records: a smaller r, an inverted P, an rSr′.
=========================================================================== */

export const LEAD_NAMES = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'] as const;
export type LeadName = typeof LEAD_NAMES[number];
export type ElectrodeId = 'RA' | 'LA' | 'LL' | 'RL' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6';
export const ELECTRODES: ElectrodeId[] = ['RA', 'LA', 'LL', 'RL', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

/** Where an electrode is: a limb, or a point on the chest wall (angle from the anterior midline toward the patient's left, degrees; height in cm below the 4th intercostal space). */
export type Site = { limb: 'right-arm' | 'left-arm' | 'left-leg' | 'right-leg' } | { chest: { phi: number; y: number } };
export type Placement = Record<ElectrodeId, Site>;

/* Torso cross-section (cm): an ellipse 30 cm wide and 20 cm deep. One intercostal space ≈ 2.5 cm. */
const A = 15, B = 10;
export function chestPoint(phi: number, y: number): Vec3 {
  const r = (phi * Math.PI) / 180;
  return [A * Math.sin(r), y, -B * Math.cos(r)];
}

/** The standard placement, with the landmark each position is found by. */
export const STANDARD_SITES: Record<ElectrodeId, { site: Site; landmark: LocalizedText }> = {
  RA: { site: { limb: 'right-arm' }, landmark: { en: 'Right arm (wrist or shoulder)', de: 'Rechter Arm (Handgelenk oder Schulter)' } },
  LA: { site: { limb: 'left-arm' }, landmark: { en: 'Left arm', de: 'Linker Arm' } },
  LL: { site: { limb: 'left-leg' }, landmark: { en: 'Left leg', de: 'Linkes Bein' } },
  RL: { site: { limb: 'right-leg' }, landmark: { en: 'Right leg (neutral)', de: 'Rechtes Bein (Erde)' } },
  V1: { site: { chest: { phi: -9.6, y: 0 } }, landmark: { en: '4th intercostal space, right sternal edge', de: '4. ICR rechts parasternal' } },
  V2: { site: { chest: { phi: 9.6, y: 0 } }, landmark: { en: '4th intercostal space, left sternal edge', de: '4. ICR links parasternal' } },
  V3: { site: { chest: { phi: 22, y: 1.25 } }, landmark: { en: 'Midway between V2 and V4', de: 'Zwischen V2 und V4' } },
  V4: { site: { chest: { phi: 36.9, y: 2.5 } }, landmark: { en: '5th intercostal space, midclavicular line', de: '5. ICR, Medioklavikularlinie' } },
  V5: { site: { chest: { phi: 62, y: 2.5 } }, landmark: { en: 'Anterior axillary line, level of V4', de: 'Vordere Axillarlinie, Höhe V4' } },
  V6: { site: { chest: { phi: 90, y: 2.5 } }, landmark: { en: 'Mid-axillary line, level of V4', de: 'Mittlere Axillarlinie, Höhe V4' } },
};
export const standardPlacement = (): Placement =>
  Object.fromEntries(ELECTRODES.map((e) => [e, JSON.parse(JSON.stringify(STANDARD_SITES[e].site))])) as Placement;

/* ---- lead vectors ---------------------------------------------------------------------------- */
// Inverse Dower transform (Edenbrandt & Pahlm 1988), Frank X (left), Y (feet), Z (back).
const DOWER: Record<LeadName, Vec3> = {
  I: [0.632, -0.235, 0.059], II: [0.235, 1.066, -0.132], III: [-0.397, 1.301, -0.191],
  aVR: [-0.434, -0.415, 0.037], aVL: [0.515, -0.768, 0.125], aVF: [-0.081, 1.184, -0.162],
  V1: [-0.515, 0.157, -0.917], V2: [0.044, 0.164, -1.387], V3: [0.882, 0.098, -1.277],
  V4: [1.213, 0.127, -0.601], V5: [1.125, 0.127, -0.086], V6: [0.831, 0.076, 0.230],
};
// Limb electrode vectors relative to Wilson's terminal: RA = −(I+II)/3, LA = (2I−II)/3, LL = (2II−I)/3.
const comb = (a: Vec3, ka: number, b: Vec3, kb: number): Vec3 => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
const LIMB: Record<'right-arm' | 'left-arm' | 'left-leg' | 'right-leg', Vec3> = {
  'right-arm': comb(DOWER.I, -1 / 3, DOWER.II, -1 / 3),
  'left-arm': comb(DOWER.I, 2 / 3, DOWER.II, -1 / 3),
  'left-leg': comb(DOWER.I, -1 / 3, DOWER.II, 2 / 3),
  'right-leg': comb(DOWER.I, -1 / 3, DOWER.II, 2 / 3),     // both legs sit at nearly the same potential
};

/* Precordial field fitted to Dower's six vectors: L(p) = G (p − h) / (|p − h|² + r0²)^(n/2) + c. */
const FIT = { h: [2.7919, -0.5304, -3.2349] as Vec3, G: 2008.453, n: 3.8714, r0: 8.1474, c: [0.2378, -0.1107, 0.0501] as Vec3 };
function field(p: Vec3): Vec3 {
  const d: Vec3 = [p[0] - FIT.h[0], p[1] - FIT.h[1], p[2] - FIT.h[2]];
  const r = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2] + FIT.r0 * FIT.r0);
  const k = FIT.G / Math.pow(r, FIT.n);
  return [d[0] * k + FIT.c[0], d[1] * k + FIT.c[1], d[2] * k + FIT.c[2]];
}
const PRECORDIAL = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'] as const;
const RESIDUAL = PRECORDIAL.map((v) => {
  const s = (STANDARD_SITES[v].site as { chest: { phi: number; y: number } }).chest;
  const f = field(chestPoint(s.phi, s.y));
  return { phi: s.phi, y: s.y, r: [DOWER[v][0] - f[0], DOWER[v][1] - f[1], DOWER[v][2] - f[2]] as Vec3 };
});

/** The lead vector (relative to Wilson's terminal) of an electrode at a site. */
export function siteVector(site: Site): Vec3 {
  if ('limb' in site) return LIMB[site.limb];
  const { phi, y } = site.chest;
  const f = field(chestPoint(phi, y));
  // exact at the six standard positions, smooth between them
  let wsum = 0; const corr: Vec3 = [0, 0, 0];
  for (const q of RESIDUAL) {
    const d2 = ((phi - q.phi) / 12) ** 2 + ((y - q.y) / 2.5) ** 2;
    if (d2 < 1e-9) return DOWER[PRECORDIAL[RESIDUAL.indexOf(q)]];
    const w = 1 / (d2 * d2);
    wsum += w; corr[0] += w * q.r[0]; corr[1] += w * q.r[1]; corr[2] += w * q.r[2];
  }
  // the correction fades away from the region the fit was made on
  const near = Math.min(...RESIDUAL.map((q) => Math.hypot((phi - q.phi) / 12, (y - q.y) / 2.5)));
  const fade = Math.exp(-near * near / 4);
  return [f[0] + (corr[0] / wsum) * fade, f[1] + (corr[1] / wsum) * fade, f[2] + (corr[2] / wsum) * fade];
}

/** The twelve leads' vectors for a placement: what each lead sees of the heart. */
export function leadVectors(pl: Placement): Record<LeadName, Vec3> {
  const u = (e: ElectrodeId) => siteVector(pl[e]);
  const RA = u('RA'), LA = u('LA'), LL = u('LL');
  const wct: Vec3 = [(RA[0] + LA[0] + LL[0]) / 3, (RA[1] + LA[1] + LL[1]) / 3, (RA[2] + LA[2] + LL[2]) / 3];
  const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const half = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const out = {
    I: sub(LA, RA), II: sub(LL, RA), III: sub(LL, LA),
    aVR: sub(RA, half(LA, LL)), aVL: sub(LA, half(RA, LL)), aVF: sub(LL, half(RA, LA)),
  } as Record<LeadName, Vec3>;
  for (const v of PRECORDIAL) out[v] = sub(u(v), wct);
  return out;
}

export interface Vcg { X: ArrayLike<number>; Y: ArrayLike<number>; Z: ArrayLike<number>; fs: number }

/** Record: project the dipole onto each lead. */
export function recordLeads(vcg: Vcg, pl: Placement = standardPlacement()): Record<LeadName, Float32Array> {
  const L = leadVectors(pl);
  const n = vcg.X.length;
  const out = {} as Record<LeadName, Float32Array>;
  for (const name of LEAD_NAMES) {
    const v = L[name], a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = v[0] * vcg.X[i] + v[1] * vcg.Y[i] + v[2] * vcg.Z[i];
    out[name] = a;
  }
  return out;
}

/** The machine's frontal axis: net QRS area in I and aVF, around each complex it detects. */
export function measuredAxis(leads: Record<LeadName, Float32Array>, fs: number): number | null {
  const I = leads.I, F = leads.aVF, n = I.length;
  // detect complexes on the spatial slope of II and V2 together
  const slope = new Float32Array(n);
  for (let i = 1; i < n; i++) slope[i] = Math.abs(leads.II[i] - leads.II[i - 1]) + Math.abs(leads.V2[i] - leads.V2[i - 1]) + Math.abs(leads.V5[i] - leads.V5[i - 1]);
  let max = 0; for (let i = 0; i < n; i++) max = Math.max(max, slope[i]);
  if (max <= 0) return null;
  const refractory = Math.round(0.3 * fs), w0 = Math.round(0.06 * fs), w1 = Math.round(0.08 * fs);
  let ai = 0, af = 0, beats = 0;
  for (let i = w0; i < n - w1; i++) {
    if (slope[i] > 0.45 * max && slope[i] >= slope[i - 1] && slope[i] >= slope[i + 1]) {
      // baseline just before the complex
      const b0 = Math.max(0, i - w0 - Math.round(0.02 * fs));
      const bi = I[b0], bf = F[b0];
      for (let j = i - w0; j < i + w1; j++) { ai += I[j] - bi; af += F[j] - bf; }
      beats++; i += refractory;
    }
  }
  if (!beats) return null;
  return Math.round((Math.atan2(af, ai) * 180) / Math.PI);
}

/** Electrode misplacements worth knowing, as placements. */
export function misplaced(kind: 'arm-reversal' | 'v1v2-high' | 'precordial-low' | 'leg-arm'): Placement {
  const p = standardPlacement();
  if (kind === 'arm-reversal') { p.RA = { limb: 'left-arm' }; p.LA = { limb: 'right-arm' }; }
  if (kind === 'leg-arm') { p.RA = { limb: 'left-leg' }; p.LL = { limb: 'right-arm' }; }
  if (kind === 'v1v2-high') { p.V1 = { chest: { phi: -9.6, y: -5 } }; p.V2 = { chest: { phi: 9.6, y: -5 } }; }
  if (kind === 'precordial-low') for (const v of PRECORDIAL) { const c = (p[v] as { chest: { phi: number; y: number } }).chest; c.y += 5; }
  return p;
}
