import { Circulation, type CirculationConfig } from '../../domains/cardio/sim/circulation.ts';
import { HeartElectrical } from '../physiology/heart/electrical.ts';
import { Respiratory } from '../physiology/lung/respiratory.ts';
import { chemistryInputs } from '../physiology/chemistry.ts';
import type { CaseDef } from '../model/types.ts';
import { CIRCULATION_DEFAULTS, modelFromCase, type PatientModel } from '../physiology/state.ts';

/* ---------------------------------------------------------------------------
   The running patient: circulation, the heart's electrical model and the
   respiratory system, coupled.

   The circulation hands the lungs its cardiac output and the left atrial
   and pulmonary arterial pressures (which decide where lung water goes);
   the chemistry hands them haemoglobin, bicarbonate and albumin; the lungs
   hand back the pulmonary vascular resistance that emboli and hypoxic
   vasoconstriction create, and the blood gases.

   Used three ways: settled for tests, run live in the page, and settled
   again whenever a page opens a patient.
--------------------------------------------------------------------------- */

/** Integration settings and activation shape: fixed, not part of the patient. */
const FIXED: CirculationConfig = {
  TmaxV: 0.8, TmaxA: 0.13, actM1: 1.32, actM2: 21.9, actT1: 0.27, actT2: 0.45, dt: 5e-4,
};
const COUPLE_S = 0.1;

export interface CirculationRun {
  sim: Circulation;
  heart: HeartElectrical;
  resp: Respiratory;
  /** Apply a changed model. */
  apply: (m: PatientModel) => void;
  /** Advance every model together, coupled every 0.1 s. */
  advance: (seconds: number) => void;
  /** Bring the slow respiratory states (CO2 stores, lung water, drive) to steady state for the current circulation. */
  equilibrate: () => void;
  /** Run to steady state from scratch. */
  settle: (seconds: number) => void;
}

export function createCirculation(m: PatientModel): CirculationRun {
  const heart = new HeartElectrical();
  const sim = new Circulation({ ...CIRCULATION_DEFAULTS, ...FIXED, baroEnabled: true });
  (sim as any).engine = heart;
  /* The sinus node is driven by the autonomic state the baroreflex sets. */
  heart.rateSource = () => (sim.baroEnabled ? sim.modulatedHR() : sim.HR);
  let model = m;
  const body = () => ({ age: model.patient.age, sex: model.patient.sex, heightCm: model.patient.heightCm, weightKg: model.patient.weightKg });
  const resp = new Respiratory(m.respiratory, body());

  const couple = () => {
    const mt = sim.metrics;
    const chem = chemistryInputs({ metrics: mt ?? undefined, Pmsf: sim.meanFillingPressure(), bloodVolume: sim.bloodVolume, baroEnabled: sim.baroEnabled, K: sim.K }, model.chemistry);
    resp.setInputs({
      CO: mt?.CO && mt.CO > 0.3 ? mt.CO : 5.2, Pla: mt?.PlaMean ?? 7, Ppa: mt?.PpaMean ?? 15,
      Hb: chem.Hb, sbc: chem.sbc, albumin: chem.albumin,
    });
    sim.Rpul = model.circulation.Rpul * resp.rpulMult();
    /* Blood viscosity rises with haematocrit: anaemic blood flows more easily, so resistance falls and output rises. */
    sim.Rsys = model.circulation.Rsys * (0.6 + 0.4 * Math.min(1.6, chem.Hb / 150));
    /* A right ventricle facing an acute rise in pulmonary pressure outgrows its coronary supply and weakens. */
    const overload = Math.max(0, Math.min(1, ((mt?.PpaMean ?? 15) - 25) / 20));
    sim.EmaxRv = model.circulation.EmaxRv * (1 - 0.7 * overload);
    sim.chemoDrive = resp.chemoDrive();
  };

  const apply = (next: PatientModel) => {
    model = next;
    heart.setParams(next.electrical);
    const c = next.circulation;
    for (const [k, v] of Object.entries(c)) {
      if (k === 'baroEnabled' || k === 'K' || k === 'Rpul' || k === 'EmaxRv' || k === 'Rsys') continue;
      if ((sim as any)[k] !== v) sim.setParam(k, v);
    }
    heart.setPotassium(next.chemistry.potassium ?? c.K ?? 4);
    heart.setCalcium(next.chemistry.calcium ?? 2.4);
    sim.K = heart.K;
    if (!!sim.baroEnabled !== !!c.baroEnabled) sim.toggleBaro();
    resp.setParams(next.respiratory, body());
    sim.Rpul = c.Rpul * resp.rpulMult();
    sim.EmaxRv = c.EmaxRv;
    sim.Rsys = c.Rsys;
  };

  const advance = (seconds: number) => {
    let left = seconds;
    while (left > 1e-9) {
      const h = Math.min(COUPLE_S, left);
      left -= h;
      sim.advance(Math.max(1, Math.round(h / sim.dt)));
      couple();
      resp.advance(h);
    }
  };
  const equilibrate = () => { couple(); resp.equilibrate(); sim.Rpul = model.circulation.Rpul * resp.rpulMult(); };
  /* The lungs change the circulation (PVR) and the circulation changes the lungs (output, pressures):
     settle in passes, bringing the slow respiratory states to steady state between them. */
  const settle = (seconds: number) => {
    advance(seconds * 0.5); equilibrate();
    advance(seconds * 0.35); equilibrate();
    advance(seconds * 0.15);
  };

  apply(m);
  return { sim, heart, resp, apply, advance, equilibrate, settle };
}

export interface SettledPatient {
  /** What the examination resolvers read (no lead buffers); the respiratory state is under `resp`. */
  snapshot: Record<string, any>;
  /** The full private state, to resume the run elsewhere (a browser worker). */
  state: Record<string, any>;
}

/** Run a patient to steady state. */
export function settleModel(m: PatientModel, seconds = 20): SettledPatient {
  const run = createCirculation(m);
  run.settle(seconds);
  const snapshot = run.sim.snapshot() as Record<string, any>;
  delete snapshot.ecgLeads;
  snapshot.resp = run.resp.snapshot();
  return { snapshot, state: { ...run.sim.serializeState(), resp: run.resp.serialize() } };
}

/** A case's patient, settled: its pathology over a healthy adult. */
export function settleCirculation(caseDef: CaseDef, seconds = 20): Record<string, any> {
  return settleModel(modelFromCase(caseDef), seconds).snapshot;
}
