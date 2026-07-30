/* ---------------------------------------------------------------------------
   The Patient.

   Every domain in this framework reads from and writes to one shared patient.
   That is the whole point: potassium is not a cardiology slider, it is a
   property of the person, and it shows up in the ECG *and* in the reflexes.

   Channels are declared here with units and reference ranges. Domains declare
   what they produce and what they consume. Couplings are declared explicitly
   rather than hidden in each domain's update loop, so the app can *show the
   learner why* something changed — which is the reason this layer exists.
--------------------------------------------------------------------------- */

export const CHANNELS = {
  // --- chemistry -----------------------------------------------------------
  K:        { label: 'Potassium',   unit: 'mmol/L', normal: [3.5, 5.0], lo: 1.5, hi: 9.0, step: 0.1, group: 'Chemistry' },
  Na:       { label: 'Sodium',      unit: 'mmol/L', normal: [135, 145], lo: 110, hi: 165, step: 1,   group: 'Chemistry' },
  Ca:       { label: 'Calcium',     unit: 'mmol/L', normal: [2.2, 2.6], lo: 1.2, hi: 3.8, step: 0.05, group: 'Chemistry' },
  glucose:  { label: 'Glucose',     unit: 'mmol/L', normal: [3.9, 5.6], lo: 0.8, hi: 30,  step: 0.1, group: 'Chemistry' },
  pH:       { label: 'Arterial pH', unit: '',       normal: [7.35, 7.45], lo: 6.9, hi: 7.7, step: 0.01, group: 'Chemistry' },

  // --- haemodynamics (produced by cardio) ---------------------------------
  MAP:      { label: 'Mean arterial pressure', unit: 'mmHg', normal: [70, 105], derived: true, group: 'Haemodynamics' },
  HR:       { label: 'Heart rate',   unit: '/min', normal: [60, 100], derived: true, group: 'Haemodynamics' },
  CO:       { label: 'Cardiac output', unit: 'L/min', normal: [4, 8], derived: true, group: 'Haemodynamics' },
  CVP:      { label: 'Central venous pressure', unit: 'mmHg', normal: [1, 8], derived: true, group: 'Haemodynamics' },
  LAP:      { label: 'Left atrial pressure', unit: 'mmHg', normal: [4, 12], derived: true, group: 'Haemodynamics' },
  EF:       { label: 'Ejection fraction', unit: '%', normal: [50, 70], derived: true, group: 'Haemodynamics' },
  bloodVolume: { label: 'Circulating volume', unit: 'mL', normal: [4700, 5300], derived: true, group: 'Haemodynamics' },

  // --- neuro ---------------------------------------------------------------
  ICP:      { label: 'Intracranial pressure', unit: 'mmHg', normal: [5, 15], lo: 0, hi: 60, step: 1, group: 'Neuro' },
  CPP:      { label: 'Cerebral perfusion pressure', unit: 'mmHg', normal: [60, 100], derived: true, group: 'Neuro' },
  cordLevel:{ label: 'Cord lesion level', unit: '', text: true, derived: true, group: 'Neuro' },

  // --- interventions -------------------------------------------------------
  betaBlocker: { label: 'Beta blocker', unit: '', normal: [0, 0], lo: 0, hi: 1, step: 0.1, group: 'Drugs' },
  atropine:    { label: 'Atropine',     unit: '', normal: [0, 0], lo: 0, hi: 1, step: 0.1, group: 'Drugs' },
  vasopressor: { label: 'Vasopressor',  unit: '', normal: [0, 0], lo: 0, hi: 1, step: 0.1, group: 'Drugs' },
};

export const PATIENT_DEFAULTS = {
  K: 4.0, Na: 140, Ca: 2.4, glucose: 5.0, pH: 7.40,
  MAP: 95, HR: 72, CO: 5.2, CVP: 4, LAP: 6, EF: 55, bloodVolume: 5000,
  ICP: 10, CPP: 85, cordLevel: null,
  betaBlocker: 0, atropine: 0, vasopressor: 0,
};

/* ---------------------------------------------------------------------------
   Couplings.

   Each one is a small, named, explainable rule with a `when` guard so the UI
   can list only the links that are currently live. `apply` returns partial
   overrides that the owning domain merges into its own parameters.
--------------------------------------------------------------------------- */
export const COUPLINGS = [
  {
    id: 'k-ecg',
    from: 'K', to: 'cardio',
    name: 'Potassium → repolarisation',
    short: 'K⁺ shapes the T wave and QRS width',
    why: 'Extracellular K⁺ sets the resting membrane potential. Raising it makes '
       + 'repolarisation faster and steeper (tall, peaked T waves), then slows phase-0 '
       + 'upstroke as sodium channels inactivate — the QRS widens and P waves flatten. '
       + 'Low K⁺ does the opposite: prolonged repolarisation, flat T, prominent U wave.',
    when: (p) => p.K < 3.3 || p.K > 5.3,
    severity: (p) => (p.K > 6.5 || p.K < 2.6 ? 'danger' : 'warn'),
    state: (p) => (p.K > 5.3 ? `K⁺ ${p.K.toFixed(1)} — hyperkalaemic` : `K⁺ ${p.K.toFixed(1)} — hypokalaemic`),
    apply: (p) => ({ K: p.K }),
  },
  {
    id: 'ca-qt',
    from: 'Ca', to: 'cardio',
    name: 'Calcium → plateau duration',
    short: 'Ca²⁺ sets the ST segment length',
    why: 'The plateau of the ventricular action potential is carried by L-type Ca²⁺ '
       + 'current. Hypocalcaemia lengthens it — a long, flat ST segment and prolonged QT '
       + 'without changing the T wave itself. Hypercalcaemia shortens the ST until the T '
       + 'wave sits almost on the QRS.',
    when: (p) => p.Ca < 2.15 || p.Ca > 2.65,
    severity: (p) => (p.Ca < 1.8 || p.Ca > 3.0 ? 'danger' : 'warn'),
    state: (p) => `Ca²⁺ ${p.Ca.toFixed(2)} — QT ${p.Ca < 2.2 ? 'prolonged' : 'shortened'}`,
    apply: (p) => ({ stFactor: 1 + (2.4 - p.Ca) * 0.55 }),
  },
  {
    id: 'cushing',
    from: 'ICP', to: 'cardio',
    name: 'Cushing reflex',
    short: 'Rising ICP drives hypertension and reflex bradycardia',
    why: 'When intracranial pressure approaches arterial pressure the brainstem is '
       + 'hypoperfused. The sympathetic response raises systemic pressure to restore '
       + 'cerebral perfusion; baroreceptors then answer that hypertension with vagal '
       + 'bradycardia. Hypertension + bradycardia + irregular breathing is the triad — '
       + 'it is a late and ominous sign.',
    when: (p) => p.ICP > 20,
    severity: (p) => (p.ICP > 35 ? 'danger' : 'warn'),
    state: (p) => `ICP ${Math.round(p.ICP)} mmHg — CPP ${Math.round(p.CPP)}`,
    apply: (p) => {
      const drive = Math.min(1, (p.ICP - 20) / 25);
      return { Rsys: 1.05 * (1 + drive * 0.55), HR: 72 * (1 - drive * 0.42) };
    },
  },
  {
    id: 'neurogenic-shock',
    from: 'cordLevel', to: 'cardio',
    name: 'Neurogenic shock',
    short: 'A cord lesion above T6 cuts sympathetic outflow to the vessels and heart',
    why: 'Sympathetic preganglionic neurons leave the cord between T1 and L2. A lesion '
       + 'above T6 disconnects most of that outflow from the brainstem: arterioles lose '
       + 'their tone and the cardiac accelerator fibres (T1–T4) are lost too. The result '
       + 'is hypotension with a *slow* heart — which is what distinguishes it from '
       + 'haemorrhagic shock, where the heart races.',
    when: (p) => p.cordLevel && CORD_RANK[p.cordLevel] != null && CORD_RANK[p.cordLevel] <= CORD_RANK.T6,
    severity: () => 'danger',
    state: (p) => `Cord lesion at ${p.cordLevel} — sympathetic outflow lost`,
    /* Losing sympathetic outflow means losing arteriolar tone, the cardiac
       accelerator *and* venoconstriction. In a closed loop the venous limb
       matters most: the reservoir dilates, mean filling pressure falls, and the
       heart has less to pump even before resistance is considered. */
    apply: () => ({ Rsys: 0.52, HR: 52, V0sv: 2900, baroEnabled: false }),
  },
  {
    id: 'cpp',
    from: 'MAP', to: 'neuro',
    name: 'Cerebral perfusion',
    short: 'CPP = MAP − ICP',
    why: 'The brain is perfused by the difference between what pushes blood in and what '
       + 'presses on it from outside. Below about 50 mmHg autoregulation fails and flow '
       + 'follows pressure passively — which is why a hypotensive episode is so much more '
       + 'dangerous in a swollen brain than in a healthy one.',
    when: (p) => p.CPP < 60,
    severity: (p) => (p.CPP < 45 ? 'danger' : 'warn'),
    state: (p) => `CPP ${Math.round(p.CPP)} mmHg — autoregulation ${p.CPP < 50 ? 'failed' : 'strained'}`,
    apply: (p) => ({ ischaemia: Math.max(0, Math.min(1, (60 - p.CPP) / 35)) }),
  },
  {
    id: 'beta-block',
    from: 'betaBlocker', to: 'cardio',
    name: 'Beta blockade',
    short: 'β₁ blockade slows the node and weakens the beat',
    why: 'Blocking β₁ receptors removes the sympathetic contribution to sinus rate, AV '
       + 'conduction and contractility at once. Rate falls, the PR interval lengthens, and '
       + 'the ventricle contracts less forcefully — which lowers cardiac output but also '
       + 'lowers myocardial oxygen demand. That trade is the whole therapeutic point.',
    when: (p) => p.betaBlocker > 0.02,
    severity: (p) => (p.betaBlocker > 0.7 ? 'warn' : 'info'),
    state: (p) => `β-blockade ${Math.round(p.betaBlocker * 100)}%`,
    apply: (p) => ({
      HR: 72 * (1 - p.betaBlocker * 0.38),
      Emax: 2.7 * (1 - p.betaBlocker * 0.34),
      avConduction: 1 - p.betaBlocker * 0.45,
    }),
  },
  {
    id: 'atropine',
    from: 'atropine', to: 'cardio',
    name: 'Vagolysis',
    short: 'Atropine removes vagal brake on the SA and AV nodes',
    why: 'Atropine is a muscarinic antagonist. It cannot make the heart contract harder — '
       + 'ventricular myocardium has almost no vagal supply — but it releases the nodes '
       + 'from parasympathetic restraint, so rate rises and AV conduction improves. This '
       + 'is why it works for sinus bradycardia and nodal block, and fails in infranodal '
       + 'block where the lesion is below the vagally innervated tissue.',
    when: (p) => p.atropine > 0.02,
    severity: () => 'info',
    state: (p) => `Atropine ${Math.round(p.atropine * 100)}%`,
    apply: (p) => ({ HR: 72 * (1 + p.atropine * 0.62), avConduction: 1 + p.atropine * 0.35 }),
  },
  {
    id: 'pressor',
    from: 'vasopressor', to: 'cardio',
    name: 'Vasopressor support',
    short: 'α₁ agonism raises systemic vascular resistance',
    why: 'Constricting arterioles raises resistance and therefore mean pressure at any '
       + 'given cardiac output. It buys perfusion pressure, but it also raises the load '
       + 'the ventricle ejects against — in a failing heart that can lower stroke volume '
       + 'even as the blood pressure number looks better.',
    when: (p) => p.vasopressor > 0.02,
    severity: () => 'info',
    state: (p) => `Vasopressor ${Math.round(p.vasopressor * 100)}%`,
    apply: (p) => ({ Rsys: 1.05 * (1 + p.vasopressor * 0.9) }),
  },
];

const CORD_ORDER = ['C1','C2','C3','C4','C5','C6','C7','C8','T1','T2','T3','T4','T5','T6',
  'T7','T8','T9','T10','T11','T12','L1','L2','L3','L4','L5','S1','S2','S3','S4'];
export const CORD_RANK = Object.fromEntries(CORD_ORDER.map((l, i) => [l, i]));

/* ------------------------------------------------------------------------- */
export class Patient {
  constructor() {
    this.state = { ...PATIENT_DEFAULTS };
    this.listeners = new Set();
    this.baseline = { ...PATIENT_DEFAULTS };
  }

  get(k) { return this.state[k]; }
  all() { return { ...this.state }; }

  set(k, v, source = 'user') {
    if (this.state[k] === v) return;
    this.state[k] = v;
    this.recompute();
    this.emit({ key: k, value: v, source });
  }

  setMany(obj, source = 'user') {
    let changed = false;
    for (const [k, v] of Object.entries(obj)) {
      if (this.state[k] !== v) { this.state[k] = v; changed = true; }
    }
    if (!changed) return;
    this.recompute();
    this.emit({ keys: Object.keys(obj), source });
  }

  reset() { this.state = { ...PATIENT_DEFAULTS }; this.recompute(); this.emit({ source: 'reset' }); }

  /* Derived channels that are pure functions of the others. */
  recompute() {
    this.state.CPP = this.state.MAP - this.state.ICP;
  }

  /* Which couplings are currently firing, for the UI to display. */
  activeCouplings() {
    return COUPLINGS.filter((c) => {
      try { return c.when(this.state); } catch { return false; }
    }).map((c) => ({
      ...c,
      level: c.severity ? c.severity(this.state) : 'info',
      status: c.state ? c.state(this.state) : '',
    }));
  }

  /* Merge every active coupling that targets `domain` into one override set. */
  overridesFor(domain) {
    const out = {};
    for (const c of COUPLINGS) {
      if (c.to !== domain) continue;
      let live = false;
      try { live = c.when(this.state); } catch { live = false; }
      if (!live) continue;
      Object.assign(out, c.apply(this.state));
    }
    return out;
  }

  /* Explain a single value: which couplings currently touch it. */
  explain(paramKey) {
    const hits = [];
    for (const c of COUPLINGS) {
      let live = false;
      try { live = c.when(this.state); } catch { live = false; }
      if (!live) continue;
      const eff = c.apply(this.state);
      if (paramKey in eff) hits.push({ coupling: c, value: eff[paramKey] });
    }
    return hits;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev) { for (const fn of this.listeners) fn(ev, this.state); }
}

export function channelStatus(key, value) {
  const ch = CHANNELS[key];
  if (!ch || !ch.normal || value == null) return 'normal';
  const [lo, hi] = ch.normal;
  if (value < lo) return value < lo - (hi - lo) * 0.6 ? 'danger' : 'warn';
  if (value > hi) return value > hi + (hi - lo) * 0.6 ? 'danger' : 'warn';
  return 'normal';
}
