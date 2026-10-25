import { defineConstants } from './constants.ts';

/* How a lower motor neuron lesion weakens and wastes a muscle (models/neuro-limb.ts): the share of its motor units a
   lesion takes, the force those left give, now and after they sprout, the MRC grade a hand gives that force, and the
   muscle's bulk as its denervated fibres shrink. */

export const NEURO = defineConstants('neuro', {
  partialShare: { value: 0.5, unit: 'fraction', status: 'assumed',
    means: 'Share of a structure’s fibres a lesion marked partial takes when the case does not say how much.',
    derivation: 'A convention for “partial” with no share given: half. A case or station that knows the share gives it as the lesion’s extent.' },
  sproutGain: { value: 2, unit: 'ratio', status: 'derived', refs: ['hansen1978', 'sharrard1955', 'gordon2010'],
    means: 'Most force the surviving motor units of a partly denervated muscle reach by sprouting, as a multiple of their own.',
    derivation: 'Human: reinnervation fully compensates the loss of up to half the motor neurone pool (Hansen 1978, electrically); weakness on manual testing needs more than half the anterior horn cells lost (Sharrard 1955). Full compensation down to 50 % survival is a gain of 2. In the rat surviving units enlarge about 5-fold (Gordon 2010); the human figure is used.' },
  sproutDays: { value: 60, unit: 'days', status: 'assumed', refs: ['gordon2010'],
    means: 'Time constant over which the surviving units’ sprouting reaches the denervated fibres.',
    derivation: 'No human time course was found. In the rat units had enlarged by the first test at 23 days; clinical recovery by collateral sprouting is taught as weeks to months. Placed at 2 months: a gap.' },
  mrc5: { value: 0.8, unit: 'fraction of normal', status: 'derived', refs: ['bohannon2005', 'vanderploeg1991'],
    means: 'Force above which the examiner’s hand finds the muscle normal (MRC 5).',
    derivation: 'The two sides normally differ by up to 18–22 % (van der Ploeg 1991), and manual testing misses deficits of 15–30 % (Bohannon 2005): a muscle at 80 % or more is graded 5.' },
  mrcTrace: { value: 0.02, unit: 'fraction of normal', status: 'assumed',
    means: 'Force below which a muscle only flickers (MRC 1), not moving the joint with gravity removed (MRC 2).',
    derivation: 'Grades 1 and 2 are definitions, not force fractions; nothing measured sets the boundary. A convention.' },
  grade3Knee: { value: 0.05, unit: 'fraction of normal', status: 'measured', refs: ['sato1999', 'dvir1997'],
    means: 'Knee extension: force that lifts the leg against gravity (MRC 3).', derivation: 'Sato 1999: 4.8 % of maximum torque in men, 4.6 % in women; Dvir 1997: 5–10 %.' },
  grade3Elbow: { value: 0.08, unit: 'fraction of normal', status: 'derived', refs: ['dvir1997'],
    means: 'Elbow flexion and extension: force that lifts the forearm against gravity (MRC 3).', derivation: 'Dvir 1997: 7–10 %; the middle.' },
  grade3Shoulder: { value: 0.15, unit: 'fraction of normal', status: 'derived', refs: ['dvir1997'],
    means: 'Shoulder abduction: force that lifts the arm against gravity (MRC 3).', derivation: 'Dvir 1997: 7–27 %, higher in women; the middle.' },
  grade3Hip: { value: 0.25, unit: 'fraction of normal', status: 'assumed', refs: ['dvir1997'],
    means: 'Hip movements: force that moves the leg against gravity (MRC 3).', derivation: 'Dvir 1997 gives 4–65 % across hip movements and sexes; a single value inside that range, not fitted.' },
  grade3Distal: { value: 0.05, unit: 'fraction of normal', status: 'assumed',
    means: 'Wrist, hand, ankle and toe movements: force that moves the light distal segment against gravity (MRC 3).',
    derivation: 'Not measured for these joints; taken as at the knee, whose segment is heavier for its muscle. A gap.' },
  grade4Knee: { value: 0.1, unit: 'fraction of normal', status: 'derived', refs: ['dvir1997'],
    means: 'Knee and elbow: least force that still resists the examiner (MRC 4).', derivation: 'Dvir 1997: a muscle graded 4 may give as little as 10 %.' },
  grade4Shoulder: { value: 0.2, unit: 'fraction of normal', status: 'derived', refs: ['dvir1997'],
    means: 'Shoulder: least force that still resists the examiner (MRC 4).', derivation: 'Dvir 1997: about 20 %.' },
  grade4Hip: { value: 0.35, unit: 'fraction of normal', status: 'derived', refs: ['dvir1997'],
    means: 'Hip: least force that still resists the examiner (MRC 4).', derivation: 'Dvir 1997: about 30–40 %; the middle.' },
  grade4Distal: { value: 0.1, unit: 'fraction of normal', status: 'assumed',
    means: 'Wrist, hand, ankle and toes: least force that still resists the examiner (MRC 4).', derivation: 'Taken as at the knee and elbow; not measured. A gap.' },
  atrophyMax: { value: 0.6, unit: 'fraction of bulk', status: 'assumed', refs: ['kern2004'],
    means: 'Share of a muscle’s bulk a wholly denervated muscle loses in the first months.',
    derivation: 'Fibre diameter halves in 2–3 months (a review’s figure), three quarters of the fibre area; the whole muscle loses less, its connective tissue and fat staying. Kern 2004 measured fibres only from 0.7 years on. A convention: no week-by-week human series of whole-muscle bulk was found.' },
  atrophyDays: { value: 45, unit: 'days', status: 'assumed', refs: ['chaudhry1992', 'kern2004'],
    means: 'Time constant of denervation atrophy.',
    derivation: 'Placed so that wasting shows at about 3 weeks (the teaching; fibrillations themselves begin at 10–14 days, Chaudhry 1992) and most of the early loss is done by 3 months. Not fitted to a series: a gap.' },
  posturalInstabilityDays: { value: 2700, unit: 'days', status: 'derived', refs: ['macleod2026', 'munhoz2014'],
    means: 'Time from the motor onset of bilateral parkinsonism after which the pull test is abnormal (postural instability, Hoehn & Yahr 3).',
    derivation: 'Macleod 2026: median 7.4 years to Hoehn & Yahr 3 in 883 population-based incident patients (7.4 × 365 = 2,700 days). The model gives the median patient; real patients differ widely, older ones sooner. Hoehn & Yahr 3 needs disease on both sides, so one-sided parkinsonism keeps its postural reflexes.' },
  wastingVisible: { value: 0.8, unit: 'fraction of bulk', status: 'assumed',
    means: 'Bulk below which the examiner sees a muscle wasted.',
    derivation: 'Inspection is crude; a fifth of the bulk lost is taken as the least that shows against the other side. Not measured.' },
});

/** Each root's share of a muscle where it was measured; the others share a muscle equally (a convention: Georgoulis
    2020 found one or two roots dominant in most muscles, but not by how much). */
export const ROOT_SHARE: Record<string, Record<string, number>> = {
  /* London 2022: tibialis anterior answered L4 stimulation in 25 %, L5 in 67 % */
  'tibialis anterior': { L4: 0.25 / 0.92, L5: 0.67 / 0.92 },
};
