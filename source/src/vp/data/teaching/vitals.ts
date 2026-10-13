import type { TeachingCard } from '../../model/types.ts';
import { f, l, t } from './helpers.ts';

/* Vital signs. */
export const VITALS: Record<string, TeachingCard> = {
  'measure.hr': {
    aliases: l(['pulse rate'], ['Pulsfrequenz']),
    assesses: t('How fast the heart beats, and whether it beats regularly.',
      'Wie schnell das Herz schlägt und ob es regelmäßig schlägt.'),
    how: l([
      'Feel the radial pulse with two fingers, or read it from the monitor.',
      'Count for 30 seconds and double it; count a full minute if the rhythm is irregular.',
      'Note whether the rhythm is regular, regularly irregular or irregularly irregular.',
    ], [
      'Den Radialispuls mit zwei Fingern tasten oder am Monitor ablesen.',
      '30 Sekunden zählen und verdoppeln; bei unregelmäßigem Rhythmus eine volle Minute zählen.',
      'Festhalten, ob der Rhythmus regelmäßig, regelmäßig unregelmäßig oder absolut unregelmäßig ist.',
    ]),
    normal: t('60–100 /min at rest in an adult, regular, with a slight speeding on inspiration (sinus arrhythmia).',
      '60–100 /min in Ruhe beim Erwachsenen, regelmäßig, bei Einatmung etwas schneller (respiratorische Sinusarrhythmie).'),
    abnormal: [
      f(t('Tachycardia: above 100 /min.', 'Tachykardie: über 100 /min.'),
        t('A compensation or a driver: fever, pain, hypovolaemia, sepsis, hypoxaemia, pulmonary embolism, thyrotoxicosis, or a tachyarrhythmia.',
          'Eine Kompensation oder ein Antrieb: Fieber, Schmerz, Hypovolämie, Sepsis, Hypoxämie, Lungenembolie, Thyreotoxikose oder eine Tachyarrhythmie.'),
        ['vitals.hr'], ['sepsis', 'upper-gi-bleed', 'pulmonary-embolism', 'thyrotoxicosis', 'diabetic-ketoacidosis']),
      f(t('Bradycardia: below 60 /min.', 'Bradykardie: unter 60 /min.'),
        t('Normal in athletes and in sleep; otherwise beta-blockers, hypothyroidism, conduction block, or raised intracranial pressure (with hypertension: Cushing’s reflex).',
          'Normal bei Sportlern und im Schlaf; sonst Betablocker, Hypothyreose, AV-Block oder erhöhter Hirndruck (mit Hypertonie: Cushing-Reflex).'),
        ['vitals.hr'], ['complete-heart-block', 'hypothyroidism']),
      f(t('Irregularly irregular.', 'Absolut unregelmäßig (Arrhythmia absoluta).'),
        t('Atrial fibrillation, until an ECG shows otherwise; frequent ectopic beats can imitate it.',
          'Vorhofflimmern, bis ein EKG etwas anderes zeigt; häufige Extrasystolen können es nachahmen.'),
        ['pulse.radial'], ['atrial-fibrillation']),
    ],
    pitfalls: l([
      'In atrial fibrillation some beats are too weak to reach the wrist: count at the apex as well (pulse deficit).',
      'Beta-blockers blunt the tachycardia of bleeding or sepsis; a normal rate does not rule out shock.',
    ], [
      'Bei Vorhofflimmern erreichen manche Schläge das Handgelenk nicht: auch an der Herzspitze zählen (Pulsdefizit).',
      'Betablocker unterdrücken die Tachykardie bei Blutung oder Sepsis; eine normale Frequenz schließt einen Schock nicht aus.',
    ]),
  },

  'measure.bp': {
    aliases: l(['sphygmomanometry', 'Riva-Rocci'], ['RR-Messung', 'Riva-Rocci']),
    assesses: t('Arterial pressure: the systolic peak and the diastolic trough; their difference, the pulse pressure, follows stroke volume and arterial stiffness.',
      'Den arteriellen Druck: systolische Spitze und diastolisches Minimum; ihre Differenz, die Blutdruckamplitude, folgt dem Schlagvolumen und der Gefäßsteifigkeit.'),
    how: l([
      'The patient rests for a few minutes, the arm supported at heart level.',
      'Choose a cuff whose bladder covers at least 80 % of the arm’s circumference.',
      'Inflate until the radial pulse disappears, then 20–30 mmHg more.',
      'Deflate at 2–3 mmHg per beat, listening over the brachial artery: the first tapping sound (Korotkoff I) is systolic, the disappearance of sounds (Korotkoff V) is diastolic.',
      'Measure both arms at the first visit.',
    ], [
      'Der Patient ruht einige Minuten, der Arm liegt gestützt auf Herzhöhe.',
      'Eine Manschette wählen, deren Gummiblase mindestens 80 % des Armumfangs umfasst.',
      'Aufpumpen, bis der Radialispuls verschwindet, dann 20–30 mmHg weiter.',
      'Mit 2–3 mmHg pro Herzschlag ablassen und über der A. brachialis hören: das erste Klopfgeräusch (Korotkoff I) ist der systolische, das Verschwinden der Geräusche (Korotkoff V) der diastolische Wert.',
      'Bei der ersten Untersuchung an beiden Armen messen.',
    ]),
    normal: t('Below 140/90 mmHg in the clinic (below 120/80 is optimal); the two arms within 10 mmHg of each other.',
      'Unter 140/90 mmHg in der Praxis (unter 120/80 optimal); beide Arme innerhalb von 10 mmHg.'),
    abnormal: [
      f(t('Hypotension: systolic below 90 mmHg or mean pressure below 65 mmHg.', 'Hypotonie: systolisch unter 90 mmHg oder Mitteldruck unter 65 mmHg.'),
        t('Shock: too little volume (bleeding, losses), too little pump, or too little resistance (sepsis, adrenal crisis).',
          'Schock: zu wenig Volumen (Blutung, Verluste), zu wenig Pumpleistung oder zu wenig Widerstand (Sepsis, Addison-Krise).'),
        ['vitals.bp'], ['sepsis', 'urosepsis', 'upper-gi-bleed', 'addisonian-crisis']),
      f(t('Wide pulse pressure with a low diastolic.', 'Große Blutdruckamplitude mit niedrigem diastolischem Wert.'),
        t('Blood runs back or off quickly in diastole: aortic regurgitation, a hyperdynamic circulation (thyrotoxicosis, anaemia, sepsis).',
          'Das Blut fließt in der Diastole schnell zurück oder ab: Aorteninsuffizienz, hyperdyname Kreislauflage (Thyreotoxikose, Anämie, Sepsis).'),
        ['vitals.bp'], ['aortic-regurgitation', 'thyrotoxicosis']),
      f(t('Narrow pulse pressure.', 'Kleine Blutdruckamplitude.'),
        t('A small stroke volume: severe aortic stenosis, hypovolaemia, tamponade, heart failure.',
          'Ein kleines Schlagvolumen: hochgradige Aortenstenose, Hypovolämie, Tamponade, Herzinsuffizienz.'),
        ['vitals.bp'], ['aortic-stenosis', 'acute-heart-failure']),
    ],
    pitfalls: l([
      'A cuff that is too small reads too high; an arm hanging down reads too high.',
      'An auscultatory gap (sounds that vanish and return) makes systolic read low unless the cuff was inflated past the palpated pressure.',
      'In shock the arm may be shut down: a cuff can read lower than the true central pressure.',
    ], [
      'Eine zu kleine Manschette misst zu hoch; ein herabhängender Arm misst zu hoch.',
      'Eine auskultatorische Lücke (Geräusche verschwinden und kehren zurück) täuscht einen zu niedrigen systolischen Wert vor, wenn nicht über den palpatorischen Wert aufgepumpt wurde.',
      'Im Schock kann der Arm zentralisiert sein: die Manschette misst dann niedriger als der zentrale Druck.',
    ]),
  },

  'measure.rr': {
    aliases: l(['breathing rate'], ['Atemzüge pro Minute']),
    assesses: t('Ventilatory drive. A raised rate is one of the earliest and most reliable signs that a patient is deteriorating.',
      'Den Atemantrieb. Eine erhöhte Atemfrequenz ist eines der frühesten und verlässlichsten Zeichen, dass sich ein Patient verschlechtert.'),
    how: l([
      'Count without telling the patient (for example while still holding the wrist, as if counting the pulse): people change their breathing when watched.',
      'Count for 30 seconds and double it, or a full minute if the breathing is irregular.',
      'Note the depth and pattern at the same time.',
    ], [
      'Zählen, ohne es dem Patienten zu sagen (z. B. während man noch das Handgelenk hält, als zähle man den Puls): wer beobachtet wird, atmet anders.',
      '30 Sekunden zählen und verdoppeln, bei unregelmäßiger Atmung eine volle Minute.',
      'Gleichzeitig Tiefe und Muster beachten.',
    ]),
    normal: t('12–20 breaths per minute at rest in an adult.', '12–20 Atemzüge pro Minute in Ruhe beim Erwachsenen.'),
    abnormal: [
      f(t('Tachypnoea: above 20 /min.', 'Tachypnoe: über 20 /min.'),
        t('Lung disease (pneumonia, embolism, oedema, asthma), metabolic acidosis (ketoacidosis, sepsis), pain, anxiety.',
          'Lungenerkrankung (Pneumonie, Embolie, Ödem, Asthma), metabolische Azidose (Ketoazidose, Sepsis), Schmerz, Angst.'),
        ['vitals.rr'], ['community-acquired-pneumonia', 'pulmonary-embolism', 'acute-heart-failure', 'diabetic-ketoacidosis', 'sepsis']),
      f(t('Bradypnoea: below 10 /min.', 'Bradypnoe: unter 10 /min.'),
        t('Depressed drive: opioids, sedatives, raised intracranial pressure; or a patient tiring after hours of hard breathing.',
          'Verminderter Antrieb: Opioide, Sedativa, erhöhter Hirndruck; oder ein Patient, der nach Stunden schwerer Atemarbeit erschöpft.'),
        ['vitals.rr'], ['copd-exacerbation', 'intracerebral-haemorrhage']),
    ],
    pitfalls: l([
      'A falling rate in a breathless patient is not always improvement: it can be exhaustion, with the CO₂ rising.',
    ], [
      'Eine sinkende Frequenz bei einem dyspnoischen Patienten ist nicht immer Besserung: es kann Erschöpfung sein, mit steigendem CO₂.',
    ]),
  },

  'measure.spo2': {
    aliases: l(['oxygen saturation', 'sats', 'pulse oximeter'], ['Sauerstoffsättigung', 'Sättigung']),
    assesses: t('The fraction of haemoglobin carrying oxygen in arterial blood, estimated from how pulsatile blood absorbs red and infrared light.',
      'Den Anteil des Hämoglobins, der im arteriellen Blut Sauerstoff trägt, geschätzt aus der Absorption von rotem und infrarotem Licht durch das pulsierende Blut.'),
    how: l([
      'Put the probe on a warm finger (or the ear lobe) and wait for a steady reading with a good pulse wave.',
      'Note how much oxygen the patient is breathing: a saturation means little without its inspired fraction.',
    ], [
      'Den Sensor an einen warmen Finger (oder das Ohrläppchen) setzen und eine stabile Anzeige mit guter Pulskurve abwarten.',
      'Notieren, wie viel Sauerstoff der Patient atmet: eine Sättigung sagt ohne die inspiratorische Fraktion wenig.',
    ]),
    normal: t('95–100 % on room air. The target in someone at risk of retaining CO₂ (for example COPD) is 88–92 %.',
      '95–100 % unter Raumluft. Bei Gefahr einer CO₂-Retention (z. B. COPD) ist das Ziel 88–92 %.'),
    abnormal: [
      f(t('Below 94 % on room air.', 'Unter 94 % unter Raumluft.'),
        t('Hypoxaemia: ventilation–perfusion mismatch, shunt, hypoventilation or diffusion limitation. Look for the cause in the lungs, the heart and the drive.',
          'Hypoxämie: Ventilations-Perfusions-Missverhältnis, Shunt, Hypoventilation oder Diffusionsstörung. Die Ursache in Lunge, Herz und Atemantrieb suchen.'),
        ['vitals.spo2'], ['community-acquired-pneumonia', 'pulmonary-embolism', 'copd-exacerbation', 'acute-heart-failure', 'pneumothorax']),
    ],
    pitfalls: l([
      'A normal saturation on oxygen does not mean normal ventilation: CO₂ can be rising. Measure a blood gas.',
      'Cold fingers, movement and poor perfusion give poor signals; carbon monoxide reads as oxyhaemoglobin, so the saturation reads falsely high.',
      'Oximeters read higher than the true saturation in darker skin; a borderline value deserves a blood gas.',
    ], [
      'Eine normale Sättigung unter Sauerstoff heißt nicht normale Ventilation: das CO₂ kann steigen. Eine Blutgasanalyse machen.',
      'Kalte Finger, Bewegung und schlechte Perfusion geben schlechte Signale; Kohlenmonoxid wird als Oxyhämoglobin gemessen, die Sättigung ist dann falsch hoch.',
      'Bei dunkler Haut messen Pulsoxymeter höher als die wahre Sättigung; ein Grenzwert verdient eine Blutgasanalyse.',
    ]),
  },

  'measure.temp': {
    aliases: l(['body temperature'], ['Fieber messen']),
    assesses: t('Core temperature, held near its set point by the hypothalamus; inflammation raises the set point (fever).',
      'Die Kerntemperatur, vom Hypothalamus nahe am Sollwert gehalten; Entzündung verstellt den Sollwert nach oben (Fieber).'),
    how: l([
      'Measure in the ear, mouth or rectum; axillary readings run lower.',
      'Record the site, and whether an antipyretic has been given.',
    ], [
      'Im Ohr, sublingual oder rektal messen; axilläre Werte liegen niedriger.',
      'Messort notieren und ob ein Antipyretikum gegeben wurde.',
    ]),
    normal: t('Mean oral temperature in healthy adults is 36.8 °C, varying by about half a degree through the day (lowest early morning).',
      'Die mittlere orale Temperatur gesunder Erwachsener ist 36,8 °C und schwankt im Tagesverlauf um etwa ein halbes Grad (frühmorgens am niedrigsten).'),
    abnormal: [
      f(t('Fever: 38.0 °C or more.', 'Fieber: 38,0 °C oder mehr.'),
        t('Infection or other inflammation; also thyroid storm, drugs, tumours.',
          'Infektion oder andere Entzündung; auch thyreotoxische Krise, Medikamente, Tumoren.'),
        ['vitals.temp'], ['community-acquired-pneumonia', 'urosepsis', 'acute-pyelonephritis', 'sepsis', 'thyroid-storm']),
      f(t('Hypothermia: below 36 °C in an unwell patient, or below 35 °C.', 'Hypothermie: unter 36 °C bei einem kranken Patienten oder unter 35 °C.'),
        t('Exposure, hypothyroidism, or septic shock in which heat production fails with perfusion; a low temperature in sepsis carries a worse prognosis than fever.',
          'Unterkühlung, Hypothyreose oder ein septischer Schock, in dem die Wärmebildung mit der Perfusion versagt; eine niedrige Temperatur bei Sepsis hat eine schlechtere Prognose als Fieber.'),
        ['vitals.temp'], ['sepsis', 'hypothyroidism']),
    ],
    pitfalls: l([
      'The old, the very ill and those on steroids may not mount a fever despite serious infection.',
    ], [
      'Alte, schwer kranke und mit Steroiden behandelte Patienten bekommen trotz schwerer Infektion oft kein Fieber.',
    ]),
    refs: ['mackowiak1992'],
  },

  'measure.bp.lying-standing': {
    aliases: l(['orthostatic blood pressure', 'postural blood pressure', 'Schellong test'], ['Orthostasetest', 'Stehtest']),
    assesses: t('How well the circulation holds pressure when about half a litre of blood pools in the legs on standing: blood volume and the baroreflex.',
      'Wie gut der Kreislauf den Druck hält, wenn beim Aufstehen etwa ein halber Liter Blut in den Beinen versackt: Blutvolumen und Baroreflex.'),
    how: l([
      'The patient lies flat for 5 minutes; measure blood pressure and heart rate.',
      'Stand the patient up, ready to catch them.',
      'Measure again at 1 and at 3 minutes (in the classical Schellong test, every minute for up to 10 minutes), and ask about dizziness.',
    ], [
      'Der Patient liegt 5 Minuten flach; Blutdruck und Herzfrequenz messen.',
      'Den Patienten aufstehen lassen, bereit, ihn aufzufangen.',
      'Nach 1 und nach 3 Minuten erneut messen (im klassischen Schellong-Test minütlich bis 10 Minuten) und nach Schwindel fragen.',
    ]),
    normal: t('Systolic falls by less than 20 mmHg and diastolic by less than 10; the heart rate rises by 10–20 /min.',
      'Der systolische Druck fällt um weniger als 20 mmHg, der diastolische um weniger als 10; die Herzfrequenz steigt um 10–20 /min.'),
    abnormal: [
      f(t('Heart rate rises by 30 /min or more, or standing is impossible because of dizziness.', 'Die Herzfrequenz steigt um 30 /min oder mehr, oder Stehen ist wegen Schwindel unmöglich.'),
        t('Hypovolaemia. After a large blood loss this is the most useful bedside sign; supine pulse and pressure are often still normal.',
          'Hypovolämie. Nach großem Blutverlust ist das das nützlichste Zeichen am Bett; Puls und Druck im Liegen sind oft noch normal.'),
        ['vitals.hr'], ['upper-gi-bleed', 'gastroenteritis', 'diabetic-ketoacidosis']),
      f(t('Systolic falls by 20 mmHg or more, or diastolic by 10 or more, within 3 minutes.', 'Systolischer Abfall um 20 mmHg oder mehr oder diastolischer um 10 oder mehr innerhalb von 3 Minuten.'),
        t('Orthostatic hypotension: volume depletion, adrenal insufficiency, drugs (diuretics, vasodilators), or autonomic failure; in autonomic failure the heart rate hardly rises.',
          'Orthostatische Hypotonie: Volumenmangel, Nebenniereninsuffizienz, Medikamente (Diuretika, Vasodilatatoren) oder autonome Insuffizienz; bei dieser steigt die Herzfrequenz kaum.'),
        ['vitals.bp'], ['orthostatic-hypotension', 'adrenal-insufficiency', 'addisonian-crisis', 'hyponatraemia-thiazide']),
    ],
    pitfalls: l([
      'Do not stand a patient who is already hypotensive lying down, or who cannot stand safely.',
      'Many healthy elderly people have a postural fall without any volume loss.',
    ], [
      'Einen Patienten, der schon im Liegen hypoton ist oder nicht sicher stehen kann, nicht aufstellen.',
      'Viele gesunde ältere Menschen haben einen orthostatischen Abfall ohne Volumenverlust.',
    ]),
    refs: ['mcgee1999'],
  },
};
