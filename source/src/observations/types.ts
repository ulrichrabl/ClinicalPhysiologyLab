import type { ObservationId, SimTime } from '../contracts/brands.ts';
import type {
  Observation,
  ObservationQuality,
  ObservationProvenance,
} from '../contracts/queries.ts';
import type {
  CardiovascularPublicState,
  ElectrophysiologyPublicState,
} from '../models/cardiovascular/public-state.ts';

export interface ObservationManifest {
  id: string;
  version: string;
  observationType: string;
  capabilities: string[];
  idealByDefault: boolean;
}

export interface PatientStateProjection {
  cardiovascular: CardiovascularPublicState;
  electrophysiology: ElectrophysiologyPublicState;
  neurological: {
    cordLesionLevel: string | null;
    lesionCompleteness: number | null;
  };
  simTime: SimTime;
}

export interface ObservationContext {
  authority?: string;
  clinicalMode?: boolean;
}

export interface ObservationPlan<TResult> {
  immediate?: Observation<TResult>;
  /** Future: schedule acquisition delay events. */
  delayMs?: number;
}

export interface ObservationModel<TRequest, TResult> {
  readonly manifest: ObservationManifest;
  canObserve(context: ObservationContext, request: TRequest): { ok: true } | { ok: false; reason: string };
  observe(input: {
    patient: Readonly<PatientStateProjection>;
    request: TRequest;
    context: ObservationContext;
    observationId: ObservationId;
  }): ObservationPlan<TResult>;
}

export function observationShell<T>(input: {
  id: ObservationId;
  type: string;
  time: SimTime;
  value: T;
  provenance: ObservationProvenance;
  quality?: ObservationQuality;
  interpretation?: { id: string; label: string }[];
}): Observation<T> {
  return {
    id: input.id,
    type: input.type,
    requestedAt: input.time,
    acquiredAt: input.time,
    availableAt: input.time,
    value: input.value,
    quality: input.quality ?? { ideal: true, artefact: null },
    provenance: input.provenance,
    interpretation: input.interpretation,
  };
}
