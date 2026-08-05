import type {
  CompiledScenario,
  CompiledTrigger,
  TriggerEvaluationContext,
} from '../contracts/scenarios.ts';
import type { PatientCommand } from '../contracts/commands.ts';
import type { RuntimeListener, Unsubscribe } from '../contracts/queries.ts';
import type { CommandId } from '../contracts/brands.ts';
import { asSimTime } from '../contracts/brands.ts';
import {
  evaluateTriggerPredicate,
  triggerThenToCommand,
} from './compiler.ts';

/** Minimal runtime surface needed by the trigger runner (avoids import cycles). */
export interface TriggerRuntimeHost {
  subscribe(listener: RuntimeListener): Unsubscribe;
  /** Internal privileged state reader — not clinical queryForClient. */
  internalStateForModels(query: { type: string; [k: string]: unknown }): unknown;
  allocateCommandId(prefix?: string): CommandId;
  dispatch(command: PatientCommand, session?: { role: string }): { accepted: boolean };
  recordScenarioAnnotation?(id: string, label: string, detail?: unknown): void;
}

export interface SerializedTriggerRunner {
  schemaVersion: 'triggers.v1';
  scenarioMeta: { id: string; version: string } | null;
  fired: Record<string, boolean>;
  lastPred: Record<string, boolean>;
  annotations: { id: string; label: string; detail?: unknown; atMs: number }[];
}

/**
 * Arm and evaluate scenario triggers against a live runtime.
 * Edge-triggered, non-reentrant — never mutates physiology directly.
 */
export class ScenarioTriggerRunner {
  private triggers: CompiledTrigger[] = [];
  private scenarioMeta: { id: string; version: string } | null = null;
  private unsub: (() => void) | null = null;
  private annotations: { id: string; label: string; detail?: unknown; atMs: number }[] = [];
  private ticking = false;
  private lastPred = new Map<string, boolean>();

  constructor(private readonly runtime: TriggerRuntimeHost) {}

  arm(compiled: CompiledScenario): void {
    this.disarm();
    this.scenarioMeta = {
      id: compiled.definition.id,
      version: compiled.definition.version,
    };
    this.triggers = compiled.triggers.map((t) => ({ ...t, fired: false }));
    this.annotations = [];
    this.lastPred.clear();
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
    this.lastPred.clear();
  }

  serializeState(): SerializedTriggerRunner {
    const fired: Record<string, boolean> = {};
    const lastPred: Record<string, boolean> = {};
    for (const t of this.triggers) fired[t.id] = !!t.fired;
    for (const [k, v] of this.lastPred) lastPred[k] = v;
    return {
      schemaVersion: 'triggers.v1',
      scenarioMeta: this.scenarioMeta ? { ...this.scenarioMeta } : null,
      fired,
      lastPred,
      annotations: structuredClone(this.annotations),
    };
  }

  restoreState(compiled: CompiledScenario | null, state: SerializedTriggerRunner | null): void {
    if (!compiled) {
      this.disarm();
      return;
    }
    this.arm(compiled);
    if (!state || state.schemaVersion !== 'triggers.v1') return;
    this.annotations = structuredClone(state.annotations || []);
    this.lastPred = new Map(Object.entries(state.lastPred || {}));
    for (const t of this.triggers) {
      if (state.fired?.[t.id]) t.fired = true;
    }
  }

  tick(): void {
    if (this.ticking || !this.scenarioMeta || !this.triggers.length) return;
    this.ticking = true;
    try {
      const ctx = this.buildContext();
      const actions: Array<() => void> = [];
      for (const trigger of this.triggers) {
        const pred = evaluateTriggerPredicate(
          { ...trigger, fired: false },
          ctx,
        );
        const was = this.lastPred.get(trigger.id) === true;
        this.lastPred.set(trigger.id, pred);

        // Edge-triggered: fire on false→true. Non-repeat also respects fired.
        // sim-time predicates stay true once reached — use fired latch, not edge alone.
        const isSimTime = trigger.when.kind === 'sim-time';
        const rising = pred && !was;
        const simTimeLatch = isSimTime && pred && !trigger.fired;
        if (!rising && !simTimeLatch) continue;
        if (!trigger.repeat && trigger.fired) continue;
        trigger.fired = true;

        const then = trigger.then;
        const meta = this.scenarioMeta;
        if (then.kind === 'annotate') {
          actions.push(() => {
            this.annotations.push({
              id: trigger.id,
              label: then.label,
              detail: then.detail,
              atMs: Number(ctx.simTimeMs),
            });
            this.runtime.recordScenarioAnnotation?.(trigger.id, then.label, then.detail);
          });
        } else {
          const cmd = triggerThenToCommand(then, meta, {
            command: (prefix?: string) => this.runtime.allocateCommandId(prefix),
          });
          if (cmd) {
            actions.push(() => {
              this.runtime.dispatch(cmd, { role: 'scenario' });
            });
          }
        }
      }
      for (const act of actions) act();
    } finally {
      this.ticking = false;
    }
  }

  getAnnotations() {
    return [...this.annotations];
  }

  private buildContext(): TriggerEvaluationContext {
    const time = this.runtime.internalStateForModels({ type: 'runtime.time' }) as { simTimeMs: number };
    const conditions = this.runtime.internalStateForModels({ type: 'conditions.active' }) as {
      conditionId: string;
    }[];
    const phys = this.runtime.internalStateForModels({
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
      activeConditionIds: (conditions || []).map((c) => c.conditionId),
      vitals: {
        meanArterialPressure: phys?.cardiovascular?.meanArterialPressure ?? null,
        heartRate: phys?.cardiovascular?.heartRate ?? null,
        cardiacOutput: phys?.cardiovascular?.cardiacOutput ?? null,
      },
    };
  }
}
