import { Brain } from './corticothalamic.ts';
import { CT } from '../../evidence/seizure.ts';
import { PLACEMENTS, StimulusField, regionDoses, pulseTrain, type PlacementId, type RegionDose, type StimulusSettings } from './ect-stimulus.ts';

/* ---------------------------------------------------------------------------
   An ECT stimulus trial: a resting brain, a train of pulses through a
   placement, and whether a seizure follows. Used by the fit
   (scripts/fit-ect.mjs), the tests and the station, so all three decide
   "a seizure" the same way: a region's cortex still firing above the
   seizing threshold 8 s after the train has ended.
--------------------------------------------------------------------------- */

const fields = new Map<PlacementId, StimulusField>();
export function fieldFor(p: PlacementId): StimulusField {
  let f = fields.get(p);
  if (!f) { f = new StimulusField(PLACEMENTS[p]); fields.set(p, f); }
  return f;
}
const doseCache = new Map<string, RegionDose[]>();
export function dosesFor(p: PlacementId, widthMs: number): RegionDose[] {
  const k = `${p}:${widthMs}`;
  let d = doseCache.get(k);
  if (!d) { d = regionDoses(fieldFor(p), widthMs); doseCache.set(k, d); }
  return d;
}

/** Seconds after the train's end at which the brain is looked at. */
export const LOOK_AFTER = 8;

export function seizes(placement: PlacementId, s: StimulusSettings, seed = 1, driveScale = 1): boolean {
  const b = new Brain({ seed });
  b.settle(6); b.advance(1);
  const tr = pulseTrain(s, dosesFor(placement, s.pulseWidth));
  b.pulses({ ...tr, area: tr.area.map((a) => a * driveScale) });
  b.advance(s.pulses / (2 * s.frequency) + LOOK_AFTER);
  return b.regions.some((r) => r.excess > CT.seizingThreshold);
}

/** The lowest of an ordered list of stimuli (weakest first) that starts a seizure, by bisection (the list is taken as
    monotonic); its index, or -1 if none does. */
export function firstSeizing(placement: PlacementId, ladder: StimulusSettings[], seed = 1, driveScale = 1): number {
  if (!seizes(placement, ladder[ladder.length - 1], seed, driveScale)) return -1;
  let lo = -1, hi = ladder.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (seizes(placement, ladder[m], seed, driveScale)) hi = m; else lo = m; }
  return hi;
}

/** The threshold charge (mC) on a ladder, interpolated between the last stimulus that fails and the first that works
    by the drive each needs: a continuous threshold from a stepped device. */
export function thresholdCharge(placement: PlacementId, ladder: StimulusSettings[], seed = 1, driveScale = 1, current = 0.9): number | null {
  const i = firstSeizing(placement, ladder, seed, driveScale);
  if (i < 0) return null;
  const q = (s: StimulusSettings) => current * s.pulseWidth * s.pulses;
  if (i === 0) return q(ladder[0]);
  /* the drive scale at which each of the two neighbours is exactly at threshold */
  const need = (s: StimulusSettings) => { let lo = 0, hi = 4 * driveScale; for (let k = 0; k < 9; k++) { const m = (lo + hi) / 2; if (seizes(placement, s, seed, m)) hi = m; else lo = m; } return hi; };
  const a = need(ladder[i - 1]), b = need(ladder[i]);
  /* where on the line between them the actual drive falls (a > driveScale >= b) */
  const f = a > b ? Math.max(0, Math.min(1, (a - driveScale) / (a - b))) : 1;
  return q(ladder[i - 1]) + f * (q(ladder[i]) - q(ladder[i - 1]));
}
