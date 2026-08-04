export type CausalReference =
  | { kind: 'command'; id: string }
  | { kind: 'condition'; id: string; version?: string }
  | { kind: 'mechanism'; id: string }
  | { kind: 'effect'; id: string }
  | { kind: 'model'; id: string; path?: string }
  | { kind: 'state'; path: string }
  | { kind: 'observation'; id: string }
  | { kind: 'authored'; noteId: string };

export type EffectSource =
  | { type: 'condition'; conditionId: string; instanceId: string }
  | { type: 'intervention'; interventionId: string }
  | { type: 'experimental'; controlId: string }
  | { type: 'regulatory'; systemId: string }
  | { type: 'scenario'; scenarioId: string };

export interface CausalNode {
  id: string;
  kind: CausalReference['kind'] | 'physiology' | 'summary';
  label: string;
  detail?: string;
  refs?: CausalReference[];
}

export interface CausalEdge {
  from: string;
  to: string;
  relation: 'causes' | 'contributes' | 'observes' | 'interprets';
}

export interface StateEvidence {
  path: string;
  value: unknown;
  unit?: string;
}

export interface ExplanationTrace {
  subject: { kind: 'observation' | 'state' | 'event'; id: string };
  summary: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  evidence: StateEvidence[];
  authoredNotes?: string[];
}
