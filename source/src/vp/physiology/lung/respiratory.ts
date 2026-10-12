/* ===========================================================================
   The respiratory system.

   Five lobes, two pleural spaces and the airways, run as four coupled
   models:

     Mechanics      each breath integrated from the equation of motion,
                    Pmus = V/C + R·dV/dt, with passive expiration. When the
                    expiratory time constant R·C is long (obstruction), the
                    lung does not empty before the next breath: dynamic
                    hyperinflation and intrinsic PEEP appear by themselves.

     Gas exchange   ventilation and perfusion are shared out among the lobes
                    (and, inside each lobe, between a low and a high V/Q
                    unit; consolidated, flooded and collapsed lung is
                    perfused but not ventilated). Every unit is solved for
                    its alveolar O2 and CO2 by mass balance against the
                    O2 and CO2 dissociation curves, with mixed venous blood
                    set by cardiac output and metabolism; arterial blood is
                    the perfusion-weighted mixture. Shunt, dead space,
                    the A–a gradient and the arterial-to-end-tidal CO2
                    gap are outputs, not inputs.

     Vasculature    hypoxic pulmonary vasoconstriction diverts blood away
                    from poorly ventilated lung; emboli remove vessels. The
                    lobes are resistances in parallel, so both raise
                    pulmonary vascular resistance, which is handed to the
                    circulation (the right ventricle feels it).
                    The Starling balance at the pulmonary capillary, with
                    capillary pressure from the circulation's left atrial
                    and pulmonary arterial pressures, decides whether
                    water stays in the vessels, the interstitium or the
                    alveoli, gravity-dependent.

     Control        the respiratory centre sets minute ventilation from
                    arterial CO2 (central chemoreceptors), arterial [H+]
                    and arterial O2 (carotid bodies), scaled by metabolic
                    rate; what it gets is limited by what the muscles and
                    the airways can deliver. Rate and depth are shared out
                    the way patients do it: stiff lungs breathe fast and
                    shallow.

   Units: gas tensions in kPa, contents in mL/dL, flows in L/min.
=========================================================================== */

export type LobeId = 'RUL' | 'RML' | 'RLL' | 'LUL' | 'LLL';
export const LOBES: LobeId[] = ['RUL', 'RML', 'RLL', 'LUL', 'LLL'];
export const LOBE_SIDE: Record<LobeId, 'L' | 'R'> = { RUL: 'R', RML: 'R', RLL: 'R', LUL: 'L', LLL: 'L' };
/** Share of lung volume, of ventilation and of perfusion, semi-recumbent (the bases are better perfused than ventilated). */
export const LOBE_VOLUME: Record<LobeId, number> = { RUL: 0.19, RML: 0.09, RLL: 0.24, LUL: 0.22, LLL: 0.26 };
const LOBE_VENT: Record<LobeId, number> = { RUL: 0.18, RML: 0.09, RLL: 0.25, LUL: 0.21, LLL: 0.27 };
const LOBE_PERF: Record<LobeId, number> = { RUL: 0.15, RML: 0.09, RLL: 0.27, LUL: 0.19, LLL: 0.30 };
/** How much gravity loads each lobe with fluid (semi-recumbent: bases first). */
/** Standard normal quantiles at the midpoints of eight equal-probability bins: the V/Q units inside each lobe. */
const VQ_Z = [-1.534, -0.887, -0.489, -0.157, 0.157, 0.489, 0.887, 1.534];
const LOBE_GRAVITY: Record<LobeId, number> = { RUL: 0.55, RML: 1.0, RLL: 1.35, LUL: 0.6, LLL: 1.35 };

export interface RespiratoryParams {
  /* inspired gas and metabolism */
  FiO2: number; Pb: number; metabolicRate: number; RQ: number;
  /* control */
  drive: number; muscleStrength: number; gCO2: number; gH: number; gO2: number; hpv: number;
  /* airways and parenchyma */
  bronchoconstriction: number; emphysema: number; fibrosis: number; capillaryLeak: number; vqMismatch: number; diffusion: number;
  /* blood */
  COHb: number; metHb: number;
  /* lobes: consolidation (alveoli full of exudate), collapse (atelectasis), embolic obstruction of the lobar artery */
  consRUL: number; consRML: number; consRLL: number; consLUL: number; consLLL: number;
  collRUL: number; collRML: number; collRLL: number; collLUL: number; collLLL: number;
  embRUL: number; embRML: number; embRLL: number; embLUL: number; embLLL: number;
  /* pleura */
  effusionL: number; effusionR: number; ptxL: number; ptxR: number;
}

export const RESPIRATORY_DEFAULTS: RespiratoryParams = {
  FiO2: 0.21, Pb: 101.3, metabolicRate: 1, RQ: 0.8,
  drive: 1, muscleStrength: 1, gCO2: 1.6, gH: 0.04, gO2: 1, hpv: 0.6,
  bronchoconstriction: 0, emphysema: 0, fibrosis: 0, capillaryLeak: 0, vqMismatch: 0, diffusion: 1,
  COHb: 0.01, metHb: 0.005,
  consRUL: 0, consRML: 0, consRLL: 0, consLUL: 0, consLLL: 0,
  collRUL: 0, collRML: 0, collRLL: 0, collLUL: 0, collLLL: 0,
  embRUL: 0, embRML: 0, embRLL: 0, embLUL: 0, embLLL: 0,
  effusionL: 0, effusionR: 0, ptxL: 0, ptxR: 0,
};

/** What the respiratory model needs from the rest of the patient. */
export interface RespiratoryInputs {
  CO: number;            // L/min (forward cardiac output)
  Pla: number;           // mmHg, mean left atrial pressure
  Ppa: number;           // mmHg, mean pulmonary arterial pressure
  Hb: number;            // g/L
  sbc: number;           // mmol/L, metabolic (standard) bicarbonate
  albumin: number;       // g/L
  temp: number;          // °C
  /** Drive from outside the lungs and chemoreceptors: cytokines and fever in sepsis. */
  sysDrive?: number;
  /** Oxygen consumption × normal from the body (thyroid hormone). */
  metabolicMult?: number;
}
export const DEFAULT_INPUTS: RespiratoryInputs = { CO: 5.2, Pla: 7, Ppa: 15, Hb: 150, sbc: 24, albumin: 42, temp: 37 };

export interface Body { age: number; sex: 'F' | 'M'; heightCm: number; weightKg: number }

/* ---- constants and the blood's chemistry --------------------------------------- */
export const MMHG_PER_KPA = 7.50062;
export const PH2O = 6.27;             // kPa, water vapour at 37 °C
const K_GAS = 8.693;                  // mL STPD/min of gas moved by 1 L/min BTPS of ventilation per kPa
const NORMAL_PACO2 = 5.33;

/** Bicarbonate actually present at a CO2 tension (acute buffering on top of the metabolic level). */
export const hco3At = (sbc: number, pco2: number) => sbc + 0.75 * (pco2 - NORMAL_PACO2);
export const phOf = (hco3: number, pco2: number) => 6.1 + Math.log10(Math.max(0.5, hco3) / (0.23 * Math.max(0.3, pco2)));
export const hPlus = (pH: number) => 10 ** (9 - pH);         // nmol/L

/** Haemoglobin O2 saturation (Severinghaus 1979), shifted by pH, CO2, temperature and carbon monoxide. */
export function satO2(po2: number, pH = 7.4, pco2 = NORMAL_PACO2, COHb = 0, T = 37): number {
  const P = Math.max(0, po2) * MMHG_PER_KPA;
  const pv = P * 10 ** (0.024 * (37 - T) + 0.40 * (pH - 7.40) + 0.06 * Math.log10(40 / Math.max(2, pco2 * MMHG_PER_KPA))) * (1 + 1.16 * COHb);
  if (pv <= 0) return 0;
  return 1 / (1 + 23400 / (pv * pv * pv + 150 * pv));
}
/** O2 content, mL/dL: bound to the haemoglobin that can carry it, plus dissolved. */
export const contentO2 = (po2: number, S: number, Hb: number, dysHb: number) => 1.34 * (Hb / 10) * (1 - dysHb) * S + 0.0225 * Math.max(0, po2);
/** CO2 content, mL/dL: mostly bicarbonate, so it scales with the metabolic level; deoxygenated blood carries more (Haldane). */
export const contentCO2 = (pco2: number, S: number, sbc: number) => (sbc / 24) * 11.02 * Math.max(0, pco2 * MMHG_PER_KPA) ** 0.396 + 4 * (1 - S);

/* ---- predicted lung function (ECSC 1993; Nunn & Gregg 1989) -------------------- */
export function predicted(b: Body) {
  const H = b.heightCm / 100, A = Math.max(18, b.age), m = b.sex === 'M';
  const FEV1 = m ? 4.30 * H - 0.029 * A - 2.49 : 3.95 * H - 0.025 * A - 2.60;
  const FVC = m ? 5.76 * H - 0.026 * A - 4.34 : 4.43 * H - 0.026 * A - 2.89;
  const TLC = m ? 7.99 * H - 7.08 : 6.60 * H - 5.79;
  const RV = m ? 1.31 * H + 0.022 * A - 1.23 : 1.81 * H + 0.016 * A - 2.00;
  const FRC = m ? 2.34 * H + 0.009 * A - 1.09 : 2.24 * H + 0.001 * A - 1.00;
  const PEF = Math.exp(m ? 0.544 * Math.log(A) - 0.0151 * A - 74.7 / b.heightCm + 5.48 : 0.376 * Math.log(A) - 0.012 * A - 58.8 / b.heightCm + 5.63) / 60;
  return { FEV1, FVC, TLC, RV, FRC, PEF, ratio: FEV1 / FVC };
}
export const idealWeight = (b: Body) => Math.max(30, (b.sex === 'M' ? 50 : 45.5) + 0.91 * (b.heightCm - 152.4));

/* ---- the state the model reports ------------------------------------------------- */
export interface LobeState {
  id: LobeId; side: 'L' | 'R';
  aerated: number; consolidated: number; flooded: number; collapsed: number; compressed: number; ptx: number;
  ventShare: number; perfShare: number; shuntShare: number;
  VQ: number; PAO2: number; PACO2: number; embolus: number;
}

export interface RespSnapshot {
  /* mechanics, instantaneous */
  t: number; V: number; flow: number; Pmus: number; Palv: number; Ppl: number; phase: 'insp' | 'exp'; breathT: number; EELV: number;
  /* pattern */
  RR: number; VT: number; VE: number; VA: number; VDanat: number; Ti: number; Te: number; iPEEP: number;
  Crs: number; Raw: number; tauE: number; effort: number; demand: number; capacity: number; afferent: number;
  /* gases */
  PIO2: number; PAO2ideal: number; PaO2: number; PaCO2: number; PvO2: number; PvCO2: number; pH: number; hco3: number;
  SaO2: number; SvO2: number; FO2Hb: number; FHHb: number; COHb: number; metHb: number; CaO2: number; CvO2: number;
  DO2: number; VO2: number; VCO2: number; AaGradient: number; shunt: number; venousAdmixture: number;
  EtCO2: number; PECO2: number; VDVT: number; deoxyHb: number;
  /* vessels and water */
  RpulMult: number; Pcap: number; filtration: number; interstitial: number; HPVtone: number;
  /* volumes and tests */
  TLC: number; RV: number; FRC: number; FVC: number; FEV1: number; PEF: number; DLCOpct: number; pred: ReturnType<typeof predicted>;
  lobes: LobeState[];
  inputs: RespiratoryInputs;
  params: RespiratoryParams;
}

/* ---- the running model ---------------------------------------------------------- */
interface Unit { lobe: number; VA: number; Q: number; kind: 'vq' | 'shunt' | 'base' | 'dead'; PO2: number; PCO2: number; diffU: number; key?: string }

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const sigm = (x: number) => 1 / (1 + Math.exp(-x));

export class Respiratory {
  p: RespiratoryParams;
  body: Body;
  inp: RespiratoryInputs = { ...DEFAULT_INPUTS };
  /* slow states */
  PaO2 = 12.5; PaCO2 = NORMAL_PACO2; VEdrive = 6.4;
  water: number[] = [0, 0, 0, 0, 0];            // alveolar flooding fraction per lobe
  interstitial = 0;
  /* mechanics states */
  t = 0; private breathT = 0; private V = 0; private flow = 0; private Pmax = 4; private phase: 'insp' | 'exp' = 'insp';
  private vtThis = 0; private vStart = 0; private endExp = 0;
  /* the last gas-exchange solution */
  private sol!: ReturnType<Respiratory['solve']>;
  private Pv = { O2: 5.3, CO2: 6.1 };
  private sinceSolve = 1e9;
  private pred: ReturnType<typeof predicted>;

  constructor(p: Partial<RespiratoryParams> = {}, body: Body = { age: 45, sex: 'M', heightCm: 176, weightKg: 76 }) {
    this.p = { ...RESPIRATORY_DEFAULTS, ...p };
    this.body = body;
    this.pred = predicted(body);
    this.equilibrate();
  }

  setParams(p: RespiratoryParams, body?: Body): void { this.p = { ...p }; if (body) { this.body = body; this.pred = predicted(body); } this.sinceSolve = 1e9; }
  setInputs(i: Partial<RespiratoryInputs>): void { Object.assign(this.inp, i); }

  /* ---- structure: how much of each lobe is gas-filled, and why not ------------------ */
  lobeStructure() {
    const p = this.p as unknown as Record<string, number>;
    const eff = { L: this.p.effusionL, R: this.p.effusionR };
    const ptx = { L: clamp(this.p.ptxL, 0, 1), R: clamp(this.p.ptxR, 0, 1) };
    return LOBES.map((id, i) => {
      const side = LOBE_SIDE[id];
      const lower = id === 'RLL' || id === 'LLL', middle = id === 'RML';
      // An effusion fills from the costophrenic angle up: it compresses the lower lobe first.
      const E = eff[side];
      const compressed = clamp(lower ? E / 1800 : middle ? (E - 700) / 1600 : (E - 1400) / 2200, 0, 0.95);
      const cons = clamp(p[`cons${id}`] ?? 0, 0, 1);
      const coll = clamp(p[`coll${id}`] ?? 0, 0, 1);
      const flooded = Math.min(this.water[i], Math.max(0, 1 - cons - coll));
      const solidFrac = clamp(cons + flooded, 0, 1);
      const collapsed = clamp(coll + compressed * (1 - coll), 0, 1);
      // A pneumothorax lets the whole lung on that side fall away from the chest wall.
      const remaining = (1 - collapsed) * (1 - ptx[side]);
      const aerated = clamp(remaining * (1 - solidFrac), 0, 1);
      const collapsedTotal = 1 - remaining;
      return { id, side, i, cons, flooded, solidFrac: remaining * solidFrac, collapsed: collapsedTotal, compressed, ptx: ptx[side], aerated, emb: clamp(p[`emb${id}`] ?? 0, 0, 1) };
    });
  }

  /* ---- mechanics: compliance, resistance, volumes -------------------------------- */
  mechanics() {
    const p = this.p, pr = this.pred;
    const st = this.lobeStructure();
    const gas = st.reduce((a, l) => a + LOBE_VOLUME[l.id] * l.aerated, 0);           // fraction of lung still holding gas
    const b = clamp(p.bronchoconstriction, 0, 1), e = clamp(p.emphysema, 0, 1), f = clamp(p.fibrosis, 0, 1);
    const CL = 0.2 * (pr.TLC / 6.8) * (1 + 1.5 * e) * (1 - 0.75 * f) * (1 - 0.45 * this.interstitial) * Math.max(0.12, gas);   // L/cmH2O
    const Ccw = 0.2;
    const Crs = 1 / (1 / CL + 1 / Ccw);
    const Raw0 = 2.0;                                                                                // cmH2O·s/L
    const Ri = Raw0 * (1 + 12 * b ** 1.5) * (1 + 0.5 * e) * (1 + 0.6 * this.interstitial);
    const Re = Raw0 * (1 + 12 * b ** 1.5) * (1 + 3 * e) * (1 + 0.6 * this.interstitial);
    // Static volumes. Weak inspiratory and expiratory muscles cannot reach TLC or get down to RV: the vital capacity shrinks.
    const mus = clamp(p.muscleStrength, 0.02, 1.3);
    const TLCs = pr.TLC * (1 + 0.35 * e - 0.4 * f - 0.15 * this.interstitial) * (0.35 + 0.65 * gas);
    const RVs = Math.min(0.85 * TLCs, pr.RV * (1 + 1.6 * e + 1.1 * b) * (0.6 + 0.4 * gas));
    const VCmus = Math.min(1, mus) ** 0.6;
    const RV = RVs + (TLCs - RVs) * (1 - VCmus) * 0.3;
    const TLC = RV + (TLCs - RVs) * VCmus;
    const FRC = Math.min(TLC - 0.3, pr.FRC * (1 + 0.5 * e + 0.4 * b - 0.35 * f) * (0.35 + 0.65 * gas));
    // Forced expiration: maximal flow falls with airway narrowing and lost recoil and becomes concave (scooped).
    const a = pr.PEF / Math.max(1, pr.FVC);
    const kFlow = (a / (1 + 6 * b ** 1.3 + 2 * e)) * (1 + 0.6 * f) * Math.sqrt(Math.min(1, mus));
    const nFlow = 1.25 + 1.2 * (b + e);
    const DL = clamp(p.diffusion, 0, 2) * (1 - 0.85 * f) * (1 - 0.6 * e) * (1 - 0.5 * this.interstitial) * Math.max(0.05, gas) ** 0.7;
    return { st, gas, CL, Crs, Ri, Re, TLC, RV, FRC, kFlow, nFlow, DL };
  }

  /** A forced expiration from TLC: volume–time and flow–volume, and the numbers a spirometer reports. */
  forcedExpiration(): { t: number[]; vol: number[]; flow: number[]; FEV1: number; FVC: number; PEF: number; FEV6: number } {
    const m = this.mechanics();
    const FVCtrue = Math.max(0.2, m.TLC - m.RV);
    const dt = 0.01, out = { t: [] as number[], vol: [] as number[], flow: [] as number[] };
    let x = 1, v = 0, FEV1 = 0, PEF = 0, FEV6 = 0, t = 0;
    for (; t < 15; t += dt) {
      const effort = Math.min(1, t / 0.07);                                   // the rise to peak takes a few tens of ms
      const q = Math.min(effort * m.kFlow * FVCtrue * 1.08, m.kFlow * FVCtrue * x ** m.nFlow);
      x = Math.max(0, x - (q * dt) / FVCtrue);
      v = (1 - x) * FVCtrue;
      PEF = Math.max(PEF, q);
      if (Math.abs(t - 1) < dt / 2) FEV1 = v;
      if (Math.abs(t - 6) < dt / 2) FEV6 = v;
      if (Math.round(t / dt) % 2 === 0) { out.t.push(+t.toFixed(2)); out.vol.push(v); out.flow.push(q); }
      if (t > 1.2 && q < 0.025) break;
    }
    if (!FEV1) FEV1 = v;
    if (!FEV6) FEV6 = v;
    return { ...out, FEV1, FVC: v, PEF, FEV6 };
  }

  /* ---- control: what the respiratory centre asks for, and what it gets --------------- */
  private VO2() { return 9.7 * this.body.weightKg ** 0.75 * clamp(this.p.metabolicRate * (this.inp.metabolicMult ?? 1), 0.3, 6) * (1 + 0.1 * (this.inp.temp - 37)); }
  /** The O2 the respiratory muscles burn: about 1 mL per litre of ventilation in health, several times that against narrowed airways or stiff lungs, and rising steeply near capacity. */
  private VO2breathing(VE: number, m: ReturnType<Respiratory['mechanics']>, cap: number) {
    const Cn = 0.1 * (this.pred.TLC / 6.8);
    return 1.0 * VE * Math.sqrt(((m.Ri + m.Re) / 4) * (Cn / Math.max(0.005, m.Crs))) * (1 + (VE / cap) ** 2);
  }
  /** Drive from the lung's own receptors (C-fibre 'J' receptors in the interstitium, irritant receptors in the airways):
      inflamed, flooded, embolised or stiff lung makes people breathe faster than their blood gases alone require. */
  afferent(m = this.mechanics()) {
    const p = this.p;
    const solid = m.st.reduce((a, l) => a + LOBE_VOLUME[l.id] * (l.solidFrac + l.flooded), 0);
    const emb = LOBES.reduce((a, id) => a + LOBE_PERF[id] * clamp((p as any)[`emb${id}`] ?? 0, 0, 1), 0);
    const pleura = m.st.reduce((a, l) => a + LOBE_VOLUME[l.id] * (l.compressed + l.ptx), 0);
    return Math.min(3, 4 * solid + 1.0 * this.interstitial + 2.6 * emb + 1.2 * clamp(p.fibrosis, 0, 1) + 1.2 * clamp(p.bronchoconstriction, 0, 1) + 0.8 * pleura);
  }
  private demand(PaO2: number, PaCO2: number, m = this.mechanics()) {
    const p = this.p;
    const VCO2 = this.VO2() * p.RQ;
    const pH = phOf(hco3At(this.inp.sbc, PaCO2), PaCO2);
    const Pmm = PaO2 * MMHG_PER_KPA;
    const d = clamp(p.drive, 0, 3);
    // Central chemoreceptors (CO2) and carotid bodies ([H+], O2). Below the set point the CO2 response is
    // much flatter (the 'dog-leg'), which is why other drives can push CO2 down. Depressant drugs lower
    // both the drive and the slope of the response.
    // The central chemoreceptors read the pH of the CSF, whose bicarbonate follows the blood's halfway over
    // days: a chronically raised bicarbonate moves the CO2 they defend upward (the 'reset' of chronic hypercapnia).
    const csfHCO3 = 24 + 0.5 * (this.inp.sbc - 24);
    const dP = PaCO2 - NORMAL_PACO2 * csfHCO3 / 24, dH = hPlus(pH) - 40;
    const chem = p.gCO2 * dP * (dP < 0 ? 0.3 : 1) + p.gH * dH * (dH < 0 ? 0.5 : 1);
    const hyp = Math.min(3, p.gO2 * 20 * Math.max(-0.003, 1 / Math.max(4, Pmm - 25) - 1 / 65));
    const stim = 1 + d * chem + hyp + this.afferent(m) + (this.inp.sysDrive ?? 0);
    return 6.4 * (VCO2 / 200) * d * clamp(stim, 0.15, 10);
  }
  private capacity(m = this.mechanics()) {
    // Maximal sustainable ventilation: about 35 × FEV1 at best, and what the muscles can do.
    const fev1 = this.forcedFEV1(m);
    // A hyperinflated chest flattens the diaphragm, which then shortens from a poor starting length.
    const hyper = clamp((m.FRC / m.TLC - 0.5) / 0.3, 0, 1);
    return Math.max(1, 0.45 * 37 * fev1 * Math.sqrt(clamp(this.p.muscleStrength, 0, 1.3)) * (1 - 0.6 * hyper));
  }
  private forcedFEV1(m: ReturnType<Respiratory['mechanics']>) {
    const FVC = Math.max(0.2, m.TLC - m.RV);
    const n = m.nFlow, k = m.kFlow;
    const x1 = Math.abs(n - 1) < 1e-3 ? Math.exp(-k) : (1 + (n - 1) * k) ** (-1 / (n - 1));
    return FVC * (1 - x1);
  }
  private delivered(demand: number, cap: number) { return demand / Math.sqrt(1 + (demand / cap) ** 2); }

  /** Rate and depth for a minute ventilation: stiff or small lungs breathe fast and shallow. */
  private pattern(VE: number, m = this.mechanics()) {
    const Cn = 0.1 * (this.pred.TLC / 6.8);
    // Stiff lungs (not floppy ones) make breathing fast and shallow; so does a load near capacity and drive from the lung itself.
    const load = Math.min(1.5, VE / Math.max(1, this.capacity(m)));
    const RR = clamp(13.5 * (VE / 6.4) ** 0.5 * Math.max(1, Cn / Math.max(0.01, m.Crs)) ** 0.3 * (1 + 0.25 * this.afferent(m) + 0.45 * (this.inp.sysDrive ?? 0)) * (1 + 0.6 * load * load)
      / clamp(this.p.muscleStrength, 0.2, 1.2) ** 0.3, 5, 50);
    const VT = VE / RR;
    const Ttot = 60 / RR;
    const Ti = Ttot * clamp(0.42 - 0.08 * (clamp(this.p.bronchoconstriction + this.p.emphysema, 0, 1)), 0.25, 0.45);
    return { RR, VT, Ti, Te: Ttot - Ti };
  }

  /* ---- gas exchange ------------------------------------------------------------------ */
  private warm = new Map<string, [number, number]>();

  solve(VE: number) {
    const p = this.p, inp = this.inp;
    const m = this.mechanics();
    const pat = this.pattern(VE, m);
    const VDanat = 0.0022 * idealWeight(this.body) * (1 + 0.25 * p.emphysema);            // L
    const VA = Math.max(0.2, VE - pat.RR * VDanat);
    const VO2 = this.VO2() + this.VO2breathing(VE, m, this.capacity(m)), VCO2 = VO2 * p.RQ;
    const Q = Math.max(0.5, inp.CO);
    const PIO2 = clamp(p.FiO2, 0.05, 1) * (p.Pb - PH2O);
    const dys = clamp(p.COHb + p.metHb, 0, 0.95);
    const Hb = inp.Hb;
    const embBurden = LOBES.reduce((a, id) => a + LOBE_PERF[id] * clamp((p as any)[`emb${id}`] ?? 0, 0, 1), 0);
    // V/Q spread: narrowed airways, destroyed and scarred lung, interstitial water, and the flow an embolus diverts onto lung not ventilated for it
    const sigma = 0.22 + 0.8 * p.bronchoconstriction + 0.35 * p.emphysema + 0.6 * p.fibrosis + 0.7 * this.interstitial + 2.6 * embBurden + clamp(p.vqMismatch, 0, 2);
    // Diffusion: the fraction of the alveolar–capillary O2 gap left at the end of the capillary; shorter transit at high flow
    const uDiff = Math.exp((-4 * Math.max(0.01, m.DL)) / (Q / 5.2));

    const ventW = m.st.map((l) => LOBE_VENT[l.id] * l.aerated);
    const ventSum = ventW.reduce((a, x) => a + x, 0) || 1e-6;

    const satAt = (po2: number, pco2: number) => satO2(po2, phOf(hco3At(inp.sbc, pco2), pco2), pco2, p.COHb, inp.temp);
    const cO2 = (po2: number, pco2: number) => contentO2(po2, satAt(po2, pco2), Hb, dys);
    const cCO2 = (pco2: number, S: number) => contentCO2(pco2, S, inp.sbc);
    const invO2 = (C: number, pco2: number) => { let lo = 0, hi = 100; for (let k = 0; k < 36; k++) { const mid = (lo + hi) / 2; if (cO2(mid, pco2) < C) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    const invCO2 = (C: number, S: number) => { let lo = 0, hi = 30; for (let k = 0; k < 36; k++) { const mid = (lo + hi) / 2; if (cCO2(mid, S) < C) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    const hpvC = (pao2: number) => 1 - clamp(p.hpv, 0, 1) * (1 - sigm((pao2 - 7) / 1.2));

    let PvO2 = this.Pv.O2, PvCO2 = this.Pv.CO2;
    const lobePAO2 = m.st.map((_, i) => this.lobePA[i] ?? 13);
    let units: Unit[] = [];
    let CaO2 = 0, CaCO2 = 0, PaO2 = this.PaO2, PaCO2 = this.PaCO2, G = 1, hpvMean = 0;

    /* One gas-exchanging unit: O2 uptake by blood equals O2 delivered by ventilation, and the same for CO2
       given off, both through the dissociation curves. Newton's method from the last solution. */
    const solveUnit = (u: Unit, key: string, CvO2: number, CvCO2: number) => {
      const lo1 = Math.min(PvO2, PIO2), hi1 = PIO2;
      const F = (a: number, c: number): [number, number] => {
        const pc = a - (a - PvO2) * u.diffU;
        const S = satAt(pc, c);
        return [10 * u.Q * (contentO2(pc, S, Hb, dys) - CvO2) - K_GAS * u.VA * (PIO2 - a), 10 * u.Q * (CvCO2 - cCO2(c, S)) - K_GAS * u.VA * c];
      };
      const w = this.warm.get(key);
      let a = clamp(w?.[0] ?? (lo1 + hi1) / 2, lo1, hi1), c = clamp(w?.[1] ?? PvCO2 * 0.85, 0, PvCO2);
      const scale = 10 * u.Q + K_GAS * u.VA;
      let f = F(a, c), ok = false;
      for (let k = 0; k < 14; k++) {
        if (Math.abs(f[0]) + Math.abs(f[1]) < 2e-5 * scale) { ok = true; break; }
        const ha = 1e-4 * Math.max(1, a), hc = 1e-4 * Math.max(1, c);
        const fa = F(a + ha, c), fc = F(a, c + hc);
        const J00 = (fa[0] - f[0]) / ha, J01 = (fc[0] - f[0]) / hc, J10 = (fa[1] - f[1]) / ha, J11 = (fc[1] - f[1]) / hc;
        const det = J00 * J11 - J01 * J10;
        if (!Number.isFinite(det) || Math.abs(det) < 1e-12) break;
        let da = (-f[0] * J11 + f[1] * J01) / det, dc = (-J00 * f[1] + J10 * f[0]) / det;
        let lam = 1;
        for (let b = 0; b < 8; b++) {
          const na = clamp(a + lam * da, lo1, hi1), nc = clamp(c + lam * dc, 0, PvCO2 * 1.02);
          const nf = F(na, nc);
          if (Math.abs(nf[0]) + Math.abs(nf[1]) < Math.abs(f[0]) + Math.abs(f[1]) || b === 7) { a = na; c = nc; f = nf; break; }
          lam /= 2;
        }
      }
      if (!ok && Math.abs(f[0]) + Math.abs(f[1]) > 1e-3 * scale) {
        // fall back to alternating bisection, which cannot fail
        for (let gs = 0; gs < 6; gs++) {
          let lo = lo1, hi = hi1;
          for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (F(mid, c)[0] > 0) hi = mid; else lo = mid; }
          a = (lo + hi) / 2;
          lo = 0; hi = PvCO2;
          for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (F(a, mid)[1] > 0) lo = mid; else hi = mid; }
          c = (lo + hi) / 2;
        }
      }
      this.warm.set(key, [a, c]);
      u.PO2 = a; u.PCO2 = c;
    };

    for (let iter = 0; iter < 30; iter++) {
      const SvO2 = satAt(PvO2, PvCO2);
      const CvO2 = contentO2(PvO2, SvO2, Hb, dys), CvCO2 = cCO2(PvCO2, SvO2);
      // Perfusion: lobes are resistances in parallel. Emboli remove vessels; hypoxic vasoconstriction
      // narrows those whose alveoli are hypoxic (aerated lung by its own alveolar O2, airless lung by venous O2).
      const hv = hpvC(PvO2);
      const g = m.st.map((l, i) => LOBE_PERF[l.id] * (1 - l.emb) * (l.aerated * hpvC(lobePAO2[i]) + l.solidFrac * hv + l.collapsed * 0.45 * hv));
      G = g.reduce((a, x) => a + x, 0);
      hpvMean = m.st.reduce((a, l, i) => a + LOBE_PERF[l.id] * (1 - hpvC(lobePAO2[i])), 0);
      const Qlung = Q * 0.98;          // 2 % bypasses the alveoli altogether (bronchial and Thebesian veins)
      units = [{ lobe: -1, VA: 0, Q: Q * 0.02, kind: 'base', PO2: PvO2, PCO2: PvCO2, diffU: 0 }];
      m.st.forEach((l, i) => {
        const qL = Qlung * g[i] / Math.max(1e-6, G);
        const aer = LOBE_PERF[l.id] * (1 - l.emb) * l.aerated * hpvC(lobePAO2[i]);
        const qAer = g[i] > 0 ? qL * aer / g[i] : 0;
        const qShunt = qL - qAer;
        const vaL = VA * ventW[i] / ventSum;
        if (qShunt > 1e-6) units.push({ lobe: i, VA: 0, Q: qShunt, kind: 'shunt', PO2: PvO2, PCO2: PvCO2, diffU: 0 });
        // Embolised segments are still ventilated but receive no blood: alveolar dead space.
        // Emphysema destroys the capillaries of the alveolar walls with them: more alveolar dead space.
        const dead = 1 - (1 - l.emb) * (1 - 0.4 * clamp(p.emphysema, 0, 1));
        if (dead > 0 && vaL > 0) units.push({ lobe: i, VA: vaL * dead, Q: 0, kind: 'dead', PO2: PIO2, PCO2: 0, diffU: 0 });
        const vaP = vaL * (1 - dead);
        if (vaP > 1e-6 || qAer > 1e-6) {
          /* A continuous spread of V/Q within the lobe (Wagner's log-normal), discretised into equal-perfusion units:
             unit k gets ventilation ∝ e^(σ·z_k). Hypoxic vasoconstriction then acts on each unit by its own alveolar
             O2, holding blood back from the poorly ventilated ones (and releasing it when the inspired O2 rises).
             On a high FiO2, units below a critical inspired V/Q absorb their gas faster than it is replaced and
             collapse: absorption atelectasis turns them into shunt. */
          const wsum = VQ_Z.reduce((a, z) => a + Math.exp(sigma * z), 0);
          const hs = VQ_Z.map((_, k) => hpvC(this.warm.get(`${i}:${k}`)?.[0] ?? lobePAO2[i]));
          const hsum = hs.reduce((a, x) => a + x, 0);
          const crit = 0.1 * Math.max(0, (clamp(p.FiO2, 0.21, 1) - 0.21) / 0.79) ** 2;
          let absorbed = 0;
          VQ_Z.forEach((z, k) => {
            let va = vaP * Math.exp(sigma * z) / wsum, q = qAer * hs[k] / hsum;
            const vq = va / Math.max(1e-6, qAer / VQ_Z.length);
            if (crit > 0 && vq < crit) { const f = clamp((crit - vq) / crit, 0, 1) * 0.8; absorbed += q * f; va *= 1 - f; q *= 1 - f; }
            units.push({ lobe: i, VA: va, Q: q, kind: 'vq', PO2: 0, PCO2: 0, diffU: uDiff, key: `${i}:${k}` });
          });
          if (absorbed > 1e-7) units.push({ lobe: i, VA: 0, Q: absorbed, kind: 'shunt', PO2: PvO2, PCO2: PvCO2, diffU: 0 });
        }
      });
      let j = 0;
      for (const u of units) {
        if (u.kind === 'vq') {
          if (u.Q < 1e-7) { u.PO2 = PIO2; u.PCO2 = 0; }
          else if (u.VA < 1e-7) { u.PO2 = PvO2; u.PCO2 = PvCO2; }
          else solveUnit(u, u.key ?? `${u.lobe}:${j}`, CvO2, CvCO2);
        } else if (u.kind !== 'dead') { u.PO2 = PvO2; u.PCO2 = PvCO2; }
        j++;
      }
      // the arterial blood is the perfusion-weighted mixture
      let qo = 0, qc = 0, qs = 0;
      for (const u of units) {
        if (u.Q <= 0) continue;
        const pc = u.kind === 'vq' ? u.PO2 - (u.PO2 - PvO2) * u.diffU : u.PO2;
        const S = satAt(pc, u.PCO2);
        qo += u.Q * contentO2(pc, S, Hb, dys); qc += u.Q * cCO2(u.PCO2, S); qs += u.Q;
      }
      CaO2 = qo / qs; CaCO2 = qc / qs;
      PaCO2 = invCO2(CaCO2, satAt(PaO2, PaCO2));
      PaO2 = invO2(CaO2, PaCO2);
      // mixed venous blood from metabolism (Fick)
      const nCvO2 = Math.max(0.3, CaO2 - VO2 / (10 * Q)), nCvCO2 = CaCO2 + VCO2 / (10 * Q);
      const nPvO2 = invO2(nCvO2, PvCO2);
      const nPvCO2 = invCO2(nCvCO2, satAt(nPvO2, PvCO2));
      const d = Math.abs(nPvO2 - PvO2) + Math.abs(nPvCO2 - PvCO2);
      PvO2 = 0.3 * PvO2 + 0.7 * nPvO2; PvCO2 = 0.3 * PvCO2 + 0.7 * nPvCO2;
      m.st.forEach((_, i) => {
        let va = 0, s = 0;
        for (const u of units) if (u.lobe === i && u.kind === 'vq') { va += u.VA; s += u.VA * u.PO2; }
        lobePAO2[i] = va > 1e-7 ? s / va : PvO2;
      });
      if (iter > 2 && d < 2e-4) break;
    }
    this.lobePA = lobePAO2;

    const SaO2 = satAt(PaO2, PaCO2);
    const SvO2 = satAt(PvO2, PvCO2);
    const vaTot = units.reduce((a, u) => a + u.VA, 0);
    const PACO2mix = vaTot > 0 ? units.reduce((a, u) => a + u.VA * u.PCO2, 0) / vaTot : 0;
    const PECO2 = PACO2mix * VA / VE;
    // the ideal alveolar gas equation, as the clinician calculates it from the blood gas
    const PAO2ideal = PIO2 - PaCO2 * (1 - clamp(p.FiO2, 0, 1) * (1 - p.RQ)) / p.RQ;
    const CcIdeal = cO2(PAO2ideal, PaCO2);
    const CvO2 = contentO2(PvO2, SvO2, Hb, dys);
    const qTot = units.reduce((a, u) => a + u.Q, 0);
    const trueShunt = units.filter((u) => u.kind === 'shunt' || u.kind === 'base').reduce((a, u) => a + u.Q, 0) / qTot;
    const lobes: LobeState[] = m.st.map((l, i) => {
      const us = units.filter((u) => u.lobe === i);
      const va = us.reduce((a, u) => a + u.VA, 0), q = us.reduce((a, u) => a + u.Q, 0);
      const vq = us.filter((u) => u.kind === 'vq');
      const vva = vq.reduce((a, u) => a + u.VA, 0);
      return {
        id: l.id, side: l.side, aerated: l.aerated, consolidated: l.cons * (1 - l.collapsed), flooded: l.flooded * (1 - l.collapsed), collapsed: l.collapsed, compressed: l.compressed, ptx: l.ptx,
        ventShare: va / Math.max(1e-6, vaTot), perfShare: q / qTot, shuntShare: us.filter((u) => u.kind === 'shunt').reduce((a, u) => a + u.Q, 0) / qTot,
        VQ: q > 1e-7 ? va / q : Infinity, PAO2: vva > 0 ? vq.reduce((a, u) => a + u.VA * u.PO2, 0) / vva : PvO2,
        PACO2: vva > 0 ? vq.reduce((a, u) => a + u.VA * u.PCO2, 0) / vva : PvCO2, embolus: l.emb,
      };
    });
    return {
      m, pat, VA, VDanat, VO2, VCO2, PIO2, PaO2, PaCO2, PvO2, PvCO2, SaO2, SvO2, CaO2, CvO2, PAO2ideal, PACO2mix, PECO2,
      shunt: trueShunt, venousAdmixture: clamp((CcIdeal - CaO2) / Math.max(0.1, CcIdeal - CvO2), 0, 1),
      G, hpvMean, lobes, Q,
    };
  }
  private lobePA: number[] = [];

  /* ---- Starling: water in the lung -------------------------------------------------- */
  private starling() {
    const inp = this.inp, leak = clamp(this.p.capillaryLeak, 0, 1);
    const Pcap = inp.Pla + 0.4 * Math.max(0, inp.Ppa - inp.Pla);
    const Kf = 1 + 4 * leak, sigmaR = 0.8 * (1 - 0.8 * leak);
    const piC = 25 * (inp.albumin / 42), piI = 14 * (inp.albumin / 42) ** 0.5;
    const NFP = (Pcap + 2) - sigmaR * (piC - piI);
    const J = Kf * NFP;                                  // relative filtration; lymph clears up to about twice normal unnoticed
    const interstitial = clamp((J - 8) / 8, 0, 1);
    const alveolar = clamp((J - 15) / 20, 0, 0.75);
    return { Pcap, J, interstitial, alveolar };
  }

  /* ---- time ---------------------------------------------------------------------------- */
  /** Jump straight to the steady state for the current parameters and inputs (used when a patient is created). */
  equilibrate(): void {
    const s = this.starling();
    this.interstitial = s.interstitial;
    LOBES.forEach((id, i) => { this.water[i] = clamp(s.alveolar * LOBE_GRAVITY[id], 0, 0.9); });
    this.sinceSolve = 0;
    // The breathing the centre ends up with is where what it asks for (given the gases that ventilation
    // produces) equals the ventilation itself. That function falls as ventilation rises: find its root.
    const g = (VE: number) => {
      const sol = this.solve(VE);
      this.Pv = { O2: sol.PvO2, CO2: sol.PvCO2 };
      this.PaO2 = sol.PaO2; this.PaCO2 = sol.PaCO2;
      return { sol, r: this.delivered(this.demand(sol.PaO2, sol.PaCO2, sol.m), this.capacity(sol.m)) - VE };
    };
    let a = 0.6, b = Math.max(2, this.capacity() * 1.05);
    let ga = g(a).r, gb = g(b).r;
    let side = 0;
    let best = { VE: this.VEdrive, sol: null as ReturnType<Respiratory['solve']> | null };
    if (ga <= 0) { best = { VE: a, sol: g(a).sol }; }
    else if (gb >= 0) { best = { VE: b, sol: g(b).sol }; }
    else {
      for (let k = 0; k < 40; k++) {
        // Illinois regula falsi: bracketed, so it always converges
        const c = (a * gb - b * ga) / (gb - ga);
        const { sol, r } = g(c);
        best = { VE: c, sol };
        if (Math.abs(r) < 2e-3 || Math.abs(b - a) < 1e-3) break;
        if (r * gb > 0) { b = c; gb = r; if (side === -1) ga /= 2; side = -1; }
        else { a = c; ga = r; if (side === 1) gb /= 2; side = 1; }
      }
    }
    this.VEdrive = best.VE;
    this.sol = best.sol ?? this.solve(best.VE);
    this.PaO2 = this.sol.PaO2; this.PaCO2 = this.sol.PaCO2;
    this.Pv = { O2: this.sol.PvO2, CO2: this.sol.PvCO2 };
    this.fe = null;
    this.Pmax = (this.sol.pat.VT / this.sol.m.Crs) * 1.6;
    this.V = 0;
  }

  /** Advance by `seconds`: breathing, and the slower drift of gases, drive and lung water toward their targets. */
  advance(seconds: number): void {
    const dt = 0.01;
    let left = seconds;
    while (left > 1e-9) {
      const h = Math.min(dt, left);
      left -= h;
      this.t += h;
      this.sinceSolve += h;
      if (this.sinceSolve >= 0.5 || !this.sol) {
        const span = Math.min(this.sinceSolve, 5);
        this.sinceSolve = 0;
        // lung water, then the gases, then the drive: each relaxes toward what the others now imply
        const s = this.starling();
        const ki = 1 - Math.exp(-span / (s.interstitial > this.interstitial ? 90 : 900));
        this.interstitial += (s.interstitial - this.interstitial) * ki;
        LOBES.forEach((id, i) => {
          const target = clamp(s.alveolar * LOBE_GRAVITY[id], 0, 0.9);
          const k = 1 - Math.exp(-span / (target > this.water[i] ? 90 : 900));
          this.water[i] += (target - this.water[i]) * k;
        });
        const sol = this.solve(this.VEdrive);
        this.sol = sol;
        this.fe = null;
        this.Pv = { O2: sol.PvO2, CO2: sol.PvCO2 };
        // blood O2 follows within a circulation time; CO2 is buffered by the body's large stores
        this.PaO2 += (sol.PaO2 - this.PaO2) * (1 - Math.exp(-span / 8));
        this.PaCO2 += (sol.PaCO2 - this.PaCO2) * (1 - Math.exp(-span / 50));
        const target = this.delivered(this.demand(this.PaO2, this.PaCO2, sol.m), this.capacity(sol.m));
        this.VEdrive += (target - this.VEdrive) * (1 - Math.exp(-span / 4));
      }
      this.breathe(h);
    }
  }
  private fe: ReturnType<Respiratory['forcedExpiration']> | null = null;

  private breathe(h: number): void {
    const sol = this.sol, pat = sol.pat, m = sol.m;
    const Ttot = pat.Ti + pat.Te;
    this.breathT += h;
    if (this.breathT >= Ttot) {
      // end of a breath: adjust the inspiratory pressure toward the tidal volume the centre wants
      const got = Math.max(0.02, this.vtThis);
      this.Pmax = clamp(this.Pmax * (pat.VT / got) ** 0.7, 0.5, 60 * clamp(this.p.muscleStrength, 0.05, 1.3));
      this.breathT -= Ttot;
      this.endExp = this.V;
      this.vStart = this.V;
      this.vtThis = 0;
    }
    const insp = this.breathT < pat.Ti;
    this.phase = insp ? 'insp' : 'exp';
    const Pmus = insp ? this.Pmax * Math.sin((Math.PI * this.breathT) / pat.Ti) : 0;
    const R = insp ? m.Ri : m.Re;
    const tau = R * m.Crs;
    const Vinf = Pmus * m.Crs;                         // V measured above the relaxed FRC
    const Vn = Vinf + (this.V - Vinf) * Math.exp(-h / tau);
    this.flow = (Vn - this.V) / h;
    this.V = Vn;
    if (insp) this.vtThis = Math.max(this.vtThis, this.V - this.vStart);
    this.Pmus = Pmus;
  }
  private Pmus = 0;

  snapshot(): RespSnapshot {
    const sol = this.sol, m = sol.m, pat = sol.pat, p = this.p;
    const pH = phOf(hco3At(this.inp.sbc, this.PaCO2), this.PaCO2);
    const SaO2 = satO2(this.PaO2, pH, this.PaCO2, p.COHb, this.inp.temp);
    const dys = clamp(p.COHb + p.metHb, 0, 0.95);
    const CaO2 = contentO2(this.PaO2, SaO2, this.inp.Hb, dys);
    const fe = this.fe ?? (this.fe = this.forcedExpiration());
    const dem = this.demand(this.PaO2, this.PaCO2, m), cap = this.capacity(m);
    const s = this.starling();
    // cmH2O: alveolar pressure drives flow through the airways; pleural pressure adds the lung's recoil (≈ −5 at FRC)
    const Palv = -(this.phase === 'insp' ? m.Ri : m.Re) * this.flow;
    const Ppl = Palv - (5 + this.V / m.CL);
    return {
      t: this.t, V: this.V, flow: this.flow, Pmus: this.Pmus, Palv, Ppl, phase: this.phase, breathT: this.breathT, EELV: m.FRC + this.endExp,
      RR: pat.RR, VT: pat.VT, VE: this.VEdrive, VA: sol.VA, VDanat: sol.VDanat, Ti: pat.Ti, Te: pat.Te, iPEEP: Math.max(0, this.endExp / m.Crs),
      Crs: m.Crs * 1000, Raw: (m.Ri + m.Re) / 2, tauE: m.Re * m.Crs, effort: dem / cap, demand: dem, capacity: cap, afferent: this.afferent(m),
      PIO2: sol.PIO2, PAO2ideal: sol.PAO2ideal, PaO2: this.PaO2, PaCO2: this.PaCO2, PvO2: sol.PvO2, PvCO2: sol.PvCO2, pH, hco3: hco3At(this.inp.sbc, this.PaCO2),
      SaO2, SvO2: sol.SvO2, FO2Hb: SaO2 * (1 - dys), FHHb: (1 - SaO2) * (1 - dys), COHb: p.COHb, metHb: p.metHb, CaO2, CvO2: sol.CvO2,
      DO2: sol.Q * CaO2 * 10, VO2: sol.VO2, VCO2: sol.VCO2, AaGradient: sol.PAO2ideal - this.PaO2, shunt: sol.shunt, venousAdmixture: sol.venousAdmixture,
      EtCO2: sol.PACO2mix, PECO2: sol.PECO2, VDVT: clamp((this.PaCO2 - sol.PECO2) / Math.max(0.1, this.PaCO2), 0, 1),
      // capillary blood, halfway between arterial and mixed venous: what colours lips and tongue
      deoxyHb: this.inp.Hb * (1 - dys) * (1 - (SaO2 + sol.SvO2) / 2),
      RpulMult: this.rpulMult(),
      Pcap: s.Pcap, filtration: s.J, interstitial: this.interstitial, HPVtone: sol.hpvMean,
      TLC: m.TLC, RV: m.RV, FRC: m.FRC, FVC: fe.FVC, FEV1: fe.FEV1, PEF: fe.PEF,
      DLCOpct: 100 * m.DL * (0.7 + 0.3 * this.inp.Hb / 146), pred: this.pred,
      lobes: sol.lobes, inputs: { ...this.inp }, params: { ...this.p },
    };
  }

  /** Pulmonary vascular resistance relative to normal: lobes in parallel, emboli removing vessels (and the vasoconstriction they provoke), hypoxic vasoconstriction narrowing them. */
  rpulMult(): number {
    const emb = LOBES.reduce((a, id) => a + LOBE_PERF[id] * clamp((this.p as any)[`emb${id}`] ?? 0, 0, 1), 0);
    return (1 / Math.max(0.05, this.sol?.G ?? 1)) * (1 + 0.8 * emb);
  }

  /** The controller's response line for the chapter diagram: ventilation delivered at each PaCO2, with PaO2 as it is now. */
  controllerCurve(paco2: number[]): number[] {
    const m = this.mechanics(), cap = this.capacity(m);
    return paco2.map((x) => this.delivered(this.demand(this.PaO2, x, m), cap));
  }
  /** The plant: minute ventilation needed for each PaCO2 at the current CO2 production, dead space and rate. */
  hyperbola(paco2: number[]): number[] {
    const sol = this.sol; if (!sol) return paco2.map(() => NaN);
    // through the current operating point: effective alveolar ventilation is 0.115·VCO2/PaCO2, and each litre of
    // minute ventilation currently buys VAeff/VE of it (anatomical and alveolar dead space)
    const vaEff = (0.1151 * sol.VCO2) / Math.max(0.3, this.PaCO2);
    const k = this.VEdrive / Math.max(0.1, vaEff);
    return paco2.map((x) => (k * 0.1151 * sol.VCO2) / Math.max(0.3, x));
  }
  /** Saturation along the dissociation curve at the patient's current pH, CO2 and temperature. */
  satCurve(po2: number[]): number[] {
    const pH = phOf(hco3At(this.inp.sbc, this.PaCO2), this.PaCO2);
    return po2.map((x) => satO2(x, pH, this.PaCO2, this.p.COHb, this.inp.temp));
  }

  /** What the carotid bodies and the sensation of breathlessness add to sympathetic outflow (0–1), for the circulation. */
  chemoDrive(): number {
    const Pmm = this.PaO2 * MMHG_PER_KPA;
    const hyp = Math.min(3, 20 * Math.max(0, 1 / Math.max(4, Pmm - 25) - 1 / 65));
    return clamp(0.6 * hyp + 0.3 * Math.max(0, this.PaCO2 - 6.5) + 0.25 * this.afferent(), 0, 1);
  }

  serialize() { return { PaO2: this.PaO2, PaCO2: this.PaCO2, VEdrive: this.VEdrive, water: [...this.water], interstitial: this.interstitial, t: this.t, Pv: { ...this.Pv } }; }
  restore(s: ReturnType<Respiratory['serialize']>) { Object.assign(this, { PaO2: s.PaO2, PaCO2: s.PaCO2, VEdrive: s.VEdrive, water: [...s.water], interstitial: s.interstitial, t: s.t, Pv: { ...s.Pv } }); this.sinceSolve = 1e9; this.sol = this.solve(this.VEdrive); }
}

/** Pulse oximetry: red and infrared absorbance of the pulsatile blood, read through a calibration made on O2Hb and HHb alone. */
export const OXIMETER_EPS = { red: { O2Hb: 0.10, HHb: 0.80, COHb: 0.07, MetHb: 0.65 }, ir: { O2Hb: 0.25, HHb: 0.16, COHb: 0.003, MetHb: 0.60 } };
export function pulseOximeter(r: Pick<RespSnapshot, 'FO2Hb' | 'FHHb' | 'COHb' | 'metHb'>): { SpO2: number; R: number } {
  const e = OXIMETER_EPS;
  const red = e.red.O2Hb * r.FO2Hb + e.red.HHb * r.FHHb + e.red.COHb * r.COHb + e.red.MetHb * r.metHb;
  const ir = e.ir.O2Hb * r.FO2Hb + e.ir.HHb * r.FHHb + e.ir.COHb * r.COHb + e.ir.MetHb * r.metHb;
  const R = red / Math.max(1e-6, ir);
  const S = (e.red.HHb - R * e.ir.HHb) / ((e.red.HHb - e.red.O2Hb) + R * (e.ir.O2Hb - e.ir.HHb));
  return { SpO2: clamp(100 * S, 0, 100), R };
}
