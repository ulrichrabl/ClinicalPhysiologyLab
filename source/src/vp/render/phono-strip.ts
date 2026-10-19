import { phonoSample, type Cycle } from './phono.ts';
import type { BeatRecord } from '../live/live-patient.ts';
import { withAlpha } from './station-strip.ts';

/* ---------------------------------------------------------------------------
   The auscultation station's signal (ADR-017 step 4): a phonocardiogram over
   the last few beats, each beat drawn from its own valve events, under the
   ECG the same beats produced, and over the breath they fell in.

   The beats differ: breathing moves P2, an irregular rhythm moves S1. The
   strip shows exactly the beats the circulation computed, on its clock.
--------------------------------------------------------------------------- */

export interface StripBeat {
  beat: BeatRecord;
  /** the sounds of this beat at the chosen site, timed from its valve events (seconds from S1) */
  cycle: Cycle;
  /** where S1 falls, ms from the beat's start (negative when the mitral valve closed just before activation) */
  s1At: number;
}

export interface PhonoStripInput {
  beats: StripBeat[];
  /** the window drawn, ms on the circulation's clock */
  from: number; to: number;
  cursor: number;
  band: { from: number; to: number } | null;
  colors: { fg: string; muted: string; accent: string; abn: string; line: string; surface: string; insp: string };
  labels: { ecg: string; phono: string; insp: string; exp: string; sounds: Record<string, string> };
}

export interface PhonoGeometry { tAt(x: number): number; xAt(t: number): number }

const ECG_H = 0.22, PHONO_H = 0.48, BREATH_H = 0.07;

export function phonoStripHeight(w: number): number { return Math.round(Math.max(190, Math.min(300, w * 0.32))); }

export function drawPhonoStrip(g: CanvasRenderingContext2D, w: number, h: number, s: PhonoStripInput): PhonoGeometry {
  const pad = 34;
  const xAt = (t: number) => pad + ((t - s.from) / (s.to - s.from)) * (w - pad - 6);
  const tAt = (x: number) => s.from + ((x - pad) / (w - pad - 6)) * (s.to - s.from);
  const top = 16, legendH = 16, hh = h - legendH, ecgH = hh * ECG_H, phH = hh * PHONO_H, brH = hh * BREATH_H;
  const yEcg = top, yPh = top + ecgH + 16, yBr = yPh + phH + 8;
  g.fillStyle = s.colors.surface; g.fillRect(0, 0, w, h);

  // the phase band at the cursor
  if (s.band) { const a = Math.max(pad, xAt(s.band.from)), b = Math.min(w, xAt(s.band.to)); if (b > a) { g.fillStyle = withAlpha(s.colors.accent, 0.13); g.fillRect(a, top - 4, b - a, yBr + brH - top + 4); } }

  // the breath: each beat shaded by the phase its P2 fell in
  for (const b of s.beats) {
    const ph = b.beat.log.breath?.phase;
    const a = Math.max(pad, xAt(b.beat.t0)), e = Math.min(w - 6, xAt(b.beat.t0 + b.beat.dur));
    if (e <= a) continue;
    g.fillStyle = ph === 'insp' ? withAlpha(s.colors.insp, 0.55) : withAlpha(s.colors.line, 0.6);
    g.fillRect(a, yBr, e - a, brH);
  }
  g.font = `500 10px "JetBrains Mono", ui-monospace, monospace`; g.textBaseline = 'middle'; g.fillStyle = s.colors.muted;
  g.fillText(s.labels.ecg, 2, yEcg + ecgH / 2); g.fillText(s.labels.phono, 2, yPh + phH / 2);

  // ECG and phonocardiogram, beat by beat
  const line = (pts: Array<[number, number]>, color: string, width: number) => {
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  };
  let ecgMax = 0.2;
  for (const b of s.beats) for (const x of b.beat.samples) ecgMax = Math.max(ecgMax, Math.abs(x.ecg ?? 0));
  g.save(); g.beginPath(); g.rect(pad, 0, w - pad - 6, h); g.clip();
  const placed: Array<{ x: number; level: number }> = [];
  /* Each beat's sounds run from its own S1 until the next beat's S1: one continuous timeline, so every S1 is drawn once,
     whether the mitral valve closed just before its activation or just after. */
  const starts = s.beats.map((b) => b.beat.t0 + b.s1At);
  for (const b of s.beats) {
    const pts: Array<[number, number]> = [];
    for (const x of b.beat.samples) pts.push([xAt(b.beat.t0 + x.t), yEcg + ecgH / 2 - ((x.ecg ?? 0) / ecgMax) * ecgH * 0.45]);
    line(pts, s.colors.muted, 1.2);
  }
  const dtMs = Math.max(0.25, ((s.to - s.from) / Math.max(200, w)) / 3);
  s.beats.forEach((b, k) => {
    const a = starts[k], e = k + 1 < s.beats.length ? starts[k + 1] : b.beat.t0 + b.beat.dur;
    const period = b.cycle.periodS * 1000;
    const ph: Array<[number, number]> = [];
    for (let T = a; T < e; T += dtMs) ph.push([xAt(T), yPh + phH / 2 - (T - a < period ? phonoSample(b.cycle, (T - a) / 1000) : 0) * phH * 0.42]);
    line(ph, s.colors.fg, 1);
    /* the sounds, named above the trace; a name that would overlap another takes the next line up */
    g.fillStyle = s.colors.fg; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.font = `600 10px "JetBrains Mono", ui-monospace, monospace`;
    const named = b.cycle.sounds.filter((x) => x.amp > 0 && a + x.t * 1000 < e).map((snd) => ({ name: s.labels.sounds[snd.name] ?? snd.name, x: xAt(a + snd.t * 1000) })).sort((p, q) => p.x - q.x);
    for (const n of named) {
      let level = 0;
      while (placed.some((p) => p.level === level && Math.abs(p.x - n.x) < 22)) level++;
      placed.push({ x: n.x, level });
      g.fillText(n.name, n.x, yPh + 2 - level * 11);
    }
  });
  g.restore();
  g.textAlign = 'left';
  // legend of the breath bar
  g.fillStyle = withAlpha(s.colors.insp, 0.55); g.fillRect(pad, yBr + brH + 6, 10, 8);
  g.fillStyle = s.colors.muted; g.textBaseline = 'top'; g.fillText(s.labels.insp, pad + 14, yBr + brH + 5);
  g.fillStyle = withAlpha(s.colors.line, 0.6); g.fillRect(pad + 110, yBr + brH + 6, 10, 8);
  g.fillStyle = s.colors.muted; g.fillText(s.labels.exp, pad + 124, yBr + brH + 5);

  // cursor
  const xc = xAt(s.cursor);
  g.strokeStyle = s.colors.accent; g.lineWidth = 2.5; g.beginPath(); g.moveTo(xc, top - 6); g.lineTo(xc, yBr + brH); g.stroke();
  g.fillStyle = s.colors.accent; g.beginPath(); g.moveTo(xc - 7, top - 10); g.lineTo(xc + 7, top - 10); g.lineTo(xc, top - 1); g.closePath(); g.fill();
  return { tAt, xAt };
}
