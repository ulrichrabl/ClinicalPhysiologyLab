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
    doseNote: L('Age method of the device’s manual: the age in percent for unilateral pads (59 years: 60 %), ultrabrief pulses (program LOW 0.25).', 'Altersmethode des Gerätehandbuchs: das Alter in Prozent bei unilateralen Elektroden (59 Jahre: 60 %), ultrakurze Pulse (Programm LOW 0.25).') },
  { id: 'bt', title: L('First treatment, bitemporal', 'Erste Behandlung, bitemporal'), placement: 'BT', program: 'LOW_05', percent: 30,
    doseNote: L('Age method of the device’s manual: half the age in percent for bilateral pads (59 years: 30 %), 0.5 ms pulses (program LOW 0.5).', 'Altersmethode des Gerätehandbuchs: das halbe Alter in Prozent bei bilateralen Elektroden (59 Jahre: 30 %), Pulse von 0,5 ms (Programm LOW 0.5).') },
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
    title: L('Check the patient and the order', 'Patient und Anordnung prüfen'),
    how: L('Confirm who the patient is, the consent, fasting, and the order: placement and dose.', 'Bestätigen Sie die Identität, die Einwilligung, die Nüchternheit und die Anordnung: Elektrodenlage und Dosis.'),
    why: L('Every treatment starts with the right patient and the order for this session.', 'Jede Behandlung beginnt mit dem richtigen Patienten und der Anordnung für diese Sitzung.'),
    says: L('Identity, consent and fasting checked; the order is read out.', 'Identität, Einwilligung und Nüchternheit geprüft; die Anordnung ist vorgelesen.') },
  { id: 'premed', role: 'anaesthetist', kind: 'room', modelled: true, after: ['check'],
    title: L('Glycopyrrolate 0.2 mg IV', 'Glycopyrronium 0,2 mg i. v.'),
    how: L('Give the anticholinergic into the line now.', 'Geben Sie das Anticholinergikum jetzt in den Zugang.'),
    why: L('The stimulus discharges the vagus onto the heart: an anticholinergic shortens the slowing and the pauses it causes.', 'Der Reiz entlädt den Vagus auf das Herz: Ein Anticholinergikum verkürzt die Verlangsamung und die Pausen, die er auslöst.'),
    says: L('Glycopyrrolate 0.2 mg is in.', 'Glycopyrronium 0,2 mg ist drin.') },
  { id: 'skin', role: 'nurse', kind: 'room', modelled: true, after: ['check'],
    title: L('Clean the skin at the pad sites', 'Haut an den Elektrodenstellen reinigen'),
    how: L('Clean and dry the skin where the pads go.', 'Reinigen und trocknen Sie die Haut, wo die Elektroden hinkommen.'),
    why: L('Oil and dead skin raise the impedance; the device manual names an unprepared skin as the usual cause of a reading over 3000 Ω.', 'Fett und Hornhaut erhöhen die Impedanz; das Gerätehandbuch nennt ungereinigte Haut als häufigste Ursache eines Werts über 3000 Ω.'),
    says: L('Skin cleaned at the pad sites.', 'Haut an den Elektrodenstellen gereinigt.') },
  { id: 'pads', role: 'psychiatrist', kind: 'room', modelled: true, after: ['skin'],
    title: L('Place the stimulus pads', 'Reizelektroden anlegen'),
    how: L('Put the pads on at the placement the order gives and press them on.', 'Legen Sie die Elektroden an der angeordneten Position an und drücken Sie sie an.'),
    why: L('Where the pads sit decides where the current goes, and so the seizure threshold, the cognitive side effects and how the heart slows.', 'Wo die Elektroden sitzen, entscheidet, wohin der Strom fließt, und damit über die Krampfschwelle, die kognitiven Nebenwirkungen und wie stark sich das Herz verlangsamt.'),
    says: L('Pads on.', 'Elektroden angelegt.') },
  { id: 'leads', role: 'nurse', kind: 'room', modelled: true, after: ['skin'],
    title: L('Attach EEG, ECG and EMG leads', 'EEG-, EKG- und EMG-Ableitungen anlegen'),
    how: L('EEG above each eyebrow to the mastoid, the ECG on the chest, the EMG on the right forearm, two electrodes about 3 inches apart; plug the cable into the device.', 'EEG über jeder Augenbraue zum Mastoid, das EKG an die Brust, das EMG an den rechten Unterarm, zwei Elektroden etwa 7,5 cm auseinander; stecken Sie das Kabel ins Gerät.'),
    why: L('Without them there is no EEG to judge the seizure, no baseline for the device’s endpoints and no ECG on the strip.', 'Ohne sie gibt es kein EEG, um den Anfall zu beurteilen, keine Grundlinie für die Endpunkte des Geräts und kein EKG auf dem Streifen.'),
    says: L('Leads on and plugged in.', 'Ableitungen angelegt und eingesteckt.') },
  { id: 'power', role: 'psychiatrist', kind: 'device', modelled: true, after: ['check'],
    title: L('Switch the device on', 'Gerät einschalten'),
    how: L('Press POWER and wait for the self test to print.', 'Drücken Sie POWER und warten Sie, bis der Selbsttest gedruckt ist.'),
    why: L('The self test checks the device before it is used on the patient.', 'Der Selbsttest prüft das Gerät, bevor es am Patienten eingesetzt wird.'),
    says: L('Device on, self test passed.', 'Gerät an, Selbsttest bestanden.') },
  { id: 'impedance', role: 'psychiatrist', kind: 'device', modelled: true, after: ['pads', 'power', 'leads'],
    title: L('Test the impedance', 'Impedanz testen'),
    how: L('Hold IMPEDANCE TEST: the display shows the ohms; release it and the device collects the baseline EEG until READY.', 'Halten Sie IMPEDANCE TEST: Die Anzeige zeigt die Ohm; lassen Sie los, und das Gerät sammelt das Grundlinien-EEG bis READY.'),
    why: L('Between 100 and 3000 Ω the pads make contact; above it they do not, below it the current may run along the skin.', 'Zwischen 100 und 3000 Ω haben die Elektroden Kontakt; darüber nicht, darunter fließt der Strom womöglich über die Haut.'),
    says: L('Impedance in range; baseline collected, READY.', 'Impedanz im Bereich; Grundlinie gesammelt, READY.') },
  { id: 'dose', role: 'psychiatrist', kind: 'device', modelled: true, after: ['power'],
    title: L('Set the program and dose', 'Programm und Dosis einstellen'),
    how: L('The program: press the FlexDial (PROGRAMS shows), press it again, turn to the ordered program, press to select. The dose: turn PERCENT ENERGY to the ordered percent (pressing that dial shows the program in use).', 'Das Programm: Drücken Sie den FlexDial (PROGRAMS erscheint), drücken Sie erneut, drehen Sie zum angeordneten Programm, drücken Sie zur Auswahl. Die Dosis: Drehen Sie PERCENT ENERGY auf den angeordneten Prozentwert (Drücken dieses Knopfs zeigt das eingestellte Programm).'),
    why: L('The charge decides whether a seizure starts and how far above threshold it lies; unilateral treatment works only well above it.', 'Die Ladung entscheidet, ob ein Anfall beginnt und wie weit über der Schwelle er liegt; unilaterale Behandlung wirkt nur deutlich darüber.'),
    says: L('Program and dose set as ordered.', 'Programm und Dosis wie angeordnet eingestellt.') },
  { id: 'oxygen', role: 'anaesthetist', kind: 'room', modelled: false, after: ['leads'],
    title: L('Preoxygenate by mask', 'Präoxygenieren über die Maske'),
    how: L('Mask on, oxygen flowing, a few minutes of breathing.', 'Maske auf, Sauerstoff an, einige Minuten atmen lassen.'),
    why: L('The patient will stop breathing with the relaxant; oxygen in the lungs is the reserve.', 'Mit dem Relaxans hört der Patient auf zu atmen; der Sauerstoff in der Lunge ist die Reserve.'),
    says: L('Preoxygenating.', 'Präoxygeniere.') },
  { id: 'induction', role: 'anaesthetist', kind: 'room', modelled: false, after: ['oxygen', 'impedance'],
    title: L('Induce anaesthesia', 'Narkose einleiten'),
    how: L('Give the induction agent and wait until the patient no longer responds (about 45 s with propofol).', 'Geben Sie das Hypnotikum und warten Sie, bis der Patient nicht mehr reagiert (mit Propofol etwa 45 s).'),
    why: L('Sleep comes before the relaxant: paralysed while awake is the worst thing that can happen here.', 'Der Schlaf kommt vor dem Relaxans: wach und gelähmt ist das Schlimmste, was hier geschehen kann.'),
    says: L('Induction agent in.', 'Hypnotikum ist drin.') },
  { id: 'cuff', role: 'nurse', kind: 'room', modelled: false, after: ['induction'],
    title: L('Inflate the cuff on the right arm', 'Manschette am rechten Arm aufpumpen'),
    how: L('Put the cuff on the upper arm and squeeze the bulb until the gauge is well above the systolic pressure; then say it is up. All before the relaxant.', 'Legen Sie die Manschette am Oberarm an und drücken Sie den Ballon, bis das Manometer deutlich über dem systolischen Druck steht; dann melden Sie sie als aufgepumpt. Alles vor dem Relaxans.'),
    why: L('The cuff keeps the relaxant out of that arm, so the motor seizure can be seen and timed there (and the EMG recorded).', 'Die Manschette hält das Relaxans von diesem Arm fern, damit der motorische Anfall dort gesehen und gemessen werden kann (und das EMG abgeleitet).'),
    says: L('Cuff up on the right arm.', 'Manschette am rechten Arm aufgepumpt.') },
  { id: 'biteBlock', role: 'anaesthetist', kind: 'room', modelled: false, after: ['induction'],
    title: L('Insert the bite block', 'Beißschutz einlegen'),
    how: L('Place the bite block between the teeth.', 'Legen Sie den Beißschutz zwischen die Zähne.'),
    why: L('The stimulus contracts the jaw muscles directly, relaxant or not: the block protects teeth and tongue.', 'Der Reiz kontrahiert die Kaumuskeln direkt, mit oder ohne Relaxans: Der Beißschutz schützt Zähne und Zunge.'),
    says: L('Bite block in.', 'Beißschutz ist drin.') },
  { id: 'relaxant', role: 'anaesthetist', kind: 'room', modelled: false, after: ['cuff', 'biteBlock'],
    title: L('Succinylcholine', 'Succinylcholin'),
    how: L('Give the relaxant and wait for the fasciculations to pass (about a minute).', 'Geben Sie das Relaxans und warten Sie, bis die Faszikulationen vorbei sind (etwa eine Minute).'),
    why: L('It softens the convulsion so that bones and joints are spared.', 'Es mildert die Krämpfe, damit Knochen und Gelenke geschont werden.'),
    says: L('Succinylcholine in; waiting for the fasciculations.', 'Succinylcholin ist drin; warte auf die Faszikulationen.') },
  { id: 'ventilate', role: 'anaesthetist', kind: 'room', modelled: false, after: ['relaxant'],
    title: L('Ventilate by bag and mask', 'Mit Beutel und Maske beatmen'),
    how: L('Ventilate, a little faster than normal, until the stimulus.', 'Beatmen Sie, etwas schneller als normal, bis zum Reiz.'),
    why: L('The patient no longer breathes; a low CO₂ also makes the seizure easier to start.', 'Der Patient atmet nicht mehr; ein niedriges CO₂ erleichtert zudem den Anfall.'),
    says: L('Ventilating. Ready for the stimulus.', 'Ich beatme. Bereit für den Reiz.') },
  { id: 'treat', role: 'psychiatrist', kind: 'device', modelled: true, after: ['ventilate', 'dose', 'impedance'],
    title: L('Give the stimulus', 'Reiz auslösen'),
    how: L('Say “stimulating”, lift the cover and hold TREAT until the tone stops.', 'Sagen Sie „Reiz“, heben Sie die Kappe und halten Sie TREAT, bis der Ton aufhört.'),
    why: L('Everyone stands clear of the patient and the bed; releasing early gives less charge.', 'Alle lassen Patient und Bett los; früheres Loslassen gibt weniger Ladung.'),
    says: L('Stimulating.', 'Reiz.') },
  { id: 'observe', role: 'nurse', kind: 'wait', modelled: true, after: ['treat'],
    title: L('Watch and time the seizure', 'Anfall beobachten und messen'),
    how: L('Watch the EEG and EMG on the strip and the cuffed arm; the anaesthetist keeps ventilating.', 'Beobachten Sie EEG und EMG auf dem Streifen und den gestauten Arm; die Anästhesie beatmet weiter.'),
    why: L('The motor seizure ends before the EEG seizure; both are recorded.', 'Der motorische Anfall endet vor dem EEG-Anfall; beide werden dokumentiert.'),
    says: L('Seizure watched and timed.', 'Anfall beobachtet und gemessen.') },
  { id: 'report', role: 'psychiatrist', kind: 'device', modelled: true, after: ['observe'],
    title: L('Print the report', 'Bericht drucken'),
    how: L('When the EEG is flat, press START/STOP: the device prints its report.', 'Wenn das EEG flach ist, drücken Sie START/STOP: Das Gerät druckt seinen Bericht.'),
    why: L('The report records the dose, the impedance and the seizure for the next treatment’s decision.', 'Der Bericht hält Dosis, Impedanz und Anfall für die Entscheidung bei der nächsten Behandlung fest.'),
    says: L('Report printed.', 'Bericht gedruckt.') },
  { id: 'recovery', role: 'anaesthetist', kind: 'room', modelled: false, after: ['observe'],
    title: L('Recover the patient', 'Patienten ausleiten'),
    how: L('Keep ventilating until breathing returns; the cuff comes down; then to recovery.', 'Beatmen Sie weiter, bis die Atmung zurückkehrt; die Manschette wird abgelassen; dann in den Aufwachraum.'),
    why: L('Breathing returns as the relaxant wears off, within minutes.', 'Die Atmung kehrt zurück, wenn das Relaxans nachlässt, binnen Minuten.'),
    says: L('Breathing again; cuff down; to recovery.', 'Atmet wieder; Manschette ab; in den Aufwachraum.') },
];
export const STEP: Record<StepId, StepDef> = Object.fromEntries(STEPS.map((s) => [s.id, s])) as Record<StepId, StepDef>;

/** a mistake the procedure noticed, at the moment it happened */
export interface ProcedureError { t: number; code: ErrorCode; step: StepId; text: LocalizedText }
export type ErrorCode = 'awake-stimulus' | 'unmodified' | 'early-stimulus' | 'no-bite-block' | 'no-impedance' | 'impedance-out' | 'wrong-dose' | 'wrong-pads'
  | 'no-leads' | 'not-ventilated' | 'awake-paralysis' | 'no-cuff' | 'cuff-low';

const ERROR_TEXT: Record<ErrorCode, LocalizedText> = {
  'awake-stimulus': L('The stimulus was given before the patient was anaesthetised.', 'Der Reiz wurde gegeben, bevor der Patient in Narkose war.'),
  unmodified: L('The stimulus was given without the relaxant: an unmodified seizure.', 'Der Reiz wurde ohne Relaxans gegeben: ein unmodifizierter Anfall.'),
  'early-stimulus': L(`The stimulus came less than ${RELAXANT_WAIT} s after the relaxant, before the fasciculations had passed.`, `Der Reiz kam weniger als ${RELAXANT_WAIT} s nach dem Relaxans, bevor die Faszikulationen vorbei waren.`),
  'no-bite-block': L('The stimulus was given without a bite block.', 'Der Reiz wurde ohne Beißschutz gegeben.'),
  'no-impedance': L('The stimulus was given without an impedance test and baseline.', 'Der Reiz wurde ohne Impedanztest und Grundlinie gegeben.'),
  'impedance-out': L('The stimulus was given with the impedance outside 100–3000 Ω.', 'Der Reiz wurde mit einer Impedanz außerhalb von 100–3000 Ω gegeben.'),
  'wrong-dose': L('The program or dose differed from the order.', 'Programm oder Dosis wichen von der Anordnung ab.'),
  'wrong-pads': L('The pads were not at the ordered placement.', 'Die Elektroden lagen nicht an der angeordneten Position.'),
  'no-leads': L('The stimulus was given without the EEG and ECG leads.', 'Der Reiz wurde ohne EEG- und EKG-Ableitungen gegeben.'),
  'not-ventilated': L('The stimulus was given while the patient was not being ventilated.', 'Der Reiz wurde gegeben, während der Patient nicht beatmet wurde.'),
  'awake-paralysis': L('The relaxant was given before the induction agent: an awake, paralysed patient.', 'Das Relaxans wurde vor dem Hypnotikum gegeben: ein wacher, gelähmter Patient.'),
  'cuff-low': L('The cuff was not above the systolic pressure when the relaxant went in: arterial blood carries it into the arm.', 'Die Manschette lag nicht über dem systolischen Druck, als das Relaxans gegeben wurde: Arterielles Blut trägt es in den Arm.'),
  'no-cuff': L('The relaxant was given before the cuff was up: the arm is relaxed too, and the motor seizure cannot be seen.', 'Das Relaxans wurde gegeben, bevor die Manschette aufgepumpt war: Auch der Arm ist relaxiert, und der motorische Anfall ist nicht zu sehen.'),
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
    L(`Placement: ${p.name.en} (${p.where.en})`, `Elektrodenlage: ${p.name.de} (${p.where.de})`),
    L(`Program ${PROGRAM_NAMES[o.program]}, ${o.percent} % energy`, `Programm ${PROGRAM_NAMES[o.program]}, ${o.percent} % Energie`),
    L('Premedication: glycopyrrolate 0.2 mg IV', 'Prämedikation: Glycopyrronium 0,2 mg i. v.'),
    o.doseNote,
  ];
}
