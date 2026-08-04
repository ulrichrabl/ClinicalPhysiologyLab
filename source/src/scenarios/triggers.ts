import type {
  CompiledScenario,
  CompiledTrigger,
  TriggerEvaluationContext,
} from '../contracts/scenarios.ts';
import type { PatientCommand } from '../contracts/commands.ts';
import type { RuntimeListener, Unsubscribe } from '../contracts/queries.ts';
import { asSimTime } from '../contracts/brands.ts';
import {
  evaluateTriggerPredicate,
  triggerThenToCommand,
} from './compiler.ts';

/** Minimal runtime surface needed by the trigger runner (avoids import cycles). */
export interface TriggerRuntimeHost {
  subscribe(listener: RuntimeListener): Unsubscribe;
  query(query: { type: string; [k: string]: unknown }): unknown;
  dispatch(command: PatientCommand): { accepted: boolean };
  recordScenarioAnnotation?(id: string, label: string, detail?: unknown): void;
}

/**
 * Arm and evaluate scenario triggers against a live runtime.
 * Triggers only dispatch / annotate — they never mutate physiology directly.
 */
export class ScenarioTriggerRunner {
  private triggers: CompiledTrigger[] = [];
  private scenarioMeta: { id: string; version: string } | null = null;
  private unsub: (() => void) | null = null;
  private annotations: { id: string; label: string; detail?: unknown; atMs: number }[] = [];

  constructor(private readonly runtime: TriggerRuntimeHost) {}

  arm(compiled: CompiledScenario): void {
    this.disarm();
    this.scenarioMeta = {
      id: compiled.definition.id,
      version: compiled.definition.version,
    };
    this.triggers = compiled.triggers.map((t) => ({ ...t, fired: false }));
    this.annotations = [];
    this.unsub = this.runtime.subscribe((ev) => {
      if (
        ev.type === 'runtime.advanced'
        || ev.type === 'physiology.updated'
        || ev.type === 'command.accepted'
      ) {
        this.tick();
      }
    });
  }

  disarm(): void {
    this.unsub?.();
    this.unsub = null;
    this.triggers = [];
    this.scenarioMeta = null;
  }

  tick(): void {
    if (!this.scenarioMeta || !this.triggers.length) return;
    const ctx = this.buildContext();
    for (const trigger of this.triggers) {
      if (!evaluateTriggerPredicate(trigger, ctx)) continue;
      trigger.fired = true;
      const then = trigger.then;
      if (then.kind === 'annotate') {
        this.annotations.push({
          id: trigger.id,
          label: then.label,
          detail: then.detail,
          atMs: Number(ctx.simTimeMs),
        });
        this.runtime.recordScenarioAnnotation?.(trigger.id, then.label, then.detail);
        continue;
      }
      const cmd = triggerThenToCommand(then, this.scenarioMeta);
      if (cmd) this.runtime.dispatch(cmd);
    }
  }

  getAnnotations() {
    return [...this.annotations];
  }

  private buildContext(): TriggerEvaluationContext {
    const time = this.runtime.query({ type: 'runtime.time' }) as { simTimeMs: number };
    const conditions = this.runtime.query({ type: 'conditions.active' }) as {
      conditionId: string;
    }[];
    const phys = this.runtime.query({
      type: 'state.projection',
      projection: 'publicPhysiology',
    }) as {
      cardiovascular: {
        meanArterialPressure: number | null;
        heartRate: number | null;
        cardiacOutput: number | null;
      };
    };
    return {
      simTimeMs: asSimTime(Number(time.simTimeMs)),
      activeConditionIds: conditions.map((c) => c.conditionId),
      vitals: {
        meanArterialPressure: phys.cardiovascular?.meanArterialPressure ?? null,
        heartRate: phys.cardiovascular?.heartRate ?? null,
        cardiacOutput: phys.cardiovascular?.cardiacOutput ?? null,
      },
    };
  }
}
