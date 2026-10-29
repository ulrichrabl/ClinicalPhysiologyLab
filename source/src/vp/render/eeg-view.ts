import { electrodeDir, toMap, OLD_NAME, type Vec3 } from '../measurements/eeg-forward.ts';

/* ---------------------------------------------------------------------------
   The EEG station's drawings: the page as the machine draws it, the head
   from above with the scalp field, a section through the head with the
   field in every shell, and one chain of electrodes with the potential
   along it and each channel's deflection.

   EEG conventions: negative is drawn up; a page runs at 30 mm/s; the
   sensitivity is µV per mm. Field colours: blue negative, red positive.
--------------------------------------------------------------------------- */

export interface Colors { fg: string; muted: string; accent: string; line: string; surface: string; sunk: string; abn: string }

/** blue for negative, red for positive, white at zero; v in −1…1 */
export function fieldRGB(v: number): [number, number, number] {
  const x = Math.max(-1, Math.min(1, v));
  const a = Math.abs(x) ** 0.8;
  return x < 0 ? [255 - a * (255 - 33), 255 - a * (255 - 102), 255 - a * (255 - 172)] : [255 - a * (255 - 190), 255 - a * (255 - 40), 255 - a * (255 - 40)];
}
export function fieldColor(v: number, alpha = 1): string {
  const [r, g, b] = fieldRGB(v);
  return `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
}

/** A grid of values (row by row from the top; NaN = outside) painted smoothly into a square. */
function paintGrid(g: CanvasRenderingContext2D, grid: Float32Array, n: number, f: (v: number) => number, x: number, y: number, size: number) {
  if (typeof document === 'undefined') return;
  const off = document.createElement('canvas'); off.width = n; off.height = n;
  const og = off.getContext('2d')!, img = og.createImageData(n, n);
  for (let k = 0; k < n * n; k++) {
    const v = grid[k];
    /* a cell outside the head takes its nearest neighbour inside, so smoothing does not fade the rim */
    let w = v;
    if (!Number.isFinite(w)) { const i = k % n, j = (k / n) | 0, ci = (n - 1) / 2; const ii = Math.round(ci + (i - ci) * 0.94), jj = Math.round(ci + (j - ci) * 0.94); w = grid[jj * n + ii]; }
    const col = fieldRGB(Number.isFinite(w) ? f(w) : 0);
    img.data[4 * k] = col[0]; img.data[4 * k + 1] = col[1]; img.data[4 * k + 2] = col[2]; img.data[4 * k + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(off, x, y, size, size);
}

/* ---- the page ------------------------------------------------------------------------------------ */

export interface PageInput {
  channels: Array<{ label: string; data: Float32Array; groupStart?: boolean; strong?: boolean }>;
  fs: number; seconds: number;
  /** the window's start on the record (ms) */
  fromMs: number;
  /** µV per mm */
  sens: number;
  cursorMs: number | null;
  colors: Colors;
  labels: { second: string };
}
export const MM_PER_S = 30;
const GUTTER = 64;

export interface PageGeometry { tAt(x: number): number; xAt(t: number): number; mm: number }

export function pageHeight(n: number, groups: number) { return Math.round(26 + n * 22 + groups * 8); }

export function drawPage(g: CanvasRenderingContext2D, w: number, h: number, p: PageInput): PageGeometry {
  const plotW = w - GUTTER;
  const mm = plotW / (p.seconds * MM_PER_S);
  const xAt = (t: number) => GUTTER + ((t - p.fromMs) / 1000) * MM_PER_S * mm;
  const tAt = (x: number) => p.fromMs + ((x - GUTTER) / (MM_PER_S * mm)) * 1000;
  g.fillStyle = p.colors.surface; g.fillRect(0, 0, w, h);
  /* time grid: a line every second, faint every 200 ms */
  for (let i = Math.ceil(p.fromMs / 200); i <= (p.fromMs + p.seconds * 1000) / 200; i++) {
    const x = xAt(i * 200);
    g.strokeStyle = p.colors.line; g.globalAlpha = i % 5 ? 0.35 : 1; g.lineWidth = i % 5 ? 0.5 : 1;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h - 20); g.stroke();
  }
  g.globalAlpha = 1;
  const n = p.channels.length, groups = p.channels.filter((c) => c.groupStart).length;
  const row = (h - 26 - groups * 8) / n;
  let y = 4;
  g.font = '500 11px "JetBrains Mono", ui-monospace, monospace'; g.textBaseline = 'middle';
  for (const c of p.channels) {
    if (c.groupStart) y += 8;
    const base = y + row / 2;
    g.fillStyle = c.strong ? p.colors.fg : p.colors.muted; g.textAlign = 'left';
    g.fillText(c.label, 4, base);
    g.strokeStyle = c.strong ? p.colors.fg : p.colors.fg; g.lineWidth = c.strong ? 1.3 : 1;
    g.beginPath();
    const step = 1000 / p.fs, i0 = Math.max(0, Math.floor(p.fromMs / step)), i1 = Math.min(c.data.length - 1, Math.ceil((p.fromMs + p.seconds * 1000) / step));
    for (let i = i0; i <= i1; i++) {
      const x = xAt(i * step), v = c.data[i];
      /* negative up: a channel goes up when input 1 is negative relative to input 2 */
      const yy = base + (v / p.sens) * mm;
      if (i === i0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
    y += row;
  }
  /* calibration: 50 µV and 1 s */
  const barUv = 50, barH = (barUv / p.sens) * mm, bx = w - 12, by = h - 24;
  g.strokeStyle = p.colors.fg; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by - barH); g.moveTo(bx, by); g.lineTo(bx - MM_PER_S * mm, by); g.stroke();
  g.fillStyle = p.colors.muted; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
  g.fillText(`${barUv} µV`, bx - 4, by - barH + 10);
  g.fillText(`1 ${p.labels.second}`, bx - 4, h - 6);
  if (p.cursorMs != null) {
    const x = xAt(p.cursorMs);
    g.strokeStyle = p.colors.accent; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h - 20); g.stroke();
  }
  return { tAt, xAt, mm };
}

/* ---- the head from above -------------------------------------------------------------------------- */

export interface MapInput {
  grid: Float32Array; n: number;
  /** multiplies the grid (the waveform at the cursor) */
  k: number;
  /** colour scale: the largest |µV| at the peak */
  max: number;
  electrodes: Array<{ name: string; v: number }>;
  patchOutline: Array<[number, number]>;
  patchCentre: [number, number];
  /** the negative end, drawn from the centre: a map vector, or null when it points straight at the viewer */
  arrow: [number, number] | null;
  facing: 'out' | 'in' | null;
  colors: Colors;
  labels: { nose: string; left: string; right: string };
}

/** Map units → canvas: the disk of radius 1 (130° from the vertex) fills the square. */
export function mapTransform(w: number, h: number) {
  const s = Math.min(w, h) / 2 - 14, cx = w / 2, cy = h / 2 + 4;
  return { s, cx, cy, to: (x: number, y: number): [number, number] => [cx + x * s, cy + y * s], from: (px: number, py: number): [number, number] => [(px - cx) / s, (py - cy) / s] };
}

export function drawHeadMap(g: CanvasRenderingContext2D, w: number, h: number, m: MapInput) {
  const T = mapTransform(w, h);
  g.fillStyle = m.colors.surface; g.fillRect(0, 0, w, h);
  /* the field, smoothed, inside the disk */
  g.save(); g.beginPath(); g.arc(T.cx, T.cy, T.s, 0, 2 * Math.PI); g.clip();
  paintGrid(g, m.grid, m.n, (v) => (v * m.k) / (m.max || 1), T.cx - T.s, T.cy - T.s, 2 * T.s);
  g.restore();
  /* the head: the electrode ring (92°), nose and ears */
  const rHead = (92 / 130) * T.s;
  g.strokeStyle = m.colors.fg; g.lineWidth = 1.5;
  g.beginPath(); g.arc(T.cx, T.cy, rHead, 0, 2 * Math.PI); g.stroke();
  g.beginPath(); g.moveTo(T.cx - 10, T.cy - rHead + 1); g.lineTo(T.cx, T.cy - rHead - 12); g.lineTo(T.cx + 10, T.cy - rHead + 1); g.stroke();
  /* the ears, where the ear electrodes sit */
  for (const e of ['A1', 'A2']) { const [ex, ey] = T.to(...toMap(electrodeDir(e))); g.beginPath(); g.ellipse(ex, ey, 5, 12, 0, 0, 2 * Math.PI); g.stroke(); }
  g.strokeStyle = m.colors.line; g.lineWidth = 1; g.setLineDash([3, 4]);
  g.beginPath(); g.arc(T.cx, T.cy, T.s, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]);
  /* the patch */
  if (m.patchOutline.length > 2) {
    g.strokeStyle = m.colors.fg; g.lineWidth = 1.5; g.setLineDash([4, 3]);
    g.beginPath(); m.patchOutline.forEach(([x, y], i) => { const [px, py] = T.to(x, y); if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.closePath(); g.stroke(); g.setLineDash([]);
  }
  const [pcx, pcy] = T.to(...m.patchCentre);
  g.fillStyle = m.colors.fg;
  if (m.arrow) {
    const [ax, ay] = T.to(m.patchCentre[0] + m.arrow[0], m.patchCentre[1] + m.arrow[1]);
    arrow(g, pcx, pcy, ax, ay, m.colors.fg);
    g.font = '700 14px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const dx = ax - pcx, dy = ay - pcy, d = Math.hypot(dx, dy) || 1;
    g.fillText('−', ax + (dx / d) * 9, ay + (dy / d) * 9);
  } else if (m.facing) {
    g.beginPath(); g.arc(pcx, pcy, 6, 0, 2 * Math.PI); g.lineWidth = 1.5; g.strokeStyle = m.colors.fg; g.stroke();
    if (m.facing === 'out') { g.beginPath(); g.arc(pcx, pcy, 2, 0, 2 * Math.PI); g.fill(); }
    else { g.beginPath(); g.moveTo(pcx - 4, pcy - 4); g.lineTo(pcx + 4, pcy + 4); g.moveTo(pcx + 4, pcy - 4); g.lineTo(pcx - 4, pcy + 4); g.stroke(); }
  }
  /* electrodes */
  g.font = '600 10px "JetBrains Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
  for (const e of m.electrodes) {
    const [x, y] = T.to(...toMap(electrodeDir(e.name)));
    g.beginPath(); g.arc(x, y, 4.5, 0, 2 * Math.PI);
    g.fillStyle = fieldColor((e.v * m.k) / (m.max || 1)); g.fill();
    g.strokeStyle = m.colors.fg; g.lineWidth = 1; g.stroke();
    g.fillStyle = m.colors.fg;
    g.fillText(e.name, x, y + (e.name === 'A1' || e.name === 'A2' ? 14 : 6));
  }
  g.fillStyle = m.colors.muted; g.font = '500 11px system-ui';
  g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(m.labels.nose, T.cx, 2);
  g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(m.labels.left, 4, h - 4);
  g.textAlign = 'right'; g.fillText(m.labels.right, w - 4, h - 4);
}

function arrow(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 9 * Math.cos(a - 0.4), y1 - 9 * Math.sin(a - 0.4)); g.lineTo(x1 - 9 * Math.cos(a + 0.4), y1 - 9 * Math.sin(a + 0.4)); g.closePath(); g.fill();
}

/* ---- a section through the head --------------------------------------------------------------- */

export interface SectionInput {
  values: Float32Array; n: number; R: number; k: number; max: number;
  radii: number[]; names: string[];
  /** the patch's points in the section's own coordinates (mm: a up, b right), and its negative end */
  patch: Array<[number, number]>;
  q: [number, number];
  /** electrodes close to the plane, in the section's coordinates (unit circle) */
  electrodes: Array<{ name: string; a: number; b: number }>;
  colors: Colors;
  shellLabels: Record<string, string>;
}

export function drawSection(g: CanvasRenderingContext2D, w: number, h: number, s: SectionInput) {
  const r = Math.min(w - 110, h) / 2 - 12, cx = 50 + (w - 50) / 2, cy = h / 2;
  g.fillStyle = s.colors.surface; g.fillRect(0, 0, w, h);
  /* the field is far larger inside the brain near the source than on the scalp: show it on a scale that compresses */
  const comp = (v: number) => Math.sign(v) * Math.log1p(Math.abs(v) / (s.max || 1) * 4) / Math.log1p(4);
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 2 * Math.PI); g.clip();
  paintGrid(g, s.values, s.n, (v) => comp(v * s.k), cx - r, cy - r, 2 * r);
  g.restore();
  g.strokeStyle = s.colors.fg; g.lineWidth = 1;
  for (const rr of s.radii) { g.beginPath(); g.arc(cx, cy, (rr / s.R) * r, 0, 2 * Math.PI); g.stroke(); }
  /* the shells' names, at the bottom, each pointing at its ring */
  g.font = '500 10px system-ui'; g.fillStyle = s.colors.fg; g.textBaseline = 'middle';
  let inner = 0;
  s.radii.forEach((rr, i) => {
    const mid = ((inner + rr) / 2 / s.R) * r;
    if (i > 0) {
      const ang = Math.PI / 2 + 0.55 + i * 0.22, px = cx + Math.cos(ang) * mid, py = cy + Math.sin(ang) * mid;
      const lx = cx - r - 6, ly = cy + r * 0.55 + (i - 1) * 14;
      g.strokeStyle = s.colors.muted; g.lineWidth = 0.75; g.beginPath(); g.moveTo(px, py); g.lineTo(lx + 2, ly); g.stroke();
      g.textAlign = 'right'; g.fillText(s.shellLabels[s.names[i]] ?? s.names[i], lx, ly);
    }
    inner = rr;
  });
  g.textAlign = 'center'; g.fillText(s.shellLabels.brain ?? 'brain', cx, cy + r * 0.35);
  /* the patch and its negative end */
  g.fillStyle = s.colors.fg;
  for (const [a, b] of s.patch) { g.beginPath(); g.arc(cx + (b / s.R) * r, cy - (a / s.R) * r, 1.6, 0, 2 * Math.PI); g.fill(); }
  const [a0, b0] = s.patch[0] ?? [0, 0];
  const x0 = cx + (b0 / s.R) * r, y0 = cy - (a0 / s.R) * r;
  const L = 34, x1 = x0 + s.q[1] * L, y1 = y0 - s.q[0] * L;
  if (Math.hypot(s.q[0], s.q[1]) > 0.15) { arrow(g, x0, y0, x1, y1, '#111'); arrow(g, x0, y0, x1, y1, s.colors.fg); g.font = '700 13px system-ui'; g.textAlign = 'center'; g.fillText('−', x1 + s.q[1] * 9, y1 - s.q[0] * 9); }
  /* electrodes in the plane */
  g.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
  for (const e of s.electrodes) {
    const x = cx + e.b * (r + 1), y = cy - e.a * (r + 1);
    g.beginPath(); g.arc(x, y, 3.5, 0, 2 * Math.PI); g.fillStyle = s.colors.fg; g.fill();
    g.textAlign = e.b >= 0 ? 'left' : 'right'; g.fillText(e.name, x + (e.b >= 0 ? 6 : -6), y);
  }
}

/* ---- one chain --------------------------------------------------------------------------------- */

export interface ChainInput {
  electrodes: string[];
  /** µV at the cursor */
  v: number[];
  /** the montage's channels along this chain: input 1, input 2 and the value */
  channels: Array<{ a: string; b: string; value: number }>;
  /** referential: the reference's potential */
  ref: { name: string; v: number } | null;
  max: number;
  colors: Colors;
  labels: { potential: string; channels: string; reversal: string; up: string };
  reversalAt: string[];
}

export function drawChain(g: CanvasRenderingContext2D, w: number, h: number, c: ChainInput) {
  g.fillStyle = c.colors.surface; g.fillRect(0, 0, w, h);
  const n = c.electrodes.length, left = 54, right = 16;
  const xAt = (i: number) => left + ((w - left - right) * (i + 0.5)) / n;
  const topH = h * 0.5, mid = 14 + topH / 2;
  const scaleY = (topH / 2 - 10) / (c.max || 1);
  /* potential along the chain, negative up as on the page */
  g.strokeStyle = c.colors.line; g.lineWidth = 1; g.beginPath(); g.moveTo(left - 6, mid); g.lineTo(w - right, mid); g.stroke();
  g.font = '500 10px system-ui'; g.fillStyle = c.colors.muted; g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillText(c.labels.potential, 4, 2);
  g.textBaseline = 'middle'; g.fillText('0', left - 16, mid);
  g.fillText('−', left - 16, mid - topH / 2 + 12); g.fillText('+', left - 16, mid + topH / 2 - 12);
  if (c.ref) {
    const yr = mid + c.ref.v * scaleY;
    g.strokeStyle = c.colors.abn; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(left - 6, yr); g.lineTo(w - right, yr); g.stroke(); g.setLineDash([]);
    g.fillStyle = c.colors.abn; g.textAlign = 'right'; g.fillText(c.ref.name === 'AVG' ? 'Avg' : c.ref.name, w - right, yr - 8);
  }
  g.strokeStyle = c.colors.fg; g.lineWidth = 2; g.beginPath();
  c.v.forEach((v, i) => { const x = xAt(i), y = mid + v * scaleY; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.stroke();
  g.font = '600 10px "JetBrains Mono", ui-monospace, monospace'; g.textAlign = 'center';
  c.v.forEach((v, i) => {
    const x = xAt(i), y = mid + v * scaleY;
    g.beginPath(); g.arc(x, y, 5, 0, 2 * Math.PI); g.fillStyle = fieldColor(v / (c.max || 1)); g.fill(); g.strokeStyle = c.colors.fg; g.lineWidth = 1; g.stroke();
    const name = c.electrodes[i];
    g.fillStyle = c.reversalAt.includes(name) ? c.colors.accent : c.colors.fg;
    g.textBaseline = 'top'; g.fillText(OLD_NAME[name] ? `${name}` : name, x, topH + 14);
  });
  /* each channel's deflection: an arrow up (input 1 negative) or down */
  const chTop = topH + 32, chMid = chTop + (h - chTop) / 2;
  /* the channels on the scale of this chain's largest, so the smaller ones still show their direction */
  const chMax = Math.max(...c.channels.map((x) => Math.abs(x.value)), (c.max || 1) * 0.05);
  const chScale = ((h - chTop) / 2 - 6) / chMax;
  g.fillStyle = c.colors.muted; g.font = '500 10px system-ui'; g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillText(c.labels.channels, 4, chTop - 4);
  for (const ch of c.channels) {
    const ia = c.electrodes.indexOf(ch.a), ib = c.electrodes.indexOf(ch.b);
    const x = ib >= 0 ? (xAt(ia) + xAt(ib)) / 2 : xAt(ia);
    const len = Math.max(-((h - chTop) / 2 - 6), Math.min((h - chTop) / 2 - 6, ch.value * chScale));
    /* value = V(input 1) − V(input 2): positive draws down */
    if (Math.abs(len) > 1.5) arrow(g, x, chMid, x, chMid + len, c.colors.fg);
    else { g.fillStyle = c.colors.fg; g.fillRect(x - 6, chMid - 0.75, 12, 1.5); }
  }
  g.strokeStyle = c.colors.line; g.beginPath(); g.moveTo(left - 6, chMid); g.lineTo(w - right, chMid); g.stroke();
}

/* the section's electrodes and patch, in its own coordinates */
export function inPlane(p: Vec3, u: Vec3, v: Vec3): [number, number] { return [p[0] * u[0] + p[1] * u[1] + p[2] * u[2], p[0] * v[0] + p[1] * v[1] + p[2] * v[2]]; }
