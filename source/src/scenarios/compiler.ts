import { createCommandId, type CommandId, type RuntimeIdFactory } from '../contracts/brands.ts';
import { runtimeError } from '../contracts/errors.ts';
import type { PatientCommand } from '../contracts/commands.ts';
import type {
  CompileScenarioResult,
  CompiledScenario,
  CompiledTrigger,
  ScenarioDefinition,
  ScenarioTrigger,
  ScenarioTriggerThen,
  TriggerEvaluationContext,
} from '../contracts/scenarios.ts';

/**
 * Compile a scenario definition into seed commands and armed triggers.
 * Validates required capabilities against the runtime's available set (ADR-007).
 */
export function compileScenario(
  definition: ScenarioDefinition,
  options: { availableCapabilities: string[] },
): CompileScenarioResult {
  if (!definition?.id || !definition.version) {
    return {
      ok: false,
      error: runtimeError('INVALID_PARAMETER', 'scenario id and version are required', {
        path: 'id',
      }),
    };
  }

  const available = new Set(options.availableCapabilities);
  const missing = (definition.requiredCapabilities ?? []).filter((c) => !available.has(c));
  if (missing.length) {
    return {
      ok: false,
      error: runtimeError(
        'UNSUPPORTED_CAPABILITY',
        `Scenario "${definition.id}" requires capabilities the runtime does not provide`,
        {
          path: 'requiredCapabilities',
          received: missing,
          alternatives: [...available].sort(),
        },
      ),
    };
  }

  const source = {
    type: 'scenario' as const,
    id: definition.id,
    version: definition.version,
  };

  const seedCommands: Omit<PatientCommand, 'id'>[] = [];
  if (definition.initialCommand) {
    seedCommands.push({
      type: definition.initialCommand.type,
      payload: definition.initialCommand.payload,
      source: definition.initialCommand.source ?? source,
    });
  } else {
    for (const cond of definition.conditions ?? []) {
      seedCommands.push({
        type: 'condition.activate',
        payload: {
          condition: cond.id,
          parameters: cond.parameters,
          instanceId: cond.instanceId,
        },
        source,
      });
    }
  }

  const triggers: CompiledTrigger[] = (definition.triggers ?? []).map((t) => compileTrigger(t));

  const compiled: CompiledScenario = {
    definition,
    seedCommands,
    triggers,
    authority: { ...definition.authority },
    requiredCapabilities: [...definition.requiredCapabilities],
  };

  return { ok: true, compiled };
}

function compileTrigger(t: ScenarioTrigger): CompiledTrigger {
  return {
    id: t.id,
    repeat: !!t.repeat,
    when: t.when,
    then: t.then,
    fired: false,
  };
}

/** Materialise seed commands with fresh command ids from a runtime-local factory when provided. */
export function materialiseSeedCommands(
  compiled: CompiledScenario,
  ids?: Pick<RuntimeIdFactory, 'command'>,
): PatientCommand[] {
  return compiled.seedCommands.map((c) => ({
    ...c,
    id: (ids ? ids.command() : createCommandId()) as CommandId,
  }));
}

export function evaluateTriggerPredicate(
  trigger: CompiledTrigger,
  ctx: TriggerEvaluationContext,
): boolean {
  if (trigger.fired && !trigger.repeat) return false;
  const when = trigger.when;
  if (when.kind === 'sim-time') {
    return Number(ctx.simTimeMs) >= when.atMs;
  }
  if (when.kind === 'condition-active') {
    return ctx.activeConditionIds.includes(when.conditionId);
  }
  if (when.kind === 'vital-threshold') {
    const raw = ctx.vitals[when.vital];
    if (raw == null || !Number.isFinite(raw)) return false;
    switch (when.op) {
      case 'lt': return raw < when.value;
      case 'gt': return raw > when.value;
      case 'lte': return raw <= when.value;
      case 'gte': return raw >= when.value;
      default: return false;
    }
  }
  return false;
}

export function triggerThenToCommand(
  then: ScenarioTriggerThen,
  scenario: { id: string; version: string },
  ids?: Pick<RuntimeIdFactory, 'command'>,
): PatientCommand | null {
  if (then.kind !== 'dispatch') return null;
  return {
    id: (ids ? ids.command() : createCommandId()) as CommandId,
    type: then.command.type,
    payload: then.command.payload ?? {},
    source: { type: 'scenario', id: scenario.id, version: scenario.version },
  };
}
