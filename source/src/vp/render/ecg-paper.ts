import { LEAD_NAMES, type LeadName } from '../measurements/ecg.ts';

/* ---------------------------------------------------------------------------
   A 12-lead ECG as it comes off the machine: 25 mm/s, 10 mm/mV, the
   standard 3 × 4 layout (each column the same 2.5 s of all its leads,
   recorded simultaneously) and a 10-second rhythm strip of lead II, on
   millimetre paper with a calibration pulse. Reading it is the learner's
   job; the paper only has to be true.
--------------------------------------------------------------------------- */

const LAYOUT: LeadName[][] = [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']];
export const PAPER_MM = { width: 262, height: 128 };

export interface PaperOptions { pxPerMm: number; header?: string; rhythm?: LeadName; speed?: number; gain?: number }

export function drawEcgPaper(canvas: HTMLCanvasElement, leads: Record<LeadName, ArrayLike<number>>, fs: number, o: PaperOptions): void {
  const mm = o.pxPerMm, speed = o.speed ?? 25, gain = o.gain ?? 10;
  const W = PAPER_MM.width * mm, H = PAPER_MM.height * mm;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#fffaf7'; g.fillRect(0, 0, W, H);
  // grid
  for (let x = 0, i = 0; x <= W; x += mm, i++) {
    g.strokeStyle = i % 5 ? 'rgba(232,120,120,0.22)' : 'rgba(214,80,80,0.5)'; g.lineWidth = i % 5 ? 0.5 : 0.9;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  for (let y = 0, i = 0; y <= H; y += mm, i++) {
    g.strokeStyle = i % 5 ? 'rgba(232,120,120,0.22)' : 'rgba(214,80,80,0.5)'; g.lineWidth = i % 5 ? 0.5 : 0.9;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  g.fillStyle = '#3b2a2a'; g.font = `600 ${Math.max(9, 2.6 * mm)}px "JetBrains Mono", ui-monospace, monospace`; g.textBaseline = 'alphabetic';
  if (o.header) g.fillText(o.header, 4 * mm, 5 * mm);
  g.font = `400 ${Math.max(8, 2.2 * mm)}px "JetBrains Mono", ui-monospace, monospace`;
  g.fillText(`${speed} mm/s · ${gain} mm/mV`, W - 52 * mm, 5 * mm);

  const n = leads.II.length;
  const base: Record<string, number> = {};
  for (const l of LEAD_NAMES) { const a = Array.from(leads[l]).sort((p, q) => p - q); base[l] = a[Math.floor(a.length / 2)] ?? 0; }
  const x0 = 10 * mm;          // after the calibration pulse
  const rowH = 27 * mm, top = 10 * mm;
  const trace = (lead: LeadName, i0: number, i1: number, x: number, y: number) => {
    g.strokeStyle = '#111'; g.lineWidth = Math.max(1, 0.28 * mm); g.lineJoin = 'round';
    g.beginPath();
    for (let i = i0; i < i1 && i < n; i++) {
      const px = x + ((i - i0) / fs) * speed * mm, py = y - (leads[lead][i] - base[lead]) * gain * mm;
      i === i0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.stroke();
  };
  const cal = (y: number) => {
    g.strokeStyle = '#111'; g.lineWidth = Math.max(1, 0.28 * mm);
    g.beginPath(); g.moveTo(2 * mm, y); g.lineTo(3 * mm, y); g.lineTo(3 * mm, y - gain * mm); g.lineTo(8 * mm, y - gain * mm); g.lineTo(8 * mm, y); g.lineTo(9 * mm, y); g.stroke();
  };
  const seg = Math.round(2.5 * fs);
  const start = Math.max(0, n - 4 * seg);
  LAYOUT.forEach((row, r) => {
    const y = top + rowH * r + rowH * 0.62;
    cal(y);
    row.forEach((lead, cIdx) => {
      const x = x0 + cIdx * 2.5 * speed * mm;
      trace(lead, start + cIdx * seg, start + (cIdx + 1) * seg, x, y);
      g.fillStyle = '#111'; g.font = `700 ${Math.max(9, 2.8 * mm)}px "JetBrains Mono", ui-monospace, monospace`;
      g.fillText(lead, x + 1.2 * mm, y - 9 * mm);
      if (cIdx) { g.strokeStyle = '#111'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y - 2.5 * mm); g.lineTo(x, y + 2.5 * mm); g.stroke(); }
    });
  });
  const ry = top + rowH * 3 + rowH * 0.5;
  const rl = o.rhythm ?? 'II';
  cal(ry);
  trace(rl, Math.max(0, n - 4 * seg), n, x0, ry);
  g.fillStyle = '#111'; g.font = `700 ${Math.max(9, 2.8 * mm)}px "JetBrains Mono", ui-monospace, monospace`;
  g.fillText(rl, x0 + 1.2 * mm, ry - 9 * mm);
}

/** A monitor-style sweep of one lead, for the bedside and the physiology chapter. */
export function drawSweep(g: CanvasRenderingContext2D, data: ArrayLike<number>, x: number, y: number, w: number, h: number, color: string, mvRange = 3): void {
  const n = data.length;
  if (!n) return;
  let mid = 0; for (let i = 0; i < n; i++) mid += data[i]; mid /= n;
  g.strokeStyle = color; g.lineWidth = 1.5; g.beginPath();
  for (let i = 0; i < n; i++) {
    const px = x + (i / (n - 1)) * w, py = y + h / 2 - ((data[i] - mid) / mvRange) * h;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.stroke();
}
