import type { TeachingCard } from '../model/types.ts';

/* ---------------------------------------------------------------------------
   Teaching cards: what each examination is, how it is done and what it shows.

   Keyed by manoeuvre id and merged into the catalog. Every card is written in
   every language the app offers (the validator reports what is missing).
   Abnormal findings name the model properties that report them and the
   diagnoses they occur in; the test suite checks those ids exist. Review
   modes (spaced repetition, matching tests to conditions) are generated from
   these cards, so nothing here is specific to one mode.

   Cards are being written system by system; the test suite reports how many
   manoeuvres have one.
--------------------------------------------------------------------------- */

export const TEACHING: Record<string, TeachingCard> = {
  'test.heel-shin': {
    aliases: { en: ['heel–knee–shin test', 'heel-to-shin test'], de: ['Knie-Hacke-Versuch', 'Hacke-Knie-Versuch', 'Fersen-Knie-Versuch'] },
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
};
