/**
 * Scenario seed for the first proof slice (spec §19).
 * Intentionally data-only: activation goes through runtime.dispatch.
 */
export const neurogenicShockDemo = {
  id: 'neurogenic-shock-demo',
  version: '0.1.0',
  title: 'C5 spinal cord injury — neurogenic shock',
  learningObjectives: [
    'Recognise hypotension with relative bradycardia as neurogenic shock',
    'Link interruption of descending sympathetic pathways to venous pooling and loss of arteriolar tone',
    'Contrast the pattern with compensatory tachycardia in haemorrhage',
  ],
  patient: {
    ageYears: 28,
    sex: 'male',
    heightCm: 178,
    weightKg: 76,
  },
  conditions: [
    {
      id: 'cervical-spinal-cord-injury',
      parameters: {
        level: 'C5',
        completeness: 1,
        side: 'bilateral',
      },
    },
  ],
  requiredCapabilities: [
    'cardiovascular.closed-loop',
    'cardiovascular.autonomic-input',
    'neurology.pathway-localisation',
    'observation.vital-signs',
  ],
  visibility: {
    latentState: 'hidden',
    diagnoses: 'hidden',
    explanations: 'available',
  },
  authority: {
    mayObserve: ['general-appearance', 'vital-signs', 'neurological-examination', 'cardiovascular-examination'],
    mayTreat: ['intravenous-fluid', 'vasopressor'],
    mayUseExperimentalControls: false,
    mayReadLatentState: false,
    mayAdvanceTime: true,
  },
  /** Canonical command issued by UI, scenario, test, and tool clients alike. */
  initialCommand: {
    type: 'condition.activate',
    payload: {
      condition: 'cervical-spinal-cord-injury',
      parameters: {
        level: 'C5',
        completeness: 1,
        side: 'bilateral',
      },
    },
    source: { type: 'scenario', id: 'neurogenic-shock-demo', version: '0.1.0' },
  },
} as const;
