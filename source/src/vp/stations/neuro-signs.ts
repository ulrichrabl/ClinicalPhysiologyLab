import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe, type RuntimeView } from '../engine/observe.ts';
import { buildView } from '../engine/view.ts';
import { caseWithModel, type PatientModel } from '../physiology/state.ts';
import { FREE_CASE } from '../app/free-case.ts';
import { KNOWLEDGE, SignEvaluator } from '../knowledge/index.ts';
import { signsTestLooksFor, signsFoundBy } from '../knowledge/elicited.ts';
import type { CaseDef, ExamContext } from '../model/types.ts';
import { NEURO_TESTS, type NeuroTest } from './neuro-tests.ts';

/* ---------------------------------------------------------------------------
   The neurological station's signs: read from the knowledge tables, never
   defined here. A sign is there when one of the station's tests finds it;
   each is listed with the tests that find it.
--------------------------------------------------------------------------- */

export type { NeuroTest } from './neuro-tests.ts';
/** The signs the station's tests can find, in the tables' order. */
export const neuroSigns = (): string[] => {
  const s = new Set<string>();
  for (const t of NEURO_TESTS) for (const m of t.manoeuvres) for (const x of signsTestLooksFor(KNOWLEDGE, CATALOG, m)) s.add(x);
  return Object.keys(KNOWLEDGE.signs).filter((id) => s.has(id) && !KNOWLEDGE.signs[id].normalVariant);
};

/** The case and the view the examination reads, for a patient with this model: the nervous-system graph decides it, no
    running circulation is needed. */
export function neuroView(model: PatientModel): { c: CaseDef; view: RuntimeView } {
  const c = caseWithModel(FREE_CASE, model);
  return { c, view: buildView(c, {}) };
}

/** One observation, by reference (`arm.drift.R`), with its value, whether it is normal and the model's basis. */
export function neuroObserve(model: PatientModel, ref: string, ctx: ExamContext = {}) {
  const { c, view } = neuroView(model);
  return observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx);
}

/** The signs of a patient with this model, each with the tests that find it and the sides it is on. */
export function neuroSignsOf(model: PatientModel): { present: Set<string>; where: Map<string, NeuroTest[]>; sides: Map<string, Set<string>> } {
  const { c, view } = neuroView(model);
  const obs = (ref: any, ctx: any) => observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx);
  const where = new Map<string, NeuroTest[]>(), sides = new Map<string, Set<string>>();
  for (const t of NEURO_TESTS) for (const m of t.manoeuvres) for (const f of signsFoundBy(KNOWLEDGE, CATALOG, obs, m).found) {
    if (!(where.get(f.sign) ?? []).includes(t.id)) where.set(f.sign, [...(where.get(f.sign) ?? []), t.id]);
    const s = sides.get(f.sign) ?? new Set<string>(); for (const x of f.sides) s.add(x); sides.set(f.sign, s);
  }
  /* signs that need tests compared (a sensory level: the trunk lost, the arm above it spared) */
  const all = new SignEvaluator(CATALOG, obs);
  for (const id of neuroSigns()) {
    if (where.has(id)) continue;
    const d = KNOWLEDGE.signs[id].definition;
    if (d && all.holds(d) === true) where.set(id, []);
  }
  return { present: new Set(where.keys()), where, sides };
}

/** The station's signs by the test that looks for them first (the most specific: a sign the general tests also see goes
    to the one that shows it best), in the station's order: how Predict and Identify offer them. */
export function neuroSignGroups(): Array<{ test: NeuroTest; signs: string[] }> {
  const PRIORITY: NeuroTest[] = ['drift', 'romberg', 'gait', 'finger-nose', 'heel-shin', 'rapid-alternating', 'arm-reflexes', 'leg-reflexes', 'sensation', 'cranial', 'speech', 'tone', 'power'];
  const all = neuroSigns(), home = new Map<string, NeuroTest>();
  for (const id of PRIORITY) {
    const t = NEURO_TESTS.find((x) => x.id === id)!;
    const looked = new Set(t.manoeuvres.flatMap((m) => signsTestLooksFor(KNOWLEDGE, CATALOG, m)));
    for (const x of all) if (looked.has(x) && !home.has(x)) home.set(x, id);
  }
  /* signs only the whole examination finds (a sensory level) go with sensation */
  for (const x of all) if (!home.has(x)) home.set(x, 'sensation');
  return NEURO_TESTS.map((t) => ({ test: t.id, signs: all.filter((x) => home.get(x) === t.id) })).filter((g) => g.signs.length);
}

/** What the examination shows, with the side of each sign: two patients with the same signature look the same. */
export function neuroSignature(r: ReturnType<typeof neuroSignsOf>): string {
  return [...r.present].sort().map((x) => `${x}:${[...(r.sides.get(x) ?? [])].sort().join('')}`).join(' ');
}
