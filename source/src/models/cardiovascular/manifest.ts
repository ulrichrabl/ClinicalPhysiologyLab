import type { ModelManifest } from '../../contracts/models.ts';

/** Versioned plugin manifests for the current circulation + ECG engines. */

export const CIRCULATION_MODEL_MANIFEST: ModelManifest = {
  id: 'cardiovascular.circulation.current',
  version: '1.0.0',
  system: 'cardiovascular',
  fidelity: 'educational',
  deterministic: true,
  consumes: [
    'vascular.systemicArteriolarTone',
    'vascular.venousTone',
    'autonomic.cardiacAcceleratorDrive',
    'cardiovascular.baroreflexEnabled',
    'cardiovascular.contractility',
    'cardiovascular.avConduction',
    'chemistry.extracellularPotassium',
  ],
  provides: [
    'cardiovascular.meanArterialPressure',
    'cardiovascular.heartRate',
    'cardiovascular.cardiacOutput',
    'cardiovascular.centralVenousPressure',
    'cardiovascular.bloodVolume',
  ],
  cadence: {
    preferredStepMs: 0.5,
    maximumStepMs: 2,
  },
  capabilities: [
    'cardiovascular.closed-loop',
    'cardiovascular.right-heart',
    'cardiovascular.pulmonary-circulation',
    'cardiovascular.baroreflex',
    'cardiovascular.autonomic-input',
  ],
  limitations: [
    'Educational four-chamber Guyton-style model; not a clinical decision-support device',
    'Baroreflex is a simplified first-order effector',
  ],
  stateSchemaVersion: '1',
};

export const ELECTROPHYSIOLOGY_MODEL_MANIFEST: ModelManifest = {
  id: 'cardiovascular.electrophysiology.hybrid-ecg',
  version: '0.1.0',
  system: 'electrophysiology',
  fidelity: 'educational',
  deterministic: true,
  consumes: [
    'chemistry.extracellularPotassium',
    'electrophysiology.stDurationFactor',
    'autonomic.cardiacAcceleratorDrive',
  ],
  provides: [
    'electrophysiology.twelve-lead',
    'electrophysiology.monitor-lead',
  ],
  cadence: {
    preferredStepMs: 2,
    maximumStepMs: 4,
  },
  capabilities: [
    'ecg.twelve-lead',
    'ecg.regional-ischaemia',
  ],
  limitations: [
    'Hybrid conduction + source synthesis; morphology is educational, not diagnostic-grade',
  ],
  stateSchemaVersion: '1',
};
