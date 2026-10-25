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
  /** the share of a structure's fibres the lesion takes, where less than all */
  extent?: Record<string, number>;
  /** days since onset (default 1): wasting and the survivors' sprouting follow it */
  days?: number;
  /** the textbook signs of this lesion (checked by the station tests) */
  signs: string[];
  /** where to look first */
  look: NeuroTest;
}

export const NEURO_PRESETS: NeuroPreset[] = [
  /* upper motor neuron */
  { id: 'mca-l', label: L('Left middle cerebral artery stroke (face and arm)', 'Mediainfarkt links (Gesicht und Arm)'),
    lesions: ['L_mcx_face', 'L_mcx_arm', 'L_broca', 'L_mcx_leg'], extent: { L_mcx_leg: 0.3 }, complete: false, days: 1, signs: ['pronator-drift', 'extensor-plantar'], look: 'drift' },
  { id: 'capsule-l', label: L('Left internal capsule (lacunar stroke)', 'Capsula interna links (lakunärer Infarkt)'),
    lesions: ['L_ic'], complete: false, days: 1, signs: ['pronator-drift', 'hyperreflexia', 'extensor-plantar'], look: 'leg-reflexes' },
  { id: 'cord-r', label: L('Right half of the cervical cord (Brown-Séquard)', 'Rechte Hälfte des Halsmarks (Brown-Séquard)'),
    lesions: ['R_cst_C5', 'R_dc_asc', 'R_stt_asc'], complete: false, days: 1, signs: ['pronator-drift', 'hyperreflexia', 'extensor-plantar', 'limb-ataxia-eyes-closed'], look: 'drift' },
  { id: 'cord-t10-r', label: L('Right half of the thoracic cord at T10', 'Rechte Hälfte des Brustmarks in Höhe Th10'),
    lesions: ['R_cst_T10', 'R_dc_T10', 'R_stt_T10'], complete: false, days: 1, signs: ['hyperreflexia', 'extensor-plantar', 'sensory-level', 'distal-vibration-loss'], look: 'sensation' },
  { id: 'mnd', label: L('Motor neurone disease (upper and lower)', 'Motoneuronerkrankung (erstes und zweites Motoneuron)'),
    lesions: ['L_ahn_C8', 'R_ahn_C8', 'L_ahn_T1', 'R_ahn_T1', 'L_cst_L2', 'R_cst_L2', 'L_cst_L3', 'R_cst_L3', 'L_cst_L4', 'R_cst_L4', 'L_cst_L5', 'R_cst_L5', 'L_cst_S1', 'R_cst_S1'], complete: false, days: 365, extent: { L_ahn_C8: 0.8, R_ahn_C8: 0.8, L_ahn_T1: 0.8, R_ahn_T1: 0.8 },
    signs: ['fasciculation', 'muscle-wasting', 'hyperreflexia', 'extensor-plantar'], look: 'tone' },
  /* brainstem and cranial nerves */
  { id: 'wallenberg-l', label: L('Left lateral medulla (Wallenberg)', 'Laterale Medulla links (Wallenberg)'),
    lesions: ['L_cn5_sens', 'L_lat_bs', 'L_icp', 'L_cn9_nuc', 'L_cn10_nuc', 'L_stt_asc'], complete: true, days: 1, signs: ['crossed-sensory-loss', 'limb-dysmetria', 'uvula-deviation', 'ptosis', 'anisocoria'], look: 'sensation' },
  { id: 'medial-medulla-l', label: L('Left medial medulla', 'Mediale Medulla links'),
    lesions: ['L_med_pyr', 'L_dc_nuc', 'L_cn12_nuc'], complete: true, days: 1, signs: ['pronator-drift', 'extensor-plantar', 'tongue-deviation'], look: 'cranial' },
  { id: 'cn3-l', label: L('Left third nerve (pupil involved)', 'N. oculomotorius links (mit Pupille)'),
    lesions: ['L_cn3'], complete: true, days: 1, signs: ['ptosis', 'fixed-dilated-pupil', 'eye-down-and-out'], look: 'eyes' },
  { id: 'cn6-l', label: L('Left sixth nerve', 'N. abducens links'), lesions: ['L_cn6'], complete: true, days: 7, signs: ['abduction-deficit'], look: 'eyes' },
  { id: 'horner-l', label: L('Left sympathetic chain (Horner’s syndrome)', 'Grenzstrang links (Horner-Syndrom)'), lesions: ['L_scg'], complete: true, days: 30, signs: ['ptosis', 'anisocoria', 'dilation-lag'], look: 'eyes' },
  { id: 'bell-l', label: L('Left facial nerve (Bell’s palsy)', 'N. facialis links (Bell-Parese)'),
    lesions: ['L_cn7'], complete: true, days: 3, signs: ['lmn-facial-weakness'], look: 'cranial' },
  /* roots, plexus and nerves */
  { id: 'c6-root-r', label: L('Right C6 root', 'Wurzel C6 rechts'), lesions: ['R_nerve_C6', 'R_drg_C6'], complete: true, days: 14, signs: ['myotomal-weakness', 'dermatomal-sensory-loss'], look: 'sensation' },
  { id: 'l4-root-r', label: L('Right L4 root', 'Wurzel L4 rechts'), lesions: ['R_nerve_L4', 'R_drg_L4'], complete: true, days: 14, signs: ['reduced-knee-reflex'], look: 'leg-reflexes' },
  { id: 'l5-root-r', label: L('Right L5 root', 'Wurzel L5 rechts'), lesions: ['R_nerve_L5', 'R_drg_L5'], complete: true, days: 14, signs: ['myotomal-weakness', 'dermatomal-sensory-loss'], look: 'power' },
  { id: 's1-root-r', label: L('Right S1 root', 'Wurzel S1 rechts'), lesions: ['R_nerve_S1', 'R_drg_S1'], complete: true, days: 14, signs: ['absent-ankle-reflex'], look: 'leg-reflexes' },
  { id: 'cauda-equina', label: L('Cauda equina (sacral roots, both sides)', 'Cauda equina (sakrale Wurzeln beidseits)'),
    lesions: ['L_nerve_S1', 'R_nerve_S1', 'L_drg_S1', 'R_drg_S1', 'L_drg_S2', 'R_drg_S2', 'L_drg_S3', 'R_drg_S3', 'L_drg_S4', 'R_drg_S4'], complete: true, days: 1, signs: ['saddle-anaesthesia', 'absent-ankle-reflex'], look: 'sensation' },
  { id: 'erb-r', label: L('Right upper brachial plexus (Erb)', 'Oberer Plexus brachialis rechts (Erb)'), lesions: ['R_bp_upper'], complete: true, days: 7, signs: ['myotomal-weakness'], look: 'power' },
  { id: 'femoral-r', label: L('Right femoral nerve', 'N. femoralis rechts'), lesions: ['R_n_femoral'], complete: true, days: 7, signs: ['reduced-knee-reflex'], look: 'leg-reflexes' },
  { id: 'peroneal-r', label: L('Right common peroneal nerve (fibular head)', 'N. peroneus communis rechts (Fibulaköpfchen)'), lesions: ['R_n_peroneal_head'], complete: true, days: 14, signs: ['foot-drop', 'steppage-gait'], look: 'gait' },
  { id: 'ulnar-r', label: L('Right ulnar nerve at the elbow', 'N. ulnaris rechts am Ellenbogen'), lesions: ['R_n_ulnar_elbow'], complete: true, days: 120, signs: ['myotomal-weakness', 'muscle-wasting'], look: 'power' },
  /* junction and muscle */
  { id: 'myasthenia', label: L('Myasthenia gravis', 'Myasthenia gravis'), lesions: ['L_nmj_post', 'R_nmj_post'], complete: true, days: 180, signs: ['fatigable-weakness', 'fatigable-dysarthria'], look: 'power' },
  { id: 'myopathy', label: L('Proximal myopathy', 'Proximale Myopathie'), lesions: ['L_muscle_prox', 'R_muscle_prox'], complete: true, days: 365, signs: ['proximal-symmetrical-weakness', 'waddling-gait'], look: 'gait' },
  /* the extrapyramidal system and the longest nerves */
  { id: 'parkinson-l', label: L('Left substantia nigra (parkinsonism, right side)', 'Substantia nigra links (Parkinsonismus rechts)'), lesions: ['L_snc'], complete: true, days: 730, signs: ['rigidity', 'rest-tremor', 'slowed-alternating-movements', 'shuffling-gait'], look: 'gait' },
  { id: 'parkinson-both', label: L('Parkinson’s disease, both sides, eight years', 'Morbus Parkinson, beidseits, acht Jahre'), lesions: ['L_snc', 'R_snc'], complete: true, days: 2920,
    signs: ['rigidity', 'rest-tremor', 'shuffling-gait', 'postural-instability'], look: 'pull' },
  { id: 'polyneuropathy', label: L('Length-dependent polyneuropathy', 'Längenabhängige Polyneuropathie'), lesions: ['polyneuropathy'], complete: true, days: 730, signs: ['stocking-sensory-loss', 'absent-ankle-reflex', 'distal-vibration-loss', 'foot-drop'], look: 'sensation' },
  /* coordination and sensation */
  { id: 'cerebellum-l', label: L('Left cerebellar hemisphere', 'Kleinhirnhemisphäre links'), lesions: ['L_cerebellum'], complete: true, days: 1, signs: ['limb-dysmetria', 'intention-tremor'], look: 'finger-nose' },
  { id: 'vermis', label: L('Cerebellar vermis', 'Kleinhirnwurm (Vermis)'), lesions: ['vermis'], complete: true, days: 365, signs: ['truncal-ataxia', 'ataxic-gait'], look: 'gait' },
  { id: 'dorsal-columns', label: L('Dorsal columns, both sides (sensory ataxia)', 'Hinterstränge beidseits (sensible Ataxie)'), lesions: ['L_dc_asc', 'R_dc_asc'], complete: true, days: 180, signs: ['limb-ataxia-eyes-closed'], look: 'romberg' },
  { id: 'sensory-cortex-l', label: L('Left sensory cortex', 'Sensibler Kortex links'), lesions: ['L_scx'], complete: true, days: 1, signs: ['hemisensory-loss'], look: 'sensation' },
];

export const NEURO_PRESET_GROUPS: Array<{ group: LocalizedText; ids: string[] }> = [
  { group: L('Upper motor neuron', 'Erstes Motoneuron'), ids: ['mca-l', 'capsule-l', 'cord-r', 'cord-t10-r', 'mnd'] },
  { group: L('Brainstem and cranial nerves', 'Hirnstamm und Hirnnerven'), ids: ['wallenberg-l', 'medial-medulla-l', 'cn3-l', 'cn6-l', 'horner-l', 'bell-l'] },
  { group: L('Roots, plexus and nerves', 'Wurzeln, Plexus und Nerven'), ids: ['c6-root-r', 'l4-root-r', 'l5-root-r', 's1-root-r', 'cauda-equina', 'erb-r', 'femoral-r', 'peroneal-r', 'ulnar-r'] },
  { group: L('Junction and muscle', 'Endplatte und Muskel'), ids: ['myasthenia', 'myopathy'] },
  { group: L('Basal ganglia and polyneuropathy', 'Basalganglien und Polyneuropathie'), ids: ['parkinson-l', 'parkinson-both', 'polyneuropathy'] },
  { group: L('Coordination and sensation', 'Koordination und Sensibilität'), ids: ['cerebellum-l', 'vermis', 'dorsal-columns', 'sensory-cortex-l'] },
];

/** A healthy adult with this preset's lesion. */
export function applyNeuroPreset(m: PatientModel, id: string): PatientModel {
  const p = NEURO_PRESETS.find((x) => x.id === id);
  const next = structuredClone(m);
  next.lesions = { nodes: p ? [...p.lesions] : [], complete: p ? p.complete : true, ...(p?.extent ? { extent: { ...p.extent } } : {}), ...(p?.days !== undefined ? { days: p.days } : {}) };
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
    ...both((s) => `${s}_mcx_face`, 'Motor cortex (face)', 'Motorkortex (Gesicht)'), ...both((s) => `${s}_mcx_arm`, 'Motor cortex (arm)', 'Motorkortex (Arm)'),
    ...both((s) => `${s}_mcx_leg`, 'Motor cortex (leg)', 'Motorkortex (Bein)'), ...both((s) => `${s}_scx`, 'Sensory cortex', 'Sensibler Kortex'),
    ...both((s) => `${s}_ic`, 'Internal capsule', 'Capsula interna'),
  ] },
  { group: L('Basal ganglia', 'Basalganglien'), nodes: [...both((s) => `${s}_snc`, 'Substantia nigra', 'Substantia nigra')] },
  { group: L('Brainstem', 'Hirnstamm'), nodes: [
    ...both((s) => `${s}_med_pyr`, 'Medullary pyramid', 'Pyramide der Medulla'), ...both((s) => `${s}_icp`, 'Inferior cerebellar peduncle', 'Unterer Kleinhirnstiel'),
    ...both((s) => `${s}_lat_bs`, 'Lateral medulla (sympathetic, vestibular nuclei)', 'Laterale Medulla (Sympathikus, Vestibulariskerne)'),
    ...both((s) => `${s}_cn5_sens`, 'Trigeminal sensory nucleus', 'Sensibler Trigeminuskern'), ...both((s) => `${s}_cn10_nuc`, 'Nucleus ambiguus (IX, X)', 'Nucleus ambiguus (IX, X)'),
    ...both((s) => `${s}_cn12_nuc`, 'Hypoglossal nucleus (XII)', 'Hypoglossuskern (XII)'),
  ] },
  { group: L('Cranial nerves', 'Hirnnerven'), nodes: [
    ...both((s) => `${s}_cn3`, 'Oculomotor nerve (III)', 'N. oculomotorius (III)'), ...both((s) => `${s}_cn6`, 'Abducens nerve (VI)', 'N. abducens (VI)'),
    ...both((s) => `${s}_scg`, 'Sympathetic chain (superior cervical ganglion)', 'Grenzstrang (Ganglion cervicale superius)'),
    ...both((s) => `${s}_cn7`, 'Facial nerve (VII)', 'N. facialis (VII)'), ...both((s) => `${s}_cn12`, 'Hypoglossal nerve (XII)', 'N. hypoglossus (XII)'),
    ...both((s) => `${s}_cn11`, 'Accessory nerve (XI)', 'N. accessorius (XI)'),
  ] },
  { group: L('Cord', 'Rückenmark'), nodes: [
    ...both((s) => `${s}_cst_C5`, 'Corticospinal tract at C5', 'Pyramidenbahn in Höhe C5'), ...both((s) => `${s}_cst_T10`, 'Corticospinal tract at T10', 'Pyramidenbahn in Höhe Th10'),
    ...both((s) => `${s}_dc_asc`, 'Dorsal column (cervical)', 'Hinterstrang (zervikal)'), ...both((s) => `${s}_dc_T10`, 'Dorsal column at T10', 'Hinterstrang in Höhe Th10'),
    ...both((s) => `${s}_stt_asc`, 'Spinothalamic tract (cervical)', 'Tractus spinothalamicus (zervikal)'), ...both((s) => `${s}_stt_T10`, 'Spinothalamic tract at T10', 'Tractus spinothalamicus in Höhe Th10'),
    ...both((s) => `${s}_ahn_C8`, 'Anterior horn C8', 'Vorderhorn C8'),
  ] },
  { group: L('Roots and plexus', 'Wurzeln und Plexus'), nodes: [
    ...(['C6', 'C7', 'L4', 'L5', 'S1'] as const).flatMap((r) => both((s) => `${s}_nerve_${r}`, `${r} root`, `Wurzel ${r}`)),
    ...both((s) => `${s}_bp_upper`, 'Upper brachial plexus', 'Oberer Plexus brachialis'),
  ] },
  { group: L('Nerves', 'Nerven'), nodes: [
    ...both((s) => `${s}_n_radial`, 'Radial nerve', 'N. radialis'), ...both((s) => `${s}_n_median`, 'Median nerve', 'N. medianus'), ...both((s) => `${s}_n_ulnar_elbow`, 'Ulnar nerve at the elbow', 'N. ulnaris am Ellenbogen'),
    ...both((s) => `${s}_n_femoral`, 'Femoral nerve', 'N. femoralis'), ...both((s) => `${s}_n_sciatic`, 'Sciatic nerve', 'N. ischiadicus'), ...both((s) => `${s}_n_peroneal_head`, 'Common peroneal nerve', 'N. peroneus communis'),
  ] },
  { group: L('All the nerves', 'Alle Nerven'), nodes: [{ id: 'polyneuropathy', label: L('Length-dependent polyneuropathy', 'Längenabhängige Polyneuropathie') }] },
  { group: L('Junction and muscle', 'Endplatte und Muskel'), nodes: [
    ...both((s) => `${s}_nmj_post`, 'Neuromuscular junction', 'Motorische Endplatte'), ...both((s) => `${s}_muscle_prox`, 'Proximal muscles', 'Proximale Muskulatur'),
  ] },
  { group: L('Cerebellum', 'Kleinhirn'), nodes: [...both((s) => `${s}_cerebellum`, 'Cerebellar hemisphere', 'Kleinhirnhemisphäre'), { id: 'vermis', label: L('Cerebellar vermis', 'Kleinhirnwurm (Vermis)') }] },
];

/** A structure's name, for the station: from the hand-cut list, or read from its id (its id if neither). */
const NAMED: Array<[RegExp, (m: RegExpMatchArray) => [string, string]]> = [
  [/^(R|L)_mcx_(face|arm|leg)$/, (m) => [`Motor cortex (${m[2]})`, `Motorkortex (${({ face: 'Gesicht', arm: 'Arm', leg: 'Bein' } as Record<string, string>)[m[2]]})`]],
  [/^(R|L)_scx$/, () => ['Sensory cortex', 'Sensibler Kortex']],
  [/^(R|L)_snc$/, () => ['Substantia nigra', 'Substantia nigra']],
  [/^polyneuropathy$/, () => ['All the longest nerves (polyneuropathy)', 'Alle längsten Nerven (Polyneuropathie)']],
  [/^L_broca$/, () => ['Broca’s area', 'Broca-Areal']],
  [/^(R|L)_ic$/, () => ['Internal capsule', 'Capsula interna']],
  [/^(R|L)_cst_(\w+)$/, (m) => [`Corticospinal tract at ${m[2]}`, `Pyramidenbahn in Höhe ${m[2].replace('T', 'Th')}`]],
  [/^(R|L)_dc_asc$/, () => ['Dorsal column', 'Hinterstrang']],
  [/^(R|L)_dc_nuc$/, () => ['Dorsal column nuclei (medulla)', 'Hinterstrangkerne (Medulla)']],
  [/^(R|L)_dc_(\w+)$/, (m) => [`Dorsal column at ${m[2]}`, `Hinterstrang in Höhe ${m[2].replace('T', 'Th')}`]],
  [/^(R|L)_stt_asc$/, () => ['Spinothalamic tract', 'Tractus spinothalamicus']],
  [/^(R|L)_stt_(\w+)$/, (m) => [`Spinothalamic tract at ${m[2]}`, `Tractus spinothalamicus in Höhe ${m[2].replace('T', 'Th')}`]],
  [/^(R|L)_ahn_(\w+)$/, (m) => [`Anterior horn ${m[2]}`, `Vorderhorn ${m[2]}`]],
  [/^(R|L)_nerve_(\w+)$/, (m) => [`${m[2]} root`, `Wurzel ${m[2]}`]],
  [/^(R|L)_drg_(\w+)$/, (m) => [`${m[2]} dorsal root ganglion`, `Spinalganglion ${m[2]}`]],
  [/^(R|L)_bp_upper$/, () => ['Upper trunk of the brachial plexus', 'Oberer Primärstrang des Plexus brachialis']],
  [/^(R|L)_n_femoral$/, () => ['Femoral nerve', 'N. femoralis']], [/^(R|L)_n_sciatic$/, () => ['Sciatic nerve', 'N. ischiadicus']],
  [/^(R|L)_n_peroneal_head$/, () => ['Common peroneal nerve at the fibular head', 'N. peroneus communis am Fibulaköpfchen']],
  [/^(R|L)_n_ulnar_elbow$/, () => ['Ulnar nerve at the elbow', 'N. ulnaris am Ellenbogen']],
  [/^(R|L)_n_radial$/, () => ['Radial nerve', 'N. radialis']], [/^(R|L)_n_median$/, () => ['Median nerve', 'N. medianus']],
  [/^(R|L)_nmj_post$/, () => ['Neuromuscular junction (acetylcholine receptors)', 'Motorische Endplatte (Acetylcholinrezeptoren)']],
  [/^(R|L)_muscle_prox$/, () => ['Proximal muscles', 'Proximale Muskulatur']],
  [/^(R|L)_cerebellum$/, () => ['Cerebellar hemisphere', 'Kleinhirnhemisphäre']], [/^vermis$/, () => ['Cerebellar vermis', 'Kleinhirnwurm']],
  [/^(R|L)_icp$/, () => ['Inferior cerebellar peduncle', 'Unterer Kleinhirnstiel']],
  [/^(R|L)_lat_bs$/, () => ['Lateral medulla', 'Laterale Medulla']], [/^(R|L)_med_pyr$/, () => ['Medullary pyramid', 'Pyramide der Medulla']],
  [/^(R|L)_cn5_sens$/, () => ['Trigeminal sensory nucleus', 'Sensibler Trigeminuskern']],
  [/^(R|L)_cn(\d+)_nuc$/, (m) => [`Nucleus of cranial nerve ${m[2]}`, `Kern des Hirnnerven ${m[2]}`]],
  [/^(R|L)_cn(\d+)$/, (m) => [`Cranial nerve ${m[2]}`, `Hirnnerv ${m[2]}`]],
];
/** A structure's name, for the station (its id if it has none). */
export function neuroNodeLabel(id: string): LocalizedText {
  const listed = NEURO_STRUCTURES.flatMap((g) => g.nodes).find((n) => n.id === id);
  if (listed) return listed.label;
  for (const [re, f] of NAMED) {
    const m = id.match(re);
    if (m) { const [en, de] = f(m); const sd = /^(R|L)_/.exec(id)?.[1]; return sd ? L(`${en}, ${sd === 'R' ? 'right' : 'left'}`, `${de} ${sd === 'R' ? 'rechts' : 'links'}`) : L(en, de); }
  }
  return L(id, id);
}
