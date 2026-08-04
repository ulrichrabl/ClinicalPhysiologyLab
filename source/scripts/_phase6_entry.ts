/** Bundle entry for Phase 6 scenario compiler / IA tests. */
export {
  createPatientRuntime,
  createCommandId,
} from '../src/runtime/patient-runtime.ts';
export { asSimDuration } from '../src/contracts/brands.ts';
export { settleWithCirculation } from './_runtime_slice_entry.ts';
export {
  neurogenicShockDemo,
  compileScenario,
  materialiseSeedCommands,
  listScenarios,
  getScenario,
} from '../src/scenarios/index.ts';
export { evaluateTriggerPredicate } from '../src/scenarios/compiler.ts';
export { asSimTime } from '../src/contracts/brands.ts';
