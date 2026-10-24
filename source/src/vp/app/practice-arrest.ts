import { tr, type LocalizedText } from '../model/i18n.ts';
import { breathingOf, ScenarioRun, TICK_S, type Breathing } from '../scenario/run.ts';
import type { NudgeId } from '../scenario/types.ts';
import { note, recordRun } from './session-record.ts';
import type { ScenarioDef } from '../scenario/types.ts';
import { FREE_CASE } from './free-case.ts';
import arrestPractice from '../scenarios/arrest-practice.json';
import arrestPe from '../scenarios/arrest-pe.json';
import arrestTension from '../scenarios/arrest-tension.json';
import arrestBleeding from '../scenarios/arrest-bleeding.json';
import arrestTamponade from '../scenarios/arrest-tamponade.json';
import arrestHyperkalaemia from '../scenarios/arrest-hyperkalaemia.json';
import arrestHypoxia from '../scenarios/arrest-hypoxia.json';
import arrestOpioid from '../scenarios/arrest-opioid.json';
import arrestHypothermia from '../scenarios/arrest-hypothermia.json';
import arrestHypokalaemia from '../scenarios/arrest-hypokalaemia.json';
import ercAls2025 from '../guidelines/erc-2025-als.json';
import type { GuidelineDef } from '../guidelines/types.ts';
import { scoreRun } from '../guidelines/score.ts';
import { debriefHtml, drawDebrief } from './arrest-debrief.ts';
import { INTERVENTION_BY_ID } from '../data/interventions.ts';
import { TEAM_ROLES, type CallContent, type TeamRole } from '../scenario/types.ts';
import { collapsePose, jerkPose, patientLayer, sceneSvg, SCENE_VIEWBOX, type ScenePerson, type SceneTask } from '../render/arrest-scene.ts';
import { figureLookFor } from '../render/patient-figure.ts';
import type { Lang } from './diagrams.ts';
import type { StationHandle, StationOptions } from './station-ecg.ts';

/* ---------------------------------------------------------------------------
   Practice: a cardiac arrest, with the clock running (ADR-018, a first
   screen after step 2). Draft, for the owner to try.

   A healthy man and a nurse; after a few seconds his heart fibrillates. The
   learner's hands do what hands do: tap to compress (or press the space
   bar), take the bag and squeeze a breath. One pair of hands cannot do both,
   so changing over costs the pause it costs in life. The nurse does what she
   is told: compressions, the bag, two breaths.

   Everything shown is the model's: the monitor draws the circulation's own
   2 ms samples (with an arterial line, for teaching), the numbers come from
   the circulation and the lungs, and the run is a ScenarioRun, so it could
   be replayed from its seed and the learner's inputs. The defibrillator
   (step 3) and the drugs (step 4) come with the nurse on the arrest trolley.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Practice · draft', 'Übung · Entwurf'), title: L('Cardiac arrest', 'Herz-Kreislauf-Stillstand'),
  lede: L('Your hands on a running patient: compressions and breaths, then the defibrillator, a cannula and the drugs, which the nurse brings. Whether a shock works, and what follows, is chance, weighted by how long his heart has gone without blood.',
    'Ihre Hände an einem laufenden Patienten: Thoraxkompressionen und Beatmung, dann Defibrillator, Venenzugang und Medikamente, die die Pflegekraft bringt. Ob ein Schock wirkt und was folgt, ist Zufall, gewichtet danach, wie lange sein Herz ohne Blut war.'),
  back: L('Ward', 'Übersicht'), preparing: L('Preparing the patient…', 'Der Patient wird vorbereitet…'),
  pause: L('Pause', 'Anhalten'), resume: L('Resume', 'Weiter'), restart: L('Start again', 'Neu beginnen'),
  monitor: L('Monitor', 'Monitor'), monitorNote: L('ECG lead II, arterial pressure (an arterial line, for teaching: on the ward you would not have one), the pressure of the compressions in the chest, and airway pressure.',
    'EKG Ableitung II, arterieller Druck (eine arterielle Kanüle, zum Lernen: auf Station hätten Sie keine), der Druck der Kompressionen im Thorax und der Atemwegsdruck.'),
  monitorNoteWard: L('ECG lead II, the pressure of the compressions in the chest, and airway pressure. No arterial line, as on the ward: end-tidal CO₂ is your guide to the compressions.',
    'EKG Ableitung II, der Druck der Kompressionen im Thorax und der Atemwegsdruck. Keine arterielle Kanüle, wie auf Station: das endtidale CO₂ zeigt Ihnen, wie gut Sie drücken.'),
  aline: L('Arterial line', 'Arterielle Kanüle'), on: L('on', 'an'), off: L('off', 'aus'),
  lastBreath: L('Last breath', 'Letzte Beatmung'), breathHint: L('Hold to squeeze the bag; let go to end the breath. Aim for about a second.', 'Gedrückt halten, um den Beutel zu drücken; loslassen beendet die Beatmung. Etwa eine Sekunde.'),
  ecg: L('ECG II', 'EKG II'), art: L('Artery', 'Arterie'), chest: L('Chest', 'Thorax'), paw: L('Airway', 'Atemweg'),
  abp: L('Arterial', 'Arteriell'), cpp: L('Coronary perfusion', 'Koronarer Perfusionsdruck'), etco2: L('End-tidal CO₂', 'Endtidales CO₂'), time: L('Time', 'Zeit'),
  hands: L('Your hands', 'Ihre Hände'),
  startCpr: L('Start compressions', 'Kompressionen beginnen'), stopCpr: L('Stop compressions', 'Kompressionen beenden'),
  push: L('Push', 'Drücken'), pushHint: L('Tap here, or press the space bar, once per compression.', 'Hier tippen oder die Leertaste drücken, einmal pro Kompression.'),
  takeBag: L('Take the bag', 'Beutel nehmen'), dropBag: L('Put the bag down', 'Beutel ablegen'), breath: L('Give a breath', 'Beatmen'),
  rate: L('Rate', 'Frequenz'), count: L('Count', 'Zählung'), handsOff: L('Hands off', 'Pause'), perMin: L('/min', '/min'), s: L('s', 's'),
  target: L('aim: 100–120/min, 30 then 2 breaths, pauses under 10 s', 'Ziel: 100–120/min, 30 dann 2 Beatmungen, Pausen unter 10 s'),
  team: L('The team', 'Das Team'), teamHint: L('You lead. Give each task to someone; a task nobody has is not done.', 'Sie leiten. Geben Sie jede Aufgabe jemandem; eine Aufgabe, die niemand hat, wird nicht erledigt.'),
  call: L('Call the arrest team', 'Reanimationsteam alarmieren'), sayWhere: L('say where (ward, room)', 'Ort nennen (Station, Zimmer)'), sayArrest: L('say “cardiac arrest, adult”', '„Herz-Kreislauf-Stillstand, Erwachsener“ sagen'), sayDefib: L('ask for the defibrillator', 'Defibrillator anfordern'),
  callBy: L('{name} calls', '{name} ruft an'), fetch: L('{name}: fetch the trolley', '{name}: Notfallwagen holen'), called: L('team called, due at {t}', 'Team alarmiert, erwartet um {t}'),
  cmdHandsOff: L('Hands off!', 'Hände weg!'), resumeCpr: L('Resume compressions', 'Kompressionen fortsetzen'),
  roleCompressions: L('compressions', 'Kompressionen'), roleAirway: L('airway', 'Atemweg'), roleDefibrillator: L('defibrillator', 'Defibrillator'), roleDrugs: L('line & drugs', 'Zugang & Medikamente'),
  give: L('give', 'Aufgabe'), sAway: L('away', 'weg'), sFree: L('no task', 'ohne Aufgabe'), sBusy: L('busy', 'beschäftigt'), sCalling: L('on the phone', 'telefoniert'),
  noTask: L('nobody has this task: give it to someone', 'niemand hat diese Aufgabe: geben Sie sie jemandem'),
  order: L('{name}, take {task}.', '{name}, übernehmen Sie {task}.'), ack: L('{task}: I’ve got it.', '{task}: übernehme ich.'),
  onIt: L('{label}: on it.', '{label}: mache ich.'), doneIt: L('{label}: done.', '{label}: erledigt.'),
  callText: L('Cardiac arrest{adult}{where}{defib}.', 'Herz-Kreislauf-Stillstand{adult}{where}{defib}.'), callAdult: L(', adult', ', Erwachsener'), callWhere: L(', ward 3, room 12', ', Station 3, Zimmer 12'), callDefib: L(', bring the defibrillator', ', bitte Defibrillator mitbringen'),
  callVague: L('We need help here!', 'Wir brauchen hier Hilfe!'), teamArrive: L('the arrest team is here', 'das Reanimationsteam ist da'),
  doctorName: L('Doctor', 'Ärztin'), nurse2Name: L('Nurse 2', 'Pflegekraft 2'),
  scene: L('The patient and the team', 'Patient und Team'),
  getTrolley: L('I’ll get the trolley.', 'Ich hole den Notfallwagen.'),
  nurse: L('The nurse', 'Die Pflegekraft'),
  nCpr: L('Take over compressions', 'Kompressionen übernehmen'), nBag: L('Take the bag', 'Beutel nehmen'), nTwo: L('Two breaths', 'Zwei Beatmungen'), nStop: L('Stop what you are doing', 'Aufhören'),
  busy: L('busy', 'beschäftigt'), free: L('free', 'frei'),
  nDoingCpr: L('compressing', 'drückt'), nDoingBag: L('holding the bag', 'hält den Beutel'),
  breathing: L('Breathing', 'Atmung'), bNormal: L('breathing', 'atmet'), bGasping: L('gasping: agonal breaths, not breathing', 'Schnappatmung: agonale Atemzüge, keine Atmung'), bNone: L('not breathing', 'atmet nicht'), bFailing: L('slow, shallow breaths: not normal breathing', 'langsame, flache Atemzüge: keine normale Atmung'),
  notChecked: L('not checked yet', 'noch nicht geprüft'), checkedAt: L('checked at {t}', 'geprüft um {t}'),
  logGasp: L('gasps', 'schnappt nach Luft'), logBreath: L('gives a breath', 'beatmet'),
  why: L('Why it works', 'Warum es wirkt'),
  trend: L('The last two minutes', 'Die letzten zwei Minuten'),
  whyCpp: L('Between compressions the aorta is still under pressure while the right atrium is not: that difference, the coronary perfusion pressure, is what fills the heart’s own arteries. It builds over several compressions and is gone within seconds of stopping. In people, a return of circulation was seen only when it reached 15 mmHg or more (Paradis 1990).',
    'Zwischen den Kompressionen steht die Aorta noch unter Druck, der rechte Vorhof nicht: dieser Unterschied, der koronare Perfusionsdruck, füllt die Herzkranzgefäße. Er baut sich über mehrere Kompressionen auf und ist Sekunden nach dem Aufhören weg. Bei Menschen kehrte ein Kreislauf nur zurück, wenn er 15 mmHg oder mehr erreichte (Paradis 1990).'),
  whyCo2: L('End-tidal CO₂ follows the flow: the CO₂ in the breath is what the blood brought to the lungs. Without compressions it falls towards zero even while you ventilate; with good compressions it rises again. With no breaths given, nothing comes out to measure.',
    'Das endtidale CO₂ folgt dem Fluss: das CO₂ in der Ausatemluft ist, was das Blut zur Lunge gebracht hat. Ohne Kompressionen fällt es gegen null, auch wenn Sie beatmen; mit guten Kompressionen steigt es wieder. Ohne Beatmung kommt nichts heraus, das man messen könnte.'),
  events: L('What happened', 'Was geschah'),
  you: L('You', 'Sie'), nurseName: L('Nurse', 'Pflegekraft'), patient: L('Patient', 'Patient'),
  blocked: L('Not now', 'Jetzt nicht'),
  reasons_busy: L('your hands are busy', 'Ihre Hände sind beschäftigt'), reasons_absent: L('not here yet', 'noch nicht da'),
  draft: L('Draft for review: the physiology is from ADR-018 steps 1–4 (compressions, breathing in arrest, given breaths, the heart in arrest and the shock, adrenaline and amiodarone; alteplase dissolving a pulmonary embolism; a tension pneumothorax and its decompression; blood loss and fluids; a tamponade and its drainage; hyperkalaemia, calcium and insulin; hypokalaemia and potassium chloride; an opioid and naloxone; hypothermia); the scene, the wording and the layout are first attempts. The monitor’s labels and the numbers are the model’s own.',
    'Entwurf zur Durchsicht: die Physiologie stammt aus ADR-018, Schritte 1–4 (Kompressionen, Atmung im Stillstand, Beatmung, das Herz im Stillstand und der Schock, Adrenalin und Amiodaron; Alteplase, die eine Lungenembolie auflöst; ein Spannungspneumothorax und seine Entlastung; Blutverlust und Volumen; eine Tamponade und ihre Punktion; Hyperkaliämie, Calcium und Insulin; Hypokaliämie und Kaliumchlorid; ein Opioid und Naloxon; Hypothermie); Szene, Wortlaut und Gestaltung sind erste Versuche. Beschriftungen und Zahlen des Monitors stammen aus dem Modell.'),
  drugs: L('Line and drugs', 'Zugang und Medikamente'), gNotHere: L('on the trolley, on its way', 'auf dem Notfallwagen, unterwegs'), gNoLine: L('no line yet', 'noch kein Zugang'), gLine: L('line in', 'Zugang liegt'),
  gAdrAgo: L('adrenaline {n} mg, last {t} ago', 'Adrenalin {n} mg, zuletzt vor {t}'), gAmio: L('amiodarone {n} mg', 'Amiodaron {n} mg'),
  iv: L('IV cannula', 'Venenzugang legen'), adr: L('Adrenaline 1 mg', 'Adrenalin 1 mg'), amio300: L('Amiodarone 300 mg', 'Amiodaron 300 mg'), amio150: L('Amiodarone 150 mg', 'Amiodaron 150 mg'), lysis: L('Alteplase 50 mg (lysis)', 'Alteplase 50 mg (Lyse)'), fluid: L('Fluid bolus 500 mL', 'Volumenbolus 500 mL'), calcium: L('Calcium chloride 10 mL', 'Calciumchlorid 10 mL'), insulin: L('Insulin + glucose', 'Insulin + Glucose'), naloxone: L('Naloxone 0.4 mg', 'Naloxon 0,4 mg'), kcl20: L('KCl 20 mmol over 2–3 min', 'KCl 20 mmol über 2–3 min'), kcl10: L('KCl 10 mmol over 2 min', 'KCl 10 mmol über 2 min'),
  gFluid: L('{n} mL fluid', '{n} mL Volumen'), reasons_equipment_fluids: L('the fluids are on the arrest trolley', 'die Infusionen sind am Notfallwagen'),
  gLysis: L('alteplase given', 'Alteplase gegeben'),
  logIv: L('has a line in', 'hat einen Venenzugang gelegt'), logDose: L('gives {drug} {mg} mg IV', 'gibt {drug} {mg} mg i.v.'),
  nameAdr: L('adrenaline', 'Adrenalin'), nameAmio: L('amiodarone', 'Amiodaron'),
  reasons_not_ventilating: L('you are not holding the bag', 'Sie halten den Beutel nicht'), fitting: L('Putting the mask on…', 'Maske wird aufgesetzt…'),
  reasons_access_iv: L('no IV access yet', 'noch kein Venenzugang'), reasons_access_pads: L('the pads are not on', 'die Elektroden kleben noch nicht'),
  defib: L('Defibrillator', 'Defibrillator'), dNotHere: L('on its way', 'unterwegs'), dNoPads: L('here, pads not on', 'da, Elektroden nicht aufgeklebt'), dPads: L('pads on', 'Elektroden aufgeklebt'),
  dCharging: L('charging…', 'lädt…'), dCharged: L('charged: 150 J', 'geladen: 150 J'),
  finish: L('Finish and debrief', 'Beenden und nachbesprechen'), check: L('Check rhythm', 'Rhythmus prüfen'), logCheck: L('checks the rhythm', 'beurteilt den Rhythmus'),
  rVf: L('VF', 'Kammerflimmern'), rVt: L('VT', 'Kammertachykardie'), rAsystole: L('asystole', 'Asystolie'), rOrganised: L('an organised rhythm', 'ein organisierter Rhythmus'),
  pads: L('Pads on', 'Elektroden aufkleben'), charge: L('Charge 150 J', 'Laden 150 J'), shockNow: L('Shock: stand clear!', 'Schock: alle weg!'),
  noFree: L('no one has free hands', 'niemand hat die Hände frei'),
  logPads: L('has the pads on', 'hat die Elektroden aufgeklebt'), logCharged: L('defibrillator charged', 'Defibrillator geladen'),
  logShock: L('shocks', 'schockt'), logArrive: L('the arrest trolley is here', 'der Notfallwagen ist da'),
  oNone: L('no effect: not a shockable rhythm', 'keine Wirkung: kein schockbarer Rhythmus'), oStill: L('VF goes on', 'das Kammerflimmern geht weiter'),
  oOrg: L('VF ends: an organised rhythm', 'Kammerflimmern endet: ein organisierter Rhythmus'), oAsys: L('VF ends: asystole', 'Kammerflimmern endet: Asystolie'), oUncharged: L('not charged', 'nicht geladen'),
  logRefib: L('VF is back', 'das Kammerflimmern ist zurück'), logLeave: L('runs for the arrest trolley', 'läuft zum Notfallwagen'), away: L('away', 'weg'),
  first: L('First: the bed and the airway', 'Zuerst: Bett und Atemweg'),
  firstHint: L('He slumped where he sat. Compressions need him flat on a firm surface; look at his breathing with the airway opened.', 'Er ist im Sitzen zusammengesackt. Für Kompressionen muss er flach auf fester Unterlage liegen; die Atmung bei geöffnetem Atemweg prüfen.'),
  xBed: L('Lay the bed flat', 'Bett flach stellen'), xBreathing: L('Check breathing', 'Atmung prüfen'), xMouth: L('Look in the mouth', 'In den Mund schauen'), xClear: L('Suction / Magill forceps', 'Absaugen / Magill-Zange'),
  bedRaised: L('head of the bed raised', 'Kopfteil hochgestellt'), bedFlat: L('lying flat', 'liegt flach'), bedLowering: L('lowering the bed…', 'Bett wird flach gestellt…'),
  reasons_position_supine: L('he is not lying flat: lay the bed flat first', 'er liegt nicht flach: zuerst das Bett flach stellen'),
  reasons_equipment_airway_kit: L('suction and forceps are on the arrest trolley', 'Absaugung und Zange sind am Notfallwagen'),
  reasons_equipment_defibrillator: L('the defibrillator is on the arrest trolley', 'der Defibrillator ist am Notfallwagen'),
  reasons_equipment_drugs: L('the drugs are on the arrest trolley', 'die Medikamente sind am Notfallwagen'),
  reasons_equipment_cannula_kit: L('the cannulas are on the arrest trolley', 'die Kanülen sind am Notfallwagen'),
  reasons_equipment_thrombolytic: L('the arrest team brings the alteplase', 'das Reanimationsteam bringt die Alteplase mit'),
  reasons_already_called: L('the team is already called', 'das Team ist schon alarmiert'),
  logBreathingSeizing: L('opens the airway, looks: he is still jerking, the breathing cannot be judged until it stops', 'öffnet den Atemweg, sieht: er zuckt noch, die Atmung lässt sich erst beurteilen, wenn es aufhört'),
  logSeizure: L('jerks all over: arms, legs and head, in irregular twitches', 'zuckt am ganzen Körper: Arme, Beine und Kopf, in unregelmäßigen Zuckungen'),
  logSeizureEnd: L('the jerking stops; he lies still', 'das Zucken hört auf; er liegt still'),
  bSeizing: L('still jerking: not judged', 'zuckt noch: nicht beurteilbar'),
  logBreathingNone: L('opens the airway, looks and listens: not breathing', 'öffnet den Atemweg, sieht und hört: keine Atmung'),
  logBreathingGasp: L('opens the airway, looks and listens: only gasps, not normal breathing', 'öffnet den Atemweg, sieht und hört: nur Schnappatmung, keine normale Atmung'),
  logBreathingNormal: L('opens the airway, looks and listens: breathing normally', 'öffnet den Atemweg, sieht und hört: atmet normal'),
  logBreathingFailing: L('opens the airway, looks and listens: a few slow, shallow breaths, not normal breathing', 'öffnet den Atemweg, sieht und hört: einzelne langsame, flache Atemzüge, keine normale Atmung'),
  logMouthClear: L('looks in his mouth: nothing in it', 'schaut in den Mund: nichts darin'),
  xChest: L('Look at and listen to the chest', 'Thorax ansehen und abhören'), xNeedleL: L('Needle decompression left', 'Entlastungspunktion links'), xNeedleR: L('Needle decompression right', 'Entlastungspunktion rechts'),
  logChest: L('looks at and listens to the chest with a breath: left {l}, right {r}.', 'sieht und hört den Thorax bei einer Beatmung ab: links {l}, rechts {r}.'),
  cSilent: L('silent, does not rise', 'kein Atemgeräusch, hebt sich nicht'), cNormal: L('air entry heard, rises', 'Atemgeräusch hörbar, hebt sich'),
  xEcho: L('Focused ultrasound', 'Fokussierter Ultraschall'), xEcls: L('Call ECLS for rewarming', 'ECLS zur Wiedererwärmung rufen'), xPeri: L('Pericardiocentesis', 'Perikardpunktion'),
  logEcho: L('scans in the pause:', 'schallt in der Pause:'),
  eLarge: L('a large pericardial effusion', 'ein großer Perikarderguss'), eSmall: L('a small pericardial effusion', 'ein kleiner Perikarderguss'), eNone: L('no pericardial effusion', 'kein Perikarderguss'),
  eRv: L('the right ventricle is dilated', 'der rechte Ventrikel ist dilatiert'), eEmpty: L('small, empty ventricles', 'kleine, leere Ventrikel'),
  eSliding: L('lung sliding left {l}, right {r}', 'Pleuragleiten links {l}, rechts {r}'), ePresent: L('present', 'vorhanden'), eAbsent: L('absent', 'fehlt'),
  reasons_equipment_ultrasound: L('the arrest team brings the ultrasound', 'das Reanimationsteam bringt den Ultraschall'),
  reasons_equipment_pericardiocentesis: L('the arrest team brings the pericardiocentesis set', 'das Reanimationsteam bringt das Punktionsset'),
  cTracheaRight: L('The trachea is pushed to the right.', 'Die Trachea ist nach rechts verlagert.'), cTracheaLeft: L('The trachea is pushed to the left.', 'Die Trachea ist nach links verlagert.'),
  logMouthBolus: L('looks in his mouth: a bolus of food in his throat', 'schaut in den Mund: ein Speisebrocken im Rachen'),
  logCleared: L('takes the bolus out: the airway is clear', 'entfernt den Brocken: der Atemweg ist frei'),
  logNoRise: L('the chest does not rise', 'der Thorax hebt sich nicht'),
  logFlat: L('lays the bed flat', 'stellt das Bett flach'),
  logPulse: L('a pulse: a circulation is back', 'Puls tastbar: ein Kreislauf ist zurück'), logNoPulse: L('no pulse: pulseless electrical activity', 'kein Puls: pulslose elektrische Aktivität'),
  tNoRise: L('No chest rise: something blocks the airway?', 'Keine Thoraxhebung: ist der Atemweg verlegt?'),
  tBolus: L('A bolus of food in his throat: take it out (suction, Magill forceps)', 'Ein Speisebrocken im Rachen: entfernen (Absaugen, Magill-Zange)'),
  tNotBreathing: L('Not breathing normally: start compressions', 'Keine normale Atmung: mit den Kompressionen beginnen'),
  tShockable: L('Shockable rhythm', 'Schockbarer Rhythmus'), tNonShockable: L('Not shockable', 'Nicht schockbar'),
  sBusyFor: L('busy, {s} s', 'beschäftigt, {s} s'),
  tHands: L('Hands', 'Hände'), tAirway: L('Airway', 'Atemweg'), tDefib: L('Defib', 'Defi'), tDrugs: L('Drugs', 'Medis'), tTeam: L('Team', 'Team'), tMonitor: L('Monitor', 'Monitor'),
  finishShort: L('Debrief', 'Debriefing'), close: L('Close', 'Schließen'),
  idleHint: L('Tap the patient or someone in the scene, or use the tabs below.', 'Tippen Sie auf den Patienten oder eine Person in der Szene, oder nutzen Sie die Reiter unten.'),
  mHead: L('His head and airway', 'Kopf und Atemweg'), mChest: L('His chest', 'Thorax'), mBed: L('The bed', 'Das Bett'), mArm: L('His arm', 'Sein Arm'), mDefib: L('The defibrillator', 'Der Defibrillator'),
  mCall: L('Call the arrest team…', 'Reanimationsteam alarmieren…'), mTake: L('Take: {task}', 'Übernehmen: {task}'),
  stCompress: L('Compressions: {who}', 'Kompressionen: {who}'), stNone: L('No one compressing', 'Niemand drückt'), stBag: L('bag: {who}', 'Beutel: {who}'),
  chooseH: L('How do you want to practise?', 'Wie möchten Sie üben?'),
  cSurprise: L('Surprise me', 'Überraschen Sie mich'), cSurpriseNote: L('Maybe a set-up lesson, maybe pure chance. You find out in the debrief.', 'Vielleicht eine angelegte Lektion, vielleicht reiner Zufall. Sie erfahren es in der Nachbesprechung.'),
  cChance: L('Pure chance', 'Reiner Zufall'), cChanceNote: L('Nothing set up: what happens is the model and its dice.', 'Nichts angelegt: Was geschieht, sind das Modell und seine Würfel.'),
  cLesson: L('Choose a lesson', 'Eine Lektion wählen'), cLessonNote: L('You will know what is coming; the surprise is gone, the practice is not.', 'Sie wissen, was kommt; die Überraschung ist weg, die Übung nicht.'),
  hazard: L('Unsafe', 'Gefährlich'), hzComp: L('shock with hands on the chest', 'Schock mit Händen am Thorax'), hzVent: L('shock while bagging', 'Schock während der Beatmung'), hzNon: L('shock of a rhythm that is not shockable', 'Schock eines nicht schockbaren Rhythmus'),
};
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const MMHG = 7.50062;
const WINDOW_S = 6;
const TREND_S = 120;

interface Sample { T: number; ecg: number; Pa: number; Pchest: number }

export function mountArrestPractice(host: HTMLElement, o: StationOptions): StationHandle {
  let lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  /* The arrests to practise (owner, 2026-10-23: every PEA situation). A surprise or pure chance picks one, so the learner
     meets the arrest without being told its cause; the debrief reveals it. Equal chances are a placement. */
  const ARRESTS = [arrestPractice, arrestPe, arrestTension, arrestBleeding, arrestTamponade, arrestHyperkalaemia, arrestHypokalaemia, arrestHypoxia, arrestOpioid, arrestHypothermia] as unknown as ScenarioDef[];
  let def = ARRESTS[0];
  let run: ScenarioRun | null = null;
  let raf = 0, stopped = false, paused = false, debrief = false;
  let lastCompressor: string | null = null, teamSig = '';
  const guideline = ercAls2025 as unknown as GuidelineDef;
  let wall0 = 0, pausedAt = 0, pausedTotal = 0, pauseWall = 0;
  /* the monitor's samples: the circulation's own (2 ms), read as they are produced */
  let buf: Sample[] = [];
  let paw: Array<{ T: number; v: number }> = [];
  let trend: Array<{ T: number; cpp: number | null; co2: number }> = [];
  let curArr: unknown[] | null = null, curStart = 0, idx = 0;
  /* the learner's compressions, for the feedback */
  let taps: number[] = [];
  let sinceBreaths = 0;
  /* the arterial line: shown while practising (for teaching), switchable; remembered on this device */
  let aline = true;
  try { aline = localStorage.getItem('cpl.arrest.aline') !== 'off'; } catch { /* storage may be unavailable */ }
  /* the squeeze in progress (wall-clock start), and the learner's last breath */
  let squeezeAt: number | null = null, squeezeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastBreath: { seconds: number; volume: number } | null = null;
  let seenEvents = 0;
  /* the log; `whoId` and `speech` put what someone said in a bubble over them in the scene */
  const log: Array<{ t: number; who: string; text: string; fromEvent?: boolean; whoId?: string; speech?: string }> = [];
  let lastBreathing = '';
  let lastSeizing = false;
  let lastNoRise = -1e9;
  /** who put the bag down to look in the mouth or clear it, and takes it up again when done */
  let rebag: string | null = null;

  const runT = () => (paused ? pausedAt : (performance.now() - wall0 - pausedTotal) / 1000);

  /* How this run is set up (ADR-018 decision 6c): a surprise (a set-up lesson or pure chance, revealed in the debrief),
     pure chance, or a lesson the learner chose. */
  let setup: { choice: 'surprise' | 'chance' | 'lesson'; nudge: NudgeId | null; scenario: string } = { choice: 'surprise', nudge: null, scenario: ARRESTS[0].id };
  const lessons = () => def.nudges ?? [];
  const pick = <X,>(xs: X[]) => xs[Math.floor(Math.random() * xs.length)];
  const start = () => {
    run = null; debrief = false;
    /* the lessons: an arrest with a cause of its own is a lesson in itself; the primary arrest's set-up nudges are its
       lessons (an arrest with a cause keeps its nudges for the surprise) */
    const ls = ARRESTS.flatMap((a) => a.scene.cause && a.reveal ? [{ scenario: a.id, nudge: '', label: a.reveal.label }]
      : (a.nudges ?? []).map((n) => ({ scenario: a.id, nudge: n.id as string, label: n.label })));
    host.innerHTML = `${head()}
      <section class="ar-choose" aria-labelledby="ar-choose-h">
        <h2 id="ar-choose-h">${t('chooseH')}</h2>
        <button type="button" class="primary" data-choose="surprise"><b>${t('cSurprise')}</b><span>${t('cSurpriseNote')}</span></button>
        <button type="button" class="ghost" data-choose="chance"><b>${t('cChance')}</b><span>${t('cChanceNote')}</span></button>
        ${ls.length ? `<details><summary>${t('cLesson')}</summary><p class="muted small">${t('cLessonNote')}</p><div class="ar-lessons">${ls.map((n) => `<button type="button" class="ghost" data-lesson="${n.nudge}" data-scenario="${n.scenario}"><b>${esc(tr(n.label, lang))}</b></button>`).join('')}</div></details>` : ''}
      </section>`;
    wire();
    host.querySelectorAll<HTMLButtonElement>('[data-choose]').forEach((b) => b.onclick = () => {
      const c = b.dataset.choose as 'surprise' | 'chance';
      /* which arrest is chance either way; a surprise is then a set-up lesson two times in three (when the arrest has any),
         pure chance otherwise. The learner is told which in the debrief. */
      const a = pick(ARRESTS), ns = a.nudges ?? [];
      const nudge = c === 'surprise' && ns.length && Math.random() < 2 / 3 ? pick(ns).id : null;
      begin({ choice: c, nudge, scenario: a.id });
    });
    host.querySelectorAll<HTMLButtonElement>('[data-lesson]').forEach((b) => b.onclick = () => begin({ choice: 'lesson', nudge: (b.dataset.lesson || null) as NudgeId | null, scenario: b.dataset.scenario! }));
  };
  const begin = (s: typeof setup) => {
    setup = s;
    def = ARRESTS.find((a) => a.id === s.scenario) ?? ARRESTS[0];
    /* forget the old run first: wiring the new page must not reach for the old run's controls (it threw, and the new
       patient was never made) */
    run = null; debrief = false;
    host.innerHTML = `${head()}<p class="muted" data-preparing>${t('preparing')}</p>`;
    wire();
    lastCompressor = null; teamSig = ''; sceneCache = null; buf = []; paw = []; trend = []; taps = []; sinceBreaths = 0; lastBreath = null; squeezeAt = null; seenEvents = 0; rebag = null; lastNoRise = -1e9; log.length = 0; curArr = null; idx = 0; lastBreathing = ''; lastSeizing = false;
    setTimeout(() => {
      if (stopped) return;
      /* a fresh seed each time: chance (gasping, the heart's noise) differs from run to run, as in life */
      run = new ScenarioRun(def, { seed: (Date.now() % 1e9) | 0, caseDef: FREE_CASE, settleSeconds: 20, nudge: setup.nudge });
      wall0 = performance.now(); pausedTotal = 0; paused = false;
      render();
    }, 30);
  };

  const head = () => `<div class="st-head">
      <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
      <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${t('title')}</h1><p class="lede">${t('lede')}</p></div>
      <span class="ar-head-buttons">${debrief || !run ? '' : `<button type="button" class="ghost" data-pause>${paused ? t('resume') : t('pause')}</button><button type="button" class="ghost" data-finish>${t('finish')}</button><button type="button" class="ghost" data-restart>${t('restart')}</button>`}</span>
    </div>`;

  /* The controls, as fragments: the desk lays them out as panels; the phone puts them in sheets behind a tab bar. Both carry
     the same data attributes, so one wiring serves both. */
  const sceneHtml = () => `<svg class="ar-scene-svg" viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${t('scene')}"></svg>
          <div class="ar-toasts" data-toasts aria-live="assertive"></div><div class="ar-menu" data-menu hidden></div>`;
  const monitorHtml = () => `<div class="st-row"><div><h2 id="ar-mon-h">${t('monitor')}</h2><div class="muted small ar-mon-note">${t(aline ? 'monitorNote' : 'monitorNoteWard')}</div></div>
            <button type="button" class="ghost small" data-aline aria-pressed="${aline}">${t('aline')}: ${t(aline ? 'on' : 'off')}</button></div>
          <canvas class="ar-strip" aria-label="${t(aline ? 'monitorNote' : 'monitorNoteWard')}"></canvas>
          <dl class="ar-nums" data-nums></dl>
          <p class="ar-breathing" data-breathing role="status"></p>`;
  const firstHtml = (hint = true) => `<h3>${t('first')} <span class="muted small" data-bed-state></span></h3>
          ${hint ? `<p class="muted small">${t('firstHint')}</p>` : ''}
          <div class="ar-row ar-wrap"><button type="button" class="ghost small" data-x="bed.flat">${t('xBed')}</button><button type="button" class="ghost small" data-x="assess.breathing">${t('xBreathing')}</button>
            <button type="button" class="ghost small" data-x="assess.mouth">${t('xMouth')}</button><button type="button" class="ghost small" data-x="airway.clear">${t('xClear')}</button></div>
          <div class="ar-row ar-wrap"><button type="button" class="ghost small" data-x="assess.chest">${t('xChest')}</button>
            <button type="button" class="ghost small" data-x="decompress.left">${t('xNeedleL')}</button><button type="button" class="ghost small" data-x="decompress.right">${t('xNeedleR')}</button>
            <button type="button" class="ghost small" data-x="assess.echo">${t('xEcho')}</button><button type="button" class="ghost small" data-x="pericardiocentesis">${t('xPeri')}</button>
            <button type="button" class="ghost small" data-x="call.ecls">${t('xEcls')}</button></div>`;
  const holdHtml = () => `<div class="ar-row"><button type="button" class="primary" data-cpr></button><button type="button" class="ghost" data-bag></button></div>`;
  const feedbackHtml = () => `<dl class="ar-feedback" data-feedback></dl>`;
  const defibHtml = () => `<h3>${t('defib')} <span class="muted small" data-defib-state></span></h3>
          <div class="ar-row ar-wrap"><button type="button" class="ghost small" data-d="pads">${t('pads')}</button><button type="button" class="ghost small" data-d="charge">${t('charge')}</button>
            <button type="button" class="ghost small" data-d="check">${t('check')}</button><button type="button" class="primary small ar-shock" data-d="shock">${t('shockNow')}</button></div>`;
  const drugsHtml = () => `<h3>${t('drugs')} <span class="muted small" data-drug-state></span></h3>
          <div class="ar-row ar-wrap"><button type="button" class="ghost small" data-g="access.iv">${t('iv')}</button><button type="button" class="ghost small" data-g="drug.adrenaline">${t('adr')}</button>
            <button type="button" class="ghost small" data-g="drug.amiodarone.300">${t('amio300')}</button><button type="button" class="ghost small" data-g="drug.amiodarone.150">${t('amio150')}</button>
            <button type="button" class="ghost small" data-g="drug.alteplase">${t('lysis')}</button><button type="button" class="ghost small" data-g="fluid.bolus">${t('fluid')}</button>
            <button type="button" class="ghost small" data-g="drug.calcium">${t('calcium')}</button><button type="button" class="ghost small" data-g="drug.insulin">${t('insulin')}</button><button type="button" class="ghost small" data-g="drug.naloxone">${t('naloxone')}</button><button type="button" class="ghost small" data-g="drug.potassium">${t('kcl20')}</button><button type="button" class="ghost small" data-g="drug.potassium10">${t('kcl10')}</button></div>`;
  const teamHtml = (hint = true) => `<h3>${t('team')}</h3>
          ${hint ? `<p class="muted small">${t('teamHint')}</p>` : ''}
          <div class="ar-call" data-call>
            <div class="small"><b>${t('call')}</b> <span class="muted" data-call-state></span></div>
            <label class="small"><input type="checkbox" data-say="where"> ${t('sayWhere')}</label>
            <label class="small"><input type="checkbox" data-say="arrest"> ${t('sayArrest')}</label>
            <label class="small"><input type="checkbox" data-say="defibrillator"> ${t('sayDefib')}</label>
            <div class="ar-row ar-wrap"><button type="button" class="ghost small" data-callby="learner">${t('callBy').replace('{name}', t('you'))}</button><button type="button" class="ghost small" data-callby="nurse">${t('callBy').replace('{name}', t('nurseName'))}</button>
              <button type="button" class="ghost small" data-fetch>${t('fetch').replace('{name}', t('nurseName'))}</button></div>
          </div>
          <div class="ar-row"><button type="button" class="ghost small" data-handsoff>${t('cmdHandsOff')}</button><button type="button" class="ghost small" data-resume>${t('resumeCpr')}</button></div>
          <div class="ar-team" data-team></div>`;
  const whyHtml = () => `<h2 id="ar-why-h">${t('why')}</h2>
          <div class="muted small">${t('trend')}</div>
          <canvas class="ar-trend" aria-label="${t('trend')}"></canvas>
          <p class="ar-legend small">${aline ? `<span class="ar-key cpp"></span>${t('cpp')} (mmHg) ` : ''}<span class="ar-key co2"></span>${t('etco2')} (mmHg)${aline ? ' <span class="muted">· 15 mmHg: Paradis</span>' : ''}</p>
          <p>${t('whyCpp')}</p><p>${t('whyCo2')}</p>`;
  const logHtml = () => `<h2 id="ar-log-h">${t('events')}</h2>
          <ol class="ar-events small" data-events aria-live="polite"></ol>`;

  /** The layout drawn last: the phone's is one screen with sheets, the desk's a grid of panels. */
  let phoneLayout = false;
  /** The phone's open sheet, if any. */
  let sheet: string | null = null;
  const SHEETS: Array<[string, string]> = [['hands', 'tHands'], ['airway', 'tAirway'], ['defib', 'tDefib'], ['drugs', 'tDrugs'], ['team', 'tTeam'], ['monitor', 'tMonitor']];

  const render = () => {
    phoneLayout = phone();
    if (phoneLayout) { renderPhone(); return; }
    host.innerHTML = `${head()}
      <p class="ar-draft muted small" role="note">${t('draft')}</p>
      <div class="ar-grid">
        <section class="panel ar-scene" aria-label="${t('scene')}">${sceneHtml()}</section>
        <section class="panel ar-monitor" aria-labelledby="ar-mon-h">${monitorHtml()}</section>
        <section class="panel ar-hands" aria-labelledby="ar-hands-h">
          <h2 id="ar-hands-h">${t('hands')}</h2>
          ${firstHtml()}
          ${holdHtml()}
          ${feedbackHtml()}
          <p class="muted small">${t('target')}</p>
          <button type="button" class="ar-pad" data-push aria-describedby="ar-push-hint">${t('push')}</button>
          <p id="ar-push-hint" class="muted small">${t('pushHint')}</p>
          <button type="button" class="ghost ar-breath" data-breath aria-describedby="ar-breath-hint">${t('breath')}</button>
          <p id="ar-breath-hint" class="muted small">${t('breathHint')}</p>
          ${defibHtml()}
          ${drugsHtml()}
          ${teamHtml()}
          <span class="st-note" role="status" data-note></span>
        </section>
        <section class="panel ar-why" aria-labelledby="ar-why-h">${whyHtml()}</section>
        <section class="panel ar-log" aria-labelledby="ar-log-h">${logHtml()}</section>
      </div>`;
    wire();
    renderEvents(true);
  };

  /* The phone (owner, 2026-10-21: "on the phone it is rather unplayable"): one screen, no page scroll. The scene with the
     numbers over it and a small strip of the ECG; one line of who does what; the pad (compressions, or the bag's squeeze)
     under the thumb; a tab bar whose sheets hold everything else. People and the patient in the scene can be tapped too. */
  const renderPhone = () => {
    const tab = (id: string, k: string) => `<button type="button" class="arp-tab${sheet === id ? ' on' : ''}" data-tab="${id}" aria-expanded="${sheet === id}">${t(k)}</button>`;
    const part = (id: string, html: string) => `<div class="arp-part" data-part="${id}"${sheet === id ? '' : ' hidden'}>${html}</div>`;
    host.innerHTML = `<div class="arp">
      <div class="arp-head">
        <button type="button" class="ghost small" data-leave>←</button>
        <b class="arp-title">${t('title')}</b>
        <span class="arp-time" data-clock>0:00</span>
        <button type="button" class="ghost small" data-pause>${paused ? t('resume') : t('pause')}</button>
        <button type="button" class="ghost small" data-finish>${t('finishShort')}</button>
        <button type="button" class="ghost small" data-restart aria-label="${t('restart')}">↺</button>
      </div>
      <section class="arp-scene ar-scene" aria-label="${t('scene')}">${sceneHtml()}<div class="arp-hud" data-hud></div></section>
      <canvas class="arp-mini" aria-hidden="true"></canvas>
      <p class="arp-status" data-status role="status"></p>
      <div class="arp-pad">
        <button type="button" class="ar-pad" data-push>${t('push')}</button>
        <button type="button" class="ghost ar-breath" data-breath>${t('breath')}</button>
        <p class="arp-idle muted" data-idle>${t('idleHint')}</p>
      </div>
      <div class="arp-sheet" data-sheet${sheet ? '' : ' hidden'}>
        <button type="button" class="arp-close ghost small" data-close aria-label="${t('close')}">✕</button>
        ${part('hands', `${holdHtml()}${feedbackHtml()}<p class="muted small">${t('target')}</p>`)}
        ${part('airway', firstHtml(false))}
        ${part('defib', defibHtml())}
        ${part('drugs', drugsHtml())}
        ${part('team', teamHtml(false))}
        ${part('monitor', `${monitorHtml()}${whyHtml()}${logHtml()}`)}
        <span class="st-note" role="status" data-note></span>
      </div>
      <nav class="arp-tabs">${SHEETS.map(([id, k]) => tab(id, k)).join('')}</nav>
    </div>`;
    wire();
    renderEvents(true);
  };
  const openSheet = (id: string | null) => {
    sheet = sheet === id ? null : id;
    if (!phoneLayout) return;
    const box = host.querySelector<HTMLElement>('[data-sheet]');
    if (box) box.hidden = !sheet;
    host.querySelectorAll<HTMLElement>('[data-part]').forEach((p) => { p.hidden = p.dataset.part !== sheet; });
    host.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => { const on = b.dataset.tab === sheet; b.classList.toggle('on', on); b.setAttribute('aria-expanded', String(on)); });
    if (sheet === 'monitor') { drawStrip(); drawTrend(); }
  };

  /* ---- the debrief (ADR-018 step 5) ----------------------------------------------------------- */
  const openDebrief = () => {
    if (!run) return;
    debrief = true;
    if (squeezeAt != null) { squeezeAt = null; run.bag('release', run.t); }
    const rep = scoreRun(guideline, run);
    const n = lessons().find((x) => x.id === setup.nudge);
    host.innerHTML = `${head()}${debriefHtml(rep, guideline, run, lang, { canReturn: !run.over, setup: { choice: setup.choice, nudge: n ? { label: n.label, explain: n.explain } : null, cause: setup.choice !== 'lesson' || !setup.nudge ? def.reveal ?? null : null } })}`;
    wire();
    const back = host.querySelector<HTMLButtonElement>('[data-db-back]');
    if (back) back.onclick = () => { debrief = false; if (paused) { pausedTotal += performance.now() - pauseWall; paused = false; } render(); };
    host.querySelector<HTMLButtonElement>('[data-db-again]')!.onclick = () => start();
    const c = host.querySelector<HTMLCanvasElement>('.ar-db-timeline');
    if (c) drawDebrief(c, rep, guideline, run, css);
    keepRun();
  };

  /* ---- the playtest copy (owner, 2026-10-23): each finished run, with what replays it exactly, goes into the session
     the recorder keeps (session-record.ts); outside the playtest copy nothing is kept. Taps are recorded app-wide. */
  const mark = (ui: string) => note(ui);
  const keepRun = () => {
    if (!run) return;
    recordRun('arrest', { scenario: `${def.id}@${def.version}`, guideline: `${guideline.id}@${guideline.version}`, seed: run.seed, nudge: setup.nudge, choice: setup.choice,
      lang, layout: phoneLayout ? 'phone' : 'desk', t: run.t, log: run.log });
  };

  /* ---- inputs ---------------------------------------------------------------------------------- */
  const note = (x: string) => { const n = host.querySelector<HTMLElement>('[data-note]'); if (n) n.textContent = x; };
  const held = (slot: string) => run?.held.get(slot);
  const phone = () => { try { return window.matchMedia('(max-width: 600px)').matches; } catch { return false; } };
  const learnerHolds = (slot: string) => held(slot)?.by === 'learner';
  /** An input lands at the run's current tick: bring the run up to now first. */
  const now = () => { if (!run) return 0; run.advanceTo(Math.floor(runT() / TICK_S) * TICK_S); return run.t; };
  /** A message over the scene, where the eyes are: what was refused and why, and what was found. */
  const toast = (text: string, tone: 'warn' | 'good' | 'info' = 'info') => {
    const box = host.querySelector<HTMLElement>('[data-toasts]');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `ar-toast ${tone}`; el.textContent = text;
    mark(`message: ${text}`);
    box.appendChild(el);
    while (box.children.length > 3) box.firstElementChild!.remove();
    setTimeout(() => el.classList.add('gone'), 3200);
    setTimeout(() => el.remove(), 3800);
  };
  const reasonText = (reason: string) => tr(T[`reasons_${reason.replace(/[^a-z]/g, '_')}`] ?? L(reason, reason), lang);
  const blocked = () => {
    const b = run?.events.filter((e) => e.kind === 'blocked').at(-1) as { reason: string } | undefined;
    const x = `${t('blocked')}: ${b ? reasonText(b.reason) : ''}`;
    note(x); toast(x, 'warn'); mark(`refused: ${b?.reason ?? ''}`);
  };
  const act = (fn: () => boolean) => { if (!run || paused) return; now(); if (!fn()) blocked(); else note(''); };
  const push = () => {
    if (!run || paused) return;
    now();
    const w = runT();
    const at = Math.max(run.t, Math.min(w, run.t + TICK_S - 0.001));
    if (run.compress(Math.round(at * 1000) / 1000)) { taps.push(w); if (taps.length > 40) taps.shift(); sinceBreaths++; note(''); }
    else blocked();
    const pad = host.querySelector<HTMLElement>('[data-push]');
    if (pad) { pad.classList.remove('hit'); void pad.offsetWidth; pad.classList.add('hit'); }
  };
  const breath = (by: string) => {
    if (!run) return false;
    const ok = run.ventilate(run.t, 1, by);
    if (ok) sinceBreaths = 0;
    return ok;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !run || !learnerHolds('compressions')) return;
    const target = e.target as HTMLElement | null;
    if (target && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
    e.preventDefault();
    if (!e.repeat) push();
  };
  document.addEventListener('keydown', onKey);

  const wire = () => {
    const lv = host.querySelector<HTMLButtonElement>('[data-leave]');
    if (lv) lv.onclick = () => o.onLeave();
    const rs = host.querySelector<HTMLButtonElement>('[data-restart]');
    if (rs) rs.onclick = () => start();
    const pb = host.querySelector<HTMLButtonElement>('[data-pause]');
    if (pb) pb.onclick = (e) => {
      if (!run) return;
      if (paused) { pausedTotal += performance.now() - pauseWall; paused = false; }
      else { pausedAt = runT(); pauseWall = performance.now(); paused = true; }
      (e.target as HTMLButtonElement).textContent = paused ? t('resume') : t('pause');
    };
    const fin = host.querySelector<HTMLButtonElement>('[data-finish]');
    if (fin) fin.onclick = () => { if (!run) return; now(); if (!paused) { pausedAt = runT(); pauseWall = performance.now(); paused = true; } openDebrief(); };
    if (!run || debrief) return;
    /* the phone's tabs and sheet */
    host.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.onclick = () => openSheet(b.dataset.tab!));
    const cl = host.querySelector<HTMLButtonElement>('[data-close]'); if (cl) cl.onclick = () => openSheet(null);
    /* the scene answers a tap: on a person, what they can be told; on the patient, what can be done there */
    const svg = host.querySelector<SVGSVGElement>('.ar-scene-svg');
    if (svg) svg.onclick = (ev) => {
      const hit = (ev.target as Element).closest<SVGElement>('[data-hit]');
      if (!hit || !run) { closeMenu(); return; }
      const box = (svg.parentElement as HTMLElement).getBoundingClientRect();
      menuFor(hit.dataset.hit!, (ev as MouseEvent).clientX - box.left, (ev as MouseEvent).clientY - box.top);
    };
    host.querySelector<HTMLButtonElement>('[data-aline]')!.onclick = () => {
      aline = !aline;
      try { localStorage.setItem('cpl.arrest.aline', aline ? 'on' : 'off'); } catch { /* not remembered */ }
      render();
    };
    host.querySelector<HTMLButtonElement>('[data-cpr]')!.onclick = () => {
      const starting = !learnerHolds('compressions');
      act(() => (learnerHolds('compressions') ? run!.release('compressions') : run!.assign('compressions', 'learner')));
      /* on a phone, bring the monitor to the top: it, your rate and the pad then fit on one screen */
      if (starting && !phoneLayout && phone()) host.querySelector('.ar-monitor')?.scrollIntoView({ block: 'start' });
    };
    host.querySelector<HTMLButtonElement>('[data-bag]')!.onclick = () => act(() => (learnerHolds('ventilation') ? run!.release('ventilation') : run!.assign('airway', 'learner')));
    host.querySelector<HTMLButtonElement>('[data-push]')!.addEventListener('pointerdown', (e) => { e.preventDefault(); push(); });
    /* a breath lasts as long as the button is held (decision 7); from the keyboard, a standard one-second breath */
    const br = host.querySelector<HTMLButtonElement>('[data-breath]')!;
    const letGo = () => {
      if (squeezeAt == null || !run) return;
      squeezeAt = null; if (squeezeTimer) { clearTimeout(squeezeTimer); squeezeTimer = null; }
      br.classList.remove('held');
      now();
      run.bag('release', run.t);
    };
    br.addEventListener('pointerdown', (e) => {
      if (!run || paused || squeezeAt != null) return;
      e.preventDefault();
      act(() => { const ok = run!.bag('squeeze', now()); if (ok) { squeezeAt = runT(); br.classList.add('held'); sinceBreaths = 0; squeezeTimer = setTimeout(letGo, 3000); } return ok; });
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) br.addEventListener(ev, letGo);
    br.onclick = (e) => { if ((e as MouseEvent).detail === 0) act(() => breath('learner')); };
    /* The defibrillator's and the drugs' actions go to whoever has that task (ADR-018 decision 8). Nobody has it: the
       leader does it with free hands, or is told to give it to someone. */
    const doer = (role: TeamRole): string | null => {
      const h = run!.roles[role];
      if (h && run!.actors[h]?.present) return h;
      const me = run!.actors.learner;
      return !me.hands && me.busyUntil <= run!.tick ? 'learner' : null;
    };
    const viaRole = (role: TeamRole, id: string) => {
      if (!run || paused) return;
      now();
      const w = doer(role);
      if (!w) { note(`${t('blocked')}: ${t('noTask')}`); toast(`${t('blocked')}: ${t('noTask')}`, 'warn'); return; }
      act(() => run!.intervene(id, w));
    };
    host.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => b.onclick = () => viaRole('defibrillator', b.dataset.d === 'pads' ? 'defib.pads' : b.dataset.d === 'charge' ? 'defib.charge' : b.dataset.d === 'check' ? 'check.rhythm' : 'defib.shock'));
    host.querySelectorAll<HTMLButtonElement>('[data-g]').forEach((b) => b.onclick = () => viaRole('drugs', b.dataset.g!));
    /* The first steps: done by the learner with free hands, else by whoever has the airway, else by anyone free. */
    const anyFree = (prefer: Array<string | null>): string | null => {
      for (const p of [...prefer, 'learner', 'nurse', 'nurse2', 'doctor']) {
        const a = p ? run!.actors[p] : null;
        if (a?.present && !a.hands && a.busyUntil <= run!.tick) return p;
      }
      return null;
    };
    host.querySelectorAll<HTMLButtonElement>('[data-x]').forEach((b) => b.onclick = () => {
      if (!run || paused) return;
      now();
      const id = b.dataset.x!;
      const kit = (INTERVENTION_BY_ID[id].needs?.equipment ?? []).find((e) => !run!.equipment.has(e));
      if (kit) { const x = `${t('blocked')}: ${reasonText(`equipment:${kit}`)}`; note(x); toast(x, 'warn'); return; }
      /* the mouth is the airway's: whoever holds the bag puts it down to look or to clear it, and takes it up again after */
      const airway = run.roles.airway, bagger = run.held.get('ventilation')?.by;
      if (id !== 'bed.flat' && id !== 'assess.breathing' && airway && bagger === airway && run.actors[airway]?.present) {
        act(() => { if (!run!.release('ventilation', airway)) return false; if (!run!.intervene(id, airway)) return false; rebag = airway; return true; });
        return;
      }
      const w = anyFree(id === 'bed.flat' ? [] : [airway]);
      if (!w) { const x = `${t('blocked')}: ${t('noFree')}`; note(x); toast(x, 'warn'); return; }
      act(() => run!.intervene(id, w));
    });
    /* calling the team, saying what the boxes say */
    host.querySelectorAll<HTMLButtonElement>('[data-callby]').forEach((b) => b.onclick = () => {
      const says = Array.from(host.querySelectorAll<HTMLInputElement>('[data-say]')).filter((x) => x.checked).map((x) => x.dataset.say as CallContent);
      act(() => run!.call(says, b.dataset.callby!));
    });
    host.querySelector<HTMLButtonElement>('[data-fetch]')!.onclick = () => act(() => run!.intervene('fetch.trolley', 'nurse'));
    /* hands off for a check or a shock, and on again, by whoever was compressing */
    host.querySelector<HTMLButtonElement>('[data-handsoff]')!.onclick = () => act(() => {
      const h = run!.held.get('compressions');
      if (!h) return true;
      lastCompressor = h.by;
      return run!.release('compressions', h.by);
    });
    host.querySelector<HTMLButtonElement>('[data-resume]')!.onclick = () => act(() => run!.assign('compressions', lastCompressor && run!.actors[lastCompressor]?.present ? lastCompressor : 'learner'));
    /* the team's cards: give a task, or (for whoever has the bag) two breaths */
    host.querySelector<HTMLElement>('[data-team]')!.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || !run || paused) return;
      if (b.dataset.assign) { const [role, to] = b.dataset.assign.split(':'); act(() => run!.assign(role as TeamRole, to)); }
      else if (b.dataset.two) {
        const w = b.dataset.two;
        act(() => {
          /* two breaths, a second and a half apart */
          if (!breath(w)) return false;
          const at = run!.t + 1.5;
          const second = () => { if (!run || stopped) return; if (run.t + 1e-9 < at) { now(); if (run.t + 1e-9 < at) { setTimeout(second, 50); return; } } breath(w); };
          setTimeout(second, 1500);
          return true;
        });
      }
    };
  };

  /* ---- the scene's menu (tap a person or the patient) ----------------------------------------- */
  const closeMenu = () => { const m = host.querySelector<HTMLElement>('[data-menu]'); if (m) { m.hidden = true; m.innerHTML = ''; } };
  const menuFor = (hit: string, x: number, y: number) => {
    const m = host.querySelector<HTMLElement>('[data-menu]');
    if (!m || !run) return;
    const r = run;
    /* each item stands for a control that already exists (in a panel or a sheet): same rules, same refusals */
    type Item = { label: string; sel?: string; sheet?: string };
    const btn = (sel: string): Item => ({ label: (host.querySelector(sel)?.textContent ?? '').trim(), sel });
    let title = '';
    let items: Item[] = [];
    if (hit.startsWith('person:')) {
      const p = hit.slice(7);
      title = who(p);
      if (p === 'learner') items = [btn('[data-cpr]'), btn('[data-bag]')];
      else {
        items = TEAM_ROLES.map((role) => ({ label: t('mTake').replace('{task}', roleName(role)), sel: `[data-assign="${role}:${p}"]` }));
        if (host.querySelector(`[data-two="${p}"]`)) items.unshift(btn(`[data-two="${p}"]`));
        if (r.held.get('compressions')?.by === p) items.unshift(btn('[data-handsoff]'));
      }
      if (p === 'learner' || p === 'nurse') { if (!r.called) items.push({ label: t('mCall'), sheet: 'team' }); }
      if (p === 'nurse' && !r.equipment.has('defibrillator')) items.push(btn('[data-fetch]'));
    } else if (hit === 'head') { title = t('mHead'); items = [btn('[data-x="assess.breathing"]'), btn('[data-x="assess.mouth"]'), btn('[data-x="airway.clear"]'), btn('[data-bag]')]; }
    else if (hit === 'chest') { title = t('mChest'); items = [btn('[data-cpr]'), btn('[data-resume]'), btn('[data-d="pads"]'), btn('[data-d="check"]'), btn('[data-x="assess.chest"]'), btn('[data-x="decompress.left"]'), btn('[data-x="decompress.right"]'), btn('[data-x="assess.echo"]'), btn('[data-x="pericardiocentesis"]')]; }
    else if (hit === 'bed') { title = t('mBed'); items = [btn('[data-x="bed.flat"]')]; }
    else if (hit === 'arm') { title = t('mArm'); items = ['access.iv', 'drug.adrenaline', 'drug.amiodarone.300', 'drug.amiodarone.150', 'drug.alteplase', 'fluid.bolus', 'drug.calcium', 'drug.insulin', 'drug.naloxone', 'drug.potassium', 'drug.potassium10'].map((g) => btn(`[data-g="${g}"]`)); }
    else if (hit === 'defib') { title = t('mDefib'); items = ['pads', 'charge', 'check', 'shock'].map((d) => btn(`[data-d="${d}"]`)); }
    items = items.filter((i) => i.label);
    if (!items.length) { closeMenu(); return; }
    m.innerHTML = `<div class="ar-menu-title">${esc(title)}</div>${items.map((i, k) => {
      const off = i.sel ? !!(host.querySelector<HTMLButtonElement>(i.sel)?.disabled) : false;
      return `<button type="button" class="ar-menu-item" data-k="${k}"${off ? ' disabled' : ''}>${esc(i.label)}</button>`;
    }).join('')}`;
    m.hidden = false;
    const W = (m.parentElement as HTMLElement).clientWidth, H = (m.parentElement as HTMLElement).clientHeight;
    m.style.left = `${Math.max(4, Math.min(W - m.offsetWidth - 4, x - m.offsetWidth / 2))}px`;
    m.style.top = `${Math.max(4, Math.min(H - m.offsetHeight - 4, y + 8))}px`;
    m.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-k]');
      if (!b) return;
      const it = items[Number(b.dataset.k)];
      closeMenu();
      if (it.sheet) { if (phoneLayout) openSheet(it.sheet); else host.querySelector('[data-call]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      host.querySelector<HTMLButtonElement>(it.sel!)?.click();
    };
  };

  /** The phone's small strip under the scene: the last 4 s of lead II (and the arterial line, when it is on). */
  const drawMini = () => {
    const c = host.querySelector<HTMLCanvasElement>('.arp-mini');
    if (!c || !run || !c.clientWidth) return;
    const { g, w } = sizeCanvas(c, 46);
    const tNow = (run.live.run.sim as any).t as number, span = 4, from = tNow - span;
    const x = (T: number) => ((T - from) / span) * w;
    const line = (get: (s: Sample) => number, lo: number, hi: number, top: number, hgt: number, color: string) => {
      g.strokeStyle = color; g.lineWidth = 1.4; g.beginPath(); let first = true;
      for (let i = 0; i < buf.length; i += 2) { const s = buf[i]; if (s.T < from) continue; const y = top + hgt - ((get(s) - lo) / (hi - lo)) * hgt; if (first) { g.moveTo(x(s.T), y); first = false; } else g.lineTo(x(s.T), y); }
      g.stroke();
    };
    line((s) => s.ecg, -1.2, 1.6, 2, aline ? 24 : 42, css('--trace'));
    if (aline) line((s) => s.Pa, 0, Math.max(80, ...buf.map((s) => s.Pa)) + 5, 26, 18, '#c0392b');
  };

  /* ---- reading the model ------------------------------------------------------------------------ */
  const readSamples = () => {
    if (!run) return;
    const sim = run.live.run.sim as any;
    if (curArr && sim.beat !== curArr) {
      const old = curArr as Array<Record<string, number>>;
      for (; idx < old.length; idx++) { const s = old[idx]; buf.push({ T: (curStart + s.t) / 1000, ecg: s.ecg, Pa: s.Pa, Pchest: s.Pchest ?? 0 }); }
      curArr = null;
    }
    if (!curArr) { curArr = sim.beat; curStart = sim.beatStartT; idx = 0; }
    const arr = curArr as Array<Record<string, number>>;
    for (; idx < arr.length; idx++) { const s = arr[idx]; buf.push({ T: (curStart + s.t) / 1000, ecg: s.ecg, Pa: s.Pa, Pchest: s.Pchest ?? 0 }); }
    const tNow = sim.t as number;
    while (buf.length && buf[0].T < tNow - WINDOW_S - 1) buf.shift();
    const r = run.live.snap.resp;
    paw.push({ T: tNow, v: r.Paw ?? 0 });
    while (paw.length && paw[0].T < tNow - WINDOW_S - 1) paw.shift();
    const m = run.live.snap.metrics;
    if (!trend.length || tNow - trend.at(-1)!.T >= 1) {
      trend.push({ T: tNow, cpp: m?.CPP ?? null, co2: (r.EtCO2 ?? 0) * MMHG });
      while (trend.length && trend[0].T < tNow - TREND_S) trend.shift();
    }
  };

  /* ---- drawing --------------------------------------------------------------------------------- */
  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const sizeCanvas = (c: HTMLCanvasElement, h: number) => {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth;
    if (c.style.height !== `${h}px`) c.style.height = `${h}px`;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w };
  };
  const drawStrip = () => {
    const c = host.querySelector<HTMLCanvasElement>('.ar-strip');
    if (!c || !run || !c.clientWidth) return;
    const h = Math.round(Math.max(phone() ? 170 : 240, Math.min(340, c.clientWidth * 0.42)));
    const { g, w } = sizeCanvas(c, h);
    const fg = css('--trace'), muted = css('--muted'), line = css('--grid'), art = '#c0392b', acc = css('--accent');
    g.fillStyle = css('--surface'); g.fillRect(0, 0, w, h);
    const pad = 46, tNow = (run.live.run.sim as any).t as number, from = tNow - WINDOW_S;
    const x = (T: number) => pad + ((T - from) / WINDOW_S) * (w - pad - 8);
    const rows: Array<{ key: string; label: string; top: number; hgt: number; lo: number; hi: number; color: string; get: (s: Sample) => number; unit?: string }> = [
      { key: 'ecg', label: t('ecg'), top: 6, hgt: h * (aline ? 0.24 : 0.5), lo: -1.2, hi: 1.6, color: fg, get: (s) => s.ecg },
      ...(aline ? [{ key: 'art', label: t('art'), top: h * 0.30, hgt: h * 0.36, lo: 0, hi: Math.max(80, ...buf.map((s) => s.Pa)) + 5, color: art, get: (s: Sample) => s.Pa, unit: 'mmHg' }] : []),
      { key: 'chest', label: t('chest'), top: h * (aline ? 0.70 : 0.60), hgt: h * (aline ? 0.13 : 0.2), lo: 0, hi: 60, color: acc, get: (s) => s.Pchest },
    ];
    g.font = '500 10px "JetBrains Mono", ui-monospace, monospace'; g.textBaseline = 'middle';
    for (const r of rows) {
      g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.moveTo(pad, r.top + r.hgt); g.lineTo(w - 8, r.top + r.hgt); g.stroke();
      g.fillStyle = muted; g.fillText(r.label, 4, r.top + r.hgt / 2);
      if (r.unit) { g.fillText(`${Math.round(r.hi)}`, 4, r.top + 6); g.fillText('0', 4, r.top + r.hgt - 4); }
      g.strokeStyle = r.color; g.lineWidth = 1.5; g.lineJoin = 'round'; g.beginPath();
      let first = true;
      for (let i = 0; i < buf.length; i += 2) {
        const s = buf[i]; if (s.T < from) continue;
        const y = r.top + r.hgt - ((r.get(s) - r.lo) / (r.hi - r.lo)) * r.hgt;
        if (first) { g.moveTo(x(s.T), y); first = false; } else g.lineTo(x(s.T), y);
      }
      g.stroke();
    }
    /* airway pressure, from the lungs (0.1 s) */
    const top = h * 0.86, hgt = h * 0.12;
    g.strokeStyle = line; g.beginPath(); g.moveTo(pad, top + hgt); g.lineTo(w - 8, top + hgt); g.stroke();
    g.fillStyle = muted; g.fillText(t('paw'), 4, top + hgt / 2);
    g.strokeStyle = '#3f6fb5'; g.lineWidth = 1.5; g.beginPath();
    paw.filter((p) => p.T >= from).forEach((p, i) => { const y = top + hgt - Math.min(1, p.v / 30) * hgt; i ? g.lineTo(x(p.T), y) : g.moveTo(x(p.T), y); });
    g.stroke();
  };
  const drawTrend = () => {
    const c = host.querySelector<HTMLCanvasElement>('.ar-trend');
    if (!c || !run || !c.clientWidth) return;
    const h = 150;
    const { g, w } = sizeCanvas(c, h);
    g.fillStyle = css('--surface'); g.fillRect(0, 0, w, h);
    const tNow = (run.live.run.sim as any).t as number, from = tNow - TREND_S, pad = 34;
    const x = (T: number) => pad + ((T - from) / TREND_S) * (w - pad - 8);
    const y = (v: number) => h - 14 - (Math.max(0, Math.min(40, v)) / 40) * (h - 24);
    g.font = '500 10px "JetBrains Mono", ui-monospace, monospace'; g.textBaseline = 'middle'; g.fillStyle = css('--muted');
    for (const v of [0, 15, 40]) { g.strokeStyle = css('--grid'); g.lineWidth = 1; g.setLineDash(v === 15 ? [4, 4] : []); g.beginPath(); g.moveTo(pad, y(v)); g.lineTo(w - 8, y(v)); g.stroke(); g.fillText(String(v), 4, y(v)); }
    g.setLineDash([]);
    const series = (get: (p: typeof trend[number]) => number | null, color: string) => {
      g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); let on = false;
      for (const p of trend) { const v = get(p); if (v == null) { on = false; continue; } if (!on) { g.moveTo(x(p.T), y(v)); on = true; } else g.lineTo(x(p.T), y(v)); }
      g.stroke();
    };
    if (aline) series((p) => p.cpp, '#c0392b');
    series((p) => p.co2, '#3f6fb5');

  };
  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const renderNumbers = () => {
    if (!run) return;
    const sim = run.live.run.sim as any, m = run.live.snap.metrics ?? {}, r = run.live.snap.resp;
    const recent = buf.filter((s) => s.T > sim.t - 4);
    const sys = recent.length ? Math.max(...recent.map((s) => s.Pa)) : NaN, dia = recent.length ? Math.min(...recent.map((s) => s.Pa)) : NaN;
    const breaths = (r.givenRate ?? 0) > 0 || (r.RR ?? 0) > 0;
    const nums = host.querySelector<HTMLElement>('[data-nums]');
    if (nums) nums.innerHTML = `
      ${aline ? `<div><dt>${t('abp')}</dt><dd>${Number.isFinite(sys) ? `${Math.round(sys)}/${Math.round(dia)}` : '—'} <span class="muted small">mmHg</span></dd></div>
      <div><dt>${t('cpp')}</dt><dd>${m.CPP != null ? Math.round(m.CPP) : '—'} <span class="muted small">mmHg</span></dd></div>` : ''}
      <div><dt>${t('etco2')}</dt><dd>${breaths ? Math.round((r.EtCO2 ?? 0) * MMHG) : '—'} <span class="muted small">mmHg</span></dd></div>
      <div><dt>${t('time')}</dt><dd>${fmtT(run.t)}</dd></div>`;
    const w = runT();
    const last = taps.filter((x) => x > w - 6).slice(-6);
    const rate = last.length >= 3 ? 60 / ((last.at(-1)! - last[0]) / (last.length - 1)) : null;
    const off = learnerHolds('compressions') || held('compressions') ? (taps.length && learnerHolds('compressions') ? w - taps.at(-1)! : 0) : null;
    const fb = host.querySelector<HTMLElement>('[data-feedback]');
    if (fb) fb.innerHTML = `
      <div><dt>${t('rate')}</dt><dd class="${rate != null && (rate < 100 || rate > 120) ? 'abn' : ''}">${rate != null ? Math.round(rate) : '—'} <span class="muted small">${t('perMin')}</span></dd></div>
      <div><dt>${t('count')}</dt><dd class="${sinceBreaths > 30 ? 'abn' : ''}">${sinceBreaths}<span class="muted small">/30</span></dd></div>
      <div><dt>${t('handsOff')}</dt><dd class="${off != null && off > 10 ? 'abn' : ''}">${off != null && off > 1.5 ? off.toFixed(0) : '—'} <span class="muted small">${t('s')}</span></dd></div>
      <div><dt>${t('lastBreath')}</dt><dd class="${lastBreath && (lastBreath.seconds < 0.6 || lastBreath.seconds > 1.5) ? 'abn' : ''}">${lastBreath ? `${lastBreath.seconds.toFixed(1)} <span class="muted small">${t('s')}</span> · ${Math.round(lastBreath.volume * 1000)} <span class="muted small">mL</span>` : '—'}</dd></div>`;
    const cpr = host.querySelector<HTMLButtonElement>('[data-cpr]'), bag = host.querySelector<HTMLButtonElement>('[data-bag]');
    if (cpr) cpr.textContent = learnerHolds('compressions') ? t('stopCpr') : t('startCpr');
    /* the mask takes a few seconds to put on: say so, rather than offer a breath that cannot be given yet */
    const fitting = run.events.some((e: any) => e.kind === 'begin' && e.id === 'vent.bag' && e.by === 'learner' && e.until > run!.t);
    if (bag) { bag.textContent = fitting ? t('fitting') : learnerHolds('ventilation') ? t('dropBag') : t('takeBag'); bag.disabled = fitting; }
    const pad = host.querySelector<HTMLButtonElement>('[data-push]'); if (pad) pad.disabled = !learnerHolds('compressions');
    const br = host.querySelector<HTMLButtonElement>('[data-breath]'); if (br) br.disabled = !learnerHolds('ventilation');
    if (phoneLayout) {
      /* under the thumb: whatever the learner's hands hold */
      const comp = learnerHolds('compressions'), bagging = learnerHolds('ventilation');
      if (pad) pad.hidden = !comp;
      if (br) br.hidden = comp || !bagging;
      const idle = host.querySelector<HTMLElement>('[data-idle]'); if (idle) idle.hidden = comp || bagging;
      const ck = host.querySelector<HTMLElement>('[data-clock]'); if (ck) ck.textContent = fmtT(run.t);
      const hud = host.querySelector<HTMLElement>('[data-hud]');
      if (hud) hud.innerHTML = `<span>${t('etco2').replace('End-tidal ', 'Et').replace('Endtidales ', 'Et')} <b>${breaths ? Math.round((r.EtCO2 ?? 0) * MMHG) : '—'}</b></span>${aline ? `<span>CPP <b>${m.CPP != null ? Math.round(m.CPP) : '—'}</b></span><span>${t('art').slice(0, 3)} <b>${Number.isFinite(sys) ? `${Math.round(sys)}/${Math.round(dia)}` : '—'}</b></span>` : ''}`;
      const st = host.querySelector<HTMLElement>('[data-status]');
      if (st) {
        const c = held('compressions'), v = held('ventilation');
        const parts = [c ? t('stCompress').replace('{who}', who(c.by)) : t('stNone')];
        if (comp) parts.push(`${rate != null ? Math.round(rate) : '—'}/min`, `${sinceBreaths}/30`);
        if (v) parts.push(t('stBag').replace('{who}', who(v.by)));
        st.innerHTML = parts.map((x, i) => (i === 1 && rate != null && (rate < 100 || rate > 120)) || (i === 2 && comp && sinceBreaths > 30) ? `<b class="abn">${esc(x)}</b>` : esc(x)).join(' · ');
      }
    }
    const ds = host.querySelector<HTMLElement>('[data-defib-state]');
    if (ds) {
      const charging = run.events.some((e: any) => e.kind === 'begin' && e.id === 'defib.charge' && e.until > run!.t);
      ds.textContent = !run.equipment.has('defibrillator') ? t('dNotHere') : !run.access.has('pads') ? t('dNoPads') : run.charged ? t('dCharged') : charging ? t('dCharging') : t('dPads');
      host.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((b) => { b.disabled = !run!.equipment.has('defibrillator') || (b.dataset.d !== 'pads' && !run!.access.has('pads')) || (b.dataset.d === 'pads' && run!.access.has('pads')) || (b.dataset.d === 'shock' && !run!.charged); });
    }
    const gs = host.querySelector<HTMLElement>('[data-drug-state]');
    if (gs) {
      const here = run.equipment.has('drugs'), line = run.access.has('iv');
      const doses = run.events.filter((e) => e.kind === 'dose') as Array<{ t: number; drug: string; mg: number }>;
      const adr = doses.filter((d) => d.drug === 'adrenaline'), amio = doses.filter((d) => d.drug === 'amiodarone').reduce((a, d) => a + d.mg, 0);
      const parts = [!here ? t('gNotHere') : line ? t('gLine') : t('gNoLine')];
      if (adr.length) parts.push(t('gAdrAgo').replace('{n}', String(adr.reduce((a, d) => a + d.mg, 0))).replace('{t}', fmtT(run.t - adr.at(-1)!.t)));
      if (amio) parts.push(t('gAmio').replace('{n}', String(amio)));
      if (doses.some((d) => d.drug === 'alteplase')) parts.push(t('gLysis'));
      const fluid = run.events.filter((e) => e.kind === 'done' && e.id === 'fluid.bolus').length * 500;
      if (fluid) parts.push(t('gFluid').replace('{n}', String(fluid)));
      gs.textContent = parts.join(' · ');
      host.querySelectorAll<HTMLButtonElement>('[data-g]').forEach((b) => { b.disabled = (b.dataset.g === 'drug.alteplase' ? !run!.equipment.has('thrombolytic') : b.dataset.g === 'fluid.bolus' ? !run!.equipment.has('fluids') : !here) || (b.dataset.g === 'access.iv' ? line : !line); });
    }
    const bst = host.querySelector<HTMLElement>('[data-bed-state]');
    if (bst) {
      const flatNow = run.session.state.position === 'supine';
      const lowering = run.events.some((e: any) => e.kind === 'begin' && e.id === 'bed.flat' && e.until > run!.t);
      bst.textContent = flatNow ? t('bedFlat') : lowering ? t('bedLowering') : t('bedRaised');
      const bb = host.querySelector<HTMLButtonElement>('[data-x="bed.flat"]'); if (bb) bb.disabled = flatNow || lowering;
    }
    renderTeam();
    /* Gasps are seen and heard from across the room, so they are logged as they come; whether he breathes otherwise is
       known only by looking (the breathing check), so the line shows the last check and when it was. */
    const state = breathingOf(r as any);
    /* the jerking is seen from across the room: its end is logged as it comes */
    const jerking = run.seizing();
    if (lastSeizing && !jerking) log.push({ t: run.t, who: t('patient'), text: t('logSeizureEnd') });
    lastSeizing = jerking;
    if (state !== lastBreathing) {
      if (lastBreathing && state === 'gasping') log.push({ t: run.t, who: t('patient'), text: t('logGasp') });
      lastBreathing = state;
    }
    const bs = host.querySelector<HTMLElement>('[data-breathing]');
    const seen = [...run.events].reverse().find((e) => e.kind === 'assessed' && e.what === 'breathing') as { t: number; breathing: Breathing; seizing?: boolean } | undefined;
    if (bs) bs.innerHTML = `<span class="muted">${t('breathing')}:</span> ${seen ? `<b class="${seen.breathing === 'normal' && !seen.seizing ? '' : 'abn'}">${t(seen.seizing ? 'bSeizing' : bKey(seen.breathing))}</b> <span class="muted small">(${t('checkedAt').replace('{t}', fmtT(seen.t))})</span>` : `<b>${t('notChecked')}</b>`}`;
  };
  const bKey = (b: Breathing) => (b === 'gasping' ? 'bGasping' : b === 'normal' ? 'bNormal' : b === 'failing' ? 'bFailing' : 'bNone');
  const who = (x: string) => (x === 'learner' ? t('you') : x === 'nurse' ? t('nurseName') : x === 'doctor' ? t('doctorName') : x === 'nurse2' ? t('nurse2Name') : x === 'patient' ? t('patient') : x);
  const roleName = (r: TeamRole) => t(`role${r[0].toUpperCase()}${r.slice(1)}`);
  const label = (id: string) => (INTERVENTION_BY_ID[id] ? tr(INTERVENTION_BY_ID[id].label, lang) : id);
  /* ---- the team ------------------------------------------------------------------------------- */
  const PEOPLE = ['learner', 'nurse', 'doctor', 'nurse2'];
  const taskOf = (id: string): SceneTask => {
    if (!run) return 'idle';
    const a = run.actors[id];
    const h = [...run.held.entries()].find(([, x]) => x.by === id)?.[0];
    if (h === 'compressions') return 'compressions';
    if (h === 'ventilation') return 'airway';
    const call = run.events.find((e) => e.kind === 'call' && e.by === id);
    if (call && a.busyUntil > run.tick && run.t - call.t < 20) return 'calling';
    /* what they are in the middle of (an errand begun and not yet done) */
    const doing = [...run.events].reverse().find((e) => e.kind === 'begin' && e.by === id && e.until > run!.t) as { id: string } | undefined;
    if (doing?.id === 'bed.flat') return 'bed';
    if (doing && (doing.id.startsWith('assess.') || doing.id === 'airway.clear')) return 'look';
    for (const r of TEAM_ROLES) if (run.roles[r] === id && (r === 'defibrillator' || r === 'drugs')) return r;
    return 'idle';
  };
  const renderTeam = () => {
    if (!run) return;
    const r = run;
    const cs = host.querySelector<HTMLElement>('[data-call-state]');
    const call = r.events.find((e) => e.kind === 'call') as { arriveAt: number } | undefined;
    if (cs) cs.textContent = call ? t('called').replace('{t}', fmtT(call.arriveAt)) : '';
    host.querySelectorAll<HTMLButtonElement>('[data-callby]').forEach((b) => { b.disabled = r.called || !r.actors[b.dataset.callby!]?.present; });
    const fb = host.querySelector<HTMLButtonElement>('[data-fetch]'); if (fb) fb.disabled = r.equipment.has('defibrillator') || !r.actors.nurse?.present;
    const left = (p: string) => Math.max(0, Math.ceil((r.actors[p]?.busyUntil - r.tick) / 10));
    const sig = JSON.stringify([PEOPLE.map((p) => [r.actors[p]?.present, taskOf(p), left(p)]), r.roles, lang]);
    if (sig === teamSig) return;
    teamSig = sig;
    const box = host.querySelector<HTMLElement>('[data-team]');
    if (!box) return;
    box.innerHTML = PEOPLE.filter((p) => r.actors[p]).map((p) => {
      const a = r.actors[p];
      const mine = TEAM_ROLES.filter((x) => r.roles[x] === p);
      const state = !a.present ? t('sAway') : taskOf(p) === 'calling' ? t('sCalling') : mine.length ? mine.map(roleName).join(', ') : a.busyUntil > r.tick ? t('sBusyFor').replace('{s}', String(left(p))) : t('sFree');
      const buttons = !a.present ? '' : TEAM_ROLES.map((x) => `<button type="button" class="ghost small${r.roles[x] === p ? ' on' : ''}" data-assign="${x}:${p}" aria-pressed="${r.roles[x] === p}">${roleName(x)}</button>`).join('')
        + (p !== 'learner' && r.roles.airway === p ? `<button type="button" class="ghost small" data-two="${p}">${t('nTwo')}</button>` : '');
      return `<div class="ar-person ${a.present ? '' : 'away'}" data-person="${p}"><span class="ar-dot" style="background:${LOOK[p].scrub}"></span><b>${who(p)}</b> <span class="muted small">${state}</span>${buttons ? `<div class="ar-row ar-wrap">${buttons}</div>` : ''}</div>`;
    }).join('');
  };

  /* ---- the scene ------------------------------------------------------------------------------ */
  const LOOK: Record<string, { scrub: string; skin: string; hair: string }> = {
    learner: { scrub: '#2f6f78', skin: '#e8c4a8', hair: '#5a4632' }, nurse: { scrub: '#8fbcd8', skin: '#c99872', hair: '#2b2118' },
    doctor: { scrub: '#7fb89d', skin: '#f0cfb4', hair: '#b58a52' }, nurse2: { scrub: '#b4a2d4', skin: '#8d5a3c', hair: '#151010' },
  };
  let sceneCache: { key: string; layer: ReturnType<typeof patientLayer> } | null = null;
  const drawScene = () => {
    const svg = host.querySelector<SVGSVGElement>('.ar-scene-svg');
    if (!svg || !run) return;
    const r = run;
    const onset = (r.events.find((e) => e.kind === 'scene' && e.state === 'arrest') as { t: number } | undefined)?.t;
    /* he slumps where he sits; the bed goes flat only when someone lowers it, over the time that takes */
    const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * x));
    const slump = onset == null ? 0 : ease((r.t - onset) / 1.2);
    const lower = [...r.events].reverse().find((e) => e.kind === 'begin' && e.id === 'bed.flat') as { t: number; until: number } | undefined;
    const flat = r.session.state.position === 'supine' ? 1 : lower ? ease((r.t - lower.t) / Math.max(0.1, lower.until - lower.t)) : 0;
    /* seizure-like jerking at the collapse (the `seizure` nudge): redrawn every frame while it lasts */
    const sz = r.seizing() ? (r.events.find((e) => e.kind === 'seizure') as { t: number } | undefined) : undefined;
    const pose = sz ? jerkPose(collapsePose(slump, flat), r.t - sz.t) : collapsePose(slump, flat);
    const last = r.trace.at(-1);
    const pulse = last && last.rhythm === 'organised' && last.Psys >= 50;
    const grey = onset != null && r.t - onset > 20 && !pulse;
    const bagging = r.held.has('ventilation') && r.did.has('vent.bag');
    const bare = r.compressions.length > 0 || r.access.has('pads');
    const key = `${slump.toFixed(2)},${flat.toFixed(2)}|${grey}|${bagging}|${bare}|${sz ? r.t.toFixed(2) : ''}`;
    if (!sceneCache || sceneCache.key !== key) {
      const look = figureLookFor(FREE_CASE.patient, { exposure: bare ? ['chest'] : [], oxygen: bagging ? { device: 'bag-valve mask', fio2: 1 } : undefined }, 7, { colour: grey ? 'grey' : 'normal' });
      sceneCache = { key, layer: patientLayer(pose, look) };
    }
    const sim = r.live.run.sim as any, resp = r.live.snap.resp as any;
    const recent = (id: string) => [...log].reverse().find((x) => x.whoId === id && r.t - x.t < 3 && x.speech);
    const people: ScenePerson[] = PEOPLE.filter((p) => r.actors[p]?.present).map((p) => ({ id: p, label: who(p), task: taskOf(p), ...LOOK[p], you: p === 'learner', says: recent(p)?.speech }));
    const ecg = buf.slice(-600).filter((_, i) => i % 8 === 0).map((x) => x.ecg);
    svg.innerHTML = sceneSvg({ pose, look: null as any, people, press: Math.min(1, (sim.Pchest ?? 0) / 23), squeeze: Math.min(1, Math.max(0, (resp?.Paw ?? 0) / 18)),
      pads: r.access.has('pads'), defibrillator: r.equipment.has('defibrillator'), charged: r.charged, line: r.access.has('iv'), ecg }, sceneCache.layer);
  };

  const renderEvents = (all = false) => {
    if (!run) return;
    if (all) { seenEvents = 0; for (let i = log.length - 1; i >= 0; i--) if (log[i].fromEvent) log.splice(i, 1); }
    const ev = run.events;
    for (; seenEvents < ev.length; seenEvents++) {
      const e = ev[seenEvents] as any;
      if (e.kind === 'say') log.push({ t: e.t, who: who(e.who), text: tr(e.text, lang), fromEvent: true });
      else if (e.kind === 'breath') {
        if (e.by === 'learner') lastBreath = { seconds: e.seconds, volume: e.volume };
        log.push({ fromEvent: true, t: e.t, who: who(e.by), text: `${t('logBreath')} (${e.seconds.toFixed(1)} ${t('s')}${e.rise === false ? `: ${t('logNoRise')}` : `, ${Math.round(e.volume * 1000)} mL`})` });
        if (!all && e.rise === false && e.t - lastNoRise > 6) { lastNoRise = e.t; toast(t('tNoRise'), 'warn'); }
      }
      else if (e.kind === 'assessed' && e.what === 'breathing' && e.seizing) {
        log.push({ fromEvent: true, t: e.t, who: who(e.by), text: t('logBreathingSeizing') });
        if (!all) toast(t('logBreathingSeizing'), 'warn');
      }
      else if (e.kind === 'seizure') {
        log.push({ fromEvent: true, t: e.t, who: t('patient'), text: t('logSeizure') });
      }
      else if (e.kind === 'assessed' && e.what === 'breathing') {
        log.push({ fromEvent: true, t: e.t, who: who(e.by), text: t(e.breathing === 'none' ? 'logBreathingNone' : e.breathing === 'gasping' ? 'logBreathingGasp' : e.breathing === 'failing' ? 'logBreathingFailing' : 'logBreathingNormal') });
        if (!all) toast(e.breathing === 'normal' ? t('logBreathingNormal') : t('tNotBreathing'), e.breathing === 'normal' ? 'good' : 'warn');
      }
      else if (e.kind === 'assessed' && e.what === 'chest' && e.chest) {
        const c = e.chest, side = (x: string) => t(x === 'silent' ? 'cSilent' : 'cNormal');
        const text = t('logChest').replace('{l}', side(c.left)).replace('{r}', side(c.right)) + (c.tension ? ` ${t(c.tension === 'left' ? 'cTracheaRight' : 'cTracheaLeft')}` : '');
        log.push({ fromEvent: true, t: e.t, who: who(e.by), text });
        if (!all) toast(text, c.left === 'silent' || c.right === 'silent' ? 'warn' : 'info');
      }
      else if (e.kind === 'assessed' && e.what === 'echo' && e.echo) {
        const x = e.echo, parts = [t(x.effusion === 'large' ? 'eLarge' : x.effusion === 'small' ? 'eSmall' : 'eNone')];
        if (x.rvDilated) parts.push(t('eRv'));
        if (x.empty) parts.push(t('eEmpty'));
        parts.push(t('eSliding').replace('{l}', t(x.sliding.left ? 'ePresent' : 'eAbsent')).replace('{r}', t(x.sliding.right ? 'ePresent' : 'eAbsent')));
        const text = `${t('logEcho')} ${parts.join('; ')}.`;
        log.push({ fromEvent: true, t: e.t, who: who(e.by), text });
        if (!all) toast(text, x.effusion === 'large' || x.rvDilated || x.empty || !x.sliding.left || !x.sliding.right ? 'warn' : 'info');
      }
      else if (e.kind === 'assessed' && e.what === 'mouth') {
        log.push({ fromEvent: true, t: e.t, who: who(e.by), text: t(e.mouth === 'bolus' ? 'logMouthBolus' : 'logMouthClear') });
        if (!all) toast(e.mouth === 'bolus' ? t('tBolus') : t('logMouthClear'), e.mouth === 'bolus' ? 'warn' : 'info');
      }
      else if (e.kind === 'assessed') {
        const rh = t(e.rhythm === 'vf' ? 'rVf' : e.rhythm === 'vt' ? 'rVt' : e.rhythm === 'asystole' ? 'rAsystole' : 'rOrganised');
        const pulse = e.pulse == null ? '' : ` — ${t(e.pulse ? 'logPulse' : 'logNoPulse')}`;
        log.push({ fromEvent: true, t: e.t, who: who(e.by), text: `${t('logCheck')}: ${rh}${pulse}` });
        if (!all) toast(`${rh}${pulse || ` — ${t(e.rhythm === 'vf' || e.rhythm === 'vt' ? 'tShockable' : 'tNonShockable')}`}`, e.pulse ? 'good' : 'warn');
      }
      if (!all && rebag && e.kind === 'done' && e.by === rebag && (e.id === 'assess.mouth' || e.id === 'airway.clear')) {
        const w = rebag; rebag = null;
        if (run.actors[w]?.present && !run.held.get('ventilation')) run.assign('airway', w);
      }
      if (e.kind === 'obstruction' && !e.what) { log.push({ fromEvent: true, t: e.t, who: who(e.by), text: t('logCleared') }); if (!all) toast(t('logCleared'), 'good'); }
      else if (e.kind === 'dose') log.push({ fromEvent: true, t: e.t, who: who(e.by), text: t('logDose').replace('{drug}', t(e.drug === 'adrenaline' ? 'nameAdr' : 'nameAmio')).replace('{mg}', String(e.mg)) });
      else if (e.kind === 'assigned' && e.to && e.to !== 'learner') {
        /* structured communication: the order, and the read-back */
        const task = roleName(e.role);
        log.push({ fromEvent: true, t: e.t, who: who('learner'), whoId: 'learner', text: `“${t('order').replace('{name}', who(e.to)).replace('{task}', task)}”`, speech: t('order').replace('{name}', who(e.to)).replace('{task}', task) });
        log.push({ fromEvent: true, t: e.t + 0.01, who: who(e.to), whoId: e.to, text: `“${t('ack').replace('{task}', task)}”`, speech: t('ack').replace('{task}', task[0].toUpperCase() + task.slice(1)) });
      }
      else if (e.kind === 'call') {
        const says: string[] = e.says;
        const text = !says.length ? t('callVague') : t('callText').replace('{adult}', says.includes('arrest') ? t('callAdult') : '').replace('{where}', says.includes('where') ? t('callWhere') : '').replace('{defib}', says.includes('defibrillator') ? t('callDefib') : '');
        log.push({ fromEvent: true, t: e.t, who: who(e.by), whoId: e.by, text: `☎ “${text}”`, speech: text });
      }
      else if (e.kind === 'begin' && e.by !== 'learner' && !['cpr.compressions', 'vent.bag', 'fetch.trolley'].includes(e.id)) {
        const x = t('onIt').replace('{label}', label(e.id));
        log.push({ fromEvent: true, t: e.t, who: who(e.by), whoId: e.by, text: `“${x}”`, speech: x });
      }
      else if (e.kind === 'done' && e.by !== 'learner' && !['cpr.compressions', 'vent.bag', 'fetch.trolley', 'defib.shock', 'check.rhythm', 'airway.clear'].includes(e.id) && !e.id.startsWith('drug.') && !e.id.startsWith('assess.')) {
        const x = t('doneIt').replace('{label}', label(e.id));
        log.push({ fromEvent: true, t: e.t, who: who(e.by), whoId: e.by, text: `“${x}”`, speech: x });
      }
      else if (e.kind === 'arrive' && e.people.includes('doctor')) { log.push({ fromEvent: true, t: e.t, who: who('doctor'), whoId: 'doctor', text: t('teamArrive') }); if (!all) toast(t('teamArrive'), 'info'); }
      else if (e.kind === 'done' && e.id !== 'defib.shock' && e.id !== 'check.rhythm' && e.id !== 'fetch.trolley' && !e.id.startsWith('drug.') && !e.id.startsWith('assess.') && e.id !== 'airway.clear') log.push({ fromEvent: true, t: e.t, who: who(e.by), text: e.id === 'defib.pads' ? t('logPads') : e.id === 'defib.charge' ? t('logCharged') : e.id === 'access.iv' ? t('logIv') : e.id === 'bed.flat' ? t('logFlat') : tr(e.id === 'cpr.compressions' ? L('starts compressions', 'beginnt mit den Kompressionen') : e.id === 'vent.bag' ? L('has the bag on the face', 'hat die Maske aufgesetzt') : INTERVENTION_BY_ID[e.id]?.label ?? L(e.id, e.id), lang) });
      else if (e.kind === 'arrive' && e.equipment.includes('defibrillator')) log.push({ fromEvent: true, t: e.t, who: who(e.people[0] ?? 'nurse'), text: t('logArrive') });
      else if (e.kind === 'leave') log.push({ fromEvent: true, t: e.t, who: who(e.people[0]), whoId: e.people[0], text: t('logLeave'), speech: t('getTrolley') });
      else if (e.kind === 'shock') {
        const x = `${t('logShock')}: ${t(e.joules === 0 ? 'oUncharged' : e.outcome === 'no-effect' ? 'oNone' : e.outcome === 'not-terminated' ? 'oStill' : e.outcome === 'organised' ? 'oOrg' : 'oAsys')}`;
        log.push({ fromEvent: true, t: e.t, who: who(e.by), text: x });
        if (!all) toast(`⚡ ${x}`, e.outcome === 'organised' ? 'good' : 'warn');
      }
      else if (e.kind === 'refibrillation') { log.push({ fromEvent: true, t: e.t, who: t('patient'), text: t('logRefib') }); if (!all) toast(t('logRefib'), 'warn'); }
      else if (e.kind === 'hazard') log.push({ fromEvent: true, t: e.t, who: `⚠ ${t('hazard')}`, text: t(e.code === 'shock-while-compressing' ? 'hzComp' : e.code === 'shock-while-ventilating' ? 'hzVent' : 'hzNon') });
      else if (e.kind === 'release') log.push({ fromEvent: true, t: e.t, who: who(e.by), text: tr(e.slot === 'compressions' ? L('stops compressions', 'beendet die Kompressionen') : L('puts the bag down', 'legt den Beutel ab'), lang) });
    }
    const box = host.querySelector<HTMLElement>('[data-events]');
    if (box) box.innerHTML = [...log].sort((a, b) => a.t - b.t).slice(-12).reverse().map((x) => `<li><span class="muted">${fmtT(x.t)}</span> <b>${esc(x.who)}</b>: ${esc(x.text)}</li>`).join('');
  };

  let tick = 0;
  const frame = () => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (!run || debrief) return;
    if (!paused) { run.advanceTo(Math.floor(runT() / TICK_S) * TICK_S); readSamples(); }
    /* the scene's end: the debrief opens by itself */
    if (run.over) { if (!paused) { pausedAt = runT(); pauseWall = performance.now(); paused = true; } openDebrief(); return; }
    drawStrip();
    if (phoneLayout) drawMini();
    if (tick % 2 === 0) drawScene();
    if (tick++ % 6 === 0) { renderNumbers(); renderEvents(); drawTrend(); }
  };

  /* turning a tablet, or resizing a window across the phone's width, changes the layout */
  const onResize = () => { if (run && !debrief && phone() !== phoneLayout) render(); };
  window.addEventListener('resize', onResize);
  start();
  raf = requestAnimationFrame(frame);
  return {
    stop: () => { stopped = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); },
    setLang: (l: Lang) => { lang = l; if (run && debrief) openDebrief(); else if (run) render(); else start(); },
  };
}
