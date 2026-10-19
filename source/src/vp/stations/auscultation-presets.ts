import type { LocalizedText } from '../model/i18n.ts';
import type { PatientModel } from '../physiology/state.ts';

/* ---------------------------------------------------------------------------
   Named starting points for the auscultation station (ADR-017 step 4).

   Each is a patient, not a sound: a few haemodynamic parameters changed on a
   healthy adult. What the stethoscope then hears is the examination model's
   reading of the circulation that results. A preset is named by the
   severity its circulation reaches by the guidelines' own measures (a test
   checks it): a peak aortic gradient, a mean mitral gradient, a regurgitant
   fraction, an ejection fraction. Where the model cannot reach a category
   (severe regurgitation sits at its largest orifice), the preset is named
   by the category it does reach.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface AuscPreset {
  id: string;
  label: LocalizedText;
  /** circulation parameters laid over a healthy adult's */
  circulation: Record<string, number>;
  /** the guideline measure the preset is named by, and the range it must fall in (checked by the station tests) */
  check: { measure: 'peakAorticGradient' | 'meanMitralGradient' | 'regurgFraction' | 'ejectionFraction'; range: [number, number]; refs: string[] };
}

export const AUSC_PRESETS: AuscPreset[] = [
  { id: 'as-moderate', label: L('Aortic stenosis, moderate', 'Aortenstenose, mittelgradig'), circulation: { Raortic: 0.15 },
    check: { measure: 'peakAorticGradient', range: [36, 64], refs: ['bonow2006'] } },
  { id: 'as-severe', label: L('Aortic stenosis, severe', 'Aortenstenose, hochgradig'), circulation: { Raortic: 0.3 },
    check: { measure: 'peakAorticGradient', range: [64, 200], refs: ['bonow2006'] } },
  { id: 'ms-moderate', label: L('Mitral stenosis, moderate', 'Mitralstenose, mittelgradig'), circulation: { Rmitral: 0.05 },
    check: { measure: 'meanMitralGradient', range: [5, 10], refs: ['bonow2006'] } },
  { id: 'ms-severe', label: L('Mitral stenosis, severe', 'Mitralstenose, hochgradig'), circulation: { Rmitral: 0.08 },
    check: { measure: 'meanMitralGradient', range: [10, 40], refs: ['bonow2006'] } },
  { id: 'ar-moderate', label: L('Aortic regurgitation, moderate', 'Aorteninsuffizienz, mittelgradig'), circulation: { regAortic: 0.9 },
    check: { measure: 'regurgFraction', range: [30, 50], refs: ['zoghbi2017'] } },
  { id: 'mr-moderate', label: L('Mitral regurgitation, moderate', 'Mitralinsuffizienz, mittelgradig'), circulation: { regMitral: 0.9 },
    check: { measure: 'regurgFraction', range: [30, 50], refs: ['zoghbi2017'] } },
  { id: 'dilated-failing', label: L('Dilated, failing left ventricle', 'Dilatierter, versagender linker Ventrikel'), circulation: { Emax: 0.5, edpV0: 110, edpV30: 200 },
    check: { measure: 'ejectionFraction', range: [0, 40], refs: ['mcdonagh2021'] } },
];

export const AUSC_PRESET_GROUPS: Array<{ group: LocalizedText; ids: string[] }> = [
  { group: L('Stenosis', 'Stenose'), ids: ['as-moderate', 'as-severe', 'ms-moderate', 'ms-severe'] },
  { group: L('Regurgitation', 'Insuffizienz'), ids: ['ar-moderate', 'mr-moderate'] },
  { group: L('Ventricle', 'Ventrikel'), ids: ['dilated-failing'] },
];

/** The preset laid over a healthy patient's circulation (other settings are kept). */
export function applyAuscPreset(m: PatientModel, healthyCirculation: PatientModel['circulation'], id: string): PatientModel {
  const p = AUSC_PRESETS.find((x) => x.id === id);
  const valves = ['Raortic', 'regAortic', 'Rmitral', 'regMitral', 'Rtricuspid', 'regTricuspid', 'Rpulmonic', 'regPulmonic', 'Emax', 'V0', 'edpV0', 'edpV30'];
  const circulation = { ...m.circulation };
  for (const k of valves) (circulation as any)[k] = (healthyCirculation as any)[k];
  return { ...m, circulation: { ...circulation, ...(p?.circulation ?? {}) } };
}
