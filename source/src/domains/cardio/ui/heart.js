import { fit, palette, label, sans, withAlpha, roundRect } from '../../../core/ui/draw.js';

/* ---------------------------------------------------------------------------
   The circulation, drawn as the ring it is.

   Right heart on the left of the frame, left heart in the middle, the lungs
   across the top and the body down the right — so the blood goes round and
   comes back, which is the one thing a left-ventricle-only diagram can never
   show. Chamber size tracks volume, wall brightness tracks pressure, valve
   leaflets swing on the real valve state, and the particles move at a speed
   proportional to actual flow.
--------------------------------------------------------------------------- */
export class HeartView {
  constructor(canvas) {
    this.canvas = canvas;
    this.particles = Array.from({ length: 44 }, (_, i) => ({ seg: i % 6, t: (i % 8) / 8 }));
    this.last = performance.now();
  }

  box(w, h) {
    const ASPECT = 1.42;
    let bw = w * 0.96, bh = bw / ASPECT;
    if (bh > h * 0.96) { bh = h * 0.96; bw = bh * ASPECT; }
    return { bx: (w - bw) / 2, by: (h - bh) / 2, bw, bh };
  }

  draw(s) {
    const g = fit(this.canvas);
    if (!g || !s) return;
    const { ctx, w, h } = g;
    const p = palette();
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    const B = this.box(w, h);
    const X = (f) => B.bx + f * B.bw;
    const Y = (f) => B.by + f * B.bh;
    const S = Math.min(B.bw / 520, B.bh / 366);

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const sz = (V, lo, span, base, grow) => {
      const k = Math.max(0, Math.min(1, (V - lo) / span));
      return base + k * grow;
    };

    // --- chamber geometry --------------------------------------------------
    const ra = { x: X(0.150), y: Y(0.300),
      rx: B.bw * sz(s.Vra ?? 50, 15, 70, 0.048, 0.020),
      ry: B.bh * sz(s.Vra ?? 50, 15, 70, 0.062, 0.026) };
    const rv = { x: X(0.196), y: Y(0.640),
      rx: B.bw * sz(s.Vrv ?? 130, 30, 150, 0.062, 0.028),
      ry: B.bh * sz(s.Vrv ?? 130, 30, 150, 0.105, 0.045) };
    const la = { x: X(0.452), y: Y(0.300),
      rx: B.bw * sz(s.Vla ?? 50, 15, 70, 0.048, 0.020),
      ry: B.bh * sz(s.Vla ?? 50, 15, 70, 0.062, 0.026) };
    const lv = { x: X(0.500), y: Y(0.650),
      rx: B.bw * sz(s.V ?? 120, 30, 150, 0.066, 0.030),
      ry: B.bh * sz(s.V ?? 120, 30, 150, 0.112, 0.050) };

    // --- the lungs ---------------------------------------------------------
    const lungY = Y(0.088);
    ctx.strokeStyle = withAlpha(p.flow, 0.30);
    ctx.lineWidth = (5 + Math.min(1, (s.Ppa ?? 15) / 45) * 5) * S;
    ctx.beginPath();
    ctx.moveTo(rv.x + rv.rx * 0.4, rv.y - rv.ry);           // RV outflow
    ctx.quadraticCurveTo(X(0.215), lungY, X(0.300), lungY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(X(0.300), lungY);
    ctx.quadraticCurveTo(X(0.410), lungY, la.x - la.rx * 0.2, la.y - la.ry);
    ctx.strokeStyle = withAlpha(p.la, 0.30);
    ctx.stroke();

    // capillary bed across the top
    ctx.strokeStyle = withAlpha(p.flow, 0.5); ctx.lineWidth = 1.4 * S;
    for (let i = 0; i < 7; i++) {
      const fx = 0.262 + i * 0.011;
      ctx.beginPath();
      ctx.moveTo(X(fx), lungY - 9 * S); ctx.lineTo(X(fx), lungY + 9 * S);
      ctx.stroke();
    }
    label(ctx, 'LUNGS', X(0.300), lungY - 17 * S, p.muted, 8.5 * S, 'center', '700');
    label(ctx, `PA ${Math.round(s.PpaMean ?? s.Ppa ?? 0)} mmHg`, X(0.196), lungY + 20 * S, p.flow, 9.5 * S, 'center', '600');

    // --- the body ----------------------------------------------------------
    const aoX = X(0.815), botY = Y(0.880);
    ctx.strokeStyle = withAlpha(p.aortic, 0.34 + Math.min(1, (s.P ?? 90) / 170) * 0.5);
    ctx.lineWidth = (6 + Math.min(1, (s.P ?? 90) / 170) * 5) * S;
    ctx.beginPath();
    ctx.moveTo(lv.x + lv.rx * 0.55, lv.y - lv.ry * 0.75);
    ctx.quadraticCurveTo(X(0.600), Y(0.185), X(0.700), Y(0.170));
    ctx.quadraticCurveTo(aoX, Y(0.170), aoX, Y(0.330));
    ctx.lineTo(aoX, Y(0.560));
    ctx.stroke();
    label(ctx, 'aorta', X(0.700), Y(0.140), p.muted, 8.5 * S, 'center');
    label(ctx, `${Math.round(s.P ?? 0)} mmHg`, aoX + 11 * S, Y(0.400), p.aortic, 10.5 * S, 'left', '700');

    // arterioles: the resistance gate
    const gateY = Y(0.640), gw = 30 * S, gh = 16 * S;
    const gate = Math.max(0.12, 1 - Math.min(1, ((s.Rsys ?? s.R ?? 1) - 0.2) / 2.6));
    roundRect(ctx, aoX - gw / 2, gateY - gh / 2, gw, gh, 4 * S);
    ctx.fillStyle = withAlpha(p.aortic, 0.10); ctx.fill();
    ctx.strokeStyle = withAlpha(p.aortic, 0.42); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = withAlpha(p.aortic, 0.55);
    ctx.fillRect(aoX - gw / 2 + 3 * S, gateY - (gh * gate) / 2, gw - 6 * S, gh * gate);
    label(ctx, 'arterioles', aoX + 20 * S, gateY, p.muted, 8.5 * S, 'left');

    // systemic veins — the reservoir, drawn fat because that is where the blood is
    ctx.strokeStyle = withAlpha(p.volume, 0.34);
    ctx.lineWidth = 11 * S;
    ctx.beginPath();
    ctx.moveTo(aoX, gateY + gh);
    ctx.lineTo(aoX, botY);
    ctx.lineTo(X(0.090), botY);
    ctx.lineTo(X(0.090), ra.y + ra.ry * 0.6);
    ctx.quadraticCurveTo(X(0.090), ra.y, ra.x - ra.rx * 0.85, ra.y + ra.ry * 0.25);
    ctx.stroke();
    label(ctx, 'systemic veins — the reservoir', X(0.450), botY + 15 * S, p.muted, 8.5 * S, 'center');
    label(ctx, `mean filling ${(s.Pmsf ?? 7).toFixed(1)} mmHg`, X(0.450), botY - 13 * S, p.volume, 9 * S, 'center', '600');

    // --- chambers ----------------------------------------------------------
    const act = Math.min(1, (s.ea ?? 0) * 3);
    this.chamber(ctx, ra, p.volume, (s.Pra ?? 3) / 20, act, 'RA', s.Pra, null, S, p);
    this.chamber(ctx, rv, p.flow, (s.Prv ?? 12) / 60, s.en ?? 0, 'RV', s.Prv, s.Vrv, S, p);
    this.chamber(ctx, la, p.la, (s.Pla ?? 6) / 26, act, 'LA', s.Pla, null, S, p);
    this.chamber(ctx, lv, p.lv, (s.Pv ?? 60) / 150, s.en ?? 0, 'LV', s.Pv, s.V, S, p);

    // --- valves ------------------------------------------------------------
    this.valve(ctx, ra.x + 4 * S, ra.y + ra.ry + 6 * S, 11 * S, s.tricuspidOpen, p.volume, S, 'down');
    this.valve(ctx, rv.x + rv.rx * 0.35, rv.y - rv.ry - 4 * S, 10 * S, s.pulmonicOpen, p.flow, S, 'right');
    this.valve(ctx, la.x + 4 * S, la.y + la.ry + 6 * S, 11 * S, s.mitralOpen, p.la, S, 'down');
    this.valve(ctx, lv.x + lv.rx * 0.5, lv.y - lv.ry - 4 * S, 10 * S, s.aorticOpen, p.aortic, S, 'right');

    // --- flow particles ----------------------------------------------------
    const paths = [
      { a: [ra.x, ra.y + ra.ry], b: [rv.x, rv.y - rv.ry * 0.4], q: s.Qtri ?? 0, c: p.volume, cap: 460 },
      { a: [rv.x + rv.rx * 0.4, rv.y - rv.ry], b: [X(0.300), lungY], q: s.Qpulv ?? 0, c: p.flow, cap: 460 },
      { a: [X(0.300), lungY], b: [la.x - la.rx * 0.2, la.y - la.ry], q: s.Qpv ?? 0, c: p.la, cap: 300 },
      { a: [la.x, la.y + la.ry], b: [lv.x, lv.y - lv.ry * 0.4], q: s.Qfill ?? 0, c: p.la, cap: 460 },
      { a: [lv.x + lv.rx * 0.55, lv.y - lv.ry * 0.75], b: [X(0.700), Y(0.170)], q: s.Qeject ?? 0, c: p.aortic, cap: 460 },
      { a: [aoX, botY], b: [X(0.120), botY], q: s.Qven ?? 0, c: p.volume, cap: 160 },
    ];
    for (const part of this.particles) {
      const pa = paths[part.seg];
      const speed = Math.min(2.6, Math.abs(pa.q) / pa.cap);
      part.t += dt * (0.18 + speed * 2.1);
      if (part.t > 1) part.t -= 1;
      if (speed < 0.015) continue;
      const x = pa.a[0] + (pa.b[0] - pa.a[0]) * part.t;
      const y = pa.a[1] + (pa.b[1] - pa.a[1]) * part.t;
      ctx.fillStyle = withAlpha(pa.c, 0.25 + Math.min(0.6, speed * 0.5));
      ctx.beginPath(); ctx.arc(x, y, 2.1 * S, 0, Math.PI * 2); ctx.fill();
    }

    // --- caption -----------------------------------------------------------
    const phase = s.aorticOpen ? ['Ejection', p.aortic]
      : s.mitralOpen ? ['Filling', p.la]
      : (s.en ?? 0) > 0.02 ? ['Isovolumic contraction', p.lv]
      : ['Isovolumic relaxation', p.flow];
    label(ctx, phase[0].toUpperCase(), B.bx + 2, B.by + 4, withAlpha(phase[1], 0.95), 9.5 * S, 'left', '700');
    label(ctx, `${Math.round(s.totalVolume ?? 5000)} mL in the loop`,
      B.bx + B.bw - 2, B.by + 4, p.muted, 9 * S, 'right', '600');
  }

  chamber(ctx, c, color, fill, act, name, P, V, S, p) {
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(color, 0.10 + Math.max(0, Math.min(1, fill)) * 0.32); ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.45 + Math.max(0, Math.min(1, act)) * 0.55);
    ctx.lineWidth = (1.6 + Math.max(0, Math.min(1, act)) * 3.6) * S; ctx.stroke();
    sans(ctx, name, c.x, c.y - (V != null ? 15 : 7) * S, p.text2, 11 * S, 'center');
    label(ctx, `${Math.round(P ?? 0)} mmHg`, c.x, c.y + (V != null ? -1 : 6) * S, color, 10 * S, 'center', '700');
    if (V != null) label(ctx, `${Math.round(V)} mL`, c.x, c.y + 12 * S, p.volume, 9.5 * S, 'center', '600');
  }

  valve(ctx, x, y, len, open, color, S, dir) {
    ctx.lineWidth = 2.1 * S; ctx.lineCap = 'round';
    ctx.strokeStyle = open ? withAlpha(color, 0.5) : color;
    const spread = open ? 0.62 : 0.06;
    ctx.beginPath();
    if (dir === 'down') {
      ctx.moveTo(x - len, y); ctx.lineTo(x - len * spread * 0.5, y + len * (open ? 0.9 : 0.12));
      ctx.moveTo(x + len, y); ctx.lineTo(x + len * spread * 0.5, y + len * (open ? 0.9 : 0.12));
    } else {
      ctx.moveTo(x, y - len); ctx.lineTo(x + len * (open ? 0.9 : 0.12), y - len * spread * 0.5);
      ctx.moveTo(x, y + len); ctx.lineTo(x + len * (open ? 0.9 : 0.12), y + len * spread * 0.5);
    }
    ctx.stroke();
  }
}
