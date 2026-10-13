import type { TeachingCard } from '../../model/types.ts';
import { f, l, t } from './helpers.ts';

/* Abdomen. */
export const ABDOMEN: Record<string, TeachingCard> = {
  'palpate.abdomen': {
    aliases: l(['abdominal examination', 'guarding', 'rebound', 'hepatomegaly', 'splenomegaly'], ['Bauchuntersuchung', 'Abwehrspannung', 'Loslassschmerz', 'Hepatomegalie', 'Splenomegalie']),
    assesses: t('Tenderness and peritoneal irritation, the size of the liver and spleen, masses, a distended bladder, and the aorta.',
      'Druckschmerz und Peritonealreizung, Größe von Leber und Milz, Raumforderungen, eine gefüllte Harnblase und die Aorta.'),
    how: l([
      'The patient lies flat with one pillow, arms by the sides, abdomen exposed. Ask where it hurts and start away from there.',
      'Palpate all nine regions lightly, then deeply, kneeling at the bedside and watching the face.',
      'Liver: from the right iliac fossa upwards, the hand still while the patient breathes in. Spleen: from the right iliac fossa towards the left costal margin.',
      'Kidneys: ballot each between two hands. Aorta: above the umbilicus, two hands; is it pulsatile or expansile?',
    ], [
      'Der Patient liegt flach mit einem Kissen, Arme neben dem Körper, Bauch frei. Nach dem Schmerzort fragen und fern davon beginnen.',
      'Alle neun Regionen erst oberflächlich, dann tief palpieren, neben dem Bett kniend und das Gesicht beobachtend.',
      'Leber: von rechts unten nach oben, die Hand ruhig, während der Patient einatmet. Milz: von rechts unten zum linken Rippenbogen.',
      'Nieren: bimanuell ballotieren. Aorta: oberhalb des Nabels mit zwei Händen; pulsierend oder expansiv?',
    ]),
    normal: t('Soft and non-tender; liver edge at most just palpable on deep inspiration; spleen and kidneys not palpable; aorta pulsatile, not expansile.',
      'Weich, kein Druckschmerz; Leberrand höchstens bei tiefer Einatmung gerade tastbar; Milz und Nieren nicht tastbar; Aorta pulsierend, nicht expansiv.'),
    abnormal: [
      f(t('Guarding, rigidity, rebound or percussion tenderness.', 'Abwehrspannung, brettharter Bauch, Loslass- oder Klopfschmerz.'),
        t('Peritoneal inflammation: the abdominal wall splints over the inflamed peritoneum.', 'Peritoneale Entzündung: die Bauchwand schient das entzündete Peritoneum.'),
        ['abdomen.palpation'], ['acute-appendicitis', 'spontaneous-bacterial-peritonitis', 'acute-pancreatitis']),
      f(t('Tenderness in the right iliac fossa.', 'Druckschmerz im rechten Unterbauch.'),
        t('Appendicitis (McBurney’s point); also ovarian and caecal disease.', 'Appendizitis (McBurney-Punkt); auch Erkrankungen von Ovar und Zäkum.'), ['abdomen.palpation'], ['acute-appendicitis']),
      f(t('Epigastric tenderness.', 'Epigastrischer Druckschmerz.'), t('Peptic ulcer, pancreatitis.', 'Ulkus, Pankreatitis.'), ['abdomen.palpation'], ['peptic-ulcer-bleed', 'acute-pancreatitis']),
      f(t('Enlarged spleen, with or without the liver.', 'Vergrößerte Milz, mit oder ohne Leber.'),
        t('Portal hypertension, haemolysis, infection, blood cancers.', 'Portale Hypertension, Hämolyse, Infektion, hämatologische Neoplasien.'), ['abdomen.palpation'], ['decompensated-cirrhosis', 'haemolytic-anaemia']),
      f(t('A smooth, dull mass rising from the pelvis that cannot be got below.', 'Eine glatte, gedämpfte Resistenz aus dem Becken, nach unten nicht abgrenzbar.'),
        t('A distended bladder: urinary retention.', 'Eine volle Harnblase: Harnverhalt.'), ['abdomen.palpation'], ['urinary-retention']),
      f(t('Loin tenderness, worse on gentle punching.', 'Flankenschmerz, verstärkt bei leichtem Klopfen (Nierenlagerklopfschmerz).'),
        t('Pyelonephritis, or a kidney stone.', 'Pyelonephritis oder Nierenstein.'), ['abdomen.palpation'], ['acute-pyelonephritis', 'urosepsis']),
    ],
    pitfalls: l([
      'The elderly, the immunosuppressed and those on steroids may have peritonitis with little tenderness.',
      'A tense patient guards voluntarily: distract them, bend their knees, warm your hands.',
    ], [
      'Alte, immunsupprimierte und mit Steroiden behandelte Patienten können eine Peritonitis mit wenig Druckschmerz haben.',
      'Ein angespannter Patient spannt willkürlich an: ablenken, Knie beugen, Hände wärmen.',
    ]),
  },

  'test.shifting-dullness': {
    aliases: l(['ascites'], ['Aszites', 'Flankendämpfung']),
    assesses: t('Free fluid in the peritoneal cavity: it sinks to the lowest point and moves when the patient turns, while gas-filled bowel floats on top.',
      'Freie Flüssigkeit in der Bauchhöhle: sie sinkt an die tiefste Stelle und verlagert sich beim Drehen, während luftgefüllter Darm obenauf schwimmt.'),
    how: l([
      'With the patient flat, percuss from the umbilicus out towards one flank until the note turns dull; keep the finger there.',
      'Roll the patient onto the opposite side and wait about 30 seconds.',
      'Percuss again at the same point: if it is now resonant, the dullness has shifted.',
    ], [
      'Am flach liegenden Patienten vom Nabel zur Flanke perkutieren, bis der Klopfschall gedämpft wird; den Finger dort lassen.',
      'Den Patienten auf die Gegenseite drehen und etwa 30 Sekunden warten.',
      'An derselben Stelle erneut perkutieren: ist sie jetzt sonor, hat sich die Dämpfung verlagert.',
    ]),
    normal: t('Resonant to the flanks, or dullness that does not move.', 'Sonor bis in die Flanken oder eine Dämpfung, die sich nicht verlagert.'),
    abnormal: [
      f(t('Dullness that shifts when the patient turns.', 'Eine Dämpfung, die sich beim Drehen verlagert.'),
        t('Ascites, usually at least 1–1.5 L: cirrhosis with portal hypertension, also heart failure, malignancy, nephrotic syndrome. New ascites needs a diagnostic tap (infection).',
          'Aszites, meist mindestens 1–1,5 l: Zirrhose mit portaler Hypertension, auch Herzinsuffizienz, Malignom, nephrotisches Syndrom. Neuer Aszites braucht eine diagnostische Punktion (Infektion).'),
        ['abdomen.ascites'], ['decompensated-cirrhosis', 'spontaneous-bacterial-peritonitis']),
    ],
    pitfalls: l(['Small amounts of ascites are missed; ultrasound finds a few hundred millilitres.'], ['Kleine Aszitesmengen werden übersehen; der Ultraschall findet schon wenige hundert Milliliter.']),
  },

  'examine.rectal': {
    aliases: l(['DRE', 'PR examination', 'melaena'], ['DRU', 'rektale Untersuchung', 'Meläna', 'Teerstuhl']),
    assesses: t('The anal canal and rectum, the prostate, anal sphincter tone and perianal sensation, and the colour of the stool (blood).',
      'Analkanal und Rektum, die Prostata, den Sphinktertonus und die perianale Sensibilität sowie die Farbe des Stuhls (Blut).'),
    how: l([
      'Explain, obtain consent and offer a chaperone.',
      'The patient lies on the left side with knees drawn up. Inspect the perianal skin.',
      'Insert a lubricated, gloved index finger; ask the patient to squeeze (tone); sweep the rectal wall all round; feel the prostate in men.',
      'Look at the glove: stool colour, blood, melaena.',
    ], [
      'Erklären, Einverständnis einholen und eine Begleitperson anbieten.',
      'Der Patient liegt auf der linken Seite mit angezogenen Knien. Die Perianalhaut inspizieren.',
      'Den mit Gleitmittel versehenen, behandschuhten Zeigefinger einführen; den Patienten kneifen lassen (Tonus); die Rektumwand zirkulär abtasten; beim Mann die Prostata tasten.',
      'Den Handschuh ansehen: Stuhlfarbe, Blut, Meläna.',
    ]),
    normal: t('Normal tone and sensation, smooth rectal wall, brown stool; prostate smooth, rubbery, chestnut-sized with a central groove.',
      'Normaler Tonus und Sensibilität, glatte Rektumwand, brauner Stuhl; Prostata glatt, prallelastisch, kastaniengroß mit zentraler Furche.'),
    abnormal: [
      f(t('Black, sticky, tarry stool with a characteristic smell (melaena).', 'Schwarzer, klebriger Teerstuhl mit typischem Geruch (Meläna).'),
        t('Bleeding from the upper gastrointestinal tract, digested on the way.', 'Blutung aus dem oberen Gastrointestinaltrakt, auf dem Weg verdaut.'),
        ['rectal.exam'], ['peptic-ulcer-bleed', 'variceal-bleed', 'upper-gi-bleed']),
      f(t('A hard, irregular mass in the rectum; fresh blood.', 'Ein harter, unregelmäßiger Tumor im Rektum; frisches Blut.'),
        t('Rectal cancer; fresh blood comes from the lower bowel.', 'Rektumkarzinom; frisches Blut kommt aus dem unteren Darm.'), ['rectal.exam'], ['colorectal-cancer']),
      f(t('Lax anal tone and reduced perianal sensation.', 'Schlaffer Sphinktertonus und verminderte perianale Sensibilität.'),
        t('Cauda equina compression: an emergency.', 'Kompression der Cauda equina: ein Notfall.'), ['rectal.exam'], ['cauda-equina-syndrome']),
      f(t('A smoothly enlarged prostate.', 'Eine glatt vergrößerte Prostata.'),
        t('Benign prostatic hyperplasia, a cause of urinary retention. A hard, craggy gland suggests cancer.', 'Benigne Prostatahyperplasie, eine Ursache des Harnverhalts. Eine harte, höckrige Drüse spricht für ein Karzinom.'),
        ['rectal.exam'], ['urinary-retention']),
    ],
    pitfalls: l(['Iron tablets and bismuth also blacken the stool, but it is not sticky and does not smell of melaena.'],
      ['Eisentabletten und Wismut färben den Stuhl ebenfalls schwarz, aber er ist nicht klebrig und riecht nicht nach Teerstuhl.']),
  },
};
