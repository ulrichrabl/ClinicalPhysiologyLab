import type { ExamContext, ManoeuvreDef } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   Manoeuvres: what a clinician can do at the bedside.

   A manoeuvre is a verb on a structure. It reveals properties in a context,
   requires things (an instrument, a position, an ability), takes time, and
   may be harmful in some states. Nothing here says whether a finding will be
   abnormal; that is the case's business.

   Phrases are what a learner might type, per language. They are matched
   loosely by the action parser and exist only so typing works; nothing
   lists them to the learner.
--------------------------------------------------------------------------- */

const GAZES: Array<NonNullable<ExamContext['gaze']>> = ['primary', 'left', 'right', 'up', 'down'];

const auscultate = (
  site: string, en: string, de: string, enPh: string[], dePh: string[], extra: Partial<ManoeuvreDef> = {},
): ManoeuvreDef => ({
  id: `auscultate.heart.${site.replace('chest.', '').replace('-area', '')}`,
  verb: 'auscultate', target: site,
  label: { en: `Listen at the ${en}`, de: `Auskultation ${de}` },
  phrases: { en: enPh, de: dePh },
  reveals: [{ property: 'heart.sounds', context: { site } }],
  context: { site, instrument: 'stethoscope-diaphragm', respiration: 'quiet' },
  requires: { instrument: ['stethoscope-diaphragm', 'stethoscope-bell'], exposure: ['chest'] },
  durationSeconds: 20,
  ...extra,
});

export const MANOEUVRES: ManoeuvreDef[] = [
  /* ---- general and vital signs -------------------------------------------- */
  {
    id: 'inspect.general', verb: 'inspect', target: 'general',
    label: { en: 'Look at the patient from the end of the bed', de: 'Inspektion vom Bettende' },
    phrases: { en: ['look at the patient', 'general inspection', 'end of the bed', 'general appearance', 'inspect'],
      de: ['patient ansehen', 'inspektion', 'allgemeinzustand', 'vom bettende', 'aspekt'] },
    reveals: [{ property: 'general.appearance' }], durationSeconds: 15,
  },
  {
    id: 'measure.hr', verb: 'measure', target: 'vitals',
    label: { en: 'Count the heart rate', de: 'Herzfrequenz zählen' },
    phrases: { en: ['heart rate', 'hr', 'pulse rate'], de: ['herzfrequenz', 'hf', 'puls zählen'] },
    reveals: [{ property: 'vitals.hr' }], requires: { instrument: ['watch', 'pulse-oximeter'] }, durationSeconds: 30,
  },
  {
    id: 'measure.bp', verb: 'measure', target: 'arm', paired: true,
    label: { en: 'Measure the blood pressure', de: 'Blutdruck messen' },
    phrases: { en: ['blood pressure', 'bp', 'measure bp'], de: ['blutdruck', 'rr', 'rr messen', 'blutdruck messen'] },
    reveals: [{ property: 'vitals.bp' }], requires: { instrument: ['bp-cuff'], exposure: ['arm'] }, durationSeconds: 60,
  },
  {
    id: 'measure.rr', verb: 'measure', target: 'vitals',
    label: { en: 'Count the respiratory rate', de: 'Atemfrequenz zählen' },
    phrases: { en: ['respiratory rate', 'rr', 'breathing rate'], de: ['atemfrequenz', 'af', 'atemzüge zählen'] },
    reveals: [{ property: 'vitals.rr' }], requires: { instrument: ['watch'] }, durationSeconds: 30,
  },
  {
    id: 'measure.spo2', verb: 'measure', target: 'vitals',
    label: { en: 'Measure oxygen saturation', de: 'Sauerstoffsättigung messen' },
    phrases: { en: ['saturation', 'sats', 'spo2', 'oxygen'], de: ['sättigung', 'spo2', 'sauerstoffsättigung', 'pulsoxymetrie'] },
    reveals: [{ property: 'vitals.spo2' }], requires: { instrument: ['pulse-oximeter'] }, durationSeconds: 20,
  },
  {
    id: 'measure.temp', verb: 'measure', target: 'vitals',
    label: { en: 'Measure the temperature', de: 'Temperatur messen' },
    phrases: { en: ['temperature', 'temp', 'fever'], de: ['temperatur', 'fieber messen'] },
    reveals: [{ property: 'vitals.temp' }], requires: { instrument: ['thermometer'] }, durationSeconds: 30,
  },

  /* ---- cardiovascular ------------------------------------------------------- */
  {
    id: 'palpate.pulse.radial', verb: 'palpate', target: 'wrist.radial', paired: true,
    label: { en: 'Feel the radial pulse', de: 'Radialispuls tasten' },
    phrases: { en: ['radial pulse', 'feel the pulse', 'take the pulse', 'pulse at the wrist'], de: ['radialispuls', 'puls tasten', 'puls fühlen'] },
    reveals: [{ property: 'pulse.radial' }], requires: { instrument: ['hands'] }, durationSeconds: 20,
  },
  {
    id: 'palpate.pulse.carotid', verb: 'palpate', target: 'neck.carotid', paired: true,
    label: { en: 'Feel the carotid pulse', de: 'Karotispuls tasten' },
    phrases: { en: ['carotid pulse', 'feel the carotid'], de: ['karotispuls', 'carotispuls', 'karotis tasten'] },
    reveals: [{ property: 'pulse.carotid' }], requires: { instrument: ['hands'] }, durationSeconds: 15,
  },
  {
    id: 'inspect.jvp', verb: 'inspect', target: 'neck.jugular',
    label: { en: 'Look at the jugular venous pressure', de: 'Halsvenen beurteilen' },
    phrases: { en: ['jvp', 'jugular venous pressure', 'neck veins'], de: ['halsvenen', 'jvd', 'jugularvenen', 'halsvenenstauung'] },
    reveals: [{ property: 'jvp' }], requires: { position: ['reclined-45'], exposure: ['neck'] }, durationSeconds: 30,
  },
  {
    id: 'palpate.apex', verb: 'palpate', target: 'chest.mitral-area',
    label: { en: 'Palpate the apex beat', de: 'Herzspitzenstoß tasten' },
    phrases: { en: ['apex beat', 'palpate apex', 'feel the apex'], de: ['herzspitzenstoß', 'spitzenstoß tasten', 'hss'] },
    reveals: [{ property: 'apex' }], requires: { instrument: ['hands'], exposure: ['chest'] }, durationSeconds: 15,
  },
  auscultate('chest.aortic-area', 'aortic area', 'Aortenareal',
    ['aortic area', 'listen aortic', '2nd right intercostal space'], ['aortenareal', 'aorta abhören', '2. icr rechts']),
  auscultate('chest.pulmonary-area', 'pulmonary area', 'Pulmonalareal',
    ['pulmonary area', 'listen pulmonary', '2nd left intercostal space'], ['pulmonalareal', '2. icr links']),
  auscultate('chest.erb', "Erb's point", 'Erb-Punkt', ["erb's point", 'erb', '3rd left intercostal space'], ['erb', 'erb-punkt', '3. icr links']),
  auscultate('chest.tricuspid-area', 'tricuspid area', 'Trikuspidalareal',
    ['tricuspid area', 'lower left sternal edge'], ['trikuspidalareal', '4. icr links']),
  auscultate('chest.mitral-area', 'mitral area (apex)', 'Mitralareal (Herzspitze)',
    ['mitral area', 'listen at the apex', 'apex with diaphragm'], ['mitralareal', 'herzspitze abhören']),
  {
    id: 'auscultate.heart.apex-bell-left-lateral', verb: 'auscultate', target: 'chest.mitral-area',
    label: { en: 'Listen at the apex with the bell, patient turned to the left', de: 'Herzspitze mit dem Trichter in Linksseitenlage abhören' },
    phrases: { en: ['bell at the apex', 'left lateral', 'roll onto left side and listen'], de: ['trichter herzspitze', 'linksseitenlage', 'linksseitenlage abhören'] },
    reveals: [{ property: 'heart.sounds', context: { site: 'chest.mitral-area' } }],
    context: { site: 'chest.mitral-area', instrument: 'stethoscope-bell', position: 'left-lateral', respiration: 'held-expiration' },
    requires: { instrument: ['stethoscope-bell'], exposure: ['chest'], position: ['left-lateral'] },
    durationSeconds: 30,
  },
  {
    id: 'auscultate.heart.lse-sitting-forward', verb: 'auscultate', target: 'chest.erb',
    label: { en: 'Listen at the left sternal edge, sitting forward, breath held in expiration', de: 'Am linken Sternalrand im Sitzen vorgebeugt in Exspiration abhören' },
    phrases: { en: ['sitting forward', 'lean forward and listen', 'held expiration'], de: ['vorgebeugt', 'nach vorne beugen', 'exspiration abhören'] },
    reveals: [{ property: 'heart.sounds', context: { site: 'chest.erb' } }],
    context: { site: 'chest.erb', instrument: 'stethoscope-diaphragm', position: 'sitting-forward', respiration: 'held-expiration' },
    requires: { instrument: ['stethoscope-diaphragm'], exposure: ['chest'], position: ['sitting-forward'] },
    durationSeconds: 30,
  },
  {
    id: 'auscultate.carotid', verb: 'auscultate', target: 'neck.carotid', paired: true,
    label: { en: 'Listen over the carotid', de: 'Karotis auskultieren' },
    phrases: { en: ['listen to the carotid', 'carotid bruit', 'auscultate carotid'], de: ['karotis abhören', 'karotis auskultieren', 'strömungsgeräusch hals'] },
    reveals: [{ property: 'heart.sounds', context: { site: 'neck.carotid' } }],
    context: { site: 'neck.carotid', instrument: 'stethoscope-bell', respiration: 'held-expiration' },
    requires: { instrument: ['stethoscope-bell', 'stethoscope-diaphragm'] }, durationSeconds: 15,
  },
  {
    id: 'auscultate.lung-base', verb: 'auscultate', target: 'chest.lung-base', paired: true,
    label: { en: 'Listen at the lung base', de: 'Lungenbasis abhören' },
    phrases: { en: ['listen to the lungs', 'lung bases', 'breath sounds', 'chest auscultation'], de: ['lunge abhören', 'lungenbasis', 'atemgeräusch', 'lunge auskultieren'] },
    reveals: [{ property: 'lung.sounds', context: { site: 'chest.lung-base' } }],
    context: { site: 'chest.lung-base', instrument: 'stethoscope-diaphragm', respiration: 'quiet' },
    requires: { instrument: ['stethoscope-diaphragm'], position: ['sitting', 'sitting-forward', 'standing'], exposure: ['chest'] },
    durationSeconds: 20,
  },

  {
    id: 'measure.crt', verb: 'measure', target: 'hands',
    label: { en: 'Capillary refill time', de: 'Rekapillarisierungszeit prüfen' },
    phrases: { en: ['capillary refill', 'crt', 'press on the nail'], de: ['rekapillarisierung', 'rekapillarisierungszeit', 'nagelbett drücken'] },
    reveals: [{ property: 'hands.crt' }], requires: { instrument: ['hands'] }, durationSeconds: 10,
  },
  {
    id: 'inspect.legs', verb: 'palpate', target: 'legs',
    label: { en: 'Look and press for ankle oedema', de: 'Auf Beinödeme prüfen' },
    phrases: { en: ['ankle oedema', 'ankle edema', 'swollen ankles', 'pitting', 'look at the legs'], de: ['ödeme', 'beinödeme', 'knöchelödeme', 'beine ansehen'] },
    reveals: [{ property: 'legs.oedema' }], requires: { instrument: ['hands'] }, durationSeconds: 15,
  },
  {
    id: 'palpate.abdomen', verb: 'palpate', target: 'abdomen',
    label: { en: 'Palpate the abdomen', de: 'Abdomen palpieren' },
    phrases: { en: ['palpate the abdomen', 'feel the abdomen', 'feel the tummy', 'abdominal examination'], de: ['bauch abtasten', 'abdomen palpieren', 'bauch untersuchen'] },
    reveals: [{ property: 'abdomen.palpation' }], requires: { instrument: ['hands'], position: ['supine'], exposure: ['abdomen'] }, durationSeconds: 60,
  },

  /* ---- eyes ----------------------------------------------------------------- */
  {
    id: 'inspect.eyes', verb: 'inspect', target: 'eyes',
    label: { en: 'Look at the eyes', de: 'Augen inspizieren' },
    phrases: { en: ['look at the eyes', 'inspect eyes', 'pupil size', 'ptosis', 'eyelids'], de: ['augen ansehen', 'augen inspizieren', 'pupillenweite', 'ptosis', 'lidspalte'] },
    reveals: [{ property: 'eye.pupil', side: 'both' }, { property: 'eye.lid', side: 'both' }, { property: 'eyes.nystagmus', context: { gaze: 'primary' } }],
    context: { lightOn: 'none', ambient: 'room', fixation: true, gaze: 'primary' }, durationSeconds: 10,
  },
  {
    id: 'inspect.eyes.dim', verb: 'inspect', target: 'eyes',
    label: { en: 'Compare the pupils in dim light', de: 'Pupillen im abgedunkelten Raum vergleichen' },
    phrases: { en: ['dim the lights', 'pupils in the dark', 'dim light'], de: ['licht dimmen', 'abdunkeln', 'pupillen im dunkeln'] },
    reveals: [{ property: 'eye.pupil', side: 'both' }],
    context: { lightOn: 'none', ambient: 'dim' }, durationSeconds: 15,
  },
  {
    id: 'test.pupils.light', verb: 'test', target: 'eye', paired: true,
    label: { en: 'Shine a light into the eye', de: 'Lichtreaktion prüfen' },
    phrases: { en: ['light reflex', 'shine a light', 'pupillary light', 'direct and consensual'], de: ['lichtreaktion', 'pupillenreaktion', 'direkt und konsensuell', 'leuchten'] },
    reveals: [{ property: 'eye.pupil', side: 'same' }, { property: 'eye.pupil', side: 'other' }],
    sideContext: ['lightOn'], context: { ambient: 'room' },
    requires: { instrument: ['pen-torch'] }, durationSeconds: 10,
  },
  {
    id: 'test.swinging-light', verb: 'test', target: 'eyes',
    label: { en: 'Swinging light test', de: 'Swinging-Flashlight-Test' },
    phrases: { en: ['swinging light', 'swinging flashlight', 'rapd', 'marcus gunn'], de: ['swinging flashlight', 'wechselbelichtung', 'rapd'] },
    reveals: [{ property: 'eyes.swinging-light' }],
    requires: { instrument: ['pen-torch'] }, durationSeconds: 20,
  },
  {
    id: 'test.eye-movements', verb: 'test', target: 'eyes',
    label: { en: 'Eye movements: follow my finger', de: 'Augenbewegungen: Folgebewegung' },
    phrases: { en: ['eye movements', 'follow my finger', 'h test', 'extraocular movements', 'gaze', 'look left', 'look right'],
      de: ['augenbewegungen', 'okulomotorik', 'folgebewegung', 'finger folgen', 'blickrichtungen'] },
    reveals: [
      { property: 'eye.motility', side: 'both' },
      ...GAZES.map((gaze) => ({ property: 'eyes.nystagmus', context: { gaze, fixation: true } })),
      { property: 'eyes.pursuit' },
    ],
    requires: { ability: ['follows-commands'] }, durationSeconds: 45,
  },
  {
    id: 'test.frenzel', verb: 'test', target: 'eyes',
    label: { en: 'Look for nystagmus behind Frenzel lenses', de: 'Nystagmus unter der Frenzel-Brille' },
    phrases: { en: ['frenzel', 'remove fixation', 'nystagmus without fixation'], de: ['frenzel', 'frenzelbrille', 'ohne fixation'] },
    reveals: GAZES.map((gaze) => ({ property: 'eyes.nystagmus', context: { gaze, fixation: false } })),
    context: { fixation: false, instrument: 'frenzel' },
    requires: { instrument: ['frenzel'] }, durationSeconds: 60,
  },
  {
    id: 'test.head-impulse', verb: 'test', target: 'eyes', paired: true,
    label: { en: 'Head impulse test', de: 'Kopfimpulstest' },
    phrases: { en: ['head impulse', 'head thrust', 'hit', 'halmagyi'], de: ['kopfimpuls', 'kopfimpulstest', 'halmagyi', 'kopfdrehtest'] },
    reveals: [{ property: 'eye.head-impulse' }],
    sideContext: ['headImpulseTo'],
    requires: { ability: ['can-fixate'] }, durationSeconds: 10,
    hazards: [{ ifState: { immobilised: 'spine.cervical' }, code: 'hit-cervical-spine',
      why: { en: 'Rapid head rotation with an unprotected cervical spine.', de: 'Schnelle Kopfdrehung bei nicht freigegebener Halswirbelsäule.' } }],
  },
  {
    id: 'test.cover', verb: 'test', target: 'eyes',
    label: { en: 'Alternate cover test', de: 'Alternierender Abdecktest' },
    phrases: { en: ['cover test', 'alternate cover', 'skew', 'test of skew'], de: ['abdecktest', 'cover-test', 'alternierender abdecktest', 'skew'] },
    reveals: [{ property: 'eyes.alignment' }],
    context: { gaze: 'primary' }, requires: { ability: ['can-fixate'] }, durationSeconds: 20,
  },
  {
    id: 'test.visual-fields', verb: 'test', target: 'eye', paired: true,
    label: { en: 'Visual fields to confrontation', de: 'Fingerperimetrie' },
    phrases: { en: ['visual fields', 'confrontation', 'fields'], de: ['gesichtsfeld', 'fingerperimetrie', 'perimetrie'] },
    reveals: [{ property: 'eye.field' }],
    requires: { ability: ['follows-commands'] }, durationSeconds: 40,
  },
  {
    id: 'test.fundoscopy', verb: 'inspect', target: 'eye', paired: true,
    label: { en: 'Fundoscopy', de: 'Funduskopie' },
    phrases: { en: ['fundoscopy', 'ophthalmoscopy', 'look at the fundus', 'optic disc'], de: ['funduskopie', 'augenhintergrund', 'papille', 'spiegeln'] },
    reveals: [{ property: 'eye.fundus' }],
    requires: { instrument: ['ophthalmoscope'] }, durationSeconds: 60,
  },

  /* ---- ears ----------------------------------------------------------------- */
  {
    id: 'test.whisper', verb: 'test', target: 'ear', paired: true,
    label: { en: 'Whispered voice test', de: 'Prüfung mit Flüstersprache' },
    phrases: { en: ['whisper', 'whispered voice', 'hearing test'], de: ['flüstern', 'flüstersprache', 'hörprüfung', 'gehör prüfen'] },
    reveals: [{ property: 'ear.whisper' }], requires: { ability: ['follows-commands'] }, durationSeconds: 20,
  },
  {
    id: 'test.rinne', verb: 'test', target: 'ear', paired: true,
    label: { en: 'Rinne test', de: 'Rinne-Versuch' },
    phrases: { en: ['rinne'], de: ['rinne'] },
    reveals: [{ property: 'ear.rinne' }], requires: { instrument: ['tuning-fork-512'], ability: ['follows-commands'] }, durationSeconds: 30,
  },
  {
    id: 'test.weber', verb: 'test', target: 'head',
    label: { en: 'Weber test', de: 'Weber-Versuch' },
    phrases: { en: ['weber'], de: ['weber'] },
    reveals: [{ property: 'head.weber' }], requires: { instrument: ['tuning-fork-512'], ability: ['follows-commands'] }, durationSeconds: 20,
  },

  /* ---- balance and coordination -------------------------------------------- */
  {
    id: 'test.romberg', verb: 'test', target: 'posture',
    label: { en: 'Stand with feet together, eyes open then closed', de: 'Romberg-Stehversuch' },
    phrases: { en: ['romberg', 'feet together', 'stand with eyes closed'], de: ['romberg', 'stehversuch', 'füße zusammen', 'augen schließen im stehen'] },
    reveals: [{ property: 'posture.romberg', context: { eyesClosed: false } }, { property: 'posture.romberg', context: { eyesClosed: true } }],
    requires: { position: ['standing'], ability: ['can-stand', 'follows-commands'] }, durationSeconds: 60,
    hazards: [{ ifState: { physiology: { key: 'Pmean', below: 60 } }, code: 'stand-while-hypotensive',
      why: { en: 'Standing a hypotensive patient risks syncope and a fall.', de: 'Aufstehen bei Hypotonie: Synkopen- und Sturzgefahr.' } }],
  },
  {
    id: 'test.gait', verb: 'test', target: 'gait',
    label: { en: 'Watch the patient walk', de: 'Gangprüfung' },
    phrases: { en: ['gait', 'walk', 'watch them walk', 'tandem'], de: ['gang', 'gangbild', 'gehen lassen', 'strichgang'] },
    reveals: [{ property: 'gait.pattern' }],
    requires: { position: ['standing'], ability: ['can-walk'] }, durationSeconds: 60,
    hazards: [{ ifState: { physiology: { key: 'Pmean', below: 60 } }, code: 'walk-while-hypotensive',
      why: { en: 'Walking a hypotensive patient risks syncope and a fall.', de: 'Gehen bei Hypotonie: Synkopen- und Sturzgefahr.' } }],
  },
  {
    id: 'test.finger-nose', verb: 'test', target: 'arm', paired: true,
    label: { en: 'Finger–nose test', de: 'Finger-Nase-Versuch' },
    phrases: { en: ['finger nose', 'finger to nose', 'coordination', 'dysmetria'], de: ['finger-nase', 'finger nase', 'koordination', 'zielversuch'] },
    reveals: [{ property: 'arm.finger-nose' }], requires: { ability: ['follows-commands'] }, durationSeconds: 20,
  },

  /* ---- positioning and exposure ------------------------------------------- */
  ...([
    ['supine', 'Lie the patient flat', 'Flach hinlegen', ['lie flat', 'lie down', 'supine'], ['flach hinlegen', 'hinlegen', 'rückenlage']],
    ['reclined-45', 'Sit the patient up at 45°', 'Oberkörper 45° hochlagern', ['45 degrees', 'recline', 'sit up at 45'], ['45 grad', 'halbsitzend', 'oberkörper hoch']],
    ['sitting', 'Sit the patient up', 'Aufsetzen', ['sit up', 'sitting'], ['aufsetzen', 'sitzen']],
    ['sitting-forward', 'Sit up and lean forward', 'Aufsetzen und nach vorne beugen', ['lean forward'], ['nach vorne beugen', 'vorbeugen']],
    ['left-lateral', 'Roll onto the left side', 'In Linksseitenlage drehen', ['roll to the left', 'left side'], ['linksseitenlage', 'auf die linke seite']],
    ['standing', 'Stand the patient up', 'Aufstehen lassen', ['stand up', 'standing'], ['aufstehen', 'stehen']],
  ] as Array<[NonNullable<ExamContext['position']>, string, string, string[], string[]]>).map(([pos, en, de, enPh, dePh]): ManoeuvreDef => ({
    id: `position.${pos}`, verb: 'position', target: 'body',
    label: { en, de }, phrases: { en: enPh, de: dePh }, reveals: [],
    sets: { position: pos },
    requires: pos === 'standing' ? { ability: ['can-stand'] } : undefined,
    durationSeconds: 20,
  })),
  {
    id: 'expose.chest', verb: 'expose', target: 'chest',
    label: { en: 'Expose the chest', de: 'Oberkörper freimachen' },
    phrases: { en: ['expose the chest', 'take off shirt', 'undress'], de: ['oberkörper frei', 'freimachen', 'hemd ausziehen'] },
    reveals: [], sets: { exposure: ['chest', 'neck', 'arm'] }, requires: { consent: 'verbal' }, durationSeconds: 30,
  },
  {
    id: 'expose.abdomen', verb: 'expose', target: 'abdomen',
    label: { en: 'Expose the abdomen', de: 'Abdomen freimachen' },
    phrases: { en: ['expose the abdomen', 'uncover the tummy'], de: ['bauch freimachen', 'abdomen freimachen'] },
    reveals: [], sets: { exposure: ['abdomen'] }, requires: { consent: 'verbal' }, durationSeconds: 15,
  },
];
