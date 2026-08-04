import type { ObservationId } from '../contracts/brands.ts';
import type {
  ObservationContext,
  ObservationModel,
  ObservationPlan,
  PatientStateProjection,
} from './types.ts';
import { observationShell } from './types.ts';
import {
  CHEMISTRY_TO_LAB_KEY,
  chemistryToLabBag,
  type ChemistryPublicState,
} from '../models/chemistry/public-state.ts';
import { ANALYTES, PANELS } from '../domains/labs/data/labs.js';
import {
  deriveLabArithmetic,
  flagAnalyte,
  interpretAcidBaseFromChemistry,
} from './interpretation/acid-base.ts';

export type LaboratoryPanelRequest = {
  type: 'observe.laboratory-panel';
  panel?: 'all' | 'abg' | 'chem' | 'fbc' | 'cardiac';
  includeInterpretation?: boolean;
};

export interface LaboratoryResultLine {
  key: string;
  label: string;
  value: number;
  unit: string;
  flag: string;
  reference: [number, number];
  source: 'chemistry' | 'physiology-derived' | 'pinned';
}

export interface LaboratoryPanelValue {
  panel: string;
  results: Record<string, number>;
  lines: LaboratoryResultLine[];
  derived: ReturnType<typeof deriveLabArithmetic>;
  interpretation?: ReturnType<typeof interpretAcidBaseFromChemistry>;
  /** Active physiology→chemistry links for the UI. */
  activeDerivations: { id: string; name: string; text: string; why: string; patch?: Record<string, number> }[];
}

export interface LaboratoryObservationInput extends PatientStateProjection {
  chemistry: ChemistryPublicState;
  chemistryPins: Set<string>;
  activeChemistryDerivations: { id: string; name: string; text: string; why: string; patch?: Record<string, number> }[];
}

/**
 * Laboratory panel observation: measures chemistry state into a clinical report
 * with flags and reference ranges. Does not mutate chemistry.
 */
export const laboratoryPanelObservation: ObservationModel<
  LaboratoryPanelRequest,
  LaboratoryPanelValue
> = {
  manifest: {
    id: 'observation.laboratory-panel.ideal',
    version: '1.0.0',
    observationType: 'observe.laboratory-panel',
    capabilities: ['observation.laboratory-panel', 'laboratory.acid-base'],
    idealByDefault: true,
  },

  canObserve() {
    return { ok: true };
  },

  observe(input: {
    patient: Readonly<LaboratoryObservationInput>;
    request: LaboratoryPanelRequest;
    context: ObservationContext;
    observationId: ObservationId;
  }): ObservationPlan<LaboratoryPanelValue> {
    const chemistry = input.patient.chemistry;
    const bag = chemistryToLabBag(chemistry);
    const panelId = input.request.panel ?? 'all';
    const panels = panelId === 'all' ? PANELS : PANELS.filter((p) => p.id === panelId);
    const keys = panels.flatMap((p) => p.keys);

    const physDriven = new Set<string>();
    for (const d of input.patient.activeChemistryDerivations) {
      if (d.patch) {
        for (const chemKey of Object.keys(d.patch)) {
          const labKey = CHEMISTRY_TO_LAB_KEY[chemKey as keyof ChemistryPublicState];
          if (labKey) physDriven.add(labKey);
        }
      }
      if (d.id === 'hypoperfusion-lactate') {
        physDriven.add('lactate'); physDriven.add('pH'); physDriven.add('HCO3');
      }
      if (d.id === 'haemorrhage-hb') physDriven.add('Hb');
      if (d.id === 'renal-perfusion') { physDriven.add('urea'); physDriven.add('creat'); }
      if (d.id === 'heart-failure-bnp') physDriven.add('BNP');
    }

    const pinSet = input.patient.chemistryPins;
    const lines: LaboratoryResultLine[] = [];
    for (const key of keys) {
      const a = ANALYTES[key];
      if (!a || bag[key] == null) continue;
      const chemField = Object.entries(CHEMISTRY_TO_LAB_KEY).find(([, lab]) => lab === key)?.[0];
      const pinned = pinSet.has(key) || (chemField != null && pinSet.has(chemField));
      lines.push({
        key,
        label: a.label,
        value: bag[key],
        unit: a.unit,
        flag: flagAnalyte(key, bag[key]),
        reference: a.normal as [number, number],
        source: pinned ? 'pinned' : physDriven.has(key) ? 'physiology-derived' : 'chemistry',
      });
    }

    const value: LaboratoryPanelValue = {
      panel: panelId,
      results: Object.fromEntries(keys.filter((k) => bag[k] != null).map((k) => [k, bag[k]])),
      lines,
      derived: deriveLabArithmetic(chemistry),
      activeDerivations: input.patient.activeChemistryDerivations,
    };
    if (input.request.includeInterpretation !== false) {
      value.interpretation = interpretAcidBaseFromChemistry(chemistry);
    }

    return {
      immediate: observationShell({
        id: input.observationId,
        type: 'observe.laboratory-panel',
        time: input.patient.simTime,
        value,
        provenance: {
          modelId: laboratoryPanelObservation.manifest.id,
          latentPaths: [
            'chemistry.*',
            'cardiovascular.meanArterialPressure',
            'cardiovascular.cardiacOutput',
            'cardiovascular.bloodVolume',
          ],
        },
        interpretation: value.interpretation?.gapRaised
          ? [{ id: 'raised-anion-gap', label: 'Raised anion gap' }]
          : undefined,
      }),
    };
  },
};
