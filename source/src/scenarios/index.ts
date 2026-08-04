import { neurogenicShockDemo } from './definitions/neurogenic-shock-demo.ts';
import type { ScenarioDefinition } from '../contracts/scenarios.ts';

export const SCENARIO_REGISTRY: Record<string, ScenarioDefinition> = {
  [neurogenicShockDemo.id]: neurogenicShockDemo as unknown as ScenarioDefinition,
};

export function getScenario(id: string): ScenarioDefinition | null {
  return SCENARIO_REGISTRY[id] ?? null;
}

export function listScenarios(): ScenarioDefinition[] {
  return Object.values(SCENARIO_REGISTRY);
}

export { neurogenicShockDemo };
export { compileScenario, materialiseSeedCommands } from './compiler.ts';
export { ScenarioTriggerRunner } from './triggers.ts';
