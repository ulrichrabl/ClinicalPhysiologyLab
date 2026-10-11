import type {
  Ability, CaseDef, Encounter, EncounterEvent, ExamContext, Finding, ManoeuvreDef, PatientState, Side, StatePredicate, Valued,
} from '../model/types.ts';
import type { Catalog } from '../data/catalog.ts';
import type { Registry } from '../registry.ts';
import type { Locale } from '../model/i18n.ts';
import { observe, type RuntimeView } from './observe.ts';

/* ---------------------------------------------------------------------------
   Encounter engine.

   Performs manoeuvres on a patient and records everything as events: the
   action (performed or blocked, and why), each finding, state changes, and
   hazards. The event log is the encounter; notes, the debrief and scoring
   are all derived from it.

   Preconditions follow the clinic: the JVP is assessed at 45°, a Romberg
   needs the patient standing, auscultation needs the chest exposed. A
   blocked action says what is missing in clinical terms, never what the
   finding would have been. Hazards (standing a hypotensive patient, a head
   impulse on an uncleared neck) are recorded for the debrief, never blocked.
--------------------------------------------------------------------------- */

export interface Session {
  catalog: Catalog;
  registry: Registry;
  caseDef: CaseDef;
  view: RuntimeView;
  state: PatientState;
  /** Simulated milliseconds since the start. */
  t: number;
  encounter: Encounter;
  /** Case-layer changes applied by the course so far. */
  overlay: Record<string, Valued>;
  appliedCourse: Set<number>;
  done: Set<string>;
}

export function startEncounter(
  catalog: Catalog, registry: Registry, caseDef: CaseDef, view: RuntimeView,
  opts: { locale?: Locale; guidance?: Encounter['guidance']; startedAt?: string } = {},
): Session {
  const state: PatientState = JSON.parse(JSON.stringify(caseDef.initialState));
  view.state = state;
  return {
    catalog, registry, caseDef, view, state, t: 0, overlay: {}, appliedCourse: new Set(), done: new Set(),
    encounter: {
      schema: 'vp.encounter/1', caseId: caseDef.id, caseVersion: caseDef.version,
      locale: opts.locale ?? 'en', guidance: opts.guidance ?? 'off',
      startedAt: opts.startedAt ?? new Date(0).toISOString(), events: [],
    },
  };
}

const push = (s: Session, e: EncounterEvent) => { s.encounter.events.push(e); };

/** Abilities follow from the patient's state unless the case states them. */
export function abilities(state: PatientState): Ability[] {
  if (state.abilities) return state.abilities;
  if (state.avpu !== 'A') return [];
  const out: Ability[] = ['can-fixate', 'can-sit', 'can-stand', 'can-walk'];
  if (state.orientation !== 'confused' && state.cooperation !== 'none') out.push('follows-commands');
  if (state.immobilised?.length) return out.filter((a) => a === 'follows-commands' || a === 'can-fixate');
  return out;
}

export function statePredicateHolds(p: StatePredicate, state: PatientState, view: RuntimeView): boolean {
  if (p.position && !(Array.isArray(p.position) ? p.position : [p.position]).includes(state.position)) return false;
  if (p.avpu && !p.avpu.includes(state.avpu)) return false;
  if (p.immobilised && !(state.immobilised ?? []).includes(p.immobilised)) return false;
  if (p.minPain && (state.pain?.[p.minPain.at] ?? 0) < p.minPain.score) return false;
  if (p.physiology) {
    const m = view.circulation?.metrics ?? view.circulation ?? {};
    const x = m[p.physiology.key];
    if (typeof x !== 'number') return false;
    if (p.physiology.below != null && !(x < p.physiology.below)) return false;
    if (p.physiology.above != null && !(x > p.physiology.above)) return false;
  }
  return true;
}

/** Apply course events that are due. Returns the notes of those applied. */
export function advanceCourse(s: Session): void {
  (s.caseDef.course ?? []).forEach((ev, i) => {
    if (s.appliedCourse.has(i) || ev.atMinutes * 60000 > s.t) return;
    s.appliedCourse.add(i);
    if (ev.unless?.some((id) => s.done.has(id))) return;
    if (ev.change.state) { Object.assign(s.state, ev.change.state); push(s, { t: s.t, kind: 'state', change: ev.change.state }); }
    if (ev.change.observables) Object.assign(s.overlay, ev.change.observables);
  });
}

export interface PerformResult {
  outcome: 'performed' | 'blocked';
  reason?: string;
  findings: Finding[];
}

/** Observe one property ref in a context, with the course overlay applied. */
export function observeIn(s: Session, ref: string, ctx: ExamContext): Finding {
  const caseDef = Object.keys(s.overlay).length ? { ...s.caseDef, observables: { ...s.caseDef.observables, ...s.overlay } } : s.caseDef;
  return observe(s.catalog, s.registry.resolvers, caseDef, s.view, ref, ctx);
}

export function perform(s: Session, manoeuvreId: string, side?: Side, extra: ExamContext = {}): PerformResult {
  const m: ManoeuvreDef | undefined = s.catalog.manoeuvres[manoeuvreId];
  if (!m) throw new Error(`unknown manoeuvre ${manoeuvreId}`);
  if (m.paired && !side) throw new Error(`manoeuvre ${manoeuvreId} is performed on a side`);
  advanceCourse(s);

  const baseCtx: ExamContext = { position: s.state.position, ...m.context, ...extra };
  for (const k of m.sideContext ?? []) (baseCtx as Record<string, unknown>)[k] = side;
  if (m.paired && baseCtx.site && s.catalog.structures[baseCtx.site]?.paired) baseCtx.site = `${baseCtx.site}.${side}`;

  const block = (reason: string): PerformResult => {
    push(s, { t: s.t, kind: 'action', manoeuvre: m.id, side, context: baseCtx, outcome: 'blocked', reason });
    return { outcome: 'blocked', reason, findings: [] };
  };
  const req = m.requires ?? {};
  if (req.position && !req.position.includes(s.state.position)) return block(`position:${req.position.join('|')}`);
  const missingExposure = (req.exposure ?? []).filter((x) => !(s.state.exposure ?? []).includes(x));
  if (missingExposure.length) return block(`exposure:${missingExposure.join('|')}`);
  const can = abilities(s.state);
  const missingAbility = (req.ability ?? []).filter((a) => !can.includes(a));
  if (missingAbility.length) return block(`ability:${missingAbility.join('|')}`);
  if (extra.instrument && req.instrument && !req.instrument.includes(extra.instrument)) return block(`instrument:${req.instrument.join('|')}`);

  push(s, { t: s.t, kind: 'action', manoeuvre: m.id, side, context: baseCtx, outcome: 'performed' });
  for (const h of m.hazards ?? []) {
    if (statePredicateHolds(h.ifState, s.state, s.view)) push(s, { t: s.t, kind: 'hazard', code: h.code, byManoeuvre: m.id });
  }
  if (req.consent && !s.encounter.events.some((e) => e.kind === 'utterance' && e.topics?.includes('consent'))) {
    push(s, { t: s.t, kind: 'hazard', code: 'no-consent', byManoeuvre: m.id });
  }

  if (m.sets) {
    const change: Partial<PatientState> = { ...m.sets };
    if (m.sets.exposure) change.exposure = [...new Set([...(s.state.exposure ?? []), ...m.sets.exposure])];
    Object.assign(s.state, change);
    push(s, { t: s.t, kind: 'state', change });
  }

  const findings: Finding[] = [];
  for (const r of m.reveals) {
    const def = s.catalog.properties[r.property];
    const ctx: ExamContext = { ...baseCtx, ...r.context };
    if (r.context?.site && m.paired && s.catalog.structures[r.context.site]?.paired) ctx.site = `${r.context.site}.${side}`;
    const sides: Array<Side | undefined> = !def.paired ? [undefined]
      : (r.side ?? (m.paired ? 'same' : 'both')) === 'both' ? ['L', 'R']
      : r.side === 'other' ? [side === 'L' ? 'R' : 'L'] : [side];
    for (const sd of sides) {
      const f = observeIn(s, sd ? `${r.property}.${sd}` : r.property, ctx);
      findings.push(f);
      push(s, { t: s.t, kind: 'finding', finding: f, byManoeuvre: m.id });
    }
  }
  s.t += m.durationSeconds * 1000;
  s.done.add(m.id);
  return { outcome: 'performed', findings };
}

/**
 * Order an investigation. The result event is stamped when it will be available.
 * A test the learner performs (an ECG they record themselves) is available at once,
 * and may carry how it was done (`detail`, e.g. the electrode placement) and what the
 * measurement itself changed (`patch`, e.g. the axis the misplaced leads report).
 */
export function order(s: Session, investigationId: string, opts: { performed?: boolean; detail?: Record<string, unknown>; patch?: (v: any) => any } = {}): void {
  const inv = s.catalog.investigations[investigationId];
  if (!inv) throw new Error(`unknown investigation ${investigationId}`);
  push(s, { t: s.t, kind: 'order', test: inv.id });
  const fromModel = inv.source !== 'case' && inv.resolver ? s.registry.resolvers[inv.resolver]?.(s.view, { property: inv.id }, {}) : undefined;
  const authored = inv.source !== 'model' ? s.caseDef.investigations?.[inv.id] : undefined;
  let value = fromModel?.value ?? authored?.value ?? inv.normal.value;
  if (opts.patch) value = opts.patch(structuredClone(value));
  push(s, { t: s.t + (opts.performed ? 0 : inv.turnaroundMinutes * 60000), kind: 'result', test: inv.id, value, ...(opts.detail ? { detail: opts.detail } : {}) });
  s.done.add(inv.id);
}
