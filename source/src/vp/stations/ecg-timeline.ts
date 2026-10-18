import type { Activation } from '../physiology/heart/electrical.ts';

/* ---------------------------------------------------------------------------
   What the heart was doing at one instant of a recorded strip.

   Reads the electrical model's activation log (ADR-017): every atrial and
   ventricular activation with its timing, on the clock of the dipole
   samples. From it, for any instant: the phase a clinician would name on
   the tracing, and the state of each part of the conduction system, for
   the station's drawing of the heart. Nothing here is drawn from a
   template: a moment is a reading of what the model scheduled.
--------------------------------------------------------------------------- */

export type EcgPhase = 'rest' | 'P' | 'PR' | 'QRS' | 'ST' | 'T';
export const PHASES: EcgPhase[] = ['rest', 'P', 'PR', 'QRS', 'ST', 'T'];

type Atria = Extract<Activation, { kind: 'atria' }>;
type Ventricles = Extract<Activation, { kind: 'ventricles' }>;

/** The AV node takes the impulse once the right atrium has carried it across (about 40 ms after the sinus node fires). */
const AV_ENTRY_MS = 40;
/** The His bundle and bundle branches are active over the last part of the PR interval (the H–V interval) and the first of QRS. */
const HV_MS = 45, BRANCH_INTO_QRS_MS = 25;
/** How long a non-conducted impulse is shown waiting in the AV node. */
const BLOCKED_SHOW_MS = 160;

export interface Moment {
  t: number;
  /** what a clinician would name on the tracing at this instant */
  phase: EcgPhase;
  atria: 'resting' | 'depolarising' | 'depolarised' | 'fibrillating' | 'flutter';
  avNode: 'idle' | 'conducting' | 'blocked';
  bundles: 'idle' | 'conducting';
  ventricles: 'resting' | 'depolarising' | 'plateau' | 'repolarising';
  /** during QRS behind a blocked bundle: the late ventricle, and whether the wave has reached it yet */
  late: { chamber: 'RV' | 'LV'; reached: boolean } | null;
  /** the activations in play at this instant */
  a: Atria | null;
  v: Ventricles | null;
  /** this P wave does not reach the ventricles (a dropped beat, complete block, or ventricles still refractory) */
  dropped: boolean;
}

const latest = <T extends Activation>(xs: T[], t: number): T | null => {
  let best: T | null = null;
  for (const x of xs) if (x.t <= t && (!best || x.t > best.t)) best = x;
  return best;
};

/** The moment at time t (ms on the activations' clock). `atrial` is the model's atrial rhythm. */
export function momentAt(acts: Activation[], t: number, atrial: 'sinus' | 'af' | 'flutter' = 'sinus'): Moment {
  const A = acts.filter((x): x is Atria => x.kind === 'atria');
  const V = acts.filter((x): x is Ventricles => x.kind === 'ventricles');
  const a = latest(A, t), v = latest(V, t);
  const m: Moment = { t, phase: 'rest', atria: 'resting', avNode: 'idle', bundles: 'idle', ventricles: 'resting', late: null, a: null, v: null, dropped: false };

  if (atrial === 'af') m.atria = 'fibrillating';
  else if (atrial === 'flutter') m.atria = 'flutter';
  else if (a) {
    const settled = a.conductedAt ?? a.end + BLOCKED_SHOW_MS;
    if (t < a.end) { m.atria = 'depolarising'; m.a = a; }
    else if (t < Math.max(settled, a.end + 80)) { m.atria = 'depolarised'; m.a = a; }
    if (t >= a.t + AV_ENTRY_MS) {
      if (a.conductedAt != null && t < a.conductedAt) { m.avNode = 'conducting'; m.a = a; }
      else if (a.conductedAt == null && a.notConducted !== 'dissociated' && t < a.end + BLOCKED_SHOW_MS) { m.avNode = 'blocked'; m.a = a; m.dropped = true; }
    }
    if (a.conductedAt != null && t >= a.conductedAt - HV_MS && t < a.conductedAt) m.bundles = 'conducting';
  }

  /* With pre-excitation the next beat's ventricles start through the accessory pathway before the AV node delivers it. */
  const next = V.find((x) => x.delta != null && x.delta <= t && x.t > t);
  const vv = next ?? v;
  if (vv && t < vv.tEnd) {
    const v = vv;
    m.v = v;
    if (t < v.qrsEnd) {
      m.ventricles = 'depolarising';
      if (v.route !== 'ectopic' && t < v.t + BRANCH_INTO_QRS_MS) m.bundles = 'conducting';
      if (v.late) m.late = { chamber: v.late.chamber, reached: t >= v.late.from };
    } else if (t < v.tStart) m.ventricles = 'plateau';
    else m.ventricles = 'repolarising';
  }

  /* The phase the tracing shows: the larger, ventricular deflections hide what the atria do under them. */
  if (m.ventricles === 'depolarising') m.phase = 'QRS';
  else if (m.atria === 'depolarising') m.phase = 'P';
  else if (m.ventricles === 'repolarising') m.phase = 'T';
  else if (m.ventricles === 'plateau') m.phase = 'ST';
  else if (m.avNode === 'conducting') m.phase = 'PR';
  return m;
}

export interface Segment { phase: Exclude<EcgPhase, 'rest'>; from: number; to: number }

/** Every P, PR, QRS, ST and T in the window [t0, t1], in time order. */
export function segments(acts: Activation[], t0: number, t1: number): Segment[] {
  const out: Segment[] = [];
  for (const x of acts) {
    if (x.kind === 'atria') {
      out.push({ phase: 'P', from: x.t, to: x.end });
      if (x.conductedAt != null) out.push({ phase: 'PR', from: x.end, to: x.conductedAt });
    } else {
      out.push({ phase: 'QRS', from: x.delta ?? x.t, to: x.qrsEnd });
      if (x.tStart > x.qrsEnd) out.push({ phase: 'ST', from: x.qrsEnd, to: x.tStart });
      out.push({ phase: 'T', from: x.tStart, to: x.tEnd });
    }
  }
  return out.filter((s) => s.to > t0 && s.from < t1 && s.to > s.from).sort((p, q) => p.from - q.from);
}

/** A time inside the given phase, as near the middle of the window as possible (for "show me the QRS"). Null when the
    window has none: no P waves in atrial fibrillation, no diastole in a fast tachycardia. */
export function findPhase(acts: Activation[], t0: number, t1: number, phase: EcgPhase, atrial: 'sinus' | 'af' | 'flutter' = 'sinus'): number | null {
  const mid = (t0 + t1) / 2;
  const candidates: number[] = [];
  if (phase === 'rest') {
    for (let t = t0 + 10; t < t1 - 10; t += 10) if (momentAt(acts, t, atrial).phase === 'rest') candidates.push(t);
    /* the middle of the longest quiet stretch nearest the middle */
    const runs: Array<[number, number]> = [];
    for (const t of candidates) { const r = runs[runs.length - 1]; if (r && t - r[1] <= 10) r[1] = t; else runs.push([t, t]); }
    const good = runs.filter((r) => r[1] - r[0] >= 40);
    if (!good.length) return null;
    good.sort((p, q) => Math.abs((p[0] + p[1]) / 2 - mid) - Math.abs((q[0] + q[1]) / 2 - mid));
    return (good[0][0] + good[0][1]) / 2;
  }
  for (const s of segments(acts, t0, t1)) {
    if (s.phase !== phase) continue;
    const c = (Math.max(s.from, t0) + Math.min(s.to, t1)) / 2;
    if (momentAt(acts, c, atrial).phase === phase) candidates.push(c);
  }
  if (!candidates.length) return null;
  candidates.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid));
  return candidates[0];
}
