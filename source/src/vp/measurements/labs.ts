import type { Resolved, Resolver } from '../engine/observe.ts';

/* ---------------------------------------------------------------------------
   Laboratory and ECG measurements: functions that read the models' state
   and return what the instrument reports. They do not interpret.
--------------------------------------------------------------------------- */

const PANEL_FIELDS: Record<string, string[]> = {
  electrolytes: ['sodium', 'potassium', 'chloride', 'bicarbonate', 'urea', 'creatinine'],
  fbc: ['haemoglobin', 'whiteCellCount', 'platelets', 'mcv'],
  'cardiac-markers': ['troponin', 'bnp'],
  crp: ['crp'],
};
const DIGITS: Record<string, number> = { glucose: 1, arterialPH: 2, paCO2: 1, paO2: 1, potassium: 1, lactate: 1, urea: 1, whiteCellCount: 1, bicarbonate: 0, baseExcess: 1, saO2: 0, coHb: 1, metHb: 1, fio2: 2 };
export const labDigits = (k: string) => DIGITS[k] ?? 0;
const round = (k: string, v: number) => { const d = DIGITS[k] ?? 0; const f = 10 ** d; return Math.round(v * f) / f; };

export const LAB_RESOLVERS: Record<string, Resolver> = {
  'chemistry.panel': (view, ref): Resolved | undefined => {
    const c = view.chemistry; const fields = PANEL_FIELDS[ref.property];
    if (!c || !fields) return undefined;
    return { value: Object.fromEntries(fields.map((k) => [k, round(k, c[k])])) };
  },
  'chemistry.glucose': (view): Resolved | undefined => (view.chemistry ? { value: round('glucose', view.chemistry.glucose ?? 5) } : undefined),
  'electrical.ecg': (view): Resolved | undefined => {
    const e = view.circulation?.ecgMetrics;
    if (!e) return undefined;
    // No measurable PR without a P wave that conducts (fibrillation, flutter, dissociation).
    const value: Record<string, number> = { rate: Math.round(e.HR), qrs: Math.round(e.QRS), qtc: Math.round(e.QTc), axis: Math.round(e.qrsAxis) };
    if (typeof e.PR === 'number') value.pr = Math.round(e.PR);
    return { value };
  },
};
