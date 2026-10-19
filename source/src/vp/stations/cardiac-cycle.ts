import type { BeatRecord } from '../live/live-patient.ts';

/* ---------------------------------------------------------------------------
   What the heart's mechanics were doing at one instant of a recorded beat
   (ADR-017 step 4).

   Reads the circulation's own beat: its 2 ms samples (pressures, volumes,
   valve flows, activation) and its valve events. From them, for any
   instant: the phase of the cardiac cycle a physiologist would name, and
   the state of each valve. Nothing here is drawn from a template: a valve
   is open when blood flows forward through it in the model, leaking when
   blood flows back through it, closed otherwise.
--------------------------------------------------------------------------- */

export type CyclePhase = 'iso-contraction' | 'ejection' | 'iso-relaxation' | 'rapid-filling' | 'diastasis' | 'atrial-systole';
export const CYCLE_PHASES: CyclePhase[] = ['iso-contraction', 'ejection', 'iso-relaxation', 'rapid-filling', 'diastasis', 'atrial-systole'];

export type ValveState = 'open' | 'closed' | 'leaking';
export interface ValveStates { mitral: ValveState; aortic: ValveState; tricuspid: ValveState; pulmonic: ValveState }

/** Forward flow above which a valve counts as open, and backward flow beyond which a closed valve counts as leaking (mL/s).
    Below these the flow is the valve's own closing motion, not blood moving through it. */
const OPEN_ML_S = 0.5, LEAK_ML_S = 2;
/** Atrial activation above which the atria count as contracting. */
const ATRIA_ON = 0.05;

export interface CycleMoment {
  /** ms from the beat's start (its ventricular activation) */
  t: number;
  phase: CyclePhase;
  valves: ValveStates;
  /** the sample at t */
  s: Record<string, number>;
}

const state = (q: number | undefined): ValveState => (q == null ? 'closed' : q > OPEN_ML_S ? 'open' : q < -LEAK_ML_S ? 'leaking' : 'closed');

/** The sample nearest to t (ms from the beat's start). */
export function sampleAt(b: BeatRecord, t: number): Record<string, number> {
  const S = b.samples;
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m].t < t) lo = m; else hi = m; }
  return Math.abs(S[lo].t - t) <= Math.abs(S[hi].t - t) ? S[lo] : S[hi];
}

/* Landmarks of a beat, read from its flows once: when ejection begins, when filling begins and when it last flows. */
export type Side = 'left' | 'right';
/* each side read from its own valves: outflow (aortic or pulmonary) and inflow (mitral or tricuspid) */
const FLOW: Record<Side, { out: string; inn: string }> = { left: { out: 'Qao', inn: 'Qmit' }, right: { out: 'Qpv', inn: 'Qtri' } };
const marks: Record<Side, WeakMap<BeatRecord, { ejectFrom: number; fillFrom: number; fillTo: number; rapidEnd: number }>> = { left: new WeakMap(), right: new WeakMap() };
function landmarks(b: BeatRecord, side: Side) {
  let m = marks[side].get(b);
  if (m) return m;
  const S = b.samples, f = FLOW[side];
  const ejectFrom = S.find((s) => (s[f.out] ?? 0) > OPEN_ML_S)?.t ?? 50;
  const ejectTo = [...S].reverse().find((s) => (s[f.out] ?? 0) > OPEN_ML_S)?.t ?? b.dur / 2;
  const fill = S.filter((s) => s.t > ejectTo && (s[f.inn] ?? 0) > OPEN_ML_S);
  const fillFrom = fill[0]?.t ?? b.dur, fillTo = fill.at(-1)?.t ?? b.dur;
  /* rapid filling ends where mitral flow falls below 40 % of its early (E) peak, as the circulation defines it; read here from
     the flow itself, from this beat's real opening */
  let ePeak = 0, ePeakT = fillFrom;
  for (const x of fill) if (x.t < fillFrom + 250 && x[f.inn] > ePeak) { ePeak = x[f.inn]; ePeakT = x.t; }
  const rapidEnd = fill.find((x) => x.t > ePeakT && x[f.inn] < 0.4 * ePeak)?.t ?? fillFrom + 150;
  m = { ejectFrom, fillFrom, fillTo, rapidEnd };
  marks[side].set(b, m);
  return m;
}

/** The phase and valve states at t (ms from the beat's start), the phase read from the left heart's valves or the right's. */
export function cycleAt(b: BeatRecord, t: number, side: Side = 'left'): CycleMoment {
  const s = sampleAt(b, t);
  const valves: ValveStates = { mitral: state(s.Qmit), aortic: state(s.Qao), tricuspid: state(s.Qtri), pulmonic: state(s.Qpv) };
  const k = landmarks(b, side);
  const atria = (s.ea ?? 0) > ATRIA_ON;
  const outV = side === 'left' ? 'aortic' : 'pulmonic', inV = side === 'left' ? 'mitral' : 'tricuspid';
  let phase: CyclePhase;
  if (valves[outV] === 'open') phase = 'ejection';
  else if (s.t < k.ejectFrom) phase = 'iso-contraction';
  else if (s.t < k.fillFrom) phase = 'iso-relaxation';
  else if (s.t <= k.fillTo) {
    /* between the mitral valve's opening and its last forward flow it stays open, even while the flow pauses in diastasis */
    if (valves[inV] === 'closed') valves[inV] = 'open';
    phase = atria ? 'atrial-systole' : s.t < k.rapidEnd ? 'rapid-filling' : 'diastasis';
  }
  /* After the last filling the mitral valve has floated shut before the next beat: as the atria relax, or early, when the
     ventricle has filled from a leaking aortic valve. The ventricle is still relaxed: this is the end of diastole. */
  else phase = atria ? 'atrial-systole' : 'diastasis';
  return { t, phase, valves, s };
}

export interface CycleSegment { phase: CyclePhase; from: number; to: number }

/** The beat as consecutive phases (ms from its start). */
export function cycleSegments(b: BeatRecord, side: Side = 'left'): CycleSegment[] {
  const out: CycleSegment[] = [];
  for (const s of b.samples) {
    const p = cycleAt(b, s.t, side).phase;
    const last = out[out.length - 1];
    if (last && last.phase === p) last.to = s.t; else out.push({ phase: p, from: s.t, to: s.t });
  }
  /* each segment runs to the start of the next */
  for (let i = 0; i < out.length - 1; i++) out[i].to = out[i + 1].from;
  if (out.length) out[out.length - 1].to = b.dur;
  return out;
}

/** The valve events of a beat, ms from its start, as the circulation recorded them (closures are heart sounds). */
export function valveEvents(b: BeatRecord): Array<{ id: 'MC' | 'TC' | 'AO' | 'PO' | 'AC' | 'PC' | 'MO' | 'TO'; t: number }> {
  const T = b.times;
  /* the mitral and tricuspid valves of a healthy heart close as the atria relax, often just before the ventricles' activation:
     that closure is recorded late in the previous beat */
  const early = (x: number | null | undefined) => (x == null ? null : x > b.dur / 2 ? x - b.dur : x);
  const list: Array<[any, number | null | undefined]> = [['MC', early(T.m1)], ['TC', early(T.t1)], ['AO', T.avo], ['PO', T.pvo], ['AC', T.a2], ['PC', T.p2], ['MO', T.mvo], ['TO', T.tvo]];
  return list.filter(([, t]) => t != null).map(([id, t]) => ({ id, t: t as number }));
}

/** The mean pressure difference across the open mitral valve in diastole (left atrium minus ventricle, mmHg): how mitral
    stenosis is graded. */
export function meanMitralGradient(b: BeatRecord): number {
  let sum = 0, n = 0;
  for (const s of b.samples) if ((s.Qmit ?? 0) > OPEN_ML_S) { sum += s.Pla - s.Pv; n++; }
  return n ? sum / n : 0;
}
