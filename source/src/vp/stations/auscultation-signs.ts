import { CATALOG } from '../data/catalog.ts';
import { REGISTRY } from '../registry.ts';
import { observe } from '../engine/observe.ts';
import { buildView } from '../engine/view.ts';
import { caseWithModel, type PatientModel } from '../physiology/state.ts';
import { FREE_CASE } from '../app/free-case.ts';
import { KNOWLEDGE } from '../knowledge/index.ts';
import { signsTestLooksFor, signsFoundBy } from '../knowledge/elicited.ts';

/* ---------------------------------------------------------------------------
   The heart sounds' signs at the auscultation station (ADR-017 step 4): read
   from the knowledge tables, never defined here. A sign is there when one of
   the standard cardiac auscultation manoeuvres finds it, each in its own
   context (site, bell or diaphragm, position, breathing): a mitral rumble is
   found with the bell at the apex, the patient on the left side; an aortic
   regurgitation murmur at the left sternal edge, sitting forward.
--------------------------------------------------------------------------- */

/** The cardiac auscultation manoeuvres, in the catalog's order. */
export const heartManoeuvres = (): string[] => Object.keys(CATALOG.manoeuvres).filter((id) => id.startsWith('auscultate.heart.'));

/** The signs a stethoscope on the heart can find, in the tables' order. */
export const auscSigns = (): string[] => {
  const s = new Set<string>();
  for (const m of heartManoeuvres()) for (const x of signsTestLooksFor(KNOWLEDGE, CATALOG, m)) s.add(x);
  return Object.keys(KNOWLEDGE.signs).filter((id) => s.has(id));
};

/** The heart-sound signs of a patient with this model, whose running circulation is `snap`: each with the manoeuvres
    that find it. */
export function auscSignsOf(model: PatientModel, snap: Record<string, any>, chemistry?: Record<string, number>): { present: Set<string>; where: Map<string, string[]> } {
  const c = caseWithModel(FREE_CASE, model);
  const view = buildView(c, { circulation: snap, chemistry });
  const obs = (ref: any, ctx: any) => observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx);
  const where = new Map<string, string[]>();
  for (const m of heartManoeuvres()) for (const f of signsFoundBy(KNOWLEDGE, CATALOG, obs, m).found) where.set(f.sign, [...(where.get(f.sign) ?? []), m]);
  return { present: new Set(where.keys()), where };
}
