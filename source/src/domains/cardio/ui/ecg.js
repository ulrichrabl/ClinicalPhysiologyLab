import { el, clear, card } from '../../../core/ui/kit.js';
import { fit, paper, palette, label, sans, withAlpha, line } from '../../../core/ui/draw.js';
import { TERRITORIES } from '../data/cases.js';
import { guard } from '../../../core/diagnostics.js';

const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
/* Cabrera order puts the limb leads in anatomical sequence around the frontal
   plane instead of the historical accident of I, II, III, aVR, aVL, aVF. */
const CABRERA = ['aVL', 'I', '-aVR', 'II', 'aVF', 'III'];
const LEAD_ANGLE = { I: 0, II: 60, III: 120, aVR: -150, aVL: -30, aVF: 90, '-aVR': 30 };

const READING = [
  { t: 'Rate', q: 'Count the R waves in 6 seconds and multiply by 10, or 300 divided by the number of large squares between beats.' },
  { t: 'Rhythm', q: 'Regular or irregular? If irregular — regularly so, or irregularly irregular?' },
  { t: 'P waves', q: 'Present? One before every QRS? Same shape each time? Upright in II and inverted in aVR means sinus.' },
  { t: 'PR interval', q: 'Normal is 120–200 ms (3–5 small squares). Long means nodal delay; short with a slurred upstroke means pre-excitation.' },
  { t: 'QRS', q: 'Width first — under 120 ms is supraventricular. Then axis, then voltage, then Q waves.' },
  { t: 'ST segment', q: 'Compare with the T-P baseline. Elevation in contiguous leads with reciprocal depression is occlusion until proven otherwise.' },
  { t: 'T and QT', q: 'T wave shape and direction, then QT corrected for rate. Discordance with the QRS matters in wide complexes.' },
];

/* ---------------------------------------------------------------------------
   Reusable lead renderers. The Cases workspace needs the same twelve-lead the
   ECG workspace draws — a case that asks you to read a tracing has to show one.
--------------------------------------------------------------------------- */
export function drawTwelveLead(canvas, buffers, gain = 1) {
  const g = fit(canvas);
  if (!g) return;
  const { ctx, w, h } = g;
  const p = palette();
  paper(ctx, 0, 0, w, h, 5);
  const cols = 4, rows = 3;
  const cw = w / cols, ch = h / rows;
  const order = [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lead = order[r][c];
      const x0 = c * cw, y0 = r * ch, mid = y0 + ch / 2;
      if (c > 0) {
        ctx.strokeStyle = p.hairline; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y0 + 6); ctx.lineTo(x0, y0 + ch - 6); ctx.stroke();
      }
      label(ctx, lead, x0 + 8, y0 + 12, p.text2, 10.5, 'left', '700');
      const buf = buffers[lead];
      if (!buf || buf.length < 4) continue;
      const n = Math.min(buf.length, 480);
      const slice = buf.slice(buf.length - n);
      const amp = (ch / 2 - 14) * gain;
      line(ctx, slice.map((v, i) => [x0 + 6 + (i / (n - 1)) * (cw - 14), mid - v * amp]), p.ecg, 1.5);
    }
  }
  const cal = h - 8;
  ctx.strokeStyle = p.text2; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(6, cal); ctx.lineTo(12, cal); ctx.lineTo(12, cal - 22 * gain);
  ctx.lineTo(22, cal - 22 * gain); ctx.lineTo(22, cal); ctx.lineTo(28, cal);
  ctx.stroke();
  label(ctx, `${(10 * gain).toFixed(0)} mm/mV`, 32, cal - 5, p.muted, 8.5, 'left');
}

export function drawRhythm(canvas, buffers, gain = 1, lead = 'II') {
  const g = fit(canvas);
  if (!g) return;
  const { ctx, w, h } = g;
  const p = palette();
  paper(ctx, 0, 0, w, h, 5);
  const buf = buffers[lead];
  if (!buf || buf.length < 8) return;
  const n = Math.min(buf.length, 1800);
  const slice = buf.slice(buf.length - n);
  const mid = h / 2, amp = (h / 2 - 12) * gain;
  line(ctx, slice.map((v, i) => [6 + (i / (n - 1)) * (w - 12), mid - v * amp]), p.ecg, 1.6);
  label(ctx, lead, 8, 12, p.text2, 10.5, 'left', '700');
}

/* A self-contained twelve-lead + rhythm strip that any workspace can embed. */
export class LeadPanel {
  constructor({ height = 330, strip = true } = {}) {
    this.buffers = Object.fromEntries(LEADS.map((l) => [l, []]));
    this.gain = 1.6;
    this.grid = el('canvas', { style: { width: '100%', height: `${height}px`, display: 'block' } });
    this.strip = strip
      ? el('canvas', { style: { width: '100%', height: '110px', display: 'block', marginTop: '10px' } })
      : null;
    this.node = el('div', { class: 'lead-panel' }, this.grid, this.strip);
  }
  reset() { for (const l of LEADS) this.buffers[l].length = 0; }
  push(snap) {
    const leads = snap.ecgLeads;
    if (leads) {
      for (const l of LEADS) {
        const add = leads[l];
        if (!add || !add.length) continue;
        const b = this.buffers[l];
        b.push(...add);
        if (b.length > 4000) b.splice(0, b.length - 4000);
      }
    }
    this.draw();
  }
  draw() {
    guard('case.ecg.grid', () => drawTwelveLead(this.grid, this.buffers, this.gain));
    if (this.strip) guard('case.ecg.strip', () => drawRhythm(this.strip, this.buffers, this.gain));
  }
  resize() { this.draw(); }
}

export class EcgView {
  constructor({ send, patient }) {
    this.send = send;
    this.patient = patient;
    this.buffers = Object.fromEntries(LEADS.map((l) => [l, []]));
    this.catalog = [];
    this.pathology = 'normal';
    this.sweep = 0;
    this.gain = 1;

    this.gridCanvas = el('canvas', { style: { width: '100%', height: '470px', display: 'block' } });
    this.stripCanvas = el('canvas', { style: { width: '100%', height: '130px', display: 'block' } });
    this.axisCanvas = el('canvas', { style: { width: '100%', height: '250px', display: 'block' } });

    this.libNode = el('div', { class: 'lib' });
    this.descNode = el('div', { class: 'ecg-desc' });
    this.territoryNode = el('div', { class: 'terr' });

    this.node = el('div', { class: 'split ecg-split' },
      el('div', { class: 'stack' },
        card('12-lead', '25 mm/s, 10 mm/mV — the standard calibration, so the squares mean what you expect.',
          el('div', { class: 'toolbar' },
            el('span', { class: 'eyebrow' }, 'Gain'),
            el('div', { class: 'chips' },
              ...[['½', 0.8], ['1', 1.6], ['2', 3.2]].map(([lbl, g]) => el('button', {
                class: 'chip' + (g === 1.6 ? ' on' : ''),
                onclick: (e) => {
                  for (const b of e.currentTarget.parentElement.children) b.classList.remove('on');
                  e.currentTarget.classList.add('on'); this.gain = g;
                },
              }, lbl)))),
          this.gridCanvas),
        card('Rhythm strip — lead II', 'A long look at one lead is how rhythm is actually read.',
          this.stripCanvas),
        card('Systematic reading', 'The order matters: it stops you finding the dramatic thing and missing the diagnosis.',
          el('ol', { class: 'reading' },
            ...READING.map((r) => el('li', {},
              el('strong', {}, r.t), ' — ', r.q))))),
      el('div', { class: 'stack' },
        card('Library', 'Twenty-nine patterns, each one generated by the model rather than drawn.',
          this.libNode, this.descNode),
        card('Frontal plane axis', 'Cabrera sequence — the leads in their true anatomical order.',
          this.axisCanvas),
        card('Coronary territories', 'Which artery, which leads, which reciprocal changes.',
          this.territoryNode)),
    );

    this.renderTerritories();
  }

  setCatalog(list) {
    this.catalog = list;
    clear(this.libNode);
    const byCat = new Map();
    for (const p of list) {
      if (!byCat.has(p.category)) byCat.set(p.category, []);
      byCat.get(p.category).push(p);
    }
    for (const [cat, items] of byCat) {
      this.libNode.append(
        el('div', { class: 'sec-head' }, cat),
        el('div', { class: 'lib-row' },
          ...items.map((p) => el('button', {
            class: 'chip' + (p.id === this.pathology ? ' on' : ''),
            data: { path: p.id },
            onclick: () => this.pick(p.id),
          }, p.name))));
    }
    this.describe();
  }

  pick(id) {
    this.pathology = id;
    for (const b of this.libNode.querySelectorAll('[data-path]')) {
      b.classList.toggle('on', b.dataset.path === id);
    }
    this.send({ type: 'setPathology', id });
    this.describe();
  }

  describe() {
    const p = this.catalog.find((x) => x.id === this.pathology);
    clear(this.descNode);
    if (!p) return;
    this.descNode.append(
      el('div', { class: 'ecg-desc-t' }, p.name),
      el('p', {}, p.description));
  }

  renderTerritories() {
    clear(this.territoryNode);
    for (const t of TERRITORIES || []) {
      this.territoryNode.append(
        el('button', { class: 'terr-row', onclick: () => t.pathId && this.pick(t.pathId) },
          el('span', { class: 'terr-a', style: { background: t.color || 'var(--aortic)' } }),
          el('span', { class: 'terr-b' },
            el('span', { class: 'terr-n' }, t.name),
            el('span', { class: 'terr-l' },
              `Leads ${(t.leads || []).join(', ')}`,
              t.reciprocal && t.reciprocal.length ? `  ·  reciprocal ${t.reciprocal.join(', ')}` : ''),
            t.artery && el('span', { class: 'terr-v' }, t.artery))));
    }
  }

  push(snap) {
    const leads = snap.ecgLeads;
    if (leads) {
      for (const l of LEADS) {
        const add = leads[l];
        if (!add || !add.length) continue;
        const b = this.buffers[l];
        b.push(...add);
        if (b.length > 4000) b.splice(0, b.length - 4000);
      }
    }
    this.snap = snap;
    this.draw();
  }

  draw() {
    guard('ecg.grid', () => this.drawGrid());
    guard('ecg.strip', () => this.drawStrip());
    guard('ecg.axis', () => this.drawAxis());
  }

  /* ---- the 12-lead panel: 3 rows x 4 columns, as printed ----------------- */
  drawGrid() { drawTwelveLead(this.gridCanvas, this.buffers, this.gain); }


  drawStrip() { drawRhythm(this.stripCanvas, this.buffers, this.gain); }


  /* ---- the axis wheel ---------------------------------------------------- */
  drawAxis() {
    const g = fit(this.axisCanvas);
    if (!g) return;
    const { ctx, w, h } = g;
    const p = palette();
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.36;

    // normal-axis sector, -30 to +90
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, (-30 * Math.PI) / 180, (90 * Math.PI) / 180);
    ctx.closePath();
    ctx.fillStyle = withAlpha(p.good, 0.10); ctx.fill();

    for (const lead of CABRERA) {
      const a = (LEAD_ANGLE[lead] * Math.PI) / 180;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      ctx.strokeStyle = p.hairline; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      label(ctx, lead, cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14), p.muted, 9, 'center', '600');
    }

    const axis = this.snap?.qrsAxis ?? 60;
    const a = (axis * Math.PI) / 180;
    ctx.strokeStyle = p.rose; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, Math.PI * 2); ctx.fillStyle = p.rose; ctx.fill();

    const cls = axis < -30 ? 'Left axis deviation'
      : axis > 90 ? 'Right axis deviation'
      : 'Normal axis';
    sans(ctx, `${Math.round(axis)}°`, cx, 16, p.text, 13, 'center', '700');
    label(ctx, cls, cx, h - 8, axis < -30 || axis > 90 ? p.warn : p.good, 9.5, 'center', '600');
  }

  resize() { this.draw(); }
}
