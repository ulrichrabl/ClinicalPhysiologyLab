/* ---------------------------------------------------------------------------
   Laboratory medicine.

   A lab value on its own is a number with a flag next to it. What makes it
   clinical is the pattern it sits in, and the pattern only means something
   against the patient in front of you — which is exactly what a framework with
   a shared patient can show and a standalone lab quiz cannot.

   Sodium is a case in point: the same 128 mmol/L is a fluid problem, a
   hormone problem or an artefact depending on volume status and osmolality,
   and the app knows the volume status because the circulation is simulating it.
--------------------------------------------------------------------------- */

export const ANALYTES = {
  // --- arterial blood gas --------------------------------------------------
  pH:      { label: 'pH',        unit: '',        normal: [7.35, 7.45], lo: 6.80, hi: 7.70, step: 0.01, dp: 2, panel: 'abg' },
  PaCO2:   { label: 'PaCO₂',     unit: 'kPa',     normal: [4.7, 6.0],   lo: 1.5,  hi: 14,   step: 0.1,  dp: 1, panel: 'abg' },
  PaO2:    { label: 'PaO₂',      unit: 'kPa',     normal: [10.5, 13.5], lo: 3,    hi: 80,   step: 0.1,  dp: 1, panel: 'abg' },
  HCO3:    { label: 'Bicarbonate', unit: 'mmol/L', normal: [22, 26],    lo: 4,    hi: 45,   step: 0.5,  dp: 1, panel: 'abg' },
  lactate: { label: 'Lactate',   unit: 'mmol/L',  normal: [0.5, 1.6],   lo: 0.2,  hi: 20,   step: 0.1,  dp: 1, panel: 'abg' },

  // --- chemistry -----------------------------------------------------------
  Na:      { label: 'Sodium',    unit: 'mmol/L',  normal: [135, 145],   lo: 105,  hi: 175,  step: 1,   dp: 0, panel: 'chem' },
  K:       { label: 'Potassium', unit: 'mmol/L',  normal: [3.5, 5.0],   lo: 1.5,  hi: 9.0,  step: 0.1, dp: 1, panel: 'chem' },
  Cl:      { label: 'Chloride',  unit: 'mmol/L',  normal: [98, 107],    lo: 70,   hi: 130,  step: 1,   dp: 0, panel: 'chem' },
  urea:    { label: 'Urea',      unit: 'mmol/L',  normal: [2.5, 7.8],   lo: 0.5,  hi: 60,   step: 0.1, dp: 1, panel: 'chem' },
  creat:   { label: 'Creatinine', unit: 'µmol/L', normal: [60, 110],    lo: 20,   hi: 1200, step: 1,   dp: 0, panel: 'chem' },
  Ca:      { label: 'Calcium (adj)', unit: 'mmol/L', normal: [2.20, 2.60], lo: 1.2, hi: 3.8, step: 0.01, dp: 2, panel: 'chem' },
  Mg:      { label: 'Magnesium', unit: 'mmol/L',  normal: [0.7, 1.0],   lo: 0.2,  hi: 3.0,  step: 0.05, dp: 2, panel: 'chem' },
  glucose: { label: 'Glucose',   unit: 'mmol/L',  normal: [3.9, 5.6],   lo: 0.8,  hi: 45,   step: 0.1, dp: 1, panel: 'chem' },
  albumin: { label: 'Albumin',   unit: 'g/L',     normal: [35, 50],     lo: 10,   hi: 60,   step: 1,   dp: 0, panel: 'chem' },

  // --- haematology ---------------------------------------------------------
  Hb:      { label: 'Haemoglobin', unit: 'g/L',   normal: [130, 170],   lo: 30,   hi: 220,  step: 1,   dp: 0, panel: 'fbc' },
  MCV:     { label: 'MCV',       unit: 'fL',      normal: [80, 100],    lo: 55,   hi: 130,  step: 1,   dp: 0, panel: 'fbc' },
  WCC:     { label: 'White cells', unit: '10⁹/L', normal: [4.0, 11.0],  lo: 0.1,  hi: 60,   step: 0.1, dp: 1, panel: 'fbc' },
  platelets: { label: 'Platelets', unit: '10⁹/L', normal: [150, 400],   lo: 2,    hi: 900,  step: 5,   dp: 0, panel: 'fbc' },

  // --- cardiac -------------------------------------------------------------
  troponin: { label: 'Troponin T', unit: 'ng/L',  normal: [0, 14],      lo: 0,    hi: 5000, step: 1,   dp: 0, panel: 'cardiac' },
  BNP:     { label: 'NT-proBNP', unit: 'ng/L',    normal: [0, 125],     lo: 0,    hi: 12000, step: 25, dp: 0, panel: 'cardiac' },
};

export const PANELS = [
  { id: 'abg', name: 'Arterial blood gas', keys: ['pH', 'PaCO2', 'PaO2', 'HCO3', 'lactate'] },
  { id: 'chem', name: 'Chemistry', keys: ['Na', 'K', 'Cl', 'urea', 'creat', 'Ca', 'Mg', 'glucose', 'albumin'] },
  { id: 'fbc', name: 'Full blood count', keys: ['Hb', 'MCV', 'WCC', 'platelets'] },
  { id: 'cardiac', name: 'Cardiac markers', keys: ['troponin', 'BNP'] },
];

export const LAB_DEFAULTS = {
  pH: 7.40, PaCO2: 5.3, PaO2: 12.0, HCO3: 24, lactate: 1.0,
  Na: 140, K: 4.0, Cl: 102, urea: 5.0, creat: 80, Ca: 2.40, Mg: 0.85,
  glucose: 5.0, albumin: 42,
  Hb: 150, MCV: 90, WCC: 7.0, platelets: 250,
  troponin: 5, BNP: 40,
};

/* ---------------------------------------------------------------------------
   Derived quantities. These are the arithmetic a clinician does at the bedside
   and the app should never make anyone do by hand.
--------------------------------------------------------------------------- */
export function derived(v) {
  const anionGap = v.Na - (v.Cl + v.HCO3);
  const albCorrected = anionGap + 0.25 * (42 - v.albumin);
  const deltaRatio = (anionGap - 12) / (24 - v.HCO3);
  const osm = 2 * v.Na + v.urea + v.glucose;
  return {
    anionGap,
    anionGapCorrected: albCorrected,
    deltaRatio: Number.isFinite(deltaRatio) ? deltaRatio : null,
    osmolality: osm,
    ureaCreatRatio: v.creat > 0 ? (v.urea * 1000) / v.creat : null,
  };
}

/* ---------------------------------------------------------------------------
   Acid–base interpretation, done the way it is taught: one step at a time,
   with the reasoning visible. Each step returns a line the learner can follow
   rather than a verdict they have to trust.
--------------------------------------------------------------------------- */
export function interpretABG(v) {
  const steps = [];
  const d = derived(v);

  // 1 — acidaemic or alkalaemic?
  const acidaemic = v.pH < 7.35, alkalaemic = v.pH > 7.45;
  steps.push({
    step: 'pH',
    finding: acidaemic ? `Acidaemia (pH ${v.pH.toFixed(2)})`
      : alkalaemic ? `Alkalaemia (pH ${v.pH.toFixed(2)})`
      : `pH ${v.pH.toFixed(2)} — within range`,
    note: acidaemic || alkalaemic ? 'The pH tells you which way the balance has tipped, and therefore which disturbance is the primary one.'
      : 'A normal pH does not mean normal acid–base status — it can be fully compensated, or two opposing disturbances.',
  });

  // 2 — respiratory or metabolic?
  const co2High = v.PaCO2 > 6.0, co2Low = v.PaCO2 < 4.7;
  const hco3Low = v.HCO3 < 22, hco3High = v.HCO3 > 26;
  let primary = 'none';
  if (acidaemic) primary = hco3Low ? 'metabolic acidosis' : co2High ? 'respiratory acidosis' : 'acidosis, mixed';
  else if (alkalaemic) primary = hco3High ? 'metabolic alkalosis' : co2Low ? 'respiratory alkalosis' : 'alkalosis, mixed';
  else if (co2High && hco3High) primary = 'compensated respiratory acidosis or metabolic alkalosis';
  else if (co2Low && hco3Low) primary = 'compensated respiratory alkalosis or metabolic acidosis';

  steps.push({
    step: 'Primary disturbance',
    finding: primary === 'none' ? 'No primary disturbance identified' : primary[0].toUpperCase() + primary.slice(1),
    note: 'Whichever of PaCO₂ or bicarbonate moves *with* the pH is the primary problem; the other is the compensation.',
  });

  // 3 — is the compensation appropriate?
  if (primary === 'metabolic acidosis') {
    const expected = 1.5 * v.HCO3 + 8;               // Winter's formula, mmHg
    const expectedKpa = expected * 0.1333;
    const actual = v.PaCO2;
    const adequate = Math.abs(actual - expectedKpa) < 0.35;
    steps.push({
      step: 'Compensation',
      finding: adequate ? `Appropriate (expected PaCO₂ ≈ ${expectedKpa.toFixed(1)} kPa, measured ${actual.toFixed(1)})`
        : actual > expectedKpa ? `Inadequate — PaCO₂ ${actual.toFixed(1)} kPa is higher than the expected ${expectedKpa.toFixed(1)}. There is an additional respiratory acidosis.`
        : `Overshoot — PaCO₂ ${actual.toFixed(1)} kPa is lower than the expected ${expectedKpa.toFixed(1)}. There is an additional respiratory alkalosis.`,
      note: "Winter's formula: expected PaCO₂ (mmHg) = 1.5 × [HCO₃⁻] + 8. Compensation never fully corrects the pH, and never overshoots — if it appears to, there is a second disturbance.",
    });
  } else if (primary === 'respiratory acidosis' || primary === 'respiratory alkalosis') {
    steps.push({
      step: 'Compensation',
      finding: 'Renal compensation takes 2–3 days to develop fully.',
      note: 'Acutely, bicarbonate moves about 1 mmol/L per 1.3 kPa change in PaCO₂. A bicarbonate that has moved much more than that means the problem is not acute.',
    });
  }

  // 4 — the anion gap, always
  const gapRaised = d.anionGapCorrected > 16;
  steps.push({
    step: 'Anion gap',
    finding: `${d.anionGap.toFixed(0)} mmol/L (albumin-corrected ${d.anionGapCorrected.toFixed(0)}) — ${gapRaised ? 'raised' : 'normal'}`,
    note: gapRaised
      ? 'An unmeasured anion is present. Lactate, ketones, urate in renal failure, or an ingested toxin.'
      : 'Calculate it on every gas, not just the acidotic ones — a normal pH can hide a raised gap balanced by a metabolic alkalosis.',
  });

  if (gapRaised && v.HCO3 < 22 && d.deltaRatio != null) {
    const r = d.deltaRatio;
    steps.push({
      step: 'Delta ratio',
      finding: `${r.toFixed(1)} — ${r < 0.4 ? 'pure normal-gap acidosis' : r < 1 ? 'mixed raised- and normal-gap acidosis' : r <= 2 ? 'pure raised-gap acidosis' : 'raised-gap acidosis with a coexisting metabolic alkalosis'}`,
      note: 'The rise in the gap should match the fall in bicarbonate. When it does not, there is more than one metabolic process running.',
    });
  }

  // 5 — oxygenation, which is a separate question entirely
  steps.push({
    step: 'Oxygenation',
    finding: v.PaO2 < 8 ? `PaO₂ ${v.PaO2.toFixed(1)} kPa — respiratory failure`
      : v.PaO2 < 10.5 ? `PaO₂ ${v.PaO2.toFixed(1)} kPa — hypoxaemic`
      : `PaO₂ ${v.PaO2.toFixed(1)} kPa — adequate`,
    note: 'Oxygenation and acid–base are separate questions on the same sample. Type 1 failure is hypoxia alone; type 2 adds a raised PaCO₂.',
  });

  if (v.lactate > 2) {
    steps.push({
      step: 'Lactate',
      finding: `${v.lactate.toFixed(1)} mmol/L — raised`,
      note: v.lactate > 4
        ? 'Above 4 mmol/L is a marker of serious tissue hypoperfusion and an independent predictor of mortality. Look at the circulation, not just the gas.'
        : 'Modestly raised lactate may be hypoperfusion, but also seizures, salbutamol, metformin or liver impairment.',
    });
  }

  return { steps, derived: d, primary, gapRaised };
}

/* ---------------------------------------------------------------------------
   Educational copy for physiology→chemistry links (display / docs only).

   Live derivation is owned by
   `models/chemistry/derive-from-haemodynamics.ts` and applied by the Patient
   Runtime. These entries are no longer an authority that mutates lab state
   or writes potassium/calcium back into Patient channels.
--------------------------------------------------------------------------- */
export const LAB_LINKS = [
  {
    id: 'hypoperfusion-lactate',
    name: 'Hypoperfusion → lactate',
    why: 'Lactate is produced whenever oxygen delivery fails to meet demand. It is the most useful single number for '
       + 'deciding whether a low blood pressure is actually harming the patient, because a young person can hold a '
       + 'normal pressure while already in shock — and their lactate will already be climbing.',
  },
  {
    id: 'haemorrhage-hb',
    name: 'Haemorrhage → haemoglobin',
    why: 'Haemoglobin is a concentration, not an amount. In acute haemorrhage the patient loses red cells and plasma '
       + 'together, so the concentration barely moves until fluid shifts in to replace the lost volume. A normal '
       + 'haemoglobin in the first hour after a bleed is reassuring only to the inexperienced.',
  },
  {
    id: 'renal-perfusion',
    name: 'Renal hypoperfusion → urea and creatinine',
    why: 'A prerenal kidney is a working kidney that is not being perfused. It reabsorbs sodium and water avidly, and '
       + 'urea follows water while creatinine does not — so the urea rises out of proportion. A urea-to-creatinine '
       + 'ratio above about 100 (SI units) points prerenal rather than intrinsic.',
  },
  {
    id: 'heart-failure-bnp',
    name: 'Wall stress → natriuretic peptide',
    why: 'Natriuretic peptides are released by stretched myocardium, so they measure filling pressure rather than '
       + 'ejection fraction. That is why they are raised in HFpEF, where the ejection fraction is normal and the '
       + 'ventricle is stiff — and why a normal level is so useful for ruling heart failure out.',
  },
  {
    id: 'potassium-ecg',
    name: 'Potassium → the ECG',
    why: 'Extracellular potassium is chemistry ground truth on the Patient Runtime. Changing it updates the '
       + 'channel mechanism the cardiac adapter reads, so T waves change shape in the ECG workspace.',
  },
  {
    id: 'calcium-ecg',
    name: 'Calcium → the QT interval',
    why: 'Calcium carries the plateau of the ventricular action potential, so it sets the length of the ST segment. '
       + 'The runtime projects chemistry calcium into the electrophysiology adapter.',
  },
];

/* ---------------------------------------------------------------------------
   Cases. Each is a full panel plus the clinical stem, and the question is
   always interpretation rather than recall.
--------------------------------------------------------------------------- */
export const CASE_SETS = [
  {
    id: 'acidbase',
    name: 'Acid–base',
    cases: [
      {
        id: 'dka',
        vignette: 'A 19-year-old with type 1 diabetes has been vomiting for a day and is breathing deeply and fast. '
          + 'pH 7.08, PaCO₂ 2.1 kPa, HCO₃⁻ 6, Na 133, Cl 96, glucose 28, albumin 40, lactate 1.4.',
        prompt: 'What is the acid–base picture?',
        labs: { pH: 7.08, PaCO2: 2.1, PaO2: 13.5, HCO3: 6, lactate: 1.4, Na: 133, Cl: 96, glucose: 28, albumin: 40, K: 5.6, urea: 9.0, creat: 105 },
        options: [
          { id: 'a', key: 'A', label: 'Raised anion gap metabolic acidosis with appropriate respiratory compensation' },
          { id: 'b', key: 'B', label: 'Normal anion gap metabolic acidosis' },
          { id: 'c', key: 'C', label: 'Respiratory alkalosis with metabolic compensation' },
          { id: 'd', key: 'D', label: 'Mixed metabolic acidosis and respiratory acidosis' },
        ],
        answer: 'a',
        diagnosis: 'Diabetic ketoacidosis — raised gap acidosis, appropriately compensated',
        findings: [
          'Anion gap 133 − (96 + 6) = 31, markedly raised — the unmeasured anion is ketones',
          "Winter's: expected PaCO₂ ≈ 1.5 × 6 + 8 = 17 mmHg ≈ 2.3 kPa; measured 2.1 — appropriate",
          'The deep, fast breathing is the compensation, not a second problem',
        ],
        teaching: 'The potassium of 5.6 is the trap. Total body potassium in DKA is profoundly depleted; it only looks '
          + 'high because acidosis and insulin deficiency have driven it out of cells. Give insulin without watching it '
          + 'and the level will fall off a cliff.',
        pitfall: 'Never treat the number in front of you without asking where that ion actually is.',
      },
      {
        id: 'copd',
        vignette: 'A 68-year-old with COPD is drowsy after a chest infection. pH 7.26, PaCO₂ 9.4 kPa, PaO₂ 7.2 kPa, '
          + 'HCO₃⁻ 34, Na 139, Cl 96, albumin 38, lactate 1.1.',
        prompt: 'How do you read this gas?',
        labs: { pH: 7.26, PaCO2: 9.4, PaO2: 7.2, HCO3: 34, lactate: 1.1, Na: 139, Cl: 96, albumin: 38, K: 4.2, urea: 6.0, creat: 88 },
        options: [
          { id: 'a', key: 'A', label: 'Acute-on-chronic respiratory acidosis with type 2 respiratory failure' },
          { id: 'b', key: 'B', label: 'Acute respiratory acidosis alone' },
          { id: 'c', key: 'C', label: 'Metabolic alkalosis with respiratory compensation' },
          { id: 'd', key: 'D', label: 'Raised anion gap metabolic acidosis' },
        ],
        answer: 'a',
        diagnosis: 'Acute-on-chronic type 2 respiratory failure',
        findings: [
          'Acidaemic with a high PaCO₂ — the respiratory system is the primary problem',
          'Bicarbonate 34 is far too high for an acute rise; renal retention takes days',
          'PaO₂ 7.2 with a raised PaCO₂ is type 2 respiratory failure',
          'Anion gap 139 − (96 + 34) = 9, normal',
        ],
        teaching: 'The bicarbonate dates the illness. An acute rise in PaCO₂ of this size would lift bicarbonate by only '
          + 'about 3 mmol/L; 34 means the kidney has been compensating for a long time and something has now been added '
          + 'on top. The chronic part is the COPD, the acute part is the infection.',
        pitfall: 'Give uncontrolled oxygen here and the PaCO₂ climbs further. Target saturations of 88–92%.',
      },
      {
        id: 'shock',
        vignette: 'A 74-year-old is hypotensive after three days of diarrhoea. pH 7.22, PaCO₂ 3.4 kPa, HCO₃⁻ 11, '
          + 'Na 141, Cl 115, albumin 32, lactate 5.8, urea 21, creatinine 190.',
        prompt: 'What is going on metabolically?',
        labs: { pH: 7.22, PaCO2: 3.4, PaO2: 12.5, HCO3: 11, lactate: 5.8, Na: 141, Cl: 115, albumin: 32, K: 3.1, urea: 21, creat: 190 },
        options: [
          { id: 'a', key: 'A', label: 'Mixed raised-gap and normal-gap metabolic acidosis' },
          { id: 'b', key: 'B', label: 'Pure normal anion gap acidosis from diarrhoea' },
          { id: 'c', key: 'C', label: 'Pure lactic acidosis' },
          { id: 'd', key: 'D', label: 'Respiratory alkalosis' },
        ],
        answer: 'a',
        diagnosis: 'Two acidoses at once — lactic acidosis on top of gastrointestinal bicarbonate loss',
        findings: [
          'Anion gap 141 − (115 + 11) = 15; corrected for albumin 32 → 17.5, raised',
          'Delta ratio (17.5 − 12) / (24 − 11) = 0.42 — too low for a pure raised-gap acidosis',
          'Lactate 5.8 accounts for the gap; the chloride of 115 accounts for the rest',
          'Urea:creatinine ratio 110 — prerenal',
        ],
        teaching: 'The delta ratio is what reveals the second process. Diarrhoea loses bicarbonate with chloride retained, '
          + 'giving a normal gap; the shock adds lactate, giving a raised one. Treat only the dehydration and the lactate '
          + 'stays; treat only the shock and the chloride load persists.',
        pitfall: 'A gap that is only mildly raised in a hypoalbuminaemic patient is a raised gap. Correct for albumin or you will miss it.',
      },
    ],
  },
  {
    id: 'sodium',
    name: 'Sodium & volume',
    cases: [
      {
        id: 'hypovolaemic-hypona',
        vignette: 'An 80-year-old on bendroflumethiazide has been unwell for a week. She is tachycardic with dry mucous '
          + 'membranes. Na 124, K 3.2, urea 14, creatinine 130, glucose 5.1.',
        prompt: 'What kind of hyponatraemia is this?',
        labs: { Na: 124, K: 3.2, Cl: 88, urea: 14, creat: 130, glucose: 5.1, albumin: 38, pH: 7.44, HCO3: 28, PaCO2: 5.4, lactate: 1.2 },
        options: [
          { id: 'a', key: 'A', label: 'Hypovolaemic hyponatraemia' },
          { id: 'b', key: 'B', label: 'SIADH' },
          { id: 'c', key: 'C', label: 'Hypervolaemic hyponatraemia from heart failure' },
          { id: 'd', key: 'D', label: 'Pseudohyponatraemia' },
        ],
        answer: 'a',
        diagnosis: 'Hypovolaemic hyponatraemia — thiazide-associated',
        findings: [
          'Clinically dry with a raised urea and a urea:creatinine ratio above 100',
          'Hypokalaemia and metabolic alkalosis fit thiazide use',
          'Volume depletion is itself a stimulus to ADH, which is why the sodium falls',
        ],
        teaching: 'Volume status is the first branch point in every hyponatraemia, and it is a clinical assessment rather '
          + 'than a laboratory one. The same sodium of 124 means opposite things — and opposite treatments — in a dry '
          + 'patient and an oedematous one. SIADH is a diagnosis of euvolaemia and cannot be made in a patient who is dry.',
        pitfall: 'Correcting chronic hyponatraemia faster than about 10 mmol/L per day risks osmotic demyelination.',
      },
      {
        id: 'siadh',
        vignette: 'A 62-year-old smoker with weight loss is euvolaemic on examination. Na 121, urea 3.0, creatinine 62, '
          + 'glucose 4.8, serum osmolality 254, urine osmolality 480, urine sodium 55.',
        prompt: 'What is the mechanism?',
        labs: { Na: 121, K: 4.1, Cl: 88, urea: 3.0, creat: 62, glucose: 4.8, albumin: 36, pH: 7.41, HCO3: 24, PaCO2: 5.2, lactate: 1.0 },
        options: [
          { id: 'a', key: 'A', label: 'SIADH — inappropriately concentrated urine despite low serum osmolality' },
          { id: 'b', key: 'B', label: 'Hypovolaemic hyponatraemia' },
          { id: 'c', key: 'C', label: 'Primary polydipsia' },
          { id: 'd', key: 'D', label: 'Cerebral salt wasting' },
        ],
        answer: 'a',
        diagnosis: 'SIADH, likely paraneoplastic from a small cell lung carcinoma',
        findings: [
          'True hypo-osmolar hyponatraemia — serum osmolality 254',
          'Urine osmolality 480 is inappropriately concentrated when it should be maximally dilute',
          'Urine sodium 55 with a low urea indicates euvolaemia, not depletion',
        ],
        teaching: 'The kidney should respond to a dilute plasma by producing maximally dilute urine. Concentrated urine '
          + 'in the face of low serum osmolality means ADH is acting when it should be switched off. In primary '
          + 'polydipsia the urine is appropriately dilute, which is how it is distinguished.',
        pitfall: 'Cerebral salt wasting looks almost identical but the patient is volume-depleted — and the treatments '
          + 'are opposite. Fluid restriction in salt wasting makes things worse.',
      },
    ],
  },
];

export const LESSONS = [
  {
    id: 'gap',
    title: 'The anion gap, and why you calculate it every time',
    blurb: 'A normal pH can hide two opposing disturbances.',
    setup: { labs: { pH: 7.40, PaCO2: 5.3, HCO3: 24, Na: 140, Cl: 104, albumin: 42, lactate: 1.0 } },
    steps: [
      { kind: 'say', eyebrow: 'Start normal', text:
        'A completely normal gas. Sodium 140, chloride 104, bicarbonate 24 — the anion gap is 12, and the panel '
        + 'reports no disturbance. Nothing to see.' },
      { kind: 'predict', text:
        'Now the patient becomes septic and lactate rises to 8, consuming bicarbonate. But they are also vomiting, '
        + 'which loses acid and raises bicarbonate. Both happen at once and the pH lands back at 7.39. '
        + 'What will the anion gap show?',
        options: [
          { id: 'a', label: 'Normal, like the pH', correct: false,
            why: 'The pH is normal because the two disturbances cancel, but the anion gap does not cancel — the '
               + 'lactate is still there as an unmeasured anion.' },
          { id: 'b', label: 'Raised, revealing the hidden acidosis', correct: true,
            why: 'Bicarbonate has been consumed by lactate and replenished by vomiting, so it reads normal. But the '
               + 'lactate anion is still in the plasma and still unmeasured, so the gap is wide. The gap sees the '
               + 'acidosis that the pH and the bicarbonate have both concealed.' },
          { id: 'c', label: 'Low, because of the alkalosis', correct: false,
            why: 'A low gap comes from unmeasured *cations* or low albumin, not from alkalosis.' },
        ],
        then: { labs: { pH: 7.39, PaCO2: 5.3, HCO3: 24, Na: 140, Cl: 92, albumin: 42, lactate: 8.0 } },
        after: 'Gap = 140 − (92 + 24) = 24. Wide open, on a gas whose pH and bicarbonate are both normal. The chloride '
             + 'is the tell — it has fallen to make room for the lactate.' },
      { kind: 'recap', points: [
        'Calculate the anion gap on every gas, not only the acidotic ones.',
        'A normal pH can mean no disturbance, or two that cancel.',
        'Correct the gap for albumin: subtract roughly 2.5 from the expected gap for every 10 g/L the albumin is low.',
        'The delta ratio then tells you whether the gap and the bicarbonate moved together.',
      ] },
    ],
  },
  {
    id: 'lactate-loop',
    title: 'Where lactate comes from',
    blurb: 'The lab number the circulation writes.',
    steps: [
      { kind: 'say', eyebrow: 'One patient', text:
        'Lactate is not really a laboratory value — it is a haemodynamic one that happens to be measured in a tube. '
        + 'It rises when oxygen delivery stops meeting demand, and oxygen delivery is cardiac output times '
        + 'haemoglobin times saturation. This lesson changes the circulation and watches the gas.' },
      { kind: 'predict', text:
        'We are about to remove 1500 mL of blood in the Circulation workspace. The baroreflex is intact and will '
        + 'defend the blood pressure. What happens to the lactate?',
        options: [
          { id: 'a', label: 'It stays normal, because the pressure is defended', correct: false,
            why: 'Pressure and flow are not the same thing. The reflex defends pressure by constricting arterioles, '
               + 'which maintains the number on the monitor while flow to the tissues falls.' },
          { id: 'b', label: 'It rises, because output falls even though pressure is held', correct: true,
            why: 'This is the single most important thing lactate teaches. A compensated patient can have a nearly '
               + 'normal blood pressure and already be in shock, because the compensation works by trading flow for '
               + 'pressure. The lactate sees the flow.' },
          { id: 'c', label: 'It falls, because metabolism slows', correct: false,
            why: 'Anaerobic metabolism produces more lactate, not less.' },
        ],
        then: { patient: { bloodVolume: 3500 } },
        after: 'Open the Circulation workspace and look: the mean pressure is holding far better than the cardiac '
             + 'output is. Then come back here and read the gas. The two workspaces are describing one patient.' },
      { kind: 'recap', points: [
        'Lactate measures flow, blood pressure measures pressure, and compensation trades one for the other.',
        'A normal blood pressure does not exclude shock, particularly in the young.',
        'Above 4 mmol/L is an independent predictor of mortality — and a reason to act now.',
        'Clearance over hours is a better guide to treatment than any single value.',
      ] },
    ],
  },
];
