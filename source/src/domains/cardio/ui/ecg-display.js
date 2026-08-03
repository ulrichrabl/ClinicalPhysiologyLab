/* Shared ECG drawing: live monitor scroll + classical paper print. */

import { el } from '../../../core/ui/kit.js';
import { fit, paper, palette, label } from '../../../core/ui/draw.js';

export const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
export const SAMPLE_HZ = 500;
export const PAPER_SPEED_MM_S = 25;
export const PAPER_GAIN_MM_MV = 10;

const GRID_ORDER = [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']];
const GRID_SEC = 2.5;
const STRIP_SEC = 5;
const PAPER_STRIP_SEC = 10;

/** Last `seconds` of samples, right-aligned in time. No baseline warping. */
export function takeTail(buf, seconds) {
  if (!buf || buf.length < 2) return null;
  const n = Math.max(2, Math.floor(seconds * SAMPLE_HZ));
  return buf.slice(Math.max(0, buf.length - n));
}

/**
 * Draw a trace at fixed paper speed: `seconds` maps to `widthPx`.
 * Short buffers sit on the right (newest edge), like a scrolling monitor.
 */
export function strokeTimed(ctx, slice, x0, mid, widthPx, seconds, ampPx, color, lineWidth = 1.5) {
  if (!slice || slice.length < 2) return;
  const nMax = Math.max(2, Math.floor(seconds * SAMPLE_HZ));
  const n = slice.length;
  const startX = x0 + widthPx * (1 - n / nMax);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = startX + (i / (nMax - 1)) * widthPx;
    const y = mid - slice[i] * ampPx;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function mmFor(widthPx, seconds) {
  return Math.max(3, widthPx / (seconds * PAPER_SPEED_MM_S));
}

function ampFromMm(mm, gain) {
  return mm * PAPER_GAIN_MM_MV * gain;
}

/** Live 12-lead monitor panel (theme colours, scrolling). */
export function drawMonitorTwelveLead(canvas, buffers, gain = 1) {
  const g = fit(canvas);
  if (!g) return;
  const { ctx, w, h } = g;
  const p = palette();
  const cols = 4, rows = 3;
  const cw = w / cols, ch = h / rows;
  const mm = mmFor(cw - 14, GRID_SEC);
  paper(ctx, 0, 0, w, h, mm);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lead = GRID_ORDER[r][c];
      const x0 = c * cw, y0 = r * ch, mid = y0 + ch / 2;
      if (c > 0) {
        ctx.strokeStyle = p.hairline; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y0 + 6); ctx.lineTo(x0, y0 + ch - 6); ctx.stroke();
      }
      label(ctx, lead, x0 + 8, y0 + 12, p.text2, 10.5, 'left', '700');
      const slice = takeTail(buffers[lead], GRID_SEC);
      if (!slice) continue;
      const amp = Math.min(ch / 2 - 14, ampFromMm(mm, gain));
      strokeTimed(ctx, slice, x0 + 6, mid, cw - 14, GRID_SEC, amp, p.ecg, 1.5);
    }
  }
  drawCalPulse(ctx, 6, h - 8, mm, gain, p.text2);
  label(ctx, '25 mm/s · live', w - 8, 12, p.muted, 9, 'right');
}

/** Live rhythm strip (theme colours, scrolling). */
export function drawMonitorRhythm(canvas, buffers, gain = 1, lead = 'II') {
  const g = fit(canvas);
  if (!g) return;
  const { ctx, w, h } = g;
  const p = palette();
  const mm = mmFor(w - 12, STRIP_SEC);
  paper(ctx, 0, 0, w, h, mm);
  const slice = takeTail(buffers[lead], STRIP_SEC);
  if (!slice) {
    label(ctx, lead, 8, 12, p.text2, 10.5, 'left', '700');
    return;
  }
  const mid = h / 2;
  const amp = Math.min(h / 2 - 12, ampFromMm(mm, gain));
  strokeTimed(ctx, slice, 6, mid, w - 12, STRIP_SEC, amp, p.ecg, 1.6);
  label(ctx, lead, 8, 12, p.text2, 10.5, 'left', '700');
  label(ctx, `${STRIP_SEC}s · 25 mm/s`, w - 8, 12, p.muted, 9, 'right');

  /* Erase bar at the newest edge — bedside-monitor cue. */
  const xBar = w - 8;
  ctx.fillStyle = p.panel;
  ctx.fillRect(xBar - 3, 4, 6, h - 8);
  ctx.fillStyle = p.rose;
  ctx.fillRect(xBar - 1, 4, 2, h - 8);
}

/** Draw a live II strip into an arbitrary rect (Wiggers ECG row). */
export function drawMonitorStripInRect(ctx, slice, x, y, w, h, gain, color) {
  if (!slice || slice.length < 2 || w < 8 || h < 8) return;
  const seconds = STRIP_SEC;
  const mm = mmFor(w, seconds);
  const mid = y + h / 2;
  const amp = Math.min(h / 2 - 2, ampFromMm(mm, gain));
  strokeTimed(ctx, slice, x, mid, w, seconds, amp, color, 1.5);
}

function drawCalPulse(ctx, x, y, mm, gain, color) {
  const h = PAPER_GAIN_MM_MV * mm * Math.min(gain, 2);
  ctx.strokeStyle = color; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + 4, y);
  ctx.lineTo(x + 4, y - h); ctx.lineTo(x + 4 + mm, y - h);
  ctx.lineTo(x + 4 + mm, y); ctx.lineTo(x + 10 + mm, y);
  ctx.stroke();
}

/* ---- Classical paper print (always light paper, frozen) ----------------- */

const PAPER_BG = '#F7F1E8';
const PAPER_INK = '#1A2330';
const PAPER_SIGNAL = '#0B5F4B';
const PAPER_FINE = '#E2B8B8';
const PAPER_BOLD = '#D09090';

function drawPaperGrid(ctx, x, y, w, h, mm) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PAPER_FINE; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = x; gx <= x + w; gx += mm) { ctx.moveTo(Math.round(gx) + 0.5, y); ctx.lineTo(Math.round(gx) + 0.5, y + h); }
  for (let gy = y; gy <= y + h; gy += mm) { ctx.moveTo(x, Math.round(gy) + 0.5); ctx.lineTo(x + w, Math.round(gy) + 0.5); }
  ctx.stroke();
  ctx.strokeStyle = PAPER_BOLD;
  ctx.beginPath();
  for (let gx = x; gx <= x + w; gx += mm * 5) { ctx.moveTo(Math.round(gx) + 0.5, y); ctx.lineTo(Math.round(gx) + 0.5, y + h); }
  for (let gy = y; gy <= y + h; gy += mm * 5) { ctx.moveTo(x, Math.round(gy) + 0.5); ctx.lineTo(x + w, Math.round(gy) + 0.5); }
  ctx.stroke();
  ctx.restore();
}

/** Render classical 12-lead + rhythm onto a canvas (for modal / print). */
export function renderPaperRecording(canvas, buffers, opts = {}) {
  const gain = opts.gain ?? 1;
  const W = canvas.width || 1400;
  const H = canvas.height || 980;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER_BG;
  ctx.fillRect(0, 0, W, H);

  const title = opts.title || '12-lead ECG';
  const sub = [
    opts.pathologyName,
    opts.HR != null ? `${Math.round(opts.HR)} bpm` : null,
    opts.axis != null ? `axis ${Math.round(opts.axis)}°` : null,
    '25 mm/s · 10 mm/mV',
  ].filter(Boolean).join('  ·  ');

  ctx.fillStyle = PAPER_INK;
  ctx.font = '700 20px "IBM Plex Sans", ui-sans-serif, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 18, 22);
  ctx.font = '500 13px "IBM Plex Sans", ui-sans-serif, sans-serif';
  ctx.fillStyle = '#445566';
  ctx.fillText(sub, 18, 44);

  const top = 58;
  const stripH = Math.round(H * 0.22);
  const gridH = H - top - stripH - 12;
  const cols = 4, rows = 3;
  const cw = W / cols, ch = gridH / rows;
  const mm = mmFor(cw - 16, GRID_SEC);

  drawPaperGrid(ctx, 0, top, W, gridH, mm);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lead = GRID_ORDER[r][c];
      const x0 = c * cw, y0 = top + r * ch, mid = y0 + ch / 2;
      if (c > 0) {
        ctx.strokeStyle = '#AABBCC'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y0 + 8); ctx.lineTo(x0, y0 + ch - 8); ctx.stroke();
      }
      ctx.fillStyle = PAPER_INK;
      ctx.font = '700 14px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText(lead, x0 + 10, y0 + 16);
      const slice = takeTail(buffers[lead], GRID_SEC);
      if (!slice) continue;
      const amp = Math.min(ch / 2 - 16, ampFromMm(mm, gain));
      strokeTimed(ctx, slice, x0 + 8, mid, cw - 16, GRID_SEC, amp, PAPER_SIGNAL, 1.8);
    }
  }

  const sy = top + gridH + 6;
  const stripMm = mmFor(W - 16, PAPER_STRIP_SEC);
  drawPaperGrid(ctx, 0, sy, W, stripH - 6, stripMm);
  ctx.fillStyle = PAPER_INK;
  ctx.font = '700 13px "IBM Plex Mono", ui-monospace, monospace';
  ctx.fillText('II', 12, sy + 14);
  ctx.fillStyle = '#667788';
  ctx.font = '500 11px "IBM Plex Sans", ui-sans-serif, sans-serif';
  ctx.fillText(`Rhythm strip · ${PAPER_STRIP_SEC} s`, 36, sy + 14);
  const strip = takeTail(buffers.II, PAPER_STRIP_SEC);
  if (strip) {
    const mid = sy + (stripH - 6) / 2;
    const amp = Math.min((stripH - 6) / 2 - 14, ampFromMm(stripMm, gain));
    strokeTimed(ctx, strip, 8, mid, W - 16, PAPER_STRIP_SEC, amp, PAPER_SIGNAL, 1.9);
  }

  /* Calibration at bottom-left of grid. */
  ctx.strokeStyle = PAPER_INK; ctx.lineWidth = 1.6;
  const calY = top + gridH - 10;
  const calH = PAPER_GAIN_MM_MV * mm * Math.min(gain, 1);
  ctx.beginPath();
  ctx.moveTo(10, calY); ctx.lineTo(16, calY);
  ctx.lineTo(16, calY - calH); ctx.lineTo(16 + mm, calY - calH);
  ctx.lineTo(16 + mm, calY); ctx.lineTo(28 + mm, calY);
  ctx.stroke();
}

/**
 * Deep-copy lead buffers for a frozen recording.
 * @returns {Record<string, number[]>}
 */
export function freezeBuffers(buffers) {
  const out = {};
  for (const l of LEADS) out[l] = (buffers[l] || []).slice();
  return out;
}

/** Open a classical paper ECG overlay. Returns a close() function. */
export function openPaperEcg(opts) {
  const buffers = opts.buffers;
  const gain = opts.gain ?? 1;
  const canvas = el('canvas', { class: 'paper-ecg-canvas' });
  /* Physical-ish aspect for on-screen paper. */
  canvas.width = 1400;
  canvas.height = 1000;
  renderPaperRecording(canvas, buffers, {
    gain,
    title: 'ECG recording',
    pathologyName: opts.pathologyName || '',
    HR: opts.HR,
    axis: opts.axis,
  });

  const close = () => overlay.remove();
  const overlay = el('div', {
    class: 'paper-ecg-overlay',
    onclick: (e) => { if (e.target === overlay) close(); },
  },
    el('div', { class: 'paper-ecg-card' },
      el('div', { class: 'paper-ecg-bar' },
        el('div', {},
          el('div', { class: 'paper-ecg-title' }, 'ECG recording'),
          el('div', { class: 'paper-ecg-sub' },
            [opts.pathologyName, opts.HR != null ? `${Math.round(opts.HR)} bpm` : null, 'frozen · 25 mm/s · 10 mm/mV']
              .filter(Boolean).join('  ·  '))),
        el('div', { class: 'paper-ecg-actions' },
          el('button', {
            class: 'chip',
            onclick: () => {
              const a = document.createElement('a');
              a.href = canvas.toDataURL('image/png');
              a.download = `ecg_${Date.now()}.png`;
              a.click();
            },
          }, 'Download PNG'),
          el('button', {
            class: 'chip',
            onclick: () => {
              const w = window.open('', '_blank');
              if (!w) return;
              const img = canvas.toDataURL('image/png');
              w.document.write(`<!doctype html><html><head><title>ECG recording</title></head><body style="margin:0;background:#F7F1E8;text-align:center"><img src="${img}" style="width:100%;height:auto"/></body></html>`);
              w.document.close();
              w.focus();
              w.print();
            },
          }, 'Print'),
          el('button', { class: 'chip on', onclick: close }, 'Close'))),
      el('div', { class: 'paper-ecg-scroll' }, canvas)));

  document.body.appendChild(overlay);
  const onKey = (e) => { if (e.key === 'Escape') { close(); window.removeEventListener('keydown', onKey); } };
  window.addEventListener('keydown', onKey);
  return close;
}
