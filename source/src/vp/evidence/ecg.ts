import { defineConstants } from './constants.ts';

/* Constants of the heart's electrical model (physiology/heart/electrical.ts): intervals, their dependence on rate
   and electrolytes, and the rhythms.

   The shape of the cardiac dipole (the direction, size and width of each activation and repolarisation lobe in
   the Frank coordinates) is fitted by eye to a normal vectorcardiogram and to the textbook patterns of each
   conduction disturbance; those geometric numbers stay in the model, described where they are used, and are
   not listed here as if they were measured. The ECG itself is a measurement of the dipole through Dower's lead
   vectors (measurements/ecg.ts, Edenbrandt & Pahlm 1988). */

export const ECG = defineConstants('ecg', {
  /* --- normal intervals ---------------------------------------------------- */
  prNormal: { value: 160, unit: 'ms', status: 'derived', refs: ['mason2007'], means: 'PR interval with normal AV conduction.',
    derivation: 'Mason’s reference range in 46,129 low-risk adults (2nd–98th percentile) is 113–212 ms; its middle, about 160 ms.' },
  qrsNormal: { value: 92, unit: 'ms', status: 'derived', refs: ['mason2007'], means: 'QRS duration with normal conduction.', derivation: 'Mason’s range 69–109 ms; the model sits in its upper middle, as adult men do.' },
  qtRef: { value: 385, unit: 'ms', status: 'derived', refs: ['sagie1992'], means: 'QT interval at a heart period of 1 s (Framingham-corrected QT).',
    derivation: 'Framingham: mean QT 0.35 s in men and 0.36 s in women at a mean RR of 0.81 s; corrected to RR 1 s with Sagie’s slope, 0.35 + 0.154 × 0.19 = 0.379 and 0.389 s: 385 ms.' },
  qtRateSlope: { value: 154, unit: 'ms per s of RR', status: 'measured', refs: ['sagie1992'], means: 'Change of QT with the heart period: QT = QT₁ − 154·(1 − RR).',
    derivation: 'Sagie’s linear regression in 5018 Framingham subjects, the same for men and women; Bazett’s square root overcorrects at fast rates and undercorrects at slow ones, so the model generates QT by Sagie and reports QTc by Bazett, as an ECG machine does.' },
  qtMin: { value: 240, unit: 'ms', status: 'derived', refs: ['sagie1992'], means: 'Shortest QT the model generates.', derivation: 'The shortest QT in Framingham, 0.24 s.' },
  /* --- potassium ------------------------------------------------------------- */
  tPeakOnset: { value: 5.4, unit: 'mmol/L', status: 'assumed', refs: ['montague2008'], means: 'Potassium above which the T wave grows and narrows.',
    derivation: 'The textbook sequence (peaked T from about 5.5, PR and P changes from about 6.5, QRS widening from about 7) is what experimental hyperkalaemia shows; clinically the ECG is insensitive and no threshold could be established (Montague: 90 patients with K ≥ 6, changes in a minority). The model follows the experimental sequence for every patient.' },
  tPeakGain: { value: 0.75, unit: 'per mmol/L', status: 'ungrounded', means: 'Rise in T-wave amplitude per mmol/L of potassium above the onset.' },
  tNarrowing: { value: 0.14, unit: 'per mmol/L', status: 'ungrounded', means: 'Narrowing of the T wave per mmol/L above the onset.' },
  prOnsetK: { value: 6, unit: 'mmol/L', status: 'assumed', refs: ['montague2008'], means: 'Potassium above which AV conduction slows (PR lengthens).', derivation: 'The textbook sequence (see above).' },
  prPerK: { value: 18, unit: 'ms per mmol/L', status: 'ungrounded', means: 'PR lengthening per mmol/L above that.' },
  pLossOnset: { value: 6.5, unit: 'mmol/L', status: 'assumed', refs: ['montague2008'], means: 'Potassium above which the P wave shrinks (atrial myocytes fail first).', derivation: 'The textbook sequence.' },
  pLossPerK: { value: 0.45, unit: 'per mmol/L', status: 'ungrounded', means: 'Loss of P-wave amplitude per mmol/L above that.' },
  qrsOnsetK: { value: 6.8, unit: 'mmol/L', status: 'assumed', refs: ['montague2008'], means: 'Potassium above which the QRS widens.', derivation: 'The textbook sequence.' },
  qrsPerK: { value: 0.32, unit: 'per mmol/L', status: 'ungrounded', means: 'Fractional QRS widening per mmol/L above that.' },
  hypoKOnset: { value: 3.5, unit: 'mmol/L', status: 'assumed', means: 'Potassium below which repolarisation lengthens and the T flattens.', derivation: 'The lower limit of normal.' },
  hypoKQt: { value: 25, unit: 'ms per mmol/L', status: 'ungrounded', means: 'QT lengthening per mmol/L below that.' },
  hypoKT: { value: 0.38, unit: 'per mmol/L', status: 'ungrounded', means: 'T-wave flattening per mmol/L below that.' },
  uWaveOnset: { value: 3.6, unit: 'mmol/L', status: 'ungrounded', means: 'Potassium below which a U wave appears.' },
  /* --- calcium and drugs ---------------------------------------------------------- */
  calciumRef: { value: 2.4, unit: 'mmol/L', status: 'assumed', means: 'Total calcium at which the QT is the reference QT.', derivation: 'Mid-normal total calcium.' },
  calciumQt: { value: 70, unit: 'ms per mmol/L', status: 'ungrounded', means: 'QT shortening per mmol/L of total calcium (the plateau shortens).' },
  digoxinQt: { value: 40, unit: 'ms', status: 'ungrounded', means: 'QT shortening at full digoxin effect.' },
  digoxinT: { value: 0.55, unit: 'fraction', status: 'ungrounded', means: 'T-wave flattening at full digoxin effect.' },
  /* --- rhythms -------------------------------------------------------------------- */
  flutterCycle: { value: 200, unit: 'ms', status: 'assumed', means: 'Atrial flutter cycle length (300 /min).', derivation: 'Typical flutter circulates the tricuspid annulus at about 300 /min.' },
  afIrregularity: { value: 0.24, unit: 'CV', status: 'ungrounded', means: 'Scatter of RR intervals in atrial fibrillation (coefficient of variation).' },
  afMinRR: { value: 320, unit: 'ms', status: 'ungrounded', means: 'Shortest RR the AV node lets through in atrial fibrillation (its refractory period).' },
  vtRate: { value: 165, unit: '/min', status: 'assumed', means: 'Rate of monomorphic ventricular tachycardia.', derivation: 'A common rate; VT runs from about 120 to 250 /min.' },
  ventricularEscape: { value: 1500, unit: 'ms', status: 'assumed', means: 'Interval after which a ventricular focus escapes below a complete block (40 /min).', derivation: 'Ventricular escape rhythms run at about 20–40 /min.' },
  junctionalEscape: { value: 2000, unit: 'ms', status: 'ungrounded', means: 'Pause after which the junction rescues a beat when conduction is intact.' },
  refractory: { value: 280, unit: 'ms', status: 'ungrounded', means: 'Shortest interval between two ventricular activations.' },
  wenckebachIncrement: { value: 140, unit: 'ms', status: 'ungrounded', means: 'Total PR lengthening over a Wenckebach cycle.' },
  wenckebachDecay: { value: 0.45, unit: '', status: 'ungrounded', means: 'How fast the PR increments shrink within a Wenckebach cycle.' },
  rsaDepth: { value: 0.035, unit: 'fraction', status: 'ungrounded', means: 'Depth of respiratory sinus arrhythmia.' },
  /* --- conduction disturbances ------------------------------------------------- */
  lbbbQrs: { value: 148, unit: 'ms', status: 'assumed', means: 'QRS duration in complete left bundle branch block.', derivation: 'Complete LBBB is defined by a QRS of 120 ms or more; typical durations are 140–160 ms.' },
  rbbbQrs: { value: 136, unit: 'ms', status: 'assumed', means: 'QRS duration in complete right bundle branch block.', derivation: 'Complete RBBB: QRS 120 ms or more, typically 130–140 ms.' },
  vtQrs: { value: 165, unit: 'ms', status: 'assumed', means: 'QRS duration of ventricular tachycardia.', derivation: 'Broad, usually above 140 ms.' },
  preexcitedPr: { value: 105, unit: 'ms', status: 'assumed', means: 'PR interval with an accessory pathway.', derivation: 'Pre-excitation shortens the PR below 120 ms.' },
  preexcitedQrs: { value: 122, unit: 'ms', status: 'assumed', means: 'QRS duration with a delta wave.', derivation: 'The delta wave widens the QRS to about 110–140 ms.' },
});
