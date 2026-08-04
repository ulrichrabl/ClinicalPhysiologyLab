import type { ResolvedPortValue } from '../../contracts/effects.ts';
import type { CardioPrivateParams } from '../../contracts/queries.ts';

/**
 * Baseline private parameters of the current circulation implementation.
 * The adapter is the only place that knows these names.
 */
export const CIRCULATION_BASELINE = {
  Rsys: 1.05,
  HR: 72,
  V0sv: 3200,
  baroEnabled: true,
} as const;

/**
 * Validated complete bilateral neurogenic-shock private targets
 * (preserved from the legacy `neurogenic-shock` coupling).
 */
export const NEUROGENIC_COMPLETE_TARGETS = {
  Rsys: 0.52,
  HR: 52,
  V0sv: 2900,
  baroEnabled: false,
  /** Public port values that produce these private targets when severity = 1. */
  ports: {
    'autonomic.sympatheticOutflow': 0.15,
    'autonomic.cardiacAcceleratorDrive': 0,
    'vascular.venousTone': 0.25,
    'vascular.systemicArteriolarTone': 0.45,
    'cardiovascular.baroreflexEnabled': 0,
  },
} as const;

function portNumber(
  resolved: Map<string, ResolvedPortValue>,
  id: string,
  fallback: number,
): number {
  const hit = resolved.get(id);
  return hit != null ? Number(hit.value) : fallback;
}

/**
 * Translate public physiological port values into the private parameter set
 * understood by the existing Circulation model.
 *
 * Calibration: when the neurogenic-shock mechanism emits its complete-bilateral
 * port values, private params match the legacy coupling exactly (Rsys 0.52, …).
 * Intermediate severities interpolate linearly in public-port space, then map.
 */
export function adaptCardioPrivateParams(
  resolved: Map<string, ResolvedPortValue>,
): CardioPrivateParams {
  const arteriolar = portNumber(resolved, 'vascular.systemicArteriolarTone', 1);
  const venous = portNumber(resolved, 'vascular.venousTone', 1);
  const cardiac = portNumber(resolved, 'autonomic.cardiacAcceleratorDrive', 1);
  const baroGate = portNumber(resolved, 'cardiovascular.baroreflexEnabled', 1);

  const artTarget = NEUROGENIC_COMPLETE_TARGETS.ports['vascular.systemicArteriolarTone'];
  const venTarget = NEUROGENIC_COMPLETE_TARGETS.ports['vascular.venousTone'];
  const cardTarget = NEUROGENIC_COMPLETE_TARGETS.ports['autonomic.cardiacAcceleratorDrive'];

  // Map arteriolar tone → Rsys so tone=0.45 → 0.52 and tone=1 → 1.05
  const Rsys = mapLinear(
    arteriolar,
    1,
    artTarget,
    CIRCULATION_BASELINE.Rsys,
    NEUROGENIC_COMPLETE_TARGETS.Rsys,
  );

  // Map venous tone → V0sv so tone=0.25 → 2900 and tone=1 → 3200
  const V0sv = mapLinear(
    venous,
    1,
    venTarget,
    CIRCULATION_BASELINE.V0sv,
    NEUROGENIC_COMPLETE_TARGETS.V0sv,
  );

  // Map cardiac accelerator → HR so drive=0 → 52 and drive=1 → 72
  const HR = mapLinear(
    cardiac,
    1,
    cardTarget,
    CIRCULATION_BASELINE.HR,
    NEUROGENIC_COMPLETE_TARGETS.HR,
  );

  const baroEnabled = baroGate >= 0.5;

  const driven = new Set<string>();
  if (Math.abs(Rsys - CIRCULATION_BASELINE.Rsys) > 1e-9) driven.add('Rsys');
  if (Math.abs(HR - CIRCULATION_BASELINE.HR) > 1e-9) driven.add('HR');
  if (Math.abs(V0sv - CIRCULATION_BASELINE.V0sv) > 1e-9) driven.add('V0sv');
  if (baroEnabled !== CIRCULATION_BASELINE.baroEnabled) driven.add('baroEnabled');

  const provenance = [...resolved.entries()].map(([portId, v]) => ({
    portId,
    value: v.value,
    contributions: v.contributions.length,
  }));

  return {
    Rsys,
    HR,
    V0sv,
    baroEnabled,
    drivenKeys: [...driven],
    provenance,
  };
}

function mapLinear(
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number {
  if (Math.abs(x1 - x0) < 1e-12) return y0;
  const t = (x - x0) / (x1 - x0);
  // Clamp extrapolation for safety; composition should keep x in [min(x0,x1), max].
  const tc = Math.max(0, Math.min(1, t));
  return y0 + (y1 - y0) * tc;
}

export interface CirculationModelHandle {
  setParams(values: Record<string, number | boolean>): void;
  settle(seconds: number): Record<string, number> | null;
  snapshot(): Record<string, number> | null;
  reset(): void;
}

/**
 * Apply adapted private params to a live circulation host (worker or in-page).
 * Returns the parameter bag that was sent — useful for tests and undo tracking.
 */
export function applyCardioAdapterToHost(
  host: { postMessage: (m: unknown) => void },
  params: CardioPrivateParams,
  previousDriven: Set<string>,
  defaults: Record<string, number | boolean> = CIRCULATION_BASELINE,
): { sent: Record<string, number | boolean>; driven: Set<string> } {
  const sent: Record<string, number | boolean> = {};
  const driven = new Set(params.drivenKeys);

  for (const key of previousDriven) {
    if (driven.has(key)) continue;
    if (key === 'baroEnabled') {
      host.postMessage({ type: 'setBaro', value: defaults.baroEnabled ?? true });
    } else if (key in defaults) {
      sent[key] = defaults[key] as number;
    }
  }

  if (driven.has('Rsys')) sent.Rsys = params.Rsys;
  if (driven.has('HR')) sent.HR = params.HR;
  if (driven.has('V0sv')) sent.V0sv = params.V0sv;

  if (Object.keys(sent).length) {
    host.postMessage({ type: 'setParams', values: sent });
  }
  if (driven.has('baroEnabled')) {
    host.postMessage({ type: 'setBaro', value: params.baroEnabled });
  } else if (previousDriven.has('baroEnabled') && !driven.has('baroEnabled')) {
    // already restored above
  }

  return { sent, driven };
}
