import { ANAES } from '../../evidence/ect-anaesthesia.ts';
import { ECT } from '../../evidence/ect.ts';

/* ===========================================================================
   The anaesthetic for ECT (part 2b, second half): what the drugs do between
   the syringe and the brain, the muscles and the waking patient.

   - Propofol moves through Schnider's three compartments to its effect site;
     esketamine is counted with it for the depth of hypnosis (an assumption:
     no ketamine pharmacokinetics). Once asleep, the patient wakes when the
     level falls below the one Iwakiri measured at return of consciousness.
   - The anticonvulsant load is propofol at its effect site plus, in
     propofol's units, a regular benzodiazepine not reversed by flumazenil.
     It hastens the end of the seizure (the relay's activity-driven
     hyperpolarisation grows faster), and does not change the threshold.
   - Rocuronium moves through Magorian's two compartments to the adductor
     pollicis's effect site (Vega 2016); sugammadex binds it one to one in the
     plasma, so the effect site empties at its own rate. Succinylcholine is the
     alternative, on a recovery curve from Lee 2009.
   - The first twitch (T1, fraction of control), the train-of-four count and
     ratio follow; the diaphragm breathes again once the hand's first twitch is
     back to a quarter.

   Concentrations in mg/L (= µg/mL), times in s, rates per minute as published.
=========================================================================== */

export interface Demographics { age: number; weightKg: number; heightCm: number; sex: 'F' | 'M' }
/** the station's patient: 59 years (the orders' age method), an average man */
export const ECT_PATIENT: Demographics = { age: 59, weightKg: 76, heightCm: 176, sex: 'M' };

export type AnaestheticId = 'propofol' | 'esketamine' | 'rocuronium' | 'sugammadex' | 'succinylcholine' | 'flumazenil';

/** lean body mass (kg), James's formula, as Schnider's model uses it */
export function leanBodyMass(p: Demographics) {
  const w = p.weightKg, h = p.heightCm;
  return p.sex === 'M' ? 1.1 * w - 128 * (w / h) ** 2 : 1.07 * w - 148 * (w / h) ** 2;
}

/** Schnider's propofol model for a patient: volumes (L), rate constants (1/min) */
export function schnider(p: Demographics) {
  const lbm = leanBodyMass(p);
  const v1 = ANAES.propV1, v2 = ANAES.propV2 - 0.391 * (p.age - 53), v3 = ANAES.propV3;
  const cl1 = ANAES.propCl1 + 0.0456 * (p.weightKg - 77) - 0.0681 * (lbm - 59) + 0.0264 * (p.heightCm - 177);
  const cl2 = ANAES.propCl2 - 0.024 * (p.age - 53), cl3 = ANAES.propCl3;
  return { v1, k10: cl1 / v1, k12: cl2 / v1, k21: cl2 / v2, k13: cl3 / v1, k31: cl3 / v3, ke0: ANAES.propKe0 };
}

/** Magorian's two-compartment rocuronium model, scaled to the weight: V1 (L), rate constants (1/min) */
export function rocuroniumModel(p: Demographics) {
  const s = p.weightKg / 70, v1 = ANAES.rocV1 * s, v2 = (ANAES.rocVss - ANAES.rocV1) * s, cl = ANAES.rocCl * s;
  /* the intercompartmental clearance that gives the measured elimination half-life:
     αβ = k10 k21 and α + β = k10 + k12 + k21, with β = ln 2 / t½ */
  const k10 = cl / v1, b = Math.LN2 / ANAES.rocHalfLife;
  /* k21 = Q/v2, k12 = Q/v1: k10 Q/(v2 b) + b = k10 + Q/v1 + Q/v2  →  Q (k10/(v2 b) − 1/v1 − 1/v2) = k10 − b */
  const Q = (k10 - b) / (k10 / (v2 * b) - 1 / v1 - 1 / v2);
  return { v1, k10, k12: Q / v1, k21: Q / v2, ke0: ANAES.rocKe0 };
}

/** the propofol effect-site concentration a dose (mg/kg) has `seconds` after it, in a patient: for the fits */
export function propofolCeAfter(p: Demographics, mgPerKg: number, seconds: number) {
  const a = new Anaesthesia(p); a.give('propofol', mgPerKg * p.weightKg); a.step(seconds); return a.propofolCe;
}

export class Anaesthesia {
  readonly patient: Demographics;
  private P: ReturnType<typeof schnider>;
  private R: ReturnType<typeof rocuroniumModel>;
  /** propofol (and esketamine, as propofol) in its compartments (mg) and at the effect site (mg/L) */
  private prop = [0, 0, 0]; propofolCe = 0;
  private esk = [0, 0, 0]; esketamineCe = 0;
  /** rocuronium, free, in its two compartments (mg), and at the adductor pollicis's effect site (mg/L) */
  private roc = [0, 0]; rocuroniumCe = 0;
  /** sugammadex not yet bound (mg) */
  sugammadexFree = 0;
  /** succinylcholine given at (s), or null */
  suxAt: number | null = null;
  /** a regular benzodiazepine: lorazepam a day (mg); flumazenil given (mg) */
  benzoPerDay = 0; flumazenil = 0;
  /** what was given (mg) and when (s) */
  readonly given: Array<{ drug: AnaestheticId; mg: number; at: number }> = [];
  t = 0;
  /** the patient has been asleep (the depth crossed 1 after a hypnotic) */
  slept = false;

  constructor(p: Demographics = ECT_PATIENT) { this.patient = p; this.P = schnider(p); this.R = rocuroniumModel(p); }

  give(drug: AnaestheticId, mg: number) {
    if (!(mg > 0)) return;
    this.given.push({ drug, mg, at: this.t });
    switch (drug) {
      case 'propofol': this.prop[0] += mg; break;
      case 'esketamine': this.esk[0] += mg * ANAES.esketaminePotency; break;
      case 'rocuronium': this.roc[0] += mg; this.bind(); break;
      case 'sugammadex': this.sugammadexFree += mg; this.bind(); break;
      case 'succinylcholine': if (this.suxAt == null) this.suxAt = this.t; break;
      case 'flumazenil': this.flumazenil += mg; break;
    }
  }
  /** sugammadex takes free rocuronium out of the plasma one molecule for one */
  private bind() {
    const can = Math.min(this.roc[0], this.sugammadexFree / ANAES.sugammadexRatio);
    if (can > 0) { this.roc[0] -= can; this.sugammadexFree -= can * ANAES.sugammadexRatio; }
  }

  /** advance by `seconds` */
  step(seconds: number) {
    const n = Math.max(1, Math.ceil(seconds / 0.5)), h = seconds / n / 60;   // minutes per substep
    const P = this.P, R = this.R;
    for (let k = 0; k < n; k++) {
      for (const [x, ce] of [[this.prop, 'propofolCe'], [this.esk, 'esketamineCe']] as const) {
        const [a1, a2, a3] = x;
        const d1 = -(P.k10 + P.k12 + P.k13) * a1 + P.k21 * a2 + P.k31 * a3;
        x[0] += h * d1; x[1] += h * (P.k12 * a1 - P.k21 * a2); x[2] += h * (P.k13 * a1 - P.k31 * a3);
        const cp = a1 / P.v1; this[ce] += h * P.ke0 * (cp - this[ce]);
      }
      const [r1, r2] = this.roc;
      this.roc[0] += h * (-(R.k10 + R.k12) * r1 + R.k21 * r2); this.roc[1] += h * (R.k12 * r1 - R.k21 * r2);
      if (this.sugammadexFree > 0) this.bind();
      this.rocuroniumCe += h * R.ke0 * (this.roc[0] / R.v1 - this.rocuroniumCe);
    }
    this.t += seconds;
    if (this.depth >= 1) this.slept = true;
    if (!this.apnoeaReached && !computingApnoea && this.propofolCe >= apnoeaCe(this.patient)) this.apnoeaReached = true;
  }

  /** the first twitch at the adductor pollicis, a fraction of control (1 no block, 0 full) */
  get t1(): number {
    const c = this.rocuroniumCe, roc = c > 0 ? 1 - c ** ANAES.rocHill / (c ** ANAES.rocHill + ANAES.rocCe50 ** ANAES.rocHill) : 1;
    return Math.min(roc, this.suxT1);
  }
  /** succinylcholine's first twitch: full block from its onset, back from `suxRecoveryFrom` to 90 % at `suxRecovery90` */
  private get suxT1(): number {
    if (this.suxAt == null) return 1;
    const x = this.t - this.suxAt, on = SUX_ONSET;
    if (x < on) return 1 - x / on;
    if (x < ANAES.suxRecoveryFrom) return 0;
    return Math.min(1, (0.9 * (x - ANAES.suxRecoveryFrom)) / (ANAES.suxRecovery90 - ANAES.suxRecoveryFrom));
  }
  /** train-of-four count (0–4): the twitches fade out at about 75, 80, 90 and 100 % depression of the first (Lee 1975) */
  get tofCount(): number { const d = 1 - this.t1; return d >= 0.98 ? 0 : d >= 0.9 ? 1 : d >= 0.8 ? 2 : d >= 0.75 ? 3 : 4; }
  /** train-of-four ratio (only meaningful with four twitches; succinylcholine does not fade, so its ratio is 1 while twitches show) */
  get tofRatio(): number { if (this.tofCount < 4) return 0; return this.suxAt != null && this.rocuroniumCe < 0.05 ? 1 : this.t1 ** ANAES.tofRatioPower; }
  /** the diaphragm breathes (more resistant than the hand) */
  get diaphragmFree(): boolean { return this.t1 >= ANAES.diaphragmT1; }
  /** the propofol has reached the apnoea level since it was given (the breathing goes on until then) */
  apnoeaReached = false;
  /** the respiratory drive is there: before the propofol has reached the apnoea level, and again once it has fallen below
      it (esketamine leaves it alone) */
  get driveBack(): boolean { return !this.apnoeaReached || this.propofolCe < apnoeaCe(this.patient); }
  /** the patient breathes: the drive is back and the diaphragm is free */
  get breathes(): boolean { return this.driveBack && this.diaphragmFree; }

  /** depth of hypnosis: propofol and esketamine at the effect site against the wake level (1 at the edge) */
  get depth(): number { return (this.propofolCe + this.esketamineCe) / ANAES.wakeCe; }
  /** asleep: from when the hypnotic has taken hold until the level falls below the waking one */
  get asleep(): boolean { return this.slept && this.depth >= 1; }
  /** awake again after having been asleep */
  get woken(): boolean { return this.slept && this.depth < 1; }

  /** the anticonvulsant load (propofol-equivalent mg/L at the effect site) */
  get load(): number {
    const reversed = Math.min(1, this.flumazenil / ANAES.flumazenilFull);
    return this.propofolCe + ANAES.benzoLoad * this.benzoPerDay * (1 - reversed);
  }
  /** how much faster the seizure ends: the multiplier on the relay's activity-driven hyperpolarisation */
  get termination(): number { return 1 + ANAES.loadTermination * this.load; }
}

/** succinylcholine's onset to full relaxation (the station's ECT.relaxantOnset, assumed 60 s) */
export const SUX_ONSET = 60;


const apnoeaCache = new Map<string, number>();
let computingApnoea = false;
/** the propofol effect-site level below which breathing returns: what Deng 2026's dose leaves when breathing returned (`ECT.apnoeaAfterInduction`, 300 s) */
export function apnoeaCe(p: Demographics): number {
  const k = JSON.stringify(p); let v = apnoeaCache.get(k);
  if (v == null) { computingApnoea = true; try { const a = new Anaesthesia(p); a.give('propofol', ANAES.apnoeaDose * p.weightKg); a.step(ECT.apnoeaAfterInduction); v = a.propofolCe; } finally { computingApnoea = false; } apnoeaCache.set(k, v); }
  return v;
}
