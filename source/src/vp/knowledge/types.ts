import type { ExamContext } from '../model/types.ts';

/* ===========================================================================
   Clinical knowledge (ADR-016): tests reveal observables; a sign is defined on
   observables; signs make up syndromes; signs and syndromes suggest conditions.

   Everything here is plain data loaded from source/knowledge/*.json, so a
   future editing backend can read and write it. The models never read it:
   a sign definition only reads model output, so editing knowledge cannot
   change the physiology.
=========================================================================== */

/** Comparison operators of a sign clause. `abnormal` means outside the observable's own normal. */
export type ClauseOp = 'eq' | 'ne' | 'in' | 'gt' | 'ge' | 'lt' | 'le' | 'has' | 'hasWhere' | 'abnormal';

/** One test against one observable: `eye.lid.ptosisMm ge 2` with the gaze primary. */
export interface Clause {
  obs: string;                       // observable (property) id
  path?: string;                     // field inside a record value, dotted
  op: ClauseOp;
  value?: unknown;
  /** Paired observables: any side (default), exactly one side, or both sides. */
  side?: 'any' | 'one' | 'both';
  /** The examination context the value must be observed in. A list means any of these, or as the patient is. */
  ctx?: { [K in keyof ExamContext]?: ExamContext[K] | Array<NonNullable<ExamContext[K]>> };
}

/** A pattern a threshold cannot express, written in code and named here (predicates.ts). */
export interface NamedPredicate { fn: string; args?: Record<string, unknown> }

export type SignDefinition = Clause | NamedPredicate | { all: SignDefinition[] } | { any: SignDefinition[] } | { not: SignDefinition };

/** Review status of a knowledge row. */
export type RowStatus = 'draft' | 'reviewed' | 'deprecated';

/** How far a threshold is grounded; the same statuses as the evidence registry, plus textbook standards. */
export type ThresholdStatus = 'measured' | 'derived' | 'assumed' | 'standard';

export interface SignRow {
  id: string;
  /** Body region, for grouping. */
  site: string;
  /** null: taught and linked, but no observable represents it yet. */
  definition: SignDefinition | null;
  threshold?: { text: string; status: ThresholdStatus; refs?: string[] };
  /** A normal finding worth naming (end-point nystagmus). */
  normalVariant?: boolean;
  qualifiers?: string;
  note?: string;
  /** What the model or a view cannot show yet, for a later run. */
  modelGap?: string;
  status: RowStatus;
  refs?: string[];
  reviewedBy?: string;
  replacedBy?: string;
}

export interface SyndromeRow { id: string; note?: string; status: RowStatus; refs?: string[]; reviewedBy?: string; replacedBy?: string }

export type RelationType = 'variant-of' | 'part-of' | 'suggests' | 'localises-to' | 'is-a';

/** `sign:ptosis`, `syndrome:horner-syndrome`, `condition:myasthenia-gravis`, `structure:eye`, `test:inspect.eyes`, `presentation:inspect-eyes-1`. */
export type EntityRef = string;
export type EntityKind = 'sign' | 'syndrome' | 'condition' | 'structure' | 'test' | 'presentation';

/** The teaching side of a test (manoeuvre). Its mechanics (what it reveals, what it needs) stay in the catalog; its
    texts (assesses, how.N, normal, pitfall.N, alias.N) are in the text table. */
export interface TestRow { id: string; refs?: string[]; animation?: string; status: RowStatus; reviewedBy?: string }

/**
 * How signs present on particular tests: what the examiner finds there (`description`) and what it means
 * (`meaning`), in the text table. "Dull", "bronchial breathing" and "increased vocal resonance" are three
 * presentations of consolidation. The tests that elicit a sign are derived from its definition; a presentation
 * gives the words, and for a sign without a definition it is what says which test would show it.
 */
export interface PresentationRow {
  id: string;
  tests: string[];
  signs: string[];
  /** Signs its words mention that other tests elicit ("the eye is down and out, with ptosis"): shown, not claimed. */
  accompanying?: string[];
  syndrome?: string;
  /** For a presentation that names no sign (a symptom, a pertinent negative). */
  note?: string;
  status: RowStatus;
  reviewedBy?: string;
}

export interface RelationRow {
  from: EntityRef;
  rel: RelationType;
  to: EntityRef;
  /** part-of: required, supporting, or absent (a pertinent negative). */
  role?: 'required' | 'supporting' | 'absent';
  /** Where the link came from, in words. */
  source?: string;
  /** suggests: the presentations that assert it (their cards show the condition with that finding). */
  via?: string[];
  /** suggests: cases with this condition that do not show the sign, and why. */
  exceptions?: Array<{ case: string; kind: 'model' | 'case'; why: string }>;
  status: RowStatus;
  refs?: string[];
  reviewedBy?: string;
}

/** The learner-facing texts of one entity in one language: `label`, `description`, `how.1` … A new language is new rows. */
export interface TextRow { entity: EntityRef; locale: string; fields: Record<string, string>; status?: RowStatus; reviewedBy?: string }

export interface Knowledge {
  signs: Record<string, SignRow>;
  syndromes: Record<string, SyndromeRow>;
  tests: Record<string, TestRow>;
  presentations: Record<string, PresentationRow>;
  relations: RelationRow[];
  texts: TextRow[];
}

export interface KnowledgeTables {
  signs: SignRow[]; syndromes: SyndromeRow[]; tests: TestRow[]; presentations: PresentationRow[]; relations: RelationRow[]; texts: TextRow[];
}
