import { el, clear, card } from '../../../core/ui/kit.js';
import { fit, palette, label, sans, withAlpha } from '../../../core/ui/draw.js';
import { TERRITORIES } from '../data/cases.js';
import { guard } from '../../../core/diagnostics.js';
import { captureEcg } from '../../../core/capture.js';
import {
  LEADS,
  drawMonitorTwelveLead,
  drawMonitorRhythm,
  freezeBuffers,
  openPaperEcg,
} from './ecg-display.js';

/* Cabrera order puts the limb leads in anatomical sequence around the frontal
   plane instead of the historical accident of I, II, III, aVR, aVL, aVF. */
const CABRERA = ['aVL', 'I', '-aVR', 'II', 'aVF', 'III'];
const LEAD_ANGLE = { I: 0, II: 60, III: 120, aVR: -150, aVL: -30, aVF: 90, '-aVR': 30 };

const BUF_CAP = 6000;

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
  drawMonitorTwelveLead(canvas, buffers, gain);
}

export function drawRhythm(canvas, buffers, gain = 1, lead = 'II') {
  drawMonitorRhythm(canvas, buffers, gain, lead);
}

function appendLeads(buffers, leads) {
  if (!leads) return;
  for (const l of LEADS) {
    const add = leads[l];
    if (!add || !add.length) continue;
    const b = buffers[l];
    for (let i = 0; i < add.length; i++) b.push(add[i]);
    if (b.length > BUF_CAP) b.splice(0, b.length - BUF_CAP);
  }
}

/* A self-contained twelve-lead + rhythm strip that any workspace can embed. */
export class LeadPanel {
  constructor({ height = 330, strip = true } = {}) {
    this.buffers = Object.fromEntries(LEADS.map((l) => [l, []]));
    this.gain = 1;
    this.grid = el('canvas', { style: { width: '100%', height: `${height}px`, display: 'block' } });
    this.strip = strip
      ? el('canvas', { style: { width: '100%', height: '110px', display: 'block', marginTop: '10px' } })
      : null;
    this.node = el('div', { class: 'lead-panel' }, this.grid, this.strip);
  }
  reset() { for (const l of LEADS) this.buffers[l].length = 0; }
  push(snap) {
    appendLeads(this.buffers, snap.ecgLeads);
    this.draw();
  }
  draw() {
    guard('case.ecg.grid', () => drawTwelveLead(this.grid, this.buffers, this.gain));
    if (this.strip) guard('case.ecg.strip', () => drawRhythm(this.strip, this.buffers, this.gain));
  }
  resize() { this.draw(); }
}

export class EcgView {
  constructor({ send, patient, getSnap }) {
    this.send = send;
    this.patient = patient;
    this.getSnap = getSnap;
    this.buffers = Object.fromEntries(LEADS.map((l) => [l, []]));
    this.catalog = [];
    this.pathology = 'normal';
    this.gain = 1;

    this.gridCanvas = el('canvas', { style: { width: '100%', height: '470px', display: 'block' } });
    this.stripCanvas = el('canvas', { style: { width: '100%', height: '130px', display: 'block' } });
    this.axisCanvas = el('canvas', { style: { width: '100%', height: '250px', display: 'block' } });

    this.libNode = el('div', { class: 'lib' });
    this.descNode = el('div', { class: 'ecg-desc' });
    this.territoryNode = el('div', { class: 'terr' });

    this.node = el('div', { class: 'split ecg-split' },
      el('div', { class: 'stack' },
        card('12-lead monitor', 'Live scroll at 25 mm/s — like a bedside monitor, not a beat snapshot.',
          el('div', { class: 'toolbar' },
            el('span', { class: 'eyebrow' }, 'Gain'),
            el('div', { class: 'chips' },
              ...[['½', 0.5], ['1', 1], ['2', 2]].map(([lbl, g]) => el('button', {
                class: 'chip' + (g === 1 ? ' on' : ''),
                onclick: (e) => {
                  for (const b of e.currentTarget.parentElement.children) b.classList.remove('on');
                  e.currentTarget.classList.add('on'); this.gain = g;
                },
              }, lbl))),
            el('div', { class: 'rail-spacer' }),
            el('button', {
              class: 'chip on',
              title: 'Freeze a classical paper 12-lead + rhythm strip',
              onclick: () => this.takeEcg(),
            }, 'Take ECG'),
            el('button', {
              class: 'chip',
              title: 'Save AI-readable ECG snapshot + metadata (Shift+C)',
              onclick: () => {
                const note = prompt('Capture note (what just changed / what looks wrong)?') || '';
                captureEcg({ note });
              },
            }, 'Capture')),
          this.gridCanvas),
        card('Rhythm strip — lead II', 'Continuous scroll. The bright bar marks the newest sample.',
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

  takeEcg() {
    const frozen = freezeBuffers(this.buffers);
    const enough = (frozen.II || []).length >= SAMPLE_MIN;
    if (!enough) {
      /* Prime then try once more after a short settle — still open what we have. */
      this.send({ type: 'prime' });
    }
    const p = this.catalog.find((x) => x.id === this.pathology);
    const snap = this.getSnap?.() || this.snap;
    openPaperEcg({
      buffers: frozen,
      gain: this.gain,
      pathologyName: p?.name || this.pathology,
      HR: snap?.HR ?? snap?.metrics?.HR,
      axis: snap?.qrsAxis ?? snap?.metrics?.qrsAxis,
    });
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
    for (const l of LEADS) this.buffers[l].length = 0;
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
    appendLeads(this.buffers, snap.ecgLeads);
    this.snap = snap;
    if (this.node.isConnected) this.draw();
  }

  draw() {
    guard('ecg.grid', () => this.drawGrid());
    guard('ecg.strip', () => this.drawStrip());
    guard('ecg.axis', () => this.drawAxis());
  }

  drawGrid() { drawTwelveLead(this.gridCanvas, this.buffers, this.gain); }
  drawStrip() { drawRhythm(this.stripCanvas, this.buffers, this.gain); }

  drawAxis() {
    const g = fit(this.axisCanvas);
    if (!g) return;
    const { ctx, w, h } = g;
    const p = palette();
    const cx = w / 2, cy = h / 2 + 6;
    const R = Math.min(w, h) * 0.36;

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

  resize() {
    const ii = this.buffers.II;
    if (ii.length < 200) {
      this.send({ type: 'prime' });
    } else {
      const tail = ii.slice(-800);
      const span = Math.max(...tail) - Math.min(...tail);
      if (span < 0.06) this.send({ type: 'prime' });
    }
    this.draw();
  }
}

const SAMPLE_MIN = 200;
