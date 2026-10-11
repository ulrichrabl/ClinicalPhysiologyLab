import type { CaseDef, PatientState } from '../model/types.ts';
import type { RuntimeView } from './observe.ts';
import { findingsForNodes } from '../../domains/neuro/model/localize.js';

/**
 * Build what resolvers read from a case and the current model outputs.
 * In the app the circulation snapshot comes from the cardio host; in tests
 * from a headless run of the same model.
 */
export function buildView(
  caseDef: CaseDef,
  opts: { circulation?: Record<string, any>; chemistry?: Record<string, number>; state?: PatientState; minutes?: number } = {},
): RuntimeView {
  const lesions = caseDef.pathology.lesions ?? [];
  const nodes = [...new Set(lesions.flatMap((l) => l.nodes))];
  const complete = lesions.every((l) => l.complete !== false);
  return {
    patient: caseDef.patient,
    state: opts.state ?? caseDef.initialState,
    circulation: opts.circulation,
    chemistry: opts.chemistry,
    neuro: nodes.length ? { nodes, complete, findings: findingsForNodes(nodes, complete) as Array<Record<string, any>> } : undefined,
    conditions: caseDef.pathology.conditions,
    minutes: opts.minutes ?? 0,
  };
}
