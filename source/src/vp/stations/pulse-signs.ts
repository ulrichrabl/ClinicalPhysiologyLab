import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe } from '../engine/observe.ts';
import { buildView } from '../engine/view.ts';
import { caseWithModel, type PatientModel } from '../physiology/state.ts';
import { FREE_CASE } from '../app/free-case.ts';
import { KNOWLEDGE } from '../knowledge/index.ts';
import { signsTestLooksFor, signsFoundBy } from '../knowledge/elicited.ts';

/* ---------------------------------------------------------------------------
   The pulse and neck-vein station's signs: read from the knowledge tables,
   found by the standard manoeuvres (the radial and carotid pulse, the blood
   pressure, the jugular venous pressure), each in its own context.
--------------------------------------------------------------------------- */

export const PULSE_MANOEUVRES = ['palpate.pulse.radial', 'palpate.pulse.carotid', 'measure.bp', 'inspect.jvp'];

/** The signs these manoeuvres can find, in the tables' order. */
export const pulseSigns = (): string[] => {
  const s = new Set<string>();
  for (const m of PULSE_MANOEUVRES) for (const x of signsTestLooksFor(KNOWLEDGE, CATALOG, m)) s.add(x);
  return Object.keys(KNOWLEDGE.signs).filter((id) => s.has(id) && !KNOWLEDGE.signs[id].normalVariant);
};

/** The pulse and neck-vein signs of a patient with this model, whose running circulation is `snap`. */
export function pulseSignsOf(model: PatientModel, snap: Record<string, any>, chemistry?: Record<string, number>): { present: Set<string>; where: Map<string, string[]> } {
  const c = caseWithModel(FREE_CASE, model);
  const view = buildView(c, { circulation: snap, chemistry });
  const obs = (ref: any, ctx: any) => observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx);
  const where = new Map<string, string[]>();
  for (const m of PULSE_MANOEUVRES) for (const f of signsFoundBy(KNOWLEDGE, CATALOG, obs, m).found) where.set(f.sign, [...(where.get(f.sign) ?? []), m]);
  return { present: new Set(where.keys()), where };
}

/** The signs grouped by the manoeuvre that finds each first: how Predict and Identify offer them. */
export function pulseSignGroups(): Array<{ test: string; signs: string[] }> {
  const all = pulseSigns(), seen = new Set<string>();
  return ['palpate.pulse.radial', 'palpate.pulse.carotid', 'measure.bp', 'inspect.jvp'].map((test) => {
    const looked = new Set(signsTestLooksFor(KNOWLEDGE, CATALOG, test));
    const signs = all.filter((x) => looked.has(x) && !seen.has(x));
    signs.forEach((x) => seen.add(x));
    return { test, signs };
  }).filter((g) => g.signs.length);
}
