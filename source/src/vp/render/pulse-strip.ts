import type { BeatRecord } from '../live/live-patient.ts';
import { venousWaves as vw0, arterialWave as aw0, type WaveSample } from '../../domains/cardio/sim/waves.ts';
const venousWaves = (S: Array<Record<string, number>>) => vw0(S as unknown as WaveSample[]);
const arterialWave = (S: Array<Record<string, number>>) => aw0(S as unknown as WaveSample[]);
import { withAlpha } from './station-strip.ts';

/* ---------------------------------------------------------------------------
   The pulse and neck-vein station's drawings, all from the circulation's own
   beats (2 ms samples):

   - the strip: the last seconds of ECG, arterial pressure (what the finger
     on the artery feels) and right atrial pressure (what the eye reads in
     the neck), beat by beat on the circulation's clock, with each beat's
     venous waves named where the model made them;
   - the beat: one beat, left heart above (aorta and ventricle) and right
     heart below (atrium and ventricle), with the valve events, the
     atrium's contraction and the a, x, v and y the eye sees;
   - the neck: the patient at 45°, the sternal angle, and the column of
     blood in the internal jugular vein rising and falling with the right
     atrial pressure now.
--------------------------------------------------------------------------- */

export interface PulseColors { fg: string; muted: string; accent: string; abn: string; line: string; surface: string; ven: string; art: string }

const font = (w = 500, s = 10) => `${w} ${s}px "JetBrains Mono", ui-monospace, monospace`;
const WAVES = ['a', 'x', 'v', 'y'] as const;

function line(g: CanvasRenderingContext2D, pts: Array<[number, number]>, color: string, width: number) {
  g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
}
const range = (vals: number[], pad: number): [number, number] => {
  let lo = Infinity, hi = -Infinity;
  for (const v of vals) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (!Number.isFinite(lo)) return [0, 1];
  const p = Math.max(pad, (hi - lo) * 0.1);
  return [lo - p, hi + p];
};

export function pulseStripHeight(w: number): number { return Math.round(Math.max(230, Math.min(320, w * 0.34))); }

/** The last seconds of the circulation's beats: ECG, arterial pressure, right atrial pressure. */
export function drawPulseStrip(g: CanvasRenderingContext2D, w: number, h: number, beats: BeatRecord[], from: number, to: number,
  c: PulseColors, labels: { ecg: string; art: string; ven: string; mmHg: string }, opts: { blind?: boolean } = {}) {
  /* blind (Identify): no ECG, which the bedside does not have, and no named waves, since naming them is the task */
  g.fillStyle = c.surface; g.fillRect(0, 0, w, h);
  const pad = 40, x = (t: number) => pad + ((t - from) / (to - from)) * (w - pad - 8);
  const rows = { ecg: [8, h * 0.18], art: [h * 0.22, h * 0.36], ven: [h * 0.62, h * 0.33] } as const;
  const all = beats.flatMap((b) => b.samples.map((s) => ({ ...s, T: b.t0 + s.t }) as Record<string, number>)).filter((s) => s.T >= from - 50 && s.T <= to);
  const [aLo, aHi] = range(all.map((s) => s.Pa), 5), [vLo, vHi] = range(all.map((s) => s.Pra), 1.5);
  let eMax = 0.2; for (const s of all) eMax = Math.max(eMax, Math.abs(s.ecg ?? 0));
  const yOf = (row: readonly [number, number], v: number, lo: number, hi: number) => row[0] + row[1] - ((v - lo) / (hi - lo)) * row[1];
  g.save(); g.beginPath(); g.rect(pad, 0, w - pad - 8, h); g.clip();
  // inspiration shading from each beat's breath
  for (const b of beats) {
    if (b.log?.breath?.phase !== 'insp') continue;
    const a = x(b.t0), e = x(b.t0 + b.dur);
    g.fillStyle = withAlpha(c.accent, 0.06); g.fillRect(a, 0, e - a, h);
  }
  const named: Array<{ k: string; x: number }> = [];
  for (const b of beats) {
    const S = b.samples;
    if (!opts.blind) line(g, S.map((s) => [x(b.t0 + s.t), rows.ecg[0] + rows.ecg[1] / 2 - ((s.ecg ?? 0) / eMax) * rows.ecg[1] * 0.45] as [number, number]), c.muted, 1);
    line(g, S.map((s) => [x(b.t0 + s.t), yOf(rows.art, s.Pa, aLo, aHi)] as [number, number]), c.art, 1.8);
    line(g, S.map((s) => [x(b.t0 + s.t), yOf(rows.ven, s.Pra, vLo, vHi)] as [number, number]), c.ven, 1.8);
    /* this beat's venous waves, named where the model made them */
    if (opts.blind) continue;
    const vw = venousWaves(S);
    g.font = font(700, 10); g.textAlign = 'center'; g.fillStyle = c.ven;
    for (const k of WAVES) {
      const t = vw.at[k]; if (t == null) continue;
      const val = k === 'a' ? (vw.a ?? NaN) : vw[k];
      if (!Number.isFinite(val)) continue;
      const up = k === 'a' || k === 'v';
      const isCannon = k === 'a' && vw.aClosed != null && vw.aClosed > vw.v;
      g.fillStyle = isCannon ? c.abn : c.ven;
      g.textBaseline = up ? 'bottom' : 'top';
      /* a wave that spans two beats' windows is named once */
      const px = x(b.t0 + t);
      if (named.some((n) => n.k === k && Math.abs(n.x - px) < 10)) continue;
      named.push({ k, x: px });
      g.fillText(isCannon ? 'a!' : k, px, yOf(rows.ven, val, vLo, vHi) + (up ? -3 : 3));
    }
  }
  g.restore();
  g.font = font(500, 10); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = c.muted;
  if (!opts.blind) g.fillText(labels.ecg, 2, rows.ecg[0] + rows.ecg[1] / 2);
  g.fillStyle = c.art; g.fillText(labels.art, 2, rows.art[0] + 10);
  g.fillStyle = c.muted; g.fillText(`${Math.round(aHi)}`, 2, rows.art[0] + 24); g.fillText(`${Math.round(aLo)}`, 2, rows.art[0] + rows.art[1] - 6);
  g.fillStyle = c.ven; g.fillText(labels.ven, 2, rows.ven[0] + 10);
  g.fillStyle = c.muted; g.fillText(`${vHi.toFixed(0)}`, 2, rows.ven[0] + 24); g.fillText(`${vLo.toFixed(0)}`, 2, rows.ven[0] + rows.ven[1] - 6);
  g.fillText(labels.mmHg, 2, h - 6);
}

/** One beat in detail: left heart above, right heart below, valve events, the atrium's contraction, the venous waves. */
export function beatHeight(w: number): number { return Math.round(Math.max(280, Math.min(380, w * 0.5))); }
export function drawBeat(g: CanvasRenderingContext2D, w: number, h: number, b: BeatRecord, c: PulseColors,
  labels: { aorta: string; lv: string; ra: string; rv: string; atria: string; ms: string; ev: Record<string, string> }) {
  g.fillStyle = c.surface; g.fillRect(0, 0, w, h);
  const S = b.samples, padL = 40, x = (t: number) => padL + (t / b.dur) * (w - padL - 10);
  const top = [14, h * 0.42] as const, bot = [h * 0.56, h * 0.36] as const;
  const [lHi] = [Math.max(...S.map((s) => Math.max(s.Pa, s.Pv))) * 1.05];
  const [rHi] = [Math.max(...S.map((s) => Math.max(s.Prv ?? 0, s.Pra))) * 1.1];
  const yL = (v: number) => top[0] + top[1] - (v / lHi) * top[1];
  const raLo = Math.min(...S.map((s) => s.Pra)) - 1, raHi = Math.max(...S.map((s) => s.Pra)) + 1.5;
  const yR = (v: number) => bot[0] + bot[1] - ((v - raLo) / (raHi - raLo)) * bot[1];
  // the atrium's contraction
  for (let i = 1; i < S.length; i++) if ((S[i].ea ?? 0) > 0.3) { g.fillStyle = withAlpha(c.ven, 0.1); g.fillRect(x(S[i - 1].t), top[0], x(S[i].t) - x(S[i - 1].t) + 0.5, bot[0] + bot[1] - top[0]); }
  // left heart
  line(g, S.map((s) => [x(s.t), yL(s.Pv)] as [number, number]), withAlpha(c.fg, 0.55), 1.4);
  line(g, S.map((s) => [x(s.t), yL(s.Pa)] as [number, number]), c.art, 2);
  // right atrium on its own scale (the right ventricle's pressure would flatten it): the waves are the point
  line(g, S.map((s) => [x(s.t), yR(s.Pra)] as [number, number]), c.ven, 2);
  // valve events
  const T = b.times ?? {};
  const ev: Array<[string, number | null | undefined]> = [['AO', T.avo], ['AC', T.a2], ['TC', T.t1 != null && T.t1 > b.dur / 2 ? null : T.t1], ['TO', T.tvo]];
  g.font = font(600, 9); g.textAlign = 'center'; g.textBaseline = 'top';
  for (const [id, t] of ev) {
    if (t == null || t < 0 || t > b.dur) continue;
    g.strokeStyle = withAlpha(c.muted, 0.6); g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(x(t), top[0]); g.lineTo(x(t), bot[0] + bot[1]); g.stroke(); g.setLineDash([]);
    g.fillStyle = c.muted; g.fillText(labels.ev[id] ?? id, x(t), bot[0] + bot[1] + 4);
  }
  // the venous waves
  const vw = venousWaves(S);
  g.font = font(700, 12); g.fillStyle = c.ven;
  for (const k of WAVES) {
    const t = vw.at[k]; const val = k === 'a' ? vw.a : vw[k];
    if (t == null || val == null) continue;
    const up = k === 'a' || k === 'v';
    const cannon = k === 'a' && vw.aClosed != null && vw.aClosed > vw.v;
    g.fillStyle = cannon ? c.abn : c.ven; g.textBaseline = up ? 'bottom' : 'top';
    g.fillText(cannon ? 'cannon a' : k, x(t), yR(val) + (up ? -4 : 4));
  }
  // the pulse upstroke
  const aw = arterialWave(S);
  g.font = font(500, 10); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = c.art; g.fillText(`${labels.aorta} ${Math.round(aw.foot)}–${Math.round(aw.peak)} · ↑ ${Math.round(aw.upstrokeMs)} ms`, padL + 4, top[0] + 10);
  g.fillStyle = withAlpha(c.fg, 0.7); g.fillText(labels.lv, padL + 4, top[0] + 24);
  g.fillStyle = c.ven; g.fillText(`${labels.ra} ${raLo.toFixed(0)}–${raHi.toFixed(0)} ${labels.ms}`, padL + 4, bot[0] + 10);
  g.fillStyle = withAlpha(c.ven, 0.6); g.fillRect(w - 120, bot[0] - 14, 10, 8); g.fillStyle = c.muted; g.fillText(labels.atria, w - 106, bot[0] - 7);
  g.textAlign = 'right'; g.fillStyle = c.muted; g.fillText(`${Math.round(lHi)}`, padL - 4, top[0] + 8); g.fillText('0', padL - 4, top[0] + top[1]);
}

/** The patient at 45° from the side: the column of blood in the internal jugular vein, rising and falling with the right
    atrial pressure now. Its top, measured vertically above the sternal angle, is the JVP. */
export function neckHeight(w: number): number { return Math.round(Math.max(220, Math.min(300, w * 0.75))); }
export function drawNeck(g: CanvasRenderingContext2D, w: number, h: number, praNow: number, praMean: number, c: PulseColors,
  labels: { angle: string; above: string; notSeen: string; ear: string; cm: string; ra?: string }) {
  g.fillStyle = c.surface; g.fillRect(0, 0, w, h);
  /* geometry in cm, on screen: the sternal angle O; the trunk at 45°, head to the left (u: toward the head, up and left);
     the back toward the bed (b: down and left). A column of blood stands 1.36 cm per mmHg above the right atrium, which
     lies about 5 cm below the sternal angle in any position. */
  const s = Math.min(w / 30, h / 27), O: [number, number] = [w * 0.68, h * 0.62];
  const R2 = Math.SQRT1_2, u: [number, number] = [-R2, -R2], bk: [number, number] = [-R2, R2];
  const at = (du: number, db = 0): [number, number] => [O[0] + (u[0] * du + bk[0] * db) * s, O[1] + (u[1] * du + bk[1] * db) * s];
  const skin = withAlpha(c.fg, 0.08), edge = withAlpha(c.fg, 0.45);
  // the trunk and neck: chest surface, front of the neck, the back on the bed
  g.fillStyle = skin; g.strokeStyle = edge; g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(...at(-16, 0)); g.lineTo(...at(4, 0));                    // chest wall up to the suprasternal notch
  g.quadraticCurveTo(...at(6, 1.5), ...at(9, 1.2));                   // the front of the neck
  g.lineTo(...at(13, 0.4));                                          // to the chin
  g.lineTo(...at(13, 9)); g.lineTo(...at(-16, 12)); g.closePath(); g.fill(); g.stroke();
  // the head
  const hc = at(17, 4.5);
  g.beginPath(); g.arc(hc[0], hc[1], 5.2 * s, 0, Math.PI * 2); g.fill(); g.stroke();
  const ear = at(16, 6.2);
  g.fillStyle = withAlpha(c.fg, 0.2); g.beginPath(); g.ellipse(ear[0], ear[1], 1.1 * s, 1.7 * s, Math.PI / 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = c.muted; g.font = font(500, 10); g.textAlign = 'center'; g.fillText(labels.ear, ear[0], ear[1] + 2.6 * s);
  // the bed
  g.strokeStyle = c.line; g.lineWidth = 3; g.beginPath(); g.moveTo(...at(-18, 12.6)); g.lineTo(...at(22, 12.6)); g.stroke();
  // heights above the sternal angle: horizontal lines, because the height is vertical
  g.strokeStyle = withAlpha(c.muted, 0.45); g.lineWidth = 1; g.setLineDash([3, 3]); g.font = font(500, 10); g.fillStyle = c.muted; g.textAlign = 'left';
  for (const k of [0, 5, 10]) { const y = O[1] - k * s; g.beginPath(); g.moveTo(w * 0.08, y); g.lineTo(w - 4, y); g.stroke(); g.fillText(`${k} ${labels.cm}`, w - 40, y - 3); }
  g.setLineDash([]);
  // the right atrium, 5 cm below the angle
  const ra: [number, number] = [O[0], O[1] + 5 * s];
  g.fillStyle = withAlpha(c.ven, 0.35); g.beginPath(); g.arc(ra[0], ra[1], 1.4 * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = c.ven; g.font = font(500, 10); g.textAlign = 'left'; g.fillText(labels.ra ?? 'RA', ra[0] + 1.8 * s, ra[1] + 3);
  // the column in the internal jugular vein, inside the neck, from the notch to where the atrium's pressure holds it
  const height = praNow * 1.36 - 5;                // cm above the sternal angle, now
  const top = height / R2;                          // distance along the neck to that height
  if (top > 1) {
    const a0 = at(1, 1.6), a1 = at(Math.min(top, 14), 1.6);
    g.strokeStyle = c.ven; g.lineWidth = Math.max(4, 0.9 * s); g.lineCap = 'round';
    g.beginPath(); g.moveTo(...a0); g.lineTo(...a1); g.stroke(); g.lineCap = 'butt';
    // its height, read vertically
    g.strokeStyle = c.ven; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(a1[0], a1[1]); g.lineTo(O[0] + 2 * s, a1[1]); g.stroke();
    g.beginPath(); g.moveTo(O[0] + 2 * s, O[1]); g.lineTo(O[0] + 2 * s, a1[1]); g.stroke();
  }
  // the sternal angle
  g.fillStyle = c.fg; g.beginPath(); g.arc(O[0], O[1], 3.5, 0, Math.PI * 2); g.fill();
  g.font = font(500, 10); g.textAlign = 'left'; g.fillText(labels.angle, O[0] + 6, O[1] + 12);
  /* the JVP is read as the column's level over the beat, not its instant height */
  const mean = praMean * 1.36 - 5;
  g.fillStyle = mean > 3 ? c.abn : c.fg; g.font = font(700, 12); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(mean > 0 ? `${mean.toFixed(1)} ${labels.cm} ${labels.above}` : labels.notSeen, 8, h - 8);
}
