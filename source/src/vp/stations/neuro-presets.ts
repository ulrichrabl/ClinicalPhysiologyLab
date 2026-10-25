import type { LocalizedText } from '../model/i18n.ts';
import { BODY_DEFAULTS, type PatientModel } from '../physiology/state.ts';
import type { NeuroTest } from './neuro-signs.ts';

/* ---------------------------------------------------------------------------
   Named starting points for the neurological station (ADR-017 decision 10).

   Each is a lesion on one rung of the ladder (cortex, internal capsule,
   cord, root, nerve, cerebellum, dorsal columns), cut on a healthy adult;
   what the limbs then do is the examination model's reading of what the
   lesion interrupts. Each names the textbook signs it should bring, and a
   station test checks the model brings them.

   `complete: false` is a partial lesion: the strokes and the cord lesion
   are, since a complete one leaves an arm too weak to hold up, and pronator
   drift is the sign of a slight pyramidal weakness. The roots and the nerve
   are complete, so that their reflex is lost rather than reduced.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface NeuroPreset {
  id: string;
  label: LocalizedText;
  /** lesioned structures of the nervous-system graph */
  lesions: string[];
  complete: boolean;
  /** the textbook signs of this lesion (checked by the station tests) */
  signs: string[];
  /** where to look first */
  look: NeuroTest;
}

export const NEURO_PRESETS: NeuroPreset[] = [
  { id: 'mca-l', label: L('Left middle cerebral artery stroke (face and arm)', 'Mediainfarkt links (Gesicht und Arm)'),
    lesions: ['L_mcx_face', 'L_mcx_arm', 'L_broca'], complete: false, signs: ['pronator-drift', 'extensor-plantar'], look: 'drift' },
  { id: 'capsule-l', label: L('Left internal capsule (lacunar stroke)', 'Capsula interna links (lakunärer Infarkt)'),
    lesions: ['L_ic'], complete: false, signs: ['pronator-drift', 'hyperreflexia', 'extensor-plantar'], look: 'knee-jerk' },
  { id: 'cord-r', label: L('Right half of the cervical cord (Brown-Séquard)', 'Rechte Hälfte des Halsmarks (Brown-Séquard)'),
    lesions: ['R_cst_C5', 'R_dc_asc', 'R_stt_asc'], complete: false, signs: ['pronator-drift', 'hyperreflexia', 'extensor-plantar', 'limb-ataxia-eyes-closed'], look: 'drift' },
  { id: 'l3-root-r', label: L('Right L3 root', 'Wurzel L3 rechts'),
    lesions: ['R_nerve_L3', 'R_drg_L3'], complete: true, signs: ['absent-knee-reflex'], look: 'knee-jerk' },
  { id: 'femoral-r', label: L('Right femoral nerve', 'N. femoralis rechts'),
    lesions: ['R_n_femoral'], complete: true, signs: ['absent-knee-reflex'], look: 'knee-jerk' },
  { id: 's1-root-r', label: L('Right S1 root', 'Wurzel S1 rechts'),
    lesions: ['R_nerve_S1', 'R_drg_S1'], complete: true, signs: ['absent-ankle-reflex'], look: 'knee-jerk' },
  { id: 'cerebellum-l', label: L('Left cerebellar hemisphere', 'Kleinhirnhemisphäre links'),
    lesions: ['L_cerebellum'], complete: true, signs: ['limb-dysmetria', 'intention-tremor'], look: 'finger-nose' },
  { id: 'dorsal-columns', label: L('Dorsal columns, both sides (sensory ataxia)', 'Hinterstränge beidseits (sensible Ataxie)'),
    lesions: ['L_dc_asc', 'R_dc_asc'], complete: true, signs: ['limb-ataxia-eyes-closed'], look: 'finger-nose' },
];

export const NEURO_PRESET_GROUPS: Array<{ group: LocalizedText; ids: string[] }> = [
  { group: L('Upper motor neuron', 'Erstes Motoneuron'), ids: ['mca-l', 'capsule-l', 'cord-r'] },
  { group: L('Lower motor neuron: root or nerve', 'Zweites Motoneuron: Wurzel oder Nerv'), ids: ['l3-root-r', 'femoral-r', 's1-root-r'] },
  { group: L('Coordination', 'Koordination'), ids: ['cerebellum-l', 'dorsal-columns'] },
];

/** A healthy adult with this preset's lesion. */
export function applyNeuroPreset(m: PatientModel, id: string): PatientModel {
  const p = NEURO_PRESETS.find((x) => x.id === id);
  const next = structuredClone(m);
  next.lesions = { nodes: p ? [...p.lesions] : [], complete: p ? p.complete : true };
  next.vestibular = { side: 'none', severity: 0.8, daysSinceOnset: 1 };
  next.body = { ...BODY_DEFAULTS };
  return next;
}

/** The structures the station lets the learner cut by hand, rung by rung, both sides. */
const both = (id: (s: 'R' | 'L') => string, en: string, de: string) => (['R', 'L'] as const).map((s) => ({
  id: id(s), label: L(`${en}, ${s === 'R' ? 'right' : 'left'}`, `${de} ${s === 'R' ? 'rechts' : 'links'}`),
}));
export const NEURO_STRUCTURES: Array<{ group: LocalizedText; nodes: Array<{ id: string; label: LocalizedText }> }> = [
  { group: L('Cortex and internal capsule', 'Rinde und Capsula interna'), nodes: [
    ...both((s) => `${s}_mcx_arm`, 'Motor cortex (arm)', 'Motorkortex (Arm)'), ...both((s) => `${s}_mcx_leg`, 'Motor cortex (leg)', 'Motorkortex (Bein)'),
    ...both((s) => `${s}_ic`, 'Internal capsule', 'Capsula interna'),
  ] },
  { group: L('Cord', 'Rückenmark'), nodes: [
    ...both((s) => `${s}_cst_C5`, 'Corticospinal tract at C5', 'Pyramidenbahn in Höhe C5'), ...both((s) => `${s}_cst_T10`, 'Corticospinal tract at T10', 'Pyramidenbahn in Höhe Th10'),
    ...both((s) => `${s}_dc_asc`, 'Dorsal column', 'Hinterstrang'),
  ] },
  { group: L('Roots and nerves', 'Wurzeln und Nerven'), nodes: [
    ...both((s) => `${s}_nerve_L3`, 'L3 root', 'Wurzel L3'), ...both((s) => `${s}_nerve_S1`, 'S1 root', 'Wurzel S1'),
    ...both((s) => `${s}_n_femoral`, 'Femoral nerve', 'N. femoralis'), ...both((s) => `${s}_n_sciatic`, 'Sciatic nerve', 'N. ischiadicus'),
  ] },
  { group: L('Cerebellum', 'Kleinhirn'), nodes: [...both((s) => `${s}_cerebellum`, 'Cerebellar hemisphere', 'Kleinhirnhemisphäre')] },
];

/** Structures the starting points cut that the hand-cut list does not offer. */
const EXTRA: Array<{ id: string; label: LocalizedText }> = [
  ...both((s) => `${s}_mcx_face`, 'Motor cortex (face)', 'Motorkortex (Gesicht)'),
  { id: 'L_broca', label: L('Broca’s area, left', 'Broca-Areal links') },
  ...both((s) => `${s}_stt_asc`, 'Spinothalamic tract', 'Tractus spinothalamicus'),
  ...(['L3', 'S1'] as const).flatMap((r) => both((s) => `${s}_drg_${r}`, `${r} dorsal root ganglion`, `Spinalganglion ${r}`)),
];
/** A structure's name, for the station (its id if it has none). */
export function neuroNodeLabel(id: string): LocalizedText {
  return [...NEURO_STRUCTURES.flatMap((g) => g.nodes), ...EXTRA].find((n) => n.id === id)?.label ?? L(id, id);
}
