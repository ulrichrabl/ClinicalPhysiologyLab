import type {
  AcquisitionConfig,
  CardiacEvent,
  ConditionConfig,
  EcgEngineOutput,
  EcgMetrics,
  Intervention,
  LeadName,
  LeadSignals,
  MechanicalTrigger,
  PatientPhenotype,
  SharedPhysiology,
  SimulationState,
  SimulatorConfig,
  SimulatorSnapshot,
  TimeRange,
} from './types/index.ts';
import {
  DEFAULT_ACQUISITION,
  ENGINE_VERSION,
  LEADS,
  MECHANISM_LIBRARY_VERSION,
  PHENOTYPE_LIBRARY_VERSION,
} from './types/index.ts';
import { SeededRng } from './rng/seeded.ts';
import { ConductionEngine } from './graph/conduction-engine.ts';
import { MechanismResolver } from './mechanisms/resolver.ts';
import { synthesizeTissueLeads, einthovenError } from './sources/tissue-synthesis.ts';
import { evalInjury } from './sources/kernels.ts';
import { LeadField } from './projection/lead-field.ts';
import { measureFeatures, interpret } from './features/measurement.ts';
import { getMechanism } from './mechanisms/registry.ts';
import { meshStats } from './regions/definitions.ts';

const INTERNAL_HZ = 1000;
const OUTPUT_HZ = 500;

export class EcgEngine {
  private rng!: SeededRng;
  private resolver = new MechanismResolver();
  private conduction!: ConductionEngine;
  private leadField!: LeadField;
  private profileIndex = 0;
  private timeMs = 0;
  private config!: SimulatorConfig;
  private physiology!: SharedPhysiology;
  private phenotype!: PatientPhenotype;
  private acquisition!: AcquisitionConfig;
  private buffers = {} as Record<LeadName, number[]>;
  private internalBuffers = {} as Record<LeadName, number[]>;
  private smoothOut = {} as Record<LeadName, number>;
  private events: CardiacEvent[] = [];
  private mechanicalTriggers: MechanicalTrigger[] = [];
  private pathologyId = 'normal';
  private lastMetrics: EcgMetrics = { HR: 72, PR: 160, QRS: 90, QT: 380, QTc: 410, qrsAxis: 60, pAxis: 45, tAxis: 50 };
  private sampleAccumulator = 0;
  private conditions: ConditionConfig[] = [];

  initialize(config: SimulatorConfig): void {
    this.config = config;
    this.rng = new SeededRng(config.seed);
    this.conditions = config.conditions?.length ? config.conditions : [{ id: 'normal', severity: 0, expression: 1 }];
    this.resolver.setConditions(this.conditions);
    this.pathologyId = this.conditions[0]?.id ?? 'normal';
    this.conduction = new ConductionEngine(this.resolver.getRegions(), this.rng);
    this.phenotype = buildPhenotype(config);
    this.profileIndex = parseInt(this.phenotype.leadProjectionProfileId.replace(/\D/g, ''), 10) || 0;
    this.rebuildLeadField();
    this.acquisition = { ...DEFAULT_ACQUISITION, ...config.acquisition };
    this.physiology = defaultPhysiology();
    this.timeMs = 0;
    this.initBufferMaps();
    this.applyRhythmAndMechanisms();
  }

  private rebuildLeadField(): void {
    this.leadField = new LeadField(this.resolver.getRegions(), {
      placementIndex: this.profileIndex,
      axisTiltDeg: (this.phenotype?.baselineElectricalAxisDeg ?? 60) - 60,
      scale: 34,
    });
  }

  private initBufferMaps(): void {
    for (const l of LEADS) {
      this.buffers[l] = [];
      this.internalBuffers[l] = [];
      this.smoothOut[l] = 0;
    }
  }

  advanceTo(timeMs: number): void {
    while (this.timeMs < timeMs) {
      const step = Math.min(2, timeMs - this.timeMs);
      this.step(step);
    }
  }

  step(durationMs: number): void {
    const dtMs = durationMs;
    this.physiology.timeMs = this.timeMs;
    const modifiers = this.resolver.resolveModifiers(this.physiology);
    this.conduction.setModifiers(modifiers);

    if (modifiers.accessory_pathway_preexcitation_fraction) {
      this.conduction.enableAccessoryPathway(
        modifiers.accessory_pathway_preexcitation_fraction,
        modifiers.accessory_pathway_delay_ms ?? 60,
      );
    }

    this.conduction.advance(dtMs);
    this.events.push(...this.conduction.state.events);
    this.mechanicalTriggers.push(...this.conduction.state.mechanicalTriggers);

    // Synthesize waveform at internal rate (1000 Hz), decimate to 500 Hz
    const steps = Math.max(1, Math.round((dtMs / 1000) * INTERNAL_HZ));
    for (let s = 0; s < steps; s++) {
      const tMs = this.timeMs + ((s + 1) / steps) * dtMs;
      this.synthesizeSample(tMs, modifiers);
    }

    this.timeMs += dtMs;
    this.updateMetrics();
  }

  applyIntervention(intervention: Intervention): void {
    if (intervention.type === 'setPathology') {
      this.setPathology(String(intervention.payload.id));
    }
    if (intervention.type === 'setParam') {
      const key = String(intervention.payload.key);
      const val = Number(intervention.payload.value);
      if (key === 'K') this.physiology.metabolism.potassiumMmolL = val;
      if (key === 'HR') this.physiology.autonomic.sympatheticDrive = val / 100;
    }
  }

  setPathology(id: string): void {
    this.pathologyId = id;
    this.resolver.setPathology(id);
    /* New conduction graph must share the synthesis clock. Previously it
       restarted at t=0 while synthesizeSample() kept using this.timeMs
       (often tens of seconds ahead) → every wavefront pulse was out of
       window → flat line for every pathology after the first. */
    this.conduction = new ConductionEngine(this.resolver.getRegions(), this.rng);
    this.conduction.jumpTo(this.timeMs);
    this.rebuildLeadField();
    this.clearBuffers();
    this.events = [];
    this.mechanicalTriggers = [];
    this.applyRhythmAndMechanisms();
  }

  updatePhysiology(partial: Partial<SharedPhysiology>): void {
    if (partial.mechanics) Object.assign(this.physiology.mechanics, partial.mechanics);
    if (partial.metabolism) Object.assign(this.physiology.metabolism, partial.metabolism);
    if (partial.autonomic) Object.assign(this.physiology.autonomic, partial.autonomic);
  }

  setPotassium(k: number): void {
    this.physiology.metabolism.potassiumMmolL = k;
    const d = (k - 4) / 4;
    this.physiology.metabolism.potassiumEffect = Math.max(0, d);
    this.physiology.metabolism.sodiumChannelAvailability = Math.max(0.3, 1 - Math.max(0, d) * 0.5);
  }

  setCalcium(ca: number): void {
    this.physiology.metabolism.calciumMmolL = ca;
    this.physiology.metabolism.calciumEffect = (ca - 2.4) * 0.55;
  }

  /** Drive sinus-cycle length from a haemodynamic HR set-point (e.g. neurogenic shock). */
  setHeartRate(hr: number): void {
    const clamped = Math.max(30, Math.min(220, hr));
    this.physiology.autonomic.sympatheticDrive = clamped / 100;
    this.conduction.setRhythm(this.conduction.getRhythmMode() || 'sinus', clamped);
    this.lastMetrics = { ...this.lastMetrics, HR: Math.round(clamped) };
  }

  snapshot(): SimulatorSnapshot {
    return {
      version: ENGINE_VERSION,
      seed: this.config.seed,
      timeMs: this.timeMs,
      state: this.getState(),
      rngState: this.rng.getState(),
    };
  }

  restore(snap: SimulatorSnapshot): void {
    this.timeMs = snap.timeMs;
    this.rng.setState(snap.rngState);
    this.physiology = snap.state.physiology;
  }

  getSignals(_range: TimeRange): LeadSignals {
    const leads = {} as Record<LeadName, Float64Array>;
    for (const l of LEADS) {
      leads[l] = Float64Array.from(this.buffers[l]);
    }
    const n = this.buffers.II.length;
    const timestampsMs = Float64Array.from({ length: n }, (_, i) => this.timeMs - (n - i) * (1000 / OUTPUT_HZ));
    return { sampleRateHz: OUTPUT_HZ, leads, timestampsMs };
  }

  getEvents(range: TimeRange): CardiacEvent[] {
    return this.events.filter((e) => e.timeMs >= range.startMs && e.timeMs <= range.endMs);
  }

  getState(): SimulationState {
    return {
      timeMs: this.timeMs,
      physiology: this.physiology,
      activeMechanisms: this.conditions.map((c) => ({ id: c.id, severity: c.severity, expression: c.expression })),
      phenotype: this.phenotype,
      resolvedModifiers: this.resolver.resolveModifiers(this.physiology),
    };
  }

  drain(): Record<LeadName, number[]> {
    const out = {} as Record<LeadName, number[]>;
    for (const l of LEADS) {
      out[l] = this.buffers[l].splice(0);
    }
    return out;
  }

  getOutput(): EcgEngineOutput {
    const leadCopy = {} as Record<LeadName, number[]>;
    for (const l of LEADS) leadCopy[l] = [...this.buffers[l]];
    return {
      ecgLeads: leadCopy,
      ecgValue: this.buffers.II.length > 0 ? this.buffers.II[this.buffers.II.length - 1] : 0,
      metrics: this.lastMetrics,
      events: this.events,
      mechanicalTriggers: this.mechanicalTriggers,
      interpretation: interpret(this.lastMetrics, Object.fromEntries(LEADS.map((l) => [l, [...this.buffers[l]]])) as Record<LeadName, number[]>),
      explanations: this.buildExplanations(),
      qrsAxis: this.lastMetrics.qrsAxis,
      pathology: this.pathologyId,
      effectiveHR: this.lastMetrics.HR,
    };
  }

  getMechanicalTriggers(): MechanicalTrigger[] {
    const t = this.mechanicalTriggers;
    this.mechanicalTriggers = [];
    return t;
  }

  reset(): void {
    this.timeMs = 0;
    this.clearBuffers();
    this.conduction.reset();
    this.events = [];
    this.mechanicalTriggers = [];
  }

  private synthesizeSample(tMs: number, modifiers: import('./types/index.ts').MechanismModifiers): void {
    const leads = synthesizeTissueLeads(
      this.conduction.state.regions,
      tMs,
      this.leadField,
      modifiers,
    );

    const rhythm = this.resolver.getPrimaryRhythm();
    /* Tiny residual only — primary f-waves come from atrial region activations. */
    let fib = 0;
    if (rhythm.mode === 'af') {
      const a = modifiers.af_source_activity ?? 1;
      fib = 0.012 * a * Math.sin(tMs * 0.053 + Math.sin(tMs * 0.009) * 2.0);
    }
    if (rhythm.mode === 'aflutter') {
      const p = ((tMs * 300 / 60000) % 1);
      fib = 0.14 * (p < 0.7 ? -p / 0.7 : (p - 0.7) / 0.3 - 1);
    }
    const st = this.territorialStShift(tMs, modifiers);
    const brug = this.brugadaPattern(tMs, modifiers);
    const delta = this.wpwDelta(tMs, modifiers);
    for (const l of LEADS) {
      let v = leads[l] + fib * (l.startsWith('V') || l === 'II' || l === 'III' || l === 'aVF' ? 1 : 0.25);
      v += st[l] ?? 0;
      v += brug[l] ?? 0;
      v += delta[l] ?? 0;
      if (modifiers.j_point_shift_mv && (l === 'V2' || l === 'V3' || l === 'V4')) {
        v += modifiers.j_point_shift_mv * 0.55;
      }
      if (modifiers.global_source_attenuation) v *= modifiers.global_source_attenuation;
      /* Soft ceiling high enough that physiologic STEMI/T aren't squared off. */
      if (Math.abs(v) > 2.6) v = Math.sign(v) * (2.6 + Math.tanh(Math.abs(v) - 2.6) * 0.35);
      this.internalBuffers[l].push(v);
    }

    this.sampleAccumulator++;
    if (this.sampleAccumulator >= INTERNAL_HZ / OUTPUT_HZ) {
      this.sampleAccumulator = 0;
      for (const l of LEADS) {
        const buf = this.internalBuffers[l];
        const avg = buf.reduce((a, c) => a + c, 0) / buf.length;
        /* Adaptive: preserve QRS edges, soften ST/T plateaus. */
        const jump = Math.abs(avg - this.smoothOut[l]);
        /* Mild coalesce of multipatch QRS; keep R peaks from washing out. */
        const a = jump > 0.06 ? 0.14 : 0.26;
        const smoothed = this.smoothOut[l] * a + avg * (1 - a);
        this.smoothOut[l] = smoothed;
        this.buffers[l].push(smoothed);
        buf.length = 0;
      }
    }
  }

  /** Lead-field correction for coarse single-dipole projection.
   *  Envelope is taken from regional injury (evalInjury) — same clock as the model. */
  private territorialStShift(
    tMs: number,
    modifiers: import('./types/index.ts').MechanismModifiers,
  ): Partial<Record<LeadName, number>> {
    const sev = (modifiers.ischemia_severity ?? 0) * (modifiers.ischemia_transmurality ?? 0.5);
    if (sev < 0.15) return {};
    let env = 0;
    let mass = 0;
    for (const r of this.conduction.state.regions.values()) {
      if (r.chamber === 'RA' || r.chamber === 'LA') continue;
      if (r.injuryCurrent === 0 || r.activationTimeMs == null) continue;
      const rep = r.repolarizationTimeMs ?? r.activationTimeMs + r.actionPotentialDurationMs;
      const w = Math.abs(evalInjury(tMs, r.activationTimeMs, rep, r.injuryCurrent))
        * r.electricalMass;
      env += w;
      mass += r.electricalMass;
    }
    if (mass < 1e-6 || env < 0.02) return {};
    const shape = Math.min(1, env / (mass * 0.55));
    /* Small residual while mesh lead-field settles — same injury clock. */
    const a = Math.min(0.16, sev * 0.12 * shape);
    const id = this.pathologyId;
    if (id === 'stemi_ant' || id === 'wellens') {
      return {
        V1: 0.08 * a, V2: 0.22 * a, V3: 0.24 * a, V4: 0.18 * a,
        I: 0.05 * a, aVL: 0.06 * a, III: -0.08 * a, aVF: -0.06 * a,
      };
    }
    if (id === 'stemi_inf') {
      return {
        II: 0.32 * a, III: 0.4 * a, aVF: 0.34 * a,
        I: -0.12 * a, aVL: -0.14 * a, V1: -0.04 * a, V2: -0.05 * a,
      };
    }
    if (id === 'stemi_lat') {
      return {
        I: 0.14 * a, aVL: 0.16 * a, V5: 0.14 * a, V6: 0.15 * a,
        V1: -0.05 * a, V2: -0.06 * a, III: -0.05 * a,
      };
    }
    if (id === 'nstemi') {
      return { V3: -0.08 * a, V4: -0.1 * a, V5: -0.09 * a, V6: -0.07 * a, II: -0.04 * a };
    }
    return {};
  }

  /** Small V1–V2 assist on top of RVOT injury dipole (coved + inverted T). */
  private brugadaPattern(
    tMs: number,
    modifiers: import('./types/index.ts').MechanismModifiers,
  ): Partial<Record<LeadName, number>> {
    const sev = modifiers.rvot_electrical_abnormality ?? 0;
    if (sev < 0.2 || this.pathologyId !== 'brugada1') return {};
    let act: number | null = null;
    let rep: number | null = null;
    let injEnv = 0;
    const parents = ['rv_outflow', 'rv_ot_anterior', 'rv_fw_basal'];
    for (const r of this.conduction.state.regions.values()) {
      if (!parents.some((p) => r.id === p || r.id.startsWith(p + '_p'))) continue;
      if (r.activationTimeMs == null) continue;
      act = act == null ? r.activationTimeMs : Math.min(act, r.activationTimeMs);
      const rr = r.repolarizationTimeMs ?? r.activationTimeMs + r.actionPotentialDurationMs;
      rep = rep == null ? rr : Math.max(rep, rr);
      injEnv = Math.max(injEnv, Math.abs(evalInjury(tMs, r.activationTimeMs, rr, r.injuryCurrent || sev)));
    }
    if (act == null || rep == null) return {};
    const j0 = act + 28;
    const j1 = act + 150;
    const tEnd = Math.min(rep + 50, act + 340);
    let st = 0, tw = 0;
    if (tMs >= j0 && tMs <= j1) {
      const u = (tMs - j0) / (j1 - j0);
      st = sev * 0.32 * (1 - 0.5 * u) * (0.55 + 0.45 * Math.min(1, injEnv + 0.3));
    }
    if (tMs > j1 && tMs < tEnd) {
      const u = (tMs - j1) / Math.max(1, tEnd - j1);
      tw = -sev * 0.12 * Math.sin(Math.PI * Math.min(1, u));
    }
    const v = st + tw;
    return { V1: v * 1.0, V2: v * 1.3, V3: v * 0.4 };
  }

  /** Light delta assist — pre-excitation itself comes from early vent tree. */
  private wpwDelta(
    tMs: number,
    modifiers: import('./types/index.ts').MechanismModifiers,
  ): Partial<Record<LeadName, number>> {
    const frac = modifiers.accessory_pathway_preexcitation_fraction ?? 0;
    if (frac < 0.2) return {};
    let earliest: number | null = null;
    for (const r of this.conduction.state.regions.values()) {
      if (r.chamber === 'RA' || r.chamber === 'LA') continue;
      if (r.activationTimeMs == null) continue;
      earliest = earliest == null ? r.activationTimeMs : Math.min(earliest, r.activationTimeMs);
    }
    if (earliest == null) return {};
    const u = (tMs - earliest) / 60;
    if (u < -0.1 || u > 1) return {};
    const slur = frac * 0.18 * Math.sin(Math.PI * Math.max(0, Math.min(1, u + 0.08)));
    return {
      V1: slur * 1.2, V2: slur * 0.85, V3: slur * 0.45,
      I: slur * 0.35, V5: slur * 0.4, V6: slur * 0.45,
    };
  }

  private applyRhythmAndMechanisms(): void {
    const rhythm = this.resolver.getPrimaryRhythm();
    this.conduction.setRhythm(rhythm.mode, rhythm.hrOverride);
    const m = getMechanism(this.pathologyId);
    if (m?.hrOverride) {
      this.conduction.setRhythm(rhythm.mode, m.hrOverride);
    }
  }

  private updateMetrics(): void {
    if (this.buffers.II.length > OUTPUT_HZ * 0.5) {
      const m = measureFeatures(
        Object.fromEntries(LEADS.map((l) => [l, this.buffers[l].slice(-OUTPUT_HZ * 2)])) as Record<LeadName, number[]>,
        OUTPUT_HZ,
      );
      /* For sinus-family rhythms the SA clock is ground truth; waveform peak
         counting misreads STEMI plateaus and multiphasic BBB as tachycardia. */
      const mode = this.conduction.getRhythmMode();
      if (mode === 'sinus' || mode === 'wenckebach' || mode === 'mobitz2') {
        m.HR = Math.round(60000 / Math.max(300, this.conduction.getCycleMs()));
      }
      const mods = this.resolver.resolveModifiers(this.physiology);
      if ((mods.accessory_pathway_preexcitation_fraction ?? 0) > 0.3) {
        /* Teaching short PR — fusion onset is earlier than lead-II P pick. */
        m.PR = Math.min(m.PR, 110);
        m.QRS = Math.max(m.QRS, 110);
      } else if (mode === 'sinus' && m.PR > 220) {
        /* Tall multipatch P/QRS can fool the P picker; SA–His timing is ~120–180. */
        m.PR = 160;
      }
      /* Bundle delay staggers LV/RV on the mesh; lead II under-reads width. */
      const bundle = Math.max(mods.left_bundle_delay_ms ?? 0, mods.right_bundle_delay_ms ?? 0);
      if (bundle >= 40) {
        m.QRS = Math.max(m.QRS, Math.round(105 + bundle * 0.45));
      } else if (mode === 'sinus' && m.QRS > 110) {
        m.QRS = Math.min(m.QRS, 100);
      }
      this.lastMetrics = m;
    }
  }

  private buildExplanations(): Array<{ finding: string; causes: string[] }> {
    const m = getMechanism(this.pathologyId);
    if (!m) return [];
    return m.interactionTags.map((tag) => ({
      finding: m.displayName,
      causes: [`Active mechanism: ${tag}`, ...Object.keys(m.modifiers).map((k) => `${k} modified`)],
    }));
  }

  private clearBuffers(): void {
    for (const l of LEADS) {
      this.buffers[l] = [];
      this.internalBuffers[l] = [];
      this.smoothOut[l] = 0;
    }
    this.sampleAccumulator = 0;
  }

  /** Validation: Einthoven law before acquisition noise. */
  validateInvariants(): { einthovenMaxError: number; meshPatches: number } {
    const regions = this.conduction.state.regions;
    const r = [...regions.values()][20];
    if (r) { r.activationTimeMs = 500; r.repolarizationTimeMs = 780; }
    const leads = synthesizeTissueLeads(regions, 520, this.leadField, {});
    return { einthovenMaxError: einthovenError(leads), meshPatches: meshStats().total };
  }
}

function buildPhenotype(config: SimulatorConfig): PatientPhenotype {
  const p = config.patient;
  return {
    id: p.phenotypeProfile ?? 'adult_profile_017',
    seed: BigInt(config.seed),
    ageYears: p.ageYears ?? 58,
    biologicalSex: p.biologicalSex ?? 'unspecified',
    bodySizeIndex: 1,
    heartOrientation: { azimuthDeg: 40, elevationDeg: 0, rotationDeg: 0 },
    thoraxProfileId: 'standard',
    cardiacRegionProfileId: 'dense_mesh_v1',
    leadProjectionProfileId: p.phenotypeProfile ?? 'profile_017',
    baselineElectricalAxisDeg: 60,
    baselineAtrialMassScale: 1,
    baselineLVSourceScale: 1,
    baselineRVSourceScale: 1,
    baselineAPDProfileId: 'adult_normal',
    baselineConductionProfileId: 'adult_normal',
  };
}

function defaultPhysiology(): SharedPhysiology {
  return {
    timeMs: 0,
    autonomic: { sympatheticDrive: 0.5, parasympatheticDrive: 0.5, catecholamineDrive: 0 },
    respiration: { phaseRad: 0, ratePerMin: 14, tidalEffect: 0.05 },
    metabolism: {
      temperatureC: 37,
      pH: 7.4,
      oxygenationEffect: 0,
      potassiumMmolL: 4,
      calciumMmolL: 2.4,
      potassiumEffect: 0,
      calciumEffect: 0,
      magnesiumEffect: 0,
      sodiumChannelAvailability: 1,
    },
    mechanics: {
      leftAtrialPressure: 8,
      rightAtrialPressure: 4,
      leftVentricularPressure: 120,
      rightVentricularPressure: 25,
      leftAtrialVolume: 60,
      rightAtrialVolume: 50,
      leftVentricularVolume: 120,
      rightVentricularVolume: 130,
      pulmonaryVascularResistance: 0.075,
      systemicVascularResistance: 1.05,
      lvContractilityScale: 1,
      rvContractilityScale: 1,
    },
  };
}

export { ENGINE_VERSION, MECHANISM_LIBRARY_VERSION, PHENOTYPE_LIBRARY_VERSION };
export { catalogEntries, MECHANISM_REGISTRY, getMechanism } from './mechanisms/registry.ts';
export type { SimulatorConfig, EcgEngineOutput, MechanicalTrigger };
