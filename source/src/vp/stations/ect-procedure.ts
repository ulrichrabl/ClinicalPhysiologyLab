import type { LocalizedText } from '../model/i18n.ts';
import type { PlacementId } from '../physiology/brain/ect-stimulus.ts';
import { PLACEMENTS } from '../physiology/brain/ect-stimulus.ts';
import { ECT } from '../evidence/ect.ts';
import type { ProgramChoice } from './ect-device.ts';
import { PROGRAM_NAMES } from './ect-device.ts';
import type { EctSession } from './ect-session.ts';

/* ===========================================================================
   The ECT treatment as a procedure (owner, 2026-10-30): the team's steps in
   the order they are done, who does each, and what the learner's hands do.

   Three people treat (Czerwonka 2024, references.ts czerwonka2024: the sequence and the roles): the
   psychiatrist runs the device and gives the stimulus; the anaesthetist
   preoxygenates, induces, gives the relaxant, inserts the bite block and
   ventilates; the nurse prepares the skin, attaches the leads, inflates the
   cuff on the arm before the relaxant and watches that arm during the
   seizure. The learner takes one role, or all of them; the others' steps are
   done by the team, visibly, so that the learner sees what each person does.

   Modes: practise (a coach says what your next step is and why), watch (the
   team does everything, one step per "Next"), exam (no coach; afterwards a
   debrief of what was done, when, by whom, and what went wrong).

   Steps that act on the model do so for real: the premedication enters the
   body, cleaning the skin lowers the impedance the device reads, pads change
   where the current goes, the monitoring leads give the strip its channels,
   the device steps are the device's own. The anaesthetic steps (oxygen,
   induction, cuff, relaxant, bite block, ventilation) are not in the model
   yet (ECT part 2b): the patient is taken as asleep and relaxed throughout,
   and these steps set the order only. The station says so.

   No page code here: the tests run whole treatments with it.
=========================================================================== */

export type EctRole = 'psychiatrist' | 'anaesthetist' | 'nurse';
export const ECT_ROLES: readonly EctRole[] = ['psychiatrist', 'anaesthetist', 'nurse'];
export type EctMode = 'practise' | 'watch' | 'exam';

export type StepId = 'check' | 'premed' | 'skin' | 'pads' | 'leads' | 'power' | 'impedance' | 'dose' | 'oxygen' | 'induction'
  | 'cuff' | 'biteBlock' | 'relaxant' | 'ventilate' | 'treat' | 'observe' | 'report' | 'recovery';

const L = (en: string, de: string): LocalizedText => ({ en, de });

/** what the psychiatrist's order says for this treatment */
export interface EctOrder {
  id: string;
  title: LocalizedText;
  placement: PlacementId;
  program: ProgramChoice;
  percent: number;
  /** why this dose (the manual's method) */
  doseNote: LocalizedText;
}

/* The two first treatments the station offers. The dose is the manual's age method (the patient is 59): for right
   unilateral the age in percent, rounded to the dial's steps (60 %), with ultrabrief pulses; for the bilateral
   placements half of it (30 %) with 0.5 ms pulses. */
export const ECT_ORDERS: readonly EctOrder[] = [
  { id: 'rul', title: L('First treatment, right unilateral', 'Erste Behandlung, rechts unilateral'), placement: 'RUL', program: 'LOW_UB', percent: 60,
    doseNote: L('Dose by age (manual): 59 years → 60 %, ultrabrief pulses.', 'Dosis nach Alter (Handbuch): 59 Jahre → 60 %, ultrakurze Pulse.') },
  { id: 'bt', title: L('First treatment, bitemporal', 'Erste Behandlung, bitemporal'), placement: 'BT', program: 'LOW_05', percent: 30,
    doseNote: L('Dose by half the age (manual): 59 years → 30 %, 0.5 ms pulses.', 'Dosis nach halbem Alter (Handbuch): 59 Jahre → 30 %, Pulse von 0,5 ms.') },
];

/* Waits, from treatments in patients. */
/** after the induction agent, before the patient is asleep enough to go on (propofol: induction to loss of response 44 s,
    IQR 39–51, Shen 2026; methohexital about 30 s, Czerwonka 2024) */
export const INDUCTION_WAIT = 45;
/** after succinylcholine, before the stimulus: the fasciculations pass (Shen 2026 waited about a minute; Parikh 2017
    until the fasciculations stopped) */
export const RELAXANT_WAIT = 60;
/** how far above the systolic pressure the team pumps the cuff (a placement: well above it, so that no arterial blood
    carrying the relaxant passes) and how much one squeeze of the bulb adds (a placement: a hand bulb of a sphygmomanometer
    raises a limb cuff by tens of mmHg a squeeze) */
export const CUFF_ABOVE = 100;
export const CUFF_SQUEEZE = 20;
/** how long the team takes to start a step it can do */
export const TEAM_DELAY = 3;
/** how long after the stimulus the seizure is watched at least */
const OBSERVE_MIN = 20;
/** how long the EEG stays flat before the seizure counts as over (the device places its EEG endpoint once the amplitude
    has stayed below the baseline for 2 s, Swartz 1994; a few seconds more, as the station's demonstration waited) */
const FLAT_FOR = 8;

/** what has been done in the room (the device keeps its own state) */
export interface Room {
  checked: boolean; premed: boolean; skin: boolean; pads: PlacementId | null; leads: boolean;
  oxygen: boolean; induced: boolean; cuff: boolean; biteBlock: boolean; relaxed: boolean; ventilating: boolean; recovered: boolean;
  /** the cuff on the right upper arm: put on, and its pressure (mmHg) */
  cuffOn: boolean; cuffMmHg: number;
  /** the treatment button's cover */
  coverUp: boolean;
}

export interface StepDef {
  id: StepId;
  role: EctRole;
  /** room: one action in the room; device: done at the device's panel; wait: watched, not done */
  kind: 'room' | 'device' | 'wait';
  /** whether the model does something with it (false: the order only, until part 2b) */
  modelled: boolean;
  /** steps that come first: the team starts a step only after these, and the coach shows it only then */
  after: StepId[];
  title: LocalizedText;
  /** for the coach: what to do */
  how: LocalizedText;
  /** for the coach and the debrief: why */
  why: LocalizedText;
  /** what the team member says when doing it */
  says: LocalizedText;
}

export const STEPS: readonly StepDef[] = [
  { id: 'check', role: 'psychiatrist', kind: 'room', modelled: false, after: [],
    title: L('Check patient and order', 'Patient und Anordnung prüfen'),
    how: L('Identity, consent, fasting; read the order aloud.', 'Identität, Einwilligung, Nüchternheit; Anordnung vorlesen.'),
    why: L('Right patient, right treatment.', 'Richtiger Patient, richtige Behandlung.'),
    says: L('Checked; order read.', 'Geprüft; Anordnung vorgelesen.') },
  { id: 'premed', role: 'anaesthetist', kind: 'room', modelled: true, after: ['check'],
    title: L('Glycopyrrolate 0.2 mg IV', 'Glycopyrronium 0,2 mg i. v.'),
    how: L('Give it now.', 'Jetzt geben.'),
    why: L('Blunts the vagal slowing the stimulus causes.', 'Dämpft die vagale Bradykardie durch den Reiz.'),
    says: L('Glycopyrrolate in.', 'Glycopyrronium gegeben.') },
  { id: 'skin', role: 'nurse', kind: 'room', modelled: true, after: ['check'],
    title: L('Clean the pad sites', 'Elektrodenstellen reinigen'),
    how: L('Rub with a saline swab, pat dry.', 'Mit Kochsalzlösung abreiben, trocken tupfen.'),
    why: L('Uncleaned skin drives the impedance above 3000 Ω.', 'Ungereinigte Haut treibt die Impedanz über 3000 Ω.'),
    says: L('Skin cleaned.', 'Haut gereinigt.') },
  { id: 'pads', role: 'psychiatrist', kind: 'room', modelled: true, after: ['skin'],
    title: L('Place the stimulus pads', 'Reizelektroden anlegen'),
    how: L('Click the two sites of the ordered placement on the head from above.', 'Die zwei Stellen der angeordneten Position am Kopf von oben anklicken.'),
    why: L('The placement decides where the current goes: threshold, side effects, bradycardia.', 'Die Position bestimmt den Stromweg: Schwelle, Nebenwirkungen, Bradykardie.'),
    says: L('Pads on.', 'Elektroden angelegt.') },
  { id: 'leads', role: 'nurse', kind: 'room', modelled: true, after: ['skin'],
    title: L('Attach EEG, ECG and EMG', 'EEG, EKG und EMG anlegen'),
    how: L('EEG above the eyebrow to the mastoid, ECG on the chest, EMG on the right forearm; plug in the cable.', 'EEG über der Augenbraue zum Mastoid, EKG auf die Brust, EMG an den rechten Unterarm; Kabel einstecken.'),
    why: L('Without EEG, no baseline and no endpoints.', 'Ohne EEG keine Grundlinie und keine Endpunkte.'),
    says: L('Leads on.', 'Ableitungen angelegt.') },
  { id: 'power', role: 'psychiatrist', kind: 'device', modelled: true, after: ['check'],
    title: L('Switch the device on', 'Gerät einschalten'),
    how: L('Press POWER; wait for the self-test printout.', 'POWER drücken; Selbsttest-Ausdruck abwarten.'),
    why: L('The device checks itself before use.', 'Das Gerät prüft sich vor dem Einsatz.'),
    says: L('Device on.', 'Gerät an.') },
  { id: 'impedance', role: 'psychiatrist', kind: 'device', modelled: true, after: ['pads', 'power', 'leads'],
    title: L('Test the impedance', 'Impedanz testen'),
    how: L('Hold IMPEDANCE TEST, release, wait for READY.', 'IMPEDANCE TEST halten, loslassen, READY abwarten.'),
    why: L('100–3000 Ω means good contact; releasing starts the baseline EEG.', '100–3000 Ω heißt guter Kontakt; Loslassen startet das Grundlinien-EEG.'),
    says: L('Impedance in range; READY.', 'Impedanz im Bereich; READY.') },
  { id: 'dose', role: 'psychiatrist', kind: 'device', modelled: true, after: ['power'],
    title: L('Set program and dose', 'Programm und Dosis einstellen'),
    how: L('FlexDial: press, PROGRAMS, press, turn, press. Then PERCENT ENERGY to the ordered value.', 'FlexDial: drücken, PROGRAMS, drücken, drehen, drücken. Dann PERCENT ENERGY auf den angeordneten Wert.'),
    why: L('The charge decides whether a seizure starts, and how far above threshold.', 'Die Ladung entscheidet, ob ein Anfall beginnt und wie weit über der Schwelle.'),
    says: L('Set as ordered.', 'Wie angeordnet eingestellt.') },
  { id: 'oxygen', role: 'anaesthetist', kind: 'room', modelled: false, after: ['leads'],
    title: L('Preoxygenate', 'Präoxygenieren'),
    how: L('Mask on, 100 % oxygen.', 'Maske auf, 100 % Sauerstoff.'),
    why: L('An oxygen reserve for the apnoea.', 'Sauerstoffreserve für die Apnoe.'),
    says: L('Preoxygenating.', 'Präoxygeniere.') },
  { id: 'induction', role: 'anaesthetist', kind: 'room', modelled: false, after: ['oxygen', 'impedance'],
    title: L('Induce anaesthesia', 'Narkose einleiten'),
    how: L('Give the hypnotic; wait until unresponsive (about 45 s).', 'Hypnotikum geben; warten, bis keine Reaktion (etwa 45 s).'),
    why: L('Asleep before the relaxant.', 'Schlafen vor dem Relaxans.'),
    says: L('Hypnotic in.', 'Hypnotikum gegeben.') },
  { id: 'cuff', role: 'nurse', kind: 'room', modelled: false, after: ['induction'],
    title: L('Inflate the arm cuff', 'Armmanschette aufpumpen'),
    how: L('Cuff on the right upper arm; pump well above systolic; report it up.', 'Manschette an den rechten Oberarm; deutlich über systolisch pumpen; melden.'),
    why: L('Keeps the relaxant out of the arm, so the motor seizure stays visible.', 'Hält das Relaxans aus dem Arm, damit der motorische Anfall sichtbar bleibt.'),
    says: L('Cuff up.', 'Manschette oben.') },
  { id: 'biteBlock', role: 'anaesthetist', kind: 'room', modelled: false, after: ['induction'],
    title: L('Insert the bite block', 'Beißschutz einlegen'),
    how: L('Between the teeth.', 'Zwischen die Zähne.'),
    why: L('The stimulus clenches the jaw directly, relaxant or not.', 'Der Reiz presst den Kiefer direkt zusammen, mit oder ohne Relaxans.'),
    says: L('Bite block in.', 'Beißschutz drin.') },
  { id: 'relaxant', role: 'anaesthetist', kind: 'room', modelled: false, after: ['cuff', 'biteBlock'],
    title: L('Succinylcholine', 'Succinylcholin'),
    how: L('Give it; wait for the fasciculations to pass (about 1 min).', 'Geben; Faszikulationen abwarten (etwa 1 min).'),
    why: L('Softens the convulsion.', 'Mildert die Krämpfe.'),
    says: L('Succinylcholine in.', 'Succinylcholin gegeben.') },
  { id: 'ventilate', role: 'anaesthetist', kind: 'room', modelled: false, after: ['relaxant'],
    title: L('Ventilate', 'Beatmen'),
    how: L('Bag and mask, slightly fast, until the stimulus.', 'Beutel und Maske, etwas schneller, bis zum Reiz.'),
    why: L('The patient is apnoeic; a low CO₂ helps the seizure.', 'Der Patient atmet nicht; niedriges CO₂ fördert den Anfall.'),
    says: L('Ventilating. Ready.', 'Beatme. Bereit.') },
  { id: 'treat', role: 'psychiatrist', kind: 'device', modelled: true, after: ['ventilate', 'dose', 'impedance'],
    title: L('Stimulate', 'Reiz auslösen'),
    how: L('Say “stimulating”, lift the cover, hold TREAT until the tone stops.', '„Reiz“ ansagen, Kappe heben, TREAT halten, bis der Ton endet.'),
    why: L('Hands off the patient; releasing early gives less charge.', 'Hände weg vom Patienten; früheres Loslassen gibt weniger Ladung.'),
    says: L('Stimulating.', 'Reiz.') },
  { id: 'observe', role: 'nurse', kind: 'wait', modelled: true, after: ['treat'],
    title: L('Time the seizure', 'Anfall messen'),
    how: L('Watch the cuffed arm, and the EEG and EMG on the strip.', 'Den gestauten Arm sowie EEG und EMG auf dem Streifen beobachten.'),
    why: L('The motor seizure ends before the EEG seizure.', 'Der motorische Anfall endet vor dem EEG-Anfall.'),
    says: L('Seizure timed.', 'Anfall gemessen.') },
  { id: 'report', role: 'psychiatrist', kind: 'device', modelled: true, after: ['observe'],
    title: L('Print the report', 'Bericht drucken'),
    how: L('When the EEG is flat, press START/STOP.', 'Wenn das EEG flach ist, START/STOP drücken.'),
    why: L('Records dose, impedance and seizure for the next treatment.', 'Hält Dosis, Impedanz und Anfall für die nächste Behandlung fest.'),
    says: L('Report printed.', 'Bericht gedruckt.') },
  { id: 'recovery', role: 'anaesthetist', kind: 'room', modelled: false, after: ['observe'],
    title: L('Recover the patient', 'Patienten ausleiten'),
    how: L('Ventilate until breathing returns; cuff down.', 'Beatmen bis zur Spontanatmung; Manschette ab.'),
    why: L('The relaxant wears off within minutes.', 'Das Relaxans lässt binnen Minuten nach.'),
    says: L('Breathing; cuff down.', 'Atmet; Manschette ab.') },
];
export const STEP: Record<StepId, StepDef> = Object.fromEntries(STEPS.map((s) => [s.id, s])) as Record<StepId, StepDef>;

/** a mistake the procedure noticed, at the moment it happened */
export interface ProcedureError { t: number; code: ErrorCode; step: StepId; text: LocalizedText }
export type ErrorCode = 'awake-stimulus' | 'unmodified' | 'early-stimulus' | 'no-bite-block' | 'no-impedance' | 'impedance-out' | 'wrong-dose' | 'wrong-pads'
  | 'no-leads' | 'not-ventilated' | 'awake-paralysis' | 'no-cuff' | 'cuff-low';

const ERROR_TEXT: Record<ErrorCode, LocalizedText> = {
  'awake-stimulus': L('Stimulus before anaesthesia.', 'Reiz vor der Narkose.'),
  unmodified: L('Stimulus without relaxant.', 'Reiz ohne Relaxans.'),
  'early-stimulus': L('Stimulus within 60 s of the relaxant.', 'Reiz innerhalb von 60 s nach dem Relaxans.'),
  'no-bite-block': L('Stimulus without bite block.', 'Reiz ohne Beißschutz.'),
  'no-impedance': L('Stimulus without impedance test.', 'Reiz ohne Impedanztest.'),
  'impedance-out': L('Stimulus with impedance outside 100–3000 Ω.', 'Reiz bei Impedanz außerhalb 100–3000 Ω.'),
  'wrong-dose': L('Program or dose not as ordered.', 'Programm oder Dosis nicht wie angeordnet.'),
  'wrong-pads': L('Pads not at the ordered placement.', 'Elektroden nicht an der angeordneten Position.'),
  'no-leads': L('Stimulus without EEG and ECG.', 'Reiz ohne EEG und EKG.'),
  'not-ventilated': L('Stimulus without ventilation.', 'Reiz ohne Beatmung.'),
  'awake-paralysis': L('Relaxant before the hypnotic: awake and paralysed.', 'Relaxans vor dem Hypnotikum: wach und gelähmt.'),
  'cuff-low': L('Cuff below systolic at the relaxant: the arm is relaxed too.', 'Manschette beim Relaxans unter systolisch: Auch der Arm ist relaxiert.'),
  'no-cuff': L('Relaxant before the cuff: no motor seizure to see.', 'Relaxans vor der Manschette: kein motorischer Anfall sichtbar.'),
};

export type Who = 'you' | EctRole;
export interface LogEntry { t: number; who: Who; step: StepId; text: LocalizedText }
export interface StepStatus { at: number; by: Who }

type Gen = Generator<number, void, unknown>;

export class Procedure {
  readonly room: Room = { checked: false, premed: false, skin: false, pads: null, leads: false, oxygen: false, induced: false, cuff: false, biteBlock: false, relaxed: false, ventilating: false, recovered: false, coverUp: false, cuffOn: false, cuffMmHg: 0 };
  readonly done = new Map<StepId, StepStatus>();
  readonly log: LogEntry[] = [];
  readonly errors: ProcedureError[] = [];
  /** when each room action was done (the waits run from these) */
  private stamps = new Map<StepId, number>();
  /** what the team is doing now: one action per role */
  private team = new Map<EctRole, { step: StepId; gen: Gen; wait: number }>();
  /** when each team member could start their next step */
  private readyAt = new Map<StepId, number>();
  /** watch mode: the team may start the next step */
  private gate = true;
  private stimulusSeen = 0;
  private lastSeizing = -Infinity;
  private padsWanted: PlacementId | null = null;

  constructor(readonly session: EctSession, readonly order: EctOrder, readonly mode: EctMode, readonly roles: readonly EctRole[]) {
    /* the room before anything is done: skin not cleaned, no pads, no leads */
    session.setPrepared(false);
    session.setPads(null);
    session.monitoringCable = false;
  }

  get t() { return this.session.t; }
  /** whether this step is the learner's to do */
  mine(id: StepId) { return this.mode !== 'watch' && this.roles.includes(STEP[id].role); }
  isDone(id: StepId) { return this.done.has(id); }
  /** all the steps before it are done */
  open(id: StepId) { return !this.isDone(id) && STEP[id].after.every((a) => this.isDone(a)); }
  /** seconds still to wait before this step should be done (the anaesthetic's onset, the fasciculations) */
  waitFor(id: StepId): number {
    const since = (s: StepId, w: number) => { const at = this.stamps.get(s); return at == null ? 0 : Math.max(0, at + w - this.t); };
    if (id === 'cuff' || id === 'biteBlock') return since('induction', INDUCTION_WAIT);
    if (id === 'ventilate') return since('relaxant', RELAXANT_WAIT);
    return 0;
  }
  /** the learner's steps that can be done now (open, in order) */
  myOpen(): StepId[] { return STEPS.filter((s) => this.mine(s.id) && this.open(s.id) && s.kind !== 'wait').map((s) => s.id); }
  /** the learner's next step: what the coach talks about */
  current(): StepId | null { return this.myOpen()[0] ?? null; }
  /** the treatment is over: the report is printed and the patient recovered */
  get finished() { return this.isDone('report') && this.isDone('recovery'); }
  /** time may run faster: nothing is the learner's to do just now (they wait for the team, a drug or the seizure) */
  get canHurry(): boolean {
    if (this.open('observe') && this.isDone('treat')) return true;
    if (this.mode === 'watch') return this.team.size > 0;
    const mine = this.myOpen();
    return mine.length === 0 || mine.every((id) => this.waitFor(id) > 0);
  }
  /** the step the team is doing now, if any */
  teamDoing(): Array<{ role: EctRole; step: StepId }> { return [...this.team].map(([role, x]) => ({ role, step: x.step })); }
  /** watch mode: the next step the team will do on "Next" */
  watchNext(): StepId | null { return this.mode === 'watch' ? STEPS.find((s) => this.open(s.id) && s.kind !== 'wait')?.id ?? null : null; }
  /** watch mode: the team waits for "Next" (not while the seizure is watched: that ends by itself) */
  get waitingForNext() { return this.mode === 'watch' && !this.gate && this.team.size === 0 && !this.finished && !this.open('observe') && this.watchNext() != null; }
  next() { this.gate = true; }

  /* ---- the learner's room actions ------------------------------------------------------------------------------- */
  /** do a room step now (the learner's hands, or the team's) */
  act(id: StepId, by: Who = 'you', opts: { placement?: PlacementId } = {}) {
    const s = STEP[id];
    if (s.kind !== 'room' || this.isDone(id)) return;
    const r = this.room, session = this.session;
    switch (id) {
      case 'check': r.checked = true; break;
      case 'premed': r.premed = true; session.give('glycopyrrolate', 0.2); break;
      case 'skin': r.skin = true; session.setPrepared(true); break;
      case 'pads': { const p = opts.placement ?? this.padsWanted ?? this.order.placement; r.pads = p; session.setPads(p); if (p !== this.order.placement) this.err('wrong-pads', id); break; }
      case 'leads': r.leads = true; session.monitoringCable = true; break;
      case 'oxygen': r.oxygen = true; break;
      case 'induction': r.induced = true; break;
      case 'cuff':
        /* the team pumps it well above the systolic pressure (a placement: the source asks only for "high enough" to keep
           the relaxant out); the learner has pumped it themselves and says it is up */
        r.cuffOn = true; if (by !== 'you') r.cuffMmHg = Math.round((this.systolic + CUFF_ABOVE) / 10) * 10;
        r.cuff = true; break;
      case 'biteBlock': r.biteBlock = true; break;
      case 'relaxant':
        if (!r.induced) this.err('awake-paralysis', id);
        if (!r.cuff) this.err('no-cuff', id);
        else if (r.cuffMmHg <= this.systolic) this.err('cuff-low', id);
        r.relaxed = true; break;
      case 'ventilate': r.ventilating = true; break;
      case 'recovery': r.recovered = true; r.ventilating = false; r.cuffMmHg = 0; r.cuffOn = false; break;
    }
    this.stamps.set(id, this.t);
    this.finish(id, by);
  }
  /** the patient's systolic pressure now (mmHg) */
  get systolic(): number { const m = (this.session.body.run.sim as unknown as { metrics?: { Psys?: number } }).metrics; return Number.isFinite(m?.Psys) ? m!.Psys! : 120; }
  /** the learner's hands on the cuff: put it on, squeeze the bulb (each squeeze adds pressure), or let it down */
  cuffOn() { this.room.cuffOn = true; }
  squeeze() { if (this.room.cuffOn) this.room.cuffMmHg = Math.min(300, this.room.cuffMmHg + CUFF_SQUEEZE); }
  deflate() { this.room.cuffMmHg = 0; }
  /** the placement the learner chose, before pressing the pads on */
  choosePads(p: PlacementId) { this.padsWanted = p; }

  private finish(id: StepId, by: Who) {
    if (this.isDone(id)) return;
    this.done.set(id, { at: this.t, by });
    this.log.push({ t: this.t, who: by, step: id, text: STEP[id].says });
    if (this.mode === 'watch') this.gate = false;
  }
  private err(code: ErrorCode, step: StepId) {
    if (this.errors.some((e) => e.code === code)) return;
    this.errors.push({ t: this.t, code, step, text: ERROR_TEXT[code] });
  }

  /* ---- each tick: notice the device steps, run the team ----------------------------------------------------------- */
  tick(dt: number) {
    const d = this.session.device, session = this.session;
    const by = (id: StepId): Who => (this.team.get(STEP[id].role)?.step === id ? STEP[id].role : this.mine(id) ? 'you' : STEP[id].role);
    /* the device steps, as the device shows them */
    if (!this.isDone('power') && d.on && !d.booting && session.paper.some((e) => e.kind === 'selftest')) this.finish('power', by('power'));
    if (!this.isDone('impedance') && d.baseline === 'ready' && d.lastStatic != null && d.lastStatic > ECT.staticLow && d.lastStatic < ECT.staticHigh) this.finish('impedance', by('impedance'));
    if (!this.isDone('dose') && d.on && !d.booting && this.doseRight() && (this.isDone('impedance') || this.team.get('psychiatrist')?.step === 'dose')) this.finish('dose', by('dose'));
    /* the stimulus: check the room at the moment it starts */
    if (session.stimuli.length > this.stimulusSeen) { this.stimulusSeen = session.stimuli.length; this.checkStimulus(); }
    if (!this.isDone('treat') && session.stimuli.length > 0 && d.stimulusEnd != null && d.treat !== 'delivering' && d.treat !== 'warning') this.finish('treat', by('treat'));
    if (session.seizing) this.lastSeizing = this.t;
    if (!this.isDone('observe') && this.isDone('treat') && d.stimulusEnd != null && d.t - d.stimulusEnd >= OBSERVE_MIN && this.t - this.lastSeizing >= FLAT_FOR) this.finish('observe', by('observe'));
    if (!this.isDone('report') && this.isDone('treat') && session.paper.some((e) => e.kind === 'report' && e.stimulus === session.stimuli.length - 1)) this.finish('report', by('report'));
    this.runTeam(dt);
  }
  private doseRight() { const s = this.session.device.settings; return s.program === this.order.program && this.session.device.percent === this.order.percent; }
  private checkStimulus() {
    const r = this.room, d = this.session.device;
    if (!r.induced) this.err('awake-stimulus', 'treat');
    else if (!r.relaxed) this.err('unmodified', 'treat');
    else { const at = this.stamps.get('relaxant'); if (at != null && this.t - at < RELAXANT_WAIT) this.err('early-stimulus', 'treat'); }
    if (!r.biteBlock) this.err('no-bite-block', 'treat');
    if (d.lastStatic == null || d.baseline !== 'ready' && !this.isDone('impedance')) this.err('no-impedance', 'treat');
    else if (d.lastStatic <= ECT.staticLow || d.lastStatic >= ECT.staticHigh) this.err('impedance-out', 'treat');
    if (!this.doseRight()) this.err('wrong-dose', 'treat');
    if (r.pads !== this.order.placement) this.err('wrong-pads', 'treat');
    if (!r.leads) this.err('no-leads', 'treat');
    if (r.relaxed && !r.ventilating) this.err('not-ventilated', 'treat');
  }

  private runTeam(dt: number) {
    for (const [role, job] of [...this.team]) {
      job.wait -= dt;
      while (job.wait <= 0) {
        const r = job.gen.next();
        if (r.done) { this.team.delete(role); break; }
        job.wait += r.value as number;
      }
    }
    if (this.mode === 'watch' && !this.gate) return;
    for (const s of STEPS) {
      if (this.mine(s.id) || !this.open(s.id) || this.team.has(s.role) || s.kind === 'wait') continue;
      if (this.mode === 'watch' && this.team.size > 0) break;
      if (this.waitFor(s.id) > 0) continue;
      /* the team takes a moment to start */
      const ready = this.readyAt.get(s.id);
      if (ready == null) { this.readyAt.set(s.id, this.t + (this.mode === 'watch' ? 0.5 : TEAM_DELAY)); continue; }
      if (this.t < ready) continue;
      this.readyAt.delete(s.id);
      this.team.set(s.role, { step: s.id, gen: this.perform(s.id), wait: 0 });
      if (this.mode === 'watch') { this.gate = false; break; }
    }
  }

  /** how the team does a step: room steps at once, device steps as the manual describes */
  private *perform(id: StepId): Gen {
    const d = this.session.device, role = STEP[id].role;
    const done = () => this.isDone(id);
    if (STEP[id].kind === 'room') { this.act(id, role); return; }
    if (id === 'power') {
      if (!d.on) d.power(true);
      while (!done()) yield 0.25;
      return;
    }
    if (id === 'impedance') {
      d.impedanceButton(true); yield 1.6; d.impedanceButton(false);
      while (d.baseline !== 'ready') yield 0.25;
      /* out of range: the team does not go on, and tries again only after a while (the display shows why) */
      if (!done()) this.readyAt.set(id, this.t + 10);
      return;
    }
    if (id === 'dose') {
      d.settings.program = this.order.program; yield 0.5;
      while (d.percent !== this.order.percent) { d.turnPercent(d.percent < this.order.percent ? 1 : -1); yield 0.15; }
      yield 0.5; this.finish('dose', role); return;
    }
    if (id === 'treat') {
      this.room.coverUp = true; yield 0.8;
      d.treatButton(true);
      while (d.treat !== 'done') yield 0.1;
      d.treatButton(false); this.room.coverUp = false;
      yield 0.2; return;
    }
    if (id === 'report') { d.startStop(); while (!done()) yield 0.25; }
  }

  /** for the debrief: each step, who did it and when, in the order of the procedure */
  summary(): Array<{ step: StepDef; status: StepStatus | null }> { return STEPS.map((s) => ({ step: s, status: this.done.get(s.id) ?? null })); }
}

export const ROLE_NAME: Record<EctRole, LocalizedText> = {
  psychiatrist: L('Psychiatrist', 'Psychiatrie'), anaesthetist: L('Anaesthetist', 'Anästhesie'), nurse: L('Nurse', 'Pflege'),
};
export const MODE_NAME: Record<EctMode, LocalizedText> = { practise: L('Practise', 'Üben'), watch: L('Watch', 'Zusehen'), exam: L('Exam', 'Prüfung') };

/** the order as the card shows it */
export function orderLines(o: EctOrder): LocalizedText[] {
  const p = PLACEMENTS[o.placement];
  return [
    L(`Pads: ${p.name.en}`, `Elektroden: ${p.name.de}`),
    L(`Program ${PROGRAM_NAMES[o.program]}, ${o.percent} %`, `Programm ${PROGRAM_NAMES[o.program]}, ${o.percent} %`),
    L('Premedication: glycopyrrolate 0.2 mg IV', 'Prämedikation: Glycopyrronium 0,2 mg i. v.'),
    o.doseNote,
  ];
}
