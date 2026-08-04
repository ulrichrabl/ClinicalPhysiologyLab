/** Bundle entry for the runtime proof-slice test. */
export {
  createPatientRuntime,
  createCommandId,
} from '../src/runtime/patient-runtime.ts';
export { asSimDuration, asSimTime, createEffectId } from '../src/contracts/brands.ts';
export { neurogenicShockDemo } from '../src/scenarios/definitions/neurogenic-shock-demo.ts';
export {
  CIRCULATION_BASELINE,
  NEUROGENIC_COMPLETE_TARGETS,
  adaptCardioPrivateParams,
} from '../src/models/cardiovascular/current-model-adapter.ts';
export { composeEffects } from '../src/physiology/composition/compose.ts';

import { Circulation } from '../src/domains/cardio/sim/circulation.ts';
import { EcgEngine } from '../src/domains/cardio/ecg-engine/index.ts';
import { CIRCULATION_BASELINE } from '../src/models/cardiovascular/current-model-adapter.ts';

const DEFAULTS = {
  Emax: 2.7, Emin: 0.06, V0: 12, edpA: 0.5, edpB: 0.022,
  EmaxRv: 0.62, V0rv: 22, edpArv: 0.42, edpBrv: 0.020,
  ElaMax: 0.25, ElaMin: 0.13, V0la: 16,
  EraMax: 0.20, EraMin: 0.10, V0ra: 18,
  TmaxV: 0.8, TmaxA: 0.13, actM1: 1.32, actM2: 21.9, actT1: 0.27, actT2: 0.45,
  Csa: 1.2, V0sa: 620, Csv: 62, V0sv: 3200, Rsys: 1.05, Rven: 0.023,
  Cpa: 4.2, V0pa: 92, Cpv: 8.5, V0pv: 212, Rpul: 0.075, Rpv: 0.011,
  Rmitral: 0.01, Raortic: 0.02, Rtricuspid: 0.009, Rpulmonic: 0.02,
  regMitral: 0, regAortic: 0, regTricuspid: 0, regPulmonic: 0,
  bloodVolume: 5000,
  HR: 72, K: 4,
  avConduction: 1, lbbConduction: 1, rbbConduction: 1,
  baroEnabled: true, Pn: 95, tauS: 2.5, tauP: 0.3, gS: 0.5, gP: 0.4,
  gR: 0.6, gV: 0.26, gE: 0.45,
  dt: 5e-4,
};

/** Run the existing Circulation model with adapter-translated private params. */
export function settleWithCirculation(
  params: { Rsys: number; HR: number; V0sv: number; baroEnabled: boolean },
  seconds: number,
): Record<string, number> {
  const engine = new EcgEngine();
  engine.initialize({
    version: '0.1',
    seed: '10392042',
    patient: { phenotypeProfile: 'adult_profile_017', ageYears: 28, biologicalSex: 'male' },
    conditions: [{ id: 'normal', severity: 0, expression: 1 }],
    acquisition: { sampleRateHz: 500, paperSpeedMmPerSec: 25, gainMmPerMv: 10 },
  });
  const cfg = { ...DEFAULTS };
  const sim = new Circulation(cfg);
  sim.engine = engine;
  sim.setParam('Rsys', params.Rsys);
  sim.setParam('HR', params.HR);
  sim.setParam('V0sv', params.V0sv);
  if (sim.baroEnabled !== params.baroEnabled) sim.toggleBaro();
  const steps = Math.max(1, Math.round(seconds / sim.dt));
  sim.advance(steps);
  return sim.snapshot() as Record<string, number>;
}

void CIRCULATION_BASELINE;
