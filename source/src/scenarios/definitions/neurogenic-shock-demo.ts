import type { ScenarioDefinition } from '../../contracts/scenarios.ts';

/**
 * Scenario seed for the first proof slice (spec §19).
 * Intentionally data-only: activation goes through runtime.dispatch via the compiler.
 */
export const neurogenicShockDemo: ScenarioDefinition = {
  id: 'neurogenic-shock-demo',
  version: '0.2.0',
  title: 'C5 spinal cord injury — neurogenic shock',
  presentationTitle: 'Collapse after a diving accident',
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
  initialization: 'fresh-patient',
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
    mayObserve: [
      'general-appearance',
      'vital-signs',
      'neurological-examination',
      'cardiovascular-examination',
      'twelve-lead-ecg',
      'laboratory-panel',
    ],
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
  triggers: [
    {
      id: 'hypotension-recognised',
      when: {
        kind: 'vital-threshold',
        vital: 'meanArterialPressure',
        op: 'lt',
        value: 75,
      },
      then: {
        kind: 'annotate',
        label: 'Hypotension with relative bradycardia — consider neurogenic shock',
        detail: {
          teaching: 'Compensatory tachycardia is absent because cardiac accelerator fibres are interrupted.',
        },
      },
    },
    {
      id: 'five-second-settle-note',
      when: { kind: 'sim-time', atMs: 5000 },
      then: {
        kind: 'annotate',
        label: 'Physiology has settled under complete C5 lesion',
      },
    },
  ],
};
