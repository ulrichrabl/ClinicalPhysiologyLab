import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe } from '../engine/observe.ts';
import { buildView } from '../engine/view.ts';
import { caseWithModel, type PatientModel } from '../physiology/state.ts';
import { FREE_CASE } from '../app/free-case.ts';
import { KNOWLEDGE, SignEvaluator, syndromeSigns } from '../knowledge/index.ts';
import { signsTestLooksFor } from '../knowledge/elicited.ts';
import { syndromePresent } from '../knowledge/coverage.ts';

/* ---------------------------------------------------------------------------
   The ECG's signs at a station (ADR-017 step 2): read from the knowledge
   tables, never defined here. A sign is present when its definition holds
   on what the 12-lead reveals of this heart (the ECG reading); a syndrome
   when its members are.
--------------------------------------------------------------------------- */

export const ECG_TEST = 'ecg-12';

/** The signs a 12-lead can show, in the tables' order. */
export const ecgSigns = (): string[] => signsTestLooksFor(KNOWLEDGE, CATALOG, ECG_TEST);

/** The syndromes made only of ECG signs. */
export const ecgSyndromes = (): string[] => {
  const s = new Set(ecgSigns());
  return Object.keys(KNOWLEDGE.syndromes).filter((id) => { const m = syndromeSigns(KNOWLEDGE, id); return m.length > 0 && m.every((x) => s.has(x.sign)); });
};

/** The ECG signs and syndromes of a patient with this model, whose running circulation is `snap`. */
export function ecgSignsOf(model: PatientModel, snap: Record<string, any>, chemistry?: Record<string, number>): { present: Set<string>; syndromes: string[] } {
  const c = caseWithModel(FREE_CASE, model);
  const view = buildView(c, { circulation: snap, chemistry });
  const h = new SignEvaluator(CATALOG, (ref, ctx) => observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx), { test: ECG_TEST });
  const all = ecgSigns();
  const map: Record<string, boolean | undefined> = {};
  for (const id of all) map[id] = h.holds(KNOWLEDGE.signs[id].definition!);
  return { present: new Set(all.filter((id) => map[id] === true)), syndromes: ecgSyndromes().filter((y) => syndromePresent(KNOWLEDGE, y, map)) };
}
