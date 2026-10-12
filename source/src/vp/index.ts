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
export { createCirculation, settleModel, settleCirculation } from './engine/circulation-host.ts';
export { healthyModel, modelFromCase, pathologyOf, caseWithModel, applyPreset, CIRCULATION_DEFAULTS, type PatientModel } from './physiology/state.ts';
export { MODELS, MODEL_BY_ID, VARIABLE_BY_ID, getPath, setPath } from './physiology/models.ts';
export { HeartElectrical, ELECTRICAL_DEFAULTS, ELECTRICAL_PRESETS, type ElectricalParams } from './physiology/heart/electrical.ts';
export { recordLeads, leadVectors, measuredAxis, misplaced, standardPlacement, STANDARD_SITES, LEAD_NAMES } from './measurements/ecg.ts';
export { chemistryState } from './physiology/chemistry.ts';
export { CONSTANTS, constantIssues, groundingSummary, type ConstantEntry, type ConstantStatus } from './evidence/constants.ts';
export { REFERENCES, type Reference } from './evidence/references.ts';
import './evidence/endocrine.ts';
export { Body, BODY_DEFAULTS, type BodyParams, type BodySnapshot } from './physiology/body/body.ts';
export { Respiratory, RESPIRATORY_DEFAULTS, LOBES, satO2, pulseOximeter, predicted, type RespiratoryParams, type RespSnapshot } from './physiology/lung/respiratory.ts';

import vestibularNeuritisLeft from './cases/vestibular-neuritis-left.json';
import exertionalSyncopeAs from './cases/exertional-syncope-as.json';
import acuteStrokeLeftMca from './cases/acute-stroke-left-mca.json';
import footDropRightL5 from './cases/foot-drop-right-l5.json';
import pneumoniaRll from './cases/pneumonia-right-lower-lobe.json';
import peAfterFlight from './cases/pulmonary-embolism-after-flight.json';
import copdExacerbation from './cases/copd-exacerbation.json';
import akiHyperkalaemia from './cases/aki-hyperkalaemia-triple-whammy.json';
import diabeticKetoacidosis from './cases/diabetic-ketoacidosis.json';
import hyponatraemiaThiazide from './cases/hyponatraemia-thiazide.json';
import urosepsis from './cases/urosepsis-septic-shock.json';
import ugib from './cases/upper-gi-bleed-peptic-ulcer.json';
import cirrhosis from './cases/decompensated-cirrhosis.json';
import ida from './cases/iron-deficiency-anaemia-caecal.json';
import graves from './cases/graves-thyrotoxicosis.json';
import addisonian from './cases/addisonian-crisis.json';
import hypercalcaemia from './cases/hypercalcaemia-malignancy.json';
import type { CaseDef } from './model/types.ts';

/** Cases are JSON documents; the validator, not the type system, vouches for them. */
export const CASES: CaseDef[] = [vestibularNeuritisLeft, exertionalSyncopeAs, acuteStrokeLeftMca, footDropRightL5, pneumoniaRll, peAfterFlight, copdExacerbation, akiHyperkalaemia, diabeticKetoacidosis, hyponatraemiaThiazide, urosepsis, ugib, cirrhosis, ida, graves, addisonian, hypercalcaemia] as unknown as CaseDef[];
