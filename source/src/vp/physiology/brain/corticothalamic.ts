import { CT } from '../../evidence/seizure.ts';
import { defineConstants } from '../../evidence/constants.ts';

/* ===========================================================================
   The corticothalamic system as a source of the EEG (Robinson's mean field,
   parameters of Deeba 2020; evidence/seizure.ts).

   Per region, four populations: cortical excitatory (e) and inhibitory (i)
   neurons, the thalamic relay (specific, s) and reticular (r) nuclei. Each
   population's mean cell-body potential V follows its synaptic input through
   a second-order response (rates α, β); its firing rate is a sigmoid of V;
   the excitatory cortical firing travels as a damped axonal field φe (rate
   γe). Cortex and thalamus reach each other after t0/2. Under random
   connectivity the inhibitory cortical population shares the excitatory
   one's potential, so φi = S(Ve). The relay also gets a noisy input from
   outside the loop; that noise, filtered by the loop, is the background
   rhythm (near 10 Hz: the loop's resonance).

     Ve:  D V = νee φe + νei S(Ve) + νes φs(t − t0/2)
     Vs:  D V = νse φe(t − t0/2) + νsr φr + νsn φn + noise − h
     Vr:  D V = νre φe(t − t0/2) + νrs φs
     φe:  (1/γe² ∂t² + 2/γe ∂t + 1) φe = S(Ve)
     D = (1/αβ) ∂t² + (1/α + 1/β) ∂t + 1

   A seizure is the loop's limit cycle (10 Hz at onset: Deeba 2020). It
   moves along a path, driven by its own firing (the progression p): the
   corticothalamic drive (νse, νre) rises by CT.pathDrive and the cortical
   inhibition weakens by CT.pathInhibition, the directions Stuiver 2025 found
   toward termination; in the model this slows the cycle toward 2.5 Hz. As it
   matures, the relay is hyperpolarised (h) until the cycle cannot survive:
   the seizure ends and the silent relay leaves the cortex suppressed until
   h wears off. Our part, and labelled so: the path and h.

   Units: mV, s, 1/s. Integration: RK4, fixed step (0.2 ms default).
=========================================================================== */

export interface RegionParams {
  nuEE: number; nuEI: number; nuES: number; nuSE: number; nuSR: number; nuRE: number; nuRS: number;
  inputSN: number; qMax: number; theta: number; sigma: number; gammaE: number; alpha: number; beta: number; loopDelay: number;
}
export const DEFAULT_PARAMS: RegionParams = {
  nuEE: CT.nuEE, nuEI: CT.nuEI, nuES: CT.nuES, nuSE: CT.nuSE, nuSR: CT.nuSR, nuRE: CT.nuRE, nuRS: CT.nuRS,
  inputSN: CT.inputSN, qMax: CT.qMax, theta: CT.theta, sigma: CT.sigma, gammaE: CT.gammaE, alpha: CT.alpha, beta: CT.beta, loopDelay: CT.loopDelay,
};

/** A small seeded generator (mulberry32), so a run replays exactly. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let spare: number | null = null;
  const gauss = () => {
    if (spare != null) { const s = spare; spare = null; return s; }
    const u = Math.max(next(), 1e-12), v = next(), r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v); return r * Math.cos(2 * Math.PI * v);
  };
  return { next, gauss };
}

export class Region {
  readonly p: RegionParams;
  readonly dt: number;
  /** φe, dφe, Ve, dVe, Vs, dVs, Vr, dVr */
  x = new Float64Array(8);
  private bufE: Float64Array; private bufS: Float64Array; private bi = 0;
  private sp: number;
  /** the seizure's progression along its path (0 at rest, 1 at its end) */
  progress = 0;
  /** the relay's activity-driven hyperpolarisation (mV) */
  relayInhibition = 0;
  /** excess cortical firing, averaged over about half a second (1/s) */
  excess = 0;
  /** φe at rest, the reference for "excess" (set by `settle`) */
  rest = 0;
  /** extra depolarising input to the relay (mV), e.g. a stimulus */
  kick = 0;
  /** input to the relay from other regions' cortex (mV), set by the brain each step */
  coupling = 0;
  /** extra depolarising input to the cortex (mV) */
  cortexKick = 0;
  private k = [new Float64Array(8), new Float64Array(8), new Float64Array(8), new Float64Array(8)];
  private tmp = new Float64Array(8);

  constructor(p: RegionParams = DEFAULT_PARAMS, dt = 2e-4) {
    this.p = p; this.dt = dt;
    const nd = Math.max(1, Math.round(p.loopDelay / 2 / dt));
    this.bufE = new Float64Array(nd + 1); this.bufS = new Float64Array(nd + 1);
    this.sp = (p.sigma * Math.sqrt(3)) / Math.PI;
  }
  S = (v: number) => this.p.qMax / (1 + Math.exp(-(v - this.p.theta) / this.sp));
  /** dS/dV: the population's gain per mV at that potential */
  dS = (v: number) => { const s = this.S(v) / this.p.qMax; return (this.p.qMax / this.sp) * s * (1 - s); };

  /** where the seizure's path has taken the model now */
  get drive() { return 1 + CT.pathDrive * Math.min(1, this.progress); }
  get inhibition() { return this.p.nuEI + CT.pathInhibition * Math.min(1, this.progress); }

  private deriv(x: Float64Array, eD: number, sD: number, noise: number, out: Float64Array) {
    const p = this.p, ab = p.alpha * p.beta, apb = p.alpha + p.beta, c = this.drive;
    const Qe = this.S(x[2]), phis = this.S(x[4]), phir = this.S(x[6]);
    const inE = p.nuEE * x[0] + this.inhibition * Qe + p.nuES * sD + this.cortexKick;
    const inS = p.nuSE * c * eD + p.nuSR * phir + p.inputSN + noise + this.kick + this.coupling - this.relayInhibition;
    const inR = p.nuRE * c * eD + p.nuRS * phis;
    out[0] = x[1]; out[1] = p.gammaE * p.gammaE * (Qe - x[0]) - 2 * p.gammaE * x[1];
    out[2] = x[3]; out[3] = ab * (inE - x[2]) - apb * x[3];
    out[4] = x[5]; out[5] = ab * (inS - x[4]) - apb * x[5];
    out[6] = x[7]; out[7] = ab * (inR - x[6]) - apb * x[7];
  }

  /** one step; `noise` is a standard normal draw (scaled here) or 0 */
  step(noise: number) {
    const dt = this.dt, eD = this.bufE[this.bi], sD = this.bufS[this.bi];
    const n = noise * CT.inputNoise / Math.sqrt(dt * 1000);
    const [k1, k2, k3, k4] = this.k, x = this.x, t = this.tmp;
    this.deriv(x, eD, sD, n, k1);
    for (let i = 0; i < 8; i++) t[i] = x[i] + 0.5 * dt * k1[i]; this.deriv(t, eD, sD, n, k2);
    for (let i = 0; i < 8; i++) t[i] = x[i] + 0.5 * dt * k2[i]; this.deriv(t, eD, sD, n, k3);
    for (let i = 0; i < 8; i++) t[i] = x[i] + dt * k3[i]; this.deriv(t, eD, sD, n, k4);
    for (let i = 0; i < 8; i++) x[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    this.bufE[this.bi] = x[0]; this.bufS[this.bi] = this.S(x[4]); this.bi = (this.bi + 1) % this.bufE.length;
    /* the slow processes */
    const ex = Math.max(0, x[0] - this.rest);
    this.excess += (dt * (ex - this.excess)) / 0.5;
    if (this.excess > CT.seizingThreshold) this.progress += dt * CT.progressRate * ex;
    else this.progress -= (dt * this.progress) / CT.progressDecay;
    this.relayInhibition += dt * (CT.relayInhibitionRate * ex * Math.min(1, this.progress) ** 2 - this.relayInhibition / CT.relayRecovery);
  }

  /** The loop's gains at the current mean state (Robinson; Stuiver 2026): X cortical, Y corticothalamic loop, Z intrathalamic.
      Read at a steady state (rest or postictal); during a seizure they are not defined, the system being on a cycle. */
  gains(mean?: { Ve: number; Vs: number; Vr: number }) {
    const p = this.p, c = this.drive;
    const Ve = mean?.Ve ?? this.x[2], Vs = mean?.Vs ?? this.x[4], Vr = mean?.Vr ?? this.x[6];
    const re = this.dS(Ve), rs = this.dS(Vs), rr = this.dS(Vr);
    const Gee = re * p.nuEE, Gei = re * this.inhibition, Ges = re * p.nuES;
    const Gse = rs * p.nuSE * c, Gsr = rs * p.nuSR, Gre = rr * p.nuRE * c, Grs = rr * p.nuRS;
    const Gese = Ges * Gse, Gesre = Ges * Gsr * Gre, Gsrs = Gsr * Grs;
    const X = Gee / (1 - Gei), Y = (Gese + Gesre) / ((1 - Gsrs) * (1 - Gei)), Z = (-Gsrs * p.alpha * p.beta) / (p.alpha + p.beta) ** 2;
    return { X, Y, Z };
  }
}

/* ---- the brain: regions coupled into hemispheres ---------------------------------------------------- */

export interface RegionDef {
  id: string;
  hemisphere: 'L' | 'R';
  /** where its patch of convexity cortex lies: the 10-10 spherical angles (θ from the vertex, negative left; φ azimuth) */
  theta: number; phi: number;
}

/** Five regions of convexity cortex per hemisphere, under the 10-20 electrodes that look at them. */
export const REGIONS: RegionDef[] = (['L', 'R'] as const).flatMap((h) => {
  const s = h === 'L' ? -1 : 1;
  return [
    { id: `${h}-frontal`, hemisphere: h, theta: s * 72, phi: s * 58 },
    { id: `${h}-central`, hemisphere: h, theta: s * 46, phi: 0 },
    { id: `${h}-temporal`, hemisphere: h, theta: s * 98, phi: s * 6 },
    { id: `${h}-parietal`, hemisphere: h, theta: s * 62, phi: s * -54 },
    { id: `${h}-occipital`, hemisphere: h, theta: s * 90, phi: s * -74 },
  ];
});

interface PulseTrain { rate: number; count: number; area: Float64Array; release: number; recovery: number; start: number; given: number; u: Float64Array }

export interface BrainOptions { seed?: number; dt?: number; regions?: RegionDef[] }

export class Brain {
  readonly regions: Region[];
  readonly defs: RegionDef[];
  readonly dt: number;
  t = 0;
  private rng: ReturnType<typeof seeded>;
  /** coupling weights: excess cortical firing of region j onto the cortex of region i (mV per 1/s) */
  readonly w: Float64Array;
  private stim: Array<{ until: number; mV: number; regions: Set<number> }> = [];
  private train: PulseTrain | null = null;

  constructor(o: BrainOptions = {}) {
    this.dt = o.dt ?? 2e-4;
    this.defs = o.regions ?? REGIONS;
    this.regions = this.defs.map(() => new Region(DEFAULT_PARAMS, this.dt));
    this.rng = seeded(o.seed ?? 1);
    const n = this.defs.length;
    this.w = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j)
      this.w[i * n + j] = (this.defs[i].hemisphere === this.defs[j].hemisphere ? BRAIN_COUPLING.within : BRAIN_COUPLING.across) / (n - 1);
  }

  /** Run without noise to the resting state, record it as each region's reference, then run with noise a little. */
  settle(seconds = 6) {
    const steps = Math.round(seconds / this.dt);
    for (let k = 0; k < steps; k++) { for (const r of this.regions) r.step(0); }
    for (const r of this.regions) { r.rest = r.x[0]; r.progress = 0; r.relayInhibition = 0; r.excess = 0; }
    this.t = 0;
  }

  /** A depolarising pulse into the relay of the chosen regions (all if none given): how a stimulus starts a seizure here. */
  stimulate(mV: number, seconds: number, regions?: number[]) {
    this.stim.push({ until: this.t + seconds, mV, regions: new Set(regions ?? this.regions.map((_, i) => i)) });
  }

  /** A train of brief pulses into the relays (the ECT stimulus, physiology/brain/ect-stimulus.ts), as a rate: while the
      train runs, each region's relay gets its pulse's area times the pulse rate times the share of the synaptic resource
      each pulse releases (Tsodyks–Markram depression in its rate form: du/dt = (1 − u)/recovery − release·u·rate). The
      pulses enter as a rate, not as volleys, because a region here is one point: driven by volleys it rings at its
      alpha resonance, and a train of 20 pulses a second (10 Hz on the device) would start a seizure at a third of the drive a 40 per second
      train needs, which no human series shows. Replaces any train running. */
  pulses(o: { rate: number; count: number; area: ArrayLike<number>; release: number; recovery: number }) {
    this.train = { ...o, area: Float64Array.from(o.area), start: this.t, given: 0, u: new Float64Array(this.regions.length).fill(1) };
  }
  /** Stop the train early (the treatment button released): returns the pulses given. */
  stopPulses() { const g = this.train?.given ?? 0; this.train = null; return g; }
  /** pulses of the last train given so far (null if none was started) */
  get pulsesGiven() { return this.train ? this.train.given : null; }
  /** whether a train is still delivering */
  get delivering() { return !!this.train && this.train.given < this.train.count; }

  step() {
    const n = this.regions.length;
    const tr = this.train;
    const on = !!tr && tr.given < tr.count;
    if (tr) {
      if (on) tr.given = Math.min(tr.count, Math.floor((this.t + this.dt - tr.start) * tr.rate + 1e-9));
      for (let i = 0; i < n; i++) tr.u[i] += this.dt * ((1 - tr.u[i]) / tr.recovery - (on ? tr.release * tr.u[i] * tr.rate : 0));
    }
    for (let i = 0; i < n; i++) {
      let c = 0;
      for (let j = 0; j < n; j++) { const wij = this.w[i * n + j]; if (wij) c += wij * Math.max(0, this.regions[j].excess - CT.seizingThreshold); }
      this.regions[i].coupling = c;
      let k = 0; for (const s of this.stim) if (this.t < s.until && s.regions.has(i)) k += s.mV;
      this.regions[i].kick = k;
      this.regions[i].cortexKick = on && tr ? tr.area[i] * tr.rate * tr.release * tr.u[i] : 0;
    }
    for (const r of this.regions) r.step(this.rng.gauss());
    this.t += this.dt;
    if (this.stim.length && this.stim.every((s) => this.t >= s.until)) this.stim = [];
  }

  advance(seconds: number) { const steps = Math.round(seconds / this.dt); for (let k = 0; k < steps; k++) this.step(); }

  /** each region's cortical firing relative to rest (1/s): what its patch of cortex contributes to the EEG */
  activity(): Float64Array { return Float64Array.from(this.regions, (r) => r.x[0] - r.rest); }
}

/* Coupling between regions: a seizing region's firing depolarises the relay of the others (corticothalamic fibres reach
   beyond their own region's thalamus), within a hemisphere more strongly than across. It decides how fast a seizure in some
   regions recruits the others. */
export const BRAIN_COUPLING = defineConstants('seizure-coupling', {
  within: { value: 1, unit: 'mV·s', status: 'assumed', means: 'Depolarisation a region’s relay receives from the ictal firing of the other regions of its hemisphere (above the seizing threshold), summed.',
    derivation: 'Corticothalamic fibres from neighbouring cortex; no measured value in the model’s units. Only firing above the seizing threshold couples, so the background is untouched (coupling the background’s own fluctuations makes the resting model unstable). Placed so that a seizure started in one region takes its whole hemisphere within seconds.' },
  across: { value: 0.3, unit: 'mV·s', status: 'derived', refs: ['kim2004'],
    means: 'Depolarisation from the other hemisphere’s ictal firing, summed.',
    derivation: 'Fitted once (by scanning) so that a seizure started in the right frontal region reaches the whole left hemisphere about 13 s after the right: Kim 2004 measured interhemispheric propagation of 7.0 ± 8.4 to 22.6 ± 20.0 s with bilateral foramen ovale electrodes in mesial temporal epilepsy, the only human figure found. A different seizure from ECT’s: a convention until a better figure is found.' },
});
