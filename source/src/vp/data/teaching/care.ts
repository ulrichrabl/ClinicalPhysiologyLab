import type { TeachingCard, TeachingFinding } from '../../model/types.ts';
import type { LocalizedText } from '../../model/i18n.ts';
import { f, l, t } from './helpers.ts';

/* Position, exposure and oxygen: what the examiner does to the patient. Their cards say what each is for and what the
   patient's response to it shows. */

const position = (assesses: LocalizedText, how: [string[], string[]], normal: LocalizedText, abnormal: TeachingFinding[], aliases?: [string[], string[]]): TeachingCard => ({
  ...(aliases ? { aliases: l(...aliases) } : {}), assesses, how: l(...how), normal, abnormal,
});

/* Oxygen devices. Variable-performance devices give an inspired fraction that depends on how the patient breathes;
   Venturi masks entrain room air at a fixed ratio and give a fixed fraction. */
const OXY_HOW = l([
  'Check the saturation and the target first (94–98 %, or 88–92 % if at risk of CO₂ retention).',
  'Fit the device and set the flow; recheck the saturation after about five minutes, and a blood gas if CO₂ retention is possible.',
], [
  'Zuerst Sättigung und Zielbereich festlegen (94–98 %, bei Gefahr einer CO₂-Retention 88–92 %).',
  'Das System anlegen und den Fluss einstellen; nach etwa fünf Minuten die Sättigung kontrollieren, bei möglicher CO₂-Retention eine Blutgasanalyse.',
]);
const OXY_ABNORMAL = [
  f(t('The saturation hardly rises despite a high inspired fraction.', 'Die Sättigung steigt trotz hoher Sauerstofffraktion kaum.'),
    t('Shunt: blood passes lung units that are not ventilated at all (consolidation, collapse, oedema, an intracardiac shunt); more oxygen cannot reach it.',
      'Shunt: Blut fließt an Lungeneinheiten vorbei, die gar nicht belüftet sind (Infiltrat, Atelektase, Ödem, intrakardialer Shunt); mehr Sauerstoff erreicht es nicht.'),
    ['vitals.spo2'], ['community-acquired-pneumonia', 'acute-heart-failure']),
  f(t('The saturation rises easily.', 'Die Sättigung steigt leicht an.'),
    t('Ventilation–perfusion mismatch or hypoventilation, which oxygen corrects (as in COPD and pulmonary embolism).',
      'Ventilations-Perfusions-Missverhältnis oder Hypoventilation, die Sauerstoff ausgleicht (wie bei COPD und Lungenembolie).'),
    ['vitals.spo2'], ['copd-exacerbation', 'pulmonary-embolism']),
  f(t('Drowsy and flushed after high-flow oxygen, in a patient with COPD.', 'Schläfrig und gerötet nach hochdosiertem Sauerstoff bei einem COPD-Patienten.'),
    t('Rising CO₂ (hypercapnic respiratory failure): reduce to the 88–92 % target and get a blood gas.', 'Steigendes CO₂ (hyperkapnisches Atemversagen): auf das Ziel 88–92 % reduzieren und eine Blutgasanalyse machen.'),
    ['vitals.spo2'], ['copd-exacerbation']),
];
const oxygen = (assesses: LocalizedText, normal: LocalizedText, aliases: [string[], string[]]): TeachingCard =>
  ({ aliases: l(...aliases), assesses, how: OXY_HOW, normal, abnormal: OXY_ABNORMAL });

export const CARE: Record<string, TeachingCard> = {
  'position.supine': position(
    t('Lying flat: for the abdomen (relaxed abdominal wall), the legs, and to see whether a patient can lie flat at all.',
      'Flache Rückenlage: für das Abdomen (entspannte Bauchdecke), die Beine und um zu sehen, ob der Patient überhaupt flach liegen kann.'),
    [['Lower the head of the bed and leave one pillow.', 'Watch the breathing as the patient lies back.'], ['Das Kopfteil absenken und ein Kissen lassen.', 'Die Atmung beobachten, während der Patient sich zurücklegt.']],
    t('Lies flat comfortably.', 'Liegt bequem flach.'),
    [f(t('Breathless lying flat, better sitting up (orthopnoea).', 'Atemnot im Liegen, besser im Sitzen (Orthopnoe).'),
      t('Pulmonary venous congestion: blood from the legs shifts into the chest when lying (heart failure); also diaphragm weakness.',
        'Pulmonalvenöse Stauung: im Liegen verlagert sich Blut aus den Beinen in den Thorax (Herzinsuffizienz); auch Zwerchfellschwäche.'),
      ['breathing.pattern'], ['acute-heart-failure'])],
    [['lying flat'], ['Rückenlage'],
    ]),
  'position.reclined-45': position(
    t('Half sitting at 45°: the standard position for the cardiovascular and respiratory examination and for reading the jugular venous pressure.',
      'Halbsitzend bei 45°: die Standardlage für die Herz- und Lungenuntersuchung und zum Ablesen des Jugularvenendrucks.'),
    [['Raise the head of the bed to 45°, the head supported.'], ['Das Kopfteil auf 45° stellen, der Kopf abgestützt.']],
    t('At 45° the top of the JVP lies just above the clavicle in a normal person.', 'Bei 45° liegt das obere Ende der Venenpulsation beim Gesunden knapp über der Klavikula.'),
    [f(t('The JVP is visible at the angle of the jaw at 45°.', 'Der Venenpuls ist bei 45° am Kieferwinkel sichtbar.'),
      t('A very high right atrial pressure.', 'Ein sehr hoher rechtsatrialer Druck.'), ['jvp'], ['acute-heart-failure'])],
    [['semi-recumbent'], ['Oberkörperhochlage']]),
  'position.sitting': position(
    t('Sitting up: to examine the back of the chest, and the posture the breathless patient chooses.',
      'Sitzend: um den Rücken des Thorax zu untersuchen; und die Haltung, die der dyspnoische Patient wählt.'),
    [['Help the patient sit up, the legs over the side or in bed.'], ['Dem Patienten beim Aufsetzen helfen, Beine aus dem Bett oder im Bett.']],
    t('Sits comfortably.', 'Sitzt bequem.'),
    [f(t('Insists on sitting bolt upright, leaning on the arms (tripod).', 'Besteht auf aufrechtem Sitzen, auf die Arme gestützt (Kutschersitz).'),
      t('Severe breathlessness; the arms fix the shoulder girdle for the accessory muscles.', 'Schwere Atemnot; die Arme fixieren den Schultergürtel für die Atemhilfsmuskulatur.'),
      ['breathing.pattern'], ['copd-exacerbation', 'asthma-exacerbation', 'acute-heart-failure'])]),
  'position.sitting-forward': position(
    t('Sitting and leaning forward brings the base of the heart close to the chest wall: for the murmur of aortic regurgitation and a pericardial rub.',
      'Sitzen mit Vorbeugen bringt die Herzbasis an die Brustwand: für das Geräusch der Aorteninsuffizienz und ein Perikardreiben.'),
    [['Sit the patient up and ask them to lean forward; listen in held expiration.'], ['Den Patienten aufsetzen und vorbeugen lassen; in angehaltener Exspiration hören.']],
    t('No discomfort.', 'Keine Beschwerden.'),
    [f(t('Chest pain eased by sitting forward.', 'Brustschmerz, der sich im Vorbeugen bessert.'),
      t('Pericarditis.', 'Perikarditis.'), ['heart.sounds'], ['pericarditis'])]),
  'position.left-lateral': position(
    t('Lying on the left side brings the apex of the heart against the chest wall: for low-pitched sounds with the bell (mitral stenosis, S3). Also the position for a rectal examination.',
      'Linksseitenlage bringt die Herzspitze an die Brustwand: für tieffrequente Töne mit dem Trichter (Mitralstenose, 3. Herzton). Auch die Lage für die rektale Untersuchung.'),
    [['Roll the patient a quarter turn onto the left side.'], ['Den Patienten eine Vierteldrehung auf die linke Seite rollen.']],
    t('No change in comfort.', 'Keine Änderung des Befindens.'),
    [f(t('A diastolic rumble or third heart sound heard only in this position.', 'Ein diastolisches Rumpeln oder 3. Herzton, nur in dieser Lage hörbar.'),
      t('Mitral stenosis; a failing left ventricle.', 'Mitralstenose; ein versagender linker Ventrikel.'), ['heart.sounds'], ['acute-heart-failure'])]),
  'position.standing': position(
    t('Standing: for orthostatic blood pressure, Romberg’s test and gait; standing also lowers venous return, which changes some murmurs.',
      'Stehen: für den orthostatischen Blutdruck, den Romberg-Versuch und das Gangbild; Stehen senkt auch den venösen Rückstrom, was manche Geräusche verändert.'),
    [['Help the patient stand, ready to catch them.'], ['Dem Patienten beim Aufstehen helfen, bereit, ihn aufzufangen.']],
    t('Stands without dizziness.', 'Steht ohne Schwindel.'),
    [f(t('Dizzy or faint on standing.', 'Schwindel oder Schwäche beim Aufstehen.'),
      t('Orthostatic hypotension, hypovolaemia: measure lying and standing pressure.', 'Orthostatische Hypotonie, Hypovolämie: Blutdruck im Liegen und Stehen messen.'), ['vitals.bp'], ['orthostatic-hypotension', 'upper-gi-bleed']),
    f(t('A systolic murmur that gets louder on standing.', 'Ein Systolikum, das im Stehen lauter wird.'),
      t('Hypertrophic obstructive cardiomyopathy: a smaller ventricle obstructs more.', 'Hypertrophe obstruktive Kardiomyopathie: ein kleinerer Ventrikel obstruiert mehr.'), ['heart.sounds'], ['hcm'])]),

  'expose.chest': {
    aliases: l(['undress'], ['entkleiden']),
    assesses: t('A chest cannot be examined through clothing: inspection needs it bare, and the stethoscope needs skin.',
      'Ein Thorax lässt sich nicht durch Kleidung untersuchen: die Inspektion braucht ihn frei, das Stethoskop braucht Haut.'),
    how: l(['Explain why and ask permission; offer a chaperone.', 'Expose to the waist, keep the patient warm, and cover again as soon as you have finished.'],
      ['Erklären, warum, und um Erlaubnis bitten; eine Begleitperson anbieten.', 'Bis zur Taille freimachen, den Patienten warm halten und nach der Untersuchung sofort wieder bedecken.']),
    normal: t('A symmetrical chest without scars or deformity.', 'Ein symmetrischer Thorax ohne Narben oder Deformität.'),
    abnormal: [
      f(t('A midline sternotomy scar, a thoracotomy scar, a pacemaker under the clavicle.', 'Eine mediane Sternotomienarbe, eine Thorakotomienarbe, ein Schrittmacher unter der Klavikula.'),
        t('Previous heart or lung surgery, or a device: ask about it.', 'Frühere Herz- oder Lungenoperation oder ein Implantat: danach fragen.'), ['chest.expansion']),
      f(t('A barrel-shaped chest.', 'Ein fassförmiger Thorax.'), t('Hyperinflation in COPD.', 'Überblähung bei COPD.'), ['chest.expansion'], ['copd-exacerbation']),
    ],
  },
  'expose.abdomen': {
    aliases: l(['undress'], ['entkleiden']),
    assesses: t('The abdomen is inspected and palpated bare, from the lower chest to the groins.', 'Das Abdomen wird frei inspiziert und palpiert, vom unteren Thorax bis zu den Leisten.'),
    how: l(['Explain and ask permission; offer a chaperone.', 'Expose from the xiphisternum to the groins; keep the rest covered.'],
      ['Erklären und um Erlaubnis bitten; eine Begleitperson anbieten.', 'Vom Xiphoid bis zu den Leisten freimachen; den Rest bedeckt lassen.']),
    normal: t('A flat abdomen moving with breathing, no scars or visible veins.', 'Ein flaches Abdomen, das sich mit der Atmung bewegt, keine Narben oder sichtbaren Venen.'),
    abnormal: [
      f(t('A distended abdomen with full flanks and an everted umbilicus.', 'Ein gespanntes Abdomen mit ausladenden Flanken und verstrichenem Nabel.'),
        t('Ascites: test for shifting dullness.', 'Aszites: auf lageabhängige Flankendämpfung prüfen.'), ['abdomen.ascites'], ['decompensated-cirrhosis']),
      f(t('An abdomen that does not move with breathing.', 'Ein Abdomen, das sich nicht mit der Atmung bewegt.'),
        t('Peritonitis.', 'Peritonitis.'), ['abdomen.palpation'], ['acute-appendicitis', 'spontaneous-bacterial-peritonitis']),
    ],
  },

  'give.oxygen.nasal-2': oxygen(
    t('Low-flow oxygen through nasal prongs (1–4 L/min): a variable inspired fraction of roughly 24–35 %, comfortable and allows eating and talking.',
      'Niedrigfluss-Sauerstoff über eine Nasenbrille (1–4 l/min): eine variable Fraktion von etwa 24–35 %, bequem, Essen und Sprechen möglich.'),
    t('Each litre per minute adds very roughly 3–4 % to the inspired fraction.', 'Jeder Liter pro Minute erhöht die inspiratorische Fraktion grob um 3–4 %.'),
    [['nasal cannula', 'nasal prongs'], ['Nasenbrille', 'Nasensonde']]),
  'give.oxygen.venturi-28': oxygen(
    t('A Venturi mask set to 28 %: the jet entrains room air at a fixed ratio, so the inspired fraction stays fixed however the patient breathes. The device of choice when CO₂ retention is a risk.',
      'Eine Venturi-Maske mit 28 %: der Strahl reißt Raumluft in festem Verhältnis mit, sodass die Fraktion unabhängig vom Atemmuster gleich bleibt. Das Mittel der Wahl bei Gefahr einer CO₂-Retention.'),
    t('A fixed 28 %, whatever the breathing pattern.', 'Feste 28 %, unabhängig vom Atemmuster.'),
    [['Venturi mask', 'fixed-performance mask'], ['Venturi-Maske']]),
  'give.oxygen.venturi-35': oxygen(
    t('A Venturi mask set to 35 %: a fixed, moderate inspired fraction.', 'Eine Venturi-Maske mit 35 %: eine feste, mittlere Fraktion.'),
    t('A fixed 35 %.', 'Feste 35 %.'), [['Venturi mask'], ['Venturi-Maske']]),
  'give.oxygen.mask-6': oxygen(
    t('A simple face mask at 5–10 L/min: roughly 35–50 %, variable. Below 5 L/min the patient rebreathes CO₂ from the mask.',
      'Eine einfache Gesichtsmaske mit 5–10 l/min: etwa 35–50 %, variabel. Unter 5 l/min atmet der Patient CO₂ aus der Maske zurück.'),
    t('Roughly 40 % at 6 L/min.', 'Etwa 40 % bei 6 l/min.'), [['Hudson mask', 'simple mask'], ['einfache Maske']]),
  'give.oxygen.nrb-15': oxygen(
    t('A non-rebreather mask with a reservoir bag at 15 L/min: the highest inspired fraction without a ventilator, roughly 60–80 %. For the critically ill.',
      'Eine Maske mit Reservoirbeutel bei 15 l/min: die höchste Fraktion ohne Beatmung, etwa 60–80 %. Für kritisch Kranke.'),
    t('Roughly 60–80 % with a full reservoir bag.', 'Etwa 60–80 % mit gefülltem Reservoirbeutel.'), [['reservoir mask', 'high-flow mask'], ['Reservoirmaske', 'Maske mit Reservoir']]),
  'give.oxygen.off': oxygen(
    t('Room air: 21 % oxygen. Stopping oxygen shows whether the patient still needs it.', 'Raumluft: 21 % Sauerstoff. Das Absetzen zeigt, ob der Patient ihn noch braucht.'),
    t('The saturation stays within target on room air.', 'Die Sättigung bleibt unter Raumluft im Zielbereich.'), [['room air'], ['Raumluft']]),
};
