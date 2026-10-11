import type { PropertyDef, ValueType } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   Observables: everything that can be perceived about the body.

   Each property has a typed, structured value (never a sentence), an
   age-appropriate normal, the context dimensions that can change it, and
   where its value comes from. Text in any language is produced by the
   formatter; animations by the renderer. Both read the same value.

   This is the seed set for the eye, ear, balance and cardiovascular
   examinations. The full examination (~150 properties) follows in M1 with
   the same shape.
--------------------------------------------------------------------------- */

const q = (unit: string, min?: number, max?: number): ValueType => ({ kind: 'quantity', unit, min, max });
const c = (valueSet: string): ValueType => ({ kind: 'coded', valueSet });
const o = (scale: string): ValueType => ({ kind: 'ordinal', scale });
const rec = (fields: Record<string, ValueType>, optional?: string[]): ValueType => ({ kind: 'record', fields, optional });
const listOf = (of: ValueType): ValueType => ({ kind: 'list', of });
const bool: ValueType = { kind: 'boolean' };
const side = c('side');

const MURMUR = rec({ valve: c('valve'), timing: c('murmur-timing'), shape: c('murmur-shape'), grade: o('murmur-grade'), pitch: c('pitch') });

export const PROPERTIES: PropertyDef[] = [
  /* ---- general ---------------------------------------------------------------- */
  {
    id: 'general.appearance', structure: 'general',
    label: { en: 'General appearance', de: 'Allgemeinzustand' },
    value: rec({ distress: c('distress'), colour: c('colour'), sweating: bool }),
    normal: { value: { distress: 'none', colour: 'normal', sweating: false } },
    source: 'model-or-case', resolver: 'general.appearance', formatter: 'general.appearance', renderer: 'svg.patient',
  },

  /* ---- vital signs (LOINC codes are the standard vital-sign codes) ----------- */
  {
    id: 'vitals.hr', structure: 'vitals', label: { en: 'Heart rate', de: 'Herzfrequenz' },
    value: q('/min', 0, 300),
    normal: { value: 72, range: [60, 100], bands: [
      { maxAge: 1, value: 130, range: [100, 160] }, { maxAge: 12, value: 95, range: [70, 120] }] },
    source: 'model-or-case', resolver: 'circulation.hr', formatter: 'vitals.hr', codes: { loinc: '8867-4' },
  },
  {
    id: 'vitals.bp', structure: 'arm', paired: true, label: { en: 'Blood pressure', de: 'Blutdruck' },
    value: rec({ systolic: q('mm[Hg]', 0, 300), diastolic: q('mm[Hg]', 0, 200) }),
    normal: { value: { systolic: 120, diastolic: 75 }, range: { systolic: [90, 139], diastolic: [60, 89] } },
    contextDims: ['position'],
    source: 'model-or-case', resolver: 'circulation.bp', formatter: 'vitals.bp', codes: { loinc: '85354-9' },
  },
  {
    id: 'vitals.rr', structure: 'vitals', label: { en: 'Respiratory rate', de: 'Atemfrequenz' },
    value: q('/min', 0, 80),
    normal: { value: 14, range: [12, 20], bands: [{ maxAge: 1, value: 40, range: [30, 60] }, { maxAge: 12, value: 22, range: [18, 30] }] },
    source: 'case', formatter: 'vitals.rr', codes: { loinc: '9279-1' },
  },
  {
    id: 'vitals.spo2', structure: 'vitals', label: { en: 'Oxygen saturation', de: 'Sauerstoffsättigung' },
    value: q('%', 0, 100), normal: { value: 98, range: [94, 100] },
    source: 'case', formatter: 'vitals.spo2', codes: { loinc: '59408-5' },
  },
  {
    id: 'vitals.temp', structure: 'vitals', label: { en: 'Temperature', de: 'Temperatur' },
    value: q('Cel', 30, 44), normal: { value: 36.8, range: [36.0, 37.9] },
    source: 'case', formatter: 'vitals.temp', codes: { loinc: '8310-5' },
  },

  /* ---- cardiovascular ------------------------------------------------------- */
  {
    id: 'pulse.radial', structure: 'wrist.radial', paired: true, label: { en: 'Radial pulse', de: 'Radialispuls' },
    value: rec({ rate: q('/min'), rhythm: c('rhythm'), volume: c('pulse-volume'), character: c('pulse-character') }),
    normal: { value: { rate: 72, rhythm: 'regular', volume: 'normal', character: 'normal' }, range: { rate: [60, 100] } },
    source: 'model-or-case', resolver: 'circulation.pulse', formatter: 'pulse', renderer: 'svg.pulse',
  },
  {
    id: 'pulse.carotid', structure: 'neck.carotid', paired: true, label: { en: 'Carotid pulse', de: 'Karotispuls' },
    value: rec({ rate: q('/min'), rhythm: c('rhythm'), volume: c('pulse-volume'), character: c('pulse-character') }),
    normal: { value: { rate: 72, rhythm: 'regular', volume: 'normal', character: 'normal' }, range: { rate: [60, 100] } },
    source: 'model-or-case', resolver: 'circulation.pulse', formatter: 'pulse', renderer: 'svg.pulse',
  },
  {
    id: 'jvp', structure: 'neck.jugular', label: { en: 'Jugular venous pressure', de: 'Jugularvenendruck' },
    value: rec({ heightCm: q('cm', -10, 20), waveform: c('jvp-wave') }),
    normal: { value: { heightCm: 2, waveform: 'normal' }, range: { heightCm: [-10, 4] } },
    contextDims: ['position'],
    source: 'model-or-case', resolver: 'circulation.jvp', formatter: 'jvp', renderer: 'svg.neck',
  },
  {
    id: 'apex', structure: 'chest.mitral-area', label: { en: 'Apex beat', de: 'Herzspitzenstoß' },
    value: rec({ position: c('apex-position'), character: c('apex-character') }),
    normal: { value: { position: 'normal', character: 'normal' } },
    source: 'model-or-case', resolver: 'circulation.apex', formatter: 'apex',
  },
  {
    id: 'heart.sounds', structure: 'chest', label: { en: 'Heart sounds', de: 'Herztöne' },
    value: rec({ s1: c('s1'), a2: c('a2'), p2: c('p2'), s2Split: c('s2-split'), added: listOf(c('added-sound')), murmurs: listOf(MURMUR) }),
    normal: { value: { s1: 'normal', a2: 'normal', p2: 'normal', s2Split: 'physiological', added: [], murmurs: [] } },
    contextDims: ['site', 'position', 'respiration', 'instrument'],
    source: 'model-or-case', resolver: 'circulation.heart-sounds', formatter: 'heart.sounds', renderer: 'audio.heart',
  },
  {
    id: 'lung.sounds', structure: 'chest', label: { en: 'Breath sounds', de: 'Atemgeräusch' },
    value: rec({ breath: c('breath-sounds'), added: listOf(c('added-lung')) }),
    normal: { value: { breath: 'vesicular', added: [] } },
    contextDims: ['site', 'respiration'],
    source: 'model-or-case', resolver: 'circulation.lungs', formatter: 'lung.sounds', renderer: 'audio.lung',
  },

  {
    id: 'hands.crt', structure: 'hands', label: { en: 'Capillary refill time', de: 'Rekapillarisierungszeit' },
    value: q('s', 0, 10), normal: { value: 2, range: [0, 2] },
    source: 'model-or-case', resolver: 'circulation.crt', formatter: 'hands.crt',
  },
  {
    id: 'legs.oedema', structure: 'legs', label: { en: 'Leg oedema', de: 'Beinödeme' },
    value: rec({ extent: c('oedema') }), normal: { value: { extent: 'none' } },
    source: 'model-or-case', resolver: 'circulation.oedema', formatter: 'legs.oedema',
  },
  {
    id: 'abdomen.palpation', structure: 'abdomen', label: { en: 'Abdominal palpation', de: 'Palpation des Abdomens' },
    value: rec({ tenderness: c('severity'), mass: bool, guarding: bool }),
    normal: { value: { tenderness: 'none', mass: false, guarding: false } },
    source: 'case', formatter: 'abdomen.palpation',
  },

  /* ---- eyes ----------------------------------------------------------------- */
  {
    id: 'eye.pupil', structure: 'eye', paired: true, label: { en: 'Pupil', de: 'Pupille' },
    value: rec({ sizeMm: q('mm', 1, 9), reaction: c('pupil-reaction') }, ['reaction']),
    normal: { value: { sizeMm: 4, reaction: 'brisk' }, range: { sizeMm: [2.5, 6] },
      bands: [{ maxAge: 12, value: { sizeMm: 5, reaction: 'brisk' }, range: { sizeMm: [3, 7] } },
        { minAge: 60, value: { sizeMm: 3.5, reaction: 'brisk' }, range: { sizeMm: [2, 5] } }] },
    contextDims: ['lightOn', 'ambient'],
    source: 'model', resolver: 'neuro.pupils', formatter: 'eye.pupil', renderer: 'svg.eyes',
  },
  {
    id: 'eyes.swinging-light', structure: 'eyes', label: { en: 'Relative afferent pupillary defect', de: 'Relatives afferentes Pupillendefizit' },
    value: rec({ rapd: c('rapd') }), normal: { value: { rapd: 'none' } },
    source: 'model', resolver: 'neuro.pupils', formatter: 'eyes.swinging-light', renderer: 'svg.eyes',
  },
  {
    id: 'eye.lid', structure: 'eye', paired: true, label: { en: 'Upper lid', de: 'Oberlid' },
    value: rec({ ptosisMm: q('mm', 0, 10) }),
    normal: { value: { ptosisMm: 0 }, range: { ptosisMm: [0, 1] } },
    contextDims: ['sustainedSeconds'],
    source: 'model-or-case', resolver: 'neuro.lids', formatter: 'eye.lid', renderer: 'svg.eyes',
  },
  {
    id: 'eye.motility', structure: 'eye', paired: true, label: { en: 'Eye movements (ductions)', de: 'Motilität (Duktionen)' },
    value: rec({
      abduction: q('%', 0, 100), adduction: q('%', 0, 100), elevation: q('%', 0, 100), depression: q('%', 0, 100),
      restingDeg: rec({ horizontal: q('deg', -45, 45), vertical: q('deg', -45, 45) }),
    }),
    normal: { value: { abduction: 100, adduction: 100, elevation: 100, depression: 100, restingDeg: { horizontal: 0, vertical: 0 } },
      range: { abduction: [90, 100], adduction: [90, 100], elevation: [80, 100], depression: [90, 100] } },
    source: 'model', resolver: 'neuro.ocular-motor', formatter: 'eye.motility', renderer: 'svg.eyes',
  },
  {
    id: 'eyes.alignment', structure: 'eyes', label: { en: 'Ocular alignment (cover test)', de: 'Augenstellung (Abdecktest)' },
    value: rec({ horizontal: c('horizontal-deviation'), horizontalPD: q('[p\'diop]', 0, 100), verticalPD: q('[p\'diop]', 0, 50), higherEye: side },
      ['higherEye']),
    normal: { value: { horizontal: 'ortho', horizontalPD: 0, verticalPD: 0 }, range: { horizontalPD: [0, 1], verticalPD: [0, 1] } },
    contextDims: ['coverEye', 'gaze'],
    source: 'model', resolver: 'neuro.ocular-motor', formatter: 'eyes.alignment', renderer: 'svg.eyes',
  },
  {
    id: 'eyes.nystagmus', structure: 'eyes', label: { en: 'Nystagmus', de: 'Nystagmus' },
    value: rec({
      present: bool, type: c('nystagmus-type'), fastPhase: c('direction'), torsion: c('torsion'), slowPhase: c('slow-phase'),
      spvDegPerS: q('deg/s', 0, 100), amplitudeDeg: q('deg', 0, 30), frequencyHz: q('Hz', 0, 10),
    }, ['type', 'fastPhase', 'torsion', 'slowPhase', 'spvDegPerS', 'amplitudeDeg', 'frequencyHz']),
    normal: { value: { present: false } },
    contextDims: ['gaze', 'fixation', 'position'],
    source: 'model', resolver: 'neuro.vestibular', formatter: 'eyes.nystagmus', renderer: 'svg.eyes',
  },
  {
    /* Side = the direction the head is turned, which tests that side's horizontal canal. */
    id: 'eye.head-impulse', structure: 'eyes', paired: true, label: { en: 'Head impulse', de: 'Kopfimpulstest' },
    value: rec({ gain: q('1', 0, 1.2), saccade: c('corrective-saccade') }),
    normal: { value: { gain: 1, saccade: 'none' }, range: { gain: [0.8, 1.2] } },
    contextDims: ['headImpulseTo'],
    source: 'model', resolver: 'neuro.vestibular', formatter: 'eye.head-impulse', renderer: 'svg.eyes',
  },
  {
    id: 'eyes.pursuit', structure: 'eyes', label: { en: 'Smooth pursuit', de: 'Blickfolge' },
    value: rec({ quality: c('pursuit') }), normal: { value: { quality: 'smooth' } },
    source: 'model', resolver: 'neuro.vestibular', formatter: 'eyes.pursuit', renderer: 'svg.eyes',
  },
  {
    id: 'eye.field', structure: 'eye', paired: true, label: { en: 'Visual field (confrontation)', de: 'Gesichtsfeld (fingerperimetrisch)' },
    value: rec({ temporal: c('field-quadrant'), nasal: c('field-quadrant') }),
    normal: { value: { temporal: 'intact', nasal: 'intact' } },
    source: 'model', resolver: 'neuro.fields', formatter: 'eye.field', renderer: 'svg.field',
  },
  {
    id: 'eye.fundus', structure: 'eye', paired: true, label: { en: 'Fundus', de: 'Fundus' },
    value: rec({ disc: c('disc') }), normal: { value: { disc: 'normal' } },
    source: 'case', formatter: 'eye.fundus', renderer: 'svg.fundus',
  },

  /* ---- ears ----------------------------------------------------------------- */
  {
    id: 'ear.whisper', structure: 'ear', paired: true, label: { en: 'Whispered voice', de: 'Flüstersprache' },
    value: c('whisper'), normal: { value: 'heard' },
    source: 'model-or-case', resolver: 'neuro.hearing', formatter: 'ear.whisper',
  },
  {
    id: 'ear.rinne', structure: 'ear', paired: true, label: { en: 'Rinne test', de: 'Rinne-Versuch' },
    value: c('rinne'), normal: { value: 'positive' },
    source: 'model-or-case', resolver: 'neuro.hearing', formatter: 'ear.rinne',
  },
  {
    id: 'head.weber', structure: 'head', label: { en: 'Weber test', de: 'Weber-Versuch' },
    value: c('weber'), normal: { value: 'central' },
    source: 'model-or-case', resolver: 'neuro.hearing', formatter: 'head.weber',
  },

  /* ---- balance and coordination -------------------------------------------- */
  {
    id: 'posture.romberg', structure: 'posture', label: { en: 'Stance, feet together', de: 'Romberg-Stehversuch' },
    value: rec({ stance: c('stance'), toward: side }, ['toward']),
    normal: { value: { stance: 'steady' } },
    contextDims: ['eyesClosed'],
    source: 'model-or-case', resolver: 'neuro.balance', formatter: 'posture.romberg', renderer: 'svg.patient',
  },
  {
    id: 'gait.pattern', structure: 'gait', label: { en: 'Gait', de: 'Gangbild' },
    value: rec({ pattern: c('gait-pattern'), toward: side }, ['toward']),
    normal: { value: { pattern: 'normal' } },
    source: 'model-or-case', resolver: 'neuro.balance', formatter: 'gait.pattern', renderer: 'svg.patient',
  },
  /* ---- neurological: cranial nerves V, VII, IX–XII and speech -------------------- */
  {
    id: 'face.movement', structure: 'face', paired: true, label: { en: 'Facial movement', de: 'Mimik' },
    value: rec({ forehead: c('face-power'), eyeClosure: c('face-power'), mouth: c('face-power') }),
    normal: { value: { forehead: 'normal', eyeClosure: 'normal', mouth: 'normal' } },
    source: 'model', resolver: 'neuro.cranial', formatter: 'face.movement', renderer: 'svg.face',
  },
  {
    id: 'face.sensation', structure: 'face', paired: true, label: { en: 'Facial sensation and corneal reflex', de: 'Gesichtssensibilität und Kornealreflex' },
    value: rec({ V1: c('sense-level'), V2: c('sense-level'), V3: c('sense-level'), corneal: bool }),
    normal: { value: { V1: 'normal', V2: 'normal', V3: 'normal', corneal: true } },
    source: 'model', resolver: 'neuro.sensory', formatter: 'face.sensation',
  },
  {
    id: 'jaw.opening', structure: 'jaw', label: { en: 'Jaw opening', de: 'Mundöffnung' },
    value: rec({ deviatesTo: c('deviation') }), normal: { value: { deviatesTo: 'none' } },
    source: 'model', resolver: 'neuro.cranial', formatter: 'jaw.opening',
  },
  {
    id: 'mouth.palate', structure: 'mouth', label: { en: 'Palate, gag and voice', de: 'Gaumensegel, Würgreflex und Stimme' },
    value: rec({ uvulaDeviatesTo: c('deviation'), gagLeft: bool, gagRight: bool, voice: c('voice') }),
    normal: { value: { uvulaDeviatesTo: 'none', gagLeft: true, gagRight: true, voice: 'normal' } },
    source: 'model', resolver: 'neuro.cranial', formatter: 'mouth.palate',
  },
  {
    id: 'mouth.tongue', structure: 'mouth', label: { en: 'Tongue', de: 'Zunge' },
    value: rec({ deviatesTo: c('deviation'), wasting: bool, fasciculation: bool }),
    normal: { value: { deviatesTo: 'none', wasting: false, fasciculation: false } },
    source: 'model', resolver: 'neuro.cranial', formatter: 'mouth.tongue',
  },
  {
    id: 'shoulder.shrug', structure: 'shoulder', paired: true, label: { en: 'Shoulder shrug and head turn', de: 'Schulterheben und Kopfdrehung' },
    value: rec({ power: o('mrc-power') }), normal: { value: { power: 5 } },
    source: 'model', resolver: 'neuro.cranial', formatter: 'shoulder.shrug',
  },
  {
    id: 'speech.language', structure: 'speech', label: { en: 'Speech and language', de: 'Sprache und Sprechen' },
    value: rec({ fluency: c('language'), comprehension: c('language'), repetition: c('language'), naming: c('language'), articulation: c('articulation') }),
    normal: { value: { fluency: 'normal', comprehension: 'normal', repetition: 'normal', naming: 'normal', articulation: 'normal' } },
    source: 'model', resolver: 'neuro.speech', formatter: 'speech.language',
  },
  {
    id: 'speech.fatigue', structure: 'speech', label: { en: 'Voice on counting to 50', de: 'Stimme beim Zählen bis 50' },
    value: rec({ voice: c('voice') }), normal: { value: { voice: 'normal' } }, contextDims: ['repetition'],
    source: 'model', resolver: 'neuro.speech', formatter: 'speech.fatigue',
  },

  /* ---- neurological: limbs and trunk ------------------------------------------------ */
  ...(['arm', 'leg'] as const).flatMap((limb): PropertyDef[] => {
    const L = limb === 'arm' ? { en: 'arm', de: 'Arm' } : { en: 'leg', de: 'Bein' };
    const moves = limb === 'arm'
      ? ['shoulderAbduction', 'elbowFlexion', 'elbowExtension', 'wristExtension', 'fingerFlexion', 'thumbAbduction', 'fingerAbduction']
      : ['hipFlexion', 'hipAdduction', 'hipAbduction', 'kneeExtension', 'ankleDorsiflexion', 'footEversion', 'footInversion', 'anklePlantarflexion'];
    const segs = limb === 'arm' ? ['C5', 'C6', 'C7', 'C8', 'T1'] : ['L2', 'L3', 'L4', 'L5', 'S1'];
    const reflexes = limb === 'arm'
      ? rec({ biceps: o('reflex-grade'), supinator: o('reflex-grade'), triceps: o('reflex-grade') })
      : rec({ knee: o('reflex-grade'), ankle: o('reflex-grade'), plantar: c('plantar') });
    return [
      { id: `${limb}.tone`, structure: limb, paired: true, label: { en: `Tone and bulk (${L.en})`, de: `Tonus und Trophik (${L.de})` },
        value: rec({ tone: c('tone'), wasting: bool, fasciculation: bool }), normal: { value: { tone: 'normal', wasting: false, fasciculation: false } },
        source: 'model', resolver: 'neuro.motor', formatter: 'limb.tone' },
      { id: `${limb}.power`, structure: limb, paired: true, label: { en: `Power (${L.en})`, de: `Kraft (${L.de})` },
        value: rec(Object.fromEntries(moves.map((m) => [m, o('mrc-power')]))), normal: { value: Object.fromEntries(moves.map((m) => [m, 5])) },
        contextDims: ['repetition'], source: 'model', resolver: 'neuro.motor', formatter: 'limb.power' },
      { id: `${limb}.reflexes`, structure: limb, paired: true, label: { en: `Reflexes (${L.en})`, de: `Reflexe (${L.de})` },
        value: reflexes, normal: { value: limb === 'arm' ? { biceps: 2, supinator: 2, triceps: 2 } : { knee: 2, ankle: 2, plantar: 'flexor' } },
        source: 'model', resolver: 'neuro.reflexes', formatter: 'limb.reflexes' },
      { id: `${limb}.pinprick`, structure: limb, paired: true, label: { en: `Pinprick (${L.en})`, de: `Schmerzempfinden (${L.de})` },
        value: rec({ ...Object.fromEntries(segs.map((g) => [g, c('sense-level')])), territories: listOf(c('territory')) }),
        normal: { value: { ...Object.fromEntries(segs.map((g) => [g, 'normal'])), territories: [] } },
        source: 'model', resolver: 'neuro.sensory', formatter: 'limb.pinprick', renderer: 'svg.dermatomes' },
      { id: `${limb}.vibration`, structure: limb, paired: true, label: { en: `Vibration and joint position (${L.en})`, de: `Vibration und Lagesinn (${L.de})` },
        value: rec({ vibration: c('sense-level'), proprioception: c('sense-level') }), normal: { value: { vibration: 'normal', proprioception: 'normal' } },
        source: 'model', resolver: 'neuro.sensory', formatter: 'limb.vibration' },
    ];
  }),
  {
    id: 'arm.drift', structure: 'arm', paired: true, label: { en: 'Pronator drift', de: 'Armvorhalteversuch' },
    value: rec({ drift: bool }), normal: { value: { drift: false } },
    source: 'model', resolver: 'neuro.motor', formatter: 'arm.drift',
  },
  {
    id: 'trunk.pinprick', structure: 'trunk', paired: true, label: { en: 'Pinprick on the trunk', de: 'Schmerzempfinden am Rumpf' },
    value: rec({ T6: c('sense-level'), T10: c('sense-level') }), normal: { value: { T6: 'normal', T10: 'normal' } },
    source: 'model', resolver: 'neuro.sensory', formatter: 'trunk.pinprick',
  },
  {
    id: 'saddle.sensation', structure: 'saddle', label: { en: 'Saddle sensation', de: 'Reithosensensibilität' },
    value: rec({ pinprick: c('sense-level') }), normal: { value: { pinprick: 'normal' } },
    source: 'model', resolver: 'neuro.sensory', formatter: 'saddle.sensation',
  },
  {
    id: 'leg.slr', structure: 'leg', paired: true, label: { en: 'Straight leg raise', de: 'Lasègue-Zeichen' },
    value: rec({ positive: bool, angleDeg: q('deg', 0, 90) }, ['angleDeg']), normal: { value: { positive: false } },
    source: 'case', formatter: 'leg.slr',
  },
  {
    id: 'leg.heel-shin', structure: 'leg', paired: true, label: { en: 'Heel–shin test', de: 'Knie-Hacke-Versuch' },
    value: rec({ dysmetria: c('severity'), intentionTremor: bool, limitedByWeakness: bool }, ['limitedByWeakness']),
    normal: { value: { dysmetria: 'none', intentionTremor: false } }, contextDims: ['eyesClosed'],
    source: 'model-or-case', resolver: 'neuro.coordination', formatter: 'arm.finger-nose',
  },
  {
    id: 'arm.rapid-alternating', structure: 'arm', paired: true, label: { en: 'Rapid alternating movements', de: 'Diadochokinese' },
    value: rec({ dysdiadochokinesia: bool, slowed: bool }), normal: { value: { dysdiadochokinesia: false, slowed: false } },
    source: 'model-or-case', resolver: 'neuro.coordination', formatter: 'arm.rapid-alternating',
  },
  {
    id: 'arm.finger-nose', structure: 'arm', paired: true, label: { en: 'Finger–nose test', de: 'Finger-Nase-Versuch' },
    value: rec({ dysmetria: c('severity'), intentionTremor: bool, limitedByWeakness: bool }, ['limitedByWeakness']),
    normal: { value: { dysmetria: 'none', intentionTremor: false } },
    contextDims: ['eyesClosed'],
    source: 'model-or-case', resolver: 'neuro.coordination', formatter: 'arm.finger-nose', renderer: 'svg.patient',
  },
];
