/* Shared canvas plumbing. */

let paletteCache = null;
let paletteKey = '';

/* Read the live theme colours once per frame rather than per stroke. */
export function palette() {
  const key = document.documentElement.dataset.theme || 'monitor';
  if (paletteCache && paletteKey === key) return paletteCache;
  const cs = getComputedStyle(document.documentElement);
  const get = (n) => cs.getPropertyValue(n).trim();
  paletteKey = key;
  paletteCache = {
    text: get('--text'), text2: get('--text-2'), muted: get('--muted'),
    hairline: get('--hairline'), hairline2: get('--hairline-2'),
    panel: get('--panel'), panel2: get('--panel-2'), panel3: get('--panel-3'), ink: get('--ink'),
    rose: get('--rose'),
    gridFine: get('--grid-fine'), gridBold: get('--grid-bold'),
    aortic: get('--aortic'), lv: get('--lv'), la: get('--la'),
    volume: get('--volume'), ecg: get('--ecg'), flow: get('--flow'),
    good: get('--good'), warn: get('--warn'), bad: get('--bad'),
  };
  return paletteCache;
}
export function invalidatePalette() { paletteCache = null; }

/* Every canvas that has ever been fitted, so the diagnostics report can say
   what size each one thinks it is. A blank panel is almost always a zero. */
export const canvasSizes = new Map();

/* Size a canvas to its CSS box at device resolution. Returns null if genuinely
   hidden.

   Measuring is deliberately belt-and-braces. Asking only the parent for
   clientWidth is one point of failure: it reads zero while the element is still
   being laid out, inside a collapsed flex or grid item, and in any container
   whose width comes from a child. When it returns zero the canvas silently
   draws nothing — no error, no warning, just an empty rectangle — so it is
   worth trying every measurement available before giving up. */
export function fit(canvas, cssHeight) {
  const parent = canvas.parentElement;
  let w = 0;
  const tries = [
    () => parent && parent.clientWidth,
    () => canvas.clientWidth,
    () => Math.round(canvas.getBoundingClientRect().width),
    () => parent && Math.round(parent.getBoundingClientRect().width),
    () => {
      // last resort: the nearest ancestor that has a width
      let n = parent;
      while (n && !w) { const r = n.clientWidth || Math.round(n.getBoundingClientRect().width); if (r) return r; n = n.parentElement; }
      return 0;
    },
  ];
  for (const t of tries) { try { w = t() || 0; } catch { w = 0; } if (w > 0) break; }

  let h = cssHeight ?? canvas.clientHeight;
  if (!h) {
    const styled = parseFloat(canvas.style.height);
    h = Number.isFinite(styled) && styled > 0 ? styled
      : Math.round(canvas.getBoundingClientRect().height) || 240;
  }
  canvasSizes.set(canvas, { w, h });
  if (!w) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw; canvas.height = ph;
    canvas.style.height = h + 'px';
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/* The rose-ruled grid of real ECG paper: a fine 1 mm square, a bold 5 mm one. */
export function paper(ctx, x, y, w, h, mm) {
  const p = palette();
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

  ctx.lineWidth = 1;
  ctx.strokeStyle = p.gridFine;
  ctx.beginPath();
  for (let gx = x; gx <= x + w + 0.5; gx += mm) { ctx.moveTo(Math.round(gx) + 0.5, y); ctx.lineTo(Math.round(gx) + 0.5, y + h); }
  for (let gy = y; gy <= y + h + 0.5; gy += mm) { ctx.moveTo(x, Math.round(gy) + 0.5); ctx.lineTo(x + w, Math.round(gy) + 0.5); }
  ctx.stroke();

  ctx.strokeStyle = p.gridBold;
  ctx.beginPath();
  for (let gx = x; gx <= x + w + 0.5; gx += mm * 5) { ctx.moveTo(Math.round(gx) + 0.5, y); ctx.lineTo(Math.round(gx) + 0.5, y + h); }
  for (let gy = y; gy <= y + h + 0.5; gy += mm * 5) { ctx.moveTo(x, Math.round(gy) + 0.5); ctx.lineTo(x + w, Math.round(gy) + 0.5); }
  ctx.stroke();
  ctx.restore();
}

export function line(ctx, pts, color, width = 1.6) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.stroke();
}

export function label(ctx, text, x, y, color, size = 10, align = 'left', weight = '500') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export function sans(ctx, text, x, y, color, size = 11, align = 'left', weight = '600') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "IBM Plex Sans", ui-sans-serif, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export function dashed(ctx, pts, color, width = 1, dash = [4, 4]) {
  ctx.save();
  ctx.setLineDash(dash);
  line(ctx, pts, color, width);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function withAlpha(color, a) {
  // Works for hex from the palette; falls back to globalAlpha use elsewhere.
  if (color.startsWith('#')) {
    const n = color.length === 4
      ? color.slice(1).split('').map((c) => parseInt(c + c, 16))
      : [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
    return `rgba(${n[0]},${n[1]},${n[2]},${a})`;
  }
  return color;
}

/* Rotate a beat so the display starts a little before the P wave rather than on
   the QRS. Makes the strip read like a textbook Wiggers diagram. */
export function rotateBeat(samples, lead = 0.22) {
  const n = samples.length;
  if (n < 4) return samples;
  const cut = Math.floor(n * (1 - lead));
  return samples.slice(cut).concat(samples.slice(0, cut));
}
