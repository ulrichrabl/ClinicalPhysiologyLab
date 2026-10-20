import type { InterventionDef } from '../scenario/types.ts';
import { OXYGEN } from './manoeuvres.ts';

/* ===========================================================================
   Interventions (ADR-018 decision 1): what the learner, or someone they ask,
   does to the patient, as a registry like the manoeuvres.

   They act through inputs the models take: the inspired oxygen fraction the
   lungs breathe, and the pressure chest compressions put on the chest
   (step 2a), the breaths given at the airway (step 2b), the shock (step 3)
   and a dose of a drug into a vein (step 4).

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
  /* The defibrillator (ADR-018 step 3): pads on, charge while compressions go on, everyone clear, shock. */
  {
    id: 'defib.pads',
    label: { en: 'Put the defibrillator pads on', de: 'Defibrillator-Elektroden aufkleben' },
    phrases: { en: ['pads on', 'put the pads on', 'attach the defibrillator', 'defib pads'], de: ['pads kleben', 'elektroden aufkleben', 'defi anschließen', 'klebeelektroden'] },
    needs: { equipment: ['defibrillator'] },
    duration: { min: 10, max: 20 },
    timing: { status: 'placement', note: 'Exposing the chest, peeling and placing two pads; not measured.' },
    effect: { kind: 'instantaneous', grants: ['pads'] },
  },
  {
    id: 'defib.charge',
    label: { en: 'Charge the defibrillator', de: 'Defibrillator laden' },
    phrases: { en: ['charge', 'charge to 150', 'charge the defibrillator', 'charging'], de: ['laden', 'auf 150 laden', 'defi laden', 'laden bitte'] },
    needs: { equipment: ['defibrillator'], access: ['pads'] },
    duration: { seconds: 7 },
    timing: { status: 'placement', note: 'Charge time of a manual defibrillator to 150–200 J: device specifications quote under 10 s; not measured here.' },
    effect: { kind: 'instantaneous', defib: 'charge' },
  },
  {
    id: 'defib.shock',
    label: { en: 'Shock', de: 'Schock abgeben' },
    phrases: { en: ['shock', 'shock now', 'deliver the shock', 'everyone clear', 'stand clear'], de: ['schock', 'schock abgeben', 'alle weg', 'weg vom patienten'] },
    needs: { equipment: ['defibrillator'], access: ['pads'] },
    duration: { seconds: 0 },
    timing: { status: 'placement', note: 'Pressing the button; the pause it needs is what the learner makes of it.' },
    effect: { kind: 'instantaneous', defib: 'shock' },
  },
  /* Going for the arrest trolley (ADR-018 step 5): whoever goes is away for the errand and comes back with it. */
  {
    id: 'fetch.trolley',
    label: { en: 'Fetch the arrest trolley', de: 'Notfallwagen holen' },
    phrases: { en: ['get the arrest trolley', 'fetch the crash trolley', 'get the defibrillator', 'bring the trolley'], de: ['notfallwagen holen', 'reawagen holen', 'defi holen', 'hol den notfallwagen'] },
    duration: { seconds: 0 },
    timing: { status: 'placement', note: 'Away 60 s: the trolley within a ward’s reach (a placement; hospitals set their own standard).' },
    effect: { kind: 'instantaneous', fetch: { equipment: ['defibrillator', 'cannula-kit', 'drugs'], seconds: 60 } },
  },
  /* The rhythm check (ADR-018 step 5): compressions paused, the rhythm read off the defibrillator. Whoever is free looks;
     the pause is whatever the hands on the chest make of it. */
  {
    id: 'check.rhythm',
    label: { en: 'Check the rhythm', de: 'Rhythmus beurteilen' },
    phrases: { en: ['rhythm check', 'check the rhythm', 'stop compressions, rhythm check', 'analyse the rhythm', 'what is the rhythm'], de: ['rhythmuskontrolle', 'rhythmus beurteilen', 'rhythmusanalyse', 'kompressionen stopp, rhythmus', 'welcher rhythmus'] },
    needs: { equipment: ['defibrillator'], access: ['pads'] },
    duration: { seconds: 2 },
    timing: { status: 'placement', note: 'A glance at the defibrillator screen; the pause it needs is what the learner makes of it.' },
    effect: { kind: 'instantaneous', assess: 'rhythm' },
  },
  /* Drugs (ADR-018 step 4): into the vein of the cannula, with a flush. Doses as in the ERC 2025 adult ALS guideline. */
  {
    id: 'drug.adrenaline',
    label: { en: 'Adrenaline 1 mg IV', de: 'Adrenalin 1 mg i.v.' },
    phrases: { en: ['adrenaline', 'adrenaline 1 mg', 'give adrenaline', 'epinephrine', 'epi', '1 mg adrenaline iv'], de: ['adrenalin', 'adrenalin 1 mg', 'suprarenin', '1 mg adrenalin i.v.', 'adrenalin geben'] },
    needs: { equipment: ['drugs'], access: ['iv'] },
    duration: { min: 10, max: 20 },
    timing: { status: 'placement', note: 'A prefilled syringe into the cannula and a 20 mL flush; not measured.' },
    effect: { kind: 'instantaneous', dose: { drug: 'adrenaline', mg: 1 } },
  },
  {
    id: 'drug.amiodarone.300',
    label: { en: 'Amiodarone 300 mg IV', de: 'Amiodaron 300 mg i.v.' },
    phrases: { en: ['amiodarone', 'amiodarone 300', 'give amiodarone', '300 of amiodarone'], de: ['amiodaron', 'amiodaron 300', 'cordarex', 'amiodaron 300 mg i.v.'] },
    needs: { equipment: ['drugs'], access: ['iv'] },
    duration: { min: 30, max: 60 },
    timing: { status: 'placement', note: 'Drawing up from ampoules (or a prefilled syringe), into the cannula, and a flush; not measured.' },
    effect: { kind: 'instantaneous', dose: { drug: 'amiodarone', mg: 300 } },
  },
  {
    id: 'drug.amiodarone.150',
    label: { en: 'Amiodarone 150 mg IV', de: 'Amiodaron 150 mg i.v.' },
    phrases: { en: ['amiodarone 150', 'further amiodarone', 'second dose of amiodarone'], de: ['amiodaron 150', 'zweite dosis amiodaron', 'nochmal amiodaron'] },
    needs: { equipment: ['drugs'], access: ['iv'] },
    duration: { min: 30, max: 60 },
    timing: { status: 'placement', note: 'As the first dose; not measured.' },
    effect: { kind: 'instantaneous', dose: { drug: 'amiodarone', mg: 150 } },
  },
];

export const INTERVENTION_BY_ID: Record<string, InterventionDef> = Object.fromEntries(INTERVENTIONS.map((x) => [x.id, x]));
