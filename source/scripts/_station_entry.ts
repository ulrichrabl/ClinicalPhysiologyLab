/** Bundle entry for the station tests (ADR-017). */
export { createCirculation } from '../src/vp/engine/circulation-host.ts';
export { healthyModel, applyPreset } from '../src/vp/physiology/state.ts';
export { recordLeads, standardPlacement } from '../src/vp/measurements/ecg.ts';
export { momentAt, segments, findPhase, PHASES } from '../src/vp/stations/ecg-timeline.ts';
export { explain, allTexts, PHASE_LABEL } from '../src/vp/stations/ecg-texts.ts';
export { ECG_STATION, stationSettings, stationPresets } from '../src/vp/stations/station.ts';
export { ELECTRICAL_PRESETS } from '../src/vp/physiology/heart/electrical.ts';
export { CATALOG } from '../src/vp/data/catalog.ts';
export { REGISTRY } from '../src/vp/registry.ts';
export { observe } from '../src/vp/engine/observe.ts';
export { buildView } from '../src/vp/engine/view.ts';
export { caseWithModel } from '../src/vp/physiology/state.ts';
export { settleModel } from '../src/vp/engine/circulation-host.ts';
export { FREE_CASE } from '../src/vp/app/free-case.ts';
export { KNOWLEDGE, SignEvaluator, testsForSign } from '../src/vp/knowledge/index.ts';
export { signsTestLooksFor } from '../src/vp/knowledge/elicited.ts';
export { syndromePresent } from '../src/vp/knowledge/coverage.ts';
export { readEcg } from '../src/vp/measurements/ecg-reading.ts';
export { misplaced } from '../src/vp/measurements/ecg.ts';
export { CASES } from '../src/vp/index.ts';
export { startEncounter, order } from '../src/vp/engine/encounter.ts';
export { signsShown, documentation, commit } from '../src/vp/engine/debrief.ts';
export { modelFromCase } from '../src/vp/physiology/state.ts';
/* the auscultation station (ADR-017 step 4) */
export { LivePatient } from '../src/vp/live/live-patient.ts';
export { AUSCULTATION_STATION } from '../src/vp/stations/station.ts';
export { AUSC_PRESETS, AUSC_PRESET_GROUPS, applyAuscPreset } from '../src/vp/stations/auscultation-presets.ts';
export { cycleAt, cycleSegments, valveEvents, meanMitralGradient, CYCLE_PHASES } from '../src/vp/stations/cardiac-cycle.ts';
export { explainCycle, allAuscTexts, CYCLE_LABEL } from '../src/vp/stations/auscultation-texts.ts';
export { REFERENCES } from '../src/vp/evidence/references.ts';
export { auscSigns, auscSignsOf, heartManoeuvres } from '../src/vp/stations/auscultation-signs.ts';
export { STATIONS } from '../src/vp/stations/station.ts';
/* the eye station */
export { EYE_STATION } from '../src/vp/stations/station.ts';
export { EYE_PRESETS, EYE_PRESET_GROUPS, EYE_STRUCTURES, EYE_LOOK_ALIKE, applyEyePreset } from '../src/vp/stations/eye-presets.ts';
export { eyeSigns, eyeSignsOf, eyeContext, eyeView, eyeSignGroups, eyeSignature, EYE_MANOEUVRES } from '../src/vp/stations/eye-signs.ts';
export { explainEye, EYE_TESTS } from '../src/vp/stations/eye-texts.ts';
export { scene, sceneFindings, pursuitTarget } from '../src/vp/render/eye-scene.ts';
export { chemistryState } from '../src/vp/physiology/chemistry.ts';
/* the pulse and neck-vein station */
export { PULSE_STATION } from '../src/vp/stations/station.ts';
export { PULSE_PRESETS, PULSE_PRESET_GROUPS, applyPulsePreset } from '../src/vp/stations/pulse-presets.ts';
export { pulseSigns, pulseSignsOf, pulseSignGroups, PULSE_MANOEUVRES } from '../src/vp/stations/pulse-signs.ts';
export { explainPulse } from '../src/vp/stations/pulse-texts.ts';
export { venousWaves, arterialWave } from '../src/domains/cardio/sim/waves.ts';
