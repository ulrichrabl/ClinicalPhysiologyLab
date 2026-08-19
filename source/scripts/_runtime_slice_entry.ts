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
  params: {
    Rsys: number;
    HR: number;
    V0sv: number;
    baroEnabled: boolean;
    bloodVolume?: number;
    Emax?: number;
    K?: number;
    [key: string]: number | boolean | undefined;
  },
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
  for (const [k, v] of Object.entries(params)) {
    if (v == null || k === 'baroEnabled') continue;
    if (typeof v === 'number' || typeof v === 'boolean') sim.setParam(k, v as number);
  }
  if (sim.baroEnabled !== params.baroEnabled) sim.toggleBaro();
  const steps = Math.max(1, Math.round(seconds / sim.dt));
  sim.advance(steps);
  return sim.snapshot() as Record<string, number>;
}

/**
 * Persistent headless circulation host for checkpoint / correlated-advance tests.
 * Mimics the worker message protocol used by the live cardio domain.
 */
export function createHeadlessCardioHost() {
  const engine = new EcgEngine();
  engine.initialize({
    version: '0.1',
    seed: '10392042',
    patient: { phenotypeProfile: 'adult_profile_017', ageYears: 28, biologicalSex: 'male' },
    conditions: [{ id: 'normal', severity: 0, expression: 1 }],
    acquisition: { sampleRateHz: 500, paperSpeedMmPerSec: 25, gainMmPerMv: 10 },
  });
  let sim = new Circulation({ ...DEFAULTS });
  sim.engine = engine;
  let handler: ((e: { data: unknown }) => void) | null = null;
  const emit = (data: unknown) => handler?.({ data });

  return {
    get onmessage() { return handler; },
    set onmessage(fn: ((e: { data: unknown }) => void) | null) { handler = fn; },
    postMessage(msg: {
      type: string;
      requestId?: string;
      seconds?: number;
      key?: string;
      value?: number | boolean;
      values?: Record<string, number>;
      id?: string;
      state?: { payload?: unknown } | unknown;
    }) {
      switch (msg.type) {
        case 'play':
        case 'pause':
        case 'setSpeed':
          break;
        case 'setParam':
          sim.setParam(msg.key!, msg.value as number);
          break;
        case 'setParams':
          for (const [k, v] of Object.entries(msg.values ?? {})) sim.setParam(k, v);
          break;
        case 'setBaro':
          if (sim.baroEnabled !== msg.value) sim.toggleBaro();
          break;
        case 'reset':
          sim.reset({ ...DEFAULTS });
          engine.reset();
          emit({ type: 'snapshot', data: sim.snapshot() });
          break;
        case 'settle': {
          const before = sim.t;
          const seconds = msg.seconds || 4;
          sim.advance(Math.round(seconds / sim.dt));
          emit({
            type: 'advanced',
            requestId: msg.requestId ?? null,
            advancedMs: (sim.t - before) * 1000,
            data: sim.snapshot(),
          });
          break;
        }
        case 'exportState':
          emit({
            type: 'modelState',
            requestId: msg.requestId ?? null,
            state: {
              schemaVersion: 'circulation.private.v1',
              modelId: 'circulation.closed-loop',
              payload: sim.serializeState(),
            },
          });
          break;
        case 'importState': {
          const bag = msg.state as { payload?: unknown };
          sim.restoreState(bag?.payload ?? msg.state);
          emit({ type: 'modelStateRestored', requestId: msg.requestId ?? null, data: sim.snapshot() });
          break;
        }
        case 'prime':
          sim.advance(8000);
          emit({ type: 'snapshot', data: sim.snapshot() });
          break;
        default:
          break;
      }
    },
    /** Test helper: advance live play frames. */
    tick(seconds = 0.1) {
      const before = sim.t;
      sim.advance(Math.round(seconds / sim.dt));
      emit({ type: 'snapshot', data: sim.snapshot() });
      return sim.t - before;
    },
    serialize() { return sim.serializeState(); },
    snapshot() { return sim.snapshot(); },
  };
}

void CIRCULATION_BASELINE;
