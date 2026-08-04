import type {
  AdvanceResult,
  CheckpointRef,
  Observation,
  ObservationRequest,
  ObservationResult,
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
  CommandResult,
  PatientCommand,
  ResolveConditionPayload,
} from '../contracts/commands.ts';
import type { PatientRuntime } from '../contracts/index.ts';
import type { PhysiologicalEffect } from '../contracts/effects.ts';
import type { SimDuration, SimTime } from '../contracts/brands.ts';
import {
  asSimDuration,
  asSimTime,
  createCheckpointId,
  createCommandId,
  createObservationId,
} from '../contracts/brands.ts';
import { runtimeError } from '../contracts/errors.ts';
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

const RUNTIME_VERSION = '0.1.0';

export interface PatientRuntimeOptions {
  seed?: string;
  scenario?: { id: string; version: string };
  /** Optional live circulation host (worker / in-page). */
  cardioHost?: { postMessage: (m: unknown) => void } | null;
  cardioDefaults?: Record<string, number | boolean>;
  /** Headless settle function for tests — receives private params, returns snapshot. */
  settlePhysiology?: (
    params: ReturnType<typeof adaptCardioPrivateParams>,
    seconds: number,
  ) => Record<string, number> | null;
  authority?: {
    mayAuthorConditions?: boolean;
    mayUseExperimentalControls?: boolean;
    mayReadLatentState?: boolean;
    mayAdvanceTime?: boolean;
  };
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
}

export class DefaultPatientRuntime implements PatientRuntime {
  readonly fingerprint: RuntimeFingerprint;
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

  constructor(opts: PatientRuntimeOptions = {}) {
    this.opts = opts;
    this.randomState = hashSeed(opts.seed ?? 'cpl-default-seed');
    this.fingerprint = {
      runtimeVersion: RUNTIME_VERSION,
      scenario: opts.scenario ?? { id: 'ad-hoc', version: '0.0.0' },
      models: [
        {
          id: 'cardiovascular.circulation.current',
          version: '1.0.0',
          stateSchemaVersion: '1',
          configurationHash: 'baseline-rsys-1.05',
        },
      ],
      seed: opts.seed ?? 'cpl-default-seed',
    };
  }

  /* ---- public API ----------------------------------------------------- */

  dispatch(command: PatientCommand): CommandResult {
    if (command.expectedRevision != null && command.expectedRevision !== this.revision) {
      return this.reject(command, runtimeError(
        'COMMAND_CONFLICT',
        `expected revision ${command.expectedRevision}, current is ${this.revision}`,
      ));
    }

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
        this.advance(asSimDuration(ms));
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
            'runtime.advance',
            'runtime.pause',
            'runtime.resume',
            'runtime.reset',
            'checkpoint.restore',
          ],
        }));
    }
  }

  query<Q extends RuntimeQuery>(query: Q): QueryResult<Q> {
    const resolved = this.resolvedEffects();
    const privateParams = adaptCardioPrivateParams(resolved);

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
          return {
            time: this.simTime,
            vitals: this.vitalsValue(),
            activeConditions: this.query({ type: 'conditions.active' }),
            appearance: this.appearanceFromState(),
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
        return this.publicPhysiology() as QueryResult<Q>;
      }
      case 'timeline.range':
        return this.timeline.filter((e) => e.at >= query.from && e.at <= query.to) as QueryResult<Q>;
      case 'explanation.vitals':
      case 'explanation.for': {
        const cond = [...this.conditions.values()][0] ?? null;
        const obsId = query.type === 'explanation.for' ? query.observationId : createObservationId('vitals');
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
        }) as QueryResult<Q>;
      }
      default:
        return null as QueryResult<Q>;
    }
  }

  observe<R extends ObservationRequest>(request: R): ObservationResult<R> {
    const id = createObservationId(request.type.replace(/\./g, '_'));
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

    if (request.type === 'observe.vital-signs') {
      const value = this.vitalsValue();
      const interpretation = [];
      if (value.bloodPressure.mean != null && value.bloodPressure.mean < 65) {
        interpretation.push({ id: 'hypotension', label: 'Hypotension' });
      }
      if (
        value.heartRate != null
        && value.heartRate < 60
        && value.bloodPressure.mean != null
        && value.bloodPressure.mean < 70
      ) {
        interpretation.push({ id: 'relative-bradycardia', label: 'Relative bradycardia' });
      }
      if (interpretation.some((i) => i.id === 'hypotension')
        && interpretation.some((i) => i.id === 'relative-bradycardia')) {
        interpretation.push({ id: 'neurogenic-shock-pattern', label: 'Neurogenic shock pattern' });
      }
      return {
        ...base,
        type: 'observe.vital-signs',
        value,
        interpretation,
      } as ObservationResult<R>;
    }

    if (request.type === 'observe.general-appearance') {
      return {
        ...base,
        type: 'observe.general-appearance',
        value: this.appearanceFromState(),
      } as ObservationResult<R>;
    }

    if (request.type === 'observe.physiology') {
      return {
        ...base,
        type: 'observe.physiology',
        value: this.publicPhysiology() as unknown as Record<string, unknown>,
      } as ObservationResult<R>;
    }

    if (request.type === 'perform.examination') {
      const findings: string[] = [];
      const cord = this.publicPhysiology().neurological.cordLesionLevel;
      if (request.exam === 'pulse' || request.exam === 'cardiovascular') {
        const v = this.vitalsValue();
        if (v.heartRate != null && v.heartRate < 60) findings.push('Bradycardic pulse');
        if (v.bloodPressure.mean != null && v.bloodPressure.mean < 70) findings.push('Hypotension');
        findings.push('Warm, dry peripheries (loss of sympathetic vasoconstriction)');
      }
      if (request.exam === 'neurological' && cord) {
        findings.push(`Motor and sensory level consistent with ${cord}`);
      }
      return {
        ...base,
        type: 'perform.examination',
        value: { exam: request.exam, findings },
      } as ObservationResult<R>;
    }

    return {
      ...base,
      type: (request as ObservationRequest).type,
      value: {},
    } as ObservationResult<R>;
  }

  advance(duration: SimDuration): AdvanceResult {
    const from = this.simTime;
    const seconds = Number(duration) / 1000;
    const privateParams = adaptCardioPrivateParams(this.resolvedEffects());
    this.pushCardioParams(privateParams);

    if (this.opts.settlePhysiology) {
      this.lastSnap = this.opts.settlePhysiology(privateParams, Math.max(seconds, 0.001));
    } else if (this.opts.cardioHost && seconds > 0) {
      this.opts.cardioHost.postMessage({ type: 'settle', seconds });
    }

    this.simTime = asSimTime(Number(from) + Number(duration));
    const events: TimelineEntry[] = [];
    if (seconds > 0) {
      events.push({
        id: `adv_${this.revision}`,
        at: this.simTime,
        type: 'runtime.advanced',
        label: `Advanced ${seconds.toFixed(2)} s`,
      });
      this.timeline.push(...events);
    }
    this.emit({ type: 'runtime.advanced', revision: this.revision, simTime: this.simTime });
    return {
      from,
      to: this.simTime,
      publicPhysiology: this.publicPhysiology(),
      events,
    };
  }

  play(): void {
    this.playing = true;
    this.opts.cardioHost?.postMessage({ type: 'play' });
    this.emit({ type: 'runtime.playing', revision: this.revision, simTime: this.simTime });
  }

  pause(): void {
    this.playing = false;
    this.opts.cardioHost?.postMessage({ type: 'pause' });
    this.emit({ type: 'runtime.paused', revision: this.revision, simTime: this.simTime });
  }

  createCheckpoint(label?: string): CheckpointRef {
    const id = createCheckpointId();
    const snap: CheckpointSnapshot = {
      id,
      label,
      createdAt: this.simTime,
      revision: this.revision,
      simTime: this.simTime,
      conditions: structuredClone([...this.conditions.values()]),
      commandLog: structuredClone(this.commandLog),
      lastSnap: this.lastSnap ? { ...this.lastSnap } : null,
      randomState: this.randomState,
    };
    this.checkpoints.set(id, snap);
    this.pushTimeline('checkpoint.created', label ?? id);
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
    this.lastSnap = snap.lastSnap ? { ...snap.lastSnap } : null;
    this.randomState = snap.randomState;
    this.prevCardioDriven = new Set();
    this.pushCardioParams(adaptCardioPrivateParams(this.resolvedEffects()));
    this.pushTimeline('checkpoint.restored', id);
    this.emit({ type: 'checkpoint.restored', revision: this.revision, simTime: this.simTime, detail: { id } });
    return { accepted: true, revision: this.revision };
  }

  branch(ref: CheckpointRef | string, label?: string): RuntimeBranch {
    const restored = this.restoreCheckpoint(ref);
    const id = `branch_${createCheckpointId()}`;
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
        'neurological-examination',
        'cardiovascular-examination',
      ],
      experimentalControls: [
        'autonomic.sympatheticOutflow',
        'vascular.venousTone',
        'cardiovascular.baroreflex',
      ],
      capabilities: [
        'cardiovascular.closed-loop',
        'cardiovascular.autonomic-input',
        'neurology.pathway-localisation',
        'observation.vital-signs',
      ],
    };
  }

  subscribe(listener: RuntimeListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Allow the UI/sim host to publish the latest haemodynamic snapshot. */
  ingestCardioSnapshot(snap: Record<string, number>): void {
    this.lastSnap = snap;
  }

  /** Bind (or re-bind) the live circulation host after the domain boots. */
  bindCardioHost(
    host: { postMessage: (m: unknown) => void } | null,
    defaults?: Record<string, number | boolean>,
  ): void {
    this.opts.cardioHost = host;
    if (defaults) this.opts.cardioDefaults = defaults;
    this.pushCardioParams(adaptCardioPrivateParams(this.resolvedEffects()));
  }

  /** Cardio private params for the legacy overridesFor bridge. */
  cardioOverrides(): Record<string, number | boolean> {
    const p = adaptCardioPrivateParams(this.resolvedEffects());
    if (!p.drivenKeys.length) return {};
    const out: Record<string, number | boolean> = {};
    if (p.drivenKeys.includes('Rsys')) out.Rsys = p.Rsys;
    if (p.drivenKeys.includes('HR')) out.HR = p.HR;
    if (p.drivenKeys.includes('V0sv')) out.V0sv = p.V0sv;
    if (p.drivenKeys.includes('baroEnabled')) out.baroEnabled = p.baroEnabled;
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

    const instanceId = payload.instanceId ?? `cond_${createCommandId()}`;
    const instance = def.initialise(payload.parameters, {
      simTime: this.simTime,
      instanceId,
    });
    this.conditions.set(instanceId, instance);

    const mechanisms = def.resolve(instance, this.simTime);
    this.pushCardioParams(adaptCardioPrivateParams(this.resolvedEffects()));
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
        this.pushCardioParams(adaptCardioPrivateParams(this.resolvedEffects()));
        return this.accept(command, { changedPaths: ['conditions'] });
      }
      return this.reject(command, runtimeError('INVALID_PARAMETER', 'No matching active condition', {
        received: payload,
      }));
    }
    this.pushCardioParams(adaptCardioPrivateParams(this.resolvedEffects()));
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
    return out;
  }

  private allEffects(): PhysiologicalEffect[] {
    return this.collectMechanisms().flatMap((m) => m.effects);
  }

  private resolvedEffects() {
    return composeEffects(this.allEffects(), this.simTime);
  }

  private pushCardioParams(params: ReturnType<typeof adaptCardioPrivateParams>) {
    if (this.opts.cardioHost) {
      const { driven } = applyCardioAdapterToHost(
        this.opts.cardioHost,
        params,
        this.prevCardioDriven,
        this.opts.cardioDefaults ?? CIRCULATION_BASELINE,
      );
      this.prevCardioDriven = driven;
    } else if (!params.drivenKeys.length) {
      this.prevCardioDriven = new Set();
    } else {
      this.prevCardioDriven = new Set(params.drivenKeys);
    }
  }

  private publicPhysiology(): PublicPhysiologyView {
    const resolved = this.resolvedEffects();
    const snap = this.lastSnap;
    const cord = this.getActiveCordLevel();
    const cond = [...this.conditions.values()][0];
    return {
      cardiovascular: {
        meanArterialPressure: snap?.Pmean ?? null,
        systolicPressure: snap?.Psys ?? null,
        diastolicPressure: snap?.Pdia ?? null,
        heartRate: snap?.HR ?? null,
        cardiacOutput: snap?.CO ?? null,
        centralVenousPressure: snap?.CVP ?? null,
        meanFillingPressure: snap?.Pmsf ?? null,
        ejectionFraction: snap?.EF ?? null,
      },
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

  private vitalsValue(): VitalSignsValue {
    const p = this.publicPhysiology().cardiovascular;
    let pattern: string | undefined;
    if (p.meanArterialPressure != null && p.meanArterialPressure < 70
      && p.heartRate != null && p.heartRate < 60) {
      pattern = 'hypotension-with-relative-bradycardia';
    }
    return {
      heartRate: p.heartRate,
      bloodPressure: {
        systolic: p.systolicPressure,
        diastolic: p.diastolicPressure,
        mean: p.meanArterialPressure,
      },
      cardiacOutput: p.cardiacOutput,
      pattern,
    };
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
    this.conditions.clear();
    this.commandLog = [];
    this.timeline = [];
    this.simTime = asSimTime(0);
    this.lastSnap = null;
    this.prevCardioDriven = new Set();
    this.opts.cardioHost?.postMessage({ type: 'reset' });
    this.revision += 1;
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
    this.revision += 1;
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
