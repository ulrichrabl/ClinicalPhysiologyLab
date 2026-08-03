/** Public type definitions for the hybrid ECG engine (spec v0.1). */

export type BiologicalSex = 'female' | 'male' | 'unspecified';
export type Chamber = 'RA' | 'LA' | 'RV' | 'LV' | 'septum';
export type NodeState =
  | 'ready'
  | 'activated'
  | 'absolute_refractory'
  | 'relative_refractory'
  | 'recovering'
  | 'suppressed'
  | 'blocked';

export type NodeType =
  | 'sa'
  | 'atrial_focus'
  | 'av_fast'
  | 'av_slow'
  | 'his'
  | 'bundle'
  | 'fascicle'
  | 'purkinje_root'
  | 'ventricular_focus'
  | 'reentry_node'
  | 'device_electrode';

export type PathwayType =
  | 'normal'
  | 'av_nodal'
  | 'his_purkinje'
  | 'myocardial'
  | 'accessory'
  | 'reentry'
  | 'device';

export type LeadName =
  | 'I' | 'II' | 'III' | 'aVR' | 'aVL' | 'aVF'
  | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6';

export const LEADS: LeadName[] = [
  'I', 'II', 'III', 'aVR', 'aVL', 'aVF',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6',
];

export interface PatientPhenotype {
  id: string;
  seed: bigint;
  ageYears: number;
  biologicalSex: BiologicalSex;
  bodySizeIndex: number;
  heartOrientation: { azimuthDeg: number; elevationDeg: number; rotationDeg: number };
  thoraxProfileId: string;
  cardiacRegionProfileId: string; // 'dense_mesh_v1'
  leadProjectionProfileId: string;
  baselineElectricalAxisDeg: number;
  baselineAtrialMassScale: number;
  baselineLVSourceScale: number;
  baselineRVSourceScale: number;
  baselineAPDProfileId: string;
  baselineConductionProfileId: string;
}

export interface SharedPhysiology {
  timeMs: number;
  autonomic: {
    sympatheticDrive: number;
    parasympatheticDrive: number;
    catecholamineDrive: number;
  };
  respiration: { phaseRad: number; ratePerMin: number; tidalEffect: number };
  metabolism: {
    temperatureC: number;
    pH: number;
    oxygenationEffect: number;
    potassiumMmolL?: number;
    calciumMmolL?: number;
    magnesiumMmolL?: number;
    potassiumEffect: number;
    calciumEffect: number;
    magnesiumEffect: number;
    sodiumChannelAvailability: number;
  };
  mechanics: {
    leftAtrialPressure: number;
    rightAtrialPressure: number;
    leftVentricularPressure: number;
    rightVentricularPressure: number;
    leftAtrialVolume: number;
    rightAtrialVolume: number;
    leftVentricularVolume: number;
    rightVentricularVolume: number;
    pulmonaryVascularResistance: number;
    systemicVascularResistance: number;
    lvContractilityScale: number;
    rvContractilityScale: number;
  };
}

export interface ElectricalNode {
  id: string;
  type: NodeType;
  state: NodeState;
  intrinsicCycleLengthMs?: number;
  phaseMs: number;
  absoluteRefractoryMs: number;
  relativeRefractoryMs: number;
  overdriveSuppression: number;
  excitability: number;
  lastActivationMs?: number;
  nextAutomaticActivationMs?: number;
  sourceRegionIds: string[];
}

export interface ConductionEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  direction: 'forward' | 'reverse' | 'bidirectional';
  baseDelayMs: number;
  velocityScale: number;
  decremental: boolean;
  recoveryDependentDelay: number;
  minimumRecoveryForConduction: number;
  refractoryUntilMs: number;
  blockFraction: number;
  intermittentBlockPattern?: string;
  pathwayType: PathwayType;
}

export interface CardiacRegion {
  id: string;
  chamber: Chamber;
  center: [number, number, number];
  /** Outward wall normal (transmural axis). */
  orientation: [number, number, number];
  /** Local myofiber direction (unit); used for anisotropic activation. */
  fiberDir?: [number, number, number];
  electricalMass: number;
  viableFraction: number;
  scarFraction: number;
  fibrosisFraction: number;
  activationTimeMs?: number;
  repolarizationTimeMs?: number;
  localConductionScale: number;
  excitability: number;
  actionPotentialDurationMs: number;
  plateauScale: number;
  notchScale: number;
  injuryCurrent: number;
  restingPotentialShift: number;
  depolarizationKernelId: string;
  repolarizationKernelId: string;
}

export interface MechanicalTrigger {
  activationTimeMs: number;
  chamber: 'RA' | 'LA' | 'RV' | 'LV';
  activationFraction: number;
  synchrony: number;
  contractilityScale: number;
  ectopic: boolean;
  paced: boolean;
}

export interface AcquisitionConfig {
  sampleRateHz: number;
  highPassHz: number;
  lowPassHz: number;
  notchHz?: 50 | 60;
  gainMmPerMv: number;
  paperSpeedMmPerSec: number;
  baselineWander: number;
  muscleNoise: number;
  mainsNoise: number;
  motionArtifact: number;
  leadPlacementProfile: string;
  monitorMode: boolean;
}

export interface ConditionConfig {
  id: string;
  severity: number;
  expression: number;
  parameters?: Record<string, number | string | boolean>;
}

export interface SimulatorConfig {
  version: string;
  seed: string;
  patient: Partial<PatientPhenotype> & { phenotypeProfile?: string; ageYears?: number; biologicalSex?: BiologicalSex };
  conditions: ConditionConfig[];
  acquisition: Partial<AcquisitionConfig>;
}

export interface TimeRange {
  startMs: number;
  endMs: number;
}

export interface LeadSignals {
  sampleRateHz: number;
  leads: Record<LeadName, Float64Array>;
  timestampsMs: Float64Array;
}

export interface CardiacEvent {
  timeMs: number;
  type: string;
  nodeId?: string;
  regionId?: string;
  chamber?: string;
  beatOrigin?: string;
  conducted?: boolean;
  ectopic?: boolean;
  paced?: boolean;
}

export interface EcgMetrics {
  HR: number;
  PR: number;
  QRS: number;
  QT: number;
  QTc: number;
  qrsAxis: number;
  pAxis: number;
  tAxis: number;
}

export interface FindingExpectation {
  id: string;
  label: string;
  presence: 'present' | 'absent' | 'masked' | 'mimicked' | 'indeterminate';
  confidence: number;
}

export interface ExplanationRule {
  findingId: string;
  causes: string[];
}

export interface DiseaseTrajectory {
  onsetMs: number;
  riseTimeMs: number;
  plateauDurationMs?: number;
  recoveryTimeMs?: number;
  permanentResidual?: number;
}

export interface MechanismModifiers {
  left_bundle_delay_ms?: number;
  right_bundle_delay_ms?: number;
  left_anterior_fascicle_delay_ms?: number;
  left_posterior_fascicle_delay_ms?: number;
  av_node_delay_ms?: number;
  av_node_block_fraction?: number;
  sa_cycle_length_ms?: number;
  sa_exit_block_fraction?: number;
  accessory_pathway_preexcitation_fraction?: number;
  accessory_pathway_delay_ms?: number;
  rv_pressure_load?: number;
  rv_volume_load?: number;
  right_atrial_dilation?: number;
  left_atrial_dilation?: number;
  lv_hypertrophy_scale?: number;
  rv_hypertrophy_scale?: number;
  rvot_electrical_abnormality?: number;
  ischemia_severity?: number;
  ischemia_transmurality?: number;
  potassium_effect?: number;
  sodium_channel_availability?: number;
  repolarization_dispersion?: number;
  global_apd_offset_ms?: number;
  global_conduction_scale?: number;
  atrial_mass_scale?: number;
  heart_azimuth_deg?: number;
  heart_rotation_deg?: number;
  global_source_attenuation?: number;
  j_point_shift_mv?: number;
  flutter_cycle_length_ms?: number;
  af_source_activity?: number;
  vt_origin_region?: string;
  vf_activity?: number;
  pacemaker_mode?: string;
  lead_reversal?: string;
  [key: string]: number | string | boolean | undefined;
}

export interface MechanismDefinition {
  id: string;
  displayName: string;
  category: string;
  defaultSeverity: number;
  defaultExpression: number;
  modifiers: Partial<MechanismModifiers>;
  interactionTags: string[];
  validationCases: string[];
  rhythmMode?: string;
  hrOverride?: number;
  params?: Record<string, number>;
  trajectory?: DiseaseTrajectory;
  ischemiaTerritories?: Array<{ territory: string; degree: number; layer?: string; transmurality?: number }>;
  necrosisTerritories?: Array<{ territory: string; degree: number }>;
}

export interface SimulationState {
  timeMs: number;
  physiology: SharedPhysiology;
  activeMechanisms: Array<{ id: string; severity: number; expression: number }>;
  phenotype: PatientPhenotype;
  resolvedModifiers: MechanismModifiers;
}

export interface SimulatorSnapshot {
  version: string;
  seed: string;
  timeMs: number;
  state: SimulationState;
  rngState: number;
}

export interface Intervention {
  type: string;
  timeMs: number;
  payload: Record<string, unknown>;
}

export interface InterpretationReport {
  rhythm: string;
  rate: string;
  conduction: string[];
  axis: string[];
  chamberPatterns: string[];
  qrsMorphology: string[];
  stT: string[];
  infarction: string[];
  devices: string[];
  artifacts: string[];
  uncertainty: string[];
}

export interface EcgEngineOutput {
  ecgLeads: Record<LeadName, number[]>;
  ecgValue: number;
  metrics: EcgMetrics;
  events: CardiacEvent[];
  mechanicalTriggers: MechanicalTrigger[];
  interpretation: InterpretationReport;
  explanations: Array<{ finding: string; causes: string[] }>;
  qrsAxis: number;
  pathology: string;
  effectiveHR: number;
}

export const ENGINE_VERSION = '0.1.0';
export const MECHANISM_LIBRARY_VERSION = '0.1.0';
export const PHENOTYPE_LIBRARY_VERSION = '0.1.0';

export const DEFAULT_ACQUISITION: AcquisitionConfig = {
  sampleRateHz: 500,
  highPassHz: 0.05,
  lowPassHz: 150,
  gainMmPerMv: 10,
  paperSpeedMmPerSec: 25,
  baselineWander: 0,
  muscleNoise: 0,
  mainsNoise: 0,
  motionArtifact: 0,
  leadPlacementProfile: 'standard',
  monitorMode: false,
};
