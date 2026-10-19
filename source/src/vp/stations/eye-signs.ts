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
  'test.frenzel', 'test.head-impulse', 'test.visual-fields', 'inspect.sclera', 'inspect.conjunctiva', 'inspect.thyroid-eyes'];

/** The signs the eye examination can find, in the tables' order. */
export const eyeSigns = (): string[] => {
  const s = new Set<string>();
  for (const m of EYE_MANOEUVRES) for (const x of signsTestLooksFor(KNOWLEDGE, CATALOG, m)) s.add(x);
  return Object.keys(KNOWLEDGE.signs).filter((id) => s.has(id) && !KNOWLEDGE.signs[id].normalVariant);
};

/** The case and the view the eye examination reads, for a patient with this model. The neurological eye needs no running
    circulation: the nervous-system graph and the vestibular loss decide what it does. The body's signs in the eye
    (bilirubin, haemoglobin, thyroid hormone) need the body run through the illness: pass its snapshot. */
export function eyeView(model: PatientModel, snap?: Record<string, any>, chemistry?: Record<string, number>): { c: CaseDef; view: RuntimeView } {
  const c = caseWithModel(FREE_CASE, model);
  return { c, view: buildView(c, snap ? { circulation: snap, chemistry } : {}) };
}

/** The eye signs of a patient with this model: each with the tests that find it on their own. */
export function eyeSignsOf(model: PatientModel, snap?: Record<string, any>, chemistry?: Record<string, number>): { present: Set<string>; where: Map<string, string[]> } {
  const { c, view } = eyeView(model, snap, chemistry);
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
export function eyeContext(model: PatientModel, snap?: Record<string, any>, chemistry?: Record<string, number>): EyeContext {
  const { c, view } = eyeView(model, snap, chemistry);
  const b = view.body as Record<string, any> | undefined;
  const o = (ref: string, ctx: ExamContext = {}) => observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx).value as any;
  const pd = (gaze: ExamContext['gaze']) => { const v = o('eyes.alignment', { gaze }); return (v?.verticalPD ?? 0) * (v?.higherEye === 'L' ? -1 : 1); };
  return {
    s: neuroExamState(view),
    verticalPD: { primary: pd('primary'), up: pd('up'), down: pd('down') },
    dark: o('eyes.nystagmus', { gaze: 'primary', fixation: false }) ?? { present: false },
    gain: { L: o('eye.head-impulse.L')?.gain ?? 1, R: o('eye.head-impulse.R')?.gain ?? 1 },
    body: b ? {
      bilirubin: b.bilirubin, conjugated: b.bilirubinConjugated, haemoglobin: b.haemoglobin, mcv: b.mcv, reticulocytes: b.reticulocytes,
      thyroidEffect: b.thyroidEffect, ft4: b.ft4, tsh: b.tsh,
      haemolysis: b.params?.haemolysis ?? 0, liverFunction: b.params?.liverFunction ?? 1, cholestasis: b.params?.cholestasis ?? 0,
      bleed: (b.params?.upperGIBleed ?? 0) + (b.params?.lowerGIBleed ?? 0), orbitopathy: b.params?.orbitopathy ?? 0,
    } : null,
    findings: { icterus: o('eyes.sclera')?.icterus ?? 'none', pallor: o('eyes.conjunctiva')?.pallor ?? 'none', thyroid: o('eyes.thyroid') ?? {} },
  };
}
