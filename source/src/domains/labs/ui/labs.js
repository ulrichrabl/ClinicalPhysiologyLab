import { el, clear, card, slider } from '../../../core/ui/kit.js';
import { ANALYTES, PANELS, LAB_DEFAULTS, derived, interpretABG } from '../data/labs.js';

const flagOf = (key, v) => {
  const a = ANALYTES[key];
  if (!a || v == null) return 'normal';
  const [lo, hi] = a.normal;
  const width = hi - lo || 1;
  if (v < lo) return v < lo - width * 0.5 ? 'low2' : 'low';
  if (v > hi) return v > hi + width * 0.8 ? 'high2' : 'high';
  return 'normal';
};

const ARROW = { low: '↓', low2: '↓↓', high: '↑', high2: '↑↑', normal: '' };

const CHEM_EFFECT_KEYS = {
  'hypoperfusion-lactate': ['lactate', 'pH', 'HCO3'],
  'haemorrhage-hb': ['Hb'],
  'renal-perfusion': ['urea', 'creat'],
  'heart-failure-bnp': ['BNP'],
};

/* A read-only results card. Cases render their own panel with this rather than
   writing into the patient's chemistry — a worked example is not the patient in
   front of you. */
export function renderResults(host, labs, opts = {}) {
  clear(host);
  for (const panel of PANELS) {
    const keys = panel.keys.filter((k) => labs[k] != null);
    if (opts.onlyAbnormal) {
      if (!keys.some((k) => flagOf(k, labs[k]) !== 'normal')) continue;
    }
    if (!keys.length) continue;
    host.append(el('div', { class: 'lab-panel' },
      el('div', { class: 'sec-head' }, panel.name),
      ...keys.map((k) => {
        const a = ANALYTES[k], v = labs[k], flag = flagOf(k, v);
        return el('div', { class: `lab-line ${flag}` },
          el('span', { class: 'll-n' }, a.label),
          el('span', { class: 'll-v' }, v.toFixed(a.dp)),
          el('span', { class: 'll-f' }, ARROW[flag]),
          el('span', { class: 'll-u' }, a.unit),
          el('span', { class: 'll-r' }, `${a.normal[0]}–${a.normal[1]}`));
      })));
  }
  const d = derived(labs);
  host.append(el('div', { class: 'lab-panel' },
    el('div', { class: 'sec-head' }, 'Derived'),
    el('div', { class: 'lab-line' },
      el('span', { class: 'll-n' }, 'Anion gap (corrected)'),
      el('span', { class: 'll-v' }, d.anionGapCorrected.toFixed(0)),
      el('span', { class: 'll-f' }, d.anionGapCorrected > 16 ? '↑' : ''),
      el('span', { class: 'll-u' }, 'mmol/L'),
      el('span', { class: 'll-r' }, '8–16')),
    d.deltaRatio != null && Number.isFinite(d.deltaRatio) && el('div', { class: 'lab-line' },
      el('span', { class: 'll-n' }, 'Delta ratio'),
      el('span', { class: 'll-v' }, d.deltaRatio.toFixed(1)),
      el('span', { class: 'll-f' }, ''),
      el('span', { class: 'll-u' }, ''),
      el('span', { class: 'll-r' }, '1–2'))));
}

export class LabsView {
  constructor({ patient, runtime, getLabs, setLab, resetLabs, getObservation, onNavigate }) {
    this.patient = patient;
    this.runtime = runtime || null;
    this.getLabs = getLabs;
    this.setLab = setLab;
    this.resetLabs = resetLabs || (() => {
      for (const [k, v] of Object.entries(LAB_DEFAULTS)) this.setLab(k, v);
    });
    this.getObservation = getObservation || (() => null);
    this.onNavigate = onNavigate || (() => {});
    this.sliders = new Map();
    this.editing = false;

    this.panelsNode = el('div', { class: 'lab-panels' });
    this.derivedNode = el('div', { class: 'lab-derived' });
    this.abgNode = el('div', { class: 'abg' });
    this.linksNode = el('div', { class: 'couplings' });
    this.editNode = el('div', { class: 'bench' });

    this.node = el('div', { class: 'split labs-split' },
      el('div', { class: 'stack' },
        card('Results', 'Values written by the simulation are marked; the rest you can set yourself.',
          el('div', { class: 'toolbar' },
            el('button', { class: 'btn ghost sm', onclick: () => this.toggleEdit() }, 'Edit values'),
            el('button', { class: 'btn ghost sm', onclick: () => this.reset() }, 'Reset to normal')),
          this.panelsNode,
          this.editNode),
        card('Derived', 'The arithmetic nobody should be doing by hand.', this.derivedNode)),
      el('div', { class: 'stack' },
        card('Interpretation', 'One step at a time, with the reasoning shown rather than a verdict to trust.',
          this.abgNode),
        card('Where these numbers came from',
          'Links to the rest of the patient. A lab value is only clinical in context.',
          this.linksNode)),
    );

    this.editNode.hidden = true;
    this.buildEditors();
    this.refresh();
  }

  toggleEdit() {
    this.editing = !this.editing;
    this.editNode.hidden = !this.editing;
  }

  reset() { this.resetLabs(); }

  buildEditors() {
    clear(this.editNode);
    for (const panel of PANELS) {
      const rows = panel.keys.map((k) => {
        const a = ANALYTES[k];
        const s = slider({
          label: a.label, key: k, min: a.lo, max: a.hi, step: a.step,
          value: this.getLabs()[k], unit: a.unit,
          format: (v) => v.toFixed(a.dp),
          onInput: (key, v) => this.setLab(key, v),
        });
        this.sliders.set(k, s);
        return s.node;
      });
      this.editNode.append(el('div', { class: 'bench-group' },
        el('div', { class: 'sec-head' }, panel.name), ...rows));
    }
  }

  refresh() {
    const labs = this.getLabs();
    const obs = this.getObservation();
    this.renderPanels(labs, obs);
    this.renderDerived(labs, obs);
    this.renderABG(labs, obs);
    this.renderLinks(obs);
    for (const [k, s] of this.sliders) {
      const input = s.node.querySelector('input');
      if (input && document.activeElement === input) continue;
      if (labs[k] != null) s.set(labs[k]);
    }
  }

  renderPanels(labs, obs) {
    clear(this.panelsNode);
    const lineByKey = new Map((obs?.value?.lines || []).map((l) => [l.key, l]));
    for (const panel of PANELS) {
      const rows = panel.keys.map((k) => {
        const a = ANALYTES[k];
        const v = labs[k];
        const flag = lineByKey.get(k)?.flag || flagOf(k, v);
        const driven = this.drivenBy(k, obs);
        return el('div', { class: `lab-line ${flag}` },
          el('span', { class: 'll-n' }, a.label),
          el('span', { class: 'll-v' }, v == null ? '—' : v.toFixed(a.dp)),
          el('span', { class: 'll-f' }, ARROW[flag] || ''),
          el('span', { class: 'll-u' }, a.unit),
          el('span', { class: 'll-r' }, `${a.normal[0]}–${a.normal[1]}`),
          driven && el('span', { class: 'll-d', title: driven }, 'sim'));
      });
      this.panelsNode.append(
        el('div', { class: 'lab-panel' },
          el('div', { class: 'sec-head' }, panel.name),
          ...rows));
    }
  }

  drivenBy(key, obs) {
    const line = (obs?.value?.lines || []).find((l) => l.key === key);
    if (line?.source === 'physiology-derived') {
      const hit = (obs.value.activeDerivations || []).find((d) =>
        (CHEM_EFFECT_KEYS[d.id] || []).includes(key));
      return hit?.name || 'Physiology-derived';
    }
    for (const d of obs?.value?.activeDerivations || []) {
      if ((CHEM_EFFECT_KEYS[d.id] || []).includes(key)) return d.name;
    }
    return null;
  }

  renderDerived(labs, obs) {
    clear(this.derivedNode);
    const d = obs?.value?.derived || derived(labs);
    const items = [
      ['Anion gap', d.anionGap.toFixed(0), 'mmol/L', '8–16',
        'Na⁺ − (Cl⁻ + HCO₃⁻). The unmeasured anions.'],
      ['Anion gap, albumin-corrected', d.anionGapCorrected.toFixed(0), 'mmol/L', '8–16',
        'Add 2.5 for every 10 g/L the albumin sits below 42. A low albumin hides a raised gap.'],
      ['Delta ratio', d.deltaRatio == null ? '—' : d.deltaRatio.toFixed(1), '', '1–2',
        'Rise in gap over fall in bicarbonate. Away from 1–2 means more than one metabolic process.'],
      ['Calculated osmolality', d.osmolality.toFixed(0), 'mOsm/kg', '275–295',
        '2×Na⁺ + urea + glucose. Compare with the measured value to find an osmolar gap.'],
      ['Urea : creatinine', d.ureaCreatRatio == null ? '—' : d.ureaCreatRatio.toFixed(0), '', '40–100',
        'Above about 100 suggests a prerenal picture rather than intrinsic renal injury.'],
    ];
    for (const [n, v, u, r, why] of items) {
      this.derivedNode.append(el('div', { class: 'lab-derived-row' },
        el('div', { class: 'ld-top' },
          el('span', { class: 'ld-n' }, n),
          el('span', { class: 'ld-v' }, v),
          el('span', { class: 'll-u' }, u),
          el('span', { class: 'll-r' }, r)),
        el('div', { class: 'ld-w' }, why)));
    }
  }

  renderABG(labs, obs) {
    clear(this.abgNode);
    const r = obs?.value?.interpretation || interpretABG(labs);
    r.steps.forEach((s, i) => {
      this.abgNode.append(el('div', { class: 'abg-step' },
        el('div', { class: 'abg-i' }, String(i + 1)),
        el('div', { class: 'abg-b' },
          el('div', { class: 'abg-k' }, s.step),
          el('div', { class: 'abg-f' }, s.finding),
          el('div', { class: 'abg-n' }, s.note))));
    });
  }

  renderLinks(obs) {
    clear(this.linksNode);
    const live = obs?.value?.activeDerivations || this.runtime?.activeChemistryLinks?.() || [];
    const labs = this.getLabs();
    const extras = [];
    if (labs.K < 3.3 || labs.K > 5.3) {
      extras.push({
        id: 'potassium-ecg',
        name: 'Potassium → the ECG',
        text: `K⁺ ${labs.K.toFixed(1)} mmol/L — channel mechanisms shape the ECG.`,
        why: 'Extracellular potassium is chemistry ground truth. Changing it here updates the '
          + 'runtime channel that the cardiac adapter reads, so T waves change in the ECG workspace.',
      });
    }
    if (labs.Ca < 2.15 || labs.Ca > 2.65) {
      extras.push({
        id: 'calcium-ecg',
        name: 'Calcium → the QT interval',
        text: `Adjusted calcium ${labs.Ca.toFixed(2)} mmol/L.`,
        why: 'Calcium carries the plateau of the ventricular action potential. The runtime '
          + 'projects this chemistry value into the electrophysiology adapter.',
      });
    }
    const all = [...live, ...extras];
    if (!all.length) {
      this.linksNode.append(el('p', { class: 'empty' },
        'Nothing in the rest of the patient is currently driving these results. Cause some hypotension in the '
        + 'Circulation workspace, or take away a litre of blood, and the lactate, urea and haemoglobin here will '
        + 'answer for it.'));
      return;
    }
    for (const l of all) {
      const why = el('p', { class: 'cpl-why', hidden: true }, l.why);
      const head = el('button', { class: 'cpl-head', onclick: () => { why.hidden = !why.hidden; } },
        el('span', { class: 'cpl-dot warn' }),
        el('span', { class: 'cpl-b' },
          el('span', { class: 'cpl-n' }, l.name),
          el('span', { class: 'cpl-s' }, l.text || '')));
      this.linksNode.append(el('div', { class: 'cpl warn' }, head, why,
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn ghost sm', onclick: () => this.onNavigate('cardio') }, 'Open circulation →'))));
    }
  }

  resize() {}
}
