import type { LeadName } from './ecg.ts';

/* ===========================================================================
   Where things are on a recorded ECG, for teaching how to measure it.

   The complexes are found on the tracing itself (the spatial slope of all
   twelve leads), and each QRS onset where that slope rises out of the
   baseline. The intervals are then the model's own (it made the tracing,
   so it knows them exactly): the P wave starts PR before the QRS, the QRS
   lasts QRS, and the T wave ends QT after the QRS onset, QT being the
   machine's QTc undone with the measured R–R (Bazett, as the machine
   reports it). So "show me" puts the calipers on the tracing where an
   expert would, and agrees with the machine's numbers.
=========================================================================== */

export interface Machine { rate?: number; pr?: number; qrs?: number; qtc?: number; axis?: number }

export interface Beat { r: number; qrsOn: number; qrsOff: number; pOn: number | null; tEnd: number }
export interface Fiducials {
  fs: number;
  beats: Beat[];
  rrMs: number | null;               // median R–R
  /** Net QRS area in leads I and aVF (mV·s), for the axis by quadrants. */
  netI: number; netF: number;
}

export function delineate(leads: Record<LeadName, ArrayLike<number>>, fs: number, m: Machine = {}): Fiducials {
  const names = Object.keys(leads) as LeadName[];
  const n = leads.II.length;
  /* spatial slope, smoothed over 10 ms */
  const raw = new Float32Array(n);
  for (let i = 1; i < n - 1; i++) { let s = 0; for (const l of names) s += Math.abs(leads[l][i + 1] - leads[l][i - 1]); raw[i] = s; }
  const w = Math.max(1, Math.round(0.005 * fs)), sv = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let j = i - w; j <= i + w; j++) if (j >= 0 && j < n) { s += raw[j]; c++; } sv[i] = s / c; }
  let max = 0; for (let i = 0; i < n; i++) max = Math.max(max, sv[i]);
  const beats: Beat[] = [];
  if (max <= 0) return { fs, beats, rrMs: null, netI: 0, netF: 0 };
  const refractory = Math.round(0.28 * fs);
  const peaks: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (sv[i] > 0.42 * max && sv[i] >= sv[i - 1] && sv[i] >= sv[i + 1]) {
      /* the highest slope within the next 60 ms is this complex's peak */
      let best = i; for (let j = i; j < Math.min(n, i + Math.round(0.06 * fs)); j++) if (sv[j] > sv[best]) best = j;
      peaks.push(best); i = best + refractory;
    }
  }
  const rr = peaks.slice(1).map((p, i) => ((p - peaks[i]) / fs) * 1000).sort((a, b) => a - b);
  const rrMs = rr.length ? rr[Math.floor(rr.length / 2)] : null;
  const ms = (x: number) => Math.round((x / 1000) * fs);
  let netI = 0, netF = 0;
  for (const pk of peaks) {
    /* QRS onset and end: outward from the peak while the slope is fast, bridging dips shorter than 24 ms (the notch of
       a bundle branch block's QRS) and stopping at the first longer quiet spell (the PR or ST segment). */
    /* the threshold is set by the complex's fastest moment, which in a broad complex comes late */
    let top = 0; for (let j = Math.max(0, pk - ms(60)); j < Math.min(n, pk + ms(170)); j++) top = Math.max(top, sv[j]);
    const thr = 0.18 * top, bridge = ms(24);
    let on = pk, off = pk;
    for (let j = pk, quiet = 0; j > Math.max(1, pk - ms(120)); j--) { if (sv[j] > thr) { on = j; quiet = 0; } else if (++quiet > bridge) break; }
    for (let j = pk, quiet = 0; j < Math.min(n - 2, pk + ms(170)); j++) { if (sv[j] > thr) { off = j; quiet = 0; } else if (++quiet > bridge) break; }
    if (m.qrs) off = on + ms(m.qrs);
    /* the R wave: lead II's largest excursion inside the QRS (what a clinician puts the caliper on) */
    let r = pk, big = -1;
    const base = leads.II[Math.max(0, on - ms(10))];
    for (let j = on; j <= off && j < n; j++) { const d = Math.abs(leads.II[j] - base); if (d > big) { big = d; r = j; } }
    const qt = m.qtc && rrMs ? m.qtc * Math.sqrt(rrMs / 1000) : (off - on) / fs * 1000 + 280;
    const pOn = m.pr != null ? on - ms(m.pr) : null;
    const tEnd = on + ms(qt);
    beats.push({ r, qrsOn: on, qrsOff: off, pOn: pOn != null && pOn >= 0 ? pOn : null, tEnd: Math.min(n - 1, tEnd) });
    const b0 = Math.max(0, on - ms(15));
    for (let j = on; j <= off && j < n; j++) { netI += (leads.I[j] - leads.I[b0]) / fs; netF += (leads.aVF[j] - leads.aVF[b0]) / fs; }
  }
  return { fs, beats, rrMs, netI, netF };
}
