/* ===========================================================================
   A spirometry printout: the flow–volume loop and the volume–time curve of a
   forced expiration from total lung capacity, against the predicted normal,
   as the spirometer draws them. The curves are the respiratory model's own
   forced expiration (flow limited by elastic recoil over airway resistance).
=========================================================================== */

export interface SpiroCurve { t: number[]; vol: number[]; flow: number[]; FEV1: number; FVC: number; PEF: number }
export interface SpiroPred { FVC: number; FEV1: number; PEF: number }

export function drawSpirogram(canvas: HTMLCanvasElement, c: SpiroCurve, pred: SpiroPred, lang: 'en' | 'de', colors: { fg: string; muted: string; line: string; accent: string; bg: string }): void {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement?.clientWidth || canvas.clientWidth || 600, H = W >= 560 ? 240 : 420;
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = colors.bg; g.fillRect(0, 0, W, H);
  const wide = W >= 560;
  const L = (en: string, de: string) => (lang === 'de' ? de : en);
  const panel = (x: number, y: number, w: number, h: number, title: string, xl: string, yl: string, xmax: number, ymax: number, xstep: number, ystep: number) => {
    g.strokeStyle = colors.line; g.lineWidth = 1;
    for (let v = 0; v <= xmax + 1e-9; v += xstep) { const X = x + (v / xmax) * w; g.beginPath(); g.moveTo(X, y); g.lineTo(X, y + h); g.stroke(); }
    for (let v = 0; v <= ymax + 1e-9; v += ystep) { const Y = y + h - (v / ymax) * h; g.beginPath(); g.moveTo(x, Y); g.lineTo(x + w, Y); g.stroke(); }
    g.fillStyle = colors.fg; g.font = '700 12px sans-serif'; g.textAlign = 'left'; g.fillText(title, x, y - 8);
    g.fillStyle = colors.muted; g.font = '10px sans-serif'; g.textAlign = 'right'; g.fillText(xl, x + w, y + h + 14); g.textAlign = 'left'; g.fillText(yl, x + 3, y + 11);
    return { X: (v: number) => x + (v / xmax) * w, Y: (v: number) => y + h - (v / ymax) * h };
  };
  const pw = wide ? (W - 60) / 2 : W - 40, ph = wide ? H - 60 : (H - 90) / 2;
  const vmax = Math.ceil(Math.max(pred.FVC, c.FVC) * 1.15), fmax = Math.ceil(Math.max(pred.PEF, c.PEF) * 1.15);
  // flow–volume
  const a = panel(28, 26, pw, ph, L('Flow–volume', 'Fluss–Volumen'), L('volume (L)', 'Volumen (l)'), 'L/s', vmax, fmax, 1, 2);
  g.setLineDash([5, 4]); g.strokeStyle = colors.muted; g.lineWidth = 1.4; g.beginPath();
  g.moveTo(a.X(0), a.Y(0)); g.lineTo(a.X(pred.FVC * 0.12), a.Y(pred.PEF)); g.lineTo(a.X(pred.FVC), a.Y(0)); g.stroke(); g.setLineDash([]);
  g.strokeStyle = colors.accent; g.lineWidth = 2.4; g.beginPath();
  c.vol.forEach((v, i) => (i ? g.lineTo(a.X(v), a.Y(c.flow[i])) : g.moveTo(a.X(v), a.Y(c.flow[i])))); g.stroke();
  // volume–time
  const b = panel(wide ? 28 + pw + 32 : 28, wide ? 26 : 26 + ph + 50, pw, ph, L('Volume–time', 'Volumen–Zeit'), L('time (s)', 'Zeit (s)'), 'L', 8, vmax, 1, 1);
  g.setLineDash([5, 4]); g.strokeStyle = colors.muted; g.lineWidth = 1.4; g.beginPath();
  for (let t = 0; t <= 8; t += 0.05) { const v = pred.FVC * (1 - Math.exp(-t * Math.log(1 / (1 - pred.FEV1 / pred.FVC)))); t ? g.lineTo(b.X(t), b.Y(v)) : g.moveTo(b.X(t), b.Y(v)); } g.stroke(); g.setLineDash([]);
  g.strokeStyle = colors.accent; g.lineWidth = 2.4; g.beginPath();
  c.t.forEach((t, i) => { if (t > 8) return; i ? g.lineTo(b.X(t), b.Y(c.vol[i])) : g.moveTo(b.X(t), b.Y(c.vol[i])); }); g.stroke();
  g.strokeStyle = colors.fg; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(b.X(1), b.Y(0)); g.lineTo(b.X(1), b.Y(c.FEV1)); g.lineTo(b.X(0), b.Y(c.FEV1)); g.stroke(); g.setLineDash([]);
  g.fillStyle = colors.fg; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText(`FEV₁`, b.X(1) + 4, b.Y(c.FEV1) + 12);
  g.fillStyle = colors.muted; g.font = '10px sans-serif'; g.textAlign = 'right';
  g.fillText(L('dashed: predicted', 'gestrichelt: Soll'), W - 12, H - 4);
}
