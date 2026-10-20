import { defineConstants } from './constants.ts';

/* Constants of the heart in an arrest (ADR-018 step 3, physiology/heart/arrest.ts).

   WORK IN PROGRESS: these values are provisional placeholders while the human evidence is gathered; each will be set
   from it (or marked a placement) before step 3 is offered for review. */

export const ARREST = defineConstants('arrest', {
  cppNoFlow: { value: 10, unit: 'mmHg', status: 'assumed', means: 'Coronary perfusion pressure below which the myocardium gets no useful flow.',
    derivation: 'Provisional (step 3 in progress).' },
  cppFullFlow: { value: 60, unit: 'mmHg', status: 'assumed', means: 'Coronary perfusion pressure at which the myocardium is fully supplied.',
    derivation: 'Provisional (step 3 in progress).' },
  depletionTau: { value: 300, unit: 's', status: 'assumed', means: 'Time constant with which the myocardium’s state falls without coronary flow.',
    derivation: 'Provisional (step 3 in progress).' },
  recoveryTau: { value: 120, unit: 's', status: 'assumed', means: 'Time constant with which the myocardium’s state recovers with full coronary flow.',
    derivation: 'Provisional (step 3 in progress).' },
  vfFineScale: { value: 0.25, unit: 'fraction', status: 'assumed', means: 'VF amplitude of an exhausted myocardium, as a fraction of fresh VF.',
    derivation: 'Provisional (step 3 in progress).' },
  contractilityFloor: { value: 0, unit: 'fraction', status: 'assumed', means: 'Contractility of an exhausted myocardium after a return of an organised rhythm.',
    derivation: 'Provisional (step 3 in progress).' },
  organisedExponent: { value: 1, unit: '', status: 'assumed', means: 'Shape of the chance of an organised rhythm after a terminating shock, M^k.',
    derivation: 'Provisional (step 3 in progress).' },
  shockTermination: { value: 0.87, unit: 'probability', status: 'assumed', means: 'Chance that a biphasic shock of 150 J ends VF.',
    derivation: 'Provisional (step 3 in progress); BIPHASIC first-shock termination about 87 % to be confirmed.' },
});
