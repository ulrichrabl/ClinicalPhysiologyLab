/* Closed-loop circulation — RK4 hemodynamics. ECG via EcgEngine. */
// @ts-nocheck
const REG_BASE_LEFT = 0.5;
const REG_BASE_RIGHT = 0.09;

const S_VLV = 0, S_VLA = 1, S_VRV = 2, S_VRA = 3,
      S_VSA = 4, S_VSV = 5, S_VPA = 6, S_VPV = 7,
      S_SS = 8, S_SP = 9, N_STATE = 10;

import type { EcgEngine } from '../ecg-engine/engine.ts';
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
    this.EmaxRv = c.EmaxRv; this.V0rv = c.V0rv;
    this.edpArv = c.edpArv; this.edpBrv = c.edpBrv;
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
    this.sigmaS = 0.5; this.sigmaP = 0.5;
    this.effRsys = c.Rsys; this.effV0sv = c.V0sv; this.effEmax = c.Emax;

    /* Total blood volume. Scaling this is haemorrhage or transfusion, and it
       is the one control that makes the closed loop worth having. */
    this.bloodVolume = c.bloodVolume;
    this.distributeVolume(c);

    this.t = 0; this.seq = 0;
    this.mitralOpen = false; this.aorticOpen = false;
    this.tricuspidOpen = false; this.pulmonicOpen = false;
    this.en = 0; this.ea = 0; this.E = 0; this.Ela = 0;
    this.Pv = 0; this.Pla = 0; this.Prv = 0; this.Pra = 0; this.Ppa = 0; this.Ppv = 0; this.Psv = 0;
    this.Qfill = 0; this.Qeject = 0; this.Qout = 0; this.Qpv = 0;
    this.Qtri = 0; this.Qpulv = 0; this.Qven = 0; this.Qpulcap = 0;
    this.dPdt = 0; this.ecgValue = 0; this.firingRate = 25;

    this.prevEn = 0;
    this.beat = []; this.lastBeat = null; this.lastSample = -1;
    this.metrics = null;
    this.events = { mvc: null, avo: null, avc: null, mvo: null, s1: null };
    this.prevMitral = false; this.prevAortic = false;
    this.beatStartT = 0;
  }

  /* Lay the blood out in roughly physiological proportions, then let the model
     settle. Two thirds of it sits in the systemic veins, which is why they are
     the reservoir the rest of the circulation draws on. */
  distributeVolume(c) {
    const V = this.bloodVolume;
    const frac = {
      lv: 0.026, la: 0.012, rv: 0.028, ra: 0.012,
      sa: 0.155, sv: 0.640, pa: 0.041, pv: 0.086,
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

  baroFiring(P) { return 2.5 + (47 - 2.5) / (1 + Math.exp(-0.07 * (P - this.Pn))); }

  modulatedHR() {
    const hr = this.HR * (1 + this.gS * this.sigmaS - this.gP * this.sigmaP);
    return Math.max(30, Math.min(200, hr));
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
  chamberP(V, act, Emax, V0, edpA, edpB) {
    const Pes = Emax * (V - V0);
    const Ped = edpA * (Math.exp(edpB * (V - V0)) - 1);
    return act * Pes + (1 - act) * Ped;
  }

  pEnd(V) { return this.Emax * (V - this.V0); }
  pPassive(V) { return this.edpA * (Math.exp(this.edpB * (V - this.V0)) - 1); }

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
  activation(t, T) {
    if (t < 0) return 0;
    const t1 = this.actT1 * T, t2 = this.actT2 * T;
    const g1 = Math.pow(t / t1, this.actM1);
    const g2 = Math.pow(t / t2, this.actM2);
    const e = (g1 / (1 + g1)) * (1 / (1 + g2));
    return Math.min(1, e / this.actNorm);
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

  deriv(y, av, aa) {
    const Vlv = y[S_VLV], Vla = y[S_VLA], Vrv = y[S_VRV], Vra = y[S_VRA];
    const Vsa = y[S_VSA], Vsv = y[S_VSV], Vpa = y[S_VPA], Vpv = y[S_VPV];

    // --- chamber pressures -------------------------------------------------
    const Plv = this.chamberP(Vlv, av, this.effEmax, this.V0, this.edpA, this.edpB);
    const Prv = this.chamberP(Vrv, av, this.EmaxRv, this.V0rv, this.edpArv, this.edpBrv);
    const Ela = this.ElaMin + (this.ElaMax - this.ElaMin) * aa;
    const Era = this.EraMin + (this.EraMax - this.EraMin) * aa;
    const Pla = Ela * (Vla - this.V0la);
    const Pra = Era * (Vra - this.V0ra);

    // --- vascular pressures ------------------------------------------------
    /* Vascular pressures are allowed below zero. A vein whose volume has fallen
       below its unstressed volume is collapsing, not holding at exactly zero,
       and clamping it there breaks the model in exactly the case that matters:
       severe haemorrhage, where the clamp cuts venous return to nothing and the
       whole circulation stops rather than settling into shock. */
    const Psa = (Vsa - this.V0sa) / this.Csa;
    const Psv = (Vsv - this.effV0sv) / this.Csv;
    const Ppa = (Vpa - this.V0pa) / this.Cpa;
    const Ppv = (Vpv - this.V0pv) / this.Cpv;

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
    const norm = Math.max(0, Math.min(1, (firing - 2.5) / 44.5));

    const d = new Float64Array(N_STATE);
    d[S_VLV] = Qmit - Qao;
    d[S_VLA] = Qpvret - Qmit;
    d[S_VRV] = Qtri - Qpv2;
    d[S_VRA] = Qven - Qtri;
    d[S_VSA] = Qao - Qsys;
    d[S_VSV] = Qsys - Qven;
    d[S_VPA] = Qpv2 - Qpulcap;
    d[S_VPV] = Qpulcap - Qpvret;
    d[S_SS] = (1 - norm - y[S_SS]) / this.tauS;
    d[S_SP] = (norm - y[S_SP]) / this.tauP;

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
        if (this.mechT < 0) { this.mechT = 0; this.beatTrigger = true; }
      }
      if (tr.chamber === 'RA' || tr.chamber === 'LA') {
        atrialActivation = Math.max(atrialActivation, tr.activationFraction);
        if (this.mechTa < 0) this.mechTa = 0;
      }
    }

    const rhythm = this.engine?.getState().activeMechanisms.find(() => false) ? 'sinus' : 'sinus';
    void rhythm;
    if (ventActivation > 0.1 && this.enRaw <= 0.1) {
      this.mechT = 0; this.beatTrigger = true;
    }
    this.enRaw = ventActivation;
    this.en = this.activation(this.mechT, this.TmaxV);
    if (this.mechT >= 0) this.mechT += this.dt;

    if (atrialActivation > 0.1 && this.eaRaw <= 0.1) this.mechTa = 0;
    this.eaRaw = atrialActivation;
    this.ea = this.activation(this.mechTa >= 0 ? this.mechTa * (0.8 / this.TmaxA) * 0.28 : -1, 0.8);
    if (this.mechTa >= 0) this.mechTa += this.dt;

    const rr = 60 / Math.max(30, this.baroEnabled ? this.HReff : this.HR);
    this.TmaxV = Math.max(0.45, Math.min(1.4, rr));

    const out = this.engine?.getOutput();
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
    const k1 = this.deriv(y0, this.en, this.ea).d;
    for (let i = 0; i < N_STATE; i++) tmp[i] = y0[i] + 0.5 * h * k1[i];
    const k2 = this.deriv(tmp, this.en, this.ea).d;
    for (let i = 0; i < N_STATE; i++) tmp[i] = y0[i] + 0.5 * h * k2[i];
    const k3 = this.deriv(tmp, this.en, this.ea).d;
    for (let i = 0; i < N_STATE; i++) tmp[i] = y0[i] + h * k3[i];
    const k4 = this.deriv(tmp, this.en, this.ea).d;
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

    const f = this.deriv(y0, this.en, this.ea);
    this.prevMitral = this.mitralOpen; this.prevAortic = this.aorticOpen;
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
    this.prevEn = this.en;
  }

  /* -------- beat recorder: one complete cardiac cycle, QRS to QRS ---------- */
  recordBeat() {
    const tms = this.t * 1000;
    const idx = this.beat.length;

    if (this.prevMitral && !this.mitralOpen) this.events.mvc = idx;
    if (this.events.s1 == null && this.en > 0.03) this.events.s1 = idx;
    if (!this.prevAortic && this.aorticOpen) this.events.avo = idx;
    if (this.prevAortic && !this.aorticOpen) this.events.avc = idx;
    if (!this.prevMitral && this.mitralOpen) this.events.mvo = idx;

    if (tms - this.lastSample >= 2 || this.lastSample < 0) {
      this.lastSample = tms;
      this.beat.push({
        t: tms - this.beatStartT,
        Pv: this.Pv, Pa: this.Part, Pla: this.Pla,
        V: this.V, Vla: this.Vla,
        Qao: this.Qeject, Qmit: this.Qfill, Qsys: this.Qout,
        Ppa: this.Ppa, Pra: this.Pra, Prv: this.Prv,
        ecg: this.ecgValue, en: this.en, E: this.E,
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
    this.beat = [];
    this.events = { mvc: null, avo: null, avc: null, mvo: null, s1: null };
    this.beatStartT = this.t * 1000;
    if (this.baroEnabled) this.HReff = this.modulatedHR();
  }

  toggleBaro() { this.baroEnabled = !this.baroEnabled; if (!this.baroEnabled) this.HReff = this.HR; }

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
      beatStartT: this.beatStartT, lastSample: this.lastSample,
      avConduction: this.avConduction, lbbConduction: this.lbbConduction, rbbConduction: this.rbbConduction,
      _pathParams: { ...(this._pathParams || {}) },
      firingRate: this.firingRate,
      metrics: this.metrics ? { ...this.metrics } : null,
      lastBeat: this.lastBeat ? structuredClone(this.lastBeat) : null,
      events: this.events ? { ...this.events } : null,
      ecg: this.engine?.snapshot?.() ?? null,
      pathologyId: this.engine?.getOutput?.()?.pathology ?? 'normal',
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
      bloodVolume: this.bloodVolume, totalVolume: this.totalVolume(),
      Csa: this.Csa, Rsys: this.Rsys, Rpul: this.Rpul, Rven: this.Rven,
      Raortic: this.Raortic, Rmitral: this.Rmitral,
      regAortic: this.regAortic, regMitral: this.regMitral,
      regTricuspid: this.regTricuspid, regPulmonic: this.regPulmonic,
      C: this.Csa, R: this.Rsys, afterload: this.Part,
      Emax: this.Emax, Emin: this.Emin, V0: this.V0, K: this.K,
      edpA: this.edpA, edpB: this.edpB,
      HR: this.engine?.getOutput().effectiveHR ?? (this.baroEnabled ? this.HReff : this.HR),
      HRset: this.HR,
      qrsAxis: this.engine?.getOutput().qrsAxis ?? 60,
      avConduction: this.avConduction ?? 1,
      lbbConduction: this.lbbConduction ?? 1,
      rbbConduction: this.rbbConduction ?? 1,
      baroEnabled: this.baroEnabled, firingRate: this.firingRate,
      sympathetic: this.sigmaS, parasympathetic: this.sigmaP,
      pathology: this.engine?.getOutput().pathology ?? 'normal',
      ecgValue: this.ecgValue,
      ecgLeads: this.engine?.drain() ?? {},
      beat: this.lastBeat,
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

