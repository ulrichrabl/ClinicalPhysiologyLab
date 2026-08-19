/**
 * Executable model plugin contract (stabilization slice).
 *
 * Current Circulation/ECG engines are still adapter-wrapped behind this
 * interface — not yet hot-swappable plug-and-play. The runtime should depend
 * on this contract rather than importing concrete simulators long-term.
 */

import type { ModelManifest } from './models.ts';

export interface SerializedModelState {
  schemaVersion: string;
  modelId: string;
  payload: unknown;
}

export interface ModelAdvanceRequest<State, Inputs> {
  state: State;
  fromMs: number;
  durationMs: number;
  inputs: Inputs;
}

export interface ModelAdvanceResult<State, Outputs> {
  state: State;
  /** Wall/sim milliseconds actually advanced. */
  advancedMs: number;
  outputs: Outputs;
  /** Host snapshot bag for public-state adapters. */
  snapshot: Record<string, unknown>;
}

export interface PhysiologyModelPlugin<State = unknown, Inputs = unknown, Outputs = unknown> {
  readonly manifest: ModelManifest;
  initialize(seed: string): State;
  /**
   * Advance model state. Must be awaitable — Worker-backed hosts cannot
   * provide the target state synchronously.
   */
  advance(
    request: ModelAdvanceRequest<State, Inputs>,
  ): Promise<ModelAdvanceResult<State, Outputs>> | ModelAdvanceResult<State, Outputs>;
  snapshot(state: State): SerializedModelState;
  restore(serialized: SerializedModelState): State;
}

/** Inputs the cardiovascular adapter may hand a host. */
export interface CardioModelInputs {
  privateParams: Record<string, number | boolean>;
  bloodVolume?: number;
  experimental?: Record<string, number | boolean>;
}
