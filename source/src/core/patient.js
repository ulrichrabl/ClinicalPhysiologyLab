/* ---------------------------------------------------------------------------
   Shared patient channels.

   Numerical / categorical values the UI and observation layer read. Canonical
   physiological evolution is owned by the Patient Runtime; these channels are
   projections and learner-editable inputs (chemistry, drugs, ICP), not a
   parallel solver.
--------------------------------------------------------------------------- */

export const CHANNELS = {
  // --- chemistry -----------------------------------------------------------
  K:        { label: 'Potassium',   unit: 'mmol/L', normal: [3.5, 5.0], lo: 1.5, hi: 9.0, step: 0.1, group: 'Chemistry' },
  Na:       { label: 'Sodium',      unit: 'mmol/L', normal: [135, 145], lo: 110, hi: 165, step: 1,   group: 'Chemistry' },
  Ca:       { label: 'Calcium',     unit: 'mmol/L', normal: [2.2, 2.6], lo: 1.2, hi: 3.8, step: 0.05, group: 'Chemistry' },
  glucose:  { label: 'Glucose',     unit: 'mmol/L', normal: [3.9, 5.6], lo: 0.8, hi: 30,  step: 0.1, group: 'Chemistry' },
  pH:       { label: 'Arterial pH', unit: '',       normal: [7.35, 7.45], lo: 6.9, hi: 7.7, step: 0.01, group: 'Chemistry' },

  // --- haemodynamics (produced by cardio via runtime snapshots) -----------
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

export class Patient {
  constructor() {
    this.state = { ...PATIENT_DEFAULTS };
    this.listeners = new Set();
    this.baseline = { ...PATIENT_DEFAULTS };
    /** @type {import('../runtime/patient-runtime.ts').DefaultPatientRuntime | null} */
    this.runtime = null;
  }

  get(k) { return this.state[k]; }
  all() { return { ...this.state }; }

  set(k, v, source = 'user') {
    if (this.state[k] === v) return;
    this.state[k] = v;
    this.recompute();
    if (this.runtime && isChannelInput(k) && source !== 'runtime' && source !== 'cardio') {
      this.runtime.syncChannels(this.channelSnapshot());
    }
    this.emit({ key: k, value: v, source });
  }

  setMany(obj, source = 'user') {
    let changed = false;
    for (const [k, v] of Object.entries(obj)) {
      if (this.state[k] !== v) { this.state[k] = v; changed = true; }
    }
    if (!changed) return;
    this.recompute();
    if (this.runtime && source !== 'runtime' && source !== 'cardio') {
      const touched = Object.keys(obj).some(isChannelInput);
      if (touched) this.runtime.syncChannels(this.channelSnapshot());
    }
    this.emit({ keys: Object.keys(obj), source });
  }

  reset() {
    this.state = { ...PATIENT_DEFAULTS };
    this.recompute();
    if (this.runtime) {
      this.runtime.dispatch({
        id: `reset_${Date.now()}`,
        type: 'runtime.reset',
        payload: {},
        source: { type: 'system' },
      });
      this.runtime.syncChannels(this.channelSnapshot());
    }
    this.emit({ source: 'reset' });
  }

  recompute() {
    this.state.CPP = this.state.MAP - this.state.ICP;
  }

  channelSnapshot() {
    return {
      K: this.state.K,
      Ca: this.state.Ca,
      ICP: this.state.ICP,
      MAP: this.state.MAP,
      CPP: this.state.CPP,
      betaBlocker: this.state.betaBlocker,
      atropine: this.state.atropine,
      vasopressor: this.state.vasopressor,
    };
  }

  /** Active mechanisms for the Patient workspace — sourced from the runtime. */
  activeCouplings() {
    if (!this.runtime) return [];
    return this.runtime.activeMechanismDisplays();
  }

  explain(paramKey) {
    if (!this.runtime) return [];
    return this.runtime.explainPrivateParam(paramKey);
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev) { for (const fn of this.listeners) fn(ev, this.state); }
}

const CHANNEL_INPUTS = new Set(['K', 'Ca', 'ICP', 'betaBlocker', 'atropine', 'vasopressor']);
function isChannelInput(k) { return CHANNEL_INPUTS.has(k); }

export function channelStatus(key, value) {
  const ch = CHANNELS[key];
  if (!ch || !ch.normal || value == null) return 'normal';
  const [lo, hi] = ch.normal;
  if (value < lo) return value < lo - (hi - lo) * 0.6 ? 'danger' : 'warn';
  if (value > hi) return value > hi + (hi - lo) * 0.6 ? 'danger' : 'warn';
  return 'normal';
}
