/* Virtual patient: public surface of the data model and engine. */
export * from './model/i18n.ts';
export type * from './model/types.ts';
export { CATALOG, CATALOG_PARTS, buildCatalog, exportCatalog, type Catalog } from './data/catalog.ts';
export { REGISTRY, type Registry } from './registry.ts';
export { observe, evaluate, matches, normalFor, isNormal, parseRef, refString, type RuntimeView, type Resolver } from './engine/observe.ts';
export { buildView } from './engine/view.ts';
export { startEncounter, perform, order, observeIn, abilities, advanceCourse, type Session } from './engine/encounter.ts';
export { ask, opening, parseAction, parseOrder, interpret, matchTopics, type Interpretation } from './engine/language.ts';
export { commit, elicited, type DebriefResult, type Commit } from './engine/debrief.ts';
export { autoNote, describe } from './engine/notes.ts';
export { validateCatalog, validateCase, checkValue, type Issue } from './engine/validate.ts';
export { neuroExamState, nystagmus } from './models/neuro-exam.ts';
export { limbState } from './models/neuro-limb.ts';
export { eyeAngles, measuredSlowPhaseVelocity } from './render/eye-motion.ts';
export { figureSvg, lerpPose, POSES } from './render/patient-figure.ts';

import vestibularNeuritisLeft from './cases/vestibular-neuritis-left.json';
import exertionalSyncopeAs from './cases/exertional-syncope-as.json';
import acuteStrokeLeftMca from './cases/acute-stroke-left-mca.json';
import footDropRightL5 from './cases/foot-drop-right-l5.json';
import type { CaseDef } from './model/types.ts';

/** Cases are JSON documents; the validator, not the type system, vouches for them. */
export const CASES: CaseDef[] = [vestibularNeuritisLeft, exertionalSyncopeAs, acuteStrokeLeftMca, footDropRightL5] as unknown as CaseDef[];
