import type { LivePatient } from '../live/live-patient.ts';
import type { RuntimeView } from '../engine/observe.ts';
import { neuroExamState, nystagmus } from '../models/neuro-exam.ts';

/* ===========================================================================
   Living diagrams for the physiology chapters.

   Each draws one model from the running patient, every frame: the
   circulation with its chambers filling and emptying and its pressure–
   volume loop; the baroreflex sigmoid with the operating point moving along
   it; the conduction system lighting up in sequence with the cardiac vector
   tracing its loop; the vestibular tone balance writing a nystagmus trace;
   the pupillary pathway responding to a light; the plasma ions as a
   Gamblegram. Nothing is pre-drawn: change a parameter and the drawing
   changes because the model did.
=========================================================================== */

export type Lang = 'en' | 'de';
export interface DiagramContext {
  live: LivePatient;
  view: RuntimeView;
  lang: Lang;
  now: number;            // ms, performance clock
  state: Record<string, any>;   // per-diagram memory between frames
}
type Draw = (g: CanvasRenderingContext2D, w: number, h: number, c: DiagramContext) => void;

const C = {
  art: '#c8473d', ven: '#4f6fb3', artSoft: 'rgba(200,71,61,0.18)', venSoft: 'rgba(79,111,179,0.18)',
};
let css: (n: string) => string = () => '#000';
const L = (c: DiagramContext, en: string, de: string) => (c.lang === 'de' ? de : en);
const num = (c: DiagramContext, x: number, d = 0) => (Number.isFinite(x) ? (c.lang === 'de' ? x.toFixed(d).replace('.', ',') : x.toFixed(d)) : '—');
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, o: { size?: number; color?: string; align?: CanvasTextAlign; weight?: number; mono?: boolean; base?: CanvasTextBaseline } = {}) {
  g.font = `${o.weight ?? 500} ${o.size ?? 12}px ${o.mono ? css('--font-mono') : css('--font-body')}`;
  g.fillStyle = o.color ?? css('--fg');
  g.textAlign = o.align ?? 'left';
  g.textBaseline = o.base ?? 'alphabetic';
  g.fillText(s, x, y);
}
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function arrow(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, wdt = 2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = wdt;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2 - 6 * Math.cos(a), y2 - 6 * Math.sin(a)); g.stroke();
  g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 9 * Math.cos(a - 0.4), y2 - 9 * Math.sin(a - 0.4)); g.lineTo(x2 - 9 * Math.cos(a + 0.4), y2 - 9 * Math.sin(a + 0.4)); g.closePath(); g.fill();
}
function axes(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.strokeStyle = css('--line'); g.lineWidth = 1;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.lineTo(x + w, y + h); g.stroke();
}

/* ---- haemodynamics: the circuit and the PV loop ---------------------------------------------- */
const circuit: Draw = (g, w, h, c) => {
  const s = c.live.snap, m = s.metrics ?? {};
  const st = c.state;
  const wide = w >= 620;
  const cw = wide ? w * 0.52 : w, chH = wide ? h : h * 0.56;
  // --- schematic ---
  const cx = cw / 2;
  const top = 18, bottom = chH - 14;
  const lungY = top + 8, bodyY = bottom - 44;
  const colR = cx - Math.min(110, cw * 0.24), colL = cx + Math.min(110, cw * 0.24);
  const box = (x: number, y: number, bw: number, bh: number, label: string, sub: string, col: string) => {
    g.fillStyle = col; rrect(g, x, y, bw, bh, 10); g.fill();
    text(g, label, x + bw / 2, y + 17, { align: 'center', weight: 700, size: 12 });
    text(g, sub, x + bw / 2, y + 32, { align: 'center', size: 11, mono: true, color: css('--muted') });
  };
  const mm = 'mmHg';
  box(cx - 120, lungY, 240, 38, L(c, 'Lungs', 'Lunge'), `PA ${num(c, s.Ppa)} → PV ${num(c, s.Ppv)} ${mm}`, css('--sunk'));
  box(cx - 120, bodyY, 240, 38, L(c, 'Body', 'Körperkreislauf'), `${L(c, 'arteries', 'Arterien')} ${num(c, s.P)} → ${L(c, 'veins', 'Venen')} ${num(c, s.Psv, 1)} ${mm}`, css('--sunk'));
  // chambers: area ∝ volume
  const ch = (x: number, y: number, vol: number, p: number, label: string, col: string, soft: string, ref: number) => {
    const r = clamp(Math.sqrt(Math.max(1, vol) / ref) * 30, 10, 48);
    g.fillStyle = soft; g.strokeStyle = col; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y, r * 1.05, r * 0.9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    text(g, label, x, y - 2, { align: 'center', weight: 700, size: 12 });
    text(g, `${num(c, vol)} mL`, x, y + 12, { align: 'center', size: 10, mono: true, color: css('--muted') });
    text(g, `${num(c, p)}`, x, y + 24, { align: 'center', size: 10, mono: true, color: col });
    return r;
  };
  const atrY = lungY + 38 + (bodyY - lungY - 38) * 0.3, venY = lungY + 38 + (bodyY - lungY - 38) * 0.72;
  ch(colR, atrY, s.Vra, s.Pra, 'RA', C.ven, C.venSoft, 70);
  ch(colR, venY, s.Vrv, s.Prv, 'RV', C.ven, C.venSoft, 120);
  ch(colL, atrY, s.Vla, s.Pla, 'LA', C.art, C.artSoft, 70);
  ch(colL, venY, s.V, s.Pv, 'LV', C.art, C.artSoft, 120);
  // valves
  const valve = (x: number, y: number, open: boolean, label: string, horizontal = true) => {
    g.strokeStyle = css('--fg'); g.lineWidth = 3;
    const gap = open ? 7 : 0;
    g.beginPath();
    if (horizontal) { g.moveTo(x - 12, y); g.lineTo(x - gap, y); g.moveTo(x + gap, y); g.lineTo(x + 12, y); }
    else { g.moveTo(x, y - 12); g.lineTo(x, y - gap); g.moveTo(x, y + gap); g.lineTo(x, y + 12); }
    g.stroke();
    text(g, label, x + (horizontal ? 16 : 6), y + (horizontal ? 4 : -14), { size: 9, color: css('--muted'), mono: true });
  };
  const midA = (atrY + venY) / 2;
  valve(colR, midA, !!s.tricuspidOpen, 'T');
  valve(colL, midA, !!s.mitralOpen, 'M');
  // great vessels and flows
  const pulmY = lungY + 38, aoY = bodyY;
  g.lineWidth = 3;
  g.strokeStyle = C.ven; g.beginPath(); g.moveTo(colR - 30, venY); g.lineTo(colR - 52, venY); g.lineTo(colR - 52, pulmY + 2); g.lineTo(cx - 60, pulmY + 2); g.stroke();   // RV → PA
  valve(colR - 52, venY - 30, !!s.pulmonicOpen, 'P', false);
  g.strokeStyle = C.art; g.beginPath(); g.moveTo(cx + 60, pulmY + 2); g.lineTo(colL, pulmY + 2); g.lineTo(colL, atrY - 30); g.stroke();   // PV → LA
  g.strokeStyle = C.art; g.beginPath(); g.moveTo(colL + 30, venY); g.lineTo(colL + 52, venY); g.lineTo(colL + 52, aoY - 2); g.lineTo(cx + 60, aoY - 2); g.stroke();   // LV → aorta
  valve(colL + 52, venY + 30, !!s.aorticOpen, 'A', false);
  g.strokeStyle = C.ven; g.beginPath(); g.moveTo(cx - 60, aoY - 2); g.lineTo(colR, aoY - 2); g.lineTo(colR, venY + 30); g.stroke();   // veins → RA (behind RV)
  // particles: one loop of blood, moving at the local flow
  const path: Array<[number, number, number]> = [   // x, y, flow key index
    [colR, aoY - 2, 0], [colR, atrY, 1], [colR, venY, 2], [colR - 52, venY, 2], [colR - 52, pulmY + 2, 3], [cx - 60, pulmY + 2, 3],
    [cx + 60, pulmY + 2, 4], [colL, pulmY + 2, 4], [colL, atrY, 5], [colL, venY, 6], [colL + 52, venY, 6], [colL + 52, aoY - 2, 7], [cx + 60, aoY - 2, 7], [cx - 60, aoY - 2, 0],
  ];
  const flows = [s.Qven, s.Qtri, s.Qpulv, s.Qpulv, s.Qpv, s.Qfill, s.Qeject, s.Qout].map((q: number) => Math.max(0, q || 0));
  const segLen: number[] = []; let total = 0;
  for (let i = 0; i < path.length; i++) { const a = path[i], b = path[(i + 1) % path.length]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); segLen.push(d); total += d; }
  const N = 34;
  st.p ??= Array.from({ length: N }, (_, i) => (i / N) * total);
  const dt = Math.min(0.05, (c.now - (st.t ?? c.now)) / 1000); st.t = c.now;
  for (let k = 0; k < N; k++) {
    let d = st.p[k], i = 0;
    while (d > segLen[i]) { d -= segLen[i]; i = (i + 1) % path.length; }
    const q = flows[path[i][2]];
    st.p[k] = (st.p[k] + q * dt * 0.35) % total;
    const a = path[i], b = path[(i + 1) % path.length], f = d / Math.max(1e-6, segLen[i]);
    const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
    const arterial = i >= 6 && i <= 12;
    g.fillStyle = arterial ? C.art : C.ven;
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }
  text(g, `HR ${num(c, s.HR)} · SV ${num(c, m.SV)} mL · CO ${num(c, m.CO, 1)} L/min · ${L(c, 'BP', 'RR')} ${num(c, m.Psys)}/${num(c, m.Pdia)}`, cx, chH - 2, { align: 'center', size: 11, mono: true, color: css('--muted') });

  // --- PV loop and Wiggers diagram ---
  const px = wide ? cw + 18 : 14, py = wide ? 14 : chH + 14, pw = wide ? w - cw - 32 : w - 28, ph = wide ? h * 0.52 : (h - chH) * 0.55;
  const beat = s.beat?.samples as Array<{ t: number; V: number; Pv: number; Pa: number; Pla: number }> | undefined;
  const vMax = Math.max(160, ...(beat?.map((b) => b.V) ?? [0])) * 1.1, pMax = Math.max(140, ...(beat?.map((b) => b.Pv) ?? [0])) * 1.1;
  const X = (v: number) => px + 30 + (v / vMax) * (pw - 36), Y = (p: number) => py + ph - 16 - (p / pMax) * (ph - 24);
  axes(g, px + 30, py, pw - 36, ph - 16);
  text(g, L(c, 'LV pressure–volume loop', 'Druck-Volumen-Schleife LV'), px + 30, py + 4, { size: 11, weight: 700 });
  text(g, 'mL', px + pw - 6, py + ph - 4, { size: 10, align: 'right', color: css('--muted') });
  text(g, 'mmHg', px + 2, py + 14, { size: 10, color: css('--muted') });
  // ESPVR and EDPVR from the parameters
  const p0 = c.live.model.circulation;
  const Ees = s.effEmax ?? p0.Emax, V0 = p0.V0;
  g.setLineDash([4, 4]); g.strokeStyle = css('--muted'); g.lineWidth = 1;
  const vEnd = Math.min(vMax, V0 + pMax / Ees);
  g.beginPath(); g.moveTo(X(V0), Y(0)); g.lineTo(X(vEnd), Y((vEnd - V0) * Ees)); g.stroke();
  g.beginPath(); for (let v = V0; v <= vMax; v += 2) { const p = p0.edpA * (Math.exp(p0.edpB * (v - V0)) - 1); if (p > pMax) break; v === V0 ? g.moveTo(X(v), Y(p)) : g.lineTo(X(v), Y(p)); } g.stroke();
  g.setLineDash([]);
  if (beat?.length) {
    g.strokeStyle = C.art; g.lineWidth = 2; g.beginPath();
    beat.forEach((b, i) => (i ? g.lineTo(X(b.V), Y(b.Pv)) : g.moveTo(X(b.V), Y(b.Pv))));
    g.closePath(); g.stroke();
  }
  g.fillStyle = css('--fg'); g.beginPath(); g.arc(X(s.V), Y(s.Pv), 4.5, 0, Math.PI * 2); g.fill();
  { const vl = Math.min(vMax * 0.6, V0 + pMax * 0.8 / Ees); text(g, 'ESPVR', X(vl) + 4, Y((vl - V0) * Ees), { size: 9, color: css('--muted') }); }

  // Wiggers: aortic, LV and LA pressure over the last beat, with the present moment
  const wy = py + ph + 12, wh = wide ? h - ph - 40 : h - py - ph - 26;
  if (beat?.length && wh > 40) {
    const dur = beat[beat.length - 1].t || 800;
    const XT = (t: number) => px + 30 + (t / dur) * (pw - 36), YP = (p: number) => wy + wh - (p / pMax) * wh;
    axes(g, px + 30, wy, pw - 36, wh);
    const line = (k: 'Pa' | 'Pv' | 'Pla', col: string, wdt: number) => { g.strokeStyle = col; g.lineWidth = wdt; g.beginPath(); beat.forEach((b, i) => (i ? g.lineTo(XT(b.t), YP(b[k])) : g.moveTo(XT(b.t), YP(b[k])))); g.stroke(); };
    line('Pa', C.art, 2); line('Pv', css('--fg'), 1.5); line('Pla', C.ven, 1.5);
    text(g, L(c, 'aorta', 'Aorta'), px + pw - 8, YP(beat[2]?.Pa ?? 80) - 4, { size: 10, align: 'right', color: C.art });
    text(g, 'LV', px + 34, wy + 12, { size: 10 });
    text(g, 'LA', px + pw - 8, YP(beat[beat.length - 1]?.Pla ?? 8) - 4, { size: 10, align: 'right', color: C.ven });
    text(g, L(c, 'one beat (Wiggers)', 'ein Schlag (Wiggers)'), px + 30, wy - 2, { size: 10, color: css('--muted') });
  }
};

/* ---- baroreflex ------------------------------------------------------------------------------------ */
const baroreflex: Draw = (g, w, h, c) => {
  const s = c.live.snap, p = c.live.model.circulation, st = c.state;
  st.hist ??= [];
  st.hist.push(s.P); if (st.hist.length > 360) st.hist.shift();
  const wide = w >= 600;
  // sigmoid
  const sx = 16, sy = 18, sw = wide ? w * 0.36 : w - 32, sh = wide ? h - 90 : h * 0.34;
  const PX = (P: number) => sx + 26 + ((P - 40) / 140) * (sw - 30), FY = (f: number) => sy + sh - (f / 50) * (sh - 10);
  axes(g, sx + 26, sy, sw - 30, sh);
  text(g, L(c, 'Receptor firing (/s)', 'Rezeptorfrequenz (/s)'), sx + 26, sy - 4, { size: 11, weight: 700 });
  text(g, L(c, 'arterial pressure (mmHg)', 'arterieller Druck (mmHg)'), sx + sw - 4, sy + sh + 14, { size: 10, align: 'right', color: css('--muted') });
  g.strokeStyle = css('--accent'); g.lineWidth = 2; g.beginPath();
  for (let P = 40; P <= 180; P += 2) { const f = 2.5 + 44.5 / (1 + Math.exp(-0.07 * (P - p.Pn))); P === 40 ? g.moveTo(PX(P), FY(f)) : g.lineTo(PX(P), FY(f)); }
  g.stroke();
  g.setLineDash([3, 3]); g.strokeStyle = css('--muted'); g.lineWidth = 1;
  g.beginPath(); g.moveTo(PX(p.Pn), sy); g.lineTo(PX(p.Pn), sy + sh); g.stroke(); g.setLineDash([]);
  text(g, `P_n ${num(c, p.Pn)}`, PX(p.Pn) + 4, sy + 12, { size: 10, color: css('--muted'), mono: true });
  // within-beat excursion of the operating point
  const lo = Math.min(...st.hist.slice(-120)), hi = Math.max(...st.hist.slice(-120));
  g.strokeStyle = 'rgba(200,71,61,0.35)'; g.lineWidth = 6; g.beginPath();
  for (let P = lo; P <= hi; P += 1) { const f = 2.5 + 44.5 / (1 + Math.exp(-0.07 * (P - p.Pn))); P === lo ? g.moveTo(PX(P), FY(f)) : g.lineTo(PX(P), FY(f)); }
  g.stroke();
  g.fillStyle = C.art; g.beginPath(); g.arc(PX(s.P), FY(s.firingRate), 6, 0, Math.PI * 2); g.fill();

  // brainstem: tone bars
  const bx = wide ? sx + sw + 30 : 16, by = wide ? 18 : sy + sh + 34, bw = wide ? w * 0.22 : (w - 32) * 0.45, bh = wide ? h - 60 : h * 0.4;
  text(g, L(c, 'Brainstem output', 'Hirnstamm-Ausgang'), bx, by - 4, { size: 11, weight: 700 });
  const bar = (x: number, label: string, v: number, col: string) => {
    const bwid = bw * 0.32;
    g.fillStyle = css('--sunk'); rrect(g, x, by + 10, bwid, bh - 30, 6); g.fill();
    g.fillStyle = col; rrect(g, x, by + 10 + (bh - 30) * (1 - clamp(v, 0, 1)), bwid, (bh - 30) * clamp(v, 0, 1), 6); g.fill();
    text(g, label, x + bwid / 2, by + bh - 6, { size: 11, align: 'center', weight: 700 });
    text(g, num(c, v, 2), x + bwid / 2, by + 24, { size: 10, align: 'center', mono: true, color: '#fff' });
  };
  bar(bx, 'σS', s.sympathetic, C.art);
  bar(bx + bw * 0.5, 'σP', s.parasympathetic, C.ven);
  if (!p.baroEnabled) text(g, L(c, 'reflex off', 'Reflex aus'), bx, by + bh + 12, { size: 11, color: css('--abn'), weight: 700 });

  // effectors
  const ex = wide ? bx + bw + 24 : bx + bw + 20, ey = by, ew = w - ex - 12;
  text(g, L(c, 'Effectors', 'Effektoren'), ex, ey - 4, { size: 11, weight: 700 });
  const rows: Array<[string, number, number, string, number]> = [
    [L(c, 'Heart rate', 'Herzfrequenz'), s.HR, p.HR, '/min', 0],
    [L(c, 'Arteriolar resistance', 'Arteriolärer Widerstand'), s.effRsys, p.Rsys, '', 2],
    [L(c, 'Unstressed venous volume', 'Ungespanntes Venenvolumen'), s.effV0sv, p.V0sv, 'mL', 0],
    [L(c, 'Contractility', 'Kontraktilität'), s.effEmax, p.Emax, '', 2],
  ];
  rows.forEach(([label, v, base, unit, d], i) => {
    const y = ey + 18 + i * ((bh - 10) / 4);
    const r = v / base;
    text(g, label, ex, y, { size: 11 });
    text(g, `${num(c, v, d)} ${unit}`, ex + ew, y, { size: 11, align: 'right', mono: true });
    g.fillStyle = css('--sunk'); g.fillRect(ex, y + 6, ew, 6);
    const mid = ex + ew / 2, len = clamp((r - 1) * ew * 1.2, -ew / 2, ew / 2);
    g.fillStyle = r >= 1 ? C.art : C.ven; g.fillRect(Math.min(mid, mid + len), y + 6, Math.abs(len), 6);
    g.fillStyle = css('--fg'); g.fillRect(mid - 0.5, y + 4, 1, 10);
  });
  // pressure trace
  const ty = h - 30, th = 26;
  const pts = st.hist as number[];
  const pmin = 40, pmax = 180;
  g.strokeStyle = C.art; g.lineWidth = 1.5; g.beginPath();
  pts.forEach((P, i) => { const x = 16 + (i / 360) * (w - 32), y = ty + th - ((P - pmin) / (pmax - pmin)) * th; i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
  text(g, `${L(c, 'arterial pressure', 'arterieller Druck')} · ${L(c, 'mean', 'Mittel')} ${num(c, s.metrics?.Pmean)} mmHg`, 16, ty - 2, { size: 10, color: css('--muted') });
};

/* ---- conduction and the cardiac vector ------------------------------------------------------------------ */
const conduction: Draw = (g, w, h, c) => {
  const heart = c.live.run.heart;
  const ph = heart.phase();
  const wide = w >= 600;
  const hx = wide ? w * 0.26 : w / 2, hy = wide ? h / 2 + 4 : h * 0.28, R = Math.min(wide ? w * 0.2 : w * 0.34, h * (wide ? 0.42 : 0.24));
  // heart outline: atria above, ventricles below, septum
  const glow = (on: number) => `rgba(240,160,40,${clamp(on, 0, 1) * 0.85})`;
  const atrOn = ph.sinceP < 110 ? 1 - ph.sinceP / 110 : 0;
  const ventOn = ph.sinceV < ph.qrs ? 1 - ph.sinceV / ph.qrs * 0.6 : 0;
  const repol = ph.sinceV > ph.qrs && ph.sinceV < ph.qt ? (ph.sinceV - ph.qrs) / (ph.qt - ph.qrs) : 1;
  g.lineWidth = 2; g.strokeStyle = css('--fg');
  g.fillStyle = css('--sunk');
  g.beginPath(); g.ellipse(hx - R * 0.42, hy - R * 0.55, R * 0.42, R * 0.3, 0, 0, Math.PI * 2); g.fill(); g.stroke();   // RA
  g.beginPath(); g.ellipse(hx + R * 0.42, hy - R * 0.55, R * 0.42, R * 0.3, 0, 0, Math.PI * 2); g.fill(); g.stroke();   // LA
  if (atrOn) { g.fillStyle = glow(atrOn); g.beginPath(); g.ellipse(hx - R * 0.42, hy - R * 0.55, R * 0.42, R * 0.3, 0, 0, Math.PI * 2); g.ellipse(hx + R * 0.42, hy - R * 0.55, R * 0.42, R * 0.3, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = css('--sunk');
  g.beginPath(); g.moveTo(hx - R * 0.85, hy - R * 0.22); g.quadraticCurveTo(hx - R * 0.9, hy + R * 0.55, hx + R * 0.05, hy + R * 0.95);
  g.quadraticCurveTo(hx + R * 0.95, hy + R * 0.5, hx + R * 0.85, hy - R * 0.22); g.closePath(); g.fill(); g.stroke();
  if (ventOn) { g.fillStyle = glow(ventOn); g.fill(); }
  else if (repol < 1) { g.fillStyle = `rgba(80,140,200,${0.35 * (1 - repol)})`; g.fill(); }
  // conduction system
  const sa: [number, number] = [hx - R * 0.72, hy - R * 0.78], av: [number, number] = [hx - R * 0.05, hy - R * 0.2], his: [number, number] = [hx, hy];
  const p = heart.p;
  const node = (pt: [number, number], on: boolean, label: string) => {
    g.fillStyle = on ? '#f0a020' : css('--muted'); g.beginPath(); g.arc(pt[0], pt[1], 5, 0, Math.PI * 2); g.fill();
    text(g, label, pt[0] + 8, pt[1] - 6, { size: 10, weight: 700 });
  };
  const wire = (pts: Array<[number, number]>, on: boolean, broken = false) => {
    g.strokeStyle = on ? '#f0a020' : css('--muted'); g.lineWidth = on ? 3 : 2; if (broken) g.setLineDash([4, 4]);
    g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); g.setLineDash([]);
  };
  const avOn = ph.sinceP > 60 && ph.pr != null && ph.sinceP < (ph.pr ?? 150);
  wire([sa, av], atrOn > 0 && p.atrial === 'sinus');
  wire([av, his], avOn, p.avBlock === 'complete');
  wire([his, [hx - R * 0.45, hy + R * 0.55], [hx - R * 0.6, hy + R * 0.2]], ventOn > 0 && p.rbb > 0.35, p.rbb <= 0.35);
  wire([his, [hx + R * 0.45, hy + R * 0.55], [hx + R * 0.62, hy + R * 0.2]], ventOn > 0 && p.lbb > 0.35, p.lbb <= 0.35);
  if (p.accessory) wire([[hx + R * 0.82, hy - R * 0.4], [hx + R * 0.86, hy - R * 0.1]], ventOn > 0);
  node(sa, atrOn > 0.3 && p.atrial === 'sinus', L(c, 'SA', 'Sinus'));
  node(av, avOn, 'AV');
  if (p.atrial === 'af') text(g, L(c, 'fibrillating atria', 'flimmernde Vorhöfe'), hx, hy - R * 0.98, { size: 10, align: 'center', color: css('--abn'), weight: 700 });
  if (p.ventricular === 'vf') text(g, L(c, 'ventricular fibrillation', 'Kammerflimmern'), hx, hy + R * 1.12, { size: 11, align: 'center', color: css('--abn'), weight: 700 });

  // the cardiac vector, frontal plane, with the hexaxial reference system
  const vx = wide ? w * 0.72 : w / 2, vy = wide ? h / 2 : h * 0.74, vr = Math.min(wide ? w * 0.22 : w * 0.36, h * (wide ? 0.4 : 0.22));
  const leads: Array<[string, number]> = [['I', 0], ['II', 60], ['III', 120], ['aVF', 90], ['aVL', -30], ['aVR', -150]];
  g.strokeStyle = css('--line'); g.lineWidth = 1;
  for (const [name, ang] of leads) {
    const a = (ang * Math.PI) / 180;
    g.beginPath(); g.moveTo(vx - Math.cos(a) * vr, vy - Math.sin(a) * vr); g.lineTo(vx + Math.cos(a) * vr, vy + Math.sin(a) * vr); g.stroke();
    text(g, name, vx + Math.cos(a) * (vr + 12), vy + Math.sin(a) * (vr + 12) + 4, { size: 10, align: 'center', color: css('--muted'), mono: true });
  }
  const v = c.live.vcg(1.6);
  const n = v.X.length;
  if (n > 10) {
    let max = 0.3; for (let i = 0; i < n; i++) max = Math.max(max, Math.hypot(v.X[i], v.Y[i]));
    const k = (vr * 0.92) / max;
    g.strokeStyle = 'rgba(200,71,61,0.55)'; g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i < n; i++) { const x = vx + v.X[i] * k, y = vy + v.Y[i] * k; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    arrow(g, vx, vy, vx + v.X[n - 1] * k, vy + v.Y[n - 1] * k, C.art, 2.5);
  }
  text(g, L(c, 'Cardiac vector (frontal plane)', 'Herzvektor (Frontalebene)'), vx, vy - vr - 22, { size: 11, align: 'center', weight: 700 });
  const e = c.live.snap.ecgMetrics ?? {};
  text(g, `${L(c, 'axis', 'Achse')} ${num(c, e.qrsAxis)}° · PR ${e.PR != null ? num(c, e.PR) : '—'} · QRS ${num(c, e.QRS)} · QT ${num(c, e.QT)} ms`, vx, vy + vr + 30, { size: 10, align: 'center', mono: true, color: css('--muted') });
  // membrane potential gauge
  const K = c.live.model.chemistry.potassium ?? c.live.model.circulation.K ?? 4;
  const EK = 26.7 * Math.log(K / 140);
  const gx = 16, gy = h - 18, gw = Math.min(220, w * 0.4);
  text(g, `E_K = ${num(c, EK)} mV  ([K⁺] ${num(c, K, 1)} mmol/L)`, gx, gy - 10, { size: 10, mono: true, color: css('--muted') });
  g.fillStyle = css('--sunk'); g.fillRect(gx, gy - 4, gw, 6);
  g.fillStyle = K > 5.5 || K < 3.5 ? css('--abn') : css('--accent'); g.fillRect(gx, gy - 4, gw * clamp((EK + 110) / 60, 0, 1), 6);
};

/* ---- vestibulo-ocular reflex ------------------------------------------------------------------------------- */
const vor: Draw = (g, w, h, c) => {
  const s = neuroExamState(c.view);
  const st = c.state;
  const toneL = s.periphery.L * s.nucleus.L, toneR = s.periphery.R * s.nucleus.R;
  // slow-phase velocity in the dark, straight ahead; positive = eyes drifting to the patient's right
  const spv = -(toneR - toneL) * 20 * (1 - s.compensation);
  const n = nystagmus(s, { gaze: 'primary', fixation: false });
  const quick = spv < 0 ? 'right' : 'left';
  // labyrinths and nuclei
  const mid = w / 2;
  const lab = (x: number, tone: number, label: string) => {
    g.strokeStyle = css('--fg'); g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x, 46, 14 + i * 7, Math.PI * (0.9 + i * 0.25), Math.PI * (2.3 + i * 0.25)); g.stroke(); }
    g.fillStyle = css('--sunk'); g.fillRect(x - 30, 86, 60, 10);
    g.fillStyle = tone < 0.6 ? css('--abn') : css('--accent'); g.fillRect(x - 30, 86, 60 * clamp(tone, 0, 1), 10);
    text(g, `${label} ${num(c, tone, 2)}`, x, 112, { size: 11, align: 'center', mono: true });
  };
  lab(mid - Math.min(170, w * 0.32), toneL, L(c, 'left tone', 'Tonus links'));
  lab(mid + Math.min(170, w * 0.32), toneR, L(c, 'right tone', 'Tonus rechts'));
  text(g, L(c, 'Labyrinths and vestibular nerves at rest', 'Labyrinthe und Vestibularisnerven in Ruhe'), mid, 16, { size: 11, align: 'center', weight: 700 });
  // eye
  const ey = 160;
  st.theta ??= 0;
  const dt = Math.min(0.05, (c.now - (st.t ?? c.now)) / 1000); st.t = c.now;
  const tau = s.tauSeconds;
  st.theta += (spv - st.theta / tau) * dt;
  const amp = Math.max(1.5, Math.abs(spv) * 0.25);
  if (Math.abs(st.theta) > amp) st.theta = -Math.sign(st.theta) * amp * 0.2;   // quick phase
  st.trace ??= []; st.trace.push(st.theta); if (st.trace.length > 600) st.trace.shift();
  for (const ex of [mid - 40, mid + 40]) {
    g.fillStyle = '#fff'; g.strokeStyle = css('--fg'); g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(ex, ey, 28, 18, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    const px = ex - clamp(st.theta, -15, 15) * 1.2;   // facing the patient: their right is our left
    g.fillStyle = '#5b4636'; g.beginPath(); g.arc(px, ey, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(px, ey, 4.5, 0, Math.PI * 2); g.fill();
  }
  text(g, L(c, 'Eyes in the dark, looking straight ahead (no fixation)', 'Augen im Dunkeln, Geradeausblick (ohne Fixation)'), mid, ey + 36, { size: 11, align: 'center', color: css('--muted') });
  // trace
  const ty = ey + 54, th = h - ty - 26;
  axes(g, 30, ty, w - 46, th);
  g.strokeStyle = css('--fg'); g.lineWidth = 1.5; g.beginPath();
  const tr = st.trace as number[];
  tr.forEach((x, i) => { const px = 30 + (i / 600) * (w - 46), py = ty + th / 2 - clamp(x, -10, 10) / 10 * (th / 2); i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.stroke();
  text(g, L(c, 'right', 'rechts'), 26, ty + 10, { size: 10, align: 'right', color: css('--muted') });
  text(g, L(c, 'left', 'links'), 26, ty + th, { size: 10, align: 'right', color: css('--muted') });
  text(g, `SPV ${num(c, Math.abs(spv), 1)} °/s · τ ${num(c, tau)} s · ${n.present ? L(c, `quick phase to the ${quick}`, `schnelle Phase nach ${quick === 'left' ? 'links' : 'rechts'}`) : L(c, 'no nystagmus', 'kein Nystagmus')}`, mid, h - 6, { size: 11, align: 'center', mono: true });
};

/* ---- pupillary light reflex ---------------------------------------------------------------------------------- */
const pupil: Draw = (g, w, h, c) => {
  const s = neuroExamState(c.view);
  const pp = s.pupil;
  const cycle = (c.now / 1000) % 6;
  const lit: 'L' | 'R' | null = cycle < 2.4 ? 'R' : cycle > 3 && cycle < 5.4 ? 'L' : null;
  const age = c.view.patient.age;
  const d0 = age < 12 ? 5 : age >= 60 ? 3.5 : 4;
  const drive = lit ? (pp.afferent[lit] ? 1 : 0) : 0;
  const size = (S: 'L' | 'R') => { if (!pp.efferent[S]) return 6.5; let d = d0 - (pp.horner[S] ? 1.8 : 0); return Math.max(1.5, d * (1 - 0.4 * drive)); };
  const st = c.state; st.d ??= { L: d0, R: d0 };
  for (const S of ['L', 'R'] as const) st.d[S] += (size(S) - st.d[S]) * 0.08;
  const mid = w / 2;
  // patient's right eye is on the viewer's left
  const eyes: Record<'L' | 'R', number> = { R: mid - Math.min(130, w * 0.25), L: mid + Math.min(130, w * 0.25) };
  const ey = 50;
  for (const S of ['R', 'L'] as const) {
    const x = eyes[S];
    g.fillStyle = '#fff'; g.strokeStyle = css('--fg'); g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(x, ey, 36, 22, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#6b8f71'; g.beginPath(); g.arc(x, ey, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(x, ey, st.d[S] * 2.1, 0, Math.PI * 2); g.fill();
    text(g, `${L(c, S === 'L' ? 'left' : 'right', S === 'L' ? 'links' : 'rechts')} ${num(c, st.d[S], 1)} mm`, x + (S === 'R' ? -70 : 70), ey - 30, { size: 11, align: 'center', mono: true });
    if (lit === S) { g.fillStyle = 'rgba(255,220,90,0.45)'; g.beginPath(); g.moveTo(x, ey - 26); g.lineTo(x - 30, ey - 60); g.lineTo(x + 30, ey - 60); g.closePath(); g.fill(); }
  }
  // pathway
  const pre = { R: mid - 40, L: mid + 40 }, py = ey + 110, ewY = ey + 150, gy = ey + 200;
  const seg = (x1: number, y1: number, x2: number, y2: number, ok: boolean, active: boolean) => {
    g.strokeStyle = !ok ? css('--abn') : active ? '#f0a020' : css('--muted'); g.lineWidth = active ? 3 : 2;
    if (!ok) g.setLineDash([5, 4]);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]);
  };
  for (const S of ['R', 'L'] as const) {
    const on = lit === S && pp.afferent[S];
    seg(eyes[S], ey + 24, pre.R, py, pp.afferent[S], on);
    seg(eyes[S], ey + 24, pre.L, py, pp.afferent[S], on);
  }
  for (const S of ['R', 'L'] as const) {
    g.fillStyle = drive ? '#f0a020' : css('--muted'); g.beginPath(); g.arc(pre[S], py, 6, 0, Math.PI * 2); g.fill();
    seg(pre[S], py, pre.R, ewY, true, !!drive); seg(pre[S], py, pre.L, ewY, true, !!drive);
    g.beginPath(); g.arc(pre[S], ewY, 6, 0, Math.PI * 2); g.fill();
    const ox = eyes[S] + (S === 'R' ? -44 : 44);
    seg(pre[S], ewY, ox, gy, pp.efferent[S], !!drive && pp.efferent[S]);
    seg(ox, gy, ox, ey, pp.efferent[S], !!drive && pp.efferent[S]);
    seg(ox, ey, eyes[S] + (S === 'R' ? -36 : 36), ey, pp.efferent[S], !!drive && pp.efferent[S]);
  }
  text(g, L(c, 'pretectal nuclei', 'prätektale Kerne'), mid, py - 10, { size: 10, align: 'center', color: css('--muted') });
  text(g, 'Edinger–Westphal', mid, ewY + 18, { size: 10, align: 'center', color: css('--muted') });
  text(g, L(c, 'oculomotor nerve → ciliary ganglion → sphincter', 'N. oculomotorius → Ganglion ciliare → Sphinkter'), mid, gy + 16, { size: 10, align: 'center', color: css('--muted') });
  if (pp.horner.L || pp.horner.R) text(g, L(c, 'sympathetic chain interrupted: small pupil, slight ptosis', 'Sympathikus unterbrochen: enge Pupille, leichte Ptosis'), mid, h - 6, { size: 11, align: 'center', color: css('--abn') });
};

/* ---- acid–base: Gamblegram ---------------------------------------------------------------------------------- */
const acidbase: Draw = (g, w, h, c) => {
  const ch = c.live.chemistry as Record<string, number>;
  const na = ch.sodium, k = ch.potassium, cl = ch.chloride, hco3 = ch.bicarbonate;
  const ag = na - cl - hco3;
  const scale = (h - 70) / 170;
  const col = (x: number, parts: Array<[string, number, string]>) => {
    let y = h - 30;
    for (const [label, v, colr] of parts) {
      const hh = Math.max(0, v) * scale;
      g.fillStyle = colr; g.fillRect(x, y - hh, 90, hh);
      g.strokeStyle = css('--surface'); g.lineWidth = 1; g.strokeRect(x, y - hh, 90, hh);
      if (hh > 14) text(g, `${label} ${num(c, v)}`, x + 45, y - hh / 2 + 4, { size: 11, align: 'center', weight: 700, color: '#fff' });
      y -= hh;
    }
  };
  const x0 = Math.max(16, w / 2 - 150);
  text(g, L(c, 'Cations', 'Kationen'), x0 + 45, 18, { size: 11, align: 'center', weight: 700 });
  text(g, L(c, 'Anions', 'Anionen'), x0 + 175, 18, { size: 11, align: 'center', weight: 700 });
  col(x0, [['Na⁺', na, '#3d7ea6'], ['K⁺', k, '#6aa6c9']]);
  col(x0 + 130, [['Cl⁻', cl, '#6c8a5a'], ['HCO₃⁻', hco3, '#9bb36b'], [L(c, 'gap', 'Lücke'), ag, ag > 16 ? '#c8473d' : '#b7a36a']]);
  text(g, 'mmol/L', x0 + 110, h - 12, { size: 10, align: 'center', color: css('--muted') });
  // pH gauge
  const pH = 6.1 + Math.log10(hco3 / (0.23 * ch.paCO2));
  const gx = Math.min(w - 150, x0 + 300), gy0 = 40, gy1 = h - 40;
  const Yp = (p: number) => gy1 - ((p - 6.9) / 0.8) * (gy1 - gy0);
  g.fillStyle = css('--sunk'); g.fillRect(gx, gy0, 10, gy1 - gy0);
  g.fillStyle = css('--accent'); g.fillRect(gx, Yp(7.45), 10, Yp(7.35) - Yp(7.45));
  g.fillStyle = css('--fg'); g.beginPath(); g.moveTo(gx + 12, Yp(clamp(pH, 6.9, 7.7))); g.lineTo(gx + 20, Yp(clamp(pH, 6.9, 7.7)) - 6); g.lineTo(gx + 20, Yp(clamp(pH, 6.9, 7.7)) + 6); g.fill();
  text(g, '7.45', gx - 4, Yp(7.45) + 4, { size: 9, align: 'right', mono: true, color: css('--muted') }); text(g, '7.35', gx - 4, Yp(7.35) + 4, { size: 9, align: 'right', mono: true, color: css('--muted') });
  text(g, `pH ${num(c, pH, 2)}`, gx + 16, Yp(clamp(pH, 6.9, 7.7)) + 4, { size: 12, mono: true, weight: 700 });
  text(g, `HCO₃⁻ : (0.23·PaCO₂) = ${num(c, hco3 / (0.23 * ch.paCO2), 1)} : 1`, gx + 16, gy0 - 8, { size: 10, mono: true, color: css('--muted') });
};

/* ---- nervous system: what the lesions interrupt ------------------------------------------------------------ */
const pathways: Draw = (g, w, h, c) => {
  const f = c.view.neuro?.findings ?? [];
  if (!f.length) { text(g, L(c, 'No lesion: every pathway intact.', 'Keine Läsion: alle Bahnen intakt.'), 16, 28, { size: 13 }); return; }
  text(g, L(c, `${f.length} pathway effects of ${c.view.neuro!.nodes.length} lesioned structure(s)`, `${f.length} Bahneffekte von ${c.view.neuro!.nodes.length} geschädigten Struktur(en)`), 16, 22, { size: 12, weight: 700 });
  const rows = Math.floor((h - 40) / 16);
  f.slice(0, rows).forEach((x: any, i: number) => {
    text(g, `${x.umnOrLmn !== 'N/A' ? `[${x.umnOrLmn}] ` : ''}${x.pathway} — ${x.deficit}`.slice(0, Math.floor(w / 6.2)), 16, 44 + i * 16, { size: 11, mono: true, color: css('--muted') });
  });
};


/* ---- respiration: the breathing lungs, the pressure–volume loop, the forced expiration ------------------------- */
const LOBE_SHAPE: Record<string, { side: 'L' | 'R'; y0: number; y1: number; x0?: number; x1?: number }> = {
  RUL: { side: 'R', y0: 0, y1: 0.42 }, RML: { side: 'R', y0: 0.42, y1: 0.62 }, RLL: { side: 'R', y0: 0.62, y1: 1 },
  LUL: { side: 'L', y0: 0, y1: 0.55 }, LLL: { side: 'L', y0: 0.55, y1: 1 },
};
/** Two lungs in a chest, drawn from the model's lobes and pleura; they inflate with the volume of the current breath. */
function drawLungs(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Record<string, any>, c: DiagramContext) {
  const infl = clamp((r.V ?? 0) / Math.max(0.3, r.VT || 0.5), -0.2, 1.4);
  const p = r.params ?? {};
  g.strokeStyle = css('--line'); g.lineWidth = 2;
  rrect(g, x, y, w, h, 18); g.stroke();
  // diaphragm descends as the lungs fill
  const dia = y + h * (0.86 + 0.05 * infl);
  const lungW = w * 0.38, gap = w * 0.08;
  const sides: Array<['L' | 'R', number]> = [['R', x + w / 2 - gap / 2 - lungW], ['L', x + w / 2 + gap / 2]];
  // trachea and bronchi
  g.strokeStyle = css('--muted'); g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x + w / 2, y - 8); g.lineTo(x + w / 2, y + h * 0.22); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(x + w / 2, y + h * 0.22); g.lineTo(x + w / 2 - lungW * 0.45, y + h * 0.36);
  g.moveTo(x + w / 2, y + h * 0.22); g.lineTo(x + w / 2 + lungW * 0.45, y + h * 0.38); g.stroke(); g.lineCap = 'butt';
  for (const [side, lx] of sides) {
    const ptx = clamp(side === 'L' ? p.ptxL ?? 0 : p.ptxR ?? 0, 0, 1);
    const E = side === 'L' ? p.effusionL ?? 0 : p.effusionR ?? 0;
    const top = y + h * 0.06, bot = dia;
    const shrink = 1 - 0.55 * ptx;
    const cx = side === 'R' ? lx + lungW * (1 - shrink) * 0.0 : lx;
    const lw = lungW * shrink * (0.94 + 0.06 * infl), lh = (bot - top) * (0.96 - 0.4 * ptx);
    const ltop = top + (bot - top - lh) * 0.5 * (ptx > 0 ? 1 : 0);
    const ox = side === 'R' ? lx + lungW - lw : cx;
    for (const l of (r.lobes ?? []).filter((q: any) => q.side === side)) {
      const shp = LOBE_SHAPE[l.id];
      const ly0 = ltop + lh * shp.y0, ly1 = ltop + lh * shp.y1;
      const coll = clamp(l.collapsed - l.compressed - l.ptx, 0, 1);
      const lwid = lw * (1 - 0.6 * coll);
      const lx0 = side === 'R' ? ox + lw - lwid : ox;
      // aerated lung: pink, darker as it fills; consolidation: grey-white; oedema: blue; collapse: dark, small
      const airy = clamp(l.aerated, 0, 1);
      g.fillStyle = `rgba(${Math.round(232 - 40 * l.consolidated)}, ${Math.round(150 + 60 * l.consolidated + 30 * l.flooded)}, ${Math.round(160 + 60 * l.consolidated + 90 * l.flooded)}, ${0.35 + 0.45 * (1 - airy)})`;
      rrect(g, lx0, ly0 + 1, lwid, ly1 - ly0 - 2, 10); g.fill();
      g.strokeStyle = 'rgba(160,80,90,0.5)'; g.lineWidth = 1; g.stroke();
      if (l.embolus > 0.05) { g.fillStyle = 'rgba(70,70,70,0.75)'; g.beginPath(); g.arc(side === 'R' ? lx0 + lwid - 10 : lx0 + 10, (ly0 + ly1) / 2, 4 + 5 * l.embolus, 0, Math.PI * 2); g.fill(); }
      if (h > 140) text(g, l.id, lx0 + lwid / 2, (ly0 + ly1) / 2 + 4, { size: 10, align: 'center', color: 'rgba(80,30,40,0.8)', weight: 700 });
    }
    // pleural fluid: a meniscus from the costophrenic angle
    if (E > 30) {
      const fh = clamp(E / 3500, 0, 0.8) * (bot - top);
      g.fillStyle = 'rgba(90,140,210,0.55)';
      g.beginPath(); g.moveTo(lx - 4, bot); g.lineTo(lx + lungW + 4, bot);
      const outer = side === 'R' ? lx - 4 : lx + lungW + 4, inner = side === 'R' ? lx + lungW + 4 : lx - 4;
      g.lineTo(inner, bot - fh * 0.75); g.quadraticCurveTo((inner + outer) / 2, bot - fh * 0.8, outer, bot - fh * 1.1); g.closePath(); g.fill();
    }
    if (ptx > 0.02) text(g, L(c, 'air', 'Luft'), side === 'R' ? lx + 4 : lx + lungW - 4, top + 14, { size: 10, align: side === 'R' ? 'left' : 'right', color: css('--muted') });
  }
  g.strokeStyle = css('--fg'); g.lineWidth = 2;
  g.beginPath(); g.moveTo(x + 8, dia + 6); g.quadraticCurveTo(x + w * 0.25, dia - 10 - 8 * infl, x + w / 2, dia + 2); g.quadraticCurveTo(x + w * 0.75, dia - 10 - 8 * infl, x + w - 8, dia + 6); g.stroke();
  text(g, r.phase === 'insp' ? L(c, 'inspiration', 'Inspiration') : L(c, 'expiration', 'Exspiration'), x + w / 2, y + h + 16, { size: 11, align: 'center', color: css('--muted') });
}

const breath: Draw = (g, w, h, c) => {
  const r = (c.live.snap.resp ?? {}) as Record<string, any>;
  const st = c.state;
  st.V ??= []; st.F ??= []; st.P ??= [];
  st.V.push(r.V ?? 0); st.F.push(r.flow ?? 0); st.P.push(r.Palv ?? 0);
  for (const k of ['V', 'F', 'P']) if (st[k].length > 600) st[k].shift();
  const wide = w >= 640;
  const lx = 16, ly = 22, lw = wide ? w * 0.3 : w - 32, lh = wide ? h - 70 : 230;
  text(g, L(c, 'Lungs, now', 'Lunge, jetzt'), lx, ly - 6, { size: 11, weight: 700 });
  drawLungs(g, lx, ly + 6, lw, lh - 20, r, c);
  // flow and volume against time
  const tx = wide ? lx + lw + 26 : 16, ty = wide ? 22 : ly + lh + 30, tw = wide ? w * 0.34 : w - 32, th = wide ? (h - 70) / 2 : 120;
  const trace = (arr: number[], y0: number, hh: number, lo: number, hi: number, col: string, label: string, unit: string, cur: number, d: number) => {
    axes(g, tx, y0, tw, hh);
    const z = y0 + hh - ((0 - lo) / (hi - lo)) * hh;
    g.strokeStyle = css('--line'); g.setLineDash([2, 3]); g.beginPath(); g.moveTo(tx, z); g.lineTo(tx + tw, z); g.stroke(); g.setLineDash([]);
    g.strokeStyle = col; g.lineWidth = 1.8; g.beginPath();
    arr.forEach((v, i) => { const X = tx + (i / 600) * tw, Y = y0 + hh - ((clamp(v, lo, hi) - lo) / (hi - lo)) * hh; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
    g.stroke();
    text(g, `${label} ${num(c, cur, d)} ${unit}`, tx + 4, y0 + 12, { size: 11, mono: true, color: col, weight: 700 });
  };
  const vmax = Math.max(0.6, ...st.V) * 1.15, fmax = Math.max(0.6, ...st.F.map(Math.abs)) * 1.15;
  trace(st.V, ty, th - 12, Math.min(-0.05, ...st.V), vmax, C.ven, 'V', 'L', r.V ?? 0, 2);
  trace(st.F, ty + th + 6, th - 12, -fmax, fmax, C.art, 'V̇', 'L/s', r.flow ?? 0, 2);
  text(g, `f ${num(c, r.RR)}/min · V_T ${num(c, (r.VT ?? 0) * 1000)} mL · τ_E ${num(c, r.tauE, 2)} s · PEEPi ${num(c, r.iPEEP, 1)} cmH₂O`, tx, ty + 2 * th + 12, { size: 10, mono: true, color: css('--muted') });
  // forced expiration flow–volume loop, against the predicted normal
  const fx = wide ? tx + tw + 26 : 16, fy = wide ? 22 : ty + 2 * th + 40, fw = wide ? w - fx - 16 : w - 32, fh = wide ? h - 70 : 180;
  text(g, L(c, 'Forced expiration: flow–volume', 'Forcierte Exspiration: Fluss–Volumen'), fx, fy - 6, { size: 11, weight: 700 });
  const fe = (st.fe && st.feT > c.now - 1500) ? st.fe : (st.feT = c.now, st.fe = c.live.run.resp.forcedExpiration());
  const pred = r.pred ?? { FVC: 4.9, PEF: 10 };
  const Vm = Math.max(pred.FVC, fe.FVC) * 1.1, Fm = Math.max(pred.PEF, ...fe.flow) * 1.15;
  axes(g, fx, fy, fw, fh - 20);
  const X = (v: number) => fx + (v / Vm) * fw, Y = (q: number) => fy + fh - 20 - (q / Fm) * (fh - 24);
  // predicted: a straight descending limb from PEF
  g.strokeStyle = css('--muted'); g.setLineDash([4, 4]); g.lineWidth = 1.2; g.beginPath();
  g.moveTo(X(0), Y(0)); g.lineTo(X(pred.FVC * 0.12), Y(pred.PEF)); g.lineTo(X(pred.FVC), Y(0)); g.stroke(); g.setLineDash([]);
  g.strokeStyle = css('--accent'); g.lineWidth = 2.2; g.beginPath();
  fe.vol.forEach((v: number, i: number) => (i ? g.lineTo(X(v), Y(fe.flow[i])) : g.moveTo(X(v), Y(fe.flow[i]))));
  g.stroke();
  text(g, L(c, 'volume exhaled (L)', 'ausgeatmetes Volumen (l)'), fx + fw, fy + fh - 4, { size: 10, align: 'right', color: css('--muted') });
  text(g, 'L/s', fx + 4, fy + 10, { size: 10, color: css('--muted') });
  text(g, `FEV₁ ${num(c, fe.FEV1, 2)} · FVC ${num(c, fe.FVC, 2)} · ${num(c, fe.FEV1 / fe.FVC, 2)}`, fx + fw, fy + 10, { size: 11, align: 'right', mono: true, weight: 700 });
  text(g, L(c, 'dashed: predicted', 'gestrichelt: Soll'), fx + fw, fy + 24, { size: 10, align: 'right', color: css('--muted') });
};

/* ---- respiration: ventilation and perfusion, lobe by lobe, and the dissociation curve ---------------------------- */
const vq: Draw = (g, w, h, c) => {
  const r = (c.live.snap.resp ?? {}) as Record<string, any>;
  const lobes = (r.lobes ?? []) as any[];
  const wide = w >= 640;
  const bx = 16, by = 24, bw = wide ? w * 0.48 : w - 32, bh = wide ? h - 60 : 250;
  text(g, L(c, 'Each lobe: ventilation (blue) and perfusion (red), share of the total', 'Jeder Lappen: Ventilation (blau) und Perfusion (rot), Anteil am Ganzen'), bx, by - 8, { size: 11, weight: 700 });
  const rowH = (bh - 30) / 5;
  const order = ['RUL', 'RML', 'RLL', 'LUL', 'LLL'];
  const names: Record<string, [string, string]> = { RUL: ['R upper', 'R Ober'], RML: ['R middle', 'Mittel'], RLL: ['R lower', 'R Unter'], LUL: ['L upper', 'L Ober'], LLL: ['L lower', 'L Unter'] };
  const scale = (bw - 150) / 0.5;
  order.forEach((id, i) => {
    const l = lobes.find((x) => x.id === id); if (!l) return;
    const y = by + i * rowH + 6;
    text(g, L(c, names[id][0], names[id][1]), bx, y + 14, { size: 11, weight: 700 });
    const x0 = bx + 70;
    g.fillStyle = C.ven; g.fillRect(x0, y + 2, clamp(l.ventShare, 0, 0.5) * scale, rowH * 0.28);
    g.fillStyle = C.art; g.fillRect(x0, y + 4 + rowH * 0.28, clamp(l.perfShare - l.shuntShare, 0, 0.5) * scale, rowH * 0.28);
    g.fillStyle = 'rgba(200,71,61,0.4)'; g.fillRect(x0 + clamp(l.perfShare - l.shuntShare, 0, 0.5) * scale, y + 4 + rowH * 0.28, clamp(l.shuntShare, 0, 0.5) * scale, rowH * 0.28);
    const vqv = l.VQ;
    const tag = !Number.isFinite(vqv) ? '∞' : num(c, vqv, 2);
    text(g, `V/Q ${tag}`, bx + bw, y + 12, { size: 11, align: 'right', mono: true, weight: 700, color: !Number.isFinite(vqv) || vqv > 3 ? css('--muted') : vqv < 0.4 ? C.art : css('--fg') });
    text(g, `PAO₂ ${num(c, l.PAO2, 1)}`, bx + bw, y + 26, { size: 10, align: 'right', mono: true, color: css('--muted') });
    const tags: string[] = [];
    if (l.consolidated > 0.05) tags.push(L(c, `consolidated ${num(c, l.consolidated * 100)} %`, `konsolidiert ${num(c, l.consolidated * 100)} %`));
    if (l.flooded > 0.03) tags.push(L(c, `oedema ${num(c, l.flooded * 100)} %`, `Ödem ${num(c, l.flooded * 100)} %`));
    if (l.collapsed > 0.05) tags.push(L(c, `collapsed ${num(c, l.collapsed * 100)} %`, `kollabiert ${num(c, l.collapsed * 100)} %`));
    if (l.embolus > 0.05) tags.push(L(c, `embolus ${num(c, l.embolus * 100)} %`, `Embolus ${num(c, l.embolus * 100)} %`));
    if (tags.length) text(g, tags.join(' · '), x0, y + rowH - 2, { size: 9, color: css('--abn') });
  });
  text(g, `${L(c, 'shunt', 'Shunt')} ${num(c, (r.shunt ?? 0) * 100)} % · ${L(c, 'dead space', 'Totraum')} V_D/V_T ${num(c, r.VDVT, 2)} · A–a ${num(c, r.AaGradient, 1)} kPa`, bx, by + bh - 4, { size: 11, mono: true });

  // O2–haemoglobin dissociation curve, at this patient's pH, CO2 and temperature, with arterial and mixed venous points
  const cx = wide ? bx + bw + 30 : 16, cy = wide ? 24 : by + bh + 34, cw = wide ? w - cx - 16 : w - 32, chh = wide ? h - 60 : 230;
  text(g, L(c, 'O₂–haemoglobin dissociation', 'Sauerstoffbindungskurve'), cx, cy - 8, { size: 11, weight: 700 });
  axes(g, cx + 24, cy, cw - 24, chh - 22);
  const Pm = 16;
  const PX = (p: number) => cx + 24 + (p / Pm) * (cw - 24), SY = (s: number) => cy + chh - 22 - s * (chh - 26);
  const ps: number[] = []; for (let p = 0.2; p <= Pm; p += 0.2) ps.push(p);
  const ref = ps.map((p) => 1 / (1 + 23400 / ((p * 7.5) ** 3 + 150 * p * 7.5)));
  g.strokeStyle = css('--muted'); g.setLineDash([4, 4]); g.lineWidth = 1.2; g.beginPath();
  ps.forEach((p, i) => (i ? g.lineTo(PX(p), SY(ref[i])) : g.moveTo(PX(p), SY(ref[i])))); g.stroke(); g.setLineDash([]);
  const cur = c.live.run.resp.satCurve(ps);
  g.strokeStyle = css('--accent'); g.lineWidth = 2.2; g.beginPath();
  ps.forEach((p, i) => (i ? g.lineTo(PX(p), SY(cur[i])) : g.moveTo(PX(p), SY(cur[i])))); g.stroke();
  const pt = (P: number, S: number, col: string, label: string) => {
    g.fillStyle = col; g.beginPath(); g.arc(PX(clamp(P, 0, Pm)), SY(S), 6, 0, Math.PI * 2); g.fill();
    text(g, label, PX(clamp(P, 0, Pm)) + 9, SY(S) + 4, { size: 11, weight: 700, color: col });
  };
  pt(r.PvO2 ?? 5.3, r.SvO2 ?? 0.75, C.ven, `v̄ ${num(c, r.PvO2, 1)} kPa, ${num(c, (r.SvO2 ?? 0) * 100)} %`);
  pt(r.PaO2 ?? 12, r.SaO2 ?? 0.97, C.art, `a ${num(c, r.PaO2, 1)} kPa, ${num(c, (r.SaO2 ?? 0) * 100)} %`);
  text(g, 'kPa', cx + cw, cy + chh - 6, { size: 10, align: 'right', color: css('--muted') });
  text(g, 'S', cx + 10, cy + 10, { size: 10, color: css('--muted') });
  text(g, `CaO₂ ${num(c, r.CaO2, 1)} · Cv̄O₂ ${num(c, r.CvO2, 1)} mL/dL · DO₂ ${num(c, r.DO2)} mL/min`, cx + 24, cy + chh + 12, { size: 10, mono: true, color: css('--muted') });
};

/* ---- respiration: the controller meets the metabolic hyperbola ------------------------------------------------- */
const control: Draw = (g, w, h, c) => {
  const r = (c.live.snap.resp ?? {}) as Record<string, any>;
  const resp = c.live.run.resp;
  const st = c.state;
  st.hist ??= []; st.hist.push([r.PaCO2 ?? 5.3, r.VE ?? 6.5]); if (st.hist.length > 400) st.hist.shift();
  const wide = w >= 600;
  const px = 16, py = 24, pw = wide ? w * 0.6 : w - 32, ph = wide ? h - 60 : 260;
  text(g, L(c, 'Where breathing settles', 'Wo sich die Atmung einpendelt'), px, py - 8, { size: 11, weight: 700 });
  axes(g, px + 30, py, pw - 30, ph - 24);
  const P0 = 2.5, P1 = 10;
  const ps: number[] = []; for (let p = P0; p <= P1; p += 0.05) ps.push(p);
  const ctl = resp.controllerCurve(ps), hyp = resp.hyperbola(ps);
  const Vm = Math.max(20, (r.VE ?? 6) * 2.2, Math.min(60, r.capacity ?? 20) * 1.1);
  const X = (p: number) => px + 30 + ((p - P0) / (P1 - P0)) * (pw - 30), Y = (v: number) => py + ph - 24 - (clamp(v, 0, Vm) / Vm) * (ph - 28);
  const line = (vals: number[], col: string, wid: number, dash?: number[]) => {
    g.strokeStyle = col; g.lineWidth = wid; if (dash) g.setLineDash(dash); g.beginPath();
    let started = false;
    ps.forEach((p, i) => { const v = vals[i]; if (!Number.isFinite(v) || v > Vm * 1.05) { started = false; return; } started ? g.lineTo(X(p), Y(v)) : (g.moveTo(X(p), Y(v)), started = true); });
    g.stroke(); g.setLineDash([]);
  };
  if (Number.isFinite(r.capacity) && r.capacity < Vm) { g.strokeStyle = css('--abn'); g.setLineDash([2, 4]); g.beginPath(); g.moveTo(X(P0), Y(r.capacity)); g.lineTo(X(P1), Y(r.capacity)); g.stroke(); g.setLineDash([]); text(g, L(c, 'sustainable maximum', 'dauerhaft leistbares Maximum'), X(P1) - 4, Y(r.capacity) - 4, { size: 10, align: 'right', color: css('--abn') }); }
  line(hyp, C.ven, 2.2);
  line(ctl, C.art, 2.2);
  g.strokeStyle = 'rgba(120,120,120,0.5)'; g.lineWidth = 1; g.beginPath();
  (st.hist as Array<[number, number]>).forEach(([p, v], i) => (i ? g.lineTo(X(p), Y(v)) : g.moveTo(X(p), Y(v)))); g.stroke();
  g.fillStyle = css('--fg'); g.beginPath(); g.arc(X(clamp(r.PaCO2 ?? 5.3, P0, P1)), Y(r.VE ?? 6), 6, 0, Math.PI * 2); g.fill();
  text(g, L(c, 'controller (brainstem)', 'Regler (Hirnstamm)'), X(Math.min(P1 - 0.3, 7.5)), Y(ctl[Math.round((7.5 - P0) / 0.05)] ?? 10) - 6, { size: 11, color: C.art, weight: 700, align: 'right' });
  text(g, L(c, 'metabolic hyperbola (lungs)', 'metabolische Hyperbel (Lunge)'), X(P1) - 4, Y(hyp[hyp.length - 1]) - 8, { size: 11, color: C.ven, weight: 700, align: 'right' });
  text(g, 'PaCO₂ (kPa)', px + pw, py + ph - 4, { size: 10, align: 'right', color: css('--muted') });
  text(g, 'V̇E (L/min)', px + 34, py + 10, { size: 10, color: css('--muted') });
  for (let p = 3; p <= 10; p++) text(g, String(p), X(p), py + ph - 10, { size: 9, align: 'center', color: css('--muted'), mono: true });
  // drives, as bars
  const dx = wide ? px + pw + 26 : 16, dy = wide ? 24 : py + ph + 30, dw = wide ? w - dx - 16 : w - 32;
  text(g, L(c, 'What drives it now', 'Was jetzt antreibt'), dx, dy - 8, { size: 11, weight: 700 });
  const p = r.params ?? {};
  const sbc = r.inputs?.sbc ?? 24;
  const set = 5.33 * (24 + 0.5 * (sbc - 24)) / 24;
  const hco3 = sbc + 0.75 * ((r.PaCO2 ?? 5.33) - 5.33);
  const H = 10 ** (9 - (6.1 + Math.log10(hco3 / (0.23 * (r.PaCO2 ?? 5.33)))));
  const Pmm = (r.PaO2 ?? 12) * 7.5;
  const dP = (r.PaCO2 ?? 5.33) - set;
  const rows: Array<[string, number]> = [
    [L(c, 'CO₂ (central)', 'CO₂ (zentral)'), (p.drive ?? 1) * (p.gCO2 ?? 1.6) * dP * (dP < 0 ? 0.3 : 1)],
    [L(c, '[H⁺] (carotid body)', '[H⁺] (Glomus)'), (p.drive ?? 1) * (p.gH ?? 0.04) * (H - 40) * (H < 40 ? 0.5 : 1)],
    [L(c, 'hypoxaemia (carotid body)', 'Hypoxämie (Glomus)'), Math.min(3, (p.gO2 ?? 1) * 20 * Math.max(-0.003, 1 / Math.max(4, Pmm - 25) - 1 / 65))],
    [L(c, 'the lung itself', 'die Lunge selbst'), r.afferent ?? 0],
  ];
  rows.forEach(([label, v], i) => {
    const y = dy + 14 + i * 34;
    text(g, label, dx, y, { size: 11 });
    text(g, (v >= 0 ? '+' : '') + num(c, v, 2), dx + dw, y, { size: 11, align: 'right', mono: true });
    g.fillStyle = css('--sunk'); g.fillRect(dx, y + 6, dw, 8);
    const mid = dx + dw * 0.25, len = clamp(v / 3, -0.25, 0.75) * dw;
    g.fillStyle = v >= 0 ? C.art : C.ven; g.fillRect(Math.min(mid, mid + len), y + 6, Math.abs(len), 8);
    g.fillStyle = css('--fg'); g.fillRect(mid - 0.5, y + 3, 1, 14);
  });
  const y2 = dy + 14 + rows.length * 34 + 6;
  text(g, `${L(c, 'defended CO₂', 'verteidigtes CO₂')} ${num(c, set, 2)} kPa`, dx, y2, { size: 11, mono: true });
  text(g, `${L(c, 'asks for', 'fordert')} ${num(c, r.demand, 1)} · ${L(c, 'gets', 'erhält')} ${num(c, r.VE, 1)} L/min`, dx, y2 + 18, { size: 11, mono: true, weight: 700 });
};

export const DIAGRAMS: Record<string, { draw: Draw; height: (w: number) => number }> = {
  circuit: { draw: circuit, height: (w) => (w >= 620 ? 360 : 640) },
  baroreflex: { draw: baroreflex, height: (w) => (w >= 600 ? 300 : 520) },
  conduction: { draw: conduction, height: (w) => (w >= 600 ? 330 : 620) },
  vor: { draw: vor, height: () => 330 },
  pupil: { draw: pupil, height: () => 300 },
  acidbase: { draw: acidbase, height: () => 280 },
  pathways: { draw: pathways, height: () => 220 },
  breath: { draw: breath, height: (w) => (w >= 640 ? 340 : 760) },
  vq: { draw: vq, height: (w) => (w >= 640 ? 330 : 580) },
  control: { draw: control, height: (w) => (w >= 600 ? 320 : 520) },
};

/** Run a diagram on a canvas until stopped. */
export function runDiagram(canvas: HTMLCanvasElement, id: string, ctx: () => Omit<DiagramContext, 'now' | 'state'>): () => void {
  const d = DIAGRAMS[id];
  if (!d) return () => undefined;
  const state: Record<string, any> = {};
  const root = canvas.closest('#vp') as HTMLElement ?? document.documentElement;
  const style = getComputedStyle(root);
  css = (n: string) => style.getPropertyValue(n).trim() || '#888';
  let raf = 0;
  const frame = (now: number) => {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = d.height(w);
    if (canvas.style.height !== `${h}px`) canvas.style.height = `${h}px`;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    try { d.draw(g, w, h, { ...ctx(), now, state }); } catch (e) { console.error(e); }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
