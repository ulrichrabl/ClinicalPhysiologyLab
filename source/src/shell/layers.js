import { el, clear, card } from '../core/ui/kit.js';

function cmdId(runtime, prefix = 'cmd') {
  return runtime?.ids?.command?.(prefix) ?? `cmd_orphan_${Date.now()}`;
}

function unwrapObs(outcome) {
  if (!outcome) return null;
  if (outcome.accepted === false) return { denied: true, error: outcome.error, value: null };
  if (outcome.accepted === true) return outcome.observation;
  return outcome;
}

/** Examine layer — clinical observations via runtime.observe / perform.examination. */
export function createExamineLayer({ runtime }) {
  const appearanceNode = el('div', { class: 'exam-block' });
  const vitalsNode = el('div', { class: 'exam-block' });
  const findingsNode = el('div', { class: 'exam-block' });

  const refresh = () => {
    if (!runtime) return;
    const appearance = unwrapObs(runtime.observe({ type: 'observe.general-appearance' }, { role: 'clinical' }));
    const vitals = unwrapObs(runtime.observe({ type: 'observe.vital-signs' }, { role: 'clinical' }));
    clear(appearanceNode);
    if (appearance?.denied) {
      appearanceNode.append(el('p', { class: 'danger' }, appearance.error?.message || 'Observation denied'));
    } else {
      appearanceNode.append(
        el('div', { class: 'sec-head' }, 'General appearance'),
        el('p', {}, appearance?.value?.appearance || '—'),
        el('p', { class: 'muted' }, appearance?.value?.consciousness || ''),
        el('p', { class: 'muted' }, appearance?.value?.perfusion || ''),
      );
    }
    clear(vitalsNode);
    const v = vitals?.value || {};
    const bp = v.bloodPressure || {};
    vitalsNode.append(
      el('div', { class: 'sec-head' }, 'Vital signs'),
      el('div', { class: 'lab-line' },
        el('span', { class: 'll-n' }, 'Heart rate'),
        el('span', { class: 'll-v' }, v.heartRate == null ? '—' : String(Math.round(v.heartRate))),
        el('span', { class: 'll-u' }, '/min')),
      el('div', { class: 'lab-line' },
        el('span', { class: 'll-n' }, 'Blood pressure'),
        el('span', { class: 'll-v' },
          bp.systolic == null ? '—' : `${Math.round(bp.systolic)}/${Math.round(bp.diastolic ?? 0)}`),
        el('span', { class: 'll-u' }, 'mmHg')),
      el('div', { class: 'lab-line' },
        el('span', { class: 'll-n' }, 'MAP'),
        el('span', { class: 'll-v' }, bp.mean == null ? '—' : String(Math.round(bp.mean))),
        el('span', { class: 'll-u' }, 'mmHg')),
      ...(vitals?.interpretation || []).map((i) =>
        el('div', { class: 'vflag warn' }, i.label)),
    );
  };

  const examine = (exam) => {
    const outcome = unwrapObs(runtime.observe({ type: 'perform.examination', exam }, { role: 'clinical' }));
    if (outcome?.denied) {
      findingsNode.prepend(
        el('div', { class: 'abg-step' },
          el('div', { class: 'abg-k' }, exam),
          el('p', { class: 'danger' }, outcome.error?.message || 'Not permitted')),
      );
      return;
    }
    findingsNode.prepend(
      el('div', { class: 'abg-step' },
        el('div', { class: 'abg-k' }, exam),
        el('ul', {}, ...(outcome?.value?.findings || ['No findings']).map((f) => el('li', {}, f)))),
    );
  };

  const node = el('div', { class: 'split' },
    el('div', { class: 'stack' },
      card('Bedside', 'What you can see and measure without instruments.',
        appearanceNode, vitalsNode,
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn ghost sm', onclick: refresh }, 'Re-examine')))),
    el('div', { class: 'stack' },
      card('Focused examination', 'Structured findings from runtime.observe.',
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn sm', onclick: () => examine('pulse') }, 'Pulse'),
          el('button', { class: 'btn sm', onclick: () => examine('cardiovascular') }, 'Cardiovascular'),
          el('button', { class: 'btn sm', onclick: () => examine('neurological') }, 'Neurological')),
        findingsNode)));

  refresh();
  runtime?.subscribe?.(() => refresh());

  return {
    id: 'examine',
    name: 'Examine',
    tagline: 'Look, feel, and take the vitals — through the runtime',
    transport: false,
    layer: true,
    workspaces: [{ id: 'bedside', label: 'Bedside', node, view: { resize() {}, refresh } }],
  };
}

/** Investigate layer — labs + ECG as observations. */
export function createInvestigateLayer({ runtime, onExplore }) {
  const labsNode = el('div', { class: 'lab-panels' });
  const ecgNode = el('div', { class: 'exam-block' });

  const refresh = () => {
    if (!runtime) return;
    const panel = unwrapObs(runtime.observe({
      type: 'observe.laboratory-panel',
      panel: 'all',
      includeInterpretation: true,
    }, { role: 'clinical' }));
    clear(labsNode);
    if (panel?.denied) {
      labsNode.append(el('p', { class: 'danger' }, panel.error?.message || 'Observation denied'));
    } else {
      const lines = panel?.value?.lines || [];
      const byPanel = new Map();
      for (const line of lines) {
        const a = line.key;
        const pid = ['pH', 'PaCO2', 'PaO2', 'HCO3', 'lactate'].includes(a) ? 'ABG'
          : ['Hb', 'MCV', 'WCC', 'platelets'].includes(a) ? 'FBC'
          : ['troponin', 'BNP'].includes(a) ? 'Cardiac'
          : 'Chemistry';
        if (!byPanel.has(pid)) byPanel.set(pid, []);
        byPanel.get(pid).push(line);
      }
      for (const [name, rows] of byPanel) {
        labsNode.append(el('div', { class: 'lab-panel' },
          el('div', { class: 'sec-head' }, name),
          ...rows.map((l) => el('div', { class: `lab-line ${l.flag}` },
            el('span', { class: 'll-n' }, l.label),
            el('span', { class: 'll-v' }, String(l.value)),
            el('span', { class: 'll-u' }, l.unit),
            l.source === 'physiology-derived' && el('span', { class: 'll-d' }, 'sim')))));
      }
      if (panel?.value?.interpretation?.primary) {
        labsNode.append(el('p', { class: 'muted' },
          `Interpretation: ${panel.value.interpretation.primary}`));
      }
    }

    const ecg = unwrapObs(runtime.observe({ type: 'observe.twelve-lead-ecg' }, { role: 'clinical' }));
    clear(ecgNode);
    ecgNode.append(
      el('div', { class: 'sec-head' }, 'Twelve-lead ECG'),
      el('p', {}, ecg?.denied ? (ecg.error?.message || 'Denied') : (ecg?.value?.report || 'No report')),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn ghost sm', onclick: () => onExplore?.('cardio', 'ecg') },
          'Open ECG lens →')),
    );
  };

  const node = el('div', { class: 'split' },
    el('div', { class: 'stack' },
      card('Laboratory', 'Measured from chemistry ground truth — not a parallel store.',
        labsNode,
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn ghost sm', onclick: refresh }, 'Repeat panel'),
          el('button', { class: 'btn ghost sm', onclick: () => onExplore?.('labs', 'panel') },
            'Open Labs lens →')))),
    el('div', { class: 'stack' },
      card('ECG', 'Observation plugin over electrophysiology public state.', ecgNode)));

  refresh();
  runtime?.subscribe?.((ev) => {
    if (ev.type === 'physiology.updated' || ev.type === 'chemistry.updated' || ev.type === 'command.accepted') {
      refresh();
    }
  });

  return {
    id: 'investigate',
    name: 'Investigate',
    tagline: 'Labs and ECG as clinical observations',
    transport: false,
    layer: true,
    workspaces: [{ id: 'workup', label: 'Work-up', node, view: { resize() {}, refresh } }],
  };
}

/** Treat layer — fluid and vasopressor via runtime commands. */
export function createTreatLayer({ runtime }) {
  const statusNode = el('div', { class: 'exam-block' });
  const logNode = el('div', { class: 'exam-block' });

  const refresh = () => {
    const vitals = unwrapObs(runtime?.observe?.({ type: 'observe.vital-signs' }, { role: 'clinical' }));
    const v = vitals?.value || {};
    const bp = v.bloodPressure || {};
    clear(statusNode);
    statusNode.append(
      el('div', { class: 'sec-head' }, 'Current perfusion'),
      el('p', {},
        `MAP ${bp.mean == null ? '—' : Math.round(bp.mean)} mmHg · `
        + `HR ${v.heartRate == null ? '—' : Math.round(v.heartRate)}`),
    );
  };

  const give = (type, payload, label) => {
    const result = runtime.dispatch({
      id: cmdId(runtime, 'treat'),
      type,
      payload,
      source: { type: 'ui', surface: 'treat' },
    }, { role: 'clinical' });
    logNode.prepend(el('p', { class: result.accepted ? '' : 'danger' },
      result.accepted ? label : `Rejected: ${result.error?.message || 'unknown'}`));
    void runtime.advance?.(3000);
    refresh();
  };

  const node = el('div', { class: 'stack' },
    card('Treat', 'Interventions go through PatientRuntime.dispatch — never private model knobs.',
      statusNode,
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: () =>
          give('treatment.fluid-bolus', { volumeMl: 500 }, 'Gave 500 mL fluid bolus') },
          'Fluid bolus 500 mL'),
        el('button', { class: 'btn', onclick: () =>
          give('treatment.vasopressor', { intensity: 0.4 }, 'Started vasopressor (40%)') },
          'Vasopressor'),
        el('button', { class: 'btn ghost', onclick: () =>
          give('treatment.vasopressor', { intensity: 0 }, 'Stopped vasopressor') },
          'Stop pressor')),
      el('div', { class: 'sec-head' }, 'Treatment log'),
      logNode));

  refresh();
  runtime?.subscribe?.(() => refresh());

  return {
    id: 'treat',
    name: 'Treat',
    tagline: 'Fluids and vasoactive drugs as runtime commands',
    transport: false,
    layer: true,
    workspaces: [{ id: 'intervene', label: 'Intervene', node, view: { resize() {}, refresh } }],
  };
}
