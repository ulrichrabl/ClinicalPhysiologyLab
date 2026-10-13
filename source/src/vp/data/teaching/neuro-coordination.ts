import type { TeachingCard } from '../../model/types.ts';
import { f, l, t } from './helpers.ts';

/* Nervous system: coordination, stance and gait. */
export const NEURO_COORDINATION: Record<string, TeachingCard> = {
  'test.finger-nose': {
    aliases: l(['finger-to-nose test', 'past-pointing', 'intention tremor', 'dysmetria'], ['Finger-Nase-Versuch', 'Intentionstremor', 'Dysmetrie']),
    assesses: t('Coordination of the arm: the cerebellar hemisphere on the same side times and scales the movement; position sense tells it where the arm is.',
      'Die Koordination des Arms: die Kleinhirnhemisphäre derselben Seite steuert Zeitpunkt und Ausmaß der Bewegung; der Lagesinn meldet ihr, wo der Arm ist.'),
    how: l([
      'Hold your finger at the limit of the patient’s reach.',
      'Ask them to touch your finger and then their own nose, back and forth, as accurately as they can; move your finger between attempts.',
      'Then with the eyes closed, nose and outstretched arm only. Compare both sides.',
    ], [
      'Den eigenen Finger an die Grenze der Reichweite des Patienten halten.',
      'Der Patient berührt abwechselnd diesen Finger und die eigene Nase, so genau wie möglich; den Finger zwischendurch verschieben.',
      'Dann mit geschlossenen Augen, nur Nase und ausgestreckter Arm. Beide Seiten vergleichen.',
    ]),
    normal: t('Smooth, accurate movements without tremor, eyes open or closed.', 'Flüssige, zielgenaue Bewegungen ohne Tremor, mit offenen wie geschlossenen Augen.'),
    abnormal: [
      f(t('A tremor that grows near the target, and overshooting (past-pointing), with eyes open as much as closed.', 'Ein zum Ziel hin zunehmender Tremor und Vorbeizeigen, mit offenen Augen ebenso wie mit geschlossenen.'),
        t('Cerebellar ataxia on the same side.', 'Zerebelläre Ataxie derselben Seite.'), ['arm.finger-nose'], ['cerebellar-stroke', 'multiple-sclerosis', 'lateral-medullary-syndrome']),
      f(t('Accurate with eyes open, lost with eyes closed.', 'Mit offenen Augen genau, mit geschlossenen ungenau.'),
        t('Sensory ataxia: position sense is lost.', 'Sensible Ataxie: der Lagesinn fehlt.'), ['arm.finger-nose', 'arm.vibration'], ['b12-deficiency']),
    ],
    pitfalls: l(['Weakness makes any coordination test clumsy: test power first.'], ['Eine Parese macht jeden Koordinationstest ungeschickt: zuerst die Kraft prüfen.']),
  },

  'test.rapid-alternating': {
    aliases: l(['dysdiadochokinesis', 'rapid alternating movements'], ['Dysdiadochokinese', 'Diadochokinese']),
    assesses: t('The cerebellum’s timing of fast, alternating movements.', 'Die zeitliche Steuerung schneller, wechselnder Bewegungen durch das Kleinhirn.'),
    how: l(['Ask the patient to pat the palm of one hand with the palm and then the back of the other hand, as fast and regularly as possible.', 'Compare both sides.'],
      ['Den Patienten mit der einen Hand abwechselnd mit Handfläche und Handrücken auf die Handfläche der anderen klopfen lassen, so schnell und regelmäßig wie möglich.', 'Beide Seiten vergleichen.']),
    normal: t('Fast, rhythmic and even.', 'Schnell, rhythmisch und gleichmäßig.'),
    abnormal: [
      f(t('Slow, irregular and clumsy, the rhythm breaking down (dysdiadochokinesis).', 'Langsam, unregelmäßig und ungeschickt, der Rhythmus zerfällt (Dysdiadochokinese).'),
        t('Cerebellar lesion on the same side.', 'Kleinhirnläsion derselben Seite.'), ['arm.rapid-alternating'], ['cerebellar-stroke', 'multiple-sclerosis']),
      f(t('Slow but regular.', 'Langsam, aber regelmäßig.'),
        t('Upper motor neurone weakness, or the slowness of Parkinsonism.', 'Zentrale Parese oder die Verlangsamung beim Parkinson-Syndrom.'), ['arm.rapid-alternating'], ['ischaemic-stroke-left-mca']),
    ],
  },

  'test.heel-shin': {
    aliases: l(['heel–knee–shin test', 'heel-to-shin test'], ['Knie-Hacke-Versuch', 'Hacke-Knie-Versuch', 'Fersen-Knie-Versuch']),
    assesses: {
      en: 'Coordination of the leg. The cerebellar hemisphere on the same side times and scales the movement; position sense from the leg (the dorsal columns) tells it where the heel is.',
      de: 'Die Koordination des Beins. Die Kleinhirnhemisphäre derselben Seite steuert Zeitpunkt und Ausmaß der Bewegung; der Lagesinn des Beins (Hinterstränge) meldet ihr, wo die Ferse ist.',
    },
    how: {
      en: [
        'The patient lies flat or half sitting.',
        'Ask them to put one heel on the opposite knee, slide it straight down the shin to the ankle, lift it and put it back on the knee; several times.',
        'Repeat with the eyes closed.',
        'Do the other leg and compare the two sides.',
      ],
      de: [
        'Der Patient liegt flach oder halb sitzend.',
        'Er setzt eine Ferse auf das andere Knie, fährt damit gerade am Schienbein entlang bis zum Knöchel, hebt sie ab und setzt sie wieder auf das Knie; mehrmals.',
        'Dasselbe mit geschlossenen Augen.',
        'Dann das andere Bein, und beide Seiten vergleichen.',
      ],
    },
    normal: {
      en: 'The heel lands on the knee and runs smoothly and straight down the shin, the same on both sides, with the eyes open or closed.',
      de: 'Die Ferse trifft das Knie und gleitet flüssig und gerade am Schienbein hinab, auf beiden Seiten gleich, mit offenen wie mit geschlossenen Augen.',
    },
    abnormal: [
      {
        sign: {
          en: 'The heel overshoots or misses the knee (dysmetria) and wobbles off the shin; the tremor grows as it nears the target (intention tremor), with the eyes open as much as closed.',
          de: 'Die Ferse schießt über das Knie hinaus oder verfehlt es (Dysmetrie) und rutscht vom Schienbein ab; das Zittern nimmt zum Ziel hin zu (Intentionstremor), mit offenen Augen ebenso wie mit geschlossenen.',
        },
        means: {
          en: 'Cerebellar ataxia: a lesion of the cerebellar hemisphere or its pathways on the same side as the clumsy leg.',
          de: 'Zerebelläre Ataxie: eine Läsion der Kleinhirnhemisphäre oder ihrer Bahnen auf der Seite des ungeschickten Beins.',
        },
        properties: ['leg.heel-shin'],
        conditions: ['cerebellar-stroke', 'lateral-medullary-syndrome', 'multiple-sclerosis'],
      },
      {
        sign: {
          en: 'Accurate while the patient watches, but the heel wanders once the eyes are closed.',
          de: 'Treffsicher, solange der Patient hinsieht, aber die Ferse irrt umher, sobald die Augen geschlossen sind.',
        },
        means: {
          en: 'Sensory ataxia: position sense from the leg is lost (dorsal columns, large-fibre neuropathy) and vision stands in for it. Romberg’s test is positive too.',
          de: 'Sensible Ataxie: der Lagesinn des Beins fehlt (Hinterstränge, Neuropathie der dicken Fasern), und das Auge ersetzt ihn. Auch der Romberg-Versuch ist positiv.',
        },
        properties: ['leg.heel-shin', 'leg.vibration'],
        conditions: ['b12-deficiency'],
      },
      {
        sign: {
          en: 'The leg cannot be lifted onto the knee, or only slowly and with effort.',
          de: 'Das Bein lässt sich nicht oder nur langsam und mühsam auf das Knie heben.',
        },
        means: {
          en: 'Weakness, not ataxia: the test cannot judge coordination in a leg with power of 3/5 or less.',
          de: 'Eine Parese, keine Ataxie: bei einer Kraft von 3/5 oder weniger lässt der Versuch kein Urteil über die Koordination zu.',
        },
        properties: ['leg.power'],
        conditions: ['ischaemic-stroke-left-mca'],
      },
    ],
    pitfalls: {
      en: [
        'Test power first; weakness imitates ataxia.',
        'A lesion of the cerebellar midline (vermis) can leave the limb tests normal and show only in stance and gait: watch the patient stand and walk.',
        'Pain or stiffness in the hip or knee limits the movement without any neurological cause.',
      ],
      de: [
        'Zuerst die Kraft prüfen; eine Parese ahmt eine Ataxie nach.',
        'Eine Läsion des Kleinhirnwurms (Vermis) kann die Extremitätenversuche normal lassen und sich nur in Stand und Gang zeigen: den Patienten stehen und gehen lassen.',
        'Schmerzen oder Steifheit in Hüfte oder Knie schränken die Bewegung ohne neurologische Ursache ein.',
      ],
    },
  },
  'test.romberg': {
    aliases: l(['Romberg sign', 'Romberg’s test'], ['Romberg-Versuch', 'Romberg-Zeichen']),
    assesses: t('Whether balance depends on vision. Standing uses three inputs: vision, position sense from the legs and the vestibular organs; with the eyes closed only two remain.',
      'Ob das Gleichgewicht vom Sehen abhängt. Stehen nutzt drei Zuflüsse: Sehen, Lagesinn der Beine und Gleichgewichtsorgan; mit geschlossenen Augen bleiben zwei.'),
    how: l([
      'Ask the patient to stand with feet together and arms by the sides; stand close, ready to catch.',
      'Watch for 30 seconds with the eyes open, then 30 seconds with the eyes closed.',
    ], [
      'Den Patienten mit geschlossenen Füßen und hängenden Armen stehen lassen; nahe stehen, bereit aufzufangen.',
      '30 Sekunden mit offenen Augen beobachten, dann 30 Sekunden mit geschlossenen.',
    ]),
    normal: t('Steady with the eyes open and closed, with only slight sway.', 'Sicherer Stand mit offenen und geschlossenen Augen, nur leichtes Schwanken.'),
    abnormal: [
      f(t('Steady with the eyes open, but sways and falls when they close (Romberg positive).', 'Sicher mit offenen Augen, schwankt und fällt bei geschlossenen (Romberg positiv).'),
        t('Loss of position sense: dorsal column disease or a large-fibre neuropathy (sensory ataxia).', 'Verlust des Lagesinns: Hinterstrangerkrankung oder Neuropathie der dicken Fasern (sensible Ataxie).'),
        ['posture.romberg'], ['b12-deficiency']),
      f(t('Falls consistently towards one side when the eyes close.', 'Fällt bei geschlossenen Augen regelmäßig zu einer Seite.'),
        t('Acute vestibular loss on that side.', 'Akuter vestibulärer Ausfall dieser Seite.'), ['posture.romberg'], ['vestibular-neuritis', 'labyrinthitis']),
      f(t('Unsteady even with the eyes open, feet together impossible.', 'Schon mit offenen Augen unsicher, Stehen mit geschlossenen Füßen unmöglich.'),
        t('Cerebellar ataxia: vision does not help, so this is not a positive Romberg.', 'Zerebelläre Ataxie: das Sehen hilft nicht, daher kein positiver Romberg.'), ['posture.romberg'], ['cerebellar-stroke']),
    ],
    pitfalls: l(['Romberg’s sign is about the difference between eyes open and closed; a patient who cannot stand with eyes open has not got one.'],
      ['Das Romberg-Zeichen betrifft den Unterschied zwischen offenen und geschlossenen Augen; wer schon mit offenen Augen nicht stehen kann, hat keines.']),
  },

  'test.gait': {
    aliases: l(['tandem gait', 'heel-to-toe walking', 'ataxic gait', 'foot drop gait'], ['Strichgang', 'Seiltänzergang', 'Steppergang', 'Gangataxie']),
    assesses: t('Everything that walking needs at once: power, tone, coordination, sensation, balance; each failure has its typical gait.',
      'Alles, was Gehen gleichzeitig braucht: Kraft, Tonus, Koordination, Sensibilität, Gleichgewicht; jedes Versagen hat seinen typischen Gang.'),
    how: l([
      'Ask the patient to walk a few metres, turn and come back; watch the start, the stride, the base, the arm swing and the turn.',
      'Then heel-to-toe along a line (tandem gait), staying close.',
    ], [
      'Den Patienten einige Meter gehen, umdrehen und zurückkommen lassen; Start, Schrittlänge, Spurbreite, Armschwung und Wendung beobachten.',
      'Dann Fuß vor Fuß auf einer Linie (Strichgang), dabei nahe bleiben.',
    ]),
    normal: t('Smooth, symmetrical steps on a narrow base, with arm swing; can walk heel to toe.', 'Flüssige, symmetrische Schritte auf schmaler Spur mit Armschwung; Strichgang möglich.'),
    abnormal: [
      f(t('Broad-based, staggering; cannot walk heel to toe.', 'Breitbasig, taumelnd; Strichgang unmöglich.'),
        t('Cerebellar ataxia. In acute vertigo, being unable to walk without help points to a central cause.', 'Zerebelläre Ataxie. Beim akuten Schwindel spricht die Unfähigkeit, ohne Hilfe zu gehen, für eine zentrale Ursache.'),
        ['gait.pattern'], ['cerebellar-stroke', 'lateral-medullary-syndrome']),
      f(t('Veers to one side but walks unaided.', 'Weicht zu einer Seite ab, geht aber ohne Hilfe.'), t('Acute peripheral vestibular loss on that side.', 'Akuter peripherer vestibulärer Ausfall dieser Seite.'),
        ['gait.pattern'], ['vestibular-neuritis']),
      f(t('One leg stiff and swung outwards in a semicircle, the arm flexed.', 'Ein Bein steif und im Halbkreis nach außen geschwungen, der Arm gebeugt.'),
        t('Hemiplegic gait: upper motor neurone lesion.', 'Hemiparetisches Gangbild (Wernicke-Mann): Läsion des ersten Motoneurons.'), ['gait.pattern'], ['ischaemic-stroke-left-mca']),
      f(t('High stepping, the foot slapping down.', 'Hohes Anheben des Beins, der Fuß klatscht auf.'),
        t('Foot drop: L5 root or common peroneal nerve.', 'Fußheberschwäche: Wurzel L5 oder N. peroneus communis.'), ['gait.pattern'], ['l5-radiculopathy', 'common-peroneal-palsy']),
      f(t('Stamping, watching the feet, worse in the dark.', 'Stampfend, den Blick auf die Füße, im Dunkeln schlechter.'),
        t('Sensory ataxia: lost position sense.', 'Sensible Ataxie: Lagesinn verloren.'), ['gait.pattern'], ['b12-deficiency']),
    ],
  },
};
