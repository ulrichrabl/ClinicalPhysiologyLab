import { el, clear, card, slider, fmt } from '../../../core/ui/kit.js';
import { Wiggers } from './wiggers.js';
import { PVLoop } from './pvloop.js';
import { HeartView } from './heart.js';
import { BENCH, PHASES } from '../data/reference.js';
import { guard } from '../../../core/diagnostics.js';

/* ---------------------------------------------------------------------------
   Circulation workspace.

   The Wiggers strip is the spine of this screen. Drag anywhere on it and the
   pressure-volume loop, the heart schematic and every readout jump to that
   instant. Linking the electrical trace to the pressures to the volumes to the
   valve clicks is the single hardest step in learning cardiac physiology, and
   almost every textbook presents those five things on separate pages.

   Double-click the strip to release the cursor and return to live.
--------------------------------------------------------------------------- */
export class LoopView {
  constructor({ patient, send, onParam }) {
    this.patient = patient;
    this.send = send;
    this.onParam = onParam || (() => {});
    this.snap = null;
    this.cursorFrac = null;
    this.sliders = new Map();

    this.wCanvas = el('canvas', { style: { width: '100%', height: '300px', display: 'block' } });
    this.pvCanvas = el('canvas', { style: { width: '100%', height: '270px', display: 'block' } });
    this.hCanvas = el('canvas', { style: { width: '100%', height: '290px', display: 'block' } });

    this.wiggers = new Wiggers(this.wCanvas, { onCursor: (f) => { this.cursorFrac = f; this.redraw(); } });
    this.pv = new PVLoop(this.pvCanvas);
    this.heart = new HeartView(this.hCanvas);

    this.phaseNode = el('div', { class: 'phases' },
      ...PHASES.map((p) => el('div', { class: 'phase', data: { phase: p.id } },
        el('span', { class: 'phase-dot', style: { background: p.color } }),
        el('span', { class: 'phase-l' }, p.label))));
    this.phaseWhy = el('p', { class: 'phase-why' });

    this.chainNode = el('div', { class: 'chain' });
    this.baroNode = el('div', { class: 'baro' });
    this.cursorReadout = el('div', { class: 'cursor-read' });

    this.node = el('div', { class: 'loop-grid' },
      el('div', { class: 'loop-main' },
        card('Cardiac cycle',
          'Pressures and volumes are one beat; the ECG row scrolls live like a monitor. Drag the cursor on the haemodynamics. Double-click to release.',
          this.wCanvas,
          this.phaseNode,
          this.phaseWhy,
          this.cursorReadout),
        el('div', { class: 'split2' },
          card('Pressure–volume loop', 'Area inside the loop is the stroke work.', this.pvCanvas),
          card('The circulation', 'A closed ring. Chamber size tracks volume, wall brightness tracks pressure, and the particles move at the real flow rate.', this.hCanvas)),
        card('Why it changed', 'The causal chain from the parameter you moved to the number you are watching.',
          this.chainNode)),
      el('div', { class: 'loop-side' },
        this.benchCard(),
        card('Baroreflex', 'The negative feedback loop that defends mean pressure.', this.baroNode)),
    );
  }

  benchCard() {
    const groups = BENCH.map((g) => {
      const items = g.items.map((it) => {
        const s = slider({
          label: it.label, key: it.key, min: it.min, max: it.max, step: it.step,
          value: it.def, unit: it.unit, format: it.fmt,
          onInput: (k, v) => this.onParam(k, v),
        });
        s.node.style.setProperty('--tint', it.tint || 'var(--rose)');
        s.node.dataset.inspect = it.key;
        s.meta = it;
        this.sliders.set(it.key, s);
        return s.node;
      });
      return el('div', { class: 'bench-group' },
        el('div', { class: 'sec-head' }, g.group),
        ...items);
    });
    const reset = el('button', { class: 'btn ghost sm', onclick: () => {
      for (const [k, s] of this.sliders) { const d = s.meta.def; s.set(d); this.onParam(k, d); }
    } }, 'Reset all');
    return card('Bench', 'Every control is a real term in the model.',
      el('div', { class: 'bench' }, ...groups),
      el('div', { class: 'btn-row' }, reset));
  }

  /* Called when a coupling from another domain is driving a parameter, so the
     learner can see that the slider is no longer the thing in charge. */
  markDriven(keys) {
    for (const [k, s] of this.sliders) s.highlight(keys.has(k));
  }

  syncSliders(snap) {
    for (const [k, s] of this.sliders) {
      const v = snap[k];
      if (v == null) continue;
      if (document.activeElement === s.node.querySelector('input')) continue;
      s.set(typeof v === 'number' ? Number(v.toFixed(4)) : v);
    }
  }

  push(snap) {
    this.snap = snap;
    guard('cardio.wiggers.push', () => this.wiggers.push(snap));
    guard('cardio.pvloop.push', () => this.pv.push(snap));
    this.redraw();
  }

  redraw() {
    if (!this.snap) return;
    const c = this.wiggers.cursorSample();
    const view = c ? { ...this.snap, ...this.sampleToState(c.sample) } : this.snap;

    guard('cardio.wiggers', () => this.wiggers.draw(this.snap));
    guard('cardio.pvloop', () => this.pv.draw(c ? c.sample : null));
    guard('cardio.heart', () => this.heart.draw(view));

    const phase = guard('cardio.phase', () => this.wiggers.currentPhase(this.snap));
    for (const n of this.phaseNode.children) n.classList.toggle('on', n.dataset.phase === phase);
    const ph = PHASES.find((p) => p.id === phase);
    this.phaseWhy.textContent = ph ? ph.body || '' : '';

    guard('cardio.cursor', () => this.renderCursor(c));
    guard('cardio.baro', () => this.renderBaro(this.snap));
  }

  /* A recorded sample only holds the fields the recorder saves; map them onto
     the shape the schematic expects. */
  sampleToState(s) {
    return {
      P: s.Pa, Pv: s.Pv, Pla: s.Pla, V: s.V, Vla: s.Vla,
      Ppa: s.Ppa, Pra: s.Pra, Prv: s.Prv,
      Qeject: s.Qao, Qfill: s.Qmit, Qven: s.Qsys, Qpv: s.Qmit * 0.3,
      Qtri: s.Qmit * 0.9, Qpulv: s.Qao * 0.9,
      en: s.en, ea: 0,
      aorticOpen: s.Qao > 1, mitralOpen: s.Qmit > 1,
      tricuspidOpen: s.Qmit > 1, pulmonicOpen: s.Qao > 1,
    };
  }

  renderCursor(c) {
    clear(this.cursorReadout);
    if (!c) {
      this.cursorReadout.append(el('span', { class: 'muted' },
        'Live — drag on the strip to freeze an instant.'));
      return;
    }
    const s = c.sample;
    const rows = [
      ['t', `${Math.round(s.t)} ms`, 'muted'],
      ['Aortic', `${s.Pa.toFixed(0)} mmHg`, 'aortic'],
      ['LV', `${s.Pv.toFixed(0)} mmHg`, 'lv'],
      ['LA', `${s.Pla.toFixed(0)} mmHg`, 'la'],
      ['Volume', `${s.V.toFixed(0)} mL`, 'volume'],
      ['Aortic flow', `${s.Qao.toFixed(0)} mL/s`, 'aortic'],
    ];
    for (const [k, v, tone] of rows) {
      this.cursorReadout.append(el('span', { class: `cr ${tone}` },
        el('span', { class: 'cr-k' }, k), el('span', { class: 'cr-v' }, v)));
    }
  }

  renderBaro(snap) {
    clear(this.baroNode);
    const on = snap.baroEnabled;
    const toggle = el('button', {
      class: 'btn sm' + (on ? '' : ' ghost'),
      onclick: () => this.send({ type: 'setBaro', value: !on }),
    }, on ? 'Reflex active' : 'Reflex off (open loop)');

    const bar = (label, v, color) => el('div', { class: 'vital-bar-row' },
      el('span', { class: 'vb-l' }, label),
      el('span', { class: 'vital-bar' },
        el('span', { style: { width: `${Math.max(0, Math.min(100, v * 100))}%`, background: color } })),
      el('span', { class: 'vb-v' }, fmt.pct(v * 100)));

    this.baroNode.append(
      el('div', { class: 'btn-row' }, toggle),
      bar('Sympathetic', snap.sympathetic ?? 0, 'var(--aortic)'),
      bar('Parasympathetic', snap.parasympathetic ?? 0, 'var(--la)'),
      el('p', { class: 'hint' }, on
        ? 'Baroreceptors compare mean pressure with the set point and adjust rate, contractility '
          + 'and resistance to close the gap. Move the resistance slider and watch rate answer.'
        : 'With the loop open, parameters act in isolation — useful for seeing a mechanism, '
          + 'misleading about what a real patient would do.'),
    );
  }

  setChain(items) {
    clear(this.chainNode);
    if (!items || !items.length) {
      this.chainNode.append(el('p', { class: 'hint' },
        'Move a control and the chain of consequences appears here.'));
      return;
    }
    items.forEach((it, i) => {
      this.chainNode.append(
        el('span', { class: `chain-node ${it.tone || ''}` },
          el('span', { class: 'cn-k' }, it.label),
          el('span', { class: 'cn-v' }, it.value)),
        i < items.length - 1 && el('span', { class: 'chain-arrow' }, '→'));
    });
  }

  captureGhost() { this.wiggers.captureGhost(); this.pv.captureGhost(); }
  clearGhost() { this.wiggers.clearGhost(); this.pv.clearGhost(); }
  resize() { this.redraw(); }
}
