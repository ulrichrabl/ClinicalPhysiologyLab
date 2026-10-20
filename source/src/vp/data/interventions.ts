import type { InterventionDef } from '../scenario/types.ts';
import { OXYGEN } from './manoeuvres.ts';

/* ===========================================================================
   Interventions (ADR-018 decision 1): what the learner, or someone they ask,
   does to the patient, as a registry like the manoeuvres.

   They act through inputs the models take: the inspired oxygen fraction the
   lungs breathe, and the pressure chest compressions put on the chest
   (step 2a) and the breaths given at the airway (step 2b). The shock and the
   drugs follow in steps 3–4.

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
  /* Breaths given at the airway (ADR-018 step 2b): held by whoever ventilates, through a mask until an airway device is in. */
  {
    id: 'vent.bag',
    label: { en: 'Ventilate with the bag', de: 'Mit dem Beutel beatmen' },
    phrases: { en: ['bag the patient', 'bag mask ventilation', 'ventilate', 'give breaths', 'rescue breaths', 'bag him'], de: ['beutelbeatmung', 'beatmen', 'maskenbeatmung', 'beatmung beginnen', 'mit dem beutel beatmen'] },
    needs: { equipment: ['bag-mask'] },
    duration: { seconds: 5 },
    timing: { status: 'placement', note: 'Connecting oxygen, placing the mask and taking the grip; not measured.' },
    effect: { kind: 'continuous', slot: 'ventilation', inputs: {}, handsWhileHeld: true, driver: 'ventilation' },
  },
  {
    id: 'airway.supraglottic',
    label: { en: 'Insert a supraglottic airway', de: 'Larynxmaske/Larynxtubus einlegen' },
    phrases: { en: ['supraglottic airway', 'i-gel', 'igel', 'laryngeal mask', 'lma', 'laryngeal tube'], de: ['larynxmaske', 'larynxtubus', 'i-gel', 'supraglottische atemwegshilfe', 'lama'] },
    needs: { equipment: ['airway-kit'] },
    duration: { min: 10, max: 20 },
    timing: { status: 'placement', note: 'Taking the device out, lubricating and inserting it; not measured.' },
    effect: { kind: 'instantaneous', airway: 'supraglottic' },
  },
  {
    id: 'airway.tube',
    label: { en: 'Intubate', de: 'Intubieren' },
    phrases: { en: ['intubate', 'tube him', 'endotracheal tube', 'et tube', 'put a tube in'], de: ['intubieren', 'intubation', 'endotrachealtubus', 'tubus'] },
    needs: { equipment: ['airway-kit'] },
    duration: { min: 20, max: 30 },
    timing: { status: 'placement', note: 'ADR-018: 20–30 s, to be checked against observed times.' },
    effect: { kind: 'instantaneous', airway: 'tube' },
  },
];

export const INTERVENTION_BY_ID: Record<string, InterventionDef> = Object.fromEntries(INTERVENTIONS.map((x) => [x.id, x]));
