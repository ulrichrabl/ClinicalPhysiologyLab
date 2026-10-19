/* Closed-loop circulation — RK4 hemodynamics. ECG via EcgEngine. */
// @ts-nocheck

const S_VLV = 0, S_VLA = 1, S_VRV = 2, S_VRA = 3,
      S_VSA = 4, S_VSV = 5, S_VPA = 6, S_VPV = 7,
      S_SS = 8, S_SP = 9, N_STATE = 10;

import type { EcgEngine } from '../ecg-engine/engine.ts';
import { CIRC, BARO } from '../../../vp/evidence/circulation.ts';

const REG_BASE_LEFT = CIRC.regBaseLeft;
const REG_BASE_RIGHT = CIRC.regBaseRight;
const KLOTZ_AN = CIRC.klotzAn, KLOTZ_BN = CIRC.klotzBn;
import type { MechanicalTrigger } from '../ecg-engine/types/index.ts';
import { getMechanism } from '../ecg-engine/mechanisms/registry.ts';

export interface CirculationConfig {
  [key: string]: number | boolean;
}

export class Circulation {
  engine: EcgEngine | null = null;
  _pathParams: Record<string, number> = {};
  avConduction = 1;
  lbbConduction = 1;
  rbbConduction = 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;

  constructor(cfg: CirculationConfig) { this.configure(cfg); this.applyCfg(cfg); }

  configure(c) {
    // --- chamber mechanics -------------------------------------------------
    this.Emax = c.Emax; this.Emin = c.Emin; this.V0 = c.V0;
    this.edpA = c.edpA; this.edpB = c.edpB;
    /* Klotz's normalised EDPVR, when the patient gives its two volumes (zero-pressure and 30 mmHg). */
    this.edpV0 = c.edpV0 ?? 0; this.edpV30 = c.edpV30 ?? 0;
    this.edpV0rv = c.edpV0rv ?? 0; this.edpV30rv = c.edpV30rv ?? 0;
    this.EmaxRv = c.EmaxRv; this.V0rv = c.V0rv;
    this.edpArv = c.edpArv; this.edpBrv = c.edpBrv;
    /* The pericardium and the septum: the heart's four chambers share a sac and two of them a wall. */
    this.periV0 = c.periV0 ?? CIRC.periV0; this.periVs = c.periVs ?? CIRC.periVs; this.pericardialFluid = c.pericardialFluid ?? 0;
    this.septalShift = c.septalShift ?? CIRC.septalShift;
    this.septalRef = c.septalRef ?? 0;
    this.ElaMax = c.ElaMax; this.ElaMin = c.ElaMin; this.V0la = c.V0la;
    this.EraMax = c.EraMax; this.EraMin = c.EraMin; this.V0ra = c.V0ra;

    // --- vascular compartments --------------------------------------------
    this.Csa = c.Csa; this.V0sa = c.V0sa;
    this.Csv = c.Csv; this.V0sv = c.V0sv;
    this.Cpa = c.Cpa; this.V0pa = c.V0pa;
    this.Cpv = c.Cpv; this.V0pv = c.V0pv;
    this.Rsys = c.Rsys; this.Rven = c.Rven;
    this.Rpul = c.Rpul; this.Rpv = c.Rpv;

    // --- valves: forward resistance and regurgitant fraction --------------
    this.Rmitral = c.Rmitral; this.Raortic = c.Raortic;
    this.Rtricuspid = c.Rtricuspid; this.Rpulmonic = c.Rpulmonic;
    this.regMitral = c.regMitral; this.regAortic = c.regAortic;
    this.regTricuspid = c.regTricuspid; this.regPulmonic = c.regPulmonic;

    // --- activation --------------------------------------------------------
    this.enRaw = 0; this.eaRaw = 0;
    this.mechT = -1; this.mechTa = -1; this.beatTrigger = false; this.vtTimer = 0;
    this.TmaxV = c.TmaxV; this.TmaxA = c.TmaxA;
    this.actM1 = c.actM1; this.actM2 = c.actM2;
    this.actT1 = c.actT1; this.actT2 = c.actT2; this.actNorm = 1;
    this.computeActNorm(0.8);

    this.HR = c.HR; this.HReff = c.HR; this.K = c.K;
    this.baroEnabled = c.baroEnabled;
    this.Pn = c.Pn; this.tauS = c.tauS; this.tauP = c.tauP; this.gS = c.gS; this.gP = c.gP;
    this.gR = c.gR; this.gV = c.gV; this.gE = c.gE;
    this.dt = c.dt;
    this.sigmaS = 0.5; this.sigmaP = 0.5; this.chemoDrive = 0;
    this.effRsys = c.Rsys; this.effV0sv = c.V0sv; this.effEmax = c.Emax;

    /* Total blood volume. Scaling this is haemorrhage or transfusion, and it
       is the one control that makes the closed loop worth having. */
    this.bloodVolume = c.bloodVolume;
    this.distributeVolume(c);

    this.t = 0; this.seq = 0;
    this.mitralOpen = false; this.aorticOpen = false;
    this.tricuspidOpen = false; this.pulmonicOpen = false;
    this.en = 0; this.enRv = 0; this.ea = 0; this.E = 0; this.Ela = 0;
    this.stretchLv = 1; this.stretchRv = 1; this.normLv = null; this.normRv = null; this.edvRefLv = null; this.edvRefRv = null; this.edvBreathLv = null; this.edvBreathRv = null; this.lastBeatPpl = null;
    this.Pv = 0; this.Pla = 0; this.Prv = 0; this.Pra = 0; this.Ppa = 0; this.Ppv = 0; this.Psv = 0;
    this.Qfill = 0; this.Qeject = 0; this.Qout = 0; this.Qpv = 0;
    this.Qtri = 0; this.Qpulv = 0; this.Qven = 0; this.Qpulcap = 0;
    this.dPdt = 0; this.ecgValue = 0; this.firingRate = 25;

    this.prevEn = 0;
    this.beat = []; this.lastBeat = null; this.lastSample = -1;
    this.metrics = null;
    this.events = { mvc: null, avo: null, avc: null, mvo: null, s1: null, tvc: null, tvcLast: null, pvo: null, pvc: null, tvo: null, m1: null };
    this.prevMitral = false; this.prevAortic = false;
    this.beatStartT = 0;
  }

  /* Lay the blood out in roughly physiological proportions, then let the model
     settle. Two thirds of it sits in the systemic veins, which is why they are
     the reservoir the rest of the circulation draws on. */
  distributeVolume(c) {
    const V = this.bloodVolume;
    const frac = {
      lv: CIRC.initLv, la: CIRC.initLa, rv: CIRC.initRv, ra: CIRC.initRa,
      sa: CIRC.initSa, sv: CIRC.initSv, pa: CIRC.initPa, pv: CIRC.initPv,
    };
    this.s = new Float64Array(N_STATE);
    this.s[S_VLV] = V * frac.lv; this.s[S_VLA] = V * frac.la;
    this.s[S_VRV] = V * frac.rv; this.s[S_VRA] = V * frac.ra;
    this.s[S_VSA] = V * frac.sa; this.s[S_VSV] = V * frac.sv;
    this.s[S_VPA] = V * frac.pa; this.s[S_VPV] = V * frac.pv;
    this.s[S_SS] = 0.5; this.s[S_SP] = 0.5;
  }

  /* Rescale every compartment when total volume changes, so a haemorrhage
     removes blood from everywhere in proportion rather than draining one box. */
  setBloodVolume(v) {
    const old = this.totalVolume();
    if (old <= 0) return;
    const k = v / old;
    for (let i = 0; i < 8; i++) this.s[i] *= k;
    this.bloodVolume = v;
  }

  totalVolume() { let t = 0; for (let i = 0; i < 8; i++) t += this.s[i]; return t; }

  /* Mean systemic filling pressure: the pressure the circulation would settle
     at if the heart stopped. The upstream end of the venous return curve. */
  meanFillingPressure() {
    const stressed = (this.s[S_VSA] - this.V0sa) + (this.s[S_VSV] - (this.effV0sv ?? this.V0sv))
      + (this.s[S_VPA] - this.V0pa) + (this.s[S_VPV] - this.V0pv);
    return stressed / (this.Csa + this.Csv + this.Cpa + this.Cpv);
  }

  applyCfg(_c: CirculationConfig) { /* conduction now in EcgEngine */ }

  baroFiring(P) { return BARO.firingMin + (BARO.firingMax - BARO.firingMin) / (1 + Math.exp(-BARO.firingSlope * (P - this.Pn))); }

  /* With the reflex loop opened, autonomic tone is held at its resting level (σ = ½), as the vascular
     effectors are: the sinus node runs at the resting rate, not at its denervated intrinsic rate. */
  openLoopHR() { return this.HR * (1 + 0.5 * this.gS - 0.5 * this.gP); }

  modulatedHR() {
    // Hyperpnoea itself withdraws vagal tone from the sinus node (the lung-inflation reflex, central respiratory–cardiac coupling).
    const hr = this.HR * (1 + this.gS * this.sigmaS - this.gP * this.sigmaP + BARO.chemoHr * (this.chemoDrive || 0));
    return Math.max(BARO.hrMin, Math.min(BARO.hrMax, hr));
  }

  /* The baroreflex is not a heart-rate reflex.

     Rate is the least of it. Sympathetic outflow also constricts arterioles
     (raising resistance), constricts the venous capacitance vessels (which
     *recruits unstressed volume into the stressed compartment* and is the main
     defence against haemorrhage), and raises contractility. In an open-loop
     model the venous limb has nowhere to act, which is why it was missing
     before; in a closed one it is the most important effector of the four. */
  reflexDrive() { return this.sigmaS - 0.5; }        // -0.5 .. +0.5

  effectiveRsys() {
    return this.baroEnabled ? this.Rsys * (1 + this.gR * this.reflexDrive() * 2) : this.Rsys;
  }

  effectiveV0sv() {
    // Venoconstriction lowers unstressed volume, shifting blood into the
    // stressed compartment and raising mean filling pressure.
    return this.baroEnabled ? this.V0sv * (1 - this.gV * this.reflexDrive() * 2) : this.V0sv;
  }

  effectiveEmax() {
    return this.baroEnabled ? this.Emax * (1 + this.gE * this.reflexDrive() * 2) : this.Emax;
  }

  /* Chamber pressure from a time-varying elastance with an exponential passive
     limb — the same form for all four chambers, different constants. */
  /* Not clamped at zero. A chamber below its unstressed volume must generate a
     restoring negative pressure, or it has no way to resist being emptied — it
     drains to whatever floor the integrator imposes, and the floor then has to
     invent the blood back. That is how volume stopped being conserved. */
  chamberP(V, act, Emax, V0, Ped) {
    const Pes = Emax * (V - V0);
    return act * Pes + (1 - act) * Ped;
  }

  /* Passive (end-diastolic) pressure–volume relation. Klotz et al. found that human ventricles of every
     aetiology share one curve once volume is normalised between the zero-pressure volume V0 and the
     volume at 30 mmHg: P = An·((V − V0)/(V30 − V0))^Bn. Below V0 the empty ventricle recoils (suction). */
  static klotz(V, V0, V30) {
    const x = (V - V0) / (V30 - V0);
    return x > 0 ? KLOTZ_AN * Math.pow(x, KLOTZ_BN) : CIRC.diastolicSuction * (V - V0);
  }
  pEnd(V) { return this.Emax * (V - this.V0); }
  pPassive(V) { return this.edpV30 > this.edpV0 && this.edpV0 > 0 ? Circulation.klotz(V, this.edpV0, this.edpV30) : this.edpA * (Math.exp(this.edpB * (V - this.V0)) - 1); }
  pPassiveRv(V) { return this.edpV30rv > this.edpV0rv && this.edpV0rv > 0 ? Circulation.klotz(V, this.edpV0rv, this.edpV30rv) : this.edpArv * (Math.exp(this.edpBrv * (V - this.V0rv)) - 1); }

  /* One valve. Forward flow down the gradient through the orifice; backward
     flow through the regurgitant orifice if there is one. Expressing both in
     one continuous function removes the open/closed state machine, which used
     to need hysteresis to stay stable. */
  valveFlow(Pup, Pdown, Rfwd, regurg, regBase) {
    const dP = Pup - Pdown;
    if (dP >= 0) return dP / Rfwd;
    if (regurg <= 1e-4) return 0;
    /* Resistance goes as the inverse square of orifice area, so the severity
       dial is squared. A valve can be both stenotic and incompetent — mixed
       disease — because the two paths are described separately. */
    const Rreg = regBase / (regurg * regurg);
    return dP / Rreg;
  }


  /* Normalised elastance activation e(t), double-Hill form
     (Stergiopulos et al.): a steep rise, a rounded peak at end-systole, and a
     faster relaxation. The rounded peak is what makes the ejection limb of the
     PV loop bow above the ESPVR and touch it only at end-systole. */
  activation(t, T, stretch = 1, norm = this.actNorm) {
    if (t < 0) return 0;
    const t1 = this.actT1 * T, t2 = this.actT2 * T * stretch;
    const g1 = Math.pow(t / t1, this.actM1);
    const g2 = Math.pow(t / t2, this.actM2);
    const e = (g1 / (1 + g1)) * (1 / (1 + g2));
    return Math.min(1, e / norm);
  }

  /* Where in the breath the circulation is now (the host passes the lung's breath clock with each coupling): the phase,
     and how far through it (0 at its start, 1 at its end). Null without a breathing host. */
  breathPhase() {
    const b = this.breath;
    if (!b || !(b.Ti > 0) || !(b.Te > 0)) return null;
    const Ttot = b.Ti + b.Te;
    const t = (((b.t + (this.t - b.at)) % Ttot) + Ttot) % Ttot;
    return t < b.Ti ? { phase: 'insp', frac: t / b.Ti } : { phase: 'exp', frac: (t - b.Ti) / b.Te };
  }

  /* When the host brings the circulation to a new steady state at once (settling, a changed patient), the reference
     filling is set to the present breath-averaged filling: the reference is the ventricle's usual filling, and a
     state reached by settling is usual by construction. Without this, how long ago and from where a patient was
     settled would bias its systole for the next minute. */
  anchorSystole() {
    if (this.edvBreathLv != null) this.edvRefLv = this.edvBreathLv;
    if (this.edvBreathRv != null) this.edvRefRv = this.edvBreathRv;
  }

  /* The peak of the un-normalised curve whose relaxation is stretched by `stretch` (the peak does not depend on the
     period, only on the ratio of the two time constants). */
  actPeak(stretch) {
    let peak = 0;
    for (let i = 0; i <= 400; i++) {
      const t = i / 400, g1 = Math.pow(t / this.actT1, this.actM1), g2 = Math.pow(t / (this.actT2 * stretch), this.actM2);
      const e = (g1 / (1 + g1)) * (1 / (1 + g2));
      if (e > peak) peak = e;
    }
    return peak || 1;
  }

  /* Length-dependent systole. A ventricle that starts its beat fuller than usual stays active longer: its relaxation
     comes later, so it ejects for longer (Curtiss 1975: in inspiration the right ventricle's systole, Q–O, lengthens
     by 7.7 ms as venous return fills it; Weissler: ejection time rises with stroke volume). Each ventricle is compared
     with its own recent filling, so the effect is beat to beat (breathing, irregular rhythms), and a heart that is
     simply large is not given a longer systole by it. */
  beginSystole() {
    const rr = 60 / Math.max(30, this.baroEnabled ? this.HReff : this.openLoopHR());
    const w = 1 - Math.exp(-rr / CIRC.systoleLengthTau);
    const one = (V, ref) => {
      const r = ref == null || !(ref > 0) ? V : ref;
      const stretch = Math.max(0.8, Math.min(1.25, 1 + CIRC.systoleLengthGain * (V / r - 1)));
      return { stretch, ref: r + (V - r) * w };
    };
    const lv = one(this.s[S_VLV], this.edvRefLv), rv = one(this.s[S_VRV], this.edvRefRv);
    this.edvRefLv = lv.ref; this.edvRefRv = rv.ref;
    /* the filling averaged over about a breath, as the examination's breath-averaged metrics are (4 s) */
    const wb = 1 - Math.exp(-rr / 4);
    this.edvBreathLv = this.edvBreathLv == null ? this.s[S_VLV] : this.edvBreathLv + (this.s[S_VLV] - this.edvBreathLv) * wb;
    this.edvBreathRv = this.edvBreathRv == null ? this.s[S_VRV] : this.edvBreathRv + (this.s[S_VRV] - this.edvBreathRv) * wb;
    this.stretchLv = lv.stretch; this.stretchRv = rv.stretch;
    this.normLv = this.actPeak(lv.stretch); this.normRv = this.actPeak(rv.stretch);
    /* What the beat starts with, for the beat log: each ventricle's end-diastolic volume, and where in the breath it filled.
       A new beat starts in the same step that closes the previous one's log entry, before it; so the entry being closed
       takes the volumes captured at its own start (beatEdvPrev). */
    this.beatEdvPrev = this.beatEdv ?? null;
    this.beatEdv = { lv: this.s[S_VLV], rv: this.s[S_VRV], breath: this.breathPhase() };
  }

  /* Peak value of the un-normalised double-Hill curve, for scaling. */
  computeActNorm(T) {
    this.actNorm = 1;
    let peak = 0;
    for (let i = 0; i <= 400; i++) {
      const v = this.activation((i / 400) * T, T);
      if (v > peak) peak = v;
    }
    this.actNorm = peak || 1;
  }

  setParam(key, value) {
    if (key === 'bloodVolume') { this.setBloodVolume(value); return; }
    if (key === 'K') { this.K = value; this.engine?.setPotassium(value); return; }
    if (key === 'HR') {
      this.HR = value;
      this.HReff = value;
      this.engine?.setHeartRate?.(value);
      return;
    }
    if (key === 'avConduction') { this.avConduction = value; return; }
    if (key === 'lbbConduction') { this.lbbConduction = value; return; }
    if (key === 'rbbConduction') { this.rbbConduction = value; return; }
    if (key === 'baroEnabled') { this.baroEnabled = value; return; }
    /* Legacy aliases, so lessons written against the open-loop model keep
       working after the move to a closed one. */
    if (key === 'R') { this.Rsys = value; return; }
    if (key === 'C') { this.Csa = value; return; }
    if (key === 'preload') { this.setBloodVolume(3400 + value * 215); return; }
    if (key in this) { this[key] = value; return; }
  }

  deriv(y, av, aa, avr = av) {
    const Vlv = y[S_VLV], Vla = y[S_VLA], Vrv = y[S_VRV], Vra = y[S_VRA];
    const Vsa = y[S_VSA], Vsv = y[S_VSV], Vpa = y[S_VPA], Vpv = y[S_VPV];

    // --- chamber pressures -------------------------------------------------
    /* Ventricular interdependence. In diastole the septum is a compliant wall between the ventricles: when
       the right ventricle's filling pressure exceeds the left's (an acutely pressure-loaded right ventricle),
       it bows into the left, which then needs a higher pressure to hold the same volume. In systole both
       ventricles stiffen and the septum is held. */
    const dPsep = this.pPassiveRv(Vrv) - this.pPassive(Vlv);
    /* The septum's normal position already reflects the normal gradient (the left ventricle fills at a higher
       pressure than the right); it moves only as that gradient departs from normal. */
    const shift = (1 - av) * Math.max(CIRC.septalShiftMin, Math.min(CIRC.septalShiftMax, this.septalShift * (dPsep - this.septalRef)));
    /* The pericardium: a stiff sac around all four chambers (and any fluid in it). Its pressure adds to every
       chamber; it is negligible until the heart outgrows its reserve volume (tamponade, acute dilatation). */
    const Vheart = Vlv + Vrv + Vla + Vra + (this.pericardialFluid || 0);
    const Pperi = CIRC.periScale * (Math.exp(Math.min(8, (Vheart - this.periV0) / this.periVs)) - Math.exp(-this.periV0 / this.periVs));
    const Plv = this.chamberP(Vlv + shift, av, this.effEmax, this.V0, this.pPassive(Vlv + shift)) + Pperi + (this.dPpl || 0);
    // the right ventricle's filling pressure is set by its free wall; the septum it pushes over takes the left's room
    const Prv = this.chamberP(Vrv, avr, this.EmaxRv, this.V0rv, this.pPassiveRv(Vrv)) + Pperi + (this.dPpl || 0);
    const Ela = this.ElaMin + (this.ElaMax - this.ElaMin) * aa;
    const Era = this.EraMin + (this.EraMax - this.EraMin) * aa;
    /* The respiratory pump: the heart and the pulmonary vessels sit in the chest, the systemic arteries and veins
       mostly outside it. Pleural pressure, as it departs from its resting end-expiratory value, adds to every
       intrathoracic pressure. Inspiration lowers it: the right atrium's pressure falls against the veins outside, more
       blood returns, the right ventricle fills and ejects for longer (P2 later); the left ventricle ejects against an
       aorta outside the chest, so its stroke falls a little (systolic pressure dips, A2 earlier). */
    const dPpl = this.dPpl || 0;
    const Pla = Ela * (Vla - this.V0la) + Pperi + dPpl;
    const Pra = Era * (Vra - this.V0ra) + Pperi + dPpl;
    this.Pperi = Pperi;

    // --- vascular pressures ------------------------------------------------
    /* Vascular pressures are allowed below zero. A vein whose volume has fallen
       below its unstressed volume is collapsing, not holding at exactly zero,
       and clamping it there breaks the model in exactly the case that matters:
       severe haemorrhage, where the clamp cuts venous return to nothing and the
       whole circulation stops rather than settling into shock. */
    const Psa = (Vsa - this.V0sa) / this.Csa;
    const Psv = (Vsv - this.effV0sv) / this.Csv;
    const Ppa = (Vpa - this.V0pa) / this.Cpa + dPpl;
    const Ppv = (Vpv - this.V0pv) / this.Cpv + dPpl;

    // --- valves ------------------------------------------------------------
    const Qao  = this.valveFlow(Plv, Psa, this.Raortic, this.regAortic, REG_BASE_LEFT);
    const Qmit = this.valveFlow(Pla, Plv, this.Rmitral, this.regMitral, REG_BASE_LEFT);
    const Qpv2 = this.valveFlow(Prv, Ppa, this.Rpulmonic, this.regPulmonic, REG_BASE_RIGHT);
    const Qtri = this.valveFlow(Pra, Prv, this.Rtricuspid, this.regTricuspid, REG_BASE_RIGHT);

    // --- vascular flows ----------------------------------------------------
    const Qsys = (Psa - Psv) / this.effRsys;       // through the arterioles
    const Qven = (Psv - Pra) / this.Rven;          // venous return
    const Qpulcap = (Ppa - Ppv) / this.Rpul;       // through the lung
    const Qpvret = (Ppv - Pla) / this.Rpv;         // pulmonary venous return

    const firing = this.baroFiring(Psa);
    const norm = Math.max(0, Math.min(1, (firing - BARO.firingMin) / (BARO.firingMax - BARO.firingMin)));

    const d = new Float64Array(N_STATE);
    d[S_VLV] = Qmit - Qao;
    d[S_VLA] = Qpvret - Qmit;
    d[S_VRV] = Qtri - Qpv2;
    d[S_VRA] = Qven - Qtri;
    d[S_VSA] = Qao - Qsys;
    d[S_VSV] = Qsys - Qven;
    d[S_VPA] = Qpv2 - Qpulcap;
    d[S_VPV] = Qpulcap - Qpvret;
    /* Carotid-body (chemoreceptor) and dyspnoeic drive add sympathetic and withdraw vagal tone:
       hypoxaemia and breathlessness are tachycardic even at a normal blood pressure. */
    const chemo = this.chemoDrive || 0;
    d[S_SS] = (Math.min(1, 1 - norm + BARO.chemoSympathetic * chemo) - y[S_SS]) / this.tauS;
    d[S_SP] = (Math.max(0, norm - BARO.chemoVagal * chemo) - y[S_SP]) / this.tauP;

    return {
      d,
      Plv, Pla, Prv, Pra, Psa, Psv, Ppa, Ppv, Ela, Era,
      E: Vlv > this.V0 + 1 ? Plv / (Vlv - this.V0) : this.effEmax * av,
      Qao, Qmit, Qpv2, Qtri, Qsys, Qven, Qpulcap, Qpvret,
      mitral: Qmit > 0, aortic: Qao > 0, tricuspid: Qtri > 0, pulmonic: Qpv2 > 0,
    };
  }

  step() {
    const ms = this.dt * 1000;

    // Mechanical → electrical feedback (spec §14.2)
    if (this.engine) {
      this.engine.updatePhysiology({
        mechanics: {
          leftAtrialPressure: this.Pla,
          rightAtrialPressure: this.Pra,
          leftVentricularPressure: this.Pv,
          rightVentricularPressure: this.Prv,
          leftAtrialVolume: this.Vla,
          rightAtrialVolume: this.Vra,
          leftVentricularVolume: this.V,
          rightVentricularVolume: this.Vrv,
          pulmonaryVascularResistance: this.Rpul,
          systemicVascularResistance: this.Rsys,
          lvContractilityScale: this.effEmax / this.Emax,
          rvContractilityScale: 1,
        },
      });
      this.engine.step(ms);
    }

    // Electrical → mechanical (spec §14.1)
    let ventActivation = 0;
    let atrialActivation = 0;
    const triggers: MechanicalTrigger[] = this.engine?.getMechanicalTriggers() ?? [];
    for (const tr of triggers) {
      if (tr.chamber === 'LV' || tr.chamber === 'RV') {
        ventActivation = Math.max(ventActivation, tr.activationFraction * tr.synchrony);
        if (this.mechT < 0) { this.mechT = 0; this.beatTrigger = true; this.beginSystole(); }
      }
      if (tr.chamber === 'RA' || tr.chamber === 'LA') {
        atrialActivation = Math.max(atrialActivation, tr.activationFraction);
        if (this.mechTa < 0) this.mechTa = 0;
      }
    }

    if (ventActivation > 0.1 && this.enRaw <= 0.1) {
      this.mechT = 0; this.beatTrigger = true; this.beginSystole();
      /* A dyssynchronous activation (bundle branch block, a ventricular focus) contracts less
         effectively: parts of the wall are still relaxing while others shorten. */
      this.beatSync = Math.min(1, Math.max(0.3, ventActivation));
    }
    this.enRaw = ventActivation;
    this.en = this.activation(this.mechT, this.TmaxV, this.stretchLv ?? 1, this.normLv ?? this.actNorm) * (this.beatSync ?? 1);
    this.enRv = this.activation(this.mechT, this.TmaxV, this.stretchRv ?? 1, this.normRv ?? this.actNorm) * (this.beatSync ?? 1);
    if (this.mechT >= 0) this.mechT += this.dt;

    if (atrialActivation > 0.1 && this.eaRaw <= 0.1) this.mechTa = 0;
    this.eaRaw = atrialActivation;
    this.ea = this.activation(this.mechTa >= 0 ? this.mechTa * (0.8 / this.TmaxA) * CIRC.atrialActivationScale : -1, 0.8);
    if (this.mechTa >= 0) this.mechTa += this.dt;

    const rr = 60 / Math.max(30, this.baroEnabled ? this.HReff : this.openLoopHR());
    this.TmaxV = Math.max(CIRC.systoleMin, Math.min(CIRC.systoleMax, rr));

    const out = this.engine?.peek ? this.engine.peek() : this.engine?.getOutput();
    this.ecgValue = out?.ecgValue ?? 0;
    if (out?.effectiveHR) this.HReff = out.effectiveHR;

    /* Reflex effectors are held constant across the RK4 sub-steps: they move on
       a timescale of seconds, the integrator on half-milliseconds. */
    this.effRsys = this.effectiveRsys();
    this.effV0sv = this.effectiveV0sv();
    this.effEmax = this.effectiveEmax();

    // ---- RK4 over the whole state vector ---------------------------------
    const h = this.dt, y0 = this.s;
    const tmp = new Float64Array(N_STATE);
    const k1 = this.deriv(y0, this.en, this.ea, this.enRv ?? this.en).d;
    for (let i = 0; i < N_STATE; i++) tmp[i] = y0[i] + 0.5 * h * k1[i];
    const k2 = this.deriv(tmp, this.en, this.ea, this.enRv ?? this.en).d;
    for (let i = 0; i < N_STATE; i++) tmp[i] = y0[i] + 0.5 * h * k2[i];
    const k3 = this.deriv(tmp, this.en, this.ea, this.enRv ?? this.en).d;
    for (let i = 0; i < N_STATE; i++) tmp[i] = y0[i] + h * k3[i];
    const k4 = this.deriv(tmp, this.en, this.ea, this.enRv ?? this.en).d;
    for (let i = 0; i < N_STATE; i++) {
      y0[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }

    // Floors: a chamber may empty but not invert.
    /* Backstops only. With pressures free to go negative these should never
       fire; if one does, blood is being created and conservation is broken. */
    for (let i = 0; i < 8; i++) if (y0[i] < 1) y0[i] = 1;

    /* The derivatives sum to zero analytically, so any drift in the total is
       integrator residue (or a backstop firing). Project it back out through
       the systemic veins, which are the compliant buffer the body itself uses
       and the only compartment large enough for the correction to be invisible.
       Without this the loop slowly gains or loses blood, and a model whose
       whole point is conservation must actually conserve. */
    let tot = 0;
    for (let i = 0; i < 8; i++) tot += y0[i];
    const err = tot - this.bloodVolume;
    if (Math.abs(err) > 1e-9) y0[S_VSV] -= err;
    y0[S_SS] = Math.max(0, Math.min(1, y0[S_SS]));
    y0[S_SP] = Math.max(0, Math.min(1, y0[S_SP]));
    this.sigmaS = y0[S_SS]; this.sigmaP = y0[S_SP];
    this.t += h;

    const f = this.deriv(y0, this.en, this.ea, this.enRv ?? this.en);
    this.prevMitral = this.mitralOpen; this.prevAortic = this.aorticOpen;
    this.prevTricuspid = this.tricuspidOpen; this.prevPulmonic = this.pulmonicOpen;
    this.mitralOpen = f.mitral; this.aorticOpen = f.aortic;
    this.tricuspidOpen = f.tricuspid; this.pulmonicOpen = f.pulmonic;
    this.E = f.E; this.Ela = f.Ela;
    this.Pv = f.Plv; this.Pla = f.Pla; this.Prv = f.Prv; this.Pra = f.Pra;
    this.Part = f.Psa; this.Psv = f.Psv; this.Ppa = f.Ppa; this.Ppv = f.Ppv;
    this.V = y0[S_VLV]; this.Vla = y0[S_VLA]; this.Vrv = y0[S_VRV]; this.Vra = y0[S_VRA];
    this.Qfill = f.Qmit; this.Qeject = f.Qao; this.Qout = f.Qsys; this.Qpv = f.Qpvret;
    this.Qtri = f.Qtri; this.Qpulv = f.Qpv2; this.Qven = f.Qven; this.Qpulcap = f.Qpulcap;
    this.dPdt = (f.Qao - f.Qsys) / this.Csa;
    this.firingRate = this.baroFiring(this.Part);

    this.recordBeat();
    this.beatPplSum = (this.beatPplSum || 0) + (this.dPpl || 0); this.beatPplN = (this.beatPplN || 0) + 1;
    this.prevEn = this.en;
  }

  /* -------- beat recorder: one complete cardiac cycle, QRS to QRS ---------- */
  recordBeat() {
    const tms = this.t * 1000;
    const idx = this.beat.length;

    if (this.prevMitral && !this.mitralOpen) { this.events.mvc = idx; this.lastMitralClosureMs = tms; }
    if (this.prevTricuspid && !this.tricuspidOpen) this.lastTricuspidClosureMs = tms;
    if (this.events.s1 == null && this.en > 0.03) this.events.s1 = idx;
    if (!this.prevAortic && this.aorticOpen) this.events.avo = idx;
    if (this.prevAortic && !this.aorticOpen) this.events.avc = idx;
    /* the mitral valve opens once per beat, after the aortic valve has closed; if filling pauses in diastasis and the valve
       flickers shut and open again, that is not its opening (which the opening snap and the E wave are timed from) */
    if (!this.prevMitral && this.mitralOpen && this.events.mvo == null && this.events.avc != null) this.events.mvo = idx;
    /* The right heart's valves, for the second heart sound's two components and the first's tricuspid one. */
    /* (the first closure of the beat: a valve that flickers shut again at end-diastole is not the first heart sound) */
    if (this.prevTricuspid && !this.tricuspidOpen && this.events.tvc == null) this.events.tvc = idx;
    if (this.prevTricuspid && !this.tricuspidOpen) this.events.tvcLast = idx;
    if (!this.prevPulmonic && this.pulmonicOpen && this.events.pvo == null) this.events.pvo = idx;
    if (this.prevPulmonic && !this.pulmonicOpen && this.events.pvc == null) { this.events.pvc = idx; this.breathAtP2 = this.breathPhase(); }
    if (!this.prevTricuspid && this.tricuspidOpen && this.events.tvo == null) this.events.tvo = idx;
    if (this.prevMitral && !this.mitralOpen && this.events.m1 == null) this.events.m1 = idx;

    if (tms - this.lastSample >= 2 || this.lastSample < 0) {
      this.lastSample = tms;
      this.beat.push({
        t: tms - this.beatStartT,
        Pv: this.Pv, Pa: this.Part, Pla: this.Pla,
        V: this.V, Vla: this.Vla,
        Qao: this.Qeject, Qmit: this.Qfill, Qsys: this.Qout,
        Ppa: this.Ppa, Pra: this.Pra, Prv: this.Prv,
        ecg: this.ecgValue, en: this.en, E: this.E,
        /* for the auscultation station's Wiggers diagram: atrial activation, the right heart's valve flows and volume */
        ea: this.ea, enRv: this.enRv, Qpv: this.Qpulv, Qtri: this.Qtri, Vrv: this.Vrv,
      });
    }

    // A new ventricular activation (the QRS) closes the beat.
    if (this.beatTrigger && this.beat.length > 40) {
      this.beatTrigger = false;
      this.finaliseBeat();
    } else if (this.beat.length > 4000) {
      // Safety valve for asystolic / chaotic rhythms.
      this.beatTrigger = false;
      this.finaliseBeat();
    }
    this.beatTrigger = false;
  }

  finaliseBeat() {
    const b = this.beat;
    let Psys = -Infinity, Pdia = Infinity, Pmean = 0;
    let EDV = -Infinity, ESV = Infinity;
    let PlaMax = -Infinity, PlaMin = Infinity;
    let peakQao = 0, dPdtMax = 0;
    let PvPeak = -Infinity, PpaMax = -Infinity, PpaMin = Infinity, PpaMean = 0;
    let PraMean = 0, PraMax = -Infinity;
    for (let i = 0; i < b.length; i++) {
      const s = b[i];
      if (s.Pa > Psys) Psys = s.Pa;
      if (s.Pa < Pdia) Pdia = s.Pa;
      Pmean += s.Pa;
      if (s.V > EDV) EDV = s.V;
      if (s.V < ESV) ESV = s.V;
      if (s.Pla > PlaMax) PlaMax = s.Pla;
      if (s.Pla < PlaMin) PlaMin = s.Pla;
      if (s.Qao > peakQao) peakQao = s.Qao;
      if (s.Pv > PvPeak) PvPeak = s.Pv;
      if (s.Ppa != null) {
        if (s.Ppa > PpaMax) PpaMax = s.Ppa;
        if (s.Ppa < PpaMin) PpaMin = s.Ppa;
        PpaMean += s.Ppa;
      }
      if (s.Pra != null) {
        PraMean += s.Pra;
        if (s.Pra > PraMax) PraMax = s.Pra;
      }
      if (i > 0) {
        const d = (b[i].Pv - b[i - 1].Pv) / ((b[i].t - b[i - 1].t) / 1000 || 1);
        if (d > dPdtMax) dPdtMax = d;
      }
    }
    Pmean /= Math.max(1, b.length);
    PpaMean /= Math.max(1, b.length);
    PraMean /= Math.max(1, b.length);

    // Stroke work = area of the pressure–volume loop (shoelace).
    let area = 0;
    for (let i = 0; i < b.length; i++) {
      const a = b[i], c = b[(i + 1) % b.length];
      area += a.V * c.Pv - c.V * a.Pv;
    }
    const strokeWork = Math.abs(area / 2) * 0.0001333; // mmHg·mL -> J

    /* Total stroke volume is what the ventricle shifts; forward stroke volume
       is what reaches the body. With a competent valve they are the same. With
       regurgitation they are not, and reporting the first as cardiac output is
       how a failing heart comes to look hyperdynamic. */
    const SVtotal = EDV - ESV;
    const dur = b.length > 1 ? b[b.length - 1].t : 833;
    const HRbeat = 60000 / Math.max(1, dur);
    let netAortic = 0;
    for (let i = 1; i < b.length; i++) {
      const h = (b[i].t - b[i - 1].t) / 1000;
      netAortic += 0.5 * (b[i].Qao + b[i - 1].Qao) * h;
    }
    const SV = Math.max(0, netAortic);
    const regurgFraction = SVtotal > 1 ? Math.max(0, (SVtotal - SV) / SVtotal) : 0;
    const CO = SV * HRbeat / 1000;
    const Pes = this.events.avc != null && b[this.events.avc] ? b[this.events.avc].Pv : Psys;

    this.metrics = {
      Psys, Pdia, Pmean, PP: Psys - Pdia,
      EDV, ESV, SV, SVtotal, regurgFraction,
      EF: EDV > 0 ? (SVtotal / EDV) * 100 : 0,
      CO, SVR: CO > 0 ? (Pmean / CO) * 80 : 0,
      strokeWork, peakQao, dPdtMax,
      PlaMax, PlaMin, PlaMean: (PlaMax + PlaMin) / 2,
      Ea: SV > 0 ? Pes / SV : 0, Ees: this.Emax, Pes,
      /* Peak ventricular pressure during ejection. The gradient across a
         stenotic aortic valve is this minus the peak aortic pressure, and it
         cannot be read off the pressure at valve closure — by then the
         ventricle is already relaxing and the gradient has gone. */
      PvPeak,
      PpaSys: PpaMax, PpaDia: PpaMin, PpaMean,
      CVPmean: PraMean, CVPmax: PraMax,
      aorticGradient: Math.max(0, PvPeak - Psys),
      cycleMs: dur, HRbeat,
    };

    this.lastBeat = { samples: b, events: { ...this.events }, dur };
    /* What a clinician measures is not one beat: with the respiratory pump, beats differ through each breath. The
       examination reads these, each beat's values averaged over about one breath (4 s). */
    const w = 1 - Math.exp(-dur / 4000);
    const avg = this.metricsBreath ?? { ...this.metrics };
    for (const k in this.metrics) { const x = this.metrics[k]; if (typeof x === 'number' && Number.isFinite(x)) avg[k] = typeof avg[k] === 'number' && Number.isFinite(avg[k]) ? avg[k] + (x - avg[k]) * w : x; }
    this.metricsBreath = avg;
    /* the closures last seen before this beat began: a beat whose window holds no closure took its S1 from there */
    this.valveTimes = this.timesOf(b, this.events, dur, { m: this.closureBeforeBeat?.m ?? null, t: this.closureBeforeBeat?.t ?? null });
    this.closureBeforeBeat = { m: this.lastMitralClosureMs != null ? this.lastMitralClosureMs - this.t * 1000 : null, t: this.lastTricuspidClosureMs != null ? this.lastTricuspidClosureMs - this.t * 1000 : null };
    /* The recent beats, each with the pleural pressure it was made at: inspiration's beats and expiration's differ. */
    const n = Math.max(1, this.beatPplN || 0);
    /* A beat's window runs from its QRS to the next: its own ejection, then the diastole that fills the next beat. So
       the pleural pressure a beat was filled under is the previous window's (fillPpl); that is the breathing phase
       its ejection, and its P2, belong to. */
    const dPplBeat = (this.beatPplSum || 0) / n;
    /* t0: when the beat began (ms on the circulation's clock); breath: where in the breath its P2 fell. */
    (this.beatLog ??= []).push({ ...this.valveTimes, Psys, dPpl: dPplBeat, fillPpl: this.lastBeatPpl ?? dPplBeat, t0: this.beatStartT, breath: this.breathAtP2 ?? null,
      edvLv: this.beatEdvPrev?.lv ?? null, edvRv: this.beatEdvPrev?.rv ?? null, breathEd: this.beatEdvPrev?.breath ?? null });
    this.breathAtP2 = null;
    this.lastBeatPpl = dPplBeat;
    if (this.beatLog.length > 40) this.beatLog.shift();
    this.beatPplSum = 0; this.beatPplN = 0;
    this.beat = [];
    this.events = { mvc: null, avo: null, avc: null, mvo: null, s1: null, tvc: null, tvcLast: null, pvo: null, pvc: null, tvo: null, m1: null };
    this.beatStartT = this.t * 1000;
    if (this.baroEnabled) this.HReff = this.modulatedHR();
  }

  /* When each valve closed and opened in the beat just recorded, and when the ventricles filled fastest, in ms from the
     start of the beat (ventricular activation). These are the times the heart sounds happen at: S1 is mitral and
     tricuspid closure, S2 aortic (A2) and pulmonary (P2) closure; an opening snap is mitral opening; S3 falls at the end
     of rapid filling, S4 with the atrial kick. */
  timesOf(b, ev, dur, before: { m: number | null; t: number | null } = { m: null, t: null }) {
    /* An event's index is the sample about to be recorded; one in the last step of a beat, before that sample was pushed,
       falls at the end of the beat. */
    const at = (i) => (i == null ? null : b[i] ? b[i].t : b.length ? b[b.length - 1].t : null);
    const mvo = ev.mvo;
    let eIdx = null, ePeak = 0;
    if (mvo != null) for (let i = mvo; i < b.length && b[i].t < b[mvo].t + 250; i++) if (b[i].Qmit > ePeak) { ePeak = b[i].Qmit; eIdx = i; }
    let rapidEnd = null;
    if (eIdx != null) for (let i = eIdx; i < b.length; i++) if (b[i].Qmit < 0.4 * ePeak) { rapidEnd = b[i].t; break; }
    /* The atrial kick: the filling peak in the last 200 ms before the next activation, after rapid filling has ended. */
    let aIdx = null, aPeak = 0;
    for (let i = 0; i < b.length; i++) if (b[i].t >= Math.max(dur - 200, rapidEnd ?? 0) && b[i].Qmit > aPeak) { aPeak = b[i].Qmit; aIdx = i; }
    /* The end of the right ventricle's active systole, as Curtiss timed it (the "O" of Q–O): the onset of the rapid
       fall of its pressure, here where it has fallen a fifth of the way from its peak to its diastolic minimum. */
    const s1Closure = (first, last) => (first != null && b[first] && (ev.avo == null || first < ev.avo) ? first : last ?? first);
    let ip = 0, lo = Infinity, rvRelax = null;
    for (let i = 0; i < b.length; i++) if (b[i].Prv > b[ip].Prv) ip = i;
    for (let i = ip; i < b.length; i++) lo = Math.min(lo, b[i].Prv);
    const th = b.length ? b[ip].Prv - 0.2 * (b[ip].Prv - lo) : 0;
    for (let i = ip + 1; i < b.length; i++) if (b[i].Prv <= th) { const f = (b[i - 1].Prv - th) / Math.max(1e-9, b[i - 1].Prv - b[i].Prv); rvRelax = b[i - 1].t + f * (b[i].t - b[i - 1].t); break; }
    return {
      /* S1 is the closure that belongs to this beat's contraction: one after its activation, before ejection begins, or else the
         closure that ends this window's diastole (standing in for the one just before this beat, which beats repeat). Not a
         flicker shut while filling pauses in diastasis. */
      cycle: dur, m1: at(s1Closure(ev.m1, ev.mvc)) ?? (before.m != null && before.m > -300 ? before.m : null), rvRelax, t1: at(s1Closure(ev.tvc, ev.tvcLast ?? null)) ?? (before.t != null && before.t > -300 ? before.t : null), avo: at(ev.avo), a2: at(ev.avc), pvo: at(ev.pvo), p2: at(ev.pvc), mvo: at(mvo), tvo: at(ev.tvo),
      ePeak: at(eIdx), rapidEnd, aPeak: at(aIdx), eFlow: ePeak, aFlow: aPeak,
    };
  }

  toggleBaro() { this.baroEnabled = !this.baroEnabled; if (!this.baroEnabled) this.HReff = this.openLoopHR(); }

  /* Delegate. The pathology belongs to the ECG model; keeping a second copy
     here meant the message handler set a field nobody read and every pathology
     rendered identically. */
  setPathology(id: string, defaults: Record<string, number | boolean>) {
    const p = getMechanism(id);
    if (!p) return;
    for (const k of Object.keys(this._pathParams || {})) this.setParam(k, defaults[k] as number);
    this._pathParams = p.params || {};
    for (const [k, v] of Object.entries(this._pathParams)) this.setParam(k, v);
    this.engine?.setPathology(id);
    if (p.hrOverride) this.HR = p.hrOverride;
    if (p.params?.Rpul) this.Rpul = p.params.Rpul;
  }

  advance(n) { for (let i = 0; i < n; i++) this.step(); }

  /**
   * Serializable private model state for checkpoints.
   * Restoring this vector + config restores chamber volumes, phases, and reflex state.
   */
  serializeState() {
    const s = this.s instanceof Float64Array ? Array.from(this.s) : [...(this.s || [])];
    return {
      schemaVersion: 'circulation.private.v1',
      t: this.t,
      seq: this.seq,
      s,
      bloodVolume: this.bloodVolume,
      // mechanics / vascular
      Emax: this.Emax, Emin: this.Emin, V0: this.V0,
      edpA: this.edpA, edpB: this.edpB,
      EmaxRv: this.EmaxRv, V0rv: this.V0rv, edpArv: this.edpArv, edpBrv: this.edpBrv,
      ElaMax: this.ElaMax, ElaMin: this.ElaMin, V0la: this.V0la,
      EraMax: this.EraMax, EraMin: this.EraMin, V0ra: this.V0ra,
      Csa: this.Csa, V0sa: this.V0sa, Csv: this.Csv, V0sv: this.V0sv,
      Cpa: this.Cpa, V0pa: this.V0pa, Cpv: this.Cpv, V0pv: this.V0pv,
      Rsys: this.Rsys, Rven: this.Rven, Rpul: this.Rpul, Rpv: this.Rpv,
      Rmitral: this.Rmitral, Raortic: this.Raortic,
      Rtricuspid: this.Rtricuspid, Rpulmonic: this.Rpulmonic,
      regMitral: this.regMitral, regAortic: this.regAortic,
      regTricuspid: this.regTricuspid, regPulmonic: this.regPulmonic,
      TmaxV: this.TmaxV, TmaxA: this.TmaxA,
      actM1: this.actM1, actM2: this.actM2, actT1: this.actT1, actT2: this.actT2,
      actNorm: this.actNorm,
      HR: this.HR, HReff: this.HReff, K: this.K,
      baroEnabled: this.baroEnabled,
      Pn: this.Pn, tauS: this.tauS, tauP: this.tauP, gS: this.gS, gP: this.gP,
      gR: this.gR, gV: this.gV, gE: this.gE, dt: this.dt,
      sigmaS: this.sigmaS, sigmaP: this.sigmaP,
      effRsys: this.effRsys, effV0sv: this.effV0sv, effEmax: this.effEmax,
      // activation clocks
      enRaw: this.enRaw, eaRaw: this.eaRaw,
      mechT: this.mechT, mechTa: this.mechTa, beatTrigger: this.beatTrigger, vtTimer: this.vtTimer,
      // valves / phase
      mitralOpen: this.mitralOpen, aorticOpen: this.aorticOpen,
      tricuspidOpen: this.tricuspidOpen, pulmonicOpen: this.pulmonicOpen,
      prevMitral: this.prevMitral, prevAortic: this.prevAortic,
      en: this.en, ea: this.ea, E: this.E, Ela: this.Ela, prevEn: this.prevEn,
      enRv: this.enRv, stretchLv: this.stretchLv, stretchRv: this.stretchRv, normLv: this.normLv, normRv: this.normRv, edvRefLv: this.edvRefLv, edvRefRv: this.edvRefRv, edvBreathLv: this.edvBreathLv, edvBreathRv: this.edvBreathRv, lastBeatPpl: this.lastBeatPpl,
      beatStartT: this.beatStartT, lastSample: this.lastSample,
      avConduction: this.avConduction, lbbConduction: this.lbbConduction, rbbConduction: this.rbbConduction,
      _pathParams: { ...(this._pathParams || {}) },
      firingRate: this.firingRate,
      metrics: this.metrics ? { ...this.metrics } : null,
      beat: (this.beat ?? []).map((x) => ({ ...x })),
      beatSync: this.beatSync ?? 1, rvIschaemia: this.rvIschaemia ?? 0, chemoDrive: this.chemoDrive ?? 0,
      lastBeat: this.lastBeat ? structuredClone(this.lastBeat) : null,
      events: this.events ? { ...this.events } : null,
      ecg: this.engine?.snapshot?.() ?? null,
      pathologyId: this.engine?.peek?.()?.pathology ?? 'normal',
    };
  }

  restoreState(state) {
    if (!state || state.schemaVersion !== 'circulation.private.v1') {
      throw new Error('unsupported circulation state schema');
    }
    const cfgKeys = [
      'Emax', 'Emin', 'V0', 'edpA', 'edpB', 'EmaxRv', 'V0rv', 'edpArv', 'edpBrv',
      'ElaMax', 'ElaMin', 'V0la', 'EraMax', 'EraMin', 'V0ra',
      'Csa', 'V0sa', 'Csv', 'V0sv', 'Cpa', 'V0pa', 'Cpv', 'V0pv',
      'Rsys', 'Rven', 'Rpul', 'Rpv',
      'Rmitral', 'Raortic', 'Rtricuspid', 'Rpulmonic',
      'regMitral', 'regAortic', 'regTricuspid', 'regPulmonic',
      'TmaxV', 'TmaxA', 'actM1', 'actM2', 'actT1', 'actT2',
      'HR', 'K', 'baroEnabled', 'Pn', 'tauS', 'tauP', 'gS', 'gP', 'gR', 'gV', 'gE', 'dt',
      'bloodVolume',
    ];
    for (const k of cfgKeys) {
      if (state[k] != null) this[k] = state[k];
    }
    this.actNorm = state.actNorm ?? this.actNorm;
    this.s = Float64Array.from(state.s || []);
    this.t = state.t ?? 0;
    this.seq = state.seq ?? 0;
    this.HReff = state.HReff ?? this.HR;
    this.sigmaS = state.sigmaS ?? 0.5;
    this.sigmaP = state.sigmaP ?? 0.5;
    this.effRsys = state.effRsys ?? this.Rsys;
    this.effV0sv = state.effV0sv ?? this.V0sv;
    this.effEmax = state.effEmax ?? this.Emax;
    this.enRaw = state.enRaw ?? 0;
    this.eaRaw = state.eaRaw ?? 0;
    this.mechT = state.mechT ?? -1;
    this.mechTa = state.mechTa ?? -1;
    this.beatTrigger = !!state.beatTrigger;
    this.vtTimer = state.vtTimer ?? 0;
    this.mitralOpen = !!state.mitralOpen;
    this.aorticOpen = !!state.aorticOpen;
    this.tricuspidOpen = !!state.tricuspidOpen;
    this.pulmonicOpen = !!state.pulmonicOpen;
    this.prevMitral = !!state.prevMitral;
    this.prevAortic = !!state.prevAortic;
    this.en = state.en ?? 0;
    this.enRv = state.enRv ?? this.en;
    for (const k of ['stretchLv', 'stretchRv']) this[k] = state[k] ?? 1;
    for (const k of ['normLv', 'normRv', 'edvRefLv', 'edvRefRv', 'edvBreathLv', 'edvBreathRv', 'lastBeatPpl']) this[k] = state[k] ?? null;
    this.ea = state.ea ?? 0;
    this.E = state.E ?? 0;
    this.Ela = state.Ela ?? 0;
    this.prevEn = state.prevEn ?? 0;
    this.beatStartT = state.beatStartT ?? 0;
    this.lastSample = state.lastSample ?? -1;
    this.avConduction = state.avConduction ?? 1;
    this.lbbConduction = state.lbbConduction ?? 1;
    this.rbbConduction = state.rbbConduction ?? 1;
    this._pathParams = { ...(state._pathParams || {}) };
    this.firingRate = state.firingRate ?? 25;
    this.metrics = state.metrics ? { ...state.metrics } : null;
    if (Array.isArray(state.beat)) this.beat = state.beat.map((x) => ({ ...x }));
    this.beatSync = state.beatSync ?? 1; this.rvIschaemia = state.rvIschaemia ?? 0; this.chemoDrive = state.chemoDrive ?? 0;
    this.lastBeat = state.lastBeat ? structuredClone(state.lastBeat) : null;
    this.events = state.events ? { ...state.events } : { mvc: null, avo: null, avc: null, mvo: null, s1: null };
    if (this.engine && state.ecg) {
      try { this.engine.restore(state.ecg); } catch { /* best-effort ECG restore */ }
    }
  }

  snapshot() {
    const m = this.metrics;
    return {
      seq: this.seq++, t: this.t,
      P: this.Part, Pv: this.Pv, Pla: this.Pla, V: this.V, Vla: this.Vla,
      E: this.E, Ela: this.Ela, en: this.en, ea: this.ea,
      Qeject: this.Qeject, Qfill: this.Qfill, Qout: this.Qout, Qpv: this.Qpv,
      dPdt: this.dPdt,
      mitralOpen: this.mitralOpen, aorticOpen: this.aorticOpen,
      Prv: this.Prv, Pra: this.Pra, Ppa: this.Ppa, Ppv: this.Ppv, Psv: this.Psv,
      Vrv: this.Vrv, Vra: this.Vra,
      Qtri: this.Qtri, Qpulv: this.Qpulv, Qven: this.Qven,
      tricuspidOpen: this.tricuspidOpen, pulmonicOpen: this.pulmonicOpen,
      /* Instantaneous values are what the schematic animates; the beat metrics
         are what the monitor and the tests should read. */
      CVP: m ? m.CVPmean : this.Pra,
      PpaSys: m ? m.PpaSys : this.Ppa,
      PpaDia: m ? m.PpaDia : this.Ppa,
      PpaMean: m ? m.PpaMean : this.Ppa,
      aorticGradient: m ? m.aorticGradient : 0,
      Pmsf: this.meanFillingPressure(),
      effRsys: this.effRsys, effV0sv: this.effV0sv, effEmax: this.effEmax,
      bloodVolume: this.bloodVolume, totalVolume: this.totalVolume(),
      Csa: this.Csa, Rsys: this.Rsys, Rpul: this.Rpul, Rven: this.Rven,
      Raortic: this.Raortic, Rmitral: this.Rmitral,
      regAortic: this.regAortic, regMitral: this.regMitral,
      regTricuspid: this.regTricuspid, regPulmonic: this.regPulmonic,
      C: this.Csa, R: this.Rsys, afterload: this.Part,
      Emax: this.Emax, Emin: this.Emin, V0: this.V0, K: this.K,
      edpA: this.edpA, edpB: this.edpB,
      HR: this.engine?.peek().effectiveHR ?? (this.baroEnabled ? this.HReff : this.openLoopHR()),
      HRset: this.HR,
      qrsAxis: this.engine?.peek().qrsAxis ?? 60,
      ecgMetrics: this.engine ? { ...this.engine.peek().metrics } : null,
      avConduction: this.avConduction ?? 1,
      lbbConduction: this.lbbConduction ?? 1,
      rbbConduction: this.rbbConduction ?? 1,
      baroEnabled: this.baroEnabled, firingRate: this.firingRate, chemoDrive: this.chemoDrive || 0, Pperi: this.Pperi || 0, rvIschaemia: this.rvIschaemia || 0,
      sympathetic: this.sigmaS, parasympathetic: this.sigmaP,
      pathology: this.engine?.peek().pathology ?? 'normal',
      ecgValue: this.ecgValue,
      ecgLeads: this.engine?.drain() ?? {},
      beat: this.lastBeat,
      valveTimes: this.valveTimes ?? null,
      metricsBreath: this.metricsBreath ? { ...this.metricsBreath } : null,
      beatLog: this.beatLog ? this.beatLog.map((x) => ({ ...x })) : [],
      dPpl: this.dPpl || 0,
      metrics: m,
      // convenience mirrors so panels can read them without null checks
      Psys: m ? m.Psys : null, Pdia: m ? m.Pdia : null, Pmean: m ? m.Pmean : null,
      SV: m ? m.SV : null, EF: m ? m.EF : null, CO: m ? m.CO : null,
      EDV: m ? m.EDV : null, ESV: m ? m.ESV : null,
    };
  }

  reset(cfg: CirculationConfig) {
    this.configure(cfg);
    this.engine?.reset();
    this.applyCfg(cfg);
  }
}

