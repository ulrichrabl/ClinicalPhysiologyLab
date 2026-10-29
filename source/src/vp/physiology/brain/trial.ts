import { Brain, type BrainOptions } from './corticothalamic.ts';
import { CT } from '../../evidence/seizure.ts';

/* ---------------------------------------------------------------------------
   A seizure trial: a resting brain, a stimulus, and what follows. Used by the
   fit (scripts/fit-seizure.mjs), the tests and the station, so all three read
   a seizure the same way.
--------------------------------------------------------------------------- */

export interface TrialOptions extends BrainOptions {
  /** regions stimulated (indices); all if absent */
  stimulated?: number[] | undefined;
  /** the stimulus into the relay (mV) and its length (s) */
  kick?: number; kickSeconds?: number;
  /** how long to run after the stimulus (s) */
  seconds?: number;
}

export interface TrialResult {
  fs: number;
  /** each region's cortical firing relative to rest (1/s), from the stimulus on */
  activity: Float32Array[];
  /** per region: seizure onset and end (s after the stimulus), null if it never seized */
  onset: Array<number | null>; end: Array<number | null>;
  /** the whole seizure: first onset to last end (s), null if none */
  duration: number | null;
  /** dominant frequency (Hz) over the seizure, every second, averaged over the seizing regions */
  frequency: Array<{ t: number; hz: number }>;
  /** fluctuation (SD over 2 s windows, mean removed: what a 0.5 Hz filter leaves) before the stimulus and after the end */
  sdBefore: number; sdAfter: number | null;
  /** the loop's gains (Stuiver's X, Y, Z) in the first region at rest and right after the seizure */
  gainsRest: { X: number; Y: number; Z: number }; gainsPost: { X: number; Y: number; Z: number } | null;
  brain: Brain;
}

const sdNoMean = (a: ArrayLike<number>, from: number, to: number) => {
  let m = 0; for (let i = from; i < to; i++) m += a[i]; m /= Math.max(1, to - from);
  let s = 0; for (let i = from; i < to; i++) s += (a[i] - m) ** 2; return Math.sqrt(s / Math.max(1, to - from));
};

/** Dominant frequency of a stretch by counting upward crossings of its mean. */
export function crossingsHz(a: ArrayLike<number>, from: number, to: number, fs: number) {
  let m = 0; for (let i = from; i < to; i++) m += a[i]; m /= Math.max(1, to - from);
  let n = 0; for (let i = from + 1; i < to; i++) if (a[i - 1] < m && a[i] >= m) n++;
  return n / ((to - from) / fs);
}

export function seizureTrial(o: TrialOptions = {}): TrialResult {
  const b = new Brain({ seed: o.seed, dt: o.dt });
  b.settle(6);
  const fs = 200, step = 1 / fs, n = b.regions.length;
  /* three seconds of background before the stimulus, to measure it */
  const pre: number[][] = b.regions.map(() => []);
  for (let k = 0; k < 3 * fs; k++) { b.advance(step); const a = b.activity(); for (let i = 0; i < n; i++) pre[i].push(a[i]); }
  const gr = b.regions[0].gains();
  const sdBefore = pre.reduce((s, a) => s + sdNoMean(a, a.length - 2 * fs, a.length), 0) / n;
  b.stimulate(o.kick ?? 20, o.kickSeconds ?? 0.05, o.stimulated);
  const T = o.seconds ?? 240, N = Math.round(T * fs);
  const activity = b.regions.map(() => new Float32Array(N));
  const onset: Array<number | null> = b.regions.map(() => null), end: Array<number | null> = b.regions.map(() => null);
  let gainsPost: TrialResult['gainsPost'] = null;
  for (let k = 0; k < N; k++) {
    b.advance(step);
    const a = b.activity(), t = (k + 1) / fs;
    for (let i = 0; i < n; i++) {
      activity[i][k] = a[i];
      if (b.regions[i].excess > CT.seizingThreshold) { if (onset[i] == null) onset[i] = t; end[i] = t; }
    }
    /* the gains 10 s after the last region stopped: the immediate postictal state, read at its (noisy) mean */
    const last = Math.max(...end.map((x) => x ?? -1));
    if (!gainsPost && last > 0 && t > last + 10 && end.every((e, i) => e == null || b.regions[i].excess < CT.seizingThreshold)) gainsPost = b.regions[0].gains();
  }
  const ons = onset.filter((x): x is number => x != null), ends = end.filter((x): x is number => x != null);
  const duration = ons.length ? Math.max(...ends) - Math.min(...ons) : null;
  const frequency: TrialResult['frequency'] = [];
  if (duration != null) {
    const t0 = Math.min(...ons), t1 = Math.max(...ends);
    for (let t = Math.ceil(t0); t + 2 <= t1; t++) {
      const seizing = activity.map((a, i) => ({ a, i })).filter(({ i }) => onset[i] != null && onset[i]! <= t && end[i]! >= t + 2);
      if (!seizing.length) continue;
      frequency.push({ t, hz: seizing.reduce((s, { a }) => s + crossingsHz(a, t * fs, (t + 2) * fs, fs), 0) / seizing.length });
    }
  }
  let sdAfter: number | null = null;
  if (duration != null) {
    const e = Math.max(...ends);
    if ((e + 35) * fs <= N) sdAfter = activity.reduce((s, a) => s + Math.max(...[5, 15, 25].map((d) => sdNoMean(a, (e + d) * fs, (e + d + 2) * fs))), 0) / n;
  }
  return { fs, activity, onset, end, duration, frequency, sdBefore, sdAfter, gainsRest: gr, gainsPost, brain: b };
}
