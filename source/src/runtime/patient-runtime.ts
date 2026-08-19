import type {
  AdvanceResult,
  CardioPrivateParams,
  CheckpointRef,
  ObservationRequest,
  ObservationResult,
  ObserveOutcome,
  PublicPhysiologyView,
  QueryResult,
  RestoreResult,
  RuntimeBranch,
  RuntimeCapabilities,
  RuntimeFingerprint,
  RuntimeListener,
  RuntimeListenerEvent,
  RuntimeQuery,
  TimelineEntry,
  Unsubscribe,
  VitalSignsValue,
} from '../contracts/queries.ts';
import type {
  ActivateConditionPayload,
  ChannelsSyncPayload,
  ChemistrySetPayload,
  ChemistryUnpinPayload,
  CirculationParamPayload,
  CommandResult,
  FluidBolusPayload,
  ModelBaroPayload,
  ModelPathologyPayload,
  PatientCommand,
  ResolveConditionPayload,
  ScenarioLoadPayload,
  VasopressorPayload,
} from '../contracts/commands.ts';
import type {
  CompiledScenario,
  ScenarioAuthority,
  ScenarioLoadResult,
} from '../contracts/scenarios.ts';
import type { SerializedModelState } from '../contracts/model-plugin.ts';
import type { RuntimeSession } from '../contracts/session.ts';
import { clinicalSession, systemSession } from '../contracts/session.ts';
import { getScenario, listScenarios } from '../scenarios/index.ts';
import {
  compileScenario,
  materialiseSeedCommands,
} from '../scenarios/compiler.ts';
import {
  ScenarioTriggerRunner,
  type SerializedTriggerRunner,
} from '../scenarios/triggers.ts';
import type { PatientRuntime } from '../contracts/index.ts';
import type { PhysiologicalEffect } from '../contracts/effects.ts';
import type { CommandId, SimDuration, SimTime } from '../contracts/brands.ts';
import {
  asSimDuration,
  asSimTime,
  createCommandId,
  RuntimeIdFactory,
  type RuntimeIdSnapshot,
} from '../contracts/brands.ts';
import { runtimeError } from '../contracts/errors.ts';
import {
  authorizeCommand,
  authorizeObservation,
  authorizeQuery,
} from '../contracts/authority.ts';
import {
  CONDITION_REGISTRY,
  getCondition,
  type ConditionInstance,
} from '../conditions/cervical-spinal-cord-injury.ts';
import { composeEffects } from '../physiology/composition/compose.ts';
import { PHYSIOLOGICAL_PORTS } from '../physiology/ports/registry.ts';
import {
  adaptCardioPrivateParams,
  CIRCULATION_BASELINE,
  applyCardioAdapterToHost,
} from '../models/cardiovascular/current-model-adapter.ts';
import { buildNeurogenicShockExplanation } from '../explanations/causal-trace.ts';
import {
  resolveChannelMechanisms,
  activeChannelDisplays,
  type ChannelState,
} from '../physiology/mechanisms/channel-mechanisms.ts';
import {
  NEUROGENIC_DISPLAY,
  lesionInterruptsSympathetic,
} from '../physiology/mechanisms/neurogenic-shock.ts';
import {
  snapshotToCardiovascularPublic,
  snapshotToElectrophysiologyPublic,
  cardiovascularToChannelProjection,
  EMPTY_CARDIOVASCULAR_PUBLIC,
  EMPTY_ELECTROPHYSIOLOGY_PUBLIC,
  type CardiovascularPublicState,
  type ElectrophysiologyPublicState,
} from '../models/cardiovascular/public-state.ts';
import {
  CIRCULATION_MODEL_MANIFEST,
  ELECTROPHYSIOLOGY_MODEL_MANIFEST,
} from '../models/cardiovascular/manifest.ts';
import { vitalSignsObservation } from '../observations/vitals.ts';
import { twelveLeadEcgObservation } from '../observations/ecg.ts';
import { laboratoryPanelObservation } from '../observations/laboratory.ts';
import type { PatientStateProjection } from '../observations/types.ts';
import {
  CHEMISTRY_DEFAULTS,
  chemistryToLabBag,
  labBagToChemistryPatch,
  type ChemistryPublicState,
} from '../models/chemistry/public-state.ts';
import { deriveChemistryFromHaemodynamics } from '../models/chemistry/derive-from-haemodynamics.ts';
import { CHEMISTRY_MODEL_MANIFEST } from '../models/chemistry/manifest.ts';
import type { ChemistryDerivation } from '../models/chemistry/derive-from-haemodynamics.ts';

const RUNTIME_VERSION = '0.1.0';

const DEFAULT_CHANNELS: ChannelState = {
  K: 4.0,
  Ca: 2.4,
  ICP: 10,
  MAP: 95,
  CPP: 85,
  betaBlocker: 0,
  atropine: 0,
  vasopressor: 0,
};

/** Learner / lesson circulation knobs that may be set via experimental command. */
const EXPERIMENTAL_CIRCULATION_KEYS = new Set([
  'bloodVolume',
  'Rsys',
  'HR',
  'V0sv',
  'Emax',
  'Csa',
  'Csv',
  'Rpul',
  'K',
  'baroEnabled',
  'stFactor',
  'Emin',
  'Rven',
  'Cpa',
  'Cpv',
]);

export interface PatientRuntimeOptions {
  seed?: string;
  scenario?: { id: string; version: string };
  /** Optional live circulation host (worker / in-page). */
  cardioHost?: { postMessage: (m: unknown) => void } | null;
  cardioDefaults?: Record<string, number | boolean>;
  /** Headless settle function for tests — receives private params, returns snapshot. */
  settlePhysiology?: (
    params: ReturnType<typeof adaptCardioPrivateParams> & {
      bloodVolume?: number;
      [key: string]: number | boolean | string[] | undefined;
    },
    seconds: number,
  ) => Record<string, number> | null;
  /** Optional headless model state export/restore for checkpoint fidelity. */
  exportModelState?: () => SerializedModelState | null;
  restoreModelState?: (state: SerializedModelState) => void;
  /** Optional channel projection writer (updates Patient.cordLevel etc.). */
  projectChannels?: (patch: Record<string, unknown>) => void;
  authority?: {
    mayAuthorConditions?: boolean;
    mayUseExperimentalControls?: boolean;
    mayReadLatentState?: boolean;
    mayAdvanceTime?: boolean;
  };
}

interface PendingAdvance {
  requestId: string;
  durationMs: number;
  from: SimTime;
  resolve: (result: AdvanceResult) => void;
  reject: (err: Error) => void;
}

interface CheckpointSnapshot {
  id: string;
  label?: string;
  createdAt: SimTime;
  revision: number;
  simTime: SimTime;
  conditions: ConditionInstance[];
  commandLog: PatientCommand[];
  lastSnap: Record<string, number> | null;
  randomState: number;
  /** @deprecated prefer idSnapshot */
  idSeq: number;
  idSnapshot: RuntimeIdSnapshot;
  channels: ChannelState;
  chemistry: ChemistryPublicState;
  chemistryPins: string[];
  chemistryBaseline: ChemistryPublicState;
  activeChemistryDerivations: ChemistryDerivation[];
  cardiovascular: CardiovascularPublicState;
  electrophysiology: ElectrophysiologyPublicState;
  learnerBloodVolume: number;
  experimentalControls: Record<string, number | boolean>;
  scenarioId: string | null;
  scenarioVersion: string | null;
  scenarioAuthority: ScenarioAuthority | null;
  scenarioAnnotations: { id: string; label: string; detail?: unknown; atMs: number }[];
  triggerState: SerializedTriggerRunner | null;
  fingerprintScenario: { id: string; version: string };
  models: Record<string, SerializedModelState>;
  timeline: TimelineEntry[];
  lastModelTimeSec: number | null;
  playing: boolean;
  /** Internal transactional markers are not timeline-visible when true. */
  silent?: boolean;
}

export class DefaultPatientRuntime implements PatientRuntime {
  readonly fingerprint: RuntimeFingerprint;
  /** Instance-local ID namespaces. */
  readonly ids: RuntimeIdFactory;
  private simTime: SimTime = asSimTime(0);
  private revision = 0;
  private playing = false;
  private conditions = new Map<string, ConditionInstance>();
  private commandLog: PatientCommand[] = [];
  private timeline: TimelineEntry[] = [];
  private listeners = new Set<RuntimeListener>();
  private checkpoints = new Map<string, CheckpointSnapshot>();
  private lastSnap: Record<string, number> | null = null;
  private prevCardioDriven = new Set<string>();
  private randomState: number;
  private readonly opts: PatientRuntimeOptions;
  private channels: ChannelState = { ...DEFAULT_CHANNELS };
  private cardiovascular: CardiovascularPublicState = { ...EMPTY_CARDIOVASCULAR_PUBLIC };
  private electrophysiology: ElectrophysiologyPublicState = { ...EMPTY_ELECTROPHYSIOLOGY_PUBLIC };
  private chemistry: ChemistryPublicState = { ...CHEMISTRY_DEFAULTS };
  private chemistryPins = new Set<string>();
  private chemistryBaseline: ChemistryPublicState = { ...CHEMISTRY_DEFAULTS };
  private activeChemistryDerivations: ChemistryDerivation[] = [];
  private compiledScenario: CompiledScenario | null = null;
  private scenarioAuthority: ScenarioAuthority | null = null;
  private triggerRunner: ScenarioTriggerRunner | null = null;
  private scenarioAnnotations: { id: string; label: string; detail?: unknown; atMs: number }[] = [];
  private learnerBloodVolume = 5000;
  private experimentalControls: Record<string, number | boolean> = {};
  private lastModelTimeSec: number | null = null;
  private pendingAdvances = new Map<string, PendingAdvance>();
  /** Cached private model states keyed by model id (filled on checkpoint / host export). */
  private modelStates: Record<string, SerializedModelState> = {};
  private hostEpoch = 0;

  constructor(opts: PatientRuntimeOptions = {}) {
    this.opts = opts;
    this.randomState = hashSeed(opts.seed ?? 'cpl-default-seed');
    this.ids = new RuntimeIdFactory(this.randomState.toString(36));
    this.fingerprint = {
      runtimeVersion: RUNTIME_VERSION,
      scenario: opts.scenario ?? { id: 'ad-hoc', version: '0.0.0' },
      models: [
        {
          id: CIRCULATION_MODEL_MANIFEST.id,
          version: CIRCULATION_MODEL_MANIFEST.version,
          stateSchemaVersion: CIRCULATION_MODEL_MANIFEST.stateSchemaVersion,
          configurationHash: 'baseline-rsys-1.05',
        },
        {
          id: ELECTROPHYSIOLOGY_MODEL_MANIFEST.id,
          version: ELECTROPHYSIOLOGY_MODEL_MANIFEST.version,
          stateSchemaVersion: ELECTROPHYSIOLOGY_MODEL_MANIFEST.stateSchemaVersion,
          configurationHash: 'hybrid-ecg-v0.1',
        },
        {
          id: CHEMISTRY_MODEL_MANIFEST.id,
          version: CHEMISTRY_MODEL_MANIFEST.version,
          stateSchemaVersion: CHEMISTRY_MODEL_MANIFEST.stateSchemaVersion,
          configurationHash: 'chemistry-educational-v1',
        },
      ],
      seed: opts.seed ?? 'cpl-default-seed',
    };
  }

  /* ---- public API ----------------------------------------------------- */

  allocateCommandId(prefix = 'cmd'): CommandId {
    return this.ids.command(prefix);
  }

  dispatch(command: PatientCommand, session?: RuntimeSession): CommandResult {
    if (command.expectedRevision != null && command.expectedRevision !== this.revision) {
      return this.reject(command, runtimeError(
        'COMMAND_CONFLICT',
        `expected revision ${command.expectedRevision}, current is ${this.revision}`,
      ));
    }

    const authErr = authorizeCommand(command, this.authorityContext(session));
    if (authErr) return this.reject(command, authErr);

    switch (command.type) {
      case 'condition.activate':
        return this.activateCondition(command);
      case 'condition.resolve':
        return this.resolveCondition(command);
      case 'runtime.advance': {
        const ms = Number((command.payload as { durationMs?: number })?.durationMs ?? 0);
        if (!Number.isFinite(ms) || ms < 0) {
          return this.reject(command, runtimeError('INVALID_PARAMETER', 'durationMs must be ≥ 0', {
            path: 'payload.durationMs',
            received: ms,
          }));
        }
        // Fire-and-forget from command path; prefer await runtime.advance() for correlated results.
        void this.advance(asSimDuration(ms));
        return this.accept(command, { changedPaths: ['runtime.time'] });
      }
      case 'runtime.pause':
        this.pause();
        return this.accept(command);
      case 'runtime.resume':
        this.play();
        return this.accept(command);
      case 'runtime.reset':
        this.resetAll();
        return this.accept(command, { changedPaths: ['*'] });
      case 'chemistry.set':
        return this.chemistrySet(command);
      case 'chemistry.unpin':
        return this.chemistryUnpin(command);
      case 'chemistry.reset':
        this.resetChemistry();
        this.recomputeCardio();
        return this.accept(command, { changedPaths: ['chemistry.*'] });
      case 'experimental.circulation-param':
        return this.experimentalCirculationParam(command);
      case 'model.set-pathology':
        return this.modelSetPathology(command);
      case 'model.set-baro':
        return this.modelSetBaro(command);
      case 'channels.sync':
        return this.channelsSyncCommand(command);
      case 'scenario.load':
        return this.scenarioLoadCommand(command);
      case 'scenario.clear':
        return this.scenarioClearCommand(command);
      case 'treatment.fluid-bolus':
        return this.treatmentFluidBolus(command);
      case 'treatment.vasopressor':
        return this.treatmentVasopressor(command);
      case 'checkpoint.restore': {
        const ref = (command.payload as { ref?: string })?.ref;
        if (!ref) {
          return this.reject(command, runtimeError('INVALID_PARAMETER', 'ref required', { path: 'payload.ref' }));
        }
        const restored = this.restoreCheckpoint(ref);
        if (!restored.accepted) {
          return this.reject(command, runtimeError('CHECKPOINT_MISSING', restored.error?.message ?? 'restore failed'));
        }
        return this.accept(command, { changedPaths: ['*'] });
      }
      default:
        return this.reject(command, runtimeError('UNKNOWN_COMMAND', `Unsupported command type: ${command.type}`, {
          received: command.type,
          alternatives: [
            'condition.activate',
            'condition.resolve',
            'chemistry.set',
            'chemistry.unpin',
            'chemistry.reset',
            'experimental.circulation-param',
            'model.set-pathology',
            'model.set-baro',
            'channels.sync',
            'scenario.load',
            'scenario.clear',
            'treatment.fluid-bolus',
            'treatment.vasopressor',
            'runtime.advance',
            'runtime.pause',
            'runtime.resume',
            'runtime.reset',
            'checkpoint.restore',
          ],
        }));
    }
  }

  /** Clinical / UI clients — latent state denied when scenario hides it. */
  queryForClient<Q extends RuntimeQuery>(query: Q, session?: RuntimeSession): QueryResult<Q> {
    return this.query(query, session ?? clinicalSession());
  }

  /**
   * Privileged model/trigger path — bypasses clinical visibility.
   * Never expose this to learner-facing UI.
   */
  internalStateForModels(query: { type: string; [k: string]: unknown }): unknown {
    return this.queryUnlocked(query as RuntimeQuery);
  }

  query<Q extends RuntimeQuery>(query: Q, session?: RuntimeSession): QueryResult<Q> {
    const denied = authorizeQuery(query, this.authorityContext(session));
    if (denied) return null as QueryResult<Q>;
    return this.queryUnlocked(query);
  }

  private queryUnlocked<Q extends RuntimeQuery>(query: Q): QueryResult<Q> {
    const resolved = this.resolvedEffects();
    const privateParams = this.mergedPrivateParams(resolved);

    switch (query.type) {
      case 'runtime.capabilities':
        return this.describeCapabilities() as QueryResult<Q>;
      case 'runtime.fingerprint':
        return this.fingerprint as QueryResult<Q>;
      case 'runtime.time':
        return { simTimeMs: this.simTime } as QueryResult<Q>;
      case 'conditions.active':
        return [...this.conditions.values()].map((c) => ({
          instanceId: c.instanceId,
          conditionId: c.conditionId,
          version: c.version,
          parameters: c.parameters,
          activatedAt: c.activatedAt,
        })) as QueryResult<Q>;
      case 'mechanisms.active': {
        const mechs = this.collectMechanisms();
        return mechs.map((m) => ({
          mechanismId: m.mechanismId,
          displayName: m.displayName,
          conditionId: m.provenance.find((p) => p.kind === 'condition') && 'id' in (m.provenance.find((p) => p.kind === 'condition') as { id: string })
            ? (m.provenance.find((p) => p.kind === 'condition') as { id: string }).id
            : undefined,
          effectTargets: m.effects.map((e) => String(e.target)),
        })) as QueryResult<Q>;
      }
      case 'effects.resolved': {
        const out: Record<string, { value: unknown; baseline: unknown; contributions: unknown[] }> = {};
        for (const [id, def] of Object.entries(PHYSIOLOGICAL_PORTS)) {
          const hit = resolved.get(id);
          out[id] = {
            value: hit?.value ?? def.baseline,
            baseline: def.baseline,
            contributions: hit?.contributions ?? [],
          };
        }
        return out as QueryResult<Q>;
      }
      case 'adapter.cardio.privateParams':
        return privateParams as QueryResult<Q>;
      case 'state.projection': {
        if (query.projection === 'publicPhysiology') return this.publicPhysiology() as QueryResult<Q>;
        if (query.projection === 'clinicalSummary') {
          const mayLatent = this.authorityContext().authority.mayReadLatentState;
          const hideDx = this.compiledScenario?.definition.visibility?.diagnoses === 'hidden';
          return {
            time: this.simTime,
            vitals: this.vitalsValue(),
            activeConditions: (mayLatent && !hideDx)
              ? this.queryUnlocked({ type: 'conditions.active' })
              : [],
            appearance: this.appearanceFromState(),
            scenarioTitle: this.presentationScenarioTitle(),
          } as QueryResult<Q>;
        }
        if (query.projection === 'modelDiagnostics') {
          return {
            privateParams,
            lastSnap: this.lastSnap,
            revision: this.revision,
          } as QueryResult<Q>;
        }
        if (query.projection === 'timelineRange') {
          return this.timeline as QueryResult<Q>;
        }
        return null as QueryResult<Q>;
      }
      case 'timeline.range':
        return this.timeline.filter((e) => e.at >= query.from && e.at <= query.to) as QueryResult<Q>;
      case 'explanation.vitals':
      case 'explanation.for': {
        const cond = [...this.conditions.values()][0] ?? null;
        const obsId = query.type === 'explanation.for'
          ? query.observationId
          : this.ids.observation('vitals');
        return buildNeurogenicShockExplanation({
          observationId: obsId,
          condition: cond
            ? {
                instanceId: cond.instanceId,
                conditionId: cond.conditionId,
                version: cond.version,
                parameters: cond.parameters,
                activatedAt: cond.activatedAt,
              }
            : null,
          resolved,
          privateParams,
          physiology: this.publicPhysiology(),
          mayReadLatentState: this.authorityContext().authority.mayReadLatentState,
        }) as QueryResult<Q>;
      }
      default:
        return null as QueryResult<Q>;
    }
  }

  observe<R extends ObservationRequest>(request: R, session?: RuntimeSession): ObserveOutcome<R> {
    const id = this.ids.observation(request.type.replace(/\./g, '_'));
    const denied = authorizeObservation(request, this.authorityContext(session));
    if (denied) {
      return {
        accepted: false,
        id,
        type: request.type,
        requestedAt: this.simTime,
        error: denied,
      };
    }

    const hideDiagnoses = this.compiledScenario?.definition.visibility?.diagnoses === 'hidden';
    const projection = this.observationProjection();
    const obsContext = { clinicalMode: true, hideDiagnoses };

    const wrap = (observation: ObservationResult<R>): ObserveOutcome<R> => ({
      accepted: true,
      observation,
    });

    if (request.type === 'observe.vital-signs') {
      const plan = vitalSignsObservation.observe({
        patient: projection,
        request,
        context: obsContext,
        observationId: id,
      });
      return wrap(plan.immediate as ObservationResult<R>);
    }

    if (request.type === 'observe.twelve-lead-ecg') {
      const plan = twelveLeadEcgObservation.observe({
        patient: projection,
        request,
        context: obsContext,
        observationId: id,
      });
      return wrap(plan.immediate as ObservationResult<R>);
    }

    if (request.type === 'observe.laboratory-panel') {
      const plan = laboratoryPanelObservation.observe({
        patient: {
          ...projection,
          chemistry: this.chemistry,
          chemistryPins: this.chemistryPins,
          activeChemistryDerivations: this.activeChemistryDerivations.map((d) => ({
            id: d.id,
            name: d.name,
            text: d.text,
            why: d.why,
            patch: d.patch as Record<string, number>,
          })),
        },
        request,
        context: { clinicalMode: true },
        observationId: id,
      });
      return wrap(plan.immediate as ObservationResult<R>);
    }

    const t = this.simTime;
    const base = {
      id,
      requestedAt: t,
      acquiredAt: t,
      availableAt: t,
      quality: { ideal: true, artefact: null },
      provenance: {
        modelId: 'observations.ideal.v1',
        latentPaths: ['cardiovascular.*', 'neurological.cordLesionLevel'],
      },
    };

    if (request.type === 'observe.general-appearance') {
      return wrap({
        ...base,
        type: 'observe.general-appearance',
        value: this.appearanceFromState(),
      } as ObservationResult<R>);
    }

    // Continue with examination handling below — fall through to remaining observe body
    // by calling the legacy path for examination / unknown.
    return this.observeExaminationOrEmpty(request, base, wrap);
  }

  private observeExaminationOrEmpty<R extends ObservationRequest>(
    request: R,
    base: {
      id: ReturnType<RuntimeIdFactory['observation']>;
      requestedAt: SimTime;
      acquiredAt: SimTime;
      availableAt: SimTime;
      quality: { ideal: boolean; artefact: null };
      provenance: { modelId: string; latentPaths: string[] };
    },
    wrap: (observation: ObservationResult<R>) => ObserveOutcome<R>,
  ): ObserveOutcome<R> {
    const hideDiagnoses = this.compiledScenario?.definition.visibility?.diagnoses === 'hidden';
    const projection = this.observationProjection();
    const obsContext = { clinicalMode: true, hideDiagnoses };

    if (request.type === 'observe.physiology') {
      return wrap({
        ...base,
        type: 'observe.physiology',
        value: this.publicPhysiology() as unknown as Record<string, unknown>,
        provenance: {
          modelId: 'observations.physiology-projection.v1',
          latentPaths: ['cardiovascular.*', 'electrophysiology.*'],
        },
      } as ObservationResult<R>);
    }

    if (request.type === 'perform.examination') {
      const findings: string[] = [];
      const cord = this.getActiveCordLevel();
      const sympathetic = Number(
        this.resolvedEffects().get('autonomic.sympatheticOutflow')?.value
        ?? PHYSIOLOGICAL_PORTS['autonomic.sympatheticOutflow'].baseline,
      );
      const lossOfTone = (cord != null && lesionInterruptsSympathetic(cord)) || sympathetic < 0.5;
      const v = vitalSignsObservation.observe({
        patient: projection,
        request: { type: 'observe.vital-signs' },
        context: obsContext,
        observationId: this.ids.observation('exam_vitals'),
      }).immediate!.value;
      if (request.exam === 'pulse' || request.exam === 'cardiovascular') {
        if (v.heartRate != null && v.heartRate < 60) findings.push('Bradycardic pulse');
        if (v.bloodPressure.mean != null && v.bloodPressure.mean < 70) findings.push('Hypotension');
        if (lossOfTone) {
          findings.push('Warm, dry peripheries (loss of sympathetic vasoconstriction)');
        } else if (v.bloodPressure.mean != null && v.bloodPressure.mean < 70) {
          findings.push('Cool peripheries possible with low output');
        } else {
          findings.push('Warm, well-perfused peripheries');
        }
      }
      if (request.exam === 'neurological' && cord) {
        findings.push(`Motor and sensory level consistent with ${cord}`);
      }
      return wrap({
        ...base,
        type: 'perform.examination',
        value: { exam: request.exam, findings },
      } as ObservationResult<R>);
    }

    return wrap({
      ...base,
      type: (request as ObservationRequest).type,
      value: {},
    } as ObservationResult<R>);
  }

  async advance(duration: SimDuration): Promise<AdvanceResult> {
    const from = this.simTime;
    const seconds = Number(duration) / 1000;
    const privateParams = this.mergedPrivateParams(this.resolvedEffects());
    this.pushCardioParams(privateParams);

    if (this.opts.settlePhysiology) {
      const settleArgs = {
        ...privateParams,
        bloodVolume: this.learnerBloodVolume,
        ...this.experimentalControls,
      };
      this.lastSnap = this.opts.settlePhysiology(
        settleArgs as Parameters<NonNullable<PatientRuntimeOptions['settlePhysiology']>>[0],
        Math.max(seconds, 0.001),
      );
      if (this.lastSnap) {
        this.ingestCardioSnapshot(this.lastSnap, { advanceMs: Number(duration) });
      } else {
        this.simTime = asSimTime(Number(from) + Number(duration));
        this.triggerRunner?.tick();
      }
      return this.finishAdvance(from, Number(duration), null);
    }

    if (this.opts.cardioHost && seconds > 0) {
      const requestId = this.ids.event('settle');
      return new Promise<AdvanceResult>((resolve, reject) => {
        this.pendingAdvances.set(requestId, {
          requestId,
          durationMs: Number(duration),
          from,
          resolve,
          reject,
        });
        this.opts.cardioHost!.postMessage({
          type: 'settle',
          requestId,
          seconds,
        });
      });
    }

    this.simTime = asSimTime(Number(from) + Number(duration));
    this.triggerRunner?.tick();
    return this.finishAdvance(from, Number(duration), null);
  }

  /**
   * Complete a correlated live-model advance. Called by the cardio host adapter
   * when an `advanced` message with a matching requestId arrives.
   */
  completeAdvance(
    requestId: string | null | undefined,
    snap: Record<string, unknown>,
    advancedMs?: number,
  ): AdvanceResult | null {
    if (!requestId || !this.pendingAdvances.has(requestId)) {
      // Uncorrelated — treat as ordinary snapshot ingest (no clock jump from settle).
      this.ingestCardioSnapshot(snap);
      return null;
    }
    const pending = this.pendingAdvances.get(requestId)!;
    this.pendingAdvances.delete(requestId);
    const ms = advancedMs != null && Number.isFinite(advancedMs)
      ? advancedMs
      : pending.durationMs;
    this.ingestCardioSnapshot(snap, { advanceMs: ms, from: pending.from });
    const result = this.finishAdvance(pending.from, ms, requestId);
    pending.resolve(result);
    return result;
  }

  private finishAdvance(from: SimTime, advancedMs: number, requestId: string | null): AdvanceResult {
    const events: TimelineEntry[] = [];
    if (advancedMs > 0) {
      events.push({
        id: this.ids.event('adv'),
        at: this.simTime,
        type: 'runtime.advanced',
        label: `Advanced ${(advancedMs / 1000).toFixed(2)} s`,
      });
      this.timeline.push(...events);
    }
    this.emit({ type: 'runtime.advanced', revision: this.revision, simTime: this.simTime });
    return {
      from,
      to: this.simTime,
      requestId,
      advancedMs,
      publicPhysiology: this.publicPhysiology(),
      events,
    };
  }

  play(options?: { speed?: number }): void {
    this.playing = true;
    if (options?.speed != null) {
      this.opts.cardioHost?.postMessage({ type: 'setSpeed', value: options.speed });
    }
    this.opts.cardioHost?.postMessage({ type: 'play' });
    this.emit({ type: 'runtime.playing', revision: this.revision, simTime: this.simTime });
  }

  pause(): void {
    this.playing = false;
    this.opts.cardioHost?.postMessage({ type: 'pause' });
    this.emit({ type: 'runtime.paused', revision: this.revision, simTime: this.simTime });
  }

  createCheckpoint(label?: string, opts?: { silent?: boolean }): CheckpointRef {
    const id = this.ids.checkpoint();
    this.captureModelStatesSync();
    const snap: CheckpointSnapshot = {
      id,
      label,
      createdAt: this.simTime,
      revision: this.revision,
      simTime: this.simTime,
      conditions: structuredClone([...this.conditions.values()]),
      commandLog: structuredClone(this.commandLog),
      lastSnap: this.lastSnap ? structuredClone(this.lastSnap) : null,
      randomState: this.randomState,
      idSeq: this.ids.peek(),
      idSnapshot: this.ids.snapshot(),
      channels: { ...this.channels },
      chemistry: { ...this.chemistry },
      chemistryPins: [...this.chemistryPins],
      chemistryBaseline: { ...this.chemistryBaseline },
      activeChemistryDerivations: structuredClone(this.activeChemistryDerivations),
      cardiovascular: structuredClone(this.cardiovascular),
      electrophysiology: structuredClone(this.electrophysiology),
      learnerBloodVolume: this.learnerBloodVolume,
      experimentalControls: { ...this.experimentalControls },
      scenarioId: this.compiledScenario?.definition.id ?? null,
      scenarioVersion: this.compiledScenario?.definition.version ?? null,
      scenarioAuthority: this.scenarioAuthority ? { ...this.scenarioAuthority } : null,
      scenarioAnnotations: structuredClone(this.scenarioAnnotations),
      triggerState: this.triggerRunner?.serializeState() ?? null,
      fingerprintScenario: { ...this.fingerprint.scenario },
      models: structuredClone(this.modelStates),
      timeline: structuredClone(this.timeline),
      lastModelTimeSec: this.lastModelTimeSec,
      playing: this.playing,
      silent: opts?.silent,
    };
    this.checkpoints.set(id, snap);
    if (!opts?.silent) this.pushTimeline('checkpoint.created', label ?? id);
    return { id, label, createdAt: this.simTime, revision: this.revision };
  }

  restoreCheckpoint(ref: CheckpointRef | string): RestoreResult {
    const id = typeof ref === 'string' ? ref : ref.id;
    const snap = this.checkpoints.get(id);
    if (!snap) {
      return { accepted: false, revision: this.revision, error: { code: 'CHECKPOINT_MISSING', message: `No checkpoint ${id}` } };
    }
    this.simTime = snap.simTime;
    this.revision = snap.revision;
    this.conditions = new Map(snap.conditions.map((c) => [c.instanceId, structuredClone(c)]));
    this.commandLog = structuredClone(snap.commandLog);
    this.lastSnap = snap.lastSnap ? structuredClone(snap.lastSnap) : null;
    this.randomState = snap.randomState;
    if (snap.idSnapshot) this.ids.restore(snap.idSnapshot);
    else this.ids.restore(snap.idSeq ?? 0);
    this.channels = { ...snap.channels };
    this.chemistry = { ...snap.chemistry };
    this.chemistryPins = new Set(snap.chemistryPins);
    this.chemistryBaseline = { ...snap.chemistryBaseline };
    this.activeChemistryDerivations = structuredClone(snap.activeChemistryDerivations ?? []);
    this.cardiovascular = structuredClone(snap.cardiovascular);
    this.electrophysiology = structuredClone(snap.electrophysiology);
    this.learnerBloodVolume = snap.learnerBloodVolume;
    this.experimentalControls = { ...snap.experimentalControls };
    this.scenarioAnnotations = structuredClone(snap.scenarioAnnotations);
    this.timeline = structuredClone(snap.timeline);
    this.lastModelTimeSec = snap.lastModelTimeSec;
    this.playing = snap.playing;
    this.scenarioAuthority = snap.scenarioAuthority ? { ...snap.scenarioAuthority } : null;
    this.fingerprint.scenario = snap.fingerprintScenario
      ? { ...snap.fingerprintScenario }
      : { id: 'ad-hoc', version: '0.0.0' };
    this.modelStates = structuredClone(snap.models ?? {});
    this.applyModelStatesSync(this.modelStates);

    if (snap.scenarioId) {
      const def = getScenario(snap.scenarioId);
      if (def) {
        const compiled = compileScenario(def, {
          availableCapabilities: this.describeCapabilities().capabilities,
        });
        if (compiled.ok) {
          this.compiledScenario = compiled.compiled;
          this.triggerRunner = new ScenarioTriggerRunner(this);
          this.triggerRunner.restoreState(compiled.compiled, snap.triggerState ?? null);
        }
      }
    } else {
      this.compiledScenario = null;
      this.triggerRunner?.disarm();
      this.triggerRunner = null;
    }
    this.prevCardioDriven = new Set();
    for (const pending of this.pendingAdvances.values()) {
      pending.reject(new Error('advance cancelled by checkpoint restore'));
    }
    this.pendingAdvances.clear();
    this.recomputeCardio();
    this.projectCordLevel();
    this.projectChemistryChannels();
    if (this.playing) this.opts.cardioHost?.postMessage({ type: 'play' });
    else this.opts.cardioHost?.postMessage({ type: 'pause' });
    this.pushTimeline('checkpoint.restored', id);
    this.emit({ type: 'checkpoint.restored', revision: this.revision, simTime: this.simTime, detail: { id } });
    return { accepted: true, revision: this.revision };
  }

  /**
   * In-place rewind — not an independent branched runtime.
   * Deferred: true isolated branches require a cloned runtime + model hosts.
   */
  branch(ref: CheckpointRef | string, label?: string): RuntimeBranch {
    const restored = this.restoreCheckpoint(ref);
    const id = `branch_${this.ids.checkpoint('branch')}`;
    if (!restored.accepted) {
      return { id, label, fromCheckpoint: typeof ref === 'string' ? ref : ref.id, createdAt: this.simTime };
    }
    this.pushTimeline('branch.created', label ?? id);
    return {
      id,
      label,
      fromCheckpoint: typeof ref === 'string' ? ref : ref.id,
      createdAt: this.simTime,
    };
  }

  describeCapabilities(): RuntimeCapabilities {
    return {
      runtimeVersion: RUNTIME_VERSION,
      conditions: Object.values(CONDITION_REGISTRY).map((c) => ({
        id: c.id,
        version: c.version,
        requires: c.requiredCapabilities,
      })),
      observations: [
        'general-appearance',
        'vital-signs',
        'twelve-lead-ecg',
        'laboratory-panel',
        'neurological-examination',
        'cardiovascular-examination',
      ],
      experimentalControls: [
        'autonomic.sympatheticOutflow',
        'vascular.venousTone',
        'cardiovascular.baroreflex',
        'experimental.circulation-param',
      ],
      capabilities: [
        ...CIRCULATION_MODEL_MANIFEST.capabilities,
        ...ELECTROPHYSIOLOGY_MODEL_MANIFEST.capabilities,
        ...CHEMISTRY_MODEL_MANIFEST.capabilities,
        'observation.vital-signs',
        'observation.twelve-lead-ecg',
        'observation.laboratory-panel',
        'neurology.pathway-localisation',
      ],
    };
  }

  subscribe(listener: RuntimeListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Ingest a Circulation snapshot into canonical public physiological state. */
  ingestCardioSnapshot(
    snap: Record<string, unknown>,
    opts?: { advanceMs?: number; from?: SimTime },
  ): void {
    this.lastSnap = snap as Record<string, number>;
    this.cardiovascular = snapshotToCardiovascularPublic(snap);
    this.electrophysiology = snapshotToElectrophysiologyPublic(snap);

    // Keep mechanism channels aligned with canonical haemodynamics.
    if (this.cardiovascular.meanArterialPressure != null) {
      this.channels.MAP = this.cardiovascular.meanArterialPressure;
      this.channels.CPP = this.cardiovascular.meanArterialPressure - this.channels.ICP;
    }

    this.applyHaemodynamicChemistry();

    const modelT = typeof snap.t === 'number' ? snap.t : null;
    if (opts?.advanceMs != null) {
      const base = opts.from != null ? opts.from : this.simTime;
      this.simTime = asSimTime(Number(base) + opts.advanceMs);
    } else if (this.playing && modelT != null && this.lastModelTimeSec != null) {
      const deltaMs = (modelT - this.lastModelTimeSec) * 1000;
      if (deltaMs > 0 && deltaMs < 120_000) {
        this.simTime = asSimTime(Number(this.simTime) + deltaMs);
      }
    }
    if (modelT != null && Number.isFinite(modelT)) this.lastModelTimeSec = modelT;

    const projection = cardiovascularToChannelProjection(this.cardiovascular);
    if (Object.keys(projection).length) {
      this.opts.projectChannels?.(projection);
    }
    this.triggerRunner?.tick();
    this.emit({
      type: 'physiology.updated',
      revision: this.revision,
      simTime: this.simTime,
      detail: { system: 'cardiovascular' },
    });
  }

  /**
   * Mutate latent chemistry. Prefer `dispatch({ type: 'chemistry.set' })` from UI;
   * this method is the shared implementation for authorized commands and tests.
   */
  setChemistry(
    patch: Partial<ChemistryPublicState>,
    opts: { pin?: boolean } = {},
  ): void {
    Object.assign(this.chemistry, patch);
    if (opts.pin) {
      for (const k of Object.keys(patch) as (keyof ChemistryPublicState)[]) {
        this.chemistryPins.add(k);
      }
    }
    // Learner-edited potassium/calcium become channel mechanism inputs.
    if (patch.potassium != null || patch.calcium != null) {
      if (patch.potassium != null) this.channels.K = patch.potassium;
      if (patch.calcium != null) this.channels.Ca = patch.calcium;
      this.recomputeCardio();
    }
    this.projectChemistryChannels();
    this.emit({ type: 'chemistry.updated', revision: this.revision, simTime: this.simTime });
  }

  /** Convenience: accept legacy lab-panel keys (K, Ca, HCO3, …). */
  setChemistryFromLabBag(bag: Record<string, number>, opts: { pin?: boolean } = {}): void {
    this.setChemistry(labBagToChemistryPatch(bag), opts);
  }

  chemistryBag(): Record<string, number> {
    return chemistryToLabBag(this.chemistry);
  }

  chemistryState(): ChemistryPublicState {
    return { ...this.chemistry };
  }

  chemistryPinKeys(): string[] {
    return [...this.chemistryPins];
  }

  /** Test / Explore helper — keys currently retained for headless settle. */
  experimentalControlKeys(): string[] {
    return Object.keys(this.experimentalControls);
  }

  activeChemistryLinks(): { id: string; name: string; text: string; why: string }[] {
    return this.activeChemistryDerivations.map(({ id, name, text, why }) => ({ id, name, text, why }));
  }

  /** Monitor-facing snapshot built from canonical public state (no private names). */
  monitorSnapshot(): Record<string, number | boolean | null> {
    const cv = this.cardiovascular;
    const ep = this.electrophysiology;
    return {
      Pmean: cv.meanArterialPressure,
      Psys: cv.systolicPressure,
      Pdia: cv.diastolicPressure,
      HR: cv.heartRate,
      SV: cv.strokeVolume,
      CO: cv.cardiacOutput,
      EF: cv.ejectionFraction,
      CVP: cv.centralVenousPressure,
      Pla: cv.leftAtrialPressure,
      Ppa: cv.pulmonaryArteryPressure,
      PpaMean: cv.pulmonaryArteryMean,
      Pmsf: cv.meanFillingPressure,
      bloodVolume: cv.bloodVolume,
      Rsys: cv.systemicVascularResistance,
      baroEnabled: cv.baroreflexEnabled,
      ecgValue: ep.leadIISample,
      qrsAxis: ep.qrsAxis,
      pathology: ep.pathology as unknown as number | null,
    };
  }

  /** Bind (or re-bind) the live circulation host after the domain boots. */
  bindCardioHost(
    host: { postMessage: (m: unknown) => void } | null,
    defaults?: Record<string, number | boolean>,
  ): void {
    this.opts.cardioHost = host;
    if (defaults) this.opts.cardioDefaults = defaults;
    this.recomputeCardio();
  }

  /** Private params for the cardiovascular model — the only path into Circulation. */
  cardioOverrides(): Record<string, number | boolean> {
    const p = adaptCardioPrivateParams(this.resolvedEffects()) as CardioPrivateParams & Record<string, number | boolean | undefined>;
    if (!p.drivenKeys.length) return {};
    const out: Record<string, number | boolean> = {};
    for (const key of p.drivenKeys) {
      const v = p[key];
      if (v != null) out[key] = v;
    }
    return out;
  }

  getActiveCordLevel(): string | null {
    for (const c of this.conditions.values()) {
      if (c.conditionId === 'cervical-spinal-cord-injury' || c.conditionId === 'spinal-cord-injury') {
        return String(c.parameters.level);
      }
    }
    return null;
  }

  /** UI display list — redacted when diagnoses are hidden. */
  activeMechanismDisplays() {
    const hideDx = this.compiledScenario?.definition.visibility?.diagnoses === 'hidden';
    if (hideDx || !this.authorityContext().authority.mayReadLatentState) {
      return [];
    }
    const displays = activeChannelDisplays(this.channels);
    const level = this.getActiveCordLevel();
    if (level && lesionInterruptsSympathetic(level)) {
      displays.push({
        id: NEUROGENIC_DISPLAY.id,
        name: NEUROGENIC_DISPLAY.name,
        short: NEUROGENIC_DISPLAY.short,
        why: NEUROGENIC_DISPLAY.why,
        to: NEUROGENIC_DISPLAY.to,
        from: NEUROGENIC_DISPLAY.from,
        level: NEUROGENIC_DISPLAY.level,
        status: `Cord lesion at ${level} — sympathetic outflow lost`,
      });
    }
    return displays;
  }

  explainPrivateParam(paramKey: string) {
    const resolved = this.resolvedEffects();
    const hits = [];
    for (const [portId, val] of resolved) {
      for (const c of val.contributions) {
        // Rough educational link: show mechanisms that touch ports the adapter uses for this key
        const related =
          (paramKey === 'Rsys' && portId.includes('Arteriolar'))
          || (paramKey === 'HR' && portId.includes('cardiacAccelerator'))
          || (paramKey === 'V0sv' && portId.includes('venous'))
          || (paramKey === 'baroEnabled' && portId.includes('baroreflex'))
          || (paramKey === 'Emax' && portId.includes('contractility'))
          || (paramKey === 'K' && portId.includes('Potassium'))
          || (paramKey === 'stFactor' && portId.includes('stDuration'));
        if (related) {
          hits.push({
            coupling: { id: c.source, name: portId },
            value: c.value,
          });
        }
      }
    }
    return hits;
  }

  /* ---- internals ------------------------------------------------------ */

  private activateCondition(command: PatientCommand): CommandResult {
    const payload = command.payload as ActivateConditionPayload;
    const def = getCondition(payload?.condition);
    if (!def) {
      return this.reject(command, runtimeError('UNKNOWN_CONDITION', `Unknown condition: ${payload?.condition}`, {
        received: payload?.condition,
        alternatives: Object.keys(CONDITION_REGISTRY),
      }));
    }
    const check = def.validate(payload.parameters ?? {});
    if (check.ok === false) {
      return this.reject(command, runtimeError('INVALID_PARAMETER', check.message, {
        path: check.path,
        received: payload.parameters,
      }));
    }

    // Replace any existing instance of the same condition family.
    for (const [id, inst] of this.conditions) {
      if (inst.conditionId === def.id) this.conditions.delete(id);
    }

    const instanceId = payload.instanceId ?? `cond_${command.id}`;
    const instance = def.initialise(payload.parameters, {
      simTime: this.simTime,
      instanceId,
    });
    this.conditions.set(instanceId, instance);

    const mechanisms = def.resolve(instance, this.simTime);
    this.recomputeCardio();
    this.projectCordLevel();
    this.pushTimeline('condition.activated', def.displayName, {
      conditionId: def.id,
      parameters: instance.parameters,
    });

    return this.accept(command, {
      mechanisms: mechanisms.map((m) => m.mechanismId),
      events: [{ id: `ev_${this.revision}`, type: 'condition.activated', at: this.simTime }],
      changedPaths: [
        'conditions',
        'mechanisms',
        'neurological.cordLesionLevel',
        'autonomic.*',
        'vascular.*',
      ],
    });
  }

  private resolveCondition(command: PatientCommand): CommandResult {
    const payload = (command.payload ?? {}) as ResolveConditionPayload;
    const aliases = new Set([
      'cervical-spinal-cord-injury',
      'spinal-cord-injury',
    ]);

    const matches = (inst: ConditionInstance): boolean => {
      if (payload.instanceId) return inst.instanceId === payload.instanceId;
      if (payload.condition) {
        if (inst.conditionId === payload.condition) return true;
        // Treat SCI aliases as one family.
        if (aliases.has(payload.condition) && aliases.has(inst.conditionId)) return true;
        return false;
      }
      return true; // resolve all
    };

    let removed = 0;
    for (const [id, inst] of [...this.conditions.entries()]) {
      if (!matches(inst)) continue;
      this.conditions.delete(id);
      removed++;
    }
    if (!removed) {
      // Resolving "all" with nothing active is a no-op success (e.g. patient.reset).
      if (!payload.instanceId && !payload.condition) {
        this.recomputeCardio();
        this.projectCordLevel();
        return this.accept(command, { changedPaths: ['conditions'] });
      }
      return this.reject(command, runtimeError('INVALID_PARAMETER', 'No matching active condition', {
        received: payload,
      }));
    }
    this.recomputeCardio();
    this.projectCordLevel();
    this.pushTimeline('condition.resolved', payload.condition ?? payload.instanceId ?? 'all');
    return this.accept(command, {
      changedPaths: ['conditions', 'mechanisms', 'autonomic.*', 'vascular.*'],
    });
  }

  private collectMechanisms() {
    const out = [];
    for (const inst of this.conditions.values()) {
      const def = getCondition(inst.conditionId);
      if (!def) continue;
      out.push(...def.resolve(inst, this.simTime));
    }
    out.push(...resolveChannelMechanisms(this.channels, this.simTime));
    return out;
  }

  private allEffects(): PhysiologicalEffect[] {
    return this.collectMechanisms().flatMap((m) => m.effects);
  }

  private resolvedEffects() {
    return composeEffects(this.allEffects(), this.simTime);
  }

  private recomputeCardio() {
    this.pushCardioParams(this.mergedPrivateParams(this.resolvedEffects()));
  }

  private projectCordLevel() {
    this.opts.projectChannels?.({ cordLevel: this.getActiveCordLevel() });
  }

  private mergedPrivateParams(resolved: Map<string, import('../contracts/effects.ts').ResolvedPortValue>) {
    const base = adaptCardioPrivateParams(resolved) as CardioPrivateParams & Record<string, number | boolean | undefined>;
    const driven = new Set(base.drivenKeys);
    for (const [k, v] of Object.entries(this.experimentalControls)) {
      if (k === 'bloodVolume') continue;
      (base as Record<string, number | boolean>)[k] = v;
      driven.add(k);
    }
    base.drivenKeys = [...driven];
    return base as ReturnType<typeof adaptCardioPrivateParams>;
  }

  private pushCardioParams(params: ReturnType<typeof adaptCardioPrivateParams>) {
    if (this.opts.cardioHost) {
      const { driven } = applyCardioAdapterToHost(
        this.opts.cardioHost,
        params,
        this.prevCardioDriven,
        {
          ...CIRCULATION_BASELINE,
          ...this.experimentalControls,
        },
      );
      this.prevCardioDriven = driven;
      this.opts.cardioHost.postMessage({
        type: 'setParam',
        key: 'bloodVolume',
        value: this.learnerBloodVolume,
      });
    } else if (!params.drivenKeys.length) {
      this.prevCardioDriven = new Set();
    } else {
      this.prevCardioDriven = new Set(params.drivenKeys);
    }
  }

  private authorityContext(session?: RuntimeSession) {
    const authority = this.scenarioAuthority ?? this.effectiveAuthority();
    const clinical = !!this.compiledScenario
      && this.compiledScenario.definition.visibility?.diagnoses === 'hidden';
    const role = session?.role;
    const diagnosticSession = session?.diagnosticSession
      || role === 'authoring'
      || role === 'test'
      || role === 'system'
      || (!this.compiledScenario && this.opts.authority?.mayReadLatentState !== false);
    return {
      mode: (clinical && !diagnosticSession ? 'clinical' : 'exploration') as 'clinical' | 'exploration',
      authority,
      diagnosticSession: !!diagnosticSession,
      session,
    };
  }

  presentationScenarioTitle(): string | null {
    const def = this.compiledScenario?.definition;
    if (!def) return null;
    const hideDx = def.visibility?.diagnoses === 'hidden';
    if (hideDx) return def.presentationTitle ?? 'Clinical scenario';
    return def.title;
  }

  authorScenarioTitle(): string | null {
    return this.compiledScenario?.definition.title ?? null;
  }

  private publicPhysiology(): PublicPhysiologyView {
    const resolved = this.resolvedEffects();
    const cord = this.getActiveCordLevel();
    const cond = [...this.conditions.values()][0];
    return {
      cardiovascular: { ...this.cardiovascular },
      electrophysiology: {
        leadIISample: this.electrophysiology.leadIISample,
        leads: this.electrophysiology.leads,
        qrsAxis: this.electrophysiology.qrsAxis,
        pathology: this.electrophysiology.pathology,
        effectiveHeartRate: this.electrophysiology.effectiveHeartRate,
      },
      chemistry: { ...this.chemistry },
      neurological: {
        cordLesionLevel: cord,
        lesionCompleteness: cond ? Number(cond.parameters.completeness) : null,
      },
      autonomic: {
        sympatheticOutflow: Number(resolved.get('autonomic.sympatheticOutflow')?.value
          ?? PHYSIOLOGICAL_PORTS['autonomic.sympatheticOutflow'].baseline),
        cardiacAcceleratorDrive: Number(resolved.get('autonomic.cardiacAcceleratorDrive')?.value
          ?? PHYSIOLOGICAL_PORTS['autonomic.cardiacAcceleratorDrive'].baseline),
      },
      vascular: {
        venousTone: Number(resolved.get('vascular.venousTone')?.value
          ?? PHYSIOLOGICAL_PORTS['vascular.venousTone'].baseline),
        systemicArteriolarTone: Number(resolved.get('vascular.systemicArteriolarTone')?.value
          ?? PHYSIOLOGICAL_PORTS['vascular.systemicArteriolarTone'].baseline),
      },
    };
  }

  private observationProjection(): PatientStateProjection {
    const phys = this.publicPhysiology();
    return {
      cardiovascular: phys.cardiovascular,
      electrophysiology: phys.electrophysiology,
      neurological: phys.neurological,
      chemistry: this.chemistry,
      chemistryPins: this.chemistryPins,
      activeChemistryDerivations: this.activeChemistryDerivations.map((d) => ({
        id: d.id,
        name: d.name,
        text: d.text,
        why: d.why,
        patch: d.patch as Record<string, number>,
      })),
      simTime: this.simTime,
    };
  }

  private vitalsValue(): VitalSignsValue {
    return vitalSignsObservation.observe({
      patient: this.observationProjection(),
      request: { type: 'observe.vital-signs' },
      context: {},
      observationId: this.ids.observation('vitals_internal'),
    }).immediate!.value;
  }

  private appearanceFromState() {
    const v = this.vitalsValue();
    const shocked = v.bloodPressure.mean != null && v.bloodPressure.mean < 70;
    return {
      appearance: shocked ? 'Pale but warm; looks unwell' : 'Comfortable at rest',
      consciousness: shocked && (v.bloodPressure.mean ?? 100) < 55 ? 'Confused' : 'Alert',
      perfusion: shocked ? 'Warm, dry skin; delayed capillary refill possible from low flow' : 'Warm, well perfused',
    };
  }

  private resetAll() {
    this.clearScenario(false);
    this.conditions.clear();
    this.commandLog = [];
    this.timeline = [];
    this.simTime = asSimTime(0);
    this.lastSnap = null;
    this.cardiovascular = { ...EMPTY_CARDIOVASCULAR_PUBLIC };
    this.electrophysiology = { ...EMPTY_ELECTROPHYSIOLOGY_PUBLIC };
    this.channels = { ...DEFAULT_CHANNELS };
    this.learnerBloodVolume = 5000;
    this.experimentalControls = {};
    this.modelStates = {};
    this.lastModelTimeSec = null;
    this.fingerprint.scenario = { id: 'ad-hoc', version: '0.0.0' };
    for (const pending of this.pendingAdvances.values()) {
      pending.reject(new Error('advance cancelled by reset'));
    }
    this.pendingAdvances.clear();
    this.hostEpoch += 1;
    this.resetChemistry();
    this.prevCardioDriven = new Set();
    this.opts.cardioHost?.postMessage({ type: 'reset' });
    this.recomputeCardio();
    this.projectCordLevel();
    this.revision += 1;
  }

  private resetChemistry() {
    this.chemistry = { ...CHEMISTRY_DEFAULTS };
    this.chemistryBaseline = { ...CHEMISTRY_DEFAULTS };
    this.chemistryPins.clear();
    this.activeChemistryDerivations = [];
    this.channels.K = this.chemistry.potassium;
    this.channels.Ca = this.chemistry.calcium;
    this.projectChemistryChannels();
  }

  private chemistrySet(command: PatientCommand): CommandResult {
    const payload = (command.payload ?? {}) as ChemistrySetPayload;
    if (!payload.values || typeof payload.values !== 'object') {
      return this.reject(command, runtimeError('INVALID_PARAMETER', 'values required', {
        path: 'payload.values',
      }));
    }
    const patch = labBagToChemistryPatch(payload.values);
    // Also accept chemistry field names directly.
    for (const [k, v] of Object.entries(payload.values)) {
      if (typeof v === 'number' && k in CHEMISTRY_DEFAULTS) {
        (patch as Record<string, number>)[k] = v;
      }
    }
    if (!Object.keys(patch).length) {
      return this.reject(command, runtimeError('INVALID_PARAMETER', 'no recognised chemistry keys', {
        received: Object.keys(payload.values),
      }));
    }
    this.setChemistry(patch, { pin: payload.pin !== false });
    return this.accept(command, {
      changedPaths: Object.keys(patch).map((k) => `chemistry.${k}`),
    });
  }

  private chemistryUnpin(command: PatientCommand): CommandResult {
    const payload = (command.payload ?? {}) as ChemistryUnpinPayload;
    if (!payload.keys?.length) {
      this.chemistryPins.clear();
    } else {
      for (const k of payload.keys) {
        this.chemistryPins.delete(k);
        const patch = labBagToChemistryPatch({ [k]: 0 });
        for (const ck of Object.keys(patch)) this.chemistryPins.delete(ck);
      }
    }
    this.applyHaemodynamicChemistry();
    return this.accept(command, { changedPaths: ['chemistry.*'] });
  }

  private experimentalCirculationParam(command: PatientCommand): CommandResult {
    // Authority is enforced centrally in dispatch via authorizeCommand.
    const payload = (command.payload ?? {}) as CirculationParamPayload;
    if (!payload.key || !EXPERIMENTAL_CIRCULATION_KEYS.has(payload.key)) {
      return this.reject(command, runtimeError('INVALID_PARAMETER', `unsupported circulation param: ${payload?.key}`, {
        path: 'payload.key',
        received: payload?.key,
        alternatives: [...EXPERIMENTAL_CIRCULATION_KEYS],
      }));
    }
    if (typeof payload.value !== 'number' && typeof payload.value !== 'boolean') {
      return this.reject(command, runtimeError('INVALID_PARAMETER', 'value must be number or boolean', {
        path: 'payload.value',
        received: payload.value,
      }));
    }
    this.experimentalControls[payload.key] = payload.value;
    if (payload.key === 'bloodVolume' && typeof payload.value === 'number') {
      this.learnerBloodVolume = payload.value;
    }
    if (payload.key === 'K' && typeof payload.value === 'number') {
      this.setChemistry({ potassium: payload.value }, { pin: true });
    }
    this.recomputeCardio();
    this.pushTimeline('experimental.circulation-param', `${payload.key}=${payload.value}`);
    return this.accept(command, {
      changedPaths: [`experimental.circulation.${payload.key}`],
    });
  }

  private modelSetPathology(command: PatientCommand): CommandResult {
    const payload = (command.payload ?? {}) as ModelPathologyPayload;
    if (!payload.pathologyId) {
      return this.reject(command, runtimeError('INVALID_PARAMETER', 'pathologyId required', {
        path: 'payload.pathologyId',
      }));
    }
    this.opts.cardioHost?.postMessage({ type: 'setPathology', id: payload.pathologyId });
    this.pushTimeline('model.set-pathology', payload.pathologyId);
    return this.accept(command, { changedPaths: ['electrophysiology.pathology'] });
  }

  private modelSetBaro(command: PatientCommand): CommandResult {
    const payload = (command.payload ?? {}) as ModelBaroPayload;
    if (typeof payload.enabled !== 'boolean') {
      return this.reject(command, runtimeError('INVALID_PARAMETER', 'enabled boolean required', {
        path: 'payload.enabled',
      }));
    }
    this.experimentalControls.baroEnabled = payload.enabled;
    this.opts.cardioHost?.postMessage({ type: 'setBaro', value: payload.enabled });
    this.recomputeCardio();
    this.pushTimeline('model.set-baro', String(payload.enabled));
    return this.accept(command, { changedPaths: ['cardiovascular.baroreflexEnabled'] });
  }

  private channelsSyncCommand(command: PatientCommand): CommandResult {
    const payload = (command.payload ?? {}) as ChannelsSyncPayload;
    if (!payload.channels || typeof payload.channels !== 'object') {
      return this.reject(command, runtimeError('INVALID_PARAMETER', 'channels required', {
        path: 'payload.channels',
      }));
    }
    this.applyChannelSync(payload.channels as Partial<ChannelState>);
    return this.accept(command, {
      changedPaths: Object.keys(payload.channels).map((k) => `channels.${k}`),
    });
  }

  private applyChannelSync(partial: Partial<ChannelState>): void {
    Object.assign(this.channels, partial);
    if (partial.K != null && partial.K !== this.chemistry.potassium) {
      this.chemistry.potassium = partial.K;
      this.chemistryPins.add('potassium');
    }
    if (partial.Ca != null && partial.Ca !== this.chemistry.calcium) {
      this.chemistry.calcium = partial.Ca;
      this.chemistryPins.add('calcium');
    }
    this.recomputeCardio();
    this.emit({ type: 'channels.synced', revision: this.revision, simTime: this.simTime });
  }

  /**
   * @deprecated Prefer dispatch({ type: 'channels.sync' }). Kept for Patient.set bridge;
   * will be removed once all UI paths use commands.
   */
  syncChannels(partial: Partial<ChannelState>): void {
    this.applyChannelSync(partial);
  }

  private captureModelStatesSync(): void {
    if (this.opts.exportModelState) {
      const state = this.opts.exportModelState();
      if (state) this.modelStates[state.modelId] = state;
    }
    // Live host: request export; inline host responds synchronously.
    if (this.opts.cardioHost) {
      const requestId = this.ids.event('export');
      let captured: SerializedModelState | null = null;
      const host = this.opts.cardioHost as {
        postMessage: (m: unknown) => void;
        onmessage?: ((e: { data: unknown }) => void) | null;
      };
      // Prefer a one-shot interceptor if the host pipes messages back via a callback
      // registered by bind — otherwise store last known modelStates only.
      this.opts.cardioHost.postMessage({ type: 'exportState', requestId });
      void captured;
      void host;
      void requestId;
    }
  }

  /** Accept a model-state payload from the cardio host after exportState. */
  ingestModelState(state: SerializedModelState): void {
    if (!state?.modelId) return;
    this.modelStates[state.modelId] = structuredClone(state);
  }

  private applyModelStatesSync(models: Record<string, SerializedModelState>): void {
    for (const state of Object.values(models)) {
      if (this.opts.restoreModelState) {
        this.opts.restoreModelState(state);
      }
      this.opts.cardioHost?.postMessage({
        type: 'importState',
        state,
      });
    }
  }

  private scenarioLoadCommand(command: PatientCommand): CommandResult {
    const payload = (command.payload ?? {}) as ScenarioLoadPayload;
    const loaded = this.loadScenarioById(payload.scenarioId);
    if (!loaded.accepted) {
      return this.reject(command, loaded.error ?? runtimeError('INVALID_PARAMETER', 'scenario load failed'));
    }
    return this.accept(command, {
      changedPaths: ['scenario', 'conditions', 'mechanisms'],
      events: [{ id: `ev_scen_${this.revision}`, type: 'scenario.loaded', at: this.simTime }],
    });
  }

  private scenarioClearCommand(command: PatientCommand): CommandResult {
    this.clearScenario();
    return this.accept(command, { changedPaths: ['scenario', 'conditions'] });
  }

  private treatmentFluidBolus(command: PatientCommand): CommandResult {
    const auth = this.effectiveAuthority();
    if (auth.mayTreat && !auth.mayTreat.includes('intravenous-fluid')) {
      return this.reject(command, runtimeError('UNAUTHORISED_COMMAND', 'intravenous fluid not permitted in this scenario'));
    }
    const payload = (command.payload ?? {}) as FluidBolusPayload;
    const vol = Number(payload.volumeMl);
    if (!Number.isFinite(vol) || vol <= 0 || vol > 2000) {
      return this.reject(command, runtimeError('OUT_OF_RANGE', 'volumeMl must be in (0, 2000]', {
        path: 'payload.volumeMl',
        received: payload.volumeMl,
      }));
    }
    this.learnerBloodVolume = Math.min(7000, this.learnerBloodVolume + vol);
    this.opts.cardioHost?.postMessage({
      type: 'setParam',
      key: 'bloodVolume',
      value: this.learnerBloodVolume,
    });
    this.pushTimeline('treatment.fluid-bolus', `+${vol} mL → ${this.learnerBloodVolume} mL`);
    return this.accept(command, {
      changedPaths: ['cardiovascular.bloodVolume', 'treatment.fluid'],
    });
  }

  private treatmentVasopressor(command: PatientCommand): CommandResult {
    const auth = this.effectiveAuthority();
    if (auth.mayTreat && !auth.mayTreat.includes('vasopressor')) {
      return this.reject(command, runtimeError('UNAUTHORISED_COMMAND', 'vasopressor not permitted in this scenario'));
    }
    const payload = (command.payload ?? {}) as VasopressorPayload;
    const intensity = Number(payload.intensity);
    if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) {
      return this.reject(command, runtimeError('OUT_OF_RANGE', 'intensity must be in [0, 1]', {
        path: 'payload.intensity',
        received: payload.intensity,
      }));
    }
    this.channels.vasopressor = intensity;
    this.recomputeCardio();
    this.opts.projectChannels?.({ vasopressor: intensity });
    this.pushTimeline('treatment.vasopressor', `intensity ${intensity}`);
    return this.accept(command, { changedPaths: ['channels.vasopressor', 'treatment.vasopressor'] });
  }

  private effectiveAuthority(): ScenarioAuthority {
    if (this.scenarioAuthority) return this.scenarioAuthority;
    return {
      mayObserve: ['*'],
      mayTreat: ['intravenous-fluid', 'vasopressor'],
      mayUseExperimentalControls: this.opts.authority?.mayUseExperimentalControls !== false,
      mayReadLatentState: this.opts.authority?.mayReadLatentState !== false,
      mayAdvanceTime: this.opts.authority?.mayAdvanceTime !== false,
      mayAuthorConditions: this.opts.authority?.mayAuthorConditions !== false,
    };
  }

  /** Load a compiled scenario: apply authority, dispatch seed commands, arm triggers. */
  loadScenario(compiled: CompiledScenario): ScenarioLoadResult {
    const caps = this.describeCapabilities().capabilities;
    const recheck = compileScenario(compiled.definition, { availableCapabilities: caps });
    if (recheck.ok === false) {
      return {
        accepted: false,
        scenarioId: compiled.definition.id,
        version: compiled.definition.version,
        seedResults: [],
        error: recheck.error,
      };
    }

    // Transactional: silent checkpoint so rollback restores fingerprint without a timeline entry.
    const rollback = this.createCheckpoint(`pre-scenario-${recheck.compiled.definition.id}`, { silent: true });
    const priorFingerprint = { ...this.fingerprint.scenario };

    const init = recheck.compiled.definition.initialization ?? 'fresh-patient';
    this.clearScenario(true);
    if (init === 'fresh-patient') {
      this.experimentalControls = {};
      this.learnerBloodVolume = 5000;
      this.resetChemistry();
      this.channels = { ...DEFAULT_CHANNELS, K: this.chemistry.potassium, Ca: this.chemistry.calcium };
      this.commandLog = [];
      this.timeline = [];
      this.simTime = asSimTime(0);
      this.lastModelTimeSec = null;
    }

    this.compiledScenario = recheck.compiled;
    this.scenarioAuthority = { ...recheck.compiled.authority };
    this.fingerprint.scenario = {
      id: recheck.compiled.definition.id,
      version: recheck.compiled.definition.version,
    };

    // Apply authored patient profile to the host when present.
    const profile = recheck.compiled.definition.patient;
    if (profile && this.opts.cardioHost) {
      this.opts.cardioHost.postMessage({
        type: 'init',
        patient: {
          ageYears: profile.ageYears,
          sex: profile.sex,
          phenotypeProfile: 'adult_profile_017',
        },
      });
    }

    const seeds = materialiseSeedCommands(recheck.compiled, this.ids);
    const seedResults = seeds.map((cmd) => {
      const result = this.dispatch(cmd, systemSession());
      return { type: cmd.type, accepted: result.accepted };
    });

    if (seedResults.some((r) => !r.accepted)) {
      this.restoreCheckpoint(rollback);
      this.fingerprint.scenario = priorFingerprint;
      this.checkpoints.delete(rollback.id);
      return {
        accepted: false,
        scenarioId: recheck.compiled.definition.id,
        version: recheck.compiled.definition.version,
        seedResults,
        error: runtimeError('INVARIANT_VIOLATION', 'scenario seed command failed; state rolled back'),
      };
    }

    this.triggerRunner = new ScenarioTriggerRunner(this);
    this.triggerRunner.arm(recheck.compiled);
    this.triggerRunner.tick();
    this.checkpoints.delete(rollback.id);

    this.emit({
      type: 'scenario.loaded',
      revision: this.revision,
      simTime: this.simTime,
      detail: { scenarioId: recheck.compiled.definition.id },
    });

    return {
      accepted: true,
      scenarioId: recheck.compiled.definition.id,
      version: recheck.compiled.definition.version,
      seedResults,
    };
  }

  loadScenarioById(scenarioId: string): ScenarioLoadResult {
    const def = getScenario(scenarioId);
    if (!def) {
      return {
        accepted: false,
        scenarioId,
        version: '',
        seedResults: [],
        error: runtimeError('INVALID_PARAMETER', `Unknown scenario: ${scenarioId}`, {
          received: scenarioId,
          alternatives: listScenarios().map((s) => s.id),
        }),
      };
    }
    const compiled = compileScenario(def, {
      availableCapabilities: this.describeCapabilities().capabilities,
    });
    if (compiled.ok === false) {
      return {
        accepted: false,
        scenarioId,
        version: def.version,
        seedResults: [],
        error: compiled.error,
      };
    }
    return this.loadScenario(compiled.compiled);
  }

  clearScenario(resolveConditions = true): void {
    this.triggerRunner?.disarm();
    this.triggerRunner = null;
    this.compiledScenario = null;
    this.scenarioAuthority = null;
    this.scenarioAnnotations = [];
    if (resolveConditions) {
      this.conditions.clear();
      this.recomputeCardio();
      this.projectCordLevel();
    }
  }

  activeScenario(): CompiledScenario | null {
    return this.compiledScenario;
  }

  scenarioAnnotationList() {
    return [...this.scenarioAnnotations];
  }

  /** Used by ScenarioTriggerRunner for annotate actions. */
  recordScenarioAnnotation(id: string, label: string, detail?: unknown): void {
    this.scenarioAnnotations.push({
      id,
      label,
      detail,
      atMs: Number(this.simTime),
    });
    this.pushTimeline('scenario.annotation', label, detail);
    this.emit({
      type: 'scenario.annotation',
      revision: this.revision,
      simTime: this.simTime,
      detail: { id, label, detail },
    });
  }

  private applyHaemodynamicChemistry() {
    const { statePatch, active } = deriveChemistryFromHaemodynamics(
      this.cardiovascular,
      this.chemistryBaseline,
    );
    this.activeChemistryDerivations = active;
    for (const [k, v] of Object.entries(statePatch) as [keyof ChemistryPublicState, number][]) {
      if (this.chemistryPins.has(k)) continue;
      this.chemistry[k] = v;
    }
    this.projectChemistryChannels();
  }

  private projectChemistryChannels() {
    this.opts.projectChannels?.({
      K: this.chemistry.potassium,
      Ca: this.chemistry.calcium,
      pH: this.chemistry.arterialPH,
    });
  }

  private accept(
    command: PatientCommand,
    extra: Partial<CommandResult> = {},
  ): CommandResult {
    this.revision += 1;
    this.commandLog.push(command);
    const result: CommandResult = {
      accepted: true,
      revision: this.revision,
      commandId: command.id,
      ...extra,
    };
    this.emit({
      type: 'command.accepted',
      revision: this.revision,
      simTime: this.simTime,
      detail: { command, result },
    });
    return result;
  }

  private reject(command: PatientCommand, error: ReturnType<typeof runtimeError>): CommandResult {
    // Do not bump revision on rejection — rejected commands are not state transitions.
    const result: CommandResult = {
      accepted: false,
      revision: this.revision,
      commandId: command.id,
      error,
    };
    this.emit({
      type: 'command.rejected',
      revision: this.revision,
      simTime: this.simTime,
      detail: { command, result },
    });
    return result;
  }

  private pushTimeline(type: string, label: string, detail?: unknown) {
    this.timeline.push({
      id: `tl_${this.timeline.length}_${this.revision}`,
      at: this.simTime,
      type,
      label,
      detail,
    });
  }

  private emit(event: RuntimeListenerEvent) {
    for (const fn of this.listeners) {
      try { fn(event); } catch { /* isolate listener failures */ }
    }
  }
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createPatientRuntime(opts?: PatientRuntimeOptions): DefaultPatientRuntime {
  return new DefaultPatientRuntime(opts);
}

export { createCommandId };
