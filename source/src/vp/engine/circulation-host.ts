import { Circulation, type CirculationConfig } from '../../domains/cardio/sim/circulation.ts';
import { EcgEngine } from '../../domains/cardio/ecg-engine/index.ts';
import type { CaseDef } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   Headless circulation for the virtual patient.

   Runs the same closed-loop model the cardio domain uses, with the case's
   pathology applied, until it settles, and returns the snapshot the
   cardiovascular examination resolvers read. In the app this will come from
   the Patient Runtime's cardio host; here it lets a page or a test examine a
   patient without the rest of the app.
--------------------------------------------------------------------------- */

/** Same values as the cardio worker's defaults (domains/cardio/sim/worker.ts). */
const DEFAULTS: CirculationConfig = {
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

export function settleCirculation(caseDef: CaseDef, seconds = 20): Record<string, any> {
  const engine = new EcgEngine();
  engine.initialize({
    version: '0.1',
    seed: '10392042',
    patient: { phenotypeProfile: 'adult_profile_017', ageYears: caseDef.patient.age, biologicalSex: caseDef.patient.sex === 'F' ? 'female' : 'male' },
    conditions: [{ id: 'normal', severity: 0, expression: 1 }],
    acquisition: { sampleRateHz: 500, paperSpeedMmPerSec: 25, gainMmPerMv: 10 },
  } as any);
  const sim = new Circulation({ ...DEFAULTS });
  (sim as any).engine = engine;
  for (const [k, v] of Object.entries(caseDef.pathology.physiology ?? {})) sim.setParam(k, v);
  sim.advance(Math.round(seconds / sim.dt));
  const snap = sim.snapshot() as Record<string, any>;
  delete snap.ecgLeads;   // large and not needed for examination
  return snap;
}
