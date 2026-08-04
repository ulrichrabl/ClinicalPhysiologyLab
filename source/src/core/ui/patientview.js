import { el, clear, card, slider, fmt } from './kit.js';
import { CHANNELS, channelStatus } from '../patient.js';

/* ---------------------------------------------------------------------------
   The Patient workspace.

   This is the screen that makes the framework a framework rather than a folder
   of unrelated simulators. It shows the shared physiological state, every
   coupling that is currently firing, and *why*.

   The design intent is that a learner who changes potassium here should be able
   to trace, without being told, why the T waves in the ECG workspace changed
   shape — and a learner who places a cervical cord lesion in the neuro
   workspace should find the explanation for the new blood pressure here.
--------------------------------------------------------------------------- */
export class PatientView {
  constructor({ patient, onNavigate }) {
    this.patient = patient;
    this.onNavigate = onNavigate || (() => {});
    this.sliders = new Map();

    this.labsNode = el('div', { class: 'labs' });
    this.couplingNode = el('div', { class: 'couplings' });
    this.drugNode = el('div', { class: 'bench' });

    this.node = el('div', { class: 'split patient-split' },
      el('div', { class: 'stack' },
        card('Shared state',
          'One patient, read and written by every domain. Nothing here belongs to a specialty.',
          this.labsNode),
        card('Interventions', 'Drugs act on receptors, and receptors are not confined to one organ.',
          this.drugNode,
          el('div', { class: 'btn-row' },
            el('button', { class: 'btn ghost sm', onclick: () => this.patient.reset() }, 'Reset patient')))),
      el('div', { class: 'stack' },
        card('Active mechanisms',
          'Typed physiological mechanisms resolved by the Patient Runtime — '
          + 'open one to read why it is firing.',
          this.couplingNode)),
    );

    this.buildLabs();
    this.buildDrugs();
    this.refresh();
    patient.on(() => this.refresh());
  }

  buildLabs() {
    clear(this.labsNode);
    const groups = new Map();
    for (const [key, ch] of Object.entries(CHANNELS)) {
      if (ch.group === 'Drugs') continue;
      if (!groups.has(ch.group)) groups.set(ch.group, []);
      groups.get(ch.group).push([key, ch]);
    }
    for (const [group, entries] of groups) {
      const rows = entries.map(([key, ch]) => {
        if (ch.derived) {
          const v = el('span', { class: 'lab-v' }, '—');
          this.sliders.set(key, { set: (x) => { v.textContent = ch.text ? (x ?? '—') : fmt.n(x, x != null && Math.abs(x) < 10 ? 1 : 0); }, node: null, valueEl: v, derived: true });
          return el('div', { class: 'lab-row derived' },
            el('span', { class: 'lab-l' }, ch.label),
            v,
            el('span', { class: 'lab-u' }, ch.unit),
            el('span', { class: 'lab-tag' }, 'derived'));
        }
        const s = slider({
          label: ch.label, key, min: ch.lo, max: ch.hi, step: ch.step,
          value: this.patient.get(key), unit: ch.unit,
          format: (v) => (ch.step < 1 ? v.toFixed(ch.step < 0.05 ? 2 : 1) : String(Math.round(v))),
          hint: ch.normal ? `normal ${ch.normal[0]}–${ch.normal[1]}` : '',
          onInput: (k, v) => this.patient.set(k, v),
        });
        this.sliders.set(key, s);
        return s.node;
      });
      this.labsNode.append(el('div', { class: 'bench-group' },
        el('div', { class: 'sec-head' }, group), ...rows));
    }
  }

  buildDrugs() {
    clear(this.drugNode);
    const rows = Object.entries(CHANNELS).filter(([, ch]) => ch.group === 'Drugs').map(([key, ch]) => {
      const s = slider({
        label: ch.label, key, min: 0, max: 1, step: 0.05,
        value: this.patient.get(key), unit: '',
        format: (v) => (v === 0 ? 'off' : `${Math.round(v * 100)}%`),
        onInput: (k, v) => this.patient.set(k, v),
      });
      this.sliders.set(key, s);
      return s.node;
    });
    this.drugNode.append(el('div', { class: 'bench-group' }, ...rows));
  }

  refresh() {
    const st = this.patient.all();
    for (const [k, s] of this.sliders) {
      if (s.derived) { s.set(st[k]); continue; }
      const input = s.node?.querySelector('input');
      if (input && document.activeElement === input) continue;
      if (st[k] != null) s.set(st[k]);
      const status = channelStatus(k, st[k]);
      s.node?.classList.toggle('warn', status === 'warn');
      s.node?.classList.toggle('danger', status === 'danger');
    }
    this.renderCouplings();
  }

  renderCouplings() {
    clear(this.couplingNode);
    const active = this.patient.activeCouplings();
    if (!active.length) {
      this.couplingNode.append(el('p', { class: 'empty' },
        'No mechanisms are currently active — the patient is within normal limits and on no drugs. '
        + 'Move potassium out of range, raise the intracranial pressure, or place a cervical cord '
        + 'lesion in Neurology, and the links will appear here.'));
      return;
    }
    for (const c of active) {
      const open = el('p', { class: 'cpl-why', hidden: true }, c.why);
      const head = el('button', {
        class: 'cpl-head',
        onclick: () => { open.hidden = !open.hidden; head.classList.toggle('open', !open.hidden); },
      },
        el('span', { class: `cpl-dot ${c.level}` }),
        el('span', { class: 'cpl-b' },
          el('span', { class: 'cpl-n' }, c.name),
          el('span', { class: 'cpl-s' }, c.short)),
        el('span', { class: 'cpl-arrow' }, `→ ${c.to}`));
      this.couplingNode.append(
        el('div', { class: `cpl ${c.level}` },
          head,
          el('div', { class: 'cpl-state' }, c.status),
          open,
          el('div', { class: 'btn-row' },
            el('button', { class: 'btn ghost sm', onclick: () => this.onNavigate(c.to) },
              `Open ${c.to} →`))),
      );
    }
  }

  resize() {}
}
