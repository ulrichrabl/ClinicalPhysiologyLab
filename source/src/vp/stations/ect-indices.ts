import { ECT } from '../evidence/ect.ts';
/* ===========================================================================
   The device's seizure measures, computed from what it records (ECT
   station, part 1).

   The device's firmware is not published. The measures are computed as its
   manual defines them and as its makers described the algorithms:
   - the EEG is filtered 2–25 Hz and its "area rate" is the mean absolute
     voltage over each second (US patent 5,871,517);
   - the ictal line is printed while that area rate exceeds the baseline's
     (manual: "when the EEG amplitude exceeds a specified baseline value");
   - the EEG endpoint is where the moving-average EEG voltage first falls
     below the pre-stimulus value and stays there for at least 2 s (Swartz,
     Abrams et al. 1994, the predecessor's algorithm); not detected if that
     never happens;
   - the EMG endpoint: the EMG, filtered 2–100 Hz and rectified, must rise
     above 5 times its baseline to count as a motor seizure; it ends where it
     falls below twice the baseline (US patent 5,269,302); "EMG activity is
     not detected" otherwise;
   - the postictal suppression index: the percentage drop of the area rate
     from the 3 s before the endpoint to the 3 s after it (manual: "the
     percentage decrease in ictal EEG amplitude immediately following seizure
     termination"; the 3 s windows are ours);
   - the average seizure energy index: the EEG's power integrated over the
     seizure, divided by its duration (manual);
   - the maximum sustained power: the mean power of the 10 s segment with the
     highest mean power, and the time from the stimulus's end to that
     segment's middle (manual);
   - the maximum sustained coherence: the mean, over the 5 s segment with the
     highest value, of the correlation between the two EEG channels in 1 s
     windows, as a percentage, from 5 s after the stimulus (manual; US patent
     5,871,517).
=========================================================================== */

export interface SeizureReport {
  eegEndpoint: number | null;
  emgEndpoint: number | null;
  asei: number | null;
  psi: number | null;
  msp: number | null; timeToPeakPower: number | null;
  coherence: number | null; timeToPeakCoherence: number | null;
  /** the midictal amplitude (µV, peak to trough on channel 1): not printed by the device, read off the strip */
  midictal: number | null;
}

/** A second-order band-pass (two first-order high-passes and two low-passes), run forward. */
export function bandpass(x: ArrayLike<number>, fs: number, lo: number, hi: number): Float32Array {
  const out = new Float32Array(x.length);
  const a = Math.exp((-2 * Math.PI * lo) / fs), b = 1 - Math.exp((-2 * Math.PI * hi) / fs);
  let h1 = 0, h2 = 0, p1 = 0, p2 = 0, l1 = 0, l2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    h1 = a * (h1 + v - p1); p1 = v;
    h2 = a * (h2 + h1 - p2); p2 = h1;
    l1 += b * (h2 - l1); l2 += b * (l1 - l2);
    out[i] = l2;
  }
  return out;
}

/** mean absolute value over each second (µV) */
export function areaRate(x: ArrayLike<number>, fs: number, from = 0, to = x.length): number[] {
  const out: number[] = [];
  for (let s = from; s + fs <= to; s += fs) { let a = 0; for (let i = s; i < s + fs; i++) a += Math.abs(x[i]); out.push(a / fs); }
  return out;
}

const meanPower = (x: ArrayLike<number>, from: number, to: number) => { let p = 0; for (let i = from; i < to; i++) p += x[i] * x[i]; return p / Math.max(1, to - from); };

/** The EEG endpoint (s after the stimulus's end) on the filtered channel, against the baseline's area rate. */
export function eegEndpoint(eeg: Float32Array, fs: number, end: number, baseline: number, upTo = eeg.length): number | null {
  /* a 1 s moving average of the rectified EEG, stepped every 0.1 s */
  const step = Math.round(fs / 10), w = fs;
  let below = -1, rose = false;
  for (let i = end + w; i <= upTo; i += step) {
    let a = 0; for (let k = i - w; k < i; k++) a += Math.abs(eeg[k]); a /= w;
    if (a > baseline) { rose = true; below = -1; continue; }
    if (!rose) continue;
    if (below < 0) below = i;
    if (i - below >= 2 * fs) return (below - end) / fs;
  }
  return null;
}

export function emgEndpoint(emg: Float32Array, fs: number, end: number, baselineFrom: number, baselineTo: number, upTo = emg.length): number | null {
  const f = bandpass(emg, fs, 2, Math.min(100, fs * 0.45));
  let b = 0; for (let i = baselineFrom; i < baselineTo; i++) b += Math.abs(f[i]); b /= Math.max(1, baselineTo - baselineFrom);
  const w = Math.round(fs / 2), step = Math.round(fs / 10);
  let rose = false, below = -1;
  for (let i = end + w; i <= upTo; i += step) {
    let a = 0; for (let k = i - w; k < i; k++) a += Math.abs(f[k]); a /= w;
    if (a > 5 * b) rose = true;
    if (!rose) continue;
    if (a > 2 * b) { below = -1; continue; }
    if (below < 0) below = i;
    if (i - below >= 2 * fs) return (below - end) / fs;
  }
  return null;
}

/** Correlation of two stretches. */
function corr(a: ArrayLike<number>, b: ArrayLike<number>, from: number, to: number) {
  let ma = 0, mb = 0; const n = to - from;
  for (let i = from; i < to; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = from; i < to; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0;
}

/**
 * The end-of-treatment measures. `eeg1`, `eeg2` raw (µV), `emg` raw; `end` the sample at which the stimulus ended;
 * `baseline` the sample range of the baseline collection (null if none: then no EEG endpoint and no indices).
 */
export function seizureReport(o: { eeg1: Float32Array; eeg2: Float32Array; emg: Float32Array; fs: number; end: number; upTo: number; baseline: [number, number] | null }): SeizureReport {
  const { fs, end, upTo } = o;
  const e1 = bandpass(o.eeg1, fs, 2, 25), e2 = bandpass(o.eeg2, fs, 2, 25);
  const emgEnd = o.baseline ? emgEndpoint(o.emg, fs, end, o.baseline[0], o.baseline[1], upTo) : emgEndpoint(o.emg, fs, end, Math.max(0, end - 5 * fs), end, upTo);
  const none: SeizureReport = { eegEndpoint: null, emgEndpoint: emgEnd, asei: null, psi: null, msp: null, timeToPeakPower: null, coherence: null, timeToPeakCoherence: null, midictal: null };
  if (!o.baseline) return none;
  const [b0, b1] = o.baseline;
  let base = 0; for (let i = b0; i < b1; i++) base += Math.abs(e1[i]); base /= Math.max(1, b1 - b0);
  const ep = eegEndpoint(e1, fs, end, base, upTo);
  /* the seizure for the power measures: to the endpoint, or to the end of the recording if none was found */
  const sEnd = ep != null ? end + Math.round(ep * fs) : upTo;
  const asei = sEnd > end ? meanPower(e1, end, sEnd) : null;
  let msp: number | null = null, ttp: number | null = null;
  for (let i = end; i + 10 * fs <= sEnd; i += fs) { const p = meanPower(e1, i, i + 10 * fs); if (msp == null || p > msp) { msp = p; ttp = (i + 5 * fs - end) / fs; } }
  let psi: number | null = null;
  if (ep != null && sEnd - 3 * fs >= end && sEnd + 3 * fs <= upTo) {
    const before = areaRate(e1, fs, sEnd - 3 * fs, sEnd), after = areaRate(e1, fs, sEnd, sEnd + 3 * fs);
    const a = before.reduce((s, x) => s + x, 0) / before.length, b = after.reduce((s, x) => s + x, 0) / after.length;
    psi = Math.max(0, Math.min(100, 100 * (1 - b / a)));
  }
  /* coherence from 5 s after the stimulus: 1 s correlations, the best 5 s mean */
  const c: number[] = [];
  for (let i = end + 5 * fs; i + fs <= sEnd; i += fs) c.push(corr(e1, e2, i, i + fs));
  let coh: number | null = null, ttc: number | null = null;
  for (let k = 0; k + 5 <= c.length; k++) { const m = c.slice(k, k + 5).reduce((s, x) => s + x, 0) / 5; if (coh == null || m > coh) { coh = m; ttc = 5 + k + 2.5; } }
  /* the midictal amplitude: the device does not measure it (owner, 2026-11-01); the seizure adequacy markers score reads
     the wave amplitude off the strip (Minelli 2016). Here: the median of each second's peak-to-trough on channel 1 (raw,
     as printed) over ECT.midictalWindow seconds centred on the middle of the EEG seizure */
  let midictal: number | null = null;
  if (ep != null) {
    const mid = end + Math.round((ep / 2) * fs), half = Math.round((ECT.midictalWindow / 2) * fs), pp: number[] = [];
    for (let i = Math.max(end, mid - half); i + fs <= Math.min(sEnd, mid + half); i += fs) { let lo = Infinity, hi = -Infinity; for (let j = i; j < i + fs; j++) { lo = Math.min(lo, o.eeg1[j]); hi = Math.max(hi, o.eeg1[j]); } pp.push(hi - lo); }
    if (pp.length) { pp.sort((a, b) => a - b); midictal = pp[Math.floor(pp.length / 2)]; }
  }
  return { eegEndpoint: ep, emgEndpoint: emgEnd, asei, psi, msp, timeToPeakPower: ttp, coherence: coh == null ? null : Math.max(0, 100 * coh), timeToPeakCoherence: ttc, midictal };
}

/** Whether the ictal line is printed for each second after the stimulus: the area rate above the baseline's. */
export function ictalLine(eeg1: Float32Array, fs: number, end: number, upTo: number, baselineRate: number): boolean[] {
  return areaRate(bandpass(eeg1, fs, 2, 25), fs, end, upTo).map((a) => a > baselineRate);
}
