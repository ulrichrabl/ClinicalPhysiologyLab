import { toMap, sphericalDir } from '../measurements/eeg-forward.ts';
import type { FieldSection, RegionDose } from '../physiology/brain/ect-stimulus.ts';

/* ---------------------------------------------------------------------------
   The ECT stimulus in the head, drawn (ECT station, part 1): the field's
   strength in a section through both pads, on a logarithmic scale with the
   excitation threshold marked; and the head from above with the pads and
   each region of the seizure model shaded by the share of it one pulse
   excites.
--------------------------------------------------------------------------- */

export interface HeadColors { fg: string; muted: string; line: string; surface: string; accent: string }

/** colour for a field (V/cm) on a log scale from 0.05 to 5, the threshold in the middle region */
export function fieldColor(v: number, threshold: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (Math.log10(v) + 1.3) / 2));   // 0.05 → 0, 5 → 1
  const th = Math.max(0, Math.min(1, (Math.log10(threshold) + 1.3) / 2));
  /* below threshold: greys to blue; above: yellow to red */
  if (t < th) { const k = t / th; return [Math.round(40 + 60 * k), Math.round(60 + 90 * k), Math.round(110 + 120 * k)]; }
  const k = (t - th) / (1 - th);
  return [Math.round(250 - 20 * k), Math.round(220 - 190 * k), Math.round(90 - 70 * k)];
}

export function drawFieldSection(g: CanvasRenderingContext2D, w: number, h: number, sec: FieldSection, radii: number[], threshold: number, c: HeadColors, labels: { a: string; b: string; left: string; right: string; up: string; dec: string }) {
  const size = Math.min(w, h - 26), cx = w / 2, cy = 8 + size / 2, r = size / 2 - 6;
  const off = document.createElement('canvas'); off.width = sec.n; off.height = sec.n;
  const og = off.getContext('2d')!, img = og.createImageData(sec.n, sec.n);
  for (let i = 0; i < sec.grid.length; i++) {
    const v = sec.grid[i];
    if (!Number.isFinite(v)) { img.data[i * 4 + 3] = 0; continue; }
    const [R, G, B] = fieldColor(v, threshold);
    img.data[i * 4] = R; img.data[i * 4 + 1] = G; img.data[i * 4 + 2] = B; img.data[i * 4 + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  g.save(); g.imageSmoothingEnabled = true; g.drawImage(off, cx - r, cy - r, 2 * r, 2 * r); g.restore();
  /* the shells */
  const R = radii[radii.length - 1];
  g.strokeStyle = c.line; g.lineWidth = 1;
  for (const x of radii) { g.beginPath(); g.arc(cx, cy, (r * x) / R, 0, 2 * Math.PI); g.stroke(); }
  /* the pads */
  g.fillStyle = c.fg; g.font = '12px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  sec.pads.forEach(([x, y], k) => {
    const px = cx + x * r, py = cy - y * r, ang = Math.atan2(-y, x);
    g.save(); g.translate(px, py); g.rotate(ang); g.fillRect(-3, -12, 6, 24); g.restore();
    g.fillText(k === 0 ? labels.a : labels.b, cx + x * (r + 0), py + (y > 0 ? -16 : 16));
  });
  g.fillStyle = c.muted; g.font = '11px system-ui, sans-serif';
  g.textAlign = 'left'; g.fillText(labels.left, 4, cy);
  g.textAlign = 'right'; g.fillText(labels.right, w - 4, cy);
  g.textAlign = 'center'; g.fillText(labels.up, cx, 6);
  /* the scale */
  const sy = h - 14, sw = Math.min(220, w - 20), sx = (w - sw) / 2;
  for (let k = 0; k < sw; k++) { const v = 10 ** ((k / sw) * 2 - 1.3); const [R2, G2, B2] = fieldColor(v, threshold); g.fillStyle = `rgb(${R2},${G2},${B2})`; g.fillRect(sx + k, sy - 6, 1, 8); }
  g.fillStyle = c.muted; g.textAlign = 'center';
  for (const v of [0.1, 0.3, 1, 3]) g.fillText(String(v).replace('.', labels.dec), sx + ((Math.log10(v) + 1.3) / 2) * sw, sy + 9);
  const tx = sx + ((Math.log10(threshold) + 1.3) / 2) * sw;
  g.strokeStyle = c.fg; g.beginPath(); g.moveTo(tx, sy - 9); g.lineTo(tx, sy + 3); g.stroke();
}

export function drawRegionMap(g: CanvasRenderingContext2D, w: number, h: number, doses: RegionDose[], pads: Array<[number, number]>, c: HeadColors, labels: { nose: string }) {
  const size = Math.min(w, h), cx = w / 2, cy = h / 2, r = size / 2 - 14;
  const at = (theta: number, phi: number) => { const [x, y] = toMap(sphericalDir(theta, phi)); return [cx + x * r, cy + y * r] as const; };
  g.strokeStyle = c.line; g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, cy, r * (90 / 130), 0, 2 * Math.PI); g.stroke();
  /* the nose */
  g.beginPath(); g.moveTo(cx - 8, cy - r * (90 / 130) + 1); g.lineTo(cx, cy - r * (90 / 130) - 10); g.lineTo(cx + 8, cy - r * (90 / 130) + 1); g.stroke();
  g.fillStyle = c.muted; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(labels.nose, cx, cy - r * (90 / 130) - 16);
  for (const d of doses) {
    const [x, y] = at(d.def.theta, d.def.phi);
    const k = d.excited;
    g.fillStyle = `rgba(230, 120, 40, ${0.15 + 0.75 * k})`;
    g.beginPath(); g.arc(x, y, r * 0.17, 0, 2 * Math.PI); g.fill();
    g.fillStyle = c.fg; g.font = '11px system-ui, sans-serif'; g.textBaseline = 'middle';
    g.fillText(`${Math.round(100 * k)} %`, x, y);
  }
  g.fillStyle = c.fg;
  for (const [theta, phi] of pads) { const [x, y] = at(theta, phi); g.fillRect(x - 7, y - 7, 14, 14); }
}
