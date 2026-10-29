import type { Colors } from './eeg-view.ts';

/* ---------------------------------------------------------------------------
   The EEG station's seizure drawings (part 2a): the corticothalamic loop of
   one region, live, and the trend of the whole run.
--------------------------------------------------------------------------- */

export interface LoopInput {
  /** firing rates now (1/s): cortex excitatory, relay, reticular */
  qe: number; qs: number; qr: number;
  /** resting values, to colour by change */
  qeRest: number; qsRest: number; qrRest: number;
  /** the path: drive multiplier on cortex→thalamus, cortical inhibition (mV·s), relay brake (mV) */
  drive: number; inhibition: number; inhibitionRest: number; brake: number;
  /** gains if defined (not during a seizure) */
  gains: { X: number; Y: number; Z: number } | null;
  stuiver: { X: string; Y: string; Z: string } | null;
  colors: Colors;
  labels: { cortex: string; relay: string; reticular: string; drive: string; brake: string; inhibition: string; gains: string; stuiver: string; undefined: string };
}

const heat = (v: number, rest: number, max = 250) => {
  const d = Math.max(-1, Math.min(1, (v - rest) / Math.max(20, max * 0.3)));
  const a = Math.abs(d) ** 0.7;
  return d >= 0 ? `rgba(${200},${70},${40},${0.15 + 0.85 * a})` : `rgba(${40},${100},${190},${0.15 + 0.85 * a})`;
};

export function drawLoop(g: CanvasRenderingContext2D, w: number, h: number, L: LoopInput) {
  g.fillStyle = L.colors.surface; g.fillRect(0, 0, w, h);
  const cx = w / 2, top = 40, bottom = h - 92;
  const nodes = {
    e: { x: cx, y: top + 10, r: 26, q: L.qe, rest: L.qeRest, label: L.labels.cortex },
    s: { x: cx - w * 0.2, y: bottom, r: 24, q: L.qs, rest: L.qsRest, label: L.labels.relay },
    rn: { x: cx + w * 0.2, y: bottom, r: 22, q: L.qr, rest: L.qrRest, label: L.labels.reticular },
  };
  const arrow = (x0: number, y0: number, x1: number, y1: number, width: number, color: string, inhib = false) => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    if (inhib) { g.beginPath(); g.arc(x1, y1, 4 + width / 2, 0, 2 * Math.PI); g.fill(); }
    else { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 10 * Math.cos(a - 0.4), y1 - 10 * Math.sin(a - 0.4)); g.lineTo(x1 - 10 * Math.cos(a + 0.4), y1 - 10 * Math.sin(a + 0.4)); g.closePath(); g.fill(); }
  };
  const edge = (A: { x: number; y: number; r: number }, B: { x: number; y: number; r: number }, off: number) => {
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
    return [A.x + (dx / d) * A.r + nx * off, A.y + (dy / d) * A.r + ny * off, B.x - (dx / d) * (B.r + 4) + nx * off, B.y - (dy / d) * (B.r + 4) + ny * off] as const;
  };
  const fg = L.colors.fg, muted = L.colors.muted;
  /* cortex → relay and reticular: thicker as the path drives harder */
  const dw = 1.5 + 3 * (L.drive - 1) / 0.6;
  arrow(...edge(nodes.e, nodes.s, -7), dw, fg);
  arrow(...edge(nodes.e, nodes.rn, 7), dw, fg);
  /* relay → cortex, relay → reticular, reticular ⊣ relay */
  arrow(...edge(nodes.s, nodes.e, -7), 1.8, fg);
  arrow(...edge(nodes.s, nodes.rn, -6), 1.2, muted);
  arrow(...edge(nodes.rn, nodes.s, -6), 1.8, muted, true);
  /* cortical self-inhibition: a loop on the cortex, thinner as it weakens */
  const iw = 1 + 3 * Math.max(0, -L.inhibition) / 1.8;
  g.strokeStyle = muted; g.lineWidth = iw; g.beginPath(); g.arc(nodes.e.x + nodes.e.r + 12, nodes.e.y, 12, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
  g.fillStyle = muted; g.beginPath(); g.arc(nodes.e.x + nodes.e.r + 2, nodes.e.y + 8, 3 + iw / 2, 0, 2 * Math.PI); g.fill();
  /* the relay's brake */
  if (L.brake > 0.05) {
    const bx = nodes.s.x - nodes.s.r - 22, by = nodes.s.y;
    g.strokeStyle = L.colors.abn; g.lineWidth = 2 + Math.min(6, L.brake);
    g.beginPath(); g.moveTo(bx - 14, by); g.lineTo(bx, by); g.stroke();
    g.beginPath(); g.moveTo(bx, by - 9); g.lineTo(bx, by + 9); g.stroke();
    g.fillStyle = L.colors.abn; g.font = '600 11px system-ui'; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillText(`${L.labels.brake} ${L.brake.toFixed(1)} mV`, bx - 18, by - 18);
  }
  /* nodes */
  g.font = '600 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const n of Object.values(nodes)) {
    g.beginPath(); g.arc(n.x, n.y, n.r, 0, 2 * Math.PI); g.fillStyle = heat(n.q, n.rest); g.fill();
    g.lineWidth = 1.5; g.strokeStyle = fg; g.stroke();
    g.fillStyle = fg; g.fillText(`${Math.round(n.q)}/s`, n.x, n.y);
    g.fillStyle = muted; g.font = '500 11px system-ui'; g.fillText(n.label, n.x, n.y + n.r + 12); g.font = '600 12px system-ui';
  }
  g.font = '500 11px system-ui'; g.textAlign = 'left'; g.fillStyle = muted;
  g.fillText(`${L.labels.drive} × ${L.drive.toFixed(2)}   ${L.labels.inhibition} ${L.inhibition.toFixed(2)} mV·s`, 8, 14);
  /* gains */
  g.textAlign = 'left'; g.fillStyle = fg; g.font = '600 12px "JetBrains Mono", ui-monospace, monospace';
  const gy = h - 28;
  g.fillText(L.gains ? `${L.labels.gains}  X ${L.gains.X.toFixed(2)}  Y ${L.gains.Y.toFixed(2)}  Z ${L.gains.Z.toFixed(2)}` : `${L.labels.gains}  ${L.labels.undefined}`, 8, gy);
  if (L.stuiver) { g.fillStyle = muted; g.font = '500 11px system-ui'; g.fillText(`${L.labels.stuiver}: X ${L.stuiver.X}  Y ${L.stuiver.Y}  Z ${L.stuiver.Z}`, 8, gy + 16); }
}

export interface TrendInput {
  /** seconds since the start of the run, one entry per second */
  t: number[];
  /** peak-to-peak at the frontocentral derivation over each second (µV) */
  amp: number[];
  /** dominant frequency over each 2 s (Hz), null when not seizing */
  hz: Array<number | null>;
  progress: number[]; brake: number[];
  now: number; stimulus: number | null; onset: number | null; end: number | null;
  window: number;
  colors: Colors;
  labels: { amp: string; hz: string; progress: string; brake: string; stim: string; onset: string; end: string; s: string };
}

export function drawTrend(g: CanvasRenderingContext2D, w: number, h: number, T: TrendInput) {
  g.fillStyle = T.colors.surface; g.fillRect(0, 0, w, h);
  const left = 44, right = 10, t1 = Math.max(T.window, T.now), t0 = t1 - T.window;
  const xAt = (t: number) => left + ((t - t0) / T.window) * (w - left - right);
  const rows = [{ y: 6, h: (h - 30) * 0.4 }, { y: 6 + (h - 30) * 0.4 + 6, h: (h - 30) * 0.35 }, { y: 6 + (h - 30) * 0.75 + 12, h: (h - 30) * 0.25 - 6 }];
  g.font = '500 10px system-ui'; g.textBaseline = 'middle';
  /* amplitude, log scale 2–1000 µV */
  const r0 = rows[0], ly = (v: number) => r0.y + r0.h - (Math.log10(Math.max(2, Math.min(1000, v))) - Math.log10(2)) / (Math.log10(1000) - Math.log10(2)) * r0.h;
  for (const v of [10, 100, 1000]) { g.strokeStyle = T.colors.line; g.lineWidth = 0.5; g.beginPath(); g.moveTo(left, ly(v)); g.lineTo(w - right, ly(v)); g.stroke(); g.fillStyle = T.colors.muted; g.textAlign = 'right'; g.fillText(`${v}`, left - 4, ly(v)); }
  g.fillStyle = T.colors.muted; g.textAlign = 'left'; g.fillText(T.labels.amp, left + 4, r0.y + 6);
  g.strokeStyle = T.colors.fg; g.lineWidth = 1.5; g.beginPath();
  T.t.forEach((t, i) => { if (t < t0) return; const x = xAt(t), y = ly(T.amp[i]); if (i && T.t[i - 1] >= t0) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
  /* frequency 0–14 Hz */
  const r1 = rows[1], fy = (v: number) => r1.y + r1.h - (Math.min(14, v) / 14) * r1.h;
  for (const v of [3, 8, 13]) { g.strokeStyle = T.colors.line; g.lineWidth = 0.5; g.beginPath(); g.moveTo(left, fy(v)); g.lineTo(w - right, fy(v)); g.stroke(); g.fillStyle = T.colors.muted; g.textAlign = 'right'; g.fillText(`${v}`, left - 4, fy(v)); }
  g.fillStyle = T.colors.muted; g.textAlign = 'left'; g.fillText(T.labels.hz, left + 4, r1.y + 6);
  g.fillStyle = T.colors.accent;
  T.t.forEach((t, i) => { const v = T.hz[i]; if (v == null || t < t0) return; g.beginPath(); g.arc(xAt(t), fy(v), 2.2, 0, 2 * Math.PI); g.fill(); });
  /* the slow variables */
  const r2 = rows[2], py = (v: number) => r2.y + r2.h - Math.min(1, v) * r2.h;
  const by = (v: number) => r2.y + r2.h - Math.min(1, v / 8) * r2.h;
  g.lineWidth = 1.5;
  g.strokeStyle = T.colors.accent; g.beginPath(); T.t.forEach((t, i) => { if (t < t0) return; const x = xAt(t); if (i && T.t[i - 1] >= t0) g.lineTo(x, py(T.progress[i])); else g.moveTo(x, py(T.progress[i])); }); g.stroke();
  g.strokeStyle = T.colors.abn; g.beginPath(); T.t.forEach((t, i) => { if (t < t0) return; const x = xAt(t); if (i && T.t[i - 1] >= t0) g.lineTo(x, by(T.brake[i])); else g.moveTo(x, by(T.brake[i])); }); g.stroke();
  g.fillStyle = T.colors.accent; g.textAlign = 'left'; g.fillText(T.labels.progress, left + 4, r2.y + 4);
  g.fillStyle = T.colors.abn; g.fillText(T.labels.brake, left + 90, r2.y + 4);
  /* markers and the time axis */
  /* markers: the labels step down a line each so stimulus and onset, a moment apart, do not overlap */
  const mark = (t: number | null, label: string, line: number) => {
    if (t == null || t < t0) return; const x = xAt(t);
    g.strokeStyle = T.colors.fg; g.setLineDash([3, 3]); g.lineWidth = 1; g.beginPath(); g.moveTo(x, 4); g.lineTo(x, h - 22); g.stroke(); g.setLineDash([]);
    g.fillStyle = T.colors.fg; g.textAlign = line ? 'left' : 'right'; g.fillText(label, x + (line ? 3 : -3), h - 18 + line * 10);
  };
  mark(T.stimulus, T.labels.stim, 0); mark(T.onset, T.labels.onset, 1); mark(T.end, T.labels.end, 1);
  g.fillStyle = T.colors.muted; g.textAlign = 'right'; g.fillText(`${Math.round(T.now)} ${T.labels.s}`, w - right, h - 4);
}
