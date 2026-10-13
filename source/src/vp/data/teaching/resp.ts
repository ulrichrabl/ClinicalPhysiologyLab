import type { TeachingCard } from '../../model/types.ts';
import type { LocalizedText } from '../../model/i18n.ts';
import { f, l, t } from './helpers.ts';

/* Respiratory system. Percussion, breath sounds and vocal resonance are done at five sites a side; the technique
   and its meaning are the same everywhere, and each site adds which part of the lung lies beneath it. */

const SITES: Record<string, LocalizedText> = {
  'upper-zone': t('Upper zone, front, below the clavicle (and the apex above it): the upper lobes.',
    'Oberfeld, vorne unterhalb der Klavikula (und die Spitze darüber): die Oberlappen.'),
  'mid-zone': t('Mid zone, front: the right middle lobe and the lingula, which are heard almost only from the front.',
    'Mittelfeld, vorne: rechter Mittellappen und Lingula, die fast nur von vorne zu hören sind.'),
  axilla: t('Axilla, the side of the chest: where upper and lower lobes meet.', 'Axilla, seitliche Thoraxwand: wo Ober- und Unterlappen aneinandergrenzen.'),
  'upper-back': t('Upper back, between the scapulae: the upper lobes from behind.', 'Oberer Rücken, zwischen den Schulterblättern: die Oberlappen von hinten.'),
  base: t('Lung base, behind: the lower lobes, where effusions and the crackles of oedema gather first.',
    'Lungenbasis, hinten: die Unterlappen, wo sich Ergüsse und die Rasselgeräusche des Ödems zuerst sammeln.'),
};
const SITE_PITFALL = (key: string) => key === 'mid-zone'
  ? l(['A right middle lobe pneumonia can be missed if the chest is examined only from behind.'], ['Eine Mittellappenpneumonie wird übersehen, wenn man den Thorax nur von hinten untersucht.'])
  : key === 'base'
    ? l(['Normal dullness over the liver begins at about the 6th rib in front on the right; do not mistake it for an effusion.'],
      ['Die normale Leberdämpfung beginnt rechts vorne etwa an der 6. Rippe; nicht mit einem Erguss verwechseln.'])
    : undefined;

const percussion = (key: string): TeachingCard => ({
  aliases: l(['percussion note'], ['Klopfschall']),
  assesses: t(`Whether the tissue under the chest wall contains air, fluid or solid lung. ${SITES[key].en}`,
    `Ob das Gewebe unter der Brustwand Luft, Flüssigkeit oder festes Lungengewebe enthält. ${SITES[key].de}`),
  how: l([
    'Press the middle finger of one hand flat on the chest wall, in an intercostal space.',
    'Strike its middle phalanx with the tip of the other middle finger, a quick blow from the wrist.',
    'Compare each site with the same site on the other side.',
  ], [
    'Den Mittelfinger einer Hand flach im Interkostalraum auf die Brustwand legen.',
    'Mit der Spitze des anderen Mittelfingers kurz aus dem Handgelenk auf dessen Mittelglied klopfen.',
    'Jede Stelle mit derselben Stelle der Gegenseite vergleichen.',
  ]),
  normal: t('Resonant, the same on both sides.', 'Sonor, seitengleich.'),
  abnormal: [
    f(t('Stony dull.', 'Absolute Dämpfung (Schenkelschall).'), t('Pleural fluid.', 'Pleuraflüssigkeit.'), ['chest.percussion'], ['pleural-effusion', 'acute-heart-failure']),
    f(t('Dull.', 'Gedämpft.'), t('Airless lung: consolidation or collapse.', 'Luftleere Lunge: Infiltrat oder Atelektase.'), ['chest.percussion'], ['community-acquired-pneumonia', 'lung-cancer']),
    f(t('Hyper-resonant.', 'Hypersonor.'), t('More air than normal: pneumothorax, or emphysema (both sides).', 'Mehr Luft als normal: Pneumothorax oder Emphysem (beidseits).'),
      ['chest.percussion'], ['pneumothorax', 'copd-exacerbation']),
  ],
  pitfalls: SITE_PITFALL(key),
});

const breathSounds = (key: string): TeachingCard => ({
  aliases: l(['auscultation of the lungs', 'breath sounds'], ['Lungenauskultation']),
  assesses: t(`How air moves through the airways and how sound travels through the lung to the chest wall. ${SITES[key].en}`,
    `Wie Luft durch die Atemwege strömt und wie der Schall durch die Lunge zur Brustwand gelangt. ${SITES[key].de}`),
  how: l([
    'Ask the patient to breathe in and out through the mouth, a little deeper than usual.',
    'Listen with the diaphragm through at least one full breath at each site.',
    'Compare with the same site on the other side; describe the breath sounds, then any added sounds.',
  ], [
    'Den Patienten etwas tiefer als normal durch den Mund ein- und ausatmen lassen.',
    'An jeder Stelle mit der Membran mindestens einen ganzen Atemzug hören.',
    'Mit derselben Stelle der Gegenseite vergleichen; erst das Atemgeräusch, dann Nebengeräusche beschreiben.',
  ]),
  normal: t('Vesicular breath sounds: soft and rustling, inspiration longer than expiration, with no gap between them; no added sounds.',
    'Vesikuläres Atemgeräusch: leise und rauschend, Einatmung länger als Ausatmung, ohne Pause dazwischen; keine Nebengeräusche.'),
  abnormal: [
    f(t('Bronchial breathing: harsh, expiration as long and loud as inspiration, with a gap between.', 'Bronchialatmen: scharf, Ausatmung so lang und laut wie Einatmung, mit Pause dazwischen.'),
      t('Consolidated lung conducts sound from the large airways: pneumonia.', 'Infiltrierte Lunge leitet den Schall der großen Atemwege: Pneumonie.'), ['lung.sounds'], ['community-acquired-pneumonia']),
    f(t('Reduced or absent breath sounds.', 'Abgeschwächtes oder fehlendes Atemgeräusch.'),
      t('Air or fluid between lung and chest wall (pneumothorax, effusion), or a collapsed lobe behind a blocked bronchus.',
        'Luft oder Flüssigkeit zwischen Lunge und Brustwand (Pneumothorax, Erguss) oder ein kollabierter Lappen hinter einem verschlossenen Bronchus.'),
      ['lung.sounds'], ['pneumothorax', 'pleural-effusion', 'lung-cancer']),
    f(t('Wheeze: musical, mainly expiratory, often from many airways at once.', 'Giemen: musikalisch, vor allem exspiratorisch, oft aus vielen Atemwegen zugleich.'),
      t('Narrowed airways: asthma, COPD; also cardiac asthma in pulmonary oedema.', 'Verengte Atemwege: Asthma, COPD; auch Asthma cardiale beim Lungenödem.'),
      ['lung.sounds'], ['asthma-exacerbation', 'copd-exacerbation', 'acute-heart-failure']),
    f(t('Fine end-inspiratory crackles at the bases.', 'Feine endinspiratorische Rasselgeräusche basal.'),
      t('Small airways snapping open: pulmonary oedema, or fibrosis (dry, like Velcro).', 'Sich öffnende kleine Atemwege: Lungenödem oder Fibrose (trocken, wie Klettverschluss, Sklerosiphonie).'),
      ['lung.sounds'], ['acute-heart-failure', 'pulmonary-fibrosis']),
    f(t('Coarse crackles that may change with coughing.', 'Grobe Rasselgeräusche, die sich beim Husten ändern können.'),
      t('Secretions in the airways: pneumonia, bronchiectasis, COPD.', 'Sekret in den Atemwegen: Pneumonie, Bronchiektasen, COPD.'), ['lung.sounds'], ['community-acquired-pneumonia', 'copd-exacerbation']),
    f(t('A creaking pleural rub.', 'Ein knarrendes Pleurareiben.'), t('Inflamed pleura: pneumonia, pulmonary infarction.', 'Entzündete Pleura: Pneumonie, Lungeninfarkt.'),
      ['lung.sounds'], ['community-acquired-pneumonia', 'pulmonary-embolism']),
  ],
  pitfalls: SITE_PITFALL(key),
});

const resonance = (key: string): TeachingCard => ({
  aliases: l(['vocal resonance', 'tactile fremitus', 'whispering pectoriloquy'], ['Bronchophonie', 'Stimmfremitus']),
  assesses: t(`How well the lung conducts the voice. Solid lung conducts better than aerated lung; fluid or air in the pleura conducts worse. ${SITES[key].en}`,
    `Wie gut die Lunge die Stimme leitet. Festes Lungengewebe leitet besser als belüftetes; Flüssigkeit oder Luft im Pleuraraum leitet schlechter. ${SITES[key].de}`),
  how: l([
    'Ask the patient to say “ninety-nine” each time you move the stethoscope.',
    'Listen with the diaphragm and compare both sides; or lay the ulnar edge of the hand on the chest to feel the vibration (tactile fremitus).',
  ], [
    'Den Patienten bei jeder Stethoskopstellung „sechsundsechzig“ sagen lassen (tiefe Stimme; für den Stimmfremitus auch „neunundneunzig“).',
    'Mit der Membran hören und beide Seiten vergleichen; oder die ulnare Handkante auflegen und die Vibration fühlen (Stimmfremitus).',
  ]),
  normal: t('A muffled, indistinct sound, the same on both sides.', 'Ein dumpfes, undeutliches Geräusch, seitengleich.'),
  abnormal: [
    f(t('Increased: the words come through clearly, even when whispered.', 'Verstärkt: die Worte kommen deutlich an, sogar geflüstert.'),
      t('Consolidation. With a dull percussion note this distinguishes pneumonia from effusion.', 'Infiltrat. Zusammen mit gedämpftem Klopfschall unterscheidet das die Pneumonie vom Erguss.'),
      ['chest.resonance'], ['community-acquired-pneumonia']),
    f(t('Reduced or absent.', 'Abgeschwächt oder aufgehoben.'),
      t('Pleural effusion or pneumothorax (dull or hyper-resonant), or collapse behind a blocked bronchus.', 'Pleuraerguss oder Pneumothorax (gedämpft bzw. hypersonor) oder Atelektase hinter verschlossenem Bronchus.'),
      ['chest.resonance'], ['pleural-effusion', 'pneumothorax']),
  ],
  pitfalls: SITE_PITFALL(key),
});

const LUNG: Record<string, TeachingCard> = {};
for (const key of Object.keys(SITES)) {
  LUNG[`percuss.lung-${key}`] = percussion(key);
  LUNG[key === 'base' ? 'auscultate.lung-base' : `auscultate.lung-${key}`] = breathSounds(key);
  LUNG[`resonance.lung-${key}`] = resonance(key);
}

export const RESP: Record<string, TeachingCard> = {
  'inspect.breathing': {
    aliases: l(['work of breathing', 'accessory muscles', 'respiratory distress'], ['Atemarbeit', 'Atemhilfsmuskulatur', 'Dyspnoe']),
    assesses: t('How hard the patient has to work to breathe, and the pattern, which points to the cause.',
      'Wie schwer der Patient atmen muss, und das Atemmuster, das auf die Ursache hinweist.'),
    how: l([
      'Watch the patient breathe, exposed to the waist, from the end of the bed and from the side.',
      'Count the rate; look at depth, rhythm, the ratio of inspiration to expiration, and symmetry.',
      'Look for accessory muscles (sternomastoid, scalenes), intercostal recession, tracheal tug, pursed lips, and whether the patient can finish a sentence.',
    ], [
      'Den Patienten mit freiem Oberkörper vom Bettende und von der Seite atmen sehen.',
      'Die Frequenz zählen; Tiefe, Rhythmus, Verhältnis von Ein- zu Ausatmung und Symmetrie beachten.',
      'Auf Atemhilfsmuskulatur (M. sternocleidomastoideus, Mm. scaleni), interkostale Einziehungen, Trachealzug, Lippenbremse achten, und ob der Patient einen Satz zu Ende sprechen kann.',
    ]),
    normal: t('Quiet, regular breathing at 12–20 /min, using the diaphragm; expiration passive and a little longer than inspiration.',
      'Ruhige, regelmäßige Atmung mit 12–20 /min über das Zwerchfell; die Ausatmung passiv und etwas länger als die Einatmung.'),
    abnormal: [
      f(t('Accessory muscles, recession, unable to speak in sentences.', 'Atemhilfsmuskulatur, Einziehungen, Sprechdyspnoe.'),
        t('Severe respiratory distress; consider how long the patient can keep this up.', 'Schwere respiratorische Not; bedenken, wie lange der Patient das durchhält.'),
        ['breathing.pattern'], ['asthma-exacerbation', 'copd-exacerbation', 'acute-heart-failure', 'community-acquired-pneumonia']),
      f(t('Prolonged expiration through pursed lips.', 'Verlängerte Ausatmung mit Lippenbremse.'),
        t('Airflow obstruction: the pursed lips keep the small airways open (COPD).', 'Atemwegsobstruktion: die Lippenbremse hält die kleinen Atemwege offen (COPD).'), ['breathing.pattern'], ['copd-exacerbation']),
      f(t('Deep, sighing breaths at a normal or raised rate (Kussmaul).', 'Tiefe, seufzende Atemzüge mit normaler oder erhöhter Frequenz (Kussmaul-Atmung).'),
        t('Metabolic acidosis: the patient blows off CO₂ to compensate.', 'Metabolische Azidose: der Patient atmet CO₂ ab, um zu kompensieren.'),
        ['breathing.pattern'], ['diabetic-ketoacidosis', 'lactic-acidosis', 'alcoholic-ketoacidosis']),
      f(t('Waxing and waning breathing with pauses (Cheyne–Stokes).', 'An- und abschwellende Atmung mit Pausen (Cheyne-Stokes).'),
        t('Unstable control of breathing: heart failure, stroke, opioids.', 'Instabile Atemregulation: Herzinsuffizienz, Schlaganfall, Opioide.'), ['breathing.pattern'], ['acute-heart-failure']),
    ],
    pitfalls: l(['A tiring patient breathes more slowly and less visibly as they deteriorate.'], ['Ein erschöpfender Patient atmet langsamer und unauffälliger, während er sich verschlechtert.']),
  },

  'palpate.trachea': {
    aliases: l(['tracheal deviation', 'mediastinal shift'], ['Trachealverlagerung', 'Mediastinalverschiebung']),
    assesses: t('The position of the upper mediastinum: pushed away by pressure in one hemithorax, or pulled towards loss of volume.',
      'Die Lage des oberen Mediastinums: weggedrückt durch Druck in einer Thoraxhälfte oder hingezogen durch Volumenverlust.'),
    how: l([
      'Warn the patient: it is uncomfortable.',
      'With the neck slightly flexed, put the index finger in the suprasternal notch and feel the gap on either side between the trachea and the sternomastoid tendons.',
    ], [
      'Den Patienten vorwarnen: es ist unangenehm.',
      'Bei leicht gebeugtem Hals den Zeigefinger in die Fossa jugularis legen und den Abstand zwischen Trachea und den Sehnen des M. sternocleidomastoideus auf beiden Seiten tasten.',
    ]),
    normal: t('Central (often very slightly to the right).', 'Mittelständig (oft ganz leicht nach rechts).'),
    abnormal: [
      f(t('Deviated away from the abnormal side.', 'Zur gesunden Seite verlagert.'),
        t('Pushed: tension pneumothorax, a large pleural effusion.', 'Verdrängt: Spannungspneumothorax, großer Pleuraerguss.'), ['trachea.position'], ['pneumothorax', 'pleural-effusion']),
      f(t('Deviated towards the abnormal side.', 'Zur kranken Seite verlagert.'),
        t('Pulled: lobar collapse (for example a tumour blocking a bronchus), upper lobe fibrosis, pneumonectomy.', 'Gezogen: Lappenatelektase (z. B. Tumor im Bronchus), Oberlappenfibrose, Pneumonektomie.'),
        ['trachea.position'], ['lung-cancer', 'pulmonary-fibrosis']),
    ],
    pitfalls: l(['Lower-lobe disease often leaves the trachea central; check the apex beat for lower mediastinal shift.'],
      ['Unterlappenprozesse lassen die Trachea oft mittelständig; für eine untere Mediastinalverschiebung den Herzspitzenstoß prüfen.']),
  },

  'palpate.chest-expansion': {
    aliases: l(['expansion'], ['Atemexkursion']),
    assesses: t('How much, and how symmetrically, each side of the chest moves with a deep breath.', 'Wie stark und wie seitengleich sich jede Thoraxhälfte bei tiefer Einatmung bewegt.'),
    how: l([
      'Place the hands on the lower chest with the fingers around the sides and the thumbs meeting in the midline, lifted slightly off the skin.',
      'Ask for a deep breath in and watch the thumbs move apart; do it at the front and at the back.',
    ], [
      'Die Hände auf den unteren Thorax legen, die Finger seitlich, die Daumen in der Mittellinie, leicht von der Haut abgehoben.',
      'Tief einatmen lassen und beobachten, wie die Daumen auseinanderweichen; vorne und hinten.',
    ]),
    normal: t('Symmetrical; the thumbs move apart by several centimetres.', 'Seitengleich; die Daumen weichen mehrere Zentimeter auseinander.'),
    abnormal: [
      f(t('Reduced on one side.', 'Einseitig vermindert.'),
        t('Disease on that side: consolidation, effusion, pneumothorax, collapse.', 'Erkrankung auf dieser Seite: Infiltrat, Erguss, Pneumothorax, Atelektase.'),
        ['chest.expansion'], ['community-acquired-pneumonia', 'pleural-effusion', 'pneumothorax']),
      f(t('Reduced on both sides.', 'Beidseits vermindert.'),
        t('Hyperinflation (COPD), fibrosis, or a stiff chest wall.', 'Überblähung (COPD), Fibrose oder steife Thoraxwand.'), ['chest.expansion'], ['copd-exacerbation', 'pulmonary-fibrosis']),
    ],
  },

  ...LUNG,
};
