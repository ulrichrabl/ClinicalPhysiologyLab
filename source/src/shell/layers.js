import { el, clear, card } from '../core/ui/kit.js';
import { createCommandId } from '../runtime/patient-runtime.ts';

/** Examine layer — clinical observations via runtime.observe / perform.examination. */
export function createExamineLayer({ runtime }) {
  const appearanceNode = el('div', { class: 'exam-block' });
  const vitalsNode = el('div', { class: 'exam-block' });
  const findingsNode = el('div', { class: 'exam-block' });

  const refresh = () => {
    if (!runtime) return;
    const appearance = runtime.observe({ type: 'observe.general-appearance' });
    const vitals = runtime.observe({ type: 'observe.vital-signs' });
    clear(appearanceNode);
    appearanceNode.append(
      el('div', { class: 'sec-head' }, 'General appearance'),
      el('p', {}, appearance.value?.appearance || '—'),
      el('p', { class: 'muted' }, appearance.value?.consciousness || ''),
      el('p', { class: 'muted' }, appearance.value?.perfusion || ''),
    );
    clear(vitalsNode);
    const v = vitals.value || {};
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
      ...(vitals.interpretation || []).map((i) =>
        el('div', { class: 'vflag warn' }, i.label)),
    );
  };

  const examine = (exam) => {
    const obs = runtime.observe({ type: 'perform.examination', exam });
    findingsNode.prepend(
      el('div', { class: 'abg-step' },
        el('div', { class: 'abg-k' }, exam),
        el('ul', {}, ...(obs.value?.findings || ['No findings']).map((f) => el('li', {}, f)))),
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
    const panel = runtime.observe({
      type: 'observe.laboratory-panel',
      panel: 'all',
      includeInterpretation: true,
    });
    clear(labsNode);
    const lines = panel.value?.lines || [];
    const byPanel = new Map();
    for (const line of lines) {
      const a = line.key;
      // group roughly by existing panel heuristics
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
    if (panel.value?.interpretation?.primary) {
      labsNode.append(el('p', { class: 'muted' },
        `Interpretation: ${panel.value.interpretation.primary}`));
    }

    const ecg = runtime.observe({ type: 'observe.twelve-lead-ecg' });
    clear(ecgNode);
    ecgNode.append(
      el('div', { class: 'sec-head' }, 'Twelve-lead ECG'),
      el('p', {}, ecg.value?.report || 'No report'),
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
    const phys = runtime?.query?.({ type: 'state.projection', projection: 'publicPhysiology' });
    const cv = phys?.cardiovascular || {};
    clear(statusNode);
    statusNode.append(
      el('div', { class: 'sec-head' }, 'Current perfusion'),
      el('p', {},
        `MAP ${cv.meanArterialPressure == null ? '—' : Math.round(cv.meanArterialPressure)} mmHg · `
        + `HR ${cv.heartRate == null ? '—' : Math.round(cv.heartRate)} · `
        + `Volume ${cv.bloodVolume == null ? '—' : Math.round(cv.bloodVolume)} mL`),
    );
  };

  const give = (type, payload, label) => {
    const result = runtime.dispatch({
      id: createCommandId(),
      type,
      payload,
      source: { type: 'ui', surface: 'treat' },
    });
    logNode.prepend(el('p', { class: result.accepted ? '' : 'danger' },
      result.accepted ? label : `Rejected: ${result.error?.message || 'unknown'}`));
    runtime.dispatch({
      id: createCommandId(),
      type: 'runtime.advance',
      payload: { durationMs: 3000 },
      source: { type: 'ui', surface: 'treat' },
    });
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
