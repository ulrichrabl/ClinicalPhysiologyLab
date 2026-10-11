import type { MeasurementSpec } from '../model/types.ts';
import type { LocalizedText } from '../model/i18n.ts';

/* ===========================================================================
   What each examination and test measures, and how.

   This is the bridge between the two worlds: a finding is not physiology,
   it is a measurement *of* physiology, taken through an instrument that has
   physics, limits and artefacts of its own. `measures` names the model
   variables the measurement reads; `physics` explains how the reading comes
   about. The physiology chapters list these as "observed through"; the
   result screens link back to the chapter.
=========================================================================== */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const M = (measures: string[], en: string, de: string): MeasurementSpec => ({ measures, physics: L(en, de) });

const LESIONS = 'nervous-system.lesions';

export const MEASUREMENTS: Record<string, MeasurementSpec> = {
  'general.appearance': M(['haemodynamics.MAP', 'baroreflex.sigmaS'],
    'The first look. Pallor and sweating are sympathetic outflow made visible: skin vessels constrict and sweat glands fire when the brainstem defends the blood pressure, or when nausea drives the same autonomic output.',
    'Der erste Blick. Blässe und Schwitzen sind sichtbarer Sympathikus: Hautgefäße verengen sich und Schweißdrüsen feuern, wenn der Hirnstamm den Blutdruck verteidigt — oder wenn Übelkeit denselben autonomen Ausstrom auslöst.'),

  /* ---- vital signs ------------------------------------------------------------------- */
  'vitals.hr': M(['haemodynamics.HR', 'baroreflex.HR'],
    'Counted from the pulse or the monitor. A palpated rate counts only beats strong enough to reach the wrist: in atrial fibrillation short cycles produce a pulse deficit, and the apex rate is higher than the radial rate.',
    'Gezählt am Puls oder am Monitor. Getastet zählen nur Schläge, die kräftig genug bis zum Handgelenk kommen: Bei Vorhofflimmern erzeugen kurze Zyklen ein Pulsdefizit, und die Herzspitzenfrequenz liegt über der Radialisfrequenz.'),
  'vitals.bp': M(['haemodynamics.Psys', 'haemodynamics.Pdia', 'haemodynamics.MAP'],
    'Oscillometric cuff: the cuff deflates while a sensor records the small pressure oscillations the artery transmits. Oscillations are largest at mean pressure, which is what the device actually measures; systolic and diastolic are then estimated by manufacturer-specific ratios. Auscultation instead listens for Korotkoff sounds as flow restarts. A cuff too small for the arm reads high.',
    'Oszillometrische Manschette: Während die Manschette entlüftet, zeichnet ein Sensor die kleinen Druckschwankungen der Arterie auf. Die Schwankungen sind beim Mitteldruck am größten — das misst das Gerät eigentlich; systolischer und diastolischer Wert werden über herstellerspezifische Quotienten geschätzt. Auskultatorisch hört man die Korotkow-Geräusche, wenn der Fluss wieder einsetzt. Eine zu kleine Manschette misst zu hoch.'),
  'pulse.radial': M(['haemodynamics.Pao', 'haemodynamics.Psys', 'haemodynamics.Pdia'],
    'The fingertip feels the pressure wave, not flow. What it detects is the pulse pressure and the rate of rise; peripheral arteries amplify the systolic peak, so the radial pulse is sharper than the central one and less informative about valve disease.',
    'Die Fingerkuppe fühlt die Druckwelle, nicht den Fluss. Sie erfasst Pulsdruck und Anstiegssteilheit; periphere Arterien verstärken den systolischen Gipfel, daher ist der Radialispuls spitzer als der zentrale und über Klappenfehler weniger aussagekräftig.'),
  'pulse.carotid': M(['haemodynamics.Pao', 'haemodynamics.Qao', 'haemodynamics.gradient'],
    'Close to the aortic valve, the carotid keeps the shape of the ejection: a stenosis that limits flow makes the upstroke slow and the peak late and small (pulsus parvus et tardus).',
    'Nahe der Aortenklappe behält die Karotis die Form der Austreibung: Eine Stenose, die den Fluss begrenzt, macht den Anstieg langsam und den Gipfel spät und klein (Pulsus parvus et tardus).'),
  'jvp': M(['haemodynamics.CVP'],
    'The internal jugular vein is a manometer open to the right atrium: the height of the column above the sternal angle, plus about 5 cm to the atrium, is right atrial pressure in cm of blood (1 mmHg ≈ 1.36 cmH₂O).',
    'Die V. jugularis interna ist ein zum rechten Vorhof offenes Manometer: Die Höhe der Säule über dem Angulus sterni plus etwa 5 cm bis zum Vorhof ist der rechtsatriale Druck in cm Blutsäule (1 mmHg ≈ 1,36 cmH₂O).'),
  'apex': M(['haemodynamics.EDV', 'haemodynamics.PvPeak'],
    'The apex lifts the chest wall during isovolumetric contraction. A large ventricle displaces it laterally; a pressure-loaded one makes it sustained and heaving.',
    'Die Herzspitze hebt die Brustwand während der isovolumetrischen Kontraktion. Ein großer Ventrikel verlagert sie nach lateral; ein druckbelasteter macht sie anhaltend und hebend.'),
  'heart.sounds': M(['haemodynamics.Qao', 'haemodynamics.gradient', 'haemodynamics.regurgFraction', 'haemodynamics.Plv', 'haemodynamics.Pao'],
    'The stethoscope hears vibration, not flow. Valve closure decelerates columns of blood (S1, S2); turbulence where flow is fast through a narrow orifice makes a murmur whose loudness follows velocity, which follows the pressure gradient (v ≈ √(ΔP/4), the simplified Bernoulli equation). Where you listen decides which valve you hear best.',
    'Das Stethoskop hört Schwingung, nicht Fluss. Klappenschluss bremst Blutsäulen ab (S1, S2); Turbulenz bei schnellem Fluss durch eine enge Öffnung erzeugt ein Geräusch, dessen Lautstärke der Geschwindigkeit folgt, die dem Druckgradienten folgt (v ≈ √(ΔP/4), vereinfachte Bernoulli-Gleichung). Wo man auskultiert, entscheidet, welche Klappe man am besten hört.'),
  'lung.sounds': M(['haemodynamics.Pla'],
    'Breath sounds are turbulence in large airways filtered by lung tissue. When left atrial pressure exceeds about 18–20 mmHg, fluid enters the interstitium and alveoli, and small airways snap open on inspiration: fine crackles at the bases.',
    'Atemgeräusche sind Turbulenz in großen Atemwegen, gefiltert durch das Lungengewebe. Übersteigt der linksatriale Druck etwa 18–20 mmHg, tritt Flüssigkeit ins Interstitium und in die Alveolen, und kleine Atemwege öffnen sich inspiratorisch schnappend: feine Rasselgeräusche basal.'),
  'hands.crt': M(['haemodynamics.MAP', 'haemodynamics.RsysEff'],
    'Blanch the nail bed and time the return of colour: skin flow, which sympathetic vasoconstriction cuts first. Cold skin and ambient temperature prolong it without shock.',
    'Nagelbett abblassen und Zeit bis zur Wiederfärbung messen: Hautdurchblutung, die sympathische Vasokonstriktion zuerst drosselt. Kalte Haut und Umgebungstemperatur verlängern sie auch ohne Schock.'),
  'legs.oedema': M(['haemodynamics.CVP', 'fluids.albumin'],
    'Pitting is interstitial fluid displaced by the thumb. Starling: filtration rises with capillary (venous) pressure and falls with plasma oncotic pressure; it takes days of raised venous pressure to show.',
    'Eindrückbare Ödeme sind interstitielle Flüssigkeit, die der Daumen verdrängt. Starling: Die Filtration steigt mit dem Kapillar-(Venen-)druck und fällt mit dem onkotischen Druck des Plasmas; es braucht Tage erhöhten Venendrucks, bis sie sichtbar wird.'),

  /* ---- eyes ------------------------------------------------------------------------------ */
  'eye.pupil': M(['pupil.dL', 'pupil.dR', 'pupil.D'],
    'Look at both pupils in room light and in the dark, then light each eye. Anisocoria larger in the dark points to the small pupil (sympathetic); larger in the light points to the big one (parasympathetic).',
    'Beide Pupillen bei Raumlicht und im Dunkeln ansehen, dann jedes Auge belichten. Eine im Dunkeln größere Anisokorie weist auf die enge Pupille (Sympathikus); eine im Hellen größere auf die weite (Parasympathikus).'),
  'eyes.swinging-light': M(['pupil.aL', 'pupil.aR'],
    'Swing the light from eye to eye every two seconds. Both pupils follow whichever eye is lit; if one optic nerve carries less signal, both pupils dilate when the light reaches it.',
    'Licht alle zwei Sekunden von Auge zu Auge schwenken. Beide Pupillen folgen dem jeweils belichteten Auge; leitet ein Sehnerv weniger, erweitern sich beide Pupillen, sobald das Licht dieses Auge erreicht.'),
  'eye.lid': M([LESIONS, 'pupil.sL', 'pupil.sR'],
    'Lid height relative to the pupil: levator (oculomotor) and Müller’s muscle (sympathetic, about 2 mm).',
    'Lidstellung relativ zur Pupille: M. levator (N. oculomotorius) und Müller-Muskel (sympathisch, etwa 2 mm).'),
  'eye.motility': M([LESIONS],
    'Follow a target through the six cardinal positions; each tests the muscle that is the prime mover in that direction.',
    'Ein Ziel durch die sechs Hauptblickrichtungen folgen lassen; jede prüft den Muskel, der in dieser Richtung Hauptbeweger ist.'),
  'eyes.alignment': M([LESIONS],
    'Cover each eye in turn and watch the other move to take up fixation: a manifest deviation. Alternate cover reveals latent ones.',
    'Jedes Auge abwechselnd abdecken und beobachten, ob das andere zur Fixation einstellt: manifestes Schielen. Der alternierende Abdecktest deckt latente Abweichungen auf.'),
  'eyes.nystagmus': M(['vor.spv', 'vor.tau', 'vor.rfix'],
    'You see the quick phases, but the slow phase is the signal. Fixation suppresses peripheral nystagmus, so look with Frenzel lenses or in the dark; observe in primary and eccentric gaze to test Alexander’s law and gaze holding.',
    'Man sieht die schnellen Phasen, aber die langsame Phase ist das Signal. Fixation unterdrückt peripheren Nystagmus, daher mit Frenzel-Brille oder im Dunkeln beobachten; in Primär- und exzentrischer Blickposition, um Alexander-Gesetz und Blickhalten zu prüfen.'),
  'eye.head-impulse': M(['vor.gainL', 'vor.gainR'],
    'A small, fast, unpredictable head turn while the patient fixes your nose. With a normal VOR the eyes stay on target; with low gain they are carried off and a corrective saccade follows. Slow turns test pursuit instead and hide the deficit.',
    'Kleine, schnelle, unvorhersehbare Kopfdrehung, während der Patient Ihre Nase fixiert. Bei normalem VOR bleiben die Augen am Ziel; bei niedriger Verstärkung werden sie mitgenommen und eine Korrektursakkade folgt. Langsame Drehungen prüfen stattdessen die Blickfolge und verbergen das Defizit.'),
  'eyes.pursuit': M(['vor.tau', LESIONS], 'Follow a slowly moving target; cerebellar and brainstem pathways keep the eye on it. Breakdown into catch-up saccades is non-specific (age, sedation).',
    'Einem langsam bewegten Ziel folgen; Kleinhirn- und Hirnstammbahnen halten das Auge darauf. Sakkadierung ist unspezifisch (Alter, Sedierung).'),
  'eye.field': M([LESIONS], 'Confrontation compares the patient’s field with yours, quadrant by quadrant; it finds dense defects and misses subtle ones.',
    'Fingerperimetrie vergleicht das Gesichtsfeld des Patienten mit dem eigenen, Quadrant für Quadrant; sie findet dichte Ausfälle und übersieht feine.'),

  /* ---- ears, balance --------------------------------------------------------------------------- */
  'ear.whisper': M([LESIONS], 'A whisper at arm’s length while masking the other ear: a crude screen for a loss over about 30 dB.', 'Flüstern auf Armlänge bei Vertäubung des anderen Ohrs: grobes Screening für einen Hörverlust über etwa 30 dB.'),
  'ear.rinne': M([LESIONS], 'Air conduction normally beats bone conduction. Conductive loss reverses it; sensorineural loss does not.', 'Luftleitung ist normal besser als Knochenleitung. Schallleitungsstörung kehrt das um; Schallempfindungsstörung nicht.'),
  'head.weber': M([LESIONS], 'A fork on the vertex lateralises toward a conductive loss and away from a sensorineural one.', 'Eine Stimmgabel auf dem Scheitel lateralisiert zur Schallleitungsstörung und weg von einer Schallempfindungsstörung.'),
  'posture.romberg': M(['vor.spv', LESIONS], 'Stance with feet together, eyes open then closed. Closing the eyes removes vision; if the patient now falls, joint position sense (or labyrinth) was what was missing.',
    'Stand mit geschlossenen Füßen, Augen offen, dann geschlossen. Augenschluss nimmt das Sehen weg; fällt der Patient jetzt, fehlte der Lagesinn (oder das Labyrinth).'),
  'gait.pattern': M(['vor.spv', LESIONS], 'Walking integrates power, tone, sensation, cerebellum and labyrinth; the pattern localises.', 'Gehen integriert Kraft, Tonus, Sensibilität, Kleinhirn und Labyrinth; das Muster lokalisiert.'),

  /* ---- cranial nerves, speech ------------------------------------------------------------------------ */
  'face.movement': M([LESIONS], 'Upper face is represented bilaterally in cortex, lower face contralaterally: an upper motor neuron lesion spares the forehead, a facial nerve lesion does not.',
    'Die obere Gesichtshälfte ist kortikal beidseitig repräsentiert, die untere kontralateral: Eine zentrale Läsion spart die Stirn aus, eine periphere Fazialisläsion nicht.'),
  'face.sensation': M([LESIONS], 'Light touch and pinprick in the three trigeminal divisions; the corneal reflex tests V₁ afferent and VII efferent together.',
    'Berührung und Schmerz in den drei Trigeminusästen; der Kornealreflex prüft V₁-Afferenz und VII-Efferenz zusammen.'),
  'jaw.opening': M([LESIONS], 'The pterygoids push the jaw toward the weak side on opening.', 'Die Pterygoidei schieben den Kiefer beim Öffnen zur schwachen Seite.'),
  'mouth.palate': M([LESIONS], 'The uvula is pulled toward the strong side when the patient says “ah”.', 'Die Uvula wird beim „Ah“ zur gesunden Seite gezogen.'),
  'mouth.tongue': M([LESIONS], 'Each genioglossus pushes the tongue forward and across: a weak side lets the tongue deviate toward it.', 'Jeder M. genioglossus schiebt die Zunge nach vorn und zur Gegenseite: Die Zunge weicht zur schwachen Seite ab.'),
  'shoulder.shrug': M([LESIONS], 'Trapezius and sternocleidomastoid (accessory nerve). The SCM turns the head away from itself.', 'M. trapezius und M. sternocleidomastoideus (N. accessorius). Der SCM dreht den Kopf zur Gegenseite.'),
  'speech.language': M([LESIONS], 'Listen to spontaneous speech, then test naming, repetition and comprehension: the pattern separates aphasia types and dysarthria.', 'Spontansprache anhören, dann Benennen, Nachsprechen und Verstehen prüfen: Das Muster trennt Aphasieformen und Dysarthrie.'),
  'speech.fatigue': M([LESIONS], 'Counting aloud loads the bulbar muscles repeatedly; fatigable transmission makes the voice fade.', 'Lautes Zählen belastet die bulbären Muskeln wiederholt; ermüdbare Übertragung lässt die Stimme schwinden.'),

  /* ---- limbs ----------------------------------------------------------------------------------------- */
  'arm.tone': M([LESIONS], 'Passive movement at varying speed. Spasticity is velocity-dependent (a catch); rigidity is not.', 'Passive Bewegung mit wechselnder Geschwindigkeit. Spastik ist geschwindigkeitsabhängig (Taschenmesser); Rigor nicht.'),
  'leg.tone': M([LESIONS], 'Roll the leg, then lift the knee briskly: a spastic leg lifts the heel off the bed.', 'Bein rollen, dann das Knie rasch anheben: Ein spastisches Bein hebt die Ferse von der Unterlage.'),
  'arm.power': M([LESIONS], 'The MRC scale grades power against gravity and resistance. Pattern matters more than grade: pyramidal weakness favours extensors in the arm.',
    'Die MRC-Skala bewertet Kraft gegen Schwerkraft und Widerstand. Das Muster zählt mehr als der Grad: Pyramidale Schwäche betont im Arm die Strecker.'),
  'leg.power': M([LESIONS], 'Pyramidal weakness favours flexors in the leg; a root or nerve lesion follows its myotome or its territory.', 'Pyramidale Schwäche betont im Bein die Beuger; eine Wurzel- oder Nervenläsion folgt ihrem Myotom oder Versorgungsgebiet.'),
  'arm.reflexes': M([LESIONS], 'A tap stretches the muscle spindle; the monosynaptic arc returns through the same segment. Brisk with an upper motor neuron lesion, lost when the arc itself is cut.',
    'Ein Schlag dehnt die Muskelspindel; der monosynaptische Bogen kehrt über dasselbe Segment zurück. Gesteigert bei zentraler Läsion, erloschen, wenn der Bogen selbst unterbrochen ist.'),
  'leg.reflexes': M([LESIONS], 'Knee L3–4, ankle S1. The plantar response is a cutaneous reflex: extensor (Babinski) means the corticospinal tract is interrupted.',
    'Patellarsehne L3–4, Achillessehne S1. Die Plantarantwort ist ein Fremdreflex: Extension (Babinski) bedeutet eine unterbrochene Pyramidenbahn.'),
  'arm.pinprick': M([LESIONS], 'A sharp pin tests the spinothalamic tract; map the border to tell dermatome from nerve territory.', 'Eine spitze Nadel prüft den Tractus spinothalamicus; die Grenze kartieren, um Dermatom und Nervengebiet zu unterscheiden.'),
  'leg.pinprick': M([LESIONS], 'L5 covers the dorsum of the foot and the big toe; the common peroneal nerve covers most of the same skin but not the sole.', 'L5 versorgt Fußrücken und Großzehe; der N. peroneus communis fast dieselbe Haut, aber nicht die Sohle.'),
  'arm.vibration': M([LESIONS], 'A 128 Hz fork tests the dorsal columns, which also carry joint position sense.', 'Eine 128-Hz-Stimmgabel prüft die Hinterstränge, die auch den Lagesinn leiten.'),
  'leg.vibration': M([LESIONS], 'Start distally at the big toe; length-dependent neuropathy loses it first there.', 'Distal an der Großzehe beginnen; längenabhängige Neuropathie verliert sie dort zuerst.'),
  'arm.drift': M([LESIONS], 'Arms out, palms up, eyes closed: subtle pyramidal weakness lets the arm pronate and sink.', 'Arme vor, Handflächen nach oben, Augen zu: Leichte pyramidale Schwäche lässt den Arm pronieren und absinken.'),
  'trunk.pinprick': M([LESIONS], 'A sensory level on the trunk localises a cord lesion: T4 at the nipples, T10 at the umbilicus.', 'Ein sensibles Niveau am Rumpf lokalisiert eine Rückenmarksläsion: Th4 an den Mamillen, Th10 am Nabel.'),
  'saddle.sensation': M([LESIONS], 'S2–S5: spared or lost, it separates conus and cauda equina lesions from those above.', 'S2–S5: Erhalten oder verloren trennt es Konus- und Kaudaläsionen von höheren.'),
  'leg.heel-shin': M([LESIONS, 'vor.tau'], 'Ataxia without weakness points to the ipsilateral cerebellum or its pathways.', 'Ataxie ohne Parese weist auf das ipsilaterale Kleinhirn oder seine Bahnen.'),
  'arm.rapid-alternating': M([LESIONS], 'Dysdiadochokinesis: the timing of alternating agonists breaks down with cerebellar disease.', 'Dysdiadochokinese: Das Timing alternierender Agonisten zerfällt bei Kleinhirnerkrankung.'),
  'arm.finger-nose': M([LESIONS], 'Intention tremor grows as the finger nears the target.', 'Intentionstremor nimmt zu, je näher der Finger dem Ziel kommt.'),

  /* ---- investigations ------------------------------------------------------------------------------- */
  'echo': M(['haemodynamics.EDV', 'haemodynamics.ESV', 'haemodynamics.EF', 'haemodynamics.gradient', 'haemodynamics.regurgFraction'],
    'Ultrasound reflected from tissue boundaries draws the chambers; volumes are estimated from two planes (Simpson). Doppler shift of red cells gives velocity, and the simplified Bernoulli equation ΔP = 4v² turns peak velocity into the gradient. Off-axis beams underestimate velocity.',
    'An Gewebegrenzen reflektierter Ultraschall zeichnet die Kammern; Volumina werden aus zwei Ebenen geschätzt (Simpson). Die Dopplerverschiebung der Erythrozyten liefert die Geschwindigkeit, und die vereinfachte Bernoulli-Gleichung ΔP = 4v² macht aus der Spitzengeschwindigkeit den Gradienten. Schräg einfallende Schallstrahlen unterschätzen die Geschwindigkeit.'),
  'ecg-12': M(['electrical.rate', 'electrical.PR', 'electrical.QRS', 'electrical.QT', 'electrical.axis', 'electrical.EK'],
    'Each lead is a voltmeter between skin electrodes, and it records the projection of the heart’s summed activation vector onto its own axis: a wavefront moving toward the positive electrode writes upward. Limb leads view the frontal plane, chest leads the horizontal one — so electrode position changes the tracing, and a misplaced V1–V2 can fake disease.',
    'Jede Ableitung ist ein Voltmeter zwischen Hautelektroden und zeichnet die Projektion des summierten Erregungsvektors des Herzens auf ihre eigene Achse auf: Eine Front, die auf die positive Elektrode zuläuft, schreibt nach oben. Extremitätenableitungen sehen die Frontalebene, Brustwandableitungen die Horizontalebene — die Elektrodenposition verändert also die Kurve, und falsch platzierte V1–V2 können Krankheit vortäuschen.'),
  'electrolytes': M(['fluids.sodium', 'fluids.potassium', 'fluids.chloride', 'fluids.bicarbonate', 'fluids.urea', 'fluids.creatinine'],
    'Ion-selective electrodes measure ion activity in plasma water. Indirect analysers dilute the sample first and read falsely low sodium when lipids or protein take up volume (pseudohyponatraemia). Haemolysis releases intracellular potassium and raises it falsely; so does a delay before centrifuging.',
    'Ionenselektive Elektroden messen die Ionenaktivität im Plasmawasser. Indirekte Analysatoren verdünnen die Probe zuerst und messen bei viel Lipid oder Protein falsch niedriges Natrium (Pseudohyponatriämie). Hämolyse setzt intrazelluläres Kalium frei und erhöht es falsch; ebenso eine verzögerte Zentrifugation.'),
  'blood-gas': M(['fluids.pH', 'fluids.paCO2', 'fluids.paO2', 'fluids.bicarbonate', 'fluids.lactate'],
    'pH and PCO₂ are measured by electrodes; PO₂ by a Clark electrode; bicarbonate is not measured but calculated from pH and PCO₂ by Henderson–Hasselbalch. Air bubbles in the syringe pull PO₂ toward 20 kPa and PCO₂ down; a venous sample looks like hypoxaemia.',
    'pH und PCO₂ werden mit Elektroden gemessen, PO₂ mit einer Clark-Elektrode; Bikarbonat wird nicht gemessen, sondern über Henderson-Hasselbalch aus pH und PCO₂ berechnet. Luftblasen in der Spritze ziehen den PO₂ Richtung 20 kPa und senken den PCO₂; eine venöse Probe sieht aus wie eine Hypoxämie.'),
  'fbc': M(['fluids.haemoglobin', 'fluids.whiteCellCount', 'fluids.platelets', 'fluids.mcv'],
    'Cells are counted as they pass an aperture (impedance) or a laser (scatter); haemoglobin is measured photometrically after lysis. Haemoglobin is a concentration: in acute bleeding it is normal until fluid shifts or infusions dilute it.',
    'Zellen werden beim Durchtritt durch eine Öffnung (Impedanz) oder einen Laser (Streulicht) gezählt; Hämoglobin wird nach Lyse photometrisch bestimmt. Hämoglobin ist eine Konzentration: Bei akuter Blutung bleibt es normal, bis Flüssigkeitsverschiebung oder Infusionen es verdünnen.'),
  'cardiac-markers': M(['fluids.troponin', 'fluids.bnp'],
    'Immunoassays. Troponin rises over hours after myocyte injury, so a single early value can be normal; BNP is released by stretched ventricular wall and tracks filling pressure, lower in obesity, higher in renal failure.',
    'Immunoassays. Troponin steigt über Stunden nach Myozytenschaden, ein einzelner früher Wert kann also normal sein; BNP wird von gedehnter Ventrikelwand freigesetzt und folgt dem Füllungsdruck, niedriger bei Adipositas, höher bei Niereninsuffizienz.'),
  'glucose': M(['fluids.glucose'],
    'Glucose oxidase or dehydrogenase on a strip turns glucose into a current. Capillary blood after sugary fingers, or a strip at the edge of its range, misleads; confirm extremes in the lab.',
    'Glukoseoxidase oder -dehydrogenase auf dem Teststreifen macht aus Glukose einen Strom. Kapillarblut nach süßen Fingern oder ein Streifen am Rand seines Messbereichs führen in die Irre; Extremwerte im Labor bestätigen.'),
};
