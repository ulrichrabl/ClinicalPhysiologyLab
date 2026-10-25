import type { CaseDef, PatientState } from '../model/types.ts';
import type { RuntimeView } from './observe.ts';
import { findingsForNodes } from '../../domains/neuro/model/localize.js';
import { chemistryState } from '../physiology/chemistry.ts';
import type { RespSnapshot } from '../physiology/lung/respiratory.ts';
import type { BodySnapshot } from '../physiology/body/body.ts';

/**
 * Build what resolvers read from a case and the current model outputs.
 * In the app the circulation snapshot comes from the cardio host; in tests
 * from a headless run of the same model.
 */
export function buildView(
  caseDef: CaseDef,
  opts: { circulation?: Record<string, any>; chemistry?: Record<string, number>; respiratory?: RespSnapshot; state?: PatientState; minutes?: number } = {},
): RuntimeView {
  const lesions = caseDef.pathology.lesions ?? [];
  const nodes = [...new Set(lesions.flatMap((l) => l.nodes))];
  const complete = lesions.every((l) => l.complete !== false);
  const extent: Record<string, number> = {};
  for (const l of lesions) if (l.extent !== undefined) for (const n of l.nodes) extent[n] = l.extent;
  return {
    patient: caseDef.patient,
    state: opts.state ?? caseDef.initialState,
    circulation: opts.circulation,
    chemistry: opts.chemistry ?? (chemistryState(opts.circulation, caseDef.pathology.chemistry, opts.respiratory) as unknown as Record<string, number>),
    respiratory: opts.respiratory ?? (opts.circulation?.resp as RespSnapshot | undefined),
    body: opts.circulation?.body as BodySnapshot | undefined,
    neuro: nodes.length ? { nodes, complete, ...(Object.keys(extent).length ? { extent } : {}), findings: findingsForNodes(nodes, complete) as Array<Record<string, any>> } : undefined,
    conditions: caseDef.pathology.conditions,
    minutes: opts.minutes ?? 0,
  };
}
