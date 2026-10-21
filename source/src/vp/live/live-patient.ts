import { createCirculation, type CirculationRun } from '../engine/circulation-host.ts';
import type { PatientModel } from '../physiology/state.ts';
import { chemistryState } from '../physiology/chemistry.ts';
import type { Vcg } from '../measurements/ecg.ts';
import type { Activation } from '../physiology/heart/electrical.ts';

/* ===========================================================================
   A patient whose physiology is running.

   The circulation and the heart's electrical model advance in real time
   (about a hundred times faster than real time on a laptop, so a frame
   costs a fraction of a millisecond). Everything that looks at the patient
   reads from here: the examination reads the latest snapshot, the monitor
   and the physiology chapters animate it, and an ECG ordered now records
   the last ten seconds of the heart's dipole through the electrodes.
=========================================================================== */

const KEEP_S = 16;           // seconds of dipole kept for recording
const FS = 500;

export type Snapshot = Record<string, any>;

/** How many recent beats a live patient keeps with their samples (about seven seconds at a resting rate). */
const BEATS_KEPT = 10;
/** The longest step between two looks at the circulation (s): shorter than any beat. */
const STEP_S = 0.2;

/** One beat as the circulation recorded it. */
export interface BeatRecord {
  t0: number; dur: number;
  samples: Array<Record<string, number>>;
  events: Record<string, number | null>;
  times: Record<string, number | null>;
  log: Record<string, any>;
}

export class LivePatient {
  model: PatientModel;
  run: CirculationRun;
  snap: Snapshot;
  chemistry: Record<string, number>;
  /** Simulated seconds since this patient was created. */
  t = 0;
  speed = 1;
  private X = new Float32Array(KEEP_S * FS);
  private Y = new Float32Array(KEEP_S * FS);
  private Z = new Float32Array(KEEP_S * FS);
  private w = 0;
  private filled = 0;
  private raf = 0;
  private last = 0;
  private listeners = new Set<(p: LivePatient) => void>();

  constructor(model: PatientModel) {
    this.model = structuredClone(model);
    this.run = createCirculation(this.model);
    this.snap = this.capture();
    this.chemistry = chemistryState(this.snap, this.model.chemistry) as unknown as Record<string, number>;
  }

  /** True while the body's course is being run again; the clock does not advance meanwhile. */
  busy = false;

  /** Run the illness's course (the body over hours to days), then let circulation and lungs settle around it.
      In slices, so the page stays responsive. */
  async settle(seconds: number, slice = 2): Promise<void> {
    this.busy = true;
    try {
      for (const _ of this.settleSteps(seconds, slice)) await new Promise((r) => setTimeout(r, 0));
    } finally { this.busy = false; }
    this.settled();
  }

  /** The same settling, at once: for a run that must be reproduced exactly (a scenario, ADR-018), and for tests.
      It does the same arithmetic as `settle`, so both reach the same patient. */
  settleNow(seconds: number, slice = 2): void {
    for (const _ of this.settleSteps(seconds, slice)) { /* run to the end */ }
    this.settled();
  }

  private *settleSteps(seconds: number, slice: number): Generator<void> {
    yield* this.run.courseSteps();
    /* In passes, as settleModel does: the lungs change the circulation and the circulation the lungs. */
    const run = this.run;
    function* pass(s: number): Generator<void> {
      for (let done = 0; done < s; done += slice) { run.advance(Math.min(slice, s - done)); yield; }
    }
    const s = seconds * 0.6;
    yield* pass(s * 0.5); run.equilibrate();
    yield* pass(s * 0.35); run.equilibrate();
    yield* pass(s * 0.15);
  }

  private settled(): void {
    this.snap = this.capture();
    this.chemistry = chemistryState(this.snap, this.model.chemistry) as unknown as Record<string, number>;
    this.emit();
  }

  advance(seconds: number): void {
    if (seconds <= 0 || this.busy) return;
    /* In steps shorter than a beat: each beat is recorded when a step ends after it, and a long step would drop all but
       its last beat (a slow frame, or running ahead). */
    for (let done = 0; done < seconds - 1e-9;) {
      const h = Math.min(STEP_S, seconds - done);
      this.run.advance(h);
      this.t += h; done += h;
      this.snap = this.capture();
    }
    this.chemistry = chemistryState(this.snap, this.model.chemistry) as unknown as Record<string, number>;
  }

  /** Change any parameter: the running patient responds from now on, as a real one would. A change to the
      body's causes (intake, losses, kidney, drugs, hormones) or to how long they have acted runs the course again,
      since those act over hours and days. */
  setModel(m: PatientModel): void {
    const before = this.model;
    this.model = structuredClone(m);
    this.run.apply(this.model);
    this.chemistry = chemistryState(this.snap, this.model.chemistry) as unknown as Record<string, number>;
    this.emit();
    if (JSON.stringify(before.body) !== JSON.stringify(m.body) || JSON.stringify(before.chronic) !== JSON.stringify(m.chronic)) {
      const pending = ++this.courseRun;
      setTimeout(() => { if (pending === this.courseRun) void this.settle(8); }, 250);
    }
  }
  private courseRun = 0;

  /** How many dipole samples have been produced since the patient was created: a monitor reads the ones it has not
      drawn yet. */
  get samples(): number { return this.total; }
  private total = 0;

  /** The last `seconds` of the cardiac dipole (Frank X, Y, Z in mV, 500 Hz). */
  vcg(seconds = 10): Vcg {
    const n = Math.min(this.filled, Math.round(seconds * FS));
    const out = { X: new Float32Array(n), Y: new Float32Array(n), Z: new Float32Array(n), fs: FS };
    const N = this.X.length;
    for (let i = 0; i < n; i++) {
      const j = (this.w - n + i + N) % N;
      out.X[i] = this.X[j]; out.Y[i] = this.Y[j]; out.Z[i] = this.Z[j];
    }
    return out;
  }

  /** The last `seconds` of the dipole together with the activations that produced it, on the heart's clock:
      sample i was produced at t0 + i·dt ms. */
  recording(seconds = 10): { vcg: Vcg; t0: number; dt: number; activations: Activation[] } {
    const vcg = this.vcg(seconds);
    const dt = 1000 / FS, heart = this.run.heart;
    const t0 = heart.sampledTo - (vcg.X.length - 1) * dt;
    const activations = heart.activations.filter((a) => (a.kind === 'atria' ? a.end : a.tEnd) >= t0 - 1000 && a.t <= heart.sampledTo + 1000).map((a) => ({ ...a }));
    return { vcg, t0, dt, activations };
  }

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000)) * this.speed;
      this.last = now;
      this.advance(dt);
      this.emit();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
  stop(): void { cancelAnimationFrame(this.raf); this.raf = 0; }
  get running(): boolean { return this.raf !== 0; }

  /** The most recent complete beats, oldest first: each with its 2 ms samples, valve events and times, and where in the
      breath it fell. Times are ms on the circulation's clock (a beat's samples run from its own start, t0). */
  beats: BeatRecord[] = [];
  private lastBeatT0 = NaN;

  on(fn: (p: LivePatient) => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const fn of this.listeners) fn(this); }

  private capture(): Snapshot {
    const s = this.run.sim.snapshot() as Snapshot;
    const v = s.ecgLeads as { X?: number[]; Y?: number[]; Z?: number[] } | undefined;
    if (v?.X) {
      const N = this.X.length;
      for (let i = 0; i < v.X.length; i++) {
        this.X[this.w] = v.X[i]; this.Y[this.w] = v.Y![i]; this.Z[this.w] = v.Z![i];
        this.w = (this.w + 1) % N;
      }
      this.filled = Math.min(N, this.filled + v.X.length);
      this.total += v.X.length;
    }
    delete s.ecgLeads;
    const entry = (s.beatLog as BeatRecord['log'][] | undefined)?.at(-1);
    if (entry && s.beat && entry.t0 !== this.lastBeatT0) {
      this.lastBeatT0 = entry.t0;
      this.beats.push({ t0: entry.t0, dur: s.beat.dur, samples: s.beat.samples, events: s.beat.events, times: s.valveTimes, log: entry });
      if (this.beats.length > BEATS_KEPT) this.beats.shift();
    }
    s.electrical = this.run.heart.p;
    s.ecgDrive = this.run.heart.drive();
    s.resp = this.run.resp.snapshot();
    s.body = this.run.body.snapshot();
    return s;
  }
}
