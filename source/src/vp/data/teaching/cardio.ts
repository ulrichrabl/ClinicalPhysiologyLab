import type { TeachingCard, TeachingFinding } from '../../model/types.ts';
import type { LocalizedText } from '../../model/i18n.ts';
import { f, l, t } from './helpers.ts';

/* Cardiovascular system. */

/* The five classical auscultation sites share how auscultation is done; what each site hears best differs. */
const HEART_HOW = l([
  'Patient reclined at 45°, chest exposed; feel the carotid pulse at the same time to time systole.',
  'Listen with the diaphragm (high-pitched sounds), then the bell laid on lightly (low-pitched sounds).',
  'Identify S1 and S2, then listen in systole and in diastole for added sounds and murmurs.',
  'For a murmur: timing, site of greatest loudness, radiation, grade (1–6), and change with breathing and manoeuvres.',
], [
  'Patient 45° hochgelagert, Oberkörper frei; gleichzeitig den Karotispuls tasten, um die Systole zuzuordnen.',
  'Mit der Membran (hohe Frequenzen) hören, dann mit dem leicht aufgesetzten Trichter (tiefe Frequenzen).',
  'S1 und S2 identifizieren, dann in Systole und Diastole auf Extratöne und Geräusche achten.',
  'Bei einem Geräusch: Zeitpunkt, Punctum maximum, Fortleitung, Lautstärke (1/6–6/6) und Änderung mit Atmung und Manövern.',
]);
const HEART_NORMAL = t('Two heart sounds, S1 and S2, with silence between them; S2 splits a little on inspiration. A soft early systolic flow murmur can be normal.',
  'Zwei Herztöne, S1 und S2, dazwischen Stille; S2 spaltet bei Einatmung leicht. Ein leises frühsystolisches Flussgeräusch kann normal sein.');
const heartSite = (where: LocalizedText, assesses: LocalizedText, abnormal: TeachingFinding[], extra?: Partial<TeachingCard>): TeachingCard => ({
  assesses: t(`${where.en}: ${assesses.en}`, `${where.de}: ${assesses.de}`),
  how: HEART_HOW, normal: HEART_NORMAL, abnormal,
  pitfalls: l([
    'Murmurs are heard over a wider area than their name suggests; the site of greatest loudness and the radiation matter more than the site.',
    'A loud murmur does not mean a severe lesion: in severe aortic stenosis with a failing ventricle the murmur becomes quieter.',
  ], [
    'Geräusche sind weiter zu hören, als ihr Name vermuten lässt; Punctum maximum und Fortleitung zählen mehr als der Ort.',
    'Ein lautes Geräusch heißt nicht ein schwerer Klappenfehler: bei hochgradiger Aortenstenose mit versagendem Ventrikel wird das Geräusch leiser.',
  ]),
  ...extra,
});

export const CARDIO: Record<string, TeachingCard> = {
  'palpate.pulse.radial': {
    aliases: l(['pulse'], ['Puls']),
    assesses: t('Rate and rhythm; and, compared with other pulses, delays and asymmetries along the arteries.',
      'Frequenz und Rhythmus; im Vergleich mit anderen Pulsen auch Verzögerungen und Seitendifferenzen entlang der Arterien.'),
    how: l([
      'Feel the radial artery at the wrist with two fingers, lateral to the flexor tendons.',
      'Assess rate and rhythm; compare both sides at once (radio-radial delay) and with the femoral pulse (radio-femoral delay).',
      'Raise the arm above the head while feeling with the palm: a tapping, collapsing pulse is easier to feel.',
    ], [
      'Die A. radialis am Handgelenk mit zwei Fingern tasten, lateral der Beugesehnen.',
      'Frequenz und Rhythmus beurteilen; beide Seiten gleichzeitig vergleichen (Seitendifferenz) und mit dem Femoralispuls (radiofemorale Verzögerung).',
      'Den Arm über den Kopf heben und mit der Handfläche tasten: ein schnellender Puls ist so leichter zu fühlen.',
    ]),
    normal: t('60–100 /min, regular, the same on both sides and in time with the femoral pulse.', '60–100 /min, regelmäßig, seitengleich und zeitgleich mit dem Femoralispuls.'),
    abnormal: [
      f(t('Irregularly irregular.', 'Absolut unregelmäßig.'), t('Atrial fibrillation.', 'Vorhofflimmern.'), ['pulse.radial'], ['atrial-fibrillation']),
      f(t('Collapsing (water-hammer) pulse: a sharp rise and a quick fall, felt best with the arm raised.', 'Schnellender Puls (Pulsus celer et altus): schneller Anstieg und rascher Abfall, am besten bei erhobenem Arm.'),
        t('Aortic regurgitation; also a hyperdynamic circulation (thyrotoxicosis, anaemia, pregnancy, sepsis).', 'Aorteninsuffizienz; auch hyperdyname Kreislauflage (Thyreotoxikose, Anämie, Schwangerschaft, Sepsis).'),
        ['pulse.radial'], ['aortic-regurgitation', 'thyrotoxicosis']),
      f(t('Weak and fast (thready).', 'Schwach und schnell (fadenförmig).'), t('Shock with a small stroke volume.', 'Schock mit kleinem Schlagvolumen.'), ['pulse.radial'], ['upper-gi-bleed', 'sepsis']),
    ],
  },

  'palpate.pulse.carotid': {
    aliases: l(['pulse character'], ['Pulsqualität']),
    assesses: t('The character and volume of the pulse: the carotid is close to the aorta, so its upstroke reflects left ventricular ejection.',
      'Qualität und Füllung des Pulses: die Karotis liegt nahe der Aorta, ihr Anstieg spiegelt die linksventrikuläre Ejektion.'),
    how: l([
      'With the patient reclined, feel one carotid at a time with the thumb or two fingers, medial to the sternomastoid.',
      'Judge the upstroke (brisk or slow), the volume and any double peak.',
    ], [
      'Am halb liegenden Patienten immer nur eine Karotis tasten, mit dem Daumen oder zwei Fingern medial des M. sternocleidomastoideus.',
      'Den Anstieg (rasch oder langsam), die Füllung und eine eventuelle Doppelgipfligkeit beurteilen.',
    ]),
    normal: t('A smooth, brisk upstroke of normal volume.', 'Ein glatter, rascher Anstieg mit normaler Füllung.'),
    abnormal: [
      f(t('Slow-rising, small-volume pulse (pulsus parvus et tardus).', 'Langsam ansteigender, kleiner Puls (Pulsus parvus et tardus).'),
        t('Severe aortic stenosis: the narrow valve slows ejection.', 'Hochgradige Aortenstenose: die enge Klappe verlangsamt den Auswurf.'),
        ['pulse.carotid'], ['aortic-stenosis']),
      f(t('Bounding, collapsing pulse; or a double peak (bisferiens).', 'Schnellender Puls; oder ein Doppelgipfel (Pulsus bisferiens).'),
        t('Aortic regurgitation (bisferiens with mixed aortic valve disease); a jerky pulse in hypertrophic cardiomyopathy.',
          'Aorteninsuffizienz (Pulsus bisferiens bei kombiniertem Aortenvitium); ein ruckartiger Puls bei hypertropher Kardiomyopathie.'),
        ['pulse.carotid'], ['aortic-regurgitation', 'hcm']),
    ],
    pitfalls: l([
      'Never press both carotids at once, and do not massage: it can slow the heart (baroreflex) or dislodge plaque.',
    ], [
      'Nie beide Karotiden gleichzeitig drücken und nicht massieren: das kann das Herz verlangsamen (Baroreflex) oder Plaques lösen.',
    ]),
  },

  'inspect.jvp': {
    aliases: l(['JVP', 'neck veins', 'hepatojugular reflux'], ['Halsvenenstauung', 'hepatojugulärer Reflux', 'JVD']),
    assesses: t('Right atrial pressure. The internal jugular vein has no valve and is a column of blood standing on the right atrium; its height shows the filling pressure of the right heart.',
      'Den rechtsatrialen Druck. Die V. jugularis interna hat keine Klappe und ist eine Blutsäule, die auf dem rechten Vorhof steht; ihre Höhe zeigt den Füllungsdruck des rechten Herzens.'),
    how: l([
      'Recline the patient at 45°, head turned slightly to the left, in good side light.',
      'Look for the pulsation of the right internal jugular between the heads of sternomastoid; it is double, impalpable, can be blocked by gentle pressure low in the neck, and falls on inspiration.',
      'Measure the vertical height of the top of the pulsation above the sternal angle.',
      'If unsure, press on the abdomen for 10 seconds (hepatojugular reflux): a sustained rise means the right heart cannot accept more volume.',
    ], [
      'Patient 45° hochgelagert, Kopf leicht nach links gedreht, gutes Seitenlicht.',
      'Die Pulsation der rechten V. jugularis interna zwischen den Köpfen des M. sternocleidomastoideus suchen; sie ist doppelgipflig, nicht tastbar, durch leichten Druck tief am Hals unterdrückbar und fällt bei Einatmung.',
      'Die senkrechte Höhe des oberen Endes der Pulsation über dem Angulus sterni messen.',
      'Im Zweifel 10 Sekunden auf das Abdomen drücken (hepatojugulärer Reflux): ein anhaltender Anstieg heißt, das rechte Herz kann kein Volumen mehr aufnehmen.',
    ]),
    normal: t('Up to 3–4 cm above the sternal angle at 45°; the right atrium lies about 5 cm below the angle, so this is a right atrial pressure up to about 8 cmH₂O.',
      'Bis 3–4 cm über dem Angulus sterni bei 45°; der rechte Vorhof liegt etwa 5 cm unter dem Angulus, das entspricht einem rechtsatrialen Druck bis etwa 8 cmH₂O.'),
    abnormal: [
      f(t('Raised JVP.', 'Erhöhter Jugularvenendruck.'),
        t('High right-sided filling: fluid overload, right or biventricular failure, massive pulmonary embolism, tamponade, tension pneumothorax.',
          'Hohe rechtsseitige Füllung: Volumenüberladung, Rechts- oder Globalherzinsuffizienz, massive Lungenembolie, Tamponade, Spannungspneumothorax.'),
        ['jvp'], ['acute-heart-failure', 'pulmonary-embolism', 'pneumothorax', 'chronic-kidney-disease']),
      f(t('JVP not visible even with the patient flat.', 'Halsvenen auch im Liegen nicht sichtbar.'),
        t('Low right atrial pressure: hypovolaemia.', 'Niedriger rechtsatrialer Druck: Hypovolämie.'),
        ['jvp'], ['upper-gi-bleed', 'gastroenteritis', 'diabetic-ketoacidosis']),
      f(t('Cannon waves: large irregular a waves.', 'Kanonenwellen: große, unregelmäßige a-Wellen.'),
        t('The atrium contracts against a closed tricuspid valve: complete heart block, ventricular tachycardia.',
          'Der Vorhof kontrahiert gegen die geschlossene Trikuspidalklappe: AV-Block III. Grades, ventrikuläre Tachykardie.'),
        ['jvp'], ['complete-heart-block', 'ventricular-tachycardia']),
    ],
    pitfalls: l([
      'A raised, non-pulsatile vein is superior vena cava obstruction, not heart failure.',
      'In a very high JVP the top may be above the jaw: sit the patient upright to find it.',
    ], [
      'Eine gestaute, nicht pulsierende Vene ist eine obere Einflussstauung, keine Herzinsuffizienz.',
      'Bei sehr hohem Venendruck liegt das obere Ende über dem Kieferwinkel: den Patienten aufrecht setzen, um es zu finden.',
    ]),
  },

  'palpate.apex': {
    aliases: l(['apex beat', 'PMI'], ['Herzspitzenstoß', 'HSS']),
    assesses: t('The size and the work of the left ventricle: where its tip strikes the chest wall and how.',
      'Größe und Arbeit des linken Ventrikels: wo und wie seine Spitze an die Brustwand schlägt.'),
    how: l([
      'Place the flat of the hand on the left chest, then localise the beat with the fingertips: the lowest and most lateral point where it is felt.',
      'Count the intercostal space down from the sternal angle (2nd rib); note its relation to the midclavicular line.',
      'Judge its character; roll the patient to the left if it cannot be felt.',
    ], [
      'Die flache Hand auf die linke Brustwand legen, dann den Stoß mit den Fingerspitzen lokalisieren: der tiefste und am weitesten lateral gelegene Punkt.',
      'Den Interkostalraum vom Angulus sterni (2. Rippe) abzählen; die Lage zur Medioklavikularlinie notieren.',
      'Die Qualität beurteilen; den Patienten nach links drehen, wenn er nicht tastbar ist.',
    ]),
    normal: t('In the 5th intercostal space at the midclavicular line, a brief tap no larger than a coin.',
      'Im 5. Interkostalraum in der Medioklavikularlinie, kurz und nicht größer als eine Münze.'),
    abnormal: [
      f(t('Displaced down and out, diffuse.', 'Nach unten außen verlagert, verbreitert.'),
        t('A dilated left ventricle (volume overload): mitral or aortic regurgitation, dilated cardiomyopathy.',
          'Ein dilatierter linker Ventrikel (Volumenbelastung): Mitral- oder Aorteninsuffizienz, dilatative Kardiomyopathie.'),
        ['apex'], ['mitral-regurgitation', 'aortic-regurgitation', 'acute-heart-failure']),
      f(t('Not displaced but sustained and heaving.', 'Nicht verlagert, aber hebend und anhaltend.'),
        t('Left ventricular hypertrophy (pressure overload): aortic stenosis, hypertension, hypertrophic cardiomyopathy.',
          'Linksventrikuläre Hypertrophie (Druckbelastung): Aortenstenose, Hypertonie, hypertrophe Kardiomyopathie.'),
        ['apex'], ['aortic-stenosis', 'hcm']),
    ],
    pitfalls: l([
      'Impalpable in many normal people: obesity, a thick chest wall, hyperinflated lungs, a pericardial effusion.',
      'A shift of the mediastinum (pneumothorax, collapse) moves the apex without any heart disease.',
    ], [
      'Bei vielen Gesunden nicht tastbar: Adipositas, dicke Brustwand, überblähte Lunge, Perikarderguss.',
      'Eine Mediastinalverschiebung (Pneumothorax, Atelektase) verlagert den Spitzenstoß ohne Herzerkrankung.',
    ]),
  },

  'auscultate.heart.aortic': heartSite(t('Aortic area, 2nd right intercostal space at the sternal edge', 'Aortenareal, 2. ICR rechts parasternal'),
    t('the aortic component of S2 and murmurs of the aortic valve and outflow.', 'die aortale Komponente des S2 und Geräusche der Aortenklappe und des Ausflusstrakts.'),
    [f(t('A harsh ejection systolic (crescendo–decrescendo) murmur radiating to the carotids; a soft or absent S2.', 'Ein raues spindelförmiges Systolikum mit Fortleitung in die Karotiden; leiser oder fehlender 2. Herzton.'),
      t('Aortic stenosis; a soft S2 means a severe one.', 'Aortenstenose; ein leiser 2. Herzton spricht für eine hochgradige.'),
      ['heart.sounds'], ['aortic-stenosis'])],
    { aliases: l(['2nd right ICS'], ['2. ICR rechts']) }),

  'auscultate.heart.pulmonary': heartSite(t('Pulmonary area, 2nd left intercostal space at the sternal edge', 'Pulmonalareal, 2. ICR links parasternal'),
    t('the pulmonary component of S2 and its splitting; murmurs of the pulmonary valve.', 'die pulmonale Komponente des S2 und ihre Spaltung; Geräusche der Pulmonalklappe.'),
    [
      f(t('A loud pulmonary component of S2.', 'Ein lauter pulmonaler Anteil des 2. Herztons.'),
        t('Pulmonary hypertension: the valve shuts against a high pressure.', 'Pulmonale Hypertonie: die Klappe schließt gegen einen hohen Druck.'),
        ['heart.sounds'], ['pulmonary-embolism', 'copd-exacerbation', 'pulmonary-fibrosis']),
      f(t('A wide split of S2 that does not change with breathing (fixed splitting).', 'Eine weite Spaltung des S2, die sich mit der Atmung nicht ändert (fixierte Spaltung).'),
        t('Atrial septal defect; a wide but varying split in right bundle branch block.', 'Vorhofseptumdefekt; eine weite, aber atemvariable Spaltung beim Rechtsschenkelblock.'),
        ['heart.sounds']),
    ],
    { aliases: l(['2nd left ICS'], ['2. ICR links']) }),

  'auscultate.heart.erb': heartSite(t('Erb’s point, 3rd left intercostal space at the sternal edge', 'Erb-Punkt, 3. ICR links parasternal'),
    t('a point where murmurs of all valves can be heard; the early diastolic murmur of aortic regurgitation is often loudest here.',
      'ein Punkt, an dem Geräusche aller Klappen zu hören sind; das frühdiastolische Geräusch der Aorteninsuffizienz ist hier oft am lautesten.'),
    [
      f(t('A soft, high-pitched early diastolic murmur, decrescendo.', 'Ein leises, hochfrequentes, decrescendoförmiges frühdiastolisches Geräusch.'),
        t('Aortic regurgitation: listen again sitting forward in held expiration.', 'Aorteninsuffizienz: erneut im Sitzen vorgebeugt in Exspiration hören.'),
        ['heart.sounds'], ['aortic-regurgitation']),
      f(t('An ejection systolic murmur that gets louder on standing or straining.', 'Ein Systolikum, das im Stehen oder beim Pressen lauter wird.'),
        t('Hypertrophic obstructive cardiomyopathy: less filling, more obstruction.', 'Hypertrophe obstruktive Kardiomyopathie: weniger Füllung, mehr Obstruktion.'),
        ['heart.sounds'], ['hcm']),
    ],
    { aliases: l(['3rd left ICS', 'left sternal edge'], ['3. ICR links', 'Punctum quintum']) }),

  'auscultate.heart.tricuspid': heartSite(t('Tricuspid area, 4th–5th left intercostal space at the lower sternal edge', 'Trikuspidalareal, 4.–5. ICR links am unteren Sternalrand'),
    t('murmurs of the tricuspid valve and a pericardial friction rub.', 'Geräusche der Trikuspidalklappe und ein Perikardreiben.'),
    [
      f(t('A pansystolic murmur that gets louder on inspiration.', 'Ein holosystolisches Geräusch, das bei Einatmung lauter wird (Carvallo-Zeichen).'),
        t('Tricuspid regurgitation: inspiration increases venous return to the right heart. Look for large v waves in the JVP.',
          'Trikuspidalinsuffizienz: die Einatmung steigert den venösen Rückstrom zum rechten Herzen. Auf große v-Wellen im Venenpuls achten.'),
        ['heart.sounds'], ['pulmonary-embolism']),
      f(t('A scratchy, superficial sound with up to three components, varying with position.', 'Ein kratzendes, oberflächliches Geräusch mit bis zu drei Komponenten, lageabhängig.'),
        t('Pericardial friction rub: pericarditis.', 'Perikardreiben: Perikarditis.'),
        ['heart.sounds'], ['pericarditis']),
    ],
    { aliases: l(['lower left sternal edge'], ['unterer linker Sternalrand']) }),

  'auscultate.heart.mitral': heartSite(t('Mitral area, at the apex', 'Mitralareal, an der Herzspitze'),
    t('S1, the mitral valve, and the third and fourth heart sounds of the left ventricle.', 'den S1, die Mitralklappe sowie den 3. und 4. Herzton des linken Ventrikels.'),
    [
      f(t('A pansystolic murmur radiating to the axilla.', 'Ein holosystolisches Geräusch mit Fortleitung in die Axilla.'),
        t('Mitral regurgitation.', 'Mitralinsuffizienz.'), ['heart.sounds'], ['mitral-regurgitation']),
      f(t('A third heart sound (gallop) early in diastole.', 'Ein 3. Herzton (Galopp) früh in der Diastole.'),
        t('Rapid filling of a dilated, failing ventricle; normal in the young and in pregnancy.', 'Rasche Füllung eines dilatierten, versagenden Ventrikels; normal bei jungen Menschen und in der Schwangerschaft.'),
        ['heart.sounds'], ['acute-heart-failure']),
      f(t('A fourth heart sound just before S1.', 'Ein 4. Herzton kurz vor S1.'),
        t('The atrium pushes blood into a stiff, hypertrophied ventricle.', 'Der Vorhof presst Blut in einen steifen, hypertrophen Ventrikel.'),
        ['heart.sounds'], ['aortic-stenosis', 'hcm']),
    ],
    { aliases: l(['apex'], ['Herzspitze', '5. ICR medioklavikulär']) }),

  'auscultate.heart.apex-bell-left-lateral': {
    aliases: l(['left lateral position'], ['Linksseitenlage']),
    assesses: t('Low-pitched sounds from the left ventricle and mitral inflow, brought nearer to the chest wall by turning the patient to the left.',
      'Tieffrequente Töne aus dem linken Ventrikel und dem Mitraleinstrom, die durch Linksdrehung näher an die Brustwand kommen.'),
    how: l([
      'Roll the patient a quarter turn onto the left side.',
      'Find the apex and lay the bell on it lightly (pressing turns the bell into a diaphragm).',
      'Listen in diastole, with the breath held in expiration.',
    ], [
      'Den Patienten eine Vierteldrehung auf die linke Seite rollen.',
      'Den Spitzenstoß suchen und den Trichter leicht aufsetzen (Andrücken macht aus dem Trichter eine Membran).',
      'In der Diastole hören, Atem in Exspiration angehalten.',
    ]),
    normal: t('No sound in diastole.', 'Kein Geräusch in der Diastole.'),
    abnormal: [
      f(t('A low-pitched, rumbling mid-diastolic murmur, often after an opening snap.', 'Ein tieffrequentes, rumpelndes mesodiastolisches Geräusch, oft nach einem Mitralöffnungston.'),
        t('Mitral stenosis; a similar rumble in severe aortic regurgitation (Austin Flint murmur).', 'Mitralstenose; ein ähnliches Rumpeln bei schwerer Aorteninsuffizienz (Austin-Flint-Geräusch).'),
        ['heart.sounds'], ['aortic-regurgitation']),
      f(t('A third or fourth heart sound.', 'Ein 3. oder 4. Herzton.'),
        t('A failing (S3) or stiff (S4) left ventricle; both are low-pitched and heard best this way.', 'Ein versagender (S3) oder steifer (S4) linker Ventrikel; beide sind tieffrequent und so am besten zu hören.'),
        ['heart.sounds'], ['acute-heart-failure', 'aortic-stenosis']),
    ],
  },

  'auscultate.heart.lse-sitting-forward': {
    aliases: l(['sitting forward in expiration'], ['vorgebeugt in Exspiration']),
    assesses: t('Sounds from the base of the heart, brought nearer to the chest wall by sitting forward with the lungs emptied.',
      'Töne von der Herzbasis, die im Vorbeugen mit entleerter Lunge näher an die Brustwand kommen.'),
    how: l([
      'Sit the patient up and ask them to lean forward.',
      'Ask them to breathe out fully and hold.',
      'Listen with the diaphragm at the left sternal edge (3rd–4th space) for the early diastole.',
    ], [
      'Den Patienten aufsetzen und nach vorne beugen lassen.',
      'Ganz ausatmen und die Luft anhalten lassen.',
      'Mit der Membran am linken Sternalrand (3.–4. ICR) auf die frühe Diastole achten.',
    ]),
    normal: t('Silence in diastole.', 'Stille in der Diastole.'),
    abnormal: [
      f(t('A soft, blowing, high-pitched early diastolic murmur.', 'Ein leises, gießendes, hochfrequentes frühdiastolisches Geräusch.'),
        t('Aortic regurgitation; often missed unless listened for in this position.', 'Aorteninsuffizienz; oft überhört, wenn nicht in dieser Haltung gesucht.'),
        ['heart.sounds'], ['aortic-regurgitation']),
      f(t('A scratchy rub.', 'Ein kratzendes Reiben.'), t('Pericarditis; the rub is louder sitting forward.', 'Perikarditis; das Reiben ist vorgebeugt lauter.'), ['heart.sounds'], ['pericarditis']),
    ],
  },

  'auscultate.carotid': {
    aliases: l(['carotid auscultation'], ['Strömungsgeräusch der Karotis']),
    assesses: t('Turbulent flow in the carotid artery: a stenosis, or a murmur conducted up from the aortic valve.',
      'Turbulente Strömung in der A. carotis: eine Stenose oder ein von der Aortenklappe fortgeleitetes Geräusch.'),
    how: l([
      'Ask the patient to hold the breath.',
      'Listen with the bell along the carotid, from the angle of the jaw down to the base of the neck, each side in turn.',
    ], [
      'Den Patienten die Luft anhalten lassen.',
      'Mit dem Trichter entlang der Karotis hören, vom Kieferwinkel bis zur Halsbasis, beide Seiten nacheinander.',
    ]),
    normal: t('No bruit.', 'Kein Strömungsgeräusch.'),
    abnormal: [
      f(t('A bruit loudest high in the neck.', 'Ein Strömungsgeräusch, hoch am Hals am lautesten.'),
        t('Carotid stenosis at the bifurcation: a source of emboli to the brain and eye.', 'Karotisstenose an der Bifurkation: eine Emboliequelle für Gehirn und Auge.'),
        ['heart.sounds'], ['tia', 'ischaemic-stroke-left-mca']),
      f(t('A murmur loudest at the base of the neck and louder still over the aortic area.', 'Ein Geräusch, an der Halsbasis am lautesten und über dem Aortenareal noch lauter.'),
        t('The murmur of aortic stenosis, conducted.', 'Das fortgeleitete Geräusch einer Aortenstenose.'), ['heart.sounds'], ['aortic-stenosis']),
    ],
    pitfalls: l(['A very tight stenosis can be silent; a bruit neither proves nor excludes significant stenosis. Ultrasound decides.'],
      ['Eine sehr enge Stenose kann stumm sein; ein Geräusch beweist eine relevante Stenose weder, noch schließt sein Fehlen sie aus. Der Ultraschall entscheidet.']),
  },

  'inspect.legs': {
    aliases: l(['ankle oedema', 'pitting oedema', 'sacral oedema'], ['Knöchelödeme', 'Beinödeme', 'Dellenbildung']),
    assesses: t('Excess interstitial fluid. Water leaves the capillaries when venous pressure rises or plasma oncotic pressure falls, and gathers where gravity takes it.',
      'Vermehrte interstitielle Flüssigkeit. Wasser verlässt die Kapillaren, wenn der Venendruck steigt oder der onkotische Druck fällt, und sammelt sich, wo die Schwerkraft es hinführt.'),
    how: l([
      'Look at both legs for swelling, colour and asymmetry.',
      'Press firmly with the thumb over the shin or behind the medial malleolus for 10 seconds; look and feel for a dent.',
      'Follow it upwards (ankle, shin, knee, thigh); in a patient in bed, press over the sacrum.',
    ], [
      'Beide Beine auf Schwellung, Farbe und Seitendifferenz ansehen.',
      'Mit dem Daumen 10 Sekunden fest über dem Schienbein oder hinter dem Innenknöchel drücken; auf eine Delle schauen und tasten.',
      'Nach oben verfolgen (Knöchel, Unterschenkel, Knie, Oberschenkel); beim bettlägerigen Patienten über dem Kreuzbein drücken.',
    ]),
    normal: t('No pitting.', 'Keine Dellenbildung.'),
    abnormal: [
      f(t('Bilateral pitting oedema.', 'Beidseitige eindrückbare Ödeme.'),
        t('Raised venous pressure (heart failure, fluid overload in kidney failure), low albumin (cirrhosis, nephrotic syndrome, malnutrition), or drugs (calcium-channel blockers).',
          'Erhöhter Venendruck (Herzinsuffizienz, Überwässerung bei Niereninsuffizienz), niedriges Albumin (Zirrhose, nephrotisches Syndrom, Mangelernährung) oder Medikamente (Kalziumkanalblocker).'),
        ['legs.oedema'], ['acute-heart-failure', 'decompensated-cirrhosis', 'chronic-kidney-disease', 'acute-kidney-injury']),
      f(t('One swollen, warm, tender calf.', 'Eine geschwollene, warme, druckschmerzhafte Wade.'),
        t('Deep vein thrombosis, the usual source of pulmonary emboli.', 'Tiefe Beinvenenthrombose, die übliche Quelle von Lungenembolien.'), ['legs.oedema'], ['pulmonary-embolism']),
      f(t('Non-pitting swelling.', 'Nicht eindrückbare Schwellung.'),
        t('Lymphoedema, or myxoedema in hypothyroidism.', 'Lymphödem oder Myxödem bei Hypothyreose.'), ['legs.oedema'], ['hypothyroidism']),
    ],
  },
};

