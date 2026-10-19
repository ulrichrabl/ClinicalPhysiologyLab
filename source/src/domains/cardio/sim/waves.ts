/* ===========================================================================
   The waves of one beat, read from its own samples (2 ms): what a hand on
   the carotid and an eye on the neck veins take in.

   Venous (right atrial pressure):
   - a: the atrium contracting (its activation above a third of its peak);
     when it contracts while the ventricles are contracting too, the
     tricuspid valve is shut and the blood has nowhere to go but back up
     the neck: the cannon wave (`aClosed`);
   - x: the fall as the atrium relaxes and the valve ring is pulled down;
   - v: the atrium filling from the veins against a closed tricuspid valve
     (and, if it leaks, from the ventricle);
   - y: the fall when the tricuspid valve opens and the ventricle fills.
   The c wave needs the valve ring to bulge into the atrium, which the
   model does not have: it is not read.

   Arterial: the upstroke (foot to 90 % of the rise), the peak and trough.

   Nothing here shapes the pressures: it reads what the circulation made.
=========================================================================== */

export interface WaveSample { t: number; Pa: number; Pra: number; ea?: number; enRv?: number; Qtri?: number }

export interface VenousWaves {
  mean: number;
  /** peak of the a wave (mmHg), null when the atria did not contract */
  a: number | null;
  /** highest right atrial pressure while atrium and ventricle contract together, null if they never did */
  aClosed: number | null;
  x: number; v: number; y: number;
  /** when each was (ms from the beat's start), for labelling a drawn beat */
  at: { a: number | null; x: number; v: number; y: number };
}

export interface ArterialWave { foot: number; peak: number; upstrokeMs: number }

const ATRIUM_ON = 0.3, ATRIUM_OFF = 0.1, VENTRICLE_ON = 0.3, CLOSED_ML_S = 0.5;

export function venousWaves(b: WaveSample[]): VenousWaves {
  let sum = 0;
  for (const s of b) sum += s.Pra;
  const mean = b.length ? sum / b.length : 0;
  let a: number | null = null, aAt: number | null = null, aClosed: number | null = null, v = -Infinity, vAt = -1;
  for (let i = 0; i < b.length; i++) {
    const s = b[i], ea = s.ea ?? 0;
    if (ea > ATRIUM_ON) {
      if (a == null || s.Pra > a) { a = s.Pra; aAt = s.t; }
      if ((s.enRv ?? 0) > VENTRICLE_ON && (s.Qtri ?? 0) <= CLOSED_ML_S) aClosed = Math.max(aClosed ?? -Infinity, s.Pra);
    }
    if (ea < ATRIUM_OFF && (s.Qtri ?? 0) <= CLOSED_ML_S && s.Pra > v) { v = s.Pra; vAt = i; }
  }
  if (vAt < 0) { v = mean; vAt = 0; }
  /* x: the lowest pressure before the v wave; y: the lowest after it, once the tricuspid valve has opened */
  let x = Infinity, y = Infinity, xAt = 0, yAt = 0;
  for (let i = 0; i <= vAt; i++) if ((b[i].ea ?? 0) < ATRIUM_OFF && b[i].Pra < x) { x = b[i].Pra; xAt = b[i].t; }
  for (let i = vAt; i < b.length; i++) if ((b[i].Qtri ?? 0) > CLOSED_ML_S && b[i].Pra < y) { y = b[i].Pra; yAt = b[i].t; }
  if (!Number.isFinite(x)) x = mean;
  if (!Number.isFinite(y)) y = mean;
  return { mean, a, aClosed, x, v, y, at: { a: aAt, x: xAt, v: b[vAt]?.t ?? 0, y: yAt } };
}

export function arterialWave(b: WaveSample[]): ArterialWave {
  let pk = 0;
  for (let i = 1; i < b.length; i++) if (b[i].Pa > b[pk].Pa) pk = i;
  let ft = 0;
  for (let i = 1; i <= pk; i++) if (b[i].Pa < b[ft].Pa) ft = i;
  const foot = b[ft]?.Pa ?? 0, peak = b[pk]?.Pa ?? 0, at90 = foot + 0.9 * (peak - foot);
  let i90 = pk;
  for (let i = ft; i <= pk; i++) if (b[i].Pa >= at90) { i90 = i; break; }
  return { foot, peak, upstrokeMs: (b[i90]?.t ?? 0) - (b[ft]?.t ?? 0) };
}
