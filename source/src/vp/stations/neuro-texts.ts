import type { LocalizedText } from '../model/i18n.ts';
import type { ExamContext } from '../model/types.ts';
import type { NeuroTest } from './neuro-tests.ts';

/* ---------------------------------------------------------------------------
   The neurological station's explanations: what each test reads, and what
   this patient's findings say about where the lesion is. The findings come
   from the examination model (read through `v`); nothing here decides them.
   Drafts until a clinician reads them.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
export { NEURO_TEST_LABEL } from './neuro-tests.ts';

export type Rung = 'cortex' | 'basal-ganglia' | 'capsule' | 'brainstem' | 'cord' | 'root' | 'plexus' | 'nerve' | 'junction' | 'muscle' | 'cerebellum';
/** The rung of the ladder a structure of the nervous-system graph sits on. */
export function rungOf(node: string): Rung | null {
  if (/cerebell|vermis|_icp$|_mcp$|_scp$|dentate|red_nuc/.test(node)) return 'cerebellum';
  if (/_snc$|_putamen$|_bg$/.test(node)) return 'basal-ganglia';
  if (node === 'polyneuropathy' || /_scg$|_ciliary$/.test(node)) return 'nerve';
  if (/_dc_nuc$|_cn\d+_(nuc|sens|mot)$|_lat_med$|_med_med$|_med_pons$|_lat_pons$/.test(node)) return 'brainstem';
  if (/_cn\d+(_nerve)?$/.test(node)) return 'nerve';
  if (/_mcx_|_scx$|broca|wernicke|arcuate|vis_cx/.test(node)) return 'cortex';
  if (/_ic$|_thal$/.test(node)) return 'capsule';
  if (/peduncle|pons|med_pyr|_lat_bs|_med_med|_lat_med|_midbrain|pyr_decuss|_ml$/.test(node)) return 'brainstem';
  if (/_cst_|_ahn_|_dc_|_stt_/.test(node)) return 'cord';
  if (/_nerve_(C|T|L|S)\d|_drg_/.test(node)) return 'root';
  if (/_bp_|_lp_/.test(node)) return 'plexus';
  if (/_n_/.test(node)) return 'nerve';
  if (/_nmj_/.test(node)) return 'junction';
  if (/_muscle_/.test(node)) return 'muscle';
  return null;
}


type S = 'R' | 'L';
const SIDES: S[] = ['R', 'L'];
const sideEn = (x: S) => (x === 'R' ? 'right' : 'left');
const sideDe = (x: S) => (x === 'R' ? 'rechts' : 'links');
const GRADE = ['0 (absent)', '1 (reduced)', '2 (normal)', '3 (brisk)', '4 (with clonus)'];
const GRADE_DE = ['0 (fehlend)', '1 (abgeschwächt)', '2 (normal)', '3 (lebhaft)', '4 (mit Klonus)'];
/** Reads one observation of the model: its value. */
export type NeuroRead = (ref: string, ctx?: ExamContext) => any;

const MOVE: Record<string, LocalizedText> = {
  shoulderAbduction: L('shoulder abduction', 'Schulterabduktion'), elbowFlexion: L('elbow flexion', 'Ellenbogenbeugung'), elbowExtension: L('elbow extension', 'Ellenbogenstreckung'),
  wristExtension: L('wrist extension', 'Handgelenkstreckung'), fingerFlexion: L('finger flexion', 'Fingerbeugung'), thumbAbduction: L('thumb abduction', 'Daumenabduktion'), fingerAbduction: L('finger abduction', 'Fingerabduktion'),
  hipFlexion: L('hip flexion', 'Hüftbeugung'), hipAdduction: L('hip adduction', 'Hüftadduktion'), hipAbduction: L('hip abduction', 'Hüftabduktion'), kneeExtension: L('knee extension', 'Kniestreckung'),
  ankleDorsiflexion: L('ankle dorsiflexion', 'Fußhebung'), toeExtension: L('big toe extension', 'Großzehenhebung'), footEversion: L('foot eversion', 'Fußeversion'), footInversion: L('foot inversion', 'Fußinversion'), anklePlantarflexion: L('plantarflexion', 'Fußsenkung'),
};
const PLANTAR_DE: Record<string, string> = { extensor: 'Babinski positiv', flexor: 'plantar', mute: 'keine Reaktion' };
const PYRAMIDAL = new Set(['shoulderAbduction', 'elbowExtension', 'wristExtension', 'fingerAbduction', 'thumbAbduction', 'hipFlexion', 'ankleDorsiflexion', 'toeExtension', 'footEversion']);
const PROXIMAL = new Set(['shoulderAbduction', 'elbowFlexion', 'elbowExtension', 'hipFlexion', 'hipAdduction', 'hipAbduction', 'kneeExtension']);

export function explainNeuro(test: NeuroTest, v: NeuroRead): { title: LocalizedText; body: LocalizedText[] } {
  const out: LocalizedText[] = [];
  const add = (en: string, de: string) => out.push(L(en, de));
  switch (test) {
    case 'tone': {
      add('The examiner moves the relaxed limb: the elbow and wrist, the knee rolled and lifted. Tone is the resistance a relaxed muscle gives to being stretched. A cut corticospinal tract releases the stretch reflexes: the resistance builds with speed and gives way, a spastic catch, in the arm’s flexors and the leg’s extensors. Rigidity, the same through the whole range whatever the speed, is the basal ganglia’s. A cut lower motor neuron leaves the limb floppy, its muscles wasting and twitching (fasciculations, when the anterior horn cell itself is sick).',
        'Der Untersucher bewegt die entspannte Extremität: Ellenbogen und Handgelenk, das Knie gerollt und angehoben. Tonus ist der Widerstand, den ein entspannter Muskel der Dehnung entgegensetzt. Eine unterbrochene Pyramidenbahn enthemmt die Dehnungsreflexe: Der Widerstand wächst mit der Geschwindigkeit und gibt nach, ein spastisches Taschenmesserphänomen, in den Beugern des Arms und den Streckern des Beins. Rigor, gleich durch den ganzen Bewegungsumfang und unabhängig von der Geschwindigkeit, gehört den Basalganglien. Ein unterbrochenes zweites Motoneuron lässt die Extremität schlaff, ihre Muskeln atrophieren und zucken (Faszikulationen, wenn die Vorderhornzelle selbst erkrankt ist).');
      for (const x of SIDES) for (const limb of ['arm', 'leg'] as const) {
        const t = v(`${limb}.tone.${x}`) ?? {};
        const le = limb === 'arm' ? 'arm' : 'leg', ld = limb === 'arm' ? 'Arm' : 'Bein';
        if (t.tone === 'spastic') add(`The ${sideEn(x)} ${le}: spastic. An upper motor neuron lesion.`, `${ld} ${sideDe(x)}: spastisch. Eine Läsion des ersten Motoneurons.`);
        else if (t.tone === 'rigid') add(`The ${sideEn(x)} ${le}: rigid. The basal ganglia (extrapyramidal).`, `${ld} ${sideDe(x)}: rigide. Die Basalganglien (extrapyramidal).`);
        else if (t.tone === 'reduced') add(`The ${sideEn(x)} ${le}: floppy${t.wasting ? ', wasted' : ''}${t.fasciculation ? ', fasciculating' : ''}. A lower motor neuron lesion${t.fasciculation ? ', the anterior horn itself' : ''}.`, `${ld} ${sideDe(x)}: schlaff${t.wasting ? ', atrophisch' : ''}${t.fasciculation ? ', mit Faszikulationen' : ''}. Eine Läsion des zweiten Motoneurons${t.fasciculation ? ', das Vorderhorn selbst' : ''}.`);
        else if (t.wasting) add(`The ${sideEn(x)} ${le}: wasted, tone normal.`, `${ld} ${sideDe(x)}: atrophisch, Tonus normal.`);
      }
      for (const x of SIDES) if (v(`arm.rest-tremor.${x}`)?.tremor === 'rest') add(`The ${sideEn(x)} hand, lying still, trembles 4–6 times a second and steadies as it moves: a rest tremor, parkinsonism.`, `Die ${x === 'R' ? 'rechte' : 'linke'} Hand zittert in Ruhe 4–6-mal pro Sekunde und wird bei Bewegung ruhiger: ein Ruhetremor, Parkinsonismus.`);
      if (out.length === 1) add('Tone and bulk are normal in all four limbs, and the hands are still at rest.', 'Tonus und Trophik sind an allen vier Extremitäten normal, die Hände in Ruhe still.');
      return { title: L('Tone: what the relaxed limb gives', 'Tonus: was die entspannte Extremität hergibt'), body: out };
    }
    case 'power': {
      add('Each movement against the examiner’s hand, graded on the MRC scale: 5 normal, 4 against some resistance, 3 against gravity only, 2 with gravity taken away, 1 a flicker, 0 nothing. Where the weakness lies is the lesion’s signature: an upper motor neuron weakens the arm’s extensors and the leg’s flexors more (the pyramidal pattern); a root weakens the muscles of its myotome whatever their nerve; a nerve only its own; the junction fatigues with repetition; muscle disease is proximal.',
        'Jede Bewegung gegen die Hand des Untersuchers, nach der MRC-Skala: 5 normal, 4 gegen etwas Widerstand, 3 nur gegen die Schwerkraft, 2 unter Aufhebung der Schwerkraft, 1 ein Flackern, 0 nichts. Wo die Schwäche liegt, ist die Handschrift der Läsion: Ein erstes Motoneuron schwächt die Strecker des Arms und die Beuger des Beins mehr (pyramidales Muster); eine Wurzel die Muskeln ihres Myotoms, gleich welcher Nerv sie versorgt; ein Nerv nur seine eigenen; die Endplatte ermüdet bei Wiederholung; eine Muskelerkrankung ist proximal.');
      for (const x of SIDES) {
        const weak: string[] = [];
        for (const limb of ['arm', 'leg'] as const) { const p = v(`${limb}.power.${x}`) ?? {}; for (const [m, g] of Object.entries(p)) if (typeof g === 'number' && g < 5) weak.push(m); }
        if (!weak.length) continue;
        const pyr = weak.every((m) => PYRAMIDAL.has(m)), prox = weak.every((m) => PROXIMAL.has(m));
        const listEn = weak.map((m) => MOVE[m]?.en ?? m).join(', '), listDe = weak.map((m) => MOVE[m]?.de ?? m).join(', ');
        add(`Weak on the ${sideEn(x)}: ${listEn}.${pyr && weak.length > 2 ? ' The pyramidal pattern.' : prox && weak.length > 2 ? ' Proximal.' : ''}`, `Schwach ${sideDe(x)}: ${listDe}.${pyr && weak.length > 2 ? ' Das pyramidale Muster.' : prox && weak.length > 2 ? ' Proximal.' : ''}`);
      }
      const fresh = v('arm.power.R')?.shoulderAbduction, tired = v('arm.power.R', { repetition: 20 })?.shoulderAbduction;
      if (typeof fresh === 'number' && typeof tired === 'number' && tired < fresh) add(`Shoulder abduction fades with repetition (${fresh} to ${tired}): fatigable weakness, the neuromuscular junction.`, `Die Schulterabduktion lässt bei Wiederholung nach (${fresh} auf ${tired}): ermüdbare Schwäche, die motorische Endplatte.`);
      if (out.length === 1) add('Full power (5/5) in every movement tested.', 'Volle Kraft (5/5) in jeder geprüften Bewegung.');
      return { title: L('Power: which movements are weak, and how', 'Kraft: welche Bewegungen schwach sind, und wie'), body: out };
    }
    case 'drift': {
      add('Arms held out, palms up, eyes closed, for 20 to 30 seconds. Holding the forearm turned palm up and the arm level takes the supinators and the extensors, which the corticospinal tract serves most. When it is slightly weak, the stronger pronators and flexors win: the hand turns palm down, the elbow bends and the arm sinks. The eyes are closed so that sight cannot correct the drift.',
        'Arme vorgestreckt, Handflächen nach oben, Augen geschlossen, 20 bis 30 Sekunden lang. Den Unterarm nach oben gedreht und den Arm waagerecht zu halten, verlangt die Supinatoren und Strecker, die die Pyramidenbahn am stärksten versorgt. Ist sie leicht geschwächt, gewinnen die stärkeren Pronatoren und Beuger: Die Hand dreht sich nach unten, der Ellenbogen beugt sich, der Arm sinkt. Die Augen sind geschlossen, damit das Sehen die Drift nicht korrigiert.');
      const d = SIDES.filter((x) => v(`arm.drift.${x}`, { eyesClosed: true })?.drift);
      if (!d.length) add('Neither arm drifts.', 'Keiner der Arme driftet.');
      else {
        for (const x of d) add(`The ${sideEn(x)} arm drifts.`, `Der ${x === 'R' ? 'rechte' : 'linke'} Arm driftet.`);
        add('An upper motor neuron sign: the lesion is in the corticospinal tract, from the motor cortex through the internal capsule and the brainstem to the cord, on the opposite side above the pyramidal decussation and on the same side below it. A root or a nerve lesion weakens its own muscles but does not make the arm drift.',
          'Ein Zeichen des ersten Motoneurons: Die Läsion liegt in der Pyramidenbahn, vom Motorkortex über die Capsula interna und den Hirnstamm bis ins Rückenmark, oberhalb der Pyramidenkreuzung auf der Gegenseite, darunter auf derselben Seite. Eine Wurzel- oder Nervenläsion schwächt ihre eigenen Muskeln, lässt den Arm aber nicht driften.');
      }
      return { title: L('Pronator drift: the corticospinal tract holding the arms against gravity', 'Armvorhalteversuch: die Pyramidenbahn hält die Arme gegen die Schwerkraft'), body: out };
    }
    case 'arm-reflexes':
    case 'leg-reflexes': {
      const arm = test === 'arm-reflexes';
      if (arm) add('The hammer stretches a tendon; the muscle’s spindles fire through its nerve and roots to the cord, which excites the same muscle, and it jerks: the biceps (C5–6, musculocutaneous nerve), the supinator or brachioradialis (C5–6, radial) and the triceps (C7–8, radial). From above, the corticospinal tract damps every reflex: cut it and they grow brisk, with clonus at their most; cut the arc itself and the reflex is lost. One root of two weakens it; both, or the nerve, abolish it.',
        'Der Hammer dehnt eine Sehne; die Muskelspindeln feuern über Nerv und Wurzeln ins Rückenmark, das denselben Muskel erregt, und er zuckt: Bizeps (C5–6, N. musculocutaneus), Brachioradialis (C5–6, N. radialis) und Trizeps (C7–8, N. radialis). Von oben dämpft die Pyramidenbahn jeden Reflex: Ist sie unterbrochen, werden sie lebhaft, im Extremfall mit Klonus; ist der Bogen selbst unterbrochen, fehlt der Reflex. Eine von zwei Wurzeln schwächt ihn; beide, oder der Nerv, heben ihn auf.');
      else add('A tap on the patellar tendon stretches the quadriceps; its spindles fire through the femoral nerve and the L3 and L4 roots to the cord, which excites the same muscle, and the leg kicks. The ankle jerk runs through S1 and the sciatic and tibial nerves. From above, the corticospinal tract damps the reflexes: cut it and they grow brisk, with clonus at their most, and the sole’s stroke lifts the big toe (an extensor plantar, Babinski’s sign); cut the arc and the reflex is lost.',
        'Ein Schlag auf die Patellarsehne dehnt den Quadrizeps; seine Muskelspindeln feuern über den N. femoralis und die Wurzeln L3 und L4 ins Rückenmark, das denselben Muskel erregt, und das Bein schlägt aus. Der ASR läuft über S1 und die Nn. ischiadicus und tibialis. Von oben dämpft die Pyramidenbahn die Reflexe: Ist sie unterbrochen, werden sie lebhaft, im Extremfall mit Klonus, und das Bestreichen der Fußsohle hebt die Großzehe (Babinski-Zeichen); ist der Bogen unterbrochen, fehlt der Reflex.');
      const names = arm ? [['biceps', 'biceps', 'BSR'], ['supinator', 'supinator', 'RPR'], ['triceps', 'triceps', 'TSR']] : [['knee', 'knee', 'PSR'], ['ankle', 'ankle', 'ASR']];
      const grade = (x: S) => { const r = v(`${arm ? 'arm' : 'leg'}.reflexes.${x}`) ?? {}; return r; };
      add(names.map(([k, en]) => `${en}: right ${GRADE[grade('R')[k] ?? 2]}, left ${GRADE[grade('L')[k] ?? 2]}`).join('; ') + (arm ? '.' : `; plantar: right ${grade('R').plantar ?? 'flexor'}, left ${grade('L').plantar ?? 'flexor'}.`),
        names.map(([k, , de]) => `${de}: rechts ${GRADE_DE[grade('R')[k] ?? 2]}, links ${GRADE_DE[grade('L')[k] ?? 2]}`).join('; ') + (arm ? '.' : `; Fußsohlenreflex: rechts ${PLANTAR_DE[grade('R').plantar] ?? 'plantar'}, links ${PLANTAR_DE[grade('L').plantar] ?? 'plantar'}.`));
      for (const x of SIDES) {
        const r = grade(x), ks = names.map(([k]) => k), vals = ks.map((k) => r[k] ?? 2);
        if (vals.some((g) => g >= 3)) add(`Brisk on the ${sideEn(x)}${!arm && r.plantar === 'extensor' ? ', with an extensor plantar' : ''}: an upper motor neuron lesion above these segments.`, `Lebhaft ${sideDe(x)}${!arm && r.plantar === 'extensor' ? ', mit positivem Babinski' : ''}: eine Läsion des ersten Motoneurons oberhalb dieser Segmente.`);
        const lost = ks.filter((k) => r[k] === 0), red = ks.filter((k) => r[k] === 1);
        if (lost.length && r.plantar === 'mute') add(`Lost on the ${sideEn(x)}, the plantar silent too: spinal shock below a cord transection. The reflexes come back over weeks (the ankle jerk at about one, the knee jerk at about two) and are brisk, with spasticity, after a month.`, `Fehlend ${sideDe(x)}, auch der Fußsohlenreflex stumm: spinaler Schock unterhalb einer Querschnittsläsion. Die Reflexe kehren über Wochen zurück (ASR nach etwa einer, PSR nach etwa zwei) und sind nach einem Monat gesteigert, mit Spastik.`);
        else if (lost.length) add(`Lost on the ${sideEn(x)} (${lost.join(', ')}): the arc is cut, in the roots or the nerve of that reflex.`, `Fehlend ${sideDe(x)} (${lost.map((k) => names.find((n) => n[0] === k)![2]).join(', ')}): Der Bogen ist unterbrochen, in den Wurzeln oder im Nerv dieses Reflexes.`);
        if (red.length) add(`Reduced on the ${sideEn(x)} (${red.join(', ')}): part of the arc is cut, one of its roots.`, `Abgeschwächt ${sideDe(x)} (${red.map((k) => names.find((n) => n[0] === k)![2]).join(', ')}): Ein Teil des Bogens ist unterbrochen, eine seiner Wurzeln.`);
        if (!arm && r.plantar === 'extensor' && !vals.some((g) => g >= 3)) add(`An extensor plantar on the ${sideEn(x)} with reflexes that are not brisk: the corticospinal tract is cut, but the reflexes are not released, or not yet. After a stroke they turn brisk, with spasticity, from about the third day, and mostly only where the weakness is severe; in the cord within days.`, `Ein positiver Babinski ${sideDe(x)} bei nicht gesteigerten Reflexen: Die Pyramidenbahn ist unterbrochen, die Reflexe aber nicht oder noch nicht enthemmt. Nach einem Schlaganfall werden sie etwa ab dem dritten Tag lebhaft, mit Spastik, und meist nur bei schwerer Parese; im Rückenmark innerhalb von Tagen.`);
      }
      return { title: arm ? L('Arm reflexes: arcs through C5 to C8, damped from above', 'Armreflexe: Bögen über C5 bis C8, von oben gedämpft') : L('Leg reflexes and the plantar response', 'Beinreflexe und Fußsohlenreflex'), body: out };
    }
    case 'finger-nose':
    case 'heel-shin': {
      const arm = test === 'finger-nose', prop = arm ? 'arm.finger-nose' : 'leg.heel-shin';
      if (arm) add('From the nose to the examiner’s finger at arm’s length and back. The cerebellar hemisphere on the same side times the agonist and the antagonist: without it the finger overshoots the target and corrects (dysmetria), and it shakes more the nearer it comes (an intention tremor, below 5 per second). Done again with the eyes closed, it tests the sense of where the arm is: the dorsal columns.',
        'Von der Nase zum Finger des Untersuchers auf Armlänge und zurück. Die Kleinhirnhemisphäre derselben Seite stimmt Agonist und Antagonist aufeinander ab: Ohne sie schießt der Finger über das Ziel hinaus und korrigiert (Dysmetrie) und zittert umso mehr, je näher er kommt (Intentionstremor, unter 5 pro Sekunde). Mit geschlossenen Augen wiederholt, prüft er den Lagesinn des Arms: die Hinterstränge.');
      else add('Lying, the heel is put on the other knee and run down the shin to the ankle. The cerebellar hemisphere on the same side keeps it on the shin; without it the heel overshoots the knee and wobbles off the shin. With the eyes closed it tests the sense of where the leg is: the dorsal columns.',
        'Im Liegen wird die Ferse auf das andere Knie gesetzt und am Schienbein entlang zum Knöchel geführt. Die Kleinhirnhemisphäre derselben Seite hält sie auf dem Schienbein; ohne sie schießt die Ferse über das Knie hinaus und rutscht vom Schienbein. Mit geschlossenen Augen prüft der Versuch den Lagesinn des Beins: die Hinterstränge.');
      for (const x of SIDES) {
        const a = v(`${prop}.${x}`, { eyesClosed: false }) ?? {}, b = v(`${prop}.${x}`, { eyesClosed: true }) ?? {};
        const le = arm ? 'finger' : 'heel', ld = arm ? 'Der Finger' : 'Die Ferse';
        if (a.limitedByWeakness) add(`The ${sideEn(x)} ${arm ? 'arm' : 'leg'} is too weak to do the test: it cannot be judged.`, `${arm ? 'Der Arm' : 'Das Bein'} ${sideDe(x)} ist zu schwach für den Test: nicht zu beurteilen.`);
        else if (a.dysmetria && a.dysmetria !== 'none') add(`The ${sideEn(x)} ${le} is ${a.dysmetria === 'marked' ? 'markedly' : 'slightly'} ataxic${a.intentionTremor ? ', with an intention tremor' : ''}, with the eyes open as well as closed: the cerebellum or its connections on the ${sideEn(x)}.`,
          `${ld} ${sideDe(x)} ist ${a.dysmetria === 'marked' ? 'deutlich' : 'leicht'} ataktisch${a.intentionTremor ? ', mit Intentionstremor' : ''}, mit offenen wie mit geschlossenen Augen: Kleinhirn oder seine Verbindungen ${sideDe(x)}.`);
        else if (b.dysmetria && b.dysmetria !== 'none') add(`The ${sideEn(x)} ${le} is accurate while the patient watches and misses with the eyes closed: sensory ataxia, the sense of position lost (the dorsal columns, or the nerves and roots that feed them).`,
          `${ld} ${sideDe(x)} trifft, solange der Patient hinsieht, und verfehlt mit geschlossenen Augen: sensible Ataxie, der Lagesinn fehlt (Hinterstränge oder die Nerven und Wurzeln, die sie speisen).`);
      }
      if (out.length === 1) add('Accurate on both sides, with the eyes open and closed.', 'Beidseits zielgenau, mit offenen und geschlossenen Augen.');
      return { title: arm ? L('Finger–nose: the cerebellum and the sense of position', 'Finger-Nase-Versuch: Kleinhirn und Lagesinn') : L('Heel–shin: the cerebellum and the sense of position, in the legs', 'Knie-Hacke-Versuch: Kleinhirn und Lagesinn, an den Beinen'), body: out };
    }
    case 'rapid-alternating': {
      add('The hand turned palm up and palm down, or patted on the other palm front and back, as fast as possible. The cerebellar hemisphere on the same side switches agonist and antagonist on time; without it the rhythm and the range break up (dysdiadochokinesia). A weak or stiff limb does it slowly but regularly.',
        'Die Hand so schnell wie möglich nach oben und unten gedreht oder abwechselnd mit Handfläche und Handrücken auf die andere Hand geklopft. Die Kleinhirnhemisphäre derselben Seite schaltet Agonist und Antagonist rechtzeitig um; ohne sie zerfallen Rhythmus und Ausmaß (Dysdiadochokinese). Ein schwacher oder steifer Arm tut es langsam, aber regelmäßig.');
      for (const x of SIDES) { const r = v(`arm.rapid-alternating.${x}`) ?? {};
        if (r.dysdiadochokinesia) add(`Irregular on the ${sideEn(x)}: dysdiadochokinesia, the cerebellum on that side.`, `Unregelmäßig ${sideDe(x)}: Dysdiadochokinese, das Kleinhirn dieser Seite.`);
        else if (r.slowed) add(`Slow but regular on the ${sideEn(x)}: weakness, or the slowness of parkinsonism (bradykinesia), not the cerebellum.`, `Langsam, aber regelmäßig ${sideDe(x)}: Schwäche oder die Verlangsamung des Parkinsonismus (Bradykinese), nicht das Kleinhirn.`); }
      if (out.length === 1) add('Quick and regular on both sides.', 'Beidseits rasch und regelmäßig.');
      return { title: L('Rapid alternating movements', 'Diadochokinese'), body: out };
    }
    case 'pull': {
      add('Standing, the patient is pulled back by the shoulders, quickly. The postural reflexes, from the basal ganglia and the brainstem, answer with a step or two back. In parkinsonism they fail late, once both sides are affected (Hoehn and Yahr stage 3, after a median of about seven years): the patient takes many small, quick steps back (retropulsion), or would fall.',
        'Im Stand wird der Patient rasch an den Schultern nach hinten gezogen. Die Haltungsreflexe, von Basalganglien und Hirnstamm, antworten mit einem oder zwei Schritten zurück. Beim Parkinsonismus versagen sie spät, wenn beide Seiten betroffen sind (Hoehn-und-Yahr-Stadium 3, nach im Median etwa sieben Jahren): Der Patient macht viele kleine, schnelle Schritte zurück (Retropulsion) oder würde stürzen.');
      const r = v('posture.pull-test')?.response;
      if (r === 'steps') add('Many small steps back: postural reflexes lost, as in advanced parkinsonism. A fall risk.', 'Viele kleine Schritte zurück: Haltungsreflexe verloren, wie beim fortgeschrittenen Parkinsonismus. Sturzgefahr.');
      else if (r === 'falls') add('No step at all: the patient would fall. Postural reflexes absent.', 'Kein Schritt: Der Patient würde stürzen. Haltungsreflexe fehlen.');
      else add('One or two steps back: postural reflexes intact.', 'Ein oder zwei Schritte zurück: Haltungsreflexe erhalten.');
      return { title: L('Pull test: the postural reflexes', 'Zugtest: die Haltungsreflexe'), body: out };
    }
    case 'romberg': {
      add('Standing with the feet together, first with the eyes open, then closed. Three things keep us upright: sight, the labyrinths and the sense of where the feet are (the dorsal columns). Take one away and the other two suffice. Steady with the eyes open but falling when they close (Romberg’s sign) means the sense of position is lost: sensory ataxia. Unsteady even with the eyes open is the cerebellum’s (the vermis). A one-sided vestibular loss pushes toward its own side.',
        'Stehen mit geschlossenen Füßen, erst mit offenen, dann mit geschlossenen Augen. Drei Dinge halten uns aufrecht: das Sehen, die Labyrinthe und der Lagesinn der Füße (die Hinterstränge). Fällt eines aus, genügen die beiden anderen. Sicher mit offenen Augen, aber fallend, sobald sie sich schließen (Romberg-Zeichen), heißt: Der Lagesinn fehlt, sensible Ataxie. Unsicher schon mit offenen Augen ist das Kleinhirn (der Vermis). Ein einseitiger Vestibularisausfall drängt zu seiner Seite.');
      const o = v('posture.romberg', { eyesClosed: false }) ?? { stance: 'steady' }, c = v('posture.romberg', { eyesClosed: true }) ?? { stance: 'steady' };
      const st = (x: any) => `${x.stance}${x.toward ? ` toward the ${sideEn(x.toward)}` : ''}`, stDe = (x: any) => `${x.stance === 'steady' ? 'sicher' : x.stance === 'sways' ? 'schwankt' : 'fällt'}${x.toward ? ` nach ${x.toward === 'R' ? 'rechts' : 'links'}` : ''}`;
      add(`Eyes open: ${st(o)}. Eyes closed: ${st(c)}.`, `Augen offen: ${stDe(o)}. Augen geschlossen: ${stDe(c)}.`);
      if (o.stance === 'steady' && c.stance === 'falls') add('Romberg’s sign: the sense of position is lost in the legs.', 'Romberg-Zeichen: Der Lagesinn der Beine fehlt.');
      else if (o.stance !== 'steady') add(`Unsteady already with the eyes open${o.toward ? `, toward the ${sideEn(o.toward)}` : ''}: the cerebellum or the vestibular system, not the sense of position.`, `Schon mit offenen Augen unsicher${o.toward ? `, nach ${o.toward === 'R' ? 'rechts' : 'links'}` : ''}: Kleinhirn oder Vestibularsystem, nicht der Lagesinn.`);
      return { title: L('Romberg: sight, labyrinths and the sense of position', 'Romberg: Sehen, Labyrinth und Lagesinn'), body: out };
    }
    case 'gait': {
      add('Watching the patient walk shows the whole motor system at once. Each lesion has its gait: hemiplegic (the leg stiff and swung round, the arm bent and still) after an upper motor neuron lesion; high-stepping, the foot slapping down, when the ankle cannot be lifted (a peroneal nerve or L5 root); waddling, the trunk lurching over each standing leg, when the hip abductors are weak (myopathy); broad-based and reeling with a cerebellar lesion; stamping and watching the feet when the sense of position is lost; short, shuffling steps, stooped, with little arm swing, in parkinsonism.',
        'Den Patienten gehen zu sehen, zeigt das ganze motorische System auf einmal. Jede Läsion hat ihren Gang: hemiparetisch (das Bein steif und herumgeschwungen, der Arm gebeugt und still) nach einer Läsion des ersten Motoneurons; Steppergang, der Fuß klatscht auf, wenn der Fuß nicht gehoben werden kann (N. peroneus oder Wurzel L5); watschelnd, der Rumpf neigt sich über jedes Standbein, wenn die Hüftabduktoren schwach sind (Myopathie); breitbasig und taumelnd bei einer Kleinhirnläsion; stampfend, den Blick auf die Füße, wenn der Lagesinn fehlt; kleine, schlurfende Schritte, vornübergebeugt, mit wenig Armschwung, beim Parkinsonismus.');
      const g = v('gait.pattern') ?? { pattern: 'normal' };
      const PAT: Record<string, [string, string]> = { normal: ['normal', 'unauffällig'], veers: ['veering to one side', 'mit Abweichtendenz'], ataxic: ['broad-based and ataxic: the cerebellum', 'breitbasig-ataktisch: das Kleinhirn'], unable: ['unable to walk', 'Gehen nicht möglich'],
        hemiplegic: ['hemiplegic: an upper motor neuron lesion', 'hemiparetisch: eine Läsion des ersten Motoneurons'], 'high-stepping': ['high-stepping: the foot cannot be lifted', 'Steppergang: der Fuß kann nicht gehoben werden'], waddling: ['waddling: weak hip abductors', 'watschelnd: schwache Hüftabduktoren'], 'sensory-ataxic': ['stamping and broad-based: the sense of position lost', 'stampfend und breitbasig: der Lagesinn fehlt'],
        parkinsonian: ['shuffling and stooped, with little arm swing: parkinsonism', 'kleinschrittig und vornübergebeugt, mit wenig Armschwung: Parkinsonismus'] };
      const pe = PAT[g.pattern] ?? [g.pattern, g.pattern];
      add(`This patient: ${pe[0]}${g.toward ? ` (${sideEn(g.toward)})` : ''}.`, `Dieser Patient: ${pe[1]}${g.toward ? ` (${sideDe(g.toward)})` : ''}.`);
      return { title: L('Gait', 'Gangbild'), body: out };
    }
    case 'sensation': {
      add('Two pathways carry what the skin feels, and they cross at different places. Pain and temperature (pinprick) enter the cord, cross within a segment or two and rise on the other side (the spinothalamic tract); vibration and the sense of position rise on the same side in the dorsal columns and cross in the medulla. Below the cortex both run together. So a half of the cord loses pinprick on the other side and vibration on its own; a root loses its dermatome; a nerve its territory, with a sharp edge.',
        'Zwei Bahnen tragen, was die Haut spürt, und sie kreuzen an verschiedenen Stellen. Schmerz und Temperatur (Spitz-stumpf) treten ins Rückenmark ein, kreuzen innerhalb von ein bis zwei Segmenten und steigen auf der Gegenseite auf (Tractus spinothalamicus); Vibration und Lagesinn steigen auf derselben Seite in den Hintersträngen auf und kreuzen in der Medulla. Oberhalb davon laufen beide zusammen. So verliert eine Rückenmarkshälfte das Schmerzempfinden auf der Gegenseite und die Vibration auf der eigenen; eine Wurzel ihr Dermatom; ein Nerv sein Versorgungsgebiet, scharf begrenzt.');
      for (const x of SIDES) {
        const segs: string[] = [], terr: string[] = [];
        for (const p of ['arm.pinprick', 'leg.pinprick', 'trunk.pinprick']) { const r = v(`${p}.${x}`) ?? {}; for (const [k, val] of Object.entries(r)) { if (k === 'territories') terr.push(...(val as string[])); else if (val !== 'normal') segs.push(k); } }
        if (segs.length) add(`Pinprick lost or reduced on the ${sideEn(x)}: ${segs.join(', ')}.`, `Spitz-stumpf vermindert oder aufgehoben ${sideDe(x)}: ${segs.join(', ')}.`);
        if (terr.length) add(`In a nerve’s territory on the ${sideEn(x)}: ${terr.join(', ')}.`, `Im Versorgungsgebiet eines Nervs ${sideDe(x)}: ${terr.join(', ')}.`);
        const vib = ['arm', 'leg'].filter((l) => (v(`${l}.vibration.${x}`)?.vibration ?? 'normal') !== 'normal');
        if (vib.length) add(`Vibration and position sense lost on the ${sideEn(x)} (${vib.join(', ')}): the dorsal column on the ${sideEn(x)} side, below the medulla.`, `Vibration und Lagesinn aufgehoben ${sideDe(x)} (${vib.map((l) => (l === 'arm' ? 'Arm' : 'Bein')).join(', ')}): der Hinterstrang ${sideDe(x)}, unterhalb der Medulla.`);
        const f = v(`face.sensation.${x}`) ?? {};
        const fl = ['V1', 'V2', 'V3'].filter((k) => f[k] && f[k] !== 'normal');
        if (fl.length) add(`The face on the ${sideEn(x)}: ${fl.join(', ')} reduced${f.corneal === false ? ', the corneal reflex lost' : ''}.`, `Gesicht ${sideDe(x)}: ${fl.join(', ')} vermindert${f.corneal === false ? ', Kornealreflex erloschen' : ''}.`);
      }
      const sd = v('saddle.sensation')?.pinprick;
      if (sd && sd !== 'normal') add('The saddle is numb: the sacral roots (the cauda equina) or the conus.', 'Die Reithose ist taub: die sakralen Wurzeln (Cauda equina) oder der Konus.');
      if (out.length === 1) add('Sensation is normal everywhere tested.', 'Die Sensibilität ist überall normal.');
      return { title: L('Sensation: two pathways that cross in different places', 'Sensibilität: zwei Bahnen, die an verschiedenen Stellen kreuzen'), body: out };
    }
    case 'eyes': {
      add('The lids, the pupils in room and dim light, and the eyes following a target. The lid is lifted by the levator (III) and by Müller’s muscle (the sympathetic); the pupil is narrowed by III’s parasympathetic fibres and widened by the sympathetic, which runs from the hypothalamus down the brainstem’s lateral side to the cord at C8–T2, out over the lung’s apex and up the carotid. A small pupil with a slight ptosis, the difference larger in the dark, is Horner’s syndrome, anywhere on that path. III moves the eye up, down and in, IV down and in, VI out. Nystagmus that beats toward the gaze and grows with it is the cerebellum’s or the brainstem’s failure to hold the eyes there.',
        'Die Lider, die Pupillen bei Raum- und Dämmerlicht, und die Augen, die einem Ziel folgen. Das Lid hebt der Levator (III) und der Müller-Muskel (Sympathikus); die Pupille verengen die parasympathischen Fasern des III, erweitern der Sympathikus, der vom Hypothalamus an der Seite des Hirnstamms hinab zum Rückenmark bei C8–T2 zieht, über die Lungenspitze hinaus und an der Karotis hinauf. Eine kleine Pupille mit leichter Ptose, der Unterschied im Dunkeln größer, ist das Horner-Syndrom, irgendwo auf diesem Weg. III bewegt das Auge nach oben, unten und innen, IV nach unten innen, VI nach außen. Ein Nystagmus, der in Blickrichtung schlägt und mit ihr zunimmt, ist das Versagen von Kleinhirn oder Hirnstamm, die Augen dort zu halten.');
      for (const x of SIDES) {
        const lid = v(`eye.lid.${x}`) ?? {}, room = v(`eye.pupil.${x}`, { lightOn: 'none', ambient: 'room' })?.sizeMm, dim = v(`eye.pupil.${x}`, { lightOn: 'none', ambient: 'dim' })?.sizeMm;
        const o: S = x === 'R' ? 'L' : 'R', dimO = v(`eye.pupil.${o}`, { lightOn: 'none', ambient: 'dim' })?.sizeMm, roomO = v(`eye.pupil.${o}`, { lightOn: 'none', ambient: 'room' })?.sizeMm;
        const ptosis = (lid.ptosisMm ?? 0) >= 1;
        if (ptosis && typeof dim === 'number' && typeof dimO === 'number' && dimO - dim >= 0.5)
          add(`The ${sideEn(x)} lid droops and the ${sideEn(x)} pupil is the smaller, more so in the dark: Horner’s syndrome on the ${sideEn(x)}, the sympathetic pathway.`, `Das Lid ${sideDe(x)} hängt und die Pupille ${sideDe(x)} ist die kleinere, im Dunkeln mehr: Horner-Syndrom ${sideDe(x)}, die Sympathikusbahn.`);
        else if (ptosis && typeof room === 'number' && typeof roomO === 'number' && room - roomO >= 1)
          add(`The ${sideEn(x)} lid droops over a large pupil: the ${sideEn(x)} third nerve, its pupil fibres included.`, `Das Lid ${sideDe(x)} hängt über einer weiten Pupille: der N. oculomotorius ${sideDe(x)}, mit seinen Pupillenfasern.`);
        else if (ptosis) add(`The ${sideEn(x)} lid droops (${lid.ptosisMm} mm).`, `Das Lid ${sideDe(x)} hängt (${lid.ptosisMm} mm).`);
      }
      const ny = (g: 'primary' | 'left' | 'right') => { const n = v('eyes.nystagmus', { gaze: g, fixation: true }) ?? {}; return n.present && !n.physiological ? n : null; };
      const nR = ny('right'), nL = ny('left'), n0 = ny('primary');
      const fp = (n: any) => (n.fastPhase === 'left' ? 'L' : n.fastPhase === 'right' ? 'R' : null) as S | null;
      if (n0 && fp(n0)) add(`Nystagmus looking straight ahead, beating to the ${sideEn(fp(n0)!)}${nR && nL && fp(nR) !== fp(nL) ? ', and changing direction with the gaze: central' : ''}.`, `Nystagmus beim Geradeausblick, nach ${sideDe(fp(n0)!)} schlagend${nR && nL && fp(nR) !== fp(nL) ? ', mit der Blickrichtung wechselnd: zentral' : ''}.`);
      else if (nR || nL) add(`Nystagmus only on looking ${nR && nL ? 'to either side' : nR ? 'right' : 'left'}, beating toward the gaze: gaze-evoked, the cerebellum or the brainstem.`, `Nystagmus nur beim Blick ${nR && nL ? 'zu beiden Seiten' : nR ? 'nach rechts' : 'nach links'}, in Blickrichtung schlagend: blickrichtungsabhängig, Kleinhirn oder Hirnstamm.`);
      for (const x of SIDES) { const m = v(`eye.motility.${x}`) ?? {};
        if ((m.abduction ?? 100) < 80) add(`The ${sideEn(x)} eye does not go fully out: the ${sideEn(x)} sixth nerve (lateral rectus).`, `Das ${x === 'R' ? 'rechte' : 'linke'} Auge geht nicht ganz nach außen: N. abducens ${sideDe(x)} (M. rectus lateralis).`);
        if ((m.adduction ?? 100) < 80 && (m.elevation ?? 100) < 80) add(`The ${sideEn(x)} eye does not go in or up: the ${sideEn(x)} third nerve.`, `Das ${x === 'R' ? 'rechte' : 'linke'} Auge geht nicht nach innen und oben: N. oculomotorius ${sideDe(x)}.`); }
      if (out.length === 1) add('Lids, pupils and eye movements are normal.', 'Lider, Pupillen und Augenbewegungen sind unauffällig.');
      return { title: L('Eyes: the lids, the pupils and the nerves that move them', 'Augen: die Lider, die Pupillen und die Nerven, die sie bewegen'), body: out };
    }
    case 'cranial': {
      add('The face, mouth and neck test the brainstem’s nerves. The lower face takes its upper motor neuron from the other hemisphere only, the forehead from both: a hemisphere lesion spares the forehead, a facial nerve lesion takes it. The jaw deviates toward a weak trigeminal side; the uvula is pulled away from a weak palate (X); the tongue points toward its weak side (XII), wasted and fasciculating if the nucleus or nerve is cut; a weak shrug and head turn is XI.',
        'Gesicht, Mund und Hals prüfen die Nerven des Hirnstamms. Das untere Gesicht erhält sein erstes Motoneuron nur von der Gegenseite, die Stirn von beiden: Eine Hemisphärenläsion spart die Stirn aus, eine Läsion des N. facialis nimmt sie mit. Der Unterkiefer weicht zur schwachen Trigeminusseite ab; die Uvula wird vom schwachen Gaumensegel weggezogen (X); die Zunge weicht zur schwachen Seite ab (XII), atrophisch und faszikulierend, wenn Kern oder Nerv betroffen sind; ein schwaches Schulterheben und Kopfdrehen ist der XI.');
      for (const x of SIDES) {
        const f = v(`face.movement.${x}`) ?? {};
        if (f.mouth && f.mouth !== 'normal') add(f.forehead === 'normal' ? `The ${sideEn(x)} lower face is weak, the forehead spared: an upper motor neuron lesion in the other hemisphere.` : `The whole ${sideEn(x)} face is weak, forehead included: the facial nerve or its nucleus on the ${sideEn(x)}.`,
          f.forehead === 'normal' ? `Das untere Gesicht ${sideDe(x)} ist schwach, die Stirn ausgespart: eine zentrale Läsion in der Gegenhemisphäre.` : `Das ganze Gesicht ${sideDe(x)} ist schwach, mit der Stirn: N. facialis oder sein Kern ${sideDe(x)}.`);
      }
      const jaw = v('jaw.opening')?.deviatesTo, pal = v('mouth.palate') ?? {}, tg = v('mouth.tongue') ?? {};
      if (jaw && jaw !== 'none') add(`The jaw opens toward the ${sideEn(jaw)}: the ${sideEn(jaw)} trigeminal motor root or nucleus.`, `Der Kiefer weicht beim Öffnen nach ${sideDe(jaw)} ab: motorischer Trigeminus ${sideDe(jaw)}.`);
      if (pal.uvulaDeviatesTo && pal.uvulaDeviatesTo !== 'none') { const weak: S = pal.uvulaDeviatesTo === 'R' ? 'L' : 'R'; add(`The uvula is pulled to the ${sideEn(pal.uvulaDeviatesTo)}: the ${sideEn(weak)} palate is weak (vagus).${pal.voice === 'hoarse' ? ' The voice is hoarse.' : ''}`, `Die Uvula wird nach ${sideDe(pal.uvulaDeviatesTo)} gezogen: Das Gaumensegel ${sideDe(weak)} ist schwach (N. vagus).${pal.voice === 'hoarse' ? ' Die Stimme ist heiser.' : ''}`); }
      if (tg.deviatesTo && tg.deviatesTo !== 'none') add(`The tongue points to the ${sideEn(tg.deviatesTo)}${tg.wasting ? ', wasted' : ''}${tg.fasciculation ? ' and fasciculating' : ''}: the ${sideEn(tg.deviatesTo)} hypoglossal ${tg.wasting ? 'nucleus or nerve' : 'side is weak; without wasting, an upper motor neuron lesion in the other hemisphere'}.`,
        `Die Zunge weicht nach ${sideDe(tg.deviatesTo)} ab${tg.wasting ? ', atrophisch' : ''}${tg.fasciculation ? ' und faszikulierend' : ''}: ${tg.wasting ? `Hypoglossuskern oder -nerv ${sideDe(tg.deviatesTo)}` : `die Seite ${sideDe(tg.deviatesTo)} ist schwach; ohne Atrophie eine zentrale Läsion der Gegenhemisphäre`}.`);
      for (const x of SIDES) { const p = v(`shoulder.shrug.${x}`)?.power; if (typeof p === 'number' && p < 5) add(`Shrug and head turn weak on the ${sideEn(x)} (${p}/5): the accessory nerve (XI).`, `Schulterheben und Kopfdrehen ${sideDe(x)} schwach (${p}/5): N. accessorius (XI).`); }
      if (out.length === 1) add('Face, jaw, palate, tongue and shrug are normal.', 'Gesicht, Kiefer, Gaumensegel, Zunge und Schulterheben sind unauffällig.');
      return { title: L('Face, mouth and neck: the brainstem’s nerves', 'Gesicht, Mund und Hals: die Nerven des Hirnstamms'), body: out };
    }
    case 'speech': {
      add('Speech has two parts. Language, in the dominant (usually left) hemisphere: Broca’s area makes speech (non-fluent when it is lost, understanding kept), Wernicke’s understands it (fluent but empty, understanding lost), and the arcuate fasciculus joining them lets words be repeated. Articulation, the mouth’s mechanics: slurred (dysarthria) with a corticobulbar, cerebellar or bulbar lesion. A voice that fades and turns nasal while counting is the fatigue of the neuromuscular junction.',
        'Sprechen hat zwei Teile. Sprache, in der dominanten (meist linken) Hemisphäre: Das Broca-Areal bildet sie (nicht flüssig, wenn es ausfällt, bei erhaltenem Verständnis), das Wernicke-Areal versteht sie (flüssig, aber inhaltsleer, Verständnis gestört), und der Fasciculus arcuatus verbindet beide und erlaubt das Nachsprechen. Artikulation, die Mechanik des Mundes: verwaschen (Dysarthrie) bei einer kortikobulbären, zerebellären oder bulbären Läsion. Eine Stimme, die beim Zählen leiser und näselnd wird, ist die Ermüdung der motorischen Endplatte.');
      const sp = v('speech.language') ?? {}, fat = v('speech.fatigue', { repetition: 50 })?.voice;
      const bad = ['fluency', 'comprehension', 'repetition', 'naming'].filter((k) => sp[k] && sp[k] !== 'normal');
      if (bad.length) add(`Impaired: ${bad.join(', ')}.${bad.includes('fluency') && !bad.includes('comprehension') ? ' Non-fluent with understanding kept: Broca’s aphasia, the left frontal lobe.' : bad.includes('comprehension') && !bad.includes('fluency') ? ' Fluent with understanding lost: Wernicke’s aphasia, the left temporal lobe.' : ''}`,
        `Gestört: ${bad.map((k) => ({ fluency: 'Flüssigkeit', comprehension: 'Verständnis', repetition: 'Nachsprechen', naming: 'Benennen' } as Record<string, string>)[k]).join(', ')}.${bad.includes('fluency') && !bad.includes('comprehension') ? ' Nicht flüssig bei erhaltenem Verständnis: Broca-Aphasie, der linke Frontallappen.' : bad.includes('comprehension') && !bad.includes('fluency') ? ' Flüssig bei gestörtem Verständnis: Wernicke-Aphasie, der linke Temporallappen.' : ''}`);
      if (sp.articulation === 'dysarthric') add('Articulation is slurred: dysarthria.', 'Die Artikulation ist verwaschen: Dysarthrie.');
      if (fat === 'fading-nasal') add('Counting to 50, the voice fades and turns nasal: fatigable bulbar weakness, the neuromuscular junction.', 'Beim Zählen bis 50 wird die Stimme leiser und näselnd: ermüdbare bulbäre Schwäche, die motorische Endplatte.');
      if (out.length === 1) add('Speech and language are normal.', 'Sprache und Sprechen sind unauffällig.');
      return { title: L('Speech: language and articulation', 'Sprache: Sprachfunktion und Artikulation'), body: out };
    }
  }
}
