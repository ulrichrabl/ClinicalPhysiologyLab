import { Circulation, type CirculationConfig } from '../../domains/cardio/sim/circulation.ts';
import { HeartElectrical } from '../physiology/heart/electrical.ts';
import { Respiratory, RESPIRATORY_DEFAULTS } from '../physiology/lung/respiratory.ts';
import { Body, BODY_DEFAULTS } from '../physiology/body/body.ts';
import type { CaseDef } from '../model/types.ts';
import { CIRCULATION_DEFAULTS, modelFromCase, type PatientModel } from '../physiology/state.ts';
import { CIRC } from '../evidence/circulation.ts';
import { INF } from '../evidence/inflammation.ts';
const CMH2O_TO_MMHG = 0.7356;
/** How quickly the circulation's reference for pleural pressure follows its mean (s): about two quiet breaths. */
const PPL_MEAN_TAU_S = 8;

/* ---------------------------------------------------------------------------
   The running patient: circulation, the heart's electrical model, the
   respiratory system and the body's internal milieu, coupled.

   The body (water, salt, potassium, acid–base, kidney, fuels) runs in hours.
   Settling a patient first runs the body through the illness's course (from a
   healthy steady state, or from the chronic state the case describes),
   coupling it to the circulation and lungs every few simulated hours; then
   the circulation and lungs settle in seconds around what the body has
   become. Live, the body advances with the clock like everything else.

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
  TmaxV: 0.8, TmaxA: CIRC.atrialTmax, actM1: CIRC.actM1, actM2: CIRC.actM2, actT1: CIRC.actT1, actT2: CIRC.actT2, dt: 5e-4,
};
const COUPLE_S = 0.1;

export interface CirculationRun {
  sim: Circulation;
  heart: HeartElectrical;
  resp: Respiratory;
  body: Body;
  /** Apply a changed model. */
  apply: (m: PatientModel) => void;
  /** Advance every model together, coupled every 0.1 s. */
  advance: (seconds: number) => void;
  /** Bring the slow respiratory states (CO2 stores, lung water, drive) to steady state for the current circulation. */
  equilibrate: () => void;
  /** Run to steady state from scratch. */
  settle: (seconds: number) => void;
  /** Run the body through the illness's course again (after a change of model). */
  course: () => void;
  /** The same, in steps, for a page to interleave with drawing. */
  courseSteps: () => Generator<void>;
  /** Settle circulation and lungs (seconds) around the body as it is. */
  settleFast: (seconds: number) => void;
}

export function createCirculation(m: PatientModel): CirculationRun {
  const heart = new HeartElectrical();
  const sim = new Circulation({ ...CIRCULATION_DEFAULTS, ...FIXED, baroEnabled: true });
  (sim as any).engine = heart;
  /* The sinus node is driven by the autonomic state the baroreflex sets. */
  heart.rateSource = () => (sim.baroEnabled ? sim.modulatedHR() : sim.openLoopHR());
  let model = m;
  const body = () => ({ age: model.patient.age, sex: model.patient.sex, heightCm: model.patient.heightCm, weightKg: model.patient.weightKg });
  const resp = new Respiratory(m.respiratory, body());
  const milieu = new Body(m.body, body());
  let lastK = NaN, lastCa = NaN;
  /* The circulation's blood-volume parameter is read as blood lost or given: the body holds the blood. */
  let bvParam = CIRCULATION_DEFAULTS.bloodVolume;

  /** What the body hands the circulation and lungs, with any value the learner has clamped. */
  const bodyOut = () => {
    const c = milieu.conc();
    const pin = model.chemistry;
    return { Hb: pin.haemoglobin ?? c.Hb, sbc: pin.bicarbonate ?? Math.max(3, c.SBC), albumin: pin.albumin ?? c.alb, K: pin.potassium ?? Math.min(9.5, c.K), Ca: pin.calcium ?? milieu.s.Ca };
  };

  let pplMean = NaN;
  const couple = () => {
    const mt = sim.metrics;
    const out = bodyOut();
    resp.setInputs({
      CO: mt?.CO && mt.CO > 0.3 ? mt.CO : 5.2, Pla: mt?.PlaMean ?? 7, Ppa: mt?.PpaMean ?? 15,
      Hb: out.Hb, sbc: out.sbc, albumin: out.albumin, temp: milieu.s.T, sysDrive: milieu.ventilatoryDrive(), metabolicMult: milieu.metabolicMult(),
    });
    sim.Rpul = model.circulation.Rpul * resp.rpulMult();
    /* Blood viscosity rises with haematocrit: anaemic blood flows more easily, so resistance falls and output rises.
       Angiotensin II and vasopressin constrict arterioles and capacitance veins. */
    sim.Rsys = model.circulation.Rsys * (CIRC.viscosityFixed + (1 - CIRC.viscosityFixed) * Math.min(CIRC.viscosityCap, out.Hb / CIRC.viscosityHbRef)) * milieu.rsysMult();
    sim.V0sv = model.circulation.V0sv * milieu.v0svMult();
    sim.Emax = model.circulation.Emax * milieu.contractility();
    /* Septic vessels respond poorly to sympathetic drive as well. */
    const vp = milieu.vasoplegia();
    const ar = milieu.adrenergicResponse();
    sim.gR = model.circulation.gR * (1 - INF.reflexResistanceLoss * vp) * ar; sim.gV = model.circulation.gV * (1 - INF.reflexVenousLoss * vp) * ar;
    sim.HR = model.circulation.HR * milieu.hrMult();
    if (!(Math.abs(out.Ca - lastCa) < 0.03)) { heart.setCalcium(out.Ca); lastCa = out.Ca; }
    const bv = milieu.bloodVolume();
    if (Math.abs(bv - sim.bloodVolume) > 0.5) sim.setBloodVolume(Math.max(1500, bv));
    if (!(Math.abs(out.K - lastK) < 0.02)) { heart.setPotassium(out.K); sim.K = heart.K; lastK = out.K; }
    /* The right ventricle's own blood supply. Its coronary perfusion pressure is aortic pressure minus the
       pressure in its wall; its demand rises with the pressure it must generate. When supply falls short it
       becomes ischaemic and weakens, which lowers aortic pressure and raises its own: the spiral of massive PE.
       Ischaemia builds and resolves over tens of seconds. */
    if (mt) {
      const rvWall = ((mt.PpaSys ?? 20) + (mt.CVPmean ?? 3)) / 2;
      const ratio = ((mt.Pmean ?? 90) - rvWall) / Math.max(10, mt.PpaSys ?? 20);
      const target = Math.max(0, Math.min(CIRC.rvIschaemiaMax, (CIRC.rvPerfusionRatio - ratio) / CIRC.rvPerfusionSpan));
      sim.rvIschaemia = (sim.rvIschaemia ?? 0) + (target - (sim.rvIschaemia ?? 0)) * (1 - Math.exp(-COUPLE_S / CIRC.rvIschaemiaTau));
    }
    sim.EmaxRv = model.circulation.EmaxRv * (1 - (sim.rvIschaemia ?? 0));
    sim.chemoDrive = Math.min(1.5, resp.chemoDrive() + milieu.adrenergic());
    const r = resp.snapshot();
    /* The breath's pleural pressure acts on the heart and lung vessels (cmH2O to mmHg), as it swings about its own mean.
       The circulation's constants were grounded on mean pressures and flows measured in breathing people, so they
       already contain breathing's average effect; what the pump adds is the swing within each breath. The mean follows
       over about two breaths. */
    pplMean = Number.isFinite(pplMean) ? pplMean + (r.Ppl - pplMean) * (1 - Math.exp(-COUPLE_S / PPL_MEAN_TAU_S)) : r.Ppl;
    sim.dPpl = (r.Ppl - pplMean) * CMH2O_TO_MMHG;
    milieu.setInputs({
      MAP: mt?.Pmean ?? 93, CO: mt?.CO && mt.CO > 0.3 ? mt.CO : 5.2, CVP: mt?.CVPmean ?? 3.5, sympathetic: sim.sigmaS ?? 0.47,
      PaCO2: r.PaCO2, DO2: r.DO2 ?? 1000, VO2: r.VO2 ?? 250, SaO2: r.SaO2,
    });
  };

  const apply = (next: PatientModel) => {
    model = next;
    heart.setParams(next.electrical);
    const c = next.circulation;
    for (const [k, v] of Object.entries(c)) {
      if (k === 'baroEnabled' || k === 'HR' || k === 'K' || k === 'Rpul' || k === 'EmaxRv' || k === 'Rsys' || k === 'V0sv' || k === 'bloodVolume' || k === 'Emax' || k === 'gR' || k === 'gV') continue;
      if ((sim as any)[k] !== v) sim.setParam(k, v);
    }
    milieu.setParams(next.body, body());
    if (c.bloodVolume !== bvParam) { milieu.addBlood(c.bloodVolume - bvParam); bvParam = c.bloodVolume; }
    const out = bodyOut();
    heart.setPotassium(out.K); lastK = out.K;
    heart.setCalcium(out.Ca); lastCa = out.Ca;
    { const hr = c.HR * milieu.hrMult(); if (sim.HR !== hr) sim.setParam('HR', hr); }
    sim.K = heart.K;
    if (!!sim.baroEnabled !== !!c.baroEnabled) sim.toggleBaro();
    resp.setParams(next.respiratory, body());
    sim.Rpul = c.Rpul * resp.rpulMult();
    sim.EmaxRv = c.EmaxRv * (1 - (sim.rvIschaemia ?? 0));
    sim.Rsys = c.Rsys * milieu.rsysMult();
    sim.V0sv = c.V0sv * milieu.v0svMult();
    sim.Emax = c.Emax * milieu.contractility();
    sim.gR = c.gR * (1 - INF.reflexResistanceLoss * milieu.vasoplegia()) * milieu.adrenergicResponse(); sim.gV = c.gV * (1 - INF.reflexVenousLoss * milieu.vasoplegia()) * milieu.adrenergicResponse();
    const bv = milieu.bloodVolume();
    if (Math.abs(bv - sim.bloodVolume) > 0.5) sim.setBloodVolume(Math.max(1500, bv));
  };

  const advance = (seconds: number) => {
    let left = seconds;
    while (left > 1e-9) {
      const h = Math.min(COUPLE_S, left);
      left -= h;
      sim.advance(Math.max(1, Math.round(h / sim.dt)));
      couple();
      resp.advance(h);
      milieu.integrate(h / 3600);
    }
  };
  const equilibrate = () => { couple(); resp.equilibrate(); sim.Rpul = model.circulation.Rpul * resp.rpulMult(); };
  /* The lungs change the circulation (PVR) and the circulation changes the lungs (output, pressures):
     settle in passes, bringing the slow respiratory states to steady state between them. */
  const settleFast = (seconds: number) => {
    advance(seconds * 0.5); equilibrate();
    advance(seconds * 0.35); equilibrate();
    advance(seconds * 0.15);
  };

  /* One phase of the body's course: the model held, the body integrated for `hours`, the circulation and lungs
     brought up to date whenever what the body hands them has changed enough to matter. */
  function* phase(hours: number, steps: number): Generator<void> {
    if (hours <= 0) return;
    const n = Math.max(3, Math.min(steps, Math.ceil(hours / 2)));
    const step = hours / n;
    let seen = { bv: NaN, K: NaN, Hb: NaN, sbc: NaN, rs: NaN };
    for (let k = 0; k < n; k++) {
      const out = bodyOut();
      const now = { bv: milieu.bloodVolume(), K: out.K, Hb: out.Hb, sbc: out.sbc, rs: milieu.rsysMult() * milieu.contractility() + 0.05 * milieu.s.T + 0.5 * milieu.hrMult() + 0.3 * milieu.metabolicMult() + 0.3 * milieu.adrenergicResponse() + 0.2 * out.Ca };
      const moved = !(Math.abs(now.bv - seen.bv) < 60 && Math.abs(now.K - seen.K) < 0.15 && Math.abs(now.Hb - seen.Hb) < 3
        && Math.abs(now.sbc - seen.sbc) < 0.7 && Math.abs(now.rs - seen.rs) < 0.02);
      if (moved) { couple(); advance(2.5); equilibrate(); milieu.anchor(); seen = now; yield; }
      milieu.integrate(step);
    }
  }

  /* The illness's course: a healthy steady state (or the chronic one the case describes), then the illness for its hours.
     A generator, so a page can run it in slices. */
  function* courseSteps(): Generator<void> {
    const target = model;
    /* Healthy first: a normal diet, a normal circulation, six days to steady state. */
    milieu.reset();
    bvParam = CIRCULATION_DEFAULTS.bloodVolume;
    milieu.setParams({ ...BODY_DEFAULTS }, body());
    milieu.setInputs({ MAP: 93, CO: 5.2, CVP: 3.5, sympathetic: 0.47, PaCO2: 5.33, DO2: 1000, VO2: 250, tempC: 37 });
    milieu.integrate(24 * 6);
    const ch = target.chronic;
    if (ch && (ch.body || ch.respiratory || ch.circulation)) {
      /* The chronic state: healthy, with the chronic disease and its usual treatment, for long enough to settle. */
      apply({
        ...target,
        circulation: { ...CIRCULATION_DEFAULTS, ...(ch.circulation ?? {}) },
        respiratory: { ...RESPIRATORY_DEFAULTS, ...(ch.respiratory ?? {}) },
        body: { ...BODY_DEFAULTS, ...(ch.body ?? {}) },
      });
      settleFast(8); yield;
      yield* phase(24 * (ch.days ?? 30), 10);
    }
    apply(target);
    settleFast(8); yield;
    yield* phase(target.body.courseHours, 24);
    couple();
  }
  const course = () => { for (const _ of courseSteps()) { /* run to the end */ } };

  const settle = (seconds: number) => { course(); settleFast(seconds * 0.6); };

  apply(m);
  return { sim, heart, resp, body: milieu, apply, advance, equilibrate, settle, settleFast, course, courseSteps };
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
  snapshot.electrical = { ...run.heart.p };
  snapshot.ecgDrive = run.heart.drive();
  snapshot.resp = run.resp.snapshot();
  snapshot.body = run.body.snapshot();
  return { snapshot, state: { ...run.sim.serializeState(), resp: run.resp.serialize(), body: run.body.serialize() } };
}

/** A case's patient, settled: its pathology over a healthy adult. */
export function settleCirculation(caseDef: CaseDef, seconds = 20): Record<string, any> {
  return settleModel(modelFromCase(caseDef), seconds).snapshot;
}
