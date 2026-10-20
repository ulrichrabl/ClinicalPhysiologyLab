import { SeededRng } from '../../domains/cardio/ecg-engine/rng/seeded.ts';

/* ---------------------------------------------------------------------------
   One seeded generator for a run (ADR-018 decision 5).

   Every source of chance draws from a named stream of it: the heart's own
   noise and fibrillation, how long a task takes, later whether a shock ends
   VF. Each stream is derived from the seed and its name alone, so a draw in
   one never shifts another: adding a new use of chance does not change what
   the old ones draw for the same seed.
--------------------------------------------------------------------------- */

export class Chance {
  private streams = new Map<string, SeededRng>();
  constructor(readonly seed: number) {}

  private stream(name: string): SeededRng {
    let s = this.streams.get(name);
    if (!s) { s = new SeededRng(`${this.seed}:${name}`); this.streams.set(name, s); }
    return s;
  }

  /** Uniform on [0, 1). */
  uniform(name: string): number { return this.stream(name).next(); }

  /** A 32-bit seed for a model that keeps its own generator (the heart's). */
  seedFor(name: string): number { return Math.floor(this.stream(name).next() * 4294967296) >>> 0 || 1; }
}
