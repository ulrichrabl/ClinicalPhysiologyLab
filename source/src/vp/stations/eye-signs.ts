import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe, type RuntimeView } from '../engine/observe.ts';
import { buildView } from '../engine/view.ts';
import { caseWithModel, type PatientModel } from '../physiology/state.ts';
import { FREE_CASE } from '../app/free-case.ts';
import { KNOWLEDGE, SignEvaluator } from '../knowledge/index.ts';
import { signsTestLooksFor, signsFoundBy } from '../knowledge/elicited.ts';
import type { CaseDef, ExamContext } from '../model/types.ts';
import { neuroExamState } from '../models/neuro-exam.ts';
import type { EyeContext } from './eye-texts.ts';

/* ---------------------------------------------------------------------------
   The eye station's signs: read from the knowledge tables, never defined
   here. A sign is there when the whole eye examination shows it; each is
   listed with the tests that find it on their own. A few need two tests
   compared (the dilation lag of a Horner pupil: room light against dim),
   so they are there without a single test that finds them alone.
--------------------------------------------------------------------------- */

/** The eye examination: the neurological eye and the vestibular eye tests, in the catalog's order. The fundus is left
    out: no model draws it, only a case can (a known gap). */
export const EYE_MANOEUVRES = ['inspect.eyes', 'inspect.eyes.dim', 'test.pupils.light', 'test.swinging-light', 'test.eye-movements', 'test.cover',
  'test.frenzel', 'test.head-impulse', 'test.visual-fields'];

/** The signs the eye examination can find, in the tables' order. */
export const eyeSigns = (): string[] => {
  const s = new Set<string>();
  for (const m of EYE_MANOEUVRES) for (const x of signsTestLooksFor(KNOWLEDGE, CATALOG, m)) s.add(x);
  return Object.keys(KNOWLEDGE.signs).filter((id) => s.has(id) && !KNOWLEDGE.signs[id].normalVariant);
};

/** The case and the view the eye examination reads, for a patient with this model. The eyes need no running
    circulation: the nervous-system graph and the vestibular loss decide what they do. */
export function eyeView(model: PatientModel): { c: CaseDef; view: RuntimeView } {
  const c = caseWithModel(FREE_CASE, model);
  return { c, view: buildView(c, {}) };
}

/** The eye signs of a patient with this model: each with the tests that find it on their own. */
export function eyeSignsOf(model: PatientModel): { present: Set<string>; where: Map<string, string[]> } {
  const { c, view } = eyeView(model);
  const obs = (ref: any, ctx: any) => observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx);
  const where = new Map<string, string[]>();
  for (const m of EYE_MANOEUVRES) for (const f of signsFoundBy(KNOWLEDGE, CATALOG, obs, m).found) where.set(f.sign, [...(where.get(f.sign) ?? []), m]);
  /* signs that need tests compared */
  const all = new SignEvaluator(CATALOG, obs);
  for (const id of eyeSigns()) {
    if (where.has(id)) continue;
    const d = KNOWLEDGE.signs[id].definition;
    if (d && all.holds(d) === true) where.set(id, []);
  }
  return { present: new Set(where.keys()), where };
}

/** What the eye station's explanations read: the examination model's state and the few findings they quote. */
export function eyeContext(model: PatientModel): EyeContext {
  const { c, view } = eyeView(model);
  const o = (ref: string, ctx: ExamContext = {}) => observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx).value as any;
  const pd = (gaze: ExamContext['gaze']) => { const v = o('eyes.alignment', { gaze }); return (v?.verticalPD ?? 0) * (v?.higherEye === 'L' ? -1 : 1); };
  return {
    s: neuroExamState(view),
    verticalPD: { primary: pd('primary'), up: pd('up'), down: pd('down') },
    dark: o('eyes.nystagmus', { gaze: 'primary', fixation: false }) ?? { present: false },
    gain: { L: o('eye.head-impulse.L')?.gain ?? 1, R: o('eye.head-impulse.R')?.gain ?? 1 },
  };
}
