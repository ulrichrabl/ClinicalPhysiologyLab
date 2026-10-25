/* Clinical Physiology Lab: the virtual patient, in one app.
   Cases and a free patient; for each, the bedside, the tests, the physiology
   (models, as living chapters) and the Model Lab (every variable).
   Bundled into a standalone page by scripts/build-vp-demo.mjs. */
import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { CASES } from '../index.ts';
import { buildView } from '../engine/view.ts';
import { startEncounter, perform, order, advanceCourse, observeIn, type Session } from '../engine/encounter.ts';
import { ask, opening, interpret, normalise } from '../engine/language.ts';
import { autoNote, describe } from '../engine/notes.ts';
import { commit, namedSigns, signsInResult, type Commit, type DebriefResult } from '../engine/debrief.ts';
import { readEcg } from '../measurements/ecg-reading.ts';
import { tr, list, type LocalizedText } from '../model/i18n.ts';
import type { CardPresentation, CaseDef, ExamContext, Finding, ManoeuvreDef, Side, InvestigationDef, TeachingCard } from '../model/types.ts';
import { KNOWLEDGE, labelOf, testsForSign } from '../knowledge/index.ts';
import { signsFoundBy, signsOnTheFigure, signsTestLooksFor, signsTheFigureCanShow } from '../knowledge/elicited.ts';
import { signsOf } from '../knowledge/coverage.ts';
import { signCard } from '../knowledge/cards.ts';
import { suggest, type Suggestion } from '../engine/suggest.ts';
import { SHORT_LABELS } from '../data/exam-structure.ts';
import { sceneFindings, type SceneControls } from '../render/eye-scene.ts';
import { EyeView } from '../render/eye-view.ts';
import { FaceView, type FaceFinding } from '../render/face-view.ts';
import { appearanceOf } from '../render/face-canvas.ts';
import { figureSvg, figureLookFor, lerpPose, POSES, VIEW_ANGLE, viewAt, type FigureFindings, type FigureLook, type Pose } from '../render/patient-figure.ts';
import { drawEcgPaper, drawSweep, PAPER_MM } from '../render/ecg-paper.ts';
import { recordLeads, measuredAxis, standardPlacement, leadVectorsOn, type Placement, type LeadName } from '../measurements/ecg.ts';
import { mountMonitor } from '../render/ecg-monitor.ts';
import { mountMeasureTool } from './ecg-measure-tool.ts';
import { healthyModel, modelFromCase, caseWithModel, type PatientModel } from '../physiology/state.ts';
import { VARIABLE_BY_ID } from '../physiology/models.ts';
import { LivePatient } from '../live/live-patient.ts';
import { renderChapter, CHAPTERS, type ChapterHandle } from './physiology-view.ts';
import { renderModelLab } from './model-lab.ts';
import { mountAuscultation } from './focus-thorax.ts';
import { mountChest, type ChestMode } from './focus-chest.ts';
import { drawCxr } from '../render/cxr.ts';
import { drawSpirogram, type SpiroCurve } from '../render/spirogram.ts';
import { RESP_RESOLVERS } from '../models/resp-exam.ts';
import { mountEcgPlacement, placementReview } from './focus-ecg.ts';
import { symbolMathML } from './math.ts';
import { labDigits } from '../measurements/labs.ts';
import { pulseOximeter } from '../physiology/lung/respiratory.ts';
const pulseOx = (r: any) => pulseOximeter(r).SpO2;
import type { ThoraxLook } from '../render/thorax.ts';

type Lang = 'en' | 'de';
type Layer = 'bedside' | 'tests' | 'physiology' | 'model';

/* ---- interface text ------------------------------------------------------------ */
const UI: Record<string, Record<Lang, string>> = {
  ward: { en: 'Clinical Physiology Lab', de: 'Clinical Physiology Lab' },
  levelLabel: { en: 'Who names the signs', de: 'Wer benennt die Befunde' },
  levelGuided: { en: 'The app names them', de: 'Die App benennt sie' },
  levelObserve: { en: 'You name them', de: 'Sie benennen sie' },
  levelGuidedHint: { en: 'After each test the app names the signs it found.', de: 'Nach jeder Untersuchung benennt die App die gefundenen Zeichen.' },
  levelObserveHint: { en: 'Observe only: after each test you choose what you saw. The debrief scores what you missed and what you over-called.', de: 'Nur beobachten: Nach jeder Untersuchung wählen Sie, was Sie gesehen haben. Die Nachbesprechung bewertet Übersehenes und Überbewertetes.' },
  observeBadge: { en: 'Observe only', de: 'Nur beobachten' },
  whatSeen: { en: 'What did you find? Choose all that apply.', de: 'Was haben Sie gefunden? Alles Zutreffende wählen.' },
  namedSoFar: { en: 'Signs you named', de: 'Von Ihnen benannte Zeichen' }, noneNamed: { en: 'None yet. Name signs after each test, or search here.', de: 'Noch keine. Benennen Sie Zeichen nach jeder Untersuchung oder suchen Sie hier.' },
  nameSign: { en: 'Name a sign', de: 'Zeichen benennen' }, removeNamed: { en: 'Remove', de: 'Entfernen' },
  docTitle: { en: 'Your documentation', de: 'Ihre Dokumentation' },
  docSummary: { en: 'You named {hit} of the {found} signs your tests showed, with {over} over-call(s).', de: 'Sie haben {hit} der {found} Zeichen benannt, die Ihre Untersuchungen zeigten, mit {over} Überbewertung(en).' },
  docHits: { en: 'Named and there', de: 'Benannt und vorhanden' }, docMisses: { en: 'There, not named', de: 'Vorhanden, nicht benannt' }, docOver: { en: 'Named, not shown by your tests', de: 'Benannt, von Ihren Untersuchungen nicht gezeigt' },
  wrongSide: { en: 'wrong side', de: 'falsche Seite' }, wasNormal: { en: 'this was', de: 'das war' }, seenWith: { en: 'shown by', de: 'gezeigt durch' },
  wardLede: { en: 'Each patient runs on the same physiological models. In a case you meet them as a clinician: take a history, examine, test, and commit to a diagnosis; then open the physiology and the model behind what you found. The free patient is a healthy adult whose every parameter you can change.', de: 'Jeder Patient läuft auf denselben physiologischen Modellen. Im Fall begegnen Sie ihnen als Ärztin oder Arzt: Anamnese, Untersuchung, Diagnostik, dann legen Sie sich auf eine Diagnose fest; danach öffnen Sie die Physiologie und das Modell hinter Ihren Befunden. Der freie Patient ist ein gesunder Erwachsener, dessen Parameter Sie alle verändern können.' },
  see: { en: 'See patient', de: 'Patient ansehen' }, freeTitle: { en: 'Free patient', de: 'Freier Patient' },
  freeText: { en: 'A healthy adult on the physiology bench. Examine, record an ECG, open any chapter, change any variable.', de: 'Ein gesunder Erwachsener auf dem Physiologie-Tisch. Untersuchen, EKG schreiben, jedes Kapitel öffnen, jede Variable ändern.' },
  openFree: { en: 'Open the free patient', de: 'Freien Patienten öffnen' }, lab: { en: 'Physiology lab', de: 'Physiologielabor' },
  stationTag: { en: 'Station', de: 'Station' },
  inStation: { en: 'In a station', de: 'In einer Station' },
  inStationNote: { en: 'Your patient, with the mechanism beside the test: every instant of the tracing or the beat, and why it looks and sounds as it does.', de: 'Ihr Patient, mit dem Mechanismus neben dem Test: jeder Moment der Kurve oder des Schlags, und warum sie so aussehen und klingen.' },
  stationEcgYours: { en: 'Your patient’s ECG', de: 'Das EKG Ihres Patienten' },
  stationAuscYours: { en: 'Your patient’s heart sounds', de: 'Die Herztöne Ihres Patienten' },
  stationEyesYours: { en: 'Your patient’s eyes', de: 'Die Augen Ihres Patienten' },
  stationPulseYours: { en: 'Your patient’s pulse and neck veins', de: 'Puls und Halsvenen Ihres Patienten' },
  stationPulseText: { en: 'The pulse under the finger and the jugular vein in the neck, beside the pressures that make them: the aorta’s wave and the right atrium’s a, x, v and y, beat by beat.', de: 'Der Puls unter dem Finger und die Jugularvene am Hals, neben den Drücken, die sie erzeugen: die Welle der Aorta und a, x, v und y des rechten Vorhofs, Schlag für Schlag.' },
  stationNeuroText: { en: 'The limb examination and the ladder of the nervous system: pronator drift, finger–nose and the knee jerk, done on the bedside figure, with the lesion placed on its rung, from cortex to muscle.', de: 'Die Untersuchung der Gliedmaßen und die Leiter des Nervensystems: Armvorhalteversuch, Finger-Nase-Versuch und Patellarsehnenreflex an der Patientenfigur, mit der Läsion auf ihrer Stufe, von der Rinde bis zum Muskel.' },
  stationEyesText: { en: 'The eye examination and the pathways it reads, side by side: pupils, movements, the cover test, nystagmus, the head impulse and the fields, with the reflex arc, the muscles and nerves, the labyrinths or the visual pathway.', de: 'Die Augenuntersuchung und die Bahnen, die sie prüft, nebeneinander: Pupillen, Motorik, Abdecktest, Nystagmus, Kopfimpuls und Gesichtsfeld, mit Reflexbogen, Muskeln und Nerven, Labyrinthen oder Sehbahn.' },
  stationShows: { en: 'shows', de: 'zeigt' }, stationNormal: { en: 'nothing abnormal', de: 'nichts Auffälliges' },
  openInStation: { en: 'Open in the station', de: 'In der Station öffnen' },
  openStationHealthy: { en: 'Open the station (a healthy heart)', de: 'Station öffnen (ein gesundes Herz)' },
  backToDebrief: { en: 'Debrief', de: 'Nachbesprechung' }, backToEncounter: { en: 'Patient', de: 'Patient' },
  stationText: { en: 'One test and the physiology that writes it, side by side: the ECG with the conduction system and the cardiac vector at every instant of the beat.', de: 'Ein Test und die Physiologie, die ihn schreibt, nebeneinander: das EKG mit dem Reizleitungssystem und dem Herzvektor in jedem Moment des Herzschlags.' },
  openStation: { en: 'Open the station', de: 'Station öffnen' },
  practiceTag: { en: 'Practice · draft', de: 'Übung · Entwurf' },
  practiceArrestTitle: { en: 'Cardiac arrest', de: 'Herz-Kreislauf-Stillstand' },
  practiceArrestText: { en: 'A man collapses in front of you. Compressions, breaths and the defibrillator, the clock running. No drugs yet.', de: 'Ein Mann bricht vor Ihnen zusammen. Kompressionen, Beatmung und Defibrillator, die Uhr läuft. Noch keine Medikamente.' },
  openPractice: { en: 'Start', de: 'Beginnen' },
  stationAuscText: { en: 'The heart sounds and the mechanics that make them, side by side: the phonocardiogram with a Wiggers diagram of every beat, its pressures, valves and phases.', de: 'Die Herztöne und die Mechanik, die sie erzeugt, nebeneinander: das Phonokardiogramm mit einem Wiggers-Diagramm jedes Schlags, seinen Drücken, Klappen und Phasen.' },
  preparing: { en: 'Bringing the patient to a steady state…', de: 'Der Patient erreicht einen stabilen Zustand…' },
  placeholder: { en: 'Ask or examine…', de: 'Fragen oder untersuchen…' }, send: { en: 'Go', de: 'Los' },
  feed: { en: 'Encounter', de: 'Verlauf' }, notes: { en: 'Notes', de: 'Notizen' }, mine: { en: 'My notes', de: 'Meine Notizen' },
  wait: { en: 'Wait 10 min', de: '10 min warten' }, commit: { en: 'Commit diagnosis', de: 'Diagnose festlegen' }, leave: { en: 'Ward', de: 'Übersicht' },
  whole: { en: 'All examinations', de: 'Alle Untersuchungen' }, tapHint: { en: 'You stand at the patient’s right: the near arm and leg are the right ones. Tap a part of the body, open all examinations, or type below to search.', de: 'Sie stehen rechts vom Patienten: der nahe Arm und das nahe Bein sind die rechten. Tippen Sie auf eine Körperregion, öffnen Sie alle Untersuchungen oder suchen Sie unten im Eingabefeld.' },
  tapHintLeft: { en: 'You stand at the patient’s left: the near arm and leg are the left ones. Tap a part of the body, open all examinations, or type below to search.', de: 'Sie stehen links vom Patienten: der nahe Arm und das nahe Bein sind die linken. Tippen Sie auf eine Körperregion, öffnen Sie alle Untersuchungen oder suchen Sie unten im Eingabefeld.' },
  tapHintFront: { en: 'You stand at the foot of the bed, facing the patient: their right is on your left. Tap a part of the body, open all examinations, or type below to search.', de: 'Sie stehen am Fußende und blicken den Patienten an: seine rechte Seite ist links von Ihnen. Tippen Sie auf eine Körperregion, öffnen Sie alle Untersuchungen oder suchen Sie unten im Eingabefeld.' },
  view: { en: 'View', de: 'Ansicht' }, viewRight: { en: 'Right side', de: 'Rechts' }, viewFront: { en: 'Front', de: 'Vorne' }, viewLeft: { en: 'Left side', de: 'Links' },
  figRight: { en: 'The patient, seen from the right side of the bed', de: 'Der Patient, von der rechten Bettseite gesehen' },
  figFront: { en: 'The patient, seen from the foot of the bed', de: 'Der Patient, vom Fußende gesehen' },
  figLeft: { en: 'The patient, seen from the left side of the bed', de: 'Der Patient, von der linken Bettseite gesehen' },
  sugExamine: { en: 'Examine', de: 'Untersuchen' }, sugOrder: { en: 'Order', de: 'Anordnen' }, sugAsk: { en: 'Ask', de: 'Fragen' },
  sugHint: { en: 'Type to search examinations, tests and questions in any language: “pupils”, “Knie-Hacke”, “chest pain?”. ↑↓ to choose, Enter to do it, Tab to fill in.', de: 'Tippen, um Untersuchungen, Tests und Fragen in jeder Sprache zu suchen: „Pupillen“, „heel shin“, „Brustschmerz?“. ↑↓ wählen, Enter ausführen, Tab übernehmen.' },
  aboutTest: { en: 'About this test', de: 'Über diese Untersuchung' }, assesses: { en: 'What it tests', de: 'Was sie prüft' }, howTo: { en: 'How to do it', de: 'Durchführung' },
  normalFinding: { en: 'Normal', de: 'Normalbefund' }, abnormalFinding: { en: 'Abnormal findings and what they mean', de: 'Pathologische Befunde und ihre Bedeutung' },
  seenIn: { en: 'Seen in', de: 'Vorkommen' }, pitfalls: { en: 'Pitfalls', de: 'Fallstricke' }, alsoCalled: { en: 'Also called', de: 'Auch' },
  signsWord: { en: 'Signs', de: 'Befunde' }, alsoShows: { en: 'This test can also show', de: 'Diese Untersuchung kann außerdem zeigen' },
  normalVariants: { en: 'Normal variants', de: 'Normvarianten' }, aboutSign: { en: 'About this sign', de: 'Zu diesem Befund' },
  normalVariantNote: { en: 'A normal finding: worth recognising so it is not taken for a sign of disease.', de: 'Ein Normalbefund: man sollte ihn kennen, damit man ihn nicht für ein Krankheitszeichen hält.' },
  simulated: { en: 'The simulated patients can show this sign.', de: 'Die simulierten Patienten können diesen Befund zeigen.' },
  notSimulated: { en: 'Taught here, but the simulation cannot show it yet.', de: 'Wird hier gelehrt, die Simulation kann ihn aber noch nicht zeigen.' },
  foundBy: { en: 'Found by', de: 'Erhoben durch' }, presentsAs: { en: 'How it presents', de: 'Wie er sich zeigt' },
  partOf: { en: 'Part of', de: 'Teil von' }, variantsWord: { en: 'Variants', de: 'Varianten' }, variantOf: { en: 'A variant of', de: 'Eine Variante von' },
  backWord: { en: 'Back', de: 'Zurück' },
  signsFoundWord: { en: 'Signs', de: 'Befunde' }, lookedFor: { en: 'Looked for, not found', de: 'Gesucht, nicht gefunden' },
  normalWord: { en: 'normal', de: 'normal' }, bothSides: { en: 'both sides', de: 'beidseits' },
  signsSoFar: { en: 'Signs found so far', de: 'Bisher erhobene Befunde' }, noSignsYet: { en: 'No signs named yet.', de: 'Noch keine Befunde benannt.' },
  signsInModel: { en: 'Signs this patient shows (from the model)', de: 'Befunde dieses Patienten (aus dem Modell)' },
  signsInModelHint: { en: 'Everything the simulation produces, whether or not it has been examined.', de: 'Alles, was die Simulation erzeugt, ob untersucht oder nicht.' },
  roleRequired: { en: 'required', de: 'obligat' }, roleAbsent: { en: 'absent', de: 'fehlt' }, roleAssociated: { en: 'associated, not counted', de: 'begleitend, nicht gezählt' },
  doIt: { en: 'Do it now', de: 'Jetzt durchführen' }, close: { en: 'Close', de: 'Schließen' },
  spoilerHidden: { en: 'The conditions it points to are shown after you commit to a diagnosis.', de: 'Die Krankheitsbilder dazu werden gezeigt, sobald Sie sich auf eine Diagnose festgelegt haben.' },
  left: { en: 'Left', de: 'Links' }, right: { en: 'Right', de: 'Rechts' }, which: { en: 'Which side?', de: 'Welche Seite?' },
  unknown: { en: 'Not understood. Rephrase it as a question to the patient or as an examination step.', de: 'Nicht verstanden. Formulieren Sie eine Frage an den Patienten oder einen Untersuchungsschritt.' },
  ordered: { en: 'Ordered', de: 'Angefordert' }, resultIn: { en: 'result in', de: 'Ergebnis in' },
  noResults: { en: 'Nothing ordered yet.', de: 'Noch nichts angefordert.' }, noNotes: { en: 'Notes are written as you go.', de: 'Notizen entstehen während der Untersuchung.' },
  myNotesHint: { en: 'Write your own notes. After you commit, they are shown next to the automatic ones.', de: 'Schreiben Sie eigene Notizen. Nach der Festlegung werden sie neben den automatischen gezeigt.' },
  position: { en: 'Position', de: 'Lagerung' }, exposed: { en: 'Exposed', de: 'Freigemacht' }, nothing: { en: 'nothing', de: 'nichts' },
  commitTitle: { en: 'Your differential', de: 'Ihre Differentialdiagnose' }, search: { en: 'Search diagnoses', de: 'Diagnosen suchen' },
  commitHint: { en: 'Add diagnoses in order of likelihood. The first is your working diagnosis.', de: 'Diagnosen nach Wahrscheinlichkeit ordnen. Die erste ist Ihre Arbeitsdiagnose.' },
  submit: { en: 'Commit', de: 'Festlegen' }, cancel: { en: 'Back to the patient', de: 'Zurück zum Patienten' },
  certain: { en: 'certain', de: 'sicher' }, likely: { en: 'likely', de: 'wahrscheinlich' }, possible: { en: 'possible', de: 'möglich' },
  debrief: { en: 'Debrief', de: 'Nachbesprechung' }, correct: { en: 'Working diagnosis correct', de: 'Arbeitsdiagnose richtig' },
  incorrect: { en: 'Working diagnosis not correct', de: 'Arbeitsdiagnose nicht richtig' },
  partly: { en: 'Right level, but not yet the cause', de: 'Richtige Ebene, aber noch nicht die Ursache' },
  levelSyndrome: { en: 'You named the syndrome. What is causing it?', de: 'Sie haben das Syndrom benannt. Was ist die Ursache?' },
  levelState: { en: 'You named the state. What is causing it?', de: 'Sie haben den Zustand benannt. Was ist die Ursache?' },
  levelLab: { en: 'You named the laboratory finding. What is causing it?', de: 'Sie haben den Laborbefund benannt. Was ist die Ursache?' }, diagnosisWas: { en: 'Diagnosis', de: 'Diagnose' },
  expert: { en: 'Expert assessment', de: 'Einschätzung der Expertin' }, evidence: { en: 'The evidence that decides this case', de: 'Die entscheidenden Befunde' },
  elicited: { en: 'found', de: 'erhoben' }, missed: { en: 'not elicited', de: 'nicht erhoben' },
  signFound: { en: 'found', de: 'gefunden' }, signNotFound: { en: 'not found', de: 'nicht gefunden' },
  signRuledOut: { en: 'looked for, rightly absent', de: 'gesucht, zu Recht nicht vorhanden' }, signNotLookedFor: { en: 'not looked for', de: 'nicht gesucht' },
  foundWith: { en: 'Found with', de: 'Gefunden mit' }, lookedForBy: { en: 'Looked for with', de: 'Gesucht mit' }, shownBy: { en: 'Shown by', de: 'Zu finden mit' },
  absentSign: { en: 'Absent:', de: 'Fehlt:' }, redFlags: { en: 'Red flags', de: 'Warnzeichen' },
  covered: { en: 'asked', de: 'erfragt' }, uncovered: { en: 'not asked', de: 'nicht erfragt' }, hazards: { en: 'Safety', de: 'Sicherheit' }, noHazards: { en: 'Nothing unsafe was done.', de: 'Nichts Unsicheres getan.' },
  time: { en: 'Time', de: 'Zeit' }, budget: { en: 'expert budget', de: 'Expertenbudget' }, ddxConsidered: { en: 'Differential you considered', de: 'Bedachte Differentialdiagnosen' },
  ddxMissed: { en: 'Worth considering too', de: 'Ebenfalls zu bedenken' }, compare: { en: 'Your notes and the automatic notes', de: 'Ihre und die automatischen Notizen' },
  how: { en: 'How the model produced what you found', de: 'Wie das Modell Ihre Befunde erzeugt hat' }, again: { en: 'Back to the ward', de: 'Zurück zur Übersicht' },
  explore: { en: 'Open the physiology of this patient', de: 'Die Physiologie dieses Patienten öffnen' },
  essential: { en: 'essential', de: 'wesentlich' }, discriminating: { en: 'discriminating', de: 'unterscheidend' }, supporting: { en: 'supporting', de: 'unterstützend' },
  min: { en: 'min', de: 'min' }, you: { en: 'You', de: 'Sie' },
  bedside: { en: 'Bedside', de: 'Am Bett' }, tests: { en: 'Tests', de: 'Diagnostik' }, physiology: { en: 'Physiology', de: 'Physiologie' }, model: { en: 'Model', de: 'Modell' },
  lockedTitle: { en: 'Opens after you commit', de: 'Öffnet nach der Festlegung' },
  lockedText: { en: 'The physiology and the model are this patient’s answer. They open once you have committed to a diagnosis.', de: 'Physiologie und Modell sind die Auflösung dieses Patienten. Sie öffnen sich, sobald Sie sich auf eine Diagnose festgelegt haben.' },
  orderTitle: { en: 'Order', de: 'Anfordern' }, atBedside: { en: 'At the bedside', de: 'Am Bett' }, laboratory: { en: 'Laboratory', de: 'Labor' }, imaging: { en: 'Imaging', de: 'Bildgebung' },
  recordYourself: { en: 'record it yourself', de: 'selbst schreiben' }, whatMeasures: { en: 'What this measures, and how', de: 'Was das misst, und wie' },
  pending: { en: 'pending', de: 'ausstehend' }, available: { en: 'at', de: 'um' }, value: { en: 'value', de: 'Wert' }, range: { en: 'reference', de: 'Referenz' },
  placementAsYou: { en: 'Recorded with the electrodes where you placed them', de: 'Mit den Elektroden aufgezeichnet, wo Sie sie platziert haben' },
  placementOk: { en: 'Electrodes at the standard positions.', de: 'Elektroden an den Standardpositionen.' },
  recordAgain: { en: 'Record another', de: 'Noch eines schreiben' }, openTests: { en: 'Open in Tests', de: 'Unter Diagnostik öffnen' },
  monitor: { en: 'Live', de: 'Live' },
};
const POSITION: Record<string, Record<Lang, string>> = {
  supine: { en: 'lying flat', de: 'flach liegend' }, 'reclined-45': { en: 'sitting at 45°', de: 'Oberkörper 45° hoch' },
  sitting: { en: 'sitting up', de: 'sitzend' }, 'sitting-forward': { en: 'sitting forward', de: 'vorgebeugt sitzend' },
  standing: { en: 'standing', de: 'stehend' }, 'left-lateral': { en: 'on the left side', de: 'in Linksseitenlage' },
  prone: { en: 'prone', de: 'in Bauchlage' }, 'head-hanging-left': { en: 'head hanging, turned left', de: 'Kopfhängelage links' }, 'head-hanging-right': { en: 'head hanging, turned right', de: 'Kopfhängelage rechts' },
};
const seedOf = (id: string) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 100000 + 1;

import { FREE_CASE } from './free-case.ts';
import { installReport } from './report.ts';
import { installRecorder, trailTail } from './session-record.ts';
import { mountEcgStation, type StationHandle } from './station-ecg.ts';
import { ECG_STATION, AUSCULTATION_STATION, EYE_STATION, PULSE_STATION, NEURO_STATION } from '../stations/station.ts';
type StationId = 'ecg' | 'auscultation' | 'eyes' | 'pulse' | 'neuro' | 'arrest';
import { mountAuscultationStation } from './station-auscultation.ts';
import { mountEyeStation } from './station-eyes.ts';
import { mountNeuroStation } from './station-neuro.ts';
import { mountPulseStation } from './station-pulse.ts';
import { mountArrestPractice } from './practice-arrest.ts';
import { motionSide, mountNeuroMotion, type NeuroMotion } from './neuro-motion-view.ts';
import type { FingerNoseFinding, ReflexGrade } from '../render/neuro-motion.ts';
import { pulseSignsOf } from '../stations/pulse-signs.ts';
import { eyeSignsOf } from '../stations/eye-signs.ts';
import { ecgSignsOf } from '../stations/ecg-signs.ts';
import { auscSignsOf } from '../stations/auscultation-signs.ts';

/* ---- feed ------------------------------------------------------------------------ */
type FeedItem =
  | { k: 'scene'; text: LocalizedText }
  | { k: 'you'; text: string }
  | { k: 'patient'; facts: string[]; topics: string[]; text: string; locale: Lang }
  | { k: 'act'; manoeuvre: string; side?: Side }
  | { k: 'blocked'; reason: string }
  | { k: 'finding'; finding: Finding }
  | { k: 'signs'; found: Array<{ sign: string; sides: Side[] }>; normal: string[]; absent: string[] }
  | { k: 'name'; test: string; side?: Side; candidates: string[] }
  | { k: 'order'; inv: string }
  | { k: 'result'; inv: string; value: unknown }
  | { k: 'system'; text: LocalizedText }
  | { k: 'side'; manoeuvre: string };

type Visual =
  | { kind: 'eyes'; controls: (now: number) => SceneControls }
  | { kind: 'auscultate'; site: string; bell: boolean; value: any; sound: 'heart' | 'lung' }
  | { kind: 'chest'; site: string; mode: ChestMode; value: any }
  | { kind: 'pulse'; finding: Finding }
  | { kind: 'face'; L: FaceFinding; R: FaceFinding }
  | { kind: 'ecg'; recorded?: number }
  | { kind: 'neuro'; motion: NeuroMotion; manoeuvre: ManoeuvreDef }
  | null;

/* ---- regions of the body for touch ---------------------------------------------- */
function regionOf(structure: string): string {
  let id: string | undefined = structure;
  while (id) {
    if (['head', 'neck', 'chest', 'abdomen', 'arm', 'legs'].includes(id)) return id;
    if (id === 'eye' || id === 'eyes' || id === 'ear') return 'head';
    if (id === 'hands') return 'arm';
    if (id === 'trunk') return 'chest';
    if (id === 'saddle') return 'abdomen';
    id = CATALOG.structures[id]?.parent;
  }
  return 'body';
}
const REGION_LABEL: Record<string, Record<Lang, string>> = {
  head: { en: 'Head, eyes and ears', de: 'Kopf, Augen und Ohren' }, neck: { en: 'Neck', de: 'Hals' }, chest: { en: 'Chest', de: 'Thorax' },
  abdomen: { en: 'Abdomen', de: 'Abdomen' }, arm: { en: 'Arm and hand', de: 'Arm und Hand' }, legs: { en: 'Legs', de: 'Beine' }, body: { en: 'Whole patient', de: 'Ganzer Patient' },
};
/* Auscultation sites ↔ manoeuvres. */
const SITE_ACT: Record<string, [string, Side?]> = {
  'chest.aortic-area': ['auscultate.heart.aortic'], 'chest.pulmonary-area': ['auscultate.heart.pulmonary'], 'chest.erb': ['auscultate.heart.erb'],
  'chest.tricuspid-area': ['auscultate.heart.tricuspid'], 'chest.mitral-area': ['auscultate.heart.mitral'],
  'neck.carotid.R': ['auscultate.carotid', 'R'], 'neck.carotid.L': ['auscultate.carotid', 'L'],
  'chest.lung-base.R': ['auscultate.lung-base', 'R'], 'chest.lung-base.L': ['auscultate.lung-base', 'L'],
};
/* Lung sites ↔ the manoeuvre for each way of examining them. */
const lungAct = (site: string, mode: ChestMode): [string, Side] | null => {
  const m = /^chest\.(upper-zone|mid-zone|axilla|upper-back|lung-base)\.(L|R)$/.exec(site);
  if (!m) return null;
  const key = m[1] === 'lung-base' ? 'base' : m[1];
  const verb = mode === 'listen' ? 'auscultate' : mode === 'percuss' ? 'percuss' : 'resonance';
  return [key === 'base' && verb === 'auscultate' ? 'auscultate.lung-base' : `${verb}.lung-${key}`, m[2] as Side];
};
const LUNG_PROPS = ['lung.sounds', 'chest.percussion', 'chest.resonance'];
const INV_GROUP = (inv: InvestigationDef): 'bedside' | 'laboratory' | 'imaging' =>
  ['ecg-12', 'glucose', 'peak-flow', 'spirometry'].includes(inv.id) ? 'bedside' : ['electrolytes', 'blood-gas', 'fbc', 'crp', 'cardiac-markers', 'd-dimer'].includes(inv.id) ? 'laboratory' : 'imaging';
const PANEL_NAMES: Record<string, [string, string, string]> = {
  sodium: ['Sodium', 'Natrium', 'mmol/L'], potassium: ['Potassium', 'Kalium', 'mmol/L'], chloride: ['Chloride', 'Chlorid', 'mmol/L'], bicarbonate: ['Bicarbonate', 'Bikarbonat', 'mmol/L'],
  urea: ['Urea', 'Harnstoff', 'mmol/L'], creatinine: ['Creatinine', 'Kreatinin', 'µmol/L'], arterialPH: ['pH', 'pH', ''], paCO2: ['PaCO₂', 'PaCO₂', 'kPa'], paO2: ['PaO₂', 'PaO₂', 'kPa'],
  lactate: ['Lactate', 'Laktat', 'mmol/L'], haemoglobin: ['Haemoglobin', 'Hämoglobin', 'g/L'], whiteCellCount: ['White cells', 'Leukozyten', '×10⁹/L'], platelets: ['Platelets', 'Thrombozyten', '×10⁹/L'],
  mcv: ['MCV', 'MCV', 'fL'], troponin: ['Troponin', 'Troponin', 'ng/L'], bnp: ['BNP', 'BNP', 'ng/L'], crp: ['CRP', 'CRP', 'mg/L'],
  baseExcess: ['Base excess', 'Basenüberschuss', 'mmol/L'], saO2: ['SaO₂ (co-oximetry)', 'SaO₂ (CO-Oxymetrie)', '%'], coHb: ['Carboxyhaemoglobin', 'Carboxyhämoglobin', '%'],
  metHb: ['Methaemoglobin', 'Methämoglobin', '%'], fio2: ['FiO₂ when taken', 'FiO₂ bei Abnahme', ''],
};

export function mount(root: HTMLElement) {
  let lang: Lang = (navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en';
  let s: Session | null = null;
  let base: CaseDef = FREE_CASE;
  let free = false;
  let committed = false;
  let live: LivePatient | null = null;
  let layer: Layer = 'bedside';
  let chapter = 'haemodynamics';
  let chapterHandle: ChapterHandle | null = null;
  let labTick: (() => void) | null = null;
  const labOpen = new Set<string>(['haemodynamics', 'electrical']);
  let feed: FeedItem[] = [];
  /* The signs named so far in this encounter, with the sides they were found on ('' = no side). */
  let signsSeen = new Map<string, Set<string>>();
  /* Who names the signs: the app (guided) or the learner (observe only, ADR-016 §11.5). Remembered on this device. */
  let level: 'guided' | 'observe' = (() => { try { return localStorage.getItem('vp.level') === 'observe' ? 'observe' : 'guided'; } catch { return 'guided'; } })();
  let nameQuery = '';
  let shownResults = new Set<string>();
  let visual: Visual = null;
  let tab: 'feed' | 'notes' | 'mine' = 'feed';
  let myNotes = '';
  let ddx: Commit[] = [];
  let debrief: DebriefResult | null = null;
  let region: { id: string; side?: Side } | null = null;
  let eyeView: EyeView | null = null;
  let faceView: FaceView | null = null;
  let stopVisual: (() => void) | null = null;
  const overlays = { anatomy: false, landmarks: false };
  const chestOverlays = { lobes: false, landmarks: false };
  let placement: Partial<Placement> = {};
  const traces = new Map<number, { leads: Record<LeadName, Float32Array>; fs: number }>();
  /* What an X-ray or a spirometer recorded at the moment it was taken, keyed by the result event. */
  const shots = new Map<number, { resp: any; circ: Record<string, any>; curve?: SpiroCurve; shift: number }>();
  let liveOff: (() => void) | null = null;
  let tick = 0;
  let station: StationHandle | null = null;

  const t = (k: string) => UI[k]?.[lang] ?? k;
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const minutes = () => (s ? Math.round(s.t / 60000) : 0);

  /* ---- screens ------------------------------------------------------------------- */
  const show = (id: 'ward' | 'encounter' | 'debrief' | 'station') => {
    for (const x of ['ward', 'encounter', 'debrief', 'station']) ($(`#${x}`)).hidden = x !== id;
    if (id !== 'station') { station?.stop(); station = null; }
    window.scrollTo(0, 0);
  };

  const renderWard = () => {
    $('#ward-title').textContent = t('ward');
    $('#ward-lede').textContent = t('wardLede');
    const lv = $('#ward-level');
    lv.innerHTML = `<span class="lv-label">${esc(t('levelLabel'))}</span>
      <span class="seg" role="radiogroup" aria-label="${esc(t('levelLabel'))}">${(['guided', 'observe'] as const).map((x) => `<button type="button" role="radio" aria-checked="${level === x}" data-level="${x}">${esc(t(x === 'guided' ? 'levelGuided' : 'levelObserve'))}</button>`).join('')}</span>
      <span class="muted small">${esc(t(level === 'guided' ? 'levelGuidedHint' : 'levelObserveHint'))}</span>`;
    lv.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => b.onclick = () => { level = b.dataset.level as typeof level; try { localStorage.setItem('vp.level', level); } catch { /* ignore */ } renderWard(); });
    const wl = $('#ward-list');
    wl.innerHTML = '';
    for (const c of CASES) {
      const card = document.createElement('article');
      card.className = 'bedcard';
      card.innerHTML = `<div class="bed-place">${esc(tr(c.setting.place, lang))}</div>
        <h2>${esc(c.patient.name)}</h2>
        <div class="bed-meta">${c.patient.age} · ${c.patient.sex === 'F' ? (lang === 'de' ? 'weiblich' : 'female') : (lang === 'de' ? 'männlich' : 'male')}</div>
        <p class="bed-triage">${esc(tr(c.setting.triage, lang))}</p>
        <button type="button" class="primary">${t('see')}</button>`;
      card.querySelector('button')!.onclick = () => start(c);
      wl.appendChild(card);
    }
    const fc = document.createElement('article');
    fc.className = 'bedcard free';
    fc.innerHTML = `<span class="tag">${t('lab')}</span><h2>${t('freeTitle')}</h2>
      <div class="bed-meta">${FREE_CASE.patient.age} · ${lang === 'de' ? 'männlich' : 'male'}</div>
      <p class="bed-triage">${t('freeText')}</p><button type="button" class="primary">${t('openFree')}</button>`;
    fc.querySelector('button')!.onclick = () => start(null);
    wl.appendChild(fc);
    const sc = document.createElement('article');
    sc.className = 'bedcard free';
    sc.innerHTML = `<span class="tag">${t('stationTag')}</span><h2>${esc(tr(ECG_STATION.title, lang))}</h2>
      <p class="bed-triage">${t('stationText')}</p><button type="button" class="primary">${t('openStation')}</button>`;
    sc.querySelector('button')!.onclick = () => openStation('ecg');
    wl.appendChild(sc);
    const ac = document.createElement('article');
    ac.className = 'bedcard free';
    ac.innerHTML = `<span class="tag">${t('stationTag')}</span><h2>${esc(tr(AUSCULTATION_STATION.title, lang))}</h2>
      <p class="bed-triage">${t('stationAuscText')}</p><button type="button" class="primary">${t('openStation')}</button>`;
    ac.querySelector('button')!.onclick = () => openStation('auscultation');
    wl.appendChild(ac);
    const ec = document.createElement('article');
    ec.className = 'bedcard free';
    ec.innerHTML = `<span class="tag">${t('stationTag')}</span><h2>${esc(tr(EYE_STATION.title, lang))}</h2>
      <p class="bed-triage">${t('stationEyesText')}</p><button type="button" class="primary">${t('openStation')}</button>`;
    ec.querySelector('button')!.onclick = () => openStation('eyes');
    wl.appendChild(ec);
    const nc = document.createElement('article');
    nc.className = 'bedcard free';
    nc.innerHTML = `<span class="tag">${t('stationTag')}</span><h2>${esc(tr(NEURO_STATION.title, lang))}</h2>
      <p class="bed-triage">${t('stationNeuroText')}</p><button type="button" class="primary">${t('openStation')}</button>`;
    nc.querySelector('button')!.onclick = () => openStation('neuro');
    wl.appendChild(nc);
    const pc = document.createElement('article');
    pc.className = 'bedcard free';
    pc.innerHTML = `<span class="tag">${t('stationTag')}</span><h2>${esc(tr(PULSE_STATION.title, lang))}</h2>
      <p class="bed-triage">${t('stationPulseText')}</p><button type="button" class="primary">${t('openStation')}</button>`;
    pc.querySelector('button')!.onclick = () => openStation('pulse');
    wl.appendChild(pc);
    const ar = document.createElement('article');
    ar.className = 'bedcard free';
    ar.innerHTML = `<span class="tag">${t('practiceTag')}</span><h2>${t('practiceArrestTitle')}</h2>
      <p class="bed-triage">${t('practiceArrestText')}</p><button type="button" class="primary">${t('openPractice')}</button>`;
    ar.querySelector('button')!.onclick = () => openStation('arrest');
    wl.appendChild(ar);
  };
  /* A station opens on a healthy heart from the Ward, or on the patient being examined (ADR-017 step 5). On a patient only
     when the mechanism is no longer a spoiler: in the free lab, or once the learner has committed to a diagnosis. Back returns
     to the screen it was opened from, with the encounter as it was. */
  let stationNow: StationId | null = null;
  const openStation = (which: StationId, onPatient = false) => {
    const from = (['encounter', 'debrief'] as const).find((x) => !$(`#${x}`).hidden) ?? 'ward';
    const withPatient = onPatient && !!live && !!s && (free || committed);
    if (from === 'ward') stopLive(); else live?.stop();
    show('station');
    stationNow = which;
    const mount = which === 'ecg' ? mountEcgStation : which === 'eyes' ? mountEyeStation : which === 'neuro' ? mountNeuroStation : which === 'pulse' ? mountPulseStation : which === 'arrest' ? mountArrestPractice : mountAuscultationStation;
    station = mount($('#station'), {
      lang,
      ...(withPatient ? { patient: { model: structuredClone(live!.model), name: { en: base.patient.name, de: base.patient.name } } } : {}),
      ...(from === 'debrief' ? { backLabel: UI.backToDebrief } : from === 'encounter' ? { backLabel: UI.backToEncounter } : {}),
      onLeave: () => {
        if (from === 'ward') { renderWard(); show('ward'); }
        else if (from === 'debrief') show('debrief');
        else { show('encounter'); live?.start(); renderEncounter(); }
      },
    });
  };
  /* every "open in station" button, wherever it is drawn (cards, results, the debrief) */
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-open-station]');
    if (!b) return;
    if (!$('#card').hidden) showCard(null);
    openStation(b.dataset.openStation as StationId, b.dataset.onPatient === '1');
  });

  /* ---- the running patient ---------------------------------------------------------- */
  const syncView = () => {
    if (!s || !live) return;
    s.view.circulation = live.snap;
    s.view.chemistry = live.chemistry;
    s.view.respiratory = live.snap.resp;
  };
  const applyModel = (m: PatientModel) => {
    if (!s || !live) return;
    live.setModel(m);
    s.caseDef = caseWithModel(FREE_CASE, m);
    const state = s.state;
    s.view = buildView(s.caseDef, { circulation: live.snap, chemistry: live.chemistry, state });
    s.view.state = state;
    renderFigure(true);
    if (layer === 'model') renderLayer();
  };

  /* ---- start -------------------------------------------------------------------- */
  const start = async (c: CaseDef | null) => {
    stopLive();
    free = !c;
    base = c ?? FREE_CASE;
    committed = free;
    const model = free ? healthyModel() : modelFromCase(base);
    const ward = $('#ward-list');
    ward.insertAdjacentHTML('beforebegin', `<p class="muted" id="preparing">${t('preparing')}</p>`);
    live = new LivePatient(model);
    await live.settle(20);
    $('#preparing')?.remove();
    const caseDef = free ? caseWithModel(FREE_CASE, model) : base;
    s = startEncounter(CATALOG, REGISTRY, caseDef, buildView(caseDef, { circulation: live.snap, chemistry: live.chemistry }), { locale: lang });
    signsSeen = new Map(); nameQuery = '';
    s.observeOnly = level === 'observe' && !free;
    feed = [{ k: 'scene', text: { en: `${tr(base.setting.place, 'en')}. ${tr(base.setting.triage, 'en')}`, de: `${tr(base.setting.place, 'de')}. ${tr(base.setting.triage, 'de')}` } }];
    const open = base.history.filter((f) => f.volunteered);
    if (open.length) feed.push({ k: 'patient', facts: open.map((f) => f.id), topics: [], text: opening(s), locale: lang });
    s.encounter.events.push({ t: 0, kind: 'utterance', from: 'patient', locale: lang, text: opening(s), facts: open.map((f) => f.id) });
    shownResults = new Set(); visual = null; tab = 'feed'; myNotes = ''; ddx = []; debrief = null; region = null; placement = {}; traces.clear();
    layer = 'bedside';
    ($('#mynotes') as HTMLTextAreaElement).value = '';
    setVisual(null);
    show('encounter');
    renderEncounter();
    renderLayer();
    live.start();
    liveOff = live.on(() => { if (++tick % 15 === 0) { labTick?.(); } });
    $('#cmd').focus();
  };
  const stopLive = () => { liveOff?.(); liveOff = null; live?.stop(); chapterHandle?.stop(); chapterHandle = null; labTick = null; };

  /* ---- performing ------------------------------------------------------------------ */
  const afterTime = (before: number) => {
    if (!s) return;
    const applied = s.appliedCourse.size;
    advanceCourse(s);
    if (s.appliedCourse.size > applied) {
      (s.caseDef.course ?? []).forEach((ev, i) => {
        if (s!.appliedCourse.has(i) && ev.atMinutes * 60000 > before && ev.note && !ev.unless?.some((u) => s!.done.has(u))) feed.push({ k: 'system', text: ev.note });
      });
    }
    for (const e of s.encounter.events) {
      if (e.kind === 'result' && e.t <= s.t && !shownResults.has(`${e.test}@${e.t}`)) {
        shownResults.add(`${e.test}@${e.t}`);
        feed.push({ k: 'result', inv: e.test, value: e.value });
        if (e.revealed) resultSigns(e);
      }
    }
  };
  /* A result a reader looks at (the ECG, ADR-017) shows signs as a test does: named by the app, or offered for the
     learner to name at the observe-only level. Read from what the result recorded when it was taken. */
  const resultSigns = (e: { test: string; revealed?: Record<string, unknown> }) => {
    if (!s) return;
    if (s.observeOnly) {
      const candidates = signsTestLooksFor(KNOWLEDGE, CATALOG, e.test);
      if (candidates.length) feed.push({ k: 'name', test: e.test, candidates });
      return;
    }
    const sf = signsInResult(s, e);
    if (sf.found.length || sf.normal.length || sf.absent.length) feed.push({ k: 'signs', ...sf });
    for (const f of sf.found) { const set = signsSeen.get(f.sign) ?? new Set<string>(); set.add(''); signsSeen.set(f.sign, set); }
  };

  const doAction = (id: string, side?: Side) => {
    if (!s) return;
    const m = CATALOG.manoeuvres[id];
    if (m.paired && !side) { feed.push({ k: 'side', manoeuvre: id }); renderEncounter(); return; }
    syncView();
    const before = s.t;
    feed.push({ k: 'act', manoeuvre: id, side });
    const r = perform(s, id, side);
    if (r.outcome === 'blocked') feed.push({ k: 'blocked', reason: r.reason! });
    if (r.outcome === 'performed' && m.sets?.oxygen) breatheOxygen();
    for (const f of r.findings) feed.push({ k: 'finding', finding: f });
    if (r.outcome === 'performed') {
      /* Name the signs this test found (only from its own observations), and at general inspection the signs the
         bedside figure shows. */
      const observe = (ref: string, ctx: ExamContext) => observeIn(s!, ref, ctx);
      if (s!.observeOnly) {
        const candidates = [...new Set([...signsTestLooksFor(KNOWLEDGE, CATALOG, id), ...(id === 'inspect.general' ? signsTheFigureCanShow(KNOWLEDGE, CATALOG) : [])])];
        if (candidates.length) feed.push({ k: 'name', test: id, side, candidates });
        visualFor(m, side, r.findings);
        afterTime(before);
        renderEncounter();
        return;
      }
      const sf = signsFoundBy(KNOWLEDGE, CATALOG, observe, id, side);
      if (id === 'inspect.general') for (const x of signsOnTheFigure(KNOWLEDGE, CATALOG, observe)) if (!sf.found.some((f) => f.sign === x)) sf.found.push({ sign: x, sides: [] });
      sf.absent = sf.absent.filter((x) => !sf.found.some((f) => f.sign === x));
      if (sf.found.length || sf.normal.length || sf.absent.length) feed.push({ k: 'signs', ...sf });
      for (const f of sf.found) { const set = signsSeen.get(f.sign) ?? new Set<string>(); for (const x of f.sides.length ? f.sides : ['']) set.add(x); signsSeen.set(f.sign, set); }
      visualFor(m, side, r.findings);
    }
    afterTime(before);
    renderEncounter();
  };

  /* Oxygen is a device on the patient and an inspired fraction in the model: the running lungs breathe it from now on. */
  const breatheOxygen = () => {
    if (!s || !live) return;
    const fio2 = s.state.oxygen?.fio2 ?? 0.21;
    const next = { ...live.model, respiratory: { ...live.model.respiratory, FiO2: fio2 } };
    if (free) applyModel(next); else { live.setModel(next); syncView(); }
  };

  const submit = (text: string) => {
    if (!s || !text.trim()) return;
    feed.push({ k: 'you', text });
    const i = interpret(CATALOG, text, lang);
    if (i.kind === 'ask') {
      const before = s.t;
      const r = ask(s, text, lang);
      feed.push({ k: 'patient', facts: r.facts.map((f) => f.id), topics: r.topics, text: r.text, locale: lang });
      afterTime(before);
      renderEncounter();
    } else if (i.kind === 'act') { feed.pop(); feed.push({ k: 'you', text }); doAction(i.manoeuvre, i.side); }
    else if (i.kind === 'order') { if (i.investigation === 'ecg-12') { setLayer('bedside'); setVisual({ kind: 'ecg' }); renderEncounter(); } else doOrder(i.investigation); }
    else { feed.push({ k: 'system', text: UI.unknown as LocalizedText }); renderEncounter(); }
  };

  const doOrder = (inv: string) => {
    if (!s || !live) return;
    syncView();
    order(s, inv);
    if (['cxr', 'spirometry', 'ctpa'].includes(inv)) {
      const tr0 = RESP_RESOLVERS['resp.trachea'](s.view, { property: 'trachea.position' }, {});
      const shiftTxt = /index (-?[0-9.]+)/.exec(tr0?.basis ?? '');
      shots.set(s.encounter.events.length - 1, {
        resp: structuredClone(live.snap.resp), circ: { metrics: { ...(live.snap.metrics ?? {}) } },
        curve: inv === 'spirometry' ? live.run.resp.forcedExpiration() : undefined, shift: shiftTxt ? +shiftTxt[1] : 0,
      });
    }
    feed.push({ k: 'order', inv });
    afterTime(s.t);
    renderEncounter();
    if (layer === 'tests') renderLayer();
  };

  /* An ECG the learner records: the last ten seconds of the heart's dipole, through the electrodes where they put them. */
  const recordEcg = (p: Placement) => {
    if (!s || !live) return;
    syncView();
    placement = p;
    const vcg = live.vcg(10);
    const leads = recordLeads(vcg, p);
    const axis = measuredAxis(leads, vcg.fs);
    const before = s.t;
    /* What a reader sees in this tracing, through the electrodes where the learner put them. */
    const reading = live.snap.electrical && live.snap.ecgDrive ? readEcg(live.snap.electrical, live.snap.ecgDrive, p) : undefined;
    order(s, 'ecg-12', { performed: true, detail: { placement: p }, patch: (v) => ({ ...v, axis: axis ?? v.axis }), ...(reading ? { revealed: { 'ecg.reading': reading } } : {}) });
    const idx = s.encounter.events.length - 1;
    traces.set(idx, { leads, fs: vcg.fs });
    feed.push({ k: 'order', inv: 'ecg-12' });
    afterTime(before);
    setVisual({ kind: 'ecg', recorded: idx });
    renderEncounter();
  };

  /* ---- what the examiner sees and hears ------------------------------------------- */
  /* The chest views draw this patient's own body (build, sex, age, fat, wasting, ascites, colour), as the bedside
     figure does. */
  const look = (): ThoraxLook => {
    const ap = appearanceOf(s!.caseDef.patient, seedOf(base.id));
    return { skin: ap.skin, shade: ap.skinShade, sex: s!.caseDef.patient.sex, figure: figureLookFor(s!.caseDef.patient, s!.state, seedOf(base.id), figureFindings()) };
  };
  const visualFor = (m: ManoeuvreDef, side: Side | undefined, findings: Finding[]) => {
    if (!s) return;
    const eyeIds = ['inspect.eyes', 'inspect.eyes.dim', 'test.pupils.light', 'test.swinging-light', 'test.eye-movements', 'test.frenzel', 'test.head-impulse', 'test.cover',
      'inspect.sclera', 'inspect.conjunctiva', 'inspect.thyroid-eyes'];
    if (eyeIds.includes(m.id)) {
      const b: SceneControls = { gaze: 'primary', fixation: true, lightOn: 'none', ambient: m.id === 'inspect.eyes.dim' ? 'dim' : 'room', cover: null };
      const gazes = ['primary', 'left', 'right', 'up', 'down'] as const;
      const t0 = performance.now();
      const controls = (now: number): SceneControls => {
        const el = Math.max(0, (now - t0) / 1000);
        switch (m.id) {
          case 'test.pupils.light': return { ...b, lightOn: el % 4 < 2.5 ? side! : 'none' };
          case 'test.swinging-light': return { ...b, lightOn: Math.floor(el / 1.6) % 2 ? 'L' : 'R' };
          case 'test.eye-movements': return { ...b, gaze: gazes[Math.floor(el / 2.5) % 5] };
          case 'test.frenzel': return { ...b, fixation: false, gaze: gazes[Math.floor(el / 3) % 5] };
          case 'test.head-impulse': return { ...b, impulse: el % 2.4 < 1 ? { to: side!, t: el % 2.4 } : undefined };
          case 'test.cover': return { ...b, cover: Math.floor(el / 1.6) % 2 ? 'L' : 'R' };
          /* the body in the eye: the sclera looking up, the lower lid drawn down, the lids following a finger down */
          case 'inspect.sclera': return { ...b, gaze: 'up' };
          case 'inspect.conjunctiva': return { ...b, gaze: 'up', pullLowerLids: 1 };
          case 'inspect.thyroid-eyes': return { ...b, gaze: Math.floor(el / 2.5) % 2 ? 'down' : 'primary' };
          default: return b;
        }
      };
      setVisual({ kind: 'eyes', controls });
      return;
    }
    /* the neurological tests that move: the bedside figure does them, driven by the finding (ADR-017 decision 10) */
    const fv = (prop: string) => findings.find((f) => f.property === prop)?.value as Record<string, any> | undefined;
    const driftL = fv('arm.drift.L'), driftR = fv('arm.drift.R');
    if (m.id === 'test.pronator-drift' && (driftL || driftR)) { setVisual({ kind: 'neuro', manoeuvre: m, motion: { kind: 'drift', finding: { drift: [!!driftR?.drift, !!driftL?.drift] } } }); return; }
    const fnSide = (['L', 'R'] as const).find((sd) => fv(`arm.finger-nose.${sd}`));
    if (m.id === 'test.finger-nose' && fnSide) { setVisual({ kind: 'neuro', manoeuvre: m, motion: { kind: 'finger-nose', side: fnSide, finding: fv(`arm.finger-nose.${fnSide}`) as FingerNoseFinding } }); return; }
    const kneeSide = (['L', 'R'] as const).find((sd) => typeof fv(`leg.reflexes.${sd}`)?.knee === 'number');
    if (m.id === 'test.leg.reflexes' && kneeSide) { setVisual({ kind: 'neuro', manoeuvre: m, motion: { kind: 'knee-jerk', side: kneeSide, grade: fv(`leg.reflexes.${kneeSide}`)!.knee as ReflexGrade } }); return; }
    const hsSide = (['L', 'R'] as const).find((sd) => fv(`leg.heel-shin.${sd}`));
    if (m.id === 'test.heel-shin' && hsSide) { setVisual({ kind: 'neuro', manoeuvre: m, motion: { kind: 'heel-shin', side: hsSide, finding: fv(`leg.heel-shin.${hsSide}`) as any } }); return; }
    const raSide = (['L', 'R'] as const).find((sd) => fv(`arm.rapid-alternating.${sd}`));
    if (m.id === 'test.rapid-alternating' && raSide) { setVisual({ kind: 'neuro', manoeuvre: m, motion: { kind: 'rapid-alternating', side: raSide, finding: fv(`arm.rapid-alternating.${raSide}`) as any } }); return; }
    if (m.id === 'test.romberg') {
      const rf = (closed: boolean) => findings.find((f) => f.property === 'posture.romberg' && !!f.context?.eyesClosed === closed)?.value as any;
      if (rf(false) || rf(true)) { setVisual({ kind: 'neuro', manoeuvre: m, motion: { kind: 'romberg', open: rf(false) ?? { stance: 'steady' }, closed: rf(true) ?? { stance: 'steady' } } }); return; }
    }
    if (m.id === 'test.gait' && fv('gait.pattern')) { setVisual({ kind: 'neuro', manoeuvre: m, motion: { kind: 'gait', finding: fv('gait.pattern') as any } }); return; }
    const faceL = findings.find((f) => f.property === 'face.movement.L'), faceR = findings.find((f) => f.property === 'face.movement.R');
    if (faceL && faceR) { setVisual({ kind: 'face', L: faceL.value as FaceFinding, R: faceR.value as FaceFinding }); return; }
    const chest = findings.find((f) => LUNG_PROPS.includes(f.property) && /^chest\.(upper-zone|mid-zone|axilla|upper-back|lung-base)\./.test(f.context?.site ?? ''));
    if (chest) {
      const mode: ChestMode = chest.property === 'chest.percussion' ? 'percuss' : chest.property === 'chest.resonance' ? 'voice' : 'listen';
      setVisual({ kind: 'chest', site: chest.context!.site!, mode, value: chest.value });
      return;
    }
    const heart = findings.find((f) => f.property === 'heart.sounds');
    const lung = findings.find((f) => f.property.startsWith('lung.sounds'));
    if (heart || lung || m.verb === 'auscultate') {
      const ctxSite = (heart ?? lung)?.context?.site ?? m.context?.site ?? 'chest.aortic-area';
      const site = side && !/\.(L|R)$/.test(ctxSite) && /carotid|lung-base/.test(ctxSite) ? `${ctxSite}.${side}` : ctxSite;
      setVisual({ kind: 'auscultate', site, bell: (heart?.context?.instrument ?? m.context?.instrument) === 'stethoscope-bell', value: (heart ?? lung)?.value ?? {}, sound: heart ? 'heart' : 'lung' });
      return;
    }
    const pulse = findings.find((f) => f.property.startsWith('pulse.'));
    if (pulse) { setVisual({ kind: 'pulse', finding: pulse }); return; }
    if (m.verb !== 'position' && m.verb !== 'expose') setVisual(null);
  };

  const setVisual = (v: Visual) => {
    visual = v;
    eyeView?.stop(); faceView?.stop(); stopVisual?.(); stopVisual = null;
    const host = $('#visual');
    host.hidden = !v;
    if (!v || !s) return;
    const c = s.caseDef;
    if (v.kind === 'eyes') {
      host.innerHTML = '<div class="eyehost"></div>';
      eyeView = new EyeView(host.querySelector('.eyehost')!, appearanceOf(c.patient, seedOf(base.id)));
      eyeView.show((k) => sceneFindings(CATALOG, REGISTRY, c, s!.view, k), v.controls);
      return;
    }
    if (v.kind === 'face') {
      host.innerHTML = '<div class="facehost"></div>';
      faceView = new FaceView(host.querySelector('.facehost')!, appearanceOf(c.patient, seedOf(base.id)));
      faceView.show({ L: v.L, R: v.R }, lang);
      return;
    }
    if (v.kind === 'neuro') {
      const sd = motionSide(v.motion);
      /* of the leg reflexes only the knee jerk is drawn so far */
      const name = v.motion.kind === 'knee-jerk' ? (lang === 'de' ? 'Patellarsehnenreflex' : 'Knee jerk') : tr(v.manoeuvre.label, lang);
      const what = v.motion.kind === 'romberg' || v.motion.kind === 'gait' || v.motion.kind === 'drift' ? name : `${name} · ${t(sd === 'L' ? 'left' : 'right').toLowerCase()}`;
      stopVisual = mountNeuroMotion(host, { look: look().figure, motion: v.motion, caption: what, label: what });
      return;
    }
    if (v.kind === 'auscultate') {
      const hr = (live?.snap.metrics?.HRbeat as number | undefined) ?? 72;
      const where = CATALOG.structures[v.site.replace(/\.(L|R)$/, '')]?.label;
      const sideTxt = /\.L$/.test(v.site) ? ` (${t('left').toLowerCase()})` : /\.R$/.test(v.site) ? ` (${t('right').toLowerCase()})` : '';
      stopVisual = mountAuscultation(host, {
        look: look(), site: v.site, bell: v.bell, value: v.value, kind: v.sound, hr, lang, overlays, timing: live?.snap.valveTimes ?? null,
        caption: `${where ? tr(where, lang) : v.site}${sideTxt} · ${v.bell ? (lang === 'de' ? 'Glocke' : 'bell') : (lang === 'de' ? 'Membran' : 'diaphragm')}`,
        onListenAt: (site) => { const a = SITE_ACT[site] ?? lungAct(site, 'listen'); if (a) doAction(a[0], a[1]); },
      });
      return;
    }
    if (v.kind === 'chest') {
      const r = live?.snap.resp;
      const where = CATALOG.structures[v.site.replace(/\.(L|R)$/, '')]?.label;
      const sideTxt = /\.L$/.test(v.site) ? ` (${t('left').toLowerCase()})` : ` (${t('right').toLowerCase()})`;
      stopVisual = mountChest(host, {
        look: look(), site: v.site, mode: v.mode, value: v.value, lang, overlays: chestOverlays,
        breathing: { rr: r?.RR ?? 14, ti: r?.Ti ?? 1.7, tauE: r?.tauE ?? 0.25 },
        caption: `${where ? tr(where, lang) : v.site}${sideTxt}`,
        onExamAt: (site, mode) => { const a = lungAct(site, mode); if (a) doAction(a[0], a[1]); },
      });
      return;
    }
    if (v.kind === 'ecg') {
      host.innerHTML = '<div data-place></div><div data-paper></div>';
      if (v.recorded == null) {
        stopVisual = mountEcgPlacement(host.querySelector('[data-place]') as HTMLElement, {
          look: look(), lang, placement, chestExposed: (s.state.exposure ?? []).includes('chest'),
          onExpose: () => { doAction('expose.chest'); setVisual({ kind: 'ecg' }); },
          onRecord: recordEcg,
          source: monitorSource() ?? undefined,
          onChange: (p) => { placement = p; renderBedMonitor(); },
        });
      } else {
        const box = host.querySelector('[data-paper]') as HTMLElement;
        box.innerHTML = ecgCard(v.recorded, true);
        paintPapers(box);
        box.querySelector<HTMLButtonElement>('[data-again]')!.onclick = () => setVisual({ kind: 'ecg' });
        box.querySelector<HTMLButtonElement>('[data-to-tests]')!.onclick = () => setLayer('tests');
      }
      return;
    }
    // pulse: the arterial pressure wave of the running patient, as the fingers would follow it
    host.innerHTML = `<div class="trace-head"><span class="trace-label">${lang === 'de' ? 'Pulskurve (arterieller Druck aus dem laufenden Kreislaufmodell)' : 'Pulse wave (arterial pressure from the running circulation)'}</span></div><canvas class="phono"></canvas>`;
    const canvas = host.querySelector('canvas')!;
    const hist: number[] = [];
    const off = live!.on((p) => { hist.push(p.snap.P); if (hist.length > 300) hist.shift(); });
    let raf = 0;
    const frame = () => {
      const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const g = canvas.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      if (hist.length > 2) {
        const lo = Math.min(...hist), hi = Math.max(...hist);
        drawSweep(g, hist, 0, 6, w, h - 12, getComputedStyle(root).getPropertyValue('--trace').trim(), Math.max(10, (hi - lo) * 1.15));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    stopVisual = () => { off(); cancelAnimationFrame(raf); };
  };

  /* ---- results -------------------------------------------------------------------------- */
  const physicsDetails = (inv: InvestigationDef) => inv.measurement ? `<details class="physics"><summary>${t('whatMeasures')}</summary><p>${esc(tr(inv.measurement.physics, lang))}</p>
    ${committed ? `<div class="measures">${inv.measurement.measures.map((x) => VARIABLE_BY_ID[x]).filter(Boolean).map((v) => `<button type="button" data-goto="${v.id}">${symbolMathML(v.symbol)} ${esc(tr(v.label, lang))}</button>`).join('')}</div>` : ''}</details>` : '';
  const ecgCard = (idx: number, inBedside = false) => {
    const e = s!.encounter.events[idx];
    if (!e || e.kind !== 'result') return '';
    const inv = CATALOG.investigations['ecg-12'];
    const p = (e.detail?.placement as Placement | undefined) ?? standardPlacement();
    const review = placementReview(p, lang);
    return `<article class="panel result"><header><b>${esc(tr(inv.label, lang))}</b><span>${Math.round(e.t / 60000)} ${t('min')}</span></header>
      <p class="ecg-line">${esc(REGISTRY.formatters[inv.formatter](e.value, {}, lang, CATALOG, { property: inv.id }).replace(/ (The tracing is under Results|Die Kurve liegt unter Befunde)\.$/, ''))}</p>
      ${traces.has(idx) ? `<div class="paper-wrap"><canvas data-paper-idx="${idx}"></canvas></div>
        <div class="focus-tools"><button type="button" class="tog small" data-measure="${idx}" aria-pressed="false">${lang === 'de' ? 'Ausmessen: Zirkel, Lineal, Kästchen' : 'Measure: calipers, ruler, squares'}</button></div>
        <div class="measure-panel" data-measure-panel="${idx}" hidden></div>` : ''}
      <p class="focus-caption">${e.detail ? t('placementAsYou') : ''}${review.length ? `: ${esc(review.join('; '))}` : (e.detail ? `. ${t('placementOk')}` : '')}</p>
      ${inBedside ? `<div class="focus-tools"><button type="button" class="ghost small" data-again>${t('recordAgain')}</button><button type="button" class="ghost small" data-to-tests>${t('openTests')}</button></div>` : physicsDetails(inv)}
      ${free || committed ? `<div class="focus-tools"><button type="button" class="ghost small" data-open-station="ecg" data-on-patient="1">${t('openInStation')}</button></div>` : ''}</article>`;
  };
  const paintPapers = (box: HTMLElement) => {
    box.querySelectorAll<HTMLCanvasElement>('[data-paper-idx]').forEach((cv) => {
      const idx = +cv.dataset.paperIdx!;
      const tr0 = traces.get(idx);
      if (!tr0) return;
      const w = (cv.parentElement as HTMLElement).clientWidth || 800;
      const mm = Math.max(3.2, Math.min(5, (w - 2) / PAPER_MM.width));
      const paint = (px: number) => drawEcgPaper(cv, tr0.leads, tr0.fs, { pxPerMm: px, header: `${s!.caseDef.patient.name} · ${s!.caseDef.patient.age} · ${lang === 'de' ? '12-Kanal-EKG' : '12-lead ECG'}` });
      paint(mm);
      /* measuring by hand: calipers and a ruler over this paper, and the steps */
      const btn = box.querySelector<HTMLButtonElement>(`[data-measure="${idx}"]`), panel = box.querySelector<HTMLElement>(`[data-measure-panel="${idx}"]`);
      if (!btn || !panel) return;
      let stop: (() => void) | null = null;
      btn.onclick = () => {
        if (stop) { stop(); stop = null; btn.setAttribute('aria-pressed', 'false'); return; }
        const e = s!.encounter.events[idx] as { value?: Record<string, number> };
        stop = mountMeasureTool({ wrap: cv.parentElement as HTMLElement, panel, leads: tr0.leads, fs: tr0.fs, pxPerMm: mm, repaint: paint, machine: e?.value ?? {}, sex: s!.caseDef.patient.sex, lang });
        btn.setAttribute('aria-pressed', 'true');
      };
    });
  };
  const labCard = (e: { test: string; value: unknown; t: number }) => {
    const inv = CATALOG.investigations[e.test];
    const v = e.value as Record<string, number>;
    const range = (inv.normal.range ?? {}) as Record<string, [number, number]>;
    const rows = Object.entries(v).map(([k, x]) => {
      const r = range[k]; const flag = r && (x < r[0] || x > r[1]);
      const n = PANEL_NAMES[k] ?? [k, k, ''];
      const f = (y: number, d = labDigits(k)) => { const s0 = y.toFixed(d); return lang === 'de' ? s0.replace('.', ',') : s0; };
      return `<tr class="${flag ? 'flag' : ''}"><td>${esc(lang === 'de' ? n[1] : n[0])}</td><td class="v">${f(x)}${flag ? (x < r![0] ? ' ↓' : ' ↑') : ''}</td><td class="muted">${esc(n[2])}</td><td class="muted">${r ? `${f(r[0], String(r[0]).split('.')[1]?.length ?? 0)}–${f(r[1], String(r[1]).split('.')[1]?.length ?? 0)}` : ''}</td></tr>`;
    }).join('');
    return `<article class="panel result"><header><b>${esc(tr(inv.label, lang))}</b><span>${Math.round(e.t / 60000)} ${t('min')}</span></header>
      <table class="lab"><thead><tr><th></th><th>${t('value')}</th><th></th><th>${t('range')}</th></tr></thead><tbody>${rows}</tbody></table>${physicsDetails(inv)}</article>`;
  };
  const filmCard = (e: { test: string; value: unknown; t: number }, idx: number) => {
    const inv = CATALOG.investigations[e.test];
    const report = esc(REGISTRY.formatters[inv.formatter](e.value, {}, lang, CATALOG, { property: inv.id }));
    const film = shots.has(idx) && e.test === 'cxr' ? `<div class="film-wrap"><canvas data-cxr-idx="${idx}"></canvas></div>` : '';
    const spiro = shots.has(idx) && e.test === 'spirometry' ? `<div class="paper-wrap"><canvas data-spiro-idx="${idx}"></canvas></div>` : '';
    const head = `<article class="panel result"><header><b>${esc(tr(inv.label, lang))}</b><span>${Math.round(e.t / 60000)} ${t('min')}</span></header>`;
    if (e.test === 'spirometry') return `${head}<p style="margin:0">${report}</p>${spiro}${physicsDetails(inv)}</article>`;
    return `${head}${film}<details class="physics"><summary>${lang === 'de' ? 'Befund der Radiologie' : 'Radiology report'}</summary><p>${report}</p></details>${physicsDetails(inv)}</article>`;
  };
  const paintFilms = (box: HTMLElement) => {
    const rootCss = getComputedStyle(root);
    const col = (n: string) => rootCss.getPropertyValue(n).trim();
    box.querySelectorAll<HTMLCanvasElement>('[data-cxr-idx]').forEach((cv) => {
      const sh = shots.get(+cv.dataset.cxrIdx!); if (!sh) return;
      const w = Math.min(420, (cv.parentElement as HTMLElement).clientWidth || 360);
      drawCxr(cv, { r: sh.resp, circ: sh.circ, sex: s!.caseDef.patient.sex, shift: sh.shift }, w);
    });
    box.querySelectorAll<HTMLCanvasElement>('[data-spiro-idx]').forEach((cv) => {
      const sh = shots.get(+cv.dataset.spiroIdx!); if (!sh?.curve) return;
      drawSpirogram(cv, sh.curve, sh.resp.pred, lang, { fg: col('--fg'), muted: col('--muted'), line: col('--grid') || col('--line'), accent: col('--trace') || col('--accent'), bg: col('--surface') });
    });
  };
  const textCard = (e: { test: string; value: unknown; t: number }) => {
    const inv = CATALOG.investigations[e.test];
    return `<article class="panel result"><header><b>${esc(tr(inv.label, lang))}</b><span>${Math.round(e.t / 60000)} ${t('min')}</span></header>
      <p style="margin:0">${esc(REGISTRY.formatters[inv.formatter](e.value, {}, lang, CATALOG, { property: inv.id }))}</p>${physicsDetails(inv)}</article>`;
  };
  const renderTests = (host: HTMLElement) => {
    if (!s) return;
    const groups: Array<['bedside' | 'laboratory' | 'imaging', string]> = [['bedside', t('atBedside')], ['laboratory', t('laboratory')], ['imaging', t('imaging')]];
    const invs = Object.values(CATALOG.investigations);
    const events = s.encounter.events.map((e, i) => ({ e, i })).filter((x) => x.e.kind === 'result');
    const ready = events.filter((x) => x.e.t <= s!.t).reverse();
    const pending = events.filter((x) => x.e.t > s!.t);
    host.innerHTML = `<div class="tests-grid"><aside class="panel order-list"><h2>${t('orderTitle')}</h2>
      ${groups.map(([g, label]) => `<h3>${label}</h3>${invs.filter((x) => INV_GROUP(x) === g).map((x) => `<button type="button" class="order-btn" data-order="${x.id}"><span>${esc(tr(x.label, lang))}</span><small>${x.id === 'ecg-12' ? t('recordYourself') : `${x.turnaroundMinutes} ${t('min')}`}</small></button>`).join('')}`).join('')}
      </aside><div class="results">
      ${pending.map(({ e }) => e.kind === 'result' ? `<p class="muted">${esc(tr(CATALOG.investigations[e.test].label, lang))} · ${t('resultIn')} ${Math.ceil((e.t - s!.t) / 60000)} ${t('min')}</p>` : '').join('')}
      ${ready.map(({ e, i }) => {
        if (e.kind !== 'result') return '';
        if (e.test === 'ecg-12') return ecgCard(i);
        if (e.test === 'cxr' || e.test === 'spirometry') return filmCard(e, i);
        const inv = CATALOG.investigations[e.test];
        return inv.formatter === 'inv.panel' ? labCard(e) : textCard(e);
      }).join('') || (pending.length ? '' : `<p class="muted">${t('noResults')}</p>`)}</div></div>`;
    paintPapers(host);
    paintFilms(host);
    host.querySelectorAll<HTMLButtonElement>('[data-order]').forEach((b) => b.onclick = () => {
      if (b.dataset.order === 'ecg-12') { setLayer('bedside'); setVisual({ kind: 'ecg' }); return; }
      doOrder(b.dataset.order!);
    });
  };

  /* ---- layers -------------------------------------------------------------------------- */
  const lockedLayer = (l: Layer) => (l === 'physiology' || l === 'model') && !committed;
  const setLayer = (l: Layer) => { if (lockedLayer(l)) return; layer = l; renderLayer(); };
  const gotoVariable = (id: string) => {
    const mid = id.split('.')[0];
    if (CHAPTERS.some((c) => c.id === mid)) { chapter = mid; setLayer('physiology'); }
  };
  const renderLayer = () => {
    if (!s || !live) return;
    root.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach((b) => {
      const l = b.dataset.layer as Layer;
      b.innerHTML = `${t(l)}${lockedLayer(l) ? ' <span class="lock" aria-hidden="true">🔒</span>' : ''}`;
      b.setAttribute('aria-selected', String(layer === l));
      b.disabled = lockedLayer(l);
      b.title = lockedLayer(l) ? t('lockedText') : '';
    });
    for (const l of ['bedside', 'tests', 'physiology', 'model'] as const) $(`#layer-${l}`).hidden = layer !== l;
    chapterHandle?.stop(); chapterHandle = null; labTick = null;
    if (layer === 'tests') renderTests($('#layer-tests'));
    if (layer === 'physiology') {
      const host = $('#layer-physiology');
      host.innerHTML = `<div class="chapters" role="tablist">${CHAPTERS.map((c) => `<button type="button" role="tab" data-ch="${c.id}" aria-selected="${c.id === chapter}">${esc(tr(c.title, lang))}</button>`).join('')}</div><div data-chapter></div>`;
      host.querySelectorAll<HTMLButtonElement>('[data-ch]').forEach((b) => b.onclick = () => { chapter = b.dataset.ch!; renderLayer(); });
      chapterHandle = renderChapter(host.querySelector('[data-chapter]') as HTMLElement, chapter, live, () => { syncView(); return s!.view; }, lang);
    }
    if (layer === 'model') {
      const host = $('#layer-model');
      const e = live.snap.ecgMetrics ?? {}, m = live.snap.metrics ?? {};
      const monVals = () => {
        const e2 = live!.snap.ecgMetrics ?? {}, m2 = live!.snap.metrics ?? {}, r2 = live!.snap.resp;
        return [String(Math.round(e2.HR ?? 0)), `${Math.round(m2.Psys ?? 0)}/${Math.round(m2.Pdia ?? 0)}`, (m2.CO ?? 0).toFixed(1),
          r2 ? String(Math.round(r2.RR)) : '—', r2 ? `${Math.round(pulseOx(r2))}` : '—', r2 ? r2.PaCO2.toFixed(1) : '—', (live!.chemistry.arterialPH ?? 7.4).toFixed(2), (live!.chemistry.potassium ?? 4).toFixed(1)];
      };
      const monLabels = ['HR', lang === 'de' ? 'RR' : 'BP', 'CO', lang === 'de' ? 'AF' : 'RR', 'SpO₂', 'PaCO₂', 'pH', 'K⁺'];
      const mon = `<div class="monitor">${monVals().map((x, i) => `<div><span>${monLabels[i]}</span><b>${x}</b></div>`).join('')}</div>`;
      host.innerHTML = `<div data-mon>${mon}</div><div data-lab></div>`;
      const lab = renderModelLab(host.querySelector('[data-lab]') as HTMLElement, {
        live, view: () => { syncView(); return s!.view; }, lang, editable: free, open: labOpen,
        onChange: (next) => applyModel(next),
      });
      labTick = () => {
        lab.tick();
        const mon2 = host.querySelector('[data-mon] .monitor');
        if (mon2) { const b = mon2.querySelectorAll('b'); monVals().forEach((x, i) => { if (b[i]) b[i].textContent = x; }); }
      };
    }
    if (lockedLayer(layer)) layer = 'bedside';
  };
  root.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach((b) => b.onclick = () => setLayer(b.dataset.layer as Layer));
  root.addEventListener('click', (ev) => { const g = (ev.target as Element).closest('[data-goto]') as HTMLElement | null; if (g) gotoVariable(g.dataset.goto!); });

  /* ---- rendering the encounter ---------------------------------------------------- */
  const blockedText = (reason: string): string => {
    const [kind, rest] = reason.split(':');
    const items = (rest ?? '').split('|');
    if (kind === 'position') return lang === 'de'
      ? `Zuerst lagern: ${items.map((p) => POSITION[p]?.de ?? p).join(' oder ')}.`
      : `First position the patient: ${items.map((p) => POSITION[p]?.en ?? p).join(' or ')}.`;
    if (kind === 'exposure') return lang === 'de'
      ? `${items.map((x) => tr(CATALOG.structures[x]?.label, 'de')).join(', ')}: noch bedeckt.`
      : `The ${items.map((x) => tr(CATALOG.structures[x]?.label, 'en').toLowerCase()).join(', ')} ${items.length > 1 ? 'are' : 'is'} still covered.`;
    const first = s?.caseDef.patient.name.split(' ')[0] ?? '';
    if (kind === 'ability') return lang === 'de' ? `Das kann ${first} gerade nicht.` : `${first} can't do that right now.`;
    return lang === 'de' ? 'Dafür fehlt das Instrument.' : 'You need a different instrument for that.';
  };
  const sideWord = (sd?: Side) => (sd ? ` (${sd === 'L' ? t('left').toLowerCase() : t('right').toLowerCase()})` : '');

  const feedHtml = () => feed.map((it, idx) => {
    switch (it.k) {
      case 'scene': return `<div class="f-scene">${esc(tr(it.text, lang))}</div>`;
      case 'you': return `<div class="f-you"><span class="spk">${t('you')}</span>${esc(it.text)}</div>`;
      case 'patient': {
        if (!s) return '';
        const c = s.caseDef;
        const facts = it.facts.map((id) => c.history.find((f) => f.id === id)!).filter(Boolean);
        if (!facts.length) return `<div class="f-patient"><span class="spk">${esc(c.patient.name.split(' ')[0])}</span>${esc(it.text)}</div>`;
        const groups: Array<{ who: string; text: string[] }> = [];
        for (const f of facts) {
          const who = f.speaker === 'companion' && c.patient.companion ? `${c.patient.companion.name.split(' ')[0]} · ${tr(c.patient.companion.relation, lang)}` : c.patient.name.split(' ')[0];
          const g = groups.find((x) => x.who === who) ?? (groups.push({ who, text: [] }), groups[groups.length - 1]);
          g.text.push(tr(f.say, lang));
        }
        return groups.map((g) => `<div class="f-patient${g.who.includes('·') ? ' companion' : ''}"><span class="spk">${esc(g.who)}</span>${esc(g.text.join(' '))}</div>`).join('');
      }
      case 'act': return `<div class="f-act">${esc(tr(CATALOG.manoeuvres[it.manoeuvre].label, lang))}${sideWord(it.side)}</div>`;
      case 'blocked': return `<div class="f-blocked">${esc(blockedText(it.reason))}</div>`;
      case 'finding': return `<div class="f-finding${it.finding.normal ? '' : ' abn'}">${esc(describe(s!, it.finding, lang))}</div>`;
      case 'signs': {
        const chip = (id: string, extra = '') => `<button type="button" class="chip" data-sign="${id}">${esc(signLabel(id))}${extra}</button>`;
        const sideOf = (sides: Side[]) => (sides.length === 2 ? ` (${t('bothSides')})` : sideWord(sides[0]));
        return `<div class="f-signs">
          ${it.found.length ? `<p class="chips"><span class="lbl">${esc(t('signsFoundWord'))}:</span>${it.found.map((f) => chip(f.sign, esc(sideOf(f.sides)))).join('')}</p>` : ''}
          ${it.normal.length ? `<p class="chips">${it.normal.map((x) => chip(x, ` (${esc(t('normalWord'))})`)).join('')}</p>` : ''}
          ${it.absent.length ? `<details><summary>${esc(t('lookedFor'))} (${it.absent.length})</summary><p class="chips">${it.absent.map((x) => chip(x)).join('')}</p></details>` : ''}</div>`;
      }
      case 'name': {
        const named = s ? namedSigns(s) : new Map();
        const on = (id: string) => { const n = named.get(id); return !!n && (!it.side || !n.sides.size || n.sides.has(it.side)); };
        return `<div class="f-signs f-name"><p class="lbl">${esc(t('whatSeen'))}</p><p class="chips">${it.candidates
          .map((id) => `<button type="button" class="chip pick" aria-pressed="${on(id)}" data-name="${id}" data-by="${it.test}"${it.side ? ` data-nside="${it.side}"` : ''}>${esc(signLabel(id))}</button>`).join('')}</p></div>`;
      }
      case 'order': { const inv = CATALOG.investigations[it.inv]; return `<div class="f-act">${t('ordered')}: ${esc(tr(inv.label, lang))}${it.inv === 'ecg-12' ? '' : ` · ${t('resultIn')} ${inv.turnaroundMinutes} ${t('min')}`}</div>`; }
      case 'result': {
        const inv = CATALOG.investigations[it.inv];
        if (it.inv === 'cxr') return `<div class="f-finding result">${esc(tr(inv.label, lang))}: ${lang === 'de' ? 'die Aufnahme liegt unter Diagnostik.' : 'the film is under Tests.'}</div>`;
        return `<div class="f-finding result">${esc(REGISTRY.formatters[inv.formatter](it.value, {}, lang, CATALOG, { property: inv.id }))}</div>`;
      }
      case 'system': return `<div class="f-system">${esc(tr(it.text, lang))}</div>`;
      case 'side': {
        const last = idx === feed.length - 1;
        return `<div class="f-side">${esc(tr(CATALOG.manoeuvres[it.manoeuvre].label, lang))}: ${t('which')} ${last ? `<button type="button" class="tog" data-side-act="${it.manoeuvre}" data-side="L">${t('left')}</button> <button type="button" class="tog" data-side-act="${it.manoeuvre}" data-side="R">${t('right')}</button>` : ''}</div>`;
      }
    }
  }).join('');

  const notesHtml = (md: string) => md ? md.split('\n').map((l) => l.startsWith('## ') ? `<h3>${esc(l.slice(3))}</h3>` : l.startsWith('- ') ? `<p>${esc(l.slice(2))}</p>` : '').join('') : `<p class="muted">${t('noNotes')}</p>`;

  /* The Notes tab: the signs named so far; with the free patient (or once a case is committed), every sign the
     model produces, so the learner can see what was there to find. */
  /* Observe only: the signs the learner named, and a search to name more (no hint which are there). */
  const namedNotesHtml = () => {
    if (!s) return '';
    const named = namedSigns(s);
    const chip = (id: string, sides: Set<Side>) => `<button type="button" class="chip pick" aria-pressed="true" data-name="${id}" title="${esc(t('removeNamed'))}">${esc(signLabel(id))}${sides.size === 2 ? ` (${esc(t('bothSides'))})` : sides.size ? esc(sideWord([...sides][0])) : ''} ×</button>`;
    const q = normalise(nameQuery);
    const hits = q.length < 2 ? [] : Object.values(KNOWLEDGE.signs).filter((x) => x.definition && !named.has(x.id) && normalise(signLabel(x.id)).includes(q)).slice(0, 12);
    return `<h3>${esc(t('namedSoFar'))}</h3>${named.size ? `<p class="chips">${[...named].map(([id, n]) => chip(id, n.sides)).join('')}</p>` : `<p class="muted">${esc(t('noneNamed'))}</p>`}
      <label class="lbl" for="name-q">${esc(t('nameSign'))}</label><input id="name-q" class="name-q" value="${esc(nameQuery)}" autocomplete="off">
      ${hits.length ? `<p class="chips">${hits.map((x) => `<button type="button" class="chip pick" aria-pressed="false" data-name="${x.id}">${esc(signLabel(x.id))}</button>`).join('')}</p>` : ''}`;
  };

  const signsNotesHtml = () => {
    if (!s) return '';
    if (s.observeOnly && !committed) return namedNotesHtml();
    const chip = (id: string, sides?: Set<string>) => {
      const sd = sides ? [...sides].filter(Boolean) as Side[] : [];
      return `<button type="button" class="chip" data-sign="${id}">${esc(signLabel(id))}${sd.length === 2 ? ` (${esc(t('bothSides'))})` : sd.length ? esc(sideWord(sd[0])) : ''}</button>`;
    };
    let html = `<h3>${esc(t('signsSoFar'))}</h3>${signsSeen.size ? `<p class="chips">${[...signsSeen].map(([id, sides]) => chip(id, sides)).join('')}</p>` : `<p class="muted">${esc(t('noSignsYet'))}</p>`}`;
    if ((free || committed) && tab === 'notes') {
      const all = signsOf(KNOWLEDGE, CATALOG, (ref, ctx) => observeIn(s!, ref, ctx));
      const shown = Object.entries(all).filter(([id, v]) => v === true && !KNOWLEDGE.signs[id].normalVariant).map(([id]) => id);
      html += `<h3>${esc(t('signsInModel'))}</h3><p class="muted small">${esc(t('signsInModelHint'))}</p>${shown.length ? `<p class="chips">${shown.map((id) => chip(id)).join('')}</p>` : `<p class="muted">—</p>`}`;
    }
    return html;
  };

  const renderEncounter = () => {
    if (!s) return;
    const c = s.caseDef;
    $('#pt-name').textContent = c.patient.name;
    $('#pt-meta').innerHTML = `${c.patient.age} · ${esc(tr(base.setting.place, lang))}${s.observeOnly ? `<span class="obs-badge">${esc(t('observeBadge'))}</span>` : ''}`;
    $('#clock').textContent = `${minutes()} ${t('min')}`;
    $('#wait').textContent = t('wait'); $('#to-commit').textContent = t('commit'); $('#leave').textContent = t('leave');
    $('#to-commit').hidden = free || committed;
    ($('#cmd') as HTMLInputElement).placeholder = t('placeholder'); $('#send').textContent = t('send');
    $('#touch-hint').textContent = t(figView === 'left' ? 'tapHintLeft' : figView === 'front' ? 'tapHintFront' : 'tapHint'); $('#whole').textContent = t('whole');
    for (const k of ['feed', 'notes', 'mine'] as const) {
      const b = $(`[data-tab="${k}"]`); b.textContent = t(k); b.setAttribute('aria-selected', String(tab === k));
      $(`#tab-${k}`).hidden = tab !== k;
    }
    $('#tab-feed').innerHTML = feedHtml();
    $('#tab-notes').innerHTML = notesHtml(autoNote(s, lang)) + signsNotesHtml();
    ($('#mynotes') as HTMLTextAreaElement).placeholder = t('myNotesHint');
    root.querySelectorAll<HTMLButtonElement>('#tab-feed [data-sign], #tab-notes [data-sign]').forEach((b) => b.onclick = () => { cardBack = []; cardNow = { kind: 'sign', id: b.dataset.sign! }; renderCard(); });
    /* Observe only: naming a sign, or taking the name back. */
    root.querySelectorAll<HTMLButtonElement>('#tab-feed [data-name], #tab-notes [data-name]').forEach((b) => b.onclick = () => {
      if (!s) return;
      const sign = b.dataset.name!, side = b.dataset.nside as Side | undefined, by = b.dataset.by;
      const removed = b.getAttribute('aria-pressed') === 'true';
      s.encounter.events.push({ t: s.t, kind: 'sign-named', sign, ...(side ? { side } : {}), ...(by ? { byManoeuvre: by } : {}), ...(removed ? { removed } : {}) });
      const keep = root.querySelector('#name-q') === document.activeElement;
      renderEncounter();
      if (keep) (root.querySelector('#name-q') as HTMLInputElement | null)?.focus();
    });
    const nq = root.querySelector('#name-q') as HTMLInputElement | null;
    if (nq) nq.oninput = () => { nameQuery = nq.value; renderEncounter(); const n2 = root.querySelector('#name-q') as HTMLInputElement | null; if (n2) { n2.focus(); n2.setSelectionRange(n2.value.length, n2.value.length); } };
    root.querySelectorAll<HTMLButtonElement>('[data-side-act]').forEach((b) => b.onclick = () => { feed.pop(); doAction(b.dataset.sideAct!, b.dataset.side as Side); });
    const fe = $('#tab-feed'); fe.scrollTop = fe.scrollHeight;
    renderFigure();
    renderBedMonitor();
    renderRegion();
    renderCare();
    if (cardNow) renderCard();
    if (layer === 'tests') renderTests($('#layer-tests'));
  };

  /* ---- the ECG monitor: the running heart's dipole, as the monitor reads it ------------------- */
  const monitorSource = () => {
    const lp = live;
    if (!lp) return null;
    return { samples: () => lp.samples, read: (n: number) => lp.vcg(n / 500), rate: () => (lp.snap.metrics?.HRbeat as number | undefined) ?? null };
  };
  /* At the bedside, once electrodes are on: lead II and the rate, like the monitor over the bed. Tap it for the ECG. */
  let bedMonitorStop: (() => void) | null = null, bedMonitorFor: LivePatient | null = null;
  const renderBedMonitor = () => {
    const box = $('#bed-monitor');
    const on = !!live && Object.keys(placement).length > 0;
    if (!on || bedMonitorFor !== live) { bedMonitorStop?.(); bedMonitorStop = null; bedMonitorFor = null; }
    box.hidden = !on;
    if (!on || bedMonitorStop) return;
    const src = monitorSource()!;
    bedMonitorFor = live;
    bedMonitorStop = mountMonitor(box.querySelector('canvas') as HTMLCanvasElement, src, {
      leads: ['II'], columns: 1, seconds: 5, vectors: () => leadVectorsOn(placement), reference: () => !!placement.RL, showRate: true, mvRange: 2.2,
      label: 'Monitor', offText: lang === 'de' ? 'Elektrode fehlt' : 'Lead off',
    });
    box.title = lang === 'de' ? 'EKG öffnen' : 'Open the ECG';
  };

  /* ---- the patient figure ---------------------------------------------------------- */
  /* What the model says the body looks like now: the findings any examiner sees by looking (they are observed, not
     recorded as examined). */
  const figureFindings = (): FigureFindings => {
    const v = (ref: string): any => { try { return observeIn(s!, ref, {}).value; } catch { return undefined; } };
    const g = v('general.appearance'), b = v('breathing.pattern');
    return {
      oedema: v('legs.oedema')?.extent, ascites: v('abdomen.ascites')?.ascites, colour: g?.colour, sweating: g?.sweating, distress: g?.distress,
      icterus: v('eyes.sclera')?.icterus, pallor: v('eyes.conjunctiva')?.pallor,
      breathing: b ? { hyperinflated: !!b.hyperinflated, accessory: !!b.accessory, pursedLips: !!b.pursedLips } : undefined,
    };
  };
  /* Where the examiner stands: the right side of the bed, its foot, or the left side. Changing it walks round the bed
     (the figure turns, eased like a change of position), so the left arm and leg can be reached as well. */
  let figView: keyof typeof VIEW_ANGLE = 'right';
  let posePrev: Pose = POSES['reclined-45'], poseTarget: Pose = POSES['reclined-45'], poseT0 = 0, poseRaf = 0, poseKey = '';
  let viewPrev = 0, viewTarget = 0;
  const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const renderFigure = (force = false) => {
    if (!s) return;
    const c = s.caseDef, st = s.state;
    const lk: FigureLook = figureLookFor(c.patient, st, seedOf(base.id), figureFindings());
    const exposed = lk.exposed;
    const target = POSES[st.position] ?? POSES.supine;
    const key = `${base.id}|${c.patient.sex}|${st.position}|${figView}|${[...exposed].sort().join(',')}|${lk.oxygen ?? ''}|${JSON.stringify(lk.body)}`;
    const g = $('#fig') as unknown as SVGGElement;
    if (key !== poseKey || force) {
      const firstForCase = !poseKey.startsWith(`${base.id}|`);
      const e0 = ease(Math.min(1, (performance.now() - poseT0) / 700));
      posePrev = firstForCase ? target : lerpPose(posePrev, poseTarget, e0);
      viewPrev = firstForCase ? VIEW_ANGLE[figView] : viewPrev + (viewTarget - viewPrev) * e0;
      poseTarget = target; viewTarget = VIEW_ANGLE[figView]; poseT0 = performance.now(); poseKey = key;
      cancelAnimationFrame(poseRaf);
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const step = (now: number) => {
        const e = ease(reduce ? 1 : Math.min(1, (now - poseT0) / 700));
        g.innerHTML = figureSvg(lerpPose(posePrev, poseTarget, e), lk, viewAt(viewPrev + (viewTarget - viewPrev) * e));
        if (e < 1) poseRaf = requestAnimationFrame(step);
      };
      g.innerHTML = figureSvg(posePrev, lk, viewAt(viewPrev));
      poseRaf = requestAnimationFrame(step);
      $('#figure').setAttribute('aria-label', t(figView === 'left' ? 'figLeft' : figView === 'front' ? 'figFront' : 'figRight'));
    }
    $('#views').innerHTML = `<span class="care-label">${esc(t('view'))}</span><div class="chips">${(['right', 'front', 'left'] as const).map((v) =>
      `<button type="button" class="chip" data-view="${v}" aria-pressed="${figView === v}">${esc(t(v === 'right' ? 'viewRight' : v === 'front' ? 'viewFront' : 'viewLeft'))}</button>`).join('')}</div>`;
    $('#views').querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.onclick = () => {
      figView = b.dataset.view as typeof figView;
      $('#touch-hint').textContent = t(figView === 'left' ? 'tapHintLeft' : figView === 'front' ? 'tapHintFront' : 'tapHint');
      renderFigure();
    });
    $('#state-line').textContent = `${t('position')}: ${POSITION[st.position]?.[lang] ?? st.position} · ${t('exposed')}: ${exposed.size ? [...exposed].map((x) => tr(CATALOG.structures[x]?.label, lang)).join(', ') : t('nothing')}${st.oxygen && st.oxygen.fio2 > 0.21 ? ` · O₂: ${st.oxygen.device}` : ''}`;
  };

  /* ---- the examination menu: grouped by system and section, in clinical order ------------ */
  const openSystems = new Set<string>(['vitals']);
  const infoBtn = (m: ManoeuvreDef) => m.teaching ? `<button type="button" class="info" data-info="${m.id}" aria-label="${esc(t('aboutTest'))}: ${esc(tr(m.label, lang))}" title="${esc(t('aboutTest'))}">i</button>` : '';
  const actHtml = (m: ManoeuvreDef, side?: Side) => {
    const label = esc(tr(m.label, lang));
    if (!m.paired || side) return `<div class="act-row"><button type="button" class="act" data-act="${m.id}" ${side ? `data-side="${side}"` : ''}>${label}</button>${infoBtn(m)}</div>`;
    return `<div class="act-row"><div class="act-pair"><span>${label}</span><span class="sides"><button type="button" class="tog small" data-act="${m.id}" data-side="R">${t('right')}</button><button type="button" class="tog small" data-act="${m.id}" data-side="L">${t('left')}</button></span></div>${infoBtn(m)}</div>`;
  };
  /** The sections that hold any of these manoeuvres, in order, each with its manoeuvres in order. */
  const sectionsFor = (keep: (m: ManoeuvreDef) => boolean) => CATALOG.examSystems.map((sys) => ({
    sys, sections: sys.sections.filter((sec) => sec.kind !== 'intervene')
      .map((sec) => ({ sec, items: sec.manoeuvres.map((id) => CATALOG.manoeuvres[id]).filter((m) => m && !m.hidden && keep(m)) }))
      .filter((x) => x.items.length),
  })).filter((x) => x.sections.length);

  const renderRegion = () => {
    const box = $('#region');
    if (!region || !s) { box.hidden = true; return; }
    box.hidden = false;
    const side = region.side;
    const all = region.id === 'body';
    const groups = sectionsFor((m) => all || regionOf(m.target) === region!.id);
    const ecg = region.id === 'chest' ? `<div class="act-row"><button type="button" class="act" data-ecg>${lang === 'de' ? '12-Kanal-EKG schreiben' : 'Record a 12-lead ECG'}</button></div>` : '';
    const body = all
      ? groups.map(({ sys, sections }) => `<details class="sys" data-sys="${sys.id}" ${openSystems.has(sys.id) ? 'open' : ''}><summary>${esc(tr(sys.label, lang))}</summary>
          ${sections.map(({ sec, items }) => `${sections.length > 1 ? `<h4 class="sec-head">${esc(tr(sec.label, lang))}</h4>` : ''}${items.map((m) => actHtml(m)).join('')}`).join('')}</details>`).join('')
      : groups.flatMap(({ sys, sections }) => sections.map(({ sec, items }) => `<h4 class="sec-head">${esc(tr(sys.label, lang))}${tr(sec.label, lang) !== tr(sys.label, lang) ? ` · ${esc(tr(sec.label, lang))}` : ''}</h4>${items.map((m) => actHtml(m, side)).join('')}`)).join('') + ecg;
    box.innerHTML = `<div class="region-head"><b>${all ? esc(t('whole')) : `${esc(REGION_LABEL[region.id][lang])}${side ? sideWord(side) : ''}`}</b><button type="button" class="ghost small" id="region-close" aria-label="${esc(t('close'))}">×</button></div>
      <div class="region-list${all ? ' all' : ''}">${body}</div>`;
    box.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.onclick = () => doAction(b.dataset.act!, (b.dataset.side as Side) || undefined));
    box.querySelectorAll<HTMLButtonElement>('[data-info]').forEach((b) => b.onclick = () => showCard(b.dataset.info!));
    box.querySelectorAll<HTMLDetailsElement>('details[data-sys]').forEach((d) => d.addEventListener('toggle', () => {
      /* One system open at a time, so the list stays short enough to scan. */
      if (d.open) { openSystems.clear(); openSystems.add(d.dataset.sys!); box.querySelectorAll<HTMLDetailsElement>('details[data-sys]').forEach((o) => { if (o !== d) o.open = false; }); }
      else openSystems.delete(d.dataset.sys!);
    }));
    box.querySelector<HTMLButtonElement>('[data-ecg]')?.addEventListener('click', () => setVisual({ kind: 'ecg' }));
    $('#region-close').onclick = () => { region = null; renderRegion(); };
  };

  /* ---- position, exposure and oxygen: always at hand, apart from the examination ------------ */
  const isActive = (m: ManoeuvreDef): boolean => {
    const st = s!.state;
    if (m.sets?.position) return st.position === m.sets.position;
    if (m.sets?.oxygen) return (st.oxygen?.fio2 ?? 0.21) <= 0.21 ? m.sets.oxygen.fio2 <= 0.21 : st.oxygen?.device === m.sets.oxygen.device;
    if (m.verb === 'expose') return (st.exposure ?? []).includes(m.target);
    return false;
  };
  const renderCare = () => {
    const box = $('#care');
    if (!s) { box.innerHTML = ''; return; }
    const care = CATALOG.examSystems.flatMap((sys) => sys.sections).filter((sec) => sec.kind === 'intervene');
    const short = (id: string) => (SHORT_LABELS[id] ? tr(SHORT_LABELS[id], lang) : tr(CATALOG.manoeuvres[id].label, lang));
    box.innerHTML = care.map((sec) => sec.layout === 'select'
      ? `<label class="care-row"><span class="care-label">${esc(tr(sec.label, lang))}</span><select data-care-select>${sec.manoeuvres.map((id) =>
          `<option value="${id}" ${isActive(CATALOG.manoeuvres[id]) ? 'selected' : ''}>${esc(short(id))}</option>`).join('')}</select></label>`
      : `<div class="care-row"><span class="care-label">${esc(tr(sec.label, lang))}</span><div class="chips">${sec.manoeuvres.map((id) =>
          `<button type="button" class="chip" data-care="${id}" aria-pressed="${isActive(CATALOG.manoeuvres[id])}" title="${esc(tr(CATALOG.manoeuvres[id].label, lang))}">${esc(short(id))}</button>`).join('')}</div></div>`).join('');
    box.querySelectorAll<HTMLButtonElement>('[data-care]').forEach((b) => b.onclick = () => doAction(b.dataset.care!));
    box.querySelectorAll<HTMLSelectElement>('[data-care-select]').forEach((sel) => sel.onchange = () => doAction(sel.value));
  };

  /* ---- the teaching cards: of a test, and of a sign ----------------------------------- */
  const signLabel = (id: string) => labelOf(KNOWLEDGE, `sign:${id}`, lang);
  const signChips = (ids: string[]) => ids.length ? `<p class="chips">${ids.map((id) => `<button type="button" class="chip" data-sign="${id}">${esc(signLabel(id))}</button>`).join('')}</p>` : '';
  const condText = (ids: string[]) => ids.map((d) => esc(tr(CATALOG.diagnoses[d]?.label, lang))).join(', ');
  const cardHead = (eyebrow: string, title: string, sub = '') => `<header class="card-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(title)}</h2>${sub}</div>
        <div>${cardBack.length ? `<button type="button" class="ghost small" id="card-back">‹ ${esc(t('backWord'))}</button>` : ''}<button type="button" class="ghost small" id="card-close" aria-label="${esc(t('close'))}">×</button></div></header>`;
  const presentationsHtml = (ps: CardPresentation[], spoilers: boolean, withTests = false) => `<ul class="abn">${ps.map((p) => `<li>
        ${withTests ? `<p class="eyebrow">${p.tests.map((x) => esc(tr(CATALOG.manoeuvres[x]?.label, lang))).join(' · ')}</p>` : ''}
        <p><b>${esc(tr(p.description, lang))}</b></p><p>${esc(tr(p.meaning, lang))}</p>
        ${signChips([...p.signs, ...p.accompanying])}
        ${spoilers && p.conditions.length ? `<p class="muted">${esc(t('seenIn'))}: ${condText(p.conditions)}</p>` : ''}</li>`).join('')}</ul>`;
  const cardHtml = (m: ManoeuvreDef, card: TeachingCard) => {
    const spoilers = free || committed;
    const aliases = list(card.aliases, lang).concat(...Object.keys(card.aliases ?? {}).filter((l) => l !== lang).map((l) => card.aliases![l]))
      .concat(Object.keys(m.label).filter((l) => l !== lang).map((l) => m.label[l]))
      .filter((x, i, a) => x && a.indexOf(x) === i && x !== tr(m.label, lang));
    return `${cardHead(t('aboutTest'), tr(m.label, lang), aliases.length ? `<p class="muted">${esc(t('alsoCalled'))}: ${aliases.map(esc).join(' · ')}</p>` : '')}
      <section><h3>${esc(t('assesses'))}</h3><p>${esc(tr(card.assesses, lang))}</p></section>
      <section><h3>${esc(t('howTo'))}</h3><ol>${list(card.how, lang).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>
      <section><h3>${esc(t('normalFinding'))}</h3><p>${esc(tr(card.normal, lang))}</p>
        ${card.normalVariants.length ? `<p class="muted small">${esc(t('normalVariants'))}:</p>${signChips(card.normalVariants)}` : ''}</section>
      ${card.presentations.length ? `<section><h3>${esc(t('abnormalFinding'))}</h3>${presentationsHtml(card.presentations, spoilers)}
        ${!spoilers && card.presentations.some((f) => f.conditions.length) ? `<p class="muted small">${esc(t('spoilerHidden'))}</p>` : ''}</section>` : ''}
      ${card.alsoShows.length ? `<section><h3>${esc(t('alsoShows'))}</h3>${signChips(card.alsoShows)}</section>` : ''}
      ${card.animation?.startsWith('station:') ? `<section><button type="button" class="ghost" data-open-station="${card.animation.slice(8)}" data-on-patient="${spoilers ? 1 : 0}">${esc(t(spoilers ? 'openInStation' : 'openStationHealthy'))}</button></section>` : ''}
      ${card.pitfalls ? `<section><h3>${esc(t('pitfalls'))}</h3><ul>${list(card.pitfalls, lang).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
      ${s && !committed ? `<div class="card-actions">${m.paired ? `<button type="button" class="primary" data-card-act="${m.id}" data-side="R">${esc(t('doIt'))}: ${esc(t('right'))}</button><button type="button" class="primary" data-card-act="${m.id}" data-side="L">${esc(t('doIt'))}: ${esc(t('left'))}</button>` : `<button type="button" class="primary" data-card-act="${m.id}">${esc(t('doIt'))}</button>`}</div>` : ''}`;
  };
  const signCardHtml = (id: string) => {
    const c = signCard(KNOWLEDGE, CATALOG, id);
    if (!c) return '';
    const spoilers = free || committed;
    const other = (['en', 'de'] as const).filter((l) => l !== lang).map((l) => labelOf(KNOWLEDGE, `sign:${id}`, l)).filter((x) => x !== signLabel(id));
    const roleWord = (r: string) => (r === 'required' ? ` (${t('roleRequired')})` : r === 'absent' ? ` (${t('roleAbsent')})` : r === 'associated' ? ` (${t('roleAssociated')})` : '');
    return `${cardHead(t('aboutSign'), signLabel(id), other.length ? `<p class="muted">${esc(t('alsoCalled'))}: ${other.map(esc).join(' · ')}</p>` : '')}
      <section><p class="muted">${esc(t(c.normalVariant ? 'normalVariantNote' : c.represented ? 'simulated' : 'notSimulated'))}</p></section>
      ${c.parents.length ? `<section><h3>${esc(t('variantOf'))}</h3>${signChips(c.parents)}</section>` : ''}
      ${c.tests.length ? `<section><h3>${esc(t('foundBy'))}</h3><p class="chips">${c.tests.filter((x) => CATALOG.manoeuvres[x]).map((x) => `<button type="button" class="chip" data-test="${x}">${esc(tr(CATALOG.manoeuvres[x].label, lang))}</button>`).join('')}${c.tests.filter((x) => CATALOG.investigations[x]).map((x) => `<span class="chip">${esc(tr(CATALOG.investigations[x].label, lang))}</span>`).join('')}</p></section>` : ''}
      ${c.presentations.length ? `<section><h3>${esc(t('presentsAs'))}</h3>${presentationsHtml(c.presentations, spoilers, true)}</section>` : ''}
      ${c.variants.length ? `<section><h3>${esc(t('variantsWord'))}</h3>${signChips(c.variants)}</section>` : ''}
      ${c.syndromes.length ? `<section><h3>${esc(t('partOf'))}</h3><p>${c.syndromes.map((x) => esc(labelOf(KNOWLEDGE, `syndrome:${x.id}`, lang)) + esc(roleWord(x.role))).join(' · ')}</p></section>` : ''}
      ${c.conditions.length ? `<section><h3>${esc(t('seenIn'))}</h3>${spoilers ? `<p>${condText(c.conditions)}</p>` : `<p class="muted small">${esc(t('spoilerHidden'))}</p>`}</section>` : ''}`;
  };
  /* The card shows a test or a sign; following a sign or a test from a card keeps a trail back. */
  type CardRef = { kind: 'test' | 'sign'; id: string };
  let cardNow: CardRef | null = null;
  let cardBack: CardRef[] = [];
  const renderCard = () => {
    const box = $('#card');
    const m = cardNow?.kind === 'test' ? CATALOG.manoeuvres[cardNow.id] : undefined;
    const html = cardNow?.kind === 'test' ? (m?.teaching ? cardHtml(m, m.teaching) : '') : cardNow ? signCardHtml(cardNow.id) : '';
    if (!html) { box.hidden = true; return; }
    box.hidden = false;
    $('#card-body').innerHTML = html;
    $('#card-close').onclick = () => showCard(null);
    const back = document.getElementById('card-back');
    if (back) back.onclick = () => { cardNow = cardBack.pop() ?? null; renderCard(); };
    box.querySelectorAll<HTMLButtonElement>('[data-card-act]').forEach((b) => b.onclick = () => { showCard(null); doAction(b.dataset.cardAct!, (b.dataset.side as Side) || undefined); });
    box.querySelectorAll<HTMLButtonElement>('[data-sign]').forEach((b) => b.onclick = () => { if (cardNow) cardBack.push(cardNow); cardNow = { kind: 'sign', id: b.dataset.sign! }; renderCard(); });
    box.querySelectorAll<HTMLButtonElement>('[data-test]').forEach((b) => b.onclick = () => { if (cardNow) cardBack.push(cardNow); cardNow = { kind: 'test', id: b.dataset.test! }; renderCard(); });
    ($('#card-close') as HTMLButtonElement).focus();
  };
  const showCard = (id: string | null) => {
    cardBack = [];
    cardNow = id ? { kind: 'test', id } : null;
    renderCard();
  };
  $('#card').addEventListener('click', (e) => { if (e.target === $('#card')) showCard(null); });
  $('#card').addEventListener('keydown', (e) => { if (e.key === 'Escape') showCard(null); });

  /* ---- suggestions in the command field ------------------------------------------------ */
  let sugs: Suggestion[] = [];
  let sugIndex = -1;
  const cmd = () => $('#cmd') as HTMLInputElement;
  const sectionName = (id?: string) => {
    for (const sys of CATALOG.examSystems) for (const sec of sys.sections) if (sec.id === id) return tr(sys.label, lang) === tr(sec.label, lang) ? tr(sec.label, lang) : `${tr(sys.label, lang)} · ${tr(sec.label, lang)}`;
    return '';
  };
  /* Above the field when there is room above it, otherwise below. */
  const placeSuggest = () => {
    const r = cmd().getBoundingClientRect();
    $('#suggest').classList.toggle('below', r.top < Math.min(360, window.innerHeight * 0.55) + 12 && window.innerHeight - r.bottom > r.top);
  };
  const renderSuggest = () => {
    const box = $('#suggest');
    const q = cmd().value;
    if (document.activeElement !== cmd()) { box.hidden = true; return; }
    sugs = suggest(CATALOG, q, lang, 9);
    if (sugIndex >= sugs.length) sugIndex = sugs.length - 1;
    if (!q.trim()) { box.hidden = false; placeSuggest(); box.innerHTML = `<p class="sug-hint">${esc(t('sugHint'))}</p>`; return; }
    if (!sugs.length) { box.hidden = true; return; }
    box.hidden = false;
    placeSuggest();
    const kindWord = (x: Suggestion) => x.kind === 'act' ? t('sugExamine') : x.kind === 'order' ? t('sugOrder') : t('sugAsk');
    box.innerHTML = `<ul role="listbox" id="sug-list">${sugs.map((x, i) => {
      const m = x.kind === 'act' ? CATALOG.manoeuvres[x.id] : undefined;
      const also = x.matched && normalise(x.matched) !== normalise(x.label) && x.matched.length < 60 ? ` <span class="sug-also">${esc(x.matched)}</span>` : '';
      const where = x.kind === 'act' ? sectionName(x.section) : '';
      return `<li role="option" id="sug-${i}" aria-selected="${i === sugIndex}" data-sug="${i}"><span class="sug-kind ${x.kind}">${esc(kindWord(x))}</span>
        <span class="sug-main"><span class="sug-label">${esc(x.kind === 'ask' ? x.text : x.label)}${x.kind === 'act' && x.side ? sideWord(x.side) : ''}</span>${also}${where ? `<span class="sug-where">${esc(where)}</span>` : ''}</span>
        ${m?.teaching ? `<button type="button" class="info" data-sug-info="${m.id}" tabindex="-1" aria-label="${esc(t('aboutTest'))}">i</button>` : ''}</li>`;
    }).join('')}</ul>`;
    cmd().setAttribute('aria-activedescendant', sugIndex >= 0 ? `sug-${sugIndex}` : '');
    box.querySelectorAll<HTMLElement>('[data-sug]').forEach((li) => li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const info = (e.target as Element).closest('[data-sug-info]') as HTMLElement | null;
      if (info) { showCard(info.dataset.sugInfo!); return; }
      runSuggestion(sugs[+li.dataset.sug!]);
    }));
  };
  const runSuggestion = (x: Suggestion) => {
    cmd().value = ''; sugIndex = -1;
    tab = 'feed';
    if (x.kind === 'act') { feed.push({ k: 'you', text: tr(CATALOG.manoeuvres[x.id].label, lang) }); doAction(x.id, x.side); }
    else if (x.kind === 'order') {
      feed.push({ k: 'you', text: x.label });
      if (x.id === 'ecg-12') { setLayer('bedside'); setVisual({ kind: 'ecg' }); renderEncounter(); } else doOrder(x.id);
    }
    else { submit(x.text); renderEncounter(); }
    renderSuggest();
  };
  const fillSuggestion = (x: Suggestion) => { cmd().value = x.kind === 'ask' ? x.text : x.label; sugIndex = -1; renderSuggest(); };
  cmd().setAttribute('role', 'combobox'); cmd().setAttribute('aria-controls', 'sug-list'); cmd().setAttribute('aria-autocomplete', 'list');
  cmd().addEventListener('input', () => { sugIndex = -1; renderSuggest(); });
  cmd().addEventListener('focus', renderSuggest);
  cmd().addEventListener('blur', () => { $('#suggest').hidden = true; });
  cmd().addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && sugs.length) { e.preventDefault(); sugIndex = (sugIndex + 1) % sugs.length; renderSuggest(); }
    else if (e.key === 'ArrowUp' && sugs.length) { e.preventDefault(); sugIndex = sugIndex <= 0 ? sugs.length - 1 : sugIndex - 1; renderSuggest(); }
    else if (e.key === 'Tab' && !e.shiftKey && sugs.length && cmd().value.trim()) { e.preventDefault(); fillSuggestion(sugs[Math.max(0, sugIndex)]); }
    else if (e.key === 'Enter' && sugIndex >= 0 && sugs[sugIndex]) { e.preventDefault(); runSuggestion(sugs[sugIndex]); }
    else if (e.key === 'Escape') { sugIndex = -1; $('#suggest').hidden = true; }
  });

  $('#figure').addEventListener('click', (ev) => {
    const el = (ev.target as Element).closest('[data-region]') as SVGElement | null;
    if (!el) return;
    region = { id: el.dataset.region!, side: (el.dataset.side as Side) || undefined };
    renderRegion();
  });
  $('#whole').onclick = () => { region = { id: 'body' }; renderRegion(); };
  $('#bed-monitor').onclick = () => setVisual({ kind: 'ecg' });

  /* ---- commit and debrief ----------------------------------------------------------- */
  const renderCommit = () => {
    $('#commit').hidden = false;
    $('#commit-title').textContent = t('commitTitle');
    $('#commit-hint').textContent = t('commitHint');
    ($('#ddx-q') as HTMLInputElement).placeholder = t('search');
    $('#commit-go').textContent = t('submit'); $('#commit-cancel').textContent = t('cancel');
    ($('#commit-go') as HTMLButtonElement).disabled = ddx.length === 0;
    const q = normalise(($('#ddx-q') as HTMLInputElement).value);
    const hits = q.length < 2 ? [] : Object.values(CATALOG.diagnoses).filter((d) => !ddx.some((x) => x.diagnosis === d.id)
      && [tr(d.label, 'en'), tr(d.label, 'de'), ...list(d.synonyms, 'en'), ...list(d.synonyms, 'de')].some((x) => normalise(x).includes(q))).slice(0, 8);
    $('#ddx-hits').innerHTML = hits.map((d) => `<button type="button" class="hit" data-dx="${d.id}">${esc(tr(d.label, lang))}</button>`).join('');
    root.querySelectorAll<HTMLButtonElement>('[data-dx]').forEach((b) => b.onclick = () => {
      ddx.push({ diagnosis: b.dataset.dx!, confidence: ddx.length ? 'possible' : 'likely' });
      ($('#ddx-q') as HTMLInputElement).value = ''; renderCommit(); ($('#ddx-q') as HTMLInputElement).focus();
    });
    $('#ddx-list').innerHTML = ddx.map((d, i) => `<li><span class="rank">${i + 1}</span><span class="dx">${esc(tr(CATALOG.diagnoses[d.diagnosis].label, lang))}</span>
      <select data-conf="${i}" aria-label="Confidence">${(['certain', 'likely', 'possible'] as const).map((c) => `<option value="${c}" ${d.confidence === c ? 'selected' : ''}>${t(c)}</option>`).join('')}</select>
      <button type="button" class="ghost small" data-up="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button type="button" class="ghost small" data-rm="${i}" aria-label="Remove">×</button></li>`).join('');
    root.querySelectorAll<HTMLSelectElement>('[data-conf]').forEach((sel) => sel.onchange = () => { ddx[+sel.dataset.conf!].confidence = sel.value as Commit['confidence']; });
    root.querySelectorAll<HTMLButtonElement>('[data-rm]').forEach((b) => b.onclick = () => { ddx.splice(+b.dataset.rm!, 1); renderCommit(); });
    root.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((b) => b.onclick = () => { const i = +b.dataset.up!; [ddx[i - 1], ddx[i]] = [ddx[i], ddx[i - 1]]; renderCommit(); });
  };

  /* A sign item: the sign, its side, what showed it, or which tests would have. */
  const signDetail = (e: DebriefResult['evidence'][number]): string => {
    const it = e.item, present = it.present !== false;
    const name = `<button type="button" class="chip" data-sign="${it.ref}">${present ? '' : `${esc(t('absentSign'))} `}${esc(signLabel(it.ref))}${esc(sideWord(it.side))}</button>`;
    const testName = (id: string) => esc(tr(CATALOG.manoeuvres[id]?.label ?? CATALOG.investigations[id]?.label ?? { en: id, de: id }, lang));
    const showing = [...new Set([...testsForSign(KNOWLEDGE, CATALOG, it.ref), ...Object.values(KNOWLEDGE.presentations).filter((p) => p.signs.includes(it.ref)).flatMap((p) => p.tests)])]
      .filter((id) => !['position', 'give', 'expose'].includes(CATALOG.manoeuvres[id]?.verb ?? ''));
    const how = e.elicited
      ? (e.shown ? `${t(present ? 'foundWith' : 'lookedForBy')}: ${testName(e.shown.test)}${esc(sideWord(e.shown.side))}` : `${t('foundWith')}: ${showing.filter((id) => s!.done.has(id)).map(testName).join(', ')}`)
      : `${t('shownBy')}: ${showing.map(testName).join(', ') || '—'}`;
    return `<p class="ev-sign">${name}<span class="muted"> ${how}</span></p>`;
  };
  const evidenceState = (e: DebriefResult['evidence'][number]) => e.item.kind !== 'sign' ? t(e.elicited ? 'elicited' : 'missed')
    : e.item.present === false ? t(e.elicited ? 'signRuledOut' : 'signNotLookedFor') : t(e.elicited ? 'signFound' : 'signNotFound');

  const evidenceDetail = (e: DebriefResult['evidence'][number]): string => {
    if (e.item.kind === 'sign') return s ? signDetail(e) : '';
    if (!s || !e.elicited) return '';
    if (e.finding) return `<p class="finding">${esc(describe(s, e.finding, lang))}</p>`;
    if (e.item.kind === 'fact') { const f = s.caseDef.history.find((x) => x.id === e.item.ref); return f ? `<p class="finding">“${esc(tr(f.say, lang))}”</p>` : ''; }
    const r = s.encounter.events.find((x) => x.kind === 'result' && x.test === e.item.ref);
    if (r && r.kind === 'result') { const inv = CATALOG.investigations[r.test]; return `<p class="finding">${esc(REGISTRY.formatters[inv.formatter](r.value, {}, lang, CATALOG, { property: inv.id }))}${r.t > s.t ? (lang === 'de' ? ' (lag bei der Festlegung noch nicht vor)' : ' (not back when you committed)') : ''}</p>`; }
    return '';
  };

  /* Observe only: what the learner named, against what their tests showed. */
  const documentationHtml = (doc: NonNullable<DebriefResult['documentation']>): string => {
    const sidesTxt = (sides: Side[]) => (sides.length === 2 ? ` (${t('bothSides')})` : sideWord(sides[0]));
    const chip = (id: string, sides: Side[]) => `<button type="button" class="chip" data-sign="${id}">${esc(signLabel(id))}${esc(sidesTxt(sides))}</button>`;
    const testName = (id: string) => esc(tr(CATALOG.manoeuvres[id]?.label ?? CATALOG.investigations[id]?.label ?? { en: id, de: id }, lang));
    const found = doc.hits.length + doc.misses.length;
    const summary = t('docSummary').replace('{hit}', String(doc.hits.length)).replace('{found}', String(found)).replace('{over}', String(doc.overcalls.length));
    const list = (items: string[]) => (items.length ? `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<p class="muted">—</p>');
    return `<section><h2>${esc(t('docTitle'))}</h2><p>${esc(summary)}</p><div class="doc-lists">
      <div><h3>✓ ${esc(t('docHits'))}</h3>${list(doc.hits.map((h) => chip(h.sign, h.sides)))}</div>
      <div><h3>○ ${esc(t('docMisses'))}</h3>${list(doc.misses.map((m) => `${chip(m.sign, m.sides)} <span class="muted">${esc(t('seenWith'))} ${testName(m.test)}</span>`))}</div>
      <div><h3>! ${esc(t('docOver'))}</h3>${list(doc.overcalls.map((o) => `${chip(o.sign, o.sides)}${o.wrongSide ? ` <span class="muted">${esc(t('wrongSide'))}</span>` : ''}${o.insteadNormal ? ` <span class="muted">${esc(t('wasNormal'))}</span> ${chip(o.insteadNormal, [])}` : ''}`))}</div>
    </div></section>`;
  };

  /* The patient in the stations: what each test shows on this patient, read from the knowledge tables, and a way in. */
  const stationsHtml = () => {
    if (!live) return '';
    const sl = (x: string) => esc(labelOf(KNOWLEDGE, `sign:${x}`, lang));
    const row = (which: StationId, title: string, present: Set<string>) => `<li><b>${esc(title)}</b> ${t('stationShows')}: ${present.size ? [...present].map(sl).join(', ') : `<span class="muted">${t('stationNormal')}</span>`}
      <button type="button" class="ghost small" data-open-station="${which}" data-on-patient="1">${t('openInStation')}</button></li>`;
    let ecg = new Set<string>(), ausc = new Set<string>(), eyes = new Set<string>(), pulse = new Set<string>();
    try { ecg = ecgSignsOf(live.model, live.snap, live.chemistry).present; ausc = auscSignsOf(live.model, live.snap, live.chemistry).present; pulse = pulseSignsOf(live.model, live.snap, live.chemistry).present; } catch { /* a model without a circulation */ }
    try { eyes = eyeSignsOf(live.model, live.snap, live.chemistry).present; } catch { /* nothing to read */ }
    return `<section><h2>${t('inStation')}</h2><p class="muted">${t('inStationNote')}</p><ul class="plain db-stations">${row('ecg', t('stationEcgYours'), ecg)}${row('auscultation', t('stationAuscYours'), ausc)}${row('pulse', t('stationPulseYours'), pulse)}${row('eyes', t('stationEyesYours'), eyes)}</ul></section>`;
  };
  const renderDebrief = () => {
    if (!s || !debrief) return;
    const d = debrief, c = s.caseDef;
    const dxName = (id: string) => esc(tr(CATALOG.diagnoses[id].label, lang));
    const weight = (w: string) => `<span class="pill ${w}">${t(w)}</span>`;
    const modelFindings = s.encounter.events.filter((e) => e.kind === 'finding' && e.finding.provenance === 'model' && e.finding.basis && !e.finding.normal);
    const seen = new Set<string>();
    $('#debrief').innerHTML = `
      <header class="db-head"><div><div class="eyebrow">${t('debrief')} · ${esc(c.patient.name)}</div><h1>${esc(tr(c.title, lang))}</h1></div>
        <div class="focus-tools"><button type="button" class="primary" id="db-explore">${t('explore')}</button><button type="button" class="ghost" id="db-back">${t('again')}</button></div></header>
      <section class="verdict ${d.diagnosis.correct ? 'ok' : d.diagnosis.level ? 'partly' : 'no'}">
        <b>${d.diagnosis.correct ? t('correct') : d.diagnosis.level ? t('partly') : t('incorrect')}.</b>
        ${d.diagnosis.level ? esc(t(d.diagnosis.level === 'syndrome' ? 'levelSyndrome' : d.diagnosis.level === 'state' ? 'levelState' : 'levelLab')) : ''}
        ${t('diagnosisWas')}: ${dxName(d.diagnosis.primary)}.
        ${d.diagnosis.rank && d.diagnosis.rank > 1 ? (lang === 'de' ? `Bei Ihnen auf Platz ${d.diagnosis.rank}.` : `You ranked it ${d.diagnosis.rank}.`) : ''}
        <div class="db-time">${t('time')}: ${d.minutes} ${t('min')} · ${t('budget')} ${d.budgetMinutes} ${t('min')}</div>
      </section>
      <section><h2>${t('expert')}</h2><p class="summary">${esc(tr(c.reference.summary, lang))}</p></section>
      <section><h2>${t('evidence')}</h2><ul class="evidence">${d.evidence.map((e) => `
        <li class="${e.elicited ? 'got' : 'miss'}"><div class="ev-top"><span class="mark">${e.elicited ? '✓' : '○'}</span>${weight(e.item.weight)}<span class="state">${evidenceState(e)}</span></div>
        ${e.item.kind === 'sign' ? evidenceDetail(e) : ''}<p>${esc(tr(e.item.why, lang))}</p>${e.item.kind === 'sign' ? '' : evidenceDetail(e)}</li>`).join('')}</ul></section>
      ${d.documentation ? documentationHtml(d.documentation) : ''}
      <section class="two"><div><h2>${t('redFlags')}</h2><ul class="plain">${d.redFlags.map((r) => `<li><span class="mark">${r.covered ? '✓' : '○'}</span> ${esc(tr(r.why, lang))} <span class="muted">(${r.covered ? t('covered') : t('uncovered')})</span></li>`).join('')}</ul></div>
        <div><h2>${t('hazards')}</h2>${d.hazards.length ? `<ul class="plain">${d.hazards.map((h) => `<li>${esc(tr(CATALOG.manoeuvres[h.manoeuvre]?.hazards?.find((x) => x.code === h.code)?.why ?? { en: h.code === 'no-consent' ? 'Examined without asking for consent first.' : h.code, de: h.code === 'no-consent' ? 'Ohne vorherige Einwilligung untersucht.' : h.code }, lang))}</li>`).join('')}</ul>` : `<p class="muted">${t('noHazards')}</p>`}</div></section>
      <section class="two"><div><h2>${t('ddxConsidered')}</h2><p>${d.diagnosis.differentialConsidered.map(dxName).join(', ') || '—'}</p></div>
        <div><h2>${t('ddxMissed')}</h2><p>${d.diagnosis.differentialMissed.map(dxName).join(', ') || '—'}</p></div></section>
      <section><h2>${t('how')}</h2><ul class="plain mono">${modelFindings.map((e) => {
        if (e.kind !== 'finding' || seen.has(e.finding.property)) return '';
        seen.add(e.finding.property);
        return `<li><b>${esc(tr(CATALOG.properties[e.finding.property.replace(/\.(L|R)$/, '')].label, lang))}</b> — ${esc(e.finding.basis!)}</li>`;
      }).join('') || '<li class="muted">—</li>'}</ul></section>
      ${stationsHtml()}
      <section><h2>${t('compare')}</h2><div class="two notes-compare"><div class="mine">${myNotes.trim() ? esc(myNotes).replace(/\n/g, '<br>') : '<span class="muted">—</span>'}</div><div class="auto">${notesHtml(autoNote(s, lang))}</div></div></section>`;
    $('#db-back').onclick = () => { stopLive(); renderWard(); show('ward'); };
    root.querySelectorAll<HTMLButtonElement>('#debrief [data-sign]').forEach((b) => b.onclick = () => { cardBack = []; cardNow = { kind: 'sign', id: b.dataset.sign! }; renderCard(); });
    $('#db-explore').onclick = () => { show('encounter'); layer = 'physiology'; chapter = /stroke|foot/.test(base.id) ? 'nervous-system' : /vestib/.test(base.id) ? 'vor' : base.tags.includes('respiratory') ? 'gas-exchange' : 'haemodynamics'; live?.start(); renderEncounter(); renderLayer(); };
  };

  /* ---- wiring ------------------------------------------------------------------------ */
  $('#cmdform').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#cmd') as HTMLInputElement; const v = i.value; i.value = ''; submit(v); tab = 'feed'; renderEncounter(); renderSuggest(); });
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab as typeof tab; renderEncounter(); });
  ($('#mynotes') as HTMLTextAreaElement).addEventListener('input', (e) => { myNotes = (e.target as HTMLTextAreaElement).value; });
  $('#wait').onclick = () => { if (!s) return; const before = s.t; s.t += 10 * 60000; afterTime(before); renderEncounter(); };
  $('#leave').onclick = () => { setVisual(null); stopLive(); renderWard(); show('ward'); };
  $('#to-commit').onclick = () => { renderCommit(); ($('#ddx-q') as HTMLInputElement).focus(); };
  $('#ddx-q').addEventListener('input', renderCommit);
  $('#commit-cancel').onclick = () => { $('#commit').hidden = true; };
  $('#commit-go').onclick = () => {
    if (!s || !ddx.length) return;
    debrief = commit(s, ddx);
    committed = true;
    $('#commit').hidden = true;
    setVisual(null);
    live?.stop();
    renderDebrief();
    show('debrief');
  };
  const setLang = () => {
    document.documentElement.lang = lang;
    root.querySelectorAll<HTMLButtonElement>('.langbtn').forEach((b) => b.textContent = lang === 'en' ? 'Deutsch' : 'English');
    renderWard();
    if (s) { s.encounter.locale = lang; renderEncounter(); renderLayer(); if (visual) setVisual(visual); }
    if (debrief && !$('#debrief').hidden) renderDebrief();
    if (!$('#commit').hidden) renderCommit();
    station?.setLang(lang);
  };
  root.querySelectorAll<HTMLButtonElement>('.langbtn').forEach((b) => b.onclick = () => { lang = lang === 'en' ? 'de' : 'en'; setLang(); });
  void observeIn;

  /* Report a problem: the state a report carries (report.ts). The learner's own notes stay out. In the playtest copy
     the same state is recorded as the person goes (session-record.ts), and a report carries the trail's last steps. */
  const appState = () => {
    const screen = ['ward', 'encounter', 'debrief', 'station'].find((x) => !$(`#${x}`).hidden) ?? 'ward';
    const snap = live ? Object.fromEntries(Object.entries(live.snap).filter(([k]) => k !== 'beat')) : null;
    return {
      screen: !$('#commit').hidden ? `${screen}+commit` : !$('#card').hidden ? `${screen}+card` : screen,
      caseId: s ? base.id : 'none', caseVersion: s ? base.version : undefined, free, lang, committed,
      layer, tab, chapter: layer === 'physiology' ? chapter : undefined, region, visual: visual?.kind ?? null, card: $('#card').hidden ? null : cardNow,
      simMinutes: minutes(), liveSeconds: live ? Math.round(live.t) : null,
      state: s?.state ?? null, events: s?.encounter.events ?? [], differential: ddx,
      debrief: debrief ? { correct: debrief.diagnosis.correct, level: debrief.diagnosis.level, rank: debrief.diagnosis.rank } : null,
      model: live?.model ?? null, snapshot: snap, chemistry: live?.chemistry ?? null,
      station: screen === 'station' ? stationNow : null,
      ...(trailTail() ? { playtestTrail: trailTail() } : {}),
    };
  };
  installReport({ root, lang: () => lang, app: appState });
  installRecorder({ root, lang: () => lang, app: () => { const a = appState(); return { ...a, screen: a.screen === 'station' && stationNow ? `station:${stationNow}` : a.screen }; } });

  setLang();
  show('ward');
}

const el = document.getElementById('vp');
if (el) mount(el);
