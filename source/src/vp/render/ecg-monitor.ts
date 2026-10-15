import { LEAD_NAMES, type LeadName, type Vcg } from '../measurements/ecg.ts';
import type { Vec3 } from '../physiology/heart/electrical.ts';

/* ---------------------------------------------------------------------------
   A live ECG monitor: the running heart's dipole, projected through the
   electrodes as they are on the patient right now, swept across the screen
   like a bedside monitor (a bright trace, an erase gap ahead of it).

   Because the leads are recomputed from where the electrodes are, every
   change shows at once: a lead stays flat ("lead off") until all of its
   electrodes are on, and dragging V1 two spaces up changes V1 while you
   drag. Without the right-leg (reference) electrode the machine picks up
   mains hum, as a real one does.

   Like a monitor (and unlike the 12-lead paper) the traces are filtered for
   a steady baseline: a slow high-pass, so the shape of ST segments is only
   approximately true here. The printed ECG is the diagnostic record.
--------------------------------------------------------------------------- */

export interface MonitorSource {
  /** Samples produced so far (a running count). */
  samples(): number;
  /** The newest n samples of the dipole. */
  read(n: number): Vcg;
  /** Heart rate to show (per minute), or null. */
  rate?(): number | null;
}

export interface MonitorOptions {
  leads: LeadName[];                          // which leads, in reading order
  columns: number | ((width: number) => number);   // laid out in this many columns (or as many as fit the width)
  seconds: number;                            // width of one sweep
  vectors: () => Record<LeadName, Vec3 | null>;   // what each lead sees now (null: lead off)
  reference?: () => boolean;                  // is the right-leg electrode on
  showRate?: boolean;
  mvRange?: number;                           // millivolts across a lead's row
  label?: string;                             // small title, top left
  offText?: string;                           // "Lead off"
}

const FS_DRAW = 250;   // drawn at half the model's 500 Hz: indistinguishable on a monitor, half the work

export function mountMonitor(canvas: HTMLCanvasElement, src: MonitorSource, o: MonitorOptions): () => void {
  const fs0 = 500;
  const N = Math.round(o.seconds * FS_DRAW);
  const buf: Record<string, Float32Array> = {};
  const avg: Record<string, number> = {};
  for (const l of LEAD_NAMES) { buf[l] = new Float32Array(N).fill(NaN); avg[l] = NaN; }
  let cursor = 0, last = src.samples(), phase = 0, raf = 0, keep = 0;
  const alpha = 1 / (1.2 * fs0);           // baseline follows over about a second
  const range = o.mvRange ?? 3;

  const take = () => {
    const now = src.samples();
    let n = now - last;
    last = now;
    if (n <= 0) return;
    n = Math.min(n, N * 2);
    const v = src.read(n);
    const L = o.vectors();
    const hum = o.reference && !o.reference() ? 0.09 : 0;
    for (let i = 0; i < v.X.length; i++) {
      phase += 1;
      const x = v.X[i], y = v.Y[i], z = v.Z[i];
      keep += FS_DRAW / fs0;
      const write = keep >= 1;
      if (write) keep -= 1;
      for (const l of o.leads) {
        const vec = L[l];
        if (!vec) { if (write) buf[l][cursor] = NaN; avg[l] = NaN; continue; }
        let s = vec[0] * x + vec[1] * y + vec[2] * z;
        if (hum) s += hum * Math.sin((phase / fs0) * 2 * Math.PI * 50) + hum * 0.4 * Math.sin((phase / fs0) * 2 * Math.PI * 150 + 1);
        avg[l] = Number.isNaN(avg[l]) ? s : avg[l] + (s - avg[l]) * alpha;
        if (write) buf[l][cursor] = s - avg[l];
      }
      if (write) cursor = (cursor + 1) % N;
    }
  };

  const draw = () => {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0c1412'; g.fillRect(0, 0, w, h);
    const head = o.label || o.showRate ? 18 : 0;
    const cols = typeof o.columns === 'function' ? o.columns(w) : o.columns;
    const rows = Math.ceil(o.leads.length / cols);
    const cw = w / cols, ch = (h - head) / rows;
    /* a faint grid: one line per 0.2 s and per 0.5 mV */
    g.strokeStyle = 'rgba(120,200,170,0.07)'; g.lineWidth = 1;
    for (let c = 0; c < cols; c++) for (let k = 1; k < o.seconds * 5; k++) { const x = c * cw + (k / (o.seconds * 5)) * cw; g.beginPath(); g.moveTo(x, head); g.lineTo(x, h); g.stroke(); }
    const font = '"JetBrains Mono", ui-monospace, monospace';
    if (o.label) { g.fillStyle = 'rgba(160,230,200,0.75)'; g.font = `600 11px ${font}`; g.fillText(o.label, 6, 13); }
    if (o.showRate) {
      /* no electrodes, no rate: a monitor only counts what it can see */
      const V = o.vectors(), seen = o.leads.some((l) => V[l]);
      const r = seen ? src.rate?.() : null;
      g.fillStyle = '#5be3a8'; g.font = `700 15px ${font}`; g.textAlign = 'right';
      g.fillText(`♥ ${r != null && Number.isFinite(r) ? Math.round(r) : '--'}`, w - 8, 15); g.textAlign = 'left';
    }
    const gap = Math.round(0.12 * N / o.seconds);
    o.leads.forEach((l, k) => {
      const col = k % cols, row = Math.floor(k / cols);
      const x0 = col * cw + 4, y0 = head + row * ch, yMid = y0 + ch * 0.55, sx = (cw - 8) / N, sy = (ch * 0.9) / range;
      g.fillStyle = 'rgba(160,230,200,0.85)'; g.font = `700 10px ${font}`; g.fillText(l, x0 + 2, y0 + 12);
      const b = buf[l];
      let off = true;
      for (let i = 0; i < N; i += 25) if (!Number.isNaN(b[i])) { off = false; break; }
      if (off) {
        g.strokeStyle = 'rgba(120,200,170,0.35)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x0, yMid); g.lineTo(x0 + cw - 8, yMid); g.stroke(); g.setLineDash([]);
        g.fillStyle = 'rgba(240,190,120,0.9)'; g.font = `600 10px ${font}`; g.fillText(o.offText ?? 'Lead off', x0 + 26, y0 + 12);
        return;
      }
      g.strokeStyle = '#5be3a8'; g.lineWidth = 1.4; g.lineJoin = 'round';
      g.beginPath();
      let pen = false;
      for (let i = 0; i < N; i++) {
        const ahead = (i - cursor + N) % N;
        if (ahead < gap) { pen = false; continue; }       // the erase gap ahead of the sweep
        const v = b[i];
        if (Number.isNaN(v)) { pen = false; continue; }
        const px = x0 + i * sx, py = yMid - Math.max(-range, Math.min(range, v)) * sy;
        if (pen) g.lineTo(px, py); else { g.moveTo(px, py); pen = true; }
        if (i === N - 1) pen = false;
      }
      g.stroke();
      /* the bright head of the trace */
      const hi = (cursor - 1 + N) % N;
      if (!Number.isNaN(b[hi])) { g.fillStyle = '#c9ffe6'; g.beginPath(); g.arc(x0 + hi * sx, yMid - Math.max(-range, Math.min(range, b[hi])) * sy, 1.8, 0, Math.PI * 2); g.fill(); }
    });
  };

  const frame = () => { take(); draw(); raf = requestAnimationFrame(frame); };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
