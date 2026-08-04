import type { CausalReference, EffectSource } from './provenance.ts';
import type { EffectId, PhysiologicalPortId, SimDuration, SimTime } from './brands.ts';

export type EffectOperation =
  | 'add'
  | 'multiply'
  | 'saturating-add'
  | 'minimum'
  | 'maximum'
  | 'clamp'
  | 'exclusive'
  | 'priority';

export interface PhysiologicalEffect<T = unknown> {
  id: EffectId;
  source: EffectSource;
  target: PhysiologicalPortId;
  operation: EffectOperation;
  value: T;
  onset: SimTime;
  duration?: SimDuration;
  priority?: number;
  provenance: CausalReference[];
}

export interface ResolvedEffectContribution<T = unknown> {
  effectId: EffectId;
  source: EffectSource;
  operation: EffectOperation;
  value: T;
  priority?: number;
  provenance: CausalReference[];
}

export interface ResolvedPortValue<T = unknown> {
  portId: PhysiologicalPortId;
  value: T;
  baseline: T;
  contributions: ResolvedEffectContribution<T>[];
}

export type CompositionRuleKind =
  | 'multiply'
  | 'add'
  | 'minimum'
  | 'maximum'
  | 'priority'
  | 'exclusive';

export interface PortDefinition<T = number> {
  id: PhysiologicalPortId;
  unit?: string;
  physiologicalMeaning: string;
  baseline: T;
  composition: CompositionRuleKind;
  /** Soft educational range; validation may warn outside it. */
  range?: { min: number; max: number };
}

export interface MechanismContribution {
  mechanismId: string;
  displayName: string;
  effects: PhysiologicalEffect[];
  provenance: CausalReference[];
}
