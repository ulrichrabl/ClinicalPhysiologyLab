import type { MechanismContribution } from '../contracts/effects.ts';
import type { SimTime } from '../contracts/brands.ts';
import { asSimTime } from '../contracts/brands.ts';
import { neurogenicShockMechanisms, CORD_RANK, type CordLevel } from '../physiology/mechanisms/neurogenic-shock.ts';

export interface ConditionContext {
  simTime: SimTime;
  instanceId: string;
}

export interface ConditionInstance {
  instanceId: string;
  conditionId: string;
  version: string;
  parameters: Record<string, unknown>;
  activatedAt: SimTime;
}

export interface ConditionDefinition {
  id: string;
  version: string;
  displayName: string;
  requiredCapabilities: string[];
  parameterSchema: {
    level: { enum: string[] };
    completeness: { type: 'number'; minimum: number; maximum: number };
    side: { enum: string[] };
  };
  initialise(parameters: Record<string, unknown>, context: ConditionContext): ConditionInstance;
  resolve(instance: ConditionInstance, simTime: SimTime): MechanismContribution[];
  validate(parameters: Record<string, unknown>): { ok: true } | { ok: false; message: string; path?: string };
}

const LEVELS = Object.keys(CORD_RANK);

export const cervicalSpinalCordInjury: ConditionDefinition = {
  id: 'cervical-spinal-cord-injury',
  version: '1.0.0',
  displayName: 'Cervical / high thoracic spinal cord injury',
  requiredCapabilities: [
    'neurology.pathway-localisation',
    'cardiovascular.autonomic-input',
  ],
  parameterSchema: {
    level: { enum: LEVELS },
    completeness: { type: 'number', minimum: 0, maximum: 1 },
    side: { enum: ['left', 'right', 'bilateral'] },
  },

  validate(parameters) {
    const level = parameters.level;
    if (typeof level !== 'string' || !(level in CORD_RANK)) {
      return {
        ok: false,
        message: `level must be a cord segment (${LEVELS.slice(0, 8).join(', ')}, …)`,
        path: 'parameters.level',
      };
    }
    const completeness = parameters.completeness;
    if (typeof completeness !== 'number' || completeness < 0 || completeness > 1) {
      return { ok: false, message: 'completeness must be a number in [0, 1]', path: 'parameters.completeness' };
    }
    const side = parameters.side;
    if (side !== 'left' && side !== 'right' && side !== 'bilateral') {
      return { ok: false, message: 'side must be left, right, or bilateral', path: 'parameters.side' };
    }
    return { ok: true };
  },

  initialise(parameters, context) {
    return {
      instanceId: context.instanceId,
      conditionId: this.id,
      version: this.version,
      parameters: {
        level: parameters.level,
        completeness: parameters.completeness,
        side: parameters.side,
      },
      activatedAt: context.simTime,
    };
  },

  resolve(instance, simTime) {
    const level = String(instance.parameters.level);
    const completeness = Number(instance.parameters.completeness);
    const side = instance.parameters.side as 'left' | 'right' | 'bilateral';
    return neurogenicShockMechanisms({
      level,
      completeness,
      side,
      onset: simTime ?? asSimTime(instance.activatedAt),
      conditionId: instance.conditionId,
      source: {
        type: 'condition',
        conditionId: instance.conditionId,
        instanceId: instance.instanceId,
      },
    });
  },
};

export const CONDITION_REGISTRY: Record<string, ConditionDefinition> = {
  [cervicalSpinalCordInjury.id]: cervicalSpinalCordInjury,
  // Alias for authoring convenience when the lesion may be high thoracic.
  'spinal-cord-injury': cervicalSpinalCordInjury,
};

export function getCondition(id: string): ConditionDefinition | undefined {
  return CONDITION_REGISTRY[id];
}

export type { CordLevel };
