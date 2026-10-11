import { CHEMISTRY_DEFAULTS, type ChemistryPublicState } from '../../models/chemistry/public-state.ts';
import { deriveChemistryFromHaemodynamics } from '../../models/chemistry/derive-from-haemodynamics.ts';

/* ---------------------------------------------------------------------------
   Body fluids, electrolytes and acid–base: the chemistry model's state for a
   patient. Healthy defaults, then what the circulation does to them
   (hypoperfusion raises lactate and lowers bicarbonate, haemorrhage dilutes
   haemoglobin, a poorly perfused kidney retains urea), then any values the
   case or the learner has pinned. Laboratory tests measure this state; they
   never define it.
--------------------------------------------------------------------------- */

export type Chemistry = ChemistryPublicState & { anionGap: number; derived: string[] };

export function chemistryState(snapshot: Record<string, any> | undefined, pins: Record<string, number> = {}): Chemistry {
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
  return { ...s, anionGap: s.sodium - (s.chloride + s.bicarbonate), derived };
}

/** pH from Henderson–Hasselbalch (PaCO2 in kPa; solubility 0.23 mmol/L/kPa). */
export const hendersonHasselbalch = (hco3: number, paCO2kPa: number) => 6.1 + Math.log10(hco3 / (0.23 * paCO2kPa));
