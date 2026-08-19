import type {
  AdvanceResult,
  CheckpointRef,
  ObservationRequest,
  ObserveOutcome,
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
import type { RuntimeSession } from './session.ts';

export interface PatientRuntime {
  readonly fingerprint: RuntimeFingerprint;
  /** Instance-local ID namespaces — never share a module-global factory. */
  readonly ids: import('./brands.ts').RuntimeIdFactory;

  dispatch(command: PatientCommand, session?: RuntimeSession): CommandResult;
  query<Q extends RuntimeQuery>(query: Q, session?: RuntimeSession): QueryResult<Q>;
  /** Clinical / UI clients — latent state denied when scenario hides it. */
  queryForClient<Q extends RuntimeQuery>(query: Q, session?: RuntimeSession): QueryResult<Q>;
  observe<R extends ObservationRequest>(request: R, session?: RuntimeSession): ObserveOutcome<R>;

  /**
   * Advance simulation time. Live hosts resolve when a correlated model
   * response arrives; headless settle resolves in the same turn.
   */
  advance(duration: SimDuration): Promise<AdvanceResult>;
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
export * from './authority.ts';
export * from './model-plugin.ts';
export * from './session.ts';
