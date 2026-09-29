/* ---------------------------------------------------------------------------
   Auscultation audio.

   Heart sounds are synthesised from the model's own last beat, not played
   from recordings:

     S1   at mitral valve closure       (beat.events.mvc)
     S2   at aortic valve closure       (beat.events.avc), A2 then P2
     AS   noise shaped by forward aortic flow × gradient
     MR   noise shaped by reverse mitral flow
     AR   noise shaped by reverse aortic flow
     MS   low rumble shaped by forward mitral flow through a stiff valve

   So a murmur's timing and shape are the flow's timing and shape. A beat is
   rebuilt from the latest snapshot every time one is scheduled, which means a
   changing heart rate or a worsening lesion is heard as it happens.

   `synthBeat` is pure (Float32Array out) so it can be tested headless.
--------------------------------------------------------------------------- */

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
}

/** Two-pole band-pass, applied in place. */
function bandpass(x, fs, f0, q) {
  const w = 2 * Math.PI * f0 / fs; const alpha = Math.sin(w) / (2 * q);
  const b0 = alpha; const b2 = -alpha; const a0 = 1 + alpha; const a1 = -2 * Math.cos(w); const a2 = 1 - alpha;
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}

function thump(out, fs, tSec, { freq = 50, decay = 0.03, amp = 1, dur = 0.09 }) {
  const i0 = Math.floor(tSec * fs); const n = Math.floor(dur * fs);
  for (let k = 0; k < n && i0 + k < out.length; k++) {
    if (i0 + k < 0) continue;
    const t = k / fs;
    const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / decay);
    out[i0 + k] += amp * env * (Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(2 * Math.PI * freq * 1.9 * t));
  }
}

/** Resample a per-sample envelope (model samples every ~2.5 ms) onto the audio grid. */
function envelopeFrom(samples, dtMs, fs, len, fn) {
  const env = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const tMs = (i / fs) * 1000;
    const j = Math.min(samples.length - 1, Math.floor(tMs / dtMs));
    env[i] = fn(samples[j]) || 0;
  }
  return env;
}

/**
 * One beat of heart sound at a given chest area.
 * @param beat   { samples, events, dur } from the circulation snapshot
 * @param spec   { area, murmurs: [{id, w, grade}], extras: {s3, s4, softS1, softA2, loudP2}, gradient }
 */
export function synthBeat(beat, spec, fs = 22050, seed = 7) {
  const samples = beat?.samples || [];
  const durMs = beat?.dur || 800;
  const len = Math.max(1, Math.floor((durMs / 1000) * fs));
  const out = new Float32Array(len);
  if (samples.length < 4) return out;
  const dtMs = durMs / samples.length;
  const ev = beat.events || {};
  const at = (idx) => (idx == null ? null : (idx * dtMs) / 1000);
  const x = spec.extras || {};
  const area = spec.area;
  const near = (a) => (a === area ? 1 : 0.55);

  // S1: mitral (and tricuspid) closure. Louder at the apex.
  const tS1 = at(ev.mvc) ?? at(ev.s1) ?? 0.02;
  thump(out, fs, tS1, { freq: 48, decay: 0.028, amp: (x.softS1 ? 0.45 : 0.9) * (area === 'mitral' || area === 'tricuspid' ? 1 : 0.7) });
  // S2: A2 then P2. Louder at the base.
  const tS2 = at(ev.avc);
  if (tS2 != null) {
    const a2 = x.softA2 ? 0.2 : 0.75;
    thump(out, fs, tS2, { freq: 70, decay: 0.022, amp: a2 * (area === 'aortic' || area === 'pulmonary' ? 1 : 0.65) });
    thump(out, fs, tS2 + 0.028, { freq: 64, decay: 0.02, amp: (x.loudP2 ? 0.7 : 0.35) * near('pulmonary') });
  }
  // S3: early rapid filling, ~150 ms after mitral opening.
  if (x.s3 && ev.mvo != null) thump(out, fs, at(ev.mvo) + 0.14, { freq: 28, decay: 0.035, amp: 0.45 * near('mitral') });
  // S4: atrial kick, just before the next S1.
  if (x.s4) thump(out, fs, durMs / 1000 - 0.07, { freq: 25, decay: 0.03, amp: 0.4 * near('mitral') });

  // Murmurs: white noise × flow envelope, then band-limited.
  const noise = rng(seed);
  for (const m of spec.murmurs || []) {
    let env; let f0; let q;
    if (m.id === 'as' || m.id === 'flow') {
      const g = Math.max(0.3, Math.min(1.5, (spec.gradient || 20) / 60));
      env = envelopeFrom(samples, dtMs, fs, len, (s) => Math.max(0, s.Qao) / 500 * g);
      f0 = 260; q = 1.1;
    } else if (m.id === 'mr' || m.id === 'tr') {
      /* Reverse flow from the model; tricuspid flow is not sampled per beat,
         so TR borrows the systolic window at a fixed intensity. */
      env = m.id === 'mr'
        ? envelopeFrom(samples, dtMs, fs, len, (s) => Math.max(0, -s.Qmit) / 60)
        : envelopeFrom(samples, dtMs, fs, len, (s) => (s.Pv > s.Pla + 5 ? 0.6 : 0));
      f0 = 320; q = 1.3;
    } else if (m.id === 'ar') {
      env = envelopeFrom(samples, dtMs, fs, len, (s) => Math.max(0, -s.Qao) / 60);
      f0 = 480; q = 1.6;
    } else if (m.id === 'ms') {
      env = envelopeFrom(samples, dtMs, fs, len, (s) => Math.max(0, s.Qmit) / 450);
      f0 = 90; q = 2;
    } else continue;
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) buf[i] = noise() * Math.min(1.4, env[i]);
    bandpass(buf, fs, f0, q);
    bandpass(buf, fs, f0 * 1.2, q);
    const gain = 0.9 * m.w * (0.35 + 0.18 * (m.grade || 2));
    for (let i = 0; i < len; i++) out[i] += buf[i] * gain * 6;
  }

  // Normalise gently so murmurs never clip the transients.
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.95) { const k = 0.95 / peak; for (let i = 0; i < len; i++) out[i] *= k; }
  return out;
}

/** One breath of lung sound (inspiration + expiration), optionally with crackles. */
export function synthBreath({ rr = 14, crackles = 0, weak = false }, fs = 22050, seed = 11) {
  const dur = 60 / Math.max(6, rr);
  const len = Math.floor(dur * fs);
  const out = new Float32Array(len);
  const noise = rng(seed);
  const ti = dur * 0.4;
  for (let i = 0; i < len; i++) {
    const t = i / fs;
    const env = t < ti ? Math.sin((Math.PI / 2) * (t / ti)) : Math.max(0, 1 - (t - ti) / (dur * 0.35)) * 0.35;
    out[i] = noise() * env * (weak ? 0.35 : 0.8);
  }
  bandpass(out, fs, 300, 0.7);
  if (crackles > 0) {
    const n = Math.round(6 + crackles * 10);
    for (let k = 0; k < n; k++) {
      const t = ti * (0.55 + 0.45 * ((k + 0.5) / n)) + noise() * 0.01;
      const i0 = Math.floor(t * fs);
      for (let j = 0; j < fs * 0.006 && i0 + j < len; j++) {
        out[i0 + j] += Math.exp(-j / (fs * 0.0012)) * Math.sin(j * 0.9) * 0.9;
      }
    }
  }
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.9) { const k = 0.9 / peak; for (let i = 0; i < len; i++) out[i] *= k; }
  return out;
}

/* ---- live player ------------------------------------------------------------
   Schedules one beat (or breath) ahead, each rebuilt from the latest model
   state, so the sound tracks the simulation. */
export class Stethoscope {
  constructor() { this.ctx = null; this.timer = null; this.onBuffer = null; this.volume = 0.9; }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.volume;
    // A gentle low-pass: a stethoscope is not a hi-fi microphone.
    this.lp = this.ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 1100;
    this.lp.connect(this.gain); this.gain.connect(this.ctx.destination);
    return this.ctx;
  }

  /** make(fs) → Float32Array; called once per scheduled cycle. */
  start(make) {
    this.stop();
    const ctx = this.ensure();
    this.make = make;
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume?.();
    this.fs = ctx.sampleRate;
    let next = ctx.currentTime + 0.08;
    const tick = () => {
      while (next < ctx.currentTime + 0.35) {
        const data = this.make(this.fs);
        if (!data || !data.length) { next += 0.5; continue; }
        const buf = ctx.createBuffer(1, data.length, this.fs);
        if (buf.copyToChannel) buf.copyToChannel(data, 0); else buf.getChannelData(0).set(data);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.connect(this.lp); src.start(next);
        next += data.length / this.fs;
        this.onBuffer?.(data, this.fs);
      }
    };
    tick();
    this.timer = setInterval(tick, 90);
    return true;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setVolume(v) { this.volume = v; if (this.gain) this.gain.gain.value = v; }
}
