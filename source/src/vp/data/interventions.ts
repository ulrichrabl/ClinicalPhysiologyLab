import type { InterventionDef } from '../scenario/types.ts';
import { OXYGEN } from './manoeuvres.ts';

/* ===========================================================================
   Interventions (ADR-018 decision 1): what the learner, or someone they ask,
   does to the patient, as a registry like the manoeuvres.

   They act through inputs the models take: the inspired oxygen fraction the
   lungs breathe, and the pressure chest compressions put on the chest
   (step 2). Ventilation, the shock and the drugs follow in steps 2–4.

   An oxygen device shares its id with the encounter's manoeuvre that puts it
   on (`give.oxygen.*`), so a phrase, a case's `unless` and the debrief name
   it the same way inside a scenario and outside one.
=========================================================================== */

const OXYGEN_INTERVENTIONS: InterventionDef[] = OXYGEN.filter(([id]) => id !== 'off').map(([id, device, fio2, en, de, enPh, dePh]) => ({
  id: `give.oxygen.${id}`,
  label: { en, de },
  phrases: { en: enPh, de: dePh },
  needs: { equipment: ['oxygen'] },
  duration: { seconds: 30 },
  timing: { status: 'placement', note: 'Putting a device on and setting the flow; the 30 s the encounter already charges for it.' },
  effect: { kind: 'continuous', slot: 'oxygen', inputs: { 'respiratory.FiO2': fio2 }, state: { oxygen: { device, fio2 } } },
}));

export const INTERVENTIONS: InterventionDef[] = [
  ...OXYGEN_INTERVENTIONS,
  {
    id: 'access.iv',
    label: { en: 'IV cannula', de: 'Venenverweilkanüle' },
    phrases: { en: ['iv access', 'cannula', 'venflon', 'put in a line', 'get a line in'], de: ['venenzugang', 'zugang legen', 'braunüle', 'flexüle', 'viggo'] },
    needs: { equipment: ['cannula-kit'] },
    duration: { min: 30, max: 60 },
    timing: { status: 'placement', note: 'ADR-018: 30–60 s, to be checked against observed times.' },
    effect: { kind: 'instantaneous', grants: ['iv'] },
  },
  /* Chest compressions (ADR-018 step 2): held by whoever compresses. The learner taps each compression; a team member
     keeps a steady rate. */
  {
    id: 'cpr.compressions',
    label: { en: 'Chest compressions', de: 'Thoraxkompressionen' },
    phrases: { en: ['start compressions', 'chest compressions', 'start cpr', 'compressions', 'cardiac massage'], de: ['herzdruckmassage', 'thoraxkompressionen', 'mit der herzdruckmassage beginnen', 'reanimation beginnen', 'drücken'] },
    duration: { seconds: 2 },
    timing: { status: 'placement', note: 'Kneeling at the side and placing the hands on the lower half of the sternum; not measured.' },
    effect: { kind: 'continuous', slot: 'compressions', inputs: {}, handsWhileHeld: true, driver: 'compressions' },
  },
];

export const INTERVENTION_BY_ID: Record<string, InterventionDef> = Object.fromEntries(INTERVENTIONS.map((x) => [x.id, x]));
