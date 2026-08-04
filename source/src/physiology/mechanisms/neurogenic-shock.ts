import type { MechanismContribution } from '../../contracts/effects.ts';
import type { CausalReference } from '../../contracts/provenance.ts';
import { createEffectId } from '../../contracts/brands.ts';
import type { SimTime } from '../../contracts/brands.ts';
import type { EffectSource } from '../../contracts/provenance.ts';

const CORD_ORDER = [
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6',
  'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
  'L1', 'L2', 'L3', 'L4', 'L5',
  'S1', 'S2', 'S3', 'S4',
] as const;

export type CordLevel = (typeof CORD_ORDER)[number];
export const CORD_RANK: Record<string, number> = Object.fromEntries(
  CORD_ORDER.map((l, i) => [l, i]),
);

/** Highest cord level at which a lesion still interrupts most sympathetic outflow. */
export const SYMPATHETIC_CUTOFF = 'T6';

export function lesionInterruptsSympathetic(level: string): boolean {
  const rank = CORD_RANK[level];
  return rank != null && rank <= CORD_RANK[SYMPATHETIC_CUTOFF];
}

/**
 * Complete bilateral targets as public port multipliers against baseline 1.
 * Adapter maps these with simple scaling onto Circulation private params:
 *   Rsys = 1.05 * arteriolarTone  → 0.52
 *   HR   = 72   * cardiacDrive    → 52
 *   V0sv from venousTone via dedicated capacitance mapping → 3500
 *     (loss of tone raises unstressed volume — venous pooling)
 */
export const NEUROGENIC_COMPLETE_PORTS = {
  'autonomic.sympatheticOutflow': 0.15,
  'autonomic.cardiacAcceleratorDrive': 52 / 72,
  'vascular.venousTone': 0.25,
  'vascular.systemicArteriolarTone': 0.52 / 1.05,
  'cardiovascular.baroreflexEnabled': 0,
} as const;

export function neurogenicShockMechanisms(input: {
  level: string;
  completeness: number;
  side: 'left' | 'right' | 'bilateral';
  source: EffectSource;
  onset: SimTime;
  conditionId: string;
}): MechanismContribution[] {
  if (!lesionInterruptsSympathetic(input.level)) return [];

  const c = clamp01(input.completeness);
  const laterality = input.side === 'bilateral' ? 1 : 0.5;
  const severity = c * laterality;

  const provenance: CausalReference[] = [
    { kind: 'condition', id: input.conditionId },
    { kind: 'mechanism', id: 'loss-of-sympathetic-outflow' },
    { kind: 'state', path: `neurological.cordLesionLevel=${input.level}` },
  ];

  const sympatheticOutflow = lerp(1, NEUROGENIC_COMPLETE_PORTS['autonomic.sympatheticOutflow'], severity);
  const cardiacAccelerator = lerp(1, NEUROGENIC_COMPLETE_PORTS['autonomic.cardiacAcceleratorDrive'], severity);
  const venousTone = lerp(1, NEUROGENIC_COMPLETE_PORTS['vascular.venousTone'], severity);
  const arteriolarTone = lerp(1, NEUROGENIC_COMPLETE_PORTS['vascular.systemicArteriolarTone'], severity);
  const baroreflex = severity >= 0.5 ? 0 : 1;

  return [
    {
      mechanismId: 'loss-of-sympathetic-outflow',
      displayName: 'Interruption of descending sympathetic pathways',
      provenance,
      effects: [
        mk(input.source, 'autonomic.sympatheticOutflow', sympatheticOutflow, input.onset, provenance, 'sym', input.conditionId),
        mk(input.source, 'autonomic.cardiacAcceleratorDrive', cardiacAccelerator, input.onset, provenance, 'acc', input.conditionId),
        mk(input.source, 'vascular.venousTone', venousTone, input.onset, provenance, 'ven', input.conditionId),
        mk(input.source, 'vascular.systemicArteriolarTone', arteriolarTone, input.onset, provenance, 'art', input.conditionId),
        {
          id: createEffectId({
            conditionId: input.conditionId,
            mechanismId: 'loss-of-sympathetic-outflow',
            port: 'cardiovascular.baroreflexEnabled',
            slot: 'baro',
          }),
          source: input.source,
          target: 'cardiovascular.baroreflexEnabled' as never,
          operation: 'minimum' as const,
          value: baroreflex,
          onset: input.onset,
          provenance,
        },
      ],
    },
  ];
}

function mk(
  source: EffectSource,
  target: string,
  value: number,
  onset: SimTime,
  provenance: CausalReference[],
  prefix: string,
  conditionId: string,
) {
  return {
    id: createEffectId({
      conditionId,
      mechanismId: 'loss-of-sympathetic-outflow',
      port: target,
      slot: prefix,
    }),
    source,
    target: target as never,
    operation: 'multiply' as const,
    value,
    onset,
    provenance,
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Display metadata for the active-mechanisms UI. */
export const NEUROGENIC_DISPLAY = {
  id: 'loss-of-sympathetic-outflow',
  name: 'Neurogenic shock',
  short: 'A cord lesion above T6 cuts sympathetic outflow to the vessels and heart',
  why: 'Sympathetic preganglionic neurons leave the cord between T1 and L2. A lesion '
    + 'above T6 disconnects most of that outflow from the brainstem: arterioles lose '
    + 'their tone and the cardiac accelerator fibres (T1–T4) are lost too. The result '
    + 'is hypotension with a *slow* heart — which is what distinguishes it from '
    + 'haemorrhagic shock, where the heart races.',
  to: 'cardio',
  from: 'cordLevel',
  level: 'danger' as const,
};
