import type { ObservationId, SimTime } from './brands.ts';

export type RuntimeQuery =
  | { type: 'runtime.capabilities' }
  | { type: 'runtime.fingerprint' }
  | { type: 'runtime.time' }
  | { type: 'mechanisms.active' }
  | { type: 'conditions.active' }
  | { type: 'effects.resolved' }
  | { type: 'timeline.range'; from: SimTime; to: SimTime }
  | { type: 'explanation.for'; observationId: ObservationId }
  | { type: 'explanation.vitals' }
  | { type: 'state.projection'; projection: StateProjectionId }
  | { type: 'adapter.cardio.privateParams' };

export type StateProjectionId =
  | 'clinicalSummary'
  | 'publicPhysiology'
  | 'authoringState'
  | 'modelDiagnostics'
  | 'explanationTrace'
  | 'timelineRange';

export type QueryResultMap = {
  'runtime.capabilities': RuntimeCapabilities;
  'runtime.fingerprint': RuntimeFingerprint;
  'runtime.time': { simTimeMs: SimTime };
  'mechanisms.active': ActiveMechanismView[];
  'conditions.active': ActiveConditionView[];
  'effects.resolved': Record<string, { value: unknown; baseline: unknown; contributions: unknown[] }>;
  'timeline.range': TimelineEntry[];
  'explanation.for': unknown;
  'explanation.vitals': unknown;
  'state.projection': unknown;
  'adapter.cardio.privateParams': CardioPrivateParams;
};

export type QueryResult<Q extends RuntimeQuery> = Q['type'] extends keyof QueryResultMap
  ? QueryResultMap[Q['type']]
  : unknown;

export interface RuntimeFingerprint {
  runtimeVersion: string;
  scenario: { id: string; version: string };
  models: {
    id: string;
    version: string;
    stateSchemaVersion: string;
    configurationHash: string;
  }[];
  seed: string;
}

export interface RuntimeCapabilities {
  runtimeVersion: string;
  conditions: { id: string; version: string; requires: string[] }[];
  observations: string[];
  experimentalControls: string[];
  capabilities: string[];
}

export interface ActiveMechanismView {
  mechanismId: string;
  displayName: string;
  conditionId?: string;
  effectTargets: string[];
}

export interface ActiveConditionView {
  instanceId: string;
  conditionId: string;
  version: string;
  parameters: Record<string, unknown>;
  activatedAt: SimTime;
}

export interface TimelineEntry {
  id: string;
  at: SimTime;
  type: string;
  label: string;
  detail?: unknown;
}

export interface CardioPrivateParams {
  Rsys: number;
  HR: number;
  V0sv: number;
  baroEnabled: boolean;
  Emax?: number;
  avConduction?: number;
  K?: number;
  stFactor?: number;
  drivenKeys: string[];
  /** Provenance for educational display — not for clients to mutate. */
  provenance: { portId: string; value: unknown; contributions: number }[];
}

export interface AdvanceResult {
  from: SimTime;
  to: SimTime;
  /** Correlated request id for live model advances (null for pure clock ticks). */
  requestId?: string | null;
  /** Duration the model actually advanced (may differ from request). */
  advancedMs?: number;
  publicPhysiology: PublicPhysiologyView;
  events: TimelineEntry[];
}

export interface PublicPhysiologyView {
  cardiovascular: import('../models/cardiovascular/public-state.ts').CardiovascularPublicState;
  electrophysiology: import('../models/cardiovascular/public-state.ts').ElectrophysiologyPublicState;
  chemistry: import('../models/chemistry/public-state.ts').ChemistryPublicState;
  neurological: {
    cordLesionLevel: string | null;
    lesionCompleteness: number | null;
  };
  autonomic: {
    sympatheticOutflow: number;
    cardiacAcceleratorDrive: number;
  };
  vascular: {
    venousTone: number;
    systemicArteriolarTone: number;
  };
}

export interface CheckpointRef {
  id: string;
  label?: string;
  createdAt: SimTime;
  revision: number;
}

export interface RestoreResult {
  accepted: boolean;
  revision: number;
  error?: { code: string; message: string };
}

export interface RuntimeBranch {
  id: string;
  label?: string;
  fromCheckpoint: string;
  createdAt: SimTime;
}

export type RuntimeListener = (event: RuntimeListenerEvent) => void;
export type Unsubscribe = () => void;

export interface RuntimeListenerEvent {
  type: string;
  revision: number;
  simTime: SimTime;
  detail?: unknown;
}

export interface ObservationQuality {
  ideal: boolean;
  noise?: number;
  artefact?: string | null;
}

export interface ObservationProvenance {
  modelId: string;
  latentPaths: string[];
}

export interface Observation<TResult> {
  id: ObservationId;
  type: string;
  requestedAt: SimTime;
  acquiredAt: SimTime;
  availableAt: SimTime;
  value: TResult;
  quality: ObservationQuality;
  provenance: ObservationProvenance;
  interpretation?: { id: string; label: string }[];
}

export type ObservationRequest =
  | { type: 'observe.vital-signs' }
  | { type: 'observe.general-appearance' }
  | { type: 'observe.physiology'; paths?: string[] }
  | { type: 'observe.twelve-lead-ecg'; leads?: string[] }
  | { type: 'observe.laboratory-panel'; panel?: 'all' | 'abg' | 'chem' | 'fbc' | 'cardiac'; includeInterpretation?: boolean }
  | { type: 'perform.examination'; exam: string; region?: string };

export type ObservationResult<R extends ObservationRequest> =
  R['type'] extends 'observe.vital-signs' ? Observation<VitalSignsValue>
  : R['type'] extends 'observe.general-appearance' ? Observation<GeneralAppearanceValue>
  : R['type'] extends 'observe.physiology' ? Observation<Record<string, unknown>>
  : R['type'] extends 'observe.twelve-lead-ecg' ? Observation<TwelveLeadEcgValue>
  : R['type'] extends 'observe.laboratory-panel' ? Observation<LaboratoryPanelValue>
  : R['type'] extends 'perform.examination' ? Observation<ExaminationValue>
  : Observation<unknown>;

/** Explicit denial — never a fake successful observation with empty value. */
export interface ObservationDenied {
  accepted: false;
  id: ObservationId;
  type: string;
  requestedAt: SimTime;
  error: import('./errors.ts').RuntimeError;
}

export type ObserveOutcome<R extends ObservationRequest> =
  | { accepted: true; observation: ObservationResult<R> }
  | ObservationDenied;

export interface VitalSignsValue {
  heartRate: number | null;
  bloodPressure: { systolic: number | null; diastolic: number | null; mean: number | null };
  cardiacOutput: number | null;
  pattern?: string;
}

export interface TwelveLeadEcgValue {
  sampleRateHz: number;
  leads: Record<string, number[]>;
  features: {
    heartRate: number | null;
    qrsAxis: number | null;
    pathology: string | null;
  };
  report: string;
}

export interface LaboratoryPanelValue {
  panel: string;
  results: Record<string, number>;
  lines: {
    key: string;
    label: string;
    value: number;
    unit: string;
    flag: string;
    reference: [number, number];
    source: 'chemistry' | 'physiology-derived' | 'pinned';
  }[];
  derived: {
    anionGap: number;
    anionGapCorrected: number;
    deltaRatio: number | null;
    osmolality: number;
    ureaCreatRatio: number | null;
  };
  interpretation?: {
    steps: { step: string; finding: string; note: string }[];
    primary: string;
    gapRaised: boolean;
  };
  activeDerivations: { id: string; name: string; text: string; why: string }[];
}

export interface GeneralAppearanceValue {
  appearance: string;
  consciousness: string;
  perfusion: string;
}

export interface ExaminationValue {
  exam: string;
  findings: string[];
}
