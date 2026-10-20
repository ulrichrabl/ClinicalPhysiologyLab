import type { LocalizedText } from '../model/i18n.ts';
import type { DrugId } from '../physiology/drugs/drugs.ts';

/* ===========================================================================
   Guidelines as data (ADR-018 decision 3).

   A guideline is a versioned file of rules. Each rule cites the section of
   the guideline it comes from and says whether its number is the
   guideline's own or a placement of ours (a tolerance, a definition the
   guideline does not give). A run is scored against it from what was
   recorded: the inputs, the events, every compression's onset and a trace
   of the patient. The grade is adherence, not the outcome: a learner can
   do everything right and the patient still die.
=========================================================================== */

/** Where a number comes from: the guideline's text, or a judgement of ours that the guideline does not make. */
export type Basis = 'guideline' | 'placement';

export interface Definition { value: number; unit: string; basis: Basis; means: string; note?: string }

export type Check =
  /** The first compression within `within` seconds of the collapse. */
  | { kind: 'first-compression'; within: number }
  /** A measure of the compressions (see GuidelineReport.measures) within limits. */
  | { kind: 'measure'; measure: 'fraction' | 'rate' | 'longestPause'; min?: number; max?: number }
  /** The compressions of each cycle before breaths, by their median. */
  | { kind: 'cycle'; min: number; max: number }
  /** The whole interruption for each shock: the pause before it and after it together. */
  | { kind: 'peri-shock'; max: number }
  /** Rhythm checks (a check, or a shock) at this interval, from the pads on, while CPR is needed. */
  | { kind: 'rhythm-checks'; every: number; tolerance: number; firstWithin: number }
  /** A dose of a drug after the nth shock, before the next one, while the rhythm stays shockable. */
  | { kind: 'dose-after-shock'; drug: DrugId; mg: number; afterShock: number }
  /** Repeated doses of a drug, from its first, at this interval while CPR is needed. */
  | { kind: 'dose-interval'; drug: DrugId; min: number; max: number }
  /** None of these hazards. */
  | { kind: 'no-hazard'; codes: string[] }
  /** Each breath the learner gives lasts this long, by its median. */
  | { kind: 'breath'; min: number; max: number };

export interface GuidelineRule {
  id: string;
  title: LocalizedText;
  /** Why it matters, in a sentence or two, for the debrief. */
  why: LocalizedText;
  /** The section of the guideline it comes from. */
  section: string;
  /** Whether the rule's numbers are the guideline's own or ours. */
  basis: Basis;
  /** What a placement rests on, or what in the guideline was read. */
  note?: string;
  /** Unit of the value reported (s, /min, %, mg). */
  unit?: string;
  check: Check;
}

export interface GuidelineDef {
  schema: 'vp.guideline/1';
  id: string;
  version: string;
  title: LocalizedText;
  source: { citation: string; doi?: string; url?: string; verified: 'full-text' | 'secondary' | 'unverified'; note: string };
  /** Definitions the rules share: what counts as a pause, as a pulse. */
  definitions: { pauseGap: Definition; pulseSystolic: Definition };
  rules: GuidelineRule[];
}

/* ---- a report ------------------------------------------------------------------------------------- */

export type RuleStatus = 'met' | 'missed' | 'not-applicable';

export interface RuleResult {
  id: string;
  status: RuleStatus;
  /** The value scored (seconds, a rate, a fraction in %), when there is one. */
  value?: number;
  /** Where on the clock it went wrong (s): each deviation. */
  at: number[];
}

export interface Pause { from: number; to: number; seconds: number; during: Array<'breaths' | 'shock' | 'rhythm-check' | 'none'> }

export interface GuidelineReport {
  guideline: string;
  /** The collapse (s), or null if the patient never arrested. */
  onset: number | null;
  /** The end of the run (s). */
  end: number;
  /** Periods in which CPR was needed: no rhythm that makes a pulse. */
  needCpr: Array<[number, number]>;
  measures: {
    firstCompression: number | null;
    firstShock: number | null;
    /** Share of the time CPR was needed with compressions going on (%). */
    fraction: number | null;
    /** Mean rate while compressing (/min). */
    rate: number | null;
    longestPause: number | null;
    cycles: number[];
    shocks: Array<{ t: number; before: number | null; after: number | null; outcome: string }>;
    breaths: number[];
  };
  pauses: Pause[];
  rules: RuleResult[];
}
