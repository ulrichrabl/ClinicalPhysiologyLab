import { el, clear, card, slider } from '../../../core/ui/kit.js';
import { ANALYTES, PANELS, LAB_DEFAULTS, derived, interpretABG, LAB_LINKS } from '../data/labs.js';

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

/* A read-only results card. Cases render their own panel with this rather than
   writing into the patient's results — a worked example is not the patient in
   front of you, and letting it overwrite them meant the simulation could never
   write a lab value again once you had opened a case. */
export function renderResults(host, labs, opts = {}) {
  clear(host);
  for (const panel of PANELS) {
    const keys = panel.keys.filter((k) => labs[k] != null);
    if (opts.onlyAbnormal) {
      // keep the panel if anything in it is flagged
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
  constructor({ patient, getLabs, setLab, onNavigate }) {
    this.patient = patient;
    this.getLabs = getLabs;
    this.setLab = setLab;
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

  reset() { for (const [k, v] of Object.entries(LAB_DEFAULTS)) this.setLab(k, v); }

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
    this.renderPanels(labs);
    this.renderDerived(labs);
    this.renderABG(labs);
    this.renderLinks(labs);
    for (const [k, s] of this.sliders) {
      const input = s.node.querySelector('input');
      if (input && document.activeElement === input) continue;
      if (labs[k] != null) s.set(labs[k]);
    }
  }

  renderPanels(labs) {
    clear(this.panelsNode);
    for (const panel of PANELS) {
      const rows = panel.keys.map((k) => {
        const a = ANALYTES[k];
        const v = labs[k];
        const flag = flagOf(k, v);
        const driven = this.drivenBy(k, labs);
        return el('div', { class: `lab-line ${flag}` },
          el('span', { class: 'll-n' }, a.label),
          el('span', { class: 'll-v' }, v == null ? '—' : v.toFixed(a.dp)),
          el('span', { class: 'll-f' }, ARROW[flag]),
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

  drivenBy(key, labs) {
    const pt = this.patient.all();
    for (const l of LAB_LINKS) {
      let live = false;
      try { live = l.when(labs, pt); } catch { live = false; }
      if (!live) continue;
      let eff = {};
      try { eff = l.apply(labs, pt) || {}; } catch { eff = {}; }
      if (key in eff) return l.name;
    }
    return null;
  }

  renderDerived(labs) {
    clear(this.derivedNode);
    const d = derived(labs);
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

  renderABG(labs) {
    clear(this.abgNode);
    const r = interpretABG(labs);
    r.steps.forEach((s, i) => {
      this.abgNode.append(el('div', { class: 'abg-step' },
        el('div', { class: 'abg-i' }, String(i + 1)),
        el('div', { class: 'abg-b' },
          el('div', { class: 'abg-k' }, s.step),
          el('div', { class: 'abg-f' }, s.finding),
          el('div', { class: 'abg-n' }, s.note))));
    });
  }

  renderLinks(labs) {
    clear(this.linksNode);
    const pt = this.patient.all();
    const live = LAB_LINKS.filter((l) => { try { return l.when(labs, pt); } catch { return false; } });
    if (!live.length) {
      this.linksNode.append(el('p', { class: 'empty' },
        'Nothing in the rest of the patient is currently driving these results. Cause some hypotension in the '
        + 'Circulation workspace, or take away a litre of blood, and the lactate, urea and haemoglobin here will '
        + 'answer for it.'));
      return;
    }
    for (const l of live) {
      const why = el('p', { class: 'cpl-why', hidden: true }, l.why);
      const head = el('button', { class: 'cpl-head', onclick: () => { why.hidden = !why.hidden; } },
        el('span', { class: 'cpl-dot warn' }),
        el('span', { class: 'cpl-b' },
          el('span', { class: 'cpl-n' }, l.name),
          el('span', { class: 'cpl-s' }, (() => { try { return l.text(labs, pt); } catch { return ''; } })())));
      this.linksNode.append(el('div', { class: 'cpl warn' }, head, why,
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn ghost sm', onclick: () => this.onNavigate('cardio') }, 'Open circulation →'))));
    }
  }

  resize() {}
}
