import { fit, paper, line, label, sans, palette, withAlpha, rotateBeat } from '../../../core/ui/draw.js';

const PHASE_COLOR = { ivc: 'lv', eject: 'aortic', ivr: 'flow', fill: 'la' };
const PHASE_NAME = { ivc: 'Isovolumic contraction', eject: 'Ejection', ivr: 'Isovolumic relaxation', fill: 'Filling' };

/* Walk one beat and label every sample with the phase it belongs to. */
function classify(samples) {
  const out = new Array(samples.length);
  let st = 'fill';
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.Qao > 1) st = 'eject';
    else if (s.Qmit > 1) st = 'fill';
    else if (st === 'eject') st = 'ivr';
    else if (st === 'fill' && s.en > 0.02) st = 'ivc';
    out[i] = st;
  }
  return out;
}

export class Wiggers {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.onCursor = opts.onCursor || (() => {});
    this.beat = null;
    this.rot = null;
    this.phases = null;
    this.cursor = null;       // 0..1 across the rotated beat, or null for live
    this.hoverX = null;
    this.dragging = false;
    this.showGhost = false;
    this.ghost = null;
    this.geom = null;

    const move = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX ?? (e.touches && e.touches[0].clientX)) - r.left;
      this.hoverX = x;
      if (!this.dragging || !this.geom) return;
      const { px, pw } = this.geom;
      const f = Math.max(0, Math.min(1, (x - px) / pw));
      this.cursor = f;
      this.onCursor(f);
      e.preventDefault();
    };
    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      canvas.setPointerCapture?.(e.pointerId);
      move(e);
    });
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('pointercancel', () => { this.dragging = false; });
    canvas.addEventListener('pointerleave', () => { this.hoverX = null; });
    canvas.addEventListener('dblclick', () => { this.release(); });
  }

  release() { this.cursor = null; this.onCursor(null); }

  push(snap) {
    if (snap.beat && snap.beat.samples.length > 30) {
      this.beat = snap.beat;
      this.rot = rotateBeat(this.beat.samples, 0.22);
      this.phases = classify(this.beat.samples);
      const n = this.beat.samples.length;
      const cut = Math.floor(n * 0.78);
      this.rotPhases = this.phases.slice(cut).concat(this.phases.slice(0, cut));
    }
  }

  captureGhost() { if (this.rot) this.ghost = { rot: this.rot.map((s) => ({ ...s })) }; }
  clearGhost() { this.ghost = null; }

  /* The sample the cursor is currently over, for every other panel to use. */
  cursorSample() {
    if (!this.rot || this.cursor == null) return null;
    const i = Math.min(this.rot.length - 1, Math.max(0, Math.round(this.cursor * (this.rot.length - 1))));
    return { sample: this.rot[i], phase: this.rotPhases[i], index: i };
  }

  currentPhase(live) {
    const c = this.cursorSample();
    if (c) return c.phase;
    if (!live) return null;
    if (live.aorticOpen) return 'eject';
    if (live.mitralOpen) return 'fill';
    return live.en > 0.02 ? 'ivc' : 'ivr';
  }

  draw(live) {
    const g = fit(this.canvas);
    if (!g || !this.rot) return;
    const { ctx, w, h } = g;
    const p = palette();
    const rot = this.rot;
    const n = rot.length;

    const padL = 46, padR = 12, padT = 16, padB = 20;
    const px = padL, pw = w - padL - padR;
    const py = padT, ph = h - padT - padB;
    this.geom = { px, pw, py, ph };

    // Row layout: pressures get the most space, then volume, flow, ECG.
    const gap = 6;
    const rows = [
      { key: 'press', weight: 0.42 },
      { key: 'vol', weight: 0.20 },
      { key: 'flow', weight: 0.14 },
      { key: 'ecg', weight: 0.24 },
    ];
    let acc = 0;
    const totalGap = gap * (rows.length - 1);
    for (const r of rows) {
      r.y = py + acc;
      r.h = (ph - totalGap) * r.weight;
      acc += r.h + gap;
    }

    // ECG paper behind everything.
    paper(ctx, px, py, pw, ph, Math.max(5, pw / 46));

    const X = (i) => px + (i / (n - 1)) * pw;

    // --- phase bands --------------------------------------------------------
    let runStart = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || this.rotPhases[i] !== this.rotPhases[runStart]) {
        const id = this.rotPhases[runStart];
        const x0 = X(runStart), x1 = X(i - 1);
        ctx.fillStyle = withAlpha(p[PHASE_COLOR[id]], 0.07);
        ctx.fillRect(x0, py, Math.max(1, x1 - x0), ph);
        if (x1 - x0 > 44) {
          label(ctx, PHASE_NAME[id].length > 14 && x1 - x0 < 110 ? id.toUpperCase() : PHASE_NAME[id],
            (x0 + x1) / 2, py + 7, withAlpha(p[PHASE_COLOR[id]], 0.85), 9, 'center', '600');
        }
        runStart = i;
      }
    }

    // --- row 1: pressures ---------------------------------------------------
    const r0 = rows[0];
    let pmax = 10;
    for (const s of rot) pmax = Math.max(pmax, s.Pa, s.Pv);
    pmax = Math.ceil((pmax * 1.08) / 20) * 20;
    const PY = (v) => r0.y + r0.h - (v / pmax) * r0.h;

    ctx.save(); ctx.beginPath(); ctx.rect(px, r0.y - 2, pw, r0.h + 4); ctx.clip();
    for (let v = 0; v <= pmax; v += pmax / 4) {
      ctx.strokeStyle = p.hairline2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, PY(v) + 0.5); ctx.lineTo(px + pw, PY(v) + 0.5); ctx.stroke();
      label(ctx, String(Math.round(v)), px - 6, PY(v), p.muted, 9, 'right');
    }
    if (this.ghost) {
      line(ctx, this.ghost.rot.map((s, i) => [X(i), PY(s.Pa)]), withAlpha(p.aortic, 0.28), 1.2);
      line(ctx, this.ghost.rot.map((s, i) => [X(i), PY(s.Pv)]), withAlpha(p.lv, 0.28), 1.2);
    }
    line(ctx, rot.map((s, i) => [X(i), PY(s.Pla)]), p.la, 1.5);
    line(ctx, rot.map((s, i) => [X(i), PY(s.Pv)]), p.lv, 1.9);
    line(ctx, rot.map((s, i) => [X(i), PY(s.Pa)]), p.aortic, 1.9);
    ctx.restore();
    label(ctx, 'mmHg', px - 6, r0.y - 4, p.muted, 8.5, 'right');

    // --- row 2: volume ------------------------------------------------------
    const r1 = rows[1];
    let vmin = Infinity, vmax = -Infinity;
    for (const s of rot) { vmin = Math.min(vmin, s.V); vmax = Math.max(vmax, s.V); }
    const vpad = Math.max(6, (vmax - vmin) * 0.22);
    const v0 = vmin - vpad, v1 = vmax + vpad;
    const VY = (v) => r1.y + r1.h - ((v - v0) / (v1 - v0)) * r1.h;
    ctx.save(); ctx.beginPath(); ctx.rect(px, r1.y - 2, pw, r1.h + 4); ctx.clip();
    if (this.ghost) line(ctx, this.ghost.rot.map((s, i) => [X(i), VY(s.V)]), withAlpha(p.volume, 0.28), 1.2);
    line(ctx, rot.map((s, i) => [X(i), VY(s.V)]), p.volume, 1.9);
    ctx.restore();
    label(ctx, `${Math.round(vmax)}`, px - 6, VY(vmax), p.muted, 9, 'right');
    label(ctx, `${Math.round(vmin)}`, px - 6, VY(vmin), p.muted, 9, 'right');
    label(ctx, 'mL', px - 6, r1.y - 3, p.muted, 8.5, 'right');

    // --- row 3: aortic flow -------------------------------------------------
    const r2 = rows[2];
    let qmax = 50;
    for (const s of rot) qmax = Math.max(qmax, s.Qao);
    const QY = (v) => r2.y + r2.h - (v / qmax) * r2.h;
    ctx.save(); ctx.beginPath(); ctx.rect(px, r2.y - 1, pw, r2.h + 2); ctx.clip();
    ctx.beginPath();
    ctx.moveTo(X(0), QY(0));
    for (let i = 0; i < n; i++) ctx.lineTo(X(i), QY(rot[i].Qao));
    ctx.lineTo(X(n - 1), QY(0)); ctx.closePath();
    ctx.fillStyle = withAlpha(p.flow, 0.22); ctx.fill();
    line(ctx, rot.map((s, i) => [X(i), QY(s.Qao)]), p.flow, 1.4);
    ctx.restore();
    label(ctx, 'mL/s', px - 6, r2.y - 2, p.muted, 8.5, 'right');
    label(ctx, String(Math.round(qmax)), px - 6, QY(qmax) + 4, p.muted, 9, 'right');

    // --- row 4: ECG ---------------------------------------------------------
    const r3 = rows[3];
    let emin = -0.4, emax = 1.2;
    for (const s of rot) { emin = Math.min(emin, s.ecg); emax = Math.max(emax, s.ecg); }
    const EY = (v) => r3.y + r3.h - ((v - emin) / (emax - emin || 1)) * r3.h;
    ctx.save(); ctx.beginPath(); ctx.rect(px, r3.y - 1, pw, r3.h + 2); ctx.clip();
    line(ctx, rot.map((s, i) => [X(i), EY(s.ecg)]), p.ecg, 1.6);
    ctx.restore();
    label(ctx, 'II', px - 6, r3.y + r3.h / 2, p.muted, 9, 'right');

    // --- valve events -------------------------------------------------------
    const cut = Math.floor(this.beat.samples.length * 0.78);
    const remap = (i) => (i == null ? null : (i - cut + this.beat.samples.length) % this.beat.samples.length);
    const ev = this.beat.events;
    const marks = [
      { i: remap(ev.s1), text: 'S1', sub: 'mitral shuts', c: p.lv },
      { i: remap(ev.avo), text: 'AVO', sub: 'ejection', c: p.aortic },
      { i: remap(ev.avc), text: 'S2', sub: 'aortic shuts', c: p.aortic },
      { i: remap(ev.mvo), text: 'MVO', sub: 'filling', c: p.la },
    ].filter((m) => m.i != null);

    for (const m of marks) {
      const x = X(m.i);
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = withAlpha(m.c, 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 0.5, py); ctx.lineTo(x + 0.5, py + ph); ctx.stroke();
      ctx.restore();
      const boxW = ctx.measureText(m.text).width;
      label(ctx, m.text, x + 3, py + ph - 6, m.c, 9, 'left', '700');
    }

    // --- cursor -------------------------------------------------------------
    const cs = this.cursorSample();
    if (cs) {
      const x = X(cs.index);
      ctx.strokeStyle = p.text; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 0.5, py); ctx.lineTo(x + 0.5, py + ph); ctx.stroke();
      const s = cs.sample;
      const dots = [[PY(s.Pa), p.aortic], [PY(s.Pv), p.lv], [PY(s.Pla), p.la], [VY(s.V), p.volume], [EY(s.ecg), p.ecg]];
      for (const [yy, cc] of dots) {
        ctx.fillStyle = cc; ctx.beginPath(); ctx.arc(x, yy, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = p.panel; ctx.lineWidth = 1.5; ctx.stroke();
      }
      const t = ((cs.index / (n - 1)) * this.beat.dur - this.beat.dur * 0.22 + this.beat.dur) % this.beat.dur;
      label(ctx, `${Math.round(t)} ms`, x + 5, py + 7, p.text, 9, 'left', '600');
    } else if (live) {
      // Live mode: a moving tick showing where in the cycle we are.
      const frac = live.beat ? null : null;
      label(ctx, 'live', px + pw - 4, py + 7, withAlpha(p.rose, 0.9), 9, 'right', '600');
    }

    // baseline time axis
    label(ctx, '0', px, py + ph + 9, p.muted, 9, 'center');
    label(ctx, `${Math.round(this.beat.dur)} ms`, px + pw, py + ph + 9, p.muted, 9, 'right');
  }
}
