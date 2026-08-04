import type {
  CausalEdge,
  CausalNode,
  ExplanationTrace,
  StateEvidence,
} from '../contracts/provenance.ts';
import type { ActiveConditionView } from '../contracts/queries.ts';
import type { ResolvedPortValue } from '../contracts/effects.ts';
import type { CardioPrivateParams, PublicPhysiologyView } from '../contracts/queries.ts';

export function buildNeurogenicShockExplanation(input: {
  observationId: string;
  condition: ActiveConditionView | null;
  resolved: Map<string, ResolvedPortValue>;
  privateParams: CardioPrivateParams;
  physiology: PublicPhysiologyView;
  /** When false, omit private adapter evidence and soften claims. */
  mayReadLatentState?: boolean;
}): ExplanationTrace {
  const sympathetic = Number(
    input.resolved.get('autonomic.sympatheticOutflow')?.value ?? 1,
  );
  const hasNeurogenic =
    !!input.condition
    || (input.physiology.neurological.cordLesionLevel != null && sympathetic < 0.5);

  if (!hasNeurogenic) {
    return {
      subject: { kind: 'observation', id: input.observationId },
      summary: 'Insufficient causal evidence for a neurogenic-shock explanation.',
      nodes: [{
        id: 'obs',
        kind: 'observation',
        label: summariseVitals(
          input.physiology.cardiovascular.meanArterialPressure,
          input.physiology.cardiovascular.heartRate,
        ),
      }],
      edges: [],
      evidence: [
        { path: 'cardiovascular.meanArterialPressure', value: input.physiology.cardiovascular.meanArterialPressure, unit: 'mmHg' },
        { path: 'cardiovascular.heartRate', value: input.physiology.cardiovascular.heartRate, unit: '/min' },
      ],
    };
  }

  const level = input.condition
    ? String(input.condition.parameters.level)
    : input.physiology.neurological.cordLesionLevel ?? 'unknown';
  const completeness = input.condition
    ? Number(input.condition.parameters.completeness ?? 1)
    : 1;
  const completeLabel = completeness >= 0.99 ? 'Complete' : 'Partial';

  const map = input.physiology.cardiovascular.meanArterialPressure;
  const hr = input.physiology.cardiovascular.heartRate;
  const co = input.physiology.cardiovascular.cardiacOutput;
  const pmsf = input.physiology.cardiovascular.meanFillingPressure;

  const coFell = co != null && co < 4.5;
  const fillingFell = pmsf != null && pmsf < 5.5;

  const nodes: CausalNode[] = [
    {
      id: 'obs',
      kind: 'observation',
      label: summariseVitals(map, hr),
      detail: 'Clinical vital-sign observation',
    },
  ];

  if (coFell) {
    nodes.push({
      id: 'co',
      kind: 'physiology',
      label: 'Cardiac output fell',
      detail: `CO ≈ ${co!.toFixed(1)} L/min`,
      refs: [{ kind: 'state', path: 'cardiovascular.cardiacOutput' }],
    });
  }

  if (fillingFell) {
    nodes.push({
      id: 'fill',
      kind: 'physiology',
      label: 'Mean filling pressure fell',
      detail: pmsf != null ? `Pmsf ≈ ${pmsf.toFixed(1)} mmHg` : 'Loss of venous tone',
      refs: [{ kind: 'state', path: 'cardiovascular.meanFillingPressure' }],
    });
  }

  nodes.push(
    {
      id: 'tone',
      kind: 'mechanism',
      label: 'Venous tone and sympathetic drive were lost',
      refs: [{ kind: 'mechanism', id: 'loss-of-sympathetic-outflow' }],
    },
    {
      id: 'pathways',
      kind: 'mechanism',
      label: 'Descending autonomic pathways were interrupted',
      refs: [{ kind: 'mechanism', id: 'loss-of-sympathetic-outflow' }],
    },
    {
      id: 'injury',
      kind: 'condition',
      label: `${completeLabel} ${level} spinal cord injury was activated`,
      refs: input.condition
        ? [{ kind: 'condition', id: input.condition.conditionId, version: input.condition.version }]
        : undefined,
    },
  );

  const edges: CausalEdge[] = [
    { from: 'injury', to: 'pathways', relation: 'causes' },
    { from: 'pathways', to: 'tone', relation: 'causes' },
  ];
  if (fillingFell) {
    edges.push({ from: 'tone', to: 'fill', relation: 'causes' });
    if (coFell) edges.push({ from: 'fill', to: 'co', relation: 'causes' });
  }
  if (coFell) edges.push({ from: 'co', to: 'obs', relation: 'causes' });
  edges.push({ from: 'tone', to: 'obs', relation: 'contributes' });

  const evidence: StateEvidence[] = [
    { path: 'neurological.cordLesionLevel', value: level },
    { path: 'vascular.systemicArteriolarTone', value: input.resolved.get('vascular.systemicArteriolarTone')?.value },
    { path: 'vascular.venousTone', value: input.resolved.get('vascular.venousTone')?.value },
    { path: 'autonomic.cardiacAcceleratorDrive', value: input.resolved.get('autonomic.cardiacAcceleratorDrive')?.value },
    { path: 'cardiovascular.meanArterialPressure', value: map, unit: 'mmHg' },
    { path: 'cardiovascular.heartRate', value: hr, unit: '/min' },
    { path: 'cardiovascular.cardiacOutput', value: co, unit: 'L/min' },
    { path: 'cardiovascular.meanFillingPressure', value: pmsf, unit: 'mmHg' },
  ];

  if (input.mayReadLatentState !== false) {
    evidence.push(
      { path: 'adapter.Rsys', value: input.privateParams.Rsys, unit: 'mmHg·s/mL' },
      { path: 'adapter.HR', value: input.privateParams.HR, unit: '/min' },
      { path: 'adapter.V0sv', value: input.privateParams.V0sv, unit: 'mL' },
      { path: 'adapter.baroEnabled', value: input.privateParams.baroEnabled },
    );
  }

  const summaryParts = [
    `Blood pressure ${fmtBp(input.physiology)}`,
    coFell ? 'because cardiac output fell' : null,
    fillingFell ? 'because mean filling pressure fell' : null,
    'because venous tone and sympathetic drive were lost',
    'because descending autonomic pathways were interrupted',
    `because a ${completeLabel.toLowerCase()} ${level} spinal cord injury was activated.`,
  ].filter(Boolean);

  return {
    subject: { kind: 'observation', id: input.observationId },
    summary: summaryParts.join(' '),
    nodes,
    edges,
    evidence,
  };
}

function summariseVitals(map: number | null, hr: number | null): string {
  const bits = [];
  if (map != null) bits.push(`MAP ${Math.round(map)} mmHg`);
  if (hr != null) bits.push(`HR ${Math.round(hr)}`);
  return bits.length ? bits.join(', ') : 'Vital signs';
}

function fmtBp(phys: PublicPhysiologyView): string {
  const map = phys.cardiovascular.meanArterialPressure;
  return map != null ? `fell (MAP ${Math.round(map)} mmHg)` : 'changed';
}
