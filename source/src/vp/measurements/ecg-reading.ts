import { HeartElectrical, type Activation, type ElectricalParams } from '../physiology/heart/electrical.ts';
import { leadVectors, standardPlacement, measuredAxis, LEAD_NAMES, type LeadName, type Placement } from './ecg.ts';

/* ---------------------------------------------------------------------------
   Reading a 12-lead ECG (ADR-017 step 2): what a careful reader measures on
   the tracing, as observables the knowledge tables can define signs on.

   The heart is recorded again from what drives it now (its parameters, the
   rate it is driven at, potassium and calcium): the electrical model is
   deterministic, so this is the same heart the patient has. Amplitudes are
   measured on the recorded leads against the T–P baseline, at fiducials
   the model knows exactly from its activation log (P, QRS onset, J point,
   T). Intervals are the model's own, as the machine reports them. Nothing
   here interprets: "is there ST elevation" is a sign, defined in
   source/knowledge/signs.json on these numbers.
--------------------------------------------------------------------------- */

export interface EcgReading {
  rate: number; regular: boolean;
  /** what the atria show: P waves, none, fibrillatory or flutter waves */
  pWaves: 'present' | 'absent' | 'fibrillatory' | 'flutter';
  /** P height in II (mV) and duration (ms), when there are P waves */
  pAmplitude: number; pDuration: number;
  pr?: number;
  /** PR lengthening from beat to beat before a P wave that is not conducted */
  prProgressive: boolean;
  /** how P waves relate to QRS complexes */
  conduction: 'all' | 'dropped' | 'dissociated' | 'no-p';
  qrs: number; qtc: number; axis: number;
  /** QRS shape in V1 and V6, as a reader names it */
  v1: string; v6: string;
  /** a slurred, slow start of QRS (pre-excitation) */
  delta: boolean;
  /** ST level at the J point (where the Fourth Universal Definition of MI measures it), and T-wave height (largest
      deflection, signed), per lead (mV) */
  st: Record<LeadName, number>;
  t: Record<LeadName, number>;
  /** the larger U wave in V2 and V3 (mV) */
  u: number;
  /** Sokolow–Lyon voltage: S in V1 plus the larger R in V5 or V6 (mV) */
  sokolow: number;
}

const FS = 500, DT = 1000 / FS;
const RECORD_MS = 12000, KEEP_MS = 8000;
const cache = new Map<string, EcgReading>();

/** Read the ECG of a heart with these parameters, driven at this rate with this potassium and calcium, through electrodes
    placed as given (standard placement by default: a misplaced V1 changes what is read, as it changes the tracing). */
export function readEcg(p: ElectricalParams, drive: { rate: number; K: number; Ca: number }, placement?: Placement): EcgReading {
  const key = JSON.stringify([p, Math.round(drive.rate * 2) / 2, Math.round(drive.K * 20) / 20, Math.round(drive.Ca * 20) / 20, placement ?? null]);
  const hit = cache.get(key);
  if (hit) return hit;
  const h = new HeartElectrical();
  h.setParams(p); h.setPotassium(drive.K); h.setCalcium(drive.Ca);
  h.rateSource = () => drive.rate;
  for (let t = 0; t < RECORD_MS; t += 20) h.step(20);
  const v = h.drain();
  const n = v.X.length, t0 = v.t0;
  const keepFrom = RECORD_MS - KEEP_MS;
  const L = leadVectors(placement ?? standardPlacement());
  const lead = (name: LeadName) => { const a = L[name], out = new Float32Array(n); for (let i = 0; i < n; i++) out[i] = a[0] * v.X[i] + a[1] * v.Y[i] + a[2] * v.Z[i]; return out; };
  const leads = Object.fromEntries(LEAD_NAMES.map((l) => [l, lead(l)])) as Record<LeadName, Float32Array>;
  const at = (x: Float32Array, t: number) => { const i = Math.round((t - t0) / DT); return i >= 0 && i < n ? x[i] : NaN; };
  const span = (x: Float32Array, a: number, b: number) => { const out: number[] = []; for (let t = a; t <= b; t += DT) { const y = at(x, t); if (Number.isFinite(y)) out.push(y); } return out; };
  const median = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((p2, q) => p2 - q); return s[Math.floor(s.length / 2)]; };

  const acts = h.activations.filter((x) => x.t >= keepFrom && (x.kind === 'atria' ? x.end : x.tEnd) < RECORD_MS - 50);
  const A = acts.filter((x): x is Extract<Activation, { kind: 'atria' }> => x.kind === 'atria');
  const V = acts.filter((x): x is Extract<Activation, { kind: 'ventricles' }> => x.kind === 'ventricles');
  const all = h.activations;

  /* The baseline before each beat: the quiet T–P stretch, or just before QRS when there is none. */
  const baseline = (x: Float32Array, b: Extract<Activation, { kind: 'ventricles' }>) => {
    const start = b.delta ?? b.t;
    const prevT = Math.max(-Infinity, ...all.filter((y) => y.kind === 'ventricles' && y.t < b.t).map((y) => (y as typeof b).tEnd));
    const prevP = Math.max(-Infinity, ...all.filter((y) => y.kind === 'atria' && y.t < start).map((y) => y.t));
    const from = Number.isFinite(prevT) ? prevT + 40 : start - 120;
    const to = Math.min(start - 15, prevP > from ? prevP - 10 : start - 15);
    const q = to - from >= 30 ? span(x, from, to) : span(x, start - 40, start - 15);
    return median(q);
  };
  const perBeat = (f: (b: Extract<Activation, { kind: 'ventricles' }>) => number) => median(V.map(f).filter(Number.isFinite));

  /* QRS shape: the deflections above 0.08 mV, in order, named as a reader would. */
  const shape = (x: Float32Array) => mode(V.map((b) => {
    const base = baseline(x, b);
    const lobes: number[] = [];
    let cur = 0;
    for (let t = b.delta ?? b.t; t <= b.qrsEnd; t += DT) {
      const y = at(x, t) - base;
      const s = Math.abs(y) < 0.05 ? 0 : Math.sign(y);
      if (s === 0) { cur = 0; continue; }
      if (s !== Math.sign(cur) || !lobes.length) { lobes.push(y); cur = y; }
      else if (Math.abs(y) > Math.abs(lobes[lobes.length - 1])) { lobes[lobes.length - 1] = y; cur = y; }
    }
    const sig = lobes.filter((y) => Math.abs(y) >= 0.08);
    const merged: number[] = [];
    for (const y of sig) { if (merged.length && Math.sign(merged[merged.length - 1]) === Math.sign(y)) merged[merged.length - 1] = Math.sign(y) * Math.max(Math.abs(y), Math.abs(merged[merged.length - 1])); else merged.push(y); }
    return name(merged);
  }));
  const v1 = shape(leads.V1), v6 = shape(leads.V6);

  const st = Object.fromEntries(LEAD_NAMES.map((l) => [l, round(perBeat((b) => at(leads[l], b.qrsEnd) - baseline(leads[l], b)))])) as Record<LeadName, number>;
  const t = Object.fromEntries(LEAD_NAMES.map((l) => [l, round(perBeat((b) => {
    const base = baseline(leads[l], b);
    let best = 0;
    for (let x = b.tStart; x <= b.tEnd; x += DT) { const y = at(leads[l], x) - base; if (Math.abs(y) > Math.abs(best)) best = y; }
    return best;
  }))])) as Record<LeadName, number>;
  const u = round(Math.max(0, ...(['V2', 'V3'] as LeadName[]).map((l) => perBeat((b) => {
    const base = baseline(leads[l], b);
    const nextP = Math.min(Infinity, ...all.filter((y) => y.t > b.tEnd).map((y) => (y.kind === 'atria' ? y.t : (y.delta ?? y.t))));
    /* A U wave is a wave of its own: a rise after the end of T, measured from the lowest point since T ended, and above
       the baseline. The slow tail of a long ST–T change is not one. */
    let best = 0, low = Infinity;
    for (let x = b.tEnd; x <= Math.min(b.tEnd + 220, nextP - 10); x += DT) {
      const y = at(leads[l], x) - base;
      low = Math.min(low, y);
      if (x >= b.tEnd + 20 && y > 0) best = Math.max(best, Math.min(y, y - low));
    }
    return best;
  }))));
  const sokolow = round(perBeat((b) => {
    const s1 = -Math.min(0, ...span(leads.V1, b.delta ?? b.t, b.qrsEnd).map((y) => y - baseline(leads.V1, b)));
    const r5 = Math.max(0, ...span(leads.V5, b.delta ?? b.t, b.qrsEnd).map((y) => y - baseline(leads.V5, b)));
    const r6 = Math.max(0, ...span(leads.V6, b.delta ?? b.t, b.qrsEnd).map((y) => y - baseline(leads.V6, b)));
    return s1 + Math.max(r5, r6);
  }));

  /* The atria. */
  const pWaves: EcgReading['pWaves'] = p.atrial === 'af' ? 'fibrillatory' : p.atrial === 'flutter' ? 'flutter' : 'present';
  /* A P wave is measured only where nothing ventricular overlaps it: up to the start of the next QRS (a delta wave can
     start before P ends), and not inside a T wave (dissociated P waves in a tachycardia are not readable). */
  const VS = all.filter((y): y is Extract<Activation, { kind: 'ventricles' }> => y.kind === 'ventricles');
  const clean = A.map((a) => {
    const next = VS.find((y) => (y.delta ?? y.t) > a.t);
    const to = Math.min(a.end, next ? (next.delta ?? next.t) : a.end);
    const busy = VS.some((y) => (y.delta ?? y.t) < to && y.tEnd > a.t && (y.delta ?? y.t) <= a.t);
    return { a, to, next, ok: !busy && to - a.t >= 25 };
  }).filter((x) => x.ok && x.next);
  const pAmp = clean.length ? median(clean.map(({ a, to, next }) => { const base = baseline(leads.II, next!); return Math.max(...span(leads.II, a.t, to).map((y) => Math.abs(y - base))); })) : 0;
  const visible = pWaves === 'present' && pAmp >= 0.05;
  const conducted = A.filter((a) => a.conductedAt != null);
  const conduction: EcgReading['conduction'] = !visible ? 'no-p' : conducted.length === A.length ? 'all' : conducted.length === 0 || A.every((a) => a.conductedAt != null || a.notConducted === 'dissociated' || a.notConducted === 'complete-block') ? 'dissociated' : 'dropped';
  let prProgressive = false;
  for (let i = 2; i < A.length; i++) {
    const [a, b, c] = [A[i - 2], A[i - 1], A[i]];
    if (a.conductedAt != null && b.conductedAt != null && c.conductedAt == null && b.conductedAt - b.t > a.conductedAt - a.t + 10) prProgressive = true;
  }
  const rrs = V.slice(1).map((b, i) => b.t - V[i].t);
  const meanRR = rrs.reduce((s, x) => s + x, 0) / Math.max(1, rrs.length);
  const cv = Math.sqrt(rrs.reduce((s, x) => s + (x - meanRR) ** 2, 0) / Math.max(1, rrs.length)) / meanRR;
  const m = h.metrics;
  const out: EcgReading = {
    rate: Math.round(m.HR), regular: cv < 0.08,
    pWaves: pWaves === 'present' && !visible ? 'absent' : pWaves,
    pAmplitude: visible ? round(pAmp) : 0, pDuration: visible ? Math.round(median(A.map((a) => a.end - a.t))) : 0,
    ...(visible && m.PR != null && conducted.length ? { pr: Math.round(m.PR) } : {}),
    prProgressive, conduction,
    /* With the electrodes where a learner put them, the axis is what those leads show (reversed arms flip it). */
    qrs: Math.round(m.QRS), qtc: Math.round(m.QTc), axis: Math.round((placement ? measuredAxis(leads, FS) : null) ?? m.qrsAxis),
    v1, v6, delta: V.some((b) => b.delta != null), st, t, u, sokolow,
  };
  if (cache.size > 200) cache.clear();
  cache.set(key, out);
  return out;
}

/** The most common of a beat-by-beat reading. */
const mode = (xs: string[]) => { const c = new Map<string, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other'; };
const round = (x: number) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : 0);

/* QRS shapes by their deflections: lower case small (< 0.5 mV), upper case large, a prime for a second wave of the same
   polarity. Enough for V1 and V6, where the bundle branch blocks and hypertrophy are read. */
export const SHAPES = ['R', 'Rs', 'RS', 'rS', 'QS', 'qR', 'qRs', 'rSr′', 'rsR′', 'RsR′', 'Qr', 'other'];
function name(d: number[]): string {
  const big = (y: number) => Math.abs(y) >= 0.5;
  const sig = d.map((y) => (y > 0 ? 'p' : 'n')).join('');
  if (sig === 'p') return 'R';
  if (sig === 'n') return 'QS';
  if (sig === 'pn') return big(d[0]) ? (big(d[1]) ? 'RS' : 'Rs') : 'rS';
  if (sig === 'np') return big(d[0]) ? 'Qr' : 'qR';
  if (sig === 'npn') return 'qRs';
  if (sig === 'pnp') return big(d[2]) ? (big(d[0]) ? 'RsR′' : 'rsR′') : 'rSr′';
  return 'other';
}
