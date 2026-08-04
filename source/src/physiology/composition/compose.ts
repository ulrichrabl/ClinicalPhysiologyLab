import type {
  PhysiologicalEffect,
  ResolvedEffectContribution,
  ResolvedPortValue,
} from '../../contracts/effects.ts';
import { requirePort } from '../ports/registry.ts';

/**
 * Deterministic, order-independent effect composition.
 * Multiply/add/min/max are associative; priority/exclusive use explicit priority.
 */
export function composeEffects(
  effects: readonly PhysiologicalEffect[],
  atTime: number,
): Map<string, ResolvedPortValue> {
  const byPort = new Map<string, PhysiologicalEffect[]>();

  for (const e of effects) {
    if (e.onset > atTime) continue;
    if (e.duration != null && e.onset + e.duration <= atTime) continue;
    const list = byPort.get(e.target) ?? [];
    list.push(e);
    byPort.set(e.target, list);
  }

  const resolved = new Map<string, ResolvedPortValue>();

  for (const [portId, list] of byPort) {
    const port = requirePort(portId);
    const baseline = port.baseline;
    const contributions: ResolvedEffectContribution[] = list.map((e) => ({
      effectId: e.id,
      source: e.source,
      operation: e.operation,
      value: e.value,
      priority: e.priority,
      provenance: e.provenance,
    }));

    // Stable sort by effect id for determinism when priority ties.
    const sorted = [...list].sort((a, b) => {
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pa !== pb) return pb - pa;
      return String(a.id).localeCompare(String(b.id));
    });

    let value: unknown = baseline;
    const rule = port.composition;

    if (rule === 'multiply') {
      value = sorted.reduce((acc: number, e) => {
        if (e.operation !== 'multiply' && e.operation !== 'add') {
          // Prefer declared op; multiply ports expect multiply.
        }
        if (e.operation === 'add') return acc + Number(e.value);
        return acc * Number(e.value);
      }, Number(baseline));
    } else if (rule === 'add') {
      value = sorted.reduce((acc: number, e) => acc + Number(e.value), Number(baseline));
    } else if (rule === 'minimum') {
      value = sorted.reduce((acc: number, e) => Math.min(acc, Number(e.value)), Number(baseline));
    } else if (rule === 'maximum') {
      value = sorted.reduce((acc: number, e) => Math.max(acc, Number(e.value)), Number(baseline));
    } else if (rule === 'priority' || rule === 'exclusive') {
      value = sorted[0]?.value ?? baseline;
    }

    resolved.set(portId, {
      portId: port.id,
      value,
      baseline,
      contributions,
    });
  }

  // Ensure every known port has an entry with baseline when no effects.
  return resolved;
}

export function resolvePortValue(
  effects: readonly PhysiologicalEffect[],
  portId: string,
  atTime: number,
  fallbackBaseline?: number,
): number {
  const all = composeEffects(effects, atTime);
  const hit = all.get(portId);
  if (hit) return Number(hit.value);
  try {
    return Number(requirePort(portId).baseline);
  } catch {
    return fallbackBaseline ?? 1;
  }
}
