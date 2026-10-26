import type { LocalizedText } from '../model/i18n.ts';
import type { PatientModel } from '../physiology/state.ts';
import { RESPIRATORY_DEFAULTS } from '../physiology/lung/respiratory.ts';

/* ---------------------------------------------------------------------------
   Named starting points for the respiratory station.

   Each is a patient: a few parameters of the lungs, the pleura, the airways,
   the muscles or the heart, changed on a healthy adult. What the hands and
   the stethoscope then find is the examination model's reading of the lungs
   that result. Each names the textbook signs it should bring; a station test
   checks the model brings them, and that no two look alike at the bedside.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface RespPreset {
  id: string;
  label: LocalizedText;
  /** respiratory parameters laid over a healthy adult's */
  respiratory?: Record<string, number>;
  /** circulation parameters laid over a healthy adult's (the heart behind the lungs) */
  circulation?: Record<string, number>;
  /** the textbook signs (checked by the station tests) */
  signs: string[];
}

/** The circulation settings a preset may change, put back to health before another is applied. */
const HEART = ['Emax', 'edpV0', 'edpV30'];

export const RESP_PRESETS: RespPreset[] = [
  { id: 'pneumonia-rll', label: L('Pneumonia, right lower lobe', 'Pneumonie, rechter Unterlappen'), respiratory: { consRLL: 0.85 }, signs: ['tachypnoea', 'dull-percussion', 'bronchial-breathing', 'coarse-crackles', 'increased-vocal-resonance', 'reduced-chest-expansion'] },
  { id: 'collapse-rul', label: L('Collapse of the right upper lobe', 'Atelektase des rechten Oberlappens'), respiratory: { collRUL: 0.9 }, signs: ['tracheal-deviation', 'dull-percussion', 'reduced-breath-sounds', 'reduced-vocal-resonance'] },
  { id: 'collapse-lll', label: L('Collapse of the left lower lobe', 'Atelektase des linken Unterlappens'), respiratory: { collLLL: 0.9 }, signs: ['dull-percussion', 'reduced-breath-sounds', 'reduced-vocal-resonance', 'reduced-chest-expansion'] },
  { id: 'fibrosis', label: L('Pulmonary fibrosis', 'Lungenfibrose'), respiratory: { fibrosis: 0.6 }, signs: ['fine-crackles', 'reduced-chest-expansion', 'tachypnoea'] },
  { id: 'ards', label: L('Acute respiratory distress syndrome', 'Akutes Lungenversagen (ARDS)'), respiratory: { capillaryLeak: 0.7 }, signs: ['fine-crackles', 'hypoxaemia', 'central-cyanosis', 'tachypnoea', 'accessory-muscle-use'] },
  { id: 'effusion-r', label: L('Pleural effusion, right, large', 'Pleuraerguss rechts, groß'), respiratory: { effusionR: 2000 }, signs: ['stony-dull-percussion', 'reduced-breath-sounds', 'reduced-vocal-resonance', 'tracheal-deviation', 'bronchial-breathing'] },
  { id: 'ptx-l', label: L('Pneumothorax, left', 'Pneumothorax links'), respiratory: { ptxL: 0.6 }, signs: ['hyper-resonant-percussion', 'reduced-breath-sounds', 'reduced-chest-expansion'] },
  { id: 'tension-r', label: L('Tension pneumothorax, right', 'Spannungspneumothorax rechts'), respiratory: { ptxR: 0.95, tensionR: 12 }, signs: ['tracheal-deviation', 'hyper-resonant-percussion', 'reduced-breath-sounds', 'hypoxaemia', 'tachypnoea'] },
  { id: 'asthma', label: L('Acute asthma', 'Akutes Asthma'), respiratory: { bronchoconstriction: 0.5 }, signs: ['wheeze', 'tachypnoea'] },
  { id: 'asthma-lt', label: L('Life-threatening asthma', 'Lebensbedrohliches Asthma'), respiratory: { bronchoconstriction: 0.85 }, signs: ['reduced-breath-sounds', 'speech-limited', 'accessory-muscle-use', 'hypoxaemia'] },
  { id: 'copd', label: L('COPD, emphysema', 'COPD, Emphysem'), respiratory: { emphysema: 0.6, bronchoconstriction: 0.25 }, signs: ['hyper-resonant-percussion', 'wheeze', 'pursed-lip-breathing', 'barrel-chest', 'accessory-muscle-use'] },
  { id: 'oedema', label: L('Pulmonary oedema (failing left ventricle)', 'Lungenödem (versagender linker Ventrikel)'), circulation: { Emax: 0.5, edpV0: 110, edpV30: 200 }, signs: ['fine-crackles', 'tachypnoea'] },
  { id: 'pe', label: L('Pulmonary embolism, both lower lobes', 'Lungenembolie, beide Unterlappen'), respiratory: { embRLL: 1, embLLL: 1, embRML: 0.8 }, signs: ['tachypnoea', 'hypoxaemia'] },
  { id: 'weak', label: L('Weak respiratory muscles', 'Schwache Atemmuskulatur'), respiratory: { muscleStrength: 0.3 }, signs: ['paradoxical-breathing', 'tachypnoea', 'accessory-muscle-use'] },
];

export const RESP_PRESET_GROUPS: Array<{ group: LocalizedText; ids: string[] }> = [
  { group: L('The lung', 'Die Lunge'), ids: ['pneumonia-rll', 'collapse-rul', 'collapse-lll', 'fibrosis', 'ards'] },
  { group: L('The pleura', 'Die Pleura'), ids: ['effusion-r', 'ptx-l', 'tension-r'] },
  { group: L('The airways', 'Die Atemwege'), ids: ['asthma', 'asthma-lt', 'copd'] },
  { group: L('Heart, vessels and muscles', 'Herz, Gefäße und Muskeln'), ids: ['oedema', 'pe', 'weak'] },
];

/** The preset laid over a healthy patient: the lungs back to health, the heart's settings a preset may change back to
    the healthy circulation's, then the preset's own changes (other settings are kept). */
export function applyRespPreset(m: PatientModel, healthyCirculation: PatientModel['circulation'], id: string): PatientModel {
  const p = RESP_PRESETS.find((x) => x.id === id);
  const circulation = { ...m.circulation };
  for (const k of HEART) (circulation as any)[k] = (healthyCirculation as any)[k];
  return {
    ...m,
    respiratory: { ...RESPIRATORY_DEFAULTS, FiO2: m.respiratory.FiO2, ...(p?.respiratory ?? {}) },
    circulation: { ...circulation, ...(p?.circulation ?? {}) },
  };
}
