/* ============================================================================
   Cardiac Loop — simulation worker
   ----------------------------------------------------------------------------
   Three coupled models:
     1. FentonKarma  — 3-variable excitable-medium model on a 33-node
                       conduction network (SA -> atria -> AV -> His -> bundles
                       -> Purkinje -> myocardium). Produces activation and a
                       physical cardiac dipole.
     2. EcgSynth     — parametric 12-lead ECG (Gaussian wave components),
                       triggered by the conduction model, shaped by pathology.
     3. Circulation  — time-varying elastance left ventricle + compliant left
                       atrium + 2-element Windkessel arterial tree, closed by
                       a baroreceptor reflex. RK4 integration.

   Everything below is deliberately written for reading, not for size.
   ========================================================================= */

/* ---------------------------------------------------------------- Fenton-Karma
   Cell-type parameter sets. Index into TYPE below.
   0 SA node   1 atrium   2 AV node   3 His   4 LBB   5 RBB
   6 septum/LV 7 LV free  8 apex/RV   9 RV free
*/
const FK_BASE = {
  tau_vp: 3.33, tau_v1m: 19.6, tau_v2m: 1000, tau_wp: 667, tau_wm: 11,
  tau_d: 0.25, tau_0: 8.3, tau_r: 50, tau_si: 45,
  k_si: 10, u_csi: 0.85, u_c: 0.13, u_v: 0.04, auto: 0,
};

function fkParams(type) {
  switch (type) {
    case 0: return { ...FK_BASE, tau_d: 0.4, tau_wm: 30, tau_0: 8000, tau_r: 45, u_c: 0.06, u_v: 0.02, auto: 1.3e-4 };
    case 1: return { ...FK_BASE, tau_wm: 8, tau_d: 0.2, tau_r: 45 };
    case 2: return { ...FK_BASE, tau_d: 1, tau_vp: 50, tau_0: 20, tau_r: 45, auto: 0 };
    case 3: return { ...FK_BASE, tau_d: 0.1, tau_wm: 18, tau_r: 60 };
    case 4:
    case 5: return { ...FK_BASE, tau_d: 0.1, tau_wm: 16, tau_r: 58 };
    case 6: return { ...FK_BASE, tau_r: 100, tau_si: 45, tau_wm: 30, tau_wp: 300, tau_0: 10 };
    case 7: return { ...FK_BASE, tau_r: 100, tau_si: 45, tau_wm: 30, tau_wp: 90, tau_0: 10 };
    case 8: return { ...FK_BASE, tau_r: 100, tau_si: 45, tau_wm: 30, tau_wp: 290, tau_0: 10 };
    case 9: return { ...FK_BASE, tau_r: 100, tau_si: 45, tau_wm: 30, tau_wp: 85, tau_0: 10 };
    default: return FK_BASE;
  }
}

const N_NODES = 33;

// Cell type of each node.
const TYPE = [
  0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 4, 4, 5, 5,
  6, 6, 6, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 8, 9, 9, 9,
];

// Node positions in a torso-centred frame (cm-ish). Used for the dipole.
const POS = [
  [1.4, 3.2, -0.3], [1.0, 3.0, -0.2], [0.6, 2.7, -0.1], [0.1, 2.4, 0], [-0.5, 2.1, 0.1],
  [-1.0, 1.7, 0.1], [0, 1.6, 0], [0, 1.1, 0], [0, 0.6, 0], [0, 0.2, 0],
  [0, -0.2, 0.1], [0.4, -0.7, 0.1], [0.7, -1.2, 0.1], [-0.4, -0.7, 0.2], [-0.7, -1.2, 0.2],
  [0.8, -0.8, 0], [1.3, -1.5, -0.1], [1.9, -2.2, -0.3], [2.4, -2.9, -0.5], [2.8, -3.5, -0.6],
  [3.1, -4.0, -0.6], [3.5, -2.4, -0.8], [3.8, -3.1, -0.9], [3.9, -3.7, -0.9],
  [-0.7, -0.8, 0.5], [-1.1, -1.5, 0.7], [-1.5, -2.2, 0.9], [-1.9, -2.8, 1.0], [-2.2, -3.3, 1.0],
  [-2.3, -3.7, 1.0], [-2.7, -2.4, 1.3], [-2.9, -3.0, 1.3], [-3.0, -3.5, 1.3],
];

// [from, to, coupling]
const EDGES = [
  [0, 1, 0.8], [1, 2, 0.06], [2, 3, 0.055], [3, 4, 0.055], [4, 5, 0.055],
  [5, 6, 0.08], [6, 7, 0.06], [7, 8, 0.06], [8, 9, 0.06],
  [10, 11, 0.2], [10, 13, 0.2], [11, 12, 0.15], [12, 15, 0.08], [13, 14, 0.15], [14, 24, 0.08],
  [15, 16, 0.06], [16, 17, 0.06], [17, 18, 0.06], [18, 19, 0.06], [19, 20, 0.06],
  [17, 21, 0.06], [18, 22, 0.06], [19, 23, 0.06],
  [24, 25, 0.06], [25, 26, 0.06], [26, 27, 0.06], [27, 28, 0.06], [28, 29, 0.06],
  [26, 30, 0.06], [27, 31, 0.06], [28, 32, 0.06],
];

// Electrode positions for the dipole projection.
const E_RA = [-25, 20, 0], E_LA = [25, 20, 0], E_LL = [8, -35, 0];
const E_PRECORDIAL = [
  [-2.5, 0.5, 9], [2.5, 0.5, 9], [4.5, -1, 8.5],
  [6.5, -2, 7], [9, -2, 4.5], [11, -2, 1.5],
];

import { Myocardium, LEADS as MYO_LEADS } from './myocardium.js';

const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

class FentonKarma {
  constructor() {
    this.u = new Float64Array(N_NODES);
    this.v = new Float64Array(N_NODES);
    this.w = new Float64Array(N_NODES);
    for (let i = 0; i < N_NODES; i++) { this.u[i] = 0; this.v[i] = 1; this.w[i] = 1; }

    this.dt = 0.02;              // ms
    this.params = TYPE.map(fkParams);
    this.neighbors = Array.from({ length: N_NODES }, () => []);
    for (const [a, b, D] of EDGES) {
      this.neighbors[a].push({ j: b, D });
      this.neighbors[b].push({ j: a, D });
    }

    this.avCond = 1; this.lbbCond = 1; this.rbbCond = 1;
    this.kRestShift = 0; this.kTauDFactor = 1; this.kTauWmFactor = 1; this.kTauRFactor = 1;

    this.saRateMultiplier = 1;
    this.baseRR = 833;           // ms
    this.saTimer = 0; this.saRefractory = 0;
    this.avTimer = -1; this.avDelay = 140; this.avFired = false;
    this.hisRefractory = 0;
    this.prevSAu = 0; this.cycleStarted = false;
  }

  /* Serum potassium shifts resting potential and channel kinetics. */
  setK(K) {
    const d = (K - 4) / 4;
    const up = Math.max(0, d);
    this.kRestShift = 0.14 * up * up * up;
    /* Excitability falls with the square of the rise, not linearly. A linear
       term made the fast inward current so weak by K+ 5.4 that the ventricle
       simply stopped depolarising — the model went asystolic at a potassium a
       real patient walks around with. Severe hyperkalaemia does eventually do
       that; moderate hyperkalaemia slows conduction and widens the QRS. */
    /* Capped. The excitable-medium model has a sharp cliff: beyond about a
       1.4x rise in tau_d the wavefront fails to propagate at all and the
       ventricle goes silent. That is the right behaviour for a potassium of 9
       and quite wrong for a potassium of 6, so excitability is only allowed to
       fall so far here. QRS widening — the thing that actually changes on the
       trace across this range — is modelled where it belongs, as slowed
       cell-to-cell conduction in the myocardial source model. */
    this.kTauDFactor = 1 + Math.min(0.33, 2.4 * Math.max(0, up - 0.18) ** 2);
    this.kTauWmFactor = Math.max(0.55, 1 - 0.30 * d);
    this.kTauRFactor = Math.max(0.55, 1 - 0.28 * up);
  }

  effectiveD(a, b, D) {
    const ta = TYPE[a], tb = TYPE[b];
    if ((ta === 2 || tb === 2) && !(ta === 2 && tb === 2)) return D * this.avCond;
    if (ta === 2 && tb === 2) return D * Math.max(0.1, this.avCond);
    if (ta === 4 || tb === 4) return D * this.lbbCond;
    if (ta === 5 || tb === 5) return D * this.rbbCond;
    return D;
  }

  step() {
    const { u, v, w, dt, params } = this;
    const du = new Float64Array(N_NODES);

    // Sinoatrial pacemaker
    this.saTimer += dt;
    const interval = this.baseRR / this.saRateMultiplier;
    if (this.saTimer >= interval && this.saRefractory <= 0 && u[0] < 0.15) {
      u[0] = 0.8; u[1] = 0.6;
      this.saTimer = 0; this.saRefractory = 250;
    }
    if (this.saRefractory > 0) this.saRefractory -= dt;

    // Atrioventricular node: delayed relay from low atrium to His
    if (u[3] > 0.4 && !this.avFired && this.avTimer < 0) this.avTimer = 0;
    if (this.avTimer >= 0) {
      const delay = this.avCond > 0.01 ? this.avDelay / Math.pow(this.avCond, 0.5) : 1e9;
      this.avTimer += dt;
      if (this.avTimer >= delay && this.hisRefractory <= 0) {
        u[10] = 0.9; this.avTimer = -1; this.avFired = true; this.hisRefractory = 300;
      }
    }
    if (this.hisRefractory > 0) this.hisRefractory -= dt;
    if (u[3] < 0.1) this.avFired = false;

    for (let i = 0; i < N_NODES; i++) {
      const p = params[i], ui = u[i];
      const tau_d = p.tau_d * this.kTauDFactor;
      const tau_wm = p.tau_wm * this.kTauWmFactor;
      const tau_r = p.tau_r * this.kTauRFactor;

      const U = Math.max(0, ui + this.kRestShift);
      const above = U >= p.u_c ? 1 : 0;
      const below = 1 - above;

      const Jfi = -v[i] * above * (U - p.u_c) * (1 - U) / tau_d;
      const Jso = U * below / p.tau_0 + above / tau_r;
      const Jsi = -w[i] * (1 + Math.tanh(p.k_si * (U - p.u_csi))) / (2 * p.tau_si);

      let diff = 0;
      for (const nb of this.neighbors[i]) diff += this.effectiveD(i, nb.j, nb.D) * (u[nb.j] - ui);
      du[i] = -(Jfi + Jso + Jsi) + diff;

      const fast = U >= p.u_v ? 1 : 0;
      const tau_vm = fast * p.tau_v1m + (1 - fast) * p.tau_v2m;
      v[i] += dt * (below * (1 - v[i]) / tau_vm - above * v[i] / p.tau_vp);
      w[i] += dt * (below * (1 - w[i]) / tau_wm - above * w[i] / p.tau_wp);
      if (v[i] < 0) v[i] = 0; else if (v[i] > 1) v[i] = 1;
      if (w[i] < 0) w[i] = 0; else if (w[i] > 1) w[i] = 1;
    }

    for (let i = 0; i < N_NODES; i++) {
      u[i] += dt * du[i];
      if (u[i] < 0) u[i] = 0; else if (u[i] > 1.1) u[i] = 1.1;
    }

    this.cycleStarted = u[0] > 0.5 && this.prevSAu <= 0.5;
    this.prevSAu = u[0];
  }

  advance(ms) {
    const n = Math.round(ms / this.dt);
    for (let i = 0; i < n; i++) this.step();
  }

  /* Net current dipole from transmembrane gradients along each connection. */
  cardiacDipole() {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < N_NODES; i++) {
      const t = TYPE[i];
      let mass;
      if (t === 0 || t === 2) mass = 0.02;
      else if (t === 3 || t === 4 || t === 5) mass = 0.05;
      else if (t === 1) mass = 0.55;
      else if (t === 8 || t === 9) mass = 0.45;
      else mass = 1;

      for (const nb of this.neighbors[i]) {
        const dU = this.u[nb.j] - this.u[i];
        if (dU === 0) continue;
        const dx = POS[nb.j][0] - POS[i][0];
        const dy = POS[nb.j][1] - POS[i][1];
        const dz = POS[nb.j][2] - POS[i][2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 0.01) continue;
        const s = -mass * dU / len;
        x += s * dx; y += s * dy; z += s * dz;
      }
    }
    return [x, y, z];
  }

  phiAt(r, dip) {
    const r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
    const rm = Math.sqrt(r2);
    return (dip[0] * (r[0] / rm) + dip[1] * (r[1] / rm) + dip[2] * (r[2] / rm)) / r2;
  }

  compute12Lead() {
    const d = this.cardiacDipole();
    const ra = this.phiAt(E_RA, d), la = this.phiAt(E_LA, d), ll = this.phiAt(E_LL, d);
    const wct = (ra + la + ll) / 3;
    const K = 250;
    const v = E_PRECORDIAL.map((p) => (this.phiAt(p, d) - wct) * K);
    return {
      I: (la - ra) * K, II: (ll - ra) * K, III: (ll - la) * K,
      aVR: (ra - (la + ll) / 2) * K, aVL: (la - (ra + ll) / 2) * K, aVF: (ll - (ra + la) / 2) * K,
      V1: v[0], V2: v[1], V3: v[2], V4: v[3], V5: v[4], V6: v[5],
    };
  }

  /* Mean activation of ventricular myocardium — drives mechanical elastance. */
  ventricularActivation() {
    let sum = 0, n = 0;
    for (let i = 0; i < N_NODES; i++) {
      const t = TYPE[i];
      if (t >= 6 && t <= 9) { sum += this.u[i]; n++; }
    }
    return n > 0 ? sum / n : 0;
  }

  /* Mean atrial activation — drives the atrial kick (the a wave). */
  atrialActivation() {
    let sum = 0, n = 0;
    for (let i = 0; i < N_NODES; i++) if (TYPE[i] === 1) { sum += this.u[i]; n++; }
    return n > 0 ? sum / n : 0;
  }

  reset() {
    for (let i = 0; i < N_NODES; i++) { this.u[i] = 0; this.v[i] = 1; this.w[i] = 1; }
    this.prevSAu = 0; this.cycleStarted = false;
    this.saTimer = 0; this.saRefractory = 0;
    this.avTimer = -1; this.avFired = false; this.hisRefractory = 0;
  }
}

/* ------------------------------------------------------------------ ECG synth
   The conduction model gives correct *timing*. This gives correct *morphology*:
   each lead is a sum of Gaussian components (P, Q, R, S, ST, T, U, delta),
   projected onto the lead axis, then modified by the active pathology.
*/
const LIMB_ANGLE = { I: 0, II: 60, III: 120, aVR: -150, aVL: -30, aVF: 90 };
const DEG = Math.PI / 180;

const PRECORDIAL_SHAPE = {
  V1: { p: 0.3, r: 0.2, s: 2.5, t: -0.3 },
  V2: { p: 0.3, r: 0.4, s: 2.0, t: 0.2 },
  V3: { p: 0.4, r: 0.8, s: 1.2, t: 0.6 },
  V4: { p: 0.4, r: 1.2, s: 0.5, t: 0.8 },
  V5: { p: 0.4, r: 1.0, s: 0.2, t: 0.7 },
  V6: { p: 0.4, r: 0.8, s: 0.0, t: 0.6 },
};

function baseWaves(lead, axis) {
  const isLimb = lead in LIMB_ANGLE;
  if (!isLimb) {
    const s = PRECORDIAL_SHAPE[lead] || { p: 0.3, r: 0.5, s: 0.5, t: 0.3 };
    return {
      P: { A: 0.15 * s.p, mu: 0.05, sigma: 0.02 },
      Q: { A: -0.08 * s.r * 0.3, mu: 0.21, sigma: 0.006 },
      R: { A: 1.1 * s.r, mu: 0.23, sigma: 0.01 },
      S: { A: -0.25 * s.s, mu: 0.255, sigma: 0.008 },
      ST: { A: 0, mu: 0.3, sigma: 0.025 },
      T: { A: 0.3 * s.t, mu: 0.4, sigma: 0.038 },
      U: { A: 0.03, mu: 0.5, sigma: 0.02 },
    };
  }
  const ang = LIMB_ANGLE[lead];
  const pProj = Math.cos((axis - 5 - ang) * DEG);
  const qrsProj = Math.cos((axis - ang) * DEG);
  const tProj = Math.cos((axis - 8 - ang) * DEG);
  return {
    P: { A: 0.15 * pProj, mu: 0.05, sigma: 0.02 },
    Q: { A: -0.08 * qrsProj, mu: 0.21, sigma: 0.006 },
    R: { A: 1.1 * qrsProj, mu: 0.23, sigma: 0.01 },
    S: { A: -0.25 * qrsProj, mu: 0.255, sigma: 0.008 },
    ST: { A: 0, mu: 0.3, sigma: 0.025 },
    T: { A: 0.3 * tProj, mu: 0.4, sigma: 0.038 },
    U: { A: 0.03 * tProj, mu: 0.5, sigma: 0.02 },
  };
}

function applyMods(waves, mods) {
  const out = { ...waves };
  for (const k of ['P', 'Q', 'R', 'S', 'ST', 'T', 'U', 'delta']) {
    if (!mods[k]) continue;
    const base = out[k], m = mods[k];
    out[k] = { A: m.A ?? base?.A ?? 0, mu: m.mu ?? base?.mu ?? 0, sigma: m.sigma ?? base?.sigma ?? 0.01 };
  }
  return out;
}

function evalWaves(phase, waves, prStretch, qrsStretch) {
  const list = [waves.P, waves.Q, waves.R, waves.S, waves.ST, waves.T, waves.U];
  if (waves.delta) list.push(waves.delta);
  let y = 0;
  for (const c of list) {
    if (!c || c.A === 0) continue;
    let mu = c.mu, sigma = c.sigma;
    if (mu > 0.15) mu = 0.05 + (mu - 0.05) * prStretch;
    if (mu > 0.19 && mu < 0.27) sigma *= qrsStretch;
    const d = phase - mu;
    y += c.A * Math.exp(-(d * d) / (2 * sigma * sigma));
  }
  return y;
}

const fibBaseline = (t) =>
  0.04 * (Math.sin(t * 8.3) + 0.7 * Math.sin(t * 13.1 + 1) + 0.5 * Math.sin(t * 19.7 + 2) + 0.3 * Math.sin(t * 31.3 + 3));

const flutterWave = (t, rate) => {
  const p = (t * rate / 60) % 1;
  return 0.15 * (p < 0.7 ? -p / 0.7 : (p - 0.7) / 0.3 - 1);
};

const vtComplex = (phase, lead) => {
  const proj = lead in LIMB_ANGLE ? Math.cos((120 - LIMB_ANGLE[lead]) * DEG) : 0.8;
  return 1.5 * proj * Math.exp(-((phase - 0.25) ** 2) / (2 * 0.022 ** 2))
       - 0.8 * proj * Math.exp(-((phase - 0.32) ** 2) / (2 * 0.02 ** 2));
};

const vfChaos = (t) =>
  0.6 * (Math.sin(t * 5.1) + 0.8 * Math.sin(t * 7.3 + 1) + 0.6 * Math.sin(t * 11.7 + 2)
       + 0.4 * Math.sin(t * 17.1 + 3) + 0.3 * Math.sin(t * 23.9 + 4)) * (0.6 + 0.4 * Math.sin(t * 1.3));

/* ------------------------------------------------------------------ pathology */
const PATHOLOGIES = [
  { id: 'normal', name: 'Normal sinus rhythm', category: 'Normal', description: 'Normal 12-lead ECG, ~60° axis, regular rate.', substrate: {} },

  { id: 'stemi_ant', name: 'Anterior STEMI', category: 'Ischemia', description: 'LAD occlusion → ST↑ V1–V4, reciprocal ST↓ II/III/aVF.', substrate: { ischaemia: [{ territory: 'LAD', degree: 1 }] } },

  { id: 'stemi_inf', name: 'Inferior STEMI', category: 'Ischemia', description: 'RCA occlusion → ST↑ II/III/aVF, reciprocal ST↓ I/aVL.', substrate: { ischaemia: [{ territory: 'RCA', degree: 1 }] } },

  { id: 'stemi_lat', name: 'Lateral STEMI', category: 'Ischemia', description: 'LCx occlusion → ST↑ I/aVL/V5–V6, reciprocal ST↓ V1–V3.', substrate: { ischaemia: [{ territory: 'LCx', degree: 1 }] } },

  { id: 'nstemi', name: 'NSTEMI', category: 'Ischemia', description: 'Subendocardial ischemia → ST depression + T inversion. No ST elevation.', substrate: { ischaemia: [{ wall: 'anterior', degree: 0.9, layer: 'endo' }, { wall: 'lateral', degree: 0.9, layer: 'endo' }, { wall: 'inferior', degree: 0.6, layer: 'endo' }, { wall: 'septal', degree: 0.6, layer: 'endo' }] } },

  { id: 'wellens', name: 'Wellens syndrome', category: 'Ischemia', description: 'Critical LAD stenosis: deep symmetric T inversions V2–V3. Pain-free ECG sign.', substrate: { wallApd: { anterior: 140, septal: 95 }, ischaemia: [{ territory: 'LAD', degree: 0.30, layer: 'epi' }] } },

  { id: 'wpw_a', name: 'WPW type A', category: 'Pre-excitation', description: 'Left-sided accessory pathway → short PR, delta wave, wide QRS.', prFactor: 0.75, qrsWidthFactor: 1.4, substrate: { deltaWave: 0.85 } },

  { id: 'brugada1', name: 'Brugada type 1', category: 'Channelopathy', description: 'Coved ST elevation ≥2 mm V1–V2 with T inversion. Risk of VF.', substrate: { ischaemia: [{ segments: ['rv_bas', 'rv_mid'], degree: 0.8, layer: 'epi' }], wallApd: { rv: -75 } } },

  { id: 'lqts', name: 'Long QT syndrome', category: 'Channelopathy', description: 'Prolonged QT with broad notched T waves. Risk of torsades.', qtFactor: 1.35, substrate: { apd: 190 } },

  { id: 'af', name: 'Atrial fibrillation', category: 'Arrhythmia', description: 'No P waves, fibrillatory baseline, irregularly irregular RR.', rhythm: 'af', substrate: { ischaemia: [{ territory: 'LAD', degree: 1 }] } },
  { id: 'aflutter', name: 'Atrial flutter', category: 'Arrhythmia', description: 'Sawtooth flutter waves ~300/min with 2:1–4:1 block.', rhythm: 'aflutter', substrate: { ischaemia: [{ territory: 'RCA', degree: 1 }] } },
  { id: 'wenckebach', params: { avConduction: 0.55 }, name: 'Wenckebach (2° AVB I)', category: 'Arrhythmia', description: 'Progressive PR prolongation then one dropped QRS.', rhythm: 'wenckebach', substrate: { ischaemia: [{ territory: 'LCx', degree: 1 }] } },
  { id: 'mobitz2', params: { avConduction: 0.4 }, name: 'Mobitz II (2° AVB II)', category: 'Arrhythmia', description: 'Constant PR with intermittent dropped QRS. More dangerous.', rhythm: 'mobitz2', substrate: { ischaemia: [{ wall: 'anterior', degree: 0.9, layer: 'endo' }, { wall: 'lateral', degree: 0.9, layer: 'endo' }, { wall: 'inferior', degree: 0.6, layer: 'endo' }, { wall: 'septal', degree: 0.6, layer: 'endo' }] } },
  { id: 'chb', params: { avConduction: 0 }, name: 'Complete heart block', category: 'Arrhythmia', description: 'P waves march independently; escape rhythm drives QRS ~40 bpm.', rhythm: 'chb', hrOverride: 40, substrate: { wallApd: { anterior: 130, septal: 90 }, ischaemia: [{ territory: 'LAD', degree: 0.30, layer: 'epi' }] } },
  { id: 'vt', name: 'Ventricular tachycardia', category: 'Arrhythmia', description: 'Wide QRS tachycardia ~150 bpm, no P waves, regular.', rhythm: 'vt', hrOverride: 150, substrate: { deltaWave: 0.85 } },
  { id: 'vf', name: 'Ventricular fibrillation', category: 'Arrhythmia', description: 'Chaotic, no organised QRS. Immediate defibrillation.', rhythm: 'vf', substrate: { ischaemia: [{ segments: ['rv_bas', 'rv_mid'], degree: 0.75, layer: 'epi' }], wallApd: { rv: -70 } } },

  { id: 'lvh', name: 'LV hypertrophy', category: 'Hypertrophy', description: 'Sokolow–Lyon: S(V1)+R(V5) > 35 mm, with lateral strain.', substrate: { hypertrophy: { lateral: 2.2, anterior: 1.8, inferior: 1.7, septal: 1.6 }, apd: 45, wallApd: { lateral: -60 }, ischaemia: [{ wall: 'lateral', degree: 0.30, layer: 'endo' }] } },

  { id: 'rvh', name: 'RV hypertrophy', category: 'Hypertrophy', description: 'Tall R in V1 (R>S), right axis deviation, ST↓/T↓ V1–V3.', substrate: { hypertrophy: { rv: 4.5 }, wallApd: { rv: -50 } } },

  { id: 'pericarditis', name: 'Acute pericarditis', category: 'Inflammation', description: 'Diffuse concave ST↑, PR depression, ST↓ in aVR. No reciprocals.', substrate: { ischaemia: [{ wall: 'anterior', degree: 0.42, layer: 'epi' }, { wall: 'lateral', degree: 0.42, layer: 'epi' }, { wall: 'inferior', degree: 0.42, layer: 'epi' }, { wall: 'septal', degree: 0.30, layer: 'epi' }] } },

  { id: 'lbbb', params: { lbbConduction: 0.12 }, name: 'Left bundle branch block', category: 'Conduction', description: 'QRS ≥120 ms, broad notched R in I/V5/V6, deep S in V1, discordant ST/T.', qrsWidthFactor: 1.8, substrate: {} },

  { id: 'rbbb', params: { rbbConduction: 0.12 }, name: 'Right bundle branch block', category: 'Conduction', description: "QRS ≥120 ms, rsR' in V1–V2, wide S in I/V5/V6.", qrsWidthFactor: 1.7, substrate: {} },

  { id: 'hyperk_mild', name: 'Hyperkalaemia (mild, K⁺ ~6)', category: 'Electrolyte', description: 'Peaked, narrow, symmetric T waves — earliest sign. Best in V2–V4.', substrate: { rest: 0.05, apd: -30, condScale: 1.15, repolSteep: 17, atrialScale: 0.55 } },

  { id: 'hyperk_mod', name: 'Hyperkalaemia (moderate, K⁺ ~7)', category: 'Electrolyte', description: 'Peaked T, widened QRS, flattened P, prolonged PR.', qrsWidthFactor: 1.5, prFactor: 1.3, substrate: { rest: 0.10, apd: -55, condScale: 1.75, repolSteep: 22, atrialScale: 0.12 } },

  { id: 'hyperk_sev', name: 'Hyperkalaemia (severe, K⁺ 8+)', category: 'Electrolyte', description: 'Sine wave: very wide QRS merging with T, absent P. Peri-arrest.', qrsWidthFactor: 2.5, prFactor: 1.6, substrate: { rest: 0.17, apd: -80, condScale: 2.9, repolSteep: 26, atrialScale: 0 } },

  { id: 'pe', name: 'Pulmonary embolism', category: 'Other', description: 'S1Q3T3 with sinus tachycardia and right heart strain.', hrOverride: 110, substrate: { hypertrophy: { rv: 2.0 }, ischaemia: [{ wall: 'rv', degree: 0.45, layer: 'epi' }], wallApd: { rv: 70, inferior: 45 } } },

  { id: 'early_repol', name: 'Early repolarisation', category: 'Normal variant', description: 'Benign concave ST elevation V2–V5 with J-point notching.', substrate: { jPoint: 1.0, wallApd: { inferior: -35, lateral: -35 } } },

  { id: 'p_mitrale', name: 'Left atrial enlargement', category: 'Chamber', description: 'P mitrale: broad notched P >120 ms in II; biphasic P in V1.', substrate: { atrialScale: 1.5, atrialDelay: 55 } },

  { id: 'p_pulmonale', name: 'Right atrial enlargement', category: 'Chamber', description: 'P pulmonale: tall peaked P >2.5 mm in II.', substrate: { atrialScale: 2.0 } },

  { id: 'digitalis', name: 'Digitalis effect', category: 'Drug effect', description: 'Scooped "reverse tick" ST depression, short QT, T flattening.', qtFactor: 0.85, substrate: { apd: -75, wallApd: { lateral: -35 }, ischaemia: [{ wall: 'lateral', degree: 0.24, layer: 'endo' }, { wall: 'inferior', degree: 0.24, layer: 'endo' }] } },
];

class EcgSynth {
  constructor() {
    this.phase = 0;
    this.buffers = {};
    for (const l of LEADS) this.buffers[l] = [];
    this.prevEn = 0;
    this.cycleLen = 833;
    this.refractoryMs = 0;
    this.time = 0;
    this.qrsAxis = 60;
    this.path = PATHOLOGIES[0];
    this.rrJitter = 0;
    this.beatCount = 0;
    this.wenckebachN = 4;
    this.pPhase = 0;
    this.pRate = 75;
    this.suppressQRS = false;
    this._lastHR = 72;
    this._axisAt = -1e9;
    this.myo = null;
  }

  setPathology(id) {
    const p = PATHOLOGIES.find((x) => x.id === id);
    if (!p) return;
    this.path = p; this.beatCount = 0; this.refractoryMs = 0;
    this.suppressQRS = false; this.rrJitter = 0;
    if (this.myo) this.myo.applySubstrate(p.substrate || {});
  }

  update(dt, en, HR, K, avCond, lbbCond, rbbCond) {
    const ms = dt * 1000;
    this.time += ms;
    if (!this.myo) { this.myo = new Myocardium(); this.myo.applySubstrate(this.path.substrate || {}); }
    const rhythm = this.path.rhythm || 'sinus';
    const rate = this.path.hrOverride || HR;
    this._lastHR = HR;
    this.cycleLen = 60000 / Math.max(30, rate);

    if (rhythm === 'vt' || rhythm === 'vf') {
      const t = this.time / 1000;
      for (const lead of LEADS) {
        this.buffers[lead].push(rhythm === 'vf' ? vfChaos(t) : vtComplex((t * rate / 60) % 1, lead));
      }
      return;
    }

    if (this.refractoryMs > 0) this.refractoryMs -= ms;
    const blocky = rhythm === 'mobitz2' || rhythm === 'wenckebach';

    // A ventricular activation upstroke retriggers the waveform template.
    if (en > 0.3 && this.prevEn <= 0.3 && this.refractoryMs <= 0) {
      let conduct = true;
      if (rhythm === 'af') this.rrJitter = (Math.random() - 0.5) * 0.35;
      else if (rhythm === 'wenckebach') {
        this.beatCount++;
        if (this.beatCount >= this.wenckebachN) { conduct = false; this.beatCount = 0; }
      } else if (rhythm === 'mobitz2') { if (Math.random() < 0.3) conduct = false; }
      else if (rhythm === 'chb') conduct = false;

      if (conduct) {
        const pr = this.path.prFactor || 1;
        const creep = rhythm === 'wenckebach' ? 1 + 0.08 * this.beatCount : 1;
        this.phase = 0.05 + (0.23 - 0.05) * pr * creep;
        this.refractoryMs = this.cycleLen * 0.5;
        this.suppressQRS = false;
        /* Hand the timing to the muscle model: the atria fire, then the
           ventricles after the PR interval. Everything about the *shape* of
           what follows is decided by the myocardium, not here. */
        const prMs = 160 * pr * creep;
        this.myo.triggerAtria(this.time);
        this.myo.pendingV = this.time + prMs;
      } else if (rhythm !== 'chb') {
        this.phase = 0.02;
        this.refractoryMs = this.cycleLen * 0.6;
        this.suppressQRS = true;
      }
    }
    this.prevEn = en;

    if (rhythm === 'chb') {
      const escape = 60000 / Math.max(20, rate);
      this.phase += ms / escape;
      if (this.phase >= 1) this.phase -= 1;
    } else if (blocky && this.suppressQRS) {
      this.phase += ms / this.cycleLen;
      if (this.phase > 0.15 && this.phase < 0.55) this.phase = 0.6;
      if (this.phase >= 1) this.phase -= 1;
    } else {
      const len = this.cycleLen * (1 + this.rrJitter);
      this.phase += ms / len;
      if (this.phase >= 1) this.phase -= 1;
    }

    if (rhythm === 'chb') {
      this.pPhase += ms / (60000 / this.pRate);
      if (this.pPhase >= 1) this.pPhase -= 1;
    }

    /* Potassium and the drugs act on the muscle, not on a drawing of it.
       Raising extracellular K+ depolarises the resting membrane, speeds
       repolarisation and slows the upstroke — and the peaked T waves, flattened
       P waves and broadening QRS all follow from those three facts rather than
       from a table of per-lead offsets. */
    const kd = (K - 4) / 4;
    const kUp = Math.max(0, kd), kDown = Math.max(0, -kd);
    const sub = this.path.substrate || {};
    /* Re-apply only when something has actually changed. Calling applySubstrate
       every half-millisecond also resets whatever else has been written onto the
       sources, which is how bundle branch block came to have no effect. */
    const sig = `${this.path.id}|${K.toFixed(2)}`;
    if (sig !== this._subSig) {
      this._subSig = sig;
      this.myo.applySubstrate(sub);
      /* Hyperkalaemia, mechanism by mechanism:
           · the resting membrane depolarises, so sodium channels inactivate and
             conduction between cells slows — the QRS widens without losing
             amplitude, which is why slowing the *upstroke* is the wrong knob;
           · IK1 conductance rises, so terminal repolarisation is faster and
             steeper — the tall, narrow, peaked T wave;
           · atrial muscle is the most sensitive, so the P wave flattens first
             and disappears well before the QRS becomes a sine wave. */
      this.myo.globalRest += kUp * 0.10;
      this.myo.globalApdOffset += -kUp * 55 + kDown * 60;
      this.myo.condScale = 1 + 1.9 * Math.max(0, kUp) ** 1.4;
      this.myo.repolSteep = 11 * (1 + 1.5 * kUp) / (1 + 0.8 * kDown);
      this.myo.upstroke = (sub.upstroke ?? 9) * (1 + 0.35 * kUp);
      this.myo.atrialScale *= Math.max(0, 1 - 1.55 * kUp);
    }

    // Deliver the pending ventricular activation once the PR interval elapses.
    if (this.myo.pendingV != null && this.time >= this.myo.pendingV) {
      this.myo.triggerVentricle(this.myo.pendingV, { lbb: lbbCond, rbb: rbbCond });
      this.myo.pendingV = null;
    }
    // Complete block: the ventricle escapes on its own, wide and slow.
    if (rhythm === 'chb') {
      const escape = 60000 / Math.max(20, this.path.hrOverride || 40);
      if (this.time - this.myo.vAct > escape) {
        this.myo.triggerVentricle(this.time, { lbb: 0.25, rbb: 0.25 });
      }
      if (this.time - this.myo.aAct > 60000 / this.pRate) this.myo.triggerAtria(this.time);
    }

    const leads = this.myo.sample(this.time, rate);
    for (const lead of LEADS) this.buffers[lead].push(leads[lead] * (this.suppressQRS ? 1 : 1));

    if (this.time - this._axisAt > 900) {
      this._axisAt = this.time;
      this.qrsAxis = this.myo.measureAxis(rate);
    }

  }

  drain() {
    const out = {};
    for (const l of LEADS) out[l] = this.buffers[l].splice(0);
    return out;
  }

  get value() {
    const b = this.buffers.II;
    return b.length > 0 ? b[b.length - 1] : 0;
  }

  get effectiveHR() { return this.path.hrOverride || this._lastHR; }

  reset() {
    this.phase = 0; this.pPhase = 0;
    for (const l of LEADS) this.buffers[l] = [];
    this.prevEn = 0; this.refractoryMs = 0; this.time = 0;
    this.rrJitter = 0; this.beatCount = 0; this.suppressQRS = false;
  }
}

/* ---------------------------------------------------------------- circulation
   State vector: [V_lv, V_la, P_art, sigma_sym, sigma_par]

   Left ventricle : P_lv = E_lv(t) · (V_lv − V0_lv),   E_lv = Emin + (Emax−Emin)·a_v(t)
   Left atrium    : P_la = E_la(t) · (V_la − V0_la),   E_la = Elamin + (Elamax−Elamin)·a_a(t)
   Pulmonary vein : Q_pv  = (P_pv − P_la) / R_pv       (no valve — flow reverses on the a wave)
   Mitral valve   : Q_mit = (P_la − P_lv) / R_mit      when P_la > P_lv
   Aortic valve   : Q_ao  = (P_lv − P_art) / R_ao      when P_lv > P_art
   Windkessel     : dP_art/dt = (Q_ao − P_art/R_sys) / C
*/
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
/* Resistance of a fully incompetent valve, sized independently of the forward
   orifice — how big the leak is has nothing to do with how stenotic the valve
   is, and a patient can have both at once.

   The right-sided valves get a lower value. Severity grades are defined by
   regurgitant volume, and the right ventricle drives its leak with about a
   fifth of the pressure, so an identical orifice resistance would make
   "severe" tricuspid regurgitation quietly mild. */
const REG_BASE_LEFT = 0.5;
const REG_BASE_RIGHT = 0.09;

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
    if (key === 'K') { this.K = value; this.fk.setK(value); return; }
    if (key === 'avConduction') { this.fk.avCond = value; return; }
    if (key === 'lbbConduction') { this.fk.lbbCond = value; return; }
    if (key === 'rbbConduction') { this.fk.rbbCond = value; return; }
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
    } else if (rawV > 0.16 && this.enRaw <= 0.16) {
      /* Detect the upstroke well below the healthy peak. Depolarisation that is
         weak is still depolarisation, and a fixed high threshold silently turns
         a sick heart into a stopped one. */
      this.mechT = 0; this.beatTrigger = true;
    }
    this.enRaw = rawV;
    this.en = this.activation(this.mechT, this.TmaxV);
    if (this.mechT >= 0) this.mechT += this.dt;

    const rawA = this.fk.atrialActivation();
    if (rawA > 0.16 && this.eaRaw <= 0.16) this.mechTa = 0;
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
  setPathology(id) {
    const p = PATHOLOGIES.find((x) => x.id === id);
    if (!p) return;
    /* A pathology can describe the muscle (substrate) and can also set model
       parameters — potassium, nodal or bundle conduction. Restore whatever the
       previous one changed first, or selections accumulate. */
    for (const k of Object.keys(this._pathParams || {})) this.setParam(k, DEFAULTS[k]);
    this._pathParams = p.params || {};
    for (const [k, v] of Object.entries(this._pathParams)) this.setParam(k, v);
    this.ecg.setPathology(id);
  }

  advance(n) { for (let i = 0; i < n; i++) this.step(); }

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
      HR: this.ecg.path.hrOverride ? this.ecg.effectiveHR : (this.baroEnabled ? this.HReff : this.HR),
      HRset: this.HR,
      qrsAxis: this.ecg.qrsAxis,
      avConduction: this.fk.avCond, lbbConduction: this.fk.lbbCond, rbbConduction: this.fk.rbbCond,
      baroEnabled: this.baroEnabled, firingRate: this.firingRate,
      sympathetic: this.sigmaS, parasympathetic: this.sigmaP,
      pathology: this.ecg.path.id,
      ecgValue: this.ecgValue,
      ecgLeads: this.ecg.drain(),
      beat: this.lastBeat,
      metrics: m,
      // convenience mirrors so panels can read them without null checks
      Psys: m ? m.Psys : null, Pdia: m ? m.Pdia : null, Pmean: m ? m.Pmean : null,
      SV: m ? m.SV : null, EF: m ? m.EF : null, CO: m ? m.CO : null,
      EDV: m ? m.EDV : null, ESV: m ? m.ESV : null,
    };
  }

  reset(cfg) {
    this.configure(cfg);
    this.fk.reset(); this.ecg.reset(); this.applyCfg(cfg);
  }
}

/* -------------------------------------------------------------- worker shell */
const DEFAULTS = {
  // --- left ventricle ------------------------------------------------------
  Emax: 2.7, Emin: 0.06, V0: 12, edpA: 0.5, edpB: 0.022,
  // --- right ventricle: thinner wall, a fifth of the contractility ---------
  EmaxRv: 0.62, V0rv: 22, edpArv: 0.42, edpBrv: 0.020,
  // --- atria ---------------------------------------------------------------
  ElaMax: 0.25, ElaMin: 0.13, V0la: 16,
  EraMax: 0.20, EraMin: 0.10, V0ra: 18,
  // --- activation ----------------------------------------------------------
  TmaxV: 0.8, TmaxA: 0.13, actM1: 1.32, actM2: 21.9, actT1: 0.27, actT2: 0.45,
  // --- systemic circuit ----------------------------------------------------
  Csa: 1.2, V0sa: 620, Csv: 62, V0sv: 3200, Rsys: 1.05, Rven: 0.023,
  // --- pulmonary circuit ---------------------------------------------------
  Cpa: 4.2, V0pa: 92, Cpv: 8.5, V0pv: 212, Rpul: 0.075, Rpv: 0.011,
  // --- valves: forward resistance, then regurgitant fraction 0..1 ----------
  Rmitral: 0.01, Raortic: 0.02, Rtricuspid: 0.009, Rpulmonic: 0.02,
  regMitral: 0, regAortic: 0, regTricuspid: 0, regPulmonic: 0,
  // --- whole-body ----------------------------------------------------------
  bloodVolume: 5000,
  HR: 72, K: 4,
  avConduction: 1, lbbConduction: 1, rbbConduction: 1,
  baroEnabled: true, Pn: 95, tauS: 2.5, tauP: 0.3, gS: 0.5, gP: 0.4,
  gR: 0.6, gV: 0.26, gE: 0.45,
  dt: 5e-4,
};

let sim = new Circulation(DEFAULTS);
let running = false;
let speed = 1;
let timer = null;
const FRAME_MS = 1000 / 30;

function tick() {
  if (!running) return;
  const seconds = (FRAME_MS / 1000) * speed;
  const steps = Math.min(Math.max(1, Math.round(seconds / sim.dt)), 1400);
  sim.advance(steps);
  postMessage({ type: 'snapshot', data: sim.snapshot() });
}

function ensureTimer() { if (timer === null) timer = setInterval(tick, FRAME_MS); }

function settle() {
  sim.advance(8000);
  sim.snapshot();
  sim.advance(80);
  postMessage({ type: 'snapshot', data: sim.snapshot() });
}

/* Hand the UI the pathology list rather than keeping a second copy of it. */
postMessage({
  type: 'catalog',
  pathologies: PATHOLOGIES.map(({ id, name, category, description }) => ({ id, name, category, description })),
  /* Legacy aliases included so a coupling written against the old open-loop
     parameter names can still be undone cleanly. */
  defaults: { ...DEFAULTS, R: DEFAULTS.Rsys, C: DEFAULTS.Csa, preload: 7.5 },
});

settle();

onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init': sim = new Circulation(DEFAULTS); settle(); break;
    case 'play': running = true; ensureTimer(); break;
    case 'pause': running = false; break;
    case 'reset': sim.reset(DEFAULTS); settle(); break;
    case 'setSpeed': speed = msg.value; break;
    case 'setParam': sim.setParam(msg.key, msg.value); break;
    case 'setParams': for (const [k, v] of Object.entries(msg.values)) sim.setParam(k, v); break;
    case 'toggleBaro': sim.toggleBaro(); break;
    case 'setBaro': if (sim.baroEnabled !== msg.value) sim.toggleBaro(); break;
    case 'setPathology': sim.setPathology(msg.id); break;
    case 'settle': sim.advance(Math.round((msg.seconds || 4) / sim.dt)); postMessage({ type: 'snapshot', data: sim.snapshot() }); break;
  }
};
