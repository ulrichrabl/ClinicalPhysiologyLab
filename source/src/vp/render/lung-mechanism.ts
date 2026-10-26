import { lungPath, ribY, heartUnderChest } from './thorax.ts';
import type { LobeId, LobeState, BreathSample } from '../physiology/lung/respiratory.ts';

/* ===========================================================================
   The respiratory station's mechanism: what lies under the chest wall.

   The lungs drawn in the chest's own centimetres (render/thorax.ts: x to the
   patient's left from the midline, y down from the 4th intercostal space),
   so the lobe under a site here is the lobe under that site on the chest.
   Everything drawn is the model's state, never a picture of a disease:

     each lobe        coloured by what fills it, in the model's proportions:
                      air (pale), exudate (consolidation), water (alveolar
                      oedema), nothing (collapse); interstitial water and
                      fibrosis as fine lines at the bases
     the pleura       fluid rising from the base to the height its volume
                      reaches (the examination's own table); air around a
                      lung that has fallen toward its hilum
     the mediastinum  the heart and the trachea moved by the same shift the
                      trachea finding reads
     the airways      trachea, main and lobar bronchi, their walls thickened
                      and lumens narrowed by bronchoconstriction, a plug in
                      the bronchus of a lobe collapsed behind it
     the site         the lobes under the stethoscope outlined, with the
                      share each contributes to what is heard there

   And the breath on one clock (`drawBreath`): lung volume, airflow and the
   pressures that drive it, from the model's own 20 ms samples.
=========================================================================== */

const f = (x: number) => x.toFixed(2);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export interface LungDrawing {
  view: 'front' | 'back';
  lobes: LobeState[];
  effusion: { L: number; R: number };
  /** the fraction of each lung fallen away from the chest wall */
  ptx: { L: number; R: number };
  tension: { L: number; R: number };
  /** the mediastinal shift index (resp-exam's `mediastinalShift`): positive toward the patient's left */
  shift: number;
  bronchoconstriction: number; emphysema: number; fibrosis: number; interstitial: number;
  /** the lungs' size from their tissue, × predicted (respiratory.ts `tissueVolume`): emphysema pushes the diaphragm down,
      fibrosis pulls it up */
  tlcRatio: number;
  /** lung volume above FRC now (L): the lungs swell a little with each breath */
  volume: number;
  /** the site being examined, and the share of each lobe under it */
  site?: { x: number; y: number; side: 'L' | 'R'; lobes: Array<[LobeId, number]> };
  /** fluid height (mL at which it reaches each site key), from the examination model */
  fluidReaches: Record<string, number>;
  beat?: number;
}

export interface LungColors { fg: string; muted: string; accent: string; line: string; surface: string }

/** What fills a lobe, as a colour: air pale pink, exudate rust, water blue, airless (collapsed) dark. */
export const FILL = { air: [243, 214, 210], solid: [176, 96, 63], water: [111, 147, 181], airless: [92, 62, 57] } as const;
export function lobeColour(l: LobeState): string {
  const own = Math.max(0, l.collapsed - l.compressed - l.ptx);
  const parts: Array<[readonly number[], number]> = [[FILL.air, l.aerated], [FILL.solid, l.consolidated], [FILL.water, l.flooded], [FILL.airless, own + l.compressed]];
  const w = parts.reduce((a, [, x]) => a + x, 0) || 1;
  const c = [0, 1, 2].map((i) => Math.round(parts.reduce((a, [rgb, x]) => a + rgb[i] * x, 0) / w));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** The lobes as regions of each lung's outline, in the drawing's own coordinates (viewer's right is +x). From the front
    the patient's left lung is on the viewer's right; from behind, on the viewer's left. */
function lobeRegions(view: 'front' | 'back'): Array<{ id: LobeId; s: 1 | -1; d: string; label: [number, number] }> {
  if (view === 'front') {
    const y4 = ribY(4, 2.4);
    return [
      { id: 'RUL', s: -1, d: `M -2.4 ${f(y4)} C -6 ${f(ribY(4, 6) + 0.2)} -10 ${f(ribY(4, 10) + 0.2)} -14.2 1.6 L -18 1.6 L -18 -17 L -1 -17 L -1 ${f(y4)} Z`, label: [-8, -6] },
      { id: 'RML', s: -1, d: `M -2.4 ${f(y4)} C -6 ${f(ribY(4, 6) + 0.2)} -10 ${f(ribY(4, 10) + 0.2)} -14.2 1.6 L -14.4 2 C -10 4 -6 6.2 -2.4 7.4 Z`, label: [-8, 3.4] },
      { id: 'RLL', s: -1, d: 'M -14.4 2 C -10 4 -6 6.2 -2.4 7.4 L -1 20 L -18 20 L -18 2 Z', label: [-12.2, 8.8] },
      { id: 'LUL', s: 1, d: 'M 14.4 1.4 C 10 3.8 6 6.4 3 8.2 L 1 8.2 L 1 -17 L 18 -17 L 18 1.4 Z', label: [8, -3] },
      { id: 'LLL', s: 1, d: 'M 14.4 1.4 C 10 3.8 6 6.4 3 8.2 L 1 20 L 18 20 L 18 1.4 Z', label: [12.2, 8.6] },
    ];
  }
  /* from behind: the patient's right lung on the viewer's right; the oblique fissure from T3 near the spine */
  return [
    { id: 'RUL', s: 1, d: 'M 1.6 -5 C 6 -3 10 2 13.6 6 L 18 6 L 18 -17 L 1 -17 Z', label: [7, -9] },
    { id: 'RLL', s: 1, d: 'M 1.6 -5 C 6 -3 10 2 13.6 6 L 18 6 L 18 20 L 1 20 Z', label: [7, 9] },
    { id: 'LUL', s: -1, d: 'M -1.6 -5 C -6 -3 -10 2 -13.6 6 L -18 6 L -18 -17 L -1 -17 Z', label: [-7, -9] },
    { id: 'LLL', s: -1, d: 'M -1.6 -5 C -6 -3 -10 2 -13.6 6 L -18 6 L -18 20 L -1 20 Z', label: [-7, 9] },
  ];
}

/** Where each lobe shrinks to when it collapses: toward its bronchus, against the mediastinum (an upper lobe up and in,
    the middle lobe against the right heart border, a lower lobe down and in behind the heart). */
const COLLAPSE_TOWARD: Record<'front' | 'back', Partial<Record<LobeId, [number, number]>>> = {
  front: { RUL: [-3.5, -11], RML: [-3, 3], RLL: [-3, 7], LUL: [3, -9], LLL: [3, 8] },
  back: { RUL: [3, -11], RLL: [3, 12], LUL: [-3, -11], LLL: [-3, 12] },
};

/** A collapsed lobe's own transform: shrunk toward where it collapses, by its airless share. */
function lobeTransform(view: 'front' | 'back', r: { id: LobeId; label: [number, number] }, own: number): string {
  if (own <= 0.05) return '';
  const [ax, ay] = COLLAPSE_TOWARD[view][r.id] ?? r.label, q = 1 - 0.5 * own;
  return ` transform="translate(${f(ax)} ${f(ay)}) scale(${f(q)}) translate(${f(-ax)} ${f(-ay)})"`;
}

/** Which lung (viewer's right +1, left −1) is the patient's left one in this view. */
const leftLungS = (view: 'front' | 'back'): 1 | -1 => (view === 'front' ? 1 : -1);

/** Fluid height in the hemithorax, as a fraction from the base (0) to the apex (1), from its volume: the examination's
    own table of the volume at which fluid lies between the lung and each site, read as heights. */
function fluidHeight(mL: number, reaches: Record<string, number>): number {
  const pts: Array<[number, number]> = [[0, 0], [reaches['lung-base'] ?? 250, 0.1], [reaches.axilla ?? 700, 0.32], [reaches['mid-zone'] ?? 1500, 0.52], [reaches['upper-back'] ?? 2200, 0.7], [reaches['upper-zone'] ?? 2800, 0.84], [4000, 0.97]];
  if (mL <= 0) return 0;
  for (let i = 1; i < pts.length; i++) if (mL <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((mL - x0) / (x1 - x0)) * (y1 - y0); }
  return 0.97;
}

/** The lungs, pleura, mediastinum and airways, as SVG in chest centimetres (viewBox −19…19 × −20…20). */
export function lungsSvg(d: LungDrawing, c: LungColors, labels: { fluid: string; air: string; lobe: Record<LobeId, string> }): string {
  const view = d.view, out: string[] = [];
  const byId = Object.fromEntries(d.lobes.map((l) => [l.id, l])) as Record<LobeId, LobeState>;
  const sideOf = (s: 1 | -1): 'L' | 'R' => (s === leftLungS(view) ? 'L' : 'R');
  /* the mediastinum moves toward the patient's left with a positive shift: on the viewer's right from the front */
  const shiftCm = clamp(d.shift, -2.5, 2.5) * 2.2 * (view === 'front' ? 1 : -1);
  /* a hyperinflated chest: the diaphragm lower and flatter; and each breath swells the lungs a little */
  const stretch = 1 + 0.9 * clamp(d.tlcRatio - 1, -0.3, 0.5);
  const swell = 1 + 0.035 * clamp(d.volume / 0.5, -0.3, 2);
  out.push(`<defs>
    <clipPath id="lm-clip-${view}-R"><path d="${lungPath(1, view)}"/></clipPath><clipPath id="lm-clip-${view}-L"><path d="${lungPath(-1, view)}"/></clipPath>
    <pattern id="lm-solid-${view}" width="1.6" height="1.6" patternUnits="userSpaceOnUse"><path d="M0.2 1.4 L0.8 0.6 L1.4 1.2" fill="none" stroke="rgba(255,240,220,0.75)" stroke-width="0.12"/></pattern>
    <pattern id="lm-airless-${view}" width="0.9" height="0.9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0 L0 0.9" stroke="rgba(0,0,0,0.35)" stroke-width="0.18"/></pattern>
  </defs>`);
  /* the chest wall and the diaphragm */
  const baseY = (view === 'back' ? 17.2 : 13.2) * stretch;
  out.push(`<path d="M -16.5 -15 C -17.5 -4 -17.5 8 -16 ${f(baseY)} M 16 ${f(baseY)} C 17.5 8 17.5 -4 16.5 -15" fill="none" stroke="${c.line}" stroke-width="0.35"/>`);
  for (const s of [-1, 1] as const) {
    const side = sideOf(s), clip = `lm-clip-${view}-${s > 0 ? 'R' : 'L'}`;
    const ptx = clamp(d.ptx[side], 0, 1), tens = d.tension[side] > 0;
    const hilum: [number, number] = [s * 4 + shiftCm * 0.6, -1];
    const scaleY = stretch * swell;
    const g: string[] = [];
    /* the pleural space: air where the lung has fallen away */
    if (ptx > 0.02) g.push(`<rect x="-19" y="-20" width="38" height="40" fill="${tens ? 'rgba(40,40,46,0.85)' : 'rgba(60,60,66,0.7)'}"/>`);
    /* the lung, drawn smaller toward its hilum when air surrounds it */
    const k = 1 - 0.62 * ptx;
    const lung: string[] = [];
    const regions = lobeRegions(view).filter((x) => x.s === s);
    const ownOf = (l: LobeState) => Math.max(0, l.collapsed - l.compressed - l.ptx);
    /* a lobe collapsed behind its bronchus loses its volume: it shrinks toward the hilum, and the lobes beside it expand
       into the space (drawn as the best-aerated neighbour filling the lung behind) */
    const neighbour = regions.map((r) => byId[r.id]).filter(Boolean).sort((a, b) => b.aerated - a.aerated)[0];
    if (neighbour && regions.some((r) => byId[r.id] && ownOf(byId[r.id]) > 0.05)) lung.push(`<rect x="-19" y="-20" width="38" height="40" fill="${lobeColour(neighbour)}"/>`);
    const ordered = [...regions].sort((a, b) => (byId[a.id] ? ownOf(byId[a.id]) : 0) - (byId[b.id] ? ownOf(byId[b.id]) : 0));
    for (const r of ordered) {
      const l = byId[r.id]; if (!l) continue;
      const own = ownOf(l);
      /* the lobe is cut by its lung's outline first, then shrunk with it: a collapsed lobe keeps its rounded edge */
      lung.push(`<g${lobeTransform(view, r, own)}><g clip-path="url(#${clip})"><path d="${r.d}" fill="${lobeColour(l)}" stroke="${c.fg}" stroke-width="0.12" stroke-opacity="0.5"/>`);
      if (l.consolidated > 0.2) lung.push(`<path d="${r.d}" fill="url(#lm-solid-${view})" opacity="${f(clamp(l.consolidated, 0, 1))}"/>`);
      if (own > 0.3) lung.push(`<path d="${r.d}" fill="url(#lm-airless-${view})" opacity="${f(clamp(own, 0, 1))}"/>`);
      lung.push(`</g></g>`);
    }
    for (const r of regions) {
      const l = byId[r.id]; if (!l) continue;
      const own = ownOf(l), [ax, ay] = COLLAPSE_TOWARD[view][r.id] ?? r.label, q = 1 - 0.5 * own;
      lung.push(`<text x="${f(ax + (r.label[0] - ax) * q)}" y="${f(ay + (r.label[1] - ay) * q)}" font-size="1.25" text-anchor="middle" fill="${own > 0.4 ? '#fff' : c.fg}" fill-opacity="0.8">${labels.lobe[r.id]}</text>`);
    }
    /* interstitial water and fibrosis: fine lines at the lateral bases (Kerley B lines; reticulation) */
    const lines = Math.round(10 * clamp(d.interstitial, 0, 1) + 14 * clamp(d.fibrosis, 0, 1));
    for (let i = 0; i < lines; i++) {
      const y = 9 - (i % 7) * 1.6 - Math.floor(i / 7) * 0.8, x = s * (13.6 - (i % 3) * 0.7);
      lung.push(`<path d="M ${f(x)} ${f(y)} L ${f(x - s * 1.6)} ${f(y + 0.15)}" stroke="${d.fibrosis > d.interstitial ? '#7a5a52' : '#4f7fae'}" stroke-width="0.14" opacity="0.8"/>`);
    }
    g.push(`<g transform="translate(${f(hilum[0])} ${f(hilum[1])}) scale(${f(k)} ${f(k * scaleY)}) translate(${f(-hilum[0])} ${f(-hilum[1])})">
      <g clip-path="url(#${clip})">${lung.join('')}</g>
      <path d="${lungPath(s, view)}" fill="none" stroke="${c.fg}" stroke-width="${ptx > 0.02 ? 0.3 : 0.18}" stroke-opacity="0.8"/></g>`);
    /* fluid: from the base up, its meniscus higher at the side */
    const E = d.effusion[side];
    if (E > 30) {
      const base = (view === 'back' ? 16 : 12) * stretch, apex = -13.6, h = fluidHeight(E, d.fluidReaches);
      const yTop = base - h * (base - apex);
      g.push(`<path d="M ${f(s * 1)} ${f(yTop + 1.2)} C ${f(s * 7)} ${f(yTop + 1)} ${f(s * 12)} ${f(yTop)} ${f(s * 17)} ${f(yTop - 1.4)} L ${f(s * 17)} 20 L ${f(s * 1)} 20 Z" fill="rgba(79,127,174,0.62)"/>`);
      g.push(`<text x="${f(s * 9)}" y="${f(Math.min(base - 0.6, yTop + 3))}" font-size="1.1" text-anchor="middle" fill="#fff">${labels.fluid.replace('{mL}', String(Math.round(E / 50) * 50))}</text>`);
    }
    if (ptx > 0.02) g.push(`<text x="${f(s * 13)}" y="-11" font-size="1.1" text-anchor="middle" fill="#fff">${labels.air}${tens ? ' ↗' : ''}</text>`);
    out.push(`<g clip-path="url(#${clip})">${g.join('')}</g><path d="${lungPath(s, view)}" fill="none" stroke="${c.line}" stroke-width="0.15" stroke-dasharray="0.6 0.5"/>`);
  }
  /* the mediastinum: the heart (from the front) and the trachea with its bronchi, shifted together */
  out.push(`<g transform="translate(${f(shiftCm)} 0)">`);
  const b = clamp(d.bronchoconstriction, 0, 1);
  /* the walls thicken and the lumens narrow with bronchoconstriction (smooth muscle, mucus, oedema of the wall) */
  const wall = 0.3 + 0.45 * b, lumen = Math.max(0.1, 0.55 * (1 - 0.8 * b));
  const tube = (path: string, scale = 1) => `<path d="${path}" fill="none" stroke="#c98f7c" stroke-width="${f((wall * 2 + lumen) * scale)}" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#f7efe9" stroke-width="${f(lumen * scale)}" stroke-linecap="round"/>`;
  out.push(tube('M 0 -18 L 0 -9.5', 1.6));
  const lobarTo: Record<LobeId, [number, number]> = view === 'front'
    ? { RUL: [-8, -7], RML: [-7, 2.5], RLL: [-9, 6], LUL: [7.5, -4], LLL: [10, 6] }
    : { RUL: [7, -9], RLL: [8, 6], LUL: [-7, -9], LLL: [-8, 6], RML: [7, 2] };
  for (const s of [-1, 1] as const) {
    const side = sideOf(s);
    const k = 1 - 0.62 * clamp(d.ptx[side], 0, 1);
    const hx = s * 4, hy = -2;
    out.push(tube(`M 0 -9.5 Q ${f(s * 2)} -7 ${f(hx - shiftCm * 0.4)} ${f(hy)}`, 1.15));
    for (const id of (['RUL', 'RML', 'RLL', 'LUL', 'LLL'] as LobeId[]).filter((x) => (x[0] === side) && (view === 'front' || x !== 'RML'))) {
      const [tx, ty] = lobarTo[id];
      const ex = hx + (tx - hx) * 0.55 * k - shiftCm * 0.4, ey = hy + (ty - hy) * 0.55 * k;
      out.push(tube(`M ${f(hx - shiftCm * 0.4)} ${f(hy)} L ${f(ex)} ${f(ey)}`, 0.7));
      const l = byId[id];
      /* a lobe collapsed behind its own bronchus: the plug that keeps the air out */
      if (l && Math.max(0, l.collapsed - l.compressed - l.ptx) >= 0.5) out.push(`<circle cx="${f(hx + (ex - hx) * 0.6 - shiftCm * 0.25)}" cy="${f(hy + (ey - hy) * 0.6)}" r="0.55" fill="#4a3530"/>`);
    }
  }
  /* the heart lies in front of the airways */
  if (view === 'front') out.push(heartUnderChest(d.beat ?? 0, 'rgba(200,71,61,0.3)', 'rgba(200,71,61,0.7)'));
  out.push(`</g>`);
  /* the site, and the lobes under it */
  if (d.site) {
    const sx = d.site.x, sy = d.site.y;
    for (const [id, w] of d.site.lobes) {
      const r = lobeRegions(view).find((x) => x.id === id), l = byId[id]; if (!r || !l) continue;
      const side = sideOf(r.s), k = 1 - 0.62 * clamp(d.ptx[side], 0, 1), hx = r.s * 4 + shiftCm * 0.6, sy2 = stretch * swell;
      out.push(`<g transform="translate(${f(hx)} -1) scale(${f(k)} ${f(k * sy2)}) translate(${f(-hx)} 1)"><g${lobeTransform(view, r, Math.max(0, l.collapsed - l.compressed - l.ptx))}>`
        + `<g clip-path="url(#lm-clip-${view}-${r.s > 0 ? 'R' : 'L'})"><path d="${r.d}" fill="none" stroke="${c.accent}" stroke-width="0.55" stroke-opacity="${f(0.35 + 0.65 * w)}"/></g></g></g>`);
    }
    out.push(`<circle cx="${f(sx)}" cy="${f(sy)}" r="1.7" fill="none" stroke="${c.accent}" stroke-width="0.45"/><circle cx="${f(sx)}" cy="${f(sy)}" r="0.35" fill="${c.accent}"/>`);
  }
  return `<svg viewBox="-19 -19 38 ${f(baseY + 21)}" xmlns="http://www.w3.org/2000/svg" role="img">${out.join('')}</svg>`;
}

/* ---- the breath on one clock ------------------------------------------------------------------------------ */

export interface BreathAdded { fine: boolean; coarse: boolean; wheeze: boolean }

/** Lung volume, airflow and the pressures over the last seconds, inspiration shaded; where the site's added sounds fall
    in each breath marked under the flow (the same rules the synthesised sound follows: fine crackles late in
    inspiration, coarse ones early in both phases, a wheeze while air flows out). */
export function drawBreath(g: CanvasRenderingContext2D, w: number, h: number, samples: BreathSample[], from: number, to: number,
  c: LungColors & { flow: string; vol: string; ppl: string; palv: string; pmus: string }, labels: { vol: string; flow: string; pres: string; insp: string; ppl: string; palv: string; pmus: string; added: string; cursor?: string },
  opts: { added?: BreathAdded; cursor?: number | null; blind?: boolean } = {}): void {
  const left = 46, right = 8, top = 6;
  const rows = 3, gap = 10, rh = (h - top - 20 - gap * (rows - 1)) / rows;
  const X = (t: number) => left + ((t - from) / Math.max(1e-6, to - from)) * (w - left - right);
  const S = samples.filter((s) => s.t >= from - 0.1 && s.t <= to + 0.1);
  g.font = '11px system-ui, sans-serif';
  if (S.length < 3) return;
  /* inspiration shaded across all rows */
  g.fillStyle = 'rgba(79,127,174,0.10)';
  let i0: number | null = null;
  for (let i = 0; i < S.length; i++) {
    if (S[i].insp && i0 == null) i0 = i;
    if ((!S[i].insp || i === S.length - 1) && i0 != null) { g.fillRect(X(S[i0].t), top, X(S[i].t) - X(S[i0].t), h - top - 20); i0 = null; }
  }
  const row = (k: number, series: Array<{ key: keyof BreathSample; color: string; label: string }>, unit: string, title: string, symmetric = false) => {
    const y0 = top + k * (rh + gap);
    let lo = Infinity, hi = -Infinity;
    for (const s of S) for (const x of series) { const v = s[x.key] as number; lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (symmetric) { const m = Math.max(Math.abs(lo), Math.abs(hi), 0.2); lo = -m; hi = m; }
    const pad = (hi - lo) * 0.12 || 0.5; lo -= pad; hi += pad;
    const Y = (v: number) => y0 + rh - ((v - lo) / (hi - lo)) * rh;
    g.strokeStyle = c.line; g.lineWidth = 1; g.beginPath(); g.moveTo(left, y0 + rh); g.lineTo(w - right, y0 + rh); g.stroke();
    if (lo < 0 && hi > 0) { g.setLineDash([3, 3]); g.beginPath(); g.moveTo(left, Y(0)); g.lineTo(w - right, Y(0)); g.stroke(); g.setLineDash([]); }
    g.fillStyle = c.muted; g.textAlign = 'right'; g.fillText(hi.toFixed(1), left - 4, y0 + 9); g.fillText(lo.toFixed(1), left - 4, y0 + rh);
    g.textAlign = 'left'; g.fillStyle = c.fg; g.fillText(`${title} (${unit})`, left + 4, y0 + 10);
    let lx = left + 4 + g.measureText(`${title} (${unit})`).width + 12;
    for (const x of series) {
      g.strokeStyle = x.color; g.lineWidth = 1.8; g.beginPath();
      S.forEach((s, i) => { const px = X(s.t), py = Y(s[x.key] as number); i ? g.lineTo(px, py) : g.moveTo(px, py); });
      g.stroke();
      if (series.length > 1) { g.fillStyle = x.color; g.fillText(x.label, lx, y0 + 10); lx += g.measureText(x.label).width + 10; }
    }
    return { y0, Y };
  };
  row(0, [{ key: 'V', color: c.vol, label: labels.vol }], 'L', labels.vol);
  const fr = row(1, [{ key: 'flow', color: c.flow, label: labels.flow }], 'L/s', labels.flow, true);
  row(2, [{ key: 'Pmus', color: c.pmus, label: labels.pmus }, { key: 'Ppl', color: c.ppl, label: labels.ppl }, { key: 'Palv', color: c.palv, label: labels.palv }], 'cmH₂O', labels.pres);
  /* the added sounds, where they fall in each breath, under the flow */
  const a = opts.added;
  if (a && (a.fine || a.coarse || a.wheeze)) {
    const yb = fr.y0 + rh - 4;
    const peak = Math.max(0.05, ...S.map((s) => Math.abs(s.flow)));
    let inspStart = S[0].t, lastInsp = S[0].insp, expStart = S[0].t;
    let inspLen = 1;
    for (let i = 1; i < S.length; i++) {
      const s = S[i];
      if (s.insp && !lastInsp) inspStart = s.t;
      if (!s.insp && lastInsp) { expStart = s.t; inspLen = Math.max(0.3, s.t - inspStart); }
      lastInsp = s.insp;
      const tick = (color: string, y: number) => { g.strokeStyle = color; g.lineWidth = 1.4; g.beginPath(); g.moveTo(X(s.t), y); g.lineTo(X(s.t), y - 7); g.stroke(); };
      const k = Math.round(s.t * 50);
      if (a.fine && s.insp && (s.t - inspStart) > 0.55 * inspLen && k % 3 === 0) tick('#2f7d4f', yb);
      if (a.coarse && ((s.insp && (s.t - inspStart) < 0.35 * inspLen) || (!s.insp && (s.t - expStart) < 0.4)) && k % 5 === 0) tick('#8a4b2f', yb);
      if (a.wheeze && !s.insp && -s.flow > 0.15 * peak) { g.strokeStyle = '#7a3fa0'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(s.t - 0.02), yb - 2); g.lineTo(X(s.t), yb - 2); g.stroke(); }
    }
    g.fillStyle = c.muted; g.textAlign = 'right'; g.fillText(labels.added, w - right, yb - 10);
  }
  /* time axis and cursor */
  g.fillStyle = c.muted; g.textAlign = 'center';
  for (let t = Math.ceil(from); t <= to; t += 1) g.fillText(`${Math.round(t - to)} s`, X(t), h - 6);
  g.fillStyle = 'rgba(79,127,174,0.5)'; g.textAlign = 'left'; g.fillText(labels.insp, left + 4, h - 6);
  if (opts.cursor != null && opts.cursor >= from && opts.cursor <= to) {
    g.strokeStyle = c.accent; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(opts.cursor), top); g.lineTo(X(opts.cursor), h - 18); g.stroke();
  }
}

/** The breath sample nearest a time. */
export const sampleAt = (samples: BreathSample[], t: number): BreathSample | undefined =>
  samples.reduce<BreathSample | undefined>((best, s) => (!best || Math.abs(s.t - t) < Math.abs(best.t - t) ? s : best), undefined);

/** Ventilation against perfusion, lobe by lobe: where the oxygen is lost. */
export function drawVQ(g: CanvasRenderingContext2D, w: number, h: number, lobes: LobeState[], c: LungColors, labels: { vent: string; perf: string; shunt: string; lobe: Record<LobeId, string> }): void {
  const left = 44, top = 18, bw = (w - left - 10) / lobes.length;
  const max = Math.max(0.35, ...lobes.flatMap((l) => [l.ventShare, l.perfShare]));
  const H = h - top - 28;
  g.font = '11px system-ui, sans-serif';
  g.fillStyle = '#4f7fae'; g.fillRect(left, 4, 10, 8); g.fillStyle = c.fg; g.textAlign = 'left'; g.fillText(labels.vent, left + 14, 12);
  let lx = left + 24 + g.measureText(labels.vent).width;
  g.fillStyle = '#c0392b'; g.fillRect(lx, 4, 10, 8); g.fillStyle = c.fg; g.fillText(labels.perf, lx + 14, 12);
  lx += 24 + g.measureText(labels.perf).width;
  g.fillStyle = 'rgba(192,57,43,0.35)'; g.fillRect(lx, 4, 10, 8); g.fillStyle = c.fg; g.fillText(labels.shunt, lx + 14, 12);
  lobes.forEach((l, i) => {
    const x = left + i * bw + bw * 0.15, bwi = bw * 0.32;
    const Y = (v: number) => top + H - (v / max) * H;
    g.fillStyle = '#4f7fae'; g.fillRect(x, Y(l.ventShare), bwi, top + H - Y(l.ventShare));
    g.fillStyle = '#c0392b'; g.fillRect(x + bwi + 3, Y(l.perfShare), bwi, top + H - Y(l.perfShare));
    /* the blood that passes this lobe without meeting air: the lower, paler part of its perfusion */
    if (l.shuntShare > 0.005) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + bwi + 3, Y(l.shuntShare), bwi, top + H - Y(l.shuntShare)); }
    g.fillStyle = c.fg; g.textAlign = 'center'; g.fillText(labels.lobe[l.id], x + bwi + 1, h - 12);
    g.fillStyle = c.muted; g.fillText(Number.isFinite(l.VQ) ? `V/Q ${l.VQ.toFixed(1)}` : 'V/Q ∞', x + bwi + 1, h - 1);
  });
  g.strokeStyle = c.line; g.beginPath(); g.moveTo(left, top + H); g.lineTo(w - 10, top + H); g.stroke();
  g.fillStyle = c.muted; g.textAlign = 'right'; g.fillText(`${Math.round(max * 100)} %`, left - 4, top + 8); g.fillText('0', left - 4, top + H);
}
