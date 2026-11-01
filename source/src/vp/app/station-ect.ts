import { SAMS_NOTE } from '../stations/ect-sams.ts';
import { tr, type LocalizedText } from '../model/i18n.ts';
import type { Lang } from './diagrams.ts';
import { type StationHandle, type StationOptions } from './station-ecg.ts';
import { ECT_STATION } from '../stations/station.ts';
import { ECT } from '../evidence/ect.ts';
import { EctSession, FS, type EctPatient, type PaperEntry, type Spot } from '../stations/ect-session.ts';
import { PROGRAM_NAMES, PROGRAM_REPORT, DEFAULT_SETTINGS, stimulusFor, type ProgramChoice } from '../stations/ect-device.ts';
import { CHARGE_MC, PERCENT_STEPS } from '../stations/ect-programs.ts';
import { nextStep, explainStimulus, ECT_BACKGROUND, reportLines, heartNow, ECT_PHASE } from '../stations/ect-texts.ts';
import { phaseOf } from '../stations/eeg-seizure.ts';
import { PLACEMENTS, thresholdField, fieldSection, energy, type PlacementId, type FieldSection, type RegionDose } from '../physiology/brain/ect-stimulus.ts';
import { fieldFor, dosesFor } from '../physiology/brain/ect-trial.ts';
import { layoutStrip, drawStrip, type PaperItem } from '../render/ect-strip.ts';
import { drawFieldSection, drawRegionMap } from '../render/ect-head.ts';
import { ectFigure, ectLook, sceneSvg, headCloseUp, chestCloseUp, CHEST_VIEWBOX, topViewSvg, cableSvg, headSpotPoints, bodySpotPoints, placementOf, PLACEMENT_SITES, SCENE_VIEWBOX, type EctFigure, type EctDress, type SiteId } from '../render/ect-scene.ts';
import { Procedure, STEPS, STEP, RESTIM_STEPS, ECT_ORDERS, ECT_ROLES, ROLE_NAME, MODE_NAME, orderLines, type EctMode, type EctRole, type StepId, type Who } from '../stations/ect-procedure.ts';

/* ---------------------------------------------------------------------------
   The ECT station, part 1: the device, the stimulus and the seizure it starts.

   Treatment: a front panel laid out as the real device's (the owner's
   photograph and the manual): the impedance display with its test button,
   the stimulus and monitoring sockets, the FlexDial with its light, the
   percent energy display and dial with the PRESET and USER SET lights, the
   guarded treatment button, start/stop with the safety-monitor light, the
   power switch, and the strip printer. It behaves as the manual describes
   (stations/ect-device.ts); the patient behind it is part 1's head and
   part 2a's brain (stations/ect-session.ts).

   The stimulus: where the current goes for each placement, the field in a
   section through the pads, how much of each region one pulse excites, and
   the arithmetic of charge and energy.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const T: Record<string, LocalizedText> = {
  eyebrow: L('Station', 'Station'), back: L('Ward', 'Übersicht'),
          given: L('Given', 'Gegeben'), none: L('none yet', 'noch keine'),
  hrL: L('Heart rate', 'Herzfrequenz'), bpL: L('Blood pressure', 'Blutdruck'),
  heart: L('Heart', 'Herz'),
  placement: L('Electrode placement', 'Elektrodenposition'),
    skin: L('Skin impedance', 'Hautimpedanz'), skinLow: L('low', 'niedrig'), skinTypical: L('typical', 'typisch'), skinHigh: L('high', 'hoch'),
  another: L('Another run (new noise)', 'Neuer Durchlauf (anderes Rauschen)'),
  restart: L('Start again', 'Neu beginnen'),
      device: L('The device', 'Das Gerät'),
  deviceNote: L('Hold IMPEDANCE TEST and TREAT as at the device. Dials: arrows, mouse wheel or drag; tap the centre to press.', 'IMPEDANCE TEST und TREAT wie am Gerät halten. Drehknöpfe: Pfeile, Mausrad oder Ziehen; Mitte antippen zum Drücken.'),
  impedance: L('IMPEDANCE TEST', 'IMPEDANCE TEST'), ectJack: L('ECT', 'ECT'), monJack: L('EEG/ECG/EMG', 'EEG/ECG/EMG'),
  flex: L('FLEXDIAL', 'FLEXDIAL'), percent: L('PERCENT ENERGY', 'PERCENT ENERGY'), preset: L('PRESET', 'PRESET'), userSet: L('USER SET', 'USER SET'),
  treat: L('TREAT', 'TREAT'), cover: L('Lift the cover', 'Kappe heben'), coverDown: L('Close the cover', 'Kappe schließen'),
  startStop: L('START/STOP', 'START/STOP'), safety: L('SAFETY MONITOR ACTIVATED', 'SAFETY MONITOR ACTIVATED'), power: L('POWER', 'POWER'),
    turnDown: L('turn left', 'nach links drehen'), turnUp: L('turn right', 'nach rechts drehen'), pressDial: L('press', 'drücken'),
  strip: L('The strip', 'Der Streifen'),
  stripNote: L('EEG 1–2, EMG and ECG; a mark each second, the heart rate every 3 s, the ictal line on top. Drag to read back.', 'EEG 1–2, EMG und EKG; jede Sekunde eine Marke, alle 3 s die Herzfrequenz, oben die Iktallinie. Ziehen zum Zurücklesen.'),
  follow: L('Follow the printer', 'Dem Drucker folgen'),
  report: L('The report', 'Der Bericht'), noReport: L('Printed after the treatment with START/STOP.', 'Wird nach der Behandlung mit START/STOP gedruckt.'),
  now: L('What happens now', 'Was jetzt geschieht'),   more: L('Background', 'Hintergrund'),
  draft: L('Explanations are drafts until a clinician has reviewed them.', 'Die Erklärungen sind Entwürfe, bis ein Kliniker sie geprüft hat.'),
  stimTitle: L('Where the current goes', 'Wohin der Strom fließt'),
  stimNote: L('The pads’ field, computed by reciprocity in the EEG station’s four-shell head.', 'Das Feld der Elektroden, berechnet per Reziprozität im Vierschalenkopf der EEG-Station.'),
  pulseWidth: L('Pulse width', 'Pulsbreite'), dose: L('Dose on the dial', 'Dosis am Drehknopf'), program: L('Program', 'Programm'),
  section: L('The field in the plane of the pads', 'Das Feld in der Ebene der Elektroden'),
  sectionNote: L('Field in the brain (V/cm, log scale): blue below the excitation threshold for this pulse width, yellow to red above it. Rings: brain, fluid, skull, scalp.', 'Feld im Gehirn (V/cm, logarithmisch): blau unter der Erregungsschwelle für diese Pulsbreite, gelb bis rot darüber. Ringe: Gehirn, Liquor, Schädel, Kopfhaut.'),
  regions: L('One pulse in each region', 'Ein Puls in jeder Region'),
  regionsNote: L('Head from above, pads as squares: the share of each region’s cortex one pulse excites.', 'Kopf von oben, Elektroden als Quadrate: der Anteil der Rinde jeder Region, den ein Puls erregt.'),
  computing: L('Computing the field…', 'Das Feld wird berechnet…'),
  nose: L('nose', 'Nase'), left: L('left', 'links'), right: L('right', 'rechts'), up: L('vertex', 'Scheitel'),
  regionCol: L('Region', 'Region'), fieldCol: L('Field (median)', 'Feld (Median)'), excitedCol: L('Excited', 'Erregt'),
  regionName: L('frontal,central,temporal,parietal,occipital', 'frontal,zentral,temporal,parietal,okzipital'),
  sd: L('Strength and duration', 'Stärke und Dauer'),
  sdNote: L('Longer pulses need a weaker field, down to a floor: beyond about 0.3 ms, extra charge adds little.', 'Längere Pulse brauchen ein schwächeres Feld, bis zu einem Boden: Über etwa 0,3 ms bringt mehr Ladung wenig.'),
    /* the procedure */
  task: L('Your task', 'Ihre Aufgabe'), order: L('The order', 'Die Anordnung'), mode: L('Mode', 'Modus'), role: L('Your role', 'Ihre Rolle'), allRoles: L('All roles', 'Alle Rollen'),
  modeNote: L('Practise: with a coach. Watch: the team works, one step per “Next”. Exam: no help; a debrief at the end.', 'Üben: mit Coach. Zusehen: Das Team arbeitet, ein Schritt pro „Weiter“. Prüfung: ohne Hilfe; Nachbesprechung am Ende.'),
  roleNote: L('The team does the other roles.', 'Das Team übernimmt die anderen Rollen.'),
  steps: L('The steps', 'Die Schritte'), stepsExam: L('Done so far', 'Bisher erledigt'), you: L('you', 'Sie'), team: L('team', 'Team'),
  room: L('At the patient', 'Am Patienten'),   roomWatch: L('The team does every step; press “Next” in the coach.', 'Das Team erledigt jeden Schritt; „Weiter“ beim Coach drücken.'),
  notModelled: L('The bite block is drawn, not modelled.', 'Der Beißschutz ist gezeichnet, nicht modelliert.'),
  breathingOwn: L('breathing', 'atmet'), apnoeic: L('apnoeic', 'apnoisch'),
    anaesthesia: L('Anaesthesia', 'Narkose'),
  coach: L('Coach', 'Coach'), coachExam: L('Exam: no coach. The debrief follows the report.', 'Prüfung: kein Coach. Nach dem Bericht folgt die Nachbesprechung.'),
  yourNext: L('Your next step', 'Ihr nächster Schritt'), whyL: L('Why', 'Warum'), waitS: L('Wait about {s} s: {what}.', 'Etwa {s} s warten: {what}.'),
  waitInd: L('the induction agent takes effect', 'das Hypnotikum wirkt'), waitOx: L('preoxygenation (3 min)', 'Präoxygenierung (3 min)'), waitRel: L('the fasciculations pass', 'die Faszikulationen klingen ab'),
  nothingYours: L('Nothing for you now; the team is working.', 'Gerade nichts für Sie; das Team arbeitet.'),
  doing: L('{who}: {what}', '{who}: {what}'), watching: L('Seizure running: watch the strip.', 'Anfall läuft: Streifen beobachten.'),
  nextBtn: L('Next', 'Weiter'), nextIs: L('Next: {what} ({who})', 'Als Nächstes: {what} ({who})'),
  hurry: L('Faster ×4', 'Schneller ×4'), realTime: L('Real time', 'Echtzeit'), hurryNote: L('Only while you wait; back to real time when it is your turn.', 'Nur während Sie warten; zurück zur Echtzeit, wenn Sie dran sind.'),
  logL: L('In the room', 'Im Raum'), mistake: L('Mistake', 'Fehler'),
  debrief: L('Debrief', 'Nachbesprechung'), noErrors: L('No mistakes.', 'Keine Fehler.'), colStep: L('Step', 'Schritt'), colRole: L('Role', 'Rolle'), colBy: L('Done by', 'Erledigt von'), colAt: L('At', 'Zeit'), notDone: L('not done', 'nicht erledigt'),
  variation: L('The patient’s variation', 'Variation des Patienten'), moreDrugs: L('More drugs, to explore', 'Weitere Medikamente, zum Ausprobieren'),
  whyBtn: L('Behind the stimulus', 'Hinter dem Reiz'), backBtn: L('Back to the treatment', 'Zurück zur Behandlung'),
  fist: L('“Make a fist”', '„Faust machen“'),
  leadTray: L('Tap a socket, then the spot its lead goes to.', 'Buchse antippen, dann die Stelle für ihre Ableitung.'),
  leadOff: L('With no socket picked, tap a placed lead to take it off.', 'Ohne gewählte Buchse: angelegte Ableitung antippen, um sie abzunehmen.'),
  cableHint: L('The monitoring cable’s end: red (+) sockets face the label, black (−) the other side, green the ground.', 'Ende des Monitorkabels: rote (+) Buchsen zur Beschriftung, schwarze (−) gegenüber, grün die Erde.'),
  cableL: L('Monitoring cable sockets', 'Buchsen des Monitorkabels'),
  chLegend: L('1 and 2 EEG, 3 EMG, 4 ECG, ISO-GND ground.', '1 und 2 EEG, 3 EMG, 4 EKG, ISO-GND Erde.'),
  viewHead: L('Head', 'Kopf'), viewBody: L('Chest and arms', 'Brust und Arme'),
  placeL: L('Where the leads go', 'Wo die Ableitungen hinkommen'),
  leadsAll: L('Place all nine leads first.', 'Erst alle neun Ableitungen anlegen.'),
  ch1: L('EEG left', 'EEG links'), ch2: L('EEG right', 'EEG rechts'), ch3: L('EMG', 'EMG'), ch4: L('ECG', 'EKG'), ground: L('Ground', 'Erde'),
  plugIn: L('Plug in', 'Einstecken'),
  service: L('Device setup (service settings)', 'Geräte-Setup (Service-Einstellungen)'),
  doseRange: L('Dose range', 'Dosisbereich'), upTo100: L('up to 100 %', 'bis 100 %'), upTo200: L('up to 200 % (2X, CE)', 'bis 200 % (2X, CE)'),
  ubWidth: L('Ultrabrief pulse', 'Ultrakurzpuls'),
  serviceNote: L('As the device was set up: the manual offers doses up to 200 % where CE rules allow, and the ultrabrief programs with 0.25 or 0.3 ms pulses. Your hospital: 2X.', 'Wie das Gerät eingerichtet ist: Das Handbuch bietet Dosen bis 200 %, wo CE-Regeln es erlauben, und die Ultrakurzpuls-Programme mit 0,25 oder 0,3 ms. Ihr Haus: 2X.'),
  samsTitle: L('Seizure quality (SAMS)', 'Anfallsqualität (SAMS)'),
  samsAsk: L('Tick each marker the report and the strip show. The midictal amplitude: read it off the strip.', 'Jeden Marker ankreuzen, den Bericht und Streifen zeigen. Die midiktale Amplitude: vom Streifen ablesen.'),
  samsDecide: L('Decision', 'Entscheidung'),
  samsBand_good: L('4–5: good; no restimulation', '4–5: gut; keine Re-Stimulation'),
  samsBand_medium: L('2–3: medium; no restimulation, raise the dose next time', '2–3: mittel; keine Re-Stimulation, Dosis nächstes Mal erhöhen'),
  samsBand_poor: L('0–1: poor; a restimulation may follow', '0–1: schlecht; Re-Stimulation möglich'),
  samsCheck: L('Check', 'Prüfen'), samsPick: L('Choose a decision.', 'Entscheidung wählen.'),
  samsYours: L('yours', 'Ihre'), samsYouSaid: L('you said', 'Sie:'), samsRated: L('Rated; the check comes in the debrief.', 'Bewertet; die Prüfung folgt in der Nachbesprechung.'),
  restimNext: L('Restimulation: agree it with anaesthesia, set {p} %, stimulate 120–180 s after the first stimulus.', 'Re-Stimulation: mit der Anästhesie absprechen, {p} % einstellen, 120–180 s nach dem ersten Reiz stimulieren.'),
  samsBandWrong: L('Your decision does not fit the score.', 'Ihre Entscheidung passt nicht zum Score.'),
  headAboveLeads: L('Head from above: the EEG leads', 'Kopf von oben: die EEG-Ableitungen'),
  atDevice: L('Device', 'Gerät'), seizure: L('Seizure', 'Anfall'),
  scene: L('The patient', 'Der Patient'), headRight: L('Head from the right', 'Kopf von rechts'), headAbove: L('Head from above: choose two sites', 'Kopf von oben: zwei Stellen wählen'), headAboveDone: L('Head from above', 'Kopf von oben'),
  chestAbove: L('Chest and arm from above', 'Brust und Arm von oben'),
  padHint: L('Click the two pad sites.', 'Die zwei Elektrodenstellen anklicken.'),
  padBad: L('Not a standard pair. Click a site again to remove its pad.', 'Kein Standardpaar. Stelle erneut anklicken, um die Elektrode zu entfernen.'),
  padsSet: L('Pads: {p}.', 'Elektroden: {p}.'),
  site_Ltemp: L('left temporal', 'links temporal'), site_Rtemp: L('right temporal', 'rechts temporal'), site_Lfront: L('left frontal', 'links frontal'), site_Rfront: L('right frontal', 'rechts frontal'), site_vertexR: L('just right of the vertex', 'knapp rechts des Scheitels'), site_LantL: L('left anterior', 'links anterior'),
  cuffL: L('The cuff', 'Die Manschette'), cuffOnBtn: L('Put the cuff on', 'Manschette anlegen'), squeezeBtn: L('Squeeze the bulb', 'Ballon drücken'), deflateBtn: L('Let it down', 'Ablassen'), cuffUpBtn: L('The cuff is up', 'Manschette ist aufgepumpt'),
  cuffNow: L('Cuff {c} mmHg, systolic {s} mmHg', 'Manschette {c} mmHg, systolisch {s} mmHg'),
};
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const SKINS = [{ k: 'skinLow', z: -1.2 }, { k: 'skinTypical', z: 0 }, { k: 'skinHigh', z: 1.5 }];
/* The premedications the station offers, at the doses used in the ECT studies the model is checked against. */
const PREMEDS: Array<{ drug: 'atropine' | 'glycopyrrolate' | 'esmolol' | 'labetalol'; mg: number; perKg?: boolean; label: LocalizedText }> = [
  { drug: 'atropine', mg: 0.5, label: L('Atropine 0.5 mg', 'Atropin 0,5 mg') },
  { drug: 'glycopyrrolate', mg: 0.2, label: L('Glycopyrrolate 0.2 mg', 'Glycopyrronium 0,2 mg') },
  { drug: 'esmolol', mg: 1, perKg: true, label: L('Esmolol 1 mg/kg', 'Esmolol 1 mg/kg') },
  { drug: 'labetalol', mg: 0.1, perKg: true, label: L('Labetalol 0.1 mg/kg', 'Labetalol 0,1 mg/kg') },
];
const PROGRAM_ORDER: ProgramChoice[] = ['DGX', 'LOWEST', 'LOW_UB', 'LOW_05', 'INTERMIT', 'USER'];

export function mountEctStation(host: HTMLElement, o: StationOptions): StationHandle {
  let lang: Lang = o.lang;
  const t = (k: string) => tr(T[k], lang);
  const num = (x: number, d = 0) => { const s = x.toFixed(d); return lang === 'de' ? s.replace('.', ',') : s; };
  let view: 'treat' | 'stim' = 'treat';
  let patient: EctPatient = { placement: 'BT', prepared: true, skin: 0, seed: 7 };
  let orderIdx = 0, mode: EctMode = 'practise', roleSel: EctRole | 'all' = 'all';
  const order = () => ECT_ORDERS[orderIdx];
  const roles = (): EctRole[] => (roleSel === 'all' ? [...ECT_ROLES] : [roleSel]);
  patient.placement = order().placement;
  let session = new EctSession(patient, DEFAULT_SETTINGS);
  let proc = new Procedure(session, order(), mode, roles());
  /* the drawing: the patient's look and figure (rebuilt only when the arm jerks), and the sites the learner has chosen */
  const look = ectLook(7);
  let fig: EctFigure = ectFigure(look), figJerk = 0, padSites: SiteId[] = [], padMsg = '', sceneAt = -1;
  /* the lead the learner holds: a channel's black or red, or the ground */
  type LeadPick = { ch: 0 | 1 | 2 | 3; pole: 'black' | 'red' } | 'ground';
  let armed: LeadPick | null = null;
  /* the placing view: the head or the body, following the lead picked up */
  let pview: 'head' | 'body' = 'head';
  const viewFor = (l: LeadPick | null) => (l && l !== 'ground' && l.ch < 2 ? 'head' : l ? 'body' : pview);
  const LEADS: LeadPick[] = [...[0, 1, 2, 3].flatMap((ch) => (['black', 'red'] as const).map((pole): LeadPick => ({ ch: ch as 0 | 1 | 2 | 3, pole }))), 'ground'];
  armed = LEADS[0];
  const leadKey = (l: LeadPick) => (l === 'ground' ? 'g' : `${l.ch}${l.pole[0]}`);
  let stopped = false, raf = 0, last = 0, hurry = false;
  const HURRY = 4;
  let follow = true, scrollX = 0, drag: { x: number; s: number } | null = null;
  let seized = false;
  let givenList: Array<{ label: LocalizedText; at: number }> = [];
  /* the stimulus view */
  let stimPlacement: PlacementId = 'BT', stimWidth = 0.5;
  let section: FieldSection | null = null, sectionKey = '', sectionJob = 0;
  let audio: { ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null = null;

  const css = (n: string) => getComputedStyle(host).getPropertyValue(n).trim() || '#888';
  const sizeCanvas = (c: HTMLCanvasElement, h: number) => {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth;
    if (c.style.height !== `${h}px`) c.style.height = `${h}px`;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w };
  };

  const newSession = (keepSeed = true) => {
    if (!keepSeed) patient.seed = (patient.seed * 7 + 3) % 997;
    patient.placement = order().placement;
    session = new EctSession(patient, DEFAULT_SETTINGS);
    proc = new Procedure(session, order(), mode, roles());
    padSites = []; padMsg = ''; sceneAt = -1; armed = LEADS[0];
    seized = false; hurry = false; follow = true; scrollX = 0; givenList = []; printedReports.clear(); baseCache = null;
    render();
  };

  /* ---- sound: the device's tones (a continuous warning, an intermittent buzz while the current flows) ---------------- */
  const tone = (kind: 'none' | 'warning' | 'delivering') => {
    try {
      if (kind === 'none') { if (audio) audio.gain.gain.value = 0; return; }
      if (!audio) {
        const ctx = new AudioContext(), osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'square'; osc.connect(gain); gain.connect(ctx.destination); gain.gain.value = 0; osc.start();
        audio = { ctx, osc, gain };
      }
      audio.osc.frequency.value = kind === 'warning' ? 880 : 440;
      audio.gain.gain.value = kind === 'warning' ? 0.04 : (Math.floor(performance.now() / 120) % 2 ? 0.04 : 0);
    } catch { /* no audio: the lights say the same */ }
  };

  /* ---- the panel ---------------------------------------------------------------------------------------------- */
  const knob = (id: 'percent' | 'flex', label: string) => `
    <div class="ect-knob" data-knob="${id}">
      <button type="button" class="ect-turn" data-turn="${id}" data-dir="-1" aria-label="${esc(label)}: ${t('turnDown')}">◀</button>
      <button type="button" class="ect-face" data-face="${id}" aria-label="${esc(label)}: ${t('pressDial')}"><span></span></button>
      <button type="button" class="ect-turn" data-turn="${id}" data-dir="1" aria-label="${esc(label)}: ${t('turnUp')}">▶</button>
    </div>`;
  const panelHtml = () => `
    <div class="ect-panel" data-panel>
      <div class="ect-col">
        <div class="ect-led ect-led8" data-led-left aria-live="polite"></div>
        <button type="button" class="ect-btn ect-yellow" data-imp>${t('impedance')}</button>
        <div class="ect-jacks">
          <button type="button" class="ect-jack" data-jack="stim" aria-pressed="${session.stimulusCable}"><span class="ect-plug"></span>${t('ectJack')}</button>
          <span class="ect-dot" data-led-mon title="ECG"></span>
          <button type="button" class="ect-jack" data-jack="mon" aria-pressed="${session.monitoringCable}"><span class="ect-plug"></span>${t('monJack')}</button>
        </div>
      </div>
      <div class="ect-col ect-center">
        <div class="ect-lab"><span class="ect-dot" data-led-flex></span>${t('flex')}</div>
        ${knob('flex', t('flex'))}
      </div>
      <div class="ect-col ect-center">
        <div class="ect-led ect-led4" data-led-right></div>
        <div class="ect-lab">${t('percent')}</div>
        ${knob('percent', t('percent'))}
        <div class="ect-lights"><span><span class="ect-dot" data-led-preset></span>${t('preset')}</span><span><span class="ect-dot" data-led-user></span>${t('userSet')}</span></div>
      </div>
      <div class="ect-col ect-center">
        <div class="ect-treat ${proc.room.coverUp ? 'open' : ''}" data-treat-wrap>
          <button type="button" class="ect-btn ect-yellow ect-big" data-treat ${proc.room.coverUp ? '' : 'disabled'}>${t('treat')}</button>
          <button type="button" class="ect-cover" data-cover>${proc.room.coverUp ? t('coverDown') : t('cover')}</button>
        </div>
      </div>
      <div class="ect-col ect-center">
        <div class="ect-lab"><span class="ect-dot ect-red" data-led-safety></span>${t('safety')}</div>
        <button type="button" class="ect-btn" data-startstop>${t('startStop')}</button>
        <button type="button" class="ect-rocker" data-power aria-pressed="${session.device.on}"><span>I</span><span>0</span></button>
        <div class="ect-lab">${t('power')}</div>
      </div>
      <div class="ect-printer" aria-hidden="true"><div class="ect-slot"></div></div>
    </div>`;

  const updatePanel = () => {
    const d = session.device, p = host.querySelector<HTMLElement>('[data-panel]');
    if (!p) return;
    const flash = Math.floor(performance.now() / 350) % 2 === 0;
    const left = p.querySelector<HTMLElement>('[data-led-left]')!;
    left.textContent = d.leftFlashes && !flash ? '' : d.left;
    p.querySelector<HTMLElement>('[data-led-right]')!.textContent = d.right;
    const lights = d.lights;
    p.querySelector('[data-led-flex]')!.classList.toggle('on', lights.flexDial && flash);
    p.querySelector('[data-led-preset]')!.classList.toggle('on', lights.preset);
    p.querySelector('[data-led-user]')!.classList.toggle('on', lights.userSet);
    p.querySelector('[data-led-safety]')!.classList.toggle('on', lights.safety);
    /* the light above the monitoring jack stays lit unless channel 4 has the ECG connected */
    p.querySelector('[data-led-mon]')!.classList.toggle('on', d.on && !session.monitoringCable);
    p.querySelector('[data-treat]')!.classList.toggle('lit', d.treat === 'delivering');
    p.querySelector('[data-power]')!.setAttribute('aria-pressed', String(d.on));
    p.querySelector('[data-jack="mon"]')!.setAttribute('aria-pressed', String(session.monitoringCable));
    /* the cover (the team may lift it too) */
    const up = proc.room.coverUp, wrap = p.querySelector<HTMLElement>('[data-treat-wrap]')!;
    if (wrap.classList.contains('open') !== up) {
      wrap.classList.toggle('open', up);
      (p.querySelector('[data-treat]') as HTMLButtonElement).disabled = !up;
      p.querySelector('[data-cover]')!.textContent = up ? t('coverDown') : t('cover');
    }
    tone(d.tone);
  };

  /* ---- the strip and the report -------------------------------------------------------------------------------- */
  const paperItems = (): PaperItem[] => session.paper.map((e: PaperEntry): PaperItem => {
    if (e.kind === 'trace') return { kind: 'trace', from: e.from, to: e.to ?? session.t, afterStimulus: e.afterStimulus };
    if (e.kind === 'selftest') return { kind: 'text', at: e.at, lines: ['ECT System IV  self test passed', 'Mains 50 Hz'] };
    if (e.kind === 'settings') { const s = session.device.settings; return { kind: 'text', at: e.at, lines: [`Program: ${PROGRAM_NAMES[s.program]}`, `FREQUENC ${s.user.frequency} HZ  P-WIDTH ${s.user.pulseWidth} MS`, `CHANN. 1 ${s.gain[0]}  CHANN. 2 ${s.gain[1]}  PRINT ${s.paper}`, `INDEXES ${s.indexes ? 'ON' : 'OFF'}`] }; }
    return { kind: 'text', at: e.at, lines: reportFor(e.stimulus) };
  });
  const reportFor = (k: number): string[] => {
    const st = session.stimuli[k];
    if (!st) return [];
    const r = session.lastReport()!;
    return reportLines({ percent: st.percent, charge: st.given.charge, current: ECT.current, duration: st.given.duration, frequency: st.given.frequency, pulseWidth: st.given.pulseWidth,
      staticOhm: st.staticOhm, dynamicOhm: st.dynamicOhm, early: st.early, baselineAvailable: r.baselineAvailable, eegEndpoint: r.eegEndpoint, emgEndpoint: r.emgEndpoint,
      baseHr: r.baseHr, peakHr: r.peakHr, asei: r.asei, psi: r.psi, msp: r.msp, ttp: r.timeToPeakPower, coh: r.coherence, ttc: r.timeToPeakCoherence,
      program: st.program === 'LOW_UB' && session.device.settings.ultrabrief === 0.3 ? 'Low 0.3 charge rate' : PROGRAM_REPORT[st.program], indexes: session.device.settings.indexes });
  };
  /* the report's text is fixed when it is printed */
  const printedReports = new Map<number, string[]>();

  const drawStripNow = () => {
    const c = host.querySelector<HTMLCanvasElement>('[data-strip]');
    if (!c) return;
    const { g, w } = sizeCanvas(c, 300);
    g.font = '11px ui-monospace, Menlo, Consolas, monospace';
    const items = paperItems().map((it, i) => {
      const e = session.paper[i];
      if (e.kind === 'report') { if (!printedReports.has(i)) printedReports.set(i, it.kind === 'text' ? it.lines : []); return { ...it, lines: printedReports.get(i)! } as PaperItem; }
      return it;
    });
    const lay = layoutStrip(items, session.device.settings.paper, g);
    const maxScroll = Math.max(0, lay.width - w);
    if (follow) scrollX = maxScroll;
    scrollX = Math.max(0, Math.min(maxScroll, scrollX));
    const base = session.baselineFrom != null && session.readyAt != null ? baselineRate() : null;
    drawStrip(g, w, 300, session, lay, scrollX, { gains: session.device.settings.gain, emgGain: 1000, ecgGain: 1000, baselineRate: base }, { paper: css('--surface'), ink: css('--fg'), faint: css('--muted') }, (tt) => session.heartRateAt(tt));
    const sl = host.querySelector<HTMLInputElement>('[data-scroll]');
    if (sl) { sl.max = String(Math.round(maxScroll)); sl.value = String(Math.round(scrollX)); }
  };
  let baseCache: { key: string; v: number } | null = null;
  const baselineRate = () => {
    const key = `${session.baselineFrom}:${session.readyAt}`;
    if (baseCache?.key === key) return baseCache.v;
    const a = Math.round(session.baselineFrom! * FS), b = Math.round(session.readyAt! * FS);
    /* the device's filter, on the baseline stretch */
    const x = session.rec.eeg1.subarray(0, b);
    let s = 0; const f = bandpassLocal(x);
    for (let i = a; i < b; i++) s += Math.abs(f[i]);
    baseCache = { key, v: s / Math.max(1, b - a) };
    return baseCache.v;
  };
  const bandpassLocal = (x: Float32Array) => { const out = new Float32Array(x.length); const aa = Math.exp((-2 * Math.PI * 2) / FS), bb = 1 - Math.exp((-2 * Math.PI * 25) / FS); let h1 = 0, h2 = 0, p1 = 0, p2 = 0, l1 = 0, l2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i]; h1 = aa * (h1 + v - p1); p1 = v; h2 = aa * (h2 + h1 - p2); p2 = h1; l1 += bb * (h2 - l1); l2 += bb * (l1 - l2); out[i] = l2; } return out; };

  const drawReport = () => {
    const el = host.querySelector<HTMLElement>('[data-report]');
    if (!el) return;
    const k = [...session.paper.keys()].reverse().find((i) => session.paper[i].kind === 'report');
    const lines = k != null ? printedReports.get(k) : null;
    /* the seizure adequacy markers score: rated by the learner from the report and the strip, then checked against them */
    let samsHtml = '';
    /* which rating belongs to this report: the first stimulus's or the restimulation's */
    const which: 'sams' | 'resams' = k != null && (session.paper[k] as { stimulus?: number }).stimulus === 1 ? 'resams' : 'sams';
    const res = proc.samsResult[which], truth = res?.truth ?? (k != null ? proc.samsTruth() : null);
    if (res) {
      const mine = res.mine, mineYou = res.by === 'you';
      if (mode === 'exam' && !proc.finished) samsHtml = `<div class="ect-sams"><p>${t('samsRated')}</p></div>`;
      else samsHtml = `<div class="ect-sams"><h4>${t('samsTitle')}: ${res.truth.points}/5${mineYou ? ` <span class="muted small">(${t('samsYours')}: ${mine.points.filter(Boolean).length}/5)</span>` : ''}</h4><ul>${res.truth.items.map((x, i) => {
          const agree = !mineYou || mine.points[i] === x.point;
          return `<li class="${x.point ? 'on' : ''}${agree ? '' : ' bad'}">${x.point ? '✓' : '○'} ${esc(tr(x.label, lang))}: <b>${esc(x.value)}</b>${agree ? '' : ` — ${t('samsYouSaid')} ${mine.points[i] ? '✓' : '○'}`}</li>`; }).join('')}</ul>`
        + (mineYou && mine.band !== res.truth.band ? `<p class="ect-err">${t('samsBandWrong')}</p>` : '')
        + `<p><b>${esc(tr(res.truth.advice, lang))}</b></p>${which === 'sams' && proc.needsRestim ? `<p>${esc(t('restimNext').replace('{p}', String(proc.restimPercent)))}</p>` : ''}<p class="muted small">${esc(tr(SAMS_NOTE, lang))}</p></div>`;
    } else if (truth && proc.mine(which) && proc.open(which)) {
      samsHtml = `<form class="ect-sams" data-samsform data-which="${which}"><h4>${t('samsTitle')}</h4><p class="muted small">${t('samsAsk')}</p><ul>${truth.items.map((x, i) => `<li><label><input type="checkbox" data-sams-i="${i}"> ${esc(tr(x.label, lang))}</label></li>`).join('')}</ul>
        <fieldset><legend class="small">${t('samsDecide')}</legend>${(['good', 'medium', 'poor'] as const).map((b) => `<label class="small"><input type="radio" name="sams-band" value="${b}"> ${t(`samsBand_${b}`)}</label>`).join('<br>')}</fieldset>
        <button type="submit" class="primary small">${t('samsCheck')}</button> <span class="muted small" data-samsmsg></span></form>`;
    }
    const html = lines ? `<pre class="ect-report">${lines.map(esc).join('\n')}</pre>${samsHtml}` : `<p class="muted small">${t('noReport')}</p>`;
    if (el.dataset.html !== html) {
      el.innerHTML = html; el.dataset.html = html;
      const f = el.querySelector<HTMLFormElement>('[data-samsform]');
      if (f) f.onsubmit = (e) => {
        e.preventDefault();
        const band = (f.querySelector('input[name="sams-band"]:checked') as HTMLInputElement | null)?.value as 'good' | 'medium' | 'poor' | undefined;
        if (!band) { const m = f.querySelector<HTMLElement>('[data-samsmsg]'); if (m) m.textContent = t('samsPick'); return; }
        const points = Array.from(f.querySelectorAll<HTMLInputElement>('[data-sams-i]'), (x) => x.checked);
        proc.act((f.dataset.which as 'sams' | 'resams') ?? 'sams', 'you', { sams: { points, band } }); drawProcedure(); drawReport();
      };
    }
  };

  /* ---- what happens now -------------------------------------------------------------------------------------- */
  const drawNow = () => {
    const el = host.querySelector<HTMLElement>('[data-now]');
    if (!el) return;
    const d = session.device, st = session.stimuli[session.stimuli.length - 1];
    if (session.seizing) seized = true;
    const reported = !!st && session.paper.some((e) => e.kind === 'report' && e.stimulus === session.stimuli.length - 1);
    const step = nextStep({ on: d.on, booting: d.booting, baseline: d.baseline, testedOhm: d.testing && d.t > 0 ? (d.left.match(/^\d+$/) ? Number(d.left) : null) : d.lastStatic, staticHigh: ECT.staticHigh, staticLow: ECT.staticLow,
      treat: d.treat, early: !!st?.early, printing: d.printing, stimulusEnd: d.stimulusEnd, reported, seconds: d.stimulusEnd != null ? d.t - d.stimulusEnd : 0 }, num);
    const ph = st ? phaseOf(session.brain, seized) : 'rest';
    const r = session.lastReport();
    const drugs = session.body.run.drugs;
    const hn = heartNow({ delivering: d.treat === 'delivering', seizing: session.seizing, afterStimulus: d.stimulusEnd != null ? d.t - d.stimulusEnd : null, seized, hr: session.heartRateAt(session.t), base: r?.baseHr ?? 0,
      vagalBlock: drugs.vagalBlock(), betaBlock: drugs.betaBlock(), placement: patient.placement }, num);
    const line = (label: string, x: LocalizedText) => `<p><b>${label}:</b> ${esc(tr(x, lang))}</p>`;
    const html = (mode === 'exam' ? '' : line(t('atDevice'), step))
      + (hn ? line(t('heart'), hn) : '')
      + (st && ph !== 'rest' ? line(t('seizure'), ECT_PHASE[ph]) : '');
    const gv = host.querySelector<HTMLElement>('[data-given]');
    if (gv) { const g = givenList.length ? givenList.map((x) => `${esc(tr(x.label, lang))} (${num(x.at)} s)`).join(', ') : t('none'); const gh = `${t('given')}: ${g}`; if (gv.dataset.html !== gh) { gv.innerHTML = gh; gv.dataset.html = gh; } }
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  };

  /* ---- the loop ---------------------------------------------------------------------------------------------- */
  const frame = (now: number) => {
    if (stopped) return;
    const dt = Math.min(0.1, last ? (now - last) / 1000 : 0);
    last = now;
    if (view === 'treat') {
      /* real time; faster only while the learner waits (the rule returns it to real time when something is theirs) */
      if (hurry && !proc.canHurry) hurry = false;
      const k = hurry ? HURRY : 1;
      session.advance(dt * k); proc.tick(dt * k);
      updatePanel(); drawStripNow(); drawReport(); drawNow(); drawProcedure();
    }
    raf = requestAnimationFrame(frame);
  };


  /* ---- render ------------------------------------------------------------------------------------------------ */
  const headHtml = () => `<div class="st-head">
      <button type="button" class="ghost" data-leave>← ${o.backLabel ? tr(o.backLabel, lang) : t('back')}</button>
      <div class="st-title"><div class="eyebrow">${t('eyebrow')}</div><h1>${esc(tr(ECT_STATION.title, lang))}</h1><p class="lede">${esc(tr(ECT_STATION.summary, lang))}</p></div>
      <button type="button" class="ghost st-mode" data-view="${view === 'treat' ? 'stim' : 'treat'}">${view === 'treat' ? t('whyBtn') : `← ${t('backBtn')}`}</button>
    </div>`;

  const render = () => {
    if (view === 'stim') { renderStim(); return; }
    const o = order();
    host.innerHTML = `${headHtml()}
      <section class="panel ect-task" aria-labelledby="ect-task-h">
        <div class="ect-order">
          <h2 id="ect-task-h">${t('task')}</h2>
          <select data-order aria-label="${t('task')}">${ECT_ORDERS.map((x, i) => `<option value="${i}" ${i === orderIdx ? 'selected' : ''}>${esc(tr(x.title, lang))}</option>`).join('')}</select>
          <ul class="ect-orderlines">${orderLines(o).map((x) => `<li>${esc(tr(x, lang))}</li>`).join('')}</ul>
        </div>
        <div class="ect-modes">
          <span class="seg" role="radiogroup" aria-label="${t('mode')}">${(['practise', 'watch', 'exam'] as const).map((m) => `<button type="button" role="radio" aria-checked="${mode === m}" data-mode="${m}">${esc(tr(MODE_NAME[m], lang))}</button>`).join('')}</span>
          <p class="muted small">${t('modeNote')}</p>
          <label class="st-preset">${t('role')}
            <select data-role ${mode === 'watch' ? 'disabled' : ''}><option value="all" ${roleSel === 'all' ? 'selected' : ''}>${t('allRoles')}</option>${ECT_ROLES.map((r) => `<option value="${r}" ${roleSel === r ? 'selected' : ''}>${esc(tr(ROLE_NAME[r], lang))}</option>`).join('')}</select></label>
          <p class="muted small">${t('roleNote')}</p>
          <button type="button" class="ghost" data-restart>${t('restart')}</button>
        </div>
      </section>
      <section class="panel ect-debrief" data-debrief hidden></section>
      <div class="ect-room-grid">
        <aside class="panel ect-steps" aria-labelledby="ect-steps-h"><h2 id="ect-steps-h">${mode === 'exam' ? t('stepsExam') : t('steps')}</h2><ol data-steps></ol></aside>
        <section class="panel ect-room" aria-labelledby="ect-room-h">
          <h2 id="ect-room-h">${t('room')}</h2>
          <p class="st-measures" data-vitals></p>
          ${roomHtml()}
          <details class="ect-variation"><summary>${t('variation')}</summary>
            <div class="st-var"><span>${t('skin')}</span><span class="seg" role="radiogroup" aria-label="${t('skin')}">${SKINS.map((x) => `<button type="button" role="radio" aria-checked="${patient.skin === x.z}" data-skin="${x.z}">${t(x.k)}</button>`).join('')}</span></div>
            <button type="button" class="ghost small" data-another>${t('another')}</button>
            <h3>${t('moreDrugs')}</h3>
            <span class="st-bar">${PREMEDS.map((p, i) => p.drug === 'glycopyrrolate' ? '' : `<button type="button" class="chip st-chip" data-give="${i}">${esc(tr(p.label, lang))}</button>`).join('')}</span>
            <p class="muted small" data-given></p>
          </details>
        </section>
        <aside class="panel ect-coach" aria-labelledby="ect-coach-h">
          <h2 id="ect-coach-h">${t('coach')}</h2>
          <div data-coach aria-live="polite"></div>
          <button type="button" class="ghost" data-hurry></button>
          <p class="muted small">${t('hurryNote')}</p>
          <h3>${t('logL')}</h3><ol class="ect-log" data-log></ol>
        </aside>
        <div class="ect-mid">
        <section class="panel st-signal" aria-labelledby="ect-dev-h">
          <div class="st-row"><div><h2 id="ect-dev-h">${t('device')}</h2><div class="muted small">${t('deviceNote')}</div></div></div>
          ${panelHtml()}
          <details class="ect-service"><summary class="small">${t('service')}</summary>
            <label class="small">${t('doseRange')} <select data-maxpct><option value="100" ${session.device.settings.maxPercent === 100 ? 'selected' : ''}>${t('upTo100')}</option><option value="200" ${session.device.settings.maxPercent === 200 ? 'selected' : ''}>${t('upTo200')}</option></select></label>
            <label class="small">${t('ubWidth')} <select data-ubw><option value="0.25" ${session.device.settings.ultrabrief === 0.25 ? 'selected' : ''}>0.25 ms</option><option value="0.3" ${session.device.settings.ultrabrief === 0.3 ? 'selected' : ''}>0.3 ms</option></select></label>
            <p class="muted small">${t('serviceNote')}</p></details>
        </section>
        <section class="panel st-signal" aria-labelledby="ect-strip-h">
          <div class="st-row"><div><h2 id="ect-strip-h">${t('strip')}</h2><div class="muted small">${t('stripNote')}</div></div>
            <label class="st-check"><input type="checkbox" data-follow ${follow ? 'checked' : ''}> ${t('follow')}</label></div>
          <canvas class="st-strip ect-strip" data-strip role="img" aria-label="${t('strip')}"></canvas>
          <input type="range" class="ect-scroll" data-scroll min="0" max="0" value="0" aria-label="${t('strip')}">
          <h3>${t('report')}</h3><div data-report></div>
        </section>
        </div>
      </div>
      <div class="st-main">
        <section class="panel st-why" aria-labelledby="ect-now-h">
          <h2 id="ect-now-h">${t('now')}</h2>
          <div data-now></div>
          <details><summary>${t('more')}</summary>${ECT_BACKGROUND.map((x) => `<div class="st-text"><h3>${esc(tr(x.title, lang))}</h3><p>${esc(tr(x.body, lang))}</p></div>`).join('')}</details>
          <p class="muted small">${t('draft')}</p>
        </section>
      </div>`;
    wireCommon(); wireTreat(); wireProcedure(); drawProcedure();
  };

  /* ---- the procedure: the room, the steps, the coach, the debrief ------------------------------------------------ */
  const roleTag = (r: EctRole) => `<span class="ect-role ect-role-${r}">${esc(tr(ROLE_NAME[r], lang))}</span>`;
  const roomHtml = () => {
    const pic = `<figure class="ect-scene"><svg viewBox="${SCENE_VIEWBOX}" data-scene role="img" aria-label="${t('scene')}"></svg></figure>
      <div class="ect-close">
        <figure><figcaption class="muted small">${t('headRight')}</figcaption><svg data-head role="img" aria-label="${t('headRight')}"></svg></figure>
        <figure><figcaption class="muted small" data-topcap>${t('headAbove')}</figcaption><svg viewBox="0 0 240 240" data-top class="ect-top"></svg><p class="muted small" data-padmsg></p></figure>
        <figure><figcaption class="muted small">${t('chestAbove')}</figcaption><svg viewBox="${CHEST_VIEWBOX}" data-chest class="ect-chest" role="img" aria-label="${t('chestAbove')}"></svg></figure>
      </div>`;
    if (mode === 'watch') return `${pic}<p class="muted">${t('roomWatch')}</p>`;
    const mine = STEPS.filter((x) => x.kind === 'room' && proc.mine(x.id));
    const btn = (id: StepId) => id === 'pads' || id === 'sams' || id === 'resams' ? ''
      : id === 'cuff' ? `<div class="ect-cuffctl"><b>${t('cuffL')}</b> <button type="button" class="ghost small" data-cuff="squeeze">${t('squeezeBtn')}</button><button type="button" class="ghost small" data-cuff="down">${t('deflateBtn')}</button><button type="button" class="ghost small ect-act" data-act="cuff">${t('cuffUpBtn')}</button> <span class="muted small" data-cuffnow></span></div>`
      : id === 'leads' ? `<div class="ect-leadctl"><b>${esc(tr(STEP.leads.title, lang))}</b><p class="muted small">${t('cableHint')}</p><svg viewBox="0 0 300 134" class="ect-cable" data-tray role="group" aria-label="${t('cableL')}"></svg><p class="muted small">${t('chLegend')}</p><div class="ect-seg" role="group"><button type="button" class="ghost small" data-pview="head">${t('viewHead')}</button><button type="button" class="ghost small" data-pview="body">${t('viewBody')}</button></div><svg class="ect-place" data-place role="group" aria-label="${t('placeL')}"></svg><p class="muted small" data-leadmsg></p><button type="button" class="ghost ect-act" data-act="leads">${t('plugIn')}</button><button type="button" class="ghost small" data-fist>${t('fist')}</button></div>`
      : `<button type="button" class="ghost ect-act" data-act="${id}">${esc(tr(STEP[id].title, lang))}</button>`;
    const real = mine.filter((x) => x.modelled || x.role === 'psychiatrist'), narr = mine.filter((x) => !x.modelled && x.role !== 'psychiatrist');
    return `${pic}<div class="ect-acts">${real.map((x) => btn(x.id)).join('')}</div>
      ${narr.length ? `<h3>${t('anaesthesia')}</h3><p class="muted small">${t('notModelled')}</p><div class="ect-acts">${narr.map((x) => btn(x.id)).join('')}</div>` : ''}
      ${mine.length ? '' : `<p class="muted">${t('nothingYours')}</p>`}`;
  };
  /* the patient, drawn: what the team has put on him, the cuffed arm jerking in the motor seizure */
  const dressNow = (): EctDress => {
    const r = proc.room, up = !r.recovered;
    const pads: SiteId[] = r.pads ? [...PLACEMENT_SITES[r.pads]] : padSites;
    return { pads, cleaned: r.skin, leads: r.leads, montage: structuredClone(session.montage), cuff: { on: r.cuffOn, mmHg: r.cuffMmHg }, mask: r.oxygen && up, bagging: r.ventilating, biteBlock: r.biteBlock && up };
  };
  const drawPatient = () => {
    const sc = host.querySelector<SVGSVGElement>('[data-scene]');
    if (!sc) return;
    /* at most ten pictures a second: the bag and the arm move, nothing else does between steps */
    const now = performance.now();
    const moving = proc.room.ventilating || session.seizing;
    if (moving && now - sceneAt < 100) return;
    const d = dressNow();
    const motor = session.rec.n ? session.rec.motor[session.rec.n - 1] : 0;
    const jerk = motor > ECT.emgThreshold && !session.armRelaxed ? Math.round(Math.min(14, (motor - ECT.emgThreshold) / 4) * (Math.sin(session.t * 2 * Math.PI * 3) > 0 ? 1 : 0)) : 0;
    if (jerk !== figJerk) { fig = ectFigure(look, jerk); figJerk = jerk; }
    /* the cable's end (the sockets the leads come from) and the leadsMine() view (the head or the body, large) */
    const tray = host.querySelector<SVGSVGElement>('[data-tray]');
    if (tray) {
      const html = cableSvg(session.montage, armed ? leadKey(armed) : null, { ch: 'CH', iso: 'ISO', gnd: 'GND' });
      if (tray.dataset.html !== html) { tray.innerHTML = html; tray.dataset.html = html; }
    }
    const pl = host.querySelector<SVGSVGElement>('[data-place]');
    if (pl) {
      pl.style.display = leadsMine() ? '' : 'none';
      host.querySelectorAll<HTMLButtonElement>('[data-pview]').forEach((x) => { x.classList.toggle('on', x.dataset.pview === pview); x.setAttribute('aria-pressed', String(x.dataset.pview === pview)); x.hidden = !leadsMine(); });
      const pkey = JSON.stringify([pview, d.montage, d.pads, d.cuff, leadsMine()]);
      if (leadsMine() && pl.dataset.key !== pkey) {
        pl.dataset.key = pkey;
        if (pview === 'head') { pl.setAttribute('viewBox', '0 0 240 240'); pl.innerHTML = topViewSvg(d.pads, { nose: t('nose'), left: t('left'), right: t('right') }, {}, { dress: d, targets: true, sites: false }); }
        else { pl.setAttribute('viewBox', CHEST_VIEWBOX); pl.innerHTML = chestCloseUp(look, d, { targets: true }); }
      }
    }
    const key = JSON.stringify([d, jerk, moving ? Math.round(session.t * 10) : 0]);
    if (sc.dataset.key === key) return;
    sc.dataset.key = key; sceneAt = now;
    sc.innerHTML = sceneSvg(fig, d, session.t);
    const hd = host.querySelector<SVGSVGElement>('[data-head]');
    if (hd) { const c = headCloseUp(fig, d, session.t); hd.setAttribute('viewBox', c.viewBox); hd.innerHTML = c.svg; }
    const ch = host.querySelector<SVGSVGElement>('[data-chest]');
    const placing = leadsMine();
    const ckey = JSON.stringify([d.montage, d.cuff]);
    if (ch && ch.dataset.key !== ckey) { ch.dataset.key = ckey; ch.innerHTML = chestCloseUp(look, d); }
    const tp = host.querySelector<SVGSVGElement>('[data-top]');
    if (tp) tp.innerHTML = topViewSvg(d.pads, { nose: t('nose'), left: t('left'), right: t('right') }, Object.fromEntries((['Ltemp', 'Rtemp', 'Lfront', 'Rfront', 'vertexR', 'LantL'] as SiteId[]).map((id) => [id, t(`site_${id}`)])), { dress: d, targets: false, sites: proc.mine('pads') && !proc.isDone('pads') });
    const lm = host.querySelector<HTMLElement>('[data-leadmsg]'); if (lm) lm.textContent = placing ? (proc.leadsPlaced ? '' : `${t('leadTray')} ${t('leadOff')}`) : '';
    const cap = host.querySelector<HTMLElement>('[data-topcap]'); if (cap) cap.textContent = proc.mine('pads') && !proc.isDone('pads') ? t('headAbove') : placing ? t('headAboveLeads') : t('headAboveDone');
    const pm = host.querySelector<HTMLElement>('[data-padmsg]'); if (pm) pm.textContent = padMsg || (proc.mine('pads') && !proc.isDone('pads') ? t('padHint') : '');
    const cn = host.querySelector<HTMLElement>('[data-cuffnow]'); if (cn) cn.textContent = t('cuffNow').replace('{c}', num(proc.room.cuffMmHg)).replace('{s}', num(proc.systolic));
  };
  /** the leads are the learner's to place now */
  const leadsMine = () => proc.mine('leads') && proc.open('leads');
  const sec = (x: number) => `${num(x)} s`;
  const whoName = (w: Who) => (w === 'you' ? t('you') : tr(ROLE_NAME[w], lang));
  const drawProcedure = () => {
    if (view !== 'treat') return;
    const set = (sel: string, html: string) => { const el = host.querySelector<HTMLElement>(sel); if (el && el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };
    const cur = proc.current(), doing = proc.teamDoing();
    /* the steps */
    set('[data-steps]', STEPS.filter((x) => (mode !== 'exam' || proc.isDone(x.id)) && (!RESTIM_STEPS.includes(x.id) || proc.needsRestim || proc.isDone(x.id))).map((x) => {
      const st = proc.done.get(x.id), busy = doing.some((d) => d.step === x.id);
      const cls = st ? 'done' : x.id === cur ? 'current' : busy ? 'busy' : proc.open(x.id) ? 'open' : '';
      const icon = st ? '✓' : x.id === cur ? '▶' : busy ? '…' : '○';
      return `<li class="${cls}"><span class="ect-ico" aria-hidden="true">${icon}</span><span class="ect-st">${esc(tr(x.title, lang))}<br>${roleTag(x.role)}${roleSel !== 'all' && proc.mine(x.id) ? ` <span class="ect-you">${t('you')}</span>` : ''}${st ? ` <span class="muted small">${sec(st.at)}</span>` : ''}</span></li>`;
    }).join(''));
    /* the room's buttons: done ones ticked */
    host.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => { const d = proc.isDone(b.dataset.act as StepId); b.classList.toggle('on', d); b.setAttribute('aria-pressed', String(d)); b.disabled = d || (b.dataset.act === 'leads' && !proc.leadsPlaced); b.hidden = RESTIM_STEPS.includes(b.dataset.act as StepId) && !proc.needsRestim; b.title = b.dataset.act === 'leads' && !proc.leadsPlaced && !d ? t('leadsAll') : ''; });
    const fb = host.querySelector<HTMLButtonElement>('[data-fist]'); if (fb) fb.disabled = session.inducedAt != null;
    drawPatient();
    /* the vitals */
    const m = (session.body.run.sim as any).metrics ?? {};
    const et = session.etco2;
    set('[data-vitals]', `<span>${t('hrL')}: ${num(session.heartRateAt(session.t))} /min</span><span>${t('bpL')}: ${Number.isFinite(m.Psys) ? `${num(m.Psys)}/${num(m.Pdia)}` : '—'} mmHg</span><span>SpO₂: ${num(session.spo2)} %</span><span>EtCO₂: ${et == null ? '—' : `${num(et)} mmHg`}</span><span>${session.breathing ? t('breathingOwn') : t('apnoeic')}</span>`);
    /* the coach */
    const doingHtml = doing.map((d) => `<p>${esc(t('doing').replace('{who}', tr(ROLE_NAME[d.role], lang)).replace('{what}', tr(STEP[d.step].title, lang)))}</p>`).join('');
    const watching = proc.isDone('treat') && !proc.isDone('observe') ? `<p>${t('watching')}</p>` : '';
    let coach = '';
    if (mode === 'watch') {
      const nx = proc.watchNext();
      coach = doingHtml + watching + (proc.waitingForNext && nx ? `<p>${esc(t('nextIs').replace('{what}', tr(STEP[nx].title, lang)).replace('{who}', tr(ROLE_NAME[STEP[nx].role], lang)))}</p><p class="muted small">${esc(tr(STEP[nx].why, lang))}</p><button type="button" class="primary" data-next>${t('nextBtn')}</button>` : '');
    } else if (mode === 'exam') {
      coach = `<p class="muted">${t('coachExam')}</p>${doingHtml}${watching}`;
    } else {
      const errs = proc.errors.map((e) => `<p class="ect-err" role="alert"><b>${t('mistake')}:</b> ${esc(tr(e.text, lang))}</p>`).join('');
      if (cur) {
        const w = proc.waitFor(cur);
        const what = cur === 'treat' ? t('waitRel') : cur === 'induction' ? t('waitOx') : t('waitInd');
        coach = `${errs}<h3>${t('yourNext')}: ${esc(tr(STEP[cur].title, lang))}</h3>${w > 0 ? `<p class="ect-wait">${esc(t('waitS').replace('{s}', num(Math.ceil(w))).replace('{what}', what))}</p>` : ''}<p>${esc(tr(STEP[cur].how, lang))}</p><p class="muted small"><b>${t('whyL')}:</b> ${esc(tr(STEP[cur].why, lang))}</p>${doingHtml}`;
      } else coach = `${errs}${watching || (proc.finished ? '' : `<p>${t('nothingYours')}</p>`)}${doingHtml}`;
    }
    set('[data-coach]', coach);
    const nb = host.querySelector<HTMLButtonElement>('[data-next]'); if (nb && !nb.onclick) nb.onclick = () => proc.next();
    const hb = host.querySelector<HTMLButtonElement>('[data-hurry]');
    if (hb) { const can = proc.canHurry; hb.disabled = !can && !hurry; const txt = hurry ? t('realTime') : t('hurry'); if (hb.textContent !== txt) hb.textContent = txt; hb.setAttribute('aria-pressed', String(hurry)); }
    /* the log, newest first */
    set('[data-log]', proc.log.slice(-8).reverse().map((l) => `<li><span class="muted small">${sec(l.t)}</span> <b>${esc(whoName(l.who))}:</b> ${esc(tr(l.text, lang))}</li>`).join(''));
    /* the debrief, once the treatment is over */
    const db = host.querySelector<HTMLElement>('[data-debrief]');
    if (db) {
      db.hidden = !proc.finished;
      if (proc.finished) set('[data-debrief]', `<h2>${t('debrief')}</h2>
        ${proc.errors.length ? proc.errors.map((e) => `<p class="ect-err"><b>${sec(e.t)}:</b> ${esc(tr(e.text, lang))}</p>`).join('') : `<p>${t('noErrors')}</p>`}
        <table class="lab"><thead><tr><th>${t('colStep')}</th><th>${t('colRole')}</th><th>${t('colBy')}</th><th>${t('colAt')}</th></tr></thead><tbody>
        ${proc.summary().map(({ step, status }) => `<tr><td>${esc(tr(step.title, lang))}</td><td>${esc(tr(ROLE_NAME[step.role], lang))}</td><td>${status ? esc(whoName(status.by)) : `<span class="muted">${t('notDone')}</span>`}</td><td>${status ? sec(status.at) : ''}</td></tr>`).join('')}
        </tbody></table>`);
    }
  };
  const wireProcedure = () => {
    host.querySelector<HTMLSelectElement>('[data-order]')!.onchange = (e) => { orderIdx = Number((e.target as HTMLSelectElement).value); newSession(); };
    host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode as EctMode; newSession(); }));
    host.querySelector<HTMLSelectElement>('[data-role]')!.onchange = (e) => { roleSel = (e.target as HTMLSelectElement).value as EctRole | 'all'; newSession(); };
    host.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => b.addEventListener('click', () => { proc.act(b.dataset.act as StepId, 'you'); drawProcedure(); }));
    host.querySelector<HTMLButtonElement>('[data-fist]')?.addEventListener('click', () => session.fist());
    host.querySelectorAll<HTMLButtonElement>('[data-cuff]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.cuff; if (k === 'squeeze') proc.squeeze(); else proc.deflate(); drawProcedure(); }));
    /* the pad sites, seen from above: the learner's hands if the pads are theirs */
    const top = host.querySelector<SVGSVGElement>('[data-top]');
    const pick = (id: SiteId) => {
      if (!proc.mine('pads') || proc.isDone('pads')) return;
      padSites = padSites.includes(id) ? padSites.filter((x) => x !== id) : [...padSites, id].slice(-2);
      padMsg = '';
      if (padSites.length === 2) {
        const pl = placementOf(padSites);
        if (pl) { proc.act('pads', 'you', { placement: pl }); padMsg = t('padsSet').replace('{p}', tr(PLACEMENTS[pl].name, lang)); }
        else padMsg = t('padBad');
      }
      sceneAt = -1; drawProcedure();
    };
    top?.addEventListener('click', (e) => { const g = (e.target as Element).closest('[data-site]'); if (g) pick(g.getAttribute('data-site') as SiteId); });
    top?.addEventListener('keydown', (e) => { const g = (e.target as Element).closest('[data-site]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(g.getAttribute('data-site') as SiteId); } });
    /* the leads: pick one from the tray, then click its spot on the head from above or the chest; a click on a placed lead
       with none picked takes it off */
    const place = (spot: Spot) => {
      if (!leadsMine()) return;
      if (armed) {
        proc.placeLead(armed, spot);
        const m = session.montage, free = LEADS.find((l) => (l === 'ground' ? m.ground : m.ch[l.ch][l.pole]) == null);
        armed = free ?? null;
      } else {
        const m = session.montage;
        const l = LEADS.find((x) => (x === 'ground' ? m.ground : m.ch[x.ch][x.pole]) === spot);
        if (l) { proc.placeLead(l, null); armed = l; }
      }
      sceneAt = -1; drawProcedure();
    };
    /* a tap lands on the nearest spot of the placing view, within a finger's reach */
    const plv = host.querySelector<SVGSVGElement>('[data-place]');
    plv?.addEventListener('click', (e) => {
      const m = plv.getScreenCTM(); if (!m) return;
      const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const pts = pview === 'head' ? headSpotPoints() : bodySpotPoints(look), reach = pview === 'head' ? 26 : 6;
      let best: string | null = null, bd = reach;
      for (const [id, p] of Object.entries(pts)) { const dd = Math.hypot(p.x - q.x, p.y - q.y); if (dd < bd) { bd = dd; best = id; } }
      if (best) { place(best as Spot); if (armed) pview = viewFor(armed); drawProcedure(); }
    });
    plv?.addEventListener('keydown', (e) => { const sp = (e.target as Element).closest('[data-spot]')?.getAttribute('data-spot') as Spot | undefined; if (sp && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); place(sp); } });
    const pickLead = (k: string) => { const l = LEADS.find((x) => leadKey(x) === k)!; armed = l; pview = viewFor(armed); drawProcedure(); };
    const tr0 = host.querySelector<SVGSVGElement>('[data-tray]');
    tr0?.addEventListener('click', (e) => { if (!leadsMine()) return; const k = (e.target as Element).closest('[data-lead]')?.getAttribute('data-lead'); if (k) pickLead(k); });
    tr0?.addEventListener('keydown', (e) => { const k = (e.target as Element).closest('[data-lead]')?.getAttribute('data-lead'); if (k && leadsMine() && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickLead(k); } });
    host.querySelectorAll<HTMLButtonElement>('[data-pview]').forEach((x) => x.addEventListener('click', () => { pview = x.dataset.pview as 'head' | 'body'; drawProcedure(); }));
    host.querySelector<HTMLButtonElement>('[data-hurry]')!.addEventListener('click', () => { hurry = !hurry && proc.canHurry; drawProcedure(); });
  };

  const wireCommon = () => {
    host.querySelector('[data-leave]')!.addEventListener('click', () => { stop(); o.onLeave(); });
    host.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view as typeof view; tone('none'); render(); }));
  };

  const wireTreat = () => {
    const d = () => session.device;
    host.querySelectorAll<HTMLButtonElement>('[data-skin]').forEach((b) => b.addEventListener('click', () => { patient.skin = Number(b.dataset.skin); newSession(); }));
    host.querySelector('[data-restart]')!.addEventListener('click', () => newSession());
    host.querySelector('[data-another]')!.addEventListener('click', () => newSession(false));
    host.querySelectorAll<HTMLButtonElement>('[data-give]').forEach((b) => b.addEventListener('click', () => {
      const p = PREMEDS[Number(b.dataset.give)];
      session.give(p.drug, p.perKg ? p.mg * session.body.model.patient.weightKg : p.mg);
      givenList.push({ label: p.label, at: session.t });
    }));
    host.querySelector<HTMLInputElement>('[data-follow]')!.onchange = (e) => { follow = (e.target as HTMLInputElement).checked; };
    const sl = host.querySelector<HTMLInputElement>('[data-scroll]')!;
    sl.oninput = () => { follow = false; scrollX = Number(sl.value); (host.querySelector('[data-follow]') as HTMLInputElement).checked = false; };
    const strip = host.querySelector<HTMLCanvasElement>('[data-strip]')!;
    strip.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, s: scrollX }; strip.setPointerCapture(e.pointerId); });
    strip.addEventListener('pointermove', (e) => { if (!drag) return; follow = false; scrollX = drag.s - (e.clientX - drag.x); (host.querySelector('[data-follow]') as HTMLInputElement).checked = false; });
    strip.addEventListener('pointerup', () => { drag = null; });
    /* holding buttons */
    const hold = (sel: string, f: (down: boolean) => void) => {
      const b = host.querySelector<HTMLButtonElement>(sel)!;
      /* held with a finger: the press lasts from touch to release; the browser's long-press (selection, magnifier, menu)
         must not take it over */
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); f(true); });
      b.addEventListener('pointerup', () => f(false));
      b.addEventListener('pointercancel', () => f(false));
      b.addEventListener('lostpointercapture', () => f(false));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      b.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      b.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); f(true); } });
      b.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); f(false); } });
    };
    hold('[data-imp]', (down) => d().impedanceButton(down));
    hold('[data-treat]', (down) => { if (proc.room.coverUp) d().treatButton(down); });
    host.querySelector('[data-cover]')!.addEventListener('click', () => { proc.room.coverUp = !proc.room.coverUp; if (!proc.room.coverUp) d().treatButton(false); updatePanel(); });
    host.querySelector('[data-startstop]')!.addEventListener('click', () => d().startStop());
    host.querySelector<HTMLSelectElement>('[data-maxpct]')?.addEventListener('change', (e) => { const v = Number((e.target as HTMLSelectElement).value) as 100 | 200; d().settings.maxPercent = v; const max = PERCENT_STEPS.indexOf(v); if (d().settings.percentIndex > max) d().settings.percentIndex = max; });
    host.querySelector<HTMLSelectElement>('[data-ubw]')?.addEventListener('change', (e) => { d().settings.ultrabrief = Number((e.target as HTMLSelectElement).value) as 0.25 | 0.3; });
    host.querySelector('[data-power]')!.addEventListener('click', () => d().power(!d().on));
    host.querySelectorAll<HTMLButtonElement>('[data-jack]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.jack === 'stim') session.setStimulusCable(!session.stimulusCable); else session.monitoringCable = !session.monitoringCable;
      b.setAttribute('aria-pressed', String(b.dataset.jack === 'stim' ? session.stimulusCable : session.monitoringCable));
    }));
    /* the dials */
    const turn = (id: string, n: number) => { if (id === 'percent') d().turnPercent(n); else d().turnFlex(n); };
    host.querySelectorAll<HTMLButtonElement>('[data-turn]').forEach((b) => b.addEventListener('click', () => turn(b.dataset.turn!, Number(b.dataset.dir))));
    host.querySelectorAll<HTMLButtonElement>('[data-face]').forEach((b) => {
      const id = b.dataset.face!;
      let start: { a: number; moved: number; acc: number } | null = null;
      const angle = (e: PointerEvent) => { const r = b.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
      b.addEventListener('wheel', (e) => { e.preventDefault(); turn(id, e.deltaY > 0 ? 1 : -1); }, { passive: false });
      /* On the device, pressing PERCENT ENERGY shows the program and pressing, holding and turning it changes the program.
         With a mouse: a drag turns the dial; a short tap shows the program for a second; held still for half a second it is
         held in, and turning then changes the program. */
      let hold: ReturnType<typeof setTimeout> | null = null, held = false;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); b.setPointerCapture(e.pointerId); start = { a: angle(e), moved: 0, acc: 0 }; held = false;
        if (id === 'percent') hold = setTimeout(() => { if (start && start.moved < 0.15) { held = true; d().pressPercent(true); } }, 500);
      });
      b.addEventListener('pointermove', (e) => {
        if (!start) return;
        let da = angle(e) - start.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        start.a = angle(e); start.acc += da; start.moved += Math.abs(da);
        const steps = Math.trunc(start.acc / (Math.PI / 8));
        if (steps) { start.acc -= steps * (Math.PI / 8); turn(id, steps); b.querySelector('span')!.style.transform = `rotate(${(start.moved * 180) / Math.PI}deg)`; }
      });
      const up = () => {
        if (!start) return;
        const click = start.moved < 0.15; start = null;
        if (hold) { clearTimeout(hold); hold = null; }
        if (id === 'percent') {
          if (held) d().pressPercent(false);
          else if (click) { d().pressPercent(true); setTimeout(() => d().pressPercent(false), 1000); }
        } else if (click) d().pressFlex();
      };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      b.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); turn(id, 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); turn(id, -1); }
        else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); if (id === 'percent') d().pressPercent(true); else d().pressFlex(); }
      });
      b.addEventListener('keyup', (e) => { if ((e.key === ' ' || e.key === 'Enter') && id === 'percent') d().pressPercent(false); });
    });
  };

  /* ---- the stimulus view --------------------------------------------------------------------------------------- */
  const renderStim = () => {
    const s = session.device.settings;
    const stim = stimulusFor(s.program, session.device.percent, s.user, s.ultrabrief);
    const doses: RegionDose[] = dosesFor(stimPlacement, stimWidth);
    const f = fieldFor(stimPlacement), th = thresholdField(stimWidth);
    const regionNames = tr(T.regionName, lang).split(',');
    const rname = (id: string) => { const [h, r] = id.split('-'); const k = ['frontal', 'central', 'temporal', 'parietal', 'occipital'].indexOf(r); return `${h === 'L' ? t('left') : t('right')} ${regionNames[k]}`; };
    const median = (() => { const fs = doses.map((x) => x.field).sort((a, b) => a - b); return fs[fs.length >> 1]; })();
    const facts = stim ? explainStimulus({ percent: session.device.percent, charge: stim.charge, current: ECT.current, pulseWidth: stimWidth, frequency: stim.frequency, pulses: Math.round(stim.charge / (ECT.current * stimWidth)),
      duration: Math.round(stim.charge / (ECT.current * stimWidth)) / (2 * stim.frequency), dynamicOhm: session.dynamicOhm, energy: energy({ frequency: stim.frequency, pulseWidth: stimWidth, pulses: Math.round(stim.charge / (ECT.current * stimWidth)) }, session.dynamicOhm),
      brainShare: brainShareOf(stimPlacement), medianField: median, threshold: th, excitedRegions: doses.filter((x) => x.excited > 0.9).length,
      placementName: PLACEMENTS[stimPlacement].name, placementWhere: PLACEMENTS[stimPlacement].where }, num) : [];
    host.innerHTML = `${headHtml()}
      <div class="st-grid">
        <aside class="panel st-settings" aria-labelledby="ect-st-h">
          <h2 id="ect-st-h">${t('stimTitle')}</h2>
          <p class="layer-note">${t('stimNote')}</p>
          <label class="st-preset">${t('placement')}
            <select data-splace>${(Object.keys(PLACEMENTS) as PlacementId[]).map((k) => `<option value="${k}" ${k === stimPlacement ? 'selected' : ''}>${esc(tr(PLACEMENTS[k].name, lang))}</option>`).join('')}</select></label>
          <label class="st-preset">${t('pulseWidth')}
            <select data-swidth>${[0.25, 0.3, 0.5, 1.0, 1.5].map((w) => `<option value="${w}" ${w === stimWidth ? 'selected' : ''}>${num(w, 2)} ms</option>`).join('')}</select></label>
          <label class="st-preset">${t('program')}
            <select data-sprog>${PROGRAM_ORDER.filter((p) => p !== 'INTERMIT').map((p) => `<option value="${p}" ${p === s.program ? 'selected' : ''}>${PROGRAM_NAMES[p]}</option>`).join('')}</select></label>
          <label class="st-var"><span>${t('dose')} <output>${num(session.device.percent)} % · ${num(CHARGE_MC[s.percentIndex], 1)} mC</output></span>
            <input type="range" data-spct min="0" max="${PERCENT_STEPS.indexOf(s.maxPercent)}" step="1" value="${s.percentIndex}"></label>
        </aside>
        <div class="st-main">
          <section class="panel st-signal">
            <div class="eeg-mech">
              <figure><figcaption class="muted small">${t('section')}</figcaption><canvas class="st-heart" data-sec role="img" aria-label="${t('section')}"></canvas><span class="muted small">${t('sectionNote')}</span></figure>
              <figure><figcaption class="muted small">${t('regions')}</figcaption><canvas class="st-heart" data-rmap role="img" aria-label="${t('regions')}"></canvas><span class="muted small">${t('regionsNote')}</span></figure>
            </div>
            <table class="lab ect-regions"><thead><tr><th>${t('regionCol')}</th><th>${t('fieldCol')}</th><th>${t('excitedCol')}</th></tr></thead>
              <tbody>${doses.map((x) => `<tr><td>${esc(rname(x.def.id))}</td><td>${num(x.field, 2)} V/cm</td><td>${num(100 * x.excited)} %</td></tr>`).join('')}</tbody></table>
            <figure><figcaption class="muted small">${t('sd')}</figcaption><canvas class="st-heart" data-sd role="img" aria-label="${t('sd')}"></canvas><span class="muted small">${t('sdNote')}</span></figure>
          </section>
          <section class="panel st-why">
            ${facts.map((x) => `<div class="st-text"><h3>${esc(tr(x.title, lang))}</h3><p>${esc(tr(x.body, lang))}</p></div>`).join('')}
            <details><summary>${t('more')}</summary>${ECT_BACKGROUND.map((x) => `<div class="st-text"><h3>${esc(tr(x.title, lang))}</h3><p>${esc(tr(x.body, lang))}</p></div>`).join('')}</details>
            <p class="muted small">${t('draft')}</p>
          </section>
        </div>
      </div>`;
    wireCommon();
    host.querySelector<HTMLSelectElement>('[data-splace]')!.onchange = (e) => { stimPlacement = (e.target as HTMLSelectElement).value as PlacementId; renderStim(); };
    host.querySelector<HTMLSelectElement>('[data-swidth]')!.onchange = (e) => { stimWidth = Number((e.target as HTMLSelectElement).value); renderStim(); };
    host.querySelector<HTMLSelectElement>('[data-sprog]')!.onchange = (e) => { session.device.settings.program = (e.target as HTMLSelectElement).value as ProgramChoice; if (stimulusFor(session.device.settings.program, session.device.percent, s.user, s.ultrabrief)) stimWidth = stimulusFor(session.device.settings.program, session.device.percent, s.user, s.ultrabrief)!.pulseWidth; renderStim(); };
    host.querySelector<HTMLInputElement>('[data-spct]')!.oninput = (e) => { session.device.settings.percentIndex = Number((e.target as HTMLInputElement).value); const x = stimulusFor(session.device.settings.program, session.device.percent, s.user, s.ultrabrief); if (x) stimWidth = x.pulseWidth; renderStim(); };
    drawStimFigures(doses, th);
    const key = `${stimPlacement}`;
    if (sectionKey !== key) {
      section = null; sectionKey = key;
      const job = ++sectionJob;
      setTimeout(() => { if (job !== sectionJob || stopped) return; section = fieldSection(f, 72); if (view === 'stim') drawStimFigures(dosesFor(stimPlacement, stimWidth), thresholdField(stimWidth)); }, 30);
    }
  };
  const shares = new Map<PlacementId, number>();
  const brainShareOf = (p: PlacementId) => { if (!shares.has(p)) shares.set(p, fieldFor(p).brainShare(300)); return shares.get(p)!; };

  const drawStimFigures = (doses: RegionDose[], th: number) => {
    const col = { fg: css('--fg'), muted: css('--muted'), line: css('--line'), surface: css('--surface'), accent: css('--accent') };
    const sc = host.querySelector<HTMLCanvasElement>('[data-sec]');
    if (sc) {
      const { g, w } = sizeCanvas(sc, 300);
      if (section) drawFieldSection(g, w, 300, section, fieldFor(stimPlacement).model.head.radii, th, col, { a: 'A', b: 'B', left: t('left'), right: t('right'), up: t('up'), dec: lang === 'de' ? ',' : '.' });
      else { g.fillStyle = col.muted; g.font = '13px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(t('computing'), w / 2, 150); }
    }
    const rc = host.querySelector<HTMLCanvasElement>('[data-rmap]');
    if (rc) { const { g, w } = sizeCanvas(rc, 300); const p = PLACEMENTS[stimPlacement]; drawRegionMap(g, w, 300, doses, [p.a, p.b], col, { nose: t('nose') }); }
    const sd = host.querySelector<HTMLCanvasElement>('[data-sd]');
    if (sd) {
      const { g, w } = sizeCanvas(sd, 170), h = 170, x0 = 46, y0 = h - 26, x1 = w - 12, y1 = 10;
      const X = (ms: number) => x0 + ((ms - 0.1) / 1.4) * (x1 - x0), maxE = thresholdField(0.1) * 1.05, Y = (e: number) => y0 - (e / maxE) * (y0 - y1);
      g.strokeStyle = col.line; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.stroke();
      g.strokeStyle = col.accent; g.lineWidth = 2; g.beginPath();
      for (let k = 0; k <= 140; k++) { const ms = 0.1 + k * 0.01; const y = Y(thresholdField(ms)); if (k === 0) g.moveTo(X(ms), y); else g.lineTo(X(ms), y); }
      g.stroke(); g.lineWidth = 1;
      g.fillStyle = col.fg; g.beginPath(); g.arc(X(stimWidth), Y(thresholdField(stimWidth)), 4, 0, 2 * Math.PI); g.fill();
      g.fillStyle = col.muted; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (const ms of [0.25, 0.5, 1.0, 1.5]) g.fillText(`${num(ms, 2)} ms`, X(ms), y0 + 14);
      g.textAlign = 'right'; for (const e of [0.4, 0.6, 0.8]) if (e < maxE) g.fillText(`${num(e, 1)}`, x0 - 4, Y(e) + 4);
      g.textAlign = 'left'; g.fillText('V/cm', 4, y1 + 4);
    }
  };

  const stop = () => { stopped = true; cancelAnimationFrame(raf); tone('none'); try { audio?.ctx.close(); } catch { /* */ } };
  render();
  raf = requestAnimationFrame(frame);
  return { stop, setLang(l: Lang) { lang = l; printedReports.clear(); render(); } };
}
