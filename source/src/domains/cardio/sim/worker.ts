/* Cardiac simulation worker — hybrid ECG engine + closed-loop circulation. */
import { EcgEngine, catalogEntries } from '../ecg-engine/index.ts';
import { Circulation, type CirculationConfig } from './circulation.ts';

export const DEFAULTS: CirculationConfig = {
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

const engine = new EcgEngine();
engine.initialize({
  version: '0.1',
  seed: '10392042',
  patient: { phenotypeProfile: 'adult_profile_017', ageYears: 58, biologicalSex: 'female' },
  conditions: [{ id: 'normal', severity: 0, expression: 1 }],
  acquisition: { sampleRateHz: 500, paperSpeedMmPerSec: 25, gainMmPerMv: 10 },
});

let sim = new Circulation(DEFAULTS);
sim.engine = engine;
engine.setPotassium(4);

let running = false;
let speed = 1;
let timer: ReturnType<typeof setInterval> | null = null;
const FRAME_MS = 1000 / 30;

function tick() {
  if (!running) return;
  const seconds = (FRAME_MS / 1000) * speed;
  const steps = Math.min(Math.max(1, Math.round(seconds / sim.dt)), 1400);
  sim.advance(steps);
  postMessage({ type: 'snapshot', data: sim.snapshot() });
}

function ensureTimer() {
  if (timer === null) timer = setInterval(tick, FRAME_MS);
}

function settle(seconds = 4) {
  const before = sim.t;
  sim.advance(Math.round(seconds / sim.dt));
  return { advancedMs: (sim.t - before) * 1000, data: sim.snapshot() };
}

declare var self: typeof globalThis;

postMessage({
  type: 'catalog',
  pathologies: catalogEntries(),
  defaults: { ...DEFAULTS, R: DEFAULTS.Rsys, C: DEFAULTS.Csa, preload: 7.5 },
});

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as {
    type: string;
    id?: string;
    key?: string;
    value?: number | boolean;
    values?: Record<string, number>;
    seconds?: number;
    requestId?: string;
    state?: unknown;
    patient?: { ageYears?: number; sex?: string; phenotypeProfile?: string };
  };
  switch (msg.type) {
    case 'init':
      sim = new Circulation(DEFAULTS);
      sim.engine = engine;
      engine.reset();
      engine.initialize({
        version: '0.1', seed: '10392042',
        patient: {
          phenotypeProfile: msg.patient?.phenotypeProfile ?? 'adult_profile_017',
          ageYears: msg.patient?.ageYears,
          biologicalSex: msg.patient?.sex as 'female' | 'male' | undefined,
        },
        conditions: [{ id: 'normal', severity: 0, expression: 1 }],
        acquisition: {},
      });
      {
        const r = settle(4);
        postMessage({ type: 'advanced', requestId: msg.requestId ?? null, advancedMs: r.advancedMs, data: r.data });
      }
      break;
    case 'play': running = true; ensureTimer(); break;
    case 'pause': running = false; break;
    case 'reset':
      sim.reset(DEFAULTS);
      engine.reset();
      {
        const r = settle(4);
        postMessage({ type: 'snapshot', data: r.data });
      }
      break;
    case 'setSpeed': speed = (msg.value as number) ?? 1; break;
    case 'setParam':
      if (msg.key === 'stFactor' && msg.value != null) engine.setCalcium(2.4 + ((msg.value as number) - 1) / 0.55);
      sim.setParam(msg.key!, msg.value as number);
      break;
    case 'setParams':
      for (const [k, v] of Object.entries(msg.values ?? {})) {
        if (k === 'stFactor') engine.setCalcium(2.4 + (v - 1) / 0.55);
        sim.setParam(k, v);
      }
      break;
    case 'toggleBaro': sim.toggleBaro(); break;
    case 'setBaro': if (sim.baroEnabled !== msg.value) sim.toggleBaro(); break;
    case 'setPathology':
      sim.setPathology(msg.id!, DEFAULTS as Record<string, number | boolean>);
      {
        const r = settle(4);
        postMessage({ type: 'snapshot', data: r.data });
      }
      break;
    case 'settle': {
      const r = settle(msg.seconds || 4);
      postMessage({
        type: 'advanced',
        requestId: msg.requestId ?? null,
        advancedMs: r.advancedMs,
        data: r.data,
      });
      break;
    }
    case 'exportState':
      postMessage({
        type: 'modelState',
        requestId: msg.requestId ?? null,
        state: {
          schemaVersion: 'circulation.private.v1',
          modelId: 'circulation.closed-loop',
          payload: sim.serializeState(),
        },
      });
      break;
    case 'importState':
      if (msg.state && typeof msg.state === 'object') {
        const bag = msg.state as { payload?: unknown };
        sim.restoreState(bag.payload ?? msg.state);
      }
      postMessage({
        type: 'modelStateRestored',
        requestId: msg.requestId ?? null,
        data: sim.snapshot(),
      });
      break;
    case 'prime': {
      const r = settle(4);
      // Prime is not a correlated advance — emit ordinary snapshot for UI warm-up.
      postMessage({ type: 'snapshot', data: r.data });
      break;
    }
  }
};
