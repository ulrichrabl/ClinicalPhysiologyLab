import type { Channel } from './eeg-montage.ts';
import { channelValue } from './eeg-montage.ts';

/* ===========================================================================
   Recording: sources in time, electrodes, channels, filters.

   Every source is a fixed field (µV at each electrode at its peak, from
   the forward model) times its own time course. The potentials at the
   electrodes are their sum; a channel is the difference of its two inputs;
   the amplifier's filters act on each channel, as an EEG machine's do:
   a first-order high-pass (the "low-frequency filter", LFF) and a
   first-order low-pass (the "high-frequency filter", HFF).
=========================================================================== */

/** The shape of a spike or sharp wave (IFCN glossary, Kane 2017): a pointed main component, by convention surface
    negative, rising faster than it falls, lasting 20 to < 70 ms (a spike) or 70–200 ms (a sharp wave), with a small
    opposite phase after it, and optionally a slow wave of the main component's polarity. Values are the waveform's own
    units: 1 at the main peak. The rise share, the opposite phase and the slow wave's length are drawing conventions,
    not measured. */
export interface Discharge {
  /** duration of the main component at its base (ms) */
  duration: number;
  /** after-going slow wave: its peak as a share of the main component (0 = none) */
  slowWave: number;
  /** its length (ms) */
  slowMs: number;
}
const RISE = 0.4, DIP = 0.15, DIP_SHARE = 0.5;

export function dischargeAt(d: Discharge, t: number): number {
  const r = RISE * d.duration, f = (1 - RISE) * d.duration, o = DIP_SHARE * d.duration;
  if (t < -r) return 0;
  if (t < 0) return 0.5 * (1 - Math.cos((Math.PI * (t + r)) / r));
  if (t < f) return 0.5 * (1 + Math.cos((Math.PI * t) / f));
  if (t < f + o) return -DIP * Math.sin((Math.PI * (t - f)) / o);
  const ts = t - f - o;
  if (d.slowWave > 0 && ts < d.slowMs) return d.slowWave * Math.sin((Math.PI * ts) / d.slowMs);
  return 0;
}
/** where the discharge starts and ends relative to its peak (ms) */
export const dischargeSpan = (d: Discharge): [number, number] => [-RISE * d.duration, (1 - RISE) * d.duration + DIP_SHARE * d.duration + (d.slowWave > 0 ? d.slowMs : 0)];

export interface Source { field: Record<string, number>; course: (tMs: number) => number }

export interface Page {
  fs: number; seconds: number;
  /** potentials at each electrode (µV), unfiltered */
  electrodes: Record<string, Float32Array>;
}

export function recordPage(sources: Source[], electrodes: readonly string[], seconds = 10, fs = 256): Page {
  const n = Math.round(seconds * fs);
  const out: Record<string, Float32Array> = {};
  for (const e of electrodes) out[e] = new Float32Array(n);
  for (const s of sources) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = s.course((i * 1000) / fs);
    for (const e of electrodes) { const k = s.field[e] ?? 0; if (!k) continue; const o = out[e]; for (let i = 0; i < n; i++) o[i] += k * w[i]; }
  }
  return { fs, seconds, electrodes: out };
}

export interface Filters { lff: number; hff: number }

/** A channel through the amplifier: the difference of its inputs, then the filters. */
export function channelTrace(page: Page, c: Channel, f: Filters): Float32Array {
  const n = page.electrodes.Fp1?.length ?? 0;
  const x = new Float32Array(n);
  const view: Record<string, number> = {};
  const keys = Object.keys(page.electrodes);
  for (let i = 0; i < n; i++) { for (const k of keys) view[k] = page.electrodes[k][i]; x[i] = channelValue(view, c); }
  return filter(x, page.fs, f);
}

export function filter(x: Float32Array, fs: number, f: Filters): Float32Array {
  const dt = 1 / fs, y = new Float32Array(x.length);
  /* high-pass: an RC coupling with time constant 1/(2π·LFF) */
  if (f.lff > 0) {
    const tau = 1 / (2 * Math.PI * f.lff), a = tau / (tau + dt);
    let yp = 0, xp = x[0] ?? 0;
    for (let i = 0; i < x.length; i++) { yp = a * (yp + x[i] - xp); xp = x[i]; y[i] = yp; }
  } else y.set(x);
  /* low-pass: an RC with time constant 1/(2π·HFF) */
  if (f.hff > 0) {
    const tau = 1 / (2 * Math.PI * f.hff), b = dt / (tau + dt);
    let yp = y[0] ?? 0;
    for (let i = 0; i < y.length; i++) { yp += b * (y[i] - yp); y[i] = yp; }
  }
  return y;
}
