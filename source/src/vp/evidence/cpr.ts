import { defineConstants } from './constants.ts';

/* Constants of chest compressions (ADR-018 step 2): what a compression does to the pressures in the chest. The
   circulation takes the intrathoracic pressure rise as an input, as it takes the breath's pleural swing. */

const CMH2O = 0.7356;   // mmHg per cmH2O

export const CPR = defineConstants('cpr', {
  itpManual: { value: 32 * CMH2O, unit: 'mmHg', status: 'measured', refs: ['charbonney2018'],
    means: 'Rise of intrathoracic pressure with each manual compression at guideline depth: what the compression puts on the chest’s contents.',
    derivation: 'Charbonney: 32 ± 12 cmH2O with manual compressions (oesophageal catheter, Thiel cadavers whose respiratory mechanics matched out-of-hospital arrests), = 23.5 mmHg. A learner’s own tapped compressions are taken as adequately deep (ADR-018 decision 7), so they get this.' },
  itpMechanical: { value: 69 * CMH2O, unit: 'mmHg', status: 'measured', refs: ['charbonney2018'],
    means: 'Rise of intrathoracic pressure with each compression of an automatic device.',
    derivation: 'Charbonney: 69 ± 14 cmH2O with automatic compressions, = 50.8 mmHg. Used for Ornato’s Thumper, the mechanical compressor of its day: an assumption, since the devices differ.' },
  cardiacExtra: { value: 0.11, unit: 'fraction', status: 'derived', refs: ['ornato1988', 'charbonney2018'],
    means: 'How much more pressure the ventricles feel than the rest of the chest, squeezed between sternum and spine: the cardiac pump, on top of the thoracic pump.',
    derivation: 'Fitted once (scripts/fit-cpr.mjs): with the mechanical intrathoracic rise at Ornato’s 60/min and 50:50 duty, after a minute of untreated VF, the arterial systolic pressure is Ornato’s 59 mmHg at 0.11 (bisection: 0.109 gives 59.1). Refitted, same target and procedure, when the lungs stopped breathing in an arrest (ADR-018 step 2b; it had been 0.10 with the pleural swings of breathing still pumping). Weakly determined: with no cardiac share at all the model gives about 56, and Ornato’s ± 5 allows anything from 0 to about 0.17. In people which pump dominates is debated; this fit says the measured intrathoracic rise alone carries most of the flow.' },
  aortaInChest: { value: 0.375, unit: 'fraction', status: 'derived', refs: ['saouti2012'],
    means: 'Share of the systemic arterial compliance that lies in the chest (the thoracic aorta): the share of the intrathoracic pressure rise the lumped arteries feel.',
    derivation: 'Saouti: the ascending aorta to the distal arch holds 40 % of total arterial compliance, of which 15 % is in the head and arm branches outside the chest (25 % in the chest); the descending aorta holds 25 %, of which about half is taken to be thoracic (the abstract does not split it). 0.25 + 0.125 = 0.375; the plausible range is 0.25–0.50.' },
  duty: { value: 0.5, unit: 'fraction', status: 'assumed', refs: ['ornato1988'],
    means: 'Share of each compression cycle spent compressing (the rest is relaxation).',
    derivation: 'The guidelines teach equal compression and relaxation, and Ornato’s Thumper ran 50:50. A rescuer’s real duty cycle varies; not measured from the learner’s taps.' },
  rescuerRate: { value: 110, unit: '/min', status: 'assumed',
    means: 'Rate at which a team member compresses when told to (the learner taps their own).',
    derivation: 'The middle of the guidelines\u2019 100\u2013120/min. A placement until the team\u2019s own quality and fatigue are modelled (ADR-018 decision 8).' },
  longestCycle: { value: 1.0, unit: 's', status: 'assumed',
    means: 'Longest cycle a compression’s duration is scaled to: after a pause, the next compression lasts as one at 60/min would.',
    derivation: 'A compression lasts duty × the interval since the previous one; after a pause for breaths that interval says nothing about the compression, so it is capped at the slowest rate studied (Ornato, 60/min).' },
});
