/* ---------------------------------------------------------------------------
   The examination.

   Regions of a body drawn from the front — so the patient's left is on your
   right, exactly as it is when you stand at the bedside.

   Each test knows two things: how to recognise a finding that it would pick up,
   and what the result sounds like when it is normal. The second half matters as
   much as the first. A student who has never been told what normal sounds like
   cannot tell you when something is abnormal.
--------------------------------------------------------------------------- */

const ARM_SEGS = ['C5', 'C6', 'C7', 'C8', 'T1'];
const LEG_SEGS = ['L2', 'L3', 'L4', 'L5', 'S1'];
const ARM_REFLEX = [['C5', 'Biceps jerk'], ['C6', 'Brachioradialis'], ['C7', 'Triceps jerk']];
const LEG_REFLEX = [['L3', 'Patellar reflex'], ['S1', 'Achilles reflex']];

const test = (id, label, match, normal, hint) => ({ id, label, match, normal, hint });

/* Peripheral tests. These are the ones that separate the bottom four rungs of
   the ladder, and each is chosen because it dissociates two things that a
   coarser test lumps together. */
const muscle = (side, name) => (f) => f.bodyRegion === `${side}_muscle_${name.replace(/\s+/g, '_')}`;
const skin = (side, area) => (f) => f.bodyRegion === `${side}_skin_${area.replace(/\s+/g, '_')}`;

function peripheralArmTests(side) {
  return [
    test(`pm_${side}_deltoid`, 'Deltoid (C5, axillary)', muscle(side, 'deltoid'),
      'Shoulder abduction 5/5.', 'Proximal. Weak early in myopathy and in upper trunk lesions.'),
    test(`pm_${side}_biceps`, 'Biceps (C5-6, musculocutaneous)', muscle(side, 'biceps'),
      'Elbow flexion 5/5.', null),
    test(`pm_${side}_triceps`, 'Triceps (C7, radial)', muscle(side, 'triceps'),
      'Elbow extension 5/5.', null),
    test(`pm_${side}_wristext`, 'Wrist/finger extension (C7, radial)', muscle(side, 'wrist extensors'),
      'No wrist drop; full finger extension.', 'Wrist drop with normal triceps localises the radial nerve below the spiral groove.'),
    test(`pm_${side}_apb`, 'Thumb abduction (C8-T1, median)', muscle(side, 'abductor pollicis brevis'),
      'Thumb abduction 5/5, thenar bulk normal.',
      'Median. Compare with the first dorsal interosseous — same roots, different nerve.'),
    test(`pm_${side}_fdi`, 'Finger abduction (C8-T1, ulnar)', muscle(side, 'first dorsal interosseous'),
      'Finger abduction 5/5, no guttering.',
      'Ulnar. Weak here with a normal thumb means the nerve, not the root.'),
    test(`sn_${side}_median`, 'Sensation — thumb and index', skin(side, 'thumb and index, palmar'),
      'Light touch and pinprick intact.', null),
    test(`sn_${side}_ulnar`, 'Sensation — little finger', skin(side, 'little finger and medial hand'),
      'Light touch and pinprick intact.', null),
    test(`sn_${side}_radial`, 'Sensation — dorsal first web', skin(side, 'dorsal first web space'),
      'Light touch and pinprick intact.', null),
  ];
}

function peripheralLegTests(side) {
  return [
    test(`pm_${side}_ilio`, 'Hip flexion (L2-3, femoral)', muscle(side, 'iliopsoas'),
      'Hip flexion 5/5.', 'Proximal. Weak early in myopathy.'),
    test(`pm_${side}_quads`, 'Knee extension (L3-4, femoral)', muscle(side, 'quadriceps'),
      'Knee extension 5/5.', null),
    test(`pm_${side}_glut`, 'Hip abduction (L5-S1, superior gluteal)', muscle(side, 'gluteus medius'),
      'Hip abduction 5/5, Trendelenburg negative.', null),
    test(`pm_${side}_ta`, 'Ankle dorsiflexion (L4-5, peroneal)', muscle(side, 'tibialis anterior'),
      'Dorsiflexion 5/5, no foot drop.', null),
    test(`pm_${side}_evert`, 'Foot eversion (L5-S1, peroneal)', muscle(side, 'peroneus longus'),
      'Eversion 5/5.', null),
    test(`pm_${side}_invert`, 'Foot inversion (L4-5, tibial)', muscle(side, 'tibialis posterior'),
      'Inversion 5/5.',
      'The discriminating test in foot drop: shares L5 with dorsiflexion but runs in the tibial '
      + 'nerve. Weak means the root; strong means the peroneal nerve.'),
    test(`pm_${side}_gastroc`, 'Ankle plantarflexion (S1-2, tibial)', muscle(side, 'gastrocnemius'),
      'Plantarflexion 5/5, can toe-walk.', null),
    test(`sn_${side}_dorsum`, 'Sensation — dorsum of foot', skin(side, 'dorsum of foot'),
      'Light touch and pinprick intact.', null),
    test(`sn_${side}_sole`, 'Sensation — sole', skin(side, 'sole of foot'),
      'Light touch and pinprick intact.', null),
  ];
}

const fatigueTests = (side) => [
  test(`fat_${side}_ocular`, 'Sustained upgaze (fatigability)', muscle(side, 'ocular'),
    'No ptosis after 60 seconds of upgaze. No diplopia.',
    'The single most useful bedside test for the neuromuscular junction. Weakness that appears '
    + 'only after sustained effort is junctional until proven otherwise.'),
  test(`fat_${side}_bulbar`, 'Count to 50 (bulbar fatigue)', muscle(side, 'bulbar'),
    'Voice stays clear and strong to 50.',
    'A voice that becomes nasal and fades is bulbar fatigue — and a warning about the airway.'),
];

/* --- reusable matchers ---------------------------------------------------- */
const power = (side, limb) => (f) =>
  f.modality === 'motor' && new RegExp(`^${side}_${limb}_`).test(f.bodyRegion);

const derm = (side, modality, segs) => (f) =>
  f.modality === modality && segs.some((s) => f.bodyRegion === `${side}_dermatome_${s}`);

const reflexAt = (side, seg) => (f) => f.bodyRegion === `${side}_reflex_${seg}`;

const region = (side, name) => (f) => f.bodyRegion === `${side}_${name}`;

function limbTests(side, limb) {
  const segs = limb === 'arm' ? ARM_SEGS : LEG_SEGS;
  const reflexes = limb === 'arm' ? ARM_REFLEX : LEG_REFLEX;
  const coordLabel = limb === 'arm' ? 'Finger-to-nose' : 'Heel-to-shin';
  return [
    test(`power_${side}_${limb}`, 'Power (MRC 0–5)', power(side, limb),
      'Power 5/5 throughout. Tone normal. No wasting or fasciculation.',
      'Test each myotome against resistance — deltoid, biceps, triceps, grip for the arm.'),
    test(`pin_${side}_${limb}`, 'Pinprick & temperature', derm(side, 'pain_temp', segs),
      'Pinprick sharp and symmetrical in every dermatome tested.',
      'Spinothalamic. Compare side to side, and work up from distal to proximal.'),
    test(`vib_${side}_${limb}`, 'Vibration & joint position', derm(side, 'proprioception', segs),
      'Vibration felt at 128 Hz distally. Joint position sense accurate at the toes/fingers.',
      'Dorsal column. Romberg becomes positive when this is lost bilaterally.'),
    ...reflexes.map(([seg, name]) =>
      test(`dtr_${side}_${seg}`, `${name} (${seg})`, reflexAt(side, seg),
        'Reflex 2+ and symmetrical.',
        'Absent points at the arc — root, nerve or anterior horn. Brisk points above it.')),
    test(`coord_${side}_${limb}`, `${coordLabel}`, region(side, 'coordination'),
      'Smooth and accurate. No dysmetria, no intention tremor.',
      'Cerebellar hemispheres act on the same side as the limb they control.'),
  ];
}

export const BODY_REGIONS = [
  {
    id: 'R_eye', label: 'Right eye', side: 'R', x: 0.4, y: 0.062, w: 0.078, h: 0.034,
    tests: [
      test('vf_R', 'Visual fields', (f) => f.modality === 'vision' && /^R_/.test(f.bodyRegion),
        'Fields full to confrontation in all four quadrants.',
        'Test each eye separately. A defect respecting the vertical meridian is chiasmal or behind it.'),
      test('pupil_R', 'Pupil reaction', (f) =>
        (f.modality === 'pupil_efferent' || f.modality === 'pupil_afferent') && f.bodyRegion === 'R_pupil_constrict',
        'Pupil 3 mm, briskly reactive directly and consensually. No RAPD.',
        'Swinging flashlight test separates an afferent defect from an efferent one.'),
      test('move_R', 'Eye movements & lid', (f) =>
        ['R_eye_movement', 'R_eye_abduction', 'R_eye_downgaze'].includes(f.bodyRegion),
        'Full range in all directions. No ptosis, no diplopia, no nystagmus.',
        'III, IV and VI. Ptosis with a big pupil is III; ptosis with a small pupil is Horner.'),
      test('horner_R', "Horner's signs", region('R', 'horner'),
        'No ptosis, no miosis, no anhidrosis. Palpebral fissures equal.',
        'The oculosympathetic chain is long — hypothalamus to cord to carotid to orbit.'),
    ],
  },
  {
    id: 'L_eye', label: 'Left eye', side: 'L', x: 0.522, y: 0.062, w: 0.078, h: 0.034,
    tests: [
      test('vf_L', 'Visual fields', (f) => f.modality === 'vision' && /^L_/.test(f.bodyRegion),
        'Fields full to confrontation in all four quadrants.',
        'Test each eye separately. A defect respecting the vertical meridian is chiasmal or behind it.'),
      test('pupil_L', 'Pupil reaction', (f) =>
        (f.modality === 'pupil_efferent' || f.modality === 'pupil_afferent') && f.bodyRegion === 'L_pupil_constrict',
        'Pupil 3 mm, briskly reactive directly and consensually. No RAPD.',
        'Swinging flashlight test separates an afferent defect from an efferent one.'),
      test('move_L', 'Eye movements & lid', (f) =>
        ['L_eye_movement', 'L_eye_abduction', 'L_eye_downgaze'].includes(f.bodyRegion),
        'Full range in all directions. No ptosis, no diplopia, no nystagmus.',
        'III, IV and VI. Ptosis with a big pupil is III; ptosis with a small pupil is Horner.'),
      test('horner_L', "Horner's signs", region('L', 'horner'),
        'No ptosis, no miosis, no anhidrosis. Palpebral fissures equal.',
        'The oculosympathetic chain is long — hypothalamus to cord to carotid to orbit.'),
    ],
  },
  {
    id: 'R_ear', label: 'Right ear', side: 'R', x: 0.33, y: 0.078, w: 0.062, h: 0.04,
    tests: [
      test('hear_R', 'Hearing — whisper, Weber, Rinne', region('R', 'ear'),
        'Whispered voice heard at 60 cm. Weber central, Rinne air > bone.',
        'Weber lateralises away from a sensorineural loss and toward a conductive one.'),
      test('vest_R', 'Vestibular — head impulse, nystagmus', region('R', 'vestibular'),
        'No nystagmus. Head impulse test normal. Steady with eyes closed.',
        'A corrective saccade on head impulse points to a peripheral vestibular lesion.'),
    ],
  },
  {
    id: 'L_ear', label: 'Left ear', side: 'L', x: 0.608, y: 0.078, w: 0.062, h: 0.04,
    tests: [
      test('hear_L', 'Hearing — whisper, Weber, Rinne', region('L', 'ear'),
        'Whispered voice heard at 60 cm. Weber central, Rinne air > bone.',
        'Weber lateralises away from a sensorineural loss and toward a conductive one.'),
      test('vest_L', 'Vestibular — head impulse, nystagmus', region('L', 'vestibular'),
        'No nystagmus. Head impulse test normal. Steady with eyes closed.',
        'A corrective saccade on head impulse points to a peripheral vestibular lesion.'),
    ],
  },
  {
    id: 'R_face', label: 'Right face', side: 'R', x: 0.378, y: 0.104, w: 0.118, h: 0.052,
    tests: [
      test('facemove_R', 'Facial movement — brows, eye closure, teeth',
        (f) => f.modality === 'cranial_motor' && /^R_face/.test(f.bodyRegion),
        'Brows raise symmetrically, eyes close fully, smile symmetrical.',
        'Ask for the forehead first. It is the only reliable UMN/LMN discriminator.'),
      ...fatigueTests('R'),
      test('sensV1_R', 'Sensation — forehead (V1)', region('R', 'face_V1_forehead'),
        'Light touch and pinprick intact. Corneal reflex present.', null),
      test('sensV2_R', 'Sensation — cheek (V2)', region('R', 'face_V2_cheek'),
        'Light touch and pinprick intact.', null),
      test('sensV3_R', 'Sensation — jaw (V3)', region('R', 'face_V3_jaw'),
        'Light touch and pinprick intact.', null),
      test('jaw_R', 'Jaw power', region('R', 'jaw'),
        'Jaw clenches strongly and opens in the midline.', null),
      test('tongue_R', 'Tongue protrusion', region('R', 'tongue'),
        'Tongue protrudes in the midline. No wasting or fasciculation.',
        'Deviates toward an LMN lesion and away from an UMN one.'),
    ],
  },
  {
    id: 'L_face', label: 'Left face', side: 'L', x: 0.504, y: 0.104, w: 0.118, h: 0.052,
    tests: [
      test('facemove_L', 'Facial movement — brows, eye closure, teeth',
        (f) => f.modality === 'cranial_motor' && /^L_face/.test(f.bodyRegion),
        'Brows raise symmetrically, eyes close fully, smile symmetrical.',
        'Ask for the forehead first. It is the only reliable UMN/LMN discriminator.'),
      ...fatigueTests('L'),
      test('sensV1_L', 'Sensation — forehead (V1)', region('L', 'face_V1_forehead'),
        'Light touch and pinprick intact. Corneal reflex present.', null),
      test('sensV2_L', 'Sensation — cheek (V2)', region('L', 'face_V2_cheek'),
        'Light touch and pinprick intact.', null),
      test('sensV3_L', 'Sensation — jaw (V3)', region('L', 'face_V3_jaw'),
        'Light touch and pinprick intact.', null),
      test('jaw_L', 'Jaw power', region('L', 'jaw'),
        'Jaw clenches strongly and opens in the midline.', null),
      test('tongue_L', 'Tongue protrusion', region('L', 'tongue'),
        'Tongue protrudes in the midline. No wasting or fasciculation.',
        'Deviates toward an LMN lesion and away from an UMN one.'),
    ],
  },
  {
    id: 'speech', label: 'Speech & language', side: 'B', x: 0.386, y: 0.164, w: 0.228, h: 0.03,
    tests: [
      test('fluency', 'Fluency', (f) => f.bodyRegion === 'speech_production',
        'Fluent, well-formed sentences with normal prosody.',
        'Non-fluent with preserved comprehension is Broca.'),
      test('comprehension', 'Comprehension', (f) => f.bodyRegion === 'speech_comprehension',
        'Follows three-stage commands without difficulty.',
        'Fluent but meaningless speech with poor comprehension is Wernicke.'),
      test('repetition', 'Repetition', (f) => f.bodyRegion === 'speech_repetition',
        'Repeats "no ifs, ands or buts" accurately.',
        'Isolated repetition failure with fluent speech is conduction aphasia.'),
    ],
  },
  {
    id: 'throat', label: 'Palate & pharynx', side: 'B', x: 0.41, y: 0.199, w: 0.18, h: 0.03,
    tests: [
      test('gag_R', 'Gag reflex, right (IX)', region('R', 'pharynx'),
        'Gag present and symmetrical.', null),
      test('gag_L', 'Gag reflex, left (IX)', region('L', 'pharynx'),
        'Gag present and symmetrical.', null),
      test('palate_R', 'Palate & voice, right (X)', region('R', 'palate_vocal'),
        'Palate elevates symmetrically. Voice clear.',
        'The uvula deviates away from the weak side.'),
      test('palate_L', 'Palate & voice, left (X)', region('L', 'palate_vocal'),
        'Palate elevates symmetrically. Voice clear.',
        'The uvula deviates away from the weak side.'),
      test('shrug_R', 'Shoulder shrug, right (XI)', region('R', 'trapezius_scm'),
        'Shrug and head turn full against resistance.', null),
      test('shrug_L', 'Shoulder shrug, left (XI)', region('L', 'trapezius_scm'),
        'Shrug and head turn full against resistance.', null),
    ],
  },
  { id: 'R_arm', label: 'Right arm', side: 'R', x: 0.15, y: 0.205, w: 0.17, h: 0.255,
    tests: [...limbTests('R', 'arm'), ...peripheralArmTests('R')] },
  { id: 'L_arm', label: 'Left arm', side: 'L', x: 0.68, y: 0.205, w: 0.17, h: 0.255,
    tests: [...limbTests('L', 'arm'), ...peripheralArmTests('L')] },
  {
    id: 'trunk', label: 'Trunk', side: 'B', x: 0.355, y: 0.205, w: 0.29, h: 0.262,
    tests: [
      test('pin_trunk_R', 'Pinprick — right T6/T10', derm('R', 'pain_temp', ['T6', 'T10']),
        'Pinprick sharp at both levels.',
        'A sensory level on the trunk is the single most useful sign of a cord lesion.'),
      test('pin_trunk_L', 'Pinprick — left T6/T10', derm('L', 'pain_temp', ['T6', 'T10']),
        'Pinprick sharp at both levels.',
        'A sensory level on the trunk is the single most useful sign of a cord lesion.'),
      test('vib_trunk_R', 'Vibration — right T6/T10', derm('R', 'proprioception', ['T6', 'T10']),
        'Vibration felt normally.', null),
      test('vib_trunk_L', 'Vibration — left T6/T10', derm('L', 'proprioception', ['T6', 'T10']),
        'Vibration felt normally.', null),
      test('bladder', 'Bladder function', (f) => f.bodyRegion === 'bladder',
        'Continent, empties completely, no urgency or retention.',
        'Sphincter involvement turns a back problem into an emergency.'),
    ],
  },
  { id: 'R_leg', label: 'Right leg', side: 'R', x: 0.352, y: 0.475, w: 0.14, h: 0.31,
    tests: [...limbTests('R', 'leg'), ...peripheralLegTests('R'),
      test('saddle_R', 'Saddle sensation, right',
        (f) => /^R_saddle_/.test(f.bodyRegion),
        'Perianal sensation intact.',
        'Saddle anaesthesia with sphincter change is cauda equina until excluded.')] },
  { id: 'L_leg', label: 'Left leg', side: 'L', x: 0.508, y: 0.475, w: 0.14, h: 0.31,
    tests: [...limbTests('L', 'leg'), ...peripheralLegTests('L'),
      test('saddle_L', 'Saddle sensation, left',
        (f) => /^L_saddle_/.test(f.bodyRegion),
        'Perianal sensation intact.',
        'Saddle anaesthesia with sphincter change is cauda equina until excluded.'),
      test('gait', 'Gait & Romberg', (f) => f.bodyRegion === 'gait_balance',
        'Normal stride and arm swing. Tandem gait steady. Romberg negative.',
        'Romberg separates sensory ataxia from cerebellar ataxia — cerebellar patients sway with eyes open too.')] },
];

/* Cases for blind mode. Each is a real lesion the model can place, plus the
   options the learner chooses between once they have finished examining. */
export const BLIND_CASES = [
  { id: 'wallenberg_L', lesion: { syndrome: 'wallenberg', side: 'L' },
    answer: 'Left lateral medulla',
    options: ['Left lateral medulla', 'Right lateral medulla', 'Left internal capsule', 'Left cerebellar hemisphere'] },
  { id: 'capsule_R', lesion: { nodes: ['R_ic'] },
    answer: 'Right internal capsule',
    options: ['Right internal capsule', 'Left internal capsule', 'Right medial medulla', 'Left cervical cord'] },
  { id: 'bells_L', lesion: { nodes: ['L_cn7'] },
    answer: 'Left facial nerve',
    options: ['Left facial nerve', 'Right motor cortex', 'Left facial nucleus with long tracts', 'Right internal capsule'] },
  { id: 'bs_R', lesion: { syndrome: 'brown-sequard', side: 'R' },
    answer: 'Right hemicord',
    options: ['Right hemicord', 'Left hemicord', 'Central cord', 'Anterior cord'] },
  { id: 'weber_R', lesion: { syndrome: 'weber', side: 'R' },
    answer: 'Right medial midbrain',
    options: ['Right medial midbrain', 'Left medial midbrain', 'Right cavernous sinus', 'Right internal capsule'] },
  { id: 'chiasm', lesion: { syndrome: 'chiasm', side: 'L' },
    answer: 'Optic chiasm',
    options: ['Optic chiasm', 'Left optic nerve', 'Right optic radiation', 'Both occipital lobes'] },
  { id: 'central', lesion: { syndrome: 'central-cord', side: 'L' },
    answer: 'Central cervical cord',
    options: ['Central cervical cord', 'Bilateral dorsal columns', 'Anterior cord', 'Peripheral neuropathy'] },
  { id: 'ulnar_L', lesion: { syndrome: 'ulnar-elbow', side: 'L' },
    answer: 'Left ulnar nerve at the elbow',
    options: ['Left ulnar nerve at the elbow', 'Left C8 root', 'Left lower brachial plexus', 'Left median nerve'] },
  { id: 'peroneal_R', lesion: { syndrome: 'peroneal-palsy', side: 'R' },
    answer: 'Right peroneal nerve at the fibular head',
    options: ['Right peroneal nerve at the fibular head', 'Right L5 root', 'Right sciatic nerve', 'Right anterior horn at L5'] },
  { id: 'mg', lesion: { syndrome: 'myasthenia', side: 'L' },
    answer: 'Neuromuscular junction',
    options: ['Neuromuscular junction', 'Muscle', 'Brainstem', 'Peripheral nerve'] },
  { id: 'myop', lesion: { syndrome: 'myopathy', side: 'L' },
    answer: 'Muscle',
    options: ['Muscle', 'Neuromuscular junction', 'Peripheral nerve', 'Anterior horn cell'] },
  { id: 'erb_R', lesion: { syndrome: 'upper-trunk', side: 'R' },
    answer: 'Right upper brachial plexus',
    options: ['Right upper brachial plexus', 'Right C5 root', 'Right axillary nerve', 'Right cervical cord'] },
  { id: 'dejerine_R', lesion: { syndrome: 'medial-medullary', side: 'R' },
    answer: 'Right medial medulla',
    options: ['Right medial medulla', 'Right lateral medulla', 'Left medial medulla', 'Right pontine base'] },
];
