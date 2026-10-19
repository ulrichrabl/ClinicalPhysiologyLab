import { phonoSample } from './phono.ts';
import { withAlpha } from './station-strip.ts';
import type { StripBeat } from './phono-strip.ts';
import type { CycleSegment } from '../stations/cardiac-cycle.ts';

/* ---------------------------------------------------------------------------
   The auscultation station's mechanism (ADR-017 step 4): a Wiggers diagram
   of one beat, drawn from the circulation's own samples.

   Pressures of the left heart (aorta, ventricle, atrium) or the right
   (pulmonary artery, ventricle, atrium), the ventricle's volume, the beat's
   ECG and its phonocardiogram, on one time axis. Each valve event is a
   vertical line where the model's valve opened or closed; the phases of the
   cycle are bands. A heart sound sits on its valve's closing line because
   both come from the same event.
--------------------------------------------------------------------------- */

export interface WiggersInput {
  b: StripBeat;
  side: 'left' | 'right';
  segments: CycleSegment[];
  events: Array<{ id: string; t: number }>;
  /** ms from the beat's start */
  cursor: number;
  colors: { fg: string; muted: string; accent: string; abn: string; line: string; surface: string; atrium: string; volume: string };
  labels: { pressure: string; volume: string; ecg: string; phono: string; artery: string; ventricle: string; atrium: string; phase: Record<string, string> };
}

export interface WiggersGeometry { tAt(x: number): number; xAt(t: number): number }

export function wiggersHeight(w: number): number { return Math.round(Math.max(330, Math.min(470, w * 0.62))); }

export function drawWiggers(g: CanvasRenderingContext2D, w: number, h: number, s: WiggersInput): WiggersGeometry {
  const beat = s.b.beat, S = beat.samples;
  const padL = 44, padR = 10;
  /* A little of the previous diastole before the activation, so a closure just before it is on the page. A closure much
     earlier than that (a mitral valve shut early by a leaking aortic valve) is drawn where the same closure falls in this
     beat's own diastole. */
  const LEAD_MS = 70;
  const events = s.events.map((e) => (e.t < -LEAD_MS ? { ...e, t: e.t + beat.dur } : e));
  const t0 = Math.min(0, ...events.map((e) => e.t)) - 20, t1 = beat.dur;
  const xAt = (t: number) => padL + ((t - t0) / (t1 - t0)) * (w - padL - padR);
  const tAt = (x: number) => t0 + ((x - padL) / (w - padL - padR)) * (t1 - t0);
  const bandH = 18, pTop = bandH + 16, pH = h * 0.44, vTop = pTop + pH + 10, vH = h * 0.15, eTop = vTop + vH + 8, eH = h * 0.11, fTop = eTop + eH + 4, fH = h - (eTop + eH + 4) - 6;
  g.fillStyle = s.colors.surface; g.fillRect(0, 0, w, h);

  // phases: bands across the whole diagram, named on top
  const tint: Record<string, number> = { 'iso-contraction': 0.16, ejection: 0.08, 'iso-relaxation': 0.16, 'rapid-filling': 0.05, diastasis: 0.0, 'atrial-systole': 0.05 };
  g.font = `500 10px "JetBrains Mono", ui-monospace, monospace`; g.textBaseline = 'middle'; g.textAlign = 'center';
  for (const seg of s.segments) {
    const a = Math.max(padL, xAt(seg.from)), b = Math.min(w - padR, xAt(seg.to));
    if (b <= a) continue;
    const on = s.cursor >= seg.from && s.cursor < seg.to;
    g.fillStyle = withAlpha(on ? s.colors.accent : s.colors.muted, on ? 0.16 : tint[seg.phase] ?? 0.05);
    g.fillRect(a, bandH, b - a, h - bandH);
    g.fillStyle = on ? s.colors.accent : s.colors.muted;
    const label = s.labels.phase[seg.phase] ?? seg.phase;
    if (b - a > g.measureText(label).width + 4) g.fillText(label, (a + b) / 2, bandH / 2 + 2);
  }
  g.textAlign = 'left';

  // pressures
  const key = s.side === 'left' ? { art: 'Pa', ven: 'Pv', atr: 'Pla', vol: 'V', open1: 'AO', close1: 'AC', open2: 'MO', close2: 'MC' }
    : { art: 'Ppa', ven: 'Prv', atr: 'Pra', vol: 'Vrv', open1: 'PO', close1: 'PC', open2: 'TO', close2: 'TC' };
  let pMax = 20;
  for (const x of S) pMax = Math.max(pMax, x[key.art] ?? 0, x[key.ven] ?? 0, x[key.atr] ?? 0);
  pMax = Math.ceil((pMax * 1.08) / 10) * 10;
  const pMin = Math.min(0, Math.floor(Math.min(...S.map((x) => x[key.atr] ?? 0))));
  const yP = (p: number) => pTop + pH - ((p - pMin) / (pMax - pMin)) * pH;
  g.strokeStyle = s.colors.line; g.lineWidth = 1; g.fillStyle = s.colors.muted; g.textBaseline = 'middle';
  const step = pMax > 100 ? 40 : pMax > 50 ? 20 : 10;
  for (let p = 0; p <= pMax; p += step) { g.beginPath(); g.moveTo(padL, yP(p)); g.lineTo(w - padR, yP(p)); g.stroke(); if (yP(p) > pTop + 12) g.fillText(String(p), 4, yP(p)); }
  g.fillText(s.labels.pressure, 4, pTop - 6);
  const trace = (k: string, color: string, width: number, y: (v: number) => number, dash: number[] = []) => {
    g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.lineJoin = 'round'; g.beginPath();
    S.forEach((x, i) => (i ? g.lineTo(xAt(x.t), y(x[k] ?? 0)) : g.moveTo(xAt(x.t), y(x[k] ?? 0)))); g.stroke(); g.setLineDash([]);
  };
  trace(key.atr, s.colors.atrium, 1.8, yP);
  trace(key.art, s.colors.abn, 2, yP);
  trace(key.ven, s.colors.fg, 2.2, yP);
  // legend
  const leg: Array<[string, string]> = [[s.labels.artery, s.colors.abn], [s.labels.ventricle, s.colors.fg], [s.labels.atrium, s.colors.atrium]];
  let lx = padL + 6;
  g.font = `500 11px Inter, system-ui, sans-serif`; g.textBaseline = 'middle';
  for (const [name, c] of leg) { g.fillStyle = c; g.fillRect(lx, pTop + 6, 14, 3); g.fillStyle = s.colors.fg; g.fillText(name, lx + 18, pTop + 8); lx += 26 + g.measureText(name).width; }

  // volume
  const vols = S.map((x) => x[key.vol] ?? 0), vMin = Math.min(...vols), vMax = Math.max(...vols);
  const yV = (v: number) => vTop + vH - ((v - vMin) / Math.max(1, vMax - vMin)) * vH * 0.9 - vH * 0.05;
  g.font = `500 10px "JetBrains Mono", ui-monospace, monospace`; g.fillStyle = s.colors.muted;
  g.fillText(String(Math.round(vMax)), 4, yV(vMax)); g.fillText(String(Math.round(vMin)), 4, yV(vMin));
  g.textAlign = 'right'; g.fillText(s.labels.volume, w - padR - 4, vTop + 4); g.textAlign = 'left';
  trace(key.vol, s.colors.volume, 2, yV);

  // ECG and phonocardiogram of this beat
  let eMax = 0.2; for (const x of S) eMax = Math.max(eMax, Math.abs(x.ecg ?? 0));
  trace('ecg', s.colors.muted, 1.2, (v) => eTop + eH / 2 - (v / eMax) * eH * 0.48);
  g.fillStyle = s.colors.muted; g.fillText(s.labels.ecg, 4, eTop + eH / 2);
  g.strokeStyle = s.colors.fg; g.lineWidth = 1; g.beginPath();
  const n = Math.max(400, Math.round(w * 2));
  for (let i = 0; i <= n; i++) {
    const t = t0 + (i / n) * (t1 - t0), y = fTop + fH / 2 - phonoSample(s.b.cycle, (t - s.b.s1At) / 1000) * fH * 0.42;
    if (i) g.lineTo(xAt(t), y); else g.moveTo(xAt(t), y);
  }
  g.stroke();
  g.fillStyle = s.colors.muted; g.fillText(s.labels.phono, 4, fTop + fH / 2);

  // valve events: a line from the pressures down through the sounds
  const mine = new Set([key.open1, key.close1, key.open2, key.close2]);
  g.font = `600 10px "JetBrains Mono", ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'bottom';
  for (const e of events) {
    if (!mine.has(e.id)) continue;
    const x = xAt(e.t);
    if (x < padL || x > w - padR) continue;
    const closing = e.id.endsWith('C');
    g.strokeStyle = closing ? s.colors.fg : s.colors.muted; g.lineWidth = 1; g.setLineDash(closing ? [] : [3, 3]);
    g.beginPath(); g.moveTo(x, pTop - 2); g.lineTo(x, h - 4); g.stroke(); g.setLineDash([]);
    g.fillStyle = closing ? s.colors.fg : s.colors.muted; g.fillText(e.id, x, pTop - 3);
  }
  g.textAlign = 'left';

  // cursor
  const xc = xAt(s.cursor);
  g.strokeStyle = s.colors.accent; g.lineWidth = 2.5; g.beginPath(); g.moveTo(xc, bandH); g.lineTo(xc, h); g.stroke();
  g.fillStyle = s.colors.accent; g.beginPath(); g.moveTo(xc - 7, bandH); g.lineTo(xc + 7, bandH); g.lineTo(xc, bandH + 9); g.closePath(); g.fill();
  return { tAt, xAt };
}
