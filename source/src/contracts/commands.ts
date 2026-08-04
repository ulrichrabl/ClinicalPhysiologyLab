import type { CommandId, SimTime } from './brands.ts';
import type { RuntimeError } from './errors.ts';

export type CommandSource =
  | { type: 'learner'; sessionId: string }
  | { type: 'scenario'; id: string; version?: string }
  | { type: 'lesson'; id: string }
  | { type: 'agent'; sessionId: string; toolCallId?: string }
  | { type: 'test'; id: string }
  | { type: 'system' }
  | { type: 'ui'; surface: string };

export interface PatientCommand<TPayload = unknown> {
  id: CommandId;
  type: string;
  payload: TPayload;
  source: CommandSource;
  issuedAt?: SimTime;
  expectedRevision?: number;
}

export interface PatientEventRef {
  id: string;
  type: string;
  at: SimTime;
}

export interface CommandResult {
  accepted: boolean;
  revision: number;
  commandId: CommandId;
  error?: RuntimeError;
  mechanisms?: string[];
  events?: PatientEventRef[];
  changedPaths?: string[];
}

export interface ActivateConditionPayload {
  condition: string;
  parameters: Record<string, unknown>;
  instanceId?: string;
}

export interface ResolveConditionPayload {
  condition?: string;
  instanceId?: string;
}

export interface AdvanceTimePayload {
  durationMs: number;
}

export type KnownCommandType =
  | 'condition.activate'
  | 'condition.resolve'
  | 'runtime.advance'
  | 'runtime.pause'
  | 'runtime.resume'
  | 'runtime.reset'
  | 'checkpoint.restore';
