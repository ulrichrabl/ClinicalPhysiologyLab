import type { TeachingCard } from '../../model/types.ts';
import { f, l, t } from './helpers.ts';

/* General examination: the look from the end of the bed, skin, mouth, hands, eyes and neck. */
export const GENERAL: Record<string, TeachingCard> = {
  'inspect.general': {
    aliases: l(['end-of-the-bed inspection', 'general appearance'], ['Inspektion vom Bettende', 'Allgemeinzustand', 'AZ']),
    assesses: t('The first impression: how ill the patient is, and clues to the system at fault, before anything is touched.',
      'Den ersten Eindruck: wie krank der Patient ist, und Hinweise auf das betroffene Organsystem, bevor man etwas berührt.'),
    how: l([
      'Stand at the end of the bed for a moment.',
      'Is the patient comfortable or distressed, alert or drowsy, well or unwell?',
      'Look at the colour (pale, flushed, yellow, blue, grey and sweaty), the breathing, the posture and the body habitus.',
      'Note what surrounds them: oxygen, drips, catheter bag, inhalers, walking aids.',
    ], [
      'Einen Moment am Bettende stehen bleiben.',
      'Wirkt der Patient entspannt oder gequält, wach oder schläfrig, gesund oder krank?',
      'Hautfarbe (blass, gerötet, gelb, bläulich, grau und schweißig), Atmung, Haltung und Körperbau beachten.',
      'Auf die Umgebung achten: Sauerstoff, Infusionen, Urinbeutel, Inhalatoren, Gehhilfen.',
    ]),
    normal: t('Alert and comfortable at rest, pink, breathing quietly, talking in full sentences.',
      'Wach und entspannt in Ruhe, rosig, ruhige Atmung, spricht in ganzen Sätzen.'),
    abnormal: [
      f(t('Grey, sweaty, mottled, agitated or drowsy.', 'Grau, schweißig, marmoriert, unruhig oder schläfrig.'),
        t('Shock or severe illness: act before completing the examination.', 'Schock oder schwere Erkrankung: handeln, bevor die Untersuchung vollständig ist.'),
        ['general.appearance'], ['sepsis', 'urosepsis', 'upper-gi-bleed', 'acute-coronary-syndrome']),
      f(t('Central cyanosis: a blue tongue and lips.', 'Zentrale Zyanose: blaue Zunge und Lippen.'),
        t('Hypoxaemia, usually severe: cyanosis appears when capillary blood carries about 5 g/dL of deoxygenated haemoglobin, which most observers see only at saturations of 80–85 %.',
          'Hypoxämie, meist schwer: Zyanose tritt auf, wenn das Kapillarblut etwa 5 g/dl desoxygeniertes Hämoglobin enthält; die meisten Untersucher sehen sie erst bei Sättigungen von 80–85 %.'),
        ['general.appearance'], ['copd-exacerbation', 'community-acquired-pneumonia', 'pulmonary-embolism']),
      f(t('Lying very still, afraid to move; or writhing and unable to settle.', 'Liegt ganz still und vermeidet jede Bewegung; oder windet sich und findet keine Ruhe.'),
        t('Still: peritonitis (movement hurts). Writhing: colic (renal, biliary).', 'Still: Peritonitis (Bewegung schmerzt). Sich windend: Kolik (Nieren, Galle).'),
        ['general.appearance'], ['acute-appendicitis', 'acute-pancreatitis', 'spontaneous-bacterial-peritonitis']),
    ],
    pitfalls: l([
      'Cyanosis is hard to see in anaemia (too little haemoglobin to turn blue), in poor light and in dark skin: look at the tongue.',
    ], [
      'Zyanose ist bei Anämie (zu wenig Hämoglobin, um blau zu werden), bei schlechtem Licht und bei dunkler Haut schwer zu sehen: auf die Zunge schauen.',
    ]),
    refs: ['lundsgaard1923', 'comroe1947'],
  },

  'inspect.skin': {
    aliases: l(['liver stigmata', 'spider naevi', 'palmar erythema'], ['Leberzeichen', 'Spider naevi', 'Palmarerythem']),
    assesses: t('Signs that the liver has failed for a long time: excess oestrogen (spider naevi, palmar erythema, gynaecomastia), low albumin, poor clotting and portal hypertension.',
      'Zeichen langjährigen Leberversagens: Östrogenüberschuss (Spider naevi, Palmarerythem, Gynäkomastie), niedriges Albumin, gestörte Gerinnung und portale Hypertension.'),
    how: l([
      'Hands: palmar erythema, Dupuytren’s contracture, clubbing, white nails (leukonychia).',
      'Face, neck, chest and arms (the area drained by the superior vena cava): spider naevi, which blanch from the centre.',
      'Chest: gynaecomastia in men. Abdomen: dilated veins around the umbilicus (caput medusae).',
      'Skin anywhere: bruising, scratch marks, jaundice.',
    ], [
      'Hände: Palmarerythem, Dupuytren-Kontraktur, Trommelschlägelfinger, Weißnägel (Leukonychie).',
      'Gesicht, Hals, Brust und Arme (Abflussgebiet der V. cava superior): Spider naevi, die vom Zentrum aus abblassen.',
      'Brust: Gynäkomastie beim Mann. Bauch: erweiterte Venen um den Nabel (Caput medusae).',
      'Haut allgemein: Hämatome, Kratzspuren, Ikterus.',
    ]),
    normal: t('None of these; up to about three spider naevi can be normal, and more in pregnancy.',
      'Keines dieser Zeichen; bis zu etwa drei Spider naevi können normal sein, in der Schwangerschaft auch mehr.'),
    abnormal: [
      f(t('Several spider naevi, palmar erythema, gynaecomastia, leukonychia.', 'Mehrere Spider naevi, Palmarerythem, Gynäkomastie, Leukonychie.'),
        t('Chronic liver disease: the liver no longer clears oestrogens and makes too little albumin.',
          'Chronische Lebererkrankung: die Leber baut Östrogene nicht mehr ab und bildet zu wenig Albumin.'),
        ['skin.liver-stigmata'], ['decompensated-cirrhosis', 'alcoholic-hepatitis']),
      f(t('Caput medusae.', 'Caput medusae.'),
        t('Portal hypertension: blood returns to the heart through the umbilical veins.',
          'Portale Hypertension: das Blut fließt über die Nabelvenen zum Herzen zurück.'),
        ['skin.liver-stigmata'], ['decompensated-cirrhosis', 'variceal-bleed']),
    ],
  },

  'inspect.pigmentation': {
    aliases: l(['Addisonian pigmentation'], ['Addison-Pigmentierung', 'Bronzehaut']),
    assesses: t('ACTH excess. ACTH and melanocyte-stimulating hormone come from the same precursor (pro-opiomelanocortin), so high ACTH darkens the skin.',
      'ACTH-Überschuss. ACTH und melanozytenstimulierendes Hormon stammen aus derselben Vorstufe (Proopiomelanocortin); viel ACTH dunkelt die Haut.'),
    how: l([
      'Look at the palmar creases with the hand stretched open.',
      'Look inside the cheeks (buccal mucosa) and at the gums.',
      'Look at recent scars, knuckles, elbows and nipples.',
    ], [
      'Die Handlinien bei gestreckter Hand ansehen.',
      'Die Wangenschleimhaut und das Zahnfleisch ansehen.',
      'Frische Narben, Fingerknöchel, Ellenbogen und Brustwarzen ansehen.',
    ]),
    normal: t('No pigment in the palmar creases or the mouth, other than what is usual for the patient’s skin.',
      'Kein Pigment in Handlinien oder Mund, außer dem für den Hauttyp des Patienten Üblichen.'),
    abnormal: [
      f(t('Dark palmar creases, brown patches inside the cheeks, pigmented scars.', 'Dunkle Handlinien, braune Flecken an der Wangenschleimhaut, pigmentierte Narben.'),
        t('Primary adrenal insufficiency (Addison’s disease): the failing adrenals let ACTH rise. In secondary insufficiency ACTH is low and the skin is pale.',
          'Primäre Nebenniereninsuffizienz (Morbus Addison): bei versagenden Nebennieren steigt das ACTH. Bei sekundärer Insuffizienz ist ACTH niedrig und die Haut blass.'),
        ['skin.pigmentation'], ['addisonian-crisis', 'adrenal-insufficiency']),
    ],
    pitfalls: l([
      'Pigmented creases and buccal patches can be normal in darker skin: ask whether it is new, or compare with old photographs.',
    ], [
      'Pigmentierte Handlinien und Wangenschleimhaut können bei dunkler Haut normal sein: fragen, ob es neu ist, oder mit alten Fotos vergleichen.',
    ]),
  },

  'inspect.mouth': {
    aliases: l(['mucous membranes', 'tongue'], ['Schleimhäute', 'Zunge']),
    assesses: t('Hydration of the mucosa, its colour (pallor, cyanosis), and the tongue and lips for deficiency signs.',
      'Die Feuchtigkeit der Schleimhaut, ihre Farbe (Blässe, Zyanose) sowie Zunge und Lippen auf Mangelzeichen.'),
    how: l([
      'Ask the patient to open the mouth; use a torch.',
      'Look at the tongue, under the tongue, the cheeks and the lips.',
    ], [
      'Den Patienten den Mund öffnen lassen; eine Lampe verwenden.',
      'Zunge, Mundboden, Wangen und Lippen ansehen.',
    ]),
    normal: t('Moist, pink mucosa; a pink tongue with normal papillae.', 'Feuchte, rosige Schleimhaut; rosige Zunge mit normalen Papillen.'),
    abnormal: [
      f(t('A dry tongue and dry mucosa.', 'Trockene Zunge und trockene Schleimhaut.'),
        t('Fluid depletion (vomiting, diarrhoea, osmotic diuresis, hypercalcaemia), or simply mouth breathing.',
          'Flüssigkeitsmangel (Erbrechen, Durchfall, osmotische Diurese, Hyperkalzämie) oder einfach Mundatmung.'),
        ['mouth.mucosa'], ['gastroenteritis', 'diabetic-ketoacidosis', 'hyperosmolar-hyperglycaemic-state', 'hypercalcaemia-malignancy']),
      f(t('A smooth, red, sore tongue (glossitis); cracks at the corners of the mouth (angular cheilitis).', 'Glatte, rote, wunde Zunge (Glossitis); Einrisse der Mundwinkel (Mundwinkelrhagaden).'),
        t('Deficiency of vitamin B₁₂, folate or iron.', 'Mangel an Vitamin B₁₂, Folsäure oder Eisen.'),
        ['mouth.mucosa'], ['b12-deficiency', 'iron-deficiency-anaemia']),
    ],
    pitfalls: l([
      'Oxygen and mouth breathing dry the mouth without any fluid deficit; a moist mouth is more informative than a dry one.',
    ], [
      'Sauerstoff und Mundatmung trocknen den Mund ohne Flüssigkeitsmangel aus; ein feuchter Mund sagt mehr als ein trockener.',
    ]),
  },

  'smell.breath': {
    aliases: l(['fetor hepaticus', 'ketotic breath'], ['Foetor hepaticus', 'Azetongeruch', 'Foetor uraemicus']),
    assesses: t('Volatile substances the blood carries to the lungs: ketones, sulphur compounds the liver fails to clear, urea breakdown products, alcohol.',
      'Flüchtige Stoffe, die das Blut zur Lunge bringt: Ketone, Schwefelverbindungen, die die Leber nicht abbaut, Abbauprodukte des Harnstoffs, Alkohol.'),
    how: l(['Notice the smell as the patient breathes out, when close to them (for example while looking in the mouth).'],
      ['Den Geruch der Ausatemluft wahrnehmen, wenn man nahe am Patienten ist (z. B. beim Blick in den Mund).']),
    normal: t('No particular odour.', 'Kein besonderer Geruch.'),
    abnormal: [
      f(t('Sweet, fruity, like pear drops or nail-varnish remover.', 'Süßlich-fruchtig, wie Nagellackentferner (Azeton).'),
        t('Ketosis: diabetic, alcoholic or starvation ketoacidosis.', 'Ketose: diabetische, alkoholische oder Hungerketoazidose.'),
        ['breath.odour'], ['diabetic-ketoacidosis', 'alcoholic-ketoacidosis', 'starvation-ketosis']),
      f(t('Musty, sweetish (fetor hepaticus).', 'Muffig-süßlich (Foetor hepaticus).'),
        t('Liver failure, often with hepatic encephalopathy.', 'Leberversagen, oft mit hepatischer Enzephalopathie.'),
        ['breath.odour'], ['hepatic-encephalopathy', 'decompensated-cirrhosis']),
      f(t('Ammonia-like, fishy (uraemic fetor).', 'Ammoniak-, fischartig (Foetor uraemicus).'),
        t('Advanced kidney failure.', 'Fortgeschrittenes Nierenversagen.'),
        ['breath.odour'], ['chronic-kidney-disease', 'acute-kidney-injury']),
    ],
    pitfalls: l(['A sizeable minority of people cannot smell acetone at all.'], ['Ein beträchtlicher Teil der Menschen kann Azeton gar nicht riechen.']),
  },

  'test.turgor': {
    aliases: l(['skin elasticity', 'tenting'], ['stehende Hautfalte']),
    assesses: t('Interstitial fluid in the skin: dehydrated skin returns slowly after being pinched.',
      'Die interstitielle Flüssigkeit der Haut: ausgetrocknete Haut gleicht sich nach dem Abheben langsam aus.'),
    how: l([
      'Pinch a fold of skin over the sternum or the forearm for a second or two.',
      'Let go and watch how quickly it flattens.',
    ], [
      'Eine Hautfalte über dem Sternum oder am Unterarm ein bis zwei Sekunden abheben.',
      'Loslassen und beobachten, wie schnell sie verstreicht.',
    ]),
    normal: t('The fold flattens at once.', 'Die Falte verstreicht sofort.'),
    abnormal: [
      f(t('The fold stays up and flattens slowly (tenting).', 'Die Falte bleibt stehen und verstreicht langsam (stehende Hautfalte).'),
        t('Fluid depletion.', 'Flüssigkeitsmangel.'),
        ['skin.turgor'], ['gastroenteritis', 'diabetic-ketoacidosis', 'hyperosmolar-hyperglycaemic-state']),
    ],
    pitfalls: l([
      'Elderly skin loses its elasticity and tents without any dehydration; in adults, turgor has no proven diagnostic value.',
    ], [
      'Alte Haut verliert ihre Elastizität und bleibt auch ohne Flüssigkeitsmangel stehen; beim Erwachsenen hat der Turgor keinen gesicherten diagnostischen Wert.',
    ]),
    refs: ['mcgee1999'],
  },

  'measure.crt': {
    aliases: l(['CRT', 'capillary refill'], ['Rekapillarisierung', 'Nagelbettprobe']),
    assesses: t('Skin perfusion: how quickly blood returns to a blanched capillary bed. It falls when sympathetic vasoconstriction shuts the skin down (shock, cold).',
      'Die Hautdurchblutung: wie schnell Blut in ein abgeblasstes Kapillarbett zurückkehrt. Sie sinkt, wenn sympathische Vasokonstriktion die Haut drosselt (Schock, Kälte).'),
    how: l([
      'Hold the hand at heart level.',
      'Press the nail bed (or the skin over the sternum) for 5 seconds until it blanches.',
      'Release and count the seconds until the colour returns.',
    ], [
      'Die Hand auf Herzhöhe halten.',
      'Das Nagelbett (oder die Haut über dem Sternum) 5 Sekunden drücken, bis es abblasst.',
      'Loslassen und die Sekunden zählen, bis die Farbe zurückkehrt.',
    ]),
    normal: t('About 1 second in adults; up to 2 s in men, 3 s in women and 4.5 s in the elderly is still within normal.',
      'Etwa 1 Sekunde beim Erwachsenen; bis 2 s bei Männern, 3 s bei Frauen und 4,5 s bei alten Menschen ist noch normal.'),
    abnormal: [
      f(t('Refill slower than the normal limit for age and sex, in a warm room.', 'Langsamere Rekapillarisierung als die Normgrenze für Alter und Geschlecht, in warmer Umgebung.'),
        t('Poor peripheral perfusion: shock, hypovolaemia.', 'Schlechte periphere Perfusion: Schock, Hypovolämie.'),
        ['hands.crt'], ['sepsis', 'urosepsis', 'upper-gi-bleed', 'gastroenteritis']),
    ],
    pitfalls: l([
      'Cold prolongs refill without any shock; the upper limit rises with age and is higher in women.',
      'In adults capillary refill has no proven value for detecting hypovolaemia; use it with pulse, pressure and urine output.',
    ], [
      'Kälte verlängert die Rekapillarisierung ohne Schock; die Obergrenze steigt mit dem Alter und ist bei Frauen höher.',
      'Beim Erwachsenen hat die Rekapillarisierungszeit keinen gesicherten Wert für eine Hypovolämie; zusammen mit Puls, Blutdruck und Urinausscheidung verwenden.',
    ]),
    refs: ['schriger1988', 'mcgee1999'],
  },

  'test.tremor': {
    aliases: l(['fine tremor', 'outstretched hands'], ['feinschlägiger Tremor', 'Vorhalteversuch der Hände']),
    assesses: t('A tremor that appears when holding a posture: an exaggerated physiological tremor from adrenergic drive, or an essential tremor.',
      'Ein Zittern beim Halten einer Haltung: ein verstärkter physiologischer Tremor durch adrenergen Antrieb oder ein essenzieller Tremor.'),
    how: l([
      'Ask the patient to hold both arms straight out in front, fingers spread.',
      'Watch the fingers; a sheet of paper laid on the backs of the hands makes a fine tremor easier to see.',
    ], [
      'Den Patienten beide Arme gestreckt nach vorne halten lassen, Finger gespreizt.',
      'Die Finger beobachten; ein Blatt Papier auf den Handrücken macht einen feinen Tremor besser sichtbar.',
    ]),
    normal: t('The hands stay still to the eye.', 'Die Hände bleiben für das Auge ruhig.'),
    abnormal: [
      f(t('A fine, fast tremor of the outstretched fingers.', 'Ein feiner, schneller Tremor der vorgehaltenen Finger.'),
        t('Adrenergic excess: thyrotoxicosis, anxiety, caffeine, β-agonists (salbutamol), alcohol withdrawal, phaeochromocytoma, hypoglycaemia.',
          'Adrenerger Überschuss: Thyreotoxikose, Angst, Koffein, β-Agonisten (Salbutamol), Alkoholentzug, Phäochromozytom, Hypoglykämie.'),
        ['hands.tremor'], ['thyrotoxicosis', 'graves-disease', 'anxiety-disorder', 'phaeochromocytoma', 'hypoglycaemia']),
    ],
    pitfalls: l([
      'A coarse irregular flap is not tremor: test for asterixis. A tremor at rest that eases on movement is Parkinsonian.',
    ], [
      'Ein grobes, unregelmäßiges Flattern ist kein Tremor: auf Asterixis prüfen. Ein Ruhetremor, der bei Bewegung nachlässt, ist parkinsonartig.',
    ]),
  },

  'test.asterixis': {
    aliases: l(['flapping tremor', 'liver flap'], ['Flapping Tremor', 'Flattertremor']),
    assesses: t('Metabolic encephalopathy. Asterixis is not a tremor but brief lapses in postural tone (negative myoclonus).',
      'Eine metabolische Enzephalopathie. Asterixis ist kein Tremor, sondern kurze Aussetzer des Haltetonus (negativer Myoklonus).'),
    how: l([
      'Ask the patient to hold the arms out, cock the wrists back and spread the fingers, like stopping traffic.',
      'Watch for at least 30 seconds.',
    ], [
      'Den Patienten die Arme vorhalten, die Hände nach oben abwinkeln und die Finger spreizen lassen, wie beim Anhalten des Verkehrs.',
      'Mindestens 30 Sekunden beobachten.',
    ]),
    normal: t('The hands stay up.', 'Die Hände bleiben oben.'),
    abnormal: [
      f(t('The hands drop forward briefly and jerk back, irregularly, on both sides.', 'Die Hände fallen unregelmäßig kurz nach vorne und schnellen zurück, beidseits.'),
        t('Metabolic encephalopathy: liver failure, uraemia, CO₂ retention.', 'Metabolische Enzephalopathie: Leberversagen, Urämie, CO₂-Retention.'),
        ['hands.asterixis'], ['hepatic-encephalopathy', 'decompensated-cirrhosis', 'acute-kidney-injury', 'copd-exacerbation']),
    ],
    pitfalls: l([
      'The patient must be awake enough to hold the posture; asterixis disappears in coma.',
    ], [
      'Der Patient muss wach genug sein, um die Haltung zu halten; im Koma verschwindet die Asterixis.',
    ]),
  },

  'inspect.sclera': {
    aliases: l(['jaundice', 'icterus'], ['Ikterus', 'Gelbsucht']),
    assesses: t('Bilirubin in the tissues. The sclerae show it first because their elastin binds bilirubin and their white background makes yellow easy to see.',
      'Bilirubin im Gewebe. Die Skleren zeigen es zuerst, weil ihr Elastin Bilirubin bindet und der weiße Hintergrund Gelb gut erkennen lässt.'),
    how: l([
      'Use daylight if possible.',
      'Ask the patient to look down and gently lift the upper lid; look at the sclera away from the lid margin.',
    ], [
      'Möglichst bei Tageslicht.',
      'Den Patienten nach unten blicken lassen und das Oberlid sanft anheben; die Sklera abseits des Lidrands ansehen.',
    ]),
    normal: t('White sclerae.', 'Weiße Skleren.'),
    abnormal: [
      f(t('Yellow sclerae.', 'Gelbe Skleren.'),
        t('Hyperbilirubinaemia, usually above about 40–50 µmol/L: too much made (haemolysis), too little conjugated or excreted (liver disease), or blocked outflow (obstruction).',
          'Hyperbilirubinämie, meist über etwa 40–50 µmol/l: zu viel gebildet (Hämolyse), zu wenig konjugiert oder ausgeschieden (Lebererkrankung) oder gestörter Abfluss (Obstruktion).'),
        ['eyes.sclera'], ['haemolytic-anaemia', 'decompensated-cirrhosis', 'alcoholic-hepatitis', 'obstructive-jaundice']),
    ],
    pitfalls: l([
      'Physicians detect jaundice only about 70 % of the time; artificial light hides it.',
      'Carotenaemia yellows the skin but spares the sclerae.',
    ], [
      'Ärzte erkennen einen Ikterus nur in etwa 70 % der Fälle; Kunstlicht verdeckt ihn.',
      'Karotinämie färbt die Haut gelb, aber nicht die Skleren.',
    ]),
    refs: ['hung2000'],
  },

  'inspect.conjunctiva': {
    aliases: l(['pallor', 'anaemia'], ['Blässe', 'Anämiezeichen']),
    assesses: t('Haemoglobin concentration, seen through the thin conjunctiva.', 'Die Hämoglobinkonzentration, sichtbar durch die dünne Bindehaut.'),
    how: l([
      'Ask the patient to look up and gently pull down the lower lid.',
      'Compare the colour of the front rim of the lower lid with the deeper, posterior part.',
    ], [
      'Den Patienten nach oben blicken lassen und das Unterlid sanft herunterziehen.',
      'Die Farbe des vorderen Lidrands mit dem tieferen, hinteren Anteil vergleichen.',
    ]),
    normal: t('The front rim is clearly redder than the part behind it.', 'Der vordere Rand ist deutlich röter als der dahinterliegende Anteil.'),
    abnormal: [
      f(t('The front rim is as pale as the rest (no rim contrast).', 'Der vordere Rand ist ebenso blass wie der Rest (kein Randkontrast).'),
        t('Anaemia, probably severe: conjunctival pallor raises the odds of a haemoglobin of 90 g/L or less about 4.5-fold (likelihood ratio 4.5).',
          'Anämie, wahrscheinlich ausgeprägt: konjunktivale Blässe erhöht die Chance auf ein Hämoglobin von 90 g/l oder weniger etwa um das 4,5-Fache (Likelihood-Ratio 4,5).'),
        ['eyes.conjunctiva'], ['iron-deficiency-anaemia', 'upper-gi-bleed', 'b12-deficiency', 'haemolytic-anaemia']),
    ],
    pitfalls: l([
      'The absence of pallor does not rule out anaemia, and observers often disagree.',
      'Conjunctivitis reddens the conjunctiva and hides pallor.',
    ], [
      'Fehlende Blässe schließt eine Anämie nicht aus, und Untersucher sind sich oft uneinig.',
      'Eine Konjunktivitis rötet die Bindehaut und verdeckt die Blässe.',
    ]),
    refs: ['sheth1997', 'kalantri2010'],
  },

  'inspect.thyroid-eyes': {
    aliases: l(['lid lag', 'lid retraction', 'Graefe sign', 'exophthalmos'], ['Graefe-Zeichen', 'Dalrymple-Zeichen', 'Exophthalmus']),
    assesses: t('Two different things: sympathetic overactivity of the lid muscle (Müller’s muscle), seen in any thyrotoxicosis; and Graves’ orbitopathy, an autoimmune swelling of the orbit.',
      'Zwei verschiedene Dinge: sympathische Überaktivität des Lidmuskels (M. tarsalis, Müller), bei jeder Thyreotoxikose; und die endokrine Orbitopathie, eine autoimmune Schwellung der Orbita beim Morbus Basedow.'),
    how: l([
      'Look from the front: is white sclera visible above the iris (lid retraction)?',
      'Look from the side and from above, over the forehead: do the eyes protrude (proptosis)?',
      'Ask the patient to follow your finger slowly from above downwards: does the upper lid lag behind the eye (lid lag)?',
      'Test eye movements and ask about double vision; look for red, swollen conjunctivae (chemosis).',
    ], [
      'Von vorne: ist über der Iris weiße Sklera sichtbar (Lidretraktion, Dalrymple-Zeichen)?',
      'Von der Seite und von oben über die Stirn: treten die Augen hervor (Exophthalmus)?',
      'Den Patienten dem Finger langsam von oben nach unten folgen lassen: bleibt das Oberlid hinter dem Auge zurück (Graefe-Zeichen)?',
      'Augenbewegungen prüfen und nach Doppelbildern fragen; auf gerötete, geschwollene Bindehaut achten (Chemosis).',
    ]),
    normal: t('The upper lid just covers the top of the iris and follows the eye smoothly; no proptosis.',
      'Das Oberlid bedeckt gerade den oberen Irisrand und folgt dem Auge gleichmäßig; kein Exophthalmus.'),
    abnormal: [
      f(t('Lid retraction and lid lag.', 'Lidretraktion und Graefe-Zeichen.'),
        t('Thyrotoxicosis of any cause.', 'Thyreotoxikose jeder Ursache.'),
        ['eyes.thyroid'], ['thyrotoxicosis', 'toxic-multinodular-goitre', 'thyroiditis', 'graves-disease']),
      f(t('Proptosis, chemosis, restricted eye movements, double vision.', 'Exophthalmus, Chemosis, eingeschränkte Augenbewegungen, Doppelbilder.'),
        t('Graves’ orbitopathy: specific to Graves’ disease, and it can occur without thyrotoxicosis.',
          'Endokrine Orbitopathie: spezifisch für den Morbus Basedow und auch ohne Thyreotoxikose möglich.'),
        ['eyes.thyroid'], ['graves-disease']),
    ],
  },

  'palpate.thyroid': {
    aliases: l(['goitre', 'thyroid palpation'], ['Struma', 'Schilddrüsenpalpation']),
    assesses: t('The size, shape, consistency and tenderness of the thyroid gland, and whether a lump belongs to it.',
      'Größe, Form, Konsistenz und Druckschmerz der Schilddrüse und ob eine Schwellung zu ihr gehört.'),
    how: l([
      'Look at the neck from the front; give a sip of water and watch: the thyroid rises on swallowing. A thyroglossal cyst rises when the tongue is stuck out.',
      'Stand behind the patient, neck slightly flexed, and feel both lobes and the isthmus with the fingertips, then again while they swallow.',
      'Feel the lymph nodes of the neck; percuss over the sternum for retrosternal extension; listen over each lobe for a bruit.',
    ], [
      'Den Hals von vorne ansehen; einen Schluck Wasser geben und beobachten: die Schilddrüse steigt beim Schlucken. Eine mediane Halszyste steigt beim Herausstrecken der Zunge.',
      'Hinter dem Patienten stehen, den Hals leicht gebeugt, beide Lappen und den Isthmus mit den Fingerspitzen tasten, dann erneut beim Schlucken.',
      'Die Halslymphknoten tasten; über dem Sternum auf eine retrosternale Ausdehnung perkutieren; über jedem Lappen auf ein Strömungsgeräusch hören.',
    ]),
    normal: t('Hardly visible or palpable, soft, smooth, painless, moving with swallowing.',
      'Kaum sichtbar oder tastbar, weich, glatt, schmerzlos, schluckverschieblich.'),
    abnormal: [
      f(t('A diffuse, smooth, soft goitre with a bruit.', 'Eine diffuse, glatte, weiche Struma mit Strömungsgeräusch.'),
        t('Graves’ disease: the stimulated gland is enlarged and very vascular.', 'Morbus Basedow: die stimulierte Drüse ist vergrößert und stark durchblutet.'),
        ['neck.thyroid'], ['graves-disease']),
      f(t('An irregular, nodular goitre.', 'Eine unregelmäßige, knotige Struma.'),
        t('Multinodular goitre, toxic or not.', 'Knotenstruma, mit oder ohne Autonomie.'),
        ['neck.thyroid'], ['toxic-multinodular-goitre']),
      f(t('A tender gland, often after a viral illness.', 'Eine druckschmerzhafte Drüse, oft nach einem Virusinfekt.'),
        t('Subacute (de Quervain’s) thyroiditis.', 'Subakute Thyreoiditis (de Quervain).'),
        ['neck.thyroid'], ['thyroiditis']),
    ],
    pitfalls: l(['A hard, fixed, single nodule or hard lymph nodes need investigation for cancer.'], ['Ein harter, fixierter, einzelner Knoten oder harte Lymphknoten müssen auf ein Karzinom abgeklärt werden.']),
  },
};
