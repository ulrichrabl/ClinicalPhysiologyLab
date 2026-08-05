/** Branded simulation primitives (Appendix A). */

export type SimTime = number & { readonly __brand: 'SimTimeMs' };
export type SimDuration = number & { readonly __brand: 'SimDurationMs' };
export type CommandId = string & { readonly __brand: 'CommandId' };
export type ObservationId = string & { readonly __brand: 'ObservationId' };
export type ConditionId = string & { readonly __brand: 'ConditionId' };
export type MechanismId = string & { readonly __brand: 'MechanismId' };
export type PhysiologicalPortId = string & { readonly __brand: 'PhysiologicalPortId' };
export type EffectId = string & { readonly __brand: 'EffectId' };
export type CheckpointId = string & { readonly __brand: 'CheckpointId' };

export function asSimTime(ms: number): SimTime {
  return ms as SimTime;
}

export function asSimDuration(ms: number): SimDuration {
  return ms as SimDuration;
}

export interface RuntimeIdSnapshot {
  command: number;
  observation: number;
  checkpoint: number;
  event: number;
}

/**
 * Instance-local monotonic ID allocator with separate namespaces.
 * Reads (observations) must not advance the command/checkpoint sequences.
 * Never uses Date.now / Math.random.
 */
export class RuntimeIdFactory {
  private commandSeq = 0;
  private observationSeq = 0;
  private checkpointSeq = 0;
  private eventSeq = 0;

  constructor(private readonly tag: string) {}

  command(prefix = 'cmd'): CommandId {
    this.commandSeq += 1;
    return `${prefix}_${this.tag}_${this.commandSeq}` as CommandId;
  }

  observation(prefix = 'obs'): ObservationId {
    this.observationSeq += 1;
    return `${prefix}_${this.tag}_${this.observationSeq}` as ObservationId;
  }

  checkpoint(prefix = 'cp'): CheckpointId {
    this.checkpointSeq += 1;
    return `${prefix}_${this.tag}_${this.checkpointSeq}` as CheckpointId;
  }

  event(prefix = 'ev'): string {
    this.eventSeq += 1;
    return `${prefix}_${this.tag}_${this.eventSeq}`;
  }

  /** @deprecated use namespaced methods — peek returns command seq for checkpoint restore compat */
  next(prefix: string): string {
    if (prefix.startsWith('obs') || prefix.includes('obs')) return this.observation(prefix);
    if (prefix.startsWith('cp') || prefix.includes('cp')) return this.checkpoint(prefix);
    if (prefix.startsWith('ev') || prefix.includes('adv') || prefix.includes('settle')) {
      return this.event(prefix);
    }
    return this.command(prefix);
  }

  peek(): number {
    return this.commandSeq;
  }

  snapshot(): RuntimeIdSnapshot {
    return {
      command: this.commandSeq,
      observation: this.observationSeq,
      checkpoint: this.checkpointSeq,
      event: this.eventSeq,
    };
  }

  restore(seqOrSnap: number | RuntimeIdSnapshot): void {
    if (typeof seqOrSnap === 'number') {
      this.commandSeq = seqOrSnap;
      return;
    }
    this.commandSeq = seqOrSnap.command;
    this.observationSeq = seqOrSnap.observation;
    this.checkpointSeq = seqOrSnap.checkpoint;
    this.eventSeq = seqOrSnap.event;
  }
}

/**
 * Orphan factory for scripts/tests that mint IDs before a runtime exists.
 * Runtimes NEVER rebind this — each runtime owns its own `runtime.ids`.
 */
const orphanFactory = new RuntimeIdFactory('orphan');

/** @deprecated Prefer `runtime.ids.command()`. Does not bind to any live runtime. */
export function createCommandId(prefix = 'cmd'): CommandId {
  return orphanFactory.command(prefix);
}

/** @deprecated Prefer `runtime.ids.observation()`. */
export function createObservationId(prefix = 'obs'): ObservationId {
  return orphanFactory.observation(prefix);
}

/** @deprecated Prefer `runtime.ids.checkpoint()`. */
export function createCheckpointId(prefix = 'cp'): CheckpointId {
  return orphanFactory.checkpoint(prefix);
}

/**
 * @deprecated No-op retained so older tests compile. Runtimes are instance-local;
 * binding a global factory is intentionally unsupported.
 */
export function bindIdFactory(_factory: RuntimeIdFactory): void {
  /* intentionally empty — instance-local IDs only */
}

/**
 * Deterministic effect IDs for composition tie-breaks.
 * Prefer explicit parts over the sequential factory so re-resolving mechanisms
 * yields identical IDs for the same logical contribution.
 * Include condition instance ID once multi-instance support is active.
 */
export function createEffectId(
  prefixOrParts: string | {
    conditionId?: string;
    conditionInstanceId?: string;
    mechanismId: string;
    port: string;
    slot?: string | number;
  },
): EffectId {
  if (typeof prefixOrParts === 'string') {
    return orphanFactory.event(`eff_${prefixOrParts}`) as EffectId;
  }
  const { conditionId, conditionInstanceId, mechanismId, port, slot } = prefixOrParts;
  const parts = [
    conditionInstanceId ?? conditionId ?? 'adhoc',
    mechanismId,
    port,
    slot ?? '0',
  ];
  return parts.join('::') as EffectId;
}
