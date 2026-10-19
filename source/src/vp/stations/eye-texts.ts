import type { LocalizedText } from '../model/i18n.ts';
import type { Side } from '../model/types.ts';
import type { NeuroExamState, NystagmusValue } from '../models/neuro-exam.ts';
import { EXAM } from '../evidence/exam.ts';

/* ---------------------------------------------------------------------------
   The eye station's explanations: for each test, what the pathway it reads
   is doing, and why the eyes look as they do.

   Written per test and per situation, in English and German, and selected
   by the examination model's state: which pathway is cut, the tone of each
   labyrinth, the integrator's time constant, the VOR gains, the vertical
   deviation in each gaze. Numbers come from the model. Nothing here decides
   what the eyes do; it says why.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export type EyeTest = 'pupils' | 'swinging' | 'movements' | 'cover' | 'nystagmus' | 'impulse' | 'fields' | 'sclera' | 'conjunctiva' | 'thyroid';
export const EYE_TESTS: EyeTest[] = ['pupils', 'swinging', 'movements', 'cover', 'nystagmus', 'impulse', 'fields', 'sclera', 'conjunctiva', 'thyroid'];
/** The tests that read the body rather than the nervous system: they need the body run through the illness. */
export const BODY_TESTS: EyeTest[] = ['sclera', 'conjunctiva', 'thyroid'];

export const EYE_TEST_LABEL: Record<EyeTest, LocalizedText> = {
  pupils: L('Pupils and lids', 'Pupillen und Lider'),
  swinging: L('Swinging light', 'Swinging flashlight'),
  movements: L('Eye movements', 'Augenbewegungen'),
  cover: L('Cover test', 'Abdecktest'),
  nystagmus: L('Nystagmus', 'Nystagmus'),
  impulse: L('Head impulse', 'Kopfimpuls'),
  fields: L('Visual fields', 'Gesichtsfeld'),
  sclera: L('Sclerae', 'Skleren'),
  conjunctiva: L('Conjunctivae', 'Konjunktiven'),
  thyroid: L('Thyroid eye signs', 'Schilddrüsenaugenzeichen'),
};

/** The manoeuvres of the examination each test stands for (their findings are listed under the eyes). */
export const EYE_TEST_MANOEUVRES: Record<EyeTest, string[]> = {
  pupils: ['inspect.eyes', 'inspect.eyes.dim', 'test.pupils.light'],
  swinging: ['test.swinging-light'],
  movements: ['test.eye-movements'],
  cover: ['test.cover'],
  nystagmus: ['test.frenzel'],
  impulse: ['test.head-impulse'],
  fields: ['test.visual-fields'],
  sclera: ['inspect.sclera'],
  conjunctiva: ['inspect.conjunctiva'],
  thyroid: ['inspect.thyroid-eyes'],
};

export interface EyeContext {
  s: NeuroExamState;
  /** vertical deviation, right eye minus left, in prism dioptres, by gaze */
  verticalPD: { primary: number; up: number; down: number };
  /** nystagmus straight ahead without fixation (Frenzel) */
  dark: NystagmusValue;
  /** VOR gain for impulses toward each side */
  gain: Record<Side, number>;
  /** the body run through the illness, when it has been (null: not yet) */
  body: EyeBody | null;
  /** the body's signs in the eye, as the examination grades them */
  findings: { icterus: string; pallor: string; thyroid: { lidRetraction?: boolean; lidLag?: boolean; exophthalmos?: boolean } };
}

export interface EyeBody {
  bilirubin: number; conjugated: number; haemoglobin: number; mcv: number; reticulocytes: number;
  thyroidEffect: number; ft4: number; tsh: number;
  haemolysis: number; liverFunction: number; cholestasis: number; bleed: number; orbitopathy: number;
}

export interface EyeText { title: LocalizedText; body: LocalizedText[] }

const SIDES: Side[] = ['L', 'R'];
const sideEn = (S: Side) => (S === 'L' ? 'left' : 'right');
const sideDe = (S: Side) => (S === 'L' ? 'links' : 'rechts');
const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const de1 = (x: number) => n1(x).replace('.', ',');

export function explainEye(test: EyeTest, c: EyeContext): EyeText {
  const s = c.s, body: LocalizedText[] = [];
  switch (test) {
    case 'pupils': {
      body.push(L('Pupil size is a balance: the sphincter, parasympathetic (Edinger–Westphal nucleus, oculomotor nerve, ciliary ganglion), narrows it; the dilator, sympathetic (a chain from the hypothalamus down the brainstem to the upper thoracic cord, back up the carotid to the eye), widens it. Light on either retina drives both pretectal nuclei, so both pupils constrict together: direct and consensual.',
        'Die Pupillenweite ist ein Gleichgewicht: Der Sphinkter, parasympathisch (Edinger-Westphal-Kern, N. oculomotorius, Ganglion ciliare), verengt sie; der Dilatator, sympathisch (eine Kette vom Hypothalamus durch den Hirnstamm ins obere Thorakalmark und entlang der Karotis zurück zum Auge), erweitert sie. Licht auf eine Netzhaut erregt beide prätektalen Kerne, daher verengen sich beide Pupillen gemeinsam: direkt und konsensuell.'));
      for (const S of SIDES) {
        if (s.pupil.horner[S]) body.push(L(`The sympathetic chain on the ${sideEn(S)} is cut. The dilator and Müller’s muscle in the lid lose their tone: the ${sideEn(S)} pupil is small and the lid droops about ${s.ptosisMm[S]} mm. Light still constricts both pupils normally. In the dark only the healthy pupil widens, so the difference grows: the small pupil is the abnormal one (dilation lag).`,
          `Der Sympathikus ${sideDe(S)} ist unterbrochen. Dilatator und Müller-Muskel im Lid verlieren ihren Tonus: Die Pupille ${sideDe(S)} ist eng, das Lid hängt etwa ${s.ptosisMm[S]} mm. Licht verengt beide Pupillen weiter normal. Im Dunkeln erweitert sich nur die gesunde Pupille, der Unterschied wächst: Die enge Pupille ist die kranke (Dilatationsverzögerung).`));
        if (!s.pupil.efferent[S]) body.push(L(`The parasympathetic fibres to the ${sideEn(S)} eye are cut. They run on the outside of the oculomotor nerve, where a compressing aneurysm reaches them first. The sphincter is paralysed: the pupil is wide and does not constrict, neither to its own light nor to the other eye’s. The difference is largest in bright light, because only the healthy pupil narrows: the large pupil is the abnormal one.`,
          `Die parasympathischen Fasern zum Auge ${sideDe(S)} sind unterbrochen. Sie liegen außen am N. oculomotorius, wo ein drückendes Aneurysma sie zuerst erreicht. Der Sphinkter ist gelähmt: Die Pupille ist weit und verengt sich nicht, weder auf ihr eigenes Licht noch auf das des anderen Auges. Der Unterschied ist im Hellen am größten, weil sich nur die gesunde Pupille verengt: Die weite Pupille ist die kranke.`));
        if (!s.pupil.afferent[S]) body.push(L(`The ${sideEn(S)} optic nerve carries no light signal. Light in that eye moves neither pupil; light in the other eye constricts both. The pupils stay equal, because the efferent pathways are intact: a blind eye does not have a large pupil. The swinging light shows it.`,
          `Der Sehnerv ${sideDe(S)} leitet kein Lichtsignal. Licht in diesem Auge bewegt keine Pupille; Licht im anderen Auge verengt beide. Die Pupillen bleiben gleich weit, weil die efferenten Bahnen intakt sind: Ein blindes Auge hat keine weite Pupille. Der Swinging-Flashlight-Test zeigt es.`));
        if (s.ptosisMm[S] >= 4) body.push(L(`The ${sideEn(S)} lid hangs ${s.ptosisMm[S]} mm: the levator, supplied by the oculomotor nerve, is weak. A sympathetic lid droops only about 2 mm.`,
          `Das Lid ${sideDe(S)} hängt ${s.ptosisMm[S]} mm: Der M. levator, versorgt vom N. oculomotorius, ist schwach. Ein sympathisches Lid hängt nur etwa 2 mm.`));
      }
      return { title: L('Pupils: two muscles, two nerves', 'Pupillen: zwei Muskeln, zwei Nerven'), body };
    }
    case 'swinging': {
      const bad = SIDES.filter((S) => !s.pupil.afferent[S]);
      if (bad.length === 1) {
        const S = bad[0];
        body.push(L(`When the light swings to the ${sideEn(S)} eye, both pupils widen: that optic nerve brings less drive to the pretectal nuclei than the other did a moment before. This is a relative afferent pupillary defect (Marcus Gunn pupil). It points to the optic nerve or a large retinal lesion, never to a cloudy lens.`,
          `Schwenkt das Licht zum Auge ${sideDe(S)}, werden beide Pupillen weiter: Dieser Sehnerv bringt den prätektalen Kernen weniger Antrieb als der andere einen Moment zuvor. Das ist ein relativer afferenter Pupillendefekt (Marcus-Gunn-Pupille). Er weist auf den Sehnerv oder einen großen Netzhautschaden, nie auf eine trübe Linse.`));
        body.push(L('The model’s afferent pathway is either working or not: a partial optic nerve lesion shows the same defect here as a complete one.',
          'Im Modell leitet die Afferenz ganz oder gar nicht: Eine partielle Sehnervenläsion zeigt hier denselben Defekt wie eine komplette.'));
      } else if (bad.length === 2) {
        body.push(L('Neither optic nerve carries light: the pupils do not react to light in either eye, and swinging the light compares two equal (absent) signals, so there is no relative defect.',
          'Keiner der Sehnerven leitet Licht: Die Pupillen reagieren auf Licht in keinem Auge, und der Schwenk vergleicht zwei gleiche (fehlende) Signale, daher gibt es keinen relativen Defekt.'));
      } else {
        body.push(L('Each optic nerve drives both pretectal nuclei, and both carry the same signal. Wherever the light is, both pupils stay equally small as it swings: no relative afferent defect.',
          'Jeder Sehnerv erregt beide prätektalen Kerne, und beide leiten dasselbe Signal. Wo auch immer das Licht ist, bleiben beide Pupillen beim Schwenken gleich eng: kein relativer afferenter Defekt.'));
      }
      if (SIDES.some((S) => !s.pupil.efferent[S])) body.push(L('A paralysed sphincter does not hide the test: watch the pupil that still moves.',
        'Ein gelähmter Sphinkter verdeckt den Test nicht: Beobachten Sie die Pupille, die sich noch bewegt.'));
      return { title: L('Swinging light: comparing the two optic nerves', 'Swinging flashlight: die beiden Sehnerven im Vergleich'), body };
    }
    case 'movements': {
      body.push(L('Each direction of gaze tests the muscle that moves the eye there: the lateral rectus (abducens nerve, VI) turns it out, the superior oblique (trochlear nerve, IV) turns it down when it looks in, the other four (oculomotor nerve, III) do the rest.',
        'Jede Blickrichtung prüft den Muskel, der das Auge dorthin bewegt: Der M. rectus lateralis (N. abducens, VI) wendet es nach außen, der M. obliquus superior (N. trochlearis, IV) senkt es beim Blick nach innen, die übrigen vier (N. oculomotorius, III) machen den Rest.'));
      for (const S of SIDES) {
        const d = s.ductions[S];
        if (d.adduction < 50) body.push(L(`The ${sideEn(S)} oculomotor nerve is cut. The lateral rectus and superior oblique still pull, unopposed: the eye rests down and out. It cannot look in or up, and down only partly; the lid hangs.`,
          `Der N. oculomotorius ${sideDe(S)} ist unterbrochen. M. rectus lateralis und M. obliquus superior ziehen weiter, ohne Gegenspieler: Das Auge steht nach unten außen. Es kann nicht nach innen oder oben blicken, nach unten nur teilweise; das Lid hängt.`));
        else if (d.abduction < 90) body.push(L(`The ${sideEn(S)} abducens nerve is cut: the eye cannot turn out past the midline and, at rest, the medial rectus turns it in. The double images are side by side and furthest apart looking ${sideEn(S)}.`,
          `Der N. abducens ${sideDe(S)} ist unterbrochen: Das Auge kann nicht über die Mitte nach außen, und in Ruhe zieht der M. rectus medialis es nach innen. Die Doppelbilder stehen nebeneinander und sind beim Blick nach ${sideDe(S)} am weitesten auseinander.`));
        else if (d.depression < 100) body.push(L(`The ${sideEn(S)} trochlear nerve is cut: the superior oblique cannot pull the eye down, so it rides a little high and falls short looking down. The double images are one above the other, worst reading or going downstairs.`,
          `Der N. trochlearis ${sideDe(S)} ist unterbrochen: Der M. obliquus superior kann das Auge nicht senken, es steht etwas höher und bleibt beim Blick nach unten zurück. Die Doppelbilder stehen übereinander, am schlimmsten beim Lesen oder Treppabgehen.`));
      }
      if (s.tauSeconds < 25) body.push(L(`Gaze holding leaks. A neural integrator in the brainstem and cerebellum holds the eyes where they look; here its time constant is ${n1(s.tauSeconds)} s instead of about 25. Looking to the side, the eyes drift back toward the centre and a quick phase brings them out again: nystagmus beating toward the direction of gaze, changing direction with it. Fixation does not stop it. Pursuit breaks into catch-up saccades.`,
        `Das Blickhalten „leckt“. Ein neuronaler Integrator in Hirnstamm und Kleinhirn hält die Augen dort, wohin sie blicken; hier ist seine Zeitkonstante ${de1(s.tauSeconds)} s statt etwa 25. Beim Seitblick driften die Augen zur Mitte zurück, und eine schnelle Phase bringt sie wieder hinaus: Nystagmus in Blickrichtung, der mit ihr die Richtung wechselt. Fixation hält ihn nicht auf. Die Blickfolge zerfällt in Aufholsakkaden.`));
      else body.push(L('At 30° to the side a few fine beats toward the direction of gaze are normal (end-point nystagmus): even a healthy integrator lets the eyes drift back a little.',
        'Bei 30° Seitblick sind einige feine Schläge in Blickrichtung normal (Endstellnystagmus): Auch ein gesunder Integrator lässt die Augen etwas zurückdriften.'));
      return { title: L('Eye movements: nerves, muscles and gaze holding', 'Augenbewegungen: Nerven, Muskeln und Blickhalten'), body };
    }
    case 'cover': {
      const v = c.verticalPD;
      body.push(L('Covering one eye makes the other take up the target. If it has to move to do so, the eyes were not aligned. Alternate cover, in primary gaze, is the test of skew of the HINTS examination.',
        'Deckt man ein Auge ab, muss das andere das Ziel übernehmen. Muss es sich dafür bewegen, standen die Augen nicht parallel. Der alternierende Abdecktest in Primärposition ist der Skew-Test der HINTS-Untersuchung.'));
      const abs = (x: number) => Math.abs(x);
      if (abs(v.primary) > 0 || abs(v.up) > 0 || abs(v.down) > 0) {
        const comitant = abs(v.up - v.primary) <= 5 && abs(v.down - v.primary) <= 5;
        const nums = `${abs(v.up)} / ${abs(v.primary)} / ${abs(v.down)}`;
        if (comitant && s.skew) body.push(L(`A vertical refixation, the same looking up, ahead and down (${nums} prism dioptres): a skew deviation. It comes not from a muscle but from the otolith pathway, which the ${sideEn(s.skew.higherEye === 'L' ? 'R' : 'L')} lateral medulla carries: the eye on the side of the lesion lies lower. In acute vertigo it means a central cause.`,
          `Eine vertikale Einstellbewegung, gleich beim Blick nach oben, geradeaus und nach unten (${nums} Prismendioptrien): eine Skew deviation. Sie stammt nicht von einem Muskel, sondern von der Otolithenbahn, die die laterale Medulla ${sideDe(s.skew.higherEye === 'L' ? 'R' : 'L')} führt: Das Auge auf der Seite der Läsion steht tiefer. Bei akutem Schwindel bedeutet das eine zentrale Ursache.`));
        else body.push(L(`A vertical refixation that changes with gaze (${nums} prism dioptres looking up, ahead, down): a weak vertical muscle, largest where that muscle should act. That is a nerve palsy, not a skew deviation.`,
          `Eine vertikale Einstellbewegung, die sich mit der Blickrichtung ändert (${nums} Prismendioptrien oben, geradeaus, unten): ein schwacher Vertikalmuskel, am größten dort, wo dieser Muskel wirken sollte. Das ist eine Nervenparese, keine Skew deviation.`));
      }
      const h = s.ductions.L.restH + s.ductions.R.restH;
      if (abs(h) >= 1) body.push(h > 0
        ? L('A horizontal refixation inward: the uncovered eye was turned out (exotropia), held there by its lateral rectus when the medial rectus is weak.',
          'Eine horizontale Einstellbewegung nach innen: Das freie Auge stand nach außen (Exotropie), dort gehalten vom M. rectus lateralis, wenn der M. rectus medialis schwach ist.')
        : L('A horizontal refixation outward: the uncovered eye was turned in (esotropia), pulled by its medial rectus when the lateral rectus is weak.',
          'Eine horizontale Einstellbewegung nach außen: Das freie Auge stand nach innen (Esotropie), gezogen vom M. rectus medialis, wenn der M. rectus lateralis schwach ist.'));
      if (body.length === 1) body.push(L('Neither eye moves when the other is covered: the eyes are aligned.', 'Keines der Augen bewegt sich, wenn das andere abgedeckt wird: Die Augen stehen parallel.'));
      return { title: L('Cover test: are the eyes aligned?', 'Abdecktest: Stehen die Augen parallel?'), body };
    }
    case 'nystagmus': {
      const tL = s.periphery.L * s.nucleus.L, tR = s.periphery.R * s.nucleus.R;
      body.push(L(`Each labyrinth fires at rest and pushes the eyes toward the other side; with equal tone (here ${n1(tL)} left, ${n1(tR)} right) the pushes cancel and the eyes stay still.`,
        `Jedes Labyrinth feuert in Ruhe und schiebt die Augen zur Gegenseite; bei gleichem Tonus (hier ${de1(tL)} links, ${de1(tR)} rechts) heben sich die Schübe auf, und die Augen stehen still.`));
      if (c.dark.present && !c.dark.physiological) {
        const weak: Side = tL < tR ? 'L' : 'R', fast = c.dark.fastPhase ?? '';
        const fastDe: Record<string, string> = { left: 'links', right: 'rechts', up: 'oben', down: 'unten' };
        body.push(L(`The ${sideEn(weak)} side is weaker, so the eyes drift slowly toward it (${n1(c.dark.spvDegPerS ?? 0)}°/s in the dark, looking ahead); a quick phase resets them each time. The nystagmus is named by its quick phase: it beats to the ${fast}.`,
          `Die Seite ${sideDe(weak)} ist schwächer, die Augen driften langsam zu ihr hin (${de1(c.dark.spvDegPerS ?? 0)}°/s im Dunkeln, Blick geradeaus); eine schnelle Phase setzt sie jedes Mal zurück. Benannt wird der Nystagmus nach der schnellen Phase: Er schlägt nach ${fastDe[fast] ?? fast}.`));
        if (s.fixationResidual < 0.5) body.push(L(`Fixation suppresses it to about ${Math.round(s.fixationResidual * 100)} %: that is why the Frenzel goggles, which blur the room, show it best. It grows looking toward the quick phase and fades looking away (Alexander’s law), but never reverses: peripheral nystagmus is unidirectional.`,
          `Fixation unterdrückt ihn auf etwa ${Math.round(s.fixationResidual * 100)} %: Deshalb zeigt ihn die Frenzel-Brille, die den Raum verschwimmen lässt, am besten. Er wird stärker beim Blick in Richtung der schnellen Phase und schwächer beim Blick weg (Alexander-Gesetz), kehrt sich aber nie um: Peripherer Nystagmus ist richtungsbestimmt.`));
        else body.push(L('Fixation does not suppress it: the flocculus, which would, is part of what is damaged. That is a central sign.',
          'Fixation unterdrückt ihn nicht: Der Flocculus, der das täte, ist Teil des Schadens. Das ist ein zentrales Zeichen.'));
      } else body.push(L('Without fixation, looking straight ahead, there is no spontaneous nystagmus: the two sides are balanced.',
        'Ohne Fixation, beim Blick geradeaus, gibt es keinen Spontannystagmus: Beide Seiten sind im Gleichgewicht.'));
      if (s.compensation > 0.05) body.push(L(`The brain is rebalancing the vestibular nuclei (${Math.round(s.compensation * 100)} % compensated): the nystagmus fades over days even though the labyrinth has not recovered. The head impulse still shows the loss.`,
        `Das Gehirn gleicht die Vestibulariskerne neu ab (zu ${Math.round(s.compensation * 100)} % kompensiert): Der Nystagmus klingt über Tage ab, obwohl sich das Labyrinth nicht erholt hat. Der Kopfimpuls zeigt den Ausfall weiter.`));
      if (s.tauSeconds < 25) body.push(L(`Gaze holding is also impaired (integrator ${n1(s.tauSeconds)} s): looking to the side adds a nystagmus beating toward the gaze, which changes direction from side to side.`,
        `Auch das Blickhalten ist gestört (Integrator ${de1(s.tauSeconds)} s): Der Seitblick fügt einen Nystagmus in Blickrichtung hinzu, der von Seite zu Seite die Richtung wechselt.`));
      return { title: L('Nystagmus: the balance of the two labyrinths', 'Nystagmus: das Gleichgewicht der beiden Labyrinthe'), body };
    }
    case 'impulse': {
      body.push(L('A small, fast head turn while the patient looks at your nose. The horizontal canal on the side the head turns to fires, and the vestibulo-ocular reflex turns the eyes the other way, as fast as the head: they stay on target. Only a fast turn tests it; a slow one lets pursuit do the work.',
        'Eine kleine, schnelle Kopfdrehung, während der Patient auf Ihre Nase blickt. Der horizontale Bogengang der Seite, zu der sich der Kopf dreht, feuert, und der vestibulookuläre Reflex dreht die Augen gegenläufig, so schnell wie den Kopf: Sie bleiben am Ziel. Nur eine schnelle Drehung prüft ihn; eine langsame überlässt die Arbeit der Blickfolge.'));
      for (const S of SIDES) {
        const g = c.gain[S];
        if (g < 0.8) body.push(L(`Turned to the ${sideEn(S)}, the gain is ${n1(g)}: the eyes move only ${Math.round(g * 100)} % as far as the head and are carried off target; a ${g < 0.6 ? 'visible' : 'small, early'} catch-up saccade brings them back. The ${sideEn(S)} labyrinth or vestibular nerve is not working.`,
          `Nach ${sideDe(S)} gedreht ist die Verstärkung ${de1(g)}: Die Augen bewegen sich nur ${Math.round(g * 100)} % so weit wie der Kopf und werden vom Ziel mitgenommen; eine ${g < 0.6 ? 'sichtbare' : 'kleine, frühe'} Korrektursakkade holt sie zurück. Labyrinth oder Vestibularisnerv ${sideDe(S)} arbeitet nicht.`));
      }
      if (c.gain.L >= 0.8 && c.gain.R >= 0.8) body.push(L(`Both gains are normal (left ${n1(c.gain.L)}, right ${n1(c.gain.R)}). In acute continuous vertigo with nystagmus, a normal head impulse is the dangerous finding: the labyrinths work, so the cause is central (stroke) until shown otherwise.`,
        `Beide Verstärkungen sind normal (links ${de1(c.gain.L)}, rechts ${de1(c.gain.R)}). Bei akutem Dauerschwindel mit Nystagmus ist ein normaler Kopfimpuls der gefährliche Befund: Die Labyrinthe arbeiten, die Ursache ist also zentral (Schlaganfall), bis das Gegenteil gezeigt ist.`));
      return { title: L('Head impulse: the vestibulo-ocular reflex', 'Kopfimpuls: der vestibulookuläre Reflex'), body };
    }
    case 'fields': {
      body.push(L('Each eye’s nasal retina sees the temporal field and its fibres cross at the chiasm; the temporal retina sees the nasal field and stays on its side. So behind the chiasm each side of the brain sees the opposite half of the world, with both eyes.',
        'Die nasale Netzhaut jedes Auges sieht das temporale Gesichtsfeld, ihre Fasern kreuzen im Chiasma; die temporale Netzhaut sieht das nasale Feld und bleibt auf ihrer Seite. Hinter dem Chiasma sieht daher jede Hirnhälfte die gegenüberliegende Hälfte der Welt, mit beiden Augen.'));
      const f = s.fields;
      const lost = (S: Side, h: 'temporal' | 'nasal') => f[S][h] === 'lost';
      if (lost('L', 'temporal') && lost('L', 'nasal') || lost('R', 'temporal') && lost('R', 'nasal')) {
        const S: Side = lost('L', 'nasal') && lost('L', 'temporal') ? 'L' : 'R';
        body.push(L(`The ${sideEn(S)} eye sees nothing: the lesion is in front of the chiasm, in that eye’s optic nerve. The other eye’s field is full.`,
          `Das Auge ${sideDe(S)} sieht nichts: Die Läsion liegt vor dem Chiasma, im Sehnerv dieses Auges. Das Feld des anderen Auges ist voll.`));
      } else if (lost('L', 'temporal') && lost('R', 'temporal')) body.push(L('Both temporal fields are lost: the crossing fibres are cut at the chiasm, typically by a pituitary tumour pressing from below. The patient bumps into things on both sides.',
        'Beide temporalen Felder fehlen: Die kreuzenden Fasern sind im Chiasma unterbrochen, typisch durch einen Hypophysentumor, der von unten drückt. Der Patient stößt beidseits an.'));
      else if (lost('L', 'temporal') && lost('R', 'nasal')) body.push(L('The left half of the world is lost in both eyes: a homonymous hemianopia from a lesion behind the chiasm on the right (optic tract, radiation or occipital cortex).',
        'Die linke Hälfte der Welt fehlt in beiden Augen: eine homonyme Hemianopsie durch eine Läsion hinter dem Chiasma rechts (Tractus opticus, Sehstrahlung oder Okzipitalkortex).'));
      else if (lost('R', 'temporal') && lost('L', 'nasal')) body.push(L('The right half of the world is lost in both eyes: a homonymous hemianopia from a lesion behind the chiasm on the left (optic tract, radiation or occipital cortex).',
        'Die rechte Hälfte der Welt fehlt in beiden Augen: eine homonyme Hemianopsie durch eine Läsion hinter dem Chiasma links (Tractus opticus, Sehstrahlung oder Okzipitalkortex).'));
      else if (SIDES.some((S) => lost(S, 'temporal') || lost(S, 'nasal'))) body.push(L('Part of the field is lost: compare which half, in which eye, with the pathway above.',
        'Ein Teil des Feldes fehlt: Vergleichen Sie, welche Hälfte in welchem Auge, mit der Bahn oben.'));
      else body.push(L('Both fields are full: the pathway is intact from retina to cortex.', 'Beide Felder sind voll: Die Bahn ist von der Netzhaut bis zur Rinde intakt.'));
      body.push(L('The model divides each field into a temporal and a nasal half: quadrant defects, macular sparing and central scotomas are not modelled.',
        'Das Modell teilt jedes Feld in eine temporale und eine nasale Hälfte: Quadrantenausfälle, Makulaaussparung und Zentralskotome sind nicht modelliert.'));
      return { title: L('Visual fields: where the pathway crosses', 'Gesichtsfeld: wo die Bahn kreuzt'), body };
    }
    case 'sclera': {
      body.push(L(`Old red cells are broken down and their haem becomes bilirubin. It travels to the liver bound to albumin (unconjugated, not water-soluble), the liver conjugates it, and it leaves in the bile. When more is made than the liver can clear, or the liver cannot conjugate, or bile cannot leave, bilirubin rises in the blood and binds to the elastin of the sclera. It shows there from about ${EXAM.icterusMild} µmol/L, before the skin, best in daylight; it is obvious from about ${EXAM.icterusMarked}.`,
        `Alte rote Blutkörperchen werden abgebaut, ihr Häm wird zu Bilirubin. Es gelangt an Albumin gebunden zur Leber (unkonjugiert, nicht wasserlöslich), die Leber konjugiert es, und es verlässt sie mit der Galle. Wird mehr gebildet, als die Leber klären kann, kann sie nicht konjugieren oder kann die Galle nicht abfließen, steigt das Bilirubin im Blut und bindet an das Elastin der Sklera. Dort wird es ab etwa ${EXAM.icterusMild} µmol/l sichtbar, vor der Haut, am besten bei Tageslicht; ab etwa ${EXAM.icterusMarked} ist es offensichtlich.`));
      const b = c.body;
      if (!b) { body.push(L('The body is being run through the illness…', 'Der Körper wird durch die Erkrankung gerechnet…')); return { title: L('Sclerae: where bilirubin shows first', 'Skleren: wo Bilirubin zuerst sichtbar wird'), body }; }
      const unc = Math.max(0, b.bilirubin - b.conjugated);
      body.push(L(`Here: bilirubin ${Math.round(b.bilirubin)} µmol/L, ${Math.round(b.conjugated)} of it conjugated. The sclerae are ${c.findings.icterus === 'none' ? 'white' : c.findings.icterus === 'mild' ? 'faintly yellow' : 'clearly yellow'}.`,
        `Hier: Bilirubin ${Math.round(b.bilirubin)} µmol/l, davon ${Math.round(b.conjugated)} konjugiert. Die Skleren sind ${c.findings.icterus === 'none' ? 'weiß' : c.findings.icterus === 'mild' ? 'leicht gelb' : 'deutlich gelb'}.`));
      if (b.cholestasis > 0.2 && b.conjugated > unc) body.push(L('Most of it is conjugated: the liver has done its work and the bile cannot leave (a stone or a tumour in the duct). Conjugated bilirubin is water-soluble, so it darkens the urine, and the stools turn pale without it.',
        'Das meiste ist konjugiert: Die Leber hat ihre Arbeit getan, aber die Galle kann nicht abfließen (ein Stein oder ein Tumor im Gang). Konjugiertes Bilirubin ist wasserlöslich, es färbt den Urin dunkel, und der Stuhl wird ohne es hell.'));
      else if (b.haemolysis > 0.3 && unc > b.conjugated) body.push(L('Most of it is unconjugated: red cells are being destroyed faster than the liver can conjugate their haem. It is bound to albumin, so the urine stays its colour (acholuric jaundice); the same breakdown makes the patient pale.',
        'Das meiste ist unkonjugiert: Rote Blutkörperchen werden schneller zerstört, als die Leber ihr Häm konjugieren kann. Es ist an Albumin gebunden, daher bleibt der Urin hell (acholurischer Ikterus); derselbe Abbau macht den Patienten blass.'));
      else if (b.liverFunction < 0.6) body.push(L('The liver itself is failing: it conjugates less, and bilirubin rises late, after the clotting and the albumin have already shown it.',
        'Die Leber selbst versagt: Sie konjugiert weniger, und das Bilirubin steigt spät, nachdem Gerinnung und Albumin es schon gezeigt haben.'));
      body.push(L('Physicians see jaundice with a sensitivity and specificity of only about 70 % (Hung 2000): a value near the threshold may be missed or called.',
        'Ärztinnen und Ärzte erkennen einen Ikterus nur mit etwa 70 % Sensitivität und Spezifität (Hung 2000): Ein Wert nahe der Schwelle kann übersehen oder fälschlich gesehen werden.'));
      return { title: L('Sclerae: where bilirubin shows first', 'Skleren: wo Bilirubin zuerst sichtbar wird'), body };
    }
    case 'conjunctiva': {
      body.push(L(`Drawing the lower lid down shows its inner surface: capillary blood under a thin membrane, with no skin pigment over it. Its redness is the haemoglobin in that blood. Pallor is a fair sign below about ${EXAM.pallorMild} g/L and a strong one below ${EXAM.pallorMarked}; above that it is unreliable, and a normal colour does not exclude a mild anaemia.`,
        `Zieht man das Unterlid herab, sieht man seine Innenseite: Kapillarblut unter einer dünnen Schleimhaut, ohne Hautpigment darüber. Ihre Röte ist das Hämoglobin in diesem Blut. Blässe ist unter etwa ${EXAM.pallorMild} g/l ein brauchbares, unter ${EXAM.pallorMarked} ein starkes Zeichen; darüber ist sie unzuverlässig, und eine normale Farbe schließt eine leichte Anämie nicht aus.`));
      const b = c.body;
      if (!b) { body.push(L('The body is being run through the illness…', 'Der Körper wird durch die Erkrankung gerechnet…')); return { title: L('Conjunctivae: the colour of the blood', 'Konjunktiven: die Farbe des Blutes'), body }; }
      body.push(L(`Here: haemoglobin ${Math.round(b.haemoglobin)} g/L, mean cell volume ${Math.round(b.mcv)} fL, reticulocytes ${n1(b.reticulocytes)} %. The conjunctivae are ${c.findings.pallor === 'none' ? 'red' : c.findings.pallor === 'mild' ? 'pale' : 'very pale'}.`,
        `Hier: Hämoglobin ${Math.round(b.haemoglobin)} g/l, mittleres Zellvolumen ${Math.round(b.mcv)} fl, Retikulozyten ${de1(b.reticulocytes)} %. Die Konjunktiven sind ${c.findings.pallor === 'none' ? 'rot' : c.findings.pallor === 'mild' ? 'blass' : 'sehr blass'}.`));
      if (b.bleed > 0 && b.mcv < 82) body.push(L('A slow bleed: each millilitre of red cells takes a milligram of iron with it, and only a milligram or two a day is absorbed. When the stores are empty the marrow makes small, pale cells (a low mean cell volume).',
        'Eine langsame Blutung: Jeder Milliliter Erythrozyten nimmt ein Milligramm Eisen mit, und nur ein bis zwei Milligramm am Tag werden aufgenommen. Sind die Speicher leer, bildet das Knochenmark kleine, blasse Zellen (ein niedriges mittleres Zellvolumen).'));
      else if (b.haemolysis > 0.3) body.push(L('Red cells are destroyed early; the marrow answers with young cells (reticulocytes) but cannot keep up. The haem of the destroyed cells is the bilirubin in the sclerae: pale and yellow together.',
        'Rote Blutkörperchen werden früh zerstört; das Knochenmark antwortet mit jungen Zellen (Retikulozyten), kommt aber nicht nach. Das Häm der zerstörten Zellen ist das Bilirubin in den Skleren: blass und gelb zugleich.'));
      if (b.bleed > 20) body.push(L('After an acute bleed the haemoglobin is unchanged at first: blood is lost whole. It falls over hours as plasma refills the vessels, so the conjunctivae can look normal in a patient who has just lost a litre.',
        'Nach einer akuten Blutung ist das Hämoglobin zunächst unverändert: Es geht Vollblut verloren. Es fällt erst über Stunden, wenn Plasma die Gefäße wieder auffüllt; die Konjunktiven können daher bei einem Patienten, der gerade einen Liter verloren hat, normal aussehen.'));
      return { title: L('Conjunctivae: the colour of the blood', 'Konjunktiven: die Farbe des Blutes'), body };
    }
    case 'thyroid': {
      body.push(L('Two different things, often together in Graves’ disease. Thyroid hormone raises sympathetic tone, which tightens Müller’s muscle in the upper lid: sclera shows above the iris (lid retraction), and the lid trails the eye looking down (lid lag). Any thyrotoxicosis does this, and it goes when the hormone falls. Exophthalmos is not hormonal: antibodies swell the muscles and fat behind the eye and push it forward. It happens only in Graves’ disease, and can come before, with, or after the thyrotoxicosis.',
        'Zwei verschiedene Dinge, beim Morbus Basedow oft zusammen. Schilddrüsenhormon steigert den Sympathikotonus und spannt damit den Müller-Muskel im Oberlid: Über der Iris ist Sklera zu sehen (Lidretraktion), und das Lid bleibt beim Blick nach unten zurück (Graefe-Zeichen). Jede Thyreotoxikose tut das, und es verschwindet, wenn das Hormon fällt. Der Exophthalmus ist nicht hormonell: Antikörper lassen Muskeln und Fett hinter dem Auge anschwellen und schieben es nach vorn. Das gibt es nur beim Morbus Basedow, und es kann vor, mit oder nach der Thyreotoxikose kommen.'));
      const b = c.body;
      if (!b) { body.push(L('The body is being run through the illness…', 'Der Körper wird durch die Erkrankung gerechnet…')); return { title: L('Thyroid eye signs: the lid and the orbit', 'Schilddrüsenaugenzeichen: Lid und Orbita'), body }; }
      const th = c.findings.thyroid;
      body.push(L(`Here: free T4 ${n1(b.ft4)} pmol/L, thyroid hormone action ×${n1(b.thyroidEffect)} of normal (the lids retract from about ×1.8 in the model); orbitopathy ${n1(b.orbitopathy)}.`,
        `Hier: freies T4 ${de1(b.ft4)} pmol/l, Schilddrüsenhormonwirkung ×${de1(b.thyroidEffect)} des Normalen (die Lider ziehen sich im Modell ab etwa ×1,8 zurück); Orbitopathie ${de1(b.orbitopathy)}.`));
      if (th.lidRetraction && !th.exophthalmos) body.push(L('Lid retraction and lag without a protruding eye: the hormone, not the orbit. The stare looks like exophthalmos from the front; look from the side, or at the sclera below the iris, to tell them apart.',
        'Lidretraktion und Graefe-Zeichen ohne hervortretendes Auge: das Hormon, nicht die Orbita. Von vorn wirkt der starre Blick wie ein Exophthalmus; von der Seite oder an der Sklera unter der Iris unterscheidet man sie.'));
      if (th.exophthalmos) body.push(L('The eye stands forward: sclera shows below the iris too. That is the orbit, and treating the hormone does not reverse it.',
        'Das Auge steht vor: Auch unter der Iris ist Sklera zu sehen. Das ist die Orbita, und die Behandlung des Hormons macht es nicht rückgängig.'));
      if (!th.lidRetraction && !th.exophthalmos) body.push(L('Neither: the lids sit at the edge of the iris, follow it down, and the eyes do not protrude.', 'Keines von beiden: Die Lider liegen am Rand der Iris, folgen ihr nach unten, und die Augen treten nicht hervor.'));
      return { title: L('Thyroid eye signs: the lid and the orbit', 'Schilddrüsenaugenzeichen: Lid und Orbita'), body };
    }
  }
}
