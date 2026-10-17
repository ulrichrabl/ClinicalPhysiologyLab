import type { DiagnosisKind, EvidenceItem, ExamContext, Finding } from '../model/types.ts';
import type { Session } from './encounter.ts';

/* ---------------------------------------------------------------------------
   Debrief: the encounter compared with the expert reference.

   The reference is defined by evidence, not by manoeuvres, so a sign counts
   as elicited whichever manoeuvre revealed it, provided it was seen in the
   context the reference requires (nystagmus on looking left, the murmur at
   the aortic area). Facts count when the patient said them; investigations
   when they were ordered.
--------------------------------------------------------------------------- */

export interface Commit { diagnosis: string; confidence: 'certain' | 'likely' | 'possible' }

export interface DebriefResult {
  diagnosis: {
    primary: string; accepted: string[]; committed: Commit[];
    /** The working diagnosis is the case's cause, or an accepted condition. */
    correct: boolean;
    /** The working diagnosis is accepted but names a syndrome, state or laboratory finding: the right level, the cause still to name. */
    level?: Exclude<DiagnosisKind, 'condition'>;
    rank: number | null; differentialConsidered: string[]; differentialMissed: string[];
  };
  evidence: Array<{ item: EvidenceItem; elicited: boolean; finding?: Finding }>;
  redFlags: Array<{ ref: string; kind: 'property' | 'fact'; why: EvidenceItem['why']; covered: boolean }>;
  hazards: Array<{ code: string; manoeuvre: string }>;
  minutes: number;
  budgetMinutes: number;
  actions: number;
}

function contextMatches(want: ExamContext | undefined, have: ExamContext): boolean {
  if (!want) return true;
  return Object.entries(want).every(([k, v]) => (have as Record<string, unknown>)[k] === v);
}

export function elicited(s: Session, kind: 'property' | 'fact' | 'investigation', ref: string, context?: ExamContext): { ok: boolean; finding?: Finding } {
  for (const e of s.encounter.events) {
    if (kind === 'property' && e.kind === 'finding' && e.finding.property === ref && contextMatches(context, e.finding.context)) return { ok: true, finding: e.finding };
    if (kind === 'fact' && e.kind === 'utterance' && e.from === 'patient' && e.facts?.includes(ref)) return { ok: true };
    if (kind === 'investigation' && e.kind === 'order' && e.test === ref) return { ok: true };
  }
  return { ok: false };
}

export function commit(s: Session, differential: Commit[]): DebriefResult {
  s.encounter.events.push({ t: s.t, kind: 'commit', differential });
  const c = s.caseDef;
  const accepted = [c.diagnosis.primary, ...c.diagnosis.accepted];
  const rankIdx = differential.findIndex((d) => accepted.includes(d.diagnosis));
  const named = new Set(differential.map((d) => d.diagnosis));
  const topKind = rankIdx === 0 ? (s.catalog.diagnoses[differential[0].diagnosis]?.kind ?? 'condition') : 'condition';
  return {
    diagnosis: {
      primary: c.diagnosis.primary, accepted, committed: differential,
      correct: rankIdx === 0 && topKind === 'condition', ...(topKind !== 'condition' ? { level: topKind } : {}), rank: rankIdx >= 0 ? rankIdx + 1 : null,
      differentialConsidered: c.diagnosis.differential.filter((d) => named.has(d)),
      differentialMissed: c.diagnosis.differential.filter((d) => !named.has(d)),
    },
    evidence: c.reference.evidence.map((item) => {
      const r = elicited(s, item.kind, item.ref, item.context);
      return { item, elicited: r.ok, finding: r.finding };
    }),
    redFlags: c.reference.redFlags.map((rf) => ({ ...rf, covered: elicited(s, rf.kind, rf.ref).ok })),
    hazards: s.encounter.events.flatMap((e) => (e.kind === 'hazard' ? [{ code: e.code, manoeuvre: e.byManoeuvre }] : [])),
    minutes: Math.round(s.t / 60000),
    budgetMinutes: c.reference.timeBudgetMinutes,
    actions: s.encounter.events.filter((e) => e.kind === 'action' && e.outcome === 'performed').length,
  };
}
