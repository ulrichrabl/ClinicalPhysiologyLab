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
