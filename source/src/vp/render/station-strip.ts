import type { LeadName } from '../measurements/ecg.ts';
import type { Activation } from '../physiology/heart/electrical.ts';

/* ---------------------------------------------------------------------------
   The ECG station's strip (ADR-017): two leads on millimetre paper at
   25 mm/s and 10 mm/mV, and under them a conduction ladder drawn from the
   electrical model's activation log on the same time axis.

   The ladder is the classic electrophysiology diagram: one row each for
   the atria, the AV node with the His bundle, and the ventricles. Each
   activation is a line across its row; the steeper the line, the slower
   the conduction. A blocked impulse stops in the AV row; a wave that
   reaches a ventricle late, through muscle, is dashed.
--------------------------------------------------------------------------- */

export interface StripInput {
  leads: Partial<Record<LeadName, ArrayLike<number>>>;
  show: [LeadName, LeadName];
  /** time of sample 0 and the sample interval (ms, the activations' clock) */
  t0: number; dt: number;
  activations: Activation[];
  cursor: number;
  band: { from: number; to: number } | null;
  colors: { fg: string; muted: string; accent: string; abn: string; line: string; surface: string };
  labels: { atria: string; av: string; ventricles: string };
}

export interface StripGeometry { tAt(x: number): number; xAt(t: number): number; height: number }

/** Paper speed and gain, as the 12-lead prints them. */
const SPEED = 25, GAIN = 10;
const ROW_MM = 24;

export function stripHeight(width: number, seconds: number): number {
  const mm = width / (seconds * SPEED);
  return Math.round(2 * ROW_MM * mm + ladderHeight(mm));
}
const ladderHeight = (mm: number) => Math.max(84, 13 * mm);

export function drawStrip(g: CanvasRenderingContext2D, w: number, h: number, s: StripInput, seconds: number): StripGeometry {
  const mm = w / (seconds * SPEED);
  const paperH = 2 * ROW_MM * mm;
  const t1 = s.t0 + seconds * 1000;
  const xAt = (t: number) => ((t - s.t0) / 1000) * SPEED * mm;
  const tAt = (x: number) => s.t0 + (x / (SPEED * mm)) * 1000;

  // paper
  g.fillStyle = '#fffaf7'; g.fillRect(0, 0, w, paperH);
  for (let x = 0, i = 0; x <= w + 0.5; x += mm, i++) {
    g.strokeStyle = i % 5 ? 'rgba(232,120,120,0.22)' : 'rgba(214,80,80,0.5)'; g.lineWidth = i % 5 ? 0.5 : 0.9;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, paperH); g.stroke();
  }
  for (let y = 0, i = 0; y <= paperH + 0.5; y += mm, i++) {
    g.strokeStyle = i % 5 ? 'rgba(232,120,120,0.22)' : 'rgba(214,80,80,0.5)'; g.lineWidth = i % 5 ? 0.5 : 0.9;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
  // the band of the phase at the cursor, over paper and ladder
  if (s.band) {
    const a = Math.max(0, xAt(s.band.from)), b = Math.min(w, xAt(s.band.to));
    if (b > a) { g.fillStyle = withAlpha(s.colors.accent, 0.14); g.fillRect(a, 0, b - a, h); }
  }
  // traces
  s.show.forEach((lead, r) => {
    const data = s.leads[lead];
    const yBase = r * ROW_MM * mm + ROW_MM * mm * 0.58;
    g.fillStyle = '#3b2a2a'; g.font = `600 ${Math.max(11, 3 * mm)}px "JetBrains Mono", ui-monospace, monospace`; g.textBaseline = 'top';
    g.fillText(lead, 1.2 * mm, r * ROW_MM * mm + 1.2 * mm);
    if (!data || !data.length) return;
    const n = data.length;
    const sorted = Array.from(data).sort((p, q) => p - q);
    const base = sorted[Math.floor(n / 2)] ?? 0;
    g.save(); g.beginPath(); g.rect(0, r * ROW_MM * mm, w, ROW_MM * mm); g.clip();
    g.strokeStyle = '#111'; g.lineWidth = Math.max(1.2, 0.3 * mm); g.lineJoin = 'round';
    g.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      const t = s.t0 + i * s.dt;
      if (t > t1) break;
      const x = xAt(t), y = yBase - (data[i] - base) * GAIN * mm;
      if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
    }
    g.stroke(); g.restore();
  });
  // row divider
  g.strokeStyle = 'rgba(214,80,80,0.75)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, ROW_MM * mm); g.lineTo(w, ROW_MM * mm); g.stroke();

  // ladder
  const ly = paperH, lh = h - paperH;
  g.fillStyle = s.colors.surface; g.fillRect(0, ly, w, lh);
  if (s.band) {
    const a = Math.max(0, xAt(s.band.from)), b = Math.min(w, xAt(s.band.to));
    if (b > a) { g.fillStyle = withAlpha(s.colors.accent, 0.14); g.fillRect(a, ly, b - a, lh); }
  }
  const rowH = (lh - 8) / 3, rTop = (i: number) => ly + 4 + i * rowH;
  g.strokeStyle = s.colors.line; g.lineWidth = 1;
  for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(0, rTop(i)); g.lineTo(w, rTop(i)); g.stroke(); }
  const pad = 4;
  const line = (x0: number, y0: number, x1: number, y1: number, color: string, dash = false) => {
    g.strokeStyle = color; g.lineWidth = 2.6; g.lineCap = 'round'; g.setLineDash(dash ? [5, 4] : []);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
  };
  for (const a of s.activations) {
    if (a.kind === 'atria') {
      line(xAt(a.t), rTop(0) + pad, xAt(a.end), rTop(1) - pad, s.colors.fg);
      const avIn = a.t + 40;
      if (a.conductedAt != null) line(xAt(avIn), rTop(1) + pad, xAt(a.conductedAt), rTop(2) - pad, s.colors.fg);
      else if (a.notConducted !== 'dissociated') {
        const xm = xAt(avIn + 90), ym = rTop(1) + rowH * 0.55;
        line(xAt(avIn), rTop(1) + pad, xm, ym, s.colors.abn);
        line(xm - 6, ym, xm + 6, ym, s.colors.abn);
      }
    } else {
      const start = a.delta ?? a.t;
      if (a.route === 'ectopic') {
        // an ectopic focus: the wave starts in the ventricles
        const xm = xAt(a.t), ym = rTop(2) + rowH * 0.62;
        g.fillStyle = s.colors.abn; g.beginPath(); g.arc(xm, ym, 3.5, 0, Math.PI * 2); g.fill();
        line(xm, ym, xAt(a.qrsEnd), rTop(2) + pad, s.colors.abn, true);
        line(xm, ym, xAt(a.qrsEnd), rTop(3) - pad, s.colors.abn, true);
      } else {
        if (a.delta != null) line(xAt(start), rTop(1) + rowH * 0.2, xAt(a.qrsEnd), rTop(3) - pad, s.colors.abn, true);
        line(xAt(a.t), rTop(2) + pad, xAt(a.late ? a.late.from : a.qrsEnd), rTop(3) - pad, s.colors.fg);
        if (a.late) line(xAt(a.late.from), rTop(2) + pad, xAt(a.qrsEnd), rTop(3) - pad, s.colors.abn, true);
      }
    }
  }
  g.fillStyle = s.colors.surface; g.fillRect(0, ly + 2, 30, lh - 4);
  g.font = `500 11px "JetBrains Mono", ui-monospace, monospace`; g.fillStyle = s.colors.muted; g.textBaseline = 'middle'; g.textAlign = 'left';
  [s.labels.atria, s.labels.av, s.labels.ventricles].forEach((l, i) => g.fillText(l, 4, rTop(i) + rowH / 2));

  // cursor
  const xc = xAt(s.cursor);
  g.strokeStyle = s.colors.accent; g.lineWidth = 2.5; g.beginPath(); g.moveTo(xc, 0); g.lineTo(xc, h); g.stroke();
  g.fillStyle = s.colors.accent; g.beginPath(); g.moveTo(xc - 7, 0); g.lineTo(xc + 7, 0); g.lineTo(xc, 9); g.closePath(); g.fill();
  return { tAt, xAt, height: h };
}

export function withAlpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}
