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

export function createCommandId(prefix = 'cmd'): CommandId {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}` as CommandId;
}

export function createObservationId(prefix = 'obs'): ObservationId {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}` as ObservationId;
}

export function createEffectId(prefix = 'eff'): EffectId {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}` as EffectId;
}

export function createCheckpointId(prefix = 'cp'): CheckpointId {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}` as CheckpointId;
}
