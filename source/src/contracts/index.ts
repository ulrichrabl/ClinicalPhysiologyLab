import type {
  AdvanceResult,
  CheckpointRef,
  ObservationRequest,
  ObservationResult,
  QueryResult,
  RestoreResult,
  RuntimeBranch,
  RuntimeCapabilities,
  RuntimeFingerprint,
  RuntimeListener,
  RuntimeQuery,
  Unsubscribe,
} from './queries.ts';
import type { CommandResult, PatientCommand } from './commands.ts';
import type { SimDuration } from './brands.ts';

export interface PatientRuntime {
  readonly fingerprint: RuntimeFingerprint;

  dispatch(command: PatientCommand): CommandResult;
  query<Q extends RuntimeQuery>(query: Q): QueryResult<Q>;
  observe<R extends ObservationRequest>(request: R): ObservationResult<R>;

  advance(duration: SimDuration): AdvanceResult;
  play(options?: { speed?: number }): void;
  pause(): void;

  createCheckpoint(label?: string): CheckpointRef;
  restoreCheckpoint(ref: CheckpointRef | string): RestoreResult;
  branch(ref: CheckpointRef | string, label?: string): RuntimeBranch;

  describeCapabilities(): RuntimeCapabilities;
  subscribe(listener: RuntimeListener): Unsubscribe;
}

export * from './brands.ts';
export * from './errors.ts';
export * from './effects.ts';
export * from './provenance.ts';
export * from './commands.ts';
export * from './queries.ts';
export * from './models.ts';
export * from './scenarios.ts';
