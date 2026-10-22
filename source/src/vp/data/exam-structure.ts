import type { ExamSystemDef } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   How the examination is organised for the learner.

   Systems come in the order a clinician examines: vital signs, a general look,
   then the systems, and last what the examiner does to the patient (position,
   oxygen). Within a system, sections follow look, feel, tap, listen; within a
   section, manoeuvres are in the order they are done. That order is what the
   region menu and the suggestions show.

   Every manoeuvre in the catalog belongs to exactly one section (the test
   suite checks it), including those reached only by typing or through a
   focused view, so a suggestion always has a home.
--------------------------------------------------------------------------- */

const lungs = (verb: 'percuss' | 'auscultate' | 'resonance') =>
  ['upper-zone', 'mid-zone', 'axilla', 'upper-back', 'base'].map((k) =>
    verb === 'auscultate' ? (k === 'base' ? 'auscultate.lung-base' : `auscultate.lung-${k}`) : `${verb}.lung-${k}`);

export const EXAM_SYSTEMS: ExamSystemDef[] = [
  {
    id: 'vitals', label: { en: 'Vital signs', de: 'Vitalparameter' },
    sections: [
      { id: 'vitals.signs', label: { en: 'Vital signs', de: 'Vitalparameter' }, kind: 'measure',
        manoeuvres: ['measure.hr', 'measure.bp', 'measure.rr', 'measure.spo2', 'measure.temp', 'measure.bp.lying-standing'] },
    ],
  },
  {
    id: 'general', label: { en: 'General examination', de: 'Allgemeine Untersuchung' },
    sections: [
      { id: 'general.inspection', label: { en: 'Inspection', de: 'Inspektion' }, kind: 'examine',
        manoeuvres: ['inspect.general', 'inspect.skin', 'inspect.pigmentation', 'inspect.mouth', 'smell.breath', 'test.turgor'] },
      { id: 'general.hands', label: { en: 'Hands', de: 'Hände' }, kind: 'examine',
        manoeuvres: ['measure.crt', 'test.arms-outstretched'] },
      { id: 'general.eyes-neck', label: { en: 'Eyes and neck', de: 'Augen und Hals' }, kind: 'examine',
        manoeuvres: ['inspect.sclera', 'inspect.conjunctiva', 'inspect.thyroid-eyes', 'palpate.thyroid'] },
    ],
  },
  {
    id: 'cardio', label: { en: 'Cardiovascular system', de: 'Herz und Kreislauf' },
    sections: [
      { id: 'cardio.palpation', label: { en: 'Pulses, venous pressure and apex', de: 'Pulse, Venendruck und Herzspitzenstoß' }, kind: 'examine',
        manoeuvres: ['palpate.pulse.radial', 'palpate.pulse.carotid', 'inspect.jvp', 'palpate.apex'] },
      { id: 'cardio.auscultation', label: { en: 'Auscultation', de: 'Auskultation' }, kind: 'examine',
        manoeuvres: ['auscultate.heart.aortic', 'auscultate.heart.pulmonary', 'auscultate.heart.erb', 'auscultate.heart.tricuspid', 'auscultate.heart.mitral',
          'auscultate.heart.apex-bell-left-lateral', 'auscultate.heart.lse-sitting-forward', 'auscultate.carotid'] },
      { id: 'cardio.periphery', label: { en: 'Periphery', de: 'Peripherie' }, kind: 'examine', manoeuvres: ['inspect.legs'] },
    ],
  },
  {
    id: 'resp', label: { en: 'Respiratory system', de: 'Atmung und Lunge' },
    sections: [
      { id: 'resp.inspection', label: { en: 'Inspection and palpation', de: 'Inspektion und Palpation' }, kind: 'examine',
        manoeuvres: ['inspect.breathing', 'palpate.trachea', 'palpate.chest-expansion'] },
      { id: 'resp.percussion', label: { en: 'Percussion', de: 'Perkussion' }, kind: 'examine', manoeuvres: lungs('percuss') },
      { id: 'resp.auscultation', label: { en: 'Auscultation', de: 'Auskultation' }, kind: 'examine', manoeuvres: lungs('auscultate') },
      { id: 'resp.resonance', label: { en: 'Vocal resonance', de: 'Bronchophonie' }, kind: 'examine', manoeuvres: lungs('resonance') },
    ],
  },
  {
    id: 'abdomen', label: { en: 'Abdomen', de: 'Abdomen' },
    sections: [
      { id: 'abdomen.exam', label: { en: 'Abdomen', de: 'Abdomen' }, kind: 'examine',
        manoeuvres: ['palpate.abdomen', 'test.shifting-dullness', 'examine.rectal'] },
    ],
  },
  {
    id: 'neuro', label: { en: 'Nervous system', de: 'Nervensystem' },
    sections: [
      { id: 'neuro.speech', label: { en: 'Speech', de: 'Sprache' }, kind: 'examine', manoeuvres: ['test.speech', 'test.count-to-50'] },
      { id: 'neuro.eyes', label: { en: 'Eyes: pupils, fields, fundi, movements', de: 'Augen: Pupillen, Gesichtsfeld, Fundus, Motorik' }, kind: 'examine',
        manoeuvres: ['inspect.eyes', 'inspect.eyes.dim', 'test.pupils.light', 'test.swinging-light', 'test.visual-fields', 'test.fundoscopy',
          'test.eye-movements', 'test.cover', 'test.sustained-upgaze'] },
      { id: 'neuro.vestibular', label: { en: 'Balance organ and hearing', de: 'Gleichgewichtsorgan und Gehör' }, kind: 'examine',
        manoeuvres: ['test.frenzel', 'test.head-impulse', 'test.whisper', 'test.rinne', 'test.weber'] },
      { id: 'neuro.cranial', label: { en: 'Face, mouth and neck (V, VII, IX–XII)', de: 'Gesicht, Mund und Hals (V, VII, IX–XII)' }, kind: 'examine',
        manoeuvres: ['test.face-sensation', 'test.jaw', 'test.face-movement', 'test.palate', 'test.tongue', 'test.shrug'] },
      { id: 'neuro.motor', label: { en: 'Tone, power and reflexes', de: 'Tonus, Kraft und Reflexe' }, kind: 'examine',
        manoeuvres: ['test.arm.tone', 'test.pronator-drift', 'test.arm.power', 'test.power-repeated', 'test.arm.reflexes',
          'test.leg.tone', 'test.leg.power', 'test.leg.reflexes', 'test.slr'] },
      { id: 'neuro.sensory', label: { en: 'Sensation', de: 'Sensibilität' }, kind: 'examine',
        manoeuvres: ['test.arm.pinprick', 'test.arm.vibration', 'test.trunk.pinprick', 'test.leg.pinprick', 'test.leg.vibration', 'test.saddle'] },
      { id: 'neuro.coordination', label: { en: 'Coordination, stance and gait', de: 'Koordination, Stand und Gang' }, kind: 'examine',
        manoeuvres: ['test.finger-nose', 'test.rapid-alternating', 'test.heel-shin', 'test.romberg', 'test.gait'] },
    ],
  },
  {
    id: 'care', label: { en: 'Position and treat', de: 'Lagern und behandeln' },
    sections: [
      { id: 'care.position', label: { en: 'Position, expose and cover', de: 'Lagern, freimachen und zudecken' }, kind: 'intervene', layout: 'chips',
        manoeuvres: ['position.supine', 'position.reclined-45', 'position.sitting', 'position.sitting-forward', 'position.left-lateral', 'position.standing',
          'expose.chest', 'expose.abdomen', 'cover.chest', 'cover.abdomen'] },
      { id: 'care.oxygen', label: { en: 'Oxygen', de: 'Sauerstoff' }, kind: 'intervene', layout: 'select',
        manoeuvres: ['give.oxygen.nasal-2', 'give.oxygen.venturi-28', 'give.oxygen.venturi-35', 'give.oxygen.mask-6', 'give.oxygen.nrb-15', 'give.oxygen.off'] },
    ],
  },
];

/** Short labels for the compact rows (positions, oxygen devices), where the full label would crowd. */
export const SHORT_LABELS: Record<string, { en: string; de: string }> = {
  'position.supine': { en: 'Flat', de: 'Flach' },
  'position.reclined-45': { en: '45°', de: '45°' },
  'position.sitting': { en: 'Sitting', de: 'Sitzend' },
  'position.sitting-forward': { en: 'Leaning forward', de: 'Vorgebeugt' },
  'position.left-lateral': { en: 'Left side', de: 'Linksseitenlage' },
  'position.standing': { en: 'Standing', de: 'Stehend' },
  'expose.chest': { en: 'Expose chest', de: 'Thorax frei' },
  'expose.abdomen': { en: 'Expose abdomen', de: 'Abdomen frei' },
  'cover.chest': { en: 'Cover chest', de: 'Thorax bedecken' },
  'cover.abdomen': { en: 'Cover abdomen', de: 'Abdomen bedecken' },
  'give.oxygen.nasal-2': { en: 'Nasal 2 L', de: 'Nasenbrille 2 l' },
  'give.oxygen.venturi-28': { en: 'Venturi 28 %', de: 'Venturi 28 %' },
  'give.oxygen.venturi-35': { en: 'Venturi 35 %', de: 'Venturi 35 %' },
  'give.oxygen.mask-6': { en: 'Mask 6 L', de: 'Maske 6 l' },
  'give.oxygen.nrb-15': { en: 'Reservoir 15 L', de: 'Reservoir 15 l' },
  'give.oxygen.off': { en: 'Room air', de: 'Raumluft' },
};
