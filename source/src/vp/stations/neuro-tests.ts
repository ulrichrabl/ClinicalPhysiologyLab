import type { LocalizedText } from '../model/i18n.ts';
import type { ExamContext, Side } from '../model/types.ts';
import type { Rung } from './neuro-texts.ts';

/* ---------------------------------------------------------------------------
   The neurological station's tests: the whole examination of the nervous
   system, in the order it is done at the bedside. The eyes are here as the
   neurological examination does them (lids, pupils, movements); the eye
   station has them in depth. Each names the catalog's manoeuvres it is, the
   observations it shows, and the rungs of the ladder it reads. What each
   finding is comes from the examination model.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export type NeuroTest = 'tone' | 'power' | 'drift' | 'arm-reflexes' | 'leg-reflexes' | 'finger-nose' | 'rapid-alternating' | 'heel-shin'
  | 'romberg' | 'pull' | 'gait' | 'sensation' | 'eyes' | 'cranial' | 'speech';
export type NeuroGroup = 'motor' | 'reflexes' | 'coordination' | 'stance' | 'sensation' | 'cranial';

export interface NeuroLine { ref: string; ctx?: ExamContext; label?: LocalizedText }
export interface NeuroTestDef {
  id: NeuroTest;
  group: NeuroGroup;
  label: LocalizedText;
  /** the catalog's manoeuvres this test is (the signs it can find are theirs) */
  manoeuvres: string[];
  /** the side can be chosen for the picture */
  sided?: boolean;
  /** it is done with the eyes open and closed */
  eyes?: boolean;
  /** the observations the finding lines show */
  lines: () => NeuroLine[];
  /** the rungs of the ladder it reads, and what the pathway is on each */
  reads: Rung[];
  path: Partial<Record<Rung, LocalizedText>>;
}

export const NEURO_GROUP_LABEL: Record<NeuroGroup, LocalizedText> = {
  motor: L('Tone and power', 'Tonus und Kraft'), reflexes: L('Reflexes', 'Reflexe'), coordination: L('Coordination', 'Koordination'),
  stance: L('Stance and gait', 'Stand und Gang'), sensation: L('Sensation', 'Sensibilität'), cranial: L('Cranial nerves and speech', 'Hirnnerven und Sprache'),
};

const S2: Side[] = ['R', 'L'];
const bothSides = (prop: string, ctx?: ExamContext, label?: LocalizedText): NeuroLine[] => S2.map((S) => ({ ref: `${prop}.${S}`, ctx, label }));
const OPEN = L('Eyes open', 'Augen offen'), SHUT = L('Eyes closed', 'Augen geschlossen');

const MOTOR_PATH = {
  cortex: L('motor strip', 'Motorstreifen'), capsule: L('posterior limb', 'hinterer Schenkel'), brainstem: L('pyramid, crossing', 'Pyramide, Kreuzung'),
  cord: L('lateral corticospinal tract; anterior horn', 'Tractus corticospinalis lateralis; Vorderhorn'), root: L('ventral roots', 'Vorderwurzeln'),
  plexus: L('plexus', 'Plexus'), nerve: L('motor nerves', 'motorische Nerven'), junction: L('neuromuscular junction', 'motorische Endplatte'), muscle: L('muscle', 'Muskel'),
};

export const NEURO_TESTS: NeuroTestDef[] = [
  { id: 'tone', group: 'motor', label: L('Tone and bulk', 'Tonus und Trophik'), manoeuvres: ['test.arm.tone', 'test.leg.tone'], sided: true,
    lines: () => [...bothSides('arm.rest-tremor'), ...bothSides('arm.tone'), ...bothSides('leg.tone')],
    reads: ['cortex', 'basal-ganglia', 'capsule', 'brainstem', 'cord', 'root', 'nerve', 'muscle'], path: { ...MOTOR_PATH, 'basal-ganglia': L('substantia nigra and striatum (rigidity, rest tremor)', 'Substantia nigra und Striatum (Rigor, Ruhetremor)') } },
  { id: 'power', group: 'motor', label: L('Power', 'Kraft'), manoeuvres: ['test.arm.power', 'test.leg.power', 'test.power-repeated'], sided: true,
    lines: () => [...bothSides('arm.power'), ...bothSides('leg.power'), ...bothSides('arm.power', { repetition: 20 }, L('After 20 repetitions', 'Nach 20 Wiederholungen'))],
    reads: ['cortex', 'capsule', 'brainstem', 'cord', 'root', 'plexus', 'nerve', 'junction', 'muscle'], path: MOTOR_PATH },
  { id: 'drift', group: 'motor', label: L('Pronator drift', 'Armvorhalteversuch'), manoeuvres: ['test.pronator-drift'],
    lines: () => bothSides('arm.drift', { eyesClosed: true }),
    reads: ['cortex', 'capsule', 'brainstem', 'cord'], path: { cortex: L('motor strip, arm', 'Motorstreifen, Arm'), capsule: L('posterior limb', 'hinterer Schenkel'), brainstem: L('pyramid, crossing', 'Pyramide, Kreuzung'), cord: L('lateral corticospinal tract', 'Tractus corticospinalis lateralis') } },
  { id: 'arm-reflexes', group: 'reflexes', label: L('Arm reflexes', 'Armreflexe'), manoeuvres: ['test.arm.reflexes'], sided: true,
    lines: () => bothSides('arm.reflexes'),
    reads: ['cord', 'root', 'plexus', 'nerve', 'muscle'], path: { cord: L('C5–8 segments; the tract above damps them', 'Segmente C5–8; die Bahn von oben dämpft'), root: L('C5–6 (biceps, supinator), C7–8 (triceps)', 'C5–6 (BSR, RPR), C7–8 (TSR)'), plexus: L('brachial plexus', 'Plexus brachialis'), nerve: L('musculocutaneous, radial', 'N. musculocutaneus, N. radialis'), muscle: L('biceps, brachioradialis, triceps', 'Bizeps, Brachioradialis, Trizeps') } },
  { id: 'leg-reflexes', group: 'reflexes', label: L('Leg reflexes and plantars', 'Beinreflexe und Babinski'), manoeuvres: ['test.leg.reflexes'], sided: true,
    lines: () => bothSides('leg.reflexes'),
    reads: ['cord', 'root', 'plexus', 'nerve', 'muscle'], path: { cord: L('L3–4 and S1 segments; the tract above damps them', 'Segmente L3–4 und S1; die Bahn von oben dämpft'), root: L('L3, L4 (knee), S1 (ankle)', 'L3, L4 (PSR), S1 (ASR)'), plexus: L('lumbosacral plexus', 'Plexus lumbosacralis'), nerve: L('femoral, sciatic and tibial', 'N. femoralis, ischiadicus, tibialis'), muscle: L('quadriceps, calf', 'Quadrizeps, Wade') } },
  { id: 'finger-nose', group: 'coordination', label: L('Finger–nose', 'Finger-Nase-Versuch'), manoeuvres: ['test.finger-nose'], sided: true, eyes: true,
    lines: () => S2.flatMap((S) => [{ ref: `arm.finger-nose.${S}`, ctx: { eyesClosed: false }, label: OPEN }, { ref: `arm.finger-nose.${S}`, ctx: { eyesClosed: true }, label: SHUT }]),
    reads: ['cerebellum', 'cord', 'root', 'nerve'], path: { cerebellum: L('hemisphere, same side', 'Hemisphäre, gleiche Seite'), cord: L('dorsal columns (eyes closed)', 'Hinterstränge (Augen zu)'), root: L('dorsal roots', 'Hinterwurzeln'), nerve: L('sensory nerves', 'sensible Nerven') } },
  { id: 'rapid-alternating', group: 'coordination', label: L('Rapid alternating movements', 'Diadochokinese'), manoeuvres: ['test.rapid-alternating'], sided: true,
    lines: () => bothSides('arm.rapid-alternating'),
    reads: ['cerebellum', 'cortex', 'basal-ganglia', 'capsule'], path: { cerebellum: L('hemisphere, same side', 'Hemisphäre, gleiche Seite'), cortex: L('motor strip (slowed when weak)', 'Motorstreifen (verlangsamt bei Parese)'), 'basal-ganglia': L('substantia nigra (bradykinesia)', 'Substantia nigra (Bradykinese)'), capsule: L('posterior limb', 'hinterer Schenkel') } },
  { id: 'heel-shin', group: 'coordination', label: L('Heel–shin', 'Knie-Hacke-Versuch'), manoeuvres: ['test.heel-shin'], sided: true, eyes: true,
    lines: () => S2.flatMap((S) => [{ ref: `leg.heel-shin.${S}`, ctx: { eyesClosed: false }, label: OPEN }, { ref: `leg.heel-shin.${S}`, ctx: { eyesClosed: true }, label: SHUT }]),
    reads: ['cerebellum', 'cord', 'root', 'nerve'], path: { cerebellum: L('hemisphere, same side', 'Hemisphäre, gleiche Seite'), cord: L('dorsal columns (eyes closed)', 'Hinterstränge (Augen zu)'), root: L('dorsal roots', 'Hinterwurzeln'), nerve: L('sensory nerves', 'sensible Nerven') } },
  { id: 'romberg', group: 'stance', label: L('Romberg', 'Romberg-Stehversuch'), manoeuvres: ['test.romberg'],
    lines: () => [{ ref: 'posture.romberg', ctx: { eyesClosed: false }, label: OPEN }, { ref: 'posture.romberg', ctx: { eyesClosed: true }, label: SHUT }],
    reads: ['cerebellum', 'brainstem', 'cord', 'root', 'nerve'], path: { cerebellum: L('vermis', 'Vermis'), brainstem: L('vestibular nuclei', 'Vestibulariskerne'), cord: L('dorsal columns', 'Hinterstränge'), root: L('dorsal roots', 'Hinterwurzeln'), nerve: L('sensory nerves of the legs', 'sensible Beinnerven') } },
  { id: 'pull', group: 'stance', label: L('Pull test', 'Zugtest'), manoeuvres: ['test.pull'],
    lines: () => [{ ref: 'posture.pull-test' }],
    reads: ['basal-ganglia', 'brainstem', 'cerebellum'], path: { 'basal-ganglia': L('substantia nigra and striatum (postural reflexes)', 'Substantia nigra und Striatum (Haltungsreflexe)'), brainstem: L('pedunculopontine nucleus', 'Nucleus pedunculopontinus'), cerebellum: L('vermis', 'Vermis') } },
  { id: 'gait', group: 'stance', label: L('Gait', 'Gangbild'), manoeuvres: ['test.gait'],
    lines: () => [{ ref: 'gait.pattern' }],
    reads: ['cortex', 'basal-ganglia', 'capsule', 'brainstem', 'cord', 'root', 'nerve', 'muscle', 'cerebellum'], path: { ...MOTOR_PATH, 'basal-ganglia': L('substantia nigra (shuffling)', 'Substantia nigra (Kleinschrittigkeit)'), cerebellum: L('vermis and hemispheres', 'Vermis und Hemisphären') } },
  { id: 'sensation', group: 'sensation', label: L('Sensation', 'Sensibilität'), manoeuvres: ['test.arm.pinprick', 'test.leg.pinprick', 'test.trunk.pinprick', 'test.saddle', 'test.arm.vibration', 'test.leg.vibration', 'test.face-sensation'],
    lines: () => [...bothSides('arm.pinprick'), ...bothSides('leg.pinprick'), ...bothSides('trunk.pinprick'), { ref: 'saddle.sensation' }, ...bothSides('arm.vibration'), ...bothSides('leg.vibration'), ...bothSides('face.sensation')],
    reads: ['cortex', 'capsule', 'brainstem', 'cord', 'root', 'plexus', 'nerve'], path: { cortex: L('sensory strip', 'sensibler Kortex'), capsule: L('thalamus and capsule', 'Thalamus und Kapsel'), brainstem: L('medial lemniscus; spinothalamic tract; trigeminal', 'Lemniscus medialis; Tractus spinothalamicus; Trigeminus'), cord: L('dorsal columns (same side); spinothalamic (crossed)', 'Hinterstränge (gleiche Seite); Tractus spinothalamicus (gekreuzt)'), root: L('dorsal roots: dermatomes', 'Hinterwurzeln: Dermatome'), plexus: L('plexus', 'Plexus'), nerve: L('nerve territories', 'Nervenversorgungsgebiete') } },
  { id: 'eyes', group: 'cranial', label: L('Eyes: lids, pupils, movements', 'Augen: Lider, Pupillen, Motorik'), manoeuvres: ['inspect.eyes', 'inspect.eyes.dim', 'test.pupils.light', 'test.eye-movements'],
    lines: () => [...bothSides('eye.lid'), ...bothSides('eye.pupil', { lightOn: 'none', ambient: 'room' }, L('Room light', 'Raumlicht')), ...bothSides('eye.pupil', { lightOn: 'none', ambient: 'dim' }, L('Dim light', 'Dämmerlicht')),
      ...bothSides('eye.motility'), { ref: 'eyes.nystagmus', ctx: { gaze: 'primary', fixation: true }, label: L('Looking ahead', 'Geradeausblick') },
      { ref: 'eyes.nystagmus', ctx: { gaze: 'right', fixation: true }, label: L('Looking right', 'Blick nach rechts') }, { ref: 'eyes.nystagmus', ctx: { gaze: 'left', fixation: true }, label: L('Looking left', 'Blick nach links') }],
    reads: ['brainstem', 'cord', 'nerve', 'junction', 'muscle', 'cerebellum'],
    path: { brainstem: L('nuclei of III, IV, VI; the sympathetic pathway descending', 'Kerne von III, IV, VI; die absteigende Sympathikusbahn'), cord: L('ciliospinal centre (C8–T2)', 'Centrum ciliospinale (C8–T2)'),
      nerve: L('III, IV, VI; the sympathetic chain', 'III, IV, VI; der Grenzstrang'), junction: L('neuromuscular junction (fatigable ptosis)', 'motorische Endplatte (ermüdbare Ptose)'), muscle: L('extraocular muscles', 'äußere Augenmuskeln'), cerebellum: L('flocculus: holding gaze', 'Flocculus: Blickhalten') } },
  { id: 'cranial', group: 'cranial', label: L('Face, mouth and neck', 'Gesicht, Mund und Hals'), manoeuvres: ['test.face-movement', 'test.face-sensation', 'test.jaw', 'test.palate', 'test.tongue', 'test.shrug'],
    lines: () => [...bothSides('face.movement'), ...bothSides('face.sensation'), { ref: 'jaw.opening' }, { ref: 'mouth.palate' }, { ref: 'mouth.tongue' }, ...bothSides('shoulder.shrug')],
    reads: ['cortex', 'capsule', 'brainstem', 'nerve', 'junction', 'muscle'], path: { cortex: L('motor strip, face', 'Motorstreifen, Gesicht'), capsule: L('corticobulbar fibres', 'kortikobulbäre Fasern'), brainstem: L('nuclei of V, VII, IX–XII', 'Kerne von V, VII, IX–XII'), nerve: L('cranial nerves', 'Hirnnerven'), junction: L('neuromuscular junction', 'motorische Endplatte'), muscle: L('bulbar and facial muscles', 'bulbäre und mimische Muskeln') } },
  { id: 'speech', group: 'cranial', label: L('Speech', 'Sprache'), manoeuvres: ['test.speech', 'test.count-to-50'],
    lines: () => [{ ref: 'speech.language' }, { ref: 'speech.fatigue', ctx: { repetition: 50 }, label: L('Counting to 50', 'Zählen bis 50') }],
    reads: ['cortex', 'capsule', 'brainstem', 'cerebellum', 'junction', 'muscle'], path: { cortex: L('Broca, Wernicke and the arcuate fasciculus (left)', 'Broca, Wernicke und Fasciculus arcuatus (links)'), capsule: L('corticobulbar fibres', 'kortikobulbäre Fasern'), brainstem: L('bulbar nuclei', 'bulbäre Kerne'), cerebellum: L('coordination of speech', 'Koordination des Sprechens'), junction: L('neuromuscular junction (fatigue)', 'motorische Endplatte (Ermüdung)'), muscle: L('bulbar muscles', 'bulbäre Muskeln') } },
];
export const NEURO_TEST_BY_ID = Object.fromEntries(NEURO_TESTS.map((x) => [x.id, x])) as Record<NeuroTest, NeuroTestDef>;
export const NEURO_TEST_LABEL = Object.fromEntries(NEURO_TESTS.map((x) => [x.id, x.label])) as Record<NeuroTest, LocalizedText>;
