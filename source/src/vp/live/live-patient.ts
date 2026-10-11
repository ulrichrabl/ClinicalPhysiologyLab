import { createCirculation, type CirculationRun } from '../engine/circulation-host.ts';
import type { PatientModel } from '../physiology/state.ts';
import { chemistryState } from '../physiology/chemistry.ts';
import type { Vcg } from '../measurements/ecg.ts';

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

  /** Run ahead without drawing, in slices, so the page stays responsive. */
  async settle(seconds: number, slice = 2): Promise<void> {
    for (let done = 0; done < seconds; done += slice) {
      this.advance(Math.min(slice, seconds - done));
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  advance(seconds: number): void {
    if (seconds <= 0) return;
    const sim = this.run.sim;
    sim.advance(Math.max(1, Math.round(seconds / sim.dt)));
    this.t += seconds;
    this.snap = this.capture();
    this.chemistry = chemistryState(this.snap, this.model.chemistry) as unknown as Record<string, number>;
  }

  /** Change any parameter: the running patient responds from now on, as a real one would. */
  setModel(m: PatientModel): void {
    this.model = structuredClone(m);
    this.run.apply(this.model);
    this.chemistry = chemistryState(this.snap, this.model.chemistry) as unknown as Record<string, number>;
    this.emit();
  }

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
    }
    delete s.ecgLeads;
    s.electrical = this.run.heart.p;
    return s;
  }
}
