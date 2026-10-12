import { CHEMISTRY_DEFAULTS, type ChemistryPublicState } from '../../models/chemistry/public-state.ts';
import { deriveChemistryFromHaemodynamics } from '../../models/chemistry/derive-from-haemodynamics.ts';
import { hco3At, phOf, type RespSnapshot } from './lung/respiratory.ts';
import type { BodySnapshot } from './body/body.ts';

/* ---------------------------------------------------------------------------
   Plasma chemistry: what a laboratory would find in the blood now.

   The body model (physiology/body/body.ts) holds the amounts and gives the
   concentrations: sodium, potassium, chloride, the metabolic bicarbonate,
   glucose, urea, creatinine, lactate, ketones, albumin, haemoglobin. The
   lungs give the arterial gases. pH follows from both by
   Henderson–Hasselbalch, and the bicarbonate a laboratory measures is the
   metabolic level plus what CO₂ itself generates by buffering.

   What no model yet produces (troponin, MCV) comes
   from the case's clamped values or the healthy default; natriuretic
   peptide is still derived from cardiac wall stress. The learner may clamp
   any value in the Model Lab as an experiment; a case may only clamp what no
   model produces.

   Laboratory tests measure this state; they never define it.
--------------------------------------------------------------------------- */

export type Chemistry = ChemistryPublicState & {
  anionGap: number; derived: string[];
  /** Metabolic bicarbonate, at a normal CO2 (the 'standard bicarbonate'). */
  standardBicarbonate: number;
  baseExcess: number;
  ketones: number; betaHydroxybutyrate: number; phosphate: number; osmolality: number;
  /** Co-oximetry: fractions of total haemoglobin. */
  saO2: number; fO2Hb: number; coHb: number; metHb: number;
};

/** Plasma values the body model produces: a case cannot clamp them, only set their causes. */
export const BODY_OUTPUTS = ['sodium', 'potassium', 'chloride', 'bicarbonate', 'glucose', 'urea', 'creatinine', 'lactate', 'albumin', 'haemoglobin', 'phosphate', 'ketones', 'osmolality', 'whiteCellCount', 'crp', 'platelets', 'mcv'];

/** Simulation snapshot → chemistry. */
export function chemistryState(snapshot: Record<string, any> | undefined, pins: Record<string, number> = {}, resp?: RespSnapshot): Chemistry {
  const s: ChemistryPublicState & Record<string, number> = { ...CHEMISTRY_DEFAULTS, ketones: 0.05, betaHydroxybutyrate: 0.04, phosphate: 1.0, osmolality: 290 } as any;
  const derived: string[] = [];
  const b = snapshot?.body as BodySnapshot | undefined;
  if (snapshot) {
    const m = snapshot.metrics ?? {};
    const { statePatch } = deriveChemistryFromHaemodynamics({
      meanArterialPressure: m.Pmean ?? null, ejectionFraction: m.EF ?? null, leftAtrialPressure: m.PlaMean ?? null, cardiacOutput: m.CO ?? null, bloodVolume: 5000,
    } as any);
    if (statePatch.bnp != null) { s.bnp = statePatch.bnp; if (statePatch.bnp > 100) derived.push('heart-failure-bnp'); }
  }
  if (b) {
    Object.assign(s, {
      sodium: b.sodium, potassium: b.potassium, chloride: b.chloride, bicarbonate: b.standardBicarbonate, glucose: b.glucose,
      urea: b.urea, creatinine: b.creatinine, lactate: b.lactate, albumin: b.albumin, haemoglobin: b.haemoglobin,
      ketones: b.ketones, betaHydroxybutyrate: b.betaHydroxybutyrate, phosphate: b.phosphate, osmolality: b.osmolality,
      whiteCellCount: b.whiteCellCount, crp: b.crp, platelets: b.platelets, temperature: b.temperature, mcv: b.mcv,
      bilirubin: b.bilirubin, alt: b.alt, alp: b.alp, ggt: b.ggt, inr: b.inr, ammonia: b.ammonia, ferritin: b.ferritin, reticulocytes: b.reticulocytes, b12: b.b12, ldh: b.ldh, haptoglobin: b.haptoglobin,
    });
    derived.push('body');
  }
  Object.assign(s, pins);
  const r = resp ?? (snapshot?.resp as RespSnapshot | undefined);
  const sbc = s.bicarbonate;
  if (r) { s.paCO2 = r.PaCO2; s.paO2 = r.PaO2; }
  const hco3 = hco3At(sbc, s.paCO2);
  s.bicarbonate = hco3;
  s.arterialPH = phOf(hco3, s.paCO2);
  const be = 0.93 * (hco3 - 24.4 + 14.83 * (s.arterialPH - 7.4));
  return {
    ...s, anionGap: s.sodium - (s.chloride + hco3), derived, standardBicarbonate: sbc, baseExcess: be,
    saO2: r ? r.SaO2 : 0.97, fO2Hb: r ? r.FO2Hb : 0.955, coHb: r ? r.COHb : 0.01, metHb: r ? r.metHb : 0.005,
  } as Chemistry;
}

/** pH from Henderson–Hasselbalch (PaCO2 in kPa; solubility 0.23 mmol/L/kPa). */
export const hendersonHasselbalch = (hco3: number, paCO2kPa: number) => 6.1 + Math.log10(hco3 / (0.23 * paCO2kPa));
