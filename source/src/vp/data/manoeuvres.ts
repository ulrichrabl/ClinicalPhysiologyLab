import type { ExamContext, ManoeuvreDef } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   Manoeuvres: what a clinician can do at the bedside.

   A manoeuvre is a verb on a structure. It reveals properties in a context,
   requires things (an instrument, a position, an ability), takes time, and
   may be harmful in some states. Nothing here says whether a finding will be
   abnormal; that is the case's business.

   Labels are the names a medical student learns the examination by (Romberg
   test, Armvorhalteversuch); how to do it is on the teaching card
   (source/knowledge/, built into teaching cards). Phrases are what a learner might type, per language;
   the action parser matches them loosely and the suggestions show the one
   that matched.
--------------------------------------------------------------------------- */

const GAZES: Array<NonNullable<ExamContext['gaze']>> = ['primary', 'left', 'right', 'up', 'down'];

const auscultate = (
  site: string, en: string, de: string, enPh: string[], dePh: string[], extra: Partial<ManoeuvreDef> = {},
): ManoeuvreDef => ({
  id: `auscultate.heart.${site.replace('chest.', '').replace('-area', '')}`,
  verb: 'auscultate', target: site,
  label: { en: `Heart sounds: ${en}`, de: `Herztöne: ${de}` },
  phrases: { en: enPh, de: dePh },
  reveals: [{ property: 'heart.sounds', context: { site } }],
  context: { site, instrument: 'stethoscope-diaphragm', respiration: 'quiet' },
  requires: { instrument: ['stethoscope-diaphragm', 'stethoscope-bell'], exposure: ['chest'] },
  durationSeconds: 20,
  ...extra,
});


/* ---- the lungs: five sites a side, each listened to, percussed and tested for vocal resonance ---------- */
type LungSite = [string, string, string, string, string[], string[], 'front' | 'back' | 'side', boolean];
const LUNG_SITES: LungSite[] = [
  ['chest.upper-zone', 'upper-zone', 'upper zone', 'Oberfeld', ['upper zone', 'apex', 'below the clavicle'], ['oberfeld', 'lungenspitze', 'infraklavikulär'], 'front', true],
  ['chest.mid-zone', 'mid-zone', 'mid zone', 'Mittelfeld', ['mid zone', 'middle zone', 'front of the chest'], ['mittelfeld', 'vorne'], 'front', false],
  ['chest.axilla', 'axilla', 'axilla', 'Axilla', ['axilla', 'side of the chest', 'armpit'], ['axilla', 'achsel', 'seitlich'], 'side', false],
  ['chest.upper-back', 'upper-back', 'upper back', 'oberer Rücken', ['upper back', 'between the scapulae'], ['oberer rücken', 'interskapulär'], 'back', false],
  ['chest.lung-base', 'base', 'lung base', 'Lungenbasis', ['lung base', 'bases', 'back of the chest', 'lower zone'], ['lungenbasis', 'basal', 'unterfeld', 'rücken'], 'back', true],
];
const BACK: ManoeuvreDef['requires'] = { position: ['sitting', 'sitting-forward', 'standing'], exposure: ['chest'] };
function lungManoeuvres([site, key, en, de, enPh, dePh, face, listed]: LungSite): ManoeuvreDef[] {
  const reach = face === 'back' ? BACK : { exposure: ['chest'] };
  const base = { target: site, paired: true, durationSeconds: 15, hidden: !listed } as const;
  return [
    { ...base, id: key === 'base' ? 'auscultate.lung-base' : `auscultate.lung-${key}`, verb: 'auscultate',
      label: { en: `Breath sounds: ${en}`, de: `Atemgeräusch: ${de}` },
      phrases: { en: [...enPh.map((p) => `listen ${p}`), ...(key === 'base' ? ['listen to the lungs', 'listen to the chest', 'lungs', 'chest', 'breath sounds', 'chest auscultation', 'auscultate lungs'] : [])],
        de: [...dePh.map((p) => `abhören ${p}`), ...(key === 'base' ? ['lunge abhören', 'lunge', 'lungen', 'thorax abhören', 'atemgeräusch', 'lunge auskultieren'] : [])] },
      reveals: [{ property: 'lung.sounds', context: { site } }],
      context: { site, instrument: 'stethoscope-diaphragm', respiration: 'quiet' },
      requires: { instrument: ['stethoscope-diaphragm'], ...reach }, durationSeconds: 20 },
    { ...base, id: `percuss.lung-${key}`, verb: 'percuss',
      label: { en: `Percussion: ${en}`, de: `Perkussion: ${de}` },
      phrases: { en: [...enPh.map((p) => `percuss ${p}`), ...(key === 'base' ? ['percuss the chest', 'percussion', 'percuss the lungs', 'chest', 'lungs'] : [])],
        de: [...dePh.map((p) => `perkutieren ${p}`), ...(key === 'base' ? ['thorax perkutieren', 'perkussion', 'lunge perkutieren', 'lunge', 'lungen', 'thorax', 'klopfschall'] : [])] },
      reveals: [{ property: 'chest.percussion', context: { site } }], context: { site },
      requires: { instrument: ['hands'], ...reach } },
    { ...base, id: `resonance.lung-${key}`, verb: 'auscultate', hidden: key !== 'base',
      label: { en: `Vocal resonance: ${en}`, de: `Bronchophonie: ${de}` },
      phrases: { en: [...enPh.map((p) => `vocal resonance ${p}`), ...(key === 'base' ? ['vocal resonance', 'say 99', 'tactile fremitus', 'vocal fremitus'] : [])],
        de: [...dePh.map((p) => `bronchophonie ${p}`), ...(key === 'base' ? ['bronchophonie', 'stimmfremitus', '66 sagen', 'sechsundsechzig'] : [])] },
      reveals: [{ property: 'chest.resonance', context: { site } }], context: { site, instrument: 'stethoscope-diaphragm' },
      requires: { instrument: ['stethoscope-diaphragm', 'hands'], ability: ['follows-commands'], ...reach } },
  ];
}

/* ---- oxygen: a device and the inspired fraction it gives ---------------------------------------------- */
/** Also read by the interventions (ADR-018), so a scenario's oxygen is the same device and fraction as the encounter's. */
export const OXYGEN: Array<[string, string, number, string, string, string[], string[]]> = [
  ['nasal-2', 'nasal cannula 2 L/min', 0.28, 'Oxygen: nasal cannula 2 L/min', 'Sauerstoff: Nasenbrille 2 l/min', ['nasal cannula', 'nasal specs', 'oxygen 2 litres', 'low flow oxygen'], ['nasenbrille', '2 liter sauerstoff', 'sauerstoff über nasenbrille']],
  ['venturi-28', 'Venturi mask 28 %', 0.28, 'Oxygen: Venturi mask 28 %', 'Sauerstoff: Venturi-Maske 28 %', ['venturi 28', '28 percent venturi', 'controlled oxygen'], ['venturi 28', 'venturimaske 28', 'kontrollierte sauerstoffgabe']],
  ['venturi-35', 'Venturi mask 35 %', 0.35, 'Oxygen: Venturi mask 35 %', 'Sauerstoff: Venturi-Maske 35 %', ['venturi 35', '35 percent venturi'], ['venturi 35', 'venturimaske 35']],
  ['mask-6', 'simple face mask 6 L/min', 0.40, 'Oxygen: simple face mask 6 L/min', 'Sauerstoff: einfache Gesichtsmaske 6 l/min', ['face mask', 'oxygen mask', 'simple mask'], ['gesichtsmaske', 'sauerstoffmaske', 'maske 6 liter']],
  ['nrb-15', 'non-rebreather mask 15 L/min', 0.80, 'Oxygen: non-rebreather mask 15 L/min', 'Sauerstoff: Maske mit Reservoirbeutel 15 l/min', ['non-rebreather', 'reservoir mask', 'high flow oxygen', '15 litres', 'give oxygen'], ['reservoirmaske', 'maske mit reservoir', '15 liter sauerstoff', 'hochdosiert sauerstoff', 'sauerstoff geben']],
  ['off', 'room air', 0.21, 'Oxygen off (room air)', 'Sauerstoff aus (Raumluft)', ['stop oxygen', 'room air', 'take the oxygen off'], ['sauerstoff beenden', 'raumluft', 'sauerstoff absetzen']],
];

export const MANOEUVRES: ManoeuvreDef[] = [
  /* ---- general and vital signs -------------------------------------------- */
  {
    id: 'inspect.general', verb: 'inspect', target: 'general',
    label: { en: 'General inspection', de: 'Allgemeine Inspektion' },
    phrases: { en: ['look at the patient', 'general inspection', 'end of the bed', 'general appearance', 'inspect'],
      de: ['patient ansehen', 'inspektion', 'allgemeinzustand', 'vom bettende', 'aspekt'] },
    reveals: [{ property: 'general.appearance' }], durationSeconds: 15,
  },
  {
    id: 'measure.hr', verb: 'measure', target: 'vitals',
    label: { en: 'Heart rate', de: 'Herzfrequenz' },
    phrases: { en: ['heart rate', 'hr', 'pulse rate'], de: ['herzfrequenz', 'hf', 'puls zählen'] },
    reveals: [{ property: 'vitals.hr' }], requires: { instrument: ['watch', 'pulse-oximeter'] }, durationSeconds: 30,
  },
  {
    id: 'measure.bp', verb: 'measure', target: 'arm', paired: true,
    label: { en: 'Blood pressure', de: 'Blutdruck' },
    phrases: { en: ['blood pressure', 'bp', 'measure bp'], de: ['blutdruck', 'rr', 'rr messen', 'blutdruck messen'] },
    reveals: [{ property: 'vitals.bp' }], requires: { instrument: ['bp-cuff'], exposure: ['arm'] }, durationSeconds: 60,
  },
  {
    id: 'measure.rr', verb: 'measure', target: 'vitals',
    label: { en: 'Respiratory rate', de: 'Atemfrequenz' },
    phrases: { en: ['respiratory rate', 'rr', 'breathing rate'], de: ['atemfrequenz', 'af', 'atemzüge zählen'] },
    reveals: [{ property: 'vitals.rr' }], requires: { instrument: ['watch'] }, durationSeconds: 30,
  },
  {
    id: 'measure.spo2', verb: 'measure', target: 'vitals',
    label: { en: 'Pulse oximetry (SpO₂)', de: 'Pulsoxymetrie (SpO₂)' },
    phrases: { en: ['saturation', 'sats', 'spo2', 'oxygen'], de: ['sättigung', 'spo2', 'sauerstoffsättigung', 'pulsoxymetrie'] },
    reveals: [{ property: 'vitals.spo2' }], requires: { instrument: ['pulse-oximeter'] }, durationSeconds: 20,
  },
  {
    id: 'measure.temp', verb: 'measure', target: 'vitals',
    label: { en: 'Temperature', de: 'Körpertemperatur' },
    phrases: { en: ['temperature', 'temp', 'fever'], de: ['temperatur', 'fieber messen'] },
    reveals: [{ property: 'vitals.temp' }], requires: { instrument: ['thermometer'] }, durationSeconds: 30,
  },

  /* ---- cardiovascular ------------------------------------------------------- */
  {
    id: 'palpate.pulse.radial', verb: 'palpate', target: 'wrist.radial', paired: true,
    label: { en: 'Radial pulse', de: 'Radialispuls' },
    phrases: { en: ['radial pulse', 'feel the pulse', 'take the pulse', 'pulse at the wrist', 'pulse'], de: ['radialispuls', 'puls tasten', 'puls fühlen', 'puls'] },
    reveals: [{ property: 'pulse.radial' }], requires: { instrument: ['hands'] }, durationSeconds: 20,
  },
  {
    id: 'palpate.pulse.carotid', verb: 'palpate', target: 'neck.carotid', paired: true,
    label: { en: 'Carotid pulse', de: 'Karotispuls' },
    phrases: { en: ['carotid pulse', 'feel the carotid'], de: ['karotispuls', 'carotispuls', 'karotis tasten'] },
    reveals: [{ property: 'pulse.carotid' }], requires: { instrument: ['hands'] }, durationSeconds: 15,
  },
  {
    id: 'inspect.jvp', verb: 'inspect', target: 'neck.jugular',
    label: { en: 'Jugular venous pressure (JVP)', de: 'Jugularvenendruck' },
    phrases: { en: ['jvp', 'jugular venous pressure', 'neck veins'], de: ['halsvenen', 'jvd', 'jugularvenen', 'halsvenenstauung'] },
    reveals: [{ property: 'jvp' }], requires: { position: ['reclined-45'], exposure: ['neck'] }, durationSeconds: 30,
  },
  {
    id: 'palpate.apex', verb: 'palpate', target: 'chest.mitral-area',
    label: { en: 'Apex beat', de: 'Herzspitzenstoß' },
    phrases: { en: ['apex beat', 'palpate apex', 'feel the apex'], de: ['herzspitzenstoß', 'spitzenstoß tasten', 'hss'] },
    reveals: [{ property: 'apex' }], requires: { instrument: ['hands'], exposure: ['chest'] }, durationSeconds: 15,
  },
  auscultate('chest.aortic-area', 'aortic area (2nd right ICS)', 'Aortenareal (2. ICR rechts)',
    /* "Listen to the heart" starts here, the first area in the menu; the view then offers the others. */
    ['aortic area', 'listen aortic', '2nd right intercostal space', 'heart', 'heart sounds'], ['aortenareal', 'aorta abhören', '2. icr rechts', 'herz', 'herztöne']),
  auscultate('chest.pulmonary-area', 'pulmonary area (2nd left ICS)', 'Pulmonalareal (2. ICR links)',
    ['pulmonary area', 'listen pulmonary', '2nd left intercostal space'], ['pulmonalareal', '2. icr links']),
  auscultate('chest.erb', "Erb's point (3rd left ICS)", 'Erb-Punkt (3. ICR links)', ["erb's point", 'erb', '3rd left intercostal space'], ['erb', 'erb-punkt', '3. icr links']),
  auscultate('chest.tricuspid-area', 'tricuspid area (4th left ICS)', 'Trikuspidalareal (4. ICR links)',
    ['tricuspid area', 'lower left sternal edge'], ['trikuspidalareal', '4. icr links']),
  auscultate('chest.mitral-area', 'mitral area (apex)', 'Mitralareal (Herzspitze)',
    ['mitral area', 'listen at the apex', 'apex with diaphragm'], ['mitralareal', 'herzspitze abhören']),
  {
    id: 'auscultate.heart.apex-bell-left-lateral', verb: 'auscultate', target: 'chest.mitral-area',
    label: { en: 'Apex with the bell, left lateral', de: 'Herzspitze mit Trichter, Linksseitenlage' },
    phrases: { en: ['bell at the apex', 'left lateral', 'roll onto left side and listen'], de: ['trichter herzspitze', 'linksseitenlage', 'linksseitenlage abhören'] },
    reveals: [{ property: 'heart.sounds', context: { site: 'chest.mitral-area' } }],
    context: { site: 'chest.mitral-area', instrument: 'stethoscope-bell', position: 'left-lateral', respiration: 'held-expiration' },
    requires: { instrument: ['stethoscope-bell'], exposure: ['chest'], position: ['left-lateral'] },
    durationSeconds: 30,
  },
  {
    id: 'auscultate.heart.lse-sitting-forward', verb: 'auscultate', target: 'chest.erb',
    label: { en: 'Left sternal edge, sitting forward, in expiration', de: 'Linker Sternalrand, vorgebeugt, in Exspiration' },
    phrases: { en: ['sitting forward', 'lean forward and listen', 'held expiration'], de: ['vorgebeugt', 'nach vorne beugen', 'exspiration abhören'] },
    reveals: [{ property: 'heart.sounds', context: { site: 'chest.erb' } }],
    context: { site: 'chest.erb', instrument: 'stethoscope-diaphragm', position: 'sitting-forward', respiration: 'held-expiration' },
    requires: { instrument: ['stethoscope-diaphragm'], exposure: ['chest'], position: ['sitting-forward'] },
    durationSeconds: 30,
  },
  {
    id: 'auscultate.carotid', verb: 'auscultate', target: 'neck.carotid', paired: true,
    label: { en: 'Auscultation of the carotids', de: 'Auskultation der Karotiden' },
    phrases: { en: ['listen to the carotid', 'carotid bruit', 'auscultate carotid'], de: ['karotis abhören', 'karotis auskultieren', 'strömungsgeräusch hals'] },
    reveals: [{ property: 'heart.sounds', context: { site: 'neck.carotid' } }],
    context: { site: 'neck.carotid', instrument: 'stethoscope-bell', respiration: 'held-expiration' },
    requires: { instrument: ['stethoscope-bell', 'stethoscope-diaphragm'] }, durationSeconds: 15,
  },
  ...LUNG_SITES.flatMap(lungManoeuvres),
  {
    id: 'inspect.breathing', verb: 'inspect', target: 'chest',
    label: { en: 'Breathing pattern and work of breathing', de: 'Atemmuster und Atemarbeit' },
    phrases: { en: ['watch the breathing', 'look at the breathing', 'work of breathing', 'accessory muscles', 'respiratory pattern', 'is he breathless', 'is she breathless', 'can they speak'],
      de: ['atmung beobachten', 'atemmuster', 'atemarbeit', 'atemhilfsmuskulatur', 'dyspnoe beurteilen', 'sprechdyspnoe'] },
    reveals: [{ property: 'breathing.pattern' }, { property: 'vitals.rr' }], durationSeconds: 30,
  },
  {
    id: 'palpate.trachea', verb: 'palpate', target: 'neck.trachea',
    label: { en: 'Tracheal position', de: 'Trachealage' },
    phrases: { en: ['trachea', 'tracheal position', 'feel the trachea', 'tracheal deviation'], de: ['trachea', 'trachealage', 'trachea tasten', 'trachealverlagerung'] },
    reveals: [{ property: 'trachea.position' }], requires: { instrument: ['hands'] }, durationSeconds: 10,
  },
  {
    id: 'palpate.chest-expansion', verb: 'palpate', target: 'chest',
    label: { en: 'Chest expansion', de: 'Thoraxexkursion' },
    phrases: { en: ['chest expansion', 'expansion', 'hands on the chest', 'symmetry of expansion'], de: ['thoraxexkursion', 'atemexkursion', 'thoraxbeweglichkeit', 'seitengleiche atemexkursion'] },
    reveals: [{ property: 'chest.expansion', side: 'both' }], requires: { instrument: ['hands'], exposure: ['chest'] }, durationSeconds: 15,
  },
  ...OXYGEN.map(([id, device, fio2, en, de, enPh, dePh]): ManoeuvreDef => ({
    id: `give.oxygen.${id}`, verb: 'give', target: 'airway',
    label: { en, de }, phrases: { en: enPh, de: dePh },
    reveals: [], durationSeconds: 30, sets: { oxygen: { device, fio2 } },
  })),

  {
    id: 'measure.crt', verb: 'measure', target: 'hands',
    label: { en: 'Capillary refill time', de: 'Rekapillarisierungszeit' },
    phrases: { en: ['capillary refill', 'crt', 'press on the nail'], de: ['rekapillarisierung', 'rekapillarisierungszeit', 'nagelbett drücken'] },
    reveals: [{ property: 'hands.crt' }], requires: { instrument: ['hands'] }, durationSeconds: 10,
  },
  {
    id: 'inspect.legs', verb: 'palpate', target: 'legs',
    label: { en: 'Legs: pressure test for oedema', de: 'Unterschenkel: Ödemprüfung durch Fingerdruck' },
    phrases: { en: ['ankle oedema', 'ankle edema', 'swollen ankles', 'pitting', 'look at the legs'], de: ['ödeme', 'beinödeme', 'knöchelödeme', 'beine ansehen'] },
    reveals: [{ property: 'legs.oedema' }], requires: { instrument: ['hands'] }, durationSeconds: 15,
  },
  {
    id: 'inspect.sclera', verb: 'inspect', target: 'eyes',
    label: { en: 'Inspection of the sclerae', de: 'Inspektion der Skleren' },
    phrases: { en: ['sclera', 'sclerae', 'whites of the eyes', 'jaundice', 'icterus', 'yellow eyes'], de: ['skleren', 'sklera', 'ikterus', 'gelbe augen', 'gelbsucht'] },
    reveals: [{ property: 'eyes.sclera' }], durationSeconds: 10,
  },
  {
    id: 'inspect.conjunctiva', verb: 'inspect', target: 'eyes',
    label: { en: 'Inspection of the conjunctivae', de: 'Inspektion der Konjunktiven' },
    phrases: { en: ['conjunctiva', 'conjunctival pallor', 'pallor', 'anaemia', 'pale', 'lower eyelid'], de: ['konjunktiven', 'bindehaut', 'blässe', 'anämie', 'unterlid'] },
    reveals: [{ property: 'eyes.conjunctiva' }], durationSeconds: 10,
  },
  {
    id: 'test.arms-outstretched', verb: 'test', target: 'hands',
    label: { en: 'Arms outstretched, fingers spread, then wrists bent back', de: 'Arme vorhalten, Finger spreizen, dann Handgelenke dorsalflektieren' },
    phrases: { en: ['tremor', 'fine tremor', 'shaky hands', 'fingers spread', 'paper on the hands', 'asterixis', 'flap', 'liver flap', 'hold your hands out', 'cock your wrists', 'arms outstretched', 'hold your arms out', 'arms out in front'],
      de: ['tremor', 'zittern', 'feinschlägiger tremor', 'finger spreizen', 'blatt auf die hände', 'flapping tremor', 'asterixis', 'hände vorhalten', 'flattern', 'arme vorhalten'] },
    reveals: [{ property: 'hands.tremor' }, { property: 'hands.asterixis' }], durationSeconds: 45,
  },
  {
    id: 'test.shifting-dullness', verb: 'percuss', target: 'abdomen',
    label: { en: 'Percussion of the flanks, then on the side', de: 'Perkussion der Flanken mit Lagewechsel' },
    phrases: { en: ['shifting dullness', 'ascites', 'percuss the abdomen', 'fluid thrill', 'flank dullness'], de: ['flankendämpfung', 'aszites', 'abdomen perkutieren', 'undulation', 'bauch abklopfen'] },
    reveals: [{ property: 'abdomen.ascites' }], requires: { instrument: ['hands'], position: ['supine'], exposure: ['abdomen'] }, durationSeconds: 60,
  },
  {
    id: 'examine.rectal', verb: 'palpate', target: 'rectum',
    label: { en: 'Digital rectal examination (DRE)', de: 'Digital-rektale Untersuchung (DRU)' },
    phrases: { en: ['rectal', 'pr', 'digital rectal', 'per rectum', 'melaena', 'dre'], de: ['rektal', 'dru', 'digital rektal', 'rektale untersuchung', 'meläna'] },
    reveals: [{ property: 'rectal.exam' }], requires: { instrument: ['hands'], position: ['left-lateral'], consent: 'chaperone' }, durationSeconds: 90,
  },
  {
    id: 'inspect.skin', verb: 'inspect', target: 'skin',
    label: { en: 'Inspection of skin, hands and chest wall', de: 'Inspektion von Haut, Händen und Thoraxwand' },
    phrases: { en: ['spider naevi', 'palmar erythema', 'liver stigmata', 'stigmata of chronic liver disease', 'caput medusae', 'skin', 'look at the hands', 'inspect the hands', 'hands'],
      de: ['spider naevi', 'palmarerythem', 'leberhautzeichen', 'caput medusae', 'haut', 'hände ansehen', 'hände inspizieren', 'hände'] },
    reveals: [{ property: 'skin.liver-stigmata' }], requires: { exposure: ['chest', 'abdomen'] }, durationSeconds: 30,
  },
  {
    id: 'inspect.pigmentation', verb: 'inspect', target: 'skin',
    label: { en: 'Inspection of palmar creases, buccal mucosa and scars', de: 'Inspektion von Handlinien, Wangenschleimhaut und Narben' },
    phrases: { en: ['pigmentation', 'palmar creases', 'buccal pigmentation', 'tanned', 'skin colour', 'hyperpigmentation'], de: ['pigmentierung', 'handlinien', 'wangenschleimhaut', 'gebräunt', 'hautfarbe', 'hyperpigmentierung'] },
    reveals: [{ property: 'skin.pigmentation' }], requires: { instrument: ['pen-torch'] }, durationSeconds: 20,
  },
  {
    id: 'palpate.thyroid', verb: 'palpate', target: 'neck.thyroid',
    label: { en: 'Thyroid examination', de: 'Schilddrüsenuntersuchung' },
    phrases: { en: ['thyroid', 'goitre', 'goiter', 'feel the neck', 'neck lump', 'thyroid bruit', 'swallow'], de: ['schilddrüse', 'struma', 'hals tasten', 'knoten am hals', 'schwirren', 'schlucken'] },
    reveals: [{ property: 'neck.thyroid' }], requires: { instrument: ['hands', 'stethoscope-bell'], position: ['sitting'] }, durationSeconds: 60,
  },
  {
    id: 'inspect.thyroid-eyes', verb: 'inspect', target: 'eyes',
    label: { en: 'Eyes from the front and side, following a finger down', de: 'Augen von vorn und seitlich, Blickfolge nach unten' },
    phrases: { en: ['lid lag', 'lid retraction', 'exophthalmos', 'proptosis', 'stare', 'thyroid eyes', 'eye signs'], de: ['graefe', 'lidretraktion', 'exophthalmus', 'protrusio', 'starrer blick', 'augenzeichen'] },
    reveals: [{ property: 'eyes.thyroid' }], durationSeconds: 30,
  },
  {
    id: 'inspect.mouth', verb: 'inspect', target: 'mouth',
    label: { en: 'Oral mucosa', de: 'Mundschleimhaut' },
    phrases: { en: ['look in the mouth', 'mucous membranes', 'mucosa', 'dry mouth', 'tongue dry', 'hydration'], de: ['mund ansehen', 'schleimhäute', 'mundschleimhaut', 'zunge trocken', 'exsikkose', 'hydratation'] },
    reveals: [{ property: 'mouth.mucosa' }], requires: { instrument: ['pen-torch'] }, durationSeconds: 15,
  },
  {
    id: 'test.turgor', verb: 'palpate', target: 'skin',
    label: { en: 'Skin turgor', de: 'Hautturgor' },
    phrases: { en: ['skin turgor', 'turgor', 'pinch the skin', 'skin fold'], de: ['hautturgor', 'turgor', 'hautfalte', 'stehende hautfalten'] },
    reveals: [{ property: 'skin.turgor' }], requires: { instrument: ['hands'] }, durationSeconds: 10,
  },
  {
    id: 'smell.breath', verb: 'inspect', target: 'mouth',
    label: { en: 'Breath odour (fetor)', de: 'Foetor ex ore' },
    phrases: { en: ['smell the breath', 'breath smell', 'ketones on breath', 'acetone', 'fetor'], de: ['atemgeruch', 'foetor', 'aceton', 'azetongeruch', 'mundgeruch'] },
    reveals: [{ property: 'breath.odour' }], durationSeconds: 5,
  },
  {
    id: 'measure.bp.lying-standing', verb: 'measure', target: 'arm', paired: true,
    label: { en: 'Lying and standing blood pressure', de: 'Schellong-Test' },
    phrases: { en: ['lying and standing', 'postural blood pressure', 'orthostatic', 'standing blood pressure', 'postural drop'], de: ['schellong', 'orthostase', 'blutdruck im stehen', 'liegend und stehend', 'orthostatischer'] },
    reveals: [{ property: 'vitals.bp', side: 'same', context: { position: 'supine' } }, { property: 'vitals.hr', context: { position: 'supine' } },
      { property: 'vitals.bp', side: 'same', context: { position: 'standing' } }, { property: 'vitals.hr', context: { position: 'standing' } }],
    requires: { instrument: ['bp-cuff'], exposure: ['arm'], ability: ['can-stand'] }, durationSeconds: 300,
  },
  {
    id: 'palpate.abdomen', verb: 'palpate', target: 'abdomen',
    label: { en: 'Abdominal palpation', de: 'Palpation des Abdomens' },
    phrases: { en: ['palpate the abdomen', 'feel the abdomen', 'feel the tummy', 'abdominal examination'], de: ['bauch abtasten', 'abdomen palpieren', 'bauch untersuchen'] },
    reveals: [{ property: 'abdomen.palpation' }], requires: { instrument: ['hands'], position: ['supine'], exposure: ['abdomen'] }, durationSeconds: 60,
  },

  /* ---- eyes ----------------------------------------------------------------- */
  {
    id: 'inspect.eyes', verb: 'inspect', target: 'eyes',
    label: { en: 'Inspection of the eyes at rest', de: 'Inspektion der Augen in Ruhe' },
    phrases: { en: ['look at the eyes', 'inspect eyes', 'pupil size', 'ptosis', 'eyelids'], de: ['augen ansehen', 'augen inspizieren', 'pupillenweite', 'ptosis', 'lidspalte'] },
    reveals: [{ property: 'eye.pupil', side: 'both' }, { property: 'eye.lid', side: 'both' }, { property: 'eyes.nystagmus', context: { gaze: 'primary' } }],
    context: { lightOn: 'none', ambient: 'room', fixation: true, gaze: 'primary' }, durationSeconds: 10,
  },
  {
    id: 'inspect.eyes.dim', verb: 'inspect', target: 'eyes',
    label: { en: 'Pupils in dim light', de: 'Pupillen im Halbdunkel' },
    phrases: { en: ['dim the lights', 'pupils in the dark', 'dim light'], de: ['licht dimmen', 'abdunkeln', 'pupillen im dunkeln'] },
    reveals: [{ property: 'eye.pupil', side: 'both' }],
    context: { lightOn: 'none', ambient: 'dim' }, durationSeconds: 15,
  },
  {
    id: 'test.pupils.light', verb: 'test', target: 'eye', paired: true,
    label: { en: 'Pupillary light reflex', de: 'Pupillenlichtreaktion' },
    phrases: { en: ['light reflex', 'shine a light', 'pupillary light', 'direct and consensual'], de: ['lichtreaktion', 'pupillenreaktion', 'direkt und konsensuell', 'leuchten'] },
    reveals: [{ property: 'eye.pupil', side: 'same' }, { property: 'eye.pupil', side: 'other' }],
    sideContext: ['lightOn'], context: { ambient: 'room' },
    requires: { instrument: ['pen-torch'] }, durationSeconds: 10,
  },
  {
    id: 'test.swinging-light', verb: 'test', target: 'eyes',
    label: { en: 'Swinging flashlight test', de: 'Swinging-Flashlight-Test' },
    phrases: { en: ['swinging light', 'swinging flashlight', 'rapd', 'marcus gunn'], de: ['swinging flashlight', 'wechselbelichtung', 'rapd'] },
    reveals: [{ property: 'eyes.swinging-light' }],
    requires: { instrument: ['pen-torch'] }, durationSeconds: 20,
  },
  {
    id: 'test.eye-movements', verb: 'test', target: 'eyes',
    label: { en: 'Eye movements (H test)', de: 'Okulomotorik (Folgebewegungen)' },
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
    label: { en: 'Frenzel goggles', de: 'Frenzel-Brille' },
    phrases: { en: ['frenzel', 'remove fixation', 'nystagmus without fixation'], de: ['frenzel', 'frenzelbrille', 'ohne fixation'] },
    reveals: GAZES.map((gaze) => ({ property: 'eyes.nystagmus', context: { gaze, fixation: false } })),
    context: { fixation: false, instrument: 'frenzel' },
    requires: { instrument: ['frenzel'] }, durationSeconds: 60,
  },
  {
    id: 'test.head-impulse', verb: 'test', target: 'eyes', paired: true,
    label: { en: 'Head impulse test', de: 'Kopfimpulstest (Halmagyi)' },
    phrases: { en: ['head impulse', 'head thrust', 'hit', 'halmagyi'], de: ['kopfimpuls', 'kopfimpulstest', 'halmagyi', 'kopfdrehtest'] },
    reveals: [{ property: 'eye.head-impulse' }],
    sideContext: ['headImpulseTo'],
    requires: { ability: ['can-fixate'] }, durationSeconds: 10,
    hazards: [{ ifState: { immobilised: 'spine.cervical' }, code: 'hit-cervical-spine',
      why: { en: 'Rapid head rotation with an unprotected cervical spine.', de: 'Schnelle Kopfdrehung bei nicht freigegebener Halswirbelsäule.' } }],
  },
  {
    id: 'test.cover', verb: 'test', target: 'eyes',
    label: { en: 'Cover test', de: 'Abdecktest (Cover-Test)' },
    phrases: { en: ['cover test', 'alternate cover', 'skew', 'test of skew'], de: ['abdecktest', 'cover-test', 'alternierender abdecktest', 'skew'] },
    /* in primary gaze (the test of skew), and looking up and down: a nerve palsy's vertical deviation changes with gaze, a skew's does not */
    reveals: [{ property: 'eyes.alignment' }, { property: 'eyes.alignment', context: { gaze: 'up' } }, { property: 'eyes.alignment', context: { gaze: 'down' } }],
    context: { gaze: 'primary' }, requires: { ability: ['can-fixate'] }, durationSeconds: 20,
  },
  {
    id: 'test.visual-fields', verb: 'test', target: 'eye', paired: true,
    label: { en: 'Visual fields by confrontation', de: 'Fingerperimetrie' },
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
    label: { en: 'Whispered voice test', de: 'Flüstersprachprüfung' },
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
    label: { en: 'Romberg test', de: 'Romberg-Stehversuch' },
    phrases: { en: ['romberg', 'feet together', 'stand with eyes closed'], de: ['romberg', 'stehversuch', 'füße zusammen', 'augen schließen im stehen'] },
    reveals: [{ property: 'posture.romberg', context: { eyesClosed: false } }, { property: 'posture.romberg', context: { eyesClosed: true } }],
    requires: { position: ['standing'], ability: ['can-stand', 'follows-commands'] }, durationSeconds: 60,
    hazards: [{ ifState: { physiology: { key: 'Pmean', below: 60 } }, code: 'stand-while-hypotensive',
      why: { en: 'Standing a hypotensive patient risks syncope and a fall.', de: 'Aufstehen bei Hypotonie: Synkopen- und Sturzgefahr.' } }],
  },
  {
    id: 'test.gait', verb: 'test', target: 'gait',
    label: { en: 'Gait', de: 'Gangbild' },
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

  /* ---- neurological: cranial nerves and speech ------------------------------------ */
  {
    id: 'test.face-movement', verb: 'test', target: 'face',
    label: { en: 'Facial nerve (VII)', de: 'N. facialis (VII)' },
    phrases: { en: ['facial movement', 'raise your eyebrows', 'show your teeth', 'facial nerve', 'smile', 'close your eyes tightly', 'face'], de: ['mimik', 'stirn runzeln', 'zähne zeigen', 'fazialis', 'augen zukneifen', 'lächeln', 'gesicht'] },
    reveals: [{ property: 'face.movement', side: 'both' }], requires: { ability: ['follows-commands'] }, durationSeconds: 20,
  },
  {
    id: 'test.face-sensation', verb: 'test', target: 'face',
    label: { en: 'Trigeminal nerve: facial sensation and corneal reflex (V)', de: 'N. trigeminus: Gesichtssensibilität und Kornealreflex (V)' },
    phrases: { en: ['facial sensation', 'trigeminal', 'corneal reflex', 'sensation on the face'], de: ['gesichtssensibilität', 'trigeminus', 'kornealreflex', 'gefühl im gesicht'] },
    reveals: [{ property: 'face.sensation', side: 'both' }], requires: { instrument: ['cotton-wool', 'neurotip'] }, durationSeconds: 40,
  },
  {
    id: 'test.jaw', verb: 'test', target: 'jaw',
    label: { en: 'Trigeminal nerve: jaw opening (V)', de: 'N. trigeminus: Mundöffnung (V)' },
    phrases: { en: ['jaw', 'open your mouth', 'masseter', 'jaw jerk'], de: ['kiefer', 'mund öffnen', 'kaumuskulatur', 'masseter'] },
    reveals: [{ property: 'jaw.opening' }], requires: { ability: ['follows-commands'] }, durationSeconds: 10,
  },
  {
    id: 'test.palate', verb: 'inspect', target: 'mouth',
    label: { en: 'Palate and gag reflex (IX, X)', de: 'Gaumensegel und Würgreflex (IX, X)' },
    phrases: { en: ['say aah', 'palate', 'uvula', 'gag reflex', 'gag'], de: ['aaa sagen', 'gaumensegel', 'uvula', 'würgreflex', 'zäpfchen'] },
    reveals: [{ property: 'mouth.palate' }], requires: { instrument: ['tongue-depressor', 'pen-torch'] }, durationSeconds: 20,
  },
  {
    id: 'test.tongue', verb: 'inspect', target: 'mouth',
    label: { en: 'Hypoglossal nerve: tongue (XII)', de: 'N. hypoglossus: Zunge (XII)' },
    phrases: { en: ['tongue', 'stick out your tongue', 'hypoglossal'], de: ['zunge', 'zunge herausstrecken', 'hypoglossus'] },
    reveals: [{ property: 'mouth.tongue' }], requires: { ability: ['follows-commands'] }, durationSeconds: 15,
  },
  {
    id: 'test.shrug', verb: 'test', target: 'shoulder',
    label: { en: 'Accessory nerve (XI)', de: 'N. accessorius (XI)' },
    phrases: { en: ['shrug', 'shrug your shoulders', 'accessory nerve', 'turn your head against my hand'], de: ['schultern heben', 'akzessorius', 'kopf drehen gegen widerstand'] },
    reveals: [{ property: 'shoulder.shrug', side: 'both' }], requires: { ability: ['follows-commands'] }, durationSeconds: 15,
  },
  {
    id: 'test.speech', verb: 'test', target: 'speech',
    label: { en: 'Language (aphasia screen)', de: 'Sprachprüfung (Aphasie)' },
    phrases: { en: ['speech', 'language', 'naming', 'repetition', 'no ifs ands or buts', 'aphasia', 'dysarthria'], de: ['sprache', 'sprachprüfung', 'benennen', 'nachsprechen', 'aphasie', 'dysarthrie'] },
    reveals: [{ property: 'speech.language' }], durationSeconds: 90,
  },
  {
    id: 'test.count-to-50', verb: 'test', target: 'speech',
    label: { en: 'Counting to 50 (speech fatigue)', de: 'Zählen bis 50 (Ermüdbarkeit der Sprache)' },
    phrases: { en: ['count to 50', 'count to fifty', 'bulbar fatigue'], de: ['bis 50 zählen', 'bis fünfzig zählen'] },
    reveals: [{ property: 'speech.fatigue', context: { repetition: 50 } }], requires: { ability: ['follows-commands'] }, durationSeconds: 40,
  },
  {
    id: 'test.sustained-upgaze', verb: 'test', target: 'eyes',
    label: { en: 'Sustained upgaze (Simpson test)', de: 'Simpson-Test' },
    phrases: { en: ['sustained upgaze', 'look up for a minute', 'fatigability', 'simpson'], de: ['simpson', 'nach oben blicken eine minute', 'ermüdbarkeit'] },
    reveals: [{ property: 'eye.lid', side: 'both', context: { sustainedSeconds: 60, gaze: 'up' } }], requires: { ability: ['follows-commands'] }, durationSeconds: 70,
  },

  /* ---- neurological: limbs and trunk -------------------------------------------- */
  ...(['arm', 'leg'] as const).flatMap((limb): ManoeuvreDef[] => {
    const A = limb === 'arm';
    const L = A ? { en: 'arm', de: 'Arm', enPl: 'arms', dePl: 'Arme' } : { en: 'leg', de: 'Bein', enPl: 'legs', dePl: 'Beine' };
    return [
      { id: `test.${limb}.tone`, verb: 'palpate', target: limb, paired: true,
        label: { en: `Tone: ${L.en}`, de: `Tonus: ${L.de}` },
        phrases: { en: [`${L.en} tone`, `tone in the ${L.en}`, `look at the ${L.enPl} for wasting`, 'fasciculations', 'tone'], de: [`tonus ${L.de.toLowerCase()}`, 'tonus', 'muskeltonus', 'atrophie', 'faszikulationen'] },
        reveals: [{ property: `${limb}.tone` }], durationSeconds: 30 },
      { id: `test.${limb}.power`, verb: 'test', target: limb, paired: true,
        label: { en: `Power: ${L.en}`, de: `Kraftprüfung: ${L.de}` },
        phrases: { en: [`${L.en} power`, `power in the ${L.en}`, `strength of the ${L.en}`, 'power', 'mrc', 'push against me'], de: [`kraft ${L.de.toLowerCase()}`, 'kraftprüfung', 'kraft', 'kennmuskeln', 'paresen'] },
        reveals: [{ property: `${limb}.power` }], requires: { ability: ['follows-commands'] }, durationSeconds: 60 },
      { id: `test.${limb}.reflexes`, verb: 'test', target: limb, paired: true,
        label: { en: A ? 'Reflexes: arm (biceps, supinator, triceps)' : 'Reflexes: leg (knee, ankle, plantar)', de: A ? 'Reflexe: Arm (BSR, BRR, TSR)' : 'Reflexe: Bein (PSR, ASR, Babinski)' },
        phrases: A ? { en: ['arm reflexes', 'biceps reflex', 'triceps reflex', 'supinator reflex', 'reflexes in the arm'], de: ['armreflexe', 'reflexe arm', 'bsr', 'tsr', 'rpr', 'bizepssehnenreflex', 'trizepssehnenreflex'] }
          : { en: ['leg reflexes', 'knee jerk', 'ankle jerk', 'plantar', 'babinski', 'reflexes in the leg'], de: ['beinreflexe', 'reflexe bein', 'psr', 'asr', 'babinski', 'patellarsehnenreflex', 'achillessehnenreflex'] },
        reveals: [{ property: `${limb}.reflexes` }], requires: { instrument: ['tendon-hammer'] }, durationSeconds: 40 },
      { id: `test.${limb}.pinprick`, verb: 'test', target: limb, paired: true,
        label: { en: `Pinprick: ${L.en}`, de: `Schmerzempfinden: ${L.de}` },
        phrases: { en: [`pinprick ${L.en}`, `sensation in the ${L.en}`, 'pinprick', 'dermatomes', 'sharp or blunt', 'light touch'], de: [`sensibilität ${L.de.toLowerCase()}`, 'spitz stumpf', 'sensibilität', 'dermatome', 'schmerzempfinden'] },
        reveals: [{ property: `${limb}.pinprick` }], requires: { instrument: ['neurotip', 'cotton-wool'] }, durationSeconds: 60 },
      { id: `test.${limb}.vibration`, verb: 'test', target: limb, paired: true,
        label: { en: `Vibration and joint position sense: ${L.en}`, de: `Vibration und Lagesinn: ${L.de}` },
        phrases: { en: [`vibration ${L.en}`, 'vibration sense', 'joint position sense', 'proprioception'], de: [`vibration ${L.de.toLowerCase()}`, 'pallästhesie', 'lagesinn', 'vibrationsempfinden'] },
        reveals: [{ property: `${limb}.vibration` }], requires: { instrument: ['tuning-fork-128'] }, durationSeconds: 40 },
    ];
  }),
  {
    id: 'test.power-repeated', verb: 'test', target: 'arm', paired: true,
    label: { en: 'Repeated shoulder abduction', de: 'Wiederholte Schulterabduktion' },
    phrases: { en: ['repeated shoulder abduction', 'fatigable weakness', 'repeat twenty times'], de: ['wiederholte abduktion', 'ermüdbare schwäche', 'zwanzigmal wiederholen'] },
    reveals: [{ property: 'arm.power', context: { repetition: 20 } }], requires: { ability: ['follows-commands'] }, durationSeconds: 60,
  },
  {
    id: 'test.pronator-drift', verb: 'test', target: 'arm',
    label: { en: 'Pronator drift', de: 'Armvorhalteversuch' },
    phrases: { en: ['pronator drift', 'arms out palms up', 'drift'], de: ['armvorhalteversuch', 'arme vorhalten', 'pronationstendenz'] },
    reveals: [{ property: 'arm.drift', side: 'both' }], context: { eyesClosed: true }, requires: { ability: ['follows-commands'] }, durationSeconds: 30,
  },
  {
    id: 'test.slr', verb: 'test', target: 'leg', paired: true,
    label: { en: 'Straight leg raise (Lasègue)', de: 'Lasègue-Zeichen' },
    phrases: { en: ['straight leg raise', 'slr', 'lasegue', 'sciatic stretch'], de: ['lasègue', 'lasegue', 'beinheben gestreckt'] },
    reveals: [{ property: 'leg.slr' }], requires: { position: ['supine'] }, durationSeconds: 20,
  },
  {
    id: 'test.heel-shin', verb: 'test', target: 'leg', paired: true,
    label: { en: 'Heel–shin test', de: 'Knie-Hacke-Versuch' },
    phrases: { en: ['heel shin', 'heel to shin'], de: ['knie hacke', 'knie-hacke-versuch'] },
    reveals: [{ property: 'leg.heel-shin' }], requires: { ability: ['follows-commands'], position: ['supine', 'reclined-45'] }, durationSeconds: 20,
  },
  {
    id: 'test.rapid-alternating', verb: 'test', target: 'arm', paired: true,
    label: { en: 'Rapid alternating movements', de: 'Rasche Wechselbewegungen (Diadochokinese)' },
    phrases: { en: ['rapid alternating', 'dysdiadochokinesia', 'pat your hand'], de: ['diadochokinese', 'dysdiadochokinese', 'schnell abwechselnde bewegungen'] },
    reveals: [{ property: 'arm.rapid-alternating' }], requires: { ability: ['follows-commands'] }, durationSeconds: 15,
  },
  {
    id: 'test.trunk.pinprick', verb: 'test', target: 'trunk',
    label: { en: 'Pinprick on the trunk', de: 'Spitz-stumpf-Prüfung am Rumpf' },
    phrases: { en: ['sensory level', 'pinprick on the trunk', 'trunk sensation'], de: ['sensibles niveau', 'rumpfsensibilität', 'niveau'] },
    reveals: [{ property: 'trunk.pinprick', side: 'both' }], requires: { instrument: ['neurotip'], exposure: ['chest'] }, durationSeconds: 40,
  },
  {
    id: 'test.saddle', verb: 'test', target: 'saddle',
    label: { en: 'Saddle sensation', de: 'Reithosensensibilität' },
    phrases: { en: ['saddle sensation', 'perianal sensation', 'saddle anaesthesia'], de: ['reithose', 'perianale sensibilität', 'reithosenanästhesie'] },
    reveals: [{ property: 'saddle.sensation' }], requires: { instrument: ['neurotip'], position: ['left-lateral'], consent: 'chaperone' }, durationSeconds: 60,
  },

  /* ---- positioning and exposure ------------------------------------------- */
  ...([
    ['supine', 'Supine (flat)', 'Flache Rückenlage', ['lie flat', 'lie down', 'supine'], ['flach hinlegen', 'hinlegen', 'rückenlage']],
    ['reclined-45', 'Reclined at 45°', 'Oberkörperhochlagerung 45°', ['45 degrees', 'recline', 'sit up at 45'], ['45 grad', 'halbsitzend', 'oberkörper hoch']],
    ['sitting', 'Sitting up', 'Sitzend', ['sit up', 'sitting'], ['aufsetzen', 'sitzen']],
    ['sitting-forward', 'Sitting, leaning forward', 'Sitzend, vorgebeugt', ['lean forward'], ['nach vorne beugen', 'vorbeugen']],
    ['left-lateral', 'Left lateral', 'Linksseitenlage', ['roll to the left', 'left side'], ['linksseitenlage', 'auf die linke seite']],
    ['standing', 'Standing', 'Stehend', ['stand up', 'standing'], ['aufstehen', 'stehen']],
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
