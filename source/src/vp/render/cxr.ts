import type { RespSnapshot } from '../physiology/lung/respiratory.ts';

/* ===========================================================================
   A chest radiograph (PA, erect), drawn from the model.

   X-ray attenuation is roughly density: air is black, soft tissue and fluid
   white-grey, bone white. So the drawing is a density map of the model's
   chest: aerated lung dark with vessels fanning from the hila; consolidated
   lobes white with dark air bronchograms, in the region each lobe projects
   to (and silhouetting the border it touches); fluid at the bases with a
   meniscus; a pneumothorax as a pleural line with black, vessel-free space
   beyond it; interstitial water as septal lines and alveolar water as
   perihilar shadowing; a large heart as a wide shadow; hyperinflation as
   long lungs over flat diaphragms. Viewed as a radiologist does: the
   patient's right on the viewer's left.
=========================================================================== */

type Pt = [number, number];
interface Lung { side: 'R' | 'L'; apex: Pt; cp: Pt; base: Pt; hilum: Pt; medTop: Pt }

let seedv = 11;
const rnd = () => { seedv = (seedv * 16807) % 2147483647; return seedv / 2147483647; };

export interface CxrInput {
  r: RespSnapshot;
  circ?: Record<string, any>;
  sex: 'F' | 'M';
  /** mediastinal shift index, positive toward the patient's left (from the examination model) */
  shift?: number;
}

export function drawCxr(canvas: HTMLCanvasElement, inp: CxrInput, cssW?: number): void {
  const dpr = window.devicePixelRatio || 1;
  const W = cssW ?? (canvas.clientWidth || 360), H = Math.round(W * 1.12);
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  seedv = 11;
  const { r } = inp; const p = r.params;
  const m = inp.circ?.metrics ?? {};
  const X = (u: number) => u * W, Y = (v: number) => v * H;
  const hyper = Math.max(0, Math.min(1, (r.TLC / r.pred.TLC - 1) / 0.35));
  const diaDrop = 0.06 * hyper;
  const shiftU = Math.max(-0.07, Math.min(0.07, (inp.shift ?? 0) * 0.035));   // positive = toward the patient's left (viewer's right)

  /* film and soft tissue */
  g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, W, H);
  const body = g.createLinearGradient(0, 0, W, 0);
  body.addColorStop(0, '#2a2a2a'); body.addColorStop(0.12, '#6a6a6a'); body.addColorStop(0.5, '#7a7a7a'); body.addColorStop(0.88, '#6a6a6a'); body.addColorStop(1, '#2a2a2a');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(X(0.42), 0); g.lineTo(X(0.58), 0); g.lineTo(X(0.6), Y(0.07));
  g.bezierCurveTo(X(0.78), Y(0.07), X(0.95), Y(0.1), X(0.99), Y(0.2)); g.lineTo(X(0.97), Y(0.95)); g.lineTo(X(0.03), Y(0.95)); g.lineTo(X(0.01), Y(0.2));
  g.bezierCurveTo(X(0.05), Y(0.1), X(0.22), Y(0.07), X(0.4), Y(0.07)); g.closePath(); g.fill();
  if (inp.sex === 'F') { g.fillStyle = 'rgba(160,160,160,0.18)'; for (const u of [0.24, 0.76]) { g.beginPath(); g.ellipse(X(u), Y(0.7), X(0.14), Y(0.11), 0, 0, Math.PI * 2); g.fill(); } }

  /* lungs */
  const lungs: Lung[] = [
    { side: 'R', apex: [0.31, 0.12], cp: [0.11, 0.72 + diaDrop], base: [0.42 + shiftU, 0.69 + diaDrop * 0.8], hilum: [0.40 + shiftU, 0.41], medTop: [0.44 + shiftU, 0.17] },
    { side: 'L', apex: [0.69, 0.12], cp: [0.89, 0.74 + diaDrop], base: [0.6 + shiftU, 0.72 + diaDrop * 0.8], hilum: [0.6 + shiftU, 0.42], medTop: [0.56 + shiftU, 0.17] },
  ];
  const ptxOf = (s: 'R' | 'L') => Math.max(0, Math.min(1, s === 'R' ? p.ptxR : p.ptxL));
  const lungPath = (l: Lung, shrink = 0) => {
    const s = l.side === 'R' ? -1 : 1;
    const k = shrink;
    const ax = l.apex[0] + (l.hilum[0] - l.apex[0]) * k * 0.6, ay = l.apex[1] + (l.hilum[1] - l.apex[1]) * k * 0.5;
    const cx = l.cp[0] + (l.hilum[0] - l.cp[0]) * k, cy = l.cp[1] + (l.hilum[1] - l.cp[1]) * k * 0.6;
    const dome = (1 - 0.9 * hyper) * 0.07;
    g.beginPath();
    g.moveTo(X(l.medTop[0]), Y(l.medTop[1] + k * 0.08));
    g.bezierCurveTo(X(l.medTop[0] + s * 0.02), Y(ay - 0.02), X(ax - s * 0.03), Y(ay - 0.02), X(ax), Y(ay));
    g.bezierCurveTo(X(ax + s * 0.12 * (1 - k)), Y(ay + 0.04), X(cx + s * 0.01), Y(0.38), X(cx), Y(cy));
    g.bezierCurveTo(X(cx - s * 0.06), Y(cy - dome * (1 - k)), X(l.base[0] + s * 0.12), Y(l.base[1] - dome * 1.6 * (1 - k)), X(l.base[0]), Y(l.base[1] - k * 0.05));
    g.bezierCurveTo(X(l.base[0] - s * 0.01), Y(0.55), X(l.hilum[0] + s * 0.01), Y(0.46), X(l.medTop[0]), Y(l.medTop[1] + k * 0.08));
    g.closePath();
  };
  for (const l of lungs) {
    const ptx = ptxOf(l.side);
    // the hemithorax: air (black) out to the chest wall
    lungPath(l); g.fillStyle = '#060606'; g.fill();
    // the lung itself, slightly greyer than free air, shrinking toward the hilum under a pneumothorax
    lungPath(l, ptx * 0.75);
    const lg = g.createRadialGradient(X(l.hilum[0]), Y(l.hilum[1]), 2, X(l.hilum[0]), Y(l.hilum[1]), X(0.32));
    lg.addColorStop(0, '#3a3a3a'); lg.addColorStop(0.5, '#1d1d1d'); lg.addColorStop(1, '#161616');
    g.fillStyle = lg; g.fill();
    if (ptx > 0.05) { g.strokeStyle = 'rgba(220,220,220,0.55)'; g.lineWidth = 1.1; g.stroke(); }
    // vessels fanning out from the hilum (not past the lung edge)
    g.save(); lungPath(l, ptx * 0.75); g.clip();
    const s = l.side === 'R' ? -1 : 1;
    const upper = r.Pcap >= 15 ? 1.8 : 1;           // upper lobe diversion
    for (let i = 0; i < 26; i++) {
      const ang = -Math.PI / 2 - s * (0.25 + 2.6 * (i / 26)) + (rnd() - 0.5) * 0.2;
      const len = 0.12 + 0.12 * rnd();
      const isUpper = Math.sin(ang) < -0.3;
      g.strokeStyle = `rgba(200,200,200,${0.18 + 0.12 * rnd()})`; g.lineWidth = (isUpper ? upper : 1) * (1.6 - 0.6 * (i % 3) / 2);
      let x = l.hilum[0], y = l.hilum[1];
      g.beginPath(); g.moveTo(X(x), Y(y));
      for (let k = 0; k < 4; k++) { x += Math.cos(ang + (rnd() - 0.5) * 0.4) * len / 4; y += Math.sin(ang + (rnd() - 0.5) * 0.4) * len / 4 * 1.1; g.lineTo(X(x), Y(y)); }
      g.stroke();
    }
    g.restore();
  }

  /* posterior ribs and clavicles */
  g.strokeStyle = 'rgba(210,210,210,0.13)'; g.lineWidth = Math.max(2, W * 0.012);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 9; k++) {
      const y0 = 0.16 + k * (0.062 + 0.004 * hyper);
      g.beginPath(); g.moveTo(X(0.5 + s * 0.06), Y(y0)); g.quadraticCurveTo(X(0.5 + s * 0.3), Y(y0 - 0.035), X(0.5 + s * 0.42), Y(y0 + 0.06)); g.stroke();
    }
    g.strokeStyle = 'rgba(230,230,230,0.5)'; g.lineWidth = Math.max(3, W * 0.016);
    g.beginPath(); g.moveTo(X(0.5 + s * 0.05), Y(0.13)); g.quadraticCurveTo(X(0.5 + s * 0.22), Y(0.09), X(0.5 + s * 0.4), Y(0.1)); g.stroke();
    g.strokeStyle = 'rgba(210,210,210,0.13)'; g.lineWidth = Math.max(2, W * 0.012);
  }

  /* lobes: consolidation, collapse, alveolar water */
  const lobe = (id: string) => r.lobes.find((l) => l.id === id);
  // where each lobe projects on a PA film: centre, radii (fractions of the image)
  const region: Record<string, Array<[number, number, number, number]>> = {
    RUL: [[0.3, 0.24, 0.12, 0.1], [0.36, 0.3, 0.08, 0.06]],
    RML: [[0.37, 0.53, 0.08, 0.08], [0.3, 0.5, 0.06, 0.05]],
    RLL: [[0.24, 0.6, 0.1, 0.09], [0.33, 0.64, 0.08, 0.05], [0.2, 0.68, 0.06, 0.04]],
    LUL: [[0.7, 0.24, 0.12, 0.1], [0.66, 0.4, 0.08, 0.08], [0.63, 0.53, 0.06, 0.06]],
    LLL: [[0.76, 0.62, 0.1, 0.09], [0.66, 0.64, 0.08, 0.06], [0.8, 0.7, 0.05, 0.04]],
  };
  const blob = (id: string, alpha: number, tint = '230,230,230') => {
    for (const [u, v, ru, rv] of region[id]) {
      const gr = g.createRadialGradient(X(u + shiftU * 0.5), Y(v), 1, X(u + shiftU * 0.5), Y(v), X(Math.max(ru, rv)) * 1.15);
      gr.addColorStop(0, `rgba(${tint},${alpha})`); gr.addColorStop(0.6, `rgba(${tint},${alpha * 0.85})`); gr.addColorStop(1, `rgba(${tint},0)`);
      g.fillStyle = gr; g.beginPath(); g.ellipse(X(u + shiftU * 0.5), Y(v), X(ru) * 1.15, Y(rv) * 1.15, 0, 0, Math.PI * 2); g.fill();
    }
  };
  for (const l of lungs) {
    g.save(); lungPath(l, ptxOf(l.side) * 0.75); g.clip();
    for (const id of (l.side === 'R' ? ['RUL', 'RML', 'RLL'] : ['LUL', 'LLL'])) {
      const q = lobe(id); if (!q) continue;
      const obstr = Math.max(0, q.collapsed - q.compressed - q.ptx);
      const solid = q.consolidated + 0.8 * obstr;
      if (solid > 0.08) {
        blob(id, Math.min(0.85, 0.75 * solid));
        // air bronchograms in consolidation (open airways), none in obstructive collapse
        if (q.consolidated > 0.3) {
          const [u, v] = region[id][0];
          // dark tubes of air in the bronchi, branching outward from the hilum through the white lobe
          g.strokeStyle = 'rgba(40,40,40,0.38)'; g.lineWidth = 1;
          const hx0 = l.hilum[0], hy0 = l.hilum[1];
          for (let k = 0; k < 4; k++) {
            const ang = Math.atan2(v - hy0, u - hx0) + (k - 1.5) * 0.18;
            let x = hx0 + Math.cos(ang) * 0.06, y = hy0 + Math.sin(ang) * 0.06;
            g.beginPath(); g.moveTo(X(x), Y(y));
            for (let j = 0; j < 5; j++) { x += Math.cos(ang) * 0.022; y += Math.sin(ang) * 0.022; g.lineTo(X(x), Y(y)); }
            g.stroke();
          }
        }
      }
      if (q.flooded > 0.05) blob(id, Math.min(0.6, 0.8 * q.flooded), '215,215,215');
    }
    // alveolar oedema: perihilar ('bat's wing'); interstitial: septal lines at the periphery of the bases
    const flood = r.lobes.filter((q) => q.side === l.side).reduce((a, q) => a + q.flooded, 0) / (l.side === 'R' ? 3 : 2);
    if (flood > 0.06) {
      const gr = g.createRadialGradient(X(l.hilum[0]), Y(l.hilum[1]), 2, X(l.hilum[0]), Y(l.hilum[1]), X(0.2));
      gr.addColorStop(0, `rgba(220,220,220,${Math.min(0.75, flood * 1.4)})`); gr.addColorStop(1, 'rgba(220,220,220,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    if (r.interstitial > 0.3) {
      g.strokeStyle = `rgba(225,225,225,${0.25 + 0.4 * r.interstitial})`; g.lineWidth = 1;
      const ex = l.cp[0];
      for (let k = 0; k < 10; k++) { const y = l.cp[1] - 0.03 - k * 0.018; const x0 = ex + (l.side === 'R' ? 0.005 : -0.005); g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X(x0 + (l.side === 'R' ? 0.035 : -0.035)), Y(y)); g.stroke(); }
    }
    if (p.fibrosis > 0.2) {
      g.strokeStyle = `rgba(210,210,210,${0.15 + 0.35 * p.fibrosis})`; g.lineWidth = 0.9;
      for (let k = 0; k < 140 * p.fibrosis; k++) {
        const u = l.cp[0] + (l.side === 'R' ? 1 : -1) * rnd() * 0.22, v = l.cp[1] - rnd() * 0.25 * (1 - Math.abs(u - l.cp[0]) * 2);
        g.beginPath(); g.moveTo(X(u), Y(v)); g.lineTo(X(u + (rnd() - 0.5) * 0.03), Y(v + (rnd() - 0.5) * 0.03)); g.lineTo(X(u + (rnd() - 0.5) * 0.03), Y(v + (rnd() - 0.5) * 0.03)); g.stroke();
      }
    }
    g.restore();
  }

  /* diaphragms and abdomen: one soft-tissue mass under both domes */
  const domeH = (1 - 0.9 * hyper) * 0.07;
  const [R, Lf] = lungs;
  g.fillStyle = 'rgba(205,205,205,0.9)';
  g.beginPath();
  g.moveTo(X(R.cp[0] - 0.03), Y(R.cp[1]));
  g.bezierCurveTo(X(R.cp[0] + 0.06), Y(R.cp[1] - domeH), X(R.base[0] - 0.12), Y(R.base[1] - domeH * 1.6), X(R.base[0]), Y(R.base[1]));
  g.lineTo(X(Lf.base[0]), Y(Lf.base[1]));
  g.bezierCurveTo(X(Lf.base[0] + 0.12), Y(Lf.base[1] - domeH * 1.6), X(Lf.cp[0] - 0.06), Y(Lf.cp[1] - domeH), X(Lf.cp[0] + 0.03), Y(Lf.cp[1]));
  g.lineTo(X(0.97), Y(1)); g.lineTo(X(0.03), Y(1)); g.closePath(); g.fill();
  g.fillStyle = 'rgba(25,25,25,0.7)'; g.beginPath(); g.ellipse(X(0.68 + shiftU), Y(Lf.base[1] + 0.05), X(0.045), Y(0.025), 0, 0, Math.PI * 2); g.fill();   // gastric bubble

  /* mediastinum, heart, trachea */
  const edv = m.EDV ?? 120, cvp = m.CVPmean ?? 3;
  const ctr = Math.min(0.68, 0.44 + Math.max(0, (edv - 140) / 600) + Math.max(0, (cvp - 8) / 120) - 0.06 * hyper);
  const hw = ctr * 0.78;
  const hx = 0.5 + shiftU, hR = hx - 0.32 * hw, hL = hx + 0.68 * hw, hTop = 0.4 + 0.03 * hyper, hBot = Math.min(R.base[1], Lf.base[1]) + 0.01;
  const soft = (a: number) => `rgba(222,222,222,${a})`;
  g.fillStyle = soft(0.88);
  g.beginPath();
  g.moveTo(X(hx - 0.045), Y(0.12));                                   // superior vena cava, right
  g.lineTo(X(hx - 0.05), Y(hTop));
  g.bezierCurveTo(X(hR - 0.01), Y(hTop + 0.03), X(hR - 0.02), Y(hBot - 0.06), X(hR + 0.02), Y(hBot));   // right atrium
  g.lineTo(X(hL - 0.06), Y(hBot));
  g.bezierCurveTo(X(hL + 0.015), Y(hBot - 0.01), X(hL + 0.01), Y(hTop + 0.12), X(hx + 0.08), Y(hTop + 0.02));  // left ventricle
  g.quadraticCurveTo(X(hx + 0.095), Y(0.36), X(hx + 0.07), Y(0.34));   // pulmonary trunk
  g.quadraticCurveTo(X(hx + 0.1), Y(0.3), X(hx + 0.06), Y(0.27));      // aortic knob
  g.lineTo(X(hx + 0.045), Y(0.12)); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(15,15,15,0.85)'; g.lineWidth = W * 0.028; g.lineCap = 'round';
  g.beginPath(); g.moveTo(X(0.5), 0); g.quadraticCurveTo(X(0.5 + shiftU * 0.5), Y(0.18), X(hx), Y(0.32)); g.stroke();
  g.lineWidth = W * 0.015;
  g.beginPath(); g.moveTo(X(hx), Y(0.32)); g.lineTo(X(hx - 0.055), Y(0.38)); g.moveTo(X(hx), Y(0.32)); g.lineTo(X(hx + 0.06), Y(0.39)); g.stroke(); g.lineCap = 'butt';
  // a middle lobe or lingula consolidation lies against the heart and erases that border (silhouette sign)
  const rml = lobe('RML'), lul = lobe('LUL');
  const blur = (x0: number, a: number) => { const gr = g.createLinearGradient(X(x0 - 0.05), 0, X(x0 + 0.05), 0); gr.addColorStop(0, soft(0)); gr.addColorStop(0.5, soft(a)); gr.addColorStop(1, soft(0)); g.fillStyle = gr; g.fillRect(X(x0 - 0.05), Y(hTop + 0.05), X(0.1), Y(hBot - hTop - 0.08)); };
  if (rml && rml.consolidated > 0.4) blur(hR, 0.75);
  if (lul && lul.consolidated > 0.4) blur(hL - 0.01, 0.7);

  /* pleural fluid: fills the hemithorax from the bottom, its surface a meniscus climbing the lateral wall */
  for (const l of lungs) {
    const E = l.side === 'R' ? p.effusionR : p.effusionL;
    if (E < 150) continue;
    const s = l.side === 'R' ? -1 : 1;
    const level = l.cp[1] - Math.min(0.5, (E - 120) / 5200);       // height of the fluid at the lateral wall
    g.save(); lungPath(l); g.clip();
    const medial = l.base[0] - s * 0.01, lateral = l.cp[0] + s * 0.02;
    const gr = g.createLinearGradient(0, Y(level - 0.03), 0, Y(level + 0.06));
    gr.addColorStop(0, soft(0)); gr.addColorStop(0.45, soft(0.8)); gr.addColorStop(1, soft(0.88));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(X(lateral), Y(level - 0.02));
    g.quadraticCurveTo(X((lateral + medial) / 2), Y(level + 0.07), X(medial), Y(level + 0.06 + (l.cp[1] - level) * 0.15));
    g.lineTo(X(medial), Y(1)); g.lineTo(X(lateral), Y(1)); g.closePath(); g.fill();
    g.restore();
  }

  /* grain, and the side marker */
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const dta = img.data;
  for (let i = 0; i < dta.length; i += 4) { const n = (rnd() - 0.5) * 14; dta[i] += n; dta[i + 1] += n; dta[i + 2] += n; }
  g.putImageData(img, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#e8e8e8'; g.font = `700 ${Math.round(W * 0.05)}px sans-serif`; g.textAlign = 'left'; g.fillText('R', X(0.04), Y(0.06));
  g.font = `500 ${Math.round(W * 0.03)}px sans-serif`; g.textAlign = 'right'; g.fillText('PA', X(0.96), Y(0.05));
}
