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
  {
    id: 'arm.finger-nose', structure: 'arm', paired: true, label: { en: 'Finger–nose test', de: 'Finger-Nase-Versuch' },
    value: rec({ dysmetria: c('severity'), intentionTremor: bool }),
    normal: { value: { dysmetria: 'none', intentionTremor: false } },
    contextDims: ['eyesClosed'],
    source: 'model-or-case', resolver: 'neuro.coordination', formatter: 'arm.finger-nose', renderer: 'svg.patient',
  },
];
