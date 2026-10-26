import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe, type RuntimeView } from '../engine/observe.ts';
import { buildView } from '../engine/view.ts';
import { caseWithModel, type PatientModel } from '../physiology/state.ts';
import { FREE_CASE } from '../app/free-case.ts';
import { KNOWLEDGE } from '../knowledge/index.ts';
import { signsTestLooksFor, signsFoundBy } from '../knowledge/elicited.ts';
import type { CaseDef, ExamContext } from '../model/types.ts';
import { RESP_TESTS, type RespTestId } from './resp-tests.ts';

/* ---------------------------------------------------------------------------
   The respiratory station's signs: read from the knowledge tables, never
   defined here. A sign is there when one of the station's tests finds it at
   one of its sites; each is listed with the tests and the sides that show it.
--------------------------------------------------------------------------- */

/** General inspection also finds signs of other systems; the chest station leaves out those the lungs cannot cause. */
const NOT_THE_CHEST = new Set(['jaundice']);

/** The signs the station's tests can find, in the tables' order. */
export const respSigns = (): string[] => {
  const s = new Set<string>();
  for (const t of RESP_TESTS) for (const m of t.manoeuvres) for (const x of signsTestLooksFor(KNOWLEDGE, CATALOG, m)) s.add(x);
  return Object.keys(KNOWLEDGE.signs).filter((id) => s.has(id) && !KNOWLEDGE.signs[id].normalVariant && !NOT_THE_CHEST.has(id));
};

/** The case and the view the examination reads, for a patient with this model and this running circulation and lungs. */
export function respView(model: PatientModel, snap: Record<string, any>, chemistry?: Record<string, number>): { c: CaseDef; view: RuntimeView } {
  const c = caseWithModel(FREE_CASE, model);
  /* sitting up, chest bare: the back can be examined */
  return { c, view: buildView(c, { circulation: snap, chemistry, state: { ...c.initialState, position: 'sitting', exposure: ['chest'] } }) };
}

/** One observation (`chest.percussion` at `{ site: 'chest.lung-base.R' }`), with its value, normality and the model's basis. */
export function respObserve(model: PatientModel, snap: Record<string, any>, ref: string, ctx: ExamContext = {}, chemistry?: Record<string, number>) {
  const { c, view } = respView(model, snap, chemistry);
  return observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx);
}

/** The signs of this patient, each with the tests and the sides that find it. */
export function respSignsOf(model: PatientModel, snap: Record<string, any>, chemistry?: Record<string, number>): { present: Set<string>; where: Map<string, RespTestId[]>; sides: Map<string, Set<string>> } {
  const { c, view } = respView(model, snap, chemistry);
  const obs = (ref: any, ctx: any) => observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx);
  const allowed = new Set(respSigns());
  const where = new Map<string, RespTestId[]>(), sides = new Map<string, Set<string>>();
  for (const t of RESP_TESTS) for (const m of t.manoeuvres) for (const f of signsFoundBy(KNOWLEDGE, CATALOG, obs, m).found) {
    if (!allowed.has(f.sign)) continue;
    if (!(where.get(f.sign) ?? []).includes(t.id)) where.set(f.sign, [...(where.get(f.sign) ?? []), t.id]);
    const s = sides.get(f.sign) ?? new Set<string>(); for (const x of f.sides) s.add(x); sides.set(f.sign, s);
  }
  return { present: new Set(where.keys()), where, sides };
}

/** The station's signs by the first test that looks for them, in the examination's order: how Predict and Identify offer them. */
export function respSignGroups(): Array<{ test: RespTestId; signs: string[] }> {
  const all = respSigns(), seen = new Set<string>();
  return RESP_TESTS.map((t) => {
    const looked = new Set(t.manoeuvres.flatMap((m) => signsTestLooksFor(KNOWLEDGE, CATALOG, m)));
    const signs = all.filter((x) => looked.has(x) && !seen.has(x));
    signs.forEach((x) => seen.add(x));
    return { test: t.id, signs };
  }).filter((g) => g.signs.length);
}
