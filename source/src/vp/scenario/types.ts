import type { LocalizedList, LocalizedText } from '../model/i18n.ts';
import type { Ability, PatientState, Position, Side } from '../model/types.ts';
import type { AirwayRoute } from '../physiology/lung/ventilation.ts';
import type { DrugId } from '../physiology/drugs/drugs.ts';

/* ===========================================================================
   Interventions and scenarios (ADR-018).

   An intervention acts on the running model; a scenario wraps a case in a
   scene. Neither writes a finding: the monitor, the examination and the
   results show what the model now does.

   Time is the scenario's clock, in ticks of 0.1 s (the interval at which the
   circulation, lungs and body are coupled). Everything the learner does is
   an input on that clock; everything else (the scene, the course, chance)
   follows from the inputs and one seed, so a run replays exactly.
=========================================================================== */

/** A value written into the running model: a parameter of the circulation, the lungs or the heart's electrical model. */
export interface ModelWrite { path: string; set?: number | string; add?: number }

/** Held while it lasts: a device on the patient, later compressions and ventilations (ADR-018 decision 1). */
export interface ContinuousEffect {
  kind: 'continuous';
  /** What it holds. One intervention per slot at a time: a new one in the same slot replaces the old. */
  slot: string;
  /** Model inputs held at these values while the intervention lasts; released, they return to what they were. */
  inputs: Record<string, number | string>;
  /** The patient's state while held (the device on the face), restored on release. */
  state?: Partial<PatientState>;
  /** Whether it keeps the hands of whoever holds it busy (compressions do; an oxygen mask does not). */
  handsWhileHeld?: boolean;
  /** A time-varying input the run drives while held: chest compressions (the learner's taps, or a team member's steady rate). */
  driver?: 'compressions' | 'ventilation';
}

/** Done once: a shock, IV access, a dose of a drug. */
export interface InstantEffect {
  kind: 'instantaneous';
  change?: ModelWrite[];
  /** What it makes possible for later interventions ('iv'). */
  grants?: string[];
  /** The airway the patient now has: a supraglottic airway or a tube (breaths given go through it). */
  airway?: AirwayRoute;
  /** The defibrillator (ADR-018 step 3): charge it, or deliver the charged shock. */
  defib?: 'charge' | 'shock';
  /** A look at the patient that is recorded with what it showed (ADR-018 step 5): the rhythm on the defibrillator (and the
      pulse with an organised rhythm), his breathing with the airway opened, what is in his mouth. */
  assess?: 'rhythm' | 'breathing' | 'mouth';
  /** The airway cleared of what blocks it (suction, Magill forceps). */
  clearAirway?: boolean;
  /** Someone goes for equipment and comes back with it (ADR-018 step 5): the arrest trolley. */
  fetch?: { equipment: string[]; seconds: number };
  /** A dose into the vein (ADR-018 step 4); the drug model carries it in and lets it act. */
  dose?: { drug: DrugId; mg: number };
  state?: Partial<PatientState>;
}

export type InterventionEffect = ContinuousEffect | InstantEffect;

export interface InterventionDef {
  id: string;
  label: LocalizedText;
  phrases?: LocalizedList;
  /** What it needs: equipment in the room, access already gained, what the patient can do. */
  needs?: { equipment?: string[]; access?: string[]; ability?: Ability[]; /** the patient lying so (compressions need him flat) */ position?: Position[] };
  /** How long the hands are busy before it takes effect: fixed, or drawn from the run's seeded chance. */
  duration: { seconds: number } | { min: number; max: number };
  /** Where the time comes from. A placement is a judgement to be checked against observed times (rule 1). */
  timing: { status: 'measured' | 'placement'; note: string };
  effect: InterventionEffect;
}

/* ---- the scene ---------------------------------------------------------------------------------- */

export interface ScenePerson { id: string; role: LocalizedText; present: boolean }
export interface SceneEquipment { id: string; label: LocalizedText; present: boolean }

/** When the scene moves on. Values are read from the running model, as the examination reads them. */
export type SceneWhen =
  | { did: string }                     // an intervention completed, or a manoeuvre or order performed
  | { holding: string }                 // a continuous slot is held now
  | { inStateFor: number }              // seconds in the current scene state
  | { at: number }                      // seconds on the scenario clock
  | { value: { of: string; below?: number; above?: number } }   // 'circulation.Pmean', 'resp.SaO2'
  | { all: SceneWhen[] }
  | { any: SceneWhen[] };

export type SceneDo =
  | { say: { who: string; text: LocalizedText } }
  /** A scripted change to the patient's model: the event the scene is built around (the heart fibrillates). */
  | { change: ModelWrite[] }
  /** People who leave the room (to fetch something, to call for help); `arrive` brings them back. */
  | { leave: { people: string[] } }
  | { arrive: { people?: string[]; equipment?: string[]; afterSeconds: number } };

export interface SceneState {
  label: LocalizedText;
  enter?: SceneDo[];
  next?: Array<{ when: SceneWhen; to: string }>;
  /** The scene is over. */
  final?: boolean;
}

/** The teaching nudges the run knows how to apply (ADR-018 decision 6c). */
export const NUDGE_IDS = ['refractory-vf', 'vf-returns', 'rosc-for-good-cpr', 'gasping', 'bolus'] as const;
export type NudgeId = typeof NUDGE_IDS[number];

/** Reversible causes of cardiac arrest (ERC 2025 ALS: hypoxia, hypovolaemia, hypo-/hyperkalaemia and other metabolic
    causes, hypothermia; thrombosis (coronary or pulmonary), tension pneumothorax, tamponade, toxins). Only those a scenario
    uses are listed. */
export const ARREST_CAUSES = ['pulmonary-embolism'] as const;
export type ArrestCause = (typeof ARREST_CAUSES)[number];

export interface ScenarioDef {
  schema: 'vp.scenario/1';
  id: string;
  version: string;
  status: 'draft' | 'review' | 'published';
  title: LocalizedText;
  /** The case whose patient this is; its own course runs underneath. */
  caseId: string;
  /** For authors: what the scenario is for. */
  purpose: string;
  scene: {
    place: LocalizedText; people: ScenePerson[]; equipment: SceneEquipment[];
    /** Who comes when the arrest team is called (ADR-018 step 5, decision 8), what they bring, and when: a call that
        does not say where delays them. */
    team?: { people: string[]; equipment: string[]; afterSeconds: number; lateWithoutWhere: number; callSeconds: number };
    /** Something in the airway (a teaching variant, drawn from the seed with this chance): no breath given reaches the lungs
        until it is cleared. */
    airway?: { obstruction: 'bolus'; chance: number };
    /** The reversible cause of an arrest in this scene, as the guideline names its causes (the 4 Hs and 4 Ts): rules that
        apply to one cause only (thrombolysis for pulmonary embolism) read it. Absent: a primary cardiac arrest. */
    cause?: ArrestCause;
  };
  /** What the debrief reveals about the arrest's cause when the learner did not choose it (a surprise or pure chance). */
  reveal?: { label: LocalizedText; explain: LocalizedText };
  /** The parts that are not physiology: who arrives, what is said, when the scene moves on. */
  machine: { start: string; states: Record<string, SceneState> };
  /** Teaching nudges (ADR-018 decision 6c): set-ups a practice run may carry, each fixing one chance draw so the run
      teaches one thing. Chosen at the start (or by "surprise me"), recorded with the run, stated in the debrief; never in
      assessment, never in the runs that validate the model. */
  nudges?: Array<{ id: NudgeId; label: LocalizedText; explain: LocalizedText }>;
}

/* ---- what a run records ------------------------------------------------------------------------- */

/** An input: everything the learner does. The seed and these replay a run (ADR-018 decision 5). t in seconds. */
export type ScenarioInput =
  | { t: number; do: 'intervene'; id: string; by: string }
  | { t: number; do: 'release'; slot: string; by: string }
  | { t: number; do: 'examine'; manoeuvre: string; side?: Side; by: string }
  | { t: number; do: 'order'; test: string; by: string }
  /** One chest compression, tapped: `at` is when it began (seconds, at or after t, within the tick it was given in). */
  | { t: number; do: 'compress'; at: number; by: string }
  /** One breath given by whoever holds the ventilation: when it began, and how long the bag was squeezed (s). */
  | { t: number; do: 'ventilate'; at: number; seconds: number; by: string }
  /** The bag squeezed by hand and let go (the learner's press and release): the breath lasts as long as it is held. */
  | { t: number; do: 'bag'; phase: 'squeeze' | 'release'; at: number; by: string }
  /** The arrest team called by whoever is free (ADR-018 step 5), saying what the call says. */
  | { t: number; do: 'call'; says: CallContent[]; by: string }
  /** A task given to someone (ADR-018 decision 8): compressions, the airway, the defibrillator, the drugs. */
  | { t: number; do: 'assign'; role: TeamRole; to: string };

/** What a call for the arrest team says: where, that it is a cardiac arrest, that the defibrillator is needed. */
export type CallContent = 'where' | 'arrest' | 'defibrillator';
/** The tasks of a resuscitation team (ERC 2025: task allocation). */
export type TeamRole = 'compressions' | 'airway' | 'defibrillator' | 'drugs';
export const TEAM_ROLES: TeamRole[] = ['compressions', 'airway', 'defibrillator', 'drugs'];

/** What followed from the inputs, the scene, the course and chance. Reproduced exactly by a replay. */
export type ScenarioEvent =
  | { t: number; kind: 'scene'; state: string }
  | { t: number; kind: 'say'; who: string; text: LocalizedText }
  | { t: number; kind: 'arrive'; people: string[]; equipment: string[] }
  | { t: number; kind: 'leave'; people: string[] }
  | { t: number; kind: 'begin'; id: string; by: string; until: number }
  | { t: number; kind: 'done'; id: string; by: string }
  | { t: number; kind: 'release'; slot: string; by: string; id: string }
  | { t: number; kind: 'blocked'; id: string; by: string; reason: string }
  | { t: number; kind: 'examined'; manoeuvre: string; by: string; until: number }
  | { t: number; kind: 'ordered'; test: string; by: string }
  | { t: number; kind: 'course'; index: number; prevented: boolean; note?: LocalizedText }
  | { t: number; kind: 'chance'; stream: string; value: number; use: string }
  /** The run was set up with this teaching nudge (ADR-018 decision 6c). */
  | { t: number; kind: 'nudge'; id: NudgeId }
  /** A shock delivered (ADR-018 step 3): the rhythm it met, and what followed. */
  | { t: number; kind: 'shock'; by: string; rhythm: string; outcome: 'not-terminated' | 'organised' | 'asystole' | 'no-effect'; joules: number }
  /** Something done that is unsafe or against the rules (a shock with hands on the patient, a shock of a rhythm that is not
      shockable), recorded for the debrief and never blocked, as in the encounter. */
  | { t: number; kind: 'hazard'; code: string; by: string }
  /** A held squeeze let go: how long it lasted and the volume it sent towards the lungs (L). */
  | { t: number; kind: 'breath'; by: string; seconds: number; volume: number; /** whether any of it reached the lungs (the chest rose) */ rise?: boolean }
  /** The arrest team called: what was said, and when they will come. */
  | { t: number; kind: 'call'; by: string; says: CallContent[]; arriveAt: number }
  /** A task given to someone (or taken from them: to null). */
  | { t: number; kind: 'assigned'; role: TeamRole; to: string | null }
  /** A rhythm check (ADR-018 step 5): the rhythm it showed. */
  | { t: number; kind: 'assessed'; what: 'rhythm' | 'breathing' | 'mouth'; by: string; rhythm?: string; pulse?: boolean; breathing?: 'normal' | 'failing' | 'gasping' | 'none'; mouth?: 'clear' | 'bolus' }
  /** Something in his airway (drawn at the start), or taken out of it (`what` null). */
  | { t: number; kind: 'obstruction'; what: string | null; by?: string }
  /** A dose given into the vein (ADR-018 step 4). */
  | { t: number; kind: 'dose'; drug: DrugId; mg: number; by: string }
  /** Ventricular fibrillation comes back after a shock had ended it. */
  | { t: number; kind: 'refibrillation'; from: string };
