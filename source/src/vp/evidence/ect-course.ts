import { defineConstants } from './constants.ts';

/* A course of ECT (ECT part 3): how the seizure threshold rises from treatment to treatment. */
export const COURSE = defineConstants('ect-course', {
  thresholdRise: { value: 0.47, unit: 'fraction', status: 'measured', refs: ['coffey1995b'], means: 'Rise of the seizure threshold from the first treatment to the sixth.',
    derivation: 'Coffey 1995: titrated at the first and the sixth treatment in 62 patients (brief pulse, constant current, moderately above threshold): the threshold rose by about 47 % on average; only 35 (56 %) showed a rise; the rise grew with age and was not tied to the response. The model takes the average for every patient.' },
  riseBy: { value: 6, unit: 'treatment', status: 'measured', refs: ['coffey1995b'], means: 'The treatment by which the threshold has risen by thresholdRise; the model rises in a straight line from the first to it (an assumption: only the first and the sixth were measured) and goes on at the same rate.',
    derivation: 'Coffey 1995 titrated at the first and the sixth treatment.' },
  driveDrop: { value: 0.09, unit: 'fraction', status: 'derived', refs: ['coffey1995b'], means: 'How much weaker each pulse acts on the cortex by the sixth treatment (falling in a straight line from the first, and on at the same rate): the anticonvulsant effect of the course, put where the model’s threshold sits.',
    derivation: 'Fitted once (scripts/fit-ect-course.mjs) so that the bitemporal threshold on the 0.5 ms program (seed 3) is thresholdRise higher at the sixth treatment. The model’s threshold does not rise in proportion to a weaker pulse (it is set by the drive of each pulse more than by their number): a drive 0.9 times as strong gives a threshold 1.55 times as high, 0.8 times 2.46, and 0.68 times none within the device. So the drop is fitted, not taken as 1/(1 + thresholdRise). The fit: 0.91 gives 94.6 → 141 mC (1.49). Checked, not fitted: right unilateral 1.48; bifrontal 1.84, a known gap.' },
  perWeek: { value: 3, unit: 'treatments/week', status: 'measured', refs: ['thymatron2021'], means: 'Treatments a week in an index course.', derivation: 'The manual: two or three a week, six to ten in all.' },
});
