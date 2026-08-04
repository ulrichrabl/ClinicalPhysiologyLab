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

/**
 * Runtime-owned monotonic ID allocator.
 * Deterministic for a given seed + call sequence — never uses Date.now / Math.random.
 */
export class RuntimeIdFactory {
  private seq = 0;
  constructor(private readonly tag: string) {}

  next(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.tag}_${this.seq}`;
  }

  peek(): number {
    return this.seq;
  }

  restore(seq: number): void {
    this.seq = seq;
  }
}

/** Module default used before a runtime binds its factory (UI helpers). */
let activeFactory = new RuntimeIdFactory('orphan');

export function bindIdFactory(factory: RuntimeIdFactory): void {
  activeFactory = factory;
}

export function createCommandId(prefix = 'cmd'): CommandId {
  return activeFactory.next(prefix) as CommandId;
}

export function createObservationId(prefix = 'obs'): ObservationId {
  return activeFactory.next(prefix) as ObservationId;
}

export function createCheckpointId(prefix = 'cp'): CheckpointId {
  return activeFactory.next(prefix) as CheckpointId;
}

/**
 * Deterministic effect IDs for composition tie-breaks.
 * Prefer explicit parts over the sequential factory so re-resolving mechanisms
 * yields identical IDs for the same logical contribution.
 */
export function createEffectId(
  prefixOrParts: string | { conditionId?: string; mechanismId: string; port: string; slot?: string | number },
): EffectId {
  if (typeof prefixOrParts === 'string') {
    return activeFactory.next(`eff_${prefixOrParts}`) as EffectId;
  }
  const { conditionId, mechanismId, port, slot } = prefixOrParts;
  const parts = [conditionId ?? 'adhoc', mechanismId, port, slot ?? '0'];
  return parts.join('::') as EffectId;
}
