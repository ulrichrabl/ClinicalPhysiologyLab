import type { TeachingCard } from '../../model/types.ts';
import { f, l, t } from './helpers.ts';

/* Nervous system: tone, power, reflexes and sensation in the limbs and trunk. */

const MRC = t('MRC grades: 0 no contraction, 1 a flicker, 2 movement with gravity eliminated, 3 against gravity, 4 against some resistance, 5 normal.',
  'Kraftgrade (MRC): 0 keine Kontraktion, 1 sichtbare Kontraktion, 2 Bewegung unter Aufhebung der Schwerkraft, 3 gegen die Schwerkraft, 4 gegen leichten Widerstand, 5 volle Kraft.');

const UMN = t('Upper motor neurone lesion: brain or spinal cord.', 'Läsion des ersten Motoneurons: Gehirn oder Rückenmark.');
const LMN = t('Lower motor neurone lesion: anterior horn, root, plexus or nerve.', 'Läsion des zweiten Motoneurons: Vorderhorn, Wurzel, Plexus oder Nerv.');

export const NEURO_LIMBS: Record<string, TeachingCard> = {
  'test.arm.tone': {
    aliases: l(['spasticity', 'rigidity', 'supinator catch'], ['Spastik', 'Rigor', 'Muskeltonus']),
    assesses: t('Resistance of the relaxed arm to passive movement; with inspection for wasting and fasciculation, the first step in telling upper from lower motor neurone.',
      'Den Widerstand des entspannten Arms gegen passive Bewegung; zusammen mit der Inspektion auf Atrophie und Faszikulationen der erste Schritt, erstes und zweites Motoneuron zu unterscheiden.'),
    how: l([
      'Look at the arms for wasting and fasciculation.',
      'Ask the patient to relax and let you move the arm; flex and extend the elbow, and pronate and supinate the forearm quickly (a catch on supination suggests spasticity).',
    ], [
      'Die Arme auf Atrophie und Faszikulationen ansehen.',
      'Den Patienten bitten, locker zu lassen; den Ellenbogen beugen und strecken und den Unterarm rasch pronieren und supinieren (ein Widerstand bei Supination spricht für Spastik).',
    ]),
    normal: t('Slight, even resistance; no wasting or fasciculation.', 'Geringer, gleichmäßiger Widerstand; keine Atrophie oder Faszikulationen.'),
    abnormal: [
      f(t('A catch that gives way, worse with faster movement (spasticity).', 'Ein federnder Widerstand, der nachgibt, stärker bei schnellerer Bewegung (Spastik, Taschenmesserphänomen).'),
        t('Upper motor neurone lesion; it develops days to weeks after a stroke.', 'Läsion des ersten Motoneurons; sie entwickelt sich Tage bis Wochen nach einem Schlaganfall.'),
        ['arm.tone'], ['ischaemic-stroke-left-mca', 'multiple-sclerosis', 'motor-neurone-disease']),
      f(t('Even resistance throughout (lead-pipe), or ratchet-like (cogwheel).', 'Gleichmäßiger Widerstand (wächserner Rigor) oder ruckartig (Zahnradphänomen).'),
        t('Rigidity: extrapyramidal disease (Parkinsonism).', 'Rigor: extrapyramidale Erkrankung (Parkinson-Syndrom).'), ['arm.tone']),
      f(t('Floppy with wasting and fasciculation.', 'Schlaff mit Atrophie und Faszikulationen.'), t('Lower motor neurone lesion.', 'Läsion des zweiten Motoneurons.'),
        ['arm.tone'], ['motor-neurone-disease', 'guillain-barre']),
    ],
    pitfalls: l(['Immediately after a stroke the limb is often floppy; spasticity follows later.'], ['Unmittelbar nach einem Schlaganfall ist die Extremität oft schlaff; die Spastik folgt später.']),
  },

  'test.pronator-drift': {
    aliases: l(['pronator drift', 'Barré test'], ['Armvorhalteversuch', 'Barré-Zeichen']),
    assesses: t('Subtle upper motor neurone weakness of the arm, often seen before formal power testing finds it.',
      'Eine leichte zentrale Armschwäche, oft sichtbar, bevor die formale Kraftprüfung sie findet.'),
    how: l(['Ask the patient to hold both arms straight out in front, palms up, and close the eyes.', 'Watch for 20–30 seconds.'],
      ['Den Patienten beide Arme gestreckt nach vorne halten lassen, Handflächen nach oben, Augen geschlossen.', '20–30 Sekunden beobachten.']),
    normal: t('Both arms stay level, palms up.', 'Beide Arme bleiben auf gleicher Höhe, Handflächen nach oben.'),
    abnormal: [
      f(t('One arm turns palm-down and sinks.', 'Ein Arm proniert und sinkt ab.'),
        t('Upper motor neurone weakness: a lesion in the opposite hemisphere.', 'Zentrale Schwäche: eine Läsion der gegenseitigen Hemisphäre.'),
        ['arm.drift'], ['ischaemic-stroke-left-mca', 'intracerebral-haemorrhage', 'subdural-haematoma']),
      f(t('One arm rises or wanders, the fingers moving restlessly.', 'Ein Arm steigt auf oder wandert, die Finger bewegen sich unruhig.'),
        t('Loss of position sense (pseudoathetosis) or a cerebellar lesion on that side.', 'Verlust des Lagesinns (Pseudoathetose) oder eine Kleinhirnläsion dieser Seite.'), ['arm.drift'], ['cerebellar-stroke', 'b12-deficiency']),
    ],
  },

  'test.arm.power': {
    aliases: l(['MRC grading', 'myotomes'], ['Kraftgrade', 'Kennmuskeln']),
    assesses: t('The strength of each movement against resistance; the pattern shows whether the lesion is central, in a root, a nerve, the junction or the muscle.',
      'Die Kraft jeder Bewegung gegen Widerstand; das Muster zeigt, ob die Läsion zentral, in einer Wurzel, einem Nerv, der Endplatte oder im Muskel liegt.'),
    how: l([
      'Test each movement and compare the sides, steadying the joint above: shoulder abduction (C5), elbow flexion (C5–6), elbow extension (C7), wrist extension (C6–7), finger extension (C7), finger flexion (C8), finger abduction (T1).',
      'Grade each on the MRC scale.',
    ], [
      'Jede Bewegung prüfen und die Seiten vergleichen, das proximale Gelenk fixieren: Schulterabduktion (C5), Ellenbogenbeugung (C5–6), Ellenbogenstreckung (C7), Handgelenkstreckung (C6–7), Fingerstreckung (C7), Fingerbeugung (C8), Fingerspreizung (T1).',
      'Jede nach den Kraftgraden (MRC) bewerten.',
    ]),
    normal: t(`Grade 5 in every movement, equal on both sides. ${MRC.en}`, `Kraftgrad 5 in jeder Bewegung, seitengleich. ${MRC.de}`),
    abnormal: [
      f(t('Extensors weaker than flexors (pyramidal pattern), on one side.', 'Strecker schwächer als Beuger (pyramidales Muster), einseitig.'),
        t('Upper motor neurone lesion in the opposite hemisphere.', 'Läsion des ersten Motoneurons in der gegenseitigen Hemisphäre.'), ['arm.power'], ['ischaemic-stroke-left-mca', 'intracerebral-haemorrhage']),
      f(t('Weakness confined to the muscles of one root (myotome).', 'Schwäche beschränkt auf die Muskeln einer Wurzel (Myotom).'), t('Radiculopathy.', 'Radikulopathie.'), ['arm.power']),
      f(t('Symmetrical weakness, proximal or ascending.', 'Symmetrische Schwäche, proximal oder aufsteigend.'),
        t('Guillain–Barré syndrome, myopathy, myasthenia.', 'Guillain-Barré-Syndrom, Myopathie, Myasthenie.'), ['arm.power'], ['guillain-barre', 'myasthenia-gravis']),
      f(t('Weakness with wasting and fasciculation, mixed with brisk reflexes.', 'Schwäche mit Atrophie und Faszikulationen, gemischt mit lebhaften Reflexen.'),
        t('Motor neurone disease: upper and lower motor neurones together.', 'Motoneuronerkrankung: erstes und zweites Motoneuron gemeinsam.'), ['arm.power'], ['motor-neurone-disease']),
    ],
  },

  'test.power-repeated': {
    aliases: l(['fatigability'], ['Ermüdbarkeit', 'Belastungstest']),
    assesses: t('Fatigable weakness: whether power falls with repeated use, the hallmark of a disorder of the neuromuscular junction.',
      'Belastungsabhängige Schwäche: ob die Kraft bei wiederholter Beanspruchung nachlässt, das Kennzeichen einer Störung der neuromuskulären Übertragung.'),
    how: l(['Test shoulder abduction once.', 'Ask the patient to abduct the arms twenty times, then test again.'],
      ['Die Schulterabduktion einmal prüfen.', 'Den Patienten die Arme zwanzigmal abduzieren lassen, dann erneut prüfen.']),
    normal: t('The same strength at the end as at the start.', 'Am Ende dieselbe Kraft wie am Anfang.'),
    abnormal: [
      f(t('Strength fades with repetition and recovers with rest.', 'Die Kraft lässt bei Wiederholung nach und erholt sich in Ruhe.'), t('Myasthenia gravis.', 'Myasthenia gravis.'), ['arm.power'], ['myasthenia-gravis']),
    ],
  },

  'test.arm.reflexes': {
    aliases: l(['biceps jerk', 'supinator jerk', 'triceps jerk', 'Hoffmann sign'], ['BSR', 'BRR', 'TSR', 'Muskeleigenreflexe', 'Trömner']),
    assesses: t('The monosynaptic stretch reflex arc of each root (biceps and supinator C5–6, triceps C7), and its control from above.',
      'Den monosynaptischen Dehnungsreflexbogen jeder Wurzel (Bizeps und Brachioradialis C5–6, Trizeps C7) und seine Kontrolle von oben.'),
    how: l([
      'The arms relaxed and positioned symmetrically.',
      'Strike the biceps tendon (through your thumb), the brachioradialis above the wrist, and the triceps above the elbow; compare the sides.',
      'If absent, repeat with reinforcement: the patient clenches the teeth.',
    ], [
      'Arme entspannt und symmetrisch gelagert.',
      'Auf die Bizepssehne (über den eigenen Daumen), den Brachioradialis über dem Handgelenk und die Trizepssehne über dem Ellenbogen schlagen; Seiten vergleichen.',
      'Fehlt ein Reflex, mit Bahnung wiederholen: der Patient beißt die Zähne zusammen.',
    ]),
    normal: t('Present and equal on both sides.', 'Auslösbar und seitengleich.'),
    abnormal: [
      f(t('Brisk, spreading reflexes on one side.', 'Lebhafte Reflexe mit verbreiterter Reflexzone auf einer Seite.'),
        t('Upper motor neurone lesion.', 'Läsion des ersten Motoneurons.'), ['arm.reflexes'], ['ischaemic-stroke-left-mca', 'multiple-sclerosis', 'motor-neurone-disease']),
      f(t('Reflexes absent even with reinforcement.', 'Reflexe auch mit Bahnung nicht auslösbar.'),
        t('Lower motor neurone lesion: root, neuropathy, Guillain–Barré syndrome.', 'Läsion des zweiten Motoneurons: Wurzel, Neuropathie, Guillain-Barré-Syndrom.'), ['arm.reflexes'], ['guillain-barre']),
    ],
    pitfalls: l(['Symmetrically brisk reflexes can be normal in anxious young people; asymmetry matters more than briskness.'],
      ['Symmetrisch lebhafte Reflexe können bei ängstlichen jungen Menschen normal sein; die Seitendifferenz zählt mehr als die Lebhaftigkeit.']),
  },

  'test.leg.tone': {
    aliases: l(['clonus', 'spasticity'], ['Klonus', 'Spastik']),
    assesses: t('Resistance of the relaxed leg to passive movement, and clonus at the ankle.', 'Den Widerstand des entspannten Beins gegen passive Bewegung und einen Klonus am Sprunggelenk.'),
    how: l([
      'Look for wasting and fasciculation.',
      'Roll the leg from side to side; lift the knee briskly from behind: in increased tone the heel lifts off the bed.',
      'Ankle clonus: flex the knee, dorsiflex the foot sharply and hold it.',
    ], [
      'Auf Atrophie und Faszikulationen achten.',
      'Das Bein hin- und herrollen; das Knie von hinten rasch anheben: bei erhöhtem Tonus hebt sich die Ferse von der Unterlage.',
      'Fußklonus: das Knie beugen, den Fuß ruckartig dorsalflektieren und halten.',
    ]),
    normal: t('The heel slides along the bed; no more than two or three beats of clonus.', 'Die Ferse gleitet auf der Unterlage; höchstens zwei bis drei Kloni.'),
    abnormal: [
      f(t('Spastic tone; sustained clonus.', 'Spastischer Tonus; unerschöpflicher Klonus.'), UMN, ['leg.tone'], ['ischaemic-stroke-left-mca', 'multiple-sclerosis', 'b12-deficiency']),
      f(t('Floppy, wasted leg.', 'Schlaffes, atrophes Bein.'), LMN, ['leg.tone'], ['guillain-barre', 'motor-neurone-disease']),
    ],
  },

  'test.leg.power': {
    aliases: l(['MRC grading', 'myotomes', 'foot drop'], ['Kraftgrade', 'Kennmuskeln', 'Fußheberparese']),
    assesses: t('The strength of each movement of the leg; the pattern places the lesion, as in foot drop: root, nerve or brain.',
      'Die Kraft jeder Bewegung des Beins; das Muster ordnet die Läsion zu, wie bei der Fußheberschwäche: Wurzel, Nerv oder Gehirn.'),
    how: l([
      'Test and compare: hip flexion (L1–2), hip extension (L5–S1), knee extension (L3–4), knee flexion (S1), ankle dorsiflexion (L4–5), big toe extension (L5), plantarflexion (S1–2), foot inversion (L5, tibial nerve) and eversion (S1, peroneal nerve).',
      'Grade each on the MRC scale.',
    ], [
      'Prüfen und vergleichen: Hüftbeugung (L1–2), Hüftstreckung (L5–S1), Kniestreckung (L3–4), Kniebeugung (S1), Fußhebung (L4–5), Großzehenhebung (L5), Fußsenkung (S1–2), Supination des Fußes (L5, N. tibialis) und Pronation (S1, N. peroneus).',
      'Jede nach den Kraftgraden (MRC) bewerten.',
    ]),
    normal: t(`Grade 5 throughout, equal on both sides. ${MRC.en}`, `Überall Kraftgrad 5, seitengleich. ${MRC.de}`),
    abnormal: [
      f(t('Weak dorsiflexion and big toe extension, with weak inversion.', 'Schwache Fuß- und Großzehenhebung mit schwacher Supination.'),
        t('L5 root: inversion is supplied by the tibial nerve, so its weakness puts the lesion above the knee, at the root.',
          'Wurzel L5: die Supination versorgt der N. tibialis, ihre Schwäche verlegt die Läsion oberhalb des Knies, an die Wurzel.'),
        ['leg.power'], ['l5-radiculopathy']),
      f(t('Weak dorsiflexion and eversion with normal inversion.', 'Schwache Fußhebung und Pronation bei normaler Supination.'),
        t('Common peroneal nerve palsy at the fibular head (crossed legs, plaster, weight loss).', 'Peroneusparese am Fibulaköpfchen (übereinandergeschlagene Beine, Gips, Gewichtsverlust).'), ['leg.power'], ['common-peroneal-palsy']),
      f(t('Weak plantarflexion and eversion.', 'Schwache Fußsenkung und Pronation.'), t('S1 root.', 'Wurzel S1.'), ['leg.power'], ['s1-radiculopathy']),
      f(t('Flexors weaker than extensors, on one side, with the arm.', 'Beuger schwächer als Strecker, einseitig, zusammen mit dem Arm.'),
        t('Upper motor neurone lesion (hemiparesis).', 'Läsion des ersten Motoneurons (Hemiparese).'), ['leg.power'], ['ischaemic-stroke-left-mca']),
      f(t('Symmetrical weakness rising from the feet.', 'Symmetrische, von den Füßen aufsteigende Schwäche.'), t('Guillain–Barré syndrome.', 'Guillain-Barré-Syndrom.'), ['leg.power'], ['guillain-barre']),
    ],
  },

  'test.leg.reflexes': {
    aliases: l(['knee jerk', 'ankle jerk', 'plantar response', 'Babinski sign'], ['PSR', 'ASR', 'Babinski-Zeichen', 'Patellarsehnenreflex', 'Achillessehnenreflex']),
    assesses: t('The knee (L3–4) and ankle (S1) reflex arcs, and the plantar response, which turns upgoing when the corticospinal tract is damaged.',
      'Die Reflexbögen von Patellarsehne (L3–4) und Achillessehne (S1) und die Fußsohlenantwort, die bei Schädigung der Pyramidenbahn nach oben geht.'),
    how: l([
      'Knee: support both knees slightly flexed and strike the patellar tendon. Ankle: dorsiflex the foot slightly and strike the Achilles tendon.',
      'Reinforce if absent: the patient pulls interlocked fingers apart.',
      'Plantar: stroke the outer edge of the sole firmly from the heel to the little toe and across the ball; watch the big toe.',
    ], [
      'Patellarsehnenreflex: beide Knie leicht gebeugt unterstützen und auf die Patellarsehne schlagen. Achillessehnenreflex: den Fuß leicht dorsalflektieren und auf die Achillessehne schlagen.',
      'Fehlt ein Reflex, bahnen: der Patient zieht die verhakten Finger auseinander (Jendrassik).',
      'Fußsohle: den lateralen Fußrand fest von der Ferse zur Kleinzehe und quer über den Ballen bestreichen; die Großzehe beobachten.',
    ]),
    normal: t('Knee and ankle reflexes present and equal; the big toe flexes down.', 'Patellar- und Achillessehnenreflex auslösbar und seitengleich; die Großzehe beugt sich nach unten.'),
    abnormal: [
      f(t('The big toe extends upwards and the other toes fan (Babinski sign).', 'Die Großzehe streckt sich nach oben, die anderen Zehen spreizen sich (Babinski-Zeichen).'),
        t('Upper motor neurone lesion: corticospinal tract.', 'Läsion des ersten Motoneurons: Pyramidenbahn.'), ['leg.reflexes'], ['ischaemic-stroke-left-mca', 'multiple-sclerosis', 'motor-neurone-disease']),
      f(t('Absent ankle reflex on one side.', 'Fehlender Achillessehnenreflex auf einer Seite.'), t('S1 radiculopathy.', 'Radikulopathie S1.'), ['leg.reflexes'], ['s1-radiculopathy']),
      f(t('All reflexes absent.', 'Alle Reflexe erloschen.'), t('Guillain–Barré syndrome or another polyneuropathy.', 'Guillain-Barré-Syndrom oder eine andere Polyneuropathie.'), ['leg.reflexes'], ['guillain-barre']),
      f(t('Absent ankle reflexes with upgoing plantars.', 'Fehlende Achillessehnenreflexe mit positivem Babinski.'),
        t('Peripheral nerves and corticospinal tracts damaged together: vitamin B₁₂ deficiency (subacute combined degeneration), also motor neurone disease.',
          'Periphere Nerven und Pyramidenbahnen gemeinsam geschädigt: Vitamin-B₁₂-Mangel (funikuläre Myelose), auch Motoneuronerkrankung.'),
        ['leg.reflexes'], ['b12-deficiency', 'motor-neurone-disease']),
    ],
    pitfalls: l(['Ankle reflexes fade with age; their absence in the very old is common and not always disease.'],
      ['Achillessehnenreflexe werden im Alter schwächer; ihr Fehlen bei sehr alten Menschen ist häufig und nicht immer krankhaft.']),
  },

  'test.slr': {
    aliases: l(['Lasègue sign', 'straight leg raising'], ['Lasègue-Zeichen', 'Lasègue-Test']),
    assesses: t('Tension on the lower lumbar and sacral roots (L5, S1) through the sciatic nerve: an irritated root, usually from a disc, hurts when stretched.',
      'Zug an den unteren Lumbal- und Sakralwurzeln (L5, S1) über den N. ischiadicus: eine gereizte Wurzel, meist durch einen Bandscheibenvorfall, schmerzt bei Dehnung.'),
    how: l(['The patient lies flat.', 'Lift the straight leg slowly by the heel; note the angle at which pain starts and where it is felt.', 'Dorsiflexing the foot at that point increases the pain if it is radicular (Bragard).'],
      ['Der Patient liegt flach.', 'Das gestreckte Bein an der Ferse langsam anheben; den Winkel des Schmerzbeginns und den Schmerzort notieren.', 'Eine Dorsalflexion des Fußes an diesem Punkt verstärkt einen radikulären Schmerz (Bragard).']),
    normal: t('The leg rises to 70–90° with at most a pulling behind the knee (tight hamstrings).', 'Das Bein lässt sich auf 70–90° heben, höchstens mit Ziehen in der Kniekehle (verkürzte ischiokrurale Muskulatur).'),
    abnormal: [
      f(t('Pain shooting down the leg below the knee between 30° and 70°.', 'Ins Bein unterhalb des Knies einschießender Schmerz zwischen 30° und 70°.'),
        t('Root tension: L5 or S1 radiculopathy, usually a disc prolapse. Pain in the affected leg when the other leg is lifted (crossed sign) is specific for disc herniation.',
          'Wurzelreizung: Radikulopathie L5 oder S1, meist ein Bandscheibenvorfall. Schmerz im betroffenen Bein beim Anheben des anderen (gekreuzter Lasègue) ist spezifisch für einen Bandscheibenvorfall.'),
        ['leg.slr'], ['l5-radiculopathy', 's1-radiculopathy']),
    ],
  },

  'test.arm.pinprick': {
    aliases: l(['dermatomes', 'spinothalamic sensation'], ['Dermatome', 'Schmerzempfinden']),
    assesses: t('Pain sensation (spinothalamic tract), dermatome by dermatome: C5 lateral upper arm, C6 thumb, C7 middle finger, C8 little finger, T1 inner forearm.',
      'Das Schmerzempfinden (Tractus spinothalamicus), Dermatom für Dermatom: C5 lateraler Oberarm, C6 Daumen, C7 Mittelfinger, C8 Kleinfinger, T1 Unterarminnenseite.'),
    how: l(['Show the patient the pin on the sternum, so they know what sharp feels like.', 'With the eyes closed, test each dermatome and compare the sides: sharp or blunt? the same?'],
      ['Die Nadel am Sternum zeigen, damit der Patient weiß, wie spitz sich anfühlt.', 'Bei geschlossenen Augen jedes Dermatom prüfen und die Seiten vergleichen: spitz oder stumpf? gleich?']),
    normal: t('Sharp everywhere, the same on both sides.', 'Überall spitz, seitengleich.'),
    abnormal: [
      f(t('Loss in one dermatome.', 'Ausfall in einem Dermatom.'), t('Radiculopathy.', 'Radikulopathie.'), ['arm.pinprick']),
      f(t('Loss over a whole half of the body, face included.', 'Ausfall einer ganzen Körperhälfte einschließlich des Gesichts.'),
        t('A lesion of the opposite hemisphere or thalamus.', 'Eine Läsion der gegenseitigen Hemisphäre oder des Thalamus.'), ['arm.pinprick'], ['ischaemic-stroke-left-mca']),
      f(t('Loss in the body on one side and the face on the other.', 'Ausfall am Körper einer Seite und im Gesicht der anderen.'),
        t('Lateral medullary syndrome: the spinothalamic tract has already crossed, the trigeminal tract not yet.', 'Wallenberg-Syndrom: der Tractus spinothalamicus hat schon gekreuzt, die Trigeminusbahn noch nicht.'),
        ['arm.pinprick'], ['lateral-medullary-syndrome']),
    ],
  },

  'test.arm.vibration': {
    aliases: l(['proprioception', 'dorsal columns', 'joint position sense'], ['Pallästhesie', 'Lagesinn', 'Hinterstränge']),
    assesses: t('Large-fibre sensation carried in the dorsal columns: vibration and the sense of joint position.', 'Die über die Hinterstränge geleitete Sensibilität der dicken Fasern: Vibration und Lagesinn.'),
    how: l([
      'Place a vibrating 128 Hz tuning fork on the tip of a finger; ask the patient to say when it stops. If absent, move up: wrist, elbow.',
      'Joint position: hold the distal phalanx by its sides, move it up or down a few millimetres with the eyes closed, and ask which way.',
    ], [
      'Eine schwingende 128-Hz-Stimmgabel auf eine Fingerkuppe setzen; der Patient sagt, wann es aufhört. Fehlt die Wahrnehmung, nach proximal gehen: Handgelenk, Ellenbogen.',
      'Lagesinn: das Fingerendglied seitlich fassen, bei geschlossenen Augen wenige Millimeter nach oben oder unten bewegen und nach der Richtung fragen.',
    ]),
    normal: t('Vibration felt as long as the examiner can feel it; small movements reported correctly.', 'Vibration so lange gespürt, wie der Untersucher sie fühlt; kleine Bewegungen richtig angegeben.'),
    abnormal: [
      f(t('Vibration and position sense lost at the fingertips.', 'Vibration und Lagesinn an den Fingerspitzen erloschen.'),
        t('Large-fibre neuropathy or a dorsal column lesion (vitamin B₁₂ deficiency, multiple sclerosis).', 'Neuropathie der dicken Fasern oder Hinterstrangläsion (Vitamin-B₁₂-Mangel, Multiple Sklerose).'),
        ['arm.vibration'], ['b12-deficiency', 'multiple-sclerosis']),
    ],
  },

  'test.trunk.pinprick': {
    aliases: l(['sensory level', 'spinal cord compression'], ['sensibles Querschnittsniveau', 'Rückenmarkskompression']),
    assesses: t('Whether sensation changes at a level across the trunk, the sign of a spinal cord lesion at or above that level. Landmarks: T4 nipples, T10 umbilicus, L1 groin.',
      'Ob sich die Sensibilität an einer Höhe quer über den Rumpf ändert, das Zeichen einer Rückenmarksläsion auf oder über dieser Höhe. Orientierung: Th4 Mamillen, Th10 Nabel, L1 Leiste.'),
    how: l(['Move the pin upwards from the legs along the trunk, front and back, both sides, and ask when it becomes sharp.'],
      ['Die Nadel von den Beinen den Rumpf hinauf führen, vorne und hinten, beidseits, und fragen, ab wann es spitz wird.']),
    normal: t('Sharp throughout; no level.', 'Überall spitz; kein Niveau.'),
    abnormal: [
      f(t('A level below which pinprick is reduced.', 'Eine Höhe, unterhalb derer das Schmerzempfinden vermindert ist.'),
        t('A spinal cord lesion: compression (tumour, abscess, disc) or myelitis. An emergency: image the spine.', 'Eine Rückenmarksläsion: Kompression (Tumor, Abszess, Bandscheibe) oder Myelitis. Ein Notfall: Bildgebung der Wirbelsäule.'),
        ['trunk.pinprick'], ['multiple-sclerosis', 'bone-metastases']),
    ],
    pitfalls: l(['The lesion can be several segments above the sensory level found.'], ['Die Läsion kann einige Segmente über dem gefundenen sensiblen Niveau liegen.']),
  },

  'test.leg.pinprick': {
    aliases: l(['dermatomes', 'stocking sensory loss'], ['Dermatome', 'strumpfförmige Sensibilitätsstörung']),
    assesses: t('Pain sensation in the leg by dermatome: L2 front of the thigh, L3 inner knee, L4 inner ankle, L5 top of the foot and big toe, S1 outer foot and sole.',
      'Das Schmerzempfinden am Bein nach Dermatomen: L2 Oberschenkelvorderseite, L3 Knieinnenseite, L4 Innenknöchel, L5 Fußrücken und Großzehe, S1 Fußaußenrand und Fußsohle.'),
    how: l(['Show the pin on the sternum first.', 'With the eyes closed, test each dermatome and compare the sides; if loss is distal, move up to find where it changes.'],
      ['Die Nadel zuerst am Sternum zeigen.', 'Bei geschlossenen Augen jedes Dermatom prüfen und die Seiten vergleichen; bei distalem Ausfall nach proximal gehen, um die Grenze zu finden.']),
    normal: t('Sharp everywhere, the same on both sides.', 'Überall spitz, seitengleich.'),
    abnormal: [
      f(t('Loss on the top of the foot and big toe.', 'Ausfall am Fußrücken und an der Großzehe.'),
        t('L5 root; a patch confined to the top of the foot and the outer shin, sparing the sole, suggests the common peroneal nerve.',
          'Wurzel L5; ein auf Fußrücken und lateralen Unterschenkel begrenztes Areal ohne Fußsohle spricht für den N. peroneus communis.'),
        ['leg.pinprick'], ['l5-radiculopathy', 'common-peroneal-palsy']),
      f(t('Loss on the outer foot and sole.', 'Ausfall am Fußaußenrand und an der Fußsohle.'), t('S1 root.', 'Wurzel S1.'), ['leg.pinprick'], ['s1-radiculopathy']),
      f(t('Loss in both feet, fading upwards (stocking).', 'Ausfall an beiden Füßen, nach oben abklingend (strumpfförmig).'),
        t('Length-dependent polyneuropathy (diabetes, alcohol, vitamin B₁₂ deficiency).', 'Längenabhängige Polyneuropathie (Diabetes, Alkohol, Vitamin-B₁₂-Mangel).'), ['leg.pinprick'], ['b12-deficiency']),
    ],
  },

  'test.leg.vibration': {
    aliases: l(['proprioception', 'dorsal columns', 'joint position sense'], ['Pallästhesie', 'Lagesinn', 'Hinterstränge']),
    assesses: t('Vibration and joint position sense from the leg (dorsal columns); the longest fibres, so the first to fail in a neuropathy.',
      'Vibration und Lagesinn des Beins (Hinterstränge); die längsten Fasern und daher die ersten, die bei einer Neuropathie ausfallen.'),
    how: l([
      'Place a vibrating 128 Hz fork on the joint of the big toe; ask when it stops. If absent, move up: ankle, shin, knee, hip.',
      'Joint position: hold the big toe by its sides, move it up or down with the eyes closed, and ask which way.',
    ], [
      'Eine schwingende 128-Hz-Stimmgabel auf das Großzehengrundgelenk setzen; fragen, wann es aufhört. Fehlt die Wahrnehmung, nach proximal gehen: Knöchel, Schienbein, Knie, Hüfte.',
      'Lagesinn: die Großzehe seitlich fassen, bei geschlossenen Augen nach oben oder unten bewegen und nach der Richtung fragen.',
    ]),
    normal: t('Vibration felt at the big toe as long as the examiner feels it; position reported correctly.', 'Vibration an der Großzehe so lange gespürt wie vom Untersucher; Stellung richtig angegeben.'),
    abnormal: [
      f(t('Vibration and position sense lost at the toes.', 'Vibration und Lagesinn an den Zehen erloschen.'),
        t('Large-fibre neuropathy or dorsal column disease. With a positive Romberg test the patient has a sensory ataxia.', 'Neuropathie der dicken Fasern oder Hinterstrangerkrankung. Mit positivem Romberg-Versuch liegt eine sensible Ataxie vor.'),
        ['leg.vibration'], ['b12-deficiency', 'multiple-sclerosis']),
    ],
    pitfalls: l(['Vibration sense at the toes declines with age.'], ['Das Vibrationsempfinden an den Zehen nimmt im Alter ab.']),
  },

  'test.saddle': {
    aliases: l(['saddle anaesthesia', 'cauda equina'], ['Reithosenanästhesie', 'Cauda equina']),
    assesses: t('Sensation in the sacral dermatomes S3–S5 around the anus, supplied by the lowest roots of the cauda equina.',
      'Die Sensibilität der sakralen Dermatome S3–S5 um den Anus, versorgt von den untersten Wurzeln der Cauda equina.'),
    how: l(['With consent and a chaperone, test pinprick and light touch around the anus and on the buttocks, both sides.', 'Ask about bladder and bowel function; check anal tone on rectal examination.'],
      ['Mit Einverständnis und Begleitperson Spitz und Berührung um den Anus und am Gesäß beidseits prüfen.', 'Nach Blasen- und Darmfunktion fragen; den Sphinktertonus rektal prüfen.']),
    normal: t('Normal sensation.', 'Normale Sensibilität.'),
    abnormal: [
      f(t('Reduced perianal sensation, often with urinary retention and lax anal tone.', 'Verminderte perianale Sensibilität, oft mit Harnverhalt und schlaffem Sphinkter.'),
        t('Cauda equina syndrome: emergency MRI and decompression.', 'Kauda-Syndrom: notfallmäßige MRT und Dekompression.'), ['saddle.sensation'], ['cauda-equina-syndrome']),
    ],
    pitfalls: l(['Back pain with any new bladder symptom needs this test; it is the one most often omitted.'], ['Rückenschmerz mit neuer Blasenstörung verlangt diesen Test; er wird am häufigsten ausgelassen.']),
  },
};
