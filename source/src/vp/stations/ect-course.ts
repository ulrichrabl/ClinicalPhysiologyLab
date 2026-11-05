import type { LocalizedText } from '../model/i18n.ts';
import { PERCENT_STEPS } from './ect-programs.ts';
import { COURSE } from '../evidence/ect-course.ts';

/* ===========================================================================
   A course of ECT (part 3): the dose for the next treatment from the seizure
   adequacy markers score, and the seizure threshold rising from treatment to
   treatment.

   The next dose (the owner's hospital, after Minelli 2016): 5/5 the same;
   4/5 by the clinical course (the same, or 10–20 % more if the response is
   poor); 3/5 10–20 % more; under 3 at least 20 % more. The base is the dose
   of the last stimulus (after a restimulation, the restimulation's).

   The threshold: ECT is an anticonvulsant; over a course the threshold rises
   (Coffey 1995: about 47 % on average from the first treatment to the sixth,
   in 56 % of patients). The model lowers the drive of each pulse in
   proportion, so the threshold charge rises by that much; linear in the
   treatment number (an assumption: Coffey measured only the first and the
   sixth).
=========================================================================== */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export type NextDose = 'same' | 'up10to20' | 'up20plus';
export const NEXT_DOSE_NAME: Record<NextDose, LocalizedText> = {
  same: L('The same dose', 'Gleiche Dosis'),
  up10to20: L('10–20 % more', '10–20 % mehr'),
  up20plus: L('At least 20 % more', 'Mindestens 20 % mehr'),
};

/** which next doses the SAMS allows (4/5: the same or 10–20 % more, by the clinical course) */
export function allowedNextDose(points: number): NextDose[] {
  return points >= 5 ? ['same'] : points === 4 ? ['same', 'up10to20'] : points === 3 ? ['up10to20'] : ['up20plus'];
}

/** the dial setting for a next-dose choice from a base dose: the nearest dial step to 1.15 or 1.25 times, never below
    the base for a rise, capped at the device's maximum */
export function nextPercent(base: number, choice: NextDose, max = 200): number {
  if (choice === 'same') return base;
  const want = base * (choice === 'up10to20' ? 1.15 : 1.25), lo = base * (choice === 'up10to20' ? 1.1 : 1.2);
  const steps = PERCENT_STEPS.filter((x) => x <= max && x >= lo - 1e-9);
  if (!steps.length) return Math.min(max, PERCENT_STEPS[PERCENT_STEPS.length - 1]);
  return steps.reduce((b, x) => (Math.abs(x - want) < Math.abs(b - want) ? x : b), steps[0]);
}

/** how much the course has raised the threshold by the n-th treatment (1 at the first) */
export function thresholdFactor(n: number): number { return 1 + (COURSE.thresholdRise * Math.max(0, n - 1)) / (COURSE.riseBy - 1); }
/** the drive of each pulse at the n-th treatment, falling by driveDrop to the sixth (fitted so that the threshold then
    stands thresholdFactor higher; the model's threshold is not proportional to the drive) */
export function courseDrive(n: number): number { return 1 - (COURSE.driveDrop * Math.max(0, n - 1)) / (COURSE.riseBy - 1); }

/** one treatment of a course, as the course log keeps it */
export interface CourseEntry { n: number; percent: number; restimPercent: number | null; eegEndpoint: number | null; points: number | null; next: NextDose | null; nextPercent: number | null; mistakes: number }
