import type { LocalizedText } from '../model/i18n.ts';
import { BODY_DEFAULTS, type PatientModel } from '../physiology/state.ts';

/* ---------------------------------------------------------------------------
   Named starting points for the eye station.

   Each is a lesion, not a picture: structures of the nervous-system graph
   cut on a healthy adult, or a peripheral vestibular loss. What the eyes
   then do is the examination model's reading of what the lesion
   interrupts. Each preset names the textbook signs it should bring; a
   station test checks the model brings them, so a preset can never show
   a pattern its name does not.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface EyePreset {
  id: string;
  label: LocalizedText;
  /** lesioned structures of the nervous-system graph */
  lesions?: string[];
  vestibular?: PatientModel['vestibular'];
  /** body parameters laid over a healthy adult's, with how long the illness has acted (the body is run through it) */
  body?: Partial<PatientModel['body']>;
  /** the textbook signs of this lesion (checked by the station tests) */
  signs: string[];
  /** where to look first */
  look: 'pupils' | 'swinging' | 'movements' | 'cover' | 'nystagmus' | 'impulse' | 'fields' | 'sclera' | 'conjunctiva' | 'thyroid';
}

export const EYE_PRESETS: EyePreset[] = [
  { id: 'neuritis-l', label: L('Vestibular neuritis, left (day 1)', 'Neuritis vestibularis links (Tag 1)'),
    vestibular: { side: 'L', severity: 0.8, daysSinceOnset: 1 }, signs: ['spontaneous-nystagmus', 'unidirectional-nystagmus', 'head-impulse-positive'], look: 'impulse' },
  { id: 'neuritis-r-week', label: L('Vestibular neuritis, right (day 7)', 'Neuritis vestibularis rechts (Tag 7)'),
    vestibular: { side: 'R', severity: 0.8, daysSinceOnset: 7 }, signs: ['head-impulse-positive'], look: 'nystagmus' },
  { id: 'lateral-medulla-l', label: L('Lateral medullary infarct, left', 'Wallenberg-Syndrom links'),
    lesions: ['L_lat_bs', 'L_icp'], signs: ['skew-deviation', 'gaze-evoked-nystagmus', 'ptosis', 'anisocoria'], look: 'cover' },
  { id: 'cerebellum-l', label: L('Cerebellar hemisphere, left', 'Kleinhirnhemisphäre links'),
    lesions: ['L_cerebellum'], signs: ['gaze-evoked-nystagmus', 'saccadic-pursuit'], look: 'movements' },
  { id: 'cn3-l', label: L('Third nerve palsy, left (pupil involved)', 'Okulomotoriusparese links (mit Pupille)'),
    lesions: ['L_cn3'], signs: ['ptosis', 'fixed-dilated-pupil', 'eye-down-and-out', 'horizontal-tropia', 'vertical-tropia'], look: 'movements' },
  { id: 'cn4-l', label: L('Fourth nerve palsy, left', 'Trochlearisparese links'),
    lesions: ['L_cn4'], signs: ['vertical-tropia'], look: 'cover' },
  { id: 'cn6-l', label: L('Sixth nerve palsy, left', 'Abduzensparese links'),
    lesions: ['L_cn6'], signs: ['abduction-deficit', 'horizontal-tropia'], look: 'movements' },
  { id: 'horner-l', label: L('Horner syndrome, left', 'Horner-Syndrom links'),
    lesions: ['L_scg'], signs: ['ptosis', 'anisocoria', 'dilation-lag'], look: 'pupils' },
  { id: 'optic-nerve-l', label: L('Optic nerve, left', 'Sehnerv links'),
    lesions: ['L_cn2'], signs: ['afferent-pupillary-defect'], look: 'swinging' },
  { id: 'chiasm', label: L('Chiasm (pituitary tumour)', 'Chiasma (Hypophysentumor)'),
    lesions: ['chiasm'], signs: ['bitemporal-hemianopia'], look: 'fields' },
  { id: 'optic-tract-r', label: L('Optic tract, right', 'Tractus opticus rechts'),
    lesions: ['R_optic_tract'], signs: ['homonymous-hemianopia'], look: 'fields' },
  { id: 'occipital-r', label: L('Occipital cortex, right', 'Okzipitalkortex rechts'),
    lesions: ['R_vis_cx'], signs: ['homonymous-hemianopia'], look: 'fields' },
  /* the body in the eye: run through the illness for the time given */
  { id: 'obstruction', label: L('Bile duct obstruction, two weeks', 'Gallengangsverschluss, zwei Wochen'),
    body: { cholestasis: 0.9, courseHours: 24 * 14 }, signs: ['jaundice'], look: 'sclera' },
  { id: 'haemolysis', label: L('Haemolytic anaemia, three weeks', 'Hämolytische Anämie, drei Wochen'),
    body: { haemolysis: 3, courseHours: 24 * 21 }, signs: ['jaundice', 'conjunctival-pallor'], look: 'conjunctiva' },
  { id: 'iron-deficiency', label: L('Slow colonic bleed, four months', 'Langsame Kolonblutung, vier Monate'),
    body: { lowerGIBleed: 2, courseHours: 24 * 120 }, signs: ['conjunctival-pallor'], look: 'conjunctiva' },
  { id: 'graves', label: L('Graves’ disease with orbitopathy, two months', 'Morbus Basedow mit Orbitopathie, zwei Monate'),
    body: { thyroidStimulation: 0.8, orbitopathy: 0.6, courseHours: 24 * 60 }, signs: ['lid-retraction', 'lid-lag', 'exophthalmos'], look: 'thyroid' },
  { id: 'thyroxine-excess', label: L('Too much levothyroxine, two months', 'Zu viel Levothyroxin, zwei Monate'),
    body: { thyroxineDose: 300, courseHours: 24 * 60 }, signs: ['lid-retraction', 'lid-lag'], look: 'thyroid' },
];

export const EYE_PRESET_GROUPS: Array<{ group: LocalizedText; ids: string[] }> = [
  { group: L('Vertigo: peripheral or central (HINTS)', 'Schwindel: peripher oder zentral (HINTS)'), ids: ['neuritis-l', 'neuritis-r-week', 'lateral-medulla-l', 'cerebellum-l'] },
  { group: L('Ocular motor nerves', 'Augenmuskelnerven'), ids: ['cn3-l', 'cn4-l', 'cn6-l'] },
  { group: L('Pupils', 'Pupillen'), ids: ['horner-l', 'optic-nerve-l'] },
  { group: L('Visual pathway', 'Sehbahn'), ids: ['chiasm', 'optic-tract-r', 'occipital-r'] },
  { group: L('The body in the eye', 'Der Körper im Auge'), ids: ['obstruction', 'haemolysis', 'iron-deficiency', 'graves', 'thyroxine-excess'] },
];

/** A healthy adult with this preset's lesion. */
export function applyEyePreset(m: PatientModel, id: string): PatientModel {
  const p = EYE_PRESETS.find((x) => x.id === id);
  const next = structuredClone(m);
  next.lesions = { nodes: [], complete: true };
  next.vestibular = { side: 'none', severity: 0.8, daysSinceOnset: 1 };
  next.body = { ...BODY_DEFAULTS };
  if (!p) return next;
  if (p.body) next.body = { ...BODY_DEFAULTS, ...p.body };
  if (p.lesions) next.lesions = { nodes: [...p.lesions], complete: true };
  if (p.vestibular) next.vestibular = { ...p.vestibular };
  return next;
}

/** The structures the station lets the learner cut by hand, by pathway: the ones the eye examination reads. */
export const EYE_STRUCTURES: Array<{ group: LocalizedText; nodes: Array<{ id: string; label: LocalizedText }> }> = [
  { group: L('Visual pathway', 'Sehbahn'), nodes: [
    { id: 'R_cn2', label: L('Optic nerve, right', 'Sehnerv rechts') }, { id: 'L_cn2', label: L('Optic nerve, left', 'Sehnerv links') },
    { id: 'chiasm', label: L('Chiasm', 'Chiasma') },
    { id: 'R_optic_tract', label: L('Optic tract, right', 'Tractus opticus rechts') }, { id: 'L_optic_tract', label: L('Optic tract, left', 'Tractus opticus links') },
    { id: 'R_vis_cx', label: L('Visual cortex, right', 'Sehrinde rechts') }, { id: 'L_vis_cx', label: L('Visual cortex, left', 'Sehrinde links') },
  ] },
  { group: L('Pupils and lids', 'Pupillen und Lider'), nodes: [
    { id: 'R_scg', label: L('Sympathetic chain, right (superior cervical ganglion)', 'Sympathikus rechts (Ganglion cervicale superius)') },
    { id: 'L_scg', label: L('Sympathetic chain, left (superior cervical ganglion)', 'Sympathikus links (Ganglion cervicale superius)') },
    { id: 'R_ciliary', label: L('Ciliary ganglion, right', 'Ganglion ciliare rechts') }, { id: 'L_ciliary', label: L('Ciliary ganglion, left', 'Ganglion ciliare links') },
  ] },
  { group: L('Eye movements', 'Augenbewegungen'), nodes: [
    { id: 'R_cn3', label: L('Oculomotor nerve (III), right', 'N. oculomotorius (III) rechts') }, { id: 'L_cn3', label: L('Oculomotor nerve (III), left', 'N. oculomotorius (III) links') },
    { id: 'R_cn4', label: L('Trochlear nerve (IV), right', 'N. trochlearis (IV) rechts') }, { id: 'L_cn4', label: L('Trochlear nerve (IV), left', 'N. trochlearis (IV) links') },
    { id: 'R_cn6', label: L('Abducens nerve (VI), right', 'N. abducens (VI) rechts') }, { id: 'L_cn6', label: L('Abducens nerve (VI), left', 'N. abducens (VI) links') },
  ] },
  { group: L('Balance and gaze holding', 'Gleichgewicht und Blickhalten'), nodes: [
    { id: 'R_cn8', label: L('Vestibulocochlear nerve, right', 'N. vestibulocochlearis rechts') }, { id: 'L_cn8', label: L('Vestibulocochlear nerve, left', 'N. vestibulocochlearis links') },
    { id: 'R_cn8_vest', label: L('Vestibular nuclei, right', 'Vestibulariskerne rechts') }, { id: 'L_cn8_vest', label: L('Vestibular nuclei, left', 'Vestibulariskerne links') },
    { id: 'R_lat_bs', label: L('Lateral medulla, right', 'Laterale Medulla rechts') }, { id: 'L_lat_bs', label: L('Lateral medulla, left', 'Laterale Medulla links') },
    { id: 'R_icp', label: L('Inferior cerebellar peduncle, right', 'Unterer Kleinhirnstiel rechts') }, { id: 'L_icp', label: L('Inferior cerebellar peduncle, left', 'Unterer Kleinhirnstiel links') },
    { id: 'R_cerebellum', label: L('Cerebellar hemisphere, right', 'Kleinhirnhemisphäre rechts') }, { id: 'L_cerebellum', label: L('Cerebellar hemisphere, left', 'Kleinhirnhemisphäre links') },
  ] },
];

/** Starting points the eye examination cannot tell apart, each with why: Identify counts either as right. An optic tract
    lesion and an occipital one both give a homonymous hemianopia here; at the bedside a tract lesion can add a relative
    afferent defect in the eye with the temporal loss and the occipital one may spare the macula, and the model has
    neither (a known gap). */
export const EYE_LOOK_ALIKE: Array<{ ids: string[]; why: LocalizedText }> = [
  { ids: ['optic-tract-r', 'occipital-r'], why: L('Both give a left homonymous hemianopia, and the model has neither the tract lesion’s afferent pupil defect nor the cortex’s macular sparing.',
    'Beide ergeben eine homonyme Hemianopsie nach links; das Modell hat weder den afferenten Pupillendefekt der Tractusläsion noch die Makulaaussparung der Rinde.') },
];
export const lookAlike = (a: string, b: string) => a === b || EYE_LOOK_ALIKE.some((g) => g.ids.includes(a) && g.ids.includes(b));
