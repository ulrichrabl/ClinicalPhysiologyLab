import type { EcgMetrics, LeadName } from '../types/index.ts';
import { LEADS } from '../types/index.ts';

/** Rule-based feature extraction from generated waveforms (spec §20). */
export function measureFeatures(
  buffers: Record<LeadName, number[]>,
  sampleRateHz: number,
): EcgMetrics {
  const ii = buffers.II;
  if (ii.length < sampleRateHz) {
    return { HR: 72, PR: 160, QRS: 90, QT: 380, QTc: 410, qrsAxis: 60, pAxis: 45, tAxis: 50 };
  }

  const beatLen = findBeatLength(ii, sampleRateHz);
  const HR = Math.round(60000 / Math.max(300, beatLen));
  const peak = findRPeak(ii);
  const base = localBaseline(ii, peak);

  const qrsStart = findQrsEdge(ii, base, peak, -1);
  let qrsEnd = findQrsEdge(ii, base, peak, +1);
  /* If ST stays elevated (any lead), the isoelectric walk eats the plateau.
     Cap J-point — check precordials too (anterior STEMI may spare lead II). */
  {
    const lo = peak + Math.floor(0.08 * sampleRateHz);
    const hi = peak + Math.floor(0.14 * sampleRateHz);
    let stMax = meanRange(ii, lo, hi) - base;
    for (const l of ['V2', 'V3', 'V4', 'III', 'aVF'] as LeadName[]) {
      const sig = buffers[l];
      if (!sig || sig.length < hi) continue;
      const b = localBaseline(sig, Math.min(peak, sig.length - 1));
      stMax = Math.max(stMax, Math.abs(meanRange(sig, lo, hi) - b));
    }
    if (stMax > 0.08) {
      const jCap = peak + Math.floor(0.08 * sampleRateHz);
      if (qrsEnd > jCap) qrsEnd = jCap;
    }
  }
  const pStart = findPStart(ii, base, qrsStart);
  const tEnd = findTEnd(ii, base, qrsEnd);

  let PR = Math.round(((qrsStart - pStart) / sampleRateHz) * 1000);
  let QRS = Math.round(((qrsEnd - qrsStart) / sampleRateHz) * 1000);
  let QT = Math.round(((tEnd - qrsStart) / sampleRateHz) * 1000);

  /* Clamp absurd values from flat / arrhythmic traces. */
  if (PR < 80 || PR > 400) PR = 160;
  if (QRS < 55) QRS = 70;
  if (QRS > 200) QRS = 160;
  if (QT < 220 || QT > 600) QT = Math.round(370 * Math.sqrt(beatLen / 1000));
  const QTc = Math.round(QT / Math.sqrt(Math.max(0.3, beatLen / 1000)));

  const qrsAxis = measureAxis(buffers, 'qrs', peak);
  const pAxis = measureAxis(buffers, 'p', peak);
  const tAxis = measureAxis(buffers, 't', peak);

  return { HR, PR, QRS, QT, QTc, qrsAxis, pAxis, tAxis };
}

function meanRange(signal: number[], a: number, b: number): number {
  const lo = Math.max(0, Math.min(a, b));
  const hi = Math.min(signal.length, Math.max(a, b));
  if (hi <= lo) return 0;
  let s = 0;
  for (let i = lo; i < hi; i++) s += signal[i];
  return s / (hi - lo);
}

function localBaseline(signal: number[], peak: number): number {
  const a = Math.max(0, peak - Math.floor(signal.length * 0.35));
  const b = Math.max(0, peak - Math.floor(signal.length * 0.18));
  if (b <= a + 2) {
    const tail = signal.slice(Math.floor(signal.length * 0.85));
    return tail.reduce((s, c) => s + c, 0) / tail.length;
  }
  let sum = 0;
  for (let i = a; i < b; i++) sum += signal[i];
  return sum / (b - a);
}

function findBeatLength(ii: number[], fs: number): number {
  const peakAbs = Math.max(...ii.map(Math.abs), 0.2);
  const thresh = Math.max(0.18, 0.45 * peakAbs);
  const minGap = Math.floor(0.36 * fs);
  let lastPeak = -1;
  let armed = true;
  const intervals: number[] = [];
  for (let i = 1; i < ii.length - 1; i++) {
    const v = ii[i];
    /* Require a return toward baseline before the next R — stops STEMI
       tombstone plateaus and BBB notches from inflating HR. */
    if (!armed && lastPeak >= 0 && v < thresh * 0.45) armed = true;
    if (!armed) continue;
    if (v > thresh && v > ii[i - 1] && v >= ii[i + 1]) {
      if (lastPeak >= 0 && i - lastPeak >= minGap) intervals.push(i - lastPeak);
      if (lastPeak < 0 || i - lastPeak >= minGap) {
        lastPeak = i;
        armed = false;
      }
    }
  }
  if (intervals.length === 0) return 833;
  intervals.sort((a, b) => a - b);
  return (intervals[Math.floor(intervals.length / 2)] / fs) * 1000;
}

function findQrsEdge(ii: number[], base: number, peak: number, dir: -1 | 1): number {
  const amp = Math.abs(ii[peak] - base);
  const thresh = Math.max(0.06, 0.12 * amp);
  /* For multiphasic BBB, late R'/S' can sit 80–120 ms after the first peak. */
  const limit = dir < 0 ? Math.max(0, peak - 90) : Math.min(ii.length - 1, peak + 140);

  /* Anchor on the latest dominant peak so R' is inside the QRS window. */
  let anchor = peak;
  if (dir > 0) {
    const hi = Math.min(ii.length - 1, peak + 110);
    for (let i = peak + 12; i < hi; i++) {
      if (ii[i] > ii[i - 1] && ii[i] >= ii[i + 1] && ii[i] - base > 0.35 * amp) {
        anchor = i;
      }
    }
    /* STEMI tombstone (no late R'): J-point = slope break onto elevated ST. */
    const stSlice = ii.slice(anchor + 35, anchor + 70);
    const stMean = stSlice.length
      ? stSlice.reduce((s, c) => s + c, 0) / stSlice.length
      : base;
    const multiphasic = anchor - peak >= 20;
    if (!multiphasic && stMean - base > 0.22 * amp) {
      const jHi = Math.min(ii.length - 2, peak + 70);
      for (let i = peak + 10; i < jHi; i++) {
        const slope = ii[i + 1] - ii[i - 1];
        if (ii[peak] - ii[i] > 0.3 * amp && Math.abs(slope) < 0.02) return i;
      }
    }
  }

  let lastActive = anchor;
  let i = anchor;
  let near = 0;
  while (dir < 0 ? i > limit : i < limit) {
    i += dir;
    if (Math.abs(ii[i] - base) >= thresh) {
      lastActive = i;
      near = 0;
    } else {
      near++;
      /* Require a longer isoelectric dwell before declaring the J-point, so a
         brief notch between R and R' is not treated as QRS end. */
      if (near >= 6 && Math.abs(lastActive - anchor) >= 8) return lastActive + dir;
    }
  }
  return lastActive;
}

function findPStart(ii: number[], base: number, qrsStart: number): number {
  const lo = Math.max(0, qrsStart - 140);
  let best = qrsStart - 70;
  let bestScore = 0;
  for (let i = qrsStart - 20; i > lo; i--) {
    const score = Math.abs(ii[i] - base);
    if (score > bestScore && score > 0.025) {
      bestScore = score;
      best = i;
    }
  }
  /* Walk left to onset. */
  let i = best;
  while (i > lo && Math.abs(ii[i] - base) > 0.02) i--;
  return i;
}

function findTEnd(ii: number[], base: number, qrsEnd: number): number {
  const hi = Math.min(ii.length - 1, qrsEnd + 280);
  let peakT = qrsEnd + 40;
  let peakV = 0;
  for (let i = qrsEnd + 20; i < hi; i++) {
    const v = Math.abs(ii[i] - base);
    if (v > peakV) { peakV = v; peakT = i; }
  }
  let i = peakT;
  let near = 0;
  while (i < hi) {
    i++;
    if (Math.abs(ii[i] - base) < 0.035) {
      near++;
      if (near >= 3) return i;
    } else near = 0;
  }
  return Math.min(hi, peakT + 60);
}

function measureAxis(
  buffers: Record<LeadName, number[]>,
  wave: 'qrs' | 'p' | 't',
  peak: number,
): number {
  const slice = (sig: number[]) => {
    const b = localBaseline(sig, peak);
    const start = wave === 'p' ? peak - 90 : wave === 'qrs' ? peak - 25 : peak + 45;
    const end = start + (wave === 'qrs' ? 55 : 70);
    const a = Math.max(0, start);
    const z = Math.min(sig.length, end);
    if (z <= a + 2) return 0;
    let s = 0;
    for (let i = a; i < z; i++) s += sig[i] - b;
    return s / (z - a);
  };
  return Math.round(Math.atan2(slice(buffers.aVF), slice(buffers.I)) * 180 / Math.PI);
}

function findRPeak(ii: number[]): number {
  let best = Math.floor(ii.length * 0.55);
  let bestV = -Infinity;
  const lo = Math.floor(ii.length * 0.2);
  const hi = Math.floor(ii.length * 0.92);
  for (let i = lo; i < hi; i++) {
    if (ii[i] > bestV) { bestV = ii[i]; best = i; }
  }
  return best;
}

/** Rule-based interpretation — no access to disease names (spec §21). */
export function interpret(metrics: EcgMetrics, leads: Record<LeadName, number[]>): import('../types/index.ts').InterpretationReport {
  const rhythm = metrics.HR > 100 ? 'Sinus tachycardia' : metrics.HR < 60 ? 'Sinus bradycardia' : 'Sinus rhythm';
  const rate = `${metrics.HR} bpm`;
  const conduction: string[] = [];
  if (metrics.PR > 200) conduction.push('First-degree AV block');
  if (metrics.QRS >= 120) conduction.push('Intraventricular conduction delay');
  if (metrics.QRS >= 120 && leads.V1.slice(-200).some((v) => v > 0.25)) conduction.push('Right bundle branch block pattern');
  if (metrics.QRS >= 120 && leads.I.slice(-200).some((v) => v > 0.45)) conduction.push('Left bundle branch block pattern');

  const axis: string[] = [];
  if (metrics.qrsAxis > 90) axis.push('Right axis deviation');
  else if (metrics.qrsAxis < -30) axis.push('Left axis deviation');
  else axis.push(`Normal QRS axis (~${metrics.qrsAxis}°)`);

  const stT: string[] = [];
  for (const l of LEADS) {
    const st = stLevel(leads[l]);
    if (st > 0.15) stT.push(`ST elevation in ${l}`);
    if (st < -0.15) stT.push(`ST depression in ${l}`);
  }

  return {
    rhythm,
    rate,
    conduction,
    axis,
    chamberPatterns: [],
    qrsMorphology: [],
    stT,
    infarction: stT.filter((s) => s.includes('elevation')),
    devices: [],
    artifacts: [],
    uncertainty: [],
  };
}

function stLevel(signal: number[]): number {
  const peak = findRPeak(signal);
  const b = localBaseline(signal, peak);
  const st = signal.slice(peak + 30, peak + 60);
  if (!st.length) return 0;
  return st.reduce((a, c) => a + c - b, 0) / st.length;
}
