import type { Activation } from '../physiology/heart/electrical.ts';
import { axisFromIandAvf, type LeadName, type Vcg } from '../measurements/ecg.ts';

/* ---------------------------------------------------------------------------
   The QRS axis, as the ECG station teaches it (ADR-017, 9b).

   The mean QRS vector is the recorded dipole integrated over one QRS. Each
   limb lead's net QRS is that vector projected on the lead's own vector
   (through the electrodes as they are). The axis a reader or a machine
   reports is read from leads I and aVF on Einthoven's ideal circle
   (I = |M| cos θ, aVF = (√3/2)|M| sin θ), whatever the electrodes really
   did; reading the same heart through electrodes at the standard
   positions tells an electrode error from a change in the heart.
--------------------------------------------------------------------------- */

type V3 = [number, number, number];
const angle = (a: number, b: number) => (Math.atan2(b, a) * 180) / Math.PI;
const dot = (a: ArrayLike<number>, m: ArrayLike<number>) => a[0] * m[0] + a[1] * m[1] + a[2] * m[2];
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/** The Cabrera order, each with its angle on the ideal circle. −aVR is aVR with its sign turned. */
export const CABRERA: Array<{ name: string; lead: LeadName; sign: 1 | -1; deg: number }> = [
  { name: 'aVL', lead: 'aVL', sign: 1, deg: -30 }, { name: 'I', lead: 'I', sign: 1, deg: 0 }, { name: '−aVR', lead: 'aVR', sign: -1, deg: 30 },
  { name: 'II', lead: 'II', sign: 1, deg: 60 }, { name: 'aVF', lead: 'aVF', sign: 1, deg: 90 }, { name: 'III', lead: 'III', sign: 1, deg: 120 },
];

export interface AxisLead { name: string; deg: number; area: number; complex: Float32Array }
export interface AxisReading {
  /** the mean QRS vector (mV·ms), in body coordinates: x to the patient's left, y to the feet, z back */
  mean: V3;
  /** the dipole's frontal path through the QRS (mV, from its baseline) */
  loop: Array<[number, number]>;
  leads: AxisLead[];
  /** the axis read from I and aVF on the ideal circle (°), the vector that reading implies, and the heart's own direction */
  read: number; readVector: [number, number]; own: number;
  /** the same heart read through electrodes at the standard positions, and whether this reading differs from it */
  standard: number; misplaced: boolean;
  /** the limb lead whose net QRS is smallest */
  isoelectric: string;
}

/** Read the axis of the last complete QRS at or before `at` (ms on the heart's clock), or null if there is none. */
export function readAxis(rec: { vcg: Vcg; t0: number; dt: number; activations: Activation[] }, vectors: Record<LeadName, ArrayLike<number> | null>,
  standard: Record<LeadName, ArrayLike<number>>, at = Infinity): AxisReading | null {
  const n = rec.vcg.X.length, tEnd = rec.t0 + (n - 1) * rec.dt;
  const vs = rec.activations.filter((a): a is Extract<Activation, { kind: 'ventricles' }> => a.kind === 'ventricles' && a.qrsEnd <= tEnd && (a.delta ?? a.t) >= rec.t0 + 15);
  const v = [...vs].reverse().find((a) => (a.delta ?? a.t) <= at) ?? vs.at(-1);
  if (!v) return null;
  const idx = (tt: number) => Math.max(0, Math.min(n - 1, Math.round((tt - rec.t0) / rec.dt)));
  const i0 = idx(v.delta ?? v.t), i1 = idx(v.qrsEnd), ib = Math.max(0, i0 - 5);
  const X = rec.vcg.X, Y = rec.vcg.Y, Z = rec.vcg.Z;
  /* the baseline: the dipole just before QRS */
  const b: V3 = [X[ib], Y[ib], Z[ib]];
  const mean: V3 = [0, 0, 0], loop: Array<[number, number]> = [];
  for (let i = i0; i <= i1; i++) {
    mean[0] += (X[i] - b[0]) * rec.dt; mean[1] += (Y[i] - b[1]) * rec.dt; mean[2] += (Z[i] - b[2]) * rec.dt;
    if ((i - i0) % 2 === 0) loop.push([X[i] - b[0], Y[i] - b[1]]);
  }
  const j0 = idx((v.delta ?? v.t) - 30), j1 = idx(v.qrsEnd + 30);
  const leads: AxisLead[] = CABRERA.map((c) => {
    const raw = vectors[c.lead] ?? [0, 0, 0];
    const lv: V3 = [raw[0] * c.sign, raw[1] * c.sign, raw[2] * c.sign];
    const complex = new Float32Array(j1 - j0 + 1), base = dot(lv, b);
    for (let i = j0; i <= j1; i++) complex[i - j0] = lv[0] * X[i] + lv[1] * Y[i] + lv[2] * Z[i] - base;
    return { name: c.name, deg: c.deg, area: dot(lv, mean), complex };
  });
  const areaOf = (name: string) => leads.find((l) => l.name === name)!.area;
  const readVector: [number, number] = [areaOf('I'), (2 * areaOf('aVF')) / Math.sqrt(3)];
  const read = axisFromIandAvf(areaOf('I'), areaOf('aVF'));
  const std = axisFromIandAvf(dot(standard.I, mean), dot(standard.aVF, mean));
  const iso = leads.reduce((best, l) => (Math.abs(l.area) < Math.abs(best.area) ? l : best), leads[0]);
  return { mean, loop, leads, read, readVector, own: angle(mean[0], mean[1]), standard: std, misplaced: Math.abs(wrap(read - std)) > 15, isoelectric: iso.name };
}

/** German teaching names the axis by Lagetyp, in 30° steps. */
export function lagetyp(d: number): string {
  const x = wrap(d);
  return x < -30 ? 'überdrehter Linkstyp' : x < 30 ? 'Linkstyp' : x < 60 ? 'Indifferenztyp' : x < 90 ? 'Steiltyp' : x <= 120 ? 'Rechtstyp' : 'überdrehter Rechtstyp';
}
