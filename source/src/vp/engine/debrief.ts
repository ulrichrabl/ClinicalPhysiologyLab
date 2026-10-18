import type { DiagnosisKind, EvidenceItem, ExamContext, Finding, Side } from '../model/types.ts';
import { observeIn, type Session } from './encounter.ts';
import { KNOWLEDGE } from '../knowledge/index.ts';
import { signsFoundBy, type SignsFound } from '../knowledge/elicited.ts';
import { SignEvaluator } from '../knowledge/predicates.ts';

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
  evidence: Array<{ item: EvidenceItem; elicited: boolean; finding?: Finding; shown?: SignShown }>;
  /** Present when the learner named signs themselves (the "observe only" level). */
  documentation?: Documentation;
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

/** What one test showed, in signs: read from the findings the learner saw, as the test recorded them. */
export interface SignShown extends SignsFound { t: number; test: string; side?: Side }

/**
 * The signs each test the learner did showed (ADR-016 §10). Each test is read from its own recorded findings, so the
 * debrief judges what the learner saw then, not the patient as they are at the end.
 */
export function signsShown(s: Session): SignShown[] {
  const events = s.encounter.events, out: SignShown[] = [];
  events.forEach((e, i) => {
    if (e.kind !== 'action' || e.outcome !== 'performed') return;
    const own: Finding[] = [];
    for (let j = i + 1; j < events.length && events[j].kind !== 'action'; j++) {
      const x = events[j];
      if (x.kind === 'finding' && x.byManoeuvre === e.manoeuvre) own.push(x.finding);
    }
    const fits = (f: Finding, ctx: ExamContext) => Object.entries(ctx).every(([k, v]) => v === undefined || (f.context as Record<string, unknown>)[k] === v);
    const observe = (ref: string, ctx: ExamContext): Finding =>
      own.find((f) => f.property === ref && fits(f, ctx)) ?? own.find((f) => f.property === ref) ?? observeIn(s, ref, ctx);
    const r = signsFoundBy(KNOWLEDGE, s.catalog, observe, e.manoeuvre, e.side);
    if (r.found.length || r.normal.length || r.absent.length) out.push({ t: e.t, test: e.manoeuvre, side: e.side, ...r });
  });
  /* A result a reader looks at (the ECG) shows signs too, once it is back: read from what it recorded. */
  for (const e of events) {
    if (e.kind !== 'result' || !e.revealed || e.t > s.t) continue;
    const r = signsInResult(s, e);
    if (r.found.length || r.normal.length || r.absent.length) out.push({ t: e.t, test: e.test, ...r });
  }
  return out;
}

/** The signs a result shows, read from the observables it recorded (ADR-017). */
export function signsInResult(s: Session, e: { test: string; revealed?: Record<string, unknown> }): SignsFound {
  const observe = (ref: string, ctx: ExamContext): Finding => (e.revealed && ref in e.revealed
    ? { property: ref, context: ctx, value: e.revealed[ref], normal: false, provenance: 'model' }
    : observeIn(s, ref, ctx));
  return signsFoundBy(KNOWLEDGE, s.catalog, observe, e.test);
}

/**
 * Whether a sign that needs more than one test was shown by what the learner saw across the encounter: unidirectional
 * nystagmus needs the eyes with fixation (the eye movements) and without it (Frenzel). Only recorded findings count;
 * anything the definition needs that the learner did not see leaves it unshown.
 */
export function shownAcrossEncounter(s: Session, sign: string): boolean {
  const def = KNOWLEDGE.signs[sign]?.definition;
  if (!def) return false;
  const seen = s.encounter.events.flatMap((e) => (e.kind === 'finding' ? [e.finding] : []));
  const NOT_SEEN = new Error('not seen');
  const fits = (f: Finding, ctx: ExamContext) => Object.entries(ctx).every(([k, v]) => v === undefined || (f.context as Record<string, unknown>)[k] === v);
  const h = new SignEvaluator(s.catalog, (ref, ctx) => { const f = seen.find((x) => x.property === ref && fits(x, ctx)); if (!f) throw NOT_SEEN; return f; });
  try { return h.holds(def) === true; } catch (e) { if (e === NOT_SEEN) return false; throw e; }
}

/** Whether a sign item of the reference was met: found (on its side), or, for a pertinent negative, looked for and not found. */
export function signElicited(shown: SignShown[], item: EvidenceItem): SignShown | undefined {
  const present = item.present !== false;
  return shown.find((x) => present
    ? x.found.some((f) => f.sign === item.ref && (!item.side || !f.sides.length || f.sides.includes(item.side)))
    : x.absent.includes(item.ref) && !x.found.some((f) => f.sign === item.ref) && (!item.side || !x.side || x.side === item.side));
}

/** The signs the learner named, as they stood at the end (a later "take back" removes one). */
export function namedSigns(s: Session): Map<string, { sides: Set<Side>; byManoeuvre?: string }> {
  const out = new Map<string, { sides: Set<Side>; byManoeuvre?: string }>();
  for (const e of s.encounter.events) {
    if (e.kind !== 'sign-named') continue;
    const cur = out.get(e.sign);
    if (e.removed) {
      if (!cur) continue;
      if (e.side) cur.sides.delete(e.side);
      if (!e.side || !cur.sides.size) out.delete(e.sign);
      continue;
    }
    const x = cur ?? { sides: new Set<Side>(), byManoeuvre: e.byManoeuvre };
    if (e.side) x.sides.add(e.side);
    out.set(e.sign, x);
  }
  return out;
}

/** How the learner documented what they examined: signs named and shown, shown and not named, named and not shown. */
export interface Documentation {
  named: number;
  /** Shown by a test the learner did, and named (side right, if they gave one). */
  hits: Array<{ sign: string; sides: Side[] }>;
  /** Shown by a test the learner did, not named. Normal variants are not counted. */
  misses: Array<{ sign: string; sides: Side[]; test: string }>;
  /** Named, but no test the learner did showed it. `insteadNormal`: the test showed a normal variant there (end-point nystagmus). */
  overcalls: Array<{ sign: string; sides: Side[]; wrongSide?: boolean; insteadNormal?: string }>;
}

export function documentation(s: Session, shown: SignShown[] = signsShown(s)): Documentation {
  const named = namedSigns(s);
  const found = new Map<string, { sides: Set<Side>; test: string }>();
  for (const x of shown) for (const f of x.found) {
    const cur = found.get(f.sign) ?? { sides: new Set<Side>(), test: x.test };
    for (const sd of f.sides) cur.sides.add(sd);
    found.set(f.sign, cur);
  }
  const doc: Documentation = { named: named.size, hits: [], misses: [], overcalls: [] };
  for (const [sign, n] of named) {
    const f = found.get(sign);
    const sides = [...n.sides];
    if (!f) {
      /* Naming a pathological sign where the test showed its normal variant (end-point nystagmus) is the classic over-call. */
      const insteadNormal = shown.find((x) => x.absent.includes(sign) && x.normal.some((v) => KNOWLEDGE.signs[v]?.site === KNOWLEDGE.signs[sign]?.site))
        ?.normal.find((v) => KNOWLEDGE.signs[v]?.site === KNOWLEDGE.signs[sign]?.site);
      doc.overcalls.push({ sign, sides, ...(insteadNormal ? { insteadNormal } : {}) });
    } else if (sides.length && f.sides.size && !sides.every((sd) => f.sides.has(sd))) doc.overcalls.push({ sign, sides, wrongSide: true });
    else doc.hits.push({ sign, sides: sides.length ? sides : [...f.sides] });
  }
  for (const [sign, f] of found) {
    if (KNOWLEDGE.signs[sign]?.normalVariant) continue;
    const n = named.get(sign);
    /* Not named, or named for one side only while it was found on the other too. */
    const unnamed = n ? (n.sides.size ? [...f.sides].filter((sd) => !n.sides.has(sd)) : []) : [...f.sides];
    if (!n || unnamed.length) doc.misses.push({ sign, sides: n ? unnamed : [...f.sides], test: f.test });
  }
  return doc;
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
    evidence: (() => {
      const shown = c.reference.evidence.some((x) => x.kind === 'sign') ? signsShown(s) : [];
      return c.reference.evidence.map((item) => {
        if (item.kind === 'sign') {
          const x = signElicited(shown, item);
          const across = !x && item.present !== false && !item.side && shownAcrossEncounter(s, item.ref);
          return { item, elicited: !!x || across, shown: x };
        }
        const r = elicited(s, item.kind, item.ref, item.context);
        return { item, elicited: r.ok, finding: r.finding };
      });
    })(),
    ...(s.encounter.events.some((e) => e.kind === 'sign-named') || s.observeOnly ? { documentation: documentation(s) } : {}),
    redFlags: c.reference.redFlags.map((rf) => ({ ...rf, covered: elicited(s, rf.kind, rf.ref).ok })),
    hazards: s.encounter.events.flatMap((e) => (e.kind === 'hazard' ? [{ code: e.code, manoeuvre: e.byManoeuvre }] : [])),
    minutes: Math.round(s.t / 60000),
    budgetMinutes: c.reference.timeBudgetMinutes,
    actions: s.encounter.events.filter((e) => e.kind === 'action' && e.outcome === 'performed').length,
  };
}
