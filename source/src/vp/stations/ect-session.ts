import { ECT } from '../evidence/ect.ts';
import { CT } from '../evidence/seizure.ts';
import { Brain, REGIONS } from '../physiology/brain/corticothalamic.ts';
import { pulseTrain, charge as chargeOf, type PlacementId } from '../physiology/brain/ect-stimulus.ts';
import { dosesFor } from '../physiology/brain/ect-trial.ts';
import { regionFields } from './eeg-seizure.ts';
import { EctDevice, type Stimulus, type DeviceSettings, DEFAULT_SETTINGS } from './ect-device.ts';
import { PERCENT_STEPS } from './ect-programs.ts';
import { seizureReport, type SeizureReport } from './ect-indices.ts';
import { LivePatient } from '../live/live-patient.ts';
import { healthyModel, type PatientModel } from '../physiology/state.ts';
import { siteVector, type Site } from '../measurements/ecg.ts';
import { Ventilator } from '../physiology/lung/ventilation.ts';
import { BARO } from '../evidence/circulation.ts';
import type { DrugId } from '../physiology/drugs/drugs.ts';

/* ===========================================================================
   A treatment session at the ECT device (ECT station, part 1): the device,
   the patient's head and brain, and what the device records.

   - The static impedance the device would measure comes from the patient's
     skin (measured spread with this device; Exner 2023); unprepared skin
     reads high. The dynamic impedance during the stimulus follows it with
     Exner's slope.
   - The stimulus goes through the placement's current paths into the
     regions of the seizure model (physiology/brain/ect-stimulus.ts).
   - The two EEG channels are the device's fronto-mastoid derivations:
     above the eyebrow to the mastoid on each side (Fp1–TP9, Fp2–TP10), from
     the regions' activity through part 1's head (stations/eeg-seizure.ts).
   - The EMG is the cuffed right arm's: the motor seizure there follows the
     left central region's cortical firing (ECT.emgThreshold, ECT.emgPerFiring;
     placements).
   - The body is the lab's own (live/live-patient.ts): its heart, circulation
     and lungs run beside the brain, and channel 4 is its ECG, lead II. The
     stimulus discharges the vagus onto the heart's pacemakers while the
     current flows (ECT.vagal…, by placement and pulse width, from Stewart
     2010); the seizure drives the sympathetic outflow (ECT.seizureSympathetic).
     Atropine, glycopyrrolate, esmolol and labetalol act through the body's
     drugs (physiology/drugs/drugs.ts).
=========================================================================== */

export interface EctPatient {
  placement: PlacementId;
  /** the body (a healthy adult if absent) */
  model?: PatientModel;
  /** skin cleaned and pads pressed on */
  prepared: boolean;
  /** the patient's skin: how far from the mean (SD) the static impedance lies */
  skin: number;
  seed: number;
}
/* ---- the monitoring leads (the device's manual, "Seizure monitoring considerations") ----------------------------------
   Four channels, each a black (negative) and a red (positive) lead-wire, and one green ground. A channel records its red
   lead's potential minus its black lead's: between two head sites the EEG, between two sites on the trunk or the limbs the
   heart (each site's lead vector, as the ECG station places electrodes) and any forearm muscle under both; between a head
   and a body site nothing the device can use. A lead not on gives no channel; no ground lets the mains in. */
export type Spot = 'Fp1' | 'Fp2' | 'Fpz' | 'F7' | 'F8' | 'TP9' | 'TP10'
  | 'chestUR' | 'chestUL' | 'chestLR' | 'chestLL' | 'foreR1' | 'foreR2' | 'foreL1' | 'foreL2' | 'shoulderR' | 'shoulderL';
export type SpotKind = 'head' | 'chest' | 'foreR' | 'foreL' | 'shoulder';
export const SPOT_KIND: Record<Spot, SpotKind> = {
  Fp1: 'head', Fp2: 'head', Fpz: 'head', F7: 'head', F8: 'head', TP9: 'head', TP10: 'head',
  chestUR: 'chest', chestUL: 'chest', chestLR: 'chest', chestLL: 'chest',
  foreR1: 'foreR', foreR2: 'foreR', foreL1: 'foreL', foreL2: 'foreL', shoulderR: 'shoulder', shoulderL: 'shoulder',
};
/** where the body sites are for the heart: the chest four about 22 cm apart corner to corner (the manual: above and below
    the heart, about 8 inches apart), the forearms and shoulders as the arm (Mason–Likar take the shoulder for the arm) */
const SPOT_SITE: Partial<Record<Spot, Site>> = {
  chestUR: { chest: { phi: -20, y: -9 } }, chestUL: { chest: { phi: 20, y: -9 } }, chestLR: { chest: { phi: -30, y: 9 } }, chestLL: { chest: { phi: 30, y: 9 } },
  foreR1: { limb: 'right-arm' }, foreR2: { limb: 'right-arm' }, shoulderR: { limb: 'right-arm' },
  foreL1: { limb: 'left-arm' }, foreL2: { limb: 'left-arm' }, shoulderL: { limb: 'left-arm' },
};
const SPOT_VEC = new Map<Spot, [number, number, number]>();
/** a body spot's lead vector (computed once) */
function spotVector(s: Spot): [number, number, number] {
  let v = SPOT_VEC.get(s);
  if (!v) { const w = siteVector(SPOT_SITE[s]!); v = [w[0], w[1], w[2]]; SPOT_VEC.set(s, v); }
  return v;
}
export interface Lead { black: Spot | null; red: Spot | null }
export interface Montage { ch: [Lead, Lead, Lead, Lead]; ground: Spot | null }
/** the manual's montage: EEG 1 left and 2 right, black above the eyebrow and red on the mastoid of the same side; EMG on the
    cuffed (right) forearm, 3 inches apart; ECG black below the right clavicle, red on the left lower chest (positive toward
    the apex, so the QRS is upright as in lead II); the ground on a shoulder */
export const STANDARD_MONTAGE: Montage = {
  ch: [{ black: 'Fp1', red: 'TP9' }, { black: 'Fp2', red: 'TP10' }, { black: 'foreR1', red: 'foreR2' }, { black: 'chestUR', red: 'chestLL' }],
  ground: 'shoulderR',
};
export const EMPTY_MONTAGE = (): Montage => ({ ch: [{ black: null, red: null }, { black: null, red: null }, { black: null, red: null }, { black: null, red: null }], ground: null });
/** what is wrong with a montage against the manual's, channel by channel (empty: nothing). The manual ("Monitoring
    electrodes application"): EEG black on the forehead and red on the mastoid of the same side, channel 1 left and 2
    right, the polarity kept the same on both sides; EMG two on the cuffed limb and ECG two on the chest above and below
    the heart, both "in any order of polarity"; the ground on either shoulder. */
export function montageProblems(m: Montage): Array<{ ch: 1 | 2 | 3 | 4 | 'ground'; kind: 'missing' | 'wrong' | 'reversed' }> {
  const out: Array<{ ch: 1 | 2 | 3 | 4 | 'ground'; kind: 'missing' | 'wrong' | 'reversed' }> = [];
  const upper = (x: Spot) => x === 'chestUR' || x === 'chestUL', lower = (x: Spot) => x === 'chestLR' || x === 'chestLL';
  m.ch.forEach((l, k) => {
    const s = STANDARD_MONTAGE.ch[k], ch = (k + 1) as 1 | 2 | 3 | 4;
    if (!l.black || !l.red) { out.push({ ch, kind: 'missing' }); return; }
    const pair = [l.black, l.red];
    if (k === 2) { if (!pair.every((x) => SPOT_KIND[x] === 'foreR')) out.push({ ch, kind: 'wrong' }); return; }
    if (k === 3) { if (!(pair.some(upper) && pair.some(lower))) out.push({ ch, kind: 'wrong' }); return; }
    if (l.black === s.black && l.red === s.red) return;
    out.push({ ch, kind: l.black === s.red && l.red === s.black ? 'reversed' : 'wrong' });
  });
  if (!m.ground) out.push({ ch: 'ground', kind: 'missing' });
  else if (SPOT_KIND[m.ground] !== 'shoulder') out.push({ ch: 'ground', kind: 'wrong' });
  return out;
}

export const DEFAULT_PATIENT: EctPatient = { placement: 'BT', prepared: true, skin: 0, seed: 7 };

/** samples per second of the recording */
export const FS = 200;

export interface Recording {
  eeg1: Float32Array; eeg2: Float32Array; emg: Float32Array; ecg: Float32Array;
  /** the left central region's cortical firing above rest (1/s), which drives the EMG */
  motor: Float32Array;
  /** samples recorded */
  n: number;
}

/** What the printer put on paper, in order: the self-test line, the settings, traces, reports. */
export type PaperEntry =
  | { kind: 'selftest'; at: number }
  | { kind: 'settings'; at: number }
  | { kind: 'trace'; from: number; to: number | null; afterStimulus: number | null }
  | { kind: 'report'; at: number; stimulus: number };

export interface StimulusRecord { at: number; end: number; percent: number; program: DeviceSettings['program']; given: Stimulus; early: boolean; dynamicOhm: number; staticOhm: number | null; energy: number }

export class EctSession {
  readonly device: EctDevice;
  readonly patient: EctPatient;
  readonly brain: Brain;
  /** session time (s); one sample every 1/FS */
  t = 0;
  rec: Recording;
  /** what happened, in session time */
  baselineFrom: number | null = null;
  readyAt: number | null = null;
  stimuli: StimulusRecord[] = [];
  printing: Array<{ from: number; to: number | null }> = [];
  reports: number[] = [];
  paper: PaperEntry[] = [];
  /** cables: stimulus cable to the pads, monitoring cable to the EEG, EMG and ECG electrodes */
  stimulusCable = true; monitoringCable = true;
  /* the anaesthetic (PR C): when the breathing stopped, when the relaxant went in and whether the cuff spared the arm */
  inducedAt: number | null = null;
  relaxedAt: number | null = null;
  armSpared = true;
  private breathingOff = false;
  /** the awake patient's fist (the voluntary contraction that checks the EMG leads): until when */
  private fistFrom = -Infinity;
  /** the stimulus pads on the head (the procedure starts without them; part 1's sessions have them on) */
  padsOn = true;
  private startedAt = 0;
  private emgNoise: () => number;
  private fields = regionFields();
  /** the body: heart, circulation, lungs */
  readonly body: LivePatient;
  /** the heart's vector (mV) for the next block of samples, and the R waves seen (session time, s) */
  private vcgBlock: [Float32Array, Float32Array, Float32Array] = [new Float32Array(0), new Float32Array(0), new Float32Array(0)]; private ecgAt = 0;
  /** where the monitoring leads are: the manual's montage unless the learner places them */
  montage: Montage = structuredClone(STANDARD_MONTAGE);
  private rcentral = REGIONS.findIndex((r) => r.id === 'R-central');
  /* the resting background (the awake EEG the device takes its baseline from): one source per region, scaled so that
     channel 1 shows ECT.restingEeg, and let through as far as each region's relay fires (its throughput, smoothed over
     half a second, against the patient's own over the first 2 s): after a seizure the hyperpolarised relay silences it */
  private bg: Array<() => number> = [];
  private bgSize = 0;
  private relaySm: Float64Array | null = null; private relayRef: Float64Array | null = null;
  readonly rWaves: number[] = [];
  /** arterial pressure every 0.1 s (session time, systolic, diastolic, mean; mmHg) */
  readonly pressure: Array<{ t: number; sys: number; dia: number; mean: number }> = [];
  private lastActivation = -Infinity;
  private vagal = 0; private adrenergic = 0;
  private lcentral = REGIONS.findIndex((r) => r.id === 'L-central');

  constructor(patient: EctPatient = DEFAULT_PATIENT, settings: DeviceSettings = DEFAULT_SETTINGS) {
    this.patient = { ...patient };
    this.device = new EctDevice(settings);
    this.brain = new Brain({ seed: patient.seed });
    this.brain.settle(6);
    this.body = new LivePatient(patient.model ?? healthyModel());
    this.body.settleNow(15);
    const cap = FS * 60 * 12;
    this.rec = { eeg1: new Float32Array(cap), eeg2: new Float32Array(cap), emg: new Float32Array(cap), ecg: new Float32Array(cap), motor: new Float32Array(cap), n: 0 };
    this.emgNoise = noiseSource(patient.seed);
    this.bg = REGIONS.map((_, r) => backgroundSource(noiseSource(patient.seed * 7919 + 101 * (r + 1))));
    { const f = this.fields.perRegion, ch = STANDARD_MONTAGE.ch[0]; let v = 0; for (const fr of f) v += (fr[ch.red!] - fr[ch.black!]) ** 2; this.bgSize = ECT.restingEeg / (2 * Math.SQRT2) / Math.sqrt(v); }
    this.updateImpedance();
  }

  /** the static impedance of this head now (Ω): what the device would read */
  get staticOhm() {
    if (!this.stimulusCable || !this.padsOn) return Infinity;
    const z = ECT.staticMean + this.patient.skin * ECT.staticSD;
    return Math.max(150, z) * (this.patient.prepared ? 1 : ECT.unpreparedSkin);
  }
  /** the dynamic impedance it presents to the 0.9 A stimulus (Ω) */
  get dynamicOhm() { return ECT.dynamicMean + ECT.staticToDynamic * this.patient.skin * ECT.dynamicSD; }
  private updateImpedance() { this.device.staticOhm = this.staticOhm; }
  setPrepared(p: boolean) { this.patient.prepared = p; this.updateImpedance(); }
  setStimulusCable(on: boolean) { this.stimulusCable = on; this.updateImpedance(); }
  /** put the stimulus pads on the head at a placement, or take them off (null) */
  setPads(placement: PlacementId | null) { if (placement) this.patient.placement = placement; this.padsOn = placement != null; this.updateImpedance(); }
  /* ---- the anaesthetic (PR C) ---- */
  private setResp(change: (r: PatientModel['respiratory']) => void) { const m = structuredClone(this.body.model); change(m.respiratory); this.body.setModel(m); }
  /** ask the awake patient to make a fist for two seconds: the EMG shows the voluntary contraction (none once anaesthetised) */
  fist() { if (this.inducedAt == null) this.fistFrom = this.t; }
  /** the voluntary EMG envelope now (0–1): up in 0.2 s, held, down by 2 s */
  private fistEnvelope() { const x = this.t - this.fistFrom; return x < 0 || x > 2 ? 0 : Math.min(1, x / 0.2, (2 - x) / 0.3); }
  /** the mask on with oxygen flowing (or off: room air) */
  oxygen(on: boolean) { this.setResp((r) => { r.FiO2 = on ? ECT.maskFiO2 : 0.21; }); }
  /** the induction agent: the patient stops breathing (ECT.apnoeaAfterInduction until it returns) */
  induce() { if (this.inducedAt != null) return; this.inducedAt = this.t; this.breathingOff = true; this.setResp((r) => { r.drive = 0; }); }
  /** succinylcholine: every muscle it reaches relaxes; the cuffed arm only if the cuff was not above the systolic pressure */
  relax(armSpared: boolean) { if (this.relaxedAt != null) return; this.relaxedAt = this.t; this.armSpared = armSpared; }
  /** breaths given by bag and mask at ECT.bagRate, or none */
  bag(on: boolean) {
    if (!on) { this.body.run.setVentilator(null); return; }
    const v = new Ventilator('mask'); v.steady(ECT.bagRate, this.body.run.resp.t); this.body.run.setVentilator(v);
  }
  /** the patient breathing on their own (not under the anaesthetic's apnoea) */
  get breathing() { return !this.breathingOff; }
  /** seconds until the breathing returns (0 if it has) */
  get apnoeaLeft() { return this.breathingOff && this.inducedAt != null ? Math.max(0, this.inducedAt + ECT.apnoeaAfterInduction - this.t) : 0; }
  /** the cuffed arm relaxed: the relaxant reached it */
  get armRelaxed() { return this.relaxedAt != null && !this.armSpared && this.t >= this.relaxedAt + ECT.relaxantOnset; }
  /** SpO₂ (%) and end-tidal CO₂ (mmHg; null without breaths, as a capnograph shows nothing) */
  get spo2(): number { const r = this.body.snap.resp as unknown as { SaO2?: number } | undefined; return 100 * (r?.SaO2 ?? 0.97); }
  get etco2(): number | null {
    const r = this.body.snap.resp as unknown as { EtCO2?: number; givenRate?: number; RR?: number } | undefined;
    const breaths = (r?.givenRate ?? 0) > 0 || (this.breathing && (r?.RR ?? 0) > 0);
    /* nothing until the first breath has been breathed out */
    return breaths && (r?.EtCO2 ?? 0) > 0 ? (r?.EtCO2 ?? 0) * 7.50062 : null;
  }
  /** whether current from the device reaches the head */
  get circuit() { return this.stimulusCable && this.padsOn; }

  private grow() {
    if (this.rec.n < this.rec.eeg1.length) return;
    const g = (a: Float32Array) => { const b = new Float32Array(a.length * 2); b.set(a); return b; };
    this.rec = { eeg1: g(this.rec.eeg1), eeg2: g(this.rec.eeg2), emg: g(this.rec.emg), ecg: g(this.rec.ecg), motor: g(this.rec.motor), n: this.rec.n };
  }

  /** advance by `seconds`, sample by sample */
  advance(seconds: number) {
    const n = Math.round(seconds * FS);
    for (let k = 0; k < n; k++) this.sample();
  }

  private sample() {
    const dt = 1 / FS;
    this.device.tick(dt);
    for (const e of this.device.drain()) this.onEvent(e);
    this.brain.advance(dt);
    this.t += dt;
    this.grow();
    const i = this.rec.n++;
    const a = this.brain.activity(), f = this.fields.perRegion;
    const mon = this.monitoringCable;
    /* the background, through each relay */
    const thr = this.brain.relayThroughput(), k = 1 / (0.5 * FS);
    if (!this.relaySm) this.relaySm = Float64Array.from(thr);
    for (let r = 0; r < thr.length; r++) this.relaySm[r] += k * (thr[r] - this.relaySm[r]);
    if (!this.relayRef) { if (this.t >= 2) this.relayRef = Float64Array.from(this.relaySm); }
    const e = Float64Array.from(a);
    for (let r = 0; r < e.length; r++) { const g = this.relayRef ? Math.min(1, this.relaySm[r] / this.relayRef[r]) : 1; e[r] += this.bgSize * g * this.bg[r](); }
    /* the motor seizure: the motor cortex above the spinal threshold drives the cuffed arm's muscles */
    this.rec.motor[i] = a[this.lcentral];
    if (i % BODY_BLOCK === 0) this.stepBody();
    const j = i - this.ecgAt;
    const v = [this.vcgBlock[0][j] ?? 0, this.vcgBlock[1][j] ?? 0, this.vcgBlock[2][j] ?? 0];
    const pot = (el: string) => { let x = 0; for (let r = 0; r < e.length; r++) x += f[r][el] * e[r]; return x; };
    /* each arm's surface EMG: the right (cuffed) driven by the left motor cortex, the left by the right; a relaxed arm gives
       only the noise. Drawn only for the arms the montage records, so the manual's montage draws the noise as before. */
    const leftRelaxed = this.relaxedAt != null && this.t >= this.relaxedAt + ECT.relaxantOnset;
    const emgOf = (side: 'R' | 'L') => {
      if (side === 'R') {
        const env = this.inducedAt == null ? this.fistEnvelope() : 0;
        const voluntary = env > 0 ? ECT.voluntaryEmg * env * this.emgNoise() : 0;
        return emgSample(this.armRelaxed ? 0 : a[this.lcentral], this.emgNoise) + voluntary;
      }
      return emgSample(leftRelaxed ? 0 : a[this.rcentral], this.emgNoise);
    };
    const hum = this.montage.ground ? 0 : ECT.mainsHum * Math.sin(2 * Math.PI * 50 * this.t);
    const channel = (l: Lead): number => {
      if (!mon || !l.black || !l.red) return 0;
      const kb = SPOT_KIND[l.black], kr = SPOT_KIND[l.red];
      let x = 0;
      if (kb === 'head' && kr === 'head') x = pot(l.red) - pot(l.black);
      else if (kb !== 'head' && kr !== 'head') {
        const vb = spotVector(l.black), vr = spotVector(l.red);
        x = 1000 * ((vr[0] - vb[0]) * v[0] + (vr[1] - vb[1]) * v[1] + (vr[2] - vb[2]) * v[2]);
        const onR = kb === 'foreR' || kr === 'foreR', onL = kb === 'foreL' || kr === 'foreL';
        if (onR) x += emgOf('R');
        if (onL) x += emgOf('L');
      }
      return x + hum;
    };
    this.rec.eeg1[i] = channel(this.montage.ch[0]);
    this.rec.eeg2[i] = channel(this.montage.ch[1]);
    this.rec.emg[i] = channel(this.montage.ch[2]);
    this.rec.ecg[i] = channel(this.montage.ch[3]);
  }

  private onEvent(e: ReturnType<EctDevice['drain']>[number]) {
    switch (e.type) {
      case 'baseline-start': this.baselineFrom = this.t; this.readyAt = null; break;
      case 'ready': this.readyAt = this.t; break;
      case 'stimulus-start': {
        this.startedAt = this.t;
        if (this.circuit) this.brain.pulses(pulseTrain(e.stimulus, dosesFor(this.patient.placement, e.stimulus.pulseWidth)));
        break;
      }
      case 'stimulus-stop': {
        const given = this.circuit ? (this.brain.pulsesGiven ?? 0) : 0;
        this.brain.stopPulses();
        const s = this.device.active;
        const pw = s?.pulseWidth ?? 0.5, f = s?.frequency ?? 30;
        const g: Stimulus = { frequency: f, pulseWidth: pw, pulses: given, charge: chargeOf({ frequency: f, pulseWidth: pw, pulses: given }), duration: given / (2 * f) };
        this.device.setDelivered(g);
        this.stimuli.push({ at: this.startedAt, end: this.t, percent: this.device.percent, program: this.device.settings.program, given: g, early: e.early, dynamicOhm: this.dynamicOhm, staticOhm: this.device.lastStatic, energy: (g.charge / 1000) * ECT.current * this.dynamicOhm });
        break;
      }
      case 'printer': {
        if (e.running) {
          this.printing.push({ from: this.t, to: null });
          const st = this.stimuli[this.stimuli.length - 1];
          this.paper.push({ kind: 'trace', from: this.t, to: null, afterStimulus: st && this.device.stimulusEnd != null ? st.end : null });
        } else {
          const p = this.printing[this.printing.length - 1]; if (p && p.to == null) p.to = this.t;
          const q = [...this.paper].reverse().find((x) => x.kind === 'trace') as Extract<PaperEntry, { kind: 'trace' }> | undefined; if (q && q.to == null) q.to = this.t;
        }
        break;
      }
      case 'report': this.reports.push(this.t); this.paper.push({ kind: 'report', at: this.t, stimulus: this.stimuli.length - 1 }); break;
      case 'selftest-printed': this.paper.push({ kind: 'selftest', at: this.t }); break;
      case 'settings-printed': this.paper.push({ kind: 'settings', at: this.t }); break;
      default: break;
    }
  }

  /** The end-of-treatment report for the last stimulus, from what was recorded up to now (null before a stimulus). */
  lastReport(): (SeizureReport & { stimulus: StimulusRecord; baselineAvailable: boolean; baseHr: number; peakHr: number; longestPause: number }) | null {
    const st = this.stimuli[this.stimuli.length - 1];
    if (!st) return null;
    /* the baseline counts only if READY came before the stimulus */
    const ok = this.baselineFrom != null && this.readyAt != null && this.readyAt <= st.at;
    const base: [number, number] | null = ok ? [Math.round(this.baselineFrom! * FS), Math.round(this.readyAt! * FS)] : null;
    const r = seizureReport({ eeg1: this.rec.eeg1, eeg2: this.rec.eeg2, emg: this.rec.emg, fs: FS, end: Math.round(st.end * FS), upTo: this.rec.n, baseline: base });
    /* the heart, as the device takes it (US 5,871,517): the baseline over the 5 s before the stimulus, the peak after it */
    let hb = 0, nb = 0; for (let x = st.at - 5; x < st.at; x += 0.5) { const h = this.heartRateAt(x); if (h > 0) { hb += h; nb++; } }
    let peak = 0; for (let x = st.end; x <= this.t; x += 0.5) peak = Math.max(peak, this.heartRateAt(x));
    return { ...r, stimulus: st, baselineAvailable: ok, baseHr: nb ? hb / nb : 0, peakHr: peak, longestPause: this.longestPause(st.at, Math.min(this.t, st.end + 30)) };
  }

  /** Give a premedication now (mg), into a vein. */
  give(drug: DrugId, mg: number) { this.body.run.drugs.give(drug, mg); }

  /* The body runs in blocks of BODY_BLOCK samples (0.1 s), ahead of the recording by one block: the vagal and sympathetic
     drive for the block are set from the stimulus and the seizure now, the body advances, and its ECG fills the block. */
  private stepBody() {
    const dt = BODY_BLOCK / FS;
    const delivering = this.device.treat === 'delivering' && this.circuit;
    const target = delivering ? vagalDrive(this.patient.placement, this.device.active?.pulseWidth ?? 0.5) : 0;
    /* the discharge acts while the current flows and fades with the vagal efferent time constant */
    this.vagal = delivering ? target : this.vagal * Math.exp(-dt / BARO.tauP);
    this.adrenergic += (ECT.seizureSympathetic * ictalIntensity(this.brain) - this.adrenergic) * (1 - Math.exp(-dt / BARO.tauS));
    /* the breathing returns when the anaesthetic's apnoea is over */
    if (this.breathingOff && this.apnoeaLeft <= 0) { this.breathingOff = false; this.setResp((r) => { r.drive = 1; }); }
    const ext = this.body.run.external;
    ext.vagalStim = this.vagal; ext.adrenergic = this.adrenergic;
    const heart = this.body.run.heart, before = this.body.samples;
    this.body.advance(dt);
    /* the new ECG samples (500 Hz) onto the recording's 200 Hz */
    const made = this.body.samples - before;
    const v = this.body.vcg((made + 1) / 500), n = v.X.length;
    const resample = (src: ArrayLike<number>) => { const out = new Float32Array(BODY_BLOCK); for (let k = 0; k < BODY_BLOCK; k++) { const x = (n - 1) * (k + 1) / BODY_BLOCK; const q = Math.floor(x), fr = x - q; out[k] = (src[q] ?? 0) * (1 - fr) + (src[Math.min(n - 1, q + 1)] ?? src[q] ?? 0) * fr; } return out; };
    this.vcgBlock = [resample(v.X), resample(v.Y), resample(v.Z)]; this.ecgAt = this.rec.n - 1;
    const m = (this.body.run.sim as unknown as { metrics?: { Psys: number; Pdia: number; Pmean: number } }).metrics;
    if (m) this.pressure.push({ t: this.t + dt, sys: m.Psys, dia: m.Pdia, mean: m.Pmean });
    /* R waves: ventricular activations, from the heart's clock to the session's */
    const offset = this.t - heart.timeMs / 1000 + dt;
    for (const a of heart.activations) if (a.kind === 'ventricles' && a.t > this.lastActivation) { this.lastActivation = a.t; this.rWaves.push(a.t / 1000 + offset); }
  }

  /** Heart rate (/min) at session time t, as the device counts it: from the R–R intervals of the last 3 s (the last interval
      if fewer), 0 after a pause of over 3 s. */
  heartRateAt(t: number): number {
    const r = this.rWaves;
    let j = r.length - 1; while (j >= 0 && r[j] > t) j--;
    if (j < 1 || t - r[j] > 3) return 0;
    let k = j; while (k > 0 && r[j] - r[k - 1] <= 3) k--;
    if (k === j) k = j - 1;
    return (60 * (j - k)) / (r[j] - r[k]);
  }

  /** the longest R–R interval between two times (s) */
  longestPause(from: number, to: number): number {
    const r = this.rWaves.filter((x) => x >= from - 3 && x <= to);
    let m = 0; for (let i = 1; i < r.length; i++) if (r[i] >= from) m = Math.max(m, r[i] - r[i - 1]);
    return m;
  }

  /** whether any region is seizing now (for the explanations, not shown by the device) */
  get seizing() { return this.brain.regions.some((r) => r.excess > CT.seizingThreshold); }
}

/** How intensely the brain is seizing, for its sympathetic outflow: the regions' excess cortical firing above the seizing
    threshold, averaged over the regions (1/s). It is highest in the first seconds of a seizure and falls as it slows. */
export function ictalIntensity(brain: Brain): number {
  let s = 0; for (const r of brain.regions) s += Math.max(0, r.excess - CT.seizingThreshold);
  return s / brain.regions.length;
}

/** Samples per body step (0.1 s at 200 Hz). */
export const BODY_BLOCK = 20;

/** The direct vagal discharge while the current flows (HeartElectrical.vagalStim), by placement and pulse width: fitted
    to Stewart 2010's heart rates during the stimulus (ECT.vagal…). Ultrabrief pulses (under 0.5 ms) take the
    unilateral ultrabrief value's share for every placement; left anterior right temporal is taken as bitemporal. */
export function vagalDrive(p: PlacementId, widthMs: number): number {
  const brief = p === 'BF' ? ECT.vagalBifrontal : p === 'RUL' ? ECT.vagalUnilateral : ECT.vagalBitemporal;
  if (widthMs >= 0.5) return brief;
  return brief * (ECT.vagalUnilateralUltrabrief / ECT.vagalUnilateral);
}

/** pink (1/f) noise, the shape of the awake EEG's spectrum, band-passed to the device's EEG band (0.5–30 Hz) */
function pinkBand(noise: () => number) {
  const b = [0, 0, 0]; let hp = 0, prev = 0, l1 = 0, l2 = 0;
  const a = 1 / (1 + (2 * Math.PI * 0.5) / FS), c = 1 - Math.exp((-2 * Math.PI * 30) / FS);
  return () => {
    const w = noise() + noise() + noise();                             // about normal
    /* Kellet's three-pole economy filter */
    b[0] = 0.99765 * b[0] + w * 0.099046; b[1] = 0.963 * b[1] + w * 0.2965164; b[2] = 0.57 * b[2] + w * 1.0526913;
    const pink = b[0] + b[1] + b[2] + w * 0.1848;
    hp = a * (hp + pink - prev); prev = pink;
    l1 += c * (hp - l1); l2 += c * (l1 - l2);
    return l2;
  };
}
/** the band's RMS for unit noise, measured once on a separate stream, so that a background can be of unit RMS */
let PINK_RMS = 0;
/** The resting background of one region, of unit RMS. Seeded. */
export function backgroundSource(noise: () => number): () => number {
  if (!PINK_RMS) { const g = pinkBand(noiseSource(91)); let v = 0; const n = FS * 120; for (let i = 0; i < n; i++) { const x = g(); v += x * x; } PINK_RMS = Math.sqrt(v / n); }
  const g = pinkBand(noise);
  return () => g() / PINK_RMS;
}

/** A uniform noise source in [−1, 1), seeded. */
export function noiseSource(seed: number) { let s = (seed * 2654435761) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 31 - 1; }; }

/** One EMG sample (µV): muscle activity in proportion to the motor cortex's firing above the spinal threshold, on a
    small resting noise (the amplifier and the relaxed muscle). */
export function emgSample(motorFiring: number, noise: () => number, threshold = ECT.emgThreshold, gain = ECT.emgPerFiring) {
  return Math.max(0, motorFiring - threshold) * gain * noise() + 3 * noise();
}


/** A treatment as the manual's sequence gives it, without a learner: power on, the impedance test, the baseline until
    READY, the stimulus with the button held to the end, then `after` seconds of recording and the report. For the fits,
    the tests and the station's starting points. */
export function scriptedTreatment(session: EctSession, o: { program?: DeviceSettings['program']; percent: number; after?: number }) {
  const d = session.device;
  if (o.program) d.settings.program = o.program;
  const i = PERCENT_STEPS.indexOf(o.percent);
  if (i < 0) throw new Error(`no ${o.percent} % setting`);
  d.settings.percentIndex = i;
  d.power(true); session.advance(6);
  d.impedanceButton(true); session.advance(1.5); d.impedanceButton(false);
  while (d.baseline !== 'ready') session.advance(0.5);
  session.advance(1);
  d.treatButton(true);
  while (d.treat !== 'done') session.advance(0.05);
  d.treatButton(false);
  session.advance(o.after ?? 150);
  d.startStop();
  session.advance(0.1);
  return session.lastReport();
}
