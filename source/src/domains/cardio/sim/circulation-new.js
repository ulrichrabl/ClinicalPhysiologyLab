/* ===========================================================================
   Circulation — closed loop, four chambers, two circulations.

   The previous model was a left ventricle ejecting into a Windkessel, with
   `preload` a number you set by hand. That is fine for showing what preload
   does and useless for showing where preload *comes from*.

   This one conserves blood. Eight compartments in a ring:

     LV → aortic valve → systemic arteries → systemic veins → RA
        → tricuspid → RV → pulmonic valve → pulmonary arteries
        → pulmonary veins → LA → mitral → LV

   Nothing is added or removed, so filling pressure is no longer a dial: it is
   what is left over after the heart has moved blood around the loop. Speed the
   heart up and the venous reservoir empties into the arteries until a new
   equilibrium is found. That equilibrium — the intersection of the cardiac
   function curve and the venous return curve — is the thing Guyton spent a
   career on, and it cannot be shown at all in an open-loop model.

   Consequences that now come free:
     · haemorrhage and fluid loading (total volume is a parameter)
     · the whole right heart, and therefore PE and RV infarct
     · ventricular interdependence through the shared circulation
     · a real CVP/JVP
     · valve stenosis and regurgitation on any of the four valves
=========================================================================== */

/* State vector layout. Kept as a flat array because RK4 over ten variables
   written out longhand is where transcription errors live. */
const S_VLV = 0, S_VLA = 1, S_VRV = 2, S_VRA = 3,
      S_VSA = 4, S_VSV = 5, S_VPA = 6, S_VPV = 7,
      S_SS = 8, S_SP = 9, N_STATE = 10;

class Circulation {
  constructor(cfg) { this.configure(cfg); this.fk = new FentonKarma(); this.ecg = new EcgSynth(); this.applyCfg(cfg); }

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
    this.dt = c.dt;
    this.sigmaS = 0.5; this.sigmaP = 0.5;

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
    const stressed = (this.s[S_VSA] - this.V0sa) + (this.s[S_VSV] - this.V0sv)
      + (this.s[S_VPA] - this.V0pa) + (this.s[S_VPV] - this.V0pv);
    return stressed / (this.Csa + this.Csv + this.Cpa + this.Cpv);
  }

  applyCfg(c) {
    this.fk.setK(c.K);
    this.fk.avCond = c.avConduction;
    this.fk.lbbCond = c.lbbConduction;
    this.fk.rbbCond = c.rbbConduction;
  }

  baroFiring(P) { return 2.5 + (47 - 2.5) / (1 + Math.exp(-0.07 * (P - this.Pn))); }

  modulatedHR() {
    const hr = this.HR * (1 + this.gS * this.sigmaS - this.gP * this.sigmaP);
    return Math.max(30, Math.min(200, hr));
  }

  /* Chamber pressure from a time-varying elastance with an exponential passive
     limb — the same form for all four chambers, different constants. */
  chamberP(V, act, Emax, V0, edpA, edpB) {
    const Pes = Emax * (V - V0);
    const Ped = edpA * (Math.exp(edpB * (V - V0)) - 1);
    return Math.max(0, act * Pes + (1 - act) * Ped);
  }

  pEnd(V) { return this.Emax * (V - this.V0); }
  pPassive(V) { return this.edpA * (Math.exp(this.edpB * (V - this.V0)) - 1); }

  /* One valve. Forward flow down the gradient through the orifice; backward
     flow through the regurgitant orifice if there is one. Expressing both in
     one continuous function removes the open/closed state machine, which used
     to need hysteresis to stay stable. */
  valveFlow(Pup, Pdown, Rfwd, regurg) {
    const dP = Pup - Pdown;
    if (dP >= 0) return dP / Rfwd;
    if (regurg <= 1e-4) return 0;
    /* A regurgitant orifice is a fraction of the forward one; the resistance
       scales as the inverse square of effective area. */
    const Rreg = Rfwd / (regurg * regurg * 45);
    return dP / Rreg;
  }

  deriv(y, av, aa) {
    const Vlv = y[S_VLV], Vla = y[S_VLA], Vrv = y[S_VRV], Vra = y[S_VRA];
    const Vsa = y[S_VSA], Vsv = y[S_VSV], Vpa = y[S_VPA], Vpv = y[S_VPV];

    // --- chamber pressures -------------------------------------------------
    const Plv = this.chamberP(Vlv, av, this.Emax, this.V0, this.edpA, this.edpB);
    const Prv = this.chamberP(Vrv, av, this.EmaxRv, this.V0rv, this.edpArv, this.edpBrv);
    const Ela = this.ElaMin + (this.ElaMax - this.ElaMin) * aa;
    const Era = this.EraMin + (this.EraMax - this.EraMin) * aa;
    const Pla = Math.max(0, Ela * (Vla - this.V0la));
    const Pra = Math.max(0, Era * (Vra - this.V0ra));

    // --- vascular pressures ------------------------------------------------
    const Psa = Math.max(0, (Vsa - this.V0sa) / this.Csa);
    const Psv = Math.max(0, (Vsv - this.V0sv) / this.Csv);
    const Ppa = Math.max(0, (Vpa - this.V0pa) / this.Cpa);
    const Ppv = Math.max(0, (Vpv - this.V0pv) / this.Cpv);

    // --- valves ------------------------------------------------------------
    const Qao  = this.valveFlow(Plv, Psa, this.Raortic, this.regAortic);
    const Qmit = this.valveFlow(Pla, Plv, this.Rmitral, this.regMitral);
    const Qpv2 = this.valveFlow(Prv, Ppa, this.Rpulmonic, this.regPulmonic);
    const Qtri = this.valveFlow(Pra, Prv, this.Rtricuspid, this.regTricuspid);

    // --- vascular flows ----------------------------------------------------
    const Qsys = (Psa - Psv) / this.Rsys;          // through the arterioles
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
      E: Vlv > this.V0 ? Plv / (Vlv - this.V0) : this.Emax * av,
      Qao, Qmit, Qpv2, Qtri, Qsys, Qven, Qpulcap, Qpvret,
      mitral: Qmit > 0, aortic: Qao > 0, tricuspid: Qtri > 0, pulmonic: Qpv2 > 0,
    };
  }

  step() {
    const ms = this.dt * 1000;
    const path = this.ecg.path;
    const rhythm = path.rhythm || 'sinus';
    const targetHR = path.hrOverride || (this.baroEnabled ? this.HReff : this.HR);
    this.fk.saRateMultiplier = targetHR / 72;
    this.fk.advance(ms);

    const rawV = this.fk.ventricularActivation();
    if (rhythm === 'vt') {
      this.vtTimer += this.dt;
      if (this.vtTimer >= 60 / (path.hrOverride || 150)) {
        this.vtTimer = 0; this.mechT = 0; this.beatTrigger = true;
      }
    } else if (rawV > 0.3 && this.enRaw <= 0.3) {
      this.mechT = 0; this.beatTrigger = true;
    }
    this.enRaw = rawV;
    this.en = this.activation(this.mechT, this.TmaxV);
    if (this.mechT >= 0) this.mechT += this.dt;

    const rawA = this.fk.atrialActivation();
    if (rawA > 0.3 && this.eaRaw <= 0.3) this.mechTa = 0;
    this.eaRaw = rawA;
    this.ea = this.activation(this.mechTa * (0.8 / this.TmaxA) * 0.28, 0.8);
    if (rhythm === 'af' || rhythm === 'aflutter' || rhythm === 'vt') this.ea *= 0.06;
    if (rhythm === 'vf') this.en = 0.04 + 0.03 * Math.sin(this.t * 41);
    if (this.mechTa >= 0) this.mechTa += this.dt;

    const rr = 60 / Math.max(30, this.baroEnabled ? this.HReff : this.HR);
    this.TmaxV = Math.max(0.45, Math.min(1.4, rr));

    const hr = this.baroEnabled ? this.HReff : this.HR;
    this.ecg.update(this.dt, this.en, hr, this.K, this.fk.avCond, this.fk.lbbCond, this.fk.rbbCond);
    this.ecgValue = this.ecg.value;

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
    y0[S_VLV] = Math.max(this.V0 * 0.35, y0[S_VLV]);
    y0[S_VRV] = Math.max(this.V0rv * 0.35, y0[S_VRV]);
    y0[S_VLA] = Math.max(this.V0la * 0.35, y0[S_VLA]);
    y0[S_VRA] = Math.max(this.V0ra * 0.35, y0[S_VRA]);
    for (let i = 4; i < 8; i++) y0[i] = Math.max(1, y0[i]);
    y0[S_SS] = Math.max(0, Math.min(1, y0[S_SS]));
    y0[S_SP] = Math.max(0, Math.min(1, y0[S_SP]));
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
}
