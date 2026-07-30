import { fit, line, dashed, label, sans, palette, withAlpha } from '../../../core/ui/draw.js';

export class PVLoop {
  constructor(canvas) {
    this.canvas = canvas;
    this.beat = null;
    this.ghost = null;
    this.cursorIndex = null;   // index into the *unrotated* beat
    this.showFrames = true;
  }

  push(snap) {
    if (snap.beat && snap.beat.samples.length > 30) {
      this.beat = snap.beat;
      this.params = { Emax: snap.Emax, V0: snap.V0, edpA: snap.edpA, edpB: snap.edpB };
      this.metrics = snap.metrics;
    }
  }

  captureGhost() {
    if (this.beat) this.ghost = { samples: this.beat.samples.map((s) => ({ V: s.V, Pv: s.Pv })), metrics: this.metrics };
  }
  clearGhost() { this.ghost = null; }

  draw() {
    const g = fit(this.canvas);
    if (!g || !this.beat) return;
    const { ctx, w, h } = g;
    const p = palette();
    const S = this.beat.samples;
    const { Emax, V0, edpA, edpB } = this.params;

    const padL = 42, padR = 16, padT = 14, padB = 30;
    const px = padL, py = padT, pw = w - padL - padR, ph = h - padT - padB;

    // Scale: always include V0 and the whole loop, with headroom.
    let vlo = V0, vhi = 40, plo = 0, phi = 40;
    for (const s of S) { vhi = Math.max(vhi, s.V); phi = Math.max(phi, s.Pv); }
    if (this.ghost) for (const s of this.ghost.samples) { vhi = Math.max(vhi, s.V); phi = Math.max(phi, s.Pv); }
    vhi = Math.ceil((vhi * 1.1) / 25) * 25;
    phi = Math.ceil((phi * 1.15) / 25) * 25;
    vlo = 0;

    const X = (v) => px + ((v - vlo) / (vhi - vlo)) * pw;
    const Y = (q) => py + ph - ((q - plo) / (phi - plo)) * ph;

    // --- frame ------------------------------------------------------------
    ctx.strokeStyle = p.hairline; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + ph + 0.5); ctx.lineTo(px + pw, py + ph + 0.5);
    ctx.stroke();
    for (let q = 0; q <= phi; q += 50) {
      ctx.strokeStyle = p.hairline2;
      ctx.beginPath(); ctx.moveTo(px, Y(q) + 0.5); ctx.lineTo(px + pw, Y(q) + 0.5); ctx.stroke();
      label(ctx, String(q), px - 6, Y(q), p.muted, 9, 'right');
    }
    for (let v = 0; v <= vhi; v += 50) {
      ctx.strokeStyle = p.hairline2;
      ctx.beginPath(); ctx.moveTo(X(v) + 0.5, py); ctx.lineTo(X(v) + 0.5, py + ph); ctx.stroke();
      label(ctx, String(v), X(v), py + ph + 11, p.muted, 9, 'center');
    }
    label(ctx, 'mmHg', px - 6, py - 2, p.muted, 8.5, 'right');
    label(ctx, 'volume  mL', px + pw, py + ph + 22, p.muted, 8.5, 'right');

    // --- ESPVR: contractility ---------------------------------------------
    const espvrV = Math.min(vhi, V0 + phi / Emax);
    dashed(ctx, [[X(V0), Y(0)], [X(espvrV), Y(Emax * (espvrV - V0))]], withAlpha(p.lv, 0.75), 1.3, [5, 4]);
    {
      const lx = X(espvrV), ly = Y(Emax * (espvrV - V0));
      label(ctx, 'ESPVR', lx - 4, ly + 9, withAlpha(p.lv, 0.9), 9, 'right', '600');
    }

    // --- EDPVR: passive filling -------------------------------------------
    const ed = [];
    for (let v = V0; v <= vhi; v += 2) {
      const q = edpA * (Math.exp(edpB * (v - V0)) - 1);
      if (q > phi) break;
      ed.push([X(v), Y(q)]);
    }
    dashed(ctx, ed, withAlpha(p.la, 0.7), 1.3, [5, 4]);
    if (ed.length) label(ctx, 'EDPVR', ed[ed.length - 1][0] - 4, ed[ed.length - 1][1] - 8, withAlpha(p.la, 0.9), 9, 'right', '600');

    // --- ghost loop --------------------------------------------------------
    if (this.ghost) {
      const pts = this.ghost.samples.map((s) => [X(s.V), Y(s.Pv)]);
      pts.push(pts[0]);
      line(ctx, pts, withAlpha(p.muted, 0.5), 1.2);
    }

    // --- stroke work -------------------------------------------------------
    const pts = S.map((s) => [X(s.V), Y(s.Pv)]);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fillStyle = withAlpha(p.lv, 0.10);
    ctx.fill();

    // --- arterial elastance ------------------------------------------------
    const m = this.metrics;
    if (m && m.SV > 0) {
      dashed(ctx, [[X(m.EDV), Y(0)], [X(m.ESV), Y(m.Pes)]], withAlpha(p.aortic, 0.6), 1.2, [3, 3]);
      label(ctx, 'Ea', X((m.EDV + m.ESV) / 2) + 14, Y(m.Pes / 2) - 4, withAlpha(p.aortic, 0.85), 9, 'left', '600');
    }

    // --- the loop ----------------------------------------------------------
    const closed = pts.concat([pts[0]]);
    line(ctx, closed, p.lv, 2);

    // --- corners -----------------------------------------------------------
    const ev = this.beat.events;
    const corner = (i, text, dx, dy, align) => {
      if (i == null || !S[i]) return;
      const s = S[i];
      ctx.fillStyle = p.text;
      ctx.beginPath(); ctx.arc(X(s.V), Y(s.Pv), 2.6, 0, Math.PI * 2); ctx.fill();
      label(ctx, text, X(s.V) + dx, Y(s.Pv) + dy, p.text2, 8.5, align, '600');
    };
    if (this.showFrames) {
      corner(ev.avo, 'AVO', 6, -7, 'left');
      corner(ev.avc, 'AVC', -6, -7, 'right');
      corner(ev.mvo, 'MVO', -6, 8, 'right');
      corner(ev.s1, 'MVC', 6, 8, 'left');
    }

    // --- direction arrow ---------------------------------------------------
    if (S.length > 20) {
      const i = Math.floor(S.length * 0.55);
      const a = S[i], b = S[Math.min(S.length - 1, i + 6)];
      const ang = Math.atan2(Y(b.Pv) - Y(a.Pv), X(b.V) - X(a.V));
      ctx.save();
      ctx.translate(X(a.V), Y(a.Pv)); ctx.rotate(ang);
      ctx.fillStyle = p.lv;
      ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, 3.6); ctx.lineTo(-4, -3.6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // --- cursor ------------------------------------------------------------
    if (this.cursorIndex != null && S[this.cursorIndex]) {
      const s = S[this.cursorIndex];
      ctx.strokeStyle = withAlpha(p.text, 0.35); ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, Y(s.Pv) + 0.5); ctx.lineTo(X(s.V), Y(s.Pv) + 0.5);
      ctx.moveTo(X(s.V) + 0.5, py + ph); ctx.lineTo(X(s.V) + 0.5, Y(s.Pv));
      ctx.stroke();
      ctx.fillStyle = p.text;
      ctx.beginPath(); ctx.arc(X(s.V), Y(s.Pv), 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = p.panel; ctx.lineWidth = 2; ctx.stroke();
      label(ctx, `${Math.round(s.V)} mL · ${Math.round(s.Pv)} mmHg`, X(s.V) + 8, Y(s.Pv) - 10, p.text, 9, 'left', '600');
    }

    // --- coupling readout ---------------------------------------------------
    if (m && m.SV > 0) {
      const ratio = m.Ea / m.Ees;
      label(ctx, `Ea/Ees ${ratio.toFixed(2)}`, px + pw - 2, py + 8, p.muted, 9, 'right');
    }
  }
}
