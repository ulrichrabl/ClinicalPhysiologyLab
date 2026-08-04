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
}): ExplanationTrace {
  const level = input.condition
    ? String(input.condition.parameters.level)
    : input.physiology.neurological.cordLesionLevel ?? 'unknown';

  const map = input.physiology.cardiovascular.meanArterialPressure;
  const hr = input.physiology.cardiovascular.heartRate;
  const co = input.physiology.cardiovascular.cardiacOutput;

  const nodes: CausalNode[] = [
    {
      id: 'obs',
      kind: 'observation',
      label: summariseVitals(map, hr),
      detail: 'Clinical vital-sign observation',
    },
    {
      id: 'co',
      kind: 'physiology',
      label: 'Cardiac output fell',
      detail: co != null ? `CO ≈ ${co.toFixed(1)} L/min` : undefined,
      refs: [{ kind: 'state', path: 'cardiovascular.cardiacOutput' }],
    },
    {
      id: 'fill',
      kind: 'physiology',
      label: 'Ventricular filling fell',
      detail: 'Loss of venous tone lowers mean filling pressure',
      refs: [{ kind: 'state', path: 'cardiovascular.meanFillingPressure' }],
    },
    {
      id: 'tone',
      kind: 'mechanism',
      label: 'Venous tone and sympathetic drive were lost',
      detail: `arteriolar tone → Rsys ${input.privateParams.Rsys.toFixed(2)}; HR driven to ${input.privateParams.HR.toFixed(0)}`,
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
      label: `Complete ${level} spinal cord injury was activated`,
      refs: input.condition
        ? [{ kind: 'condition', id: input.condition.conditionId, version: input.condition.version }]
        : undefined,
    },
  ];

  const edges: CausalEdge[] = [
    { from: 'injury', to: 'pathways', relation: 'causes' },
    { from: 'pathways', to: 'tone', relation: 'causes' },
    { from: 'tone', to: 'fill', relation: 'causes' },
    { from: 'fill', to: 'co', relation: 'causes' },
    { from: 'co', to: 'obs', relation: 'causes' },
    { from: 'tone', to: 'obs', relation: 'contributes' },
  ];

  const evidence: StateEvidence[] = [
    { path: 'neurological.cordLesionLevel', value: level },
    { path: 'vascular.systemicArteriolarTone', value: input.resolved.get('vascular.systemicArteriolarTone')?.value },
    { path: 'vascular.venousTone', value: input.resolved.get('vascular.venousTone')?.value },
    { path: 'autonomic.cardiacAcceleratorDrive', value: input.resolved.get('autonomic.cardiacAcceleratorDrive')?.value },
    { path: 'adapter.Rsys', value: input.privateParams.Rsys, unit: 'mmHg·s/mL' },
    { path: 'adapter.HR', value: input.privateParams.HR, unit: '/min' },
    { path: 'adapter.V0sv', value: input.privateParams.V0sv, unit: 'mL' },
    { path: 'adapter.baroEnabled', value: input.privateParams.baroEnabled },
    { path: 'cardiovascular.meanArterialPressure', value: map, unit: 'mmHg' },
    { path: 'cardiovascular.heartRate', value: hr, unit: '/min' },
    { path: 'cardiovascular.cardiacOutput', value: co, unit: 'L/min' },
  ];

  return {
    subject: { kind: 'observation', id: input.observationId },
    summary:
      `Blood pressure ${fmtBp(input.physiology)} `
      + `because cardiac output fell because ventricular filling fell `
      + `because venous tone and sympathetic drive were lost `
      + `because descending autonomic pathways were interrupted `
      + `because a complete ${level} spinal cord injury was activated.`,
    nodes,
    edges,
    evidence,
    authoredNotes: [
      'Hypotension with relative bradycardia distinguishes neurogenic from haemorrhagic shock.',
    ],
  };
}

function summariseVitals(map: number | null, hr: number | null): string {
  const bp = map != null ? `MAP ${Math.round(map)} mmHg` : 'hypotension';
  const pulse = hr != null ? `HR ${Math.round(hr)} /min` : 'relative bradycardia';
  return `${bp}, ${pulse}`;
}

function fmtBp(p: PublicPhysiologyView): string {
  const s = p.cardiovascular.systolicPressure;
  const d = p.cardiovascular.diastolicPressure;
  if (s != null && d != null) return `${Math.round(s)}/${Math.round(d)} mmHg`;
  const m = p.cardiovascular.meanArterialPressure;
  if (m != null) return `MAP ${Math.round(m)} mmHg`;
  return 'is low';
}
