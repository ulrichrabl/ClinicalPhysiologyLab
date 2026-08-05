/** Bundle entry for platform runtime hardening tests. */
export {
  createPatientRuntime,
  createCommandId,
} from '../src/runtime/patient-runtime.ts';
export { asSimDuration, RuntimeIdFactory, createEffectId } from '../src/contracts/brands.ts';
export {
  settleWithCirculation,
  createHeadlessCardioHost,
} from './_runtime_slice_entry.ts';
export {
  authorizeCommand,
  authorizeQuery,
  authorizeObservation,
} from '../src/contracts/authority.ts';
export { neurogenicShockDemo, compileScenario } from '../src/scenarios/index.ts';
export { testSession, clinicalSession, systemSession } from '../src/contracts/session.ts';
