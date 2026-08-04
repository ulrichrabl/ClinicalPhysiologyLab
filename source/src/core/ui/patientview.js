import { el, clear, card, slider, fmt } from './kit.js';
import { CHANNELS, channelStatus } from '../patient.js';
import { createCommandId } from '../../runtime/patient-runtime.ts';
import { listScenarios } from '../../scenarios/index.ts';

/* ---------------------------------------------------------------------------
   The Patient workspace (ADR-009 Patient layer).

   Clinical summary, active scenario, shared channels, and mechanisms —
   all sourced from the Patient Runtime.
--------------------------------------------------------------------------- */
export class PatientView {
  constructor({ patient, runtime, onNavigate }) {
    this.patient = patient;
    this.runtime = runtime || patient?.runtime || null;
    this.onNavigate = onNavigate || (() => {});
    this.sliders = new Map();

    this.summaryNode = el('div', { class: 'exam-block' });
    this.scenarioNode = el('div', { class: 'exam-block' });
    this.labsNode = el('div', { class: 'labs' });
    this.couplingNode = el('div', { class: 'couplings' });
    this.drugNode = el('div', { class: 'bench' });
    this.annotationsNode = el('div', { class: 'exam-block' });

    this.node = el('div', { class: 'split patient-split' },
      el('div', { class: 'stack' },
        card('Clinical summary',
          'What the runtime currently knows about this patient.',
          this.summaryNode),
        card('Scenario',
          'Load a compiled scenario — seed commands go through dispatch.',
          this.scenarioNode),
        card('Shared state',
          'Learner-editable inputs and haemodynamic projections from public state.',
          this.labsNode),
        card('Interventions', 'Drug channels resolved as mechanisms by the runtime.',
          this.drugNode,
          el('div', { class: 'btn-row' },
            el('button', { class: 'btn ghost sm', onclick: () => this.patient.reset() }, 'Reset patient')))),
      el('div', { class: 'stack' },
        card('Active mechanisms',
          'Typed physiological mechanisms resolved by the Patient Runtime.',
          this.couplingNode),
        card('Scenario notes',
          'Trigger annotations from the active scenario.',
          this.annotationsNode)),
    );

    this.buildScenario();
    this.buildLabs();
    this.buildDrugs();
    this.refresh();
    patient.on(() => this.refresh());
    this.runtime?.subscribe?.(() => this.refresh());
  }

  buildScenario() {
    clear(this.scenarioNode);
    const scenarios = listScenarios();
    for (const s of scenarios) {
      this.scenarioNode.append(
        el('div', { class: 'cpl' },
          el('div', { class: 'cpl-n' }, s.title),
          el('p', { class: 'muted' }, s.learningObjectives?.[0] || ''),
          el('div', { class: 'btn-row' },
            el('button', {
              class: 'btn sm',
              onclick: () => this.loadScenario(s.id),
            }, 'Start scenario'),
            el('button', {
              class: 'btn ghost sm',
              onclick: () => this.clearScenario(),
            }, 'Clear'))),
      );
    }
  }

  loadScenario(id) {
    if (!this.runtime) return;
    this.runtime.dispatch({
      id: createCommandId(),
      type: 'scenario.load',
      payload: { scenarioId: id },
      source: { type: 'ui', surface: 'patient' },
    });
    this.runtime.dispatch({
      id: createCommandId(),
      type: 'runtime.advance',
      payload: { durationMs: 5000 },
      source: { type: 'ui', surface: 'patient' },
    });
    this.refresh();
  }

  clearScenario() {
    if (!this.runtime) return;
    this.runtime.dispatch({
      id: createCommandId(),
      type: 'scenario.clear',
      payload: {},
      source: { type: 'ui', surface: 'patient' },
    });
    this.refresh();
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
    this.renderSummary();
    this.renderCouplings();
    this.renderAnnotations();
  }

  renderSummary() {
    clear(this.summaryNode);
    if (!this.runtime) {
      this.summaryNode.append(el('p', { class: 'empty' }, 'Runtime not bound.'));
      return;
    }
    const summary = this.runtime.query({
      type: 'state.projection',
      projection: 'clinicalSummary',
    });
    const scen = this.runtime.activeScenario?.();
    const vitals = summary?.vitals || {};
    const bp = vitals.bloodPressure || {};
    this.summaryNode.append(
      el('p', {},
        scen
          ? `Active scenario: ${scen.definition.title}`
          : 'No scenario loaded — baseline physiology.'),
      el('p', {},
        `HR ${vitals.heartRate == null ? '—' : Math.round(vitals.heartRate)} · `
        + `BP ${bp.systolic == null ? '—' : `${Math.round(bp.systolic)}/${Math.round(bp.diastolic ?? 0)}`} · `
        + `MAP ${bp.mean == null ? '—' : Math.round(bp.mean)}`),
      el('p', { class: 'muted' },
        (summary?.activeConditions || []).length
          ? `Conditions: ${summary.activeConditions.map((c) => c.conditionId).join(', ')}`
          : 'No active conditions.'),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn ghost sm', onclick: () => this.onNavigate('examine') },
          'Examine →'),
        el('button', { class: 'btn ghost sm', onclick: () => this.onNavigate('investigate') },
          'Investigate →'),
        el('button', { class: 'btn ghost sm', onclick: () => this.onNavigate('treat') },
          'Treat →')),
    );
  }

  renderAnnotations() {
    clear(this.annotationsNode);
    const notes = this.runtime?.scenarioAnnotationList?.() || [];
    if (!notes.length) {
      this.annotationsNode.append(el('p', { class: 'empty' },
        'Scenario triggers will leave teaching notes here when they fire.'));
      return;
    }
    for (const n of notes) {
      this.annotationsNode.append(
        el('div', { class: 'abg-step' },
          el('div', { class: 'abg-k' }, n.id),
          el('div', { class: 'abg-f' }, n.label)));
    }
  }

  renderCouplings() {
    clear(this.couplingNode);
    const active = this.patient.activeCouplings();
    if (!active.length) {
      this.couplingNode.append(el('p', { class: 'empty' },
        'No mechanisms are currently active — the patient is within normal limits and on no drugs. '
        + 'Start the neurogenic shock scenario, or explore a specialty lens.'));
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
