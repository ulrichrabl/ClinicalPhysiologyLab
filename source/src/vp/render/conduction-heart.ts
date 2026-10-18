import type { ElectricalParams } from '../physiology/heart/electrical.ts';
import type { Moment } from '../stations/ecg-timeline.ts';
import { withAlpha } from './station-strip.ts';

/* ---------------------------------------------------------------------------
   The ECG station's mechanism pane (ADR-017): the heart and its conduction
   system at the cursor, and the cardiac vector in the two planes the leads
   look from.

   Every colour is a state the electrical model's activation log gives for
   this instant (stations/ecg-timeline.ts); the arrows are the recorded
   dipole at this instant, with its recent path as a fading trail. The lead
   axes are the station's own lead vectors, so a lead "sees" exactly the
   projection of the arrow on its axis.
--------------------------------------------------------------------------- */

type V3 = [number, number, number];
export interface LeadAxis { name: string; a: number; b: number; on: boolean }
export interface HeartInput {
  moment: Moment;
  e: ElectricalParams;
  dipole: V3 | null;
  trail: V3[];
  /** the largest dipole magnitude in the strip, for scaling the arrows */
  scale: number;
  frontal: LeadAxis[];      // a: left, b: feet
  horizontal: LeadAxis[];   // a: left, b: back
  colors: { fg: string; muted: string; accent: string; abn: string; line: string; sunk: string; surface: string; repol: string };
  labels: { frontal: string; horizontal: string; front: string; back: string; ra: string; la: string; rv: string; lv: string; sa: string; av: string; focus: string; ap: string };
}

export function heartPaneHeight(w: number): number { return w >= 620 ? 330 : Math.round(w * 0.95) + 2 * Math.min(w / 4 - 22, 120) + 64; }

export function drawConductionHeart(g: CanvasRenderingContext2D, w: number, h: number, s: HeartInput): void {
  const wide = w >= 620;
  const heartBox = wide ? { x: 0, y: 0, w: w * 0.5, h } : { x: 0, y: 0, w, h: Math.round(w * 0.95) };
  drawHeart(g, heartBox, s);
  /* the two planes side by side: right of the heart when wide, under it when narrow */
  const x0 = wide ? w * 0.52 : 0, rw = w - x0;
  const pr = wide ? Math.min(rw / 4 - 22, (h - 80) / 2) : Math.min(rw / 4 - 22, 120);
  const py = wide ? h / 2 + 10 : heartBox.h + 34 + pr;
  const pc = [{ x: x0 + rw / 4, y: py }, { x: x0 + (3 * rw) / 4, y: py }];
  plane(g, pc[0].x, pc[0].y, pr, s.frontal, s.dipole ? [s.dipole[0], s.dipole[1]] : null, s.trail.map((d) => [d[0], d[1]]), s, s.labels.frontal, null);
  plane(g, pc[1].x, pc[1].y, pr, s.horizontal, s.dipole ? [s.dipole[0], s.dipole[2]] : null, s.trail.map((d) => [d[0], d[2]]), s, s.labels.horizontal, [s.labels.front, s.labels.back]);
}

function drawHeart(g: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, s: HeartInput) {
  const { moment: m, e, colors: c } = s;
  const k = Math.min(box.w / 330, box.h / 320);
  const ox = box.x + (box.w - 330 * k) / 2, oy = box.y + (box.h - 320 * k) / 2;
  const P = (x: number, y: number): [number, number] => [ox + x * k, oy + y * k];
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';

  const dep = withAlpha(c.accent, 0.6), done = withAlpha(c.accent, 0.22), rep = withAlpha(c.repol, 0.45), late = withAlpha(c.abn, 0.42);
  const atriaFill = m.atria === 'depolarising' ? dep : m.atria === 'depolarised' ? done : m.atria === 'fibrillating' || m.atria === 'flutter' ? withAlpha(c.abn, 0.18) : c.sunk;
  let rvFill = c.sunk, lvFill = c.sunk;
  if (m.ventricles === 'depolarising') {
    const v = m.v;
    if (v?.route === 'ectopic') { rvFill = late; lvFill = late; }
    else {
      rvFill = lvFill = dep;
      if (m.late) { const f = m.late.reached ? late : c.sunk; if (m.late.chamber === 'RV') rvFill = f; else lvFill = f; }
    }
  } else if (m.ventricles === 'plateau') rvFill = lvFill = done;
  else if (m.ventricles === 'repolarising') rvFill = lvFill = rep;

  const ell = (cx: number, cy: number, rx: number, ry: number, fill: string, dashed: boolean) => {
    const [x, y] = P(cx, cy);
    g.beginPath(); g.ellipse(x, y, rx * k, ry * k, 0, 0, Math.PI * 2);
    g.fillStyle = fill; g.fill(); g.strokeStyle = c.muted; g.lineWidth = 1.5; g.setLineDash(dashed ? [4, 3] : []); g.stroke(); g.setLineDash([]);
  };
  const fib = m.atria === 'fibrillating' || m.atria === 'flutter';
  ell(115, 95, 52, 40, atriaFill, fib);
  ell(215, 90, 48, 36, atriaFill, fib);
  const path = (pts: Array<[number, number, number, number, number, number]>, start: [number, number]) => {
    g.beginPath(); g.moveTo(...P(...start));
    for (const q of pts) g.bezierCurveTo(...P(q[0], q[1]), ...P(q[2], q[3]), ...P(q[4], q[5]));
    g.closePath();
  };
  path([[120, 132, 62, 150, 70, 200], [78, 245, 140, 280, 175, 290]], [165, 135]);
  g.fillStyle = rvFill; g.fill(); g.strokeStyle = c.muted; g.lineWidth = 1.5; g.stroke();
  path([[215, 130, 270, 150, 262, 205], [255, 250, 205, 285, 175, 290]], [165, 135]);
  g.fillStyle = lvFill; g.fill(); g.stroke();

  g.font = `700 ${Math.max(11, 13 * k)}px ${'"Atkinson Hyperlegible", system-ui, sans-serif'}`; g.fillStyle = c.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(s.labels.ra, ...P(112, 98)); g.fillText(s.labels.la, ...P(215, 92)); g.fillText(s.labels.rv, ...P(100, 212)); g.fillText(s.labels.lv, ...P(232, 212));

  // conduction system
  const wire = (pts: Array<[number, number]>, on: boolean, blocked: boolean) => {
    g.strokeStyle = blocked ? c.abn : on ? c.accent : withAlpha(c.muted, 0.7);
    g.lineWidth = (on ? 5 : 3.2) * Math.max(0.8, k); g.setLineDash(blocked ? [5, 5] : []);
    g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(...P(...q)) : g.moveTo(...P(...q)))); g.stroke(); g.setLineDash([]);
  };
  const rbbBlocked = e.rbb < 0.35, lbbBlocked = e.lbb < 0.35;
  const bundlesOn = m.bundles === 'conducting';
  wire([[160, 134], [166, 165]], bundlesOn, false);
  wire([[166, 165], [135, 215], [120, 255]], bundlesOn && !rbbBlocked, rbbBlocked);
  wire([[166, 165], [200, 215], [225, 258]], bundlesOn && !lbbBlocked, lbbBlocked);
  const cross = (x: number, y: number) => { g.strokeStyle = c.abn; g.lineWidth = 3.5 * Math.max(0.8, k); g.beginPath(); g.moveTo(...P(x - 8, y - 8)); g.lineTo(...P(x + 8, y + 8)); g.moveTo(...P(x + 8, y - 8)); g.lineTo(...P(x - 8, y + 8)); g.stroke(); };
  if (rbbBlocked) cross(149, 190);
  if (lbbBlocked) cross(183, 190);
  if (e.accessory) {
    const on = m.ventricles === 'depolarising' && m.v?.delta != null && m.t < m.v.t;
    wire([[248, 118], [262, 150]], on, false);
    g.font = `500 ${Math.max(10, 11 * k)}px "JetBrains Mono", ui-monospace, monospace`; g.fillStyle = c.muted; g.textAlign = 'left';
    g.fillText(s.labels.ap, ...P(268, 132));
  }
  const node = (x: number, y: number, r: number, fill: string, label: string, lx: number, ly: number) => {
    g.beginPath(); g.arc(...P(x, y), r * Math.max(0.8, k), 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.strokeStyle = c.fg; g.lineWidth = 1.5; g.stroke();
    g.font = `500 ${Math.max(10, 12 * k)}px "JetBrains Mono", ui-monospace, monospace`; g.fillStyle = c.fg; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(label, ...P(lx, ly));
  };
  const saOn = m.atria === 'depolarising' && m.a != null && m.t - m.a.t < 40;
  node(82, 64, 8, fib ? c.sunk : saOn ? c.accent : c.surface, s.labels.sa, 46, 50);
  node(160, 128, 7, m.avNode === 'conducting' ? c.accent : m.avNode === 'blocked' ? c.abn : c.surface, s.labels.av, 124, 150);
  if (m.v?.route === 'ectopic' && m.ventricles === 'depolarising') {
    const [fx, fy] = m.v.origin === 'vt' ? [205, 262] : [150, 250];
    g.beginPath(); g.arc(...P(fx, fy), 7 * Math.max(0.8, k), 0, Math.PI * 2); g.fillStyle = c.abn; g.fill();
    g.font = `500 ${Math.max(10, 12 * k)}px "JetBrains Mono", ui-monospace, monospace`; g.fillStyle = c.fg; g.textAlign = 'center';
    g.fillText(s.labels.focus, ...P(fx, fy + 22));
  }
  g.restore();
}

function plane(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, axes: LeadAxis[], d: [number, number] | null, trail: Array<[number, number]>, s: HeartInput, title: string, ends: [string, string] | null) {
  const c = s.colors;
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = c.surface; g.fill(); g.strokeStyle = c.line; g.lineWidth = 1; g.stroke();
  for (const ax of axes) {
    const m = Math.hypot(ax.a, ax.b) || 1, ux = ax.a / m, uy = ax.b / m;
    g.strokeStyle = ax.on ? c.fg : c.line; g.lineWidth = ax.on ? 1.8 : 1; g.setLineDash(ax.on ? [] : [3, 3]);
    g.beginPath(); g.moveTo(cx - ux * r, cy - uy * r); g.lineTo(cx + ux * r, cy + uy * r); g.stroke(); g.setLineDash([]);
    g.font = `${ax.on ? 700 : 500} 11px "JetBrains Mono", ui-monospace, monospace`; g.fillStyle = ax.on ? c.fg : c.muted; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ax.name, cx + ux * (r + 13), cy + uy * (r + 11));
  }
  g.font = `700 12px "Atkinson Hyperlegible", system-ui, sans-serif`; g.fillStyle = c.fg; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(title, cx, cy - r - 22);
  if (ends) {
    g.font = `500 10px "JetBrains Mono", ui-monospace, monospace`; g.fillStyle = c.muted;
    g.fillText(ends[0], cx, cy - r + 12); g.fillText(ends[1], cx, cy + r - 5);
  }
  const k = (r * 0.9) / Math.max(0.2, s.scale);
  if (trail.length > 1) {
    for (let i = 1; i < trail.length; i++) {
      g.strokeStyle = withAlpha(c.accent, 0.12 + 0.6 * (i / trail.length)); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(cx + trail[i - 1][0] * k, cy + trail[i - 1][1] * k); g.lineTo(cx + trail[i][0] * k, cy + trail[i][1] * k); g.stroke();
    }
  }
  if (d) {
    const x = cx + d[0] * k, y = cy + d[1] * k, len = Math.hypot(x - cx, y - cy);
    if (len > 3) {
      const a = Math.atan2(y - cy, x - cx);
      g.strokeStyle = c.fg; g.fillStyle = c.fg; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(x - 7 * Math.cos(a), y - 7 * Math.sin(a)); g.stroke();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 11 * Math.cos(a - 0.42), y - 11 * Math.sin(a - 0.42)); g.lineTo(x - 11 * Math.cos(a + 0.42), y - 11 * Math.sin(a + 0.42)); g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fillStyle = c.fg; g.fill();
  }
  g.restore();
}
