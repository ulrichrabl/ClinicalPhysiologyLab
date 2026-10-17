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

/** `sign:ptosis`, `syndrome:horner-syndrome`, `condition:myasthenia-gravis`, `structure:eye`. */
export type EntityRef = string;
export type EntityKind = 'sign' | 'syndrome' | 'condition' | 'structure';

export interface RelationRow {
  from: EntityRef;
  rel: RelationType;
  to: EntityRef;
  /** part-of: required, supporting, or absent (a pertinent negative). */
  role?: 'required' | 'supporting' | 'absent';
  /** Where the link came from (e.g. the teaching card it was migrated from). */
  source?: string;
  /** suggests: cases with this condition that do not show the sign, and why. */
  exceptions?: Array<{ case: string; kind: 'model' | 'case'; why: string }>;
  status: RowStatus;
  refs?: string[];
  reviewedBy?: string;
}

/** One learner-facing text, in one language. */
export interface TextRow { entity: EntityRef; field: string; locale: string; text: string; status?: RowStatus }

export interface Knowledge {
  signs: Record<string, SignRow>;
  syndromes: Record<string, SyndromeRow>;
  relations: RelationRow[];
  texts: TextRow[];
}

export interface KnowledgeTables { signs: SignRow[]; syndromes: SyndromeRow[]; relations: RelationRow[]; texts: TextRow[] }
