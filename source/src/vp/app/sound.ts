import { murmurEnvelope, type Cycle } from '../render/phono.ts';

/* Shared by the focused views: a scrolling trace, and heart sounds as audio. */

/** Draw f(t) scrolling right-to-left in real time, until the returned stop() is called. */
export function traceLoop(canvas: HTMLCanvasElement, f: (t: number) => number, windowS: number, gain: number, cyc?: Cycle): () => void {
  const ctx = canvas.getContext('2d')!;
  const root = (canvas.closest('#vp') as HTMLElement) ?? document.documentElement;
  const css = (n: string) => getComputedStyle(root).getPropertyValue(n).trim();
  const t0 = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const tNow = (now - t0) / 1000;
    ctx.strokeStyle = css('--grid'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    if (cyc) {
      ctx.fillStyle = css('--systole');
      for (let k = Math.floor((tNow - windowS) / cyc.periodS); k <= Math.ceil(tNow / cyc.periodS); k++) {
        const a = k * cyc.periodS, b = a + cyc.systoleS;
        const xa = w - (tNow - a) / windowS * w, xb = w - (tNow - b) / windowS * w;
        ctx.fillRect(xa, 0, xb - xa, h);
      }
    }
    ctx.strokeStyle = css('--trace'); ctx.lineWidth = 1.4; ctx.beginPath();
    const n = Math.max(200, Math.round(w * 2));
    for (let i = 0; i <= n; i++) {
      const x = i / n * w, tt = tNow - windowS + i / n * windowS;
      const y = h / 2 - f(tt) * gain * h * 0.3;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

/** Heart sounds as damped low-frequency bursts, murmurs as band-passed noise shaped by their envelope. Returns stop(). */
export function playCycle(cyc: Cycle): (() => void) | null {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  const ac: AudioContext = new AC();
  const sr = ac.sampleRate;
  const len = Math.round(cyc.periodS * sr);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (const snd of cyc.sounds) {
    const f = snd.freqHz * 1.6;   // shifted up so laptop speakers can render it
    const start = Math.round(snd.t * sr), n = Math.round(snd.durS * sr);
    for (let i = 0; i < n && start + i < len; i++) {
      const x = i / sr;
      d[start + i] += snd.amp * 0.8 * Math.sin(2 * Math.PI * f * x) * Math.exp(-x / (snd.durS / 3)) * (1 - Math.exp(-x * 400));
    }
  }
  for (const m of cyc.murmurs) {
    let y1 = 0, y2 = 0;
    const w0 = 2 * Math.PI * m.centreHz / sr, r = 0.985;
    const a1 = 2 * r * Math.cos(w0), a2 = -r * r;
    for (let i = 0; i < len; i++) {
      const e = murmurEnvelope(m, i / sr);
      const y = (e > 0 ? rnd() * e : 0) * (1 - r) * 6 + a1 * y1 + a2 * y2;
      y2 = y1; y1 = y;
      d[i] += y * m.amp * 0.9;
    }
  }
  const src = ac.createBufferSource();
  src.buffer = buf; src.loop = true;
  const g = ac.createGain(); g.gain.value = 0.9;
  src.connect(g).connect(ac.destination);
  src.start();
  return () => { try { src.stop(); ac.close(); } catch { /* already stopped */ } };
}

/* ---- the lungs ------------------------------------------------------------------------------------------------- */

export interface BreathSpec {
  rr: number; ti: number; tauE: number;            // from the respiratory model: rate, inspiratory time, expiratory time constant
  breath: 'vesicular' | 'bronchial' | 'reduced' | 'absent';
  added: string[];                                 // 'fine-crackles', 'coarse-crackles', 'wheeze'
}

/** Airflow through one breath, the model's own shape: a half-sine of inspiration, an exponential expiration. Normalised to peak 1. */
export function breathFlow(spec: BreathSpec, t: number): number {
  const T = 60 / Math.max(4, spec.rr), tt = ((t % T) + T) % T;
  if (tt < spec.ti) return Math.sin((Math.PI * tt) / spec.ti);
  const te = tt - spec.ti;
  return -0.75 * Math.exp(-te / Math.max(0.08, spec.tauE)) * Math.min(1, te / 0.06);
}

/** One breath of breath sounds as samples: filtered noise following the flow, with the lung's filtering and the added sounds. */
export function synthBreath(sr: number, spec: BreathSpec): Float32Array {
  const T = 60 / Math.max(4, spec.rr), n = Math.round(T * sr);
  const out = new Float32Array(n);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  // a two-pole band-pass per character: aerated lung passes the low frequencies; consolidation passes the high
  const band = spec.breath === 'bronchial' ? [700, 0.93] : [260, 0.965];
  const w0 = (2 * Math.PI * band[0]) / sr, r = band[1];
  const a1 = 2 * r * Math.cos(w0), a2 = -r * r;
  let y1 = 0, y2 = 0;
  const level = spec.breath === 'absent' ? 0.03 : spec.breath === 'reduced' ? 0.3 : spec.breath === 'bronchial' ? 1.1 : 0.9;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = breathFlow(spec, t);
    // vesicular: inspiration throughout, expiration faint and early; bronchial: expiration as loud and long, a gap between
    let env = f > 0 ? f : spec.breath === 'bronchial' ? -f * 1.1 : -f * 0.35 * (t - spec.ti < 0.35 * (T - spec.ti) ? 1 : 0.15);
    if (spec.breath === 'bronchial' && Math.abs(t - spec.ti) < 0.12) env *= Math.abs(t - spec.ti) / 0.12;
    const y = rnd() * env * (1 - r) * 9 + a1 * y1 + a2 * y2;
    y2 = y1; y1 = y;
    out[i] = y * level;
  }
  const click = (t0: number, f: number, durS: number, amp: number) => {
    const s0 = Math.round(t0 * sr), m = Math.round(durS * sr);
    for (let i = 0; i < m && s0 + i < n; i++) { const x = i / sr; out[s0 + i] += amp * Math.sin(2 * Math.PI * f * x) * Math.exp(-x / (durS / 3)); }
  };
  if (spec.added.includes('fine-crackles')) for (let k = 0; k < 14; k++) click(spec.ti * (0.55 + 0.42 * Math.abs(rnd())), 900 + 400 * Math.abs(rnd()), 0.006, 0.55);
  if (spec.added.includes('coarse-crackles')) {
    for (let k = 0; k < 7; k++) click(spec.ti * 0.35 * Math.abs(rnd()), 280 + 120 * Math.abs(rnd()), 0.018, 0.7);
    for (let k = 0; k < 4; k++) click(spec.ti + (T - spec.ti) * 0.3 * Math.abs(rnd()), 260, 0.02, 0.5);
  }
  if (spec.added.includes('wheeze')) {
    for (let i = Math.round(spec.ti * sr); i < n; i++) {
      const t = i / sr, f = -breathFlow(spec, t);
      out[i] += 0.32 * Math.max(0, f) * (Math.sin(2 * Math.PI * 420 * t) + 0.4 * Math.sin(2 * Math.PI * 630 * t + 1));
    }
  }
  return out;
}

/** Play a buffer on a loop until stop() is called. */
export function playLoop(make: (sr: number) => Float32Array, gain = 0.8): (() => void) | null {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  const ac: AudioContext = new AC();
  const data = make(ac.sampleRate);
  const buf = ac.createBuffer(1, data.length, ac.sampleRate);
  buf.getChannelData(0).set(data);
  const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
  const g = ac.createGain(); g.gain.value = gain;
  src.connect(g).connect(ac.destination); src.start();
  return () => { try { src.stop(); ac.close(); } catch { /* stopped */ } };
}

/** A percussion note: the chest wall rings for as long as what lies beneath lets it. */
export const PERCUSSION_NOTE: Record<string, { f: number; decay: number; amp: number }> = {
  resonant: { f: 130, decay: 0.16, amp: 0.8 }, 'hyper-resonant': { f: 95, decay: 0.32, amp: 1 },
  dull: { f: 240, decay: 0.045, amp: 0.55 }, 'stony-dull': { f: 320, decay: 0.018, amp: 0.4 },
};
export function synthPercussion(sr: number, note: string): Float32Array {
  const p = PERCUSSION_NOTE[note] ?? PERCUSSION_NOTE.resonant;
  const n = Math.round(1.2 * sr), out = new Float32Array(n);
  let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // the tap itself (a click of noise) then the ring of the wall and the air beneath
    out[i] = (t < 0.008 ? rnd() * (1 - t / 0.008) * 0.6 : 0) + p.amp * Math.sin(2 * Math.PI * p.f * t) * Math.exp(-t / p.decay) * (1 - Math.exp(-t * 300));
  }
  return out;
}
