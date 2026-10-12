import { CHEMISTRY_DEFAULTS, type ChemistryPublicState } from '../../models/chemistry/public-state.ts';
import { deriveChemistryFromHaemodynamics } from '../../models/chemistry/derive-from-haemodynamics.ts';
import { hco3At, phOf, type RespSnapshot } from './lung/respiratory.ts';

/* ---------------------------------------------------------------------------
   Body fluids, electrolytes and acid–base: the chemistry model's state for a
   patient. Healthy defaults, then what the circulation does to them
   (hypoperfusion raises lactate and lowers bicarbonate, haemorrhage dilutes
   haemoglobin, a poorly perfused kidney retains urea), then any values the
   case or the learner has pinned.

   Acid–base is two-sided. The metabolic side is the bicarbonate the body
   holds (standard bicarbonate: derived or pinned here). The respiratory
   side is the arterial CO2, which the lungs set. pH follows from both by
   Henderson–Hasselbalch, and the bicarbonate a laboratory measures is the
   metabolic level plus what CO2 itself generates by buffering.

   Laboratory tests measure this state; they never define it.
--------------------------------------------------------------------------- */

export type Chemistry = ChemistryPublicState & {
  anionGap: number; derived: string[];
  /** Metabolic bicarbonate, at a normal CO2 (the 'standard bicarbonate'). */
  standardBicarbonate: number;
  baseExcess: number;
  /** Co-oximetry: fractions of total haemoglobin. */
  saO2: number; fO2Hb: number; coHb: number; metHb: number;
};

/** Simulation snapshot → chemistry. Respiratory gases come from the respiratory model when it is running. */
export function chemistryState(snapshot: Record<string, any> | undefined, pins: Record<string, number> = {}, resp?: RespSnapshot): Chemistry {
  const s: ChemistryPublicState = { ...CHEMISTRY_DEFAULTS };
  const derived: string[] = [];
  if (snapshot) {
    const m = snapshot.metrics ?? {};
    const { statePatch, active } = deriveChemistryFromHaemodynamics({
      meanArterialPressure: m.Pmean ?? null, systolicPressure: m.Psys ?? null, diastolicPressure: m.Pdia ?? null,
      pulsePressure: m.PP ?? null, heartRate: m.HRbeat ?? null, strokeVolume: m.SV ?? null, cardiacOutput: m.CO ?? null,
      ejectionFraction: m.EF ?? null, centralVenousPressure: m.CVPmean ?? null, leftAtrialPressure: m.PlaMean ?? null,
      pulmonaryArteryPressure: m.PpaSys ?? null, pulmonaryArteryMean: m.PpaMean ?? null, meanFillingPressure: snapshot.Pmsf ?? null,
      bloodVolume: snapshot.bloodVolume ?? null, systemicVascularResistance: m.SVR ?? null, baroreflexEnabled: !!snapshot.baroEnabled,
    } as any);
    Object.assign(s, statePatch);
    derived.push(...active.map((a) => a.id));
  }
  Object.assign(s, pins);
  if (snapshot?.K != null && pins.potassium == null) s.potassium = snapshot.K;
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
  };
}

/** Values every chemistry consumer needs before the lungs have run: what the respiratory model reads. */
export function chemistryInputs(snapshot: Record<string, any> | undefined, pins: Record<string, number> = {}) {
  const c = chemistryState(snapshot, pins);
  return { Hb: c.haemoglobin, sbc: c.standardBicarbonate, albumin: c.albumin };
}

/** pH from Henderson–Hasselbalch (PaCO2 in kPa; solubility 0.23 mmol/L/kPa). */
export const hendersonHasselbalch = (hco3: number, paCO2kPa: number) => 6.1 + Math.log10(hco3 / (0.23 * paCO2kPa));
