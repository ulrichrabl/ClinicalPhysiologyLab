import type { ResolvedPortValue } from '../../contracts/effects.ts';
import type { CardioPrivateParams } from '../../contracts/queries.ts';
import { NEUROGENIC_COMPLETE_PORTS } from '../../physiology/mechanisms/neurogenic-shock.ts';

/**
 * Baseline private parameters of the current circulation implementation.
 * Only this adapter may mention these names.
 */
export const CIRCULATION_BASELINE = {
  Rsys: 1.05,
  HR: 72,
  V0sv: 3200,
  Emax: 2.7,
  avConduction: 1,
  baroEnabled: true,
  K: 4.0,
  stFactor: 1,
} as const;

/** Validated complete bilateral neurogenic-shock private targets.
 *  V0sv rises with loss of venous tone (pooling / ↑ unstressed volume).
 *  The previous 2900 mL target was physiologically reversed. */
export const NEUROGENIC_COMPLETE_TARGETS = {
  Rsys: 0.52,
  HR: 52,
  V0sv: 3500,
  baroEnabled: false,
  ports: NEUROGENIC_COMPLETE_PORTS,
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
 * Translate public physiological port values into Circulation private params.
 *
 * Scaling is intentional and simple:
 *   Rsys = baseline.Rsys × arteriolarTone
 *   HR   = baseline.HR   × cardiacAcceleratorDrive
 *   Emax = baseline.Emax × contractility
 *   av   = baseline.av   × avConduction
 * Venous tone maps unstressed venous volume: loss of tone → V0sv rises
 * (pooling). Complete neurogenic → 3500 mL.
 */
export function adaptCardioPrivateParams(
  resolved: Map<string, ResolvedPortValue>,
): CardioPrivateParams {
  const arteriolar = portNumber(resolved, 'vascular.systemicArteriolarTone', 1);
  const venous = portNumber(resolved, 'vascular.venousTone', 1);
  const cardiac = portNumber(resolved, 'autonomic.cardiacAcceleratorDrive', 1);
  const baroGate = portNumber(resolved, 'cardiovascular.baroreflexEnabled', 1);
  const contractility = portNumber(resolved, 'cardiovascular.contractility', 1);
  const avConduction = portNumber(resolved, 'cardiovascular.avConduction', 1);
  const K = portNumber(resolved, 'chemistry.extracellularPotassium', CIRCULATION_BASELINE.K);
  const stFactor = portNumber(resolved, 'electrophysiology.stDurationFactor', 1);

  const Rsys = CIRCULATION_BASELINE.Rsys * arteriolar;
  const HR = CIRCULATION_BASELINE.HR * cardiac;
  const Emax = CIRCULATION_BASELINE.Emax * contractility;

  const venTarget = NEUROGENIC_COMPLETE_PORTS['vascular.venousTone'];
  const V0sv = mapLinear(
    venous,
    1,
    venTarget,
    CIRCULATION_BASELINE.V0sv,
    NEUROGENIC_COMPLETE_TARGETS.V0sv,
  );

  const baroEnabled = baroGate >= 0.5;

  const driven = new Set<string>();
  if (Math.abs(Rsys - CIRCULATION_BASELINE.Rsys) > 1e-9) driven.add('Rsys');
  if (Math.abs(HR - CIRCULATION_BASELINE.HR) > 1e-9) driven.add('HR');
  if (Math.abs(V0sv - CIRCULATION_BASELINE.V0sv) > 1e-9) driven.add('V0sv');
  if (Math.abs(Emax - CIRCULATION_BASELINE.Emax) > 1e-9) driven.add('Emax');
  if (Math.abs(avConduction - CIRCULATION_BASELINE.avConduction) > 1e-9) driven.add('avConduction');
  if (baroEnabled !== CIRCULATION_BASELINE.baroEnabled) driven.add('baroEnabled');
  if (Math.abs(K - CIRCULATION_BASELINE.K) > 1e-9) driven.add('K');
  if (Math.abs(stFactor - 1) > 1e-9) driven.add('stFactor');

  return {
    Rsys,
    HR,
    V0sv,
    baroEnabled,
    drivenKeys: [...driven],
    provenance: [...resolved.entries()].map(([portId, v]) => ({
      portId,
      value: v.value,
      contributions: v.contributions.length,
    })),
    // Extended fields consumed by applyCardioAdapterToHost
    Emax,
    avConduction,
    K,
    stFactor,
  } as CardioPrivateParams & {
    Emax: number;
    avConduction: number;
    K: number;
    stFactor: number;
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
  const tc = Math.max(0, Math.min(1, t));
  return y0 + (y1 - y0) * tc;
}

/**
 * Apply adapted private params to a live circulation host.
 */
export function applyCardioAdapterToHost(
  host: { postMessage: (m: unknown) => void },
  params: CardioPrivateParams,
  previousDriven: Set<string>,
  defaults: Record<string, number | boolean> = CIRCULATION_BASELINE,
): { sent: Record<string, number | boolean>; driven: Set<string> } {
  const sent: Record<string, number | boolean> = {};
  const driven = new Set(params.drivenKeys);
  const bag = params as CardioPrivateParams & Record<string, number | boolean | undefined>;

  for (const key of previousDriven) {
    if (driven.has(key)) continue;
    if (key === 'baroEnabled') {
      host.postMessage({ type: 'setBaro', value: defaults.baroEnabled ?? true });
    } else if (key === 'stFactor') {
      host.postMessage({ type: 'setParam', key: 'stFactor', value: 1 });
    } else if (key in defaults) {
      sent[key] = defaults[key] as number;
    }
  }

  for (const key of ['Rsys', 'HR', 'V0sv', 'Emax', 'avConduction', 'K'] as const) {
    if (driven.has(key) && bag[key] != null) sent[key] = bag[key] as number;
  }

  if (Object.keys(sent).length) {
    host.postMessage({ type: 'setParams', values: sent });
  }
  if (driven.has('stFactor') && bag.stFactor != null) {
    host.postMessage({ type: 'setParam', key: 'stFactor', value: bag.stFactor as number });
  }
  if (driven.has('baroEnabled')) {
    host.postMessage({ type: 'setBaro', value: params.baroEnabled });
  }

  return { sent, driven };
}
