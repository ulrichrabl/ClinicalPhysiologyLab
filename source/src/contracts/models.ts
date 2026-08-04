export interface ModelManifest {
  id: string;
  version: string;
  system: string;
  fidelity: 'conceptual' | 'educational' | 'detailed';
  deterministic: boolean;
  consumes: string[];
  provides: string[];
  cadence: {
    preferredStepMs: number;
    maximumStepMs: number;
  };
  capabilities: string[];
  limitations: string[];
  stateSchemaVersion: string;
}
