/**
 * Bridges the legacy shared Patient object to the new Patient Runtime.
 *
 * Migration rule (spec §17.3): change communication contracts before broad
 * file moves. This facade lets the existing UI keep calling patient.set /
 * overridesFor while the C5 neurogenic-shock path is owned by the runtime.
 */
import {
  createPatientRuntime,
  createCommandId,
  type DefaultPatientRuntime,
  type PatientRuntimeOptions,
} from './patient-runtime.ts';
import type { PatientCommand } from '../contracts/commands.ts';

export interface LegacyPatientLike {
  get(k: string): unknown;
  set(k: string, v: unknown, source?: string): void;
  setMany(obj: Record<string, unknown>, source?: string): void;
  overridesFor(domain: string): Record<string, unknown>;
  activeCouplings(): unknown[];
  on(fn: (ev: unknown, state: unknown) => void): () => void;
  /** Attached at runtime. */
  runtime?: DefaultPatientRuntime;
}

/**
 * Attach a PatientRuntime to a legacy Patient and intercept cord-level writes
 * so they become condition.activate / condition.resolve commands.
 */
export function attachRuntimeToPatient(
  patient: LegacyPatientLike,
  opts: PatientRuntimeOptions = {},
): DefaultPatientRuntime {
  const runtime = createPatientRuntime(opts);
  patient.runtime = runtime;

  // When the legacy UI sets cordLevel, dispatch through the runtime.
  const originalSet = patient.set.bind(patient);
  patient.set = (k: string, v: unknown, source = 'user') => {
    if (k === 'cordLevel') {
      syncCordLevelToRuntime(runtime, v as string | null, source);
    }
    originalSet(k, v, source);
    return;
  };

  const originalSetMany = patient.setMany.bind(patient);
  patient.setMany = (obj: Record<string, unknown>, source = 'user') => {
    if ('cordLevel' in obj) {
      syncCordLevelToRuntime(runtime, obj.cordLevel as string | null, source);
    }
    originalSetMany(obj, source);
  };

  // Mirror runtime condition changes back onto the legacy channel.
  runtime.subscribe((ev) => {
    if (ev.type === 'command.accepted' || ev.type === 'checkpoint.restored') {
      const level = runtime.getActiveCordLevel();
      const current = patient.get('cordLevel');
      if (current !== level) {
        originalSet('cordLevel', level, 'runtime');
      }
    }
  });

  return runtime;
}

function syncCordLevelToRuntime(
  runtime: DefaultPatientRuntime,
  cordLevel: string | null,
  source: string,
): void {
  const src = mapSource(source);
  if (!cordLevel) {
    runtime.dispatch({
      id: createCommandId(),
      type: 'condition.resolve',
      payload: { condition: 'cervical-spinal-cord-injury' },
      source: src,
    });
    return;
  }
  runtime.dispatch({
    id: createCommandId(),
    type: 'condition.activate',
    payload: {
      condition: 'cervical-spinal-cord-injury',
      parameters: {
        level: cordLevel,
        completeness: 1,
        side: 'bilateral',
      },
    },
    source: src,
  });
}

function mapSource(source: string): PatientCommand['source'] {
  if (source === 'runtime' || source === 'system') return { type: 'system' };
  if (source === 'test') return { type: 'test', id: 'legacy-bridge' };
  if (source.startsWith('scenario')) return { type: 'scenario', id: source };
  return { type: 'ui', surface: source };
}

/**
 * Merge runtime-owned cardio overrides into the legacy overridesFor result.
 * Runtime effects replace the hard-coded neurogenic-shock coupling output.
 */
export function mergeRuntimeCardioOverrides(
  patient: LegacyPatientLike,
  legacyOverrides: Record<string, unknown>,
): Record<string, unknown> {
  const runtime = patient.runtime;
  if (!runtime) return legacyOverrides;

  const fromRuntime = runtime.cardioOverrides();
  if (!Object.keys(fromRuntime).length) {
    // Runtime has no driven neurogenic effects — strip legacy neurogenic keys
    // only when cordLevel is unset; otherwise fall through to legacy for
    // non-migrated couplings (Cushing, drugs, electrolytes).
    return legacyOverrides;
  }

  // Prefer runtime-translated private params for the keys it owns.
  const out = { ...legacyOverrides };
  for (const [k, v] of Object.entries(fromRuntime)) out[k] = v;
  return out;
}
