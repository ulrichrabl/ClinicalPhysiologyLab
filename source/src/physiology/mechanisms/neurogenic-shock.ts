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
 * Loss of descending sympathetic drive after a high cord lesion.
 * Effect magnitudes match the educational neurogenic-shock profile used by
 * the validated circulation coupling (complete lesion → Rsys 0.52, HR 52, …).
 */
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
  // Unilateral lesions spare contralateral outflow; treat as half the bilateral effect.
  const laterality = input.side === 'bilateral' ? 1 : 0.5;
  const severity = c * laterality;

  const provenance: CausalReference[] = [
    { kind: 'condition', id: input.conditionId },
    { kind: 'mechanism', id: 'loss-of-sympathetic-outflow' },
    { kind: 'state', path: `neurological.cordLesionLevel=${input.level}` },
  ];

  // Interpolate toward the complete bilateral targets documented in the legacy coupling.
  const sympatheticOutflow = lerp(1, 0.15, severity);
  const cardiacAccelerator = lerp(1, 0.0, severity);
  const venousTone = lerp(1, 0.25, severity);
  const arteriolarTone = lerp(1, 0.45, severity);
  const baroreflex = severity >= 0.5 ? 0 : 1;

  return [
    {
      mechanismId: 'loss-of-sympathetic-outflow',
      displayName: 'Interruption of descending sympathetic pathways',
      provenance,
      effects: [
        {
          id: createEffectId('sym'),
          source: input.source,
          target: 'autonomic.sympatheticOutflow' as never,
          operation: 'multiply',
          value: sympatheticOutflow,
          onset: input.onset,
          provenance,
        },
        {
          id: createEffectId('acc'),
          source: input.source,
          target: 'autonomic.cardiacAcceleratorDrive' as never,
          operation: 'multiply',
          value: cardiacAccelerator,
          onset: input.onset,
          provenance,
        },
        {
          id: createEffectId('ven'),
          source: input.source,
          target: 'vascular.venousTone' as never,
          operation: 'multiply',
          value: venousTone,
          onset: input.onset,
          provenance,
        },
        {
          id: createEffectId('art'),
          source: input.source,
          target: 'vascular.systemicArteriolarTone' as never,
          operation: 'multiply',
          value: arteriolarTone,
          onset: input.onset,
          provenance,
        },
        {
          id: createEffectId('baro'),
          source: input.source,
          target: 'cardiovascular.baroreflexEnabled' as never,
          operation: 'minimum',
          value: baroreflex,
          onset: input.onset,
          provenance,
        },
      ],
    },
  ];
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
