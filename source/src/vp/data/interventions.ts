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
  /* Before the first compression (ADR-018 step 5, second pass): he slumps in a bed whose head is raised; it is laid flat
     (and the CPR release of the mattress pulled), the airway opened and his breathing looked at, his mouth looked into. */
  {
    id: 'bed.flat',
    label: { en: 'Lay the bed flat for CPR', de: 'Bett flach stellen für die Reanimation' },
    phrases: { en: ['lay him flat', 'bed flat', 'lie him flat', 'put the bed down', 'cpr position'], de: ['flach lagern', 'bett flach', 'flach hinlegen', 'kopfteil runter', 'reanimationslagerung'] },
    duration: { seconds: 3 },
    timing: { status: 'placement', note: 'Lowering the head of the bed and pulling the mattress’s CPR release; not measured.' },
    effect: { kind: 'instantaneous', state: { position: 'supine' } },
  },
  {
    id: 'assess.breathing',
    label: { en: 'Open the airway, check breathing', de: 'Atemwege öffnen, Atmung prüfen' },
    phrases: { en: ['check breathing', 'is he breathing', 'look listen feel', 'open the airway', 'head tilt chin lift'], de: ['atmung prüfen', 'atmet er', 'sehen hören fühlen', 'atemwege freimachen', 'kopf überstrecken'] },
    duration: { seconds: 7 },
    timing: { status: 'placement', note: 'Head tilt and chin lift, then looking for normal breathing; the guideline allows no more than 10 s, 7 s is ours.' },
    effect: { kind: 'instantaneous', assess: 'breathing' },
  },
  {
    id: 'assess.mouth',
    label: { en: 'Look in his mouth', de: 'In den Mund schauen' },
    phrases: { en: ['look in the mouth', 'check the mouth', 'inspect the airway', 'anything in his mouth'], de: ['mund inspizieren', 'in den mund schauen', 'mundraum kontrollieren', 'fremdkörper'] },
    duration: { seconds: 3 },
    timing: { status: 'placement', note: 'Opening the mouth and looking in; not measured.' },
    effect: { kind: 'instantaneous', assess: 'mouth' },
  },
  /* The chest (a tension pneumothorax): listened to and looked at, and decompressed with a cannula on either side. */
  {
    id: 'assess.chest',
    label: { en: 'Look at and listen to the chest', de: 'Thorax inspizieren und auskultieren' },
    phrases: { en: ['listen to the chest', 'breath sounds', 'auscultate', 'check the chest', 'is the chest rising on both sides'], de: ['thorax auskultieren', 'atemgeräusche', 'abhören', 'thorax ansehen', 'hebt sich der thorax beidseits'] },
    duration: { seconds: 8 },
    timing: { status: 'placement', note: 'Watching both sides rise with a breath and listening under each clavicle and in each axilla; not measured.' },
    effect: { kind: 'instantaneous', assess: 'chest' },
  },
  {
    id: 'assess.echo',
    label: { en: 'Focused ultrasound in the pause', de: 'Fokussierter Ultraschall in der Pause' },
    phrases: { en: ['echo', 'ultrasound', 'pocus', 'scan the heart', 'look with the ultrasound'], de: ['echo', 'ultraschall', 'sono', 'herz schallen'] },
    needs: { equipment: ['ultrasound'] },
    duration: { seconds: 8 },
    timing: { status: 'placement', note: 'A subxiphoid view in the pause of a rhythm check (ERC 2025: POCUS may help identify treatable causes such as tamponade and tension pneumothorax), and a look at lung sliding; not measured.' },
    effect: { kind: 'instantaneous', assess: 'echo' },
  },
  {
    id: 'pericardiocentesis',
    label: { en: 'Pericardiocentesis', de: 'Perikardpunktion' },
    phrases: { en: ['pericardiocentesis', 'drain the pericardium', 'needle the pericardium', 'tap the effusion'], de: ['perikardpunktion', 'perikarderguss punktieren', 'perikard entlasten'] },
    needs: { equipment: ['pericardiocentesis'] },
    duration: { min: 60, max: 120 },
    timing: { status: 'placement', note: 'A long needle from below the xiphoid towards the left shoulder, ideally with ultrasound, and aspirating; how much comes out is a placement (to 200 mL left). Not measured.' },
    effect: { kind: 'instantaneous', change: [{ path: 'circulation.pericardialFluid', set: 200 }] },
  },
  {
    id: 'decompress.left',
    label: { en: 'Needle decompression, left chest', de: 'Nadeldekompression, linker Thorax' },
    phrases: { en: ['decompress the left chest', 'needle the left chest', 'left needle decompression', 'needle thoracocentesis left'], de: ['links entlasten', 'nadeldekompression links', 'entlastungspunktion links'] },
    needs: { equipment: ['cannula-kit'] },
    duration: { min: 15, max: 30 },
    timing: { status: 'placement', note: 'A large cannula into the second intercostal space in the midclavicular line (or the fourth or fifth in the anterior axillary line); not measured.' },
    effect: { kind: 'instantaneous', change: [{ path: 'respiratory.tensionL', set: 0 }] },
  },
  {
    id: 'decompress.right',
    label: { en: 'Needle decompression, right chest', de: 'Nadeldekompression, rechter Thorax' },
    phrases: { en: ['decompress the right chest', 'needle the right chest', 'right needle decompression', 'needle thoracocentesis right'], de: ['rechts entlasten', 'nadeldekompression rechts', 'entlastungspunktion rechts'] },
    needs: { equipment: ['cannula-kit'] },
    duration: { min: 15, max: 30 },
    timing: { status: 'placement', note: 'As on the left; not measured.' },
    effect: { kind: 'instantaneous', change: [{ path: 'respiratory.tensionR', set: 0 }] },
  },
  {
    id: 'airway.clear',
    label: { en: 'Clear the airway (suction, Magill forceps)', de: 'Atemweg freimachen (Absaugen, Magill-Zange)' },
    phrases: { en: ['suction', 'clear the airway', 'magill forceps', 'remove the foreign body', 'suck him out'], de: ['absaugen', 'atemweg freimachen', 'magill-zange', 'fremdkörper entfernen'] },
    needs: { equipment: ['airway-kit'] },
    duration: { min: 10, max: 20 },
    timing: { status: 'placement', note: 'Suction, or a laryngoscope and Magill forceps for a bolus; not measured.' },
    effect: { kind: 'instantaneous', clearAirway: true },
  },
  /* Chest compressions (ADR-018 step 2): held by whoever compresses. The learner taps each compression; a team member
     keeps a steady rate. On a flat bed only: on a raised head end the force goes into the mattress and he slides. */
  {
    id: 'cpr.compressions',
    label: { en: 'Chest compressions', de: 'Thoraxkompressionen' },
    phrases: { en: ['start compressions', 'chest compressions', 'start cpr', 'compressions', 'cardiac massage'], de: ['herzdruckmassage', 'thoraxkompressionen', 'mit der herzdruckmassage beginnen', 'reanimation beginnen', 'drücken'] },
    needs: { position: ['supine'] },
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
    effect: { kind: 'instantaneous', fetch: { equipment: ['defibrillator', 'cannula-kit', 'drugs', 'airway-kit'], seconds: 60 } },
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
  /* Fluids when the arrest is caused by hypovolaemia (ERC 2025 ALS: "Give fluids during CPR only if cardiac arrest is
     caused by hypovolaemia"; isotonic saline or a balanced crystalloid). */
  {
    id: 'fluid.bolus',
    label: { en: 'Fluid bolus 500 mL IV (pressure bag)', de: 'Volumenbolus 500 mL i.v. (Druckbeutel)' },
    phrases: { en: ['fluid bolus', 'give fluids', 'run in 500', 'saline bolus', 'crystalloid', 'open the fluids'], de: ['volumenbolus', 'volumen geben', '500 ml laufen lassen', 'kristalloid', 'infusion auf'] },
    needs: { equipment: ['fluids'], access: ['iv'] },
    duration: { min: 90, max: 150 },
    timing: { status: 'placement', note: 'Spiking the bag, a pressure bag and 500 mL through a large cannula: a few minutes; the volume is counted in when it has run. Not measured.' },
    effect: { kind: 'instantaneous', change: [{ path: 'circulation.bloodVolume', add: 500 }] },
  },
  /* Hypothermia (ERC 2025): rewarming with VA-ECMO; the call that starts it. */
  {
    id: 'call.ecls',
    label: { en: 'Call the ECLS team for rewarming', de: 'ECLS-Team zur Wiedererwärmung rufen' },
    phrases: { en: ['call ecmo', 'call the ecls team', 'extracorporeal rewarming', 'ecpr'], de: ['ecmo anrufen', 'ecls-team rufen', 'extrakorporale wiedererwärmung', 'ecpr'] },
    duration: { min: 30, max: 60 },
    timing: { status: 'placement', note: 'A phone call; not measured. The team’s arrival and the rewarming are outside the scene.' },
    effect: { kind: 'instantaneous' },
  },
  /* Opioid toxicity (ERC 2025 First aid: "Naloxone is a safe and effective antidote that reverses the effects of opioid
     overdose"; "it can take several minutes to work"; "Naloxone is not effective once cardiac arrest has occurred"). It
     gives back the breathing drive the opioid took; a heart in arrest it does not touch. */
  {
    id: 'drug.naloxone',
    label: { en: 'Naloxone 0.4 mg IV', de: 'Naloxon 0,4 mg i.v.' },
    phrases: { en: ['naloxone', 'narcan', 'give naloxone', 'reverse the opioid'], de: ['naloxon', 'narcanti', 'naloxon geben', 'opioid antagonisieren'] },
    needs: { equipment: ['drugs'], access: ['iv'] },
    duration: { min: 60, max: 120 },
    timing: { status: 'placement', note: 'Giving it and waiting for it to act: "it can take several minutes to work" (ERC 2025 First aid); 1–2 min IV is ours.' },
    effect: { kind: 'instantaneous', change: [{ path: 'respiratory.drive', set: 1 }] },
  },
  /* Hyperkalaemia (ERC 2025 Special circumstances): "Use IV 10 mL 10 % calcium chloride for patients with severe
     hyperkalaemia with ECG changes"; "Give 10 units soluble insulin and 25 g glucose IV". */
  {
    id: 'drug.calcium',
    label: { en: 'Calcium chloride 10 % 10 mL IV', de: 'Calciumchlorid 10 % 10 mL i.v.' },
    phrases: { en: ['calcium', 'calcium chloride', 'give calcium', '10 ml calcium chloride'], de: ['calcium', 'calciumchlorid', 'calcium geben', '10 ml calciumchlorid'] },
    needs: { equipment: ['drugs'], access: ['iv'] },
    duration: { min: 15, max: 30 },
    timing: { status: 'placement', note: 'A prefilled syringe, by rapid bolus, and a flush; not measured.' },
    effect: { kind: 'instantaneous', dose: { drug: 'calcium', mg: 6.8 } },
  },
  {
    id: 'drug.insulin',
    label: { en: 'Insulin 10 units with 25 g glucose IV', de: 'Insulin 10 IE mit 25 g Glucose i.v.' },
    phrases: { en: ['insulin', 'insulin and glucose', 'insulin dextrose', '10 units of insulin'], de: ['insulin', 'insulin glucose', 'insulin und glukose', '10 ie insulin'] },
    needs: { equipment: ['drugs'], access: ['iv'] },
    duration: { min: 60, max: 120 },
    timing: { status: 'placement', note: 'Drawing up soluble insulin and giving it with 50 mL of 50 % glucose; not measured.' },
    effect: { kind: 'instantaneous', dose: { drug: 'insulin', mg: 10 } },
  },
  /* Hypokalaemia (ERC 2025 Special circumstances): "Give 20 mmol potassium chloride IV/IO over 2-3 min, followed by
     10 mmol over 2 min in hypokalaemic cardiac arrest". The dose counts in when its time has run. */
  {
    id: 'drug.potassium',
    label: { en: 'Potassium chloride 20 mmol IV over 2–3 min', de: 'Kaliumchlorid 20 mmol i.v. über 2–3 min' },
    phrases: { en: ['potassium', 'potassium chloride', 'kcl', 'give potassium', '20 mmol potassium'], de: ['kalium', 'kaliumchlorid', 'kcl', 'kalium geben', '20 mmol kalium'] },
    needs: { equipment: ['drugs'], access: ['iv'] },
    duration: { min: 120, max: 180 },
    timing: { status: 'guideline', note: 'The guideline\u2019s "over 2-3 min"; the dose is counted in when it has run.' },
    effect: { kind: 'instantaneous', dose: { drug: 'potassium', mg: 20 } },
  },
  {
    id: 'drug.potassium10',
    label: { en: 'Potassium chloride 10 mmol IV over 2 min', de: 'Kaliumchlorid 10 mmol i.v. über 2 min' },
    phrases: { en: ['10 mmol potassium', 'more potassium', 'further potassium'], de: ['10 mmol kalium', 'weiteres kalium', 'nochmal kalium'] },
    needs: { equipment: ['drugs'], access: ['iv'] },
    duration: { min: 120, max: 120 },
    timing: { status: 'guideline', note: 'The guideline\u2019s "10 mmol over 2 min"; counted in when it has run.' },
    effect: { kind: 'instantaneous', dose: { drug: 'potassium', mg: 10 } },
  },
  /* Local anaesthetic systemic toxicity (ERC 2025 Special circumstances): "Give an initial intravenous bolus of 1.5 mL kg-1
     20% lipid emulsion followed by an infusion at 15 mL kg-1 h-1". The infusion is taken to run on after the bolus. */
  {
    id: 'drug.lipid',
    label: { en: 'Lipid emulsion 20 % 100 mL IV, then an infusion', de: 'Lipidemulsion 20 % 100 mL i.v., dann als Infusion' },
    phrases: { en: ['lipid', 'lipid emulsion', 'intralipid', 'give lipid', 'lipid rescue'], de: ['lipid', 'lipidemulsion', 'intralipid', 'lipid geben', 'lipidtherapie'] },
    needs: { equipment: ['drugs'], access: ['iv'] },
    duration: { min: 60, max: 120 },
    timing: { status: 'placement', note: 'Drawing up 100 mL and giving it as a bolus, then setting up the infusion; not measured.' },
    effect: { kind: 'instantaneous', dose: { drug: 'lipid', mg: 100 } },
  },
  /* Thrombolysis when pulmonary embolism is the suspected or confirmed cause (ERC 2025 ALS: thrombolytic drugs). */
  {
    id: 'drug.alteplase',
    label: { en: 'Alteplase 50 mg IV (thrombolysis)', de: 'Alteplase 50 mg i.v. (Thrombolyse)' },
    phrases: { en: ['alteplase', 'thrombolysis', 'lyse', 'give alteplase', 'tpa', 'actilyse', 'alteplase 50 mg'], de: ['alteplase', 'lyse', 'thrombolyse', 'actilyse', 'lysieren', 'alteplase 50 mg i.v.'] },
    needs: { equipment: ['thrombolytic'], access: ['iv'] },
    duration: { min: 60, max: 120 },
    timing: { status: 'placement', note: 'Dissolving the powder in its water and giving it as a bolus with a flush; not measured.' },
    effect: { kind: 'instantaneous', dose: { drug: 'alteplase', mg: 50 } },
  },
];

export const INTERVENTION_BY_ID: Record<string, InterventionDef> = Object.fromEntries(INTERVENTIONS.map((x) => [x.id, x]));
