import type { Locale, LocalizedList, LocalizedText } from './i18n.ts';

/* ===========================================================================
   Virtual patient — data model.

   Five layers, each pure data (JSON-serialisable) so a future authoring
   platform can read and write them:

     1. Ontology        body structures, value types, scales, value sets
     2. Observables     what can be perceived about the body (PropertyDef):
                        typed, structured values, never sentences
     3. Manoeuvres      what a clinician can do, what each reveals, and what
                        it requires (position, instrument, consent, ability)
     4. Case            one patient: pathology that drives the models, the
                        case layer for what no model covers, history facts,
                        course over time, expert reference, diagnosis
     5. Encounter       an event-sourced record of what the learner did

   Text in any language is generated from structured values by formatters,
   and the same values drive SVG renderers. A finding is therefore written
   once and shown in every language and every visualisation.

   Code (resolvers, formatters, renderers) is referenced by id from data and
   registered separately, so data never contains functions.
=========================================================================== */

/* ---- 0. Shared ------------------------------------------------------------- */

export type Side = 'L' | 'R';

/** External terminology mappings. Filled by clinicians; never invented. */
export interface Codes {
  snomed?: string;   // SNOMED CT concept id
  loinc?: string;    // LOINC code (observations, labs, vitals)
  fma?: string;      // Foundational Model of Anatomy id
  icd10?: string;
  icd11?: string;
}

/* ---- 1. Ontology ------------------------------------------------------------ */

/** A body structure. Paired structures expand to `<id>.L` and `<id>.R`. */
export interface StructureDef {
  id: string;                       // 'eye', 'chest.2nd-right-ics', 'limb.lower'
  parent?: string;
  paired?: boolean;
  label: LocalizedText;
  synonyms?: LocalizedList;         // for the action parser
  codes?: Codes;
}

export interface ScaleDef {
  id: string;                       // 'mrc-power', 'murmur-grade', 'reflex-grade'
  min: number;
  max: number;
  labels?: Record<number, LocalizedText>;
}

/** Something the examiner holds. Manoeuvres require instruments by id. */
export interface InstrumentDef {
  id: string;                       // 'stethoscope-diaphragm', 'pen-torch', 'frenzel', 'tuning-fork-512'
  label: LocalizedText;
  synonyms?: LocalizedList;
}

export interface ValueSetDef {
  id: string;                       // 'pupil-reaction', 'gaze-direction'
  values: Array<{ code: string; label: LocalizedText; codes?: Codes }>;
}

/** The type of an observable value. UCUM units for quantities. */
export type ValueType =
  | { kind: 'quantity'; unit: string; min?: number; max?: number }
  | { kind: 'ordinal'; scale: string }
  | { kind: 'coded'; valueSet: string }
  | { kind: 'boolean' }
  | { kind: 'text' }                                  // last resort, case layer only
  | { kind: 'record'; fields: Record<string, ValueType>; optional?: string[] }
  | { kind: 'list'; of: ValueType };

/* ---- Examination context ----------------------------------------------------
   Many signs depend on how they are elicited: nystagmus on gaze and fixation,
   a murmur on position and respiration, ptosis on sustained upgaze. Values
   can therefore vary with the context of the manoeuvre. */

export type Gaze = 'primary' | 'left' | 'right' | 'up' | 'down' | 'up-left' | 'up-right' | 'down-left' | 'down-right';
export type Position = 'supine' | 'reclined-45' | 'sitting' | 'sitting-forward' | 'standing' | 'left-lateral' | 'prone' | 'head-hanging-left' | 'head-hanging-right';
export type Respiration = 'quiet' | 'inspiration' | 'expiration' | 'held-expiration' | 'valsalva';

export interface ExamContext {
  site?: string;                    // where the instrument is: 'chest.aortic-area', 'neck.carotid.R'
  gaze?: Gaze;
  fixation?: boolean;               // false behind Frenzel lenses or in darkness
  position?: Position;
  respiration?: Respiration;
  instrument?: string;              // 'stethoscope-bell', 'pen-torch', 'frenzel', ...
  lightOn?: Side | 'both' | 'none';
  ambient?: 'room' | 'dim';         // anisocoria of Horner's syndrome is larger in dim light
  eyesClosed?: boolean;             // Romberg
  coverEye?: Side | 'none';         // cover test
  headImpulseTo?: Side;             // head impulse test
  sustainedSeconds?: number;        // fatigability
  repetition?: number;
}

/** A predicate over the context: every given key must match (arrays = any of). */
export type ContextPredicate = {
  [K in keyof ExamContext]?: ExamContext[K] | Array<NonNullable<ExamContext[K]>>;
} & { not?: ContextPredicate };

/**
 * A value that can change with the examination context. Rules apply in order;
 * `merge` patches record fields, `scale` multiplies numeric fields (e.g. fixation
 * suppresses nystagmus amplitude to 30%), `replace` swaps the value.
 */
export interface Valued<T = unknown> {
  value: T;
  when?: Array<{
    if: ContextPredicate;
    mode?: 'replace' | 'merge' | 'scale';
    value?: unknown;
    factor?: number;
    fields?: string[];            // for `scale`: which numeric fields
  }>;
}

/* ---- 2. Observables -------------------------------------------------------- */

/** Where a property's value can come from. */
export type PropertySource =
  | 'model'           // only from a resolver over the runtime (circulation, neuro graph, chemistry)
  | 'case'            // only authored in the case layer
  | 'model-or-case';  // resolver if it yields a value, otherwise the case layer

/** Age/sex-dependent normal value. The first matching band wins; `value` is the default. */
export interface NormalSpec {
  value: unknown;
  /** For quantities (or numeric record fields): values inside the range count as normal. */
  range?: [number, number] | Record<string, [number, number]>;
  bands?: Array<{ minAge?: number; maxAge?: number; sex?: 'F' | 'M'; value: unknown; range?: NormalSpec['range'] }>;
}

/**
 * How an examination or test observes the models: which model variables it
 * measures, and the physics of the instrument (its errors and limits). This
 * is the bridge between the physiology layer and the clinical layers.
 */
export interface MeasurementSpec {
  measures: string[];             // physiology variable ids, 'model.variable'
  physics: LocalizedText;         // how the instrument turns the variable into a reading
}

/** Something that can be perceived about the body. */
export interface PropertyDef {
  id: string;                     // 'eye.pupil' — paired properties expand to 'eye.pupil.L'
  structure: string;              // structure id it belongs to
  paired?: boolean;
  label: LocalizedText;
  value: ValueType;
  normal: NormalSpec;
  contextDims?: Array<keyof ExamContext>;   // which context dimensions can change it
  source: PropertySource;
  resolver?: string;              // registered resolver id (source model / model-or-case)
  formatter: string;              // registered formatter id: value → text in any locale
  renderer?: string;              // registered SVG renderer id
  codes?: Codes;
  measurement?: MeasurementSpec;
}

/* ---- 3. Manoeuvres ---------------------------------------------------------- */

export type Verb =
  | 'inspect' | 'palpate' | 'percuss' | 'auscultate' | 'measure' | 'test'
  | 'ask' | 'instruct' | 'position' | 'expose' | 'order' | 'give';

export type Ability = 'follows-commands' | 'can-sit' | 'can-stand' | 'can-walk' | 'can-fixate';

export interface ManoeuvreDef {
  id: string;                     // 'test.eye.gaze-nystagmus'
  verb: Verb;
  target: string;                 // structure id
  paired?: boolean;               // performed per side
  label: LocalizedText;
  phrases: LocalizedList;         // what a learner might type, per language
  /**
   * What it reveals, each in a context. A gaze test reveals nystagmus in five
   * gaze positions. For a paired manoeuvre, `side` says which side's property
   * is revealed: the side examined (default), the other one, or both; shining
   * a light in the left eye reveals both pupils.
   */
  reveals: Array<{ property: string; context?: ExamContext; side?: 'same' | 'other' | 'both' }>;
  /** Context keys a paired manoeuvre sets to the side performed (light in the left eye, head turned left). */
  sideContext?: Array<'lightOn' | 'headImpulseTo' | 'coverEye'>;
  /** Fixed context the manoeuvre imposes (e.g. Frenzel lenses remove fixation). */
  context?: ExamContext;
  requires?: {
    instrument?: string[];        // any of
    position?: Position[];        // any of; otherwise the learner must reposition first
    exposure?: string[];          // structures to expose
    ability?: Ability[];
    consent?: 'verbal' | 'chaperone';
  };
  durationSeconds: number;
  /** Changes the patient state (repositioning, exposing). */
  sets?: Partial<PatientState>;
  /** Doing this in these states is harmful (recorded in the debrief, never blocked). */
  hazards?: Array<{ ifState: StatePredicate; code: string; why: LocalizedText }>;
  renderer?: string;
  /** Reached through a focused view (tap another site) or by typing; not listed in the region menu. */
  hidden?: boolean;
  /** Where it belongs in the examination (data/exam-structure.ts), filled in when the catalog is built. */
  section?: string;
  /** Its place in a clinician's sequence, across all sections (lower comes first). */
  order?: number;
  /** What the test is, how it is done and what it shows: built from the knowledge tables (knowledge/cards.ts). */
  teaching?: TeachingCard;
}

/* ---- How the examination is organised ----------------------------------------
   Systems in the order a clinician examines, each with sections, each listing its
   manoeuvres in the order they are done (look, feel, tap, listen). The order of
   the arrays is the order shown to the learner. */

/** Measuring a vital sign, examining, or doing something to the patient. */
export type ManoeuvreKind = 'measure' | 'examine' | 'intervene';

export interface ExamSectionDef {
  id: string;                     // 'neuro.coordination'
  label: LocalizedText;
  kind: ManoeuvreKind;
  manoeuvres: string[];           // in clinical order
  /** 'chips' lays short alternatives (positions) out in a row; 'select' offers mutually exclusive ones (oxygen devices) as a choice. */
  layout?: 'list' | 'chips' | 'select';
}

export interface ExamSystemDef {
  id: string;                     // 'neuro'
  label: LocalizedText;
  sections: ExamSectionDef[];
}

/* ---- Teaching: what a test is and what it shows ------------------------------
   Built from the knowledge tables (source/knowledge/, ADR-016): the texts of a
   test, its presentations (how signs show on it and what they mean) and the
   signs it can elicit, derived from their definitions. Nothing here is written
   by hand any more; data/catalog.ts attaches a card to every test that has one.
   A learner's progress is stored per learner, keyed by ids, and never here. */

/** How one or more signs (or a syndrome) present on a test, and what that means. */
export interface CardPresentation {
  id: string;
  tests: string[];
  signs: string[];
  /** Signs the description mentions that other tests elicit. */
  accompanying: string[];
  syndrome?: string;
  description: LocalizedText;
  meaning: LocalizedText;
  /** The conditions the knowledge links to this presentation. Shown only once a case is committed. */
  conditions: string[];
}

export interface TeachingCard {
  /** Other names, eponyms and the names used in other languages; also searched. */
  aliases?: LocalizedList;
  /** The function and pathway the test examines. */
  assesses: LocalizedText;
  /** How to do it, step by step. */
  how: LocalizedList;
  normal: LocalizedText;
  presentations: CardPresentation[];
  /** Further signs the test can elicit (from their definitions) that no presentation names. */
  alsoShows: string[];
  /** Normal findings worth naming on this test (end-point nystagmus). */
  normalVariants: string[];
  pitfalls?: LocalizedList;
  /** Reference ids from evidence/references.ts. */
  refs?: string[];
  /** An animation that shows the test, once one exists (renderer id). */
  animation?: string;
}

/* ---- Patient state (non-physiological, changes during an encounter) ------- */

export interface PatientState {
  position: Position;
  avpu: 'A' | 'V' | 'P' | 'U';
  orientation?: 'oriented' | 'confused';
  pain?: Record<string, number>;          // structure id → 0–10
  nausea?: 0 | 1 | 2 | 3;
  fatigue?: number;                        // 0–1
  cooperation?: 'full' | 'limited' | 'none';
  exposure?: string[];
  immobilised?: string[];                  // e.g. ['spine.cervical']
  abilities?: Ability[];                   // overrides derived abilities
  /** Supplemental oxygen: the device and the inspired fraction it gives. The respiratory model breathes this. */
  oxygen?: { device: string; fio2: number };
}

export type StatePredicate = Partial<{
  position: Position | Position[];
  avpu: Array<PatientState['avpu']>;
  immobilised: string;                     // contains
  minPain: { at: string; score: number };
  physiology: { key: string; below?: number; above?: number };   // e.g. MAP below 65
}>;

/* ---- 4. History ------------------------------------------------------------ */

/** A topic a learner can ask about. Topics form a tree (SOCRATES under pain, etc.). */
export interface HistoryTopicDef {
  id: string;                     // 'pc', 'cvs.chest-pain', 'pmh', 'ice.concerns'
  parent?: string;
  label: LocalizedText;
  intents: LocalizedList;         // question phrasings that map here
  /** Default answer when the case has no fact for this topic (a natural negative). */
  defaultAnswer?: LocalizedText;
}

/** One thing the patient knows, structured, with what they say in each language. */
export interface HistoryFact {
  id: string;
  topic: string;
  assertion?: {
    concept: string;              // 'chest-pain', 'syncope', 'vertigo'
    present: boolean;
    attributes?: Record<string, string | number | boolean>;   // site, character, onset, trigger…
  };
  say: LocalizedText;             // in the persona's voice
  /** Who says it: the patient (default) or the person accompanying them (collateral history). */
  speaker?: 'patient' | 'companion';
  volunteered?: boolean;          // said without being asked
  onlyIf?: StatePredicate;        // e.g. only while alert
}

/* ---- 4. Investigations ------------------------------------------------------ */

/** A test that can be ordered. Results come from a model, the case, or a normal. */
export interface InvestigationDef {
  id: string;                     // 'echo', 'ecg-12', 'glucose'
  label: LocalizedText;
  synonyms?: LocalizedList;
  value: ValueType;
  normal: NormalSpec;
  source: PropertySource;
  resolver?: string;
  formatter: string;
  turnaroundMinutes: number;      // simulated time until the result is available
  codes?: Codes;
  measurement?: MeasurementSpec;
  /** Observables the result lets a reader see (ADR-017): the ECG's tracing, read. Signs are defined on these. */
  reveals?: Array<{ property: string }>;
}

/* ---- 4. Case --------------------------------------------------------------- */

/** What a committable diagnosis is (ADR-016): a condition (a cause), or a syndrome, state or laboratory finding whose cause
    is still to be named. A syndrome or state is the syndrome of the same id in the knowledge tables. */
export type DiagnosisKind = 'condition' | 'syndrome' | 'state' | 'lab-finding';

export interface DiagnosisDef {
  id: string;
  label: LocalizedText;
  /** Default: condition. */
  kind?: DiagnosisKind;
  synonyms?: LocalizedList;
  codes?: Codes;
}

export interface EvidenceItem {
  id: string;
  /** A sign (ADR-016 §10) where one names the finding; a property where a number or a context is the point (SpO₂ on air). */
  kind: 'sign' | 'property' | 'fact' | 'investigation';
  ref: string;                    // sign id ('ptosis'), property ref ('eye.head-impulse.L'), fact id, or test id
  /** sign: the side it must be found on, when it matters. */
  side?: Side;
  /** sign: false for a pertinent negative, credited when a test that looks for it was done and did not find it. */
  present?: boolean;
  context?: ExamContext;          // the context in which it must be elicited, if any
  weight: 'essential' | 'discriminating' | 'supporting';
  discriminates?: string[];       // diagnosis ids it separates from the primary
  why: LocalizedText;
}

/**
 * The expert reference is defined by EVIDENCE, not by manoeuvres: several
 * manoeuvres can reveal the same sign, and the learner gets credit for
 * eliciting it by any of them.
 */
export interface ExpertReference {
  evidence: EvidenceItem[];
  redFlags: Array<{ ref: string; kind: 'property' | 'fact'; why: LocalizedText }>;
  timeBudgetMinutes: number;
  summary: LocalizedText;         // the expert's one-paragraph assessment
}

export interface CourseEvent {
  atMinutes: number;
  unless?: string[];              // manoeuvre/order/treatment ids that prevent it
  change: {
    physiology?: Record<string, number>;
    state?: Partial<PatientState>;
    observables?: Record<string, Valued>;
  };
  note?: LocalizedText;
}

export interface CaseDef {
  schema: 'vp.case/1';
  id: string;
  version: string;                // semver of the case content
  status: 'draft' | 'review' | 'published';
  locales: Locale[];              // languages this case is complete in
  title: LocalizedText;           // shown only after the encounter
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  authoring: { authors: string[]; reviewers: string[]; updated: string; sources: string[] };

  patient: {
    name: string;
    age: number;
    sex: 'F' | 'M';
    heightCm?: number;
    weightKg?: number;
    appearance: {
      skinTone: 1 | 2 | 3 | 4 | 5 | 6; hair: string; build: 'slim' | 'average' | 'heavy'; eyes?: 'brown' | 'hazel' | 'green' | 'blue' | 'grey';
      /** Where body fat sits, if not the usual for sex and age: central (abdominal, visceral) or peripheral (hips, thighs). */
      fat?: 'central' | 'peripheral';
      /** Muscle bulk, if reduced by chronic illness (cirrhosis, cancer, COPD, frailty). */
      muscle?: 'normal' | 'wasted';
    };
    speaks?: Locale[];            // languages the patient can be interviewed in
    /** Someone who came with the patient and can give a collateral history. */
    companion?: { name: string; relation: LocalizedText };
  };
  setting: { place: LocalizedText; triage: LocalizedText };

  /** What drives the models. Everything derivable is derived from here. */
  pathology: {
    conditions?: Array<{ id: string; params?: Record<string, unknown> }>;
    physiology?: Record<string, number>;           // circulation parameters (lesson vocabulary)
    electrical?: Record<string, number | string>;  // the heart's electrical substrate (physiology/heart/electrical.ts)
    respiratory?: Record<string, number>;          // lungs, pleura, airways, inspired gas, control of breathing (physiology/lung/respiratory.ts)
    /** The internal milieu: intake and losses, kidney, drugs, hormones, fuels, and how long the illness has acted (physiology/body/body.ts). */
    body?: Record<string, number>;
    /** Values clamped by the case for what no model yet produces (white cells, CRP, troponin). Model outputs cannot be clamped. */
    chemistry?: Record<string, number>;
    lesions?: Array<{ nodes: string[]; complete?: boolean; label?: string }>;
    /** The state the patient lived in before this illness (chronic disease, usual treatment), reached as a steady state first. */
    chronic?: { days?: number; physiology?: Record<string, number>; respiratory?: Record<string, number>; body?: Record<string, number> };
  };
  initialState: PatientState;

  /** The case layer: observables no model covers. Keyed by property ref ('skin.rash', 'eye.fundus.L'). */
  observables?: Record<string, Valued>;

  /** Investigation results no model covers. Keyed by investigation id. */
  investigations?: Record<string, Valued>;

  history: HistoryFact[];
  course?: CourseEvent[];
  reference: ExpertReference;
  diagnosis: { primary: string; accepted: string[]; differential: string[] };
}

/* ---- 5. Encounter (event-sourced) ----------------------------------------- */

export interface Finding {
  property: string;               // resolved ref, e.g. 'eye.nystagmus.spontaneous'
  context: ExamContext;
  value: unknown;                 // structured; text and pictures are generated from it
  normal: boolean;
  provenance: 'model' | 'case' | 'default-normal';
  basis?: string;                 // model quantity behind it; shown after commit
}

export type EncounterEvent =
  | { t: number; kind: 'action'; manoeuvre: string; side?: Side; context: ExamContext; outcome: 'performed' | 'blocked'; reason?: string }
  | { t: number; kind: 'finding'; finding: Finding; byManoeuvre: string }
  | { t: number; kind: 'utterance'; from: 'learner' | 'patient'; locale: Locale; text: string; topics?: string[]; facts?: string[] }
  | { t: number; kind: 'order'; test: string }
  /** `revealed`: the values of the observables the result lets a reader see (the ECG's tracing, read), as they were when it was taken. */
  | { t: number; kind: 'result'; test: string; value: unknown; detail?: Record<string, unknown>; revealed?: Record<string, unknown> }
  | { t: number; kind: 'state'; change: Partial<PatientState> }
  | { t: number; kind: 'hazard'; code: string; byManoeuvre: string }
  | { t: number; kind: 'note'; author: 'auto' | 'learner'; text: string; locale: Locale }
  | { t: number; kind: 'commit'; differential: Array<{ diagnosis: string; confidence: 'certain' | 'likely' | 'possible' }> }
  /** The learner names a sign they saw (the "observe only" level, ADR-016 §11.5), or takes a name back. */
  | { t: number; kind: 'sign-named'; sign: string; side?: Side; byManoeuvre?: string; removed?: boolean };

export interface Encounter {
  schema: 'vp.encounter/1';
  caseId: string;
  caseVersion: string;
  locale: Locale;
  guidance: 'off' | 'prompts' | 'coach' | 'walkthrough';
  startedAt: string;              // ISO wall clock
  events: EncounterEvent[];       // t = simulated milliseconds since start
}
