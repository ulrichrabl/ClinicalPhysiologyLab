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
  drivenKeys: string[];
  /** Provenance for educational display — not for clients to mutate. */
  provenance: { portId: string; value: unknown; contributions: number }[];
}

export interface AdvanceResult {
  from: SimTime;
  to: SimTime;
  publicPhysiology: PublicPhysiologyView;
  events: TimelineEntry[];
}

export interface PublicPhysiologyView {
  cardiovascular: {
    meanArterialPressure: number | null;
    systolicPressure: number | null;
    diastolicPressure: number | null;
    heartRate: number | null;
    cardiacOutput: number | null;
    centralVenousPressure: number | null;
    meanFillingPressure: number | null;
    ejectionFraction: number | null;
  };
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
  | { type: 'perform.examination'; exam: string; region?: string };

export type ObservationResult<R extends ObservationRequest> =
  R['type'] extends 'observe.vital-signs' ? Observation<VitalSignsValue>
  : R['type'] extends 'observe.general-appearance' ? Observation<GeneralAppearanceValue>
  : R['type'] extends 'observe.physiology' ? Observation<Record<string, unknown>>
  : R['type'] extends 'perform.examination' ? Observation<ExaminationValue>
  : Observation<unknown>;

export interface VitalSignsValue {
  heartRate: number | null;
  bloodPressure: { systolic: number | null; diastolic: number | null; mean: number | null };
  cardiacOutput: number | null;
  pattern?: string;
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
