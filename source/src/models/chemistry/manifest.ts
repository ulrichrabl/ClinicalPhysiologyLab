import type { ModelManifest } from '../../contracts/models.ts';

export const CHEMISTRY_MODEL_MANIFEST: ModelManifest = {
  id: 'chemistry.educational.v1',
  version: '1.0.0',
  system: 'chemistry',
  fidelity: 'educational',
  deterministic: true,
  consumes: [
    'cardiovascular.meanArterialPressure',
    'cardiovascular.cardiacOutput',
    'cardiovascular.bloodVolume',
    'cardiovascular.leftAtrialPressure',
  ],
  provides: [
    'chemistry.extracellularPotassium',
    'chemistry.calcium',
    'chemistry.lactate',
    'chemistry.acid-base',
  ],
  cadence: {
    preferredStepMs: 1000,
    maximumStepMs: 5000,
  },
  capabilities: [
    'laboratory.acid-base',
    'laboratory.chemistry-panel',
    'chemistry.potassium-ecg-coupling',
  ],
  limitations: [
    'Educational chemistry and derived hypoperfusion links; not a clinical analyser',
  ],
  stateSchemaVersion: '1',
};
