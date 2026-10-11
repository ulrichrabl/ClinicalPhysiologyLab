import { Circulation, type CirculationConfig } from '../../domains/cardio/sim/circulation.ts';
import { HeartElectrical } from '../physiology/heart/electrical.ts';
import type { CaseDef } from '../model/types.ts';
import { CIRCULATION_DEFAULTS, modelFromCase, type PatientModel } from '../physiology/state.ts';

/* ---------------------------------------------------------------------------
   The running circulation and cardiac electrical model for one patient.

   The same closed-loop model the cardio domain uses, configured from a
   PatientModel: the electrical mechanism first, then every circulation
   parameter the model holds. Used three ways: settled at build time (so a
   page opens on a patient already in steady state), restored and run live
   in a browser worker, and settled in tests.
--------------------------------------------------------------------------- */

/** Integration settings and activation shape: fixed, not part of the patient. */
const FIXED: CirculationConfig = {
  TmaxV: 0.8, TmaxA: 0.13, actM1: 1.32, actM2: 21.9, actT1: 0.27, actT2: 0.45, dt: 5e-4,
};

export interface CirculationRun {
  sim: Circulation;
  heart: HeartElectrical;
  /** Apply a changed model. */
  apply: (m: PatientModel) => void;
}

export function createCirculation(m: PatientModel): CirculationRun {
  const heart = new HeartElectrical();
  const sim = new Circulation({ ...CIRCULATION_DEFAULTS, ...FIXED, baroEnabled: true });
  (sim as any).engine = heart;
  /* The sinus node is driven by the autonomic state the baroreflex sets. */
  heart.rateSource = () => (sim.baroEnabled ? sim.modulatedHR() : sim.HR);
  const apply = (next: PatientModel) => {
    heart.setParams(next.electrical);
    const c = next.circulation;
    for (const [k, v] of Object.entries(c)) {
      if (k === 'baroEnabled' || k === 'K') continue;
      if ((sim as any)[k] !== v) sim.setParam(k, v);
    }
    heart.setPotassium(next.chemistry.potassium ?? c.K ?? 4);
    heart.setCalcium(next.chemistry.calcium ?? 2.4);
    sim.K = heart.K;
    if (!!sim.baroEnabled !== !!c.baroEnabled) sim.toggleBaro();
  };
  apply(m);
  return { sim, heart, apply };
}

export interface SettledPatient {
  /** What the examination resolvers read (no lead buffers). */
  snapshot: Record<string, any>;
  /** The full private state, to resume the run elsewhere (a browser worker). */
  state: Record<string, any>;
}

/** Run a patient to steady state. */
export function settleModel(m: PatientModel, seconds = 20): SettledPatient {
  const { sim } = createCirculation(m);
  sim.advance(Math.round(seconds / sim.dt));
  const snapshot = sim.snapshot() as Record<string, any>;
  delete snapshot.ecgLeads;
  return { snapshot, state: sim.serializeState() };
}

/** A case's patient, settled: its pathology over a healthy adult. */
export function settleCirculation(caseDef: CaseDef, seconds = 20): Record<string, any> {
  return settleModel(modelFromCase(caseDef), seconds).snapshot;
}
