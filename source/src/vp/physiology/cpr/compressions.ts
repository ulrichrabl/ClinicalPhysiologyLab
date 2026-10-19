import { CPR } from '../../evidence/cpr.ts';

/* ===========================================================================
   Chest compressions as a pressure on the chest (ADR-018 decision 6a).

   Each compression starts when it is given (a tap, a rescuer's push) and
   raises the intrathoracic pressure as a half-sine for `duty` of the
   interval since the previous compression, then releases fully: the
   relaxation phase in which the coronary arteries fill. The circulation
   reads the pressure at every step of its own clock.

   The compressor is a pure function of the onsets it was given, so a run
   with the same onsets produces the same pressures, step for step.
=========================================================================== */

export class Compressor {
  /** Onsets in seconds on the circulation's clock, in order. */
  private onsets: number[] = [];
  /** The intrathoracic pressure rise a compression reaches (mmHg). */
  constructor(public amplitude: number = CPR.itpManual) {}

  /** A compression begins at time `t` (circulation seconds). Onsets must come in order. */
  push(t: number): void {
    const last = this.onsets.at(-1);
    if (last !== undefined && t < last) throw new Error(`compression at ${t} s before the previous one at ${last} s`);
    this.onsets.push(t);
    if (this.onsets.length > 64) this.onsets.splice(0, this.onsets.length - 64);
  }

  /** Compressions at a steady rate from `from` until `until` (a rescuer or a device keeping time). */
  steady(rate: number, from: number, until = Infinity): void { this.rate = { T: 60 / rate, from, until }; }
  /** Stop a steady rate at `t`. */
  stopSteady(t: number): void { if (this.rate) this.rate.until = Math.min(this.rate.until, t); }
  private rate: { T: number; from: number; until: number } | null = null;

  /** The compression in progress at t: its onset and how long it lasts, or null. */
  private current(t: number): { at: number; d: number } | null {
    const o = this.onsets;
    let i = o.length - 1;
    while (i >= 0 && o[i] > t) i--;
    let best: { at: number; d: number } | null = null;
    if (i >= 0) {
      const prev = i > 0 ? o[i - 1] : undefined;
      const interval = prev === undefined ? CPR.longestCycle : o[i] - prev;
      best = { at: o[i], d: CPR.duty * Math.min(CPR.longestCycle, Math.max(0.05, interval)) };
    }
    const r = this.rate;
    if (r && t >= r.from) {
      const k = Math.floor((t - r.from) / r.T + 1e-9), at = r.from + k * r.T;
      if (at < r.until && (!best || at > best.at)) best = { at, d: CPR.duty * Math.min(CPR.longestCycle, r.T) };
    }
    return best;
  }

  /** The intrathoracic pressure rise at time t. */
  pressureAt(t: number): number {
    const c = this.current(t);
    if (!c) return 0;
    const x = (t - c.at) / c.d;
    return x < 1 ? this.amplitude * Math.sin(Math.PI * x) : 0;
  }

}
