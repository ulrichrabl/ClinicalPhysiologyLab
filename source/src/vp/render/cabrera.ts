import { withAlpha } from './station-strip.ts';

/* ---------------------------------------------------------------------------
   The ECG station's axis pane: the six limb leads in the frontal plane,
   laid out as the Cabrera circle (aVL −30°, I 0°, −aVR +30°, II +60°,
   aVF +90°, III +120°), with the heart's mean QRS vector, the loop the
   dipole drew through the last QRS, and the dipole at the cursor.

   Nothing here is a textbook drawing: each lead's axis is the station's
   own lead vector (so misplaced electrodes turn it), the mean vector is
   the recorded dipole integrated over the last QRS, and each lead's small
   complex is that QRS projected on that lead. A lead's net deflection is
   the mean vector's shadow on its axis; the lead most nearly at right
   angles to the vector is the most nearly isoelectric.
--------------------------------------------------------------------------- */

export interface CabreraLead {
  name: string;
  /** the lead's vector in the frontal plane: a to the patient's left, b towards the feet */
  a: number; b: number;
  /** its QRS through the last beat (mV), and the net area (mV·ms) */
  complex: ArrayLike<number> | null;
  area: number;
}
export interface CabreraInput {
  /** in Cabrera order; −aVR is given as its own lead with the sign turned */
  leads: CabreraLead[];
  /** the mean QRS vector as the leads give it, frontal (left, feet), any scale */
  mean: [number, number] | null;
  /** the heart's own mean vector, when it differs from what the leads give (electrodes not where the reader assumes) */
  truth?: [number, number] | null;
  /** the dipole's path through the last QRS, and now, in mV */
  loop: Array<[number, number]>;
  dipole: [number, number] | null;
  scale: number;
  focus: string | null;
  colors: { fg: string; muted: string; accent: string; abn: string; line: string; surface: string; sunk: string };
  labels: { normal: string; lad: string; rad: string; extreme: string; mean: string; now: string };
}
export interface CabreraHit { name: string; x: number; y: number; w: number; h: number }

export const cabreraHeight = (w: number) => (w >= 640 ? 360 : Math.round(w * 0.95) + 300);

const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
/** An angle in degrees, in the usual −180…+180 range. */
export const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
export const angleOf = (a: number, b: number) => deg(Math.atan2(b, a));

/** The usual reading of an axis (AHA/ACCF/HRS 2009: normal −30° to +90°). */
export function axisClass(d: number): 'normal' | 'lad' | 'rad' | 'extreme' {
  const x = wrapDeg(d);
  if (x >= -30 && x <= 90) return 'normal';
  if (x < -30 && x >= -90) return 'lad';
  if (x > 90 || x === -180) return 'rad';   // ±180° is the end of the right range
  return 'extreme';
}

export function drawCabrera(g: CanvasRenderingContext2D, w: number, h: number, s: CabreraInput): CabreraHit[] {
  const c = s.colors, hits: CabreraHit[] = [];
  const wide = w >= 640;
  const r = wide ? Math.min(h / 2 - 44, w * 0.24) : Math.min(w / 2 - 46, 170);
  const cx = wide ? r + 48 : w / 2, cy = wide ? h / 2 + 4 : r + 46;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';

  /* the ranges, as faint sectors (screen angles: x right = patient's left, y down = feet) */
  const sector = (from: number, to: number, col: string) => { g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, rad(from), rad(to)); g.closePath(); g.fillStyle = col; g.fill(); };
  sector(-30, 90, withAlpha('#2e7d4f', 0.10));
  sector(-90, -30, withAlpha('#c98a1b', 0.12));
  sector(90, 180, withAlpha('#c98a1b', 0.12));
  sector(-180, -90, withAlpha(c.abn, 0.10));
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.strokeStyle = c.line; g.lineWidth = 1; g.stroke();
  g.font = '600 10px "Atkinson Hyperlegible", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const sectorLabel = (d: number, text: string, col: string) => { g.fillStyle = col; g.fillText(text, cx + Math.cos(rad(d)) * r * 0.72, cy + Math.sin(rad(d)) * r * 0.72); };
  sectorLabel(12, s.labels.normal, '#2e7d4f'); sectorLabel(-62, s.labels.lad, '#a06a10'); sectorLabel(140, s.labels.rad, '#a06a10'); sectorLabel(-140, s.labels.extreme, c.abn);

  /* the six leads: the positive half solid, ending in its name; the negative half dashed */
  for (const L of s.leads) {
    const m = Math.hypot(L.a, L.b) || 1, ux = L.a / m, uy = L.b / m;
    const on = s.focus === L.name;
    g.strokeStyle = on ? c.accent : c.fg; g.lineWidth = on ? 2.6 : 1.3;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + ux * r, cy + uy * r); g.stroke();
    g.setLineDash([3, 4]); g.strokeStyle = on ? withAlpha(c.accent, 0.6) : c.line; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - ux * r, cy - uy * r); g.stroke(); g.setLineDash([]);
    const lx = cx + ux * (r + 20), ly = cy + uy * (r + 14);
    g.font = `${on ? 700 : 600} 12px "JetBrains Mono", ui-monospace, monospace`; g.fillStyle = on ? c.accent : c.fg;
    g.fillText(L.name, lx, ly);
    g.font = '500 9px "JetBrains Mono", ui-monospace, monospace'; g.fillStyle = c.muted;
    const a = Math.round(angleOf(L.a, L.b));
    g.fillText(`${a > 0 ? '+' : a < 0 ? '−' : ''}${Math.abs(a)}°`, lx, ly + 12);
    hits.push({ name: L.name, x: lx - 22, y: ly - 12, w: 44, h: 30 });
  }

  /* the loop the dipole drew through the last QRS, and the dipole now */
  const k = (r * 0.9) / Math.max(0.2, s.scale);
  if (s.loop.length > 1) {
    g.strokeStyle = withAlpha(c.accent, 0.55); g.lineWidth = 1.6; g.beginPath();
    s.loop.forEach(([x, y], i) => (i ? g.lineTo(cx + x * k, cy + y * k) : g.moveTo(cx + x * k, cy + y * k)));
    g.stroke();
  }
  if (s.dipole && Math.hypot(...s.dipole) * k > 4) arrow(g, cx, cy, cx + s.dipole[0] * k, cy + s.dipole[1] * k, withAlpha(c.fg, 0.55), 2);

  /* the heart's own, when the electrodes misreport it: faint, for comparison */
  if (s.truth && Math.hypot(...s.truth) > 1e-9) {
    const m = Math.hypot(...s.truth), ux = s.truth[0] / m, uy = s.truth[1] / m;
    g.setLineDash([5, 4]); arrow(g, cx, cy, cx + ux * r * 0.82, cy + uy * r * 0.82, withAlpha(c.muted, 0.8), 2); g.setLineDash([]);
    g.font = '600 10px "Atkinson Hyperlegible", system-ui, sans-serif'; g.fillStyle = c.muted;
    g.fillText(s.labels.now, cx + ux * (r * 0.82 + 14), cy + uy * (r * 0.82 + 14));
  }
  /* the mean QRS vector: the axis */
  if (s.mean && Math.hypot(...s.mean) > 1e-9) {
    const m = Math.hypot(...s.mean), ux = s.mean[0] / m, uy = s.mean[1] / m;
    /* its shadow on the focused lead */
    const f = s.leads.find((L) => L.name === s.focus);
    if (f) {
      const fm = Math.hypot(f.a, f.b) || 1, fx = f.a / fm, fy = f.b / fm, dot = ux * fx + uy * fy;
      const px = cx + fx * dot * r * 0.82, py = cy + fy * dot * r * 0.82;
      g.setLineDash([2, 3]); g.strokeStyle = c.accent; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx + ux * r * 0.82, cy + uy * r * 0.82); g.lineTo(px, py); g.stroke(); g.setLineDash([]);
      g.strokeStyle = dot >= 0 ? '#2e7d4f' : c.abn; g.lineWidth = 6; g.globalAlpha = 0.7;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(px, py); g.stroke(); g.globalAlpha = 1;
    }
    arrow(g, cx, cy, cx + ux * r * 0.82, cy + uy * r * 0.82, c.abn, 3.5);
    const a = Math.round(angleOf(s.mean[0], s.mean[1]));
    g.font = '700 13px "JetBrains Mono", ui-monospace, monospace'; g.fillStyle = c.abn;
    g.fillText(`${a > 0 ? '+' : a < 0 ? '−' : ''}${Math.abs(a)}°`, cx + ux * r * 0.5 + uy * 14, cy + uy * r * 0.5 - ux * 14);
  }
  g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fillStyle = c.fg; g.fill();

  /* each lead's QRS, in the same order: the mean vector's shadow, beat by beat */
  const x0 = wide ? cx + r + 70 : 12, y0 = wide ? 22 : cy + r + 52;
  const cw = wide ? w - x0 - 8 : w - 24, rowH = wide ? (h - 40) / s.leads.length : 44;
  const all = s.leads.flatMap((L) => (L.complex ? Array.from(L.complex) : [0]));
  const amp = Math.max(0.3, ...all.map(Math.abs));
  const maxArea = Math.max(1e-6, ...s.leads.map((L) => Math.abs(L.area)));
  /* the most nearly isoelectric lead: smallest net area for its size */
  const iso = s.leads.reduce((best, L) => (Math.abs(L.area) < Math.abs(best.area) ? L : best), s.leads[0]);
  s.leads.forEach((L, i) => {
    const y = y0 + rowH * (i + 0.5), on = s.focus === L.name;
    if (on) { g.fillStyle = withAlpha(c.accent, 0.1); g.fillRect(x0 - 4, y - rowH / 2 + 2, cw + 8, rowH - 4); }
    g.font = `${on ? 700 : 600} 12px "JetBrains Mono", ui-monospace, monospace`; g.fillStyle = on ? c.accent : c.fg; g.textAlign = 'left';
    g.fillText(L.name, x0, y);
    const tx = x0 + 44, tw = Math.max(40, cw * 0.42);
    g.strokeStyle = c.line; g.lineWidth = 1; g.beginPath(); g.moveTo(tx, y); g.lineTo(tx + tw, y); g.stroke();
    if (L.complex && L.complex.length > 1) {
      g.strokeStyle = c.fg; g.lineWidth = 1.5; g.beginPath();
      for (let j = 0; j < L.complex.length; j++) { const xx = tx + (j / (L.complex.length - 1)) * tw, yy = y - (L.complex[j] / amp) * (rowH * 0.42); j ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
      g.stroke();
    }
    /* the net area as a bar: up positive, down negative */
    const bx = tx + tw + 14, bw = 14, bh = (L.area / maxArea) * rowH * 0.4;
    g.fillStyle = L.area >= 0 ? '#2e7d4f' : c.abn; g.globalAlpha = 0.8;
    g.fillRect(bx, Math.min(y, y - bh), bw, Math.max(1, Math.abs(bh))); g.globalAlpha = 1;
    g.font = '500 11px "JetBrains Mono", ui-monospace, monospace'; g.fillStyle = c.muted;
    const sign = L === iso ? '≈ 0' : L.area > 0 ? '+' : '−';
    g.fillText(sign, bx + bw + 8, y);
    hits.push({ name: L.name, x: x0 - 4, y: y - rowH / 2, w: cw + 8, h: rowH });
  });
  g.restore();
  return hits;
}

function arrow(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, width: number) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - 8 * Math.cos(a), y1 - 8 * Math.sin(a)); g.stroke();
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 13 * Math.cos(a - 0.4), y1 - 13 * Math.sin(a - 0.4)); g.lineTo(x1 - 13 * Math.cos(a + 0.4), y1 - 13 * Math.sin(a + 0.4)); g.closePath(); g.fill();
}
