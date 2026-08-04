import type { CommandSource, PatientCommand } from './commands.ts';
import type { RuntimeError } from './errors.ts';
import type { SimTime } from './brands.ts';

/** Who may do what while a scenario is active (ADR-007 / ADR-009). */
export interface ScenarioAuthority {
  mayObserve: string[];
  mayTreat: string[];
  mayUseExperimentalControls: boolean;
  mayReadLatentState: boolean;
  mayAdvanceTime: boolean;
  mayAuthorConditions?: boolean;
}

export interface ScenarioVisibility {
  latentState: 'hidden' | 'available';
  diagnoses: 'hidden' | 'available';
  explanations: 'hidden' | 'available';
}

export interface ScenarioPatientProfile {
  ageYears?: number;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
}

export interface ScenarioConditionSeed {
  id: string;
  parameters: Record<string, unknown>;
  instanceId?: string;
}

/** Declarative trigger: when a predicate holds, emit a command or timeline note. */
export type ScenarioTriggerWhen =
  | { kind: 'sim-time'; atMs: number }
  | { kind: 'condition-active'; conditionId: string }
  | {
      kind: 'vital-threshold';
      vital: 'meanArterialPressure' | 'heartRate' | 'cardiacOutput';
      op: 'lt' | 'gt' | 'lte' | 'gte';
      value: number;
    };

export type ScenarioTriggerThen =
  | {
      kind: 'dispatch';
      command: {
        type: string;
        payload?: unknown;
      };
    }
  | {
      kind: 'annotate';
      label: string;
      detail?: unknown;
    };

export interface ScenarioTrigger {
  id: string;
  /** Fire at most once unless repeat is true. */
  repeat?: boolean;
  when: ScenarioTriggerWhen;
  then: ScenarioTriggerThen;
}

/**
 * Author-facing scenario definition (data only).
 * The compiler turns this into seed commands + armed triggers.
 */
export interface ScenarioDefinition {
  id: string;
  version: string;
  title: string;
  learningObjectives: string[];
  patient?: ScenarioPatientProfile;
  conditions: ScenarioConditionSeed[];
  requiredCapabilities: string[];
  visibility: ScenarioVisibility;
  authority: ScenarioAuthority;
  /**
   * Optional explicit seed command. If omitted, the compiler synthesises
   * condition.activate commands from `conditions`.
   */
  initialCommand?: {
    type: string;
    payload: unknown;
    source?: CommandSource;
  };
  triggers?: ScenarioTrigger[];
}

export interface CompiledTrigger {
  id: string;
  repeat: boolean;
  when: ScenarioTriggerWhen;
  then: ScenarioTriggerThen;
  fired: boolean;
}

export interface CompiledScenario {
  definition: ScenarioDefinition;
  seedCommands: Omit<PatientCommand, 'id'>[];
  triggers: CompiledTrigger[];
  authority: ScenarioAuthority;
  requiredCapabilities: string[];
}

export type CompileScenarioResult =
  | { ok: true; compiled: CompiledScenario }
  | { ok: false; error: RuntimeError };

export interface ScenarioLoadResult {
  accepted: boolean;
  scenarioId: string;
  version: string;
  seedResults: { type: string; accepted: boolean }[];
  error?: RuntimeError;
}

export interface TriggerEvaluationContext {
  simTimeMs: SimTime;
  activeConditionIds: string[];
  vitals: {
    meanArterialPressure: number | null;
    heartRate: number | null;
    cardiacOutput: number | null;
  };
}
