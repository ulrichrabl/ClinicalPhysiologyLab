/** Bundle entry for the scenario tests (ADR-018). */
export { CASES, SCENARIOS, INTERVENTIONS, INTERVENTION_BY_ID, ScenarioRun, replay, TICK_S, Chance, validateInterventions, validateScenario, validateCase, CATALOG, REGISTRY, modelFromCase } from '../src/vp/index.ts';
export { LivePatient } from '../src/vp/live/live-patient.ts';
/* ADR-018 step 2: chest compressions */
export { cprTrial } from '../src/vp/physiology/cpr/trial.ts';
export { Compressor } from '../src/vp/physiology/cpr/compressions.ts';
export { CPR } from '../src/vp/evidence/cpr.ts';
export { createCirculation } from '../src/vp/engine/circulation-host.ts';
export { healthyModel } from '../src/vp/physiology/state.ts';
/* ADR-018 step 2b: breathing in arrest and given breaths */
export { Ventilator } from '../src/vp/physiology/lung/ventilation.ts';
export { LUNG } from '../src/vp/evidence/lung.ts';
