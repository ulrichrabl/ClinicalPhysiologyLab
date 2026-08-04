/**
 * Canonical chemistry / haematology public state.
 * Distinct from laboratory observations (what was measured) and interpretations.
 */

export interface ChemistryPublicState {
  potassium: number;
  calcium: number;
  sodium: number;
  chloride: number;
  glucose: number;
  albumin: number;
  urea: number;
  creatinine: number;
  magnesium: number;
  arterialPH: number;
  paCO2: number;
  paO2: number;
  bicarbonate: number;
  lactate: number;
  haemoglobin: number;
  mcv: number;
  whiteCellCount: number;
  platelets: number;
  troponin: number;
  bnp: number;
}

/** Keys that physiology may overwrite unless the learner has pinned them. */
export const PHYSIOLOGY_DERIVED_KEYS: (keyof ChemistryPublicState)[] = [
  'lactate',
  'arterialPH',
  'bicarbonate',
  'haemoglobin',
  'urea',
  'creatinine',
  'bnp',
];

export const CHEMISTRY_DEFAULTS: ChemistryPublicState = {
  potassium: 4.0,
  calcium: 2.40,
  sodium: 140,
  chloride: 102,
  glucose: 5.0,
  albumin: 42,
  urea: 5.0,
  creatinine: 80,
  magnesium: 0.85,
  arterialPH: 7.40,
  paCO2: 5.3,
  paO2: 12.0,
  bicarbonate: 24,
  lactate: 1.0,
  haemoglobin: 150,
  mcv: 90,
  whiteCellCount: 7.0,
  platelets: 250,
  troponin: 5,
  bnp: 40,
};

/** Map between legacy lab panel keys and chemistry public fields. */
export const LAB_KEY_TO_CHEMISTRY: Record<string, keyof ChemistryPublicState> = {
  K: 'potassium',
  Ca: 'calcium',
  Na: 'sodium',
  Cl: 'chloride',
  glucose: 'glucose',
  albumin: 'albumin',
  urea: 'urea',
  creat: 'creatinine',
  Mg: 'magnesium',
  pH: 'arterialPH',
  PaCO2: 'paCO2',
  PaO2: 'paO2',
  HCO3: 'bicarbonate',
  lactate: 'lactate',
  Hb: 'haemoglobin',
  MCV: 'mcv',
  WCC: 'whiteCellCount',
  platelets: 'platelets',
  troponin: 'troponin',
  BNP: 'bnp',
};

export const CHEMISTRY_TO_LAB_KEY: Record<keyof ChemistryPublicState, string> = Object.fromEntries(
  Object.entries(LAB_KEY_TO_CHEMISTRY).map(([lab, chem]) => [chem, lab]),
) as Record<keyof ChemistryPublicState, string>;

export function chemistryToLabBag(c: ChemistryPublicState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [lab, chem] of Object.entries(LAB_KEY_TO_CHEMISTRY)) {
    out[lab] = c[chem];
  }
  return out;
}

export function labBagToChemistryPatch(bag: Record<string, number>): Partial<ChemistryPublicState> {
  const out: Partial<ChemistryPublicState> = {};
  for (const [k, v] of Object.entries(bag)) {
    const chem = LAB_KEY_TO_CHEMISTRY[k];
    if (chem && typeof v === 'number') out[chem] = v;
  }
  return out;
}
