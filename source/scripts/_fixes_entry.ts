/** Bundle entry for the simulator-fixes regression tests. */
export { createPatientRuntime } from '../src/runtime/patient-runtime.ts';
export { applyCardioAdapterToHost, CIRCULATION_BASELINE } from '../src/models/cardiovascular/current-model-adapter.ts';
export { createHeadlessCardioHost } from './_runtime_slice_entry.ts';
