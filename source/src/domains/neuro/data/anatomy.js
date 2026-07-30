/* ---------------------------------------------------------------------------
   Neuroanatomy as a graph.

   Two tables. NODES are places a lesion can sit — a cortical region, a tract at
   a named cord level, a cranial nerve nucleus, a decussation. PATHWAYS are
   ordered chains of nodes that carry one modality from origin to target, with
   the point where an upper motor neuron hands over to a lower motor neuron
   marked explicitly.

   Everything clinically interesting falls out of those two facts. Where a
   pathway crosses the midline decides whether a deficit is ipsilateral or
   contralateral. Where the UMN/LMN transition sits decides whether the finding
   is spastic with brisk reflexes or flaccid with absent ones. The localiser
   does not contain a table of syndromes — it derives them.
--------------------------------------------------------------------------- */

export const NODES = {};

function node(id, name, level, side, isDecussation = false) {
  NODES[id] = { id, name, level, side, isDecussation };
  return id;
}

const SIDES = ['L', 'R'];
const other = (s) => (s === 'L' ? 'R' : 'L');

/* -------------------------------------------------------------- cortex ---- */
node('L_mcx_face', 'L motor cortex (face)', 'cortex', 'L');
node('R_mcx_face', 'R motor cortex (face)', 'cortex', 'R');
node('L_mcx_arm', 'L motor cortex (arm)', 'cortex', 'L');
node('R_mcx_arm', 'R motor cortex (arm)', 'cortex', 'R');
node('L_mcx_leg', 'L motor cortex (leg)', 'cortex', 'L');
node('R_mcx_leg', 'R motor cortex (leg)', 'cortex', 'R');
node('L_scx', 'L sensory cortex', 'cortex', 'L');
node('R_scx', 'R sensory cortex', 'cortex', 'R');
node('L_vis_cx', 'L visual cortex (occipital)', 'cortex', 'L');
node('R_vis_cx', 'R visual cortex (occipital)', 'cortex', 'R');
node('L_broca', 'L Broca area (speech production)', 'cortex', 'L');
node('L_wernicke', 'L Wernicke area (speech comprehension)', 'cortex', 'L');
node('L_arcuate', 'L arcuate fasciculus', 'cortex', 'L');

node('L_ic', 'L internal capsule', 'ic', 'L');
node('R_ic', 'R internal capsule', 'ic', 'R');
node('L_thal', 'L thalamus', 'thalamus', 'L');
node('R_thal', 'R thalamus', 'thalamus', 'R');

/* ------------------------------------------------------- visual pathway ---- */
node('L_retina_temp', 'L retina temporal (sees nasal/R field)', 'eye', 'L');
node('L_retina_nas', 'L retina nasal (sees temporal/L field)', 'eye', 'L');
node('R_retina_temp', 'R retina temporal (sees nasal/L field)', 'eye', 'R');
node('R_retina_nas', 'R retina nasal (sees temporal/R field)', 'eye', 'R');
node('L_cn2', 'L optic nerve (CN II)', 'orbit', 'L');
node('R_cn2', 'R optic nerve (CN II)', 'orbit', 'R');
node('chiasm', 'Optic chiasm', 'chiasm', 'B', true);
node('L_optic_tract', 'L optic tract', 'midbrain', 'L');
node('R_optic_tract', 'R optic tract', 'midbrain', 'R');
node('L_lgn', 'L lateral geniculate nucleus', 'thalamus', 'L');
node('R_lgn', 'R lateral geniculate nucleus', 'thalamus', 'R');
node('L_optic_rad', 'L optic radiation', 'parietal', 'L');
node('R_optic_rad', 'R optic radiation', 'parietal', 'R');

/* ------------------------------------------------------ pupillary loop ---- */
node('L_pretectal', 'L pretectal nucleus', 'midbrain', 'L');
node('R_pretectal', 'R pretectal nucleus', 'midbrain', 'R');
node('L_ew', 'L Edinger-Westphal nucleus', 'midbrain', 'L');
node('R_ew', 'R Edinger-Westphal nucleus', 'midbrain', 'R');
node('L_ciliary', 'L ciliary ganglion', 'orbit', 'L');
node('R_ciliary', 'R ciliary ganglion', 'orbit', 'R');
node('L_pupil', 'L pupillary sphincter', 'eye', 'L');
node('R_pupil', 'R pupillary sphincter', 'eye', 'R');

/* --------------------------------------- oculosympathetic (Horner) chain --- */
node('L_hypothal', 'L hypothalamus', 'hypothalamus', 'L');
node('R_hypothal', 'R hypothalamus', 'hypothalamus', 'R');
node('L_lat_bs', 'L lateral brainstem (sympathetic)', 'brainstem', 'L');
node('R_lat_bs', 'R lateral brainstem (sympathetic)', 'brainstem', 'R');
node('L_cilio_C', 'L ciliospinal center (C8-T2)', 'cord_C', 'L');
node('R_cilio_C', 'R ciliospinal center (C8-T2)', 'cord_C', 'R');
node('L_scg', 'L superior cervical ganglion', 'peripheral', 'L');
node('R_scg', 'R superior cervical ganglion', 'peripheral', 'R');
node('L_pupil_dil', 'L pupil dilator', 'eye', 'L');
node('R_pupil_dil', 'R pupil dilator', 'eye', 'R');

/* ------------------------------------------------- cranial nerve nuclei ---- */
const CN_NUCLEI = [
  ['cn3_nuc', 'CN III nucleus (oculomotor)', 'midbrain'],
  ['cn4_nuc', 'CN IV nucleus (trochlear)', 'midbrain'],
  ['cn5_mot', 'CN V motor nucleus', 'pons'],
  ['cn5_sens', 'CN V sensory nucleus', 'pons'],
  ['cn6_nuc', 'CN VI nucleus (abducens)', 'pons'],
  ['cn7_nuc', 'CN VII nucleus (facial motor)', 'pons'],
  ['cn8_coch', 'CN VIII cochlear nucleus', 'pons'],
  ['cn8_vest', 'CN VIII vestibular nucleus', 'pons'],
  ['cn9_nuc', 'CN IX nucleus', 'medulla'],
  ['cn10_nuc', 'CN X nucleus (dorsal vagal + ambiguus)', 'medulla'],
  ['cn11_nuc', 'CN XI nucleus (spinal accessory)', 'medulla'],
  ['cn12_nuc', 'CN XII nucleus (hypoglossal)', 'medulla'],
];
for (const s of SIDES) for (const [id, name, level] of CN_NUCLEI) node(`${s}_${id}`, `${s} ${name}`, level, s);

const CN_NERVES = [
  ['cn3', 'oculomotor nerve'], ['cn4', 'trochlear nerve'], ['cn5_nerve', 'trigeminal nerve'],
  ['cn6', 'abducens nerve'], ['cn7', 'facial nerve'], ['cn8', 'vestibulocochlear nerve'],
  ['cn9', 'glossopharyngeal nerve'], ['cn10', 'vagus nerve'], ['cn11', 'accessory nerve'],
  ['cn12', 'hypoglossal nerve'],
];
for (const s of SIDES) for (const [id, name] of CN_NERVES) node(`${s}_${id}`, `${s} ${name}`, 'peripheral', s);

/* ------------------------------------------------------ corticospinal ------ */
for (const s of SIDES) {
  node(`${s}_peduncle`, `${s} cerebral peduncle`, 'midbrain', s);
  node(`${s}_pons_cst`, `${s} pontine CST`, 'pons', s);
  node(`${s}_med_pyr`, `${s} medullary pyramid`, 'medulla', s);
}
node('pyr_decuss', 'Pyramidal decussation', 'medulla', 'B', true);

const CST_LEVELS = ['C5','C6','C7','C8','T1','T6','T10','L2','L3','L4','L5','S1','S2'];
const AHN_LEVELS = ['C5','C6','C7','C8','T1','L2','L3','L4','L5','S1','S2'];
const MYOTOMES = [['C5','deltoid'],['C6','biceps'],['C7','triceps/wrist ext'],['C8','finger flexors'],
  ['T1','hand intrinsics'],['L2','hip flexors'],['L3','knee extensors'],['L4','ankle dorsiflexors'],
  ['L5','great toe extensor'],['S1','ankle plantarflexors']];
const DRG_LEVELS = ['C5','C6','C7','C8','T1','T6','T10','L2','L3','L4','L5','S1','S2','S3','S4'];
const DERMATOMES = ['C5','C6','C7','C8','T1','T6','T10','L2','L3','L4','L5','S1'];

const cordLevel = (seg) => 'cord_' + seg[0];

for (const s of SIDES) {
  for (const l of CST_LEVELS) node(`${s}_cst_${l}`, `${s} lateral CST at ${l}`, cordLevel(l), s);
  for (const l of AHN_LEVELS) node(`${s}_ahn_${l}`, `${s} anterior horn ${l}`, cordLevel(l), s);
  for (const [l, muscle] of MYOTOMES) node(`${s}_nerve_${l}`, `${s} ${l} nerve (${muscle})`, 'peripheral', s);
  for (const l of DRG_LEVELS) node(`${s}_drg_${l}`, `${s} dorsal root ganglion ${l}`, cordLevel(l), s);
}

/* -------------------------------------- ascending sensory: the two systems -- */
/* Pain and temperature cross within a segment or two of entry. Position and
   vibration ascend ipsilaterally to the medulla and cross there. That single
   difference produces most of the cord syndromes. */
for (const s of SIDES) {
  for (const l of DERMATOMES) {
    node(`${s}_stt_cross_${l}`, `${s}→${other(s)} STT crossing at ${l}`, cordLevel(l), s, true);
  }
  node(`${s}_stt_asc`, `${s} anterolateral tract (ascending)`, 'cord_T', s);
  node(`${s}_dc_asc`, `${s} dorsal column (ascending)`, 'cord_T', s);
  node(`${s}_dc_nuc`, `${s} nucleus gracilis/cuneatus`, 'medulla', s);
}
node('ml_decuss', 'Medial lemniscal decussation', 'medulla', 'B', true);
for (const s of SIDES) node(`${s}_ml`, `${s} medial lemniscus`, 'brainstem', s);

/* -------------------------------------------------------- cerebellum ------- */
node('L_cerebellum', 'L cerebellar hemisphere', 'cerebellum', 'L');
node('R_cerebellum', 'R cerebellar hemisphere', 'cerebellum', 'R');
node('vermis', 'Cerebellar vermis', 'cerebellum', 'B');
for (const s of SIDES) {
  node(`${s}_icp`, `${s} inferior cerebellar peduncle`, 'cerebellum', s);
  node(`${s}_mcp`, `${s} middle cerebellar peduncle`, 'pons', s);
  node(`${s}_scp`, `${s} superior cerebellar peduncle`, 'midbrain', s);
  node(`${s}_red_nuc`, `${s} red nucleus`, 'midbrain', s);
  node(`${s}_dentate`, `${s} dentate nucleus`, 'cerebellum', s);
}
node('scp_decuss', 'SCP decussation', 'midbrain', 'B', true);

/* ---------------------------------------------------------- autonomic ------ */
node('pontine_mic', 'Pontine micturition center', 'pons', 'B');
node('L_sacral_para', 'L sacral parasympathetic (S2-S4)', 'cord_S', 'L');
node('R_sacral_para', 'R sacral parasympathetic (S2-S4)', 'cord_S', 'R');
node('bladder', 'Detrusor muscle', 'peripheral', 'B');
node('L_pudendal', 'L pudendal nerve (S2-S4)', 'peripheral', 'L');
node('R_pudendal', 'R pudendal nerve (S2-S4)', 'peripheral', 'R');
node('ext_sphincter', 'External urethral sphincter', 'peripheral', 'B');

/* -------------------------------- named brainstem territories (syndromes) --- */
for (const s of SIDES) {
  node(`${s}_lat_med`, `${s} lateral medulla`, 'medulla', s);
  node(`${s}_med_med`, `${s} medial medulla`, 'medulla', s);
  node(`${s}_med_pons`, `${s} medial pons`, 'pons', s);
  node(`${s}_lat_pons`, `${s} lateral pons`, 'pons', s);
  node(`${s}_med_midbrain`, `${s} medial midbrain`, 'midbrain', s);
}

/* ========================================================================== */
/*  PATHWAYS                                                                  */
/* ========================================================================== */

export const PATHWAYS = [];
const path = (p) => { PATHWAYS.push(p); return p; };

/* ------------------------------------------------- corticospinal pathways -- */
function corticospinal(side, seg, muscle, bodyRegion) {
  const dst = other(side);
  const order = ['C5','C6','C7','C8','T1','L2','L3','L4','L5','S1'];
  const through = order.slice(0, order.indexOf(seg) + 1).map((l) => `${dst}_cst_${l}`);
  path({
    id: `cst_${side}_${dst}_${seg}`,
    name: `${side} cortex → ${dst} ${muscle} (${seg})`,
    modality: 'motor',
    nodes: [
      `${side}_mcx_${seg <= 'T1' ? 'arm' : 'leg'}`,
      `${side}_ic`, `${side}_peduncle`, `${side}_pons_cst`, `${side}_med_pyr`,
      'pyr_decuss', ...through, `${dst}_ahn_${seg}`, `${dst}_nerve_${seg}`,
    ],
    lmnFrom: `${dst}_ahn_${seg}`,
    bodyRegion,
    testMethod: `Test ${muscle} strength (MRC grade 0-5)`,
  });
}
for (const [seg, muscle, limb] of [
  ['C5','deltoid','arm'], ['C6','biceps','arm'], ['C7','triceps','arm'],
  ['C8','finger flexors','arm'], ['T1','hand intrinsics','arm'],
  ['L2','hip flexors','leg'], ['L3','knee extensors','leg'], ['L4','ankle dorsiflexors','leg'],
  ['L5','great toe extensor','leg'], ['S1','ankle plantarflexors','leg'],
]) {
  corticospinal('L', seg, muscle, `R_${limb}_${seg}`);
  corticospinal('R', seg, muscle, `L_${limb}_${seg}`);
}

/* -------------------------------------------------------- cranial motor ---- */
for (const s of SIDES) {
  path({ id: `cn3_${s}`, name: `CN III ${s} (oculomotor)`, modality: 'cranial_motor',
    nodes: [`${s}_cn3_nuc`, `${s}_cn3`], lmnFrom: `${s}_cn3_nuc`,
    bodyRegion: `${s}_eye_movement`,
    testMethod: 'Test eye movements (medial, up, down), check ptosis' });

  // The trochlear nerve is the only one that decussates before it exits.
  path({ id: `cn4_${s}`, name: `CN IV ${s} nuc → ${other(s)} eye`, modality: 'cranial_motor',
    nodes: [`${s}_cn4_nuc`, `${other(s)}_cn4`], lmnFrom: `${s}_cn4_nuc`,
    bodyRegion: `${other(s)}_eye_downgaze`,
    testMethod: 'Test looking down and in (reading stairs)' });

  path({ id: `cn5m_${s}`, name: `CN V motor ${s} (mastication)`, modality: 'cranial_motor',
    nodes: [`${s}_cn5_mot`, `${s}_cn5_nerve`], lmnFrom: `${s}_cn5_mot`,
    bodyRegion: `${s}_jaw`, testMethod: 'Test jaw clench, jaw opening against resistance' });

  for (const div of ['V1_forehead', 'V2_cheek', 'V3_jaw']) {
    path({ id: `cn5s_${s}_${div}`, name: `CN V sensory ${s} ${div}`, modality: 'face_sensation',
      nodes: [`${s}_cn5_nerve`, `${s}_cn5_sens`, `${other(s)}_thal`, `${other(s)}_scx`],
      bodyRegion: `${s}_face_${div}`,
      testMethod: `Test light touch and pinprick on ${div.replace('_', ' ')}` });
  }

  path({ id: `cn6_${s}`, name: `CN VI ${s} (abducens)`, modality: 'cranial_motor',
    nodes: [`${s}_cn6_nuc`, `${s}_cn6`], lmnFrom: `${s}_cn6_nuc`,
    bodyRegion: `${s}_eye_abduction`, testMethod: 'Test lateral gaze — eye fails to abduct' });

  /* The facial nucleus: the lower face gets crossed input only, the upper face
     gets input from both hemispheres. That asymmetry is the entire basis of
     "forehead sparing" in a stroke versus a Bell's palsy. */
  path({ id: `cn7_${other(s)}_to_${s}_lower`, name: `${other(s)} cortex → ${s} lower face`,
    modality: 'cranial_motor',
    nodes: [`${other(s)}_mcx_face`, `${other(s)}_ic`, `${other(s)}_peduncle`, `${other(s)}_pons_cst`,
      `${s}_cn7_nuc`, `${s}_cn7`],
    lmnFrom: `${s}_cn7_nuc`, bodyRegion: `${s}_face_lower`,
    testMethod: 'Ask to show teeth, puff cheeks' });
  for (const src of SIDES) {
    path({ id: `cn7_${src}_to_${s}_upper`, name: `${src} cortex → ${s} upper face`,
      modality: 'cranial_motor',
      /* Genuinely parallel: either hemisphere alone can drive the upper face. */
      parallel: true,
      nodes: [`${src}_mcx_face`, `${src}_ic`, `${src}_peduncle`, `${src}_pons_cst`,
        `${s}_cn7_nuc`, `${s}_cn7`],
      lmnFrom: `${s}_cn7_nuc`, bodyRegion: `${s}_face_upper`,
      testMethod: 'Ask to raise eyebrows, close eyes tightly' });
  }

  path({ id: `cn8_hear_${s}`, name: `CN VIII hearing ${s}`, modality: 'hearing',
    nodes: [`${s}_cn8`, `${s}_cn8_coch`], bodyRegion: `${s}_ear`,
    testMethod: 'Whisper test, Rinne/Weber tuning fork' });
  path({ id: `cn8_vest_${s}`, name: `CN VIII vestibular ${s}`, modality: 'vestibular',
    nodes: [`${s}_cn8`, `${s}_cn8_vest`], bodyRegion: `${s}_vestibular`,
    testMethod: 'Head impulse test, Dix-Hallpike, nystagmus check' });

  path({ id: `cn9_${s}`, name: `CN IX ${s} (glossopharyngeal)`, modality: 'cranial_motor',
    nodes: [`${s}_cn9_nuc`, `${s}_cn9`], lmnFrom: `${s}_cn9_nuc`, bodyRegion: `${s}_pharynx`,
    testMethod: 'Test gag reflex, say "aah" — uvula deviates away from lesion' });
  path({ id: `cn10_${s}`, name: `CN X ${s} (vagus)`, modality: 'cranial_motor',
    nodes: [`${s}_cn10_nuc`, `${s}_cn10`], lmnFrom: `${s}_cn10_nuc`, bodyRegion: `${s}_palate_vocal`,
    testMethod: 'Check palate elevation, voice hoarseness' });
  path({ id: `cn11_${s}`, name: `CN XI ${s} (accessory)`, modality: 'cranial_motor',
    nodes: [`${s}_cn11_nuc`, `${s}_cn11`], lmnFrom: `${s}_cn11_nuc`, bodyRegion: `${s}_trapezius_scm`,
    testMethod: 'Shrug shoulders against resistance, turn head against resistance' });
  path({ id: `cn12_${other(s)}_to_${s}`, name: `${other(s)} cortex → ${s} tongue (CN XII)`,
    modality: 'cranial_motor',
    nodes: [`${other(s)}_mcx_face`, `${other(s)}_ic`, `${other(s)}_peduncle`, `${other(s)}_med_pyr`,
      `${s}_cn12_nuc`, `${s}_cn12`],
    lmnFrom: `${s}_cn12_nuc`, bodyRegion: `${s}_tongue`,
    testMethod: 'Protrude tongue — deviates TOWARD LMN lesion, AWAY from UMN lesion' });
}

/* ---------------------------------------------------- ascending sensory ---- */
for (const s of SIDES) {
  for (const seg of DERMATOMES) {
    path({ id: `stt_${s}_${seg}`, name: `${s} ${seg} pain/temp → ${other(s)} cortex`,
      modality: 'pain_temp',
      nodes: [`${s}_drg_${seg}`, `${s}_stt_cross_${seg}`, `${other(s)}_stt_asc`,
        `${other(s)}_thal`, `${other(s)}_scx`],
      bodyRegion: `${s}_dermatome_${seg}`, testMethod: `Test pinprick at ${seg} dermatome` });

    path({ id: `dc_${s}_${seg}`, name: `${s} ${seg} proprioception → ${other(s)} cortex`,
      modality: 'proprioception',
      nodes: [`${s}_drg_${seg}`, `${s}_dc_asc`, `${s}_dc_nuc`, 'ml_decuss',
        `${other(s)}_ml`, `${other(s)}_thal`, `${other(s)}_scx`],
      bodyRegion: `${s}_dermatome_${seg}`,
      testMethod: `Test vibration (tuning fork) and joint position sense at ${seg} level` });
  }
}

/* ------------------------------------------------------------- vision ------ */
const VF = 'Visual field testing by confrontation';
path({ id: 'vis_L_temp', name: 'L temporal retina → L cortex (R nasal field)', modality: 'vision',
  nodes: ['L_retina_temp', 'L_cn2', 'L_optic_tract', 'L_lgn', 'L_optic_rad', 'L_vis_cx'],
  bodyRegion: 'R_nasal_field', testMethod: VF });
path({ id: 'vis_L_nas', name: 'L nasal retina → R cortex (L temporal field)', modality: 'vision',
  nodes: ['L_retina_nas', 'L_cn2', 'chiasm', 'R_optic_tract', 'R_lgn', 'R_optic_rad', 'R_vis_cx'],
  bodyRegion: 'L_temporal_field', testMethod: VF });
path({ id: 'vis_R_temp', name: 'R temporal retina → R cortex (L nasal field)', modality: 'vision',
  nodes: ['R_retina_temp', 'R_cn2', 'R_optic_tract', 'R_lgn', 'R_optic_rad', 'R_vis_cx'],
  bodyRegion: 'L_nasal_field', testMethod: VF });
path({ id: 'vis_R_nas', name: 'R nasal retina → L cortex (R temporal field)', modality: 'vision',
  nodes: ['R_retina_nas', 'R_cn2', 'chiasm', 'L_optic_tract', 'L_lgn', 'L_optic_rad', 'L_vis_cx'],
  bodyRegion: 'R_temporal_field', testMethod: VF });

/* ------------------------------------------------------ pupillary reflex --- */
for (const s of SIDES) {
  for (const t of SIDES) {
    path({ id: `pupil_aff_${s}_to_${t}`, name: `Pupil afferent ${s} eye → ${t} EW`,
      modality: 'pupil_afferent',
      /* Either eye can drive either Edinger-Westphal nucleus — hence the
         consensual response, and hence "relative" afferent defects. */
      parallel: true,
      nodes: [`${s}_cn2`, `${t}_pretectal`, `${t}_ew`],
      bodyRegion: `${t}_pupil_constrict`,
      testMethod: 'Shine light in eye — check both direct and consensual response' });
  }
  path({ id: `pupil_eff_${s}`, name: `Pupil efferent ${s} (CN III → pupil)`,
    modality: 'pupil_efferent',
    nodes: [`${s}_ew`, `${s}_cn3_nuc`, `${s}_cn3`, `${s}_ciliary`, `${s}_pupil`],
    bodyRegion: `${s}_pupil_constrict`, testMethod: 'Check pupil size and reactivity' });
  path({ id: `horner_${s}`, name: `Sympathetic ${s} (Horner's pathway)`, modality: 'sympathetic',
    nodes: [`${s}_hypothal`, `${s}_lat_bs`, `${s}_cilio_C`, `${s}_scg`, `${s}_pupil_dil`],
    bodyRegion: `${s}_horner`,
    testMethod: "Check for miosis, ptosis, anhidrosis (Horner's triad)" });
}

/* --------------------------------------------------------- cerebellar ----- */
for (const s of SIDES) {
  path({ id: `cpc_${s}`, name: `${s} cortex → ${s} pons → ${other(s)} cerebellum`,
    modality: 'cerebellar', nodes: [`${s}_ic`, `${s}_mcp`, `${other(s)}_cerebellum`],
    bodyRegion: `${other(s)}_coordination`,
    testMethod: 'Finger-to-nose test, rapid alternating movements' });
  path({ id: `dtc_${s}`, name: `${s} cerebellum → ${other(s)} thalamus → ${other(s)} cortex`,
    modality: 'cerebellar',
    nodes: [`${s}_dentate`, `${s}_scp`, 'scp_decuss', `${other(s)}_red_nuc`, `${other(s)}_thal`],
    bodyRegion: `${s}_coordination`,
    testMethod: 'Intention tremor, dysmetria, dysdiadochokinesia' });
}
path({ id: 'vermis_gait', name: 'Vermis → gait/truncal coordination', modality: 'cerebellar',
  nodes: ['vermis'], bodyRegion: 'gait_balance', testMethod: 'Tandem gait, Romberg test' });

/* ----------------------------------------------------------- language ----- */
path({ id: 'broca', name: 'Broca area (speech production)', modality: 'language',
  nodes: ['L_broca'], bodyRegion: 'speech_production',
  testMethod: 'Assess fluency, naming, repetition — Broca: non-fluent, preserved comprehension' });
path({ id: 'wernicke', name: 'Wernicke area (speech comprehension)', modality: 'language',
  nodes: ['L_wernicke'], bodyRegion: 'speech_comprehension',
  testMethod: 'Test comprehension — Wernicke: fluent but nonsensical, impaired comprehension' });
path({ id: 'arcuate', name: 'Arcuate fasciculus (repetition)', modality: 'language',
  nodes: ['L_broca', 'L_arcuate', 'L_wernicke'], bodyRegion: 'speech_repetition',
  testMethod: 'Test repetition — conduction aphasia: fluent, good comprehension, poor repetition' });

/* ---------------------------------------------------------- autonomic ----- */
for (const s of SIDES) {
  path({ id: `bladder_${s}`, name: `Pontine mic center → ${s} bladder`, modality: 'autonomic',
    nodes: ['pontine_mic', `${s}_sacral_para`, 'bladder'], bodyRegion: 'bladder',
    testMethod: 'Ask about urinary retention/incontinence' });
  for (const seg of ['S2', 'S3', 'S4']) {
    path({ id: `saddle_${s}_${seg}`, name: `${s} ${seg} perineal sensation`, modality: 'pain_temp',
      nodes: [`${s}_drg_${seg}`, `${s}_stt_cross_S1`, `${other(s)}_stt_asc`,
        `${other(s)}_thal`, `${other(s)}_scx`],
      bodyRegion: `${s}_saddle_${seg}`, testMethod: 'Test perianal sensation (pin prick)' });
  }
}

/* ------------------------------------------------------------- reflexes ---- */
for (const s of SIDES) {
  for (const [seg, name] of [['C5','biceps jerk'],['C6','brachioradialis'],['C7','triceps jerk'],
    ['L3','patellar reflex'],['S1','Achilles reflex']]) {
    path({ id: `dtr_${s}_${seg}`, name: `${s} ${name} (${seg})`, modality: 'reflex',
      nodes: [`${s}_drg_${seg}`, `${s}_ahn_${seg}`, `${s}_nerve_${seg}`],
      lmnFrom: `${s}_drg_${seg}`, bodyRegion: `${s}_reflex_${seg}`,
      testMethod: `Test ${name} — absent=LMN, brisk=UMN` });
  }
}

/* ========================================================================== */

/* Rostro-caudal depth, used to lay the graph out the way a neuroanatomy
   textbook draws it: cortex at the top, peripheral nerve at the bottom. */
export const LEVEL_DEPTH = {
  cortex: 0.04, parietal: 0.08, eye: 0.10, hypothalamus: 0.10, ic: 0.12,
  thalamus: 0.14, orbit: 0.15, chiasm: 0.18, midbrain: 0.22, cerebellum: 0.30,
  pons: 0.32, brainstem: 0.35, medulla: 0.42,
  cord_C: 0.55, cord_T: 0.65, cord_L: 0.75, cord_S: 0.82, peripheral: 0.92,
};

export const LEVEL_ORDER = ['cortex','ic','thalamus','hypothalamus','midbrain','pons','medulla',
  'brainstem','chiasm','cerebellum','orbit','eye','parietal','cord_C','cord_T','cord_L','cord_S','peripheral'];

export const LEVEL_LABEL = {
  cortex: 'Cortex', ic: 'Internal capsule', thalamus: 'Thalamus', hypothalamus: 'Hypothalamus',
  midbrain: 'Midbrain', pons: 'Pons', medulla: 'Medulla', brainstem: 'Brainstem',
  chiasm: 'Chiasm', cerebellum: 'Cerebellum', orbit: 'Orbit', eye: 'Eye', parietal: 'Parietal',
  cord_C: 'Cervical cord', cord_T: 'Thoracic cord', cord_L: 'Lumbar cord', cord_S: 'Sacral cord',
  peripheral: 'Peripheral',
};

export const MODALITY_GROUP = {
  motor: 'motor', cranial_motor: 'cranial', reflex: 'motor',
  pain_temp: 'sensory', proprioception: 'sensory', face_sensation: 'sensory',
  vision: 'visual', pupil_afferent: 'visual', pupil_efferent: 'visual',
  cerebellar: 'cerebellar', sympathetic: 'autonomic', autonomic: 'autonomic',
  language: 'language', hearing: 'sensory', vestibular: 'sensory',
};

export const MODALITY_LABEL = {
  motor: 'Motor', cranial_motor: 'Cranial motor', reflex: 'Reflex',
  pain_temp: 'Pain / temperature', proprioception: 'Proprioception',
  face_sensation: 'Facial sensation', vision: 'Vision',
  pupil_afferent: 'Pupil (afferent)', pupil_efferent: 'Pupil (efferent)',
  sympathetic: 'Sympathetic', cerebellar: 'Cerebellar', language: 'Language',
  autonomic: 'Autonomic', hearing: 'Hearing', vestibular: 'Vestibular',
};

/* Lesion sites, ordered the way a clinician thinks: top down. */
export const SITES = Object.values(NODES).sort((a, b) =>
  LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.id.localeCompare(b.id));

/* ===========================================================================
   THE PERIPHERAL EXTENSION

   Everything above stops at the spinal nerve, which is where most teaching
   models stop and where clinical neurology is only half done. The ladder a
   clinician actually descends is

     cortex → subcortical → brainstem → cord → ROOT → PLEXUS → NERVE → NMJ → MUSCLE

   and the bottom four rungs have their own patterns. A root lesion follows a
   dermatome and myotome and kills one reflex. A plexus lesion crosses several
   nerves but stays in one limb. A single nerve lesion respects that nerve's
   territory and nobody else's. A neuromuscular junction lesion has no sensory
   signs at all and fatigues. A muscle lesion is proximal, symmetric, and leaves
   the reflexes alone until very late.

   Those distinctions are what the next section makes derivable.
=========================================================================== */

const periph = (id, name, level, side) => node(id, name, level, side);

for (const s of SIDES) {
  // --- brachial plexus ---------------------------------------------------
  periph(`${s}_bp_upper`, `${s} upper trunk (C5-6)`, 'plexus', s);
  periph(`${s}_bp_middle`, `${s} middle trunk (C7)`, 'plexus', s);
  periph(`${s}_bp_lower`, `${s} lower trunk (C8-T1)`, 'plexus', s);
  periph(`${s}_bp_lat`, `${s} lateral cord`, 'plexus', s);
  periph(`${s}_bp_post`, `${s} posterior cord`, 'plexus', s);
  periph(`${s}_bp_med`, `${s} medial cord`, 'plexus', s);

  // --- lumbosacral plexus ------------------------------------------------
  periph(`${s}_lp_lumbar`, `${s} lumbar plexus (L2-4)`, 'plexus', s);
  periph(`${s}_lp_sacral`, `${s} sacral plexus (L4-S3)`, 'plexus', s);

  // --- named peripheral nerves -------------------------------------------
  for (const [id, nm] of [
    ['musculocut', 'musculocutaneous nerve'], ['axillary', 'axillary nerve'],
    ['radial', 'radial nerve'], ['pin', 'posterior interosseous nerve'],
    ['median', 'median nerve'], ['ain', 'anterior interosseous nerve'],
    ['median_carpal', 'median nerve at the carpal tunnel'],
    ['ulnar', 'ulnar nerve'], ['ulnar_elbow', 'ulnar nerve at the elbow'],
    ['femoral', 'femoral nerve'], ['obturator', 'obturator nerve'],
    ['sciatic', 'sciatic nerve'], ['tibial', 'tibial nerve'],
    ['peroneal', 'common peroneal nerve'], ['peroneal_head', 'common peroneal nerve at the fibular head'],
    ['sup_gluteal', 'superior gluteal nerve'],
  ]) periph(`${s}_n_${id}`, `${s} ${nm}`, 'nerve', s);

  // --- neuromuscular junction --------------------------------------------
  periph(`${s}_nmj_pre`, `${s} presynaptic terminal (Ca²⁺ channels)`, 'nmj', s);
  periph(`${s}_nmj_post`, `${s} postsynaptic membrane (ACh receptors)`, 'nmj', s);

  // --- muscle -------------------------------------------------------------
  periph(`${s}_muscle_prox`, `${s} proximal limb muscle`, 'muscle', s);
  periph(`${s}_muscle_dist`, `${s} distal limb muscle`, 'muscle', s);
  periph(`${s}_muscle_bulbar`, `${s} bulbar muscle`, 'muscle', s);
  periph(`${s}_muscle_ocular`, `${s} extraocular muscle`, 'muscle', s);
}

/* Each entry: muscle, the roots that supply it, trunk, cord, nerve chain,
   whether it is proximal or distal, the reflex it subserves, and the bedside
   test. Written once; the pathways, the exam and the syndromes all read it. */
export const MOTOR_UNITS = [
  // --- arm -----------------------------------------------------------------
  { m: 'deltoid', roots: ['C5', 'C6'], trunk: 'bp_upper', cord: 'bp_post', nerves: ['n_axillary'],
    limb: 'arm', bulk: 'prox', test: 'Shoulder abduction against resistance' },
  { m: 'biceps', roots: ['C5', 'C6'], trunk: 'bp_upper', cord: 'bp_lat', nerves: ['n_musculocut'],
    limb: 'arm', bulk: 'prox', reflex: 'C5', test: 'Elbow flexion, forearm supinated' },
  { m: 'brachioradialis', roots: ['C5', 'C6'], trunk: 'bp_upper', cord: 'bp_post', nerves: ['n_radial'],
    limb: 'arm', bulk: 'prox', reflex: 'C6', test: 'Elbow flexion, thumb up' },
  { m: 'triceps', roots: ['C7', 'C8'], trunk: 'bp_middle', cord: 'bp_post', nerves: ['n_radial'],
    limb: 'arm', bulk: 'prox', reflex: 'C7', test: 'Elbow extension against resistance' },
  { m: 'wrist extensors', roots: ['C6', 'C7'], trunk: 'bp_middle', cord: 'bp_post', nerves: ['n_radial', 'n_pin'],
    limb: 'arm', bulk: 'dist', test: 'Wrist and finger extension — look for wrist drop' },
  { m: 'flexor pollicis longus', roots: ['C8', 'T1'], trunk: 'bp_lower', cord: 'bp_med', nerves: ['n_median', 'n_ain'],
    limb: 'arm', bulk: 'dist', test: 'Make an OK sign — a flat pinch means anterior interosseous' },
  { m: 'abductor pollicis brevis', roots: ['C8', 'T1'], trunk: 'bp_lower', cord: 'bp_med',
    nerves: ['n_median', 'n_median_carpal'],
    limb: 'arm', bulk: 'dist', test: 'Thumb abduction perpendicular to the palm' },
  { m: 'first dorsal interosseous', roots: ['C8', 'T1'], trunk: 'bp_lower', cord: 'bp_med',
    nerves: ['n_ulnar', 'n_ulnar_elbow'],
    limb: 'arm', bulk: 'dist', test: 'Index finger abduction; look for guttering between the metacarpals' },
  // --- leg -----------------------------------------------------------------
  { m: 'iliopsoas', roots: ['L2', 'L3'], trunk: 'lp_lumbar', cord: 'lp_lumbar', nerves: ['n_femoral'],
    limb: 'leg', bulk: 'prox', test: 'Hip flexion against resistance, seated' },
  { m: 'quadriceps', roots: ['L3', 'L4'], trunk: 'lp_lumbar', cord: 'lp_lumbar', nerves: ['n_femoral'],
    limb: 'leg', bulk: 'prox', reflex: 'L3', test: 'Knee extension against resistance' },
  { m: 'hip adductors', roots: ['L2', 'L3', 'L4'], trunk: 'lp_lumbar', cord: 'lp_lumbar', nerves: ['n_obturator'],
    limb: 'leg', bulk: 'prox', test: 'Squeeze the knees together against resistance' },
  { m: 'gluteus medius', roots: ['L5', 'S1'], trunk: 'lp_sacral', cord: 'lp_sacral', nerves: ['n_sup_gluteal'],
    limb: 'leg', bulk: 'prox', test: 'Hip abduction; Trendelenburg test on standing' },
  { m: 'tibialis anterior', roots: ['L4', 'L5'], trunk: 'lp_sacral', cord: 'lp_sacral',
    nerves: ['n_sciatic', 'n_peroneal', 'n_peroneal_head'],
    limb: 'leg', bulk: 'dist', test: 'Ankle dorsiflexion — look for foot drop and a high-stepping gait' },
  { m: 'peroneus longus', roots: ['L5', 'S1'], trunk: 'lp_sacral', cord: 'lp_sacral',
    nerves: ['n_sciatic', 'n_peroneal', 'n_peroneal_head'],
    limb: 'leg', bulk: 'dist', test: 'Foot eversion against resistance' },
  { m: 'tibialis posterior', roots: ['L4', 'L5'], trunk: 'lp_sacral', cord: 'lp_sacral',
    nerves: ['n_sciatic', 'n_tibial'],
    limb: 'leg', bulk: 'dist', test: 'Foot inversion — spared in a peroneal palsy, weak in an L5 radiculopathy' },
  { m: 'gastrocnemius', roots: ['S1', 'S2'], trunk: 'lp_sacral', cord: 'lp_sacral',
    nerves: ['n_sciatic', 'n_tibial'],
    limb: 'leg', bulk: 'dist', reflex: 'S1', test: 'Ankle plantarflexion; ask the patient to toe-walk' },
];

/* Cutaneous territories, which is how a nerve lesion is separated from a root
   lesion at the bedside: they overlap but they are not the same shape. */
export const SENSORY_TERRITORIES = [
  { area: 'lateral forearm', nerves: ['n_musculocut'], roots: ['C6'], limb: 'arm' },
  { area: 'thumb and index, palmar', nerves: ['n_median', 'n_median_carpal'], roots: ['C6', 'C7'], limb: 'arm' },
  { area: 'little finger and medial hand', nerves: ['n_ulnar', 'n_ulnar_elbow'], roots: ['C8'], limb: 'arm' },
  { area: 'dorsal first web space', nerves: ['n_radial'], roots: ['C6'], limb: 'arm' },
  { area: 'shoulder badge patch', nerves: ['n_axillary'], roots: ['C5'], limb: 'arm' },
  { area: 'anterior thigh', nerves: ['n_femoral'], roots: ['L2', 'L3'], limb: 'leg' },
  { area: 'medial thigh', nerves: ['n_obturator'], roots: ['L3'], limb: 'leg' },
  { area: 'dorsum of foot', nerves: ['n_sciatic', 'n_peroneal', 'n_peroneal_head'], roots: ['L5'], limb: 'leg' },
  { area: 'sole of foot', nerves: ['n_sciatic', 'n_tibial'], roots: ['S1'], limb: 'leg' },
];

/* --- pathways: the final common path, one per muscle --------------------- */
for (const s of SIDES) {
  for (const u of MOTOR_UNITS) {
    const chain = [
      ...u.roots.map((r) => `${s}_ahn_${r}`).filter((id) => NODES[id]),
      `${s}_${u.trunk}`,
      ...(u.cord !== u.trunk ? [`${s}_${u.cord}`] : []),
      ...u.nerves.map((n) => `${s}_${n}`),
      `${s}_nmj_pre`, `${s}_nmj_post`,
      `${s}_muscle_${u.bulk}`,
    ].filter((id) => NODES[id]);

    path({
      id: `mu_${s}_${u.m.replace(/\s+/g, '_')}`,
      name: `${s} ${u.m}`,
      modality: 'peripheral_motor',
      nodes: chain,
      lmnFrom: chain[0],
      bodyRegion: `${s}_muscle_${u.m.replace(/\s+/g, '_')}`,
      testMethod: u.test,
      meta: { roots: u.roots, nerves: u.nerves, limb: u.limb, bulk: u.bulk, reflex: u.reflex },
    });
  }

  for (const t of SENSORY_TERRITORIES) {
    path({
      id: `cut_${s}_${t.area.replace(/\s+/g, '_')}`,
      name: `${s} ${t.area}`,
      modality: 'cutaneous',
      nodes: [
        ...t.roots.map((r) => `${s}_drg_${r}`).filter((id) => NODES[id]),
        ...t.nerves.map((n) => `${s}_${n}`),
      ].filter((id) => NODES[id]),
      bodyRegion: `${s}_skin_${t.area.replace(/\s+/g, '_')}`,
      testMethod: `Light touch and pinprick over the ${t.area}`,
      meta: { roots: t.roots, nerves: t.nerves, limb: t.limb },
    });
  }

  /* Ocular and bulbar muscle, which is where neuromuscular junction disease
     announces itself and where myopathy usually does not. */
  for (const [grp, nm, test] of [
    ['ocular', 'extraocular muscles', 'Sustained upgaze for 60 seconds — look for progressive ptosis'],
    ['bulbar', 'bulbar muscles', 'Count aloud to 50 — listen for the voice becoming nasal and quiet'],
  ]) {
    path({
      id: `nmj_${s}_${grp}`,
      name: `${s} ${nm}`,
      modality: 'peripheral_motor',
      nodes: [`${s}_nmj_pre`, `${s}_nmj_post`, `${s}_muscle_${grp}`],
      lmnFrom: `${s}_nmj_pre`,
      bodyRegion: `${s}_muscle_${grp}`,
      testMethod: test,
      meta: { bulk: grp },
    });
  }
}

/* Register the new levels with the layout and labelling tables. */
Object.assign(LEVEL_DEPTH, { plexus: 0.86, nerve: 0.93, nmj: 0.97, muscle: 1.0 });
LEVEL_ORDER.push('plexus', 'nerve', 'nmj', 'muscle');
Object.assign(LEVEL_LABEL, {
  plexus: 'Plexus', nerve: 'Peripheral nerve', nmj: 'Neuromuscular junction', muscle: 'Muscle',
});
Object.assign(MODALITY_GROUP, { peripheral_motor: 'motor', cutaneous: 'sensory' });
Object.assign(MODALITY_LABEL, { peripheral_motor: 'Motor (peripheral)', cutaneous: 'Cutaneous sensation' });

/* SITES was computed before the peripheral nodes existed. */
SITES.length = 0;
SITES.push(...Object.values(NODES).sort((a, b) =>
  LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || a.id.localeCompare(b.id)));
