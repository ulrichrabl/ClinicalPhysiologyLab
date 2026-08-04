import { derived, interpretABG } from '../../domains/labs/data/labs.js';
import { ANALYTES } from '../../domains/labs/data/labs.js';
import type { ChemistryPublicState } from '../../models/chemistry/public-state.ts';
import { chemistryToLabBag } from '../../models/chemistry/public-state.ts';

export interface AcidBaseInterpretation {
  steps: { step: string; finding: string; note: string }[];
  derived: {
    anionGap: number;
    anionGapCorrected: number;
    deltaRatio: number | null;
    osmolality: number;
    ureaCreatRatio: number | null;
  };
  primary: string;
  gapRaised: boolean;
}

/**
 * Interpretation layer: chemistry ground truth → clinical reading.
 * Distinct from the latent chemistry state and from the measured lab panel.
 */
export function interpretAcidBaseFromChemistry(chemistry: ChemistryPublicState): AcidBaseInterpretation {
  const bag = chemistryToLabBag(chemistry);
  const result = interpretABG(bag);
  return {
    steps: result.steps,
    derived: result.derived,
    primary: result.primary,
    gapRaised: result.gapRaised,
  };
}

export function deriveLabArithmetic(chemistry: ChemistryPublicState) {
  return derived(chemistryToLabBag(chemistry));
}

export function flagAnalyte(key: string, value: number | null | undefined): string {
  const a = ANALYTES[key];
  if (!a || value == null) return 'normal';
  const [lo, hi] = a.normal;
  const width = hi - lo || 1;
  if (value < lo) return value < lo - width * 0.5 ? 'low2' : 'low';
  if (value > hi) return value > hi + width * 0.8 ? 'high2' : 'high';
  return 'normal';
}
