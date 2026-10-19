import type { LocalizedText } from '../model/i18n.ts';
import { applyPreset, type PatientModel } from '../physiology/state.ts';

/* ---------------------------------------------------------------------------
   Named starting points for the pulse and neck-vein station.

   Each is a patient: a few haemodynamic parameters, or a rhythm, on a
   healthy adult. What the finger feels and the eye sees in the neck is the
   examination model's reading of the waves the circulation then makes.
   Each names the textbook signs it should bring; a station test checks the
   model brings them.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface PulsePreset {
  id: string;
  label: LocalizedText;
  /** circulation parameters laid over a healthy adult's */
  circulation?: Record<string, number>;
  /** an electrical preset (rhythm, conduction) */
  rhythm?: string;
  /** the textbook signs (checked by the station tests) */
  signs: string[];
}

export const PULSE_PRESETS: PulsePreset[] = [
  { id: 'as-severe', label: L('Aortic stenosis, severe', 'Aortenstenose, hochgradig'), circulation: { Raortic: 0.3 }, signs: ['slow-rising-pulse'] },
  { id: 'ar-moderate', label: L('Aortic regurgitation, moderate', 'Aorteninsuffizienz, mittelgradig'), circulation: { regAortic: 0.9 }, signs: ['collapsing-pulse', 'wide-pulse-pressure'] },
  { id: 'pulmonary-hypertension', label: L('Pulmonary hypertension', 'Pulmonale Hypertonie'), circulation: { Rpul: 0.4 }, signs: ['raised-jvp'] },
  { id: 'tr-severe', label: L('Tricuspid regurgitation, severe', 'Trikuspidalinsuffizienz, hochgradig'), circulation: { regTricuspid: 0.9 }, signs: ['large-v-waves'] },
  { id: 'af', label: L('Atrial fibrillation', 'Vorhofflimmern'), rhythm: 'af', signs: ['irregularly-irregular-pulse', 'absent-a-waves'] },
  { id: 'chb', label: L('Complete heart block', 'AV-Block III°'), rhythm: 'chb', signs: ['cannon-a-waves'] },
  { id: 'vt', label: L('Ventricular tachycardia', 'Ventrikuläre Tachykardie'), rhythm: 'vt', signs: ['cannon-a-waves'] },
  { id: 'wenckebach', label: L('Second-degree AV block, Wenckebach', 'AV-Block II°, Typ Wenckebach'), rhythm: 'wenckebach', signs: ['regularly-irregular-pulse'] },
];

export const PULSE_PRESET_GROUPS: Array<{ group: LocalizedText; ids: string[] }> = [
  { group: L('The arterial pulse', 'Der arterielle Puls'), ids: ['as-severe', 'ar-moderate'] },
  { group: L('Rhythm', 'Rhythmus'), ids: ['af', 'wenckebach', 'chb', 'vt'] },
  { group: L('The neck veins', 'Die Halsvenen'), ids: ['pulmonary-hypertension', 'tr-severe'] },
];

/** A healthy adult (the given model's patient) with this preset's change. */
export function applyPulsePreset(m: PatientModel, healthyCirculation: Record<string, number>, id: string): PatientModel {
  const p = PULSE_PRESETS.find((x) => x.id === id);
  let next = applyPreset(structuredClone(m), 'normal');
  next.circulation = { ...healthyCirculation, ...(p?.circulation ?? {}) };
  if (p?.rhythm) next = applyPreset(next, p.rhythm);
  return next;
}
