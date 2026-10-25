/* Virtual patient: public surface of the data model and engine. */
export * from './model/i18n.ts';
export type * from './model/types.ts';
export { CATALOG, CATALOG_PARTS, buildCatalog, exportCatalog, type Catalog } from './data/catalog.ts';
export { REGISTRY, type Registry } from './registry.ts';
export { observe, evaluate, matches, normalFor, isNormal, parseRef, refString, type RuntimeView, type Resolver } from './engine/observe.ts';
export { buildView } from './engine/view.ts';
export { startEncounter, perform, order, observeIn, abilities, advanceCourse, type Session } from './engine/encounter.ts';
export { ask, opening, parseAction, parseOrder, interpret, matchTopics, type Interpretation } from './engine/language.ts';
export { suggest, type Suggestion } from './engine/suggest.ts';
export { EXAM_SYSTEMS } from './data/exam-structure.ts';
export { commit, elicited, type DebriefResult, type Commit } from './engine/debrief.ts';
export { autoNote, describe } from './engine/notes.ts';
export { validateCatalog, validateCase, checkValue, type Issue } from './engine/validate.ts';
export { neuroExamState, nystagmus } from './models/neuro-exam.ts';
export { limbState } from './models/neuro-limb.ts';
export { eyeAngles, measuredSlowPhaseVelocity } from './render/eye-motion.ts';
export { figureSvg, figureLookFor, lerpPose, POSES } from './render/patient-figure.ts';
export { createCirculation, settleModel, settleCirculation } from './engine/circulation-host.ts';
export { healthyModel, modelFromCase, pathologyOf, caseWithModel, applyPreset, CIRCULATION_DEFAULTS, type PatientModel } from './physiology/state.ts';
export { MODELS, MODEL_BY_ID, VARIABLE_BY_ID, getPath, setPath } from './physiology/models.ts';
export { HeartElectrical, ELECTRICAL_DEFAULTS, ELECTRICAL_PRESETS, type ElectricalParams } from './physiology/heart/electrical.ts';
export { recordLeads, leadVectors, leadVectorsOn, measuredAxis, misplaced, standardPlacement, STANDARD_SITES, LEAD_NAMES } from './measurements/ecg.ts';
export { delineate } from './measurements/ecg-measure.ts';
export { chemistryState } from './physiology/chemistry.ts';
export { CONSTANTS, constantIssues, groundingSummary, type ConstantEntry, type ConstantStatus } from './evidence/constants.ts';
export { REFERENCES, type Reference } from './evidence/references.ts';
export {
  KNOWLEDGE, KNOWLEDGE_TABLES, buildKnowledge, labelOf, textOf, textIn, listOf, localized, localizedList, kindOf, idOf, explore, signsForCondition, syndromeSigns, testsForSign,
  conditionAncestors, conditionDescendants, SignEvaluator, NAMED, contextsFor, observablesOf,
} from './knowledge/index.ts';
export { validateKnowledge, shapeErrors } from './knowledge/validate.ts';
export { coverage, coverageSummary, signsOf, syndromePresent, representation, channelsOf, figureOnly } from './knowledge/coverage.ts';
export { exportObservables } from './knowledge/observables.ts';
export { teachingCard, signCard, signsElicitedBy, presentationConditions, type SignCard } from './knowledge/cards.ts';
export { signsFoundBy, signsOnTheFigure, type SignsFound } from './knowledge/elicited.ts';
export { withTeaching } from './data/catalog.ts';
import './evidence/endocrine.ts';
import './evidence/renal.ts';
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
import caudaEquina from './cases/cauda-equina-central-disc.json';
import guillainBarre from './cases/guillain-barre-after-diarrhoea.json';
import myasthenia from './cases/myasthenia-gravis-generalised.json';
import parkinsons from './cases/parkinsons-disease-early.json';
import b12Sacd from './cases/b12-subacute-combined-degeneration.json';
import type { CaseDef } from './model/types.ts';

/** Cases are JSON documents; the validator, not the type system, vouches for them. */
export const CASES: CaseDef[] = [vestibularNeuritisLeft, exertionalSyncopeAs, acuteStrokeLeftMca, footDropRightL5, pneumoniaRll, peAfterFlight, copdExacerbation, akiHyperkalaemia, diabeticKetoacidosis, hyponatraemiaThiazide, urosepsis, ugib, cirrhosis, ida, graves, addisonian, hypercalcaemia, caudaEquina, guillainBarre, myasthenia, parkinsons, b12Sacd] as unknown as CaseDef[];

/* Interventions and scenarios (ADR-018). */
export type * from './scenario/types.ts';
export { INTERVENTIONS, INTERVENTION_BY_ID } from './data/interventions.ts';
export { ScenarioRun, replay, TICK_S, type RunOptions } from './scenario/run.ts';
export { Chance } from './scenario/chance.ts';
export { validateInterventions, validateScenario } from './scenario/validate.ts';
import copdEdOxygen from './scenarios/copd-ed-oxygen.json';
import vestibularEdCourse from './scenarios/vestibular-ed-course.json';
import arrestPractice from './scenarios/arrest-practice.json';
import arrestPe from './scenarios/arrest-pe.json';
import arrestTension from './scenarios/arrest-tension.json';
import arrestBleeding from './scenarios/arrest-bleeding.json';
import arrestTamponade from './scenarios/arrest-tamponade.json';
import arrestHyperkalaemia from './scenarios/arrest-hyperkalaemia.json';
import arrestHypoxia from './scenarios/arrest-hypoxia.json';
import arrestOpioid from './scenarios/arrest-opioid.json';
import arrestHypothermia from './scenarios/arrest-hypothermia.json';
import arrestHypokalaemia from './scenarios/arrest-hypokalaemia.json';
import arrestLocalAnaesthetic from './scenarios/arrest-local-anaesthetic.json';
import type { ScenarioDef } from './scenario/types.ts';

/** Scenarios are JSON documents, like cases; the validator vouches for them. All drafts for now. */
export const SCENARIOS: ScenarioDef[] = [copdEdOxygen, vestibularEdCourse, arrestPractice, arrestPe, arrestTension, arrestBleeding, arrestTamponade, arrestHyperkalaemia, arrestHypoxia, arrestOpioid, arrestHypothermia, arrestHypokalaemia, arrestLocalAnaesthetic] as unknown as ScenarioDef[];

/* ADR-018 step 5: guidelines as data, and scoring a run against them */
export type * from './guidelines/types.ts';
export { scoreRun, type RunRecord } from './guidelines/score.ts';
export { validateGuideline } from './guidelines/validate.ts';
import ercAls2025 from './guidelines/erc-2025-als.json';
import type { GuidelineDef } from './guidelines/types.ts';
export const GUIDELINES: GuidelineDef[] = [ercAls2025] as unknown as GuidelineDef[];
