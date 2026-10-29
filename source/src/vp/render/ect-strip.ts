import { FS, type EctSession } from '../stations/ect-session.ts';
import { bandpass } from '../stations/ect-indices.ts';

/* ---------------------------------------------------------------------------
   The ECT device's paper strip (ECT station, part 1), drawn as its manual
   and the published strips show it: four traces (EEG 1 and 2, EMG, ECG) at
   the set gains and paper speed, the ictal line along the top while the EEG
   exceeds its baseline, a seconds scale with a mark every second and a
   black block every 6 s, the heart rate every 3 s, the self-test and
   settings lines, and the end-of-treatment report where it was printed.
   Only what the printer printed is on the paper: segments follow each other
   with no gaps for the time it was stopped.
--------------------------------------------------------------------------- */

export interface StripColors { paper: string; ink: string; faint: string }

export type PaperItem =
  | { kind: 'trace'; from: number; to: number; afterStimulus: number | null }
  | { kind: 'text'; lines: string[]; at: number };

export interface StripLayout { items: Array<PaperItem & { x: number; w: number }>; width: number; pxPerSec: number }

const PX_PER_MM = 3.2;

/** Lay the printed items along the paper: trace segments at the paper speed, text blocks as wide as their lines. */
export function layoutStrip(items: PaperItem[], paperSpeed: number, g?: CanvasRenderingContext2D): StripLayout {
  const pxPerSec = paperSpeed * PX_PER_MM;
  let x = 44;
  const out: StripLayout['items'] = [];
  for (const it of items) {
    let w: number;
    if (it.kind === 'trace') w = Math.max(0, (it.to - it.from) * pxPerSec);
    else { const lw = g ? Math.max(...it.lines.map((l) => g.measureText(l).width)) : 8 * Math.max(...it.lines.map((l) => l.length)); w = Math.ceil(lw) + 24; }
    out.push({ ...it, x, w });
    x += w + 6;
  }
  return { items: out, width: x + 8, pxPerSec };
}

export interface StripState { gains: [number, number]; emgGain: number; ecgGain: number; baselineRate: number | null }

/** Draw the paper from `scrollX` (px from its start) across the canvas width. */
export function drawStrip(g: CanvasRenderingContext2D, w: number, h: number, s: EctSession, L: StripLayout, scrollX: number, st: StripState, c: StripColors, heartRate: (t: number) => number) {
  g.fillStyle = c.paper; g.fillRect(0, 0, w, h);
  const top = 14, scaleH = 16, chH = (h - top - scaleH - 4) / 4;
  const pxPerCm = 10 * PX_PER_MM;
  const rec = s.rec;
  g.font = '11px ui-monospace, Menlo, Consolas, monospace';
  g.textBaseline = 'middle';
  const ef = filtered(s);
  for (const it of L.items) {
    const x0 = it.x - scrollX;
    if (x0 > w || x0 + it.w < 0) continue;
    if (it.kind === 'text') {
      g.fillStyle = c.ink; g.textAlign = 'left';
      it.lines.forEach((line, k) => g.fillText(line, x0 + 12, top + 10 + k * 14));
      continue;
    }
    const i0 = Math.max(0, Math.round(it.from * FS)), i1 = Math.min(rec.n, Math.round(it.to * FS));
    const xAt = (i: number) => x0 + ((i / FS - it.from) * L.pxPerSec);
    /* the four traces at their gains (µV per cm), positive up */
    const chans: Array<{ data: Float32Array; gain: number }> = [
      { data: ef.e1, gain: st.gains[0] }, { data: ef.e2, gain: st.gains[1] },
      { data: rec.emg, gain: st.emgGain }, { data: rec.ecg, gain: st.ecgGain },
    ];
    const a = Math.max(i0, Math.floor((scrollX - it.x) / L.pxPerSec * FS + it.from * FS) - 2), b = Math.min(i1, Math.ceil((scrollX + w - it.x) / L.pxPerSec * FS + it.from * FS) + 2);
    g.strokeStyle = c.ink; g.lineWidth = 1;
    chans.forEach((ch, k) => {
      const mid = top + chH * (k + 0.5), lim = chH * 0.62;
      g.save(); g.beginPath(); g.rect(Math.max(0, x0), mid - chH / 2, Math.min(w, x0 + it.w) - Math.max(0, x0), chH); g.clip();
      g.beginPath();
      for (let i = a; i < b; i++) {
        const y = mid - Math.max(-lim, Math.min(lim, (ch.data[i] / ch.gain) * pxPerCm));
        if (i === a) g.moveTo(xAt(i), y); else g.lineTo(xAt(i), y);
      }
      g.stroke(); g.restore();
    });
    /* the seconds scale: a tick each second, a black block every 6 s, counted from the stimulus's end when there was one */
    const base = it.afterStimulus ?? it.from;
    const y0 = h - scaleH;
    g.fillStyle = c.ink;
    for (let tt = Math.ceil(it.from - base); base + tt <= it.to; tt++) {
      const x = x0 + (base + tt - it.from) * L.pxPerSec;
      if (x < -50 || x > w + 50) continue;
      g.fillRect(x, y0, 1, 5);
      if (tt >= 0 && tt % 6 === 0) g.fillRect(x, y0, Math.min(L.pxPerSec, 18), 6);
      if (tt % 6 === 0 && it.afterStimulus != null) { g.textAlign = 'left'; g.fillText(String(tt), x + 2, y0 + 11); }
    }
    /* the heart rate every 3 s above the ECG */
    g.textAlign = 'left';
    for (let tt = Math.ceil(it.from / 3) * 3; tt <= it.to; tt += 3) {
      const x = x0 + (tt - it.from) * L.pxPerSec;
      if (x < -40 || x > w) continue;
      g.fillText(`${Math.round(heartRate(tt))}`, x + 2, top + chH * 3.08);
    }
    /* the ictal line: after the stimulus, while the EEG's area rate exceeds the baseline's */
    if (it.afterStimulus != null && st.baselineRate != null) {
      for (let tt = Math.max(it.from, it.afterStimulus); tt + 1 <= it.to; tt++) {
        const k0 = Math.round(tt * FS); let m = 0; for (let i = k0; i < k0 + FS && i < rec.n; i++) m += Math.abs(ef.e1[i]); m /= FS;
        if (m > st.baselineRate) { const x = x0 + (tt - it.from) * L.pxPerSec; g.fillRect(x, 3, L.pxPerSec, 3); }
      }
    }
  }
  /* channel labels at the left edge */
  g.fillStyle = c.paper; g.fillRect(0, 0, 40, h);
  g.textAlign = 'left'; g.fillStyle = c.faint;
  ['EEG 1', 'EEG 2', 'EMG', 'ECG'].forEach((n, k) => g.fillText(n, 4, top + chH * (k + 0.5)));
}

/* the EEG channels as the device draws and analyses them, filtered 2–25 Hz, kept and extended as the recording grows */
const cache = new WeakMap<EctSession, { n: number; e1: Float32Array; e2: Float32Array }>();
function filtered(s: EctSession) {
  const c = cache.get(s);
  if (c && c.n === s.rec.n) return c;
  const e1 = bandpass(s.rec.eeg1.subarray(0, s.rec.n), FS, 2, 25), e2 = bandpass(s.rec.eeg2.subarray(0, s.rec.n), FS, 2, 25);
  const out = { n: s.rec.n, e1, e2 };
  cache.set(s, out);
  return out;
}
