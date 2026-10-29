import { ECT } from '../evidence/ect.ts';
import { CT } from '../evidence/seizure.ts';
import { Brain, REGIONS } from '../physiology/brain/corticothalamic.ts';
import { pulseTrain, charge as chargeOf, type PlacementId } from '../physiology/brain/ect-stimulus.ts';
import { dosesFor } from '../physiology/brain/ect-trial.ts';
import { regionFields } from './eeg-seizure.ts';
import { EctDevice, type Stimulus, type DeviceSettings, DEFAULT_SETTINGS } from './ect-device.ts';
import { PERCENT_STEPS } from './ect-programs.ts';
import { seizureReport, type SeizureReport } from './ect-indices.ts';

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
   - The EMG is the cuffed right foot's: the motor seizure there follows the
     left central region's cortical firing (ECT.emgThreshold, ECT.emgPerFiring;
     placements).
   - The ECG runs at a constant rate: the vagal and sympathetic responses
     to the stimulus and the seizure are the next part (ECT 2).
=========================================================================== */

export interface EctPatient {
  placement: PlacementId;
  /** skin cleaned and pads pressed on */
  prepared: boolean;
  /** the patient's skin: how far from the mean (SD) the static impedance lies */
  skin: number;
  seed: number;
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

export interface StimulusRecord { at: number; end: number; given: Stimulus; early: boolean; dynamicOhm: number; staticOhm: number | null; energy: number }

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
  /** cables: stimulus cable to the pads, monitoring cable to the EEG, EMG and ECG electrodes */
  stimulusCable = true; monitoringCable = true;
  private startedAt = 0;
  private emgNoise: () => number;
  private fields = regionFields();
  private lcentral = REGIONS.findIndex((r) => r.id === 'L-central');

  constructor(patient: EctPatient = DEFAULT_PATIENT, settings: DeviceSettings = DEFAULT_SETTINGS) {
    this.patient = { ...patient };
    this.device = new EctDevice(settings);
    this.brain = new Brain({ seed: patient.seed });
    this.brain.settle(6);
    const cap = FS * 60 * 12;
    this.rec = { eeg1: new Float32Array(cap), eeg2: new Float32Array(cap), emg: new Float32Array(cap), ecg: new Float32Array(cap), motor: new Float32Array(cap), n: 0 };
    this.emgNoise = noiseSource(patient.seed);
    this.updateImpedance();
  }

  /** the static impedance of this head now (Ω): what the device would read */
  get staticOhm() {
    if (!this.stimulusCable) return Infinity;
    const z = ECT.staticMean + this.patient.skin * ECT.staticSD;
    return Math.max(150, z) * (this.patient.prepared ? 1 : ECT.unpreparedSkin);
  }
  /** the dynamic impedance it presents to the 0.9 A stimulus (Ω) */
  get dynamicOhm() { return ECT.dynamicMean + ECT.staticToDynamic * this.patient.skin * ECT.dynamicSD; }
  private updateImpedance() { this.device.staticOhm = this.staticOhm; }
  setPrepared(p: boolean) { this.patient.prepared = p; this.updateImpedance(); }
  setStimulusCable(on: boolean) { this.stimulusCable = on; this.updateImpedance(); }

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
    let fp1 = 0, tp9 = 0, fp2 = 0, tp10 = 0;
    for (let r = 0; r < a.length; r++) { fp1 += f[r].Fp1 * a[r]; tp9 += f[r].TP9 * a[r]; fp2 += f[r].Fp2 * a[r]; tp10 += f[r].TP10 * a[r]; }
    const mon = this.monitoringCable;
    this.rec.eeg1[i] = mon ? fp1 - tp9 : 0;
    this.rec.eeg2[i] = mon ? fp2 - tp10 : 0;
    /* the motor seizure: the motor cortex above the spinal threshold drives the cuffed foot's muscles */
    this.rec.motor[i] = a[this.lcentral];
    this.rec.emg[i] = mon ? emgSample(a[this.lcentral], this.emgNoise) : 0;
    this.rec.ecg[i] = mon ? 1000 * ecgAt(this.t, ECT.restingHeartRate) : 0;
  }

  private onEvent(e: ReturnType<EctDevice['drain']>[number]) {
    switch (e.type) {
      case 'baseline-start': this.baselineFrom = this.t; this.readyAt = null; break;
      case 'ready': this.readyAt = this.t; break;
      case 'stimulus-start': {
        this.startedAt = this.t;
        if (this.stimulusCable) this.brain.pulses(pulseTrain(e.stimulus, dosesFor(this.patient.placement, e.stimulus.pulseWidth)));
        break;
      }
      case 'stimulus-stop': {
        const given = this.stimulusCable ? (this.brain.pulsesGiven ?? 0) : 0;
        this.brain.stopPulses();
        const s = this.device.active;
        const pw = s?.pulseWidth ?? 0.5, f = s?.frequency ?? 30;
        const g: Stimulus = { frequency: f, pulseWidth: pw, pulses: given, charge: chargeOf({ frequency: f, pulseWidth: pw, pulses: given }), duration: given / (2 * f) };
        this.device.setDelivered(g);
        this.stimuli.push({ at: this.startedAt, end: this.t, given: g, early: e.early, dynamicOhm: this.dynamicOhm, staticOhm: this.device.lastStatic, energy: (g.charge / 1000) * ECT.current * this.dynamicOhm });
        break;
      }
      case 'printer': if (e.running) this.printing.push({ from: this.t, to: null }); else { const p = this.printing[this.printing.length - 1]; if (p && p.to == null) p.to = this.t; } break;
      case 'report': this.reports.push(this.t); break;
      default: break;
    }
  }

  /** The end-of-treatment report for the last stimulus, from what was recorded up to now (null before a stimulus). */
  lastReport(): (SeizureReport & { stimulus: StimulusRecord; baselineAvailable: boolean }) | null {
    const st = this.stimuli[this.stimuli.length - 1];
    if (!st) return null;
    /* the baseline counts only if READY came before the stimulus */
    const ok = this.baselineFrom != null && this.readyAt != null && this.readyAt <= st.at;
    const base: [number, number] | null = ok ? [Math.round(this.baselineFrom! * FS), Math.round(this.readyAt! * FS)] : null;
    const r = seizureReport({ eeg1: this.rec.eeg1, eeg2: this.rec.eeg2, emg: this.rec.emg, fs: FS, end: Math.round(st.end * FS), upTo: this.rec.n, baseline: base });
    return { ...r, stimulus: st, baselineAvailable: ok };
  }

  /** whether any region is seizing now (for the explanations, not shown by the device) */
  get seizing() { return this.brain.regions.some((r) => r.excess > CT.seizingThreshold); }
}

/** A uniform noise source in [−1, 1), seeded. */
export function noiseSource(seed: number) { let s = (seed * 2654435761) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 31 - 1; }; }

/** One EMG sample (µV): muscle activity in proportion to the motor cortex's firing above the spinal threshold, on a
    small resting noise (the amplifier and the relaxed muscle). */
export function emgSample(motorFiring: number, noise: () => number, threshold = ECT.emgThreshold, gain = ECT.emgPerFiring) {
  return Math.max(0, motorFiring - threshold) * gain * noise() + 3 * noise();
}

/* A plain ECG for channel 4 (lead II-like, mV), a sum of Gaussians for P, QRS and T at a fixed rate. */
export function ecgAt(t: number, rate: number) {
  const rr = 60 / rate, ph = (t % rr) / rr;
  const g = (c: number, w: number, a: number) => a * Math.exp(-(((ph - c) / w) ** 2));
  return g(0.1, 0.025, 0.12) + g(0.235, 0.008, -0.12) + g(0.25, 0.01, 1.1) + g(0.265, 0.008, -0.25) + g(0.5, 0.05, 0.3);
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
