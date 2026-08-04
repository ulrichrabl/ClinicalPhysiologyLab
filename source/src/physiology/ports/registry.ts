import type { PhysiologicalPortId } from '../../contracts/brands.ts';
import type { PortDefinition } from '../../contracts/effects.ts';

function port(
  id: string,
  def: Omit<PortDefinition, 'id'>,
): PortDefinition {
  return { id: id as PhysiologicalPortId, ...def };
}

/** Public physiological ports. Models adapt these; clients never see private params. */
export const PHYSIOLOGICAL_PORTS: Record<string, PortDefinition> = {
  'autonomic.sympatheticOutflow': port('autonomic.sympatheticOutflow', {
    unit: 'fraction',
    physiologicalMeaning: 'Descending sympathetic drive to vessels and visceral beds',
    baseline: 1,
    composition: 'multiply',
    range: { min: 0, max: 2 },
  }),
  'autonomic.cardiacAcceleratorDrive': port('autonomic.cardiacAcceleratorDrive', {
    unit: 'fraction',
    physiologicalMeaning: 'T1–T4 cardiac accelerator fibre drive to the SA node and myocardium',
    baseline: 1,
    composition: 'multiply',
    range: { min: 0, max: 3 },
  }),
  'vascular.venousTone': port('vascular.venousTone', {
    unit: 'fraction',
    physiologicalMeaning: 'Sympathetic venoconstriction of the systemic venous reservoir',
    baseline: 1,
    composition: 'multiply',
    range: { min: 0, max: 2 },
  }),
  'vascular.systemicArteriolarTone': port('vascular.systemicArteriolarTone', {
    unit: 'fraction',
    physiologicalMeaning: 'Sympathetic arteriolar tone setting systemic vascular resistance',
    baseline: 1,
    composition: 'multiply',
    range: { min: 0, max: 3 },
  }),
  'cardiovascular.baroreflexEnabled': port('cardiovascular.baroreflexEnabled', {
    unit: 'boolean-as-0-1',
    physiologicalMeaning: 'Whether arterial baroreflex modulation of HR, resistance and capacitance is active',
    baseline: 1,
    composition: 'minimum',
    range: { min: 0, max: 1 },
  }),
  'cardiovascular.contractility': port('cardiovascular.contractility', {
    unit: 'fraction',
    physiologicalMeaning: 'Left-ventricular end-systolic elastance scale',
    baseline: 1,
    composition: 'multiply',
    range: { min: 0.2, max: 2 },
  }),
  'cardiovascular.avConduction': port('cardiovascular.avConduction', {
    unit: 'fraction',
    physiologicalMeaning: 'AV nodal conduction scale',
    baseline: 1,
    composition: 'multiply',
    range: { min: 0.2, max: 2 },
  }),
  'chemistry.extracellularPotassium': port('chemistry.extracellularPotassium', {
    unit: 'mmol/L',
    physiologicalMeaning: 'Extracellular potassium concentration',
    baseline: 4.0,
    composition: 'exclusive',
    range: { min: 1.5, max: 9 },
  }),
  'electrophysiology.stDurationFactor': port('electrophysiology.stDurationFactor', {
    unit: 'fraction',
    physiologicalMeaning: 'Action-potential plateau / ST-segment duration scale',
    baseline: 1,
    composition: 'exclusive',
    range: { min: 0.3, max: 2.5 },
  }),
};

export function getPort(id: string): PortDefinition | undefined {
  return PHYSIOLOGICAL_PORTS[id];
}

export function requirePort(id: string): PortDefinition {
  const p = getPort(id);
  if (!p) throw new Error(`Unknown physiological port: ${id}`);
  return p;
}

export const PORT_IDS = Object.keys(PHYSIOLOGICAL_PORTS) as PhysiologicalPortId[];
