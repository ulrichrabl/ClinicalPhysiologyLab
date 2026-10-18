import type { LocalizedText } from '../../model/i18n.ts';
import { ECG } from '../../evidence/ecg.ts';

/* ===========================================================================
   The heart's electrical activity, as physiology.

   Two parts. A beat scheduler decides when the atria and ventricles
   activate: the sinus node (rate from the circulation's autonomic state),
   atrial fibrillation or flutter, AV-nodal conduction and its blocks,
   escape rhythms, ventricular tachycardia and fibrillation. Each activation
   then adds its contribution to the heart's electrical dipole, the cardiac
   vector H(t) in Frank coordinates (x to the patient's left, y toward the
   feet, z toward the back), built from the activation sequence: septum,
   free walls, base; atria; repolarisation.

   Nothing here is an ECG. The ECG is a measurement: the projection of H(t)
   onto the lead vectors of electrodes placed on the skin
   (measurements/ecg.ts). Potassium, calcium and the reflex heart rate come
   from the other models; nothing in the electrical model is set to make a
   tracing look a certain way.

   The circulation drives this module through the same small interface it
   uses for the cardio domain's ECG engine (step, mechanical triggers, peek),
   so the two models stay coupled beat by beat: a ventricular activation
   starts a contraction; atrial fibrillation removes the atrial kick; a
   blocked beat is a beat the ventricle never makes.
=========================================================================== */

export type Vec3 = [number, number, number];

export interface ElectricalParams {
  /** What drives the atria. */
  atrial: 'sinus' | 'af' | 'flutter';
  /** AV-nodal conduction, 1 normal; lower lengthens the PR interval. */
  av: number;
  /** Pattern of AV block, if any. */
  avBlock: 'none' | 'wenckebach' | 'mobitz2' | 'complete';
  /** Bundle branch conduction, 1 normal, below ~0.35 functionally blocked. */
  lbb: number;
  rbb: number;
  /** Accessory pathway (pre-excitation), 0 or 1. */
  accessory: number;
  /** A ventricular rhythm that takes over. */
  ventricular: 'none' | 'vt' | 'vf';
  /** Ventricular and atrial mass or size, 1 normal. */
  lvMass: number;
  rvMass: number;
  laSize: number;
  raSize: number;
  /** Acute ischaemia: territory and transmural injury current. */
  ischaemia: 'none' | 'anterior' | 'inferior' | 'lateral' | 'subendocardial' | 'wellens';
  injury: number;
  /** Repolarisation reserve, 1 normal; above 1 a longer QT (channelopathy, drugs). */
  repolarisation: number;
  /** Sodium-channel loss in the right ventricular outflow tract (Brugada pattern), 0–1. */
  brugada: number;
  /** Diffuse epicardial inflammation, 0–1. */
  pericarditis: number;
  /** Early repolarisation (J point), 0–1. */
  earlyRepol: number;
  /** Digoxin effect, 0–1. */
  digoxin: number;
}

export const ELECTRICAL_DEFAULTS: ElectricalParams = {
  atrial: 'sinus', av: 1, avBlock: 'none', lbb: 1, rbb: 1, accessory: 0, ventricular: 'none',
  lvMass: 1, rvMass: 1, laSize: 1, raSize: 1, ischaemia: 'none', injury: 1,
  repolarisation: 1, brugada: 0, pericarditis: 0, earlyRepol: 0, digoxin: 0,
};

/** Named starting points for the Model Lab: the patterns a learner knows by name, as parameter sets. */
export const ELECTRICAL_PRESETS: Array<{ id: string; label: LocalizedText; params: Partial<ElectricalParams>; chemistry?: Record<string, number>; circulation?: Record<string, number> }> = [
  { id: 'normal', label: { en: 'Normal', de: 'Normal' }, params: {} },
  { id: 'af', label: { en: 'Atrial fibrillation', de: 'Vorhofflimmern' }, params: { atrial: 'af' } },
  { id: 'flutter', label: { en: 'Atrial flutter', de: 'Vorhofflattern' }, params: { atrial: 'flutter' } },
  { id: 'avb1', label: { en: 'First-degree AV block', de: 'AV-Block I°' }, params: { av: 0.6 } },
  { id: 'wenckebach', label: { en: 'Wenckebach (Mobitz I)', de: 'Wenckebach (Mobitz I)' }, params: { av: 0.8, avBlock: 'wenckebach' } },
  { id: 'mobitz2', label: { en: 'Mobitz II', de: 'Mobitz II' }, params: { avBlock: 'mobitz2' } },
  { id: 'chb', label: { en: 'Complete heart block', de: 'AV-Block III°' }, params: { avBlock: 'complete' } },
  { id: 'vt', label: { en: 'Ventricular tachycardia', de: 'Ventrikuläre Tachykardie' }, params: { ventricular: 'vt' } },
  { id: 'vf', label: { en: 'Ventricular fibrillation', de: 'Kammerflimmern' }, params: { ventricular: 'vf' } },
  { id: 'lbbb', label: { en: 'Left bundle branch block', de: 'Linksschenkelblock' }, params: { lbb: 0.1 } },
  { id: 'rbbb', label: { en: 'Right bundle branch block', de: 'Rechtsschenkelblock' }, params: { rbb: 0.1 } },
  { id: 'wpw', label: { en: 'Pre-excitation (WPW)', de: 'Präexzitation (WPW)' }, params: { accessory: 1 } },
  { id: 'lvh', label: { en: 'Left ventricular hypertrophy', de: 'Linksventrikuläre Hypertrophie' }, params: { lvMass: 1.7 } },
  { id: 'rvh', label: { en: 'Right ventricular hypertrophy', de: 'Rechtsventrikuläre Hypertrophie' }, params: { rvMass: 2.2, raSize: 1.4 } },
  { id: 'stemi-anterior', label: { en: 'Anterior STEMI', de: 'Vorderwand-STEMI' }, params: { ischaemia: 'anterior', injury: 1 } },
  { id: 'stemi-inferior', label: { en: 'Inferior STEMI', de: 'Hinterwand-STEMI (inferior)' }, params: { ischaemia: 'inferior', injury: 1 } },
  { id: 'stemi-lateral', label: { en: 'Lateral STEMI', de: 'Lateralwand-STEMI' }, params: { ischaemia: 'lateral', injury: 1 } },
  { id: 'nstemi', label: { en: 'Subendocardial ischaemia', de: 'Subendokardiale Ischämie' }, params: { ischaemia: 'subendocardial', injury: 1 } },
  { id: 'wellens', label: { en: 'Wellens pattern', de: 'Wellens-Muster' }, params: { ischaemia: 'wellens', injury: 1 } },
  { id: 'pericarditis', label: { en: 'Pericarditis', de: 'Perikarditis' }, params: { pericarditis: 1 } },
  { id: 'brugada', label: { en: 'Brugada pattern', de: 'Brugada-Muster' }, params: { brugada: 1 } },
  { id: 'early-repol', label: { en: 'Early repolarisation', de: 'Frühe Repolarisation' }, params: { earlyRepol: 1 } },
  { id: 'long-qt', label: { en: 'Long QT', de: 'Langes QT' }, params: { repolarisation: 1.3 } },
  { id: 'digoxin', label: { en: 'Digoxin effect', de: 'Digitaliseffekt' }, params: { digoxin: 1 } },
  { id: 'p-mitrale', label: { en: 'Left atrial enlargement', de: 'Linksatriale Vergrößerung' }, params: { laSize: 1.8 } },
  { id: 'p-pulmonale', label: { en: 'Right atrial enlargement', de: 'Rechtsatriale Vergrößerung' }, params: { raSize: 1.9 } },
  { id: 'hyperkalaemia', label: { en: 'Hyperkalaemia (K⁺ 7.2)', de: 'Hyperkaliämie (K⁺ 7,2)' }, params: {}, chemistry: { potassium: 7.2 } },
  { id: 'hypokalaemia', label: { en: 'Hypokalaemia (K⁺ 2.6)', de: 'Hypokaliämie (K⁺ 2,6)' }, params: {}, chemistry: { potassium: 2.6 } },
];

/** The cardio domain's mechanism ids, translated (for content written against it). */
export const MECHANISM_TO_PRESET: Record<string, string> = {
  normal: 'normal', af: 'af', aflutter: 'flutter', wenckebach: 'wenckebach', mobitz2: 'mobitz2', chb: 'chb', vt: 'vt', vf: 'vf',
  lvh: 'lvh', rvh: 'rvh', lbbb: 'lbbb', rbbb: 'rbbb', wpw_a: 'wpw', stemi_ant: 'stemi-anterior', stemi_inf: 'stemi-inferior',
  stemi_lat: 'stemi-lateral', nstemi: 'nstemi', wellens: 'wellens', pericarditis: 'pericarditis', brugada1: 'brugada',
  early_repol: 'early-repol', lqts: 'long-qt', digitalis: 'digoxin', p_mitrale: 'p-mitrale', p_pulmonale: 'p-pulmonale',
  hyperk_mild: 'hyperkalaemia', hyperk_mod: 'hyperkalaemia', hyperk_sev: 'hyperkalaemia',
};

/* ---- vector helpers ------------------------------------------------------------------- */
const norm = (v: Vec3): Vec3 => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => norm([a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t]);

/** One component of the dipole: a lobe in time along a fixed direction. */
interface Kernel { t: number; sl: number; sr: number; v: Vec3 }
/** A plateau (ST segment current of injury, PR-segment atrial current): ramps in, holds, ramps out. */
interface Plateau { t0: number; t1: number; rise: number; fall: number; v: Vec3 }

/** Machine-style intervals, but known exactly: the model knows its own fiducials. */
export interface ElectricalMetrics {
  HR: number; PR: number | null; QRS: number; QT: number; QTc: number; qrsAxis: number; pAxis: number | null; tAxis: number;
  RR: number; conducted: boolean;
}

/** One activation as the model scheduled it, in ms on the model's clock (the clock of the dipole samples).
    The record is what the model did, read back: the station asks it what the heart was doing at any instant of a
    recorded strip. Nothing in it shapes the dipole. */
export type Activation =
  | {
    kind: 'atria'; t: number;
    /** when the left atrium has finished activating (the end of the P wave) */
    end: number;
    /** when the ventricles activated from this impulse; null when it did not reach them */
    conductedAt: number | null;
    /** why it did not: dropped by a failing AV node, a complete block, ventricles driven by their own rhythm
        (dissociation), or ventricles still refractory */
    notConducted?: 'dropped' | 'complete-block' | 'dissociated' | 'refractory';
  }
  | {
    kind: 'ventricles'; t: number;
    /** what started it: an impulse through the AV node, an escape focus, a ventricular tachycardia */
    origin: 'conducted' | 'escape' | 'vt';
    /** the path the wave took through the ventricles */
    route: 'normal' | 'rbbb' | 'lbbb' | 'pre-excited' | 'ectopic';
    /** the end of QRS (the J point), the start of the T wave and the end of repolarisation */
    qrsEnd: number; tStart: number; tEnd: number;
    pr: number | null;
    /** behind a blocked bundle: the ventricle reached late, through muscle, and from when */
    late: { chamber: 'RV' | 'LV'; from: number } | null;
    /** with pre-excitation: when the accessory pathway's wave begins (two widths before its peak), ahead of `t` */
    delta?: number;
  };

interface MechanicalTrigger {
  activationTimeMs: number; chamber: 'RA' | 'LA' | 'RV' | 'LV';
  activationFraction: number; synchrony: number; contractilityScale: number; ectopic: boolean; paced: boolean;
}

/** Deterministic random numbers, so a case replays identically. */
class Rng {
  s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  next(): number { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s / 4294967296; }
  gauss(): number { const u = Math.max(1e-9, this.next()), v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
}

const FS = 500;                // dipole samples per second
/** The accessory pathway's activation lobe: its peak relative to the AV-nodal activation, and its rising width (ms). */
const DELTA = { at: -18, sl: 26 };
const DT = 1000 / FS;

/* Directions of the normal activation sequence (Frank axes: left, feet, back). */
const D = {
  septum: norm([-0.6, 0.1, -0.75]),        // left-to-right across the septum, toward the front
  rvEarly: norm([-0.2, 0.3, -0.9]),        // right ventricular free wall, anterior
  lv: norm([0.72, 0.62, 0.42]),             // left ventricular free wall: left, down, back
  base: norm([-0.45, -0.55, 0.7]),         // last to activate: posterobasal
  ra: norm([0.15, 0.75, -0.6]),
  la: norm([0.75, 0.45, 0.45]),
  t: norm([0.62, 0.55, -0.35]),
};

export class HeartElectrical {
  p: ElectricalParams = { ...ELECTRICAL_DEFAULTS };
  K = 4;
  Ca = 2.4;
  /** Rate the sinus node (or the AV node in AF) is driven at, from the autonomic model. */
  rateSource: () => number = () => 72;

  timeMs = 0;
  private rng = new Rng(10392042);
  private kernels: Kernel[] = [];
  private plateaus: Plateau[] = [];
  private pending: Array<{ t: number; kind: 'conducted' | 'escape' | 'vt'; pr: number | null }> = [];
  private nextAtrialMs = 200;
  private nextVentricularMs = 600;      // AF, flutter, VT, escape clock
  private lastVentricularMs = -1000;
  private wenckebach = 0;
  private mobitz = 0;
  private flutterCount = 0;
  private nextSampleMs = 0;
  private vcg: number[] = [];
  private triggers: MechanicalTrigger[] = [];
  private rr: number[] = [];
  private afPhase: number[] = [0, 1.7, 3.1, 0.6];
  /** The activations of the last 20 s, oldest first. */
  activations: Activation[] = [];
  private vfPhase: number[] = [0, 2.1, 4.2, 1.3];
  private vfAmp: Vec3 = [0.5, 0.4, 0.45];
  metrics: ElectricalMetrics = { HR: 72, PR: 160, QRS: 90, QT: 390, QTc: 427, qrsAxis: 55, pAxis: 60, tAxis: 45, RR: 833, conducted: true };

  /* ---- configuration ------------------------------------------------------------------- */
  setParams(p: Partial<ElectricalParams>): void {
    const prev = this.p;
    this.p = { ...this.p, ...p };
    // A change of driving rhythm restarts its clock from now, as a real conversion would.
    if (prev.atrial !== this.p.atrial || prev.ventricular !== this.p.ventricular || prev.avBlock !== this.p.avBlock) {
      this.nextAtrialMs = this.timeMs + 50;
      this.nextVentricularMs = this.timeMs + 300;
      this.wenckebach = 0; this.mobitz = 0;
    }
  }

  /* ---- the interface the circulation uses ------------------------------------------------ */
  updatePhysiology(_partial: unknown): void { /* mechano-electric feedback not modelled */ }
  setPotassium(k: number): void { this.K = k; }
  setCalcium(ca: number): void { this.Ca = ca; }
  setHeartRate(_hr: number): void { /* the rate comes from rateSource, read every beat */ }
  setPathology(id: string): void {
    const preset = ELECTRICAL_PRESETS.find((x) => x.id === (MECHANISM_TO_PRESET[id] ?? id));
    this.setParams({ ...ELECTRICAL_DEFAULTS, ...(preset?.params ?? {}) });
    if (preset?.chemistry?.potassium) this.K = preset.chemistry.potassium;
  }
  getMechanicalTriggers(): MechanicalTrigger[] { const t = this.triggers; this.triggers = []; return t; }
  peek() {
    const n = this.vcg.length;
    return {
      ecgValue: n ? this.leadII(this.vcg[n - 3], this.vcg[n - 2], this.vcg[n - 1]) : 0,
      effectiveHR: this.metrics.HR, qrsAxis: this.metrics.qrsAxis, pathology: this.rhythmLabel(), metrics: { ...this.metrics },
    };
  }
  /** The recorded dipole since the last call, as Frank X, Y, Z (mV) at 500 Hz. */
  drain(): { X: number[]; Y: number[]; Z: number[]; fs: number; t0: number } {
    const n = this.vcg.length / 3;
    const X = new Array(n), Y = new Array(n), Z = new Array(n);
    for (let i = 0; i < n; i++) { X[i] = this.vcg[3 * i]; Y[i] = this.vcg[3 * i + 1]; Z[i] = this.vcg[3 * i + 2]; }
    const t0 = this.nextSampleMs - n * DT;
    this.vcg = [];
    return { X, Y, Z, fs: FS, t0 };
  }
  reset(): void { const p = this.p; Object.assign(this, new HeartElectrical()); this.p = p; }

  /** The time of the newest dipole sample produced (ms, the clock of `activations`). */
  get sampledTo(): number { return this.nextSampleMs - DT; }

  /** Where in the cycle the heart is now, for drawings of the conduction system. */
  phase(): { sinceP: number; sinceV: number; qrs: number; qt: number; pr: number | null } {
    return {
      sinceP: this.lastP && this.p.atrial === 'sinus' ? this.timeMs - this.lastP.t : Infinity,
      sinceV: this.timeMs - this.lastVentricularMs, qrs: this.metrics.QRS, qt: this.metrics.QT, pr: this.metrics.PR,
    };
  }

  rhythmLabel(): string {
    if (this.p.ventricular !== 'none') return this.p.ventricular;
    if (this.p.atrial === 'af') return 'af';
    if (this.p.atrial === 'flutter') return 'flutter';
    if (this.p.avBlock === 'complete') return 'chb';
    return 'sinus';
  }

  /* ---- time ---------------------------------------------------------------------------- */
  step(ms: number): void {
    const end = this.timeMs + ms;
    this.schedule(end);
    while (this.pending.length && this.pending[0].t <= end) {
      const b = this.pending.shift()!;
      this.ventricularBeat(b.t, b.kind, b.pr);
    }
    while (this.nextSampleMs <= end) {
      const h = this.dipole(this.nextSampleMs);
      this.vcg.push(h[0], h[1], h[2]);
      this.nextSampleMs += DT;
    }
    if (this.vcg.length > FS * 3 * 40) this.vcg.splice(0, FS * 3 * 10);   // undrained runs keep the last 30 s
    this.timeMs = end;
    this.prune();
  }

  private rate(): number { return Math.max(25, Math.min(220, this.rateSource())); }

  /** Decide activations due before `end`. */
  private schedule(end: number): void {
    const p = this.p;
    if (p.ventricular === 'vf') { this.metrics = { ...this.metrics, HR: 0, PR: null, conducted: false }; return; }
    if (p.ventricular === 'vt') {
      while (this.nextVentricularMs <= end) {
        this.queue(this.nextVentricularMs, 'vt', null);
        this.nextVentricularMs += 60000 / ECG.vtRate;
      }
      // the sinus node carries on, dissociated
    }
    if (p.atrial === 'af') {
      while (this.nextVentricularMs <= end) {
        if (p.ventricular === 'none' && p.avBlock !== 'complete') this.queue(this.nextVentricularMs, 'conducted', null);
        /* The AV node lets through a random selection of a chaotic barrage: intervals scatter widely
           around the mean the autonomic state sets, never shorter than its refractory period. */
        const mean = 60000 / this.rate();
        this.nextVentricularMs += Math.max(ECG.afMinRR, mean * (1 + ECG.afIrregularity * this.rng.gauss()));
      }
    } else if (p.atrial === 'flutter') {
      while (this.nextAtrialMs <= end) {
        this.flutterCount++;
        const ratio = Math.max(2, Math.min(4, Math.round(60000 / ECG.flutterCycle / this.rate())));
        if (p.ventricular === 'none' && p.avBlock !== 'complete' && this.flutterCount % ratio === 0) this.queue(this.nextAtrialMs + 120, 'conducted', null);
        this.nextAtrialMs += ECG.flutterCycle;
      }
    } else {
      while (this.nextAtrialMs <= end) {
        const t = this.nextAtrialMs;
        const atria = this.atrialBeat(t);
        const pr = this.prInterval();
        if (p.ventricular === 'none') {
          let conduct = p.avBlock !== 'complete';
          let prNow = pr;
          if (p.avBlock === 'wenckebach') {
            /* Each beat finds the node less recovered: the PR lengthens by smaller steps until one fails. */
            if (this.wenckebach >= 3) { conduct = false; this.wenckebach = 0; } else { prNow = pr + ECG.wenckebachIncrement * (1 - Math.pow(ECG.wenckebachDecay, this.wenckebach)); this.wenckebach++; }
          } else if (p.avBlock === 'mobitz2') {
            this.mobitz = (this.mobitz + 1) % 3;
            if (this.mobitz === 0) conduct = false;
          }
          if (!conduct) atria.notConducted = p.avBlock === 'complete' ? 'complete-block' : 'dropped';
          else if (this.queue(t + prNow, 'conducted', prNow)) atria.conductedAt = t + prNow;
          else atria.notConducted = 'refractory';
        } else atria.notConducted = 'dissociated';
        /* Respiratory sinus arrhythmia: a few per cent, at the breathing rate. */
        const rsa = 1 + ECG.rsaDepth * Math.sin((2 * Math.PI * t) / 4200);
        this.nextAtrialMs += 60000 / this.rate() / rsa;
      }
    }
    // Escape: a ventricle left without a conducted beat for 1.5 s activates by itself.
    if (p.ventricular === 'none') {
      const lastQueued = this.pending.length ? this.pending[this.pending.length - 1].t : this.lastVentricularMs;
      /* Below the AV node a ventricular focus fires at about 40/min if nothing reaches it; with intact conduction
         a long pause (a dropped beat, sinus arrest) is rescued later, by the junction. */
      const escapeAt = Math.max(lastQueued, this.lastVentricularMs) + (p.avBlock === 'complete' ? ECG.ventricularEscape : ECG.junctionalEscape);
      if (escapeAt <= end + 1) {
        const conductedSoon = this.pending.some((b) => b.t <= escapeAt + 1);
        if (!conductedSoon) this.queue(escapeAt, 'escape', null);
      }
    }
  }

  private queue(t: number, kind: 'conducted' | 'escape' | 'vt', pr: number | null): boolean {
    // A ventricle activated within its refractory period cannot activate again.
    const last = Math.max(this.lastVentricularMs, ...this.pending.map((b) => b.t));
    if (t - last < ECG.refractory) return false;
    this.pending.push({ t, kind, pr });
    this.pending.sort((a, b) => a.t - b.t);
    return true;
  }

  private prInterval(): number {
    const p = this.p;
    let pr = ECG.prNormal / Math.pow(Math.max(0.2, p.av), 0.9);
    if (this.K > ECG.prOnsetK) pr += ECG.prPerK * (this.K - ECG.prOnsetK);
    if (p.accessory) pr = Math.min(pr, ECG.preexcitedPr);
    return pr;
  }

  /* ---- the dipole of one activation --------------------------------------------------------- */
  private atrialBeat(t: number): Activation & { kind: 'atria' } {
    const p = this.p;
    let amp = 0.11;
    if (this.K > ECG.pLossOnset) amp *= Math.max(0, 1 - ECG.pLossPerK * (this.K - ECG.pLossOnset));   // atrial myocytes fail first in hyperkalaemia
    const ra = amp * (1 + 1.6 * (p.raSize - 1));
    const la = amp * 0.95 * (1 + 1.3 * (p.laSize - 1));
    const laDelay = 30 + 28 * (p.laSize - 1);
    this.kernels.push({ t: t + 28, sl: 15, sr: 15, v: scale(D.ra, ra) });
    this.kernels.push({ t: t + 28 + laDelay, sl: 17, sr: 17 + 6 * (p.laSize - 1), v: scale(D.la, la) });
    // Atrial repolarisation (Ta): small, opposite, mostly hidden in the PR segment and QRS.
    this.kernels.push({ t: t + 230, sl: 70, sr: 70, v: scale(norm(add(D.ra, D.la)), -0.025) });
    if (p.pericarditis > 0) this.plateaus.push({ t0: t + 90, t1: t + this.prInterval() + 10, rise: 15, fall: 10, v: scale(norm(add(D.ra, D.la)), -0.05 * p.pericarditis) });
    this.triggers.push({ activationTimeMs: t, chamber: 'RA', activationFraction: 1, synchrony: 1, contractilityScale: 1, ectopic: false, paced: false });
    this.triggers.push({ activationTimeMs: t, chamber: 'LA', activationFraction: 1, synchrony: 1, contractilityScale: 1, ectopic: false, paced: false });
    this.lastP = { t, amp: ra + la };
    const rec = { kind: 'atria' as const, t, end: t + 28 + laDelay + 2.5 * (17 + 6 * (p.laSize - 1)), conductedAt: null };
    this.activations.push(rec);
    return rec;
  }
  lastP: { t: number; amp: number } | null = null;

  private ventricularBeat(t: number, kind: 'conducted' | 'escape' | 'vt', pr: number | null): void {
    const p = this.p, K = this.K;
    const rrMs = this.lastVentricularMs > 0 ? t - this.lastVentricularMs : 60000 / this.rate();
    this.lastVentricularMs = t;
    this.rr.push(rrMs); if (this.rr.length > 8) this.rr.shift();

    /* Hyperkalaemia slows conduction in the ventricles too: the QRS widens. */
    const w = 1 + Math.max(0, K - ECG.qrsOnsetK) * ECG.qrsPerK;
    const k: Kernel[] = [];
    const lbbBlock = p.lbb < 0.35, rbbBlock = p.rbb < 0.35;
    const lvGain = 1 + 1.5 * (p.lvMass - 1);
    const lvDir = p.lvMass > 1 ? mix(D.lv, norm([0.75, 0.45, 0.55]), Math.min(1, (p.lvMass - 1) * 0.8)) : D.lv;
    let qrs = ECG.qrsNormal * w;
    let synchrony = 1;
    let discordant = 0;     // how much the T wave turns away from the QRS (secondary repolarisation change)
    let qrsMean: Vec3;

    const origin = kind;
    // A junctional escape (conduction intact, the sinus paused) is narrow; below a complete block it is ventricular, and wide.
    if (kind === 'escape' && p.avBlock !== 'complete') kind = 'conducted';
    if (kind === 'vt') {
      k.push({ t: t + 35 * w, sl: 22, sr: 22, v: scale(norm([-0.4, -0.55, -0.7]), 1.3) });
      k.push({ t: t + 95 * w, sl: 30, sr: 26, v: scale(norm([-0.6, -0.7, -0.1]), 1.9) });
      qrs = ECG.vtQrs * w; synchrony = 0.7; discordant = 1;
    } else if (kind === 'escape') {
      k.push({ t: t + 40 * w, sl: 22, sr: 22, v: scale(norm([0.2, -0.6, 0.6]), 0.9) });
      k.push({ t: t + 95 * w, sl: 26, sr: 24, v: scale(norm([0.6, -0.5, 0.55]), 1.5) });
      qrs = 150 * w; synchrony = 0.8; discordant = 1;
    } else if (lbbBlock) {
      /* The septum is activated from the right: the first vector points left, so the septal q in I and V6 is lost.
         The left ventricle is then reached slowly, cell to cell: a broad, notched R in the lateral leads. */
      k.push({ t: t + 18 * w, sl: 10, sr: 10, v: scale(norm([0.55, 0.1, 0.6]), 0.4) });
      k.push({ t: t + 62 * w, sl: 20, sr: 18, v: scale(norm([0.7, 0.25, 0.65]), 1.25 * lvGain) });
      k.push({ t: t + 108 * w, sl: 18, sr: 16, v: scale(norm([0.8, 0.05, 0.55]), 1.15 * lvGain) });
      qrs = (ECG.lbbbQrs + 40 * (0.35 - p.lbb)) * w; synchrony = 0.82; discordant = 1;
    } else {
      // septum, right ventricle, left ventricle, base
      const rbbDelay = rbbBlock ? 1 : Math.max(0, (1 - p.rbb) * 0.4);
      k.push({ t: t + 11 * w, sl: 6, sr: 6, v: scale(D.septum, 0.28) });
      if (!rbbBlock) k.push({ t: t + (24 + 10 * rbbDelay) * w, sl: 8, sr: 8, v: scale(D.rvEarly, 0.3 * (1 + 0.6 * (p.rvMass - 1))) });
      k.push({ t: t + 40 * w, sl: 11 * (1 + 0.12 * (p.lvMass - 1)), sr: 11, v: scale(lvDir, 1.55 * lvGain) });
      k.push({ t: t + 64 * w, sl: 9, sr: 9, v: scale(D.base, 0.42) });
      if (p.rvMass > 1.15) k.push({ t: t + 52 * w, sl: 12, sr: 12, v: scale(norm([-0.55, 0.55, -0.62]), 1.25 * (p.rvMass - 1)) });
      if (rbbBlock) {
        /* The right ventricle activates late, from the left, and unopposed: a terminal rightward, anterior vector — R′ in V1, slurred S in I and V6. */
        k.push({ t: t + 104 * w, sl: 15, sr: 13, v: scale(norm([-0.45, 0.15, -0.85]), 0.75) });
        qrs = ECG.rbbbQrs * w; synchrony = 0.92; discordant = 0.45;
      }
      if (p.accessory) {
        /* The accessory pathway activates ventricle early and slowly before the normal wave arrives: the delta wave. */
        k.push({ t: t + DELTA.at, sl: DELTA.sl, sr: 14, v: scale(norm([0.35, 0.45, -0.82]), 0.55) });
        qrs = Math.max(qrs, ECG.preexcitedQrs * w); discordant = Math.max(discordant, 0.5);
      }
      qrs += 10 * Math.max(0, p.lvMass - 1);
    }
    for (const x of k) this.kernels.push(x);
    qrsMean = norm(k.reduce<Vec3>((s, x) => add(s, scale(x.v, x.sl + x.sr)), [0, 0, 0]));

    /* ---- repolarisation ---- */
    const rr = Math.max(300, rrMs);
    /* QT follows the heart period linearly (Sagie, Framingham); a machine still reports QTc by Bazett. */
    let qt1 = ECG.qtRef * p.repolarisation;
    qt1 -= ECG.calciumQt * (this.Ca - ECG.calciumRef);                    // calcium shortens the plateau
    qt1 -= ECG.digoxinQt * p.digoxin;
    if (K < ECG.hypoKOnset) qt1 += ECG.hypoKQt * (ECG.hypoKOnset - K);
    let QT = Math.max(ECG.qtMin, qt1 - ECG.qtRateSlope * (1 - rr / 1000));
    QT = Math.max(QT, qrs + 160);
    const jPoint = t + qrs;
    let tDir: Vec3 = discordant ? mix(D.t, scale(qrsMean, -1) as Vec3, discordant) : D.t;
    let tAmp = 0.36;
    let sl = 0.19 * QT, sr = 42;
    if (p.lvMass > 1.35 && discordant === 0) {
      // strain: the thick wall repolarises out of order
      tDir = mix(tDir, scale(lvDir, -1) as Vec3, Math.min(0.9, (p.lvMass - 1.35) * 1.6));
      this.plateaus.push({ t0: jPoint, t1: t + QT - 80, rise: 25, fall: 60, v: scale(lvDir, -0.07 * Math.min(1.5, p.lvMass - 1.2)) });
    }
    if (K > ECG.tPeakOnset) { tAmp *= 1 + ECG.tPeakGain * (K - ECG.tPeakOnset); const narrow = Math.max(0.45, 1 - ECG.tNarrowing * (K - ECG.tPeakOnset)); sl *= narrow; sr *= narrow; }
    if (K < ECG.hypoKOnset) tAmp *= Math.max(0.2, 1 - ECG.hypoKT * (ECG.hypoKOnset - K));
    if (p.digoxin > 0) tAmp *= 1 - ECG.digoxinT * p.digoxin;
    if (kind === 'vt' || kind === 'escape') tAmp = 0.55;
    if (discordant >= 1) tAmp = Math.max(tAmp, 0.5);

    // ischaemia
    const inj = p.injury;
    const ST: Record<string, Vec3> = {
      anterior: norm([0.15, -0.2, -0.95]), inferior: norm([-0.25, 0.95, 0.12]), lateral: norm([0.92, -0.35, 0.15]),
      subendocardial: norm([-0.55, -0.6, -0.05]),
    };
    if ((p.ischaemia === 'anterior' || p.ischaemia === 'inferior' || p.ischaemia === 'lateral') && inj > 0) {
      const v = ST[p.ischaemia];
      this.plateaus.push({ t0: jPoint - 6, t1: t + QT - 120, rise: 8, fall: 90, v: scale(v, 0.42 * inj) });
      tDir = mix(tDir, v, 0.45 * inj); tAmp *= 1 + 0.45 * inj;     // hyperacute T
    } else if (p.ischaemia === 'subendocardial' && inj > 0) {
      this.plateaus.push({ t0: jPoint, t1: t + QT - 100, rise: 25, fall: 70, v: scale(ST.subendocardial, 0.14 * inj) });
      tDir = mix(tDir, norm([-0.5, -0.2, 0.2]), 0.5 * inj);
    } else if (p.ischaemia === 'wellens' && inj > 0) {
      tDir = mix(tDir, norm([0.25, 0.4, 0.88]), 0.85 * inj); tAmp *= 1.5; sl = sr = 0.14 * QT;
    }
    if (p.pericarditis > 0) this.plateaus.push({ t0: jPoint - 5, t1: t + QT - 120, rise: 18, fall: 80, v: scale(norm([0.5, 0.75, -0.35]), 0.17 * p.pericarditis) });
    if (p.earlyRepol > 0) {
      this.kernels.push({ t: jPoint - 2, sl: 5, sr: 9, v: scale(norm([0.6, 0.7, -0.2]), 0.16 * p.earlyRepol) });
      this.plateaus.push({ t0: jPoint, t1: t + QT - 130, rise: 10, fall: 80, v: scale(norm([0.55, 0.6, -0.5]), 0.08 * p.earlyRepol) });
    }
    if (p.brugada > 0) {
      const v = norm([-0.35, -0.45, -0.82]);
      this.kernels.push({ t: jPoint - 4, sl: 6, sr: 10, v: scale(v, 0.3 * p.brugada) });
      this.plateaus.push({ t0: jPoint, t1: t + QT - 150, rise: 6, fall: 120, v: scale(v, 0.2 * p.brugada) });
      this.kernels.push({ t: t + QT - 90, sl: 0.17 * QT, sr: 40, v: scale(v, -0.22 * p.brugada) });
    }
    if (p.digoxin > 0) this.plateaus.push({ t0: jPoint, t1: t + QT - 60, rise: 50, fall: 40, v: scale(D.t, -0.09 * p.digoxin) });
    if (K < ECG.hypoKOnset) this.plateaus.push({ t0: jPoint, t1: t + QT - 60, rise: 30, fall: 40, v: scale(D.t, -0.025 * (ECG.hypoKOnset - K)) });

    const tPeak = t + QT - 2.2 * sr;
    this.kernels.push({ t: tPeak, sl, sr, v: scale(norm(tDir), tAmp) });
    const route = kind !== 'conducted' ? 'ectopic' : lbbBlock ? 'lbbb' : p.accessory ? 'pre-excited' : rbbBlock ? 'rbbb' : 'normal';
    this.activations.push({
      kind: 'ventricles', t, origin, route, pr, qrsEnd: jPoint, tStart: Math.max(jPoint, tPeak - 2 * sl), tEnd: t + QT,
      late: route === 'lbbb' ? { chamber: 'LV', from: t + 30 * w } : rbbBlock && kind === 'conducted' && !lbbBlock ? { chamber: 'RV', from: t + 74 * w } : null,
      ...(route === 'pre-excited' ? { delta: t + DELTA.at - 2 * DELTA.sl } : {}),
    });
    if (K < ECG.uWaveOnset) this.kernels.push({ t: t + QT + 70, sl: 40, sr: 45, v: scale(D.t, 0.05 + 0.1 * (ECG.uWaveOnset - K)) });   // U wave

    /* ---- the beat drives the mechanics ---- */
    for (const chamber of ['LV', 'RV'] as const) {
      this.triggers.push({ activationTimeMs: t, chamber, activationFraction: 1, synchrony, contractilityScale: 1, ectopic: kind !== 'conducted', paced: false });
    }

    /* ---- what a machine would measure, known exactly ---- */
    const meanRR = this.rr.reduce((a, b) => a + b, 0) / this.rr.length;
    const frontal = (v: Vec3) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
    const qrsArea = k.reduce<Vec3>((s, x) => add(s, scale(x.v, x.sl + x.sr)), [0, 0, 0]);
    const pVisible = p.atrial === 'sinus' && this.lastP && this.lastP.amp > 0.03;
    this.metrics = {
      HR: Math.round(60000 / meanRR), RR: rrMs,
      PR: kind === 'conducted' && p.atrial === 'sinus' && pr != null && pVisible ? Math.round(pr) : null,
      QRS: Math.round(qrs), QT: Math.round(QT), QTc: Math.round(QT / Math.sqrt(rr / 1000)),
      qrsAxis: Math.round(frontal(qrsArea)), pAxis: pVisible ? Math.round(frontal(add(D.ra, D.la))) : null, tAxis: Math.round(frontal(tDir)),
      conducted: kind === 'conducted' && pr != null,
    };
  }

  /* ---- the dipole at time t ---------------------------------------------------------------- */
  private dipole(t: number): Vec3 {
    let x = 0, y = 0, z = 0;
    for (const k of this.kernels) {
      const d = t - k.t;
      const s = d < 0 ? k.sl : k.sr;
      if (d < -4.5 * k.sl || d > 4.5 * k.sr) continue;
      const g = Math.exp(-(d * d) / (2 * s * s));
      x += k.v[0] * g; y += k.v[1] * g; z += k.v[2] * g;
    }
    for (const pl of this.plateaus) {
      if (t < pl.t0 - pl.rise || t > pl.t1 + 4 * pl.fall) continue;
      const up = t < pl.t0 ? 0.5 * (1 + Math.cos((Math.PI * (pl.t0 - t)) / pl.rise)) : 1;
      const down = t > pl.t1 ? Math.exp(-((t - pl.t1) * (t - pl.t1)) / (2 * pl.fall * pl.fall)) : 1;
      const g = up * down;
      x += pl.v[0] * g; y += pl.v[1] * g; z += pl.v[2] * g;
    }
    const s = t / 1000;
    if (this.p.atrial === 'af' && this.p.ventricular !== 'vf') {
      /* Fibrillatory waves: several wavelets at 5–8 Hz drifting in phase; largest toward V1. */
      let f = 0;
      const freqs = [5.3, 6.1, 6.9, 7.6];
      for (let i = 0; i < 4; i++) { this.afPhase[i] += (this.rng.next() - 0.5) * 0.02; f += Math.sin(2 * Math.PI * freqs[i] * s + this.afPhase[i]) * (0.022 + 0.008 * Math.sin(0.7 * s + i)); }
      x += -0.35 * f; y += 0.45 * f; z += -0.85 * f;
    }
    if (this.p.atrial === 'flutter' && this.p.ventricular !== 'vf') {
      /* Re-entry round the tricuspid annulus at 300/min: a sawtooth, negative in the inferior leads. */
      const ph = (s * 5) % 1;
      const saw = ph < 0.8 ? 1 - ph / 0.8 * 2 : -1 + ((ph - 0.8) / 0.2) * 2;
      const v = 0.14 * saw;
      x += 0.05 * v; y += -0.95 * v; z += -0.3 * v;
    }
    if (this.p.ventricular === 'vf') {
      /* Many wavelets, no organised activation: a coarse, chaotic oscillation and no output. */
      const freqs = [3.6, 4.4, 5.3, 6.2];
      let a = 0, b = 0, c = 0;
      for (let i = 0; i < 4; i++) {
        this.vfPhase[i] += (this.rng.next() - 0.5) * 0.06;
        const w = Math.sin(2 * Math.PI * freqs[i] * s + this.vfPhase[i]);
        a += w * Math.cos(i * 1.3 + 0.2 * s); b += w * Math.sin(i * 0.9 + 0.3 * s); c += w * Math.cos(i * 2.1 - 0.25 * s);
      }
      for (let i = 0; i < 3; i++) this.vfAmp[i] = Math.max(0.15, Math.min(0.7, this.vfAmp[i] + (this.rng.next() - 0.5) * 0.004));
      x += 0.3 * a * this.vfAmp[0]; y += 0.3 * b * this.vfAmp[1]; z += 0.3 * c * this.vfAmp[2];
    }
    // the body is not still: slow baseline wander (breathing) and a little noise
    const wander = 0.018 * Math.sin(2 * Math.PI * 0.24 * s);
    x += wander + 0.004 * this.rng.gauss(); y += 0.7 * wander + 0.004 * this.rng.gauss(); z += 0.5 * wander + 0.004 * this.rng.gauss();
    return [x, y, z];
  }

  private prune(): void {
    const t = this.timeMs;
    if (this.kernels.length > 40) this.kernels = this.kernels.filter((k) => k.t + 4.5 * k.sr > t);
    if (this.plateaus.length > 10) this.plateaus = this.plateaus.filter((p) => p.t1 + 4 * p.fall > t);
    if (this.activations.length > 80) this.activations = this.activations.filter((a) => (a.kind === 'atria' ? a.end : a.tEnd) > t - 20000);
  }

  /** Lead II with standard electrodes (Dower coefficients), for the monitor. */
  private leadII(x: number, y: number, z: number): number { return 0.235 * x + 1.066 * y - 0.132 * z; }

  /* ---- checkpoints --------------------------------------------------------------------------- */
  snapshot(): Record<string, unknown> {
    const { rng, vcg, ...rest } = this as any;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.s }));
  }
  restore(s: Record<string, any>): void {
    if (!s || s.kernels === undefined) return;     // a snapshot from the other engine: start clean
    const { rngState, ...rest } = s;
    Object.assign(this, rest);
    this.rng = new Rng(rngState);
    this.vcg = [];
  }
}
